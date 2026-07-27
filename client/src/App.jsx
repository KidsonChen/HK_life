import React, { useState, useCallback, useEffect } from 'react';
import { api } from './api.js';
import { RefreshIcon, BuildingIcon } from './icons.jsx';
import WeatherCard from './components/WeatherCard.jsx';
import TrafficCard from './components/TrafficCard.jsx';
import TransportCards from './components/TransportCards.jsx';
import RouteModal from './components/RouteModal.jsx';

const OPERATORS = {
  citybus: { label: '城巴', color: 'var(--line-citybus)', type: 'bus' },
  kmb: { label: '九巴', color: 'var(--line-kmb)', type: 'bus' },
  mtr: { label: '港鐵', color: 'var(--line-mtr)', type: 'mtr' }
};

export default function App() {
  const [weather, setWeather] = useState(null);
  const [weatherErr, setWeatherErr] = useState(false);
  const [traffic, setTraffic] = useState(null);
  const [trafficErr, setTrafficErr] = useState(false);
  const [transport, setTransport] = useState({ citybus: null, kmb: null, mtr: null });
  const [loading, setLoading] = useState(false);

  const [modalOp, setModalOp] = useState(null); // 當前開啟的運輸商
  const [lastFocus, setLastFocus] = useState(null);

  const loadWeather = useCallback(async () => {
    try { const d = await api.weather(); setWeather(d); setWeatherErr(false); }
    catch { setWeatherErr(true); }
  }, []);

  const loadTraffic = useCallback(async () => {
    try { const d = await api.traffic(); setTraffic(d); setTrafficErr(false); }
    catch { setTrafficErr(true); }
  }, []);

  const loadTransport = useCallback(async () => {
    const ops = Object.keys(OPERATORS);
    await Promise.all(ops.map(async (op) => {
      try {
        const d = await api.routes(op);
        if (op === 'mtr') return; // 港鐵首頁不顯示路線清單
        const routes = d.routes || d.lines || [];
        setTransport((t) => ({ ...t, [op]: routes.slice(0, 6).map(r => ({ route: r.route, status: '正常運行' })) }));
      } catch {
        setTransport((t) => ({ ...t, [op]: [] }));
      }
    }));
  }, []);

  const refreshAll = useCallback(() => {
    setLoading(true);
    Promise.allSettled([loadWeather(), loadTraffic(), loadTransport()])
      .finally(() => setTimeout(() => setLoading(false), 600));
  }, [loadWeather, loadTraffic, loadTransport]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const openModal = (op) => {
    setLastFocus(document.activeElement);
    setModalOp(op);
  };
  const closeModal = () => {
    setModalOp(null);
    lastFocus?.focus?.();
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__mark" aria-hidden="true"><BuildingIcon size={28} /></span>
          <div>
            <h1>香港生活資訊</h1>
            <p className="app-header__sub">天氣 · 交通 · 即時運輸</p>
          </div>
        </div>
        <button className={`btn-refresh ${loading ? 'is-loading' : ''}`} type="button" onClick={refreshAll} aria-label="重新整理所有資料">
          <RefreshIcon />
          <span>重新整理</span>
        </button>
      </header>

      <main id="main" className="bento">
        <WeatherCard data={weather} error={weatherErr} loading={!weather && !weatherErr} />
        <TrafficCard data={traffic} error={trafficErr} loading={!traffic && !trafficErr} />
        <TransportCards
          data={transport}
          onOpen={openModal}
        />
      </main>

      <footer className="app-footer">
        <p>資料來源：香港天文台 · DATA.GOV.HK</p>
        <p>香港生活資訊 © 2026</p>
      </footer>

      {modalOp && (
        <RouteModal
          op={modalOp}
          cfg={OPERATORS[modalOp]}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
