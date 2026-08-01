import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api.js';
import { findRoute } from '../mtrTransfer.js';

const W = 1000, H = 700, PAD = 46;

// 以經緯度線性投影（香港範圍小，誤差可忽略），緯度依 cos 修正
function project(geo) {
  const pts = Object.values(geo);
  if (!pts.length) return null;
  const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const k = Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
  const spanX = (maxLng - minLng) * k, spanY = maxLat - minLat;
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const offX = (W - spanX * scale) / 2, offY = (H - spanY * scale) / 2;
  const out = {};
  for (const [code, [lat, lng]] of Object.entries(geo)) {
    out[code] = {
      x: offX + (lng - minLng) * k * scale,
      y: offY + (maxLat - lat) * scale
    };
  }
  return out;
}

export default function MtrMapCard() {
  const [lines, setLines] = useState([]);
  const [geo, setGeo] = useState(null);
  const [sel, setSel] = useState({ from: '', to: '' });
  const { from, to } = sel;
  const [hover, setHover] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, w: W, h: H });
  const drag = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => {
    api.mtrLines().then(setLines).catch(() => setLines([]));
    api.mtrGeo().then(setGeo).catch(() => setGeo(null));
  }, []);

  const pos = useMemo(() => (geo ? project(geo) : null), [geo]);

  const nameOf = useMemo(() => {
    const m = {};
    lines.forEach(l => l.stations.forEach(([c, n]) => { m[c] = n; }));
    return m;
  }, [lines]);

  // 每站經過幾條線 → 判斷轉車站
  const lineCount = useMemo(() => {
    const m = {};
    lines.forEach(l => l.stations.forEach(([c]) => { m[c] = (m[c] || 0) + 1; }));
    return m;
  }, [lines]);

  const plan = useMemo(() => {
    if (!from || !to || from === to || !lines.length) return null;
    return findRoute(lines, from, to);
  }, [from, to, lines]);

  // 路線上經過的站與路段（用於高亮）
  const routeSet = useMemo(() => {
    if (!plan) return { stations: new Set(), edges: new Set() };
    const stations = new Set(), edges = new Set();
    plan.segments.forEach(seg => {
      const codes = seg.stationCodes || [];
      codes.forEach((c, k) => {
        stations.add(c);
        if (k < codes.length - 1) {
          edges.add(`${seg.lineCode}|${[c, codes[k + 1]].sort().join('-')}`);
        }
      });
    });
    return { stations, edges };
  }, [plan]);

  // 一次一個 state，避免同一輪 render 內連續點選讀到舊值
  const pick = (code) => {
    setSel((s) => {
      if (!s.from) return { from: code, to: '' };        // 選出發站
      if (s.from === code) return { from: '', to: '' };  // 再點一次＝取消
      if (s.to) return { from: code, to: '' };           // 已完成 → 重新開始
      return { from: s.from, to: code };                 // 選目的站
    });
  };

  // 平移 / 縮放
  const onWheel = (e) => {
    e.preventDefault();
    const f = e.deltaY > 0 ? 1.15 : 0.87;
    setView(v => {
      const w = Math.min(W, Math.max(W * 0.25, v.w * f));
      const h = w * (H / W);
      return { x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2, w, h };
    });
  };
  const onDown = (e) => { drag.current = { px: e.clientX, py: e.clientY, ...view }; };
  const onMove = (e) => {
    if (!drag.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = drag.current.w / rect.width, sy = drag.current.h / rect.height;
    setView({
      x: drag.current.x - (e.clientX - drag.current.px) * sx,
      y: drag.current.y - (e.clientY - drag.current.py) * sy,
      w: drag.current.w, h: drag.current.h
    });
  };
  const onUp = () => { drag.current = null; };
  const reset = () => setView({ x: 0, y: 0, w: W, h: H });

  const zoomed = view.w < W * 0.85;
  const showLabel = (code) =>
    code === from || code === to || code === hover ||
    routeSet.stations.has(code) || lineCount[code] > 1 || zoomed;

  return (
    <section className="card card--mtrmap">
      <div className="card__head">
        <h2>港鐵路線圖 · 最快路線</h2>
        <span className="card__badge">{from && !to ? '再點選目的站' : from ? '已選定' : '點選出發站'}</span>
      </div>

      <div className="mtrmap-picks">
        <button type="button" className={`pick ${from ? 'is-set' : ''}`} onClick={() => setSel({ from: '', to: '' })}>
          <span className="pick__label">出發</span>
          <span className="pick__value">{from ? nameOf[from] : '在圖上點選'}</span>
        </button>
        <button type="button" className="pick__swap" aria-label="交換起訖站"
          onClick={() => setSel((s) => ({ from: s.to, to: s.from }))}>⇄</button>
        <button type="button" className={`pick ${to ? 'is-set' : ''}`} onClick={() => setSel((s) => ({ ...s, to: '' }))}>
          <span className="pick__label">目的地</span>
          <span className="pick__value">{to ? nameOf[to] : '在圖上點選'}</span>
        </button>
        <button type="button" className="pick__reset" onClick={reset}>重置檢視</button>
      </div>

      <div className="mtrmap-wrap">
        {!pos && <div className="map-overlay">載入路線圖…</div>}
        {pos && (
          <svg
            ref={svgRef}
            className="mtrmap"
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            role="img"
            aria-label="香港港鐵路線圖，可點選車站"
            onWheel={onWheel}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
          >
            {/* 路段 */}
            {lines.map(l => {
              const codes = l.stations.map(s => s[0]).filter(c => pos[c]);
              return codes.slice(0, -1).map((c, i) => {
                const a = pos[c], b = pos[codes[i + 1]];
                const key = `${l.code}|${[c, codes[i + 1]].sort().join('-')}`;
                const on = routeSet.edges.has(key);
                return (
                  <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={l.color}
                    strokeWidth={on ? 7 : 3.2}
                    strokeOpacity={plan ? (on ? 1 : 0.18) : 0.85}
                    strokeLinecap="round" />
                );
              });
            })}

            {/* 車站 */}
            {Object.keys(nameOf).filter(c => pos[c]).map(code => {
              const p = pos[code];
              const inRoute = routeSet.stations.has(code);
              const isEnd = code === from || code === to;
              const interchange = lineCount[code] > 1;
              const dim = plan && !inRoute;
              return (
                <g key={code} className="mtrmap__sta" data-code={code}
                  role="button" tabIndex={0}
                  aria-label={`${nameOf[code]}${interchange ? '（轉車站）' : ''}`}
                  onClick={() => pick(code)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(code); } }}
                  onMouseEnter={() => setHover(code)}
                  onMouseLeave={() => setHover(null)}>
                  <circle cx={p.x} cy={p.y} r={11} fill="transparent" />
                  <circle
                    cx={p.x} cy={p.y}
                    r={isEnd ? 8 : interchange ? 5.5 : 3.8}
                    fill={isEnd ? '#0F172A' : '#FFFFFF'}
                    stroke={isEnd ? '#0F172A' : '#334155'}
                    strokeWidth={isEnd ? 3 : interchange ? 2.2 : 1.6}
                    opacity={dim ? 0.25 : 1} />
                  {isEnd && <circle cx={p.x} cy={p.y} r={3} fill="#fff" />}
                  {showLabel(code) && (
                    <text
                      className={`mtrmap__label ${isEnd ? 'is-end' : ''}`}
                      x={p.x + 9} y={p.y + 4}
                      opacity={dim ? 0.25 : 1}>{nameOf[code]}</text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {from && to && from === to && <div className="state-msg">出發站與目的站相同</div>}

      {plan && (
        <div className="transfer-plan">
          <div className="transfer-plan__summary">
            <span className="transfer-plan__stat"><strong>{plan.transfers}</strong> 次轉車</span>
            <span className="transfer-plan__stat"><strong>{plan.totalStops}</strong> 個站</span>
            <span className="transfer-plan__stat">約 <strong>{plan.est}</strong> 分鐘</span>
          </div>
          <div className="transfer-plan__segs">
            {plan.segments.map((s, i) => (
              <div className="transfer-seg" key={i} style={{ borderLeftColor: s.color }}>
                <span className="transfer-seg__badge" style={{ background: s.color }}>{s.lineName}</span>
                <div className="transfer-seg__info">
                  <div className="transfer-seg__route">{s.from} → {s.to}</div>
                  <div className="transfer-seg__meta">
                    {s.stops} 個站{i < plan.segments.length - 1 ? ` · 於 ${s.to} 轉車` : ' · 到達'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="card__hint">
        時間為粗估（每站約 3 分鐘、每次轉車約 5 分鐘）。站點座標來自 OpenStreetMap（ODbL），位置依實際地理繪製。滾輪縮放、拖曳平移。
      </p>
    </section>
  );
}
