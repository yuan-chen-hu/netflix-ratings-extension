// End-to-end behaviour of background.js's fetch pipeline: provider ordering,
// caching, the OMDb quota counter and the persistent id map.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBackground } from './helpers/load.js';
import { createChrome, createFetch } from './helpers/chrome-stub.js';

const OMDB_INCEPTION = {
  Response: 'True', Title: 'Inception', Year: '2010', Type: 'movie', imdbID: 'tt1375666',
  imdbRating: '8.8', Metascore: '74', Awards: 'Won 4 Oscars.',
  Ratings: [{ Source: 'Rotten Tomatoes', Value: '87%' }, { Source: 'Metacritic', Value: '74/100' }],
};

const TMDB_SEARCH = {
  results: [{
    id: 27205, media_type: 'movie', title: 'Inception', original_title: 'Inception',
    release_date: '2010-07-15', vote_average: 8.369, vote_count: 36000,
  }],
};

function setup({ storage = {}, routes = [] } = {}) {
  const harness = createChrome(storage);
  const fetchImpl = createFetch(routes);
  const ctx = loadBackground({ chrome: harness.chrome, fetch: fetchImpl });
  return { ...harness, ctx, fetch: fetchImpl };
}

const omdbRoute = (body = OMDB_INCEPTION) => ['omdbapi.com', body];
const tmdbRoutes = (search = TMDB_SEARCH, imdbId = 'tt1375666') => [
  ['/external_ids', { imdb_id: imdbId }],
  ['/search/multi', search],
  [/themoviedb\.org\/3\/(movie|tv)\/\d+\?/, { id: 27205, title: 'Inception', release_date: '2010-07-15', vote_average: 8.4 }],
];

test('OMDb mode returns flattened ratings and caches them', async () => {
  const { ctx, store, fetch } = setup({ routes: [omdbRoute()] });
  const data = await ctx.handleFetch('Inception', 'KEY', null, false);
  assert.equal(data.imdb, '8.8');
  assert.equal(data.rt, '87%');
  assert.equal(store.nro_cache.Inception.data.imdbID, 'tt1375666');

  const again = await ctx.handleFetch('Inception', 'KEY', null, false);
  assert.equal(again.imdb, '8.8');
  assert.equal(fetch.urls.length, 1, 'second call must be served from cache');
});

test('an OMDb miss is cached so the same title is not re-queried', async () => {
  const { ctx, store, fetch } = setup({ routes: [omdbRoute({ Response: 'False', Error: 'Movie not found!' })] });
  assert.equal(await ctx.handleFetch('Nope', 'KEY', null, false), null);
  assert.equal(store.nro_cache.Nope.data, null);
  assert.equal(await ctx.handleFetch('Nope', 'KEY', null, false), null);
  assert.equal(fetch.urls.length, 1);
});

test('every OMDb call is counted against the daily quota', async () => {
  const { ctx } = setup({ routes: [omdbRoute()] });
  await ctx.handleFetch('Inception', 'KEY', null, false);
  await ctx.handleFetch('Other', 'KEY', null, false);
  const q = await ctx.getQuota();
  assert.equal(q.count, 2);
  assert.equal(q.day, new Date().toISOString().slice(0, 10));
});

test('a quota counter left over from a previous UTC day resets', async () => {
  const { ctx } = setup({
    storage: { nro_quota: { day: '2000-01-01', count: 998 } },
    routes: [omdbRoute()],
  });
  await ctx.handleFetch('Inception', 'KEY', null, false);
  const q = await ctx.getQuota();
  assert.equal(q.count, 1);
});

test('a localized title is resolved through TMDB before OMDb is queried by id', async () => {
  const { ctx, fetch } = setup({
    storage: { tmdb_api_key: 'TK' },
    routes: [...tmdbRoutes(), omdbRoute()],
  });
  const data = await ctx.handleFetch('全面啟動', 'KEY', null, false);
  assert.equal(data.imdb, '8.8');
  assert.match(fetch.urls[0], /search\/multi/);
  assert.match(fetch.urls[1], /external_ids/);
  assert.match(fetch.urls[2], /omdbapi\.com\/\?i=tt1375666/);
});

test('the id map spares the second localized lookup its TMDB search', async () => {
  const { ctx, fetch } = setup({
    storage: {
      tmdb_api_key: 'TK',
      nro_idmap: { '全面啟動|': { imdbID: 'tt1375666', tmdbId: 27205, mediaType: 'movie', ts: Date.now() } },
    },
    routes: [...tmdbRoutes(), omdbRoute()],
  });
  await ctx.handleFetch('全面啟動', 'KEY', null, false);
  assert.equal(fetch.urls.filter(u => u.includes('search/multi')).length, 0);
  assert.match(fetch.urls[0], /omdbapi\.com\/\?i=tt1375666/);
});

test('a cold localized lookup writes the id map', async () => {
  const { ctx, store } = setup({
    storage: { tmdb_api_key: 'TK' },
    routes: [...tmdbRoutes(), omdbRoute()],
  });
  await ctx.handleFetch('全面啟動', 'KEY', '2010', false);
  await new Promise(r => setTimeout(r, 1100)); // debounced write
  assert.equal(store.nro_idmap['全面啟動|2010'].imdbID, 'tt1375666');
});

test('a Latin title that OMDb cannot find falls back to TMDB', async () => {
  const { ctx, fetch } = setup({
    storage: { tmdb_api_key: 'TK' },
    routes: [
      ['omdbapi.com/?t=', { Response: 'False', Error: 'Movie not found!' }],
      ...tmdbRoutes(),
      omdbRoute(),
    ],
  });
  const data = await ctx.handleFetch('Inception', 'KEY', null, false);
  assert.equal(data.imdb, '8.8');
  assert.match(fetch.urls[0], /omdbapi\.com\/\?t=/);
  assert.ok(fetch.urls.some(u => u.includes('search/multi')));
});

test('a quota/key error skips the TMDB fallback entirely', async () => {
  const { ctx, fetch, store } = setup({
    storage: { tmdb_api_key: 'TK' },
    routes: [
      ['omdbapi.com', { Response: 'False', Error: 'Request limit reached!' }],
      ...tmdbRoutes(),
    ],
  });
  assert.equal(await ctx.handleFetch('Inception', 'KEY', null, false), null);
  assert.equal(fetch.urls.filter(u => u.includes('themoviedb')).length, 0);
  assert.equal(store.nro_api_status.status, 'limit');
  assert.equal(store.nro_cache, undefined, 'a quota failure must not be cached as a miss');
});

test('TMDB-primary mode serves grid tiles without spending OMDb quota', async () => {
  const { ctx, fetch } = setup({
    storage: { tmdb_api_key: 'TK', nro_prefs: { source: 'tmdb' } },
    routes: [...tmdbRoutes(), omdbRoute()],
  });
  const data = await ctx.handleFetch('Inception', 'KEY', null, false);
  assert.equal(data.tmdb, '8.4');
  assert.equal(data.imdb, null);
  assert.equal(data.imdbID, 'tt1375666');
  assert.equal(data.type, 'movie');
  assert.equal(data.year, '2010');
  assert.equal(data.full, false);
  assert.equal(fetch.urls.filter(u => u.includes('omdbapi')).length, 0);
  assert.equal((await ctx.getQuota()).count, 0);
});

test('TMDB-primary mode calls OMDb by id for the detail view', async () => {
  const { ctx, fetch } = setup({
    storage: { tmdb_api_key: 'TK', nro_prefs: { source: 'tmdb' } },
    routes: [...tmdbRoutes(), omdbRoute()],
  });
  const data = await ctx.handleFetch('Inception', 'KEY', null, true);
  assert.equal(data.rt, '87%');
  assert.equal(data.imdb, '8.8');
  assert.equal(data.tmdb, '8.4', 'the TMDB score is kept alongside the OMDb ratings');
  assert.equal(data.full, true);
  assert.equal(fetch.urls.filter(u => u.includes('omdbapi.com/?i=tt1375666')).length, 1);
});

test('a cached TMDB-only record is upgraded when the detail view asks for it', async () => {
  const { ctx, fetch } = setup({
    storage: { tmdb_api_key: 'TK', nro_prefs: { source: 'tmdb' } },
    routes: [...tmdbRoutes(), omdbRoute()],
  });
  const grid = await ctx.handleFetch('Inception', 'KEY', null, false);
  assert.equal(grid.full, false);
  const detail = await ctx.handleFetch('Inception', 'KEY', null, true);
  assert.equal(detail.full, true);
  assert.equal(detail.rt, '87%');
  // …and the enriched record now satisfies a repeat detail request from cache.
  const before = fetch.urls.length;
  await ctx.handleFetch('Inception', 'KEY', null, true);
  assert.equal(fetch.urls.length, before);
});

test('TMDB-primary mode marks the detail attempt even when there is no IMDb id', async () => {
  const { ctx } = setup({
    storage: { tmdb_api_key: 'TK', nro_prefs: { source: 'tmdb' } },
    routes: [
      ['/external_ids', { imdb_id: null }],
      ['/search/multi', TMDB_SEARCH],
      omdbRoute(),
    ],
  });
  const data = await ctx.handleFetch('Inception', 'KEY', null, true);
  assert.equal(data.detailTried, true, 'without this the hover view refetches forever');
  assert.equal(data.full, false);
});

test('TMDB-primary mode falls back to OMDb when TMDB knows nothing', async () => {
  const { ctx } = setup({
    storage: { tmdb_api_key: 'TK', nro_prefs: { source: 'tmdb' } },
    routes: [['/search/multi', { results: [] }], omdbRoute()],
  });
  const data = await ctx.handleFetch('Inception', 'KEY', null, false);
  assert.equal(data.imdb, '8.8');
});

test('TMDB-primary mode without a TMDB key behaves like OMDb mode', async () => {
  const { ctx, fetch } = setup({
    storage: { nro_prefs: { source: 'tmdb' } },
    routes: [omdbRoute()],
  });
  const data = await ctx.handleFetch('Inception', 'KEY', null, false);
  assert.equal(data.imdb, '8.8');
  assert.match(fetch.urls[0], /omdbapi/);
});

test('TMDB search is asked for results in the browser language', async () => {
  const harness = createChrome({ tmdb_api_key: 'TK', nro_prefs: { source: 'tmdb' } });
  const fetchImpl = createFetch([...tmdbRoutes(), omdbRoute()]);
  const ctx = loadBackground({ chrome: harness.chrome, fetch: fetchImpl, language: 'zh-TW' });
  await ctx.handleFetch('Inception', 'KEY', null, false);
  assert.match(fetchImpl.urls.find(u => u.includes('search/multi')), /language=zh-TW/);
});
