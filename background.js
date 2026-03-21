// Netflix Rating Overlay - background.js (service worker)
const CACHE_KEY = 'nro_cache';
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
function rateLimitedFetch(url) {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeRequests++;
      fetch(url)
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
      if (!cached.data || cached.data.type) return cached.data;
    }
  }

  try {
    const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`;
    const res = await rateLimitedFetch(url);
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

function setApiStatus(status, message) {
  chrome.storage.local.set({ nro_api_status: { status, message, ts: Date.now() } });
}
