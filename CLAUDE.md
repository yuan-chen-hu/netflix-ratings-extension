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

## Data Flow

1. `content.js` scans DOM for title cards
2. Sends `{ type: 'fetchRatings', title, apiKey }` to `background.js`
3. `background.js` checks `chrome.storage.local` cache (7-day TTL / 24-hour TTL for misses)
4. On miss, fetches OMDb and caches result
5. Returns `{ imdb, rt, mc, awards, imdbID, type, title, year }` to `content.js`
6. `content.js` injects `.nro-badge` into the card

## Key Implementation Details

- **Card selectors:** `.title-card-container`, `.slider-item`, `[data-uia="title-card"]`, `[data-uia="search-gallery-video-card"]` (search page uses `aria-label` on `<a>` for title)
- **Duplicate prevention:** `pendingTitles` Set prevents redundant in-flight requests
- **DOM recycling:** `dataset.nroTitle` detects recycled cards with new titles
- **Badge placement:** `position: absolute; bottom: 4px` on `.title-card` container; billboard/hover use `position: static`
- **External links:** Hover/billboard badges only (`isHover=true`). Small cards: `pointer-events: none`
- **i18n:** `zh-*` → Chinese, all others → English
- **Movie/TV split:** From OMDb `json.Type` ("movie" / "series")
- **Cache migration:** Entries missing `type` are re-fetched regardless of TTL
- **Cache race fix:** In-memory cache in `background.js` with debounced flush; `flushNow()` called immediately after each API write
- **Cache size:** Max 500 entries; LRU eviction down to 450 when exceeded (`evictIfNeeded`)
- **Rate limiting:** Max 3 concurrent OMDb requests across all tabs via `rateLimitedFetch` queue

## OMDb API Limits

Free tier: 1,000 requests/day. Both hits and misses cached. On limit error, returns null until UTC midnight reset.

## Documentation Maintenance Rule

README.md and docs/*.md must always have both English and Chinese versions in sync. English first, `---` divider, then Chinese.
