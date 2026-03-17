// Netflix Rating Overlay - content.js
const CACHE_KEY = 'nro_cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
let apiKey = '';
let ratingCache = {};
let pendingTitles = new Set();
let observer = null;

async function init() {
  const data = await chrome.storage.local.get(['omdb_api_key', CACHE_KEY]);
  apiKey = data.omdb_api_key || '';
  ratingCache = data[CACHE_KEY] || {};
  startObserver();
  scanTitles();
}

function startObserver() {
  if (observer) observer.disconnect();
  observer = new MutationObserver(debounce(() => scanTitles(), 200));
  observer.observe(document.body, { childList: true, subtree: true });
}

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function scanTitles() {
  if (!apiKey) return;
  const selectors = [
    '.title-card-container',
    '.slider-item',
    '.search-title-card',
    '[data-uia="title-card"]',
    '.titleCard--metaData',
  ];
  document.querySelectorAll(selectors.join(',')).forEach(card => processCard(card, false));

  // Hover / detail modal
  document.querySelectorAll('.previewModal--container').forEach(card => processCard(card, true));

  // 首頁頂部 billboard hero
  document.querySelectorAll('.title-logo').forEach(logo => {
    if (!logo.alt) return;
    const container = logo.closest('.titleWrapper') || logo.parentElement;
    if (container.querySelector('.nro-badge')) return;
    const rawTitle = logo.alt.trim();
    const cached = ratingCache[rawTitle];
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      if (cached.data) injectBillboardBadge(container, cached.data, rawTitle);
      return;
    }
    if (pendingTitles.has(rawTitle)) return;
    pendingTitles.add(rawTitle);
    fetchRatings(rawTitle).then(ratings => {
      pendingTitles.delete(rawTitle);
      if (!ratings) return;
      if (!document.contains(container)) return;
      if (logo.alt.trim() !== rawTitle) return;
      injectBillboardBadge(container, ratings, rawTitle);
    });
  });
}

function processCard(card, isHover = false) {
  let rawTitle = '';
  let titleEl = null;

  if (isHover) {
    // Hover / detail modal: 標題在 boxart alt，hero modal 則在 .title-logo alt
    const boxart = card.querySelector('.previewModal--boxart');
    const titleLogo = document.querySelector('.title-logo');
    const source = boxart?.alt ? boxart : (titleLogo?.alt ? titleLogo : null);
    if (!source) return;
    rawTitle = source.alt.trim();
    titleEl = source;
  } else {
    titleEl =
      card.querySelector('.fallback-text') ||
      card.querySelector('[data-uia="title-card-title"]') ||
      card.querySelector('.video-title span') ||
      card.querySelector('span[class*="title"]') ||
      card.querySelector('p[class*="title"]');
    if (!titleEl) return;
    rawTitle = titleEl.textContent.trim();
  }
  if (!rawTitle) return;
  // 如果 badge 已存在且片名相同，跳過
  const existing = card.querySelector('.nro-badge');
  if (existing && existing.dataset.nroTitle === rawTitle) return;
  // 片名不同（DOM 被回收）或尚無 badge，移除舊的再重注入
  if (existing) existing.remove();
  // 有快取直接注入，不需等待也不受 pendingTitles 限制
  const cached = ratingCache[rawTitle];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    if (cached.data) injectBadge(card, titleEl, cached.data, rawTitle, isHover);
    return;
  }
  if (pendingTitles.has(rawTitle)) return;
  pendingTitles.add(rawTitle);
  fetchRatings(rawTitle).then(ratings => {
    pendingTitles.delete(rawTitle);
    if (!ratings) return;
    // 驗證 card 還在 DOM 且片名沒有被回收替換
    if (!document.contains(card)) return;
    const currentTitle = isHover
      ? (card.querySelector('.previewModal--boxart')?.alt || document.querySelector('.title-logo')?.alt || '')
      : (titleEl?.textContent?.trim() || '');
    if (currentTitle !== rawTitle) return;
    injectBadge(card, titleEl, ratings, rawTitle, isHover);
  });
}

async function fetchRatings(title) {
  const cached = ratingCache[title];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  try {
    const data = await chrome.runtime.sendMessage({ type: 'fetchRatings', title, apiKey });
    if (data) ratingCache[title] = { ts: Date.now(), data };
    return data || null;
  } catch (e) {
    return null;
  }
}

function findTitleCard(el) {
  let node = el.parentElement;
  while (node && node !== document.body) {
    if (node.classList.contains('title-card')) return node;
    node = node.parentElement;
  }
  return null;
}

function injectBadge(card, titleEl, ratings, rawTitle, isHover = false) {
  let container;
  if (isHover) {
    container =
      card.querySelector('.previewModal--detailsMetadata-left') ||
      card.querySelector('.previewModal--metadataAndControls') ||
      card.querySelector('.previewModal--info') ||
      card;
  } else {
    container = findTitleCard(titleEl) || card;
  }
  if (container.querySelector('.nro-badge')) return;
  const badge = document.createElement('div');
  badge.className = isHover ? 'nro-badge nro-badge--hover' : 'nro-badge';
  badge.dataset.nroTitle = rawTitle;
  const parts = [];
  if (ratings.imdb) {
    const score = parseFloat(ratings.imdb);
    const cls = score >= 7.5 ? 'nro-great' : score >= 6 ? 'nro-ok' : 'nro-bad';
    parts.push(`<span class="nro-pill nro-imdb ${cls}"><svg viewBox="0 0 48 20" class="nro-imdb-logo"><rect width="48" height="20" rx="3" fill="#F5C518"/><text x="50%" y="14" text-anchor="middle" font-size="10" font-weight="900" font-family="Arial Black,Arial" fill="#000">IMDb</text></svg><span class="nro-score">${ratings.imdb}</span></span>`);
  }
  if (ratings.rt) {
    const pct = parseInt(ratings.rt);
    const cls = pct >= 75 ? 'nro-great' : pct >= 60 ? 'nro-ok' : 'nro-bad';
    const emoji = pct >= 60 ? '🍅' : '🤢';
    parts.push(`<span class="nro-pill nro-rt ${cls}"><span class="nro-rt-icon">${emoji}</span><span class="nro-score">${ratings.rt}</span></span>`);
  }
  if (ratings.mc) {
    const score = parseInt(ratings.mc);
    const cls = score >= 75 ? 'nro-great' : score >= 50 ? 'nro-ok' : 'nro-bad';
    parts.push(`<span class="nro-pill nro-mc ${cls}"><span class="nro-mc-logo">M</span><span class="nro-score">${ratings.mc}</span></span>`);
  }
  if (parts.length === 0) return;
  if (isHover && ratings.awards) {
    parts.push(`<span class="nro-awards">🏆 ${ratings.awards}</span>`);
  }
  badge.innerHTML = parts.join('');
  container.appendChild(badge);
}

function injectBillboardBadge(container, ratings, rawTitle) {
  if (container.querySelector('.nro-badge')) return;
  const badge = document.createElement('div');
  badge.className = 'nro-badge nro-badge--billboard';
  badge.dataset.nroTitle = rawTitle;
  const parts = [];
  if (ratings.imdb) {
    const score = parseFloat(ratings.imdb);
    const cls = score >= 7.5 ? 'nro-great' : score >= 6 ? 'nro-ok' : 'nro-bad';
    parts.push(`<span class="nro-pill nro-imdb ${cls}"><svg viewBox="0 0 48 20" class="nro-imdb-logo"><rect width="48" height="20" rx="3" fill="#F5C518"/><text x="50%" y="14" text-anchor="middle" font-size="10" font-weight="900" font-family="Arial Black,Arial" fill="#000">IMDb</text></svg><span class="nro-score">${ratings.imdb}</span></span>`);
  }
  if (ratings.rt) {
    const pct = parseInt(ratings.rt);
    const cls = pct >= 75 ? 'nro-great' : pct >= 60 ? 'nro-ok' : 'nro-bad';
    const emoji = pct >= 60 ? '🍅' : '🤢';
    parts.push(`<span class="nro-pill nro-rt ${cls}"><span class="nro-rt-icon">${emoji}</span><span class="nro-score">${ratings.rt}</span></span>`);
  }
  if (ratings.mc) {
    const score = parseInt(ratings.mc);
    const cls = score >= 75 ? 'nro-great' : score >= 50 ? 'nro-ok' : 'nro-bad';
    parts.push(`<span class="nro-pill nro-mc ${cls}"><span class="nro-mc-logo">M</span><span class="nro-score">${ratings.mc}</span></span>`);
  }
  if (ratings.awards) {
    parts.push(`<span class="nro-awards">🏆 ${ratings.awards}</span>`);
  }
  if (parts.length === 0) return;
  badge.innerHTML = parts.join('');
  container.appendChild(badge);
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.omdb_api_key) {
    apiKey = changes.omdb_api_key.newValue || '';
    document.querySelectorAll('.nro-badge').forEach(el => el.remove());
    scanTitles();
  }
});

init();
