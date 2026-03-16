# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Chrome extension (Manifest V3) that overlays IMDb, Rotten Tomatoes, and Metacritic ratings on Netflix title cards. Ratings are fetched via the [OMDb API](https://www.omdbapi.com/).

## No Build Step

This is a plain JS/CSS Chrome extension — no bundler, no npm, no compilation. Edit files directly and reload the extension in `chrome://extensions/`.

To reload after changes: go to `chrome://extensions/` → find "Netflix Rating Overlay" → click the refresh icon (🔄).

## Architecture

```
manifest.json       Extension config (MV3)
background.js       Service worker — handles all OMDb API fetch calls
content.js          Injected into Netflix pages — scans cards, injects badges
ratings.css         Badge styles injected into Netflix pages
popup.html/js       Extension popup UI for entering the OMDb API key
```

**Key design decision:** All `fetch()` calls to `omdbapi.com` are made from `background.js` (service worker), NOT from `content.js`. This is because Netflix's CSP blocks fetch requests from content scripts. `content.js` uses `chrome.runtime.sendMessage` to ask the background worker to fetch on its behalf.

## Data Flow

1. `content.js` scans Netflix DOM for title cards using CSS selectors
2. For each title found, sends `{ type: 'fetchRatings', title, apiKey }` to `background.js`
3. `background.js` checks `chrome.storage.local` cache (7-day TTL for hits, 24-hour TTL for misses)
4. On cache miss, fetches from OMDb API and caches the result
5. Returns `{ imdb, rt, mc, title, year }` to `content.js`
6. `content.js` injects a `.nro-badge` div into the `.title-card` DOM node

## Key Implementation Details

- **Duplicate request prevention:** `pendingTitles` (Set) in `content.js` ensures each title is only in-flight once at a time, preventing API quota burn from MutationObserver firing repeatedly
- **DOM recycling:** Netflix reuses card DOM nodes when scrolling. Badge injection uses `dataset.nroTitle` to detect when a recycled node now shows a different title
- **Badge placement:** Badges are injected into `.title-card` (not `.fallback-text-container`) as `position: absolute; bottom: 4px` overlays, because `.boxart-container` has `overflow: hidden; height: 0` which clips children
- **OMDb coverage:** English Netflix titles have much better coverage than Chinese/Asian titles. Netflix interface language affects which titles get ratings

## Documentation Maintenance Rule

All documentation files (README.md, docs/*.md) must always contain both English and Chinese versions in sync. English comes first, followed by a `---` divider, then the Chinese version. When updating any doc file, always update both languages to reflect the same information.

## OMDb API Limits

Free tier: 1,000 requests/day. Both hits and misses are cached to conserve quota. If `{ Response: 'False', Error: 'Request limit reached!' }` is returned, the extension silently returns null until the next UTC midnight reset.
