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
- [x] **TMDB 當主資料源**（`nro_prefs.source`）：格狀卡片的分數／年份／類型改由 TMDB 提供，OMDb 只在展開卡片時補 RT / Metacritic / 獎項。TMDB 徽章（藍色 pill）在沒有 IMDb 分數時取代 IMDb 徽章
- [x] **分數門檻過濾**：popup 滑桿（IMDb・RT・MC，依來源自動換算刻度），低於門檻淡化或隱藏；查不到分數的片不會被隱藏。同時套用到頁面與 popup 排行榜
- [x] **額度儀表**：`nro_quota` 記錄當日 OMDb 呼叫次數，popup 顯示「今日已用 N / 1000」，接近上限轉黃轉紅
- [x] **片名 → imdbID 對應表**（`nro_idmap`）：獨立存放、永不過期、上限 3,000 筆，評分快取被 LRU 清掉也不必重跑 TMDB 搜尋
- [x] **Letterboxd 清單支援**：list / watchlist / films 三種網址，純 HTML 直接抓（無 WAF），片名取自 `data-film-name`、poster alt 與 slug
- [x] **清單自動更新**：`chrome.alarms` 每 6 小時檢查，超過 7 天的清單背景重抓，且不會動使用者關掉的開關
- [x] **效能：掃描範圍縮小**：MutationObserver 收集有變動的子樹，只在這些子樹跑選擇器掃描；會觸發 layout 的結構偵測改為節流 2 秒 + `requestIdleCallback`
- [x] **效能：同片名索引**：`waiting` Map 記錄等同一個片名的卡片，查詢結束時直接更新這些卡片，取代整頁 `rescan()`
- [x] **測試**：`tests/`（node:test + jsdom，77 項）— 直接載入出貨用原始碼，涵蓋卡片偵測、徽章落點、資料來源順序、額度計算、清單解析、過濾邏輯、popup 畫面與 manifest 權限同步。jsdom 僅為 devDependency，出貨仍是「無 build step」

## 待辦（需實機驗證）

- [ ] 確認來源 — 驗證 OMDb 回傳評分與各網站實際數值一致（需本機 API key + 逐片人工比對，無法離線驗證）
- [ ] 實機驗證 Netflix / Disney+ 新版面：確認 `heuristicCards()` / `artworkBox()` 在真實 DOM 上的落點（目前以 jsdom 模擬版面驗證）
- [ ] IMDb 清單分頁：確認新版清單頁 `?page=N` 與「50 more」按鈕文案（目前兩種都試）
- [ ] Letterboxd 版面：確認目前的 poster 標記（`data-film-name` / `data-item-slug` / `img.image[alt]`）與實際頁面一致，以及 `/page/N/` 的翻頁上限
- [ ] TMDB 比對品質：`pickTmdbResult()` 已依「片名完全相符 → 年份 → 熱門度」排序並帶 `language=`，仍需實際比對命中率
- [ ] TMDB 模式的分數落差：TMDB 與 IMDb 同為 10 分制但取樣母體不同，需確認徽章顏色門檻（≥7.5 / ≥6）對 TMDB 是否仍合理

## 建議（依效益排序）

### 中

- [ ] **快取容量隨模式調整** — TMDB 模式沒有日額度，500 筆的上限反而成為主要限制，可考慮依 `source` 放寬
- [ ] **門檻過濾支援「未評分也隱藏」選項** — 目前查不到分數一律保留，某些使用情境（只想看高分片）會希望連未知的也收起來

### 效能

- [ ] `heuristicScan()` 仍是整份文件掃描，只是改到 idle 執行；若真實頁面上仍偏重，可再依 `dirtyRoots` 縮小量測範圍
- [ ] `scanSpecialAreas()` 每次掃描都對整份文件查 hover 彈窗／billboard，可改為由 MutationObserver 判斷是否真的出現過

### 工程

- [ ] 測試加入 Disney+ 版面案例（目前 jsdom 測試以 Netflix 結構為主）
- [ ] CI：把 `npm test` 接到 GitHub Actions，避免改動 Netflix 選擇器後才在實機上發現破圖
