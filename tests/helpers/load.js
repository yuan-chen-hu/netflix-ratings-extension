// Loads the shipped extension sources unmodified.
//
// background.js runs in a bare vm context (it only needs chrome + fetch);
// content.js runs inside a jsdom window so it sees a real DOM. Both are plain
// scripts, so their top-level `function` declarations land on the realm's
// global object and tests can call them directly.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(import.meta.dirname, '../..');

export function readSource(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

export function loadBackground({ chrome, fetch, language = 'en-US' }) {
  const sandbox = {
    chrome,
    fetch,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    navigator: { language },
    structuredClone,
    // Host objects, not JS intrinsics — a fresh vm realm doesn't get these.
    URL,
    URLSearchParams,
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(readSource('background.js'), context, { filename: 'background.js' });
  return context;
}

// jsdom has no layout engine, so offsetWidth/offsetHeight are always 0 and the
// layout-adaptive code paths would never fire. Tests declare a box on an
// element with data-w / data-h and these getters report it.
function installBoxMetrics(win) {
  const read = (el, attr) => {
    const own = el.getAttribute(attr);
    if (own != null) return Number(own);
    // An element with no declared box reports the union of its children, which
    // is close enough to how a wrapper behaves in a real layout.
    let max = 0;
    el.querySelectorAll(`[${attr}]`).forEach(child => {
      max = Math.max(max, Number(child.getAttribute(attr) || 0));
    });
    return max;
  };
  Object.defineProperty(win.HTMLElement.prototype, 'offsetWidth', {
    configurable: true, get() { return read(this, 'data-w'); },
  });
  Object.defineProperty(win.HTMLElement.prototype, 'offsetHeight', {
    configurable: true, get() { return read(this, 'data-h'); },
  });
}

class FakeIntersectionObserver {
  constructor(cb) { this.cb = cb; this.seen = new Set(); }
  observe(el) {
    if (this.seen.has(el)) return;
    this.seen.add(el);
    // Async, mirroring the real observer — observeCard's synchronous
    // `visibleCards.has()` check must not see the element yet.
    Promise.resolve().then(() => this.cb([{ target: el, isIntersecting: true }]));
  }
  unobserve(el) { this.seen.delete(el); }
  disconnect() { this.seen.clear(); }
}

export function loadContent({ chrome, html, url = 'https://www.netflix.com/browse' }) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const win = dom.window;
  installBoxMetrics(win);
  win.chrome = chrome;
  win.IntersectionObserver = FakeIntersectionObserver;
  win.requestIdleCallback = (fn) => win.setTimeout(fn, 0);
  // Indirect eval: runs in global scope, so `function` declarations become
  // window properties the tests can reach.
  win.eval(readSource('content.js'));
  return { dom, win, document: win.document };
}

// The popup runs against its own HTML, so this doubles as a check that every
// element popup.js reaches for still exists in popup.html.
export function loadPopup({ chrome, fetch, language = 'en-US' }) {
  const html = readSource('popup.html').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'chrome-extension://test/popup.html', runScripts: 'outside-only' });
  const win = dom.window;
  win.chrome = chrome;
  win.fetch = fetch;
  Object.defineProperty(win.navigator, 'language', { value: language, configurable: true });
  win.eval(readSource('popup.js'));
  return { dom, win, document: win.document };
}

// content.js kicks off an async init(); give it (and any queued microtasks) a
// chance to finish before asserting.
export function settle(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
