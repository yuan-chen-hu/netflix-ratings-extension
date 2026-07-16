// Netflix Rating Overlay - content.js
const CACHE_KEY = 'nro_cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
let apiKey = '';
let ratingCache = {};
let pendingTitles = new Set();
let observer = null;

// Platform detection — Netflix and Disney+ have different DOM structures
const IS_DISNEY = location.hostname.includes('disneyplus.com');
// Dispatcher the MutationObserver and storage listener call on each pass
const scan = () => (IS_DISNEY ? scanDisney() : scanTitles());

// Viewport gating: grid cards are only processed once they scroll into view,
// so offscreen cards don't run getTitle()/fetch on every mutation pass.
// The MutationObserver still drives re-processing of visible cards, which is
// what catches Netflix's recycled (reused) card nodes.
const visibleCards = new WeakSet();
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      visibleCards.add(e.target);
      processVisibleCard(e.target);
    } else {
      visibleCards.delete(e.target);
    }
  }
}, { rootMargin: '300px' });

function processVisibleCard(card) {
  if (IS_DISNEY) {
    const title = disneyTitle(card);
    if (title) processDisneyCard(card, title);
  } else {
    processCard(card, false);
  }
}

// Register a card with the IntersectionObserver (idempotent) and process it
// immediately if it's already known to be on-screen.
function observeCard(card) {
  io.observe(card);
  if (visibleCards.has(card)) processVisibleCard(card);
}

async function init() {
  const data = await chrome.storage.local.get(['omdb_api_key', CACHE_KEY]);
  apiKey = data.omdb_api_key || '';
  ratingCache = data[CACHE_KEY] || {};
  if (!IS_DISNEY && location.pathname === '/viewingactivity') {
    scanViewingActivity();
  } else {
    startObserver();
    scan();
  }
}

function startObserver() {
  if (observer) observer.disconnect();
  observer = new MutationObserver(debounce(() => scan(), 200));
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
    '[data-uia="title-card"]',
    '[data-uia="search-gallery-video-card"]',
  ];
  const cards = document.querySelectorAll(selectors.join(','));
  cards.forEach(observeCard);

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
    fetchRatings(rawTitle, extractYear(container)).then(ratings => {
      pendingTitles.delete(rawTitle);
      if (!ratings) return;
      if (!document.contains(container)) return;
      if (logo.alt.trim() !== rawTitle) return;
      injectBillboardBadge(container, ratings, rawTitle);
    });
  });
}

// Best-effort release year for OMDb disambiguation (same-title-different-year).
// Only the hover modal and billboard expose it; grid cards don't, so this
// returns null there and the query stays year-less. Scoped to metadata rows to
// avoid matching stray 4-digit numbers in descriptions.
function extractYear(scope) {
  if (!scope) return null;
  const metaEl =
    scope.querySelector('[class*="year"]') ||
    scope.querySelector('.previewModal--detailsMetadata-info') ||
    scope.querySelector('.videoMetadata--container') ||
    scope.querySelector('.previewModal--metadataAndControls');
  const text = (metaEl || scope).textContent || '';
  const m = text.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : null;
}

function getTitle(card) {
  // Try text-based selectors first
  const textEl =
    card.querySelector('.fallback-text') ||
    card.querySelector('[data-uia="title-card-title"]') ||
    card.querySelector('.video-title span') ||
    card.querySelector('span[class*="title"]') ||
    card.querySelector('p[class*="title"]');
  if (textEl && textEl.textContent.trim()) return { el: textEl, title: textEl.textContent.trim() };
  // Fallback: img alt (boxart image)
  const img = card.querySelector('img[alt]');
  if (img && img.alt.trim()) return { el: img, title: img.alt.trim() };
  // Fallback: aria-label on card or child link
  const ariaEl = card.querySelector('a[aria-label]') || card.querySelector('[aria-label]');
  if (ariaEl && ariaEl.getAttribute('aria-label').trim()) {
    return { el: ariaEl, title: ariaEl.getAttribute('aria-label').trim() };
  }
  if (card.getAttribute('aria-label')?.trim()) {
    return { el: card, title: card.getAttribute('aria-label').trim() };
  }
  return null;
}

function processCard(card, isHover = false) {
  let rawTitle = '';
  let titleEl = null;

  if (isHover) {
    const boxart = card.querySelector('.previewModal--boxart');
    const titleLogo = document.querySelector('.title-logo');
    const source = boxart?.alt ? boxart : (titleLogo?.alt ? titleLogo : null);
    if (!source) return;
    rawTitle = source.alt.trim();
    titleEl = source;
  } else {
    const found = getTitle(card);
    if (!found) return;
    titleEl = found.el;
    rawTitle = found.title;
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
  fetchRatings(rawTitle, isHover ? extractYear(card) : null).then(ratings => {
    pendingTitles.delete(rawTitle);
    if (!ratings) return;
    // 驗證 card 還在 DOM 且片名沒有被回收替換
    if (!document.contains(card)) return;
    const currentTitle = isHover
      ? (card.querySelector('.previewModal--boxart')?.alt || document.querySelector('.title-logo')?.alt || '')
      : (getTitle(card)?.title || '');
    if (currentTitle !== rawTitle) return;
    injectBadge(card, titleEl, ratings, rawTitle, isHover);
  });
}

// --- Disney+ ---
// Tiles are <a href="/browse/entity-…"> anchors wrapping an <img alt="Title">.
// Nav/collection links share the /browse/ path but have no image, so the img
// check filters them out.
function scanDisney() {
  if (!apiKey) return;
  document.querySelectorAll('a[href*="/browse/"]').forEach(card => {
    if (disneyTitle(card)) observeCard(card);
  });
}

function disneyTitle(card) {
  const img = card.querySelector('img[alt]');
  return (img?.alt || card.getAttribute('aria-label') || '').trim();
}

function processDisneyCard(card, rawTitle) {
  const existing = card.querySelector('.nro-badge');
  if (existing && existing.dataset.nroTitle === rawTitle) return;
  if (existing) existing.remove();
  const cached = ratingCache[rawTitle];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    if (cached.data) injectDisneyBadge(card, cached.data, rawTitle);
    return;
  }
  if (pendingTitles.has(rawTitle)) return;
  pendingTitles.add(rawTitle);
  fetchRatings(rawTitle).then(ratings => {
    pendingTitles.delete(rawTitle);
    if (!ratings) return;
    if (!document.contains(card)) return;
    if (disneyTitle(card) !== rawTitle) return; // DOM recycled with new title
    injectDisneyBadge(card, ratings, rawTitle);
  });
}

function injectDisneyBadge(card, ratings, rawTitle) {
  if (card.querySelector('.nro-badge')) return;
  if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
  const parts = buildPills(ratings, false);
  if (parts.length === 0) return;
  const badge = document.createElement('div');
  badge.className = 'nro-badge';
  badge.dataset.nroTitle = rawTitle;
  badge.innerHTML = parts.join('');
  card.appendChild(badge);
}

async function fetchRatings(title, year = null) {
  const cached = ratingCache[title];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  try {
    const data = await chrome.runtime.sendMessage({ type: 'fetchRatings', title, year, apiKey });
    if (data) ratingCache[title] = { ts: Date.now(), data };
    return data || null;
  } catch (e) {
    return null;
  }
}

function findBadgeContainer(el, card) {
  // Walk up from titleEl looking for .title-card
  let node = el.parentElement;
  while (node && node !== document.body && node !== card) {
    if (node.classList.contains('title-card')) return node;
    node = node.parentElement;
  }
  // Fallback: look for common Netflix card wrappers inside the card
  const inner =
    card.querySelector('.title-card') ||
    card.querySelector('.boxart-container') ||
    card.querySelector('[class*="titleCard"]');
  if (inner) return inner;
  return card;
}

function buildPills(ratings, withLinks) {
  const parts = [];
  if (ratings.imdb) {
    const score = parseFloat(ratings.imdb);
    const cls = score >= 7.5 ? 'nro-great' : score >= 6 ? 'nro-ok' : 'nro-bad';
    const pill = `<svg viewBox="0 0 48 20" class="nro-imdb-logo"><rect width="48" height="20" rx="3" fill="#F5C518"/><text x="50%" y="14" text-anchor="middle" font-size="10" font-weight="900" font-family="Arial Black,Arial" fill="#000">IMDb</text></svg><span class="nro-score">${ratings.imdb}</span>`;
    if (withLinks) {
      const imdbUrl = ratings.imdbID
        ? `https://www.imdb.com/title/${ratings.imdbID}/`
        : `https://www.imdb.com/find/?q=${encodeURIComponent(ratings.title || '')}`;
      parts.push(`<a href="${imdbUrl}" target="_blank" class="nro-pill nro-imdb nro-link ${cls}" title="Open IMDb">${pill}</a>`);
    } else {
      parts.push(`<span class="nro-pill nro-imdb ${cls}">${pill}</span>`);
    }
  }
  if (ratings.rt) {
    const pct = parseInt(ratings.rt);
    const cls = pct >= 75 ? 'nro-great' : pct >= 60 ? 'nro-ok' : 'nro-bad';
    const emoji = pct >= 60 ? '🍅' : '🤢';
    const pill = `<span class="nro-rt-icon">${emoji}</span><span class="nro-score">${ratings.rt}</span>`;
    if (withLinks) {
      const rtQuery = encodeURIComponent(ratings.title || '');
      parts.push(`<a href="https://www.rottentomatoes.com/search?search=${rtQuery}" target="_blank" class="nro-pill nro-rt nro-link ${cls}" title="Open Rotten Tomatoes">${pill}</a>`);
    } else {
      parts.push(`<span class="nro-pill nro-rt ${cls}">${pill}</span>`);
    }
  }
  if (ratings.mc) {
    const score = parseInt(ratings.mc);
    const cls = score >= 75 ? 'nro-great' : score >= 50 ? 'nro-ok' : 'nro-bad';
    const pill = `<span class="nro-mc-logo">M</span><span class="nro-score">${ratings.mc}</span>`;
    if (withLinks) {
      const mcQuery = encodeURIComponent(ratings.title || '');
      parts.push(`<a href="https://www.metacritic.com/search/${mcQuery}/" target="_blank" class="nro-pill nro-mc nro-link ${cls}" title="Open Metacritic">${pill}</a>`);
    } else {
      parts.push(`<span class="nro-pill nro-mc ${cls}">${pill}</span>`);
    }
  }
  return parts;
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
    container = findBadgeContainer(titleEl, card);
    // Ensure the container can anchor absolute positioning
    const pos = getComputedStyle(container).position;
    if (pos === 'static') container.style.position = 'relative';
  }
  if (container.querySelector('.nro-badge')) return;
  const badge = document.createElement('div');
  badge.className = isHover ? 'nro-badge nro-badge--hover' : 'nro-badge';
  badge.dataset.nroTitle = rawTitle;
  // Only hover/detail gets clickable links
  const parts = buildPills(ratings, isHover);
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
  const parts = buildPills(ratings, true);
  if (ratings.awards) {
    parts.push(`<span class="nro-awards">🏆 ${ratings.awards}</span>`);
  }
  if (parts.length === 0) return;
  badge.innerHTML = parts.join('');
  container.appendChild(badge);
}

// Viewing activity page: auto-extract watched titles into exclude list
function extractViewingTitles() {
  const titles = new Set();
  // Try multiple selectors for Netflix viewing activity page
  document.querySelectorAll('.retableRow .title a, .viewing-activity-item a, a[class*="activityItem"]').forEach(a => {
    const t = a.textContent.trim();
    if (t) titles.add(t);
  });
  // Fallback: any link whose text looks like a title (not nav/UI chrome)
  if (titles.size === 0) {
    document.querySelectorAll('a').forEach(a => {
      const t = a.textContent.trim();
      if (t && t.length > 1 && t.length < 100 && a.closest('[class*="row"], [class*="item"], li, td')) {
        titles.add(t);
      }
    });
  }
  return [...titles];
}

function scanViewingActivity() {
  const save = () => {
    const titles = extractViewingTitles();
    if (titles.length === 0) return;
    chrome.storage.local.get('nro_exclude', data => {
      const exclude = data.nro_exclude || {};
      titles.forEach(t => { exclude[t] = 1; });
      chrome.storage.local.set({ nro_exclude: exclude });
    });
    // Notify popup with final count
    chrome.runtime.sendMessage({ type: 'viewingHistoryDone', count: titles.length }).catch(() => {});
  };

  // Auto-click "Show More" to load all pages, then save
  let clickCount = 0;
  const loadAllAndSave = () => {
    const moreBtn = [...document.querySelectorAll('button')].find(b =>
      /show more|load more|顯示更多|더 보기/i.test(b.textContent.trim())
    );
    if (moreBtn && clickCount < 5) {
      clickCount++;
      moreBtn.click();
      setTimeout(loadAllAndSave, 1500);
    } else {
      save();
    }
  };

  // Wait for initial render, then start loading all pages
  setTimeout(loadAllAndSave, 2000);
}

// Message listener: popup can request viewing history on demand
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'getViewingHistory') {
    sendResponse({ titles: extractViewingTitles() });
  }
  return true;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.omdb_api_key) {
    apiKey = changes.omdb_api_key.newValue || '';
    document.querySelectorAll('.nro-badge').forEach(el => el.remove());
    scan();
  }
});

init();
