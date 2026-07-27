// Vercel Serverless Function 入口
// Vercel 會自動把 /api/* 路由到本檔（api/index.js 代表整個 /api 命名空間）。
// req.url 會保留完整路徑（例如 /api/weather），Express app 內已定義對應路由，直接轉發即可。
import { app } from '../server/src/index.js';

export default app;
