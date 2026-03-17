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
