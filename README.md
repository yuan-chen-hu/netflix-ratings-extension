# Netflix Rating Overlay

Display **IMDb**, **Rotten Tomatoes**, and **Metacritic** scores on Netflix title cards.

## Installation

1. **Get a free OMDb API Key** at [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) (free: 1,000 req/day)
2. Open `chrome://extensions/` → enable **Developer mode** → **Load unpacked** → select this folder
3. Click the extension icon → paste your API Key → Save
4. Browse Netflix — rating badges appear automatically

## Rating Sources

| Badge | Source | Format |
|-------|--------|--------|
| `IMDb` yellow logo | IMDb | Score /10 |
| 🍅 | Rotten Tomatoes | Tomatometer % |
| `M` yellow logo | Metacritic | Metascore /100 |

## Color Legend

| Color | IMDb | RT | Metacritic |
|-------|------|----|------------|
| 🟢 Green | ≥ 7.5 | ≥ 75% | ≥ 75 |
| 🟡 Yellow | 6–7.4 | 60–74% | 50–74 |
| 🔴 Red | < 6 | < 60% | < 50 |

## Popup Features

- **API Status:** Real-time check (working / limit reached / invalid)
- **Ranking:** Scrollable list split by Movie / TV Show (toggle to switch)
  - Sort by IMDb, RT, Metacritic, or Awards
  - Top 3 highlighted — scroll for full ranking
  - Skip any title; next in rank fills in
  - Click title to open Netflix search
- **External Links:** Hover/detail badges link to IMDb, RT, Metacritic
- **Exclude list:** Hide titles from ranking — import IMDb/Letterboxd CSV, sync Netflix watch history (background, auto load-more), per-title or restore-all
- **i18n:** Chinese for `zh-*` browsers, English for all others
- **Data source:** Year and Movie/TV classification from OMDb (sourced from IMDb)

## Notes

- Ratings cached for 7 days to minimize API usage
- Best coverage with Netflix UI set to English (OMDb indexes English titles)
- Metacritic scores not available for all titles

---

# 中文說明

在 Netflix 瀏覽頁面的每部影片旁顯示 **IMDb**、**Rotten Tomatoes** 與 **Metacritic** 評分。

## 安裝步驟

1. **取得免費 OMDb API Key**：[omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx)（免費：每天 1,000 次）
2. 開啟 `chrome://extensions/` → 啟用「開發人員模式」→「載入未封裝項目」→ 選擇此資料夾
3. 點擊擴充功能圖示 → 貼上 API Key → 儲存
4. 前往 Netflix，評分徽章會自動出現

## 顯示來源

| 圖示 | 來源 | 格式 |
|------|------|------|
| `IMDb` 黃底黑字 | IMDb | 10 分制 |
| 🍅 | Rotten Tomatoes | Tomatometer % |
| `M` 黃底黑字 | Metacritic | 百分制 |

## 顏色說明

| 顏色 | IMDb | RT | Metacritic |
|------|------|----|------------|
| 🟢 綠色 | ≥ 7.5 | ≥ 75% | ≥ 75 |
| 🟡 黃色 | 6–7.4 | 60–74% | 50–74 |
| 🔴 紅色 | < 6 | < 60% | < 50 |

## Popup 功能

- **API 狀態**：即時檢測（正常 / 已達上限 / 無效）
- **排行榜**：Movie / TV Show 分開，按鈕切換
  - 排序來源：IMDb / RT / Metacritic / 獎項數量
  - 前 3 名高亮，往下滾動看完整排名
  - 可跳過任一影片，由下一順位遞補
  - 點擊片名跳轉 Netflix 搜尋
- **外部連結**：Hover / 詳情頁 badge 可點擊開啟 IMDb / RT / Metacritic
- **排除清單**：從排行榜隱藏已看過的片 — 匯入 IMDb/Letterboxd CSV、同步 Netflix 觀看紀錄（背景自動載入全部）、單筆或全部還原
- **多語系**：`zh-*` 顯示中文，其他語言顯示英文
- **資料來源**：年份與 Movie/TV Show 分類來自 OMDb（資料源為 IMDb）

## 注意事項

- 評分快取 7 天，減少 API 使用
- Netflix 介面設為英文時覆蓋率最佳（OMDb 以英文片名為主）
- 部分影片無 Metacritic 評分
