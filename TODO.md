# TODO

## 已完成

- [x] Hover 展開卡片顯示評分 (previewModal)
- [x] Popup 排行榜（Movie / TV Show 切換，IMDb / RT / MC / 獎項排序，可跳過）
- [x] Hover/detail badge 可點擊跳轉 IMDb / RT / Metacritic
- [x] 多語系 UI（中文 / 英文自動偵測）
- [x] 搜尋頁 card 顯示評分（`data-uia="search-gallery-video-card"`）
- [x] Cache migration、LRU eviction（上限 500 筆）、rate limiting（3 並發）
- [x] Popup 排除清單：匯入 IMDb/Letterboxd CSV、Netflix 觀看紀錄自動同步（背景 tab + 自動 load more）、單筆/全部還原
- [x] 擴展 Disney+ 支援（`a[href*="/browse/"]` tile，共用 fetch/cache/rate-limit）
- [x] 效能：IntersectionObserver 視窗閘門，只處理進入視窗的卡片
- [x] 安全：popup 排行榜/排除清單片名 HTML 轉義（escapeHtml）
- [x] 年份消歧義：hover / billboard 帶年份給 OMDb（`&y=`）
- [x] 版面自動適應：Netflix 改版時改用結構偵測找卡片（封面圖 + title/watch 連結），徽章釘在封面圖實際方框；舊 class 若不再包住封面圖會自動改用量測結果；popup 顯示偵測狀態
- [x] IMDb 公開清單過濾：兩個欄位（只顯示清單內 / 隱藏清單內），各自開關，淡化或隱藏；背景分頁載入清單以繞過 IMDb WAF
- [x] 串接 TMDB API：中文／日文／韓文片名 → IMDb ID → OMDb `?i=`；Latin 片名查無結果時也會用 TMDB 補救（popup 可填 TMDB key，選填）
- [x] Disney+ selector 自適應：`/browse/` 失效時改用結構偵測（排除 nav/header），alt 文字清洗（`Loki | Disney+` → `Loki`）
- [x] 品牌中性化：名稱改為 Stream Rating Overlay，popup logo 改為 ★，重新產生 icon（原本三個 PNG 的 IDAT 資料損毀，解碼器讀不出來）

## 待辦（需實機驗證）

- [ ] 確認來源 — 驗證 OMDb 回傳評分與各網站實際數值一致（需本機 API key + 逐片人工比對，無法離線驗證）
- [ ] 實機驗證 Netflix / Disney+ 新版面：確認 `heuristicCards()` / `artworkBox()` 在真實 DOM 上的落點（目前以 jsdom 模擬版面驗證）
- [ ] IMDb 清單分頁：確認新版清單頁 `?page=N` 與「50 more」按鈕文案（目前兩種都試）
- [ ] TMDB 比對品質：`search/multi` 第一筆命中率、必要時加 `language` 參數與片名相似度排序

## 建議（依效益排序）

### 高

- [ ] **改用 TMDB 當主資料源，OMDb 只補 RT/MC** — OMDb 免費版 1,000 次/天，逛個大首頁就快見底；TMDB 無同等日額度。分數／年份／類型改由 TMDB 提供，只有需要 Rotten Tomatoes / Metacritic 時才打 OMDb
- [ ] **分數門檻過濾** — 「只顯示 IMDb ≥ 7.5」滑桿。過濾用的 CSS 與 pipeline（`applyListFilter` / `.nro-filtered`）都已存在，只差 UI
- [ ] **額度儀表** — 記錄當日 OMDb 呼叫次數，popup 顯示「今日已用 340 / 1000」；目前只有撞到上限才會知道

### 中

- [ ] **快取 localized title → imdbID 對應表** — 快取被 LRU 清掉後，中文片名要重付 2 次 TMDB + 1 次 OMDb；此對應永不過期，值得獨立存放
- [ ] **Letterboxd 清單支援** — 沿用同一套 include/exclude 機制，且 Letterboxd 沒有 WAF，比 IMDb 好抓
- [ ] **清單自動更新** — 已載入的 IMDb 清單每週背景重抓一次

### 效能

- [ ] `scan()` 每次 mutation（防抖 200ms）都對整份文件 `querySelectorAll`；heuristic 路徑還會掃所有 `img` 並讀 `offsetWidth`（觸發 layout）。可改為只掃 mutation target 子樹，或把量測搬進 `requestIdleCallback`
- [ ] 用 `Map<title, cards[]>` 索引，fetch 完只更新相關卡片，取代目前的全頁 `rescan()`

### 工程

- [ ] 將 jsdom 測試（卡片偵測 / 徽章落點 / 清單比對 / TMDB 呼叫順序，共 99 項）收進 `tests/`，jsdom 僅列 devDependency，不影響「無 build step」的出貨方式 — Netflix 改版時這是唯一能當下抓到破圖的機制
