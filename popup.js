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
    awards: '獎項',
    skip: '跳過',
    count: (n) => `共 ${n} 筆`,
    exclude_label: '從排行榜排除',
    import_csv: '匯入 CSV',
    sync_netflix: 'Netflix 觀看紀錄',
    excluded_count: (n) => `已排除 ${n} 部`,
    restore_all: '全部還原',
    clear_excludes: '清除',
    import_ok: (n) => `✓ 匯入 ${n} 部`,
    sync_reading: '讀取中...',
    sync_ok: (n) => `✓ 同步 ${n} 部`,
    sync_open: '已開啟頁面',
    sync_not_ready: '請至觀看紀錄頁',
    show_excluded: (n) => `▾ 查看 ${n} 部`,
    hide_excluded: '▴ 隱藏',
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
    awards: 'Awards',
    skip: 'Skip',
    count: (n) => `${n} total`,
    exclude_label: 'Exclude from ranking',
    import_csv: 'Import CSV',
    sync_netflix: 'Netflix History',
    excluded_count: (n) => `${n} excluded`,
    restore_all: 'Restore all',
    clear_excludes: 'Clear',
    import_ok: (n) => `✓ ${n} imported`,
    sync_reading: 'Reading...',
    sync_ok: (n) => `✓ ${n} synced`,
    sync_open: 'Page opened',
    sync_not_ready: 'Visit viewingactivity',
    show_excluded: (n) => `▾ Show ${n}`,
    hide_excluded: '▴ Hide',
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
let excludedTitles = new Set();
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

// Parse awards string like "Won 2 Oscars. 3 wins & 5 nominations total." → { wins: 3, noms: 5 }
function parseAwards(str) {
  if (!str) return null;
  let wins = 0, noms = 0;
  const wMatch = str.match(/(\d+)\s*win/i);
  if (wMatch) wins = parseInt(wMatch[1]);
  const nMatch = str.match(/(\d+)\s*nomination/i);
  if (nMatch) noms = parseInt(nMatch[1]);
  return (wins + noms > 0) ? { wins, noms, total: wins + noms } : null;
}

function parseScore(source, ratings) {
  if (source === 'imdb') return ratings.imdb ? parseFloat(ratings.imdb) : null;
  if (source === 'rt') return ratings.rt ? parseInt(ratings.rt) : null;
  if (source === 'mc') return ratings.mc ? parseInt(ratings.mc) : null;
  if (source === 'awards') {
    const a = parseAwards(ratings.awards);
    return a ? a.total : null;
  }
  return null;
}

function formatScore(source, ratings) {
  if (source === 'imdb') return ratings.imdb;
  if (source === 'rt') return ratings.rt;
  if (source === 'mc') return ratings.mc;
  if (source === 'awards') {
    const a = parseAwards(ratings.awards);
    if (!a) return null;
    return isChinese
      ? `${a.wins} 獲獎 / ${a.noms} 提名`
      : `${a.wins} wins / ${a.noms} noms`;
  }
  return null;
}

function scoreClass(source, val) {
  if (source === 'imdb') return val >= 7.5 ? 'great' : val >= 6 ? 'ok' : 'bad';
  if (source === 'rt') return val >= 75 ? 'great' : val >= 60 ? 'ok' : 'bad';
  if (source === 'mc') return val >= 75 ? 'great' : val >= 50 ? 'ok' : 'bad';
  if (source === 'awards') return val >= 20 ? 'great' : val >= 5 ? 'ok' : 'bad';
  return '';
}

function sourceLabel(source) {
  if (source === 'imdb') return 'IMDb';
  if (source === 'rt') return '🍅 RT';
  if (source === 'mc') return 'Metacritic';
  if (source === 'awards') return '🏆';
  return '';
}

function renderList() {
  const listEl = document.getElementById('rankList');
  const countEl = document.getElementById('rankCount');
  const items = cachedItems[currentType] || [];
  const filtered = items.filter(it => !skippedTitles.has(it.rawTitle) && !excludedTitles.has(it.rawTitle) && !excludedTitles.has(it.title));

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

  const totalMovie = Object.values(cache).filter(e => e.data && e.data.type !== 'series').length;
  const totalSeries = Object.values(cache).filter(e => e.data && e.data.type === 'series').length;
  const statsEl = document.getElementById('cacheStats');
  if (statsEl) statsEl.textContent = isChinese
    ? `已掃描：${totalMovie} 部電影・${totalSeries} 部影集`
    : `Scanned: ${totalMovie} movies・${totalSeries} TV shows`;

  renderList();
}

loadAndRender();

// --- Exclude list ---

function splitCSVLine(line) {
  const fields = [];
  let field = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      fields.push(field); field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

// Parses IMDb CSV (Title column), Letterboxd CSV (Name column), or plain text (one per line)
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 1) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
  const titleIdx = headers.findIndex(h => h === 'Title' || h === 'Name');
  if (titleIdx === -1) {
    // Plain text fallback: one title per line
    return lines.map(l => l.trim()).filter(Boolean);
  }
  return lines.slice(1).map(line => {
    const fields = splitCSVLine(line);
    return (fields[titleIdx] || '').replace(/^"|"$/g, '').trim();
  }).filter(Boolean);
}

async function addExcludes(titles) {
  const data = await chrome.storage.local.get('nro_exclude');
  const exclude = data.nro_exclude || {};
  titles.forEach(t => { if (t) exclude[t] = 1; });
  await chrome.storage.local.set({ nro_exclude: exclude });
  excludedTitles = new Set(Object.keys(exclude));
  updateExcludeUI();
  renderList();
}

let excludeListVisible = false;

function updateExcludeUI() {
  const toggleBtn = document.getElementById('toggleExcludeBtn');
  const restoreAllBtn = document.getElementById('restoreAllBtn');
  const listEl = document.getElementById('excludeList');
  if (!toggleBtn) return;
  if (excludedTitles.size > 0) {
    toggleBtn.style.display = '';
    toggleBtn.textContent = excludeListVisible ? t.hide_excluded : t.show_excluded(excludedTitles.size);
    restoreAllBtn.style.display = '';
    if (excludeListVisible) renderExcludeList();
  } else {
    toggleBtn.style.display = 'none';
    restoreAllBtn.style.display = 'none';
    listEl.style.display = 'none';
    excludeListVisible = false;
  }
}

function renderExcludeList() {
  const listEl = document.getElementById('excludeList');
  if (!listEl) return;
  const titles = [...excludedTitles].sort();
  listEl.innerHTML = titles.map(title =>
    `<div class="exclude-list-item">
      <span class="exclude-list-name" title="${title}">${title}</span>
      <button class="exclude-restore" data-title="${title}">✕</button>
    </div>`
  ).join('');
  listEl.querySelectorAll('.exclude-restore').forEach(btn => {
    btn.addEventListener('click', async () => {
      const data = await chrome.storage.local.get('nro_exclude');
      const exclude = data.nro_exclude || {};
      delete exclude[btn.dataset.title];
      await chrome.storage.local.set({ nro_exclude: exclude });
      excludedTitles = new Set(Object.keys(exclude));
      updateExcludeUI();
      renderList();
    });
  });
}

document.getElementById('toggleExcludeBtn').addEventListener('click', () => {
  excludeListVisible = !excludeListVisible;
  const listEl = document.getElementById('excludeList');
  listEl.style.display = excludeListVisible ? '' : 'none';
  updateExcludeUI();
});

async function initExcludes() {
  const data = await chrome.storage.local.get('nro_exclude');
  excludedTitles = new Set(Object.keys(data.nro_exclude || {}));
  updateExcludeUI();
}

// Import CSV / TXT button
document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const titles = parseCSV(ev.target.result);
    await addExcludes(titles);
    const btn = document.getElementById('importBtn');
    btn.textContent = t.import_ok(titles.length);
    btn.classList.add('exclude-btn-ok');
  };
  reader.readAsText(file);
  e.target.value = '';
});

// Sync from Netflix viewing activity — opens background tab, auto-closes when done
document.getElementById('syncNetflixBtn').addEventListener('click', async () => {
  const btn = document.getElementById('syncNetflixBtn');
  btn.textContent = t.sync_reading;
  btn.disabled = true;

  // Snapshot current exclude count to detect new additions
  const beforeCount = excludedTitles.size;

  // Open viewing activity in background (no tab switch)
  const tab = await chrome.tabs.create({
    url: 'https://www.netflix.com/viewingactivity',
    active: false,
  });

  // Listen for "done" message from content script
  const onDone = (msg) => {
    if (msg.type !== 'viewingHistoryDone') return;
    chrome.runtime.onMessage.removeListener(onDone);
    clearTimeout(fallbackTimer);
    chrome.tabs.remove(tab.id).catch(() => {});
    finish(msg.count - beforeCount);
  };
  chrome.runtime.onMessage.addListener(onDone);

  // Fallback: if no message after 30s, read storage directly and close tab
  const fallbackTimer = setTimeout(async () => {
    chrome.runtime.onMessage.removeListener(onDone);
    chrome.tabs.remove(tab.id).catch(() => {});
    const data = await chrome.storage.local.get('nro_exclude');
    const newCount = Object.keys(data.nro_exclude || {}).length - beforeCount;
    finish(newCount);
  }, 30000);

  async function finish(added) {
    const data = await chrome.storage.local.get('nro_exclude');
    excludedTitles = new Set(Object.keys(data.nro_exclude || {}));
    btn.textContent = added > 0 ? t.sync_ok(added) : t.sync_not_ready;
    if (added > 0) btn.classList.add('exclude-btn-ok');
    btn.disabled = false;
    updateExcludeUI();
    renderList();
  }
});

// Restore all excludes
document.getElementById('restoreAllBtn').addEventListener('click', async () => {
  await chrome.storage.local.remove('nro_exclude');
  excludedTitles = new Set();
  excludeListVisible = false;
  updateExcludeUI();
  renderList();
});


initExcludes();
