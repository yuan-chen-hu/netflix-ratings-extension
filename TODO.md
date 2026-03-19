# TODO

## 已完成

- [x] Hover 展開卡片顯示評分 — previewModal 彈出時注入 badge
- [x] 推薦高分 — Popup 排行榜（Movie / TV Show 分開，可切換 IMDb / RT / MC，可跳過遞補）
- [x] 導入評分網站連結 — hover/detail 頁面的 badge 可點擊跳轉到 IMDb / RT / Metacritic
- [x] 多語系 — 自動偵測瀏覽器語言，中文 / 英文 UI

## 待辦功能

- [ ] 確認來源 — 驗證 OMDb 回傳的評分資料與各評分網站實際數值一致
- [ ] 串接 TMDB API — 用中文片名查 TMDB 取得英文片名 + IMDb ID，再用 ID 查 OMDb，提升中文 Netflix 覆蓋率並解決同名撞片問題（需額外申請免費 TMDB API key：themoviedb.org/settings/api）
