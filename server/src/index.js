import express from 'express';
import { CONFIG } from './config.js';
import { getWeather, getTempHistory, getRegionalTemp } from './providers/hko.js';
import { getTraffic } from './providers/traffic.js';
import {
  getRoutes, getStops, getEta, getMtrLines, getLrtStations
} from './providers/transport.js';

const app = express();

// CORS：允許前端跨域請求
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const ok = (res, data) => res.json(data);
const fail = (res, err, fallback) => {
  if (fallback) return res.json(fallback);
  res.status(502).json({ error: String(err?.message || err) });
};

// 天氣
app.get('/api/weather', async (req, res) => {
  try { ok(res, await getWeather()); }
  catch (e) { fail(res, e, CONFIG.demo ? null : undefined); }
});

// 天氣：每日氣溫走勢（最高/平均/最低）
app.get('/api/weather/temphistory', async (req, res) => {
  try { ok(res, await getTempHistory(30)); }
  catch (e) { fail(res, e); }
});

// 天氣：分區即時氣溫（最新一分鐘平均）
app.get('/api/weather/regional-temp', async (req, res) => {
  try { ok(res, await getRegionalTemp()); }
  catch (e) { fail(res, e); }
});

// 交通
app.get('/api/traffic', async (req, res) => {
  try { ok(res, await getTraffic()); }
  catch (e) { fail(res, e, CONFIG.demo ? null : undefined); }
});

// 運輸：路線清單
app.get('/api/transport/:op/routes', async (req, res) => {
  try { ok(res, await getRoutes(req.params.op)); }
  catch (e) { fail(res, e); }
});

// 運輸：站點清單
app.get('/api/transport/:op/stops', async (req, res) => {
  const { route, dir = 'outbound' } = req.query;
  if (!route) return res.status(400).json({ error: 'route 必填' });
  try { ok(res, await getStops(req.params.op, route, dir)); }
  catch (e) { fail(res, e); }
});

// 運輸：抵達時間
app.get('/api/transport/:op/eta', async (req, res) => {
  const { route, dir = 'outbound', stop, mode, line } = req.query;
  if (!stop) return res.status(400).json({ error: 'stop 必填' });
  try { ok(res, await getEta(req.params.op, route, dir, stop, mode, line)); }
  catch (e) { fail(res, e); }
});

// 港鐵靜態資料
app.get('/api/mtr/lines', (req, res) => ok(res, getMtrLines()));
app.get('/api/mtr/lrt-stations', (req, res) => ok(res, getLrtStations()));

// 健康檢查
app.get('/api/health', (req, res) => ok(res, { ok: true, demo: CONFIG.demo }));

// 提供前端靜態檔案（assets 目錄）
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
const __dirname = dirname(fileURLToPath(import.meta.url));

// assets 目錄
const assetsDir = join(__dirname, '../../assets');
app.use(express.static(assetsDir));

// 產品靜態檔（build 後由 client 提供）
const clientDist = join(__dirname, '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// 本地開發才啟動監聽；Vercel Serverless Function 環境由 api/index.js 匯入 app，不在此 listen
if (!process.env.VERCEL) {
  app.listen(CONFIG.port, () => {
    console.log(`[hk-life] API server 啟動： http://localhost:${CONFIG.port}  (demo=${CONFIG.demo})`);
  });
}

// 匯出 app 供 Vercel Serverless Function（api/index.js）直接使用
export { app };