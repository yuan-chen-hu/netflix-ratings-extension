// Pure parsing/normalisation helpers in background.js — no network, no DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBackground } from './helpers/load.js';
import { createChrome, createFetch } from './helpers/chrome-stub.js';

function bg() {
  const { chrome } = createChrome();
  return loadBackground({ chrome, fetch: createFetch([]) });
}

test('normalizeListUrl accepts every IMDb shape', () => {
  const { normalizeListUrl } = bg();
  assert.equal(normalizeListUrl('https://www.imdb.com/list/ls012345678/'), 'https://www.imdb.com/list/ls012345678/');
  assert.equal(normalizeListUrl('ls012345678'), 'https://www.imdb.com/list/ls012345678/');
  assert.equal(normalizeListUrl('imdb.com/list/ls012345678/?sort=alpha'), 'https://www.imdb.com/list/ls012345678/');
  assert.equal(normalizeListUrl('https://www.imdb.com/user/ur123456/watchlist'), 'https://www.imdb.com/user/ur123456/watchlist/');
});

test('normalizeListUrl accepts Letterboxd lists, watchlists and film logs', () => {
  const { normalizeListUrl } = bg();
  assert.equal(normalizeListUrl('https://letterboxd.com/dave/list/best-of-2024/'),
    'https://letterboxd.com/dave/list/best-of-2024/');
  assert.equal(normalizeListUrl('letterboxd.com/dave/watchlist/'),
    'https://letterboxd.com/dave/watchlist/');
  assert.equal(normalizeListUrl('https://letterboxd.com/dave/films/by/rating/'),
    'https://letterboxd.com/dave/films/');
});

test('normalizeListUrl rejects unrelated URLs', () => {
  const { normalizeListUrl } = bg();
  assert.equal(normalizeListUrl(''), null);
  assert.equal(normalizeListUrl('https://example.com/list/ls123456789/'), null);
  assert.equal(normalizeListUrl('https://letterboxd.com/dave/'), null);
  assert.equal(normalizeListUrl('https://www.imdb.com/title/tt0111161/'), null);
});

test('listSite distinguishes providers', () => {
  const { listSite } = bg();
  assert.equal(listSite('https://letterboxd.com/dave/watchlist/'), 'letterboxd');
  assert.equal(listSite('https://www.imdb.com/list/ls1/'), 'imdb');
});

test('slugTitles keeps both the year-suffixed and bare form', () => {
  const { slugTitles } = bg();
  // Spread copies the vm realm's arrays into this one so deepEqual can compare them.
  assert.deepEqual([...slugTitles('the-thing-1982')], ['the thing 1982', 'the thing']);
  assert.deepEqual([...slugTitles('parasite')], ['parasite']);
  assert.deepEqual([...slugTitles('')], []);
});

test('parseLetterboxdList reads names, alt text and slugs', () => {
  const { parseLetterboxdList } = bg();
  const html = `
    <li class="poster-container">
      <div class="film-poster" data-film-slug="the-godfather" data-film-name="The Godfather">
        <img class="image" alt="The Godfather" src="x.jpg">
      </div>
    </li>
    <li class="poster-container">
      <div data-item-slug="the-thing-1982"><img class="image" alt="The Thing" src="y.jpg"></div>
    </li>`;
  const titles = new Set();
  parseLetterboxdList(html, titles);
  assert.ok(titles.has('The Godfather'));
  assert.ok(titles.has('The Thing'));
  assert.ok(titles.has('the thing 1982'));
  assert.ok(titles.has('the thing'));
});

test('parseLetterboxdList decodes HTML entities', () => {
  const { parseLetterboxdList } = bg();
  const titles = new Set();
  parseLetterboxdList('<div data-film-name="Tick, Tick&hellip; Boom! &amp; Friends"></div>', titles);
  assert.ok([...titles][0].includes('&') === true || [...titles][0].includes('Boom'));
  assert.ok([...titles].some(t => t.includes('& Friends')));
});

test('parseImdbList walks __NEXT_DATA__ for tt ids and titles', () => {
  const { parseImdbList } = bg();
  const payload = {
    props: { pageProps: { list: { items: [
      { id: 'tt0111161', titleText: { text: 'The Shawshank Redemption' } },
      { id: 'tt0068646', titleText: { text: 'The Godfather' }, originalTitleText: { text: 'Il padrino' } },
    ] } } },
  };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`;
  const ids = new Set(), titles = new Set();
  parseImdbList(html, ids, titles);
  assert.deepEqual([...ids], ['tt0111161', 'tt0068646']);
  assert.ok(titles.has('Il padrino'));
});

test('parseImdbList falls back to legacy markup when there is no __NEXT_DATA__', () => {
  const { parseImdbList } = bg();
  const html = '<a href="/title/tt0133093/">1. The Matrix</a><a href="/title/tt0109830/">2. Forrest Gump</a>';
  const ids = new Set(), titles = new Set();
  parseImdbList(html, ids, titles);
  assert.deepEqual([...ids], ['tt0133093', 'tt0109830']);
  assert.ok(titles.has('The Matrix'));
  assert.ok(!titles.has('1. The Matrix'));
});

test('parseOmdb flattens the OMDb payload and marks it complete', () => {
  const { parseOmdb } = bg();
  const data = parseOmdb({
    Title: 'Inception', Year: '2010', Type: 'movie', imdbID: 'tt1375666', imdbRating: '8.8',
    Metascore: '74', Awards: 'Won 4 Oscars. 159 wins & 220 nominations total.',
    Ratings: [
      { Source: 'Internet Movie Database', Value: '8.8/10' },
      { Source: 'Rotten Tomatoes', Value: '87%' },
      { Source: 'Metacritic', Value: '74/100' },
    ],
  });
  assert.equal(data.imdb, '8.8');
  assert.equal(data.rt, '87%');
  assert.equal(data.mc, '74/100');
  assert.equal(data.type, 'movie');
  assert.equal(data.full, true);
});

test('parseOmdb treats N/A as missing', () => {
  const { parseOmdb } = bg();
  const data = parseOmdb({ Title: 'X', Year: '2020', Type: 'series', imdbID: 'tt1', imdbRating: 'N/A', Metascore: 'N/A', Awards: 'N/A', Ratings: [] });
  assert.equal(data.imdb, null);
  assert.equal(data.mc, null);
  assert.equal(data.awards, null);
});

test('isLocalizedTitle only flags non-Latin scripts', () => {
  const { isLocalizedTitle } = bg();
  assert.equal(isLocalizedTitle('Stranger Things'), false);
  assert.equal(isLocalizedTitle('Le Voyage dans la Lune'), false);
  assert.equal(isLocalizedTitle('Amélie'), false);
  assert.equal(isLocalizedTitle('怪奇物語'), true);
  assert.equal(isLocalizedTitle('오징어 게임'), true);
});

test('pickTmdbResult prefers an exact title match over popularity order', () => {
  const { pickTmdbResult } = bg();
  const results = [
    { id: 1, media_type: 'movie', title: 'Dune: Part Two', release_date: '2024-02-27' },
    { id: 2, media_type: 'movie', title: 'Dune', release_date: '2021-09-15' },
  ];
  assert.equal(pickTmdbResult(results, 'Dune', null).id, 2);
});

test('pickTmdbResult uses the year to separate remakes', () => {
  const { pickTmdbResult } = bg();
  const results = [
    { id: 1, media_type: 'movie', title: 'The Thing', release_date: '2011-10-14' },
    { id: 2, media_type: 'movie', title: 'The Thing', release_date: '1982-06-25' },
  ];
  assert.equal(pickTmdbResult(results, 'The Thing', '1982').id, 2);
  assert.equal(pickTmdbResult(results, 'The Thing', '2011').id, 1);
});

test('pickTmdbResult keeps TMDB ordering when nothing else separates results', () => {
  const { pickTmdbResult } = bg();
  const results = [
    { id: 1, media_type: 'tv', name: 'Unrelated A' },
    { id: 2, media_type: 'tv', name: 'Unrelated B' },
  ];
  assert.equal(pickTmdbResult(results, 'Something Else', null).id, 1);
});
