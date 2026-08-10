// The popup, rendered against the real popup.html. Loading it at all is the
// test that every id popup.js reaches for still exists in the markup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPopup, loadContent, settle } from './helpers/load.js';
import { createChrome, createFetch } from './helpers/chrome-stub.js';

const entry = (data) => ({ ts: Date.now(), data });
const today = () => new Date().toISOString().slice(0, 10);

const CACHE = {
  Inception: entry({ imdb: '8.8', rt: '87%', mc: '74/100', imdbID: 'tt1375666', type: 'movie', title: 'Inception', year: '2010', full: true }),
  Mediocre: entry({ imdb: '5.4', rt: '31%', mc: '40/100', imdbID: 'tt2', type: 'movie', title: 'Mediocre', year: '2015', full: true }),
  Severance: entry({ imdb: '8.7', rt: '97%', mc: '83/100', imdbID: 'tt3', type: 'series', title: 'Severance', year: '2022', full: true }),
};

async function mount(storage = {}, language = 'en-US') {
  const harness = createChrome(storage);
  const fetchImpl = createFetch([['omdbapi.com', { Response: 'True', Title: 'Inception' }]]);
  const loaded = loadPopup({ chrome: harness.chrome, fetch: fetchImpl, language });
  await settle(10);
  return { ...harness, ...loaded };
}

test('the popup renders without reaching for a missing element', async () => {
  const { document } = await mount({ omdb_api_key: 'KEY', nro_cache: CACHE });
  assert.ok(document.getElementById('rankList'));
  assert.equal(document.querySelectorAll('.rank-item').length, 2, 'two movies, the series is on the other tab');
});

test('the ranking is sorted best first and counts what it shows', async () => {
  const { document } = await mount({ omdb_api_key: 'KEY', nro_cache: CACHE });
  const names = [...document.querySelectorAll('.rank-name')].map(el => el.textContent);
  assert.deepEqual(names, ['Inception', 'Mediocre']);
  assert.match(document.getElementById('rankCount').textContent, /2 total/);
  assert.match(document.getElementById('cacheStats').textContent, /2 movies/);
});

test('the score threshold also filters the popup ranking', async () => {
  const { document } = await mount({
    omdb_api_key: 'KEY',
    nro_cache: CACHE,
    nro_prefs: { source: 'omdb', minScore: 7.5, minSource: 'imdb' },
  });
  const names = [...document.querySelectorAll('.rank-name')].map(el => el.textContent);
  assert.deepEqual(names, ['Inception']);
});

test('moving the slider stores the threshold for the content script', async () => {
  const { document, win, store } = await mount({ omdb_api_key: 'KEY', nro_cache: CACHE });
  const slider = document.getElementById('minScore');
  slider.value = '7.5';
  slider.dispatchEvent(new win.Event('change'));
  await settle(0);

  assert.equal(store.nro_prefs.minScore, 7.5);
  assert.equal(document.getElementById('minScoreVal').textContent, '7.5');
  assert.equal(document.querySelectorAll('.rank-item').length, 1);
});

test('switching the threshold source rescales the slider and resets the value', async () => {
  const { document, win, store } = await mount({
    omdb_api_key: 'KEY',
    nro_cache: CACHE,
    nro_prefs: { source: 'omdb', minScore: 7.5, minSource: 'imdb' },
  });
  const picker = document.getElementById('minSource');
  picker.value = 'rt';
  picker.dispatchEvent(new win.Event('change'));
  await settle(0);

  assert.equal(store.nro_prefs.minSource, 'rt');
  assert.equal(store.nro_prefs.minScore, 0, 'a 7.5 IMDb cut must not become a 7.5% RT cut');
  assert.equal(document.getElementById('minScore').max, '95');
  assert.equal(document.getElementById('minScoreVal').textContent, 'off');
});

test('the data source picker is stored and explains itself', async () => {
  const { document, win, store } = await mount({ omdb_api_key: 'KEY', tmdb_api_key: 'TK' });
  const picker = document.getElementById('sourceMode');
  picker.value = 'tmdb';
  picker.dispatchEvent(new win.Event('change'));
  await settle(0);

  assert.equal(store.nro_prefs.source, 'tmdb');
  assert.match(document.getElementById('sourceHelp').textContent, /no daily cap/i);
});

test('choosing TMDB without a TMDB key warns instead of silently doing nothing', async () => {
  const { document } = await mount({ omdb_api_key: 'KEY', nro_prefs: { source: 'tmdb' } });
  const help = document.getElementById('sourceHelp');
  assert.match(help.textContent, /TMDB API key/i);
  assert.ok(help.className.includes('err'));
});

test('the quota meter shows today usage and hides a stale count', async () => {
  const shown = await mount({ omdb_api_key: 'KEY', nro_quota: { day: today(), count: 340 } });
  assert.notEqual(shown.document.getElementById('quotaBox').style.display, 'none');
  assert.match(shown.document.getElementById('quotaText').textContent, /340 \/ 1000/);
  assert.equal(shown.document.getElementById('quotaFill').style.width, '34%');

  const stale = await mount({ omdb_api_key: 'KEY', nro_quota: { day: '2000-01-01', count: 900 } });
  assert.equal(stale.document.getElementById('quotaBox').style.display, 'none');
});

test('the quota bar turns red as the free tier runs out', async () => {
  const { document } = await mount({ omdb_api_key: 'KEY', nro_quota: { day: today(), count: 960 } });
  assert.ok(document.getElementById('quotaFill').className.includes('hot'));
});

test('a TMDB-only entry is ranked but labelled as TMDB, not IMDb', async () => {
  const { document } = await mount({
    omdb_api_key: 'KEY',
    nro_cache: { Dune: entry({ imdb: null, tmdb: '8.2', imdbID: 'tt9', type: 'movie', title: 'Dune', year: '2021', full: false }) },
  });
  const score = document.querySelector('.rank-score');
  assert.match(score.textContent, /TMDB 8\.2/);
});

test('titles are escaped before they reach innerHTML', async () => {
  const { document } = await mount({
    omdb_api_key: 'KEY',
    nro_cache: { evil: entry({ imdb: '7.0', imdbID: 'tt8', type: 'movie', title: '<img src=x onerror=alert(1)>', year: '2020', full: true }) },
  });
  assert.equal(document.querySelectorAll('.rank-name img').length, 0);
  assert.match(document.querySelector('.rank-name').textContent, /<img src=x/);
});

test('the popup speaks Chinese for zh locales', async () => {
  const { document } = await mount({ omdb_api_key: 'KEY', nro_quota: { day: today(), count: 12 } }, 'zh-TW');
  assert.match(document.getElementById('quotaText').textContent, /今日已用 12 \/ 1000/);
  assert.equal(document.documentElement.lang, 'zh-TW');
});

test('popup.js and content.js normalise titles identically', async () => {
  const popup = await mount({});
  const harness = createChrome({});
  const { win: contentWin } = loadContent({ chrome: harness.chrome, html: '<body></body>' });
  await settle(0);

  const samples = ['The Gray Man', 'Amélie', 'Mr. & Mrs. Smith', 'WALL·E', '怪奇物語', 'A Quiet Place', '  '];
  for (const s of samples) {
    assert.deepEqual([...popup.win.titleKeys(s)], [...contentWin.titleKeys(s)], `titleKeys drifted for "${s}"`);
  }
});
