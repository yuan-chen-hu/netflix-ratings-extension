// Netflix Rating Overlay - background.js (service worker)
const CACHE_KEY = 'nro_cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'fetchRatings') {
    handleFetch(msg.title, msg.apiKey).then(sendResponse);
    return true; // keep channel open for async
  }
});

async function handleFetch(title, apiKey) {
  const stored = await chrome.storage.local.get(CACHE_KEY);
  const cache = stored[CACHE_KEY] || {};
  const cached = cache[title];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.Response === 'False') {
      // 配額用完時不快取，讓隔天重試
      if (json.Error && json.Error.includes('limit')) return null;
      // 查不到的片快取 24 小時
      cache[title] = { ts: Date.now(), data: null };
      chrome.storage.local.set({ [CACHE_KEY]: cache });
      return null;
    }
    const imdb = json.imdbRating && json.imdbRating !== 'N/A' ? json.imdbRating : null;
    const rtEntry = (json.Ratings || []).find(r => r.Source === 'Rotten Tomatoes');
    const rt = rtEntry ? rtEntry.Value : null;
    const mcEntry = (json.Ratings || []).find(r => r.Source === 'Metacritic');
    const mc = mcEntry ? mcEntry.Value : (json.Metascore && json.Metascore !== 'N/A' ? json.Metascore + '/100' : null);
    const awards = json.Awards && json.Awards !== 'N/A' ? json.Awards : null;
    const data = { imdb, rt, mc, awards, title: json.Title, year: json.Year };
    cache[title] = { ts: Date.now(), data };
    chrome.storage.local.set({ [CACHE_KEY]: cache });
    return data;
  } catch (e) {
    return null;
  }
}
