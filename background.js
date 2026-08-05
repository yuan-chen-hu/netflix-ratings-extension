// Stream Rating Overlay - background.js (service worker)
const CACHE_KEY = 'nro_cache';
const LISTS_KEY = 'nro_lists';
const LIST_SETTINGS_KEY = 'nro_list_settings';
const TMDB_KEY = 'tmdb_api_key';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;      // max entries before LRU eviction
const API_CONCURRENCY = 3;  // max simultaneous OMDb requests across all tabs

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
    handleFetch(msg.title, msg.apiKey, msg.year).then(sendResponse);
    return true; // keep channel open for async
  }
  if (msg.type === 'fetchImdbList') {
    handleListFetch(msg.url, msg.slot).then(sendResponse, () => sendResponse({ error: 'network' }));
    return true;
  }
});

async function handleFetch(title, apiKey, year) {
  const cache = await getCache();
  const cached = cache[title];
  // Return cached data if valid AND has the `type` field (old entries missing type get re-fetched)
  if (cached) {
    const ttl = cached.data ? CACHE_TTL : MISS_TTL;
    if (Date.now() - cached.ts < ttl) {
      if (!cached.data || cached.data.type) return cached.data;
    }
  }

  try {
    const tmdb = await getTmdbKey();
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
    const imdb = json.imdbRating && json.imdbRating !== 'N/A' ? json.imdbRating : null;
    const rtEntry = (json.Ratings || []).find(r => r.Source === 'Rotten Tomatoes');
    const rt = rtEntry ? rtEntry.Value : null;
    const mcEntry = (json.Ratings || []).find(r => r.Source === 'Metacritic');
    const mc = mcEntry ? mcEntry.Value : (json.Metascore && json.Metascore !== 'N/A' ? json.Metascore + '/100' : null);
    const awards = json.Awards && json.Awards !== 'N/A' ? json.Awards : null;
    const imdbID = json.imdbID || null;
    const type = json.Type || null; // "movie" or "series"
    const data = { imdb, rt, mc, awards, imdbID, type, title: json.Title, year: json.Year };
    setCacheEntry(title, { ts: Date.now(), data });
    flushNow();
    return data;
  } catch (e) {
    return null;
  }
}

// Returns the parsed OMDb response (including `Response: "False"` misses), or
// null on a transport error. Key/limit problems are reported once, here.
async function omdbFetch(query, apiKey) {
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

// --- TMDB title resolution (optional) ---
// TMDB indexes localized titles, so it bridges "怪奇物語" → tt4574334 → OMDb.
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
});

// CJK / Cyrillic / Thai / Arabic etc. — scripts OMDb can't match on
function isLocalizedTitle(title) {
  // Latin + Latin Extended + general punctuation are fine; anything else
  // (CJK, Cyrillic, Thai, Arabic…) is a localized title.
  return /[^\u0020-\u024F\u1E00-\u1EFF\u2000-\u206F]/.test(title || '');
}

async function resolveImdbIdViaTmdb(title, year, key) {
  try {
    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(key)}` +
      `&query=${encodeURIComponent(title)}&include_adult=false`;
    const res = await rateLimitedFetch(searchUrl);
    if (!res.ok) {
      setTmdbStatus(res.status === 401 ? 'invalid' : 'error');
      return null;
    }
    const json = await res.json();
    const results = (json.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'tv');
    if (!results.length) return null;
    setTmdbStatus('ok');
    let pick = results[0];
    if (year) {
      const byYear = results.find(r => String(r.release_date || r.first_air_date || '').startsWith(String(year)));
      if (byYear) pick = byYear;
    }
    const path = pick.media_type === 'tv' ? 'tv' : 'movie';
    const extRes = await rateLimitedFetch(
      `https://api.themoviedb.org/3/${path}/${pick.id}/external_ids?api_key=${encodeURIComponent(key)}`);
    if (!extRes.ok) return null;
    const ext = await extRes.json();
    return /^tt\d+$/.test(ext.imdb_id || '') ? ext.imdb_id : null;
  } catch (e) {
    return null;
  }
}

function setTmdbStatus(status) {
  chrome.storage.local.set({ nro_tmdb_status: { status, ts: Date.now() } });
}

// --- IMDb public list import ---
// Fetches a shared/public IMDb list (or watchlist) and returns its imdb IDs +
// titles. Content scripts can't fetch imdb.com from a Netflix page (CSP), so
// this runs here. Only public lists work — no cookies are sent.
const LIST_MAX_PAGES = 8;
const LIST_MAX_ITEMS = 5000;
const LIST_MAX_CLICKS = 20; // "50 more" clicks per page

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
  if (!/(^|\.)imdb\.com$/i.test(u.hostname)) return null;
  const list = u.pathname.match(/\/list\/(ls\d+)/i);
  if (list) return `https://www.imdb.com/list/${list[1]}/`;
  const watchlist = u.pathname.match(/\/user\/(ur\d+)\/watchlist/i);
  if (watchlist) return `https://www.imdb.com/user/${watchlist[1]}/watchlist/`;
  return null;
}

async function handleListFetch(input, slot) {
  const base = normalizeListUrl(input);
  if (!base) return { error: 'bad_url' };

  // Fast path: plain fetch. Credentials are included so the profile's existing
  // imdb.com cookies (incl. the AWS WAF token) come along.
  let result = await fetchListDirect(base);
  // Fallback: load the list in a background tab and read it from the rendered
  // page. IMDb answers cookie-less requests with a JS challenge that only a
  // real page context can clear.
  if (!result) result = await fetchListViaTab(base);

  if (!result) return { error: 'empty' };
  // Saved here rather than in the popup so a list still lands in storage when
  // the popup is closed mid-load.
  if (slot === 'include' || slot === 'exclude') {
    const data = await chrome.storage.local.get([LISTS_KEY, LIST_SETTINGS_KEY]);
    const stored = data[LISTS_KEY] || {};
    stored[slot] = { ...result, ts: Date.now() };
    // A freshly loaded list starts switched on; the popup switch turns it off.
    const settings = data[LIST_SETTINGS_KEY] || {};
    settings[slot + 'On'] = true;
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
  return { url: base, ids: [...ids], titles: [...titles], count: Math.max(ids.size, titles.size) };
}

async function fetchListViaTab(base) {
  let tab;
  try {
    tab = await chrome.tabs.create({ url: base, active: false });
  } catch (e) {
    return null;
  }
  const ids = new Set();
  const titles = new Set();
  try {
    for (let page = 1; page <= LIST_MAX_PAGES; page++) {
      if (page > 1) {
        await chrome.tabs.update(tab.id, { url: `${base}?page=${page}` });
        await sleep(500); // let the navigation flip the tab out of "complete"
      }
      await waitForTabLoad(tab.id, 25000);
      const before = ids.size + titles.size;
      // Retry: the WAF challenge page loads first and swaps itself for the
      // real list a second or two later.
      for (let attempt = 0; attempt < 8; attempt++) {
        const scraped = await scrapeTab(tab.id);
        if (scraped) {
          scraped.ids.forEach(id => ids.add(id));
          scraped.titles.forEach(x => titles.add(x));
        }
        if (ids.size + titles.size > before) break;
        await sleep(1500);
      }
      // Lists longer than one page render behind a "50 more" button — click it
      // until it's gone. This is the path that works whether or not `?page=N`
      // is still supported.
      for (let clicks = 0; clicks < LIST_MAX_CLICKS; clicks++) {
        const beforeClick = ids.size + titles.size;
        const clicked = await clickMoreInTab(tab.id);
        if (!clicked) break;
        await sleep(1200);
        const more = await scrapeTab(tab.id);
        if (more) {
          more.ids.forEach(id => ids.add(id));
          more.titles.forEach(x => titles.add(x));
        }
        if (ids.size + titles.size === beforeClick) break; // button did nothing
        if (ids.size >= LIST_MAX_ITEMS) break;
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
  return { url: base, ids: [...ids], titles: [...titles], count: Math.max(ids.size, titles.size) };
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

async function scrapeTab(tabId) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: scrapeImdbListInPage,
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
