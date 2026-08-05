# Workflow — Stream Rating Overlay

## Page Load
```
Netflix / Disney+ loads → content.js init()
  ├── Read omdb_api_key + nro_cache from chrome.storage.local
  ├── loadLists() — nro_lists + nro_list_settings (IMDb list filter)
  ├── Start MutationObserver (debounced 200ms → scan)
  └── Run initial scan()
```

## Card Discovery (layout-adaptive)
```
findCards()
  ├── Known class hooks: .title-card-container, .slider-item,
  │   [data-uia*="title-card"], [data-uia*="video-card"], [class*="titleCard"]…
  ├── ∪ heuristicCards() — structure only, survives class renames
  │     ├── Pass 1: <a href*="/watch/" | "/title/" | "jbv="> wrapping an <img>,
  │     │           tile-sized (60–700px wide)
  │     └── Pass 2 (only if pass 1 is empty): artwork <img> → walk up ≤4 levels
  │                 to the wrapper that contains a title/watch link
  ├── isSpecialArea() drops anything inside the billboard or preview modal
  └── reportLayout() → nro_layout { mode: known | mixed | adaptive | none, count }
```
Each discovered card is registered with the IntersectionObserver (300px rootMargin) and only processed once on screen.

## Scan Flow
```
scan() → scanTitles()            (Netflix)   |  scanDisney()  (Disney+)
  ├── Runs when an API key OR a list filter is active
  ├── processCard() per visible card
  │   ├── getTitle() → cleanTitle()  (text hook → img alt → aria-label)
  │   ├── applyListFilter()          — runs first, works without an API key
  │   ├── Badge exists with same title → skip
  │   ├── Cache hit → injectBadge()
  │   ├── Title in pendingTitles → skip (a later rescan() picks it up)
  │   └── fetchRatings() → applyListFilter(resolved) → injectBadge()
  ├── processCard(preview modal, isHover=true)
  └── injectBillboardBadge() — billboardLogos(): .title-logo, else hero <img alt>
```

## Ratings Fetch
```
fetchRatings(title)
  ├── In-memory ratingCache hit (7d) → return immediately
  └── Miss → sendMessage to background.js → handleFetch()
        ├── storage cache hit (7d hits / 24h misses) → return cached
        └── Miss → rateLimitedFetch (max 3 concurrent across all tabs)
              ├── Localized title (non-Latin script) + TMDB key configured
              │     → TMDB search/multi → external_ids → imdb_id
              │     → GET omdbapi.com/?i={imdbID}
              ├── Otherwise → GET omdbapi.com/?t={title}&y={year}
              │     └── Miss (not a quota/key error) + TMDB key
              │           → TMDB rescue, retry by imdbID
              ├── Found → cache 7d → { imdb, rt, mc, awards, imdbID, type, title, year }
              ├── Not found → cache 24h → null
              └── Quota / invalid key → no cache, status → nro_api_status
```
Cache is capped at 500 entries (LRU eviction to 450 when exceeded).

## Badge Injection
```
findBadgeContainer(titleEl, card)
  ├── Known hook: .title-card / .boxart-container / [class*="boxart"]
  ├── artworkBox(card) — tightest ancestor of the artwork whose box matches
  │   the image within 15%
  └── Hook wins only if its box is ≤1.25× the artwork; otherwise the measured
      box wins (a class can survive a redesign without wrapping the poster)
```
- **Small cards:** `position: absolute; bottom: 4px` overlay, no clickable links
- **Hover/detail modal:** `position: static` inline, IMDb/RT/MC links + awards
- **Billboard hero:** `position: static` inline, IMDb/RT/MC links + awards

## IMDb List Filter
```
popup Load → background handleListFetch(url, slot)
  ├── normalizeListUrl() — /list/ls…, /user/ur…/watchlist, bare "ls…"; imdb.com only
  ├── fetchListDirect()  — fetch with credentials, parse __NEXT_DATA__
  │     └── AWS WAF challenge detected → give up on the fast path
  ├── fetchListViaTab()  — background tab (active:false)
  │     ├── executeScript → __NEXT_DATA__ + a[href*="/title/tt"]  (retry ×8)
  │     ├── click "50 more / load more / 載入更多" (≤20×), re-scrape
  │     ├── next page via ?page=N (≤8 pages), stop when nothing new
  │     └── tab closed in finally
  └── Writes nro_lists[slot] + flips nro_list_settings[slot]On → popup reads back

content.js applyListFilter(card, title, ratings, resolved)
  ├── exclude list hit                → filter
  ├── include list miss (resolved)    → filter
  ├── include list miss (unresolved)  → leave alone (avoids flicker)
  └── Filtered → .nro-filtered (dim) [+ .nro-filtered-hide (display:none)]
```
Matching order: `imdbID` → normalized raw title → normalized OMDb title (`titleKeys()`: lowercase, NFKD, punctuation-stripped, article-insensitive).

## Popup Ranking
```
loadAndRender()
  ├── Read nro_cache from storage
  ├── Split by type: "series" → TV Show list, else → Movie list
  ├── Parse score by source (IMDb/RT/MC/Awards)
  ├── Filter: skipped ∪ nro_exclude ∪ passesListFilter() (same list rules)
  ├── Sort descending → top 3 highlighted
  └── User toggles Movie ↔ TV Show, switches sort source, or skips titles
```

## Behavior After Refresh

| Scenario | Result |
|----------|--------|
| Same title, within 7 days | Served from storage cache, no API call |
| Same title, after 7 days | Re-queries OMDb |
| Not found, within 24 hours | Skipped (null cached) |
| Not found, after 24 hours | Retries OMDb |
| Quota exceeded (1,000/day) | Returns null, not cached — recovers at UTC midnight |
| Old cache missing `type` | Re-fetched regardless of TTL |
| Cache > 500 entries | LRU eviction — oldest entries removed down to 450 |
| Expired entries not re-visited | Stay in cache indefinitely (no active sweep) |
| List toggled in popup | `chrome.storage.onChanged` → filters re-applied live, no reload |
| Netflix class names changed | `heuristicCards()` takes over; `nro_layout.mode` reads `adaptive` |

## DOM Scrolling

Netflix virtualizes its list — cards are recycled on scroll. MutationObserver detects changes → `scan` → `processCard` compares `dataset.nroTitle` and re-injects if the title changed. After each fetch settles, a debounced `rescan()` covers cards that were skipped because the same title was already in flight.

---

# 中文說明

## 頁面載入
```
Netflix / Disney+ 載入 → content.js init()
  ├── 讀取 omdb_api_key + nro_cache
  ├── loadLists() — nro_lists + nro_list_settings（IMDb 清單過濾）
  ├── 啟動 MutationObserver（防抖 200ms → scan）
  └── 執行初次 scan()
```

## 卡片偵測（版面自適應）
```
findCards()
  ├── 內建 class 選擇器：.title-card-container、.slider-item、
  │   [data-uia*="title-card"]、[data-uia*="video-card"]、[class*="titleCard"]…
  ├── ∪ heuristicCards() — 純結構判斷，class 改名也不受影響
  │     ├── 第一輪：包住 <img> 的 <a href*="/watch/" | "/title/" | "jbv=">，
  │     │           且寬度介於 60–700px
  │     └── 第二輪（第一輪為空才跑）：從封面 <img> 往上找 ≤4 層，
  │                 找到包含 title/watch 連結的外框
  ├── isSpecialArea() 排除 billboard 與 hover 彈窗（各有專屬流程）
  └── reportLayout() → nro_layout { mode: known | mixed | adaptive | none, count }
```
偵測到的卡片交給 IntersectionObserver（rootMargin 300px），進入視窗才處理。

## 掃描流程
```
scan() → scanTitles()（Netflix） | scanDisney()（Disney+）
  ├── 有 API key 或清單過濾啟用時才執行
  ├── 對每張進入視窗的卡片執行 processCard()
  │   ├── getTitle() → cleanTitle()（文字節點 → img alt → aria-label）
  │   ├── applyListFilter()  — 先跑，沒有 API key 也能運作
  │   ├── badge 已存在且片名相同 → 跳過
  │   ├── 快取命中 → injectBadge()
  │   ├── 片名在 pendingTitles → 跳過（稍後 rescan() 會補上）
  │   └── fetchRatings() → applyListFilter(resolved) → injectBadge()
  ├── processCard(hover 彈窗, isHover=true)
  └── injectBillboardBadge() — billboardLogos()：.title-logo，或 hero 的 <img alt>
```

## 評分取得
```
fetchRatings(title)
  ├── 記憶體 ratingCache 命中（7天）→ 直接回傳
  └── 未命中 → sendMessage 到 background.js → handleFetch()
        ├── storage 快取命中（命中7天 / 查無24小時）→ 回傳快取
        └── 未命中 → rateLimitedFetch（全 tab 最多 3 個並發）
              ├── 在地語系片名（非拉丁字母）且已設定 TMDB key
              │     → TMDB search/multi → external_ids → imdb_id
              │     → GET omdbapi.com/?i={imdbID}
              ├── 其他 → GET omdbapi.com/?t={title}&y={year}
              │     └── 查無（且非配額／金鑰錯誤）且有 TMDB key
              │           → TMDB 補救，改用 imdbID 重查
              ├── 有資料 → 快取7天 → { imdb, rt, mc, awards, imdbID, type, title, year }
              ├── 查無此片 → 快取24小時 → 回傳 null
              └── 配額用完 / 金鑰無效 → 不快取，狀態寫入 nro_api_status
```
快取上限 500 筆，超過時 LRU eviction 降至 450 筆。

## Badge 注入
```
findBadgeContainer(titleEl, card)
  ├── 內建 class：.title-card / .boxart-container / [class*="boxart"]
  ├── artworkBox(card) — 最貼合封面圖的祖先（尺寸相差 15% 以內）
  └── 內建 class 只有在盒子 ≤ 封面圖的 1.25 倍時才勝出；否則採用量測結果
      （class 可能在改版後留著，但已經不再包住封面圖）
```
- **小卡片：** `position: absolute; bottom: 4px`，無連結
- **Hover / 詳情：** `position: static` inline，有 IMDb/RT/MC 連結 + 獎項
- **Billboard hero：** `position: static` inline，有連結 + 獎項

## IMDb 清單過濾
```
popup 按「載入」→ background handleListFetch(url, slot)
  ├── normalizeListUrl() — /list/ls…、/user/ur…/watchlist、純 "ls…"；僅接受 imdb.com
  ├── fetchListDirect()  — 帶 cookie 直接 fetch，解析 __NEXT_DATA__
  │     └── 偵測到 AWS WAF 挑戰頁 → 放棄快路徑
  ├── fetchListViaTab()  — 背景分頁（active:false）
  │     ├── executeScript → __NEXT_DATA__ + a[href*="/title/tt"]（重試 8 次）
  │     ├── 點「50 more / load more / 載入更多」（≤20 次）後重新讀取
  │     ├── 以 ?page=N 翻頁（≤8 頁），沒有新資料就停
  │     └── finally 關閉分頁
  └── 寫入 nro_lists[slot] 並打開 nro_list_settings[slot]On → popup 讀回顯示

content.js applyListFilter(card, title, ratings, resolved)
  ├── 命中排除清單            → 過濾
  ├── 不在包含清單（已解析）  → 過濾
  ├── 不在包含清單（未解析）  → 先不動（避免閃爍）
  └── 過濾 → .nro-filtered（淡化）[+ .nro-filtered-hide（display:none）]
```
比對順序：`imdbID` → 正規化後的卡片片名 → 正規化後的 OMDb 片名（`titleKeys()`：轉小寫、NFKD、去標點、忽略冠詞）。

## Popup 排行榜
```
loadAndRender()
  ├── 讀取 nro_cache
  ├── 依 type 分類："series" → TV Show，其他 → Movie
  ├── 依選擇來源解析分數（IMDb/RT/MC/獎項）
  ├── 過濾：已跳過 ∪ nro_exclude ∪ passesListFilter()（與頁面同一套規則）
  ├── 降冪排序 → 前3名高亮
  └── 使用者切換 Movie ↔ TV Show、改排序來源、跳過片名
```

## 刷新頁面後的行為

| 狀況 | 結果 |
|------|------|
| 同一部片，7天內 | 從 storage 快取取，不打 API |
| 同一部片，7天後 | 重新查詢 OMDb |
| 查無的片，24小時內 | 跳過（null 已快取）|
| 查無的片，24小時後 | 重試 OMDb |
| 配額用完（1000次/天） | 回傳 null，不快取，UTC 00:00 重置 |
| 舊快取缺 type 欄位 | 不受 TTL 限制，自動重查 |
| 快取超過 500 筆 | LRU eviction，刪最舊的降至 450 筆 |
| 過期但未重新瀏覽的條目 | 無主動清除，永久留在快取直到被重查或 eviction |
| 在 popup 切換清單開關 | `chrome.storage.onChanged` → 已開啟的分頁即時重套，不需重整 |
| Netflix class 名稱改掉 | 改由 `heuristicCards()` 接手，`nro_layout.mode` 顯示 `adaptive` |

## DOM 捲動

Netflix 虛擬化列表，捲動時回收 card 節點。MutationObserver 偵測變動 → `scan` → `processCard` 比對 `dataset.nroTitle`，片名不同時移除舊 badge 並重新注入。每次 fetch 結束後會觸發防抖的 `rescan()`，補上先前因「同片名已在查詢中」而跳過的卡片。
