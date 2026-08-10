# Workflow — Stream Rating Overlay

## Page Load
```
Netflix / Disney+ loads → content.js init()
  ├── Read omdb_api_key + nro_cache from chrome.storage.local
  ├── loadSettings() — nro_lists, nro_list_settings, nro_prefs
  ├── Start MutationObserver (collects dirty subtrees, debounced 200ms)
  └── scheduleScan(full)
```

## Scan Scheduling
Two passes with very different costs, so they run on different schedules:
```
MutationObserver → dirtyRoots.add(target)  (>30 roots → mark full scan)
  └── debounce 200ms → runScan()
        ├── selectorScan(scope) per dirty subtree — querySelectorAll only, no
        │     layout reads; falls back to one document-wide pass when the roots
        │     outnumber SCOPED_ROOT_LIMIT
        ├── scanSpecialAreas() — preview modal + billboard hero
        └── scheduleHeuristic() → throttled 2s → requestIdleCallback →
              heuristicScan()  (measures elements; whole document by nature)
```

## Card Discovery (layout-adaptive)
```
selectorCards(scope)  — known class hooks
  ├── .title-card-container, .slider-item, [data-uia*="title-card"],
  │   [data-uia*="video-card"], [class*="titleCard"]…
  ├── The scope itself counts when a mutation target *is* the card
  └── isSpecialArea() drops anything inside the billboard or preview modal

heuristicCards()      — structure only, survives class renames
  ├── Pass 1: <a href*="/watch/" | "/title/" | "jbv="> wrapping an <img>,
  │           tile-sized (60–700px wide)
  └── Pass 2 (only if pass 1 is empty): artwork <img> → walk up ≤4 levels
              to the wrapper that contains a title/watch link

heuristicScan() = selectorCards(document) ∪ heuristicCards()
  └── reportLayout() → nro_layout { mode: known | mixed | adaptive | none, count }
```
Each discovered card is registered with the IntersectionObserver (300px rootMargin) and only processed once on screen.

## Per-Card Flow
```
processCard(card, isHover)
  ├── getTitle() → cleanTitle()  (text hook → img alt → aria-label)
  ├── applyFilters()             — runs first, works without an API key
  ├── Badge exists with same title → skip
  ├── cacheHit(entry, isHover) → injectBadge()
  │     └── a detail view only accepts a record with `full` (or `detailTried`)
  ├── Title already in flight → awaitTitle(title, card), no second request
  └── fetchRatings() → settleTitle(title) → applyFilters(resolved) → injectBadge()
```

## Ratings Fetch
```
fetchRatings(title, year, detail)
  ├── In-memory ratingCache hit → return immediately
  └── Miss → sendMessage to background.js → handleFetch(title, key, year, detail)
        ├── storage cache hit (7d hits / 24h misses) → return cached
        │     └── a `detail` request rejects a TMDB-only record and refetches
        └── Miss → rateLimitedFetch (max 3 concurrent across all tabs)
              │
              ├── nro_prefs.source === 'tmdb' and a TMDB key is set
              │     → tmdbLookup(): id map hit → 1 detail call,
              │                     otherwise search/multi → external_ids
              │     → { tmdb, imdbID, type, year, title, full: false }
              │     → detail view only: GET omdbapi.com/?i={imdbID} for RT/MC/awards
              │     → TMDB knows nothing → fall through to the OMDb path
              │
              ├── Localized title (non-Latin script) + TMDB key
              │     → resolveImdbIdViaTmdb() → GET omdbapi.com/?i={imdbID}
              ├── Otherwise → GET omdbapi.com/?t={title}&y={year}
              │     └── Miss (not a quota/key error) + TMDB key
              │           → TMDB rescue, retry by imdbID
              ├── Found → cache 7d → { imdb, rt, mc, awards, imdbID, type, title, year, full }
              ├── Not found → cache 24h → null
              └── Quota / invalid key → no cache, status → nro_api_status
```
- Every outgoing OMDb call increments `nro_quota { day, count }` (UTC day, reset on rollover) — the popup renders it as *used N / 1000*.
- `pickTmdbResult()` ranks TMDB search results by exact title match, then release year, then TMDB's own popularity order.
- `nro_idmap` (title|year → { imdbID, tmdbId, mediaType }) never expires and is capped at 3,000 entries, so a title evicted from the ratings cache doesn't pay for its lookups twice.
- Ratings cache is capped at 500 entries (LRU eviction to 450 when exceeded).

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
- **TMDB mode:** the TMDB pill replaces the IMDb pill whenever `imdb` is absent

## List & Score Filter
```
popup Load → background handleListFetch(url, slot, keepSwitch)
  ├── normalizeListUrl()
  │     ├── imdb.com   — /list/ls…, /user/ur…/watchlist, bare "ls…"
  │     └── letterboxd.com — /user/list/name/, /user/watchlist/, /user/films/
  ├── Letterboxd → fetchLetterboxdDirect(): plain HTML, ?page=N via /page/N/,
  │     titles from data-film-name / img alt / slug (slug also without its year)
  ├── IMDb → fetchListDirect(): fetch with credentials, parse __NEXT_DATA__
  │     └── AWS WAF challenge detected → give up on the fast path
  ├── fetchListViaTab()  — background tab (active:false)
  │     ├── executeScript → __NEXT_DATA__ + a[href*="/title/tt"]
  │     │     (8 tries with backoff on page 1, 3 on later pages)
  │     ├── click "50 more / load more / 載入更多" (≤20×), re-scrape  [IMDb only]
  │     ├── next page (≤8 IMDb / ≤20 Letterboxd), stop when nothing new
  │     └── tab closed in finally
  └── Writes nro_lists[slot] + flips nro_list_settings[slot]On → popup reads back
        └── keepSwitch (the weekly refresh) leaves the switch as the user set it

chrome.alarms "nro_list_refresh" — every 6h → refreshStaleLists()
  └── any loaded list older than 7 days is re-fetched in place

content.js applyFilters(card, title, ratings, resolved)
  ├── exclude list hit                → filter
  ├── include list miss (resolved)    → filter
  ├── include list miss (unresolved)  → leave alone (avoids flicker)
  ├── score below nro_prefs.minScore  → filter  (no score → never filtered)
  └── Filtered → .nro-filtered (dim) [+ .nro-filtered-hide (display:none)]
```
Matching order: `imdbID` → normalized raw title → normalized OMDb title (`titleKeys()`: lowercase, NFKD, punctuation-stripped, article-insensitive).

The threshold reads `imdb`, falling back to `tmdb` (same 0–10 scale), or `rt` / `mc` as a percentage.

## Popup Ranking
```
loadAndRender()
  ├── Read nro_cache from storage
  ├── Split by type: "series" → TV Show list, else → Movie list
  ├── Parse score by source (IMDb/RT/MC/Awards); the IMDb column falls back to
  │   the TMDB score and is labelled "TMDB" for those rows
  ├── Filter: skipped ∪ nro_exclude ∪ passesListFilter() (lists + threshold)
  ├── Sort descending → top 3 highlighted
  └── User toggles Movie ↔ TV Show, switches sort source, or skips titles
```

## Storage Keys

Everything lives in `chrome.storage.local`; nothing leaves the machine except the API calls themselves.

| Key | Shape | Written by | Lifetime |
|-----|-------|-----------|----------|
| `omdb_api_key` | string | popup | until changed |
| `tmdb_api_key` | string | popup | until changed |
| `nro_prefs` | `{ source: 'omdb'\|'tmdb', minScore, minSource: 'imdb'\|'rt'\|'mc' }` | popup | until changed |
| `nro_cache` | `{ [title]: { ts, data } }` | background | 7d hits / 24h misses, max 500 (LRU → 450) |
| `nro_idmap` | `{ [title\|year]: { imdbID, tmdbId, mediaType, ts } }` | background | never expires, max 3000 (oldest trimmed to 2700) |
| `nro_quota` | `{ day: 'YYYY-MM-DD', count }` | background | resets on UTC day rollover |
| `nro_lists` | `{ include: { url, site, ids, titles, count, ts }, exclude: {…} }` | background | refreshed after 7d |
| `nro_list_settings` | `{ includeOn, excludeOn, mode: 'dim'\|'hide' }` | popup + background | until changed |
| `nro_exclude` | `{ [title]: 1 }` | popup + content | until restored |
| `nro_layout` | `{ host, path, mode, count, ts }` | content | diagnostic; popup ignores it after 10 min |
| `nro_api_status` | `{ status: 'ok'\|'limit'\|'invalid', message, ts }` | background + popup | diagnostic |
| `nro_tmdb_status` | `{ status: 'ok'\|'invalid'\|'error', ts }` | background | diagnostic |

Other limits: max 3 concurrent API requests across all tabs; lists cap at 5,000 items, 8 pages (IMDb) / 20 pages (Letterboxd).

## Behavior After Refresh

| Scenario | Result |
|----------|--------|
| Same title, within 7 days | Served from storage cache, no API call |
| Same title, after 7 days | Re-queries the configured provider |
| Not found, within 24 hours | Skipped (null cached) |
| Not found, after 24 hours | Retries OMDb |
| Quota exceeded (1,000/day) | Returns null, not cached — recovers at UTC midnight |
| Old cache missing `type` | Re-fetched regardless of TTL |
| TMDB-only record, card expanded | Re-fetched once through OMDb, then cached as `full` |
| Cache > 500 entries | LRU eviction — oldest entries removed down to 450 |
| Title evicted from cache | `nro_idmap` still holds its IMDb ID — no repeat TMDB search |
| Expired entries not re-visited | Stay in cache indefinitely (no active sweep) |
| List or threshold changed in popup | `chrome.storage.onChanged` → filters re-applied live, no reload |
| List older than 7 days | Re-fetched by the alarm; the on/off switch is left alone |
| Netflix class names changed | `heuristicCards()` takes over; `nro_layout.mode` reads `adaptive` |

## DOM Scrolling

Netflix virtualizes its list — cards are recycled on scroll. MutationObserver records the changed subtrees → the debounced scan re-runs `processCard` on just those → `dataset.nroTitle` is compared and the badge re-injected if the title changed. Cards skipped because the same title was already in flight register in the `waiting` map and are updated directly when that fetch settles, instead of triggering a full-page rescan.

## Tests

```
npm install && npm test
```
`tests/` loads the shipped sources unmodified — `background.js` in a `vm` context, `content.js` and `popup.js` inside jsdom — against a stubbed `chrome.*` and a routed `fetch`. jsdom has no layout engine, so tests declare each element's box with `data-w` / `data-h` and the harness reports those as `offsetWidth` / `offsetHeight`.

Covered: URL normalisation, IMDb/Letterboxd list parsing, OMDb response mapping, provider ordering and call counts, quota accounting, the id map, card detection (known + adaptive), badge anchoring, recycled nodes, the in-flight title index, list and threshold filters, popup rendering, and manifest/permission drift.

---

# 中文說明

## 頁面載入
```
Netflix / Disney+ 載入 → content.js init()
  ├── 讀取 omdb_api_key + nro_cache
  ├── loadSettings() — nro_lists、nro_list_settings、nro_prefs
  ├── 啟動 MutationObserver（收集有變動的子樹，防抖 200ms）
  └── scheduleScan(full)
```

## 掃描排程
兩種成本差很多的掃描，排程也分開：
```
MutationObserver → dirtyRoots.add(target)（超過 30 個 → 標記為整頁掃描）
  └── 防抖 200ms → runScan()
        ├── 對每個有變動的子樹跑 selectorScan(scope) — 只做 querySelectorAll，
        │     不讀取版面尺寸；子樹數量超過 SCOPED_ROOT_LIMIT 時改跑整份文件一次
        ├── scanSpecialAreas() — hover 彈窗 + billboard hero
        └── scheduleHeuristic() → 節流 2 秒 → requestIdleCallback →
              heuristicScan()（需要量測元素，本質上必須掃整份文件）
```

## 卡片偵測（版面自適應）
```
selectorCards(scope)  — 內建 class 選擇器
  ├── .title-card-container、.slider-item、[data-uia*="title-card"]、
  │   [data-uia*="video-card"]、[class*="titleCard"]…
  ├── 當 mutation target 本身就是卡片時，scope 自己也算
  └── isSpecialArea() 排除 billboard 與 hover 彈窗（各有專屬流程）

heuristicCards()      — 純結構判斷，class 改名也不受影響
  ├── 第一輪：包住 <img> 的 <a href*="/watch/" | "/title/" | "jbv=">，
  │           且寬度介於 60–700px
  └── 第二輪（第一輪為空才跑）：從封面 <img> 往上找 ≤4 層，
              找到包含 title/watch 連結的外框

heuristicScan() = selectorCards(document) ∪ heuristicCards()
  └── reportLayout() → nro_layout { mode: known | mixed | adaptive | none, count }
```
偵測到的卡片交給 IntersectionObserver（rootMargin 300px），進入視窗才處理。

## 單張卡片流程
```
processCard(card, isHover)
  ├── getTitle() → cleanTitle()（文字節點 → img alt → aria-label）
  ├── applyFilters()          — 先跑，沒有 API key 也能運作
  ├── badge 已存在且片名相同 → 跳過
  ├── cacheHit(entry, isHover) → injectBadge()
  │     └── 詳情／hover 只接受帶 `full`（或 `detailTried`）的資料
  ├── 該片名已在查詢中 → awaitTitle(title, card)，不再發第二次請求
  └── fetchRatings() → settleTitle(title) → applyFilters(resolved) → injectBadge()
```

## 評分取得
```
fetchRatings(title, year, detail)
  ├── 記憶體 ratingCache 命中 → 直接回傳
  └── 未命中 → sendMessage 到 background.js → handleFetch(title, key, year, detail)
        ├── storage 快取命中（命中7天 / 查無24小時）→ 回傳快取
        │     └── detail 請求會拒絕「只有 TMDB 分數」的資料並重新查詢
        └── 未命中 → rateLimitedFetch（全 tab 最多 3 個並發）
              │
              ├── nro_prefs.source === 'tmdb' 且已設定 TMDB key
              │     → tmdbLookup()：對應表命中 → 1 次 detail 呼叫，
              │                     否則 search/multi → external_ids
              │     → { tmdb, imdbID, type, year, title, full: false }
              │     → 只有展開卡片時：GET omdbapi.com/?i={imdbID} 補 RT/MC/獎項
              │     → TMDB 查無 → 落回 OMDb 流程
              │
              ├── 在地語系片名（非拉丁字母）且有 TMDB key
              │     → resolveImdbIdViaTmdb() → GET omdbapi.com/?i={imdbID}
              ├── 其他 → GET omdbapi.com/?t={title}&y={year}
              │     └── 查無（且非配額／金鑰錯誤）且有 TMDB key
              │           → TMDB 補救，改用 imdbID 重查
              ├── 有資料 → 快取7天 → { imdb, rt, mc, awards, imdbID, type, title, year, full }
              ├── 查無此片 → 快取24小時 → 回傳 null
              └── 配額用完 / 金鑰無效 → 不快取，狀態寫入 nro_api_status
```
- 每一次送出的 OMDb 請求都會累加 `nro_quota { day, count }`（以 UTC 日計算，跨日歸零），popup 顯示為「今日已用 N / 1000」。
- `pickTmdbResult()` 依「片名完全相符 → 上映年份 → TMDB 原本的熱門度排序」挑選搜尋結果。
- `nro_idmap`（title|year → { imdbID, tmdbId, mediaType }）永不過期，上限 3,000 筆；即使評分快取被清掉，也不必重付查詢成本。
- 評分快取上限 500 筆，超過時 LRU eviction 降至 450 筆。

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
- **TMDB 模式：** 沒有 `imdb` 分數時，改以 TMDB 徽章取代 IMDb 徽章

## 清單與分數過濾
```
popup 按「載入」→ background handleListFetch(url, slot, keepSwitch)
  ├── normalizeListUrl()
  │     ├── imdb.com   — /list/ls…、/user/ur…/watchlist、純 "ls…"
  │     └── letterboxd.com — /使用者/list/名稱/、/使用者/watchlist/、/使用者/films/
  ├── Letterboxd → fetchLetterboxdDirect()：純 HTML，翻頁用 /page/N/，
  │     片名取自 data-film-name / img alt / slug（slug 另存去掉年份的版本）
  ├── IMDb → fetchListDirect()：帶 cookie 直接 fetch，解析 __NEXT_DATA__
  │     └── 偵測到 AWS WAF 挑戰頁 → 放棄快路徑
  ├── fetchListViaTab()  — 背景分頁（active:false）
  │     ├── executeScript → __NEXT_DATA__ + a[href*="/title/tt"]
  │     │     （第 1 頁重試 8 次並逐次拉長間隔，後續頁 3 次）
  │     ├── 點「50 more / load more / 載入更多」（≤20 次）後重新讀取（僅 IMDb）
  │     ├── 翻頁（IMDb ≤8 頁 / Letterboxd ≤20 頁），沒有新資料就停
  │     └── finally 關閉分頁
  └── 寫入 nro_lists[slot] 並打開 nro_list_settings[slot]On → popup 讀回顯示
        └── keepSwitch（每週自動更新）不會動使用者自己設定的開關

chrome.alarms「nro_list_refresh」— 每 6 小時 → refreshStaleLists()
  └── 已載入且超過 7 天的清單就地重抓

content.js applyFilters(card, title, ratings, resolved)
  ├── 命中排除清單                  → 過濾
  ├── 不在包含清單（已解析）        → 過濾
  ├── 不在包含清單（未解析）        → 先不動（避免閃爍）
  ├── 分數低於 nro_prefs.minScore   → 過濾（查不到分數則永不過濾）
  └── 過濾 → .nro-filtered（淡化）[+ .nro-filtered-hide（display:none）]
```
比對順序：`imdbID` → 正規化後的卡片片名 → 正規化後的 OMDb 片名（`titleKeys()`：轉小寫、NFKD、去標點、忽略冠詞）。

分數門檻讀取 `imdb`，沒有時改用 `tmdb`（同為 10 分制），或依設定改用 `rt` / `mc` 的百分比。

## Popup 排行榜
```
loadAndRender()
  ├── 讀取 nro_cache
  ├── 依 type 分類："series" → TV Show，其他 → Movie
  ├── 依選擇來源解析分數（IMDb/RT/MC/獎項）；IMDb 欄位在沒有 IMDb 分數時
  │   改用 TMDB 分數，該列標示為「TMDB」
  ├── 過濾：已跳過 ∪ nro_exclude ∪ passesListFilter()（清單 + 分數門檻）
  ├── 降冪排序 → 前3名高亮
  └── 使用者切換 Movie ↔ TV Show、改排序來源、跳過片名
```

## Storage 鍵值

全部存在 `chrome.storage.local`；除了 API 呼叫本身，沒有任何資料離開本機。

| 鍵值 | 結構 | 寫入者 | 生命週期 |
|------|------|--------|----------|
| `omdb_api_key` | string | popup | 直到修改 |
| `tmdb_api_key` | string | popup | 直到修改 |
| `nro_prefs` | `{ source: 'omdb'\|'tmdb', minScore, minSource: 'imdb'\|'rt'\|'mc' }` | popup | 直到修改 |
| `nro_cache` | `{ [片名]: { ts, data } }` | background | 命中 7 天 / 查無 24 小時，上限 500（LRU → 450） |
| `nro_idmap` | `{ [片名\|年份]: { imdbID, tmdbId, mediaType, ts } }` | background | 永不過期，上限 3000（清最舊的到 2700） |
| `nro_quota` | `{ day: 'YYYY-MM-DD', count }` | background | UTC 跨日歸零 |
| `nro_lists` | `{ include: { url, site, ids, titles, count, ts }, exclude: {…} }` | background | 超過 7 天自動重抓 |
| `nro_list_settings` | `{ includeOn, excludeOn, mode: 'dim'\|'hide' }` | popup + background | 直到修改 |
| `nro_exclude` | `{ [片名]: 1 }` | popup + content | 直到還原 |
| `nro_layout` | `{ host, path, mode, count, ts }` | content | 診斷用；超過 10 分鐘 popup 就不顯示 |
| `nro_api_status` | `{ status: 'ok'\|'limit'\|'invalid', message, ts }` | background + popup | 診斷用 |
| `nro_tmdb_status` | `{ status: 'ok'\|'invalid'\|'error', ts }` | background | 診斷用 |

其他上限：全部分頁合計最多 3 個並發 API 請求；清單最多 5,000 筆、8 頁（IMDb）／20 頁（Letterboxd）。

## 刷新頁面後的行為

| 狀況 | 結果 |
|------|------|
| 同一部片，7天內 | 從 storage 快取取，不打 API |
| 同一部片，7天後 | 依目前設定的來源重新查詢 |
| 查無的片，24小時內 | 跳過（null 已快取）|
| 查無的片，24小時後 | 重試 OMDb |
| 配額用完（1000次/天） | 回傳 null，不快取，UTC 00:00 重置 |
| 舊快取缺 type 欄位 | 不受 TTL 限制，自動重查 |
| 只有 TMDB 分數的片被展開 | 透過 OMDb 補查一次，之後以 `full` 快取 |
| 快取超過 500 筆 | LRU eviction，刪最舊的降至 450 筆 |
| 片名被擠出快取 | `nro_idmap` 仍保有 IMDb ID，不必重跑 TMDB 搜尋 |
| 過期但未重新瀏覽的條目 | 無主動清除，永久留在快取直到被重查或 eviction |
| 在 popup 改清單或分數門檻 | `chrome.storage.onChanged` → 已開啟的分頁即時重套，不需重整 |
| 清單超過 7 天 | 由 alarm 自動重抓，開關維持使用者的設定 |
| Netflix class 名稱改掉 | 改由 `heuristicCards()` 接手，`nro_layout.mode` 顯示 `adaptive` |

## DOM 捲動

Netflix 虛擬化列表，捲動時回收 card 節點。MutationObserver 記下有變動的子樹 → 防抖後只對這些子樹重跑 `processCard` → 比對 `dataset.nroTitle`，片名不同時移除舊 badge 並重新注入。因「同片名已在查詢中」而跳過的卡片會登記在 `waiting` map 裡，該次查詢結束時直接更新這些卡片，不需要整頁重掃。

## 測試

```
npm install && npm test
```
`tests/` 直接載入出貨用的原始碼（不做改寫）— `background.js` 跑在 `vm` context，`content.js` 與 `popup.js` 跑在 jsdom 裡 — 搭配假的 `chrome.*` 與可路由的 `fetch`。jsdom 沒有版面引擎，因此測試用 `data-w` / `data-h` 宣告每個元素的尺寸，由測試工具回報成 `offsetWidth` / `offsetHeight`。

涵蓋範圍：網址正規化、IMDb/Letterboxd 清單解析、OMDb 回應轉換、資料來源順序與呼叫次數、額度計算、ID 對應表、卡片偵測（內建 + 自適應）、徽章落點、DOM 回收、同片名索引、清單與門檻過濾、popup 畫面，以及 manifest 權限是否與程式碼同步。
