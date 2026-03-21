# TODO

## 已完成

- [x] Hover 展開卡片顯示評分 (previewModal)
- [x] Popup 排行榜（Movie / TV Show 切換，IMDb / RT / MC / 獎項排序，可跳過）
- [x] Hover/detail badge 可點擊跳轉 IMDb / RT / Metacritic
- [x] 多語系 UI（中文 / 英文自動偵測）
- [x] 搜尋頁 card 顯示評分（`data-uia="search-gallery-video-card"`）
- [x] Cache migration（舊快取缺 type 欄位時自動重查）
- [x] Cache 容量控制（LRU eviction，上限 500 筆）
- [x] Rate limiting（最多 3 個並發 OMDb 請求，queue 排隊）
- [x] MISS_TTL bug fix（查無的片正確使用 24h TTL）

## 待辦

- [ ] 串接 TMDB API — 中文片名 → 英文片名 + IMDb ID，提升中文 Netflix 覆蓋率（需 TMDB API key）
- [ ] 確認來源 — 驗證 OMDb 回傳評分與各網站實際數值一致
