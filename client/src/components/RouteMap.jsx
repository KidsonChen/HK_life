import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api.js';

const OP_COLOR = { kmb: '#E60012', citybus: '#00A0B0' };

// 複用既有樣式（.bus-marker__pin / .stop-marker__dot 已在 styles.css）
const stopIcon = (color, emphasized) => L.divIcon({
  className: 'stop-marker',
  html: emphasized
    ? `<span class="stop-marker__dot" style="background:${color};border-color:#fff;width:14px;height:14px;box-shadow:0 0 0 3px ${color}55"></span>`
    : '<span class="stop-marker__dot"></span>',
  iconSize: emphasized ? [14, 14] : [10, 10],
  iconAnchor: emphasized ? [7, 7] : [5, 5]
});

const vehIcon = (color, label) => L.divIcon({
  className: 'bus-marker',
  html: `<span class="bus-marker__pin" style="--pin:${color}"><span class="bus-marker__num">${label}</span></span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

// 路線地圖：跟隨看板查詢的同一路線，標示上車站（綠）與下車站（紅）
export default function RouteMap({ op, route, dir, boardSeq, alightSeq }) {
  const mapEl = useRef(null);
  const map = useRef(null);
  const layers = useRef({ stops: null, line: null, veh: null });
  const fitted = useRef('');
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (map.current || !mapEl.current) return;
    const m = L.map(mapEl.current, { center: [22.32, 114.17], zoom: 11, zoomControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(m);
    layers.current.stops = L.layerGroup().addTo(m);
    layers.current.line = L.layerGroup().addTo(m);
    layers.current.veh = L.layerGroup().addTo(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 200);
    return () => { m.remove(); map.current = null; };
  }, []);

  const load = useCallback(async () => {
    if (!route) return;
    try {
      const d = await api.busLive(op, route, dir);
      setStatus(d.stops?.length ? 'ok' : 'error');
      const m = map.current;
      if (!m) return;
      const color = OP_COLOR[op] || '#2563EB';
      const { stops, line, veh } = layers.current;
      stops.clearLayers(); line.clearLayers(); veh.clearLayers();

      const pts = (d.stops || []).map(s => [s.lat, s.lng]);
      if (pts.length > 1) L.polyline(pts, { color, weight: 4, opacity: .5 }).addTo(line);

      (d.stops || []).forEach((s) => {
        const isBoard = s.seq != null && boardSeq != null && String(s.seq) === String(boardSeq);
        const isAlight = s.seq != null && alightSeq != null && String(s.seq) === String(alightSeq);
        if (isBoard) L.marker([s.lat, s.lng], { icon: stopIcon('#16A34A', true) })
          .bindPopup(`<b>${s.seq}. ${s.name}</b><br/>上車站`).addTo(stops);
        else if (isAlight) L.marker([s.lat, s.lng], { icon: stopIcon('#DC2626', true) })
          .bindPopup(`<b>${s.seq}. ${s.name}</b><br/>下車站`).addTo(stops);
        else L.marker([s.lat, s.lng], { icon: stopIcon(color, false) }).bindPopup(`<b>${s.seq}. ${s.name}</b>`).addTo(stops);
      });

      (d.vehicles || []).forEach((v) => {
        L.marker([v.lat, v.lng], { icon: vehIcon(color, v.order), zIndexOffset: 500 })
          .bindPopup(`<b>${route} · 第 ${v.order} 班</b><br/>往 ${v.dest}<br/>下一站：${v.nextStop}<br/>約 ${v.minsToNext} 分鐘到站`)
          .addTo(veh);
      });

      const key = `${op}|${route}|${dir}`;
      if (fitted.current !== key) {
        if (pts.length) m.fitBounds(L.latLngBounds(pts).pad(0.12));
        fitted.current = key;
      }
      setTimeout(() => m.invalidateSize(), 60);
    } catch {
      setStatus('error');
    }
  }, [op, route, dir, boardSeq, alightSeq]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const color = OP_COLOR[op] || '#2563EB';
  return (
    <div className="board-map">
      <div ref={mapEl} className="map-canvas" />
      {status === 'error' && <div className="map-overlay">地圖暫時載入失敗，請稍後再試。</div>}
      <div className="board-map__legend">
        <span><i className="dot" style={{ background: color }} /> 路線</span>
        <span><i className="dot" style={{ background: '#16A34A' }} /> 上車站</span>
        <span><i className="dot" style={{ background: '#DC2626' }} /> 下車站</span>
        <span><i className="dot dot--veh" style={{ background: color }} /> 在途車輛</span>
      </div>
    </div>
  );
}
