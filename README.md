# 香港生活資訊 (HK Life)

香港即時生活資訊儀表板：**天氣預報 · 交通情況 · 城巴/九巴/港鐵即時運輸查詢**。

採用 **React + Node.js (Express)** 架構，前端 SPA 透過 Node 後端代理並標準化香港政府開放 API（香港天文台、DATA.GOV.HK），解決瀏覽器 CORS 問題並加上快取與降級。

## 架構

```
HK_life/
├── server/                # Node.js + Express 後端 API
│   ├── src/
│   │   ├── index.js       # Express server，掛載 /api 路由，build 後兼託管靜態檔
│   │   ├── config.js      # 端點設定 + 港鐵路線/輕鐵站靜態資料
│   │   └── providers/     # 各資料來源：hko / traffic / transport
│   └── package.json
├── client/                # React + Vite 前端 SPA
│   ├── src/
│   │   ├── App.jsx        # 主元件：資料狀態、重新整理、Modal 開關
│   │   ├── api.js         # 前端 fetch 封裝（打 /api）
│   │   ├── icons.jsx      # SVG 圖示（無 emoji）
│   │   ├── components/    # WeatherCard / TrafficCard / TransportCards / RouteModal
│   │   └── styles.css     # 設計系統（Bento Grid · Flat Touch-First）
│   ├── vite.config.js     # dev server + /api 代理到後端
│   └── package.json
└── package.json           # 根：concurrently 同時跑前後端
```

## 功能

- **天氣**：香港天文台即時觀測 + 九天預報（失敗自動降級示範資料）
- **交通**：DATA.GOV.HK 交通事件/事故（失敗自動降級）
- **運輸詳細查詢**（點擊卡片展開）：
  - 城巴 / 九巴：路線清單 → 站點 → 即時抵達時間（真實開放 API）
  - 港鐵：重鐵路線資訊（靜態，無免費即時 API）+ 輕鐵即時到站（真實 API）
  - 抵達時間每 30 秒自動重新整理（含倒數徽章）
  - 搜尋路線、去程/回程切換、ESC / 點背景關閉、鍵盤可操作

## 本地開發

```bash
# 1. 安裝依賴（根目錄一次裝好前後端）
npm run install:all

# 2. 同時啟動後端 (3007) 與前端 (5173)
npm run dev
```

開啟 http://localhost:5173

> 個別啟動：
> - 後端：`npm run server`（預設 port 3007，可用 `PORT=xxxx` 覆寫）
> - 前端：`npm run client`

## 生產建置

```bash
npm run build          # 打包前端到 client/dist
npm start              # 後端同時託管 API 與靜態檔，預設 http://localhost:3007
```

## 設定

`server/src/config.js` 集中管理所有外部 API 端點。`HK_DEMO=1` 可強制全部降級為示範資料（離線演示用）。

## 技術棧

- 前端：React 18 + Vite 5
- 後端：Node.js + Express 4（原生 `fetch`）
- 設計：CSS 變數設計系統，深色模式自動適應，響應式 Bento 網格
