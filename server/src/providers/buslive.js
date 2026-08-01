import { CONFIG } from '../config.js';

/*
 * 巴士「即時位置」推算
 *
 * 香港並無公開的巴士 GPS 位置 API。九巴／城巴只公開「各站預計抵達時間」。
 * 本模組由整條路線所有站的 ETA 反推每輛車目前所在路段：
 *   1. 依站序由小到大掃描，每站的 ETA 時間由早到晚排序。
 *   2. 第 j 早的 ETA 屬於前方第 j 輛車；某站出現比前一站更多的 ETA，
 *      代表有一輛新的車剛好在該站之前，於是建立新車輛。
 *   3. 車輛位置 = 它第一個有 ETA 的站的前一段路上，
 *      依「剩餘分鐘 ÷ 該路段行車時間」在兩站座標之間內插。
 * 因此位置為推算值，UI 必須標示「推算」而非宣稱 GPS 實測。
 */

const stopCache = new Map();   // stopId -> { name, lat, lng }
const routeCache = new Map();  // key -> { at, data }
const TTL = 20_000;

const jget = (u) => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null);

async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

async function kmbStop(id) {
  if (stopCache.has(`kmb:${id}`)) return stopCache.get(`kmb:${id}`);
  const s = await jget(`${CONFIG.transport.kmb.baseUrl}/stop/${id}`);
  const d = s?.data;
  if (!d?.lat) return null;
  const v = { name: d.name_tc || id, lat: +d.lat, lng: +d.long };
  stopCache.set(`kmb:${id}`, v);
  return v;
}

async function ctbStop(id) {
  if (stopCache.has(`ctb:${id}`)) return stopCache.get(`ctb:${id}`);
  const s = await jget(`${CONFIG.transport.citybus.baseUrl}/stop/${id}`);
  const d = s?.data;
  if (!d?.lat) return null;
  const v = { name: d.name_tc || id, lat: +d.lat, lng: +d.long };
  stopCache.set(`ctb:${id}`, v);
  return v;
}

// 取得帶座標的站序清單
async function getRouteStops(op, route, dir) {
  const bound = dir === 'inbound' ? 'inbound' : 'outbound';
  if (op === 'kmb') {
    const res = await jget(`${CONFIG.transport.kmb.baseUrl}/route-stop/${encodeURIComponent(route)}/${bound}/1`);
    const ids = (res?.data || []).map(d => d.stop);
    const stops = await pool(ids, 10, kmbStop);
    return stops.map((s, i) => (s ? { seq: i + 1, id: ids[i], ...s } : null)).filter(Boolean);
  }
  const res = await jget(`${CONFIG.transport.citybus.baseUrl}/route-stop/${CONFIG.transport.citybus.company}/${encodeURIComponent(route)}/${bound}/`);
  const ids = (res?.data || []).map(d => d.stop);
  const stops = await pool(ids, 10, ctbStop);
  return stops.map((s, i) => (s ? { seq: i + 1, id: ids[i], ...s } : null)).filter(Boolean);
}

// 取得整條路線每站的 ETA（毫秒時間戳陣列）
async function getRouteEtas(op, route, dir, stops) {
  const wantDir = dir === 'inbound' ? 'I' : 'O';
  const bySeq = new Map();
  if (op === 'kmb') {
    const res = await jget(`${CONFIG.transport.kmb.baseUrl}/route-eta/${encodeURIComponent(route)}/1`);
    for (const e of res?.data || []) {
      if (e.dir !== wantDir || !e.eta) continue;
      const t = Date.parse(e.eta);
      if (isNaN(t)) continue;
      const seq = Number(e.seq);
      if (!bySeq.has(seq)) bySeq.set(seq, []);
      bySeq.get(seq).push({ t, dest: e.dest_tc || e.dest_en || '', remark: e.rmk_tc || '' });
    }
    return bySeq;
  }
  // 城巴無整線 ETA，逐站查詢（併發 8，最多 60 站）
  const targets = stops.slice(0, 60);
  await pool(targets, 8, async (s) => {
    const res = await jget(`${CONFIG.transport.citybus.baseUrl}/eta/${CONFIG.transport.citybus.company}/${s.id}/${encodeURIComponent(route)}/`);
    for (const e of res?.data || []) {
      if (e.dir !== wantDir || !e.eta) continue;
      const t = Date.parse(e.eta);
      if (isNaN(t)) continue;
      if (!bySeq.has(s.seq)) bySeq.set(s.seq, []);
      bySeq.get(s.seq).push({ t, dest: e.dest_tc || e.dest_en || '', remark: e.rmk_tc || '' });
    }
  });
  return bySeq;
}

// 由各站 ETA 反推車輛
function inferVehicles(stops, bySeq) {
  const chains = []; // 每輛車：{ firstSeq, points: [{seq,t}], dest, remark }
  for (const s of stops) {
    const list = (bySeq.get(s.seq) || []).slice().sort((a, b) => a.t - b.t);
    list.forEach((e, j) => {
      if (j < chains.length) {
        chains[j].points.push({ seq: s.seq, t: e.t });
      } else {
        chains.push({ firstSeq: s.seq, points: [{ seq: s.seq, t: e.t }], dest: e.dest, remark: e.remark });
      }
    });
  }

  const bySeqStop = new Map(stops.map(s => [s.seq, s]));
  const now = Date.now();
  const out = [];

  chains.forEach((c, idx) => {
    const first = c.points[0];
    const target = bySeqStop.get(first.seq);
    if (!target) return;
    const prev = bySeqStop.get(first.seq - 1);
    const minsToNext = Math.max(0, (first.t - now) / 60000);

    // 該路段行車時間：用這輛車下一段的 ETA 差，否則預設 2 分鐘
    const nxt = c.points[1];
    const segMin = nxt ? Math.max(0.5, (nxt.t - first.t) / 60000) : 2;

    let lat, lng, progress;
    if (!prev) {
      // 尚在起點站（或起點前），直接放在首站
      lat = target.lat; lng = target.lng; progress = 1;
    } else {
      progress = Math.min(1, Math.max(0, 1 - minsToNext / segMin));
      lat = prev.lat + (target.lat - prev.lat) * progress;
      lng = prev.lng + (target.lng - prev.lng) * progress;
    }

    out.push({
      id: `v${idx + 1}`,
      order: idx + 1,
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
      progress: +progress.toFixed(2),
      nextStop: target.name,
      nextStopSeq: target.seq,
      prevStop: prev?.name || '起點站',
      minsToNext: Math.round(minsToNext),
      dest: c.dest,
      remark: c.remark
    });
  });

  return out;
}

export async function getBusLive(op, route, dir) {
  if (op !== 'kmb' && op !== 'citybus') {
    return { source: 'unsupported', reason: '此運輸商未提供路線位置資料', stops: [], vehicles: [] };
  }
  const key = `${op}|${route}|${dir}`;
  const hit = routeCache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;

  const stops = await getRouteStops(op, route, dir);
  if (!stops.length) {
    const data = { source: 'error', reason: '取不到此路線的站點座標', stops: [], vehicles: [] };
    routeCache.set(key, { at: Date.now(), data });
    return data;
  }
  const bySeq = await getRouteEtas(op, route, dir, stops);
  const vehicles = inferVehicles(stops, bySeq);
  const data = {
    source: 'live',
    method: 'eta-inferred',
    route,
    dir,
    updatedAt: new Date().toISOString(),
    stops: stops.map(s => ({ seq: s.seq, name: s.name, lat: s.lat, lng: s.lng })),
    vehicles
  };
  routeCache.set(key, { at: Date.now(), data });
  return data;
}
