# Netflix Rating Overlay 🎬

Display **IMDb**, **Rotten Tomatoes**, and **Metacritic** scores directly on Netflix browse pages, overlaid on every title card.

## Installation

### 1. Get a Free OMDb API Key
Go to https://www.omdbapi.com/apikey.aspx and sign up for a free account.
(Free tier: 1,000 requests/day — plenty for normal use)

> **What is an OMDb API Key?**
> A free 8-character alphanumeric key (e.g. `a1b2c3d4`) sent to your email after registration. Click the activation link in the email before use.

### 2. Load the Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this folder (`netflix-ratings-extension`)

### 3. Set Your API Key
1. Click the extension icon 🧩 in the browser toolbar
2. Find "Netflix Rating Overlay" and click it
3. Paste your OMDb API Key and click Save

### 4. Start Browsing!
Go to Netflix — rating badges will automatically appear on title cards as you browse.

## Rating Sources

| Badge | Source | Format |
|-------|--------|--------|
| `IMDb` yellow logo | IMDb | Score out of 10 |
| 🍅 | Rotten Tomatoes | Tomatometer % |
| `M` yellow logo | Metacritic | Metascore out of 100 |

> All ratings are fetched via OMDb API, which aggregates IMDb, Rotten Tomatoes, and Metacritic data.

## Color Legend

| Color | Meaning | IMDb | Rotten Tomatoes | Metacritic |
|-------|---------|------|-----------------|------------|
| 🟢 Green | Great | ≥ 7.5 | ≥ 75% | ≥ 75 |
| 🟡 Yellow | OK | 6 – 7.4 | 60 – 74% | 50 – 74 |
| 🔴 Red | Poor | < 6 | < 60% | < 50 |

## Popup Features

- **API Status:** Real-time check of your OMDb API key status (working / limit reached / invalid)
- **Top 3 Ratings:** Shows the top 3 highest-rated titles from your scanned cache
  - Switch between IMDb, Rotten Tomatoes, and Metacritic as the ranking source (default: IMDb)
  - Skip any title to see the next one in line

## Notes
- Ratings are cached for 7 days to minimize API usage
- Some newer or less popular titles may not have ratings in OMDb
- Metacritic scores are not available for all titles
- Netflix interface must be set to English for best coverage (OMDb indexes English titles)

---

# 中文說明

在 Netflix 瀏覽頁面的每部影片旁顯示 **IMDb**、**Rotten Tomatoes** 與 **Metacritic** 評分。

## 安裝步驟

### 1. 取得免費 OMDb API Key
前往 https://www.omdbapi.com/apikey.aspx 申請免費帳號
（免費版每天 1,000 次查詢，一般使用完全足夠）

> **什麼是 OMDb API Key？**
> 註冊後會寄到你的 Email，是一組 8 碼英數字（例如 `a1b2c3d4`）。收到信後需點擊啟用連結才能使用。

### 2. 載入擴充功能
1. 開啟 Chrome，網址列輸入：`chrome://extensions/`
2. 右上角開啟「**開發人員模式**」
3. 點擊「**載入未封裝項目**」
4. 選擇此資料夾（`netflix-ratings-extension`）

### 3. 設定 API Key
1. 點擊瀏覽器右上角的擴充功能圖示 🧩
2. 找到「Netflix Rating Overlay」，點擊
3. 貼上你的 OMDb API Key，點「儲存」

### 4. 開始使用！
前往 Netflix，瀏覽任何影片列表，評分徽章會自動出現在片名下方。

## 顯示來源

| 圖示 | 來源 | 說明 |
|------|------|------|
| `IMDb` 黃底黑字 | IMDb | 10 分制評分 |
| 🍅 | Rotten Tomatoes | 百分比（Tomatometer） |
| `M` 黃底黑字 | Metacritic | 百分制（Metascore） |

> 三個評分均來自 OMDb API，OMDb 整合了 IMDb、Rotten Tomatoes 與 Metacritic 資料。

## 評分顏色說明

| 顏色 | 意義 | IMDb | Rotten Tomatoes | Metacritic |
|------|------|------|-----------------|------------|
| 🟢 綠色 | 優秀 | ≥ 7.5 | ≥ 75% | ≥ 75 |
| 🟡 黃色 | 普通 | 6 – 7.4 | 60 – 74% | 50 – 74 |
| 🔴 紅色 | 較差 | < 6 | < 60% | < 50 |

## Popup 功能

- **API 狀態**：即時檢測 OMDb API Key 狀態（正常 / 已達上限 / 無效）
- **Top 3 評分排行**：顯示目前已掃描影片中分數最高的前 3 名
  - 可切換 IMDb、Rotten Tomatoes、Metacritic 作為排序來源（預設 IMDb）
  - 可跳過任一影片，由下一順位遞補

## 注意事項
- 評分資料來自 OMDb API（整合 IMDb、Rotten Tomatoes、Metacritic）
- 查詢結果會快取 7 天，避免重複消耗 API 配額
- 部分較新或冷門的片子可能找不到評分
- Metacritic 評分若 OMDb 未收錄則不顯示（非所有影片皆有）
