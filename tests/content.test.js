// content.js against a jsdom Netflix page: card detection, badge anchoring,
// filters and the in-flight title index.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContent, settle } from './helpers/load.js';
import { createChrome } from './helpers/chrome-stub.js';

const fresh = (data) => ({ ts: Date.now(), data });
const rating = (over = {}) => ({
  imdb: '8.8', rt: '87%', mc: '74/100', awards: null,
  imdbID: 'tt1375666', type: 'movie', title: 'Inception', year: '2010', full: true, ...over,
});

// A classic Netflix tile, with the boxes jsdom can't compute declared inline.
function tile({ title, cls = 'title-card-container', href = '/watch/1', w = 200, h = 112 }) {
  return `
    <div class="slider-item">
      <div class="${cls}" data-w="${w}" data-h="${h}">
        <div class="title-card" data-w="${w}" data-h="${h}">
          <a href="${href}" data-w="${w}" data-h="${h}">
            <div class="boxart-container" data-w="${w}" data-h="${h}">
              <img src="a.jpg" alt="${title}" data-w="${w}" data-h="${h}">
            </div>
          </a>
        </div>
      </div>
    </div>`;
}

async function mount(html, storage) {
  const harness = createChrome(storage);
  const loaded = loadContent({ chrome: harness.chrome, html: `<body>${html}</body>` });
  await settle(0);
  return { ...harness, ...loaded };
}

test('badges land on the artwork box of a known Netflix tile', async () => {
  const { win, document } = await mount(tile({ title: 'Inception' }), {
    omdb_api_key: 'KEY',
    nro_cache: { Inception: fresh(rating()) },
  });
  win.selectorScan(document);
  await settle(0);

  const badge = document.querySelector('.nro-badge');
  assert.ok(badge, 'a badge was injected');
  assert.equal(badge.parentElement.className, 'title-card');
  assert.equal(badge.dataset.nroTitle, 'Inception');
  assert.match(badge.innerHTML, /8\.8/);
  assert.match(badge.innerHTML, /87%/);
});

test('grid badges carry no outbound links', async () => {
  const { win, document } = await mount(tile({ title: 'Inception' }), {
    omdb_api_key: 'KEY',
    nro_cache: { Inception: fresh(rating()) },
  });
  win.selectorScan(document);
  await settle(0);
  assert.equal(document.querySelectorAll('.nro-badge a').length, 0);
});

test('tiles are still found when Netflix renames its classes', async () => {
  const html = `
    <div class="rowContainer">
      <a href="/watch/9" data-w="200" data-h="112">
        <div class="art" data-w="200" data-h="112">
          <img src="b.jpg" alt="Andor" data-w="200" data-h="112">
        </div>
      </a>
    </div>`;
  const { win, document } = await mount(html, {
    omdb_api_key: 'KEY',
    nro_cache: { Andor: fresh(rating({ title: 'Andor', imdb: '8.4' })) },
  });
  assert.equal(win.selectorCards(document).size, 0, 'no known class hook matches');
  win.heuristicScan();
  await settle(0);

  const badge = document.querySelector('.nro-badge');
  assert.ok(badge);
  assert.equal(badge.parentElement.className, 'art', 'anchored to the measured artwork box');
});

test('a legacy class that no longer wraps the poster is ignored in favour of the measured box', async () => {
  const html = `
    <div class="title-card-container" data-w="900" data-h="500">
      <div class="title-card" data-w="900" data-h="500">
        <a href="/watch/3" data-w="200" data-h="112">
          <div class="poster" data-w="200" data-h="112">
            <img src="c.jpg" alt="Loki" data-w="200" data-h="112">
          </div>
        </a>
      </div>
    </div>`;
  const { win, document } = await mount(html, {
    omdb_api_key: 'KEY',
    nro_cache: { Loki: fresh(rating({ title: 'Loki' })) },
  });
  win.selectorScan(document);
  await settle(0);
  assert.equal(document.querySelector('.nro-badge').parentElement.className, 'poster');
});

test('the layout report tells the popup which detection path is in use', async () => {
  const { win, document, store } = await mount(tile({ title: 'Inception' }), {
    omdb_api_key: 'KEY',
    nro_cache: { Inception: fresh(rating()) },
  });
  win.heuristicScan();
  await settle(0);
  assert.equal(store.nro_layout.mode, 'mixed');
  assert.ok(store.nro_layout.count >= 1);
  assert.equal(store.nro_layout.host, 'www.netflix.com');
});

test('a recycled card node picks up its new title', async () => {
  const { win, document } = await mount(tile({ title: 'Inception' }), {
    omdb_api_key: 'KEY',
    nro_cache: {
      Inception: fresh(rating()),
      Andor: fresh(rating({ title: 'Andor', imdb: '8.4', rt: '96%' })),
    },
  });
  const card = document.querySelector('.title-card-container');
  win.processCard(card, false);
  assert.equal(document.querySelector('.nro-badge').dataset.nroTitle, 'Inception');

  document.querySelector('img').setAttribute('alt', 'Andor');
  win.processCard(card, false);
  const badges = document.querySelectorAll('.nro-badge');
  assert.equal(badges.length, 1, 'the stale badge is removed, not duplicated');
  assert.equal(badges[0].dataset.nroTitle, 'Andor');
  assert.match(badges[0].innerHTML, /8\.4/);
});

test('one fetch serves every tile sharing a title', async () => {
  const harness = createChrome({ omdb_api_key: 'KEY' });
  let calls = 0;
  harness.chrome.runtime.sendMessage = async (msg) => {
    calls++;
    assert.equal(msg.title, 'Inception');
    return rating();
  };
  const { win, document } = loadContent({
    chrome: harness.chrome,
    html: `<body>${tile({ title: 'Inception' })}${tile({ title: 'Inception', href: '/watch/2' })}</body>`,
  });
  await settle(0);
  win.selectorScan(document);
  await settle(10);

  assert.equal(calls, 1, 'the duplicate title is not re-requested');
  assert.equal(document.querySelectorAll('.nro-badge').length, 2, 'both tiles get the result');
});

test('a mutation inside one row is enough to badge a newly inserted tile', async () => {
  const { win, document } = await mount('<div id="row"></div>', {
    omdb_api_key: 'KEY',
    nro_cache: { Inception: fresh(rating()) },
  });
  await settle(250); // let the initial scan pass finish
  document.getElementById('row').innerHTML = tile({ title: 'Inception' });
  await settle(300); // MutationObserver → debounced scoped scan

  assert.ok(document.querySelector('.nro-badge'), 'the scoped scan found the new tile');
});

test('the TMDB pill stands in when only a TMDB score is known', async () => {
  const { win, document } = await mount(tile({ title: 'Inception' }), {
    omdb_api_key: 'KEY',
    nro_cache: {
      Inception: fresh({ imdb: null, rt: null, mc: null, tmdb: '8.4', imdbID: 'tt1375666', type: 'movie', title: 'Inception', year: '2010', full: false }),
    },
  });
  win.selectorScan(document);
  await settle(0);
  const badge = document.querySelector('.nro-badge');
  assert.match(badge.innerHTML, /nro-tmdb/);
  assert.match(badge.innerHTML, /8\.4/);
  assert.ok(!badge.innerHTML.includes('nro-imdb'));
});

test('cleanTitle strips platform decoration but keeps verb-like titles intact', async () => {
  const { win } = await mount('', {});
  assert.equal(win.cleanTitle('Loki | Disney+'), 'Loki');
  assert.equal(win.cleanTitle('Andor – poster'), 'Andor');
  assert.equal(win.cleanTitle('觀看 怪奇物語'), '怪奇物語');
  assert.equal(win.cleanTitle('  The   Bear  '), 'The Bear');
  assert.equal(win.cleanTitle('Play Dirty'), 'Play Dirty');
  assert.equal(win.cleanTitle('Watch Dogs'), 'Watch Dogs');
});

test('titleKeys normalises case, punctuation, diacritics and leading articles', async () => {
  const { win } = await mount('', {});
  assert.deepEqual([...win.titleKeys('The Gray Man')], ['the gray man', 'gray man']);
  assert.deepEqual([...win.titleKeys('Amélie')], ['amelie']);
  assert.deepEqual([...win.titleKeys('Mr. & Mrs. Smith')], ['mr and mrs smith']);
  assert.deepEqual([...win.titleKeys('  ')], []);
});
