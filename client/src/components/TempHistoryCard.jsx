import React from 'react';

// 畫一條折線 SVG path（多序列共用座標系）
function buildPath(values, w, h, pad) {
  if (!values.length) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  return values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * innerW;
    const y = pad + innerH - ((v - min) / span) * innerH;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function Spark({ data, color, fill }) {
  const w = 300, h = 70, pad = 6;
  const values = data.map(d => d.value);
  const path = buildPath(values, w, h, pad);
  const min = Math.min(...values), max = Math.max(...values);
  const area = `${path} L${(w - pad).toFixed(1)},${(h - pad).toFixed(1)} L${pad},${(h - pad).toFixed(1)} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="氣溫走勢">
      {fill && <path d={area} fill={fill} opacity="0.15" />}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <text x={pad} y={pad + 8} className="spark__min">{min}°</text>
      <text x={pad} y={h - 2} className="spark__max">{max}°</text>
    </svg>
  );
}

export default function TempHistoryCard({ data, error, loading }) {
  if (loading) {
    return (
      <section className="card card--temp" aria-labelledby="temp-title">
        <div className="card__head"><h2 id="temp-title">氣溫走勢</h2></div>
        <div className="skeleton skeleton--block" role="status"><span className="visually-hidden">載入中…</span></div>
      </section>
    );
  }
  if (error || !data || !data.mean?.length) {
    return (
      <section className="card card--temp" aria-labelledby="temp-title">
        <div className="card__head"><h2 id="temp-title">氣溫走勢</h2></div>
        <div className="state-msg">{error ? '無法載入氣溫資料' : '暫無資料'}</div>
      </section>
    );
  }
  const latest = data.mean[data.mean.length - 1]?.value;
  const maxLatest = data.max[data.max.length - 1]?.value;
  const minLatest = data.min[data.min.length - 1]?.value;
  return (
    <section className="card card--temp" aria-labelledby="temp-title">
      <div className="card__head">
        <h2 id="temp-title">氣溫走勢</h2>
        <span className="card__hint">天文台站 · 近 30 天</span>
      </div>
      <div className="temp-summary">
        <div className="temp-summary__item"><span className="temp-summary__label">今日均溫</span><span className="temp-summary__val">{latest ?? '—'}°</span></div>
        <div className="temp-summary__item"><span className="temp-summary__label">最高</span><span className="temp-summary__val temp-summary__val--max">{maxLatest ?? '—'}°</span></div>
        <div className="temp-summary__item"><span className="temp-summary__label">最低</span><span className="temp-summary__val temp-summary__val--min">{minLatest ?? '—'}°</span></div>
      </div>
      <div className="spark-group">
        <div className="spark-row">
          <span className="spark-row__label spark-row__label--max">最高</span>
          <Spark data={data.max} color="#E6553A" fill="#E6553A" />
        </div>
        <div className="spark-row">
          <span className="spark-row__label spark-row__label--mean">平均</span>
          <Spark data={data.mean} color="#2E8BC0" fill="#2E8BC0" />
        </div>
        <div className="spark-row">
          <span className="spark-row__label spark-row__label--min">最低</span>
          <Spark data={data.min} color="#5BA152" fill="#5BA152" />
        </div>
      </div>
    </section>
  );
}
