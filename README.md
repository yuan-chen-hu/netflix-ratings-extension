# Stream Rating Overlay

Display **IMDb**, **Rotten Tomatoes**, **Metacritic** and **TMDB** scores on **Netflix** and **Disney+** title cards.

## Installation

1. **Get a free OMDb API Key** at [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) (free: 1,000 req/day)
2. Open `chrome://extensions/` → enable **Developer mode** → **Load unpacked** → select this folder
3. Click the extension icon → paste your API Key → Save
4. Browse Netflix or Disney+ — rating badges appear automatically

**Recommended:** also add a free [TMDB key](https://www.themoviedb.org/settings/api) in the popup. It does two jobs:

- **Localized titles** — OMDb only indexes English titles, so Chinese / Japanese / Korean card titles are resolved through TMDB into an IMDb ID before the rating lookup
- **Unlocks TMDB mode** — see [Primary Data Source](#primary-data-source) below, which keeps ordinary browsing off the OMDb daily limit entirely

## Rating Sources

| Badge | Source | Format |
|-------|--------|--------|
| `IMDb` yellow logo | IMDb | Score /10 |
| 🍅 | Rotten Tomatoes | Tomatometer % |
| `M` yellow logo | Metacritic | Metascore /100 |
| `TMDB` blue logo | TMDB | Score /10 — shown instead of IMDb in TMDB mode |

## Color Legend

| Color | IMDb / TMDB | RT | Metacritic |
|-------|-------------|----|------------|
| 🟢 Green | ≥ 7.5 | ≥ 75% | ≥ 75 |
| 🟡 Yellow | 6–7.4 | 60–74% | 50–74 |
| 🔴 Red | < 6 | < 60% | < 50 |

## Primary Data Source

OMDb's free tier is 1,000 requests a day, which one long browsing session can burn through. The popup's **Primary data source** picker chooses where the numbers come from:

| Mode | Grid tiles | Hover / detail card | OMDb calls |
|------|-----------|---------------------|------------|
| **OMDb** (default) | IMDb + RT + Metacritic | same, plus awards | one per title |
| **TMDB** | TMDB score, year, movie/TV | RT + Metacritic + awards fetched from OMDb on demand | only for cards you actually open |

TMDB mode needs a TMDB key and has no comparable daily cap, so browsing costs nothing; you only spend OMDb quota on titles you stop to look at. The popup shows **OMDb used today: N / 1000** whenever the counter is non-zero, so the limit stops being a surprise.

## Popup Features

- **API Status:** Real-time check (working / limit reached / invalid)
- **Ranking:** Scrollable list split by Movie / TV Show (toggle to switch)
  - Sort by IMDb, RT, Metacritic, or Awards
  - Top 3 highlighted — scroll for full ranking
  - Skip any title; next in rank fills in
  - Click title to open Netflix search
- **External Links:** Hover/detail badges link to IMDb, RT, Metacritic
- **Quota meter:** OMDb calls used today out of the free tier's 1,000, turning yellow then red as it fills
- **Exclude list:** Hide titles from ranking — import IMDb/Letterboxd CSV, sync Netflix watch history (background, auto load-more), per-title or restore-all
- **Score threshold:** *Minimum score* slider — dim or hide anything rated below your cut, on IMDb (or TMDB), Rotten Tomatoes, or Metacritic. Titles with no score are never hidden
- **List filter:** Two independent fields for public IMDb or Letterboxd list URLs, each with its own on/off switch
  - *Only show titles in this list* — everything outside the list is filtered out
  - *Hide titles in this list* — everything inside the list is filtered out
  - Both can run at once; switch either on or off at any time (takes effect immediately on open tabs)
  - Filtered titles are dimmed by default, or hidden completely (`Dim` / `Hide` selector)
  - Also applies to the popup ranking
- **Layout detector:** Shows how many cards the scanner currently sees and whether it's using the built-in selectors or auto-detection
- **i18n:** Chinese for `zh-*` browsers, English for all others

## List Filter

1. Copy a list URL:
   - **IMDb** — open your list → **Share** → copy the link (the list must be **public**). A bare `ls…` id or a watchlist URL works too
   - **Letterboxd** — a list (`letterboxd.com/user/list/name/`), a watchlist (`/user/watchlist/`), or the full watched log (`/user/films/`)
2. Paste it into either field in the popup → **Load**
3. The switch turns on automatically; toggle it off any time to see everything again

Matching uses the IMDb ID first (exact) and falls back to title matching. IMDb lists carry IDs; Letterboxd markup doesn't, so those match on title alone — coverage is best with the streaming UI in English.

Loaded lists are re-fetched in the background once they're a week old, so a watchlist you keep editing stays current without another visit to the popup.

## Notes

- Works on both Netflix and Disney+ (grid, hover, search; Netflix billboard hero)
- **Survives Netflix layout changes:** cards are found by the known class hooks first, and when those stop matching the scanner falls back to page structure (artwork image inside a title/watch link). Badges are pinned to the box the artwork actually fills, so a class rename doesn't push them out of place
- IMDb blocks plain background requests, so an IMDb list is loaded in a background tab that closes itself when done. Letterboxd serves plain HTML, so those lists load without opening anything
- Ratings cached for 7 days to minimize API usage; the title → IMDb ID mapping is kept separately and never expires, so an evicted cache entry doesn't cost another round of lookups
- Best coverage with the streaming UI set to English, or with a TMDB key configured (OMDb indexes English titles)
- Year passed to OMDb from hover/billboard metadata to disambiguate same-name titles
- Metacritic scores not available for all titles

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | API keys, the ratings cache, lists and preferences (all local — nothing is sent anywhere else) |
| `tabs` + `scripting` | Opening the background tab that clears IMDb's bot challenge, and syncing Netflix viewing activity. Both tabs close themselves |
| `alarms` | The weekly list refresh |
| `netflix.com`, `disneyplus.com` | Where the badges are drawn |
| `omdbapi.com`, `api.themoviedb.org` | Rating lookups |
| `imdb.com`, `letterboxd.com` | Loading the lists you paste into the filter |

## What's New in 1.3

- **TMDB as primary data source** — browse without spending OMDb quota; OMDb is called only for cards you expand
- **Score threshold filter** — dim or hide anything below your cut
- **OMDb quota meter** — see today's usage before you hit the wall
- **Letterboxd lists** — lists, watchlists and full watched logs alongside IMDb lists
- **Weekly list auto-refresh**
- **Faster scanning** — only changed page regions are re-scanned, and layout measurement moved to idle time
- **Test suite** — `npm test` runs the shipped code against a stubbed browser

## Development

No build step — plain JS/CSS. Edit and reload in `chrome://extensions/`.

```bash
npm install   # jsdom, for the tests only
npm test
```

The suite runs the shipped `background.js`, `content.js` and `popup.js` unmodified against a stubbed `chrome.*` and a jsdom page: card detection, badge anchoring, provider ordering, quota accounting, list parsing and the filters. Nothing under `tests/` or `node_modules/` is part of the extension.

---

# 中文說明

在 **Netflix** 與 **Disney+** 瀏覽頁面的每部影片旁顯示 **IMDb**、**Rotten Tomatoes**、**Metacritic** 與 **TMDB** 評分。

## 安裝步驟

1. **取得免費 OMDb API Key**：[omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx)（免費：每天 1,000 次）
2. 開啟 `chrome://extensions/` → 啟用「開發人員模式」→「載入未封裝項目」→ 選擇此資料夾
3. 點擊擴充功能圖示 → 貼上 API Key → 儲存
4. 前往 Netflix 或 Disney+，評分徽章會自動出現

**建議一併設定：** 在 popup 填入免費的 [TMDB key](https://www.themoviedb.org/settings/api)，它有兩個用途：

- **在地語系片名** — OMDb 只收錄英文片名，中文／日文／韓文片名會先透過 TMDB 轉成 IMDb ID 再查評分
- **開啟 TMDB 模式** — 見下方[主要資料來源](#主要資料來源)，一般瀏覽完全不會消耗 OMDb 的每日額度

## 顯示來源

| 圖示 | 來源 | 格式 |
|------|------|------|
| `IMDb` 黃底黑字 | IMDb | 10 分制 |
| 🍅 | Rotten Tomatoes | Tomatometer % |
| `M` 黃底黑字 | Metacritic | 百分制 |
| `TMDB` 藍底 | TMDB | 10 分制 — TMDB 模式下取代 IMDb 顯示 |

## 顏色說明

| 顏色 | IMDb / TMDB | RT | Metacritic |
|------|-------------|----|------------|
| 🟢 綠色 | ≥ 7.5 | ≥ 75% | ≥ 75 |
| 🟡 黃色 | 6–7.4 | 60–74% | 50–74 |
| 🔴 紅色 | < 6 | < 60% | < 50 |

## 主要資料來源

OMDb 免費版每天只有 1,000 次，逛個大首頁就快見底。popup 的「**主要資料來源**」可以切換分數從哪裡來：

| 模式 | 格狀卡片 | 展開卡片 / 詳情 | OMDb 用量 |
|------|---------|----------------|-----------|
| **OMDb**（預設） | IMDb + RT + Metacritic | 同左，另加獎項 | 每部片一次 |
| **TMDB** | TMDB 分數、年份、電影／影集 | 展開時才向 OMDb 補 RT + Metacritic + 獎項 | 只花在你真的展開的片 |

TMDB 模式需要 TMDB key，而 TMDB 沒有同等的日額度，所以純瀏覽不花配額，只有停下來細看的片才會用到 OMDb。當日只要有用量，popup 就會顯示「**OMDb 今日已用 N / 1000**」，不必等撞到上限才知道。

## Popup 功能

- **API 狀態**：即時檢測（正常 / 已達上限 / 無效）
- **排行榜**：Movie / TV Show 分開，按鈕切換
  - 排序來源：IMDb / RT / Metacritic / 獎項數量
  - 前 3 名高亮，往下滾動看完整排名
  - 可跳過任一影片，由下一順位遞補
  - 點擊片名跳轉 Netflix 搜尋
- **外部連結**：Hover / 詳情頁 badge 可點擊開啟 IMDb / RT / Metacritic
- **額度儀表**：顯示 OMDb 今日已用幾次（免費版 1,000 次），接近上限時轉黃再轉紅
- **排除清單**：從排行榜隱藏已看過的片 — 匯入 IMDb/Letterboxd CSV、同步 Netflix 觀看紀錄（背景自動載入全部）、單筆或全部還原
- **分數門檻**：「分數門檻」滑桿 — 低於你設定的分數就淡化或隱藏，可依 IMDb（或 TMDB）、Rotten Tomatoes、Metacritic 計算。查不到分數的片永遠不會被隱藏
- **清單過濾**：兩個獨立欄位，各自貼上公開的 IMDb 或 Letterboxd 清單網址，各自有開關
  - *只顯示清單內的影片* — 清單外的一律過濾掉
  - *隱藏清單內的影片* — 清單內的一律過濾掉
  - 兩個可同時使用，開關隨時可切換（已開啟的分頁立即生效）
  - 被過濾的影片預設淡化，也可選擇完全隱藏（`淡化` / `隱藏`）
  - 同時套用到 popup 排行榜
- **版面偵測**：顯示目前掃到幾張卡片、以及使用內建選擇器還是自動偵測
- **多語系**：`zh-*` 顯示中文，其他語言顯示英文

## 清單過濾

1. 複製清單網址：
   - **IMDb** — 開啟清單 → **Share（分享）** → 複製連結（清單必須設為 **公開**）。也接受 `ls…` 編號或 watchlist 網址
   - **Letterboxd** — 清單（`letterboxd.com/使用者/list/名稱/`）、watchlist（`/使用者/watchlist/`）或看過的全部影片（`/使用者/films/`）
2. 貼到 popup 任一欄位 → 按 **載入**
3. 載入後開關會自動打開；想看全部時隨時關掉即可

比對優先使用 IMDb ID（精準），其次才用片名比對。IMDb 清單帶有 ID；Letterboxd 的頁面沒有，只能用片名比對 — 串流介面設為英文時覆蓋率最佳。

已載入的清單超過一週後會在背景自動重抓，常改的 watchlist 不必再回到 popup 手動更新。

## 注意事項

- 同時支援 Netflix 與 Disney+（格狀卡、hover、搜尋頁；Netflix 首頁 billboard）
- **可承受 Netflix 改版**：先用內建 class 選擇器找卡片，當這些失效時改用頁面結構判斷（title/watch 連結內的封面圖）。徽章會釘在封面圖實際佔據的方框上，因此 class 改名也不會讓徽章位置跑掉
- IMDb 會擋掉純背景請求，因此 IMDb 清單改以背景分頁載入，讀完自動關閉；Letterboxd 是純 HTML，不需要開任何分頁
- 評分快取 7 天，減少 API 使用；片名 → IMDb ID 的對應表另外存放且永不過期，快取被清掉時不必重付一輪查詢
- 串流介面設為英文、或設定 TMDB key 時覆蓋率最佳（OMDb 以英文片名為主）
- Hover / billboard 的年份會帶入 OMDb 查詢，消除同名不同年的誤判
- 部分影片無 Metacritic 評分

## 權限說明

| 權限 | 用途 |
|------|------|
| `storage` | API key、評分快取、清單與偏好設定（全部存在本機，不會外送） |
| `tabs` + `scripting` | 開背景分頁通過 IMDb 的機器人驗證，以及同步 Netflix 觀看紀錄；兩者都會自動關閉 |
| `alarms` | 每週的清單自動更新 |
| `netflix.com`、`disneyplus.com` | 顯示徽章的頁面 |
| `omdbapi.com`、`api.themoviedb.org` | 查詢評分 |
| `imdb.com`、`letterboxd.com` | 載入你貼進過濾器的清單 |

## 1.3 版更新

- **TMDB 當主資料來源** — 瀏覽時不消耗 OMDb 額度，只有展開的卡片才會呼叫 OMDb
- **分數門檻過濾** — 低於門檻的片淡化或隱藏
- **OMDb 額度儀表** — 撞到上限前就看得到今天用了多少
- **Letterboxd 清單** — 清單、watchlist 與「看過的全部影片」，與 IMDb 清單並行
- **清單每週自動更新**
- **掃描更快** — 只重掃有變動的頁面區塊，量測版面改到瀏覽器閒置時進行
- **測試套件** — `npm test` 直接對出貨用的程式碼跑模擬瀏覽器測試

## 開發

沒有 build step，純 JS/CSS，改完直接在 `chrome://extensions/` 重新載入即可。

```bash
npm install   # 只為了測試用的 jsdom
npm test
```

測試會直接載入出貨用的 `background.js`、`content.js`、`popup.js`（不做任何改寫），搭配假的 `chrome.*` 與 jsdom 頁面，涵蓋卡片偵測、徽章落點、資料來源順序、額度計算、清單解析與各種過濾。`tests/` 與 `node_modules/` 都不屬於擴充功能本體。
