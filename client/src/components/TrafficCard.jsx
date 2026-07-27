import React, { useState, useEffect, useCallback } from 'react';
import { WarnIcon, CloseIcon } from '../icons.jsx';

function severity(status, type) {
  if (type === 'resolved') return 'traffic-item--ok';
  const s = (status || '').toLowerCase();
  if (/塞|擠|封閉|意外|closed|jam|congest|accident/.test(s)) return 'traffic-item--bad';
  if (/慢|緩|維修|delay|slow|works/.test(s)) return 'traffic-item--warn';
  return '';
}

const CATEGORY_LABEL = { road: '公路', mtr: '港鐵' };

export default function TrafficCard({ data, error, loading }) {
  const [selected, setSelected] = useState(null);

  const close = useCallback(() => setSelected(null), []);

  // ESC 關閉 lightbox
  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected, close]);

  if (loading) {
    return (
      <section className="card card--traffic" id="traffic" aria-labelledby="traffic-title">
        <div className="card__head"><h2 id="traffic-title">交通情況</h2></div>
        <div className="skeleton skeleton--block" role="status"><span className="visually-hidden">載入中…</span></div>
      </section>
    );
  }
  if (error || !data || !data.items?.length) {
    return (
      <section className="card card--traffic" id="traffic" aria-labelledby="traffic-title">
        <div className="card__head"><h2 id="traffic-title">交通情況</h2></div>
        <div className="state-msg">{error ? <><WarnIcon /> <span>無法載入交通資料</span></> : '目前沒有公路或港鐵事故'}</div>
      </section>
    );
  }
  return (
    <section className="card card--traffic" id="traffic" aria-labelledby="traffic-title">
      <div className="card__head">
        <h2 id="traffic-title">交通情況</h2>
        <span className="card__hint">公路 · 港鐵 事故</span>
      </div>
      <div className="traffic" aria-live="polite">
        {data.items.map((it, i) => (
          <button
            type="button"
            className={`traffic-item ${severity(it.status, it.type)}`}
            key={it.id || i}
            onClick={() => setSelected(it)}
            aria-haspopup="dialog"
            title="點擊查看完整內容"
          >
            <span className="traffic-item__road">
              {it.category && <span className={`traffic-tag traffic-tag--${it.category}`}>{CATEGORY_LABEL[it.category] || ''}</span>}
              {it.road}
            </span>
            <span className="traffic-item__status">{it.status}</span>
          </button>
        ))}
      </div>

      {/* Lightbox：完整內容 */}
      {selected && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-labelledby="lightbox-title">
          <div className="lightbox__backdrop" onClick={close} />
          <div className="lightbox__panel">
            <header className="lightbox__head">
              <div className="lightbox__titlewrap">
                {selected.category && (
                  <span className={`traffic-tag traffic-tag--${selected.category}`}>{CATEGORY_LABEL[selected.category] || ''}</span>
                )}
                <h3 id="lightbox-title">{selected.road}</h3>
              </div>
              <button className="lightbox__close" type="button" aria-label="關閉" onClick={close}>
                <CloseIcon />
              </button>
            </header>
            <div className="lightbox__body">
              <p className="lightbox__text">{selected.full || selected.status}</p>
              {selected.time && <div className="lightbox__time">發布時間：{selected.time}</div>}
              {selected.type === 'resolved' && <div className="lightbox__badge lightbox__badge--ok">已解封／完結</div>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
