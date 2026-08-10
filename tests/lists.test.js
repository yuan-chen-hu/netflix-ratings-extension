// Loading public lists: Letterboxd's plain HTML path, IMDb's WAF fallback into
// a background tab, and the weekly refresh alarm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBackground } from './helpers/load.js';
import { createChrome, createFetch } from './helpers/chrome-stub.js';

const LB_LIST = 'https://letterboxd.com/dave/list/best/';

function lbPage(names) {
  return names.map(n =>
    `<li class="poster-container"><div class="film-poster" data-film-slug="${n.toLowerCase().replace(/\W+/g, '-')}" data-film-name="${n}"><img class="image" alt="${n}" src="p.jpg"></div></li>`
  ).join('');
}

test('a Letterboxd list is read straight from the HTML, page by page', async () => {
  const harness = createChrome();
  const fetchImpl = createFetch([[/./, (url) => {
    if (url.endsWith('/page/2/')) return lbPage(['Parasite']);
    if (url.includes('/page/')) return ''; // page 3 onwards is empty
    return lbPage(['Heat', 'Sicario']);
  }]]);
  const ctx = loadBackground({ chrome: harness.chrome, fetch: fetchImpl });

  const res = await ctx.handleListFetch(LB_LIST, 'include');
  assert.equal(res.site, 'letterboxd');
  assert.ok(res.titles.includes('Heat'));
  assert.ok(res.titles.includes('Parasite'));
  assert.deepEqual([...res.ids], [], 'Letterboxd markup carries no IMDb ids');
  assert.equal(harness.store.nro_lists.include.url, LB_LIST);
  assert.equal(harness.store.nro_list_settings.includeOn, true);
});

test('an unreachable list reports empty rather than storing nothing useful', async () => {
  const harness = createChrome();
  harness.chrome.tabs.create = async () => { throw new Error('no tabs'); };
  const ctx = loadBackground({ chrome: harness.chrome, fetch: createFetch([]) });
  const res = await ctx.handleListFetch(LB_LIST, 'include');
  assert.equal(res.error, 'empty');
  assert.equal(harness.store.nro_lists, undefined);
});

test('a bad URL is rejected before any request goes out', async () => {
  const harness = createChrome();
  const fetchImpl = createFetch([]);
  const ctx = loadBackground({ chrome: harness.chrome, fetch: fetchImpl });
  assert.equal((await ctx.handleListFetch('https://example.com/x', 'include')).error, 'bad_url');
  assert.equal(fetchImpl.urls.length, 0);
});

test("IMDb's bot challenge pushes the load into a background tab", async () => {
  const harness = createChrome();
  harness.chrome.scripting.executeScript = async ({ func }) => {
    // Only the list scraper returns data; the "load more" probe finds no button.
    if (func.name === 'scrapeImdbListInPage') {
      return [{ result: { ids: ['tt0111161'], titles: ['The Shawshank Redemption'] } }];
    }
    return [{ result: false }];
  };
  const fetchImpl = createFetch([['imdb.com', '<html>awsWafCookieDomainList</html>']]);
  const ctx = loadBackground({ chrome: harness.chrome, fetch: fetchImpl });

  const res = await ctx.handleListFetch('https://www.imdb.com/list/ls012345678/', 'exclude');
  assert.deepEqual([...res.ids], ['tt0111161']);
  assert.equal(harness.calls.tabsCreated.length, 1);
  assert.equal(harness.calls.tabsRemoved.length, 1, 'the background tab must be closed again');
  assert.equal(harness.store.nro_lists.exclude.count, 1);
});

test('the weekly refresh reloads stale lists and leaves fresh ones alone', async () => {
  const now = Date.now();
  const harness = createChrome({
    nro_lists: {
      include: { url: LB_LIST, site: 'letterboxd', ids: [], titles: ['Heat'], count: 1, ts: now - 8 * 864e5 },
      exclude: { url: 'https://letterboxd.com/dave/watchlist/', site: 'letterboxd', ids: [], titles: ['Dune'], count: 1, ts: now - 864e5 },
    },
    nro_list_settings: { includeOn: false, excludeOn: true, mode: 'dim' },
  });
  const fetchImpl = createFetch([[/./, (url) => (url.includes('/page/') ? '' : lbPage(['Heat', 'Sicario']))]]);
  const ctx = loadBackground({ chrome: harness.chrome, fetch: fetchImpl });

  await ctx.refreshStaleLists();
  assert.ok(fetchImpl.urls.some(u => u.startsWith(LB_LIST)));
  assert.ok(!fetchImpl.urls.some(u => u.includes('watchlist')), 'the day-old list is still fresh');
  assert.ok(harness.store.nro_lists.include.titles.includes('Sicario'), 'the refreshed copy has the new title');
  assert.ok(harness.store.nro_lists.include.ts > now - 1000);
});

test('a background refresh does not switch a list the user turned off back on', async () => {
  const harness = createChrome({
    nro_lists: { include: { url: LB_LIST, site: 'letterboxd', ids: [], titles: ['Heat'], count: 1, ts: 0 } },
    nro_list_settings: { includeOn: false, excludeOn: false, mode: 'dim' },
  });
  const fetchImpl = createFetch([[/./, (url) => (url.includes('/page/') ? '' : lbPage(['Heat']))]]);
  const ctx = loadBackground({ chrome: harness.chrome, fetch: fetchImpl });

  await ctx.refreshStaleLists();
  assert.equal(harness.store.nro_list_settings.includeOn, false);
});

test('a manual load switches the list on', async () => {
  const harness = createChrome({ nro_list_settings: { includeOn: false, excludeOn: false, mode: 'dim' } });
  const fetchImpl = createFetch([[/./, (url) => (url.includes('/page/') ? '' : lbPage(['Heat']))]]);
  const ctx = loadBackground({ chrome: harness.chrome, fetch: fetchImpl });

  await ctx.handleListFetch(LB_LIST, 'include');
  assert.equal(harness.store.nro_list_settings.includeOn, true);
});
