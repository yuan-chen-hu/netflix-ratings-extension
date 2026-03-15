const keyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const status = document.getElementById('status');

// Load saved key
chrome.storage.local.get('omdb_api_key', (data) => {
  if (data.omdb_api_key) keyInput.value = data.omdb_api_key;
});

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
