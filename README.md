# Netflix Rating Overlay 🎬

在 Netflix 瀏覽頁面的每部影片旁顯示 **IMDb**、**Rotten Tomatoes** 與 **Metacritic** 評分。

## 安裝步驟

### 1. 取得免費 OMDb API Key
前往 https://www.omdbapi.com/apikey.aspx 申請免費帳號
（免費版每天 1,000 次查詢，一般使用完全足夠）

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

## 注意事項
- 評分資料來自 OMDb API（整合 IMDb、Rotten Tomatoes、Metacritic）
- 查詢結果會快取 7 天，避免重複消耗 API 配額
- 部分較新或冷門的片子可能找不到評分
- Metacritic 評分若 OMDb 未收錄則不顯示（非所有影片皆有）
