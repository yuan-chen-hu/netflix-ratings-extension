# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## What This Is

A Chrome extension (Manifest V3) that overlays IMDb, Rotten Tomatoes, and Metacritic ratings on Netflix title cards, fetched via the [OMDb API](https://www.omdbapi.com/).

## No Build Step

Plain JS/CSS — no bundler, no npm. Edit files directly and reload in `chrome://extensions/`.

## Architecture

```
manifest.json       Extension config (MV3)
background.js       Service worker — all OMDb API fetch calls
content.js          Injected into Netflix — scans cards, injects badges
ratings.css         Badge styles
popup.html/js       Popup UI (API key, ranking, i18n)
```

**Key design:** All `fetch()` calls go through `background.js`. Netflix's CSP blocks fetch from content scripts. `content.js` uses `chrome.runtime.sendMessage` to delegate.

**Naming:** The extension is platform-neutral ("Stream Rating Overlay"); the repo folder and the `nro_*` storage prefix keep the historical name.

## Data Flow

1. `content.js` scans DOM for title cards
2. Sends `{ type: 'fetchRatings', title, apiKey }` to `background.js`
3. `background.js` checks `chrome.storage.local` cache (7-day TTL / 24-hour TTL for misses)
4. On miss, fetches OMDb and caches result
5. Returns `{ imdb, rt, mc, awards, imdbID, type, title, year }` to `content.js`
6. `content.js` injects `.nro-badge` into the card

## Key Implementation Details

- **Card selectors:** `NF_CARD_SELECTORS` (known hooks: `.title-card-container`, `.slider-item`, `[data-uia*="title-card"]`, `[data-uia*="video-card"]`, `[class*="titleCard"]`…) unioned with `heuristicCards()` — a structural fallback that finds tiles by artwork `<img>` inside a `/watch/`, `/title/` or `jbv=` link. Survives Netflix class renames; billboard/preview-modal areas are excluded via `isSpecialArea()`
- **Badge anchoring:** `findBadgeContainer()` tries legacy class hooks, then `artworkBox()` — the closest ancestor of the artwork whose box matches the image within 15%. Keeps badges on the poster when classes change
- **Layout diagnostics:** `reportLayout()` writes `nro_layout` ({mode: known/mixed/adaptive/none, count}); popup renders it under the list filter
- **Duplicate prevention:** `pendingTitles` Set prevents redundant in-flight requests
- **DOM recycling:** `dataset.nroTitle` detects recycled cards with new titles
- **Badge placement:** `position: absolute; bottom: 4px` on `.title-card` container; billboard/hover use `position: static`
- **External links:** Hover/billboard badges only (`isHover=true`). Small cards: `pointer-events: none`
- **i18n:** `zh-*` → Chinese, all others → English
- **Title cleaning:** `cleanTitle()` strips platform decoration from alt/aria text (`"Loki | Disney+"`, `"Andor – poster"`, `"觀看 X"`). English verb prefixes ("Watch…", "Play…") are deliberately kept — they're indistinguishable from real titles (Play Dirty, Watch Dogs) and a wrong strip poisons the cache key
- **TMDB (optional, `tmdb_api_key`):** localized titles (non-Latin script per `isLocalizedTitle()`) go TMDB `search/multi` → `external_ids` → IMDb ID → OMDb `?i=`. Latin titles try OMDb `?t=` first and only fall back to TMDB on a miss. Quota/invalid-key errors skip the fallback (`isFatalOmdbError`). Status in `nro_tmdb_status`
- **Movie/TV split:** From OMDb `json.Type` ("movie" / "series"). Entries missing `type` fall into Movie list as default.
- **Cache migration:** Entries missing `type` are re-fetched regardless of TTL
- **Cache race fix:** In-memory cache in `background.js` with debounced flush; `flushNow()` called immediately after each API write
- **Cache TTL:** 7 days for hits, 24h for misses. No active expiry sweep — expired entries stay until re-queried or LRU eviction.
- **Cache size:** Max 500 entries; LRU eviction down to 450 when exceeded (`evictIfNeeded`)
- **Rate limiting:** Max 3 concurrent OMDb requests across all tabs via `rateLimitedFetch` queue
- **Exclude list:** Stored in `nro_exclude` (chrome.storage.local). Populated via IMDb/Letterboxd CSV import or Netflix viewing activity sync (background tab, auto load-more, auto-close). Per-title restore or restore-all in popup.
- **IMDb list filter:** `nro_lists` = `{ include: {url, ids, titles, count, ts}, exclude: {…} }`, `nro_list_settings` = `{ includeOn, excludeOn, mode: 'dim'|'hide' }`. Include = show only list members; exclude = hide list members; both independent and live-toggled via `chrome.storage.onChanged`. Matching is imdbID first, then normalized title (`titleKeys()` — duplicated verbatim in `content.js` and `popup.js`, keep in sync). Applied to page tiles (`.nro-filtered` / `.nro-filtered-hide`) and to the popup ranking. Include-mode only filters once OMDb data has resolved (or when there's no API key), to avoid flicker.
- **IMDb list loading:** `background.js` tries `fetch` with `credentials: 'include'` first; IMDb answers cookie-less requests with an AWS WAF JS challenge (HTTP 202, `awsWafCookieDomainList` in body), so the fallback opens a background tab and reads `__NEXT_DATA__` + `a[href*="/title/tt"]` via `chrome.scripting.executeScript`, paging through `?page=N`, then closes the tab. Background writes `nro_lists` itself so a load survives the popup closing. Needs `scripting` permission + `https://www.imdb.com/*` host permission.

## OMDb API Limits

Free tier: 1,000 requests/day. Both hits and misses cached. On limit error, returns null until UTC midnight reset.

## Documentation Maintenance Rule

README.md and docs/*.md must always have both English and Chinese versions in sync. English first, `---` divider, then Chinese.
