import { CONFIG, MTR_LINES, MTR_STATION_NAMES, LRT_STATIONS } from '../config.js';

const j = (u) => fetch(u).then(r => r.json()).catch(() => null);
const demoRoutes = (op) => ({
  citybus: [
    { route: '1', orig: '摩星嶺', dest: '跑馬地(上)' },
    { route: '6', orig: '赤柱市場', dest: '中環(交易廣場)' },
    { route: '720', orig: '太古城', dest: '中環(港澳碼頭)' }
  ],
  kmb: [
    { route: '1A', orig: '竹園邨', dest: '尖沙咀碼頭' },
    { route: '6C', orig: '九龍城碼頭', dest: '美孚' },
    { route: '104', orig: '白田', dest: '堅尼地城' }
  ]
}[op] || []);

// 路線清單
export async function getRoutes(op) {
  if (op === 'mtr') return { source: 'static', lines: MTR_LINES };
  try {
    if (op === 'citybus') {
      const res = await j(`${CONFIG.transport.citybus.baseUrl}/route/${CONFIG.transport.citybus.company}/`);
      const data = (res?.data || []).map(r => ({
        route: r.route, orig: r.orig_tc || r.orig_en || '', dest: r.dest_tc || r.dest_en || ''
      }));
      if (!data.length) return { source: 'demo', routes: demoRoutes(op) };
      return { source: 'live', routes: data };
    }
    if (op === 'kmb') {
      // 官方 dataset hk-td-tis_21-etakmb：路線列表 GET /route/
      const res = await j(`${CONFIG.transport.kmb.baseUrl}/route/`);
      const list = res?.data || [];
      if (!list.length) return { source: 'demo', routes: demoRoutes(op) };
      // 只取 service_type=1（正常班次），並以 route+bound 去重（O=去程優先顯示）
      const seen = new Set();
      const data = [];
      for (const r of list) {
        if (String(r.service_type) !== '1' || r.bound !== 'O') continue;
        if (seen.has(r.route)) continue;
        seen.add(r.route);
        data.push({ route: r.route, orig: r.orig_tc || '', dest: r.dest_tc || '' });
      }
      return { source: 'live', routes: data };
    }
  } catch (err) {
    console.error(`[transport] ${op} 路線失敗:`, err.message);
  }
  return { source: 'demo', routes: demoRoutes(op) };
}

// 站點清單（巴士路線）
export async function getStops(op, route, dir) {
  const bound = dir === 'inbound' ? 'inbound' : 'outbound';
  try {
    if (op === 'citybus') {
      const res = await j(`${CONFIG.transport.citybus.baseUrl}/route-stop/${CONFIG.transport.citybus.company}/${encodeURIComponent(route)}/${bound}/`);
      const ids = (res?.data || []).map(d => d.stop).filter(Boolean);
      const stops = await Promise.all(ids.slice(0, 40).map(async id => {
        const s = await j(`${CONFIG.transport.citybus.baseUrl}/stop/${id}`);
        return { id, name: s?.data?.name_tc || id };
      }));
      return { source: 'live', stops };
    }
    if (op === 'kmb') {
      // 官方 dataset：GET /route-stop/{route}/{bound}/{service_type}
      const res = await j(`${CONFIG.transport.kmb.baseUrl}/route-stop/${encodeURIComponent(route)}/${bound}/1`);
      const ids = (res?.data || []).map(d => d.stop).filter(Boolean);
      const stops = await Promise.all(ids.slice(0, 40).map(async id => {
        const s = await j(`${CONFIG.transport.kmb.baseUrl}/stop/${id}`);
        return { id, name: s?.data?.name_tc || id };
      }));
      return { source: 'live', stops };
    }
  } catch (err) {
    console.error(`[transport] ${op} 站點失敗:`, err.message);
  }
  return { source: 'demo', stops: demoStops(route) };
}

// 抵達時間
export async function getEta(op, route, dir, stopId, mtrMode, line) {
  // MTR 重鐵：Next Train API（官方 dataset mtr-data2-nexttrain-data）
  if (op === 'mtr' && mtrMode === 'heavy') {
    try {
      const res = await j(`${CONFIG.transport.mtrHeavy.baseUrl}?line=${encodeURIComponent(line)}&sta=${encodeURIComponent(stopId)}&lang=TC`);
      const key = `${line}-${stopId}`;
      const d = res?.data?.[key];
      if (!d) return { source: 'error', etas: [] };
      const rows = [];
      for (const [dirKey, label] of [['UP', '上行'], ['DOWN', '下行']]) {
        const lineColor = MTR_LINES.find(l => l.code === line)?.color || '';
        for (const t of (d[dirKey] || [])) {
          rows.push({
            route: label,
            dir: dirKey,
            dest: MTR_STATION_NAMES[t.dest] || t.dest,
            mins: t.ttnt !== undefined ? Math.max(0, Math.round(parseInt(t.ttnt, 10) / 60)) : parseEta(t.time),
            remark: t.plat ? `${t.plat} 號月台` : '',
            color: lineColor
          });
        }
      }
      rows.sort((a, b) => (a.mins ?? 99) - (b.mins ?? 99));
      return { source: 'live', etas: rows.slice(0, 8) };
    } catch (err) {
      console.error('[transport] MTR 重鐵到站失敗:', err.message);
      return { source: 'error', etas: [] };
    }
  }
  // MTR 輕鐵：即時
  if (op === 'mtr' && mtrMode === 'lrt') {
    try {
      const res = await j(`${CONFIG.transport.mtrLrt.baseUrl}/getSchedule?station_id=${encodeURIComponent(stopId)}&language=TC`);
      const set = new Map();
      (res?.platform_list || []).forEach(p => (p.route_list || []).forEach(rt => {
        if (!set.has(rt.route_no + rt.dest_ch)) set.set(rt.route_no + rt.dest_ch, rt);
      }));
      const etas = [...set.values()].map(rt => ({
        route: rt.route_no,
        dest: rt.dest_ch || rt.dest_en,
        mins: parseMins(rt.time_ch || rt.time_en),
        remark: rt.special ? '特別班次' : '',
        dir: ''
      }));
      return { source: 'live', etas };
    } catch (err) {
      console.error('[transport] LRT 到站失敗:', err.message);
      return { source: 'error', etas: [] };
    }
  }
  // 巴士 ETA
  try {
    if (op === 'citybus') {
      const res = await j(`${CONFIG.transport.citybus.baseUrl}/eta/${CONFIG.transport.citybus.company}/${encodeURIComponent(stopId)}/${encodeURIComponent(route)}/`);
      const etas = (res?.data || []).filter(d => d.eta).map(d => ({
        route: d.route, dest: d.dest_tc || d.dest_en, mins: parseEta(d.eta), remark: d.rmk_tc || '', dir: (d.dir === 'I' ? '回程' : '去程')
      }));
      return { source: 'live', etas };
    }
    if (op === 'kmb') {
      // 官方 dataset：GET /eta/{stop_id}/{route}/{service_type}
      const res = await j(`${CONFIG.transport.kmb.baseUrl}/eta/${encodeURIComponent(stopId)}/${encodeURIComponent(route)}/1`);
      const wantDir = dir === 'inbound' ? 'I' : 'O';
      const etas = (res?.data || [])
        .filter(d => d.eta && d.dir === wantDir)
        .map(d => ({
          route: d.route, dest: d.dest_tc || d.dest_en, mins: parseEta(d.eta), remark: d.rmk_tc || '', dir: (d.dir === 'I' ? '回程' : '去程')
        }));
      return { source: 'live', etas };
    }
  } catch (err) {
    console.error(`[transport] ${op} 到站失敗:`, err.message);
  }
  return { source: 'demo', etas: demoEta(route) };
}

export function getMtrLines() { return MTR_LINES; }
export function getLrtStations() { return LRT_STATIONS; }

function parseEta(iso) {
  if (!iso) return null;
  const t = new Date(String(iso).replace(' ', 'T')).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.round((t - Date.now()) / 60000));
}
function parseMins(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
function demoStops(route) {
  return Array.from({ length: 6 }, (_, i) => ({ id: `S${i}`, name: `${route} 號路線 第 ${i + 1} 站` }));
}
function demoEta(route) {
  const base = Math.floor(Math.random() * 8) + 1;
  return [
    { route, dest: '終點站', mins: base, remark: '', dir: '' },
    { route, dest: '終點站', mins: base + 8, remark: '', dir: '' },
    { route, dest: '終點站', mins: base + 17, remark: '班次較疏', dir: '' }
  ];
}
