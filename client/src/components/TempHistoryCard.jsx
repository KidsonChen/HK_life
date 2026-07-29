import React, { useState, useMemo } from 'react';

// 溫度色階：冷藍 → 涼綠 → 暖橙 → 熱紅
function tempColor(temp) {
  const t = Math.max(15, Math.min(35, temp));
  const ratio = (t - 15) / 20;
  const stops = [
    { p: 0,    c: [59, 130, 246] },
    { p: 0.35, c: [34, 197, 94] },
    { p: 0.65, c: [249, 115, 22] },
    { p: 1,    c: [220, 38, 38] }
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
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');

  const stations = data?.stations || [];
  const districts = data?.districts || [];
  const summary = data?.summary || null;
  const observedAt = data?.observedAt || '';
  const isDemo = data?.source === 'demo';

  // 篩選站點（hooks 必須在條件 return 之前呼叫）
  const filteredStations = useMemo(() => {
    if (selectedDistrict === 'ALL') return stations;
    return stations.filter(s => s.district === selectedDistrict);
  }, [stations, selectedDistrict]);

  // 篩選後的摘要
  const filteredSummary = useMemo(() => {
    if (selectedDistrict === 'ALL') return summary;
    if (!filteredStations.length) return null;
    const temps = filteredStations.map(s => s.temp);
    const hums = filteredStations.map(s => s.humidity).filter(v => v != null);
    return {
      max: Math.max(...temps),
      min: Math.min(...temps),
      mean: +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
      maxStation: filteredStations.find(s => s.temp === Math.max(...temps)),
      minStation: filteredStations.find(s => s.temp === Math.min(...temps)),
      count: filteredStations.length,
      humidity: hums.length ? +(hums.reduce((a, b) => a + b, 0) / hums.length).toFixed(0) : null
    };
  }, [filteredStations, summary, selectedDistrict]);

  const selectedDistrictName = selectedDistrict === 'ALL'
    ? '全港'
    : districts.find(d => d.code === selectedDistrict)?.name || '';

  if (loading) {
    return (
      <section className="card card--temp" aria-labelledby="temp-title">
        <div className="card__head"><h2 id="temp-title">分區氣溫</h2></div>
        <div className="skeleton skeleton--block" role="status"><span className="visually-hidden">載入中…</span></div>
      </section>
    );
  }
  if (error || !data || !stations.length) {
    return (
      <section className="card card--temp" aria-labelledby="temp-title">
        <div className="card__head"><h2 id="temp-title">分區氣溫</h2></div>
        <div className="state-msg">{error ? '無法載入分區氣溫' : '暫無資料'}</div>
      </section>
    );
  }

  return (
    <section className="card card--temp" aria-labelledby="temp-title">
      <div className="card__head">
        <h2 id="temp-title">分區氣溫</h2>
        <span className="card__hint">{selectedDistrictName} · {observedAt || ''}{isDemo ? ' · 示範' : ''}</span>
      </div>

      {/* 18 區選擇器 */}
      <div className="district-chips" role="group" aria-label="選擇區域">
        <button
          type="button"
          className={`district-chip ${selectedDistrict === 'ALL' ? 'is-active' : ''}`}
          onClick={() => setSelectedDistrict('ALL')}
        >
          全港
        </button>
        {districts?.map(d => (
          <button
            type="button"
            key={d.code}
            className={`district-chip ${selectedDistrict === d.code ? 'is-active' : ''}`}
            onClick={() => setSelectedDistrict(d.code)}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* 摘要：最高 / 平均 / 最低 */}
      {filteredSummary && (
        <div className="temp-summary">
          <div className="temp-summary__item">
            <span className="temp-summary__label">最高</span>
            <span className="temp-summary__val temp-summary__val--max">{filteredSummary.max}°</span>
            <span className="temp-summary__sub">{filteredSummary.maxStation?.zh}</span>
          </div>
          <div className="temp-summary__item">
            <span className="temp-summary__label">平均</span>
            <span className="temp-summary__val">{filteredSummary.mean}°</span>
            <span className="temp-summary__sub">
              {filteredSummary.humidity != null ? `濕度 ${filteredSummary.humidity}%` : `${filteredSummary.count} 站`}
            </span>
          </div>
          <div className="temp-summary__item">
            <span className="temp-summary__label">最低</span>
            <span className="temp-summary__val temp-summary__val--min">{filteredSummary.min}°</span>
            <span className="temp-summary__sub">{filteredSummary.minStation?.zh}</span>
          </div>
        </div>
      )}

      {/* 分區清單：按溫度排序，色階條 */}
      <div className="regional-list">
        {filteredStations.map((s, i) => (
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
            {s.humidity != null && (
              <span className="regional-row__humidity">{s.humidity}%</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}