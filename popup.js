const keyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const status = document.getElementById('status');
const apiStatus = document.getElementById('apiStatus');
const apiStatusText = document.getElementById('apiStatusText');

// Load saved key, then actively check API status
chrome.storage.local.get('omdb_api_key', async (data) => {
  const key = data.omdb_api_key || '';
  if (key) keyInput.value = key;

  if (!key) {
    setApiStatusUI('unknown', 'Enter your OMDb API Key above');
    return;
  }

  setApiStatusUI('unknown', 'Checking...');
  try {
    const res = await fetch(`https://www.omdbapi.com/?t=inception&apikey=${key}`);
    const json = await res.json();
    if (json.Response === 'False') {
      const err = (json.Error || '').toLowerCase();
      if (err.includes('limit')) {
        setApiStatusUI('limit', '⚠ Daily limit reached — resets at UTC 00:00 (台灣時間 08:00)');
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
    setApiStatusUI('unknown', 'Cannot reach OMDb — check network');
  }
});

function setApiStatusUI(type, text) {
  apiStatus.className = `api-status ${type}`;
  apiStatusText.textContent = text;
}

saveBtn.addEventListener('click', async () => {
  const key = keyInput.value.trim();
  if (!key) {
    showStatus('請輸入 API Key', '#f87171');
    return;
  }

  // Quick validation via OMDb
  try {
    showStatus('驗證中...', '#facc15');
    const res = await fetch(`https://www.omdbapi.com/?t=inception&apikey=${key}`);
    const json = await res.json();
    if (json.Response === 'False' && json.Error && json.Error.toLowerCase().includes('invalid api key')) {
      showStatus('❌ API Key 無效', '#f87171');
      return;
    }
    await chrome.storage.local.set({ omdb_api_key: key });
    showStatus('✅ 儲存成功！重新整理 Netflix 即可看到評分', '#4ade80');
  } catch (e) {
    await chrome.storage.local.set({ omdb_api_key: key });
    showStatus('✅ 已儲存（無法驗證，請確認網路）', '#facc15');
  }
});

function showStatus(msg, color) {
  status.textContent = msg;
  status.style.color = color;
}

keyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});

// --- Top 3 Ratings ---
let currentSource = 'imdb';
let skippedTitles = new Set();

document.querySelectorAll('.source-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentSource = tab.dataset.source;
    skippedTitles.clear();
    renderTop3();
  });
});

function parseScore(source, ratings) {
  if (source === 'imdb') {
    return ratings.imdb ? parseFloat(ratings.imdb) : null;
  } else if (source === 'rt') {
    return ratings.rt ? parseInt(ratings.rt) : null;
  } else if (source === 'mc') {
    return ratings.mc ? parseInt(ratings.mc) : null;
  }
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

async function renderTop3() {
  const listEl = document.getElementById('top3List');
  const stored = await chrome.storage.local.get('nro_cache');
  const cache = stored.nro_cache || {};

  const scored = [];
  for (const [title, entry] of Object.entries(cache)) {
    if (!entry.data) continue;
    if (skippedTitles.has(title)) continue;
    const val = parseScore(currentSource, entry.data);
    if (val == null) continue;
    scored.push({ title: entry.data.title || title, rawTitle: title, score: val, ratings: entry.data });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);

  if (top.length === 0) {
    listEl.innerHTML = '<div class="top3-empty">此來源尚無評分資料</div>';
    return;
  }

  listEl.innerHTML = top.map((item, i) => {
    const cls = scoreClass(currentSource, item.score);
    const display = formatScore(currentSource, item.ratings);
    return `
      <div class="top3-item">
        <span class="top3-rank">${i + 1}</span>
        <div class="top3-info">
          <div class="top3-name" title="${item.title}" data-search="${encodeURIComponent(item.title)}">${item.title}</div>
          <div class="top3-score ${cls}">${sourceLabel(currentSource)} ${display}</div>
        </div>
        <button class="top3-skip" data-title="${item.rawTitle}">跳過</button>
      </div>`;
  }).join('');

  listEl.querySelectorAll('.top3-name').forEach(el => {
    el.addEventListener('click', () => {
      const url = `https://www.netflix.com/search?q=${el.dataset.search}`;
      chrome.tabs.create({ url });
    });
  });

  listEl.querySelectorAll('.top3-skip').forEach(btn => {
    btn.addEventListener('click', () => {
      skippedTitles.add(btn.dataset.title);
      renderTop3();
    });
  });
}

renderTop3();
