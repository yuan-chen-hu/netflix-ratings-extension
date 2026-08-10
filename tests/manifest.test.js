// The manifest is the one thing no other test exercises: a missing permission
// fails silently at runtime rather than throwing anywhere the tests can see.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readSource } from './helpers/load.js';

const manifest = JSON.parse(readSource('manifest.json'));
const background = readSource('background.js');

test('every chrome API the background uses is declared', () => {
  const needed = {
    'chrome.storage.': 'storage',
    'chrome.tabs.': 'tabs',
    'chrome.scripting.': 'scripting',
    'chrome.alarms.': 'alarms',
  };
  for (const [usage, permission] of Object.entries(needed)) {
    if (background.includes(usage)) {
      assert.ok(manifest.permissions.includes(permission), `missing "${permission}" permission for ${usage}`);
    }
  }
});

test('every host the background fetches from has a host permission', () => {
  const hosts = ['www.omdbapi.com', 'www.imdb.com', 'letterboxd.com', 'api.themoviedb.org'];
  for (const host of hosts) {
    assert.ok(background.includes(host), `${host} is no longer fetched — drop its host permission`);
    assert.ok(
      manifest.host_permissions.some(p => p.includes(host)),
      `missing host permission for ${host}`);
  }
});

test('the content script runs on the streaming sites it targets', () => {
  const matches = manifest.content_scripts[0].matches.join(' ');
  assert.match(matches, /netflix\.com/);
  assert.match(matches, /disneyplus\.com/);
  assert.deepEqual(manifest.content_scripts[0].js, ['content.js']);
  assert.deepEqual(manifest.content_scripts[0].css, ['ratings.css']);
});

test('the packaged version matches package.json', () => {
  assert.equal(manifest.version, JSON.parse(readSource('package.json')).version);
});
