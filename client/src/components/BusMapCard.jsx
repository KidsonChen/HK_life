import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api.js';

const OPS = [
  { key: 'kmb', label: '九巴', color: '#E60012' },
  { key: 'citybus', label: '城巴', color: '#00A0B0' }
];

const busIcon = (color, label) => L.divIcon({
  className: 'bus-marker',
  html: `<span class="bus-marker__pin" style="--pin:${color}"><span class="bus-marker__num">${label}</span></span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const stopIcon = L.divIcon({
  className: 'stop-marker',
  html: '<span class="stop-marker__dot"></span>',
  iconSize: [10, 10],
  iconAnchor: [5, 5]
});

export default function BusMapCard() {
  const [op, setOp] = useState('kmb');
  const [route, setRoute] = useState('968');
  const [input, setInput] = useState('968');
  const [dir, setDir] = useState('outbound');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ok | empty | error
  const [countdown, setCountdown] = useState(30);

  const mapEl = useRef(null);
  const map = useRef(null);
  const layers = useRef({ stops: null, line: null, buses: null });
  const fitted = useRef('');

  // 初始化地圖（一次）
  useEffect(() => {
    if (map.current || !mapEl.current) return;
    const m = L.map(mapEl.current, {
      center: [22.3193, 114.1694],
      zoom: 11,
      zoomControl: true,
      attributionControl: true
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(m);
    layers.current.stops = L.layerGroup().addTo(m);
    layers.current.line = L.layerGroup().addTo(m);
    layers.current.buses = L.layerGroup().addTo(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 200);
    return () => { m.remove(); map.current = null; };
  }, []);

  const load = useCallback(async () => {
    if (!route) return;
    setStatus((s) => (s === 'ok' ? 'ok' : 'loading'));
    try {
      const d = await api.busLive(op, route, dir);
      setData(d);
      setStatus(d.stops?.length ? (d.vehicles.length ? 'ok' : 'empty') : 'error');
      setCountdown(30);
    } catch {
      setStatus('error');
    }
  }, [op, route, dir]);

  useEffect(() => { load(); }, [load]);

  // 30 秒自動更新
  useEffect(() => {
    const t1 = setInterval(load, 30000);
    const t2 = setInterval(() => setCountdown(c => (c <= 1 ? 30 : c - 1)), 1000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [load]);

  // 繪製
  useEffect(() => {
    const m = map.current;
    if (!m || !data?.stops?.length) return;
    const color = OPS.find(o => o.key === op)?.color || '#2563EB';
    const { stops, line, buses } = layers.current;
    stops.clearLayers(); line.clearLayers(); buses.clearLayers();

    const pts = data.stops.map(s => [s.lat, s.lng]);
    L.polyline(pts, { color, weight: 4, opacity: .55 }).addTo(line);
    data.stops.forEach((s) => {
      L.marker([s.lat, s.lng], { icon: stopIcon })
        .bindPopup(`<b>${s.seq}. ${s.name}</b>`)
        .addTo(stops);
    });
    data.vehicles.forEach((v) => {
      L.marker([v.lat, v.lng], { icon: busIcon(color, v.order), zIndexOffset: 500 })
        .bindPopup(
          `<b>${route} · 第 ${v.order} 班</b><br/>往 ${v.dest || '—'}<br/>` +
          `下一站：${v.nextStop}<br/>約 ${v.minsToNext} 分鐘到站` +
          (v.remark ? `<br/><i>${v.remark}</i>` : '')
        )
        .addTo(buses);
    });

    const key = `${op}|${route}|${dir}`;
    if (fitted.current !== key) {
      m.fitBounds(L.latLngBounds(pts).pad(0.12));
      fitted.current = key;
    }
    setTimeout(() => m.invalidateSize(), 60);
  }, [data, op, route, dir]);

  const submit = (e) => {
    e.preventDefault();
    const v = input.trim().toUpperCase();
    if (v) setRoute(v);
  };

  return (
    <section className="card card--map">
      <div className="card__head">
        <h2>路線地圖 · 車輛位置</h2>
        <span className="card__badge">{countdown}s 後更新</span>
      </div>

      <form className="map-controls" onSubmit={submit}>
        <div className="seg" role="group" aria-label="營運商">
          {OPS.map(o => (
            <button key={o.key} type="button"
              className={`seg__btn ${op === o.key ? 'is-active' : ''}`}
              onClick={() => setOp(o.key)}>{o.label}</button>
          ))}
        </div>
        <label className="sr-only" htmlFor="map-route">路線編號</label>
        <input id="map-route" className="map-controls__input" value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="路線，例如 968" autoComplete="off" />
        <div className="seg" role="group" aria-label="方向">
          <button type="button" className={`seg__btn ${dir === 'outbound' ? 'is-active' : ''}`} onClick={() => setDir('outbound')}>去程</button>
          <button type="button" className={`seg__btn ${dir === 'inbound' ? 'is-active' : ''}`} onClick={() => setDir('inbound')}>回程</button>
        </div>
        <button type="submit" className="map-controls__go">查看</button>
      </form>

      <div className="map-wrap">
        <div ref={mapEl} className="map-canvas" />
        {status === 'loading' && <div className="map-overlay">載入 {route} 路線…</div>}
        {status === 'error' && <div className="map-overlay">取不到 {route} 的站點資料，換個路線編號試試。</div>}
      </div>

      <div className="map-legend">
        <span className="map-legend__item"><i className="dot dot--bus" style={{ background: OPS.find(o => o.key === op)?.color }} /> 行駛中車輛（{data?.vehicles?.length || 0}）</span>
        <span className="map-legend__item"><i className="dot dot--stop" /> 車站（{data?.stops?.length || 0}）</span>
      </div>

      {status === 'empty' && <div className="state-msg">此刻沒有班次在途，可能已收車或班次較疏。</div>}

      <p className="card__hint">
        位置由全線各站預計到站時間推算（香港未開放巴士 GPS 資料），為估算值而非實測座標。底圖 © OpenStreetMap / CARTO。
      </p>
    </section>
  );
}
