// 港鐵轉車建議：以 (車站, 線路) 為狀態的最短路徑搜尋
// 優先順序：轉車次數最少 → 經過車站數最少
export function findRoute(lines, fromSta, toSta) {
  if (!fromSta || !toSta || fromSta === toSta) return null;

  // 建立：每條線的站序（雙向）
  // state key: `${sta}|${lineCode}`
  const adj = new Map(); // key -> [{ sta, line, isTransfer }]
  const linesBySta = new Map(); // sta -> Set(lineCode)

  for (const l of lines) {
    const st = l.stations.map(s => s[0]);
    st.forEach((sta, i) => {
      if (!linesBySta.has(sta)) linesBySta.set(sta, new Set());
      linesBySta.get(sta).add(l.code);
      const key = `${sta}|${l.code}`;
      if (!adj.has(key)) adj.set(key, []);
      if (i > 0) adj.get(key).push({ sta: st[i - 1], line: l.code, isTransfer: false });
      if (i < st.length - 1) adj.get(key).push({ sta: st[i + 1], line: l.code, isTransfer: false });
    });
  }
  // 同站轉線邊
  for (const [sta, lineSet] of linesBySta) {
    const arr = [...lineSet];
    for (const a of arr) for (const b of arr) {
      if (a !== b) adj.get(`${sta}|${a}`).push({ sta, line: b, isTransfer: true });
    }
  }

  if (!linesBySta.has(fromSta) || !linesBySta.has(toSta)) return null;

  // Dijkstra：cost = transfers * 1000 + stops
  const dist = new Map();
  const prev = new Map();
  const pq = []; // [cost, key]
  for (const l of linesBySta.get(fromSta)) {
    const k = `${fromSta}|${l}`;
    dist.set(k, 0);
    pq.push([0, k]);
  }
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [cost, key] = pq.shift();
    if (cost > (dist.get(key) ?? Infinity)) continue;
    const [sta] = key.split('|');
    if (sta === toSta) continue; // 到達也可能有其他更優路徑，繼續處理但不擴展
    for (const nb of adj.get(key) || []) {
      const nk = `${nb.sta}|${nb.line}`;
      const nc = cost + (nb.isTransfer ? 1000 : 1);
      if (nc < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nc);
        prev.set(nk, key);
        pq.push([nc, nk]);
      }
    }
  }

  // 找到目的站成本最低的 (sta,line) 狀態
  let best = null;
  for (const l of linesBySta.get(toSta)) {
    const k = `${toSta}|${l}`;
    if (dist.has(k) && (best === null || dist.get(k) < dist.get(best))) best = k;
  }
  if (!best) return null;

  // 回溯路徑
  const path = [];
  let cur = best;
  while (cur) { path.unshift(cur); cur = prev.get(cur); }

  // 壓縮為線路分段
  const lineMap = Object.fromEntries(lines.map(l => [l.code, l]));
  const nameMap = Object.fromEntries(lines.flatMap(l => l.stations));
  const segs = [];
  for (const key of path) {
    const [sta, line] = key.split('|');
    const last = segs[segs.length - 1];
    if (last && last.line === line) {
      if (last.stations[last.stations.length - 1] !== sta) last.stations.push(sta);
    } else {
      // 轉線：同站不同線 → 新分段由該站開始
      segs.push({ line, stations: [sta] });
    }
  }
  // 移除只有 1 站且非起點的偽分段（轉線邊產生）
  const cleaned = segs.filter((s, i) => s.stations.length > 1 || i === 0);
  if (!cleaned.length) return null;

  const totalStops = cleaned.reduce((n, s) => n + Math.max(0, s.stations.length - 1), 0);
  return {
    transfers: cleaned.length - 1,
    totalStops,
    est: totalStops * 3 + (cleaned.length - 1) * 5, // 粗估：每站3分鐘+每次轉車5分鐘
    segments: cleaned.map(s => ({
      lineCode: s.line,
      lineName: lineMap[s.line]?.name || s.line,
      color: lineMap[s.line]?.color || '#2563EB',
      fromCode: s.stations[0],
      toCode: s.stations[s.stations.length - 1],
      stationCodes: s.stations.slice(),
      from: nameMap[s.stations[0]] || s.stations[0],
      to: nameMap[s.stations[s.stations.length - 1]] || s.stations[s.stations.length - 1],
      stops: Math.max(0, s.stations.length - 1)
    }))
  };
}
