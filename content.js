// Stream Rating Overlay - content.js
const CACHE_KEY = 'nro_cache';
const LISTS_KEY = 'nro_lists';
const LIST_SETTINGS_KEY = 'nro_list_settings';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
let apiKey = '';
let ratingCache = {};
let pendingTitles = new Set();
let observer = null;

// IMDb list filter state (populated from storage, live-updated on change)
let lists = { include: null, exclude: null };
let listSettings = { includeOn: false, excludeOn: false, mode: 'dim' };

// Platform detection — Netflix and Disney+ have different DOM structures
const IS_DISNEY = location.hostname.includes('disneyplus.com');
// Dispatcher the MutationObserver and storage listener call on each pass
const scan = () => (IS_DISNEY ? scanDisney() : scanTitles());
// Re-run after a fetch settles so cards that were skipped as duplicates
// (same title already in flight) pick up the result without a DOM mutation.
const rescan = debounce(() => scan(), 300);

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
  await loadLists();
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

// --- Card discovery (layout-adaptive) ---
// Netflix reshuffles class names periodically. Known hooks are tried first
// (cheap, exact); when they stop matching, cards are derived from the page
// structure instead — an artwork <img> inside a link to a title/watch URL.
const NF_CARD_SELECTORS = [
  '.title-card-container',
  '.slider-item',
  '[data-uia="title-card"]',
  '[data-uia="search-gallery-video-card"]',
  '[data-uia*="title-card"]',
  '[data-uia*="video-card"]',
  '[class*="title-card"]',
  '[class*="titleCard"]',
];

const NF_TITLE_LINKS = 'a[href*="/watch/"], a[href*="/title/"], a[href*="jbv="]';
const NF_MODAL = '.previewModal--container, [data-uia*="previewModal"], [data-uia="preview-modal"]';
const NF_BILLBOARD = '.billboard-row, [class*="billboard" i], [data-uia*="billboard"]';

// Elements handled by their own code path — never treat them as grid cards.
function isSpecialArea(el) {
  return !!(el.closest(NF_MODAL) || el.closest(NF_BILLBOARD));
}

function findCards() {
  const cards = new Set();
  document.querySelectorAll(NF_CARD_SELECTORS.join(',')).forEach(el => {
    if (!isSpecialArea(el)) cards.add(el);
  });
  const legacyCount = cards.size;
  heuristicCards().forEach(el => cards.add(el));
  reportLayout(legacyCount > 0 ? (cards.size > legacyCount ? 'mixed' : 'known') : (cards.size ? 'adaptive' : 'none'), cards.size);
  return cards;
}

// Structure-based tiles: a link to a title/watch page that wraps artwork.
function heuristicCards() {
  const roots = new Set();
  document.querySelectorAll(NF_TITLE_LINKS).forEach(a => {
    if (isSpecialArea(a)) return;
    if (!a.querySelector('img[alt], img[src*="nflxso.net"]')) return;
    const w = a.offsetWidth;
    if (w < 60 || w > 700) return; // nav chrome / full-width heroes
    roots.add(a);
  });
  if (roots.size > 0) return roots;

  // Layouts where the link is a sibling/child of the artwork rather than its
  // parent: start from the image and walk up looking for the tile wrapper.
  document.querySelectorAll('img[alt], img[src*="nflxso.net"]').forEach(img => {
    if (isSpecialArea(img)) return;
    const w = img.offsetWidth, h = img.offsetHeight;
    if (w < 80 || w > 700 || h < 40) return;
    let node = img.parentElement;
    for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
      if (node.querySelector(NF_TITLE_LINKS)) { roots.add(node); return; }
    }
  });
  return roots;
}

// Records what the scanner is seeing so the popup can show whether the current
// Netflix layout is still recognised (throttled to one write per 5s).
let lastLayoutReport = 0;
let lastLayoutCount = -1;
function reportLayout(mode, count) {
  if (count === lastLayoutCount && Date.now() - lastLayoutReport < 30000) return;
  if (Date.now() - lastLayoutReport < 5000) return;
  lastLayoutReport = Date.now();
  lastLayoutCount = count;
  chrome.storage.local.set({
    nro_layout: { host: location.hostname, path: location.pathname, mode, count, ts: Date.now() },
  }).catch(() => {});
}

function scanTitles() {
  if (!apiKey && !listActive()) return;
  findCards().forEach(observeCard);

  // Hover / detail modal
  document.querySelectorAll(NF_MODAL).forEach(card => processCard(card, true));

  // 首頁頂部 billboard hero
  billboardLogos().forEach(logo => {
    const container = logo.closest('.titleWrapper') || logo.closest('[class*="info" i]') || logo.parentElement;
    if (!container) return;
    const rawTitle = (logo.alt || '').trim();
    if (!rawTitle) return;
    if (container.querySelector('.nro-badge')) return;
    if (!apiKey) return;
    const cached = ratingCache[rawTitle];
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      if (cached.data) injectBillboardBadge(container, cached.data, rawTitle);
      return;
    }
    if (pendingTitles.has(rawTitle)) return;
    pendingTitles.add(rawTitle);
    fetchRatings(rawTitle, extractYear(container)).then(ratings => {
      pendingTitles.delete(rawTitle);
      rescan();
      if (!ratings) return;
      if (!document.contains(container)) return;
      if ((logo.alt || '').trim() !== rawTitle) return;
      injectBillboardBadge(container, ratings, rawTitle);
    });
  });
}

// Billboard title logo — `.title-logo` on the classic layout, otherwise any
// alt-bearing logo image inside the hero area.
function billboardLogos() {
  const els = new Set();
  document.querySelectorAll('.title-logo').forEach(el => { if (el.alt) els.add(el); });
  if (els.size > 0) return els;
  document.querySelectorAll(`${NF_BILLBOARD} img[alt], img[class*="logo" i][alt]`).forEach(el => {
    if ((el.alt || '').trim()) els.add(el);
  });
  return els;
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
    card.querySelector('[data-uia*="title-card-title"]') ||
    card.querySelector('.video-title span') ||
    card.querySelector('span[class*="title"]') ||
    card.querySelector('p[class*="title"]');
  if (textEl && cleanTitle(textEl.textContent)) return { el: textEl, title: cleanTitle(textEl.textContent) };
  // Fallback: img alt (boxart image)
  const img = card.querySelector('img[alt]');
  if (img && cleanTitle(img.alt)) return { el: img, title: cleanTitle(img.alt) };
  // Fallback: aria-label on card or child link
  const ariaEl = card.querySelector('a[aria-label]') || card.querySelector('[aria-label]');
  if (ariaEl && cleanTitle(ariaEl.getAttribute('aria-label'))) {
    return { el: ariaEl, title: cleanTitle(ariaEl.getAttribute('aria-label')) };
  }
  if (cleanTitle(card.getAttribute('aria-label'))) {
    return { el: card, title: cleanTitle(card.getAttribute('aria-label')) };
  }
  return null;
}

// Hover/detail modal title source: boxart alt, else the billboard logo behind it
function hoverTitleEl(card) {
  return (
    card.querySelector('.previewModal--boxart[alt]') ||
    card.querySelector('img[class*="boxart" i][alt]') ||
    card.querySelector('img[alt]') ||
    document.querySelector('.title-logo[alt]')
  );
}

function processCard(card, isHover = false) {
  let rawTitle = '';
  let titleEl = null;

  if (isHover) {
    const source = hoverTitleEl(card);
    if (!source || !source.alt) return;
    rawTitle = source.alt.trim();
    titleEl = source;
  } else {
    const found = getTitle(card);
    if (!found) return;
    titleEl = found.el;
    rawTitle = found.title;
  }
  if (!rawTitle) return;

  const cached = ratingCache[rawTitle];
  const fresh = cached && Date.now() - cached.ts < CACHE_TTL;
  // Filter runs before (and independently of) the badge so it also works with
  // no API key — title matching alone is enough for many lists.
  if (!isHover) applyListFilter(card, rawTitle, fresh ? cached.data : null, fresh || !apiKey);
  if (!apiKey) return;

  // 如果 badge 已存在且片名相同，跳過
  const existing = card.querySelector('.nro-badge');
  if (existing && existing.dataset.nroTitle === rawTitle) return;
  // 片名不同（DOM 被回收）或尚無 badge，移除舊的再重注入
  if (existing) existing.remove();
  // 有快取直接注入，不需等待也不受 pendingTitles 限制
  if (fresh) {
    if (cached.data) injectBadge(card, titleEl, cached.data, rawTitle, isHover);
    return;
  }
  if (pendingTitles.has(rawTitle)) return;
  pendingTitles.add(rawTitle);
  fetchRatings(rawTitle, isHover ? extractYear(card) : null).then(ratings => {
    pendingTitles.delete(rawTitle);
    rescan();
    // 驗證 card 還在 DOM 且片名沒有被回收替換
    if (!document.contains(card)) return;
    const currentTitle = isHover
      ? (hoverTitleEl(card)?.alt || '').trim()
      : (getTitle(card)?.title || '');
    if (currentTitle !== rawTitle) return;
    if (!isHover) applyListFilter(card, rawTitle, ratings, true);
    if (!ratings) return;
    injectBadge(card, titleEl, ratings, rawTitle, isHover);
  });
}

// --- Disney+ ---
// Tiles are <a href="/browse/entity-…"> anchors wrapping an <img alt="Title">.
// Nav/collection links share the /browse/ path but have no image, so the img
// check filters them out.
function scanDisney() {
  if (!apiKey && !listActive()) return;
  const cards = new Set();
  document.querySelectorAll('a[href*="/browse/"]').forEach(card => {
    if (disneyTitle(card)) cards.add(card);
  });
  const knownCount = cards.size;
  // Same adaptive fallback as Netflix: any link-wrapped artwork of tile size
  if (knownCount === 0) {
    document.querySelectorAll('a[href]').forEach(a => {
      if (a.closest('nav, header, footer, [role="navigation"], [role="banner"]')) return;
      const img = a.querySelector('img[alt]');
      if (!img || !img.alt.trim()) return;
      const w = a.offsetWidth;
      if (w < 60 || w > 700) return;
      if (disneyTitle(a)) cards.add(a);
    });
  }
  reportLayout(knownCount > 0 ? 'known' : (cards.size ? 'adaptive' : 'none'), cards.size);
  cards.forEach(observeCard);
}

function disneyTitle(card) {
  const img = card.querySelector('img[alt]');
  return cleanTitle(img?.alt || card.getAttribute('aria-label') || '');
}

// Strips the decoration streaming UIs put around the title in alt/aria text —
// "Loki | Disney+", "Andor – poster", "觀看 怪奇物語" all reduce to the title.
// English verb prefixes ("Watch…", "Play…") are deliberately NOT stripped:
// they're indistinguishable from real titles (Play Dirty, Watch Dogs), and a
// wrong strip would poison the cache key and the list matching.
function cleanTitle(raw) {
  return String(raw || '')
    .replace(/\s*[|｜]\s*(disney\+?|hulu|star)\s*$/i, '')
    .replace(/^(觀看|观看|播放|재생|再生)\s+/, '')
    .replace(/[\s–—-]+(poster|海報|キービジュアル)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function processDisneyCard(card, rawTitle) {
  const cached = ratingCache[rawTitle];
  const fresh = cached && Date.now() - cached.ts < CACHE_TTL;
  applyListFilter(card, rawTitle, fresh ? cached.data : null, fresh || !apiKey);
  if (!apiKey) return;

  const existing = card.querySelector('.nro-badge');
  if (existing && existing.dataset.nroTitle === rawTitle) return;
  if (existing) existing.remove();
  if (fresh) {
    if (cached.data) injectDisneyBadge(card, cached.data, rawTitle);
    return;
  }
  if (pendingTitles.has(rawTitle)) return;
  pendingTitles.add(rawTitle);
  fetchRatings(rawTitle).then(ratings => {
    pendingTitles.delete(rawTitle);
    rescan();
    if (!document.contains(card)) return;
    if (disneyTitle(card) !== rawTitle) return; // DOM recycled with new title
    applyListFilter(card, rawTitle, ratings, true);
    if (!ratings) return;
    injectDisneyBadge(card, ratings, rawTitle);
  });
}

function injectDisneyBadge(card, ratings, rawTitle) {
  if (card.querySelector('.nro-badge')) return;
  // Pin to the artwork box rather than the link, which is often padded
  const container = artworkBox(card) || card;
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const parts = buildPills(ratings, false);
  if (parts.length === 0) return;
  const badge = document.createElement('div');
  badge.className = 'nro-badge';
  badge.dataset.nroTitle = rawTitle;
  badge.innerHTML = parts.join('');
  container.appendChild(badge);
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

// --- IMDb list filter ---

async function loadLists() {
  const d = await chrome.storage.local.get([LISTS_KEY, LIST_SETTINGS_KEY]);
  const stored = d[LISTS_KEY] || {};
  lists = { include: buildList(stored.include), exclude: buildList(stored.exclude) };
  listSettings = Object.assign(
    { includeOn: false, excludeOn: false, mode: 'dim' },
    d[LIST_SETTINGS_KEY] || {}
  );
}

function buildList(raw) {
  if (!raw) return null;
  const ids = new Set(raw.ids || []);
  const titles = new Set();
  (raw.titles || []).forEach(t => titleKeys(t).forEach(k => titles.add(k)));
  if (!ids.size && !titles.size) return null;
  return { ids, titles };
}

// Keep in sync with the copy in popup.js — normalises a display title into
// match keys (case/punctuation/diacritic insensitive, plus an article-less
// variant so "The Gray Man" matches "Gray Man").
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

function listActive() {
  return !!((listSettings.includeOn && lists.include) || (listSettings.excludeOn && lists.exclude));
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

// Hide/dim the tile the card belongs to. `resolved` means we already have (or
// definitively failed to get) OMDb data — until then "not in the include list"
// is not yet a safe conclusion, so the card stays untouched to avoid flicker.
function applyListFilter(card, rawTitle, ratings, resolved) {
  const target = filterTarget(card);
  if (!listActive()) { setFiltered(target, false); return; }
  let filtered = false;
  if (listSettings.excludeOn && lists.exclude && matchList(lists.exclude, rawTitle, ratings)) {
    filtered = true;
  }
  if (!filtered && listSettings.includeOn && lists.include) {
    const hit = matchList(lists.include, rawTitle, ratings);
    if (!hit && !resolved) return; // undecided — leave as-is
    filtered = !hit;
  }
  setFiltered(target, filtered);
}

function filterTarget(card) {
  return card.closest('.slider-item') || card.closest('[data-uia="title-card"]') || card;
}

function setFiltered(el, on) {
  el.classList.toggle('nro-filtered', on);
  el.classList.toggle('nro-filtered-hide', on && listSettings.mode === 'hide');
}

function clearAllFilters() {
  document.querySelectorAll('.nro-filtered').forEach(el => {
    el.classList.remove('nro-filtered', 'nro-filtered-hide');
  });
}

function findBadgeContainer(el, card) {
  // Known class hooks first
  let legacy = null;
  let node = el.parentElement;
  while (node && node !== document.body && node !== card) {
    if (node.classList.contains('title-card')) { legacy = node; break; }
    node = node.parentElement;
  }
  if (!legacy) {
    legacy =
      card.querySelector('.title-card') ||
      card.querySelector('.boxart-container') ||
      card.querySelector('[class*="titleCard"]') ||
      card.querySelector('[class*="boxart" i]');
  }
  // Layout-adaptive anchor: whatever box the artwork actually fills.
  const art = artworkBox(card);
  if (!legacy) return art || card;
  if (!art || legacy === art) return legacy;
  // A known class can survive a redesign while no longer wrapping the poster —
  // if the hook's box is much bigger than the artwork, the badge would land
  // off the image, so trust the measured box instead.
  const fits = legacy.offsetHeight <= art.offsetHeight * 1.25 && legacy.offsetWidth <= art.offsetWidth * 1.25;
  return fits ? legacy : art;
}

// The tightest ancestor of the card's artwork whose box matches the artwork
// itself (within 15%) — i.e. the element the badge should sit inside. Taking
// the innermost match keeps the badge on the poster even when outer wrappers
// happen to be close in size.
function artworkBox(card) {
  const img = largestImage(card);
  if (!img) return null;
  const iw = img.offsetWidth, ih = img.offsetHeight;
  if (iw < 40 || ih < 20) return null;
  let node = img.parentElement;
  while (node && node !== document.body) {
    const w = node.offsetWidth, h = node.offsetHeight;
    if (w >= iw * 0.85 && w <= iw * 1.15 && h >= ih * 0.85 && h <= ih * 1.15) return node;
    if (node === card) break;
    node = node.parentElement;
  }
  return null;
}

function largestImage(scope) {
  let best = null, area = 0;
  scope.querySelectorAll('img').forEach(img => {
    const a = img.offsetWidth * img.offsetHeight;
    if (a > area) { area = a; best = img; }
  });
  return best;
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
      card.querySelector('[class*="detailsMetadata" i]') ||
      card.querySelector('[class*="metadata" i]') ||
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
  // List/toggle edits in the popup take effect immediately on open tabs
  if (changes[LISTS_KEY] || changes[LIST_SETTINGS_KEY]) {
    loadLists().then(() => { clearAllFilters(); scan(); });
  }
});

init();
