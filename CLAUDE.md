# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## What This Is

A Chrome extension (Manifest V3) that overlays IMDb, Rotten Tomatoes, Metacritic and TMDB ratings on **Netflix and Disney+** title cards, fetched via the [OMDb API](https://www.omdbapi.com/) and, optionally, [TMDB](https://www.themoviedb.org/). It also filters tiles by list membership (IMDb / Letterboxd) and by score.

## No Build Step

Plain JS/CSS — no bundler, nothing to compile. Edit files directly and reload in `chrome://extensions/`.

`package.json` + `node_modules/` exist **only** for the test suite (`npm test`, jsdom as the single devDependency). Nothing under `tests/` is loaded by the extension; never introduce a build/bundle step for shipped code.

## Architecture

```
manifest.json       Extension config (MV3)
background.js       Service worker — all OMDb/TMDB/list fetch calls
content.js          Injected into Netflix — scans cards, injects badges
ratings.css         Badge styles
popup.html/js       Popup UI (API keys, prefs, ranking, filters, i18n)
tests/              node:test + jsdom; loads the shipped sources unmodified
```

**Key design:** All `fetch()` calls go through `background.js`. Netflix's CSP blocks fetch from content scripts. `content.js` uses `chrome.runtime.sendMessage` to delegate.

**Naming:** The extension is platform-neutral ("Stream Rating Overlay"); the repo folder and the `nro_*` storage prefix keep the historical name.

## Data Flow

1. `content.js` scans DOM for title cards
2. Sends `{ type: 'fetchRatings', title, year, detail, apiKey }` to `background.js`
3. `background.js` checks `chrome.storage.local` cache (7-day TTL / 24-hour TTL for misses)
4. On miss, fetches from the configured provider and caches the result
5. Returns `{ imdb, tmdb, rt, mc, awards, imdbID, type, title, year, full }` to `content.js`
6. `content.js` injects `.nro-badge` into the card

## Key Implementation Details

- **Card selectors:** `selectorCards(scope)` (known hooks: `.title-card-container`, `.slider-item`, `[data-uia*="title-card"]`, `[data-uia*="video-card"]`, `[class*="titleCard"]`…) unioned by `heuristicScan()` with `heuristicCards()` — a structural fallback that finds tiles by artwork `<img>` inside a `/watch/`, `/title/` or `jbv=` link. Survives Netflix class renames; billboard/preview-modal areas are excluded via `isSpecialArea()`
- **Scan scheduling:** The MutationObserver collects changed subtrees in `dirtyRoots`; the debounced `runScan()` runs the cheap selector pass **only within those subtrees** (falling back to one document pass past `SCOPED_ROOT_LIMIT`). The heuristic pass reads `offsetWidth`/`offsetHeight`, so it's throttled to 2s and deferred to `requestIdleCallback`
- **Badge anchoring:** `findBadgeContainer()` tries legacy class hooks, then `artworkBox()` — the closest ancestor of the artwork whose box matches the image within 15%. Keeps badges on the poster when classes change
- **Layout diagnostics:** `reportLayout()` writes `nro_layout` ({mode: known/mixed/adaptive/none, count}); popup renders it under the list filter
- **Duplicate prevention:** `pendingTitles` Set prevents redundant in-flight requests; cards that lose the race register in the `waiting` Map (title → Set of cards) and are updated directly by `settleTitle()` when the fetch lands — there is no full-page rescan
- **DOM recycling:** `dataset.nroTitle` detects recycled cards with new titles
- **Badge placement:** `position: absolute; bottom: 4px` on `.title-card` container; billboard/hover use `position: static`
- **External links:** Hover/billboard badges only (`isHover=true`). Small cards: `pointer-events: none`
- **i18n:** `zh-*` → Chinese, all others → English. The `i18n` object in `popup.js` has a `zh` and an `en` half — **add every new key to both**, or the other locale silently renders the raw HTML default. Static markup uses `data-i18n` / `data-i18n-placeholder`; dynamic strings are functions (`t.quota_label(n, max)`)
- **Title cleaning:** `cleanTitle()` strips platform decoration from alt/aria text (`"Loki | Disney+"`, `"Andor – poster"`, `"觀看 X"`). English verb prefixes ("Watch…", "Play…") are deliberately kept — they're indistinguishable from real titles (Play Dirty, Watch Dogs) and a wrong strip poisons the cache key
- **TMDB (optional, `tmdb_api_key`):** localized titles (non-Latin script per `isLocalizedTitle()`) go TMDB `search/multi` → `external_ids` → IMDb ID → OMDb `?i=`. Latin titles try OMDb `?t=` first and only fall back to TMDB on a miss. Quota/invalid-key errors skip the fallback (`isFatalOmdbError`). Status in `nro_tmdb_status`. `pickTmdbResult()` ranks results by exact title match → year → TMDB's own order, and searches carry `language=` from `navigator.language`
- **Source mode (`nro_prefs.source`):** `'omdb'` (default) or `'tmdb'`. In TMDB mode `fetchViaTmdb()` supplies score/year/type for grid tiles with **zero** OMDb calls, and OMDb is only queried by IMDb ID when `detail` is set (hover modal / billboard) to fill RT, MC and awards. `data.full` marks an OMDb-enriched record; `data.detailTried` marks an attempt that couldn't be enriched, which is what stops the detail view refetching forever. `cacheHit(entry, detail)` in `content.js` is the other half of that contract
- **Score threshold (`nro_prefs.minScore` / `minSource`):** applied in `applyFilters()` alongside the list filters and in the popup ranking. `thresholdScore()` reads `imdb`, falling back to `tmdb` (same 0–10 scale), or `rt`/`mc` as percentages. **A title with no score is never filtered** — a missing rating is not a bad rating. Duplicated in `content.js` and `popup.js`, keep in sync
- **OMDb quota meter:** `bumpQuota()` in `omdbFetch()` counts every outgoing call into `nro_quota { day, count }` (UTC day, debounced write, resets on rollover). Popup renders it as `used N / 1000`
- **Persistent id map (`nro_idmap`):** `title|year` → `{ imdbID, tmdbId, mediaType, ts }`. Never expires (an IMDb ID doesn't change), capped at 3,000 with oldest-first trimming. Kept out of `nro_cache` precisely so LRU eviction there doesn't force another TMDB round-trip
- **Movie/TV split:** From OMDb `json.Type` ("movie" / "series"), or TMDB `media_type` (`tv` → `series`). Entries missing `type` fall into Movie list as default.
- **Cache migration:** Entries missing `type` are re-fetched regardless of TTL
- **Cache race fix:** In-memory cache in `background.js` with debounced flush; `flushNow()` called immediately after each API write
- **Cache TTL:** 7 days for hits, 24h for misses. No active expiry sweep — expired entries stay until re-queried or LRU eviction.
- **Cache size:** Max 500 entries; LRU eviction down to 450 when exceeded (`evictIfNeeded`)
- **Rate limiting:** Max 3 concurrent OMDb requests across all tabs via `rateLimitedFetch` queue
- **Exclude list:** Stored in `nro_exclude` (chrome.storage.local). Populated via IMDb/Letterboxd CSV import or Netflix viewing activity sync (background tab, auto load-more, auto-close). Per-title restore or restore-all in popup.
- **List filter:** `nro_lists` = `{ include: {url, site, ids, titles, count, ts}, exclude: {…} }`, `nro_list_settings` = `{ includeOn, excludeOn, mode: 'dim'|'hide' }`. Include = show only list members; exclude = hide list members; both independent and live-toggled via `chrome.storage.onChanged`. Matching is imdbID first, then normalized title (`titleKeys()` — duplicated verbatim in `content.js` and `popup.js`, keep in sync). Applied to page tiles (`.nro-filtered` / `.nro-filtered-hide`) and to the popup ranking. Include-mode only filters once rating data has resolved (or when there's no API key), to avoid flicker.
- **IMDb list loading:** `background.js` tries `fetch` with `credentials: 'include'` first; IMDb answers cookie-less requests with an AWS WAF JS challenge (HTTP 202, `awsWafCookieDomainList` in body), so the fallback opens a background tab and reads `__NEXT_DATA__` + `a[href*="/title/tt"]` via `chrome.scripting.executeScript`, paging through `?page=N`, then closes the tab. Retries back off, and pages after the first give up quickly so an empty page doesn't cost the full budget. Background writes `nro_lists` itself so a load survives the popup closing. Needs `scripting` permission + `https://www.imdb.com/*` host permission.
- **Letterboxd list loading:** `/user/list/name/`, `/user/watchlist/`, `/user/films/`. No WAF, so `fetchLetterboxdDirect()` (plain HTML, `/page/N/`, up to 20 pages) is the path that normally runs; the tab fallback shares the same machinery with `scrapeLetterboxdInPage`. The markup carries **no IMDb IDs**, so these lists match on title alone — `parseLetterboxdList()` collects `data-film-name`/`data-item-name`, poster `img.image[alt]`, and slugs (both with and without a trailing disambiguating year).
- **List auto-refresh:** `chrome.alarms` `nro_list_refresh` every 6h → `refreshStaleLists()` re-loads any list older than 7 days. Passes `keepSwitch` so a refresh never re-enables a list the user switched off. Needs the `alarms` permission.

## Storage Keys

`docs/WORKFLOW.md` holds the authoritative table (shape, writer, lifetime for all 12 keys). Update it whenever a key is added or its shape changes.

## OMDb API Limits

Free tier: 1,000 requests/day. Both hits and misses cached. On limit error, returns null until UTC midnight reset. `nro_prefs.source = 'tmdb'` exists to keep browsing off this budget entirely.

## Tests

```
npm install && npm test      # node:test + jsdom
```

```
tests/helpers/load.js         loads the shipped sources (vm for background, jsdom for content/popup)
tests/helpers/chrome-stub.js  chrome.* stub + routed fetch
tests/parsers.test.js         URL normalisation, list/OMDb parsing, TMDB result ranking
tests/fetch-flow.test.js      provider ordering, caching, quota, id map
tests/lists.test.js           Letterboxd direct load, IMDb tab fallback, weekly refresh
tests/content.test.js         card detection, badge anchoring, recycling, title index
tests/filters.test.js         list + threshold filtering on page tiles
tests/popup.test.js           popup rendering, prefs wiring, i18n, escaping
tests/manifest.test.js        permissions/hosts vs. what the code actually uses
```

Tests load the shipped sources **unmodified**, so top-level `function` declarations are the test surface; module state is driven through the `chrome.storage` stub, as in the real extension. Two harness details that matter:

- jsdom reports `offsetWidth`/`offsetHeight` as 0, so the harness maps them to `data-w`/`data-h` attributes — layout-dependent tests must declare boxes that way.
- **Storage callbacks in the stub fire asynchronously on purpose.** Chrome never delivers them synchronously, and making them sync once hid a real TDZ crash in `popup.js`. Don't "simplify" this.

Run the suite after touching card detection, badge anchoring, the fetch pipeline, list parsing or the filters — it is the only mechanism that catches a layout/API regression at edit time.

## Documentation Maintenance Rule

README.md and docs/*.md must always have both English and Chinese versions in sync. English first, `---` divider, then Chinese. A change to one half is not done until the other half says the same thing.

Single-language by design: **CLAUDE.md** (English, for agents) and **TODO.md** (Chinese, the owner's working list). Don't bilingualise those.

When a feature lands, update all of: `README.md` (both halves), `docs/WORKFLOW.md` (both halves, including the storage-key table), `TODO.md`, this file, and `manifest.json`'s `version` + `description` — `package.json`'s version must match the manifest, and `tests/manifest.test.js` enforces that.
