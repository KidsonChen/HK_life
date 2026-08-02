import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../api.js';

const OPS = [
  { key: 'kmb', label: '九巴', color: '#E60012' },
  { key: 'citybus', label: '城巴', color: '#00A0B0' }
];

function etaText(mins) {
  if (mins === null || mins === undefined || Number.isNaN(mins)) return '--';
  if (mins <= 0) return '即將到站';
  if (mins === 1) return '1 分鐘';
  return `${mins} 分鐘`;
}

// 電子看板本體：依到站時間排序，即將到站轉綠閃爍
function Board({ route, dest, clock, rows, caption }) {
  return (
    <div className="board" role="region" aria-label={`${route} 路線即時到站看板`}>
      <div className="board__bar">
        <span className="board__route" style={{ '--op': 'var(--op-color)' }}>{route}</span>
        <span className="board__dest">往 {dest}</span>
        <span className="board__clock" aria-label="現在時間">{clock}</span>
      </div>
      {caption && <div className="board__caption">{caption}</div>}
      <div className="board__cols" aria-hidden="true">
        <span>班次</span><span>目的地</span><span>預計到達</span>
      </div>
      <ol className="board__rows">
        {rows.length === 0 && (
          <li className="board__row board__row--msg">暫無到站資料，可能已收車或班次較疏。</li>
        )}
        {rows.map((r, i) => {
          const soon = r.soon;
          return (
            <li className={`board__row ${soon ? 'is-soon' : ''}`} key={i}>
              <span className="board__seq">{i + 1}</span>
              <span className="board__stop">
                {r.label}
                {r.remark && r.remark !== '原定班次' && (
                  <em className="board__remark">{r.remark}</em>
                )}
              </span>
              <span className="board__eta">
                {etaText(r.mins)}
                {soon && <i className="board__blink" aria-hidden="true" />}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function BusBoardCard() {
  const [op, setOp] = useState('kmb');
  const [route, setRoute] = useState('968');
  const [input, setInput] = useState('968');
  const [dir, setDir] = useState('outbound');

  const [stops, setStops] = useState(null);        // 該路線站序
  const [boardStop, setBoardStop] = useState(null); // 上車站 {id,name}
  const [boardEtas, setBoardEtas] = useState(null); // 上車站 ETA
  const [alightStop, setAlightStop] = useState(null); // 下車站 {id,name}
  const [alightEtas, setAlightEtas] = useState(null); // 下車站 ETA

  const [status, setStatus] = useState('loading'); // loading | ok | error
  const [countdown, setCountdown] = useState(30);
  const [clock, setClock] = useState(() => new Date());

  const opColor = OPS.find(o => o.key === op)?.color || '#E60012';
  const clockStr = clock.toLocaleTimeString('zh-HK', { hour12: false });

  // 載入站序（路線／方向／營運商改變時）
  const loadStops = useCallback(async () => {
    if (!route) return;
    setStatus('loading');
    setStops(null); setBoardStop(null); setBoardEtas(null);
    setAlightStop(null); setAlightEtas(null);
    try {
      const d = await api.stops(op, route, dir);
      const list = d.stops || [];
      setStops(list);
      setStatus(list.length ? 'ok' : 'error');
      setCountdown(30);
    } catch {
      setStops([]);
      setStatus('error');
    }
  }, [op, route, dir]);

  const fetchEta = useCallback(async (stop) => {
    if (!stop) return [];
    try {
      const d = await api.eta(op, { route, dir, stop: stop.id });
      return d.etas || [];
    } catch {
      return [];
    }
  }, [op, route, dir]);

  useEffect(() => { loadStops(); }, [loadStops]);

  // 每 30 秒重抓兩個站的 ETA；每秒倒數＋時鐘
  useEffect(() => {
    const refresh = async () => {
      if (boardStop) { const e = await fetchEta(boardStop); setBoardEtas(e); }
      if (alightStop) { const e = await fetchEta(alightStop); setAlightEtas(e); }
      setCountdown(30);
    };
    const t1 = setInterval(refresh, 30000);
    const t2 = setInterval(() => setCountdown(c => (c <= 1 ? 30 : c - 1)), 1000);
    const t3 = setInterval(() => setClock(new Date()), 1000);
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); };
  }, [boardStop, alightStop, fetchEta]);

  const submit = (e) => {
    e.preventDefault();
    const v = input.trim().toUpperCase();
    if (v) setRoute(v);
  };

  // 選上車站 → 抓 ETA，清空下車選擇
  const pickBoard = async (stop) => {
    setBoardStop(stop);
    setBoardEtas(null);
    setAlightStop(null);
    setAlightEtas(null);
    setBoardEtas(await fetchEta(stop));
  };

  // 選下車站 → 抓該站 ETA
  const pickAlight = async (stop) => {
    setAlightStop(stop);
    setAlightEtas(null);
    setAlightEtas(await fetchEta(stop));
  };

  // 上車站之後的站（可選為下車站）
  const remainingStops = useMemo(() => {
    if (!stops || !boardStop) return [];
    const idx = stops.findIndex(s => s.id === boardStop.id);
    return idx >= 0 ? stops.slice(idx + 1) : [];
  }, [stops, boardStop]);

  const toRows = (etas) => (etas || [])
    .slice()
    .sort((a, b) => (a.mins ?? 999) - (b.mins ?? 999))
    .map(e => ({
      label: e.dest || (dir === 'outbound' ? '去程' : '回程'),
      mins: e.mins,
      remark: e.remark,
      soon: (e.mins ?? 999) <= 1
    }));

  const boardDest = boardEtas?.[0]?.dest
    || stops?.[stops.length - 1]?.name?.replace(/\s*\(.*\)/, '')
    || (dir === 'outbound' ? '去程' : '回程');
  const alightDest = alightEtas?.[0]?.dest || boardDest;

  return (
    <section className="card card--board" style={{ '--op-color': opColor }}>
      <div className="card__head">
        <h2>巴士即時到站看板</h2>
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
        <label className="sr-only" htmlFor="board-route">路線編號</label>
        <input id="board-route" className="map-controls__input" value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="路線，例如 968" autoComplete="off" />
        <div className="seg" role="group" aria-label="方向">
          <button type="button" className={`seg__btn ${dir === 'outbound' ? 'is-active' : ''}`} onClick={() => setDir('outbound')}>去程</button>
          <button type="button" className={`seg__btn ${dir === 'inbound' ? 'is-active' : ''}`} onClick={() => setDir('inbound')}>回程</button>
        </div>
        <button type="submit" className="map-controls__go">查看</button>
      </form>

      {status === 'error' && (
        <div className="state-msg">取不到 {route} 的站點資料，換個路線編號試試。</div>
      )}

      {status === 'ok' && stops && (
        <>
          {/* 上車站選擇 */}
          <div className="board-pick">
            <label className="board-pick__label" htmlFor="board-stop">上車站</label>
            <select
              id="board-stop"
              className="board-pick__select"
              value={boardStop?.id || ''}
              onChange={(e) => {
                const s = stops.find(x => x.id === e.target.value);
                if (s) pickBoard(s);
              }}
            >
              <option value="">選擇上車站…</option>
              {stops.map(s => (
                <option key={s.id} value={s.id}>{s.name.replace(/\s*\(.*\)/, '')}</option>
              ))}
            </select>
          </div>

          {/* 上車站到站看板 */}
          {boardStop && (
            <Board
              route={route}
              dest={boardDest}
              clock={clockStr}
              rows={toRows(boardEtas)}
              caption={`上車站 · ${boardStop.name.replace(/\s*\(.*\)/, '')}`}
            />
          )}

          {/* 下車站選擇：上車站之後的站 */}
          {boardStop && remainingStops.length > 0 && (
            <div className="board-pick">
              <div className="board-pick__label">下車站（選擇路線之後的站）</div>
              <div className="board-stops">
                {remainingStops.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={`board-stops__btn ${alightStop?.id === s.id ? 'is-active' : ''}`}
                    onClick={() => pickAlight(s)}
                  >
                    {s.name.replace(/\s*\(.*\)/, '')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 下車站預計抵達看板 */}
          {alightStop && (
            <Board
              route={route}
              dest={alightDest}
              clock={clockStr}
              rows={toRows(alightEtas)}
              caption={`預計抵達 · ${alightStop.name.replace(/\s*\(.*\)/, '')}`}
            />
          )}
        </>
      )}

      <p className="card__hint">
        到站時間取自各營運商官方預計到站資料（ETA），每 30 秒自動更新。選擇上車站可看該站倒數，
        再點選路線後段的車站即可預估抵達時間。
      </p>
    </section>
  );
}
