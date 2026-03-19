# Workflow — Netflix Rating Overlay

## Page Load

```
Netflix page loads
    │
    ▼
content.js init()
    ├── Read omdb_api_key from chrome.storage.local
    ├── Read nro_cache from chrome.storage.local → store in memory as ratingCache
    ├── Start MutationObserver (fires scanTitles on DOM changes, debounced 200ms)
    └── Run initial scanTitles()
```

---

## Scan Flow (scanTitles)

```
scanTitles()
    │
    ▼
Find all matching card elements
(.title-card-container, .slider-item, etc.)
    │
    ▼ Run processCard() on each card
    │
    ├── No title element found → skip
    ├── Badge exists with same title → skip (already processed)
    ├── Title is in pendingTitles → skip (request in flight)
    └── Call fetchRatings()
```

---

## Ratings Fetch Flow (fetchRatings)

```
fetchRatings(title)
    │
    ▼
Check in-memory ratingCache (content.js)
    ├── Hit and not expired (7 days) → return immediately, no request sent
    └── Miss → sendMessage to background.js
            │
            ▼
        background.js handleFetch()
            │
            ▼
        Check chrome.storage.local cache
            ├── Hit (has ratings, 7-day TTL) → return cached data
            ├── Hit (not found result, 24-hour TTL) → return null
            └── Miss → send OMDb API request
                    │
                    ▼
                GET omdbapi.com/?t={title}&apikey={key}
                    ├── Has data → save to storage cache (7 days) → return ratings
                    ├── Title not found → save to storage cache (24 hours) → return null
                    └── Network error / quota exceeded → no cache → return null
```

---

## Badge Injection Flow

```
fetchRatings returns ratings data
    │
    ▼
injectBadge(card, titleEl, ratings, rawTitle)
    │
    ▼
findTitleCard(titleEl) — walk up DOM to find .title-card ancestor
    │
    ▼
Create .nro-badge div (position: absolute, bottom: 4px)
Build IMDb / RT / Metacritic pills
    │
    ▼
appendChild to .title-card
```

---

## Hover & Billboard Flow

```
scanTitles() also scans:
    │
    ├── .previewModal--container  (hover detail modal)
    │       └── processCard(card, isHover=true)
    │           ├── Get title from .previewModal--boxart alt or .title-logo alt
    │           └── injectBadge into .previewModal--detailsMetadata-left
    │               (includes awards display: 🏆)
    │
    └── .title-logo  (billboard hero banner)
            └── injectBillboardBadge(container, ratings)
                (also includes awards display)
```

---

## Popup Top 3 Flow

```
popup.js renderTop3()
    │
    ▼
Read nro_cache from chrome.storage.local
    │
    ▼
Parse scores by selected source (IMDb / RT / MC)
    ├── IMDb: parseFloat("8.4") → 8.4
    ├── RT:   parseInt("94%") → 94
    └── MC:   parseInt("82/100") → 82
    │
    ▼
Filter out skipped titles → sort descending → take top 3
    │
    ▼
Render with skip buttons (skipped title replaced by next in rank)
```

---

## Behavior After Page Refresh

| Scenario | Result |
|----------|--------|
| Same title, within 7 days | No OMDb request — served from storage cache |
| Same title, after 7 days | Re-queries OMDb |
| Title not in OMDb, within 24 hours | Skipped — null result is cached |
| Title not in OMDb, after 24 hours | Retries OMDb |
| Quota exceeded (1,000/day) | Returns null, not cached — recovers after UTC midnight reset |

**Page refresh does NOT re-fetch all ratings. Cache persists in `chrome.storage.local`.**

---

## Scrolling / Dynamic DOM

Netflix uses a virtualized list. When scrolling:
1. Old card DOM nodes are recycled
2. New titles are swapped in

MutationObserver detects DOM changes → triggers scanTitles → processCard compares `dataset.nroTitle` — if the title changed, the old badge is removed and a new one is injected.

---

# 中文說明

## 頁面載入流程

```
Netflix 頁面載入
    │
    ▼
content.js init()
    ├── 從 chrome.storage.local 讀取 omdb_api_key
    ├── 從 chrome.storage.local 讀取 nro_cache → 存入記憶體 ratingCache
    ├── 啟動 MutationObserver（DOM 變動時觸發 scanTitles，防抖 200ms）
    └── 執行初次 scanTitles()
```

---

## 每次掃描流程（scanTitles）

```
scanTitles()
    │
    ▼
找出所有符合 selector 的卡片元素
(.title-card-container, .slider-item, 等)
    │
    ▼ 對每張卡片執行 processCard()
    │
    ├── 找不到片名 → 跳過
    ├── badge 已存在且片名相同 → 跳過（不重查）
    ├── 片名在 pendingTitles → 跳過（請求進行中）
    └── 進入 fetchRatings()
```

---

## 評分取得流程（fetchRatings）

```
fetchRatings(title)
    │
    ▼
查詢記憶體 ratingCache（content.js 內）
    ├── 命中且未過期（7天）→ 直接回傳，不發任何請求
    └── 未命中 → sendMessage 到 background.js
            │
            ▼
        background.js handleFetch()
            │
            ▼
        查詢 chrome.storage.local 快取
            ├── 命中（有評分，7天 TTL）→ 回傳快取資料
            ├── 命中（查無結果，24小時 TTL）→ 回傳 null
            └── 未命中 → 發送 OMDb API 請求
                    │
                    ▼
                GET omdbapi.com/?t={title}&apikey={key}
                    ├── 有資料 → 存入 storage 快取（7天）→ 回傳評分
                    ├── 查無此片 → 存入 storage 快取（24小時）→ 回傳 null
                    └── 網路錯誤 / 配額用完 → 不快取 → 回傳 null
```

---

## Badge 注入流程

```
fetchRatings 回傳評分資料
    │
    ▼
injectBadge(card, titleEl, ratings, rawTitle)
    │
    ▼
findTitleCard(titleEl) — 向上找 .title-card 祖先節點
    │
    ▼
建立 .nro-badge div（position: absolute, bottom: 4px）
注入 IMDb / RT / Metacritic pill
    │
    ▼
appendChild 到 .title-card
```

---

## Hover 與 Billboard 流程

```
scanTitles() 同時掃描：
    │
    ├── .previewModal--container（滑鼠 hover 彈出的詳情卡片）
    │       └── processCard(card, isHover=true)
    │           ├── 從 .previewModal--boxart alt 或 .title-logo alt 取得片名
    │           └── injectBadge 注入 .previewModal--detailsMetadata-left
    │               （hover 模式會額外顯示獎項：🏆）
    │
    └── .title-logo（首頁頂部 billboard hero）
            └── injectBillboardBadge(container, ratings)
                （同樣顯示獎項）
```

---

## Popup Top 3 流程

```
popup.js renderTop3()
    │
    ▼
從 chrome.storage.local 讀取 nro_cache
    │
    ▼
依選擇的來源解析分數（IMDb / RT / MC）
    ├── IMDb: parseFloat("8.4") → 8.4
    ├── RT:   parseInt("94%") → 94
    └── MC:   parseInt("82/100") → 82
    │
    ▼
過濾已跳過的片名 → 降冪排序 → 取前 3 名
    │
    ▼
顯示排行，每項可點「跳過」（被跳過的片由下一順位遞補）
```

---

## 刷新頁面後的行為

| 狀況 | 結果 |
|------|------|
| 同一部片，7天內 | 不打 OMDb，從 storage 快取直接取 |
| 同一部片，7天後 | 重新查詢 OMDb |
| OMDb 查無的片，24小時內 | 不重查，直接跳過 |
| OMDb 查無的片，24小時後 | 重新嘗試查詢 |
| 配額用完（1000次/天） | 回傳 null，不快取，隔天重置後恢復 |

**結論：刷新頁面不會重新打所有 API，快取在 chrome.storage.local 持續存在。**

---

## DOM 捲動 / 動態載入

Netflix 使用虛擬化清單，捲動時會：
1. 回收舊卡片 DOM 節點
2. 替換成新片名

MutationObserver 偵測到 DOM 變化 → 觸發 scanTitles → processCard 比對 `dataset.nroTitle`，若片名不同則移除舊 badge 並重新注入。
