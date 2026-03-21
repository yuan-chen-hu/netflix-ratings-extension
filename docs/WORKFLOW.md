# Workflow — Netflix Rating Overlay

## Page Load
```
Netflix loads → content.js init()
  ├── Read omdb_api_key + nro_cache from chrome.storage.local
  ├── Start MutationObserver (debounced 200ms → scanTitles)
  └── Run initial scanTitles()
```

## Scan Flow
```
scanTitles()
  ├── Query card selectors (.title-card-container, .slider-item,
  │   [data-uia="title-card"], [data-uia="search-gallery-video-card"])
  ├── processCard() on each card
  │   ├── No title found → skip
  │   ├── Badge exists with same title → skip
  │   ├── Title in pendingTitles → skip
  │   └── fetchRatings() → injectBadge()
  ├── processCard(.previewModal--container, isHover=true) — hover modal
  └── injectBillboardBadge(.title-logo) — homepage hero banner
```

## Ratings Fetch
```
fetchRatings(title)
  ├── In-memory ratingCache hit (7d) → return immediately
  └── Miss → sendMessage to background.js
        ├── storage cache hit (7d hits / 24h misses) → return cached
        └── Miss → rateLimitedFetch (max 3 concurrent across all tabs)
              → GET omdbapi.com/?t={title}&apikey={key}
                    ├── Found → cache 7d → return { imdb, rt, mc, awards, imdbID, type, title, year }
                    ├── Not found → cache 24h → return null
                    └── Error / quota → no cache → return null
```

Cache is capped at 500 entries (LRU eviction to 450 when exceeded).

## Badge Injection
- **Small cards:** `position: absolute; bottom: 4px` overlay, no clickable links
- **Hover/detail modal:** `position: static` inline, IMDb/RT/MC links + awards
- **Billboard hero:** `position: static` inline, IMDb/RT/MC links + awards

## Popup Ranking
```
loadAndRender()
  ├── Read nro_cache from storage
  ├── Split by type: "series" → TV Show list, else → Movie list
  ├── Parse score by source (IMDb/RT/MC/Awards)
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

## DOM Scrolling

Netflix virtualizes its list — cards are recycled on scroll. MutationObserver detects changes → `scanTitles` → `processCard` compares `dataset.nroTitle` and re-injects if title changed.

---

# 中文說明

## 頁面載入
```
Netflix 載入 → content.js init()
  ├── 讀取 omdb_api_key + nro_cache
  ├── 啟動 MutationObserver（防抖 200ms → scanTitles）
  └── 執行初次 scanTitles()
```

## 掃描流程
```
scanTitles()
  ├── 查詢 card selectors（.title-card-container、.slider-item、
  │   [data-uia="title-card"]、[data-uia="search-gallery-video-card"]）
  ├── 對每張 card 執行 processCard()
  │   ├── 找不到片名 → 跳過
  │   ├── badge 已存在且片名相同 → 跳過
  │   ├── 片名在 pendingTitles → 跳過
  │   └── fetchRatings() → injectBadge()
  ├── processCard(.previewModal--container, isHover=true) — hover 彈窗
  └── injectBillboardBadge(.title-logo) — 首頁頂部 hero
```

## 評分取得
```
fetchRatings(title)
  ├── 記憶體 ratingCache 命中（7天）→ 直接回傳
  └── 未命中 → sendMessage 到 background.js
        ├── storage 快取命中（命中7天 / 查無24小時）→ 回傳快取
        └── 未命中 → rateLimitedFetch（全 tab 最多 3 個並發）
              → GET omdbapi.com/?t={title}&apikey={key}
                    ├── 有資料 → 快取7天 → 回傳評分
                    ├── 查無此片 → 快取24小時 → 回傳 null
                    └── 錯誤 / 配額用完 → 不快取 → 回傳 null
```

快取上限 500 筆，超過時 LRU eviction 降至 450 筆。

## Badge 注入
- **小卡片：** `position: absolute; bottom: 4px`，無連結
- **Hover / 詳情：** `position: static` inline，有 IMDb/RT/MC 連結 + 獎項
- **Billboard hero：** `position: static` inline，有連結 + 獎項

## Popup 排行榜
```
loadAndRender()
  ├── 讀取 nro_cache
  ├── 依 type 分類："series" → TV Show，其他 → Movie
  ├── 依選擇來源解析分數（IMDb/RT/MC/獎項）
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

## DOM 捲動

Netflix 虛擬化列表，捲動時回收 card 節點。MutationObserver 偵測變動 → `scanTitles` → `processCard` 比對 `dataset.nroTitle`，片名不同時移除舊 badge 並重新注入。
