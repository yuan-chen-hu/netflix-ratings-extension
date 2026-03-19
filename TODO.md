# TODO

## 已完成

- [x] Hover 展開卡片顯示評分 — previewModal 彈出時注入 badge
- [x] 推薦高分 — Popup 內 Top 3 評分排行（可切換 IMDb / RT / MC 來源，可跳過遞補）

## 待辦功能

- [ ] 導入評分網站連結 — 點擊 badge 可直接跳轉到 IMDb / RT / Metacritic 對應頁面
- [ ] 確認來源 — 驗證 OMDb 回傳的評分資料與各評分網站實際數值一致
- [ ] 串接 TMDB API — 用中文片名查 TMDB 取得英文片名 + IMDb ID，再用 ID 查 OMDb，提升中文 Netflix 覆蓋率並解決同名撞片問題（需額外申請免費 TMDB API key：themoviedb.org/settings/api）
