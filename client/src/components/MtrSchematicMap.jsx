import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api.js';
import { findRoute } from '../mtrTransfer.js';
import { SCHEMATIC, elbow } from '../mtrSchematic.js';

const CELL = 9;           // 每格像素
const PAD = 40;

// 由示意圖格座標算出畫布尺寸
const xs = Object.values(SCHEMATIC).map(p => p[0]);
const ys = Object.values(SCHEMATIC).map(p => p[1]);
const MINX = Math.min(...xs), MAXX = Math.max(...xs);
const MINY = Math.min(...ys), MAXY = Math.max(...ys);
const W = (MAXX - MINX) * CELL + PAD * 2;
const H = (MAXY - MINY) * CELL + PAD * 2;

const px = (p) => [PAD + (p[0] - MINX) * CELL, PAD + (p[1] - MINY) * CELL];

// 標籤朝向：依該站在圖上的位置決定文字放左還是放右，避免壓線
function labelSide(code) {
  const [x] = SCHEMATIC[code];
  return x > (MINX + MAXX) / 2 ? 1 : -1;
}

export default function MtrSchematicMap() {
  const [lines, setLines] = useState([]);
  const [sel, setSel] = useState({ from: '', to: '' });
  const { from, to } = sel;
  const [hover, setHover] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, w: W, h: H });
  const drag = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => { api.mtrLines().then(setLines).catch(() => setLines([])); }, []);

  const nameOf = useMemo(() => {
    const m = {};
    lines.forEach(l => l.stations.forEach(([c, n]) => { m[c] = n; }));
    return m;
  }, [lines]);

  const lineCount = useMemo(() => {
    const m = {};
    lines.forEach(l => l.stations.forEach(([c]) => { m[c] = (m[c] || 0) + 1; }));
    return m;
  }, [lines]);

  const plan = useMemo(() => {
    if (!from || !to || from === to || !lines.length) return null;
    return findRoute(lines, from, to);
  }, [from, to, lines]);

  const routeSet = useMemo(() => {
    if (!plan) return { stations: new Set(), edges: new Set() };
    const stations = new Set(), edges = new Set();
    plan.segments.forEach(seg => {
      const codes = seg.stationCodes || [];
      codes.forEach((c, k) => {
        stations.add(c);
        if (k < codes.length - 1) edges.add(`${seg.lineCode}|${[c, codes[k + 1]].sort().join('-')}`);
      });
    });
    return { stations, edges };
  }, [plan]);

  const pick = (code) => {
    setSel((s) => {
      if (!s.from) return { from: code, to: '' };
      if (s.from === code) return { from: '', to: '' };
      if (s.to) return { from: code, to: '' };
      return { from: s.from, to: code };
    });
  };

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

  const zoomed = view.w < W * 0.8;
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
        {!lines.length && <div className="map-overlay">載入路線圖…</div>}
        {!!lines.length && (
          <svg
            ref={svgRef}
            className="mtrmap mtrmap--schematic"
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            role="img"
            aria-label="香港港鐵示意路線圖，可點選車站規劃路線"
            onWheel={onWheel}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
          >
            {/* 路線：每段以 elbow 拆成直線＋45°斜線 */}
            {lines.map(l => {
              const st = l.stations.map(s => s[0]).filter(c => SCHEMATIC[c]);
              return st.slice(0, -1).map((c, i) => {
                const next = st[i + 1];
                const key = `${l.code}|${[c, next].sort().join('-')}`;
                const on = routeSet.edges.has(key);
                const pts = elbow(SCHEMATIC[c], SCHEMATIC[next]).map(px);
                return (
                  <polyline key={key}
                    points={pts.map(p => p.join(',')).join(' ')}
                    fill="none"
                    stroke={l.color}
                    strokeWidth={on ? 9 : 5}
                    strokeOpacity={plan ? (on ? 1 : 0.15) : 0.9}
                    strokeLinecap="round"
                    strokeLinejoin="round" />
                );
              });
            })}

            {/* 車站 */}
            {Object.keys(nameOf).filter(c => SCHEMATIC[c]).map(code => {
              const [x, y] = px(SCHEMATIC[code]);
              const inRoute = routeSet.stations.has(code);
              const isEnd = code === from || code === to;
              const interchange = lineCount[code] > 1;
              const dim = plan && !inRoute;
              const side = labelSide(code);
              return (
                <g key={code} className="mtrmap__sta" data-code={code}
                  role="button" tabIndex={0}
                  aria-label={`${nameOf[code]}${interchange ? '（轉車站）' : ''}`}
                  onClick={() => pick(code)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(code); } }}
                  onMouseEnter={() => setHover(code)}
                  onMouseLeave={() => setHover(null)}>
                  <circle cx={x} cy={y} r={13} fill="transparent" />
                  <circle
                    cx={x} cy={y}
                    r={isEnd ? 9 : interchange ? 7 : 4.5}
                    fill={isEnd ? '#0F172A' : '#FFFFFF'}
                    stroke={isEnd ? '#0F172A' : '#334155'}
                    strokeWidth={isEnd ? 3 : interchange ? 2.6 : 2}
                    opacity={dim ? 0.22 : 1} />
                  {isEnd && <circle cx={x} cy={y} r={3.4} fill="#fff" />}
                  {showLabel(code) && (
                    <text
                      className={`mtrmap__label ${isEnd ? 'is-end' : ''}`}
                      x={x + side * 12}
                      y={y + 4}
                      textAnchor={side > 0 ? 'start' : 'end'}
                      opacity={dim ? 0.22 : 1}>{nameOf[code]}</text>
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
        此為<strong>示意圖</strong>，站點位置經簡化排列，不代表實際地理位置與距離。
        時間為粗估（每站約 3 分鐘、每次轉車約 5 分鐘）。滾輪縮放、拖曳平移。
      </p>
    </section>
  );
}
