import React from 'react';
import { ArrowIcon } from '../icons.jsx';

const LINE_LABELS = { citybus: '城巴', kmb: '九巴', mtr: '港鐵' };

export default function TransportCards({ data, onOpen }) {
  const ops = ['citybus', 'kmb', 'mtr'];
  return (
    <section className="card card--transport" id="transport" aria-labelledby="transport-title">
      <div className="card__head"><h2 id="transport-title">即時運輸資料</h2></div>
      <div className="transport-grid">
        {ops.map((op) => {
          const items = data[op];
          return (
            <div
              key={op}
              className="transport-col"
              data-line={op}
              role="button"
              tabIndex={0}
              aria-label={`${LINE_LABELS[op]} — 查詢路線及抵達時間`}
              onClick={() => onOpen(op)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(op); } }}
            >
              <div className="transport-col__head">
                <span className="transport-col__dot" />
                <span className="transport-col__title">{LINE_LABELS[op]}</span>
              </div>
              {items === null ? (
                <div className="skeleton skeleton--line" />
              ) : items.length === 0 ? (
                <div className="state-msg">暫無資料</div>
              ) : (
                items.map((it, i) => {
                  const bad = /延誤|故障|暫停|closed|delay|suspend/i.test(it.status);
                  return (
                    <div className="transport-item" key={i}>
                      <span className="transport-item__route">{it.route}</span>
                      <span className={`transport-item__status ${bad ? 'is-bad' : ''}`}>{it.status}</span>
                    </div>
                  );
                })
              )}
              <div className="transport-col__hint">查詢路線及抵達時間 <ArrowIcon size={14} /></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
