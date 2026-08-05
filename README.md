# Stream Rating Overlay

Display **IMDb**, **Rotten Tomatoes**, and **Metacritic** scores on **Netflix** and **Disney+** title cards.

## Installation

1. **Get a free OMDb API Key** at [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) (free: 1,000 req/day)
2. Open `chrome://extensions/` → enable **Developer mode** → **Load unpacked** → select this folder
3. Click the extension icon → paste your API Key → Save
4. Browse Netflix or Disney+ — rating badges appear automatically

**Localized UI?** OMDb only indexes English titles. Add a free [TMDB key](https://www.themoviedb.org/settings/api) in the popup and Chinese / Japanese / Korean card titles are resolved through TMDB into an IMDb ID before the rating lookup.

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
- **IMDb list filter:** Two independent fields for public IMDb list URLs, each with its own on/off switch
  - *Only show titles in this list* — everything outside the list is filtered out
  - *Hide titles in this list* — everything inside the list is filtered out
  - Both can run at once; switch either on or off at any time (takes effect immediately on open tabs)
  - Filtered titles are dimmed by default, or hidden completely (`Dim` / `Hide` selector)
  - Also applies to the popup ranking
- **Layout detector:** Shows how many cards the scanner currently sees and whether it's using the built-in selectors or auto-detection
- **i18n:** Chinese for `zh-*` browsers, English for all others
- **Data source:** Year and Movie/TV classification from OMDb (sourced from IMDb)

## IMDb List Filter

1. Open your list on IMDb → **Share** → copy the link (the list must be **public**)
2. Paste it into either field in the popup → **Load** (a `ls…` id or a watchlist URL also works)
3. The switch turns on automatically; toggle it off any time to see everything again

Matching uses the IMDb ID first (exact) and falls back to title matching, so coverage is best with the streaming UI in English.

## Notes

- Works on both Netflix and Disney+ (grid, hover, search; Netflix billboard hero)
- **Survives Netflix layout changes:** cards are found by the known class hooks first, and when those stop matching the scanner falls back to page structure (artwork image inside a title/watch link). Badges are pinned to the box the artwork actually fills, so a class rename doesn't push them out of place
- IMDb blocks plain background requests, so a list is loaded in a background tab that closes itself when done
- Ratings cached for 7 days to minimize API usage
- Best coverage with the streaming UI set to English, or with a TMDB key configured (OMDb indexes English titles)
- Year passed to OMDb from hover/billboard metadata to disambiguate same-name titles
- Metacritic scores not available for all titles

---

# 中文說明

在 **Netflix** 與 **Disney+** 瀏覽頁面的每部影片旁顯示 **IMDb**、**Rotten Tomatoes** 與 **Metacritic** 評分。

## 安裝步驟

1. **取得免費 OMDb API Key**：[omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx)（免費：每天 1,000 次）
2. 開啟 `chrome://extensions/` → 啟用「開發人員模式」→「載入未封裝項目」→ 選擇此資料夾
3. 點擊擴充功能圖示 → 貼上 API Key → 儲存
4. 前往 Netflix 或 Disney+，評分徽章會自動出現

**介面是中文？** OMDb 只收錄英文片名。在 popup 填入免費的 [TMDB key](https://www.themoviedb.org/settings/api)，中文／日文／韓文片名會先透過 TMDB 轉成 IMDb ID 再查評分。

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
- **IMDb 清單過濾**：兩個獨立欄位，各自貼上公開 IMDb 清單網址，各自有開關
  - *只顯示清單內的影片* — 清單外的一律過濾掉
  - *隱藏清單內的影片* — 清單內的一律過濾掉
  - 兩個可同時使用，開關隨時可切換（已開啟的分頁立即生效）
  - 被過濾的影片預設淡化，也可選擇完全隱藏（`淡化` / `隱藏`）
  - 同時套用到 popup 排行榜
- **版面偵測**：顯示目前掃到幾張卡片、以及使用內建選擇器還是自動偵測
- **多語系**：`zh-*` 顯示中文，其他語言顯示英文
- **資料來源**：年份與 Movie/TV Show 分類來自 OMDb（資料源為 IMDb）

## IMDb 清單過濾

1. 在 IMDb 開啟你的清單 → **Share（分享）** → 複製連結（清單必須設為 **公開**）
2. 貼到 popup 任一欄位 → 按 **載入**（也接受 `ls…` 編號或 watchlist 網址）
3. 載入後開關會自動打開；想看全部時隨時關掉即可

比對優先使用 IMDb ID（精準），其次才用片名比對，因此串流介面設為英文時覆蓋率最佳。

## 注意事項

- 同時支援 Netflix 與 Disney+（格狀卡、hover、搜尋頁；Netflix 首頁 billboard）
- **可承受 Netflix 改版**：先用內建 class 選擇器找卡片，當這些失效時改用頁面結構判斷（title/watch 連結內的封面圖）。徽章會釘在封面圖實際佔據的方框上，因此 class 改名也不會讓徽章位置跑掉
- IMDb 會擋掉純背景請求，因此清單改以背景分頁載入，讀完自動關閉
- 評分快取 7 天，減少 API 使用
- 串流介面設為英文、或設定 TMDB key 時覆蓋率最佳（OMDb 以英文片名為主）
- Hover / billboard 的年份會帶入 OMDb 查詢，消除同名不同年的誤判
- 部分影片無 Metacritic 評分
