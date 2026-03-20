// Netflix Rating Overlay - background.js (service worker)
const CACHE_KEY = 'nro_cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL = 24 * 60 * 60 * 1000;

// In-memory cache — authoritative source, flushed to storage periodically
let memCache = null;
let flushTimer = null;

async function getCache() {
  if (memCache) return memCache;
  const stored = await chrome.storage.local.get(CACHE_KEY);
  memCache = stored[CACHE_KEY] || {};
  return memCache;
}

function setCacheEntry(title, entry) {
  if (!memCache) memCache = {};
  memCache[title] = entry;
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushNow, 500);
}

function flushNow() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (memCache) chrome.storage.local.set({ [CACHE_KEY]: memCache });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'fetchRatings') {
    handleFetch(msg.title, msg.apiKey).then(sendResponse);
    return true; // keep channel open for async
  }
});

async function handleFetch(title, apiKey) {
  const cache = await getCache();
  const cached = cache[title];
  // Return cached data if valid AND has the `type` field (old entries missing type get re-fetched)
  if (cached) {
    const ttl = cached.data ? CACHE_TTL : MISS_TTL;
    if (Date.now() - cached.ts < ttl) {
      // Old entries missing `type` field get re-fetched
      if (!cached.data || cached.data.type) return cached.data;
    }
  }

  try {
    const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.Response === 'False') {
      if (json.Error && json.Error.includes('limit')) {
        setApiStatus('limit', 'Daily limit reached — resets at UTC midnight');
        return null;
      }
      if (json.Error && json.Error.includes('Invalid API key')) {
        setApiStatus('invalid', 'Invalid API Key');
        return null;
      }
      // 查不到的片快取 24 小時
      setCacheEntry(title, { ts: Date.now(), data: null });
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

function setApiStatus(status, message) {
  chrome.storage.local.set({ nro_api_status: { status, message, ts: Date.now() } });
}
