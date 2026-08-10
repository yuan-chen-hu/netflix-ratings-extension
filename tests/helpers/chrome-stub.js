// A minimal chrome.* implementation: enough surface for background.js and
// content.js to run unmodified, with the storage writes observable from tests.

export function createChrome(initial = {}) {
  const store = structuredClone(initial);
  const changeListeners = [];
  const messageListeners = [];
  const calls = { tabsCreated: [], tabsRemoved: [], executed: [], alarms: [] };

  const pick = (keys) => {
    if (keys == null) return structuredClone(store);
    const list = Array.isArray(keys) ? keys : [keys];
    const out = {};
    list.forEach(k => { if (k in store) out[k] = structuredClone(store[k]); });
    return out;
  };

  // chrome.storage callbacks are always delivered asynchronously — code that
  // only works when they fire synchronously would break in a real browser.
  const later = (cb, arg) => { queueMicrotask(() => cb(arg)); };

  const local = {
    get(keys, cb) {
      const result = pick(typeof keys === 'string' || Array.isArray(keys) ? keys : null);
      if (cb) { later(cb, result); return undefined; }
      return Promise.resolve(result);
    },
    set(obj, cb) {
      const changes = {};
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: store[k], newValue: v };
        store[k] = structuredClone(v);
      }
      changeListeners.forEach(fn => fn(changes, 'local'));
      if (cb) { later(cb); return undefined; }
      return Promise.resolve();
    },
    remove(keys, cb) {
      const list = Array.isArray(keys) ? keys : [keys];
      const changes = {};
      list.forEach(k => { changes[k] = { oldValue: store[k], newValue: undefined }; delete store[k]; });
      changeListeners.forEach(fn => fn(changes, 'local'));
      if (cb) { later(cb); return undefined; }
      return Promise.resolve();
    },
  };

  const chrome = {
    storage: {
      local,
      onChanged: { addListener: (fn) => changeListeners.push(fn) },
    },
    runtime: {
      lastError: null,
      onMessage: { addListener: (fn) => messageListeners.push(fn), removeListener: () => {} },
      // Overridden per-test where the content script needs a canned reply.
      sendMessage: async () => null,
    },
    tabs: {
      onUpdated: { addListener: () => {}, removeListener: () => {} },
      create: async (opts) => { calls.tabsCreated.push(opts); return { id: 1, status: 'complete' }; },
      update: async () => ({ id: 1 }),
      get: async () => ({ id: 1, status: 'complete' }),
      remove: async (id) => { calls.tabsRemoved.push(id); },
    },
    scripting: {
      executeScript: async (opts) => { calls.executed.push(opts); return [{ result: null }]; },
    },
    alarms: {
      create: (name, info) => calls.alarms.push({ name, info }),
      onAlarm: { addListener: () => {} },
    },
  };

  return {
    chrome,
    store,
    calls,
    // Deliver a message the way the extension messaging layer would.
    dispatchMessage(msg) {
      return new Promise(resolve => {
        for (const fn of messageListeners) {
          const kept = fn(msg, {}, resolve);
          if (kept) return;
        }
        resolve(undefined);
      });
    },
  };
}

// Records every URL requested and replies from a routing table. Each route is
// [matcher, responder]; the responder returns the JSON/text body.
export function createFetch(routes) {
  const urls = [];
  const fetchImpl = async (url, opts) => {
    urls.push(String(url));
    for (const [match, respond] of routes) {
      if (typeof match === 'string' ? String(url).includes(match) : match.test(String(url))) {
        const body = typeof respond === 'function' ? await respond(String(url), opts) : respond;
        if (body && body.__status) {
          return { ok: body.__status < 400, status: body.__status, json: async () => ({}), text: async () => '' };
        }
        const isText = typeof body === 'string';
        return {
          ok: true,
          status: 200,
          json: async () => (isText ? JSON.parse(body) : body),
          text: async () => (isText ? body : JSON.stringify(body)),
        };
      }
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  };
  fetchImpl.urls = urls;
  return fetchImpl;
}
