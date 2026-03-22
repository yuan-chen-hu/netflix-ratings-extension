# TODO

## 已完成

- [x] Hover 展開卡片顯示評分 (previewModal)
- [x] Popup 排行榜（Movie / TV Show 切換，IMDb / RT / MC / 獎項排序，可跳過）
- [x] Hover/detail badge 可點擊跳轉 IMDb / RT / Metacritic
- [x] 多語系 UI（中文 / 英文自動偵測）
- [x] 搜尋頁 card 顯示評分（`data-uia="search-gallery-video-card"`）
- [x] Cache migration、LRU eviction（上限 500 筆）、rate limiting（3 並發）
- [x] Popup 排除清單：匯入 IMDb/Letterboxd CSV、Netflix 觀看紀錄自動同步（背景 tab + 自動 load more）、單筆/全部還原

## 待辦

- [ ] 串接 TMDB API — 中文片名 → 英文片名 + IMDb ID，提升中文 Netflix 覆蓋率（需 TMDB API key）
- [ ] 確認來源 — 驗證 OMDb 回傳評分與各網站實際數值一致
