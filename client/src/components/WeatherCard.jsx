import React from 'react';
import { WeatherIcon, WarnIcon, SunIcon } from '../icons.jsx';

export default function WeatherCard({ data, error, loading }) {
  if (loading) {
    return (
      <section className="card card--weather" id="weather" aria-labelledby="weather-title">
        <div className="card__head"><h2 id="weather-title"><SunIcon size={18} /> 天氣預報</h2></div>
        <div className="skeleton skeleton--current" role="status"><span className="visually-hidden">載入中…</span></div>
        <div className="forecast__list">{Array.from({ length: 7 }, (_, i) => <div key={i} className="skeleton skeleton--line" />)}</div>
      </section>
    );
  }
  if (error || !data) {
    return (
      <section className="card card--weather" id="weather" aria-labelledby="weather-title">
        <div className="card__head"><h2 id="weather-title"><SunIcon size={18} /> 天氣預報</h2></div>
        <div className="state-msg state-msg--error"><WarnIcon /> <span>無法載入天氣資料</span></div>
      </section>
    );
  }
  const c = data.current;
  return (
    <section className="card card--weather" id="weather" aria-labelledby="weather-title">
      <div className="card__head">
        <h2 id="weather-title"><SunIcon size={18} /> 天氣預報</h2>
        <span className="card__badge">香港</span>
      </div>
      <div className="current-weather" aria-live="polite">
        <div className="current-weather__icon"><WeatherIcon code={c.icon} /></div>
        <div className="current-weather__body">
          <div className="current-weather__temp">{c.temp ?? '—'}°C</div>
          <div className="current-weather__desc">{c.desc}</div>
          <div className="current-weather__meta">
            <span className="chip">濕度 {c.humidity ?? '—'}%</span>
            {c.wind && <span className="chip">風 {c.wind} {c.speed ?? ''}km/h</span>}
            {c.rain !== null && c.rain !== undefined && <span className="chip">雨量 {c.rain}mm</span>}
          </div>
          {c.warnings?.length > 0 && (
            <div className="weather-warning">
              {c.warnings.map((w, i) => <div key={i} className="warning-badge">{w}</div>)}
            </div>
          )}
          {data.rainDistricts?.length > 0 && (
            <div className="rain-districts">
              <span className="rain-districts__label">分區雨量</span>
              {data.rainDistricts.slice(0, 4).map((r, i) => (
                <span key={i} className="chip chip--rain">{r.place} {r.max}mm</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="forecast">
        <h3 className="forecast__title">未來 7 天預報</h3>
        <div className="forecast__list" aria-live="polite">
          {(data.forecast || []).map((d, i) => (
            <div className="forecast-day" key={i}>
              <div className="forecast-day__date">{d.dayLabel}</div>
              <div className="forecast-day__icon"><WeatherIcon code={d.icon} size={32} /></div>
              <div className="forecast-day__temp">{d.temp_max ?? '—'}° <span>{d.temp_min ?? '—'}°</span></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
