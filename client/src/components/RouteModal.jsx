import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../api.js';
import { ArrowIcon, BackIcon, CloseIcon, WarnIcon } from '../icons.jsx';
import { findRoute } from '../mtrTransfer.js';

const VIEW = { ROUTES: 'routes', STOPS: 'stops', ETA: 'eta', MTR_CHOOSE: 'mtr_choose', MTR_HEAVY: 'mtr_heavy', MTR_STATIONS: 'mtr_stations', LRT_STATIONS: 'lrt_stations', MTR_TRANSFER: 'mtr_transfer' };

const FAV_KEY = 'hk-life-fav-routes';
const loadFavs = (op) => {
  try { return (JSON.parse(localStorage.getItem(FAV_KEY) || '{}')[op]) || []; } catch { return []; }
};
const saveFavs = (op, list) => {
  try {
    const all = JSON.parse(localStorage.getItem(FAV_KEY) || '{}');
    all[op] = list;
    localStorage.setItem(FAV_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
};

// 熱門路線（常用幹線，無收藏時提供捷徑）
const POPULAR = {
  citybus: ['1', '5B', '6', '70', '260', '780', '788', 'A11', 'E11'],
  kmb: ['1A', '2', '5C', '6', '104', '118', '271', '960', '968']
};

export default function RouteModal({ op, cfg, onClose }) {
  const isMtr = cfg.type === 'mtr';
  const [view, setView] = useState(isMtr ? VIEW.MTR_CHOOSE : VIEW.ROUTES);
  const [mtrMode, setMtrMode] = useState(null); // 'heavy' | 'lrt'
  const [dir, setDir] = useState('outbound');
  const [route, setRoute] = useState(null);
  const [query, setQuery] = useState('');

  const [routes, setRoutes] = useState(null);
  const [stops, setStops] = useState(null);
  const [etas, setEtas] = useState(null);
  const [note, setNote] = useState(null);

  const [mtrLines, setMtrLines] = useState([]);
  const [mtrLine, setMtrLine] = useState(null); // 選中的重鐵線 {code,name,color,stations}
  const [lrtStations, setLrtStations] = useState([]);
  const [countdown, setCountdown] = useState(30);
  const [etaStop, setEtaStop] = useState(null);
  const [favs, setFavs] = useState(() => loadFavs(op));
  const [tFrom, setTFrom] = useState('');
  const [tTo, setTTo] = useState('');

  const toggleFav = useCallback((routeNo) => {
    setFavs((prev) => {
      const next = prev.includes(routeNo) ? prev.filter(r => r !== routeNo) : [...prev, routeNo];
      saveFavs(op, next);
      return next;
    });
  }, [op]);

  // 轉車建議：所有重鐵站（去重）
  const allStations = useMemo(() => {
    const seen = new Map();
    mtrLines.forEach(l => (l.stations || []).forEach(([code, name]) => { if (!seen.has(code)) seen.set(code, name); }));
    return [...seen.entries()].map(([code, name]) => ({ code, name }));
  }, [mtrLines]);

  const transferPlan = useMemo(() => {
    if (!tFrom || !tTo || tFrom === tTo || !mtrLines.length) return null;
    return findRoute(mtrLines, tFrom, tTo);
  }, [tFrom, tTo, mtrLines]);

  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const timers = useRef([]);

  const clearTimers = () => { timers.current.forEach(clearInterval); timers.current = []; };

  // 關閉：清計時器 + ESC
  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; clearTimers(); };
  }, [onClose]);

  // 載入路線清單
  useEffect(() => {
    if (view !== VIEW.ROUTES) return;
    setRoutes(null);
    api.routes(op).then((d) => {
      setRoutes(d.routes || []);
      if (d.source === 'demo') setNote('即時路線清單暫時無法取得，顯示熱門路線。');
    }).catch(() => setRoutes([]));
  }, [view, op]);

  // MTR 靜態資料
  useEffect(() => {
    if (view === VIEW.MTR_HEAVY || view === VIEW.MTR_TRANSFER) api.mtrLines().then(setMtrLines).catch(() => setMtrLines([]));
    if (view === VIEW.LRT_STATIONS) api.lrtStations().then(setLrtStations).catch(() => setLrtStations([]));
  }, [view]);

  // 載入站點
  const loadStops = useCallback((r, d) => {
    setRoute(r); setDir(d); setView(VIEW.STOPS); setStops(null);
    api.stops(op, r, d).then((d2) => setStops(d2.stops || [])).catch(() => setStops([]));
  }, [op]);

  // 載入 ETA + 自動倒數
  const loadEta = useCallback((stopId, stopName, mode, lineCode) => {
    setEtaStop({ id: stopId, name: stopName });
    setView(VIEW.ETA); setEtas(null); setNote(null); setCountdown(30);
    clearTimers();
    const fetchEta = () => {
      api.eta(op, { route, dir, stop: stopId, mode, line: lineCode }).then((d) => {
        setEtas(d.etas || []);
        if (d.source === 'demo') setNote('即時到站資料暫時無法取得，顯示示範時間。');
        if (d.source === 'error') setNote('即時到站資料暫時無法取得，請稍後再試。');
      }).catch(() => setEtas([]));
    };
    fetchEta();
    timers.current.push(setInterval(fetchEta, 30000));
    timers.current.push(setInterval(() => setCountdown((c) => (c <= 1 ? 30 : c - 1)), 1000));
  }, [op, route, dir]);

  const filteredRoutes = (routes || []).filter(r => !query || (r.route || '').toUpperCase().includes(query.toUpperCase()));

  const goBack = () => {
    clearTimers();
    if (view === VIEW.ETA) {
      if (isMtr && mtrMode === 'lrt') { setView(VIEW.LRT_STATIONS); }
      else if (isMtr && mtrMode === 'heavy') { setView(VIEW.MTR_STATIONS); }
      else { setView(VIEW.STOPS); }
    } else if (view === VIEW.STOPS) {
      setRoute(null); setView(VIEW.ROUTES);
    } else if (view === VIEW.MTR_STATIONS) {
      setMtrLine(null); setView(VIEW.MTR_HEAVY);
    } else if (view === VIEW.MTR_HEAVY || view === VIEW.LRT_STATIONS || view === VIEW.MTR_TRANSFER) {
      setMtrMode(null); setView(VIEW.MTR_CHOOSE);
    }
  };

  const title = isMtr ? '港鐵查詢'
    : view === VIEW.ROUTES ? '路線查詢'
    : view === VIEW.STOPS ? `${route} 號路線 · ${dir === 'inbound' ? '回程' : '去程'}`
    : `抵達時間 · ${etaStop?.name || ''}`;

  const showSearch = !isMtr && view === VIEW.ROUTES;
  const showDir = !isMtr && (view === VIEW.ROUTES || view === VIEW.STOPS);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__panel" ref={panelRef}>
        <header className="modal__head">
          <div className="modal__titlewrap">
            <span className="modal__operator" style={{ background: cfg.color }}>{cfg.label}</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="modal__close" type="button" aria-label="關閉" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <div className="modal__toolbar">
          {showSearch && (
            <label className="sr-only" htmlFor="route-search">搜尋路線</label>
          )}
          {showSearch && (
            <input
              id="route-search"
              ref={searchRef}
              className="modal__search"
              type="search"
              inputMode="latin"
              autoComplete="off"
              placeholder="輸入路線編號，例如 1A / 720"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          {showDir && (
            <div className="modal__dir" role="group" aria-label="方向">
              <button type="button" className={`dir-btn ${dir === 'outbound' ? 'is-active' : ''}`} onClick={() => { setDir('outbound'); if (route) loadStops(route, 'outbound'); }}>去程</button>
              <button type="button" className={`dir-btn ${dir === 'inbound' ? 'is-active' : ''}`} onClick={() => { setDir('inbound'); if (route) loadStops(route, 'inbound'); }}>回程</button>
            </div>
          )}
        </div>

        <div className="modal__body">
          {/* MTR 選擇 */}
          {view === VIEW.MTR_CHOOSE && (
            <div className="stop-list">
              <button type="button" className="stop-card" onClick={() => { setMtrMode('heavy'); setView(VIEW.MTR_HEAVY); }}>
                <span className="stop-card__name">重鐵（市區線）— 即時列車到站</span><ArrowIcon />
              </button>
              <button type="button" className="stop-card" onClick={() => { setMtrMode('lrt'); setView(VIEW.LRT_STATIONS); }}>
                <span className="stop-card__name">輕鐵（新界西北）— 即時到站</span><ArrowIcon />
              </button>
              <button type="button" className="stop-card stop-card--accent" onClick={() => { setMtrMode('transfer'); setView(VIEW.MTR_TRANSFER); }}>
                <span className="stop-card__name">轉車建議 — 起點到目的地點對點規劃</span><ArrowIcon />
              </button>
            </div>
          )}

          {/* MTR 轉車建議 */}
          {view === VIEW.MTR_TRANSFER && (
            <div>
              <button className="back-btn" type="button" onClick={goBack}><BackIcon /> 返回</button>
              <h3 className="stop-pane__title">轉車建議</h3>
              <div className="transfer-form">
                <div className="transfer-form__row">
                  <label className="transfer-form__label" htmlFor="t-from">出發</label>
                  <select id="t-from" className="transfer-form__select" value={tFrom} onChange={(e) => setTFrom(e.target.value)}>
                    <option value="">選擇出發站</option>
                    {allStations.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                  </select>
                </div>
                <button type="button" className="transfer-form__swap" aria-label="交換起點終點" onClick={() => { setTFrom(tTo); setTTo(tFrom); }}>⇅</button>
                <div className="transfer-form__row">
                  <label className="transfer-form__label" htmlFor="t-to">目的地</label>
                  <select id="t-to" className="transfer-form__select" value={tTo} onChange={(e) => setTTo(e.target.value)}>
                    <option value="">選擇目的站</option>
                    {allStations.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {tFrom && tTo && tFrom === tTo && <div className="state-msg">出發站與目的站相同</div>}
              {transferPlan && (
                <div className="transfer-plan">
                  <div className="transfer-plan__summary">
                    <span className="transfer-plan__stat"><strong>{transferPlan.transfers}</strong> 次轉車</span>
                    <span className="transfer-plan__stat"><strong>{transferPlan.totalStops}</strong> 個站</span>
                    <span className="transfer-plan__stat">約 <strong>{transferPlan.est}</strong> 分鐘</span>
                  </div>
                  <div className="transfer-plan__segs">
                    {transferPlan.segments.map((s, i) => (
                      <div className="transfer-seg" key={i}>
                        <span className="transfer-seg__badge" style={{ background: s.color }}>{s.lineName}</span>
                        <div className="transfer-seg__info">
                          <div className="transfer-seg__route">{s.from} → {s.to}</div>
                          <div className="transfer-seg__meta">{s.stops} 個站{i < transferPlan.segments.length - 1 ? ` · 於 ${s.to} 轉車` : ''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="card__hint">時間為粗估（每站約 3 分鐘＋每次轉車約 5 分鐘），僅供參考。</div>
                </div>
              )}
              {tFrom && tTo && tFrom !== tTo && !transferPlan && mtrLines.length > 0 && (
                <div className="state-msg">找不到合適路線</div>
              )}
            </div>
          )}

          {/* MTR 重鐵：選擇路線（真實 Next Train API） */}
          {view === VIEW.MTR_HEAVY && (
            <div>
              <button className="back-btn" type="button" onClick={goBack}><BackIcon /> 返回</button>
              <h3 className="stop-pane__title">選擇路線</h3>
              <div className="route-list">
                {mtrLines.map((l) => (
                  <button type="button" className="route-card" key={l.code} onClick={() => { setMtrLine(l); setView(VIEW.MTR_STATIONS); }}>
                    <span className="route-card__no" style={{ background: l.color }}>{l.code}</span>
                    <span className="route-card__info">
                      <span className="route-card__dest">{l.name}</span>
                      <span className="route-card__orig">{l.termini}</span>
                    </span>
                    <ArrowIcon />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MTR 重鐵：選擇車站 */}
          {view === VIEW.MTR_STATIONS && mtrLine && (
            <div>
              <button className="back-btn" type="button" onClick={goBack}><BackIcon /> 返回路線</button>
              <h3 className="stop-pane__title">{mtrLine.name} · 選擇車站</h3>
              <div className="stop-list">
                {(mtrLine.stations || []).map(([code, name]) => (
                  <button type="button" className="stop-card" key={code} onClick={() => loadEta(code, `${mtrLine.name} ${name}`, 'heavy', mtrLine.code)}>
                    <span className="stop-card__name">{name}</span><ArrowIcon />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 路線清單 */}
          {view === VIEW.ROUTES && (
            <div className="route-list">
              {routes === null && <div className="skeleton skeleton--line" />}
              {note && <div className="note-banner">{note}</div>}
              {routes !== null && !query && (
                <>
                  {favs.length > 0 && (
                    <div className="route-group">
                      <div className="route-group__title">我的收藏</div>
                      {favs.map((no) => {
                        const r = routes.find(x => x.route === no);
                        return r ? <RouteCard key={`fav-${no}`} r={r} fav onFav={toggleFav} onGo={() => loadStops(r.route, dir)} /> : null;
                      })}
                    </div>
                  )}
                  <div className="route-group">
                    <div className="route-group__title">熱門路線</div>
                    <div className="popular-chips">
                      {(POPULAR[op] || []).map((no) => (
                        <button type="button" className="popular-chip" key={no} onClick={() => setQuery(no)}>{no}</button>
                      ))}
                    </div>
                  </div>
                  <div className="route-group__title">全部路線</div>
                </>
              )}
              {routes !== null && filteredRoutes.length === 0 && <div className="state-msg">找不到相關路線</div>}
              {filteredRoutes.slice(0, query ? 200 : 60).map((r) => (
                <RouteCard key={r.route} r={r} fav={favs.includes(r.route)} onFav={toggleFav} onGo={() => loadStops(r.route, dir)} />
              ))}
            </div>
          )}

          {/* 站點清單 / 輕鐵站 */}
          {(view === VIEW.STOPS || view === VIEW.LRT_STATIONS) && (
            <div>
              {view === VIEW.STOPS && (<button className="back-btn" type="button" onClick={goBack}><BackIcon /> 返回路線</button>)}
              {view === VIEW.LRT_STATIONS && (<button className="back-btn" type="button" onClick={goBack}><BackIcon /> 返回</button>)}
              <h3 className="stop-pane__title">{view === VIEW.LRT_STATIONS ? '選擇輕鐵站' : `${route} 號路線 · ${dir === 'inbound' ? '回程' : '去程'}`}</h3>
              <div className="stop-list">
                {view === VIEW.LRT_STATIONS ? (
                  lrtStations.map((s) => (
                    <button type="button" className="stop-card" key={s.id} onClick={() => loadEta(s.id, s.name, 'lrt')}>
                      <span className="stop-card__name">{s.name}</span><ArrowIcon />
                    </button>
                  ))
                ) : (
                  <>
                    {stops === null && <div className="skeleton skeleton--line" />}
                    {stops !== null && stops.length === 0 && <div className="state-msg">此路線暫無站點資料</div>}
                    {stops?.map((s) => (
                      <button type="button" className="stop-card" key={s.id} onClick={() => loadEta(s.id, s.name, null)}>
                        <span className="stop-card__name">{s.name}</span><ArrowIcon />
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* 抵達時間 */}
          {view === VIEW.ETA && (
            <div>
              <button className="back-btn" type="button" onClick={goBack}><BackIcon /> 返回</button>
              <h3 className="stop-pane__title">抵達時間 · {etaStop?.name}</h3>
              <div className="eta-refresh">每 30 秒自動更新 · {countdown}s</div>
              {note && <div className="note-banner">{note}</div>}
              <div className="eta-list">
                {etas === null && <div className="skeleton skeleton--line" />}
                {etas !== null && etas.length === 0 && <div className="state-msg">暫無到站資料</div>}
                {etas?.map((e, i) => <EtaRow key={i} e={e} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RouteCard({ r, fav, onFav, onGo }) {
  return (
    <div className={`route-card ${fav ? 'route-card--fav' : ''}`}>
      <button type="button" className="route-card__main" onClick={onGo}>
        <span className="route-card__no">{r.route}</span>
        <span className="route-card__info">
          <span className="route-card__orig">{r.orig || ''} →</span>
          <span className="route-card__dest">{r.dest || ''}</span>
        </span>
      </button>
      <button type="button" className={`fav-btn ${fav ? 'is-fav' : ''}`} aria-label={fav ? '取消收藏' : '收藏路線'} aria-pressed={fav} onClick={(ev) => { ev.stopPropagation(); onFav(r.route); }}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </button>
    </div>
  );
}

function EtaRow({ e }) {
  const mins = e.mins;
  const urgency = mins === null ? 'arriving'
    : mins <= 0 ? 'arriving'
    : mins <= 3 ? 'soon'
    : mins >= 15 ? 'late' : 'normal';
  const timeText = mins === null ? '到站' : (mins <= 0 ? '即將到站' : `${mins} 分`);
  const isMtr = !!e.dir && (e.dir === 'UP' || e.dir === 'DOWN');
  return (
    <div className={`eta-row eta-row--${urgency}`}>
      <div className="eta-row__main">
        <div className="eta-row__top">
          {e.route && <span className="eta-row__route" style={e.color ? { background: e.color } : undefined}>{e.route}</span>}
          <span className="eta-row__dest">往 {e.dest || ''}</span>
        </div>
        <div className="eta-row__sub">
          {!isMtr && e.dir && <span className="eta-row__dir">{e.dir}</span>}
          {e.remark && <span className="eta-row__plat">{e.remark}</span>}
        </div>
      </div>
      <div className="eta-row__time">
        <div className="eta-row__mins">{timeText}</div>
        <div className="eta-row__label">預計抵達</div>
      </div>
    </div>
  );
}
