// List filtering and the score threshold, as applied to page tiles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContent, settle } from './helpers/load.js';
import { createChrome } from './helpers/chrome-stub.js';

const fresh = (data) => ({ ts: Date.now(), data });

function tile(title, href) {
  return `
    <div class="slider-item" data-title="${title}">
      <div class="title-card-container" data-w="200" data-h="112">
        <div class="title-card" data-w="200" data-h="112">
          <a href="${href}" data-w="200" data-h="112">
            <div class="boxart-container" data-w="200" data-h="112">
              <img src="a.jpg" alt="${title}" data-w="200" data-h="112">
            </div>
          </a>
        </div>
      </div>
    </div>`;
}

async function mount(titles, storage) {
  const harness = createChrome(storage);
  const html = `<body>${titles.map((t, i) => tile(t, `/watch/${i}`)).join('')}</body>`;
  const loaded = loadContent({ chrome: harness.chrome, html });
  await settle(0);
  loaded.win.selectorScan(loaded.document);
  await settle(0);
  return { ...harness, ...loaded };
}

const slot = (titles, ids = []) => ({ url: 'https://letterboxd.com/x/list/y/', ids, titles, count: titles.length, ts: Date.now() });
const filtered = (doc, title) => doc.querySelector(`.slider-item[data-title="${title}"]`).classList.contains('nro-filtered');
const hidden = (doc, title) => doc.querySelector(`.slider-item[data-title="${title}"]`).classList.contains('nro-filtered-hide');

test('an exclude list dims the titles it contains', async () => {
  const { document } = await mount(['Inception', 'Andor'], {
    nro_lists: { exclude: slot(['Inception']) },
    nro_list_settings: { excludeOn: true, includeOn: false, mode: 'dim' },
  });
  assert.equal(filtered(document, 'Inception'), true);
  assert.equal(filtered(document, 'Andor'), false);
});

test('an include list dims everything it does not contain', async () => {
  const { document } = await mount(['Inception', 'Andor'], {
    nro_lists: { include: slot(['Inception']) },
    nro_list_settings: { includeOn: true, excludeOn: false, mode: 'dim' },
  });
  assert.equal(filtered(document, 'Inception'), false);
  assert.equal(filtered(document, 'Andor'), true);
});

test('hide mode adds the display:none class as well', async () => {
  const { document } = await mount(['Inception'], {
    nro_lists: { exclude: slot(['Inception']) },
    nro_list_settings: { excludeOn: true, includeOn: false, mode: 'hide' },
  });
  assert.equal(hidden(document, 'Inception'), true);
});

test('a list switched off filters nothing', async () => {
  const { document } = await mount(['Inception'], {
    nro_lists: { exclude: slot(['Inception']) },
    nro_list_settings: { excludeOn: false, includeOn: false, mode: 'dim' },
  });
  assert.equal(filtered(document, 'Inception'), false);
});

test('title matching survives articles, case and punctuation', async () => {
  const { document } = await mount(['The Gray Man', 'Mr. & Mrs. Smith'], {
    nro_lists: { exclude: slot(['gray man', 'Mr and Mrs Smith']) },
    nro_list_settings: { excludeOn: true, includeOn: false, mode: 'dim' },
  });
  assert.equal(filtered(document, 'The Gray Man'), true);
  assert.equal(filtered(document, 'Mr. & Mrs. Smith'), true);
});

test('an IMDb id in the list matches even when the displayed title differs', async () => {
  const { document } = await mount(['全面啟動'], {
    omdb_api_key: 'KEY',
    nro_cache: { 全面啟動: fresh({ imdb: '8.8', imdbID: 'tt1375666', type: 'movie', title: 'Inception', year: '2010', full: true }) },
    nro_lists: { exclude: slot([], ['tt1375666']) },
    nro_list_settings: { excludeOn: true, includeOn: false, mode: 'dim' },
  });
  assert.equal(filtered(document, '全面啟動'), true);
});

test('the score threshold dims titles below the cut', async () => {
  const { document } = await mount(['Good', 'Bad'], {
    omdb_api_key: 'KEY',
    nro_prefs: { source: 'omdb', minScore: 7.5, minSource: 'imdb' },
    nro_cache: {
      Good: fresh({ imdb: '8.8', imdbID: 'tt1', type: 'movie', title: 'Good', year: '2010', full: true }),
      Bad: fresh({ imdb: '5.1', imdbID: 'tt2', type: 'movie', title: 'Bad', year: '2011', full: true }),
    },
  });
  assert.equal(filtered(document, 'Good'), false);
  assert.equal(filtered(document, 'Bad'), true);
});

test('a title with no rating at all is never hidden by the threshold', async () => {
  const { document } = await mount(['Unknown', 'Unrated'], {
    omdb_api_key: 'KEY',
    nro_prefs: { source: 'omdb', minScore: 7.5, minSource: 'imdb' },
    nro_cache: {
      Unknown: fresh(null), // OMDb had no match
      Unrated: fresh({ imdb: null, imdbID: 'tt3', type: 'movie', title: 'Unrated', year: '2012', full: true }),
    },
  });
  assert.equal(filtered(document, 'Unknown'), false);
  assert.equal(filtered(document, 'Unrated'), false);
});

test('the threshold reads the TMDB score when that is all there is', async () => {
  const { document } = await mount(['Tmdb'], {
    omdb_api_key: 'KEY',
    nro_prefs: { source: 'tmdb', minScore: 7.5, minSource: 'imdb' },
    nro_cache: { Tmdb: fresh({ imdb: null, tmdb: '6.2', imdbID: 'tt4', type: 'movie', title: 'Tmdb', year: '2013', full: false }) },
  });
  assert.equal(filtered(document, 'Tmdb'), true);
});

test('a percentage threshold applies to Rotten Tomatoes', async () => {
  const { document } = await mount(['Fresh', 'Rotten'], {
    omdb_api_key: 'KEY',
    nro_prefs: { source: 'omdb', minScore: 75, minSource: 'rt' },
    nro_cache: {
      Fresh: fresh({ imdb: '5.0', rt: '92%', imdbID: 'tt5', type: 'movie', title: 'Fresh', year: '2014', full: true }),
      Rotten: fresh({ imdb: '9.0', rt: '31%', imdbID: 'tt6', type: 'movie', title: 'Rotten', year: '2015', full: true }),
    },
  });
  assert.equal(filtered(document, 'Fresh'), false);
  assert.equal(filtered(document, 'Rotten'), true);
});

test('changing the threshold in the popup re-filters open tabs', async () => {
  const { chrome, document } = await mount(['Bad'], {
    omdb_api_key: 'KEY',
    nro_cache: { Bad: fresh({ imdb: '5.1', imdbID: 'tt2', type: 'movie', title: 'Bad', year: '2011', full: true }) },
  });
  assert.equal(filtered(document, 'Bad'), false);

  await chrome.storage.local.set({ nro_prefs: { source: 'omdb', minScore: 7.5, minSource: 'imdb' } });
  await settle(250); // storage change → reload settings → rescan
  assert.equal(filtered(document, 'Bad'), true);

  await chrome.storage.local.set({ nro_prefs: { source: 'omdb', minScore: 0, minSource: 'imdb' } });
  await settle(250);
  assert.equal(filtered(document, 'Bad'), false);
});
