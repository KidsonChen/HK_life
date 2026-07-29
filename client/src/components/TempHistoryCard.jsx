import React from 'react';

// 溫度色階：冷藍 → 涼綠 → 暖橙 → 熱紅
function tempColor(temp) {
  // 範圍 15°C ~ 35°C
  const t = Math.max(15, Math.min(35, temp));
  const ratio = (t - 15) / 20; // 0 ~ 1
  // 四段插值
  const stops = [
    { p: 0,    c: [59, 130, 246] },   // 冷藍 #3B82F6
    { p: 0.35, c: [34, 197, 94] },    // 涼綠 #22C55E
    { p: 0.65, c: [249, 115, 22] },   // 暖橙 #F97316
    { p: 1,    c: [220, 38, 38] }     // 熱紅 #DC2626
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (ratio >= stops[i].p && ratio <= stops[i + 1].p) {
      lo = stops[i]; hi = stops[i + 1];
      break;
    }
  }
  const span = hi.p - lo.p || 1;
  const r = (lo.c[0] + (hi.c[0] - lo.c[0]) * (ratio - lo.p) / span) | 0;
  const g = (lo.c[1] + (hi.c[1] - lo.c[1]) * (ratio - lo.p) / span) | 0;
  const b = (lo.c[2] + (hi.c[2] - lo.c[2]) * (ratio - lo.p) / span) | 0;
  return `rgb(${r}, ${g}, ${b})`;
}

export default function TempHistoryCard({ data, error, loading }) {
  if (loading) {
    return (
      <section className="card card--temp" aria-labelledby="temp-title">
        <div className="card__head"><h2 id="temp-title">分區氣溫</h2></div>
        <div className="skeleton skeleton--block" role="status"><span className="visually-hidden">載入中…</span></div>
      </section>
    );
  }
  if (error || !data || !data.stations?.length) {
    return (
      <section className="card card--temp" aria-labelledby="temp-title">
        <div className="card__head"><h2 id="temp-title">分區氣溫</h2></div>
        <div className="state-msg">{error ? '無法載入分區氣溫' : '暫無資料'}</div>
      </section>
    );
  }

  const { summary, stations, observedAt, source } = data;
  const isDemo = source === 'demo';

  return (
    <section className="card card--temp" aria-labelledby="temp-title">
      <div className="card__head">
        <h2 id="temp-title">分區氣溫</h2>
        <span className="card__hint">全港 {summary.count} 站 · {observedAt || ''}{isDemo ? ' · 示範' : ''}</span>
      </div>

      {/* 摘要：最高 / 平均 / 最低 */}
      <div className="temp-summary">
        <div className="temp-summary__item">
          <span className="temp-summary__label">最高</span>
          <span className="temp-summary__val temp-summary__val--max">{summary.max}°</span>
          <span className="temp-summary__sub">{summary.maxStation?.zh}</span>
        </div>
        <div className="temp-summary__item">
          <span className="temp-summary__label">平均</span>
          <span className="temp-summary__val">{summary.mean}°</span>
          <span className="temp-summary__sub">全港 {summary.count} 站</span>
        </div>
        <div className="temp-summary__item">
          <span className="temp-summary__label">最低</span>
          <span className="temp-summary__val temp-summary__val--min">{summary.min}°</span>
          <span className="temp-summary__sub">{summary.minStation?.zh}</span>
        </div>
      </div>

      {/* 分區清單：按溫度排序，色階條 */}
      <div className="regional-list">
        {stations.map((s, i) => (
          <div className="regional-row" key={s.en}>
            <span className="regional-row__rank">{i + 1}</span>
            <span className="regional-row__name">
              <span className="regional-row__zh">{s.zh}</span>
              <span className="regional-row__en">{s.en}</span>
            </span>
            <span className="regional-row__bar">
              <span
                className="regional-row__bar-fill"
                style={{
                  width: `${Math.max(8, ((s.temp - summary.min) / Math.max(summary.max - summary.min, 1)) * 100)}%`,
                  background: tempColor(s.temp)
                }}
              />
            </span>
            <span className="regional-row__temp" style={{ color: tempColor(s.temp) }}>
              {s.temp}°
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}