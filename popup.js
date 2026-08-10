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
    list_filter_label: '清單與分數過濾（套用於 Netflix / Disney+ 頁面）',
    only_in_list: '只顯示清單內的影片',
    hide_in_list: '隱藏清單內的影片',
    list_url_ph: 'imdb.com/list/ls… 或 letterboxd.com/…',
    load_list: '載入',
    filter_mode: '被過濾的影片',
    mode_dim: '淡化',
    mode_hide: '隱藏',
    list_loading: '讀取清單中…',
    list_loaded: (n, d) => `✓ ${n} 部・更新於 ${d}`,
    list_cleared: '已清除清單',
    list_err_url: '網址無效 — 請貼上 IMDb 清單（…/list/ls…）或 Letterboxd 清單／watchlist／films 網址',
    list_err_empty: '讀不到內容 — 請確認清單設為「公開」',
    list_err_net: '無法連線 IMDb',
    list_need_url: '請先貼上清單網址並按「載入」',
    layout_info: (n, m) => `版面偵測：${n} 張卡片（${m}）`,
    layout_known: '內建選擇器',
    layout_mixed: '內建＋自動偵測',
    layout_adaptive: '自動偵測',
    layout_none: '⚠ 找不到卡片 — 請重新整理串流頁面',
    tmdb_label: 'TMDB API Key（選填）',
    tmdb_ph: '中文／日文／韓文片名比對用',
    tmdb_help: '片名是中文等在地語系？加一組免費 TMDB Key：',
    tmdb_saved: (n) => `✓ 已儲存 — 在地語系片名將透過 TMDB 對應 IMDb ID`,
    tmdb_invalid: '✕ TMDB Key 無效',
    tmdb_cleared: '已清除 TMDB Key',
    tmdb_checking: '驗證中…',
    source_label: '主要資料來源',
    source_omdb_help: 'OMDb 提供 IMDb／RT／Metacritic 全部分數，但免費版每天只有 1,000 次。',
    source_tmdb_help: 'TMDB 沒有日額度：卡片分數改由 TMDB 提供，只有展開卡片時才用 OMDb 補 RT／Metacritic。',
    source_tmdb_needs_key: '⚠ 需要先填上方的 TMDB API Key，否則會自動退回 OMDb。',
    quota_label: (n, max) => `OMDb 今日已用 ${n} / ${max}`,
    quota_reset: 'UTC 00:00 重置',
    min_score_label: '分數門檻',
    min_score_off: '關閉',
    min_score_help: (src, v) => `只顯示 ${src} ≥ ${v} 的影片；查不到分數的不會被隱藏。`,
    min_score_tmdb_note: 'TMDB 模式下，卡片沒有 RT／Metacritic 分數，門檻請用 IMDb。',
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
    list_filter_label: 'List & score filter (applies on Netflix / Disney+)',
    only_in_list: 'Only show titles in this list',
    hide_in_list: 'Hide titles in this list',
    list_url_ph: 'imdb.com/list/ls… or letterboxd.com/…',
    load_list: 'Load',
    filter_mode: 'Filtered titles',
    mode_dim: 'Dim',
    mode_hide: 'Hide',
    list_loading: 'Loading list…',
    list_loaded: (n, d) => `✓ ${n} titles・updated ${d}`,
    list_cleared: 'List cleared',
    list_err_url: 'Invalid URL — paste an IMDb list (…/list/ls…) or a Letterboxd list / watchlist / films URL',
    list_err_empty: 'Nothing found — make sure the list is public',
    list_err_net: 'Cannot reach IMDb',
    list_need_url: 'Paste a list URL and press Load first',
    layout_info: (n, m) => `Layout: ${n} cards detected (${m})`,
    layout_known: 'built-in selectors',
    layout_mixed: 'built-in + auto-detect',
    layout_adaptive: 'auto-detect',
    layout_none: '⚠ No cards found — reload the streaming page',
    tmdb_label: 'TMDB API Key (optional)',
    tmdb_ph: 'For localized titles (中文/日本語/한국어)',
    tmdb_help: 'Localized titles? Add a free TMDB key:',
    tmdb_saved: () => '✓ Saved — localized titles now resolve via TMDB',
    tmdb_invalid: '✕ Invalid TMDB key',
    tmdb_cleared: 'TMDB key cleared',
    tmdb_checking: 'Validating…',
    source_label: 'Primary data source',
    source_omdb_help: 'OMDb gives IMDb / RT / Metacritic in one call, but the free tier stops at 1,000 a day.',
    source_tmdb_help: 'TMDB has no daily cap: tiles get TMDB scores, and OMDb is only called for RT / Metacritic when a card is expanded.',
    source_tmdb_needs_key: '⚠ Add a TMDB API key above, otherwise this falls back to OMDb.',
    quota_label: (n, max) => `OMDb used today: ${n} / ${max}`,
    quota_reset: 'resets UTC 00:00',
    min_score_label: 'Minimum score',
    min_score_off: 'off',
    min_score_help: (src, v) => `Only show titles rated ${src} ≥ ${v}. Titles with no score are never hidden.`,
    min_score_tmdb_note: 'In TMDB mode tiles carry no RT / Metacritic score — use the IMDb threshold.',
  },
};

const t = isChinese ? i18n.zh : i18n.en;

// Escape user/API-derived strings before interpolating into innerHTML,
// so titles containing " < > & ' don't break attributes or markup.
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

// --- TMDB key (optional): bridges localized titles to an IMDb ID ---
const tmdbInput = document.getElementById('tmdbKey');
const tmdbSaveBtn = document.getElementById('tmdbSaveBtn');

function setTmdbStatusUI(text, cls) {
  const el = document.getElementById('tmdbStatus');
  el.textContent = text;
  el.className = `list-status ${cls || ''}`;
}

chrome.storage.local.get('tmdb_api_key', (d) => {
  if (d.tmdb_api_key) {
    tmdbInput.value = d.tmdb_api_key;
    setTmdbStatusUI(t.tmdb_saved(), 'ok');
  }
  renderPrefsUI(); // the source help depends on whether a TMDB key exists
});

tmdbSaveBtn.addEventListener('click', async () => {
  const key = tmdbInput.value.trim();
  if (!key) {
    await chrome.storage.local.remove('tmdb_api_key');
    setTmdbStatusUI(t.tmdb_cleared, '');
    return;
  }
  setTmdbStatusUI(t.tmdb_checking, '');
  try {
    const res = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(key)}`);
    if (res.status === 401) {
      setTmdbStatusUI(t.tmdb_invalid, 'err');
      return;
    }
  } catch (e) {
    /* offline — save anyway, background will retry */
  }
  await chrome.storage.local.set({ tmdb_api_key: key });
  setTmdbStatusUI(t.tmdb_saved(), 'ok');
  renderPrefsUI();
});

tmdbInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tmdbSaveBtn.click();
});

// --- OMDb quota meter ---
// background.js counts every outgoing OMDb call per UTC day. Without this the
// only signal that the free tier ran out is ratings silently going missing.
const OMDB_DAILY_LIMIT = 1000;

async function renderQuota() {
  const box = document.getElementById('quotaBox');
  const d = await chrome.storage.local.get('nro_quota');
  const q = d.nro_quota;
  const today = new Date().toISOString().slice(0, 10);
  if (!q || q.day !== today || !q.count) { box.style.display = 'none'; return; }
  box.style.display = '';
  document.getElementById('quotaText').textContent = t.quota_label(q.count, OMDB_DAILY_LIMIT);
  document.getElementById('quotaReset').textContent = t.quota_reset;
  const pct = Math.min(100, (q.count / OMDB_DAILY_LIMIT) * 100);
  const fill = document.getElementById('quotaFill');
  fill.style.width = pct + '%';
  fill.className = 'quota-fill' + (pct >= 90 ? ' hot' : pct >= 70 ? ' warn' : '');
}

renderQuota();

// --- Preferences: primary data source + score threshold ---
const PREFS_KEY = 'nro_prefs';
const PREFS_DEFAULT = { source: 'omdb', minScore: 0, minSource: 'imdb' };
let prefs = { ...PREFS_DEFAULT };

const sourceModeEl = document.getElementById('sourceMode');
const minSourceEl = document.getElementById('minSource');
const minScoreEl = document.getElementById('minScore');
const minScoreValEl = document.getElementById('minScoreVal');

// IMDb and TMDB are 0–10; RT and Metacritic are percentages.
function scaleFor(source) {
  return source === 'imdb' ? { max: 9.5, step: 0.5 } : { max: 95, step: 5 };
}

function formatThreshold(source, value) {
  if (source === 'imdb') return value.toFixed(1);
  if (source === 'rt') return `${value}%`;
  return `${value}/100`;
}

function sourceName(source) {
  return source === 'imdb' ? 'IMDb' : source === 'rt' ? 'Rotten Tomatoes' : 'Metacritic';
}

function renderPrefsUI() {
  sourceModeEl.value = prefs.source;
  const hasTmdbKey = !!tmdbInput.value.trim();
  const help = document.getElementById('sourceHelp');
  if (prefs.source === 'tmdb') {
    help.textContent = hasTmdbKey ? t.source_tmdb_help : t.source_tmdb_needs_key;
    help.className = hasTmdbKey ? 'list-status' : 'list-status err';
  } else {
    help.textContent = t.source_omdb_help;
    help.className = 'list-status';
  }

  const { max, step } = scaleFor(prefs.minSource);
  minSourceEl.value = prefs.minSource;
  minScoreEl.max = String(max);
  minScoreEl.step = String(step);
  minScoreEl.value = String(Math.min(prefs.minScore, max));

  const off = !(prefs.minScore > 0);
  minScoreValEl.textContent = off ? t.min_score_off : formatThreshold(prefs.minSource, prefs.minScore);
  minScoreValEl.className = off ? 'range-val off' : 'range-val';

  const hint = document.getElementById('minScoreHelp');
  if (prefs.source === 'tmdb' && prefs.minSource !== 'imdb') {
    hint.textContent = t.min_score_tmdb_note;
    hint.className = 'list-status err';
  } else if (off) {
    hint.textContent = '';
    hint.className = 'list-status';
  } else {
    hint.textContent = t.min_score_help(sourceName(prefs.minSource), formatThreshold(prefs.minSource, prefs.minScore));
    hint.className = 'list-status';
  }
}

async function savePrefs() {
  await chrome.storage.local.set({ [PREFS_KEY]: prefs });
}

sourceModeEl.addEventListener('change', async () => {
  prefs.source = sourceModeEl.value;
  await savePrefs();
  renderPrefsUI();
});

minSourceEl.addEventListener('change', async () => {
  prefs.minSource = minSourceEl.value;
  // The scales don't line up (7.5 on IMDb vs 75%), so switching source resets
  // the threshold rather than silently reinterpreting the number.
  prefs.minScore = 0;
  await savePrefs();
  renderPrefsUI();
  renderList();
});

minScoreEl.addEventListener('input', () => {
  prefs.minScore = parseFloat(minScoreEl.value) || 0;
  renderPrefsUI();
});

minScoreEl.addEventListener('change', async () => {
  prefs.minScore = parseFloat(minScoreEl.value) || 0;
  await savePrefs();
  renderPrefsUI();
  renderList();
});

async function initPrefs() {
  const d = await chrome.storage.local.get(PREFS_KEY);
  prefs = Object.assign({}, PREFS_DEFAULT, d[PREFS_KEY] || {});
  renderPrefsUI();
  renderList();
}

initPrefs();

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
  // In TMDB-primary mode most cached entries only carry a TMDB score. It's the
  // same 0–10 scale, so it ranks alongside IMDb — labelled per item.
  if (source === 'imdb') return ratings.imdb ? parseFloat(ratings.imdb) : (ratings.tmdb ? parseFloat(ratings.tmdb) : null);
  if (source === 'rt') return ratings.rt ? parseInt(ratings.rt) : null;
  if (source === 'mc') return ratings.mc ? parseInt(ratings.mc) : null;
  if (source === 'awards') {
    const a = parseAwards(ratings.awards);
    return a ? a.total : null;
  }
  return null;
}

function formatScore(source, ratings) {
  if (source === 'imdb') return ratings.imdb || ratings.tmdb;
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

// The IMDb column can hold a TMDB score (TMDB-primary mode); say so per row
// rather than passing a TMDB number off as an IMDb one.
function itemSourceLabel(source, ratings) {
  if (source === 'imdb' && !ratings.imdb && ratings.tmdb) return 'TMDB';
  return sourceLabel(source);
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
  const filtered = items.filter(it =>
    !skippedTitles.has(it.rawTitle) &&
    !excludedTitles.has(it.rawTitle) &&
    !excludedTitles.has(it.title) &&
    passesListFilter(it));

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="rank-empty">${t.no_data}</div>`;
    countEl.textContent = '';
    return;
  }

  listEl.innerHTML = filtered.map((item, i) => {
    const cls = scoreClass(currentSource, item.score);
    const display = formatScore(currentSource, item.ratings);
    const isTop3 = i < 3 ? ' top3' : '';
    const yearStr = item.year ? `(${escapeHtml(item.year)})` : '';
    const safeTitle = escapeHtml(item.title);
    const safeRaw = escapeHtml(item.rawTitle);
    return `
      <div class="rank-item${isTop3}">
        <span class="rank-num">${i + 1}</span>
        <div class="rank-info">
          <div class="rank-name" title="${safeTitle}" data-search="${encodeURIComponent(item.title)}">${safeTitle}</div>
          <div class="rank-meta">${yearStr} <span class="rank-score ${cls}">${itemSourceLabel(currentSource, item.ratings)} ${escapeHtml(display)}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0">
          <button class="rank-skip" data-title="${safeRaw}">${t.skip}</button>
          <button class="rank-exclude" data-title="${safeRaw}" data-display="${safeTitle}" title="${t.exclude_label}">✕</button>
        </div>
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

  listEl.querySelectorAll('.rank-exclude').forEach(btn => {
    btn.addEventListener('click', () => {
      addExcludes([btn.dataset.title, btn.dataset.display]);
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
  listEl.innerHTML = titles.map(title => {
    const safe = escapeHtml(title);
    return `<div class="exclude-list-item">
      <span class="exclude-list-name" title="${safe}">${safe}</span>
      <button class="exclude-restore" data-title="${safe}">✕</button>
    </div>`;
  }).join('');
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

// --- IMDb list filter ---
// Two independent lists: `include` (only these titles stay visible) and
// `exclude` (these titles get filtered out). Each has its own on/off switch,
// and content.js re-applies both live via chrome.storage.onChanged.

const LIST_SLOTS = ['include', 'exclude'];
let storedLists = {};
let listSettings = { includeOn: false, excludeOn: false, mode: 'dim' };
let listMatchers = { include: null, exclude: null };

// Keep in sync with the copy in content.js
function titleKeys(s) {
  const base = String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  if (!base) return [];
  const keys = [base];
  const stripped = base.replace(/^(the|a|an)\s+/, '');
  if (stripped !== base) keys.push(stripped);
  return keys;
}

function buildMatcher(raw) {
  if (!raw) return null;
  const ids = new Set(raw.ids || []);
  const titles = new Set();
  (raw.titles || []).forEach(x => titleKeys(x).forEach(k => titles.add(k)));
  if (!ids.size && !titles.size) return null;
  return { ids, titles };
}

function matchList(list, rawTitle, ratings) {
  if (!list) return false;
  if (ratings && ratings.imdbID && list.ids.has(ratings.imdbID)) return true;
  for (const k of titleKeys(rawTitle)) if (list.titles.has(k)) return true;
  if (ratings && ratings.title) {
    for (const k of titleKeys(ratings.title)) if (list.titles.has(k)) return true;
  }
  return false;
}

// Same rules the page overlay uses, applied to the popup ranking
function passesListFilter(item) {
  const r = item.ratings || {};
  if (listSettings.excludeOn && listMatchers.exclude && matchList(listMatchers.exclude, item.rawTitle, r)) return false;
  if (listSettings.includeOn && listMatchers.include && !matchList(listMatchers.include, item.rawTitle, r)) return false;
  if (prefs.minScore > 0) {
    const s = thresholdScore(r);
    if (s != null && s < prefs.minScore) return false;
  }
  return true;
}

// Keep in sync with the copy in content.js — TMDB shares IMDb's 0–10 scale, so
// it stands in when only TMDB data is available.
function thresholdScore(ratings) {
  if (!ratings) return null;
  if (prefs.minSource === 'rt') return ratings.rt ? parseInt(ratings.rt, 10) : null;
  if (prefs.minSource === 'mc') return ratings.mc ? parseInt(ratings.mc, 10) : null;
  const v = ratings.imdb || ratings.tmdb;
  return v ? parseFloat(v) : null;
}

function setListStatus(slot, text, cls) {
  const el = document.getElementById(slot + 'Status');
  if (!el) return;
  el.textContent = text;
  el.className = `list-status ${cls || ''}`;
}

function renderListStatus(slot) {
  const list = storedLists[slot];
  if (!list) { setListStatus(slot, '', ''); return; }
  const when = list.ts ? new Date(list.ts).toLocaleDateString() : '';
  setListStatus(slot, t.list_loaded(list.count || (list.ids || []).length, when), 'ok');
}

async function saveListSettings() {
  await chrome.storage.local.set({ nro_list_settings: listSettings });
}

async function loadList(slot) {
  const urlEl = document.getElementById(slot + 'Url');
  const input = urlEl.value.trim();

  if (!input) { // empty field = clear this slot
    delete storedLists[slot];
    listMatchers[slot] = null;
    listSettings[slot + 'On'] = false;
    document.getElementById(slot + 'Toggle').checked = false;
    await chrome.storage.local.set({ nro_lists: storedLists });
    await saveListSettings();
    setListStatus(slot, t.list_cleared, '');
    renderList();
    return;
  }

  setListStatus(slot, t.list_loading, '');
  let res;
  try {
    // background.js does the fetching (and the storage write, so the result
    // survives the popup being closed mid-load)
    res = await chrome.runtime.sendMessage({ type: 'fetchImdbList', url: input, slot });
  } catch (e) {
    res = { error: 'network' };
  }
  if (!res || res.error) {
    // The background may have stored the list even if the reply was lost
    const saved = (await chrome.storage.local.get('nro_lists')).nro_lists || {};
    if (saved[slot]) {
      storedLists = saved;
      listMatchers[slot] = buildMatcher(saved[slot]);
      renderListStatus(slot);
      renderList();
      return;
    }
    const err = res && res.error;
    setListStatus(slot, err === 'bad_url' ? t.list_err_url : err === 'empty' ? t.list_err_empty : t.list_err_net, 'err');
    return;
  }

  storedLists = (await chrome.storage.local.get('nro_lists')).nro_lists || {};
  listMatchers[slot] = buildMatcher(storedLists[slot]);
  urlEl.value = res.url;
  // A freshly loaded list is switched on — the switch stays available to
  // turn it back off at any time.
  listSettings[slot + 'On'] = true;
  document.getElementById(slot + 'Toggle').checked = true;
  await saveListSettings();
  renderListStatus(slot);
  renderList();
}

function renderLayoutInfo(layout) {
  const el = document.getElementById('layoutInfo');
  if (!el || !layout) return;
  if (Date.now() - (layout.ts || 0) > 10 * 60 * 1000) return; // stale
  if (!layout.count) {
    el.textContent = t.layout_none;
    el.className = 'layout-info warn';
    return;
  }
  const modeLabel = t['layout_' + layout.mode] || layout.mode;
  el.textContent = t.layout_info(layout.count, modeLabel);
  el.className = 'layout-info';
}

async function initListFilter() {
  const d = await chrome.storage.local.get(['nro_lists', 'nro_list_settings', 'nro_layout']);
  storedLists = d.nro_lists || {};
  listSettings = Object.assign(listSettings, d.nro_list_settings || {});

  LIST_SLOTS.forEach(slot => {
    const list = storedLists[slot];
    if (list && list.url) document.getElementById(slot + 'Url').value = list.url;
    listMatchers[slot] = buildMatcher(list);
    renderListStatus(slot);

    document.getElementById(slot + 'Load').addEventListener('click', () => loadList(slot));
    document.getElementById(slot + 'Url').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadList(slot);
    });
    document.getElementById(slot + 'Toggle').addEventListener('change', async (e) => {
      if (e.target.checked && !storedLists[slot]) {
        e.target.checked = false;
        setListStatus(slot, t.list_need_url, 'err');
        return;
      }
      listSettings[slot + 'On'] = e.target.checked;
      await saveListSettings();
      renderList();
    });
  });

  document.getElementById('includeToggle').checked = !!listSettings.includeOn;
  document.getElementById('excludeToggle').checked = !!listSettings.excludeOn;

  const modeEl = document.getElementById('filterMode');
  modeEl.value = listSettings.mode || 'dim';
  modeEl.addEventListener('change', async () => {
    listSettings.mode = modeEl.value;
    await saveListSettings();
  });

  renderLayoutInfo(d.nro_layout);
  renderList();
}

// A tab-based list load can outlive the message reply — reflect it as soon as
// background.js writes the result.
chrome.storage.onChanged.addListener((changes) => {
  if (changes.nro_quota) renderQuota();
  if (!changes.nro_lists) return;
  storedLists = changes.nro_lists.newValue || {};
  LIST_SLOTS.forEach(slot => {
    listMatchers[slot] = buildMatcher(storedLists[slot]);
    renderListStatus(slot);
    if (storedLists[slot] && storedLists[slot].url) {
      const el = document.getElementById(slot + 'Url');
      if (!el.value.trim()) el.value = storedLists[slot].url;
    }
  });
  renderList();
});

initListFilter();
