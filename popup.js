// --- i18n ---
const isChinese = /^zh\b/i.test(navigator.language);

const i18n = {
  zh: {
    save: '儲存',
    placeholder_apikey: '貼上你的 OMDb API Key...',
    sort_by: '排序依',
    no_data: '尚無資料',
    tv_show: 'TV Show',
    preview: '預覽效果：',
    api_help: '免費 API Key 請到：',
    api_limit: '（免費版每天 1,000 次查詢）',
    enter_key: '請輸入 API Key',
    enter_key_above: '請在上方輸入 OMDb API Key',
    checking: '檢查中...',
    validating: '驗證中...',
    invalid_key: '❌ API Key 無效',
    save_ok: '✅ 儲存成功！重新整理 Netflix 即可看到評分',
    save_ok_no_verify: '✅ 已儲存（無法驗證，請確認網路）',
    limit_reached: '⚠ 每日上限已達 — UTC 00:00 重置（台灣 08:00）',
    network_error: '無法連線 OMDb — 請檢查網路',
    skip: '跳過',
    count: (n) => `共 ${n} 筆`,
  },
  en: {
    save: 'Save',
    placeholder_apikey: 'Paste your OMDb API Key...',
    sort_by: 'Sort by',
    no_data: 'No data yet',
    tv_show: 'TV Show',
    preview: 'Preview:',
    api_help: 'Get a free API Key at:',
    api_limit: '(Free tier: 1,000 requests/day)',
    enter_key: 'Please enter API Key',
    enter_key_above: 'Enter your OMDb API Key above',
    checking: 'Checking...',
    validating: 'Validating...',
    invalid_key: '❌ Invalid API Key',
    save_ok: '✅ Saved! Refresh Netflix to see ratings',
    save_ok_no_verify: '✅ Saved (could not verify — check network)',
    limit_reached: '⚠ Daily limit reached — resets at UTC 00:00',
    network_error: 'Cannot reach OMDb — check network',
    skip: 'Skip',
    count: (n) => `${n} total`,
  },
};

const t = isChinese ? i18n.zh : i18n.en;

// Apply i18n to static HTML elements
document.querySelectorAll('[data-i18n]').forEach(el => {
  const key = el.dataset.i18n;
  if (t[key]) el.textContent = t[key];
});
document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
  const key = el.dataset.i18nPlaceholder;
  if (t[key]) el.placeholder = t[key];
});
if (isChinese) document.documentElement.lang = 'zh-TW';

// --- API Key ---
const keyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const status = document.getElementById('status');
const apiStatus = document.getElementById('apiStatus');
const apiStatusText = document.getElementById('apiStatusText');

chrome.storage.local.get('omdb_api_key', async (data) => {
  const key = data.omdb_api_key || '';
  if (key) keyInput.value = key;

  if (!key) {
    setApiStatusUI('unknown', t.enter_key_above);
    return;
  }

  setApiStatusUI('unknown', t.checking);
  try {
    const res = await fetch(`https://www.omdbapi.com/?t=inception&apikey=${key}`);
    const json = await res.json();
    if (json.Response === 'False') {
      const err = (json.Error || '').toLowerCase();
      if (err.includes('limit')) {
        setApiStatusUI('limit', t.limit_reached);
        chrome.storage.local.set({ nro_api_status: { status: 'limit', ts: Date.now() } });
      } else if (err.includes('invalid')) {
        setApiStatusUI('invalid', '✕ Invalid API Key');
        chrome.storage.local.set({ nro_api_status: { status: 'invalid', ts: Date.now() } });
      } else {
        setApiStatusUI('ok', '✓ Working');
      }
    } else {
      setApiStatusUI('ok', '✓ Working');
      chrome.storage.local.set({ nro_api_status: { status: 'ok', ts: Date.now() } });
    }
  } catch (e) {
    setApiStatusUI('unknown', t.network_error);
  }
});

function setApiStatusUI(type, text) {
  apiStatus.className = `api-status ${type}`;
  apiStatusText.textContent = text;
}

saveBtn.addEventListener('click', async () => {
  const key = keyInput.value.trim();
  if (!key) {
    showStatus(t.enter_key, '#f87171');
    return;
  }

  try {
    showStatus(t.validating, '#facc15');
    const res = await fetch(`https://www.omdbapi.com/?t=inception&apikey=${key}`);
    const json = await res.json();
    if (json.Response === 'False' && json.Error && json.Error.toLowerCase().includes('invalid api key')) {
      showStatus(t.invalid_key, '#f87171');
      return;
    }
    await chrome.storage.local.set({ omdb_api_key: key });
    showStatus(t.save_ok, '#4ade80');
  } catch (e) {
    await chrome.storage.local.set({ omdb_api_key: key });
    showStatus(t.save_ok_no_verify, '#facc15');
  }
});

function showStatus(msg, color) {
  status.textContent = msg;
  status.style.color = color;
}

keyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});

// --- Ranking ---
let currentSource = 'imdb';
let currentType = 'movie';
let skippedTitles = new Set();
let cachedItems = { movie: [], series: [] };

document.querySelectorAll('#sourceTabs .tab-btn').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#sourceTabs .tab-btn').forEach(b => b.classList.remove('active'));
    tab.classList.add('active');
    currentSource = tab.dataset.source;
    skippedTitles.clear();
    loadAndRender();
  });
});

document.querySelectorAll('#typeTabs .tab-btn').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#typeTabs .tab-btn').forEach(b => b.classList.remove('active'));
    tab.classList.add('active');
    currentType = tab.dataset.type;
    skippedTitles.clear();
    renderList();
  });
});

function parseScore(source, ratings) {
  if (source === 'imdb') return ratings.imdb ? parseFloat(ratings.imdb) : null;
  if (source === 'rt') return ratings.rt ? parseInt(ratings.rt) : null;
  if (source === 'mc') return ratings.mc ? parseInt(ratings.mc) : null;
  return null;
}

function formatScore(source, ratings) {
  if (source === 'imdb') return ratings.imdb;
  if (source === 'rt') return ratings.rt;
  if (source === 'mc') return ratings.mc;
  return null;
}

function scoreClass(source, val) {
  if (source === 'imdb') return val >= 7.5 ? 'great' : val >= 6 ? 'ok' : 'bad';
  if (source === 'rt') return val >= 75 ? 'great' : val >= 60 ? 'ok' : 'bad';
  if (source === 'mc') return val >= 75 ? 'great' : val >= 50 ? 'ok' : 'bad';
  return '';
}

function sourceLabel(source) {
  if (source === 'imdb') return 'IMDb';
  if (source === 'rt') return '🍅 RT';
  if (source === 'mc') return 'Metacritic';
  return '';
}

function renderList() {
  const listEl = document.getElementById('rankList');
  const countEl = document.getElementById('rankCount');
  const items = cachedItems[currentType] || [];
  const filtered = items.filter(it => !skippedTitles.has(it.rawTitle));

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="rank-empty">${t.no_data}</div>`;
    countEl.textContent = '';
    return;
  }

  listEl.innerHTML = filtered.map((item, i) => {
    const cls = scoreClass(currentSource, item.score);
    const display = formatScore(currentSource, item.ratings);
    const isTop3 = i < 3 ? ' top3' : '';
    const yearStr = item.year ? `(${item.year})` : '';
    return `
      <div class="rank-item${isTop3}">
        <span class="rank-num">${i + 1}</span>
        <div class="rank-info">
          <div class="rank-name" title="${item.title}" data-search="${encodeURIComponent(item.title)}">${item.title}</div>
          <div class="rank-meta">${yearStr} <span class="rank-score ${cls}">${sourceLabel(currentSource)} ${display}</span></div>
        </div>
        <button class="rank-skip" data-title="${item.rawTitle}">${t.skip}</button>
      </div>`;
  }).join('');

  countEl.textContent = t.count(filtered.length);

  listEl.querySelectorAll('.rank-name').forEach(el => {
    el.addEventListener('click', () => {
      chrome.tabs.create({ url: `https://www.netflix.com/search?q=${el.dataset.search}` });
    });
  });

  listEl.querySelectorAll('.rank-skip').forEach(btn => {
    btn.addEventListener('click', () => {
      skippedTitles.add(btn.dataset.title);
      renderList();
    });
  });
}

async function loadAndRender() {
  const stored = await chrome.storage.local.get('nro_cache');
  const cache = stored.nro_cache || {};

  cachedItems = { movie: [], series: [] };

  for (const [title, entry] of Object.entries(cache)) {
    if (!entry.data) continue;
    const val = parseScore(currentSource, entry.data);
    if (val == null) continue;
    const item = {
      title: entry.data.title || title,
      rawTitle: title,
      score: val,
      ratings: entry.data,
      year: entry.data.year || '',
    };
    if (entry.data.type === 'series') {
      cachedItems.series.push(item);
    } else {
      cachedItems.movie.push(item);
    }
  }

  cachedItems.movie.sort((a, b) => b.score - a.score);
  cachedItems.series.sort((a, b) => b.score - a.score);

  renderList();
}

loadAndRender();
