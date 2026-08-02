import React, { useState, useCallback, useEffect, useRef } from 'react';
import { api } from './api.js';
import { RefreshIcon, BuildingIcon, CheckIcon, InfoIcon, WarnIcon, UpIcon } from './icons.jsx';
import WeatherCard from './components/WeatherCard.jsx';
import TrafficCard from './components/TrafficCard.jsx';
import TransportCards from './components/TransportCards.jsx';
import RouteModal from './components/RouteModal.jsx';
import TempHistoryCard from './components/TempHistoryCard.jsx';
import BusMapCard from './components/BusMapCard.jsx';
import BusBoardCard from './components/BusBoardCard.jsx';
import MtrSchematicMap from './components/MtrSchematicMap.jsx';

const PAGES = [
  { id: 'home', label: '生活資訊' },
  { id: 'bus', label: '巴士' },
  { id: 'mtr', label: '港鐵' }
];

function currentPage() {
  const h = window.location.hash.replace('#/', '');
  return PAGES.some(p => p.id === h) ? h : 'home';
}

const OPERATORS = {
  citybus: { label: '城巴', color: 'var(--line-citybus)', type: 'bus' },
  kmb: { label: '九巴', color: 'var(--line-kmb)', type: 'bus' },
  mtr: { label: '港鐵', color: 'var(--line-mtr)', type: 'mtr' }
};

/* ===== Toast 通知元件 ===== */
function Toast({ toast, onDone }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 2500);
    const t2 = setTimeout(onDone, 2900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  const Icon = toast.type === 'success' ? CheckIcon : toast.type === 'error' ? WarnIcon : InfoIcon;
  return (
    <div className={`toast toast--${toast.type} ${leaving ? 'is-leaving' : ''}`} role="status">
      <span className="toast__icon"><Icon size={16} /></span>
      <span className="toast__msg">{toast.msg}</span>
    </div>
  );
}

export default function App() {
  const [weather, setWeather] = useState(null);
  const [weatherErr, setWeatherErr] = useState(false);
  const [traffic, setTraffic] = useState(null);
  const [trafficErr, setTrafficErr] = useState(false);
  const [transport, setTransport] = useState({ citybus: null, kmb: null, mtr: null });
  const [tempHistory, setTempHistory] = useState(null);
  const [tempErr, setTempErr] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [showTop, setShowTop] = useState(false);

  const [modalOp, setModalOp] = useState(null); // 當前開啟的運輸商
  const [lastFocus, setLastFocus] = useState(null);
  const toastId = useRef(0);
  const [page, setPage] = useState(currentPage);

  // hash 路由：支援上一頁／下一頁與可分享網址
  useEffect(() => {
    const onHash = () => setPage(currentPage());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goto = (id) => { window.location.hash = `#/${id}`; };

  const pushToast = useCallback((type, msg) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, type, msg }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter(t => t.id !== id));
  }, []);

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
        const routes = d.routes || d.lines || [];
        // 巴士以 route 為識別碼，港鐵回傳的是 name（線名）
        setTransport((t) => ({
          ...t,
          [op]: routes.slice(0, 6).map(r => ({ route: r.route || r.name || r.code, status: '正常運行' }))
        }));
      } catch {
        setTransport((t) => ({ ...t, [op]: [] }));
      }
    }));
  }, []);

  const loadTempHistory = useCallback(async () => {
    try { const d = await api.regionalTemp(); setTempHistory(d); setTempErr(false); }
    catch { setTempErr(true); }
  }, []);

  const refreshAll = useCallback(() => {
    setLoading(true);
    Promise.allSettled([loadWeather(), loadTraffic(), loadTransport(), loadTempHistory()])
      .then((results) => {
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed === 0) {
          setLastUpdated(new Date());
          pushToast('success', '資料已更新');
        } else if (failed === results.length) {
          pushToast('error', '無法更新資料，請稍後再試');
        } else {
          pushToast('info', `部分資料更新失敗（${failed}/${results.length}）`);
        }
      })
      .finally(() => setTimeout(() => setLoading(false), 600));
  }, [loadWeather, loadTraffic, loadTransport, loadTempHistory, pushToast]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  // 回到頂部按鈕：監聽捲動
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const openModal = (op) => {
    setLastFocus(document.activeElement);
    setModalOp(op);
  };
  const closeModal = () => {
    setModalOp(null);
    lastFocus?.focus?.();
  };

  const updatedText = lastUpdated
    ? `最後更新 ${lastUpdated.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })}`
    : '';

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__ribbon" aria-hidden="true">
          {['#E60012','#00A040','#0860A8','#7D499D','#9C2E00','#5EB7E8','#CBD300','#F7943E','#00888E','#EB6EA5']
            .map((c) => <i key={c} style={{ background: c }} />)}
        </div>
        <div className="app-header__brand">
          <span className="app-header__mark" aria-hidden="true"><BuildingIcon size={28} /></span>
          <div>
            <p className="app-header__eyebrow">HONG KONG · 即時</p>
            <h1>香港生活資訊</h1>
            <p className="app-header__sub">天氣 · 交通 · 即時運輸</p>
          </div>
        </div>
        <div className="app-header__meta">
          {updatedText && <span className="app-header__updated">{updatedText}</span>}
          <button className={`btn-refresh ${loading ? 'is-loading' : ''}`} type="button" onClick={refreshAll} aria-label="重新整理所有資料">
            <RefreshIcon />
            <span>重新整理</span>
          </button>
        </div>

        <nav className="app-nav" aria-label="主要頁面">
          {PAGES.map(p => (
            <button
              key={p.id}
              type="button"
              className={`app-nav__tab ${page === p.id ? 'is-active' : ''}`}
              aria-current={page === p.id ? 'page' : undefined}
              onClick={() => goto(p.id)}
            >{p.label}</button>
          ))}
        </nav>
      </header>

      {page === 'home' && (
        <main id="main" className="bento">
          <WeatherCard data={weather} error={weatherErr} loading={!weather && !weatherErr} />
          <TempHistoryCard data={tempHistory} error={tempErr} loading={!tempHistory && !tempErr} />
          <TrafficCard data={traffic} error={trafficErr} loading={!traffic && !trafficErr} />
        </main>
      )}

      {page === 'bus' && (
        <main id="main" className="bento bento--transit">
          <BusBoardCard />
          <BusMapCard />
          <TransportCards
            data={transport}
            onOpen={openModal}
            ops={['kmb', 'citybus']}
            title="巴士路線查詢"
          />
        </main>
      )}

      {page === 'mtr' && (
        <main id="main" className="bento bento--transit">
          <MtrSchematicMap />
          <TransportCards
            data={transport}
            onOpen={openModal}
            ops={['mtr']}
            title="港鐵路線查詢"
          />
        </main>
      )}

      <footer className="app-footer">
        <p>資料來源：香港天文台 · DATA.GOV.HK</p>
        <p>香港生活資訊 © 2026</p>
      </footer>

      {/* Toast 通知 */}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => <Toast key={t.id} toast={t} onDone={() => removeToast(t.id)} />)}
      </div>

      {/* 回到頂部 */}
      <button
        type="button"
        className={`back-to-top ${showTop ? 'is-visible' : ''}`}
        onClick={scrollTop}
        aria-label="回到頂部"
      >
        <UpIcon size={20} />
      </button>

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