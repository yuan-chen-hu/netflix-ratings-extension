// Stream Rating Overlay - background.js (service worker)
const CACHE_KEY = 'nro_cache';
const LISTS_KEY = 'nro_lists';
const LIST_SETTINGS_KEY = 'nro_list_settings';
const PREFS_KEY = 'nro_prefs';
const IDMAP_KEY = 'nro_idmap';
const QUOTA_KEY = 'nro_quota';
const TMDB_KEY = 'tmdb_api_key';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;      // max entries before LRU eviction
const IDMAP_MAX = 3000;     // title → imdbID mappings kept (never expire)
const API_CONCURRENCY = 3;  // max simultaneous OMDb requests across all tabs
const OMDB_DAILY_LIMIT = 1000; // free tier — used for the popup quota meter

// In-memory cache — authoritative source, flushed to storage after each write
let memCache = null;
let flushTimer = null;

// Rate limiter state
let activeRequests = 0;
const requestQueue = [];

async function getCache() {
  if (memCache) return memCache;
  const stored = await chrome.storage.local.get(CACHE_KEY);
  memCache = stored[CACHE_KEY] || {};
  return memCache;
}

function setCacheEntry(title, entry) {
  if (!memCache) memCache = {};
  memCache[title] = entry;
  evictIfNeeded();
  scheduleFlush();
}

function evictIfNeeded() {
  const keys = Object.keys(memCache);
  if (keys.length <= CACHE_MAX) return;
  // Sort by timestamp ascending, remove oldest entries down to 90% of limit
  const sorted = keys.sort((a, b) => (memCache[a].ts || 0) - (memCache[b].ts || 0));
  const toRemove = keys.length - Math.floor(CACHE_MAX * 0.9);
  sorted.slice(0, toRemove).forEach(k => delete memCache[k]);
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushNow, 500);
}

function flushNow() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (memCache) chrome.storage.local.set({ [CACHE_KEY]: memCache });
}

// Rate-limited fetch: queues requests when API_CONCURRENCY is reached
function rateLimitedFetch(url, opts) {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeRequests++;
      fetch(url, opts)
        .then(resolve, reject)
        .finally(() => {
          activeRequests--;
          if (requestQueue.length > 0) requestQueue.shift()();
        });
    };
    if (activeRequests < API_CONCURRENCY) {
      run();
    } else {
      requestQueue.push(run);
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'fetchRatings') {
    handleFetch(msg.title, msg.apiKey, msg.year, msg.detail).then(sendResponse);
    return true; // keep channel open for async
  }
  if (msg.type === 'fetchImdbList') {
    handleListFetch(msg.url, msg.slot).then(sendResponse, () => sendResponse({ error: 'network' }));
    return true;
  }
});

// `detail` marks the hover modal / billboard, the only places that show RT, MC
// and awards. In TMDB-primary mode those are the only requests that spend OMDb
// quota — grid tiles are served entirely from TMDB.
async function handleFetch(title, apiKey, year, detail) {
  const cache = await getCache();
  const cached = cache[title];
  // Return cached data if valid AND has the `type` field (old entries missing type get re-fetched).
  // A detail request needs the OMDb-enriched (`full`) record, so a TMDB-only
  // entry falls through to a fetch even while it's still fresh.
  if (cached) {
    const ttl = cached.data ? CACHE_TTL : MISS_TTL;
    if (Date.now() - cached.ts < ttl) {
      if (!cached.data) return null;
      if (cached.data.type && (!detail || cached.data.full)) return cached.data;
    }
  }

  try {
    const tmdb = await getTmdbKey();
    const prefs = await getPrefs();

    // TMDB-primary: score/year/type come from TMDB (no daily cap), OMDb is
    // reserved for the RT/MC/awards a detail view actually shows.
    if (prefs.source === 'tmdb' && tmdb) {
      const data = await fetchViaTmdb(title, year, tmdb, detail ? apiKey : null);
      if (data) {
        setCacheEntry(title, { ts: Date.now(), data });
        flushNow();
        return data;
      }
      // TMDB had nothing — fall through and let OMDb try.
    }

    // OMDb only indexes English titles, so a localized card title (Chinese,
    // Japanese, Korean…) is resolved through TMDB into an IMDb ID first.
    const localized = tmdb && isLocalizedTitle(title);
    let json = null;

    if (localized) {
      const imdbId = await resolveImdbIdViaTmdb(title, year, tmdb);
      if (imdbId) json = await omdbFetch(`i=${encodeURIComponent(imdbId)}`, apiKey);
    }
    if (!json) {
      const yearParam = year ? `&y=${encodeURIComponent(year)}` : '';
      json = await omdbFetch(`t=${encodeURIComponent(title)}${yearParam}`, apiKey);
    }
    // Latin-script titles can still be localized ("Le Voyage…"). If OMDb had no
    // match, give TMDB a chance before recording a miss.
    if (tmdb && !localized && json && json.Response === 'False' && !isFatalOmdbError(json)) {
      const imdbId = await resolveImdbIdViaTmdb(title, year, tmdb);
      if (imdbId) {
        const retry = await omdbFetch(`i=${encodeURIComponent(imdbId)}`, apiKey);
        if (retry && retry.Response !== 'False') json = retry;
      }
    }

    if (!json) return null;
    if (json.Response === 'False') {
      if (isFatalOmdbError(json)) return null; // status already reported
      setCacheEntry(title, { ts: Date.now(), data: null });
      flushNow();
      return null;
    }
    setApiStatus('ok', 'Working');
    const data = parseOmdb(json);
    setCacheEntry(title, { ts: Date.now(), data });
    flushNow();
    return data;
  } catch (e) {
    return null;
  }
}

// OMDb JSON → the flat record content.js renders. `full` marks a record that
// carries everything the detail badge needs (RT / MC / awards).
function parseOmdb(json) {
  const imdb = json.imdbRating && json.imdbRating !== 'N/A' ? json.imdbRating : null;
  const rtEntry = (json.Ratings || []).find(r => r.Source === 'Rotten Tomatoes');
  const rt = rtEntry ? rtEntry.Value : null;
  const mcEntry = (json.Ratings || []).find(r => r.Source === 'Metacritic');
  const mc = mcEntry ? mcEntry.Value : (json.Metascore && json.Metascore !== 'N/A' ? json.Metascore + '/100' : null);
  const awards = json.Awards && json.Awards !== 'N/A' ? json.Awards : null;
  return {
    imdb, rt, mc, awards,
    imdbID: json.imdbID || null,
    type: json.Type || null, // "movie" or "series"
    title: json.Title,
    year: json.Year,
    full: true,
  };
}

// Returns the parsed OMDb response (including `Response: "False"` misses), or
// null on a transport error. Key/limit problems are reported once, here.
async function omdbFetch(query, apiKey) {
  bumpQuota();
  const res = await rateLimitedFetch(`https://www.omdbapi.com/?${query}&apikey=${apiKey}`);
  if (!res.ok) return null;
  const json = await res.json();
  if (json.Response === 'False' && json.Error) {
    if (json.Error.includes('limit')) setApiStatus('limit', 'Daily limit reached — resets at UTC midnight');
    else if (json.Error.includes('Invalid API key')) setApiStatus('invalid', 'Invalid API Key');
  }
  return json;
}

// Key/quota failures — retrying with another query won't help
function isFatalOmdbError(json) {
  const err = (json && json.Error) || '';
  return err.includes('limit') || err.includes('Invalid API key');
}

function setApiStatus(status, message) {
  chrome.storage.local.set({ nro_api_status: { status, message, ts: Date.now() } });
}

// --- OMDb quota meter ---
// OMDb's free tier is 1,000 calls per UTC day and the API only tells you once
// you've blown through it, so every outgoing call is counted here.
let quota = null;
let quotaTimer = null;

function utcDay(ts) {
  return new Date(ts == null ? Date.now() : ts).toISOString().slice(0, 10);
}

async function getQuota() {
  if (!quota) {
    const d = await chrome.storage.local.get(QUOTA_KEY);
    quota = d[QUOTA_KEY] || { day: utcDay(), count: 0 };
  }
  if (quota.day !== utcDay()) quota = { day: utcDay(), count: 0 };
  return quota;
}

async function bumpQuota() {
  const q = await getQuota();
  q.count++;
  if (quotaTimer) clearTimeout(quotaTimer);
  quotaTimer = setTimeout(() => {
    quotaTimer = null;
    chrome.storage.local.set({ [QUOTA_KEY]: quota });
  }, 1000);
}

// --- Preferences ---
// `source` picks the primary metadata provider: 'omdb' (default) or 'tmdb'.
const DEFAULT_PREFS = { source: 'omdb', minScore: 0, minSource: 'imdb' };
let prefs = null;

async function getPrefs() {
  if (!prefs) {
    const d = await chrome.storage.local.get(PREFS_KEY);
    prefs = Object.assign({}, DEFAULT_PREFS, d[PREFS_KEY] || {});
  }
  return prefs;
}

// --- TMDB title resolution ---
// TMDB indexes localized titles, so it bridges "怪奇物語" → tt4574334 → OMDb,
// and in TMDB-primary mode it supplies the score/year/type directly.
let tmdbKey = null; // null = not loaded yet, '' = not configured

async function getTmdbKey() {
  if (tmdbKey === null) {
    const d = await chrome.storage.local.get(TMDB_KEY);
    tmdbKey = d[TMDB_KEY] || '';
  }
  return tmdbKey;
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes[TMDB_KEY]) tmdbKey = changes[TMDB_KEY].newValue || '';
  if (changes[PREFS_KEY]) prefs = Object.assign({}, DEFAULT_PREFS, changes[PREFS_KEY].newValue || {});
});

// CJK / Cyrillic / Thai / Arabic etc. — scripts OMDb can't match on
function isLocalizedTitle(title) {
  // Latin + Latin Extended + general punctuation are fine; anything else
  // (CJK, Cyrillic, Thai, Arabic…) is a localized title.
  return /[^\u0020-\u024F\u1E00-\u1EFF\u2000-\u206F]/.test(title || '');
}

// --- Persistent title → id map ---
// The ratings cache is LRU-capped and TTL'd; this mapping never goes stale
// (a title's IMDb ID doesn't change), so it's kept separately. Without it,
// every evicted localized title costs 2 TMDB calls again just to find its ID.
let idmap = null;
let idmapTimer = null;

function idmapKey(title, year) {
  return `${String(title || '').trim().toLowerCase()}|${year || ''}`;
}

async function getIdmap() {
  if (!idmap) {
    const d = await chrome.storage.local.get(IDMAP_KEY);
    idmap = d[IDMAP_KEY] || {};
  }
  return idmap;
}

async function rememberId(title, year, rec) {
  const map = await getIdmap();
  map[idmapKey(title, year)] = { ...rec, ts: Date.now() };
  const keys = Object.keys(map);
  if (keys.length > IDMAP_MAX) {
    keys.sort((a, b) => (map[a].ts || 0) - (map[b].ts || 0))
      .slice(0, keys.length - Math.floor(IDMAP_MAX * 0.9))
      .forEach(k => delete map[k]);
  }
  if (idmapTimer) clearTimeout(idmapTimer);
  idmapTimer = setTimeout(() => {
    idmapTimer = null;
    chrome.storage.local.set({ [IDMAP_KEY]: idmap });
  }, 1000);
}

async function recallId(title, year) {
  const map = await getIdmap();
  // An exact title+year hit is best; a year-less entry still identifies the title.
  return map[idmapKey(title, year)] || (year ? map[idmapKey(title, '')] : null) || null;
}

// Full TMDB record for a title: score, year, type and the IMDb ID.
// Costs 1 request when the id map already knows the title, 2 on a cold lookup.
async function tmdbLookup(title, year, key) {
  const known = await recallId(title, year);
  if (known && known.tmdbId && known.mediaType) {
    const detail = await tmdbGet(`${known.mediaType}/${known.tmdbId}`, key);
    if (detail) return tmdbRecord(detail, known.mediaType, known.imdbID || null);
  }

  const params = `&query=${encodeURIComponent(title)}&include_adult=false${tmdbLangParam()}`;
  const json = await tmdbGet('search/multi', key, params);
  if (!json) return null;
  const results = (json.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'tv');
  if (!results.length) return null;
  setTmdbStatus('ok');
  const pick = pickTmdbResult(results, title, year);
  const mediaType = pick.media_type === 'tv' ? 'tv' : 'movie';

  const ext = await tmdbGet(`${mediaType}/${pick.id}/external_ids`, key);
  const imdbID = ext && /^tt\d+$/.test(ext.imdb_id || '') ? ext.imdb_id : null;
  await rememberId(title, year, { imdbID, tmdbId: pick.id, mediaType });
  return tmdbRecord(pick, mediaType, imdbID);
}

function tmdbRecord(obj, mediaType, imdbID) {
  const date = obj.release_date || obj.first_air_date || '';
  const score = typeof obj.vote_average === 'number' && obj.vote_average > 0
    ? obj.vote_average.toFixed(1)
    : null;
  return {
    tmdbId: obj.id,
    mediaType,
    imdbID,
    score,
    votes: obj.vote_count || 0,
    title: obj.title || obj.name || '',
    year: date ? date.slice(0, 4) : '',
  };
}

async function tmdbGet(path, key, extra) {
  try {
    const res = await rateLimitedFetch(
      `https://api.themoviedb.org/3/${path}?api_key=${encodeURIComponent(key)}${extra || ''}`);
    if (!res.ok) {
      setTmdbStatus(res.status === 401 ? 'invalid' : 'error');
      return null;
    }
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Ask TMDB for results in the browser's language so localized titles come back
// in the same script the streaming UI showed them in.
function tmdbLangParam() {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || '';
  return lang ? `&language=${encodeURIComponent(lang)}` : '';
}

// `search/multi` sorts by popularity, which is often wrong for remakes and
// same-name shows. Rank by how well the title actually matches first, then by
// year, and only fall back to TMDB's own ordering as a tiebreaker.
function pickTmdbResult(results, title, year) {
  const want = normalizeForMatch(title);
  let best = results[0], bestScore = -Infinity;
  results.forEach((r, i) => {
    const names = [r.title, r.name, r.original_title, r.original_name].filter(Boolean);
    let s = 0;
    if (names.some(n => normalizeForMatch(n) === want)) s += 100;
    else if (names.some(n => normalizeForMatch(n).includes(want) || want.includes(normalizeForMatch(n)))) s += 40;
    const date = String(r.release_date || r.first_air_date || '');
    if (year && date.startsWith(String(year))) s += 50;
    else if (year && date) {
      const diff = Math.abs(parseInt(date.slice(0, 4), 10) - parseInt(year, 10));
      if (diff === 1) s += 20; // release vs. streaming-debut year often differ by one
    }
    s -= i; // preserve TMDB's popularity order among otherwise equal matches
    if (s > bestScore) { bestScore = s; best = r; }
  });
  return best;
}

function normalizeForMatch(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// TMDB-primary path. `omdbKeyForDetail` is only set for hover/billboard, where
// RT / MC / awards are actually displayed.
async function fetchViaTmdb(title, year, key, omdbKeyForDetail) {
  const rec = await tmdbLookup(title, year, key);
  if (!rec) return null;
  const base = {
    imdb: null, rt: null, mc: null, awards: null,
    tmdb: rec.score,
    imdbID: rec.imdbID,
    type: rec.mediaType === 'tv' ? 'series' : 'movie',
    title: rec.title || title,
    year: rec.year,
    full: false,
  };
  if (!base.tmdb && !base.imdbID) return null; // nothing worth showing or caching
  if (omdbKeyForDetail) {
    // Records the attempt even when it can't be made (no IMDb ID) or comes back
    // empty, so the detail view doesn't re-request the same title on every pass.
    base.detailTried = true;
    if (rec.imdbID) {
      const json = await omdbFetch(`i=${encodeURIComponent(rec.imdbID)}`, omdbKeyForDetail);
      if (json && json.Response !== 'False') {
        setApiStatus('ok', 'Working');
        return { ...parseOmdb(json), tmdb: rec.score };
      }
    }
  }
  return base;
}

// Localized title → IMDb ID, for the OMDb-primary path.
async function resolveImdbIdViaTmdb(title, year, key) {
  const known = await recallId(title, year);
  if (known && known.imdbID) return known.imdbID;
  const rec = await tmdbLookup(title, year, key);
  return rec ? rec.imdbID : null;
}

function setTmdbStatus(status) {
  chrome.storage.local.set({ nro_tmdb_status: { status, ts: Date.now() } });
}

// --- Public list import (IMDb + Letterboxd) ---
// Fetches a shared/public list and returns its imdb IDs + titles. Content
// scripts can't fetch imdb.com from a Netflix page (CSP), so this runs here.
const LIST_MAX_PAGES = 8;
const LB_MAX_PAGES = 20;    // Letterboxd paginates at ~100 posters per page
const LIST_MAX_ITEMS = 5000;
const LIST_MAX_CLICKS = 20; // "50 more" clicks per page
const LIST_REFRESH_AGE = 7 * 24 * 60 * 60 * 1000;

function listSite(url) {
  return /letterboxd\.com/i.test(url || '') ? 'letterboxd' : 'imdb';
}

function normalizeListUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  // Bare id pasted on its own: "ls123456789"
  const bare = raw.match(/^(ls\d{6,})$/i);
  if (bare) return `https://www.imdb.com/list/${bare[1]}/`;
  let u;
  try {
    u = new URL(/^https?:/i.test(raw) ? raw : `https://${raw}`);
  } catch (e) {
    return null;
  }
  if (/(^|\.)letterboxd\.com$/i.test(u.hostname)) return normalizeLetterboxdUrl(u);
  if (!/(^|\.)imdb\.com$/i.test(u.hostname)) return null;
  const list = u.pathname.match(/\/list\/(ls\d+)/i);
  if (list) return `https://www.imdb.com/list/${list[1]}/`;
  const watchlist = u.pathname.match(/\/user\/(ur\d+)\/watchlist/i);
  if (watchlist) return `https://www.imdb.com/user/${watchlist[1]}/watchlist/`;
  return null;
}

// Letterboxd exposes three shapes worth importing: a named list, a watchlist,
// and the full "films watched" log (the natural exclude source).
function normalizeLetterboxdUrl(u) {
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const user = parts[0];
  if (parts[1] === 'list' && parts[2]) return `https://letterboxd.com/${user}/list/${parts[2]}/`;
  if (parts[1] === 'watchlist') return `https://letterboxd.com/${user}/watchlist/`;
  if (parts[1] === 'films') return `https://letterboxd.com/${user}/films/`;
  return null;
}

async function handleListFetch(input, slot, keepSwitch) {
  const base = normalizeListUrl(input);
  if (!base) return { error: 'bad_url' };
  const site = listSite(base);

  // Fast path: plain fetch. Credentials are included so the profile's existing
  // cookies (incl. IMDb's AWS WAF token) come along.
  let result = site === 'letterboxd'
    ? await fetchLetterboxdDirect(base)
    : await fetchListDirect(base);
  // Fallback: load the list in a background tab and read it from the rendered
  // page. IMDb answers cookie-less requests with a JS challenge that only a
  // real page context can clear.
  if (!result) result = await fetchListViaTab(base, site);

  if (!result) return { error: 'empty' };
  // Saved here rather than in the popup so a list still lands in storage when
  // the popup is closed mid-load.
  if (slot === 'include' || slot === 'exclude') {
    const data = await chrome.storage.local.get([LISTS_KEY, LIST_SETTINGS_KEY]);
    const stored = data[LISTS_KEY] || {};
    stored[slot] = { ...result, ts: Date.now() };
    // A freshly loaded list starts switched on; the popup switch turns it off.
    // A background refresh must not resurrect a list the user switched off.
    const settings = data[LIST_SETTINGS_KEY] || {};
    if (!keepSwitch) settings[slot + 'On'] = true;
    await chrome.storage.local.set({ [LISTS_KEY]: stored, [LIST_SETTINGS_KEY]: settings });
  }
  return result;
}

async function fetchListDirect(base) {
  const ids = new Set();
  const titles = new Set();
  for (let page = 1; page <= LIST_MAX_PAGES; page++) {
    const url = page === 1 ? base : `${base}?page=${page}`;
    let res;
    try {
      res = await rateLimitedFetch(url, { credentials: 'include' });
    } catch (e) {
      break;
    }
    if (!res.ok) break;
    const html = await res.text();
    if (html.includes('awsWafCookieDomainList')) break; // bot challenge, not the list
    const before = ids.size + titles.size;
    parseImdbList(html, ids, titles);
    // No new items on this page → end of list (or the list isn't paginated)
    if (ids.size + titles.size === before) break;
    if (ids.size >= LIST_MAX_ITEMS) break;
  }
  if (!ids.size && !titles.size) return null;
  return { url: base, site: 'imdb', ids: [...ids], titles: [...titles], count: Math.max(ids.size, titles.size) };
}

// Letterboxd serves plain HTML with no bot challenge, so the direct path is
// almost always the one that runs. Pages are `…/page/2/`, and there are no
// IMDb IDs in the markup — matching is title-only.
async function fetchLetterboxdDirect(base) {
  const titles = new Set();
  for (let page = 1; page <= LB_MAX_PAGES; page++) {
    const url = page === 1 ? base : `${base}page/${page}/`;
    let res;
    try {
      res = await rateLimitedFetch(url, { credentials: 'include' });
    } catch (e) {
      break;
    }
    if (!res.ok) break;
    const before = titles.size;
    parseLetterboxdList(await res.text(), titles);
    if (titles.size === before) break;
    if (titles.size >= LIST_MAX_ITEMS) break;
  }
  if (!titles.size) return null;
  return { url: base, site: 'letterboxd', ids: [], titles: [...titles], count: titles.size };
}

// Letterboxd posters carry the display name in a data attribute or the img alt,
// and always carry a slug. The slug is the reliable one, so both are collected.
function parseLetterboxdList(html, titles) {
  const add = (s) => {
    const t = decodeEntities(String(s || '')).trim();
    if (t && t.length < 150) titles.add(t);
  };
  let m;
  const nameRe = /data-(?:film|item)(?:-full-display)?-name="([^"]+)"/g;
  while ((m = nameRe.exec(html)) && titles.size < LIST_MAX_ITEMS) add(m[1]);

  const altRe = /<img[^>]*class="[^"]*image[^"]*"[^>]*alt="([^"]+)"/g;
  while ((m = altRe.exec(html)) && titles.size < LIST_MAX_ITEMS) add(m[1]);

  const slugRe = /data-(?:film|item)-slug="([^"]+)"/g;
  while ((m = slugRe.exec(html)) && titles.size < LIST_MAX_ITEMS) {
    slugTitles(m[1]).forEach(add);
  }
}

// "the-thing-1982" → ["the thing 1982", "the thing"]. Disambiguating years are
// part of the slug but never part of the on-screen title, so both are kept.
function slugTitles(slug) {
  const base = String(slug || '').replace(/-/g, ' ').trim();
  if (!base) return [];
  const noYear = base.replace(/\s+(19|20)\d{2}$/, '');
  return noYear !== base ? [base, noYear] : [base];
}

async function fetchListViaTab(base, site) {
  let tab;
  try {
    tab = await chrome.tabs.create({ url: base, active: false });
  } catch (e) {
    return null;
  }
  const ids = new Set();
  const titles = new Set();
  const maxPages = site === 'letterboxd' ? LB_MAX_PAGES : LIST_MAX_PAGES;
  try {
    for (let page = 1; page <= maxPages; page++) {
      if (page > 1) {
        const next = site === 'letterboxd' ? `${base}page/${page}/` : `${base}?page=${page}`;
        await chrome.tabs.update(tab.id, { url: next });
        await sleep(500); // let the navigation flip the tab out of "complete"
      }
      await waitForTabLoad(tab.id, 25000);
      const before = ids.size + titles.size;
      // Retry with backoff: the WAF challenge page loads first and swaps itself
      // for the real list a second or two later. Only the first page has to
      // clear the challenge, so later pages give up quickly — otherwise the
      // page after the last one costs a full retry budget before we notice the
      // list has ended.
      const attempts = page === 1 ? 8 : 3;
      for (let attempt = 0; attempt < attempts; attempt++) {
        const scraped = await scrapeTab(tab.id, site);
        if (scraped) {
          scraped.ids.forEach(id => ids.add(id));
          scraped.titles.forEach(x => titles.add(x));
        }
        if (ids.size + titles.size > before) break;
        if (attempt < attempts - 1) await sleep(400 + attempt * 400);
      }
      // Lists longer than one page render behind a "50 more" button — click it
      // until it's gone. This is the path that works whether or not `?page=N`
      // is still supported.
      if (site !== 'letterboxd') {
        for (let clicks = 0; clicks < LIST_MAX_CLICKS; clicks++) {
          const beforeClick = ids.size + titles.size;
          const clicked = await clickMoreInTab(tab.id);
          if (!clicked) break;
          await sleep(1200);
          const more = await scrapeTab(tab.id, site);
          if (more) {
            more.ids.forEach(id => ids.add(id));
            more.titles.forEach(x => titles.add(x));
          }
          if (ids.size + titles.size === beforeClick) break; // button did nothing
          if (ids.size >= LIST_MAX_ITEMS) break;
        }
      }
      if (ids.size + titles.size === before) break;
      if (ids.size >= LIST_MAX_ITEMS) break;
    }
  } catch (e) {
    /* fall through with whatever was collected */
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
  if (!ids.size && !titles.size) return null;
  return { url: base, site, ids: [...ids], titles: [...titles], count: Math.max(ids.size, titles.size) };
}

async function clickMoreInTab(tabId) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: clickLoadMoreInPage,
    });
    return !!(res && res.result);
  } catch (e) {
    return false;
  }
}

// Runs inside the IMDb tab — must be self-contained (no outer references).
function clickLoadMoreInPage() {
  const re = /^\s*(\d+\s+more|load more|show more|see more|載入更多|顯示更多|もっと見る|더 보기)\s*$/i;
  const buttons = [...document.querySelectorAll('button, a[role="button"], span[role="button"]')];
  const btn = buttons.find(b => re.test((b.textContent || '').trim()) && b.offsetParent !== null);
  if (!btn) return false;
  btn.click();
  return true;
}

async function scrapeTab(tabId, site) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: site === 'letterboxd' ? scrapeLetterboxdInPage : scrapeImdbListInPage,
      args: [LIST_MAX_ITEMS],
    });
    return res && res.result;
  } catch (e) {
    return null;
  }
}

// Runs inside the IMDb tab — must be self-contained (no outer references).
function scrapeImdbListInPage(maxItems) {
  const ids = new Set();
  const titles = new Set();

  const walk = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > 14 || ids.size >= maxItems) return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child, depth + 1);
      return;
    }
    if (typeof node.id === 'string' && /^tt\d{6,}$/.test(node.id)) {
      ids.add(node.id);
      if (node.titleText && node.titleText.text) titles.add(node.titleText.text);
      if (node.originalTitleText && node.originalTitleText.text) titles.add(node.originalTitleText.text);
    }
    for (const key in node) walk(node[key], depth + 1);
  };

  const nextData = document.getElementById('__NEXT_DATA__');
  if (nextData) {
    try { walk(JSON.parse(nextData.textContent), 0); } catch (e) { /* ignore */ }
  }
  // Rendered markup — covers items appended after hydration
  document.querySelectorAll('a[href*="/title/tt"]').forEach(a => {
    const m = (a.getAttribute('href') || '').match(/\/title\/(tt\d{6,})/);
    if (!m || ids.size >= maxItems) return;
    ids.add(m[1]);
    const text = (a.textContent || '').trim().replace(/^\d+\.\s*/, '');
    if (text && text.length < 150) titles.add(text);
  });

  return { ids: [...ids], titles: [...titles] };
}

// Runs inside the Letterboxd tab — must be self-contained (no outer references).
function scrapeLetterboxdInPage(maxItems) {
  const titles = new Set();
  const add = (s) => {
    const t = String(s || '').trim();
    if (t && t.length < 150 && titles.size < maxItems) titles.add(t);
  };
  document.querySelectorAll('[data-film-name], [data-item-name], [data-item-full-display-name]').forEach(el => {
    add(el.getAttribute('data-film-name'));
    add(el.getAttribute('data-item-name'));
    add(el.getAttribute('data-item-full-display-name'));
  });
  document.querySelectorAll('img.image[alt]').forEach(img => add(img.getAttribute('alt')));
  document.querySelectorAll('[data-film-slug], [data-item-slug]').forEach(el => {
    const slug = el.getAttribute('data-film-slug') || el.getAttribute('data-item-slug') || '';
    const base = slug.replace(/-/g, ' ').trim();
    if (!base) return;
    add(base);
    const noYear = base.replace(/\s+(19|20)\d{2}$/, '');
    if (noYear !== base) add(noYear);
  });
  return { ids: [], titles: [...titles] };
}

function waitForTabLoad(tabId, timeout) {
  return new Promise(resolve => {
    const done = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve();
    };
    const listener = (id, info) => { if (id === tabId && info.status === 'complete') done(); };
    const timer = setTimeout(done, timeout);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then(tabInfo => { if (tabInfo.status === 'complete') done(); }, done);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function parseImdbList(html, ids, titles) {
  // Modern IMDb embeds the whole list in __NEXT_DATA__. Walking the tree for
  // any object with a tt-id survives IMDb reshuffling its GraphQL schema.
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    try {
      collectListItems(JSON.parse(m[1]), ids, titles, 0);
    } catch (e) { /* fall through to the markup scan */ }
  }
  if (ids.size === 0) {
    // Legacy markup fallback: <a href="/title/tt…/">Title</a>
    const re = /href="\/title\/(tt\d{6,})\/?[^"]*"[^>]*>([^<]{1,150})</g;
    let x;
    while ((x = re.exec(html)) && ids.size < LIST_MAX_ITEMS) {
      ids.add(x[1]);
      const t = decodeEntities(x[2]).replace(/^\d+\.\s*/, '').trim();
      if (t) titles.add(t);
    }
  }
}

function collectListItems(node, ids, titles, depth) {
  if (!node || typeof node !== 'object' || depth > 14 || ids.size >= LIST_MAX_ITEMS) return;
  if (Array.isArray(node)) {
    for (const child of node) collectListItems(child, ids, titles, depth + 1);
    return;
  }
  if (typeof node.id === 'string' && /^tt\d{6,}$/.test(node.id)) {
    ids.add(node.id);
    const primary = node.titleText && node.titleText.text;
    const original = node.originalTitleText && node.originalTitleText.text;
    if (primary) titles.add(primary);
    if (original) titles.add(original);
  }
  for (const key in node) collectListItems(node[key], ids, titles, depth + 1);
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

// --- Weekly list refresh ---
// A watchlist people actually use drifts within days. The alarm re-runs the
// same loader the popup uses; a failure just leaves the previous copy in place.
const REFRESH_ALARM = 'nro_list_refresh';

if (typeof chrome !== 'undefined' && chrome.alarms) {
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 360, delayInMinutes: 5 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === REFRESH_ALARM) refreshStaleLists();
  });
}

async function refreshStaleLists() {
  const data = await chrome.storage.local.get(LISTS_KEY);
  const stored = data[LISTS_KEY] || {};
  for (const slot of ['include', 'exclude']) {
    const list = stored[slot];
    if (!list || !list.url) continue;
    if (Date.now() - (list.ts || 0) < LIST_REFRESH_AGE) continue;
    await handleListFetch(list.url, slot, true);
  }
}
