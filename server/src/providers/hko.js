import { CONFIG } from '../config.js';

const jget = async (url) => {
  try { const r = await fetch(url); if (!r.ok) return null; return await r.json(); }
  catch { return null; }
};

// 香港天文台：即時天氣 + 九天預報 + 各區雨量 + 警告
export async function getWeather() {
  const [rhr, fnd, warnsum, warningInfo, swt] = await Promise.all([
    jget(CONFIG.weather.rhrread),
    jget(CONFIG.weather.fnd),
    jget(CONFIG.weather.warnsum),
    jget(CONFIG.weather.warningInfo),
    jget(CONFIG.weather.swt)
  ]);

  // 若核心 rhrread 失敗則降級
  if (!rhr) return demo();
  return normalize(rhr, fnd, { warnsum, warningInfo, swt });
}

function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }

function normalize(rhr, fnd, extra = {}) {
  const tempData = rhr?.temperature?.data || [];
  const temp = tempData.length > 0 ? tempData[0].value : null;

  const humidityData = rhr?.humidity?.data || [];
  const humidity = humidityData.length > 0 ? humidityData[0].value : null;

  // 各區雨量（real-time 網格雨量替代：分區雨量）
  const rainfallData = rhr?.rainfall?.data || [];
  const rainDistricts = rainfallData
    .map(r => ({ place: r.place || r.place_en || '', max: num(r.max) }))
    .filter(r => r.max && r.max > 0)
    .sort((a, b) => b.max - a.max)
    .slice(0, 5);

  const wind = null;
  const speed = null;
  const iconCode = rhr?.icon?.[0];
  const icon = mapIcon(iconCode);
  const desc = rhr?.weatherDesc || '香港天文台觀測';

  // 警告彙整：rhrread.warningMessage + 專用端點
  const warnings = collectWarnings(rhr, extra);

  const forecast = parseForecast(fnd);

  return {
    source: 'hko',
    current: { temp, humidity, rain: rainDistricts[0]?.max ?? null, wind, speed, icon, desc, warnings },
    rainDistricts,
    forecast
  };
}

function collectWarnings(rhr, extra) {
  const out = [];
  const push = (txt) => { if (txt && typeof txt === 'string' && txt.trim()) out.push(txt.trim()); };

  // 1) rhrread 內嵌警告
  if (Array.isArray(rhr?.warningMessage)) rhr.warningMessage.forEach(push);
  else push(rhr?.warningMessage);
  push(rhr?.tcmessage);

  // 2) warnsum：各警告名稱
  const ws = extra?.warnsum;
  if (ws && typeof ws === 'object') {
    Object.values(ws).forEach(v => {
      if (v && v.name) push(v.name);
    });
  }

  // 3) warningInfo：詳細警告（含生效時間）
  const wi = extra?.warningInfo;
  if (wi && Array.isArray(wi.warningStatement)) {
    wi.warningStatement.forEach(s => { if (s?.headline) push(s.headline); });
  }

  // 4) swt 特別天氣提示
  const sw = extra?.swt;
  if (sw && Array.isArray(sw.swt)) {
    sw.swt.forEach(s => { if (s?.desc) push(s.desc); });
  }

  // 去重
  return [...new Set(out)];
}

function mapIcon(code) {
  if (!code && code !== 0) return '01d';
  const c = Number(code);
  if ([60, 61, 64].includes(c)) return '11d';
  if ([53, 54, 62].includes(c)) return '10d';
  if ([51, 52].includes(c)) return '03d';
  if ([80, 81, 82].includes(c)) return '50d';
  if ([70, 71].includes(c)) return '50d';
  if (c === 50) return '01d';
  if (c >= 90) return '01d';
  return '02d';
}

function parseForecast(fnd) {
  const details = Array.isArray(fnd?.weatherForecast) ? fnd.weatherForecast
    : (fnd?.weatherForecast?.forecastDetail || []);
  if (!details.length) return [];

  return details.slice(0, 7).map((d, i) => {
    let date = new Date();
    if (d.forecastDate && /^\d{8}$/.test(d.forecastDate)) {
      date = new Date(`${d.forecastDate.slice(0,4)}-${d.forecastDate.slice(4,6)}-${d.forecastDate.slice(6,8)}`);
    } else {
      date.setDate(date.getDate() + i);
    }
    const max = num(d.forecastMaxtemp?.value ?? d.max ?? d.forecastMax);
    const min = num(d.forecastMintemp?.value ?? d.min ?? d.forecastMin);
    return {
      dt: Math.floor(date.getTime() / 1000),
      dayLabel: date.toLocaleDateString('zh-HK', { weekday: 'short', day: 'numeric', month: 'short' }),
      icon: mapIcon(d.ForecastIcon),
      desc: d.forecastWeather ?? '',
      temp_max: max,
      temp_min: min
    };
  });
}

// 每日最高/平均/最低氣溫（天文台站）近 N 天走勢
export async function getTempHistory(days = 30) {
  try {
    const [mx, mn, mean] = await Promise.all([
      jget(`${CONFIG.weather.clm}?dataType=CLMMAXT&lang=tc&rformat=json&station=HKO`),
      jget(`${CONFIG.weather.clm}?dataType=CLMMINT&lang=tc&rformat=json&station=HKO`),
      jget(`${CONFIG.weather.clm}?dataType=CLMTEMP&lang=tc&rformat=json&station=HKO`)
    ]);
    if (!mean?.data?.length) return demoHistory();
    const take = (ds) => (ds?.data || []).slice(-days).map(r => ({
      date: `${r[0]}-${r[1].padStart(2,'0')}-${r[2].padStart(2,'0')}`,
      value: num(r[3])
    })).filter(x => x.value != null);
    return { source: 'hko', max: take(mx), min: take(mn), mean: take(mean) };
  } catch (err) {
    console.error('[hko] 氣溫走勢失敗:', err.message);
    return demoHistory();
  }
}

function demoHistory() {
  const now = new Date();
  const gen = (base, amp) => Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - (29 - i));
    return { date: d.toISOString().slice(0, 10), value: +(base + amp * Math.sin(i / 3)).toFixed(1) };
  });
  return { source: 'demo', max: gen(30, 2), min: gen(25, 1.5), mean: gen(27, 1.8) };
}

function demo() {
  const icons = ['01d', '02d', '03d', '10d', '10d', '04d', '01d'];
  const descs = ['晴朗', '局部多雲', '多雲', '有雨', '有雨', '陰', '晴朗'];
  const now = new Date();
  const forecast = icons.map((ic, i) => {
    const d = new Date(now); d.setDate(now.getDate() + i);
    return {
      dt: Math.floor(d.getTime() / 1000),
      dayLabel: d.toLocaleDateString('zh-HK', { weekday: 'short', day: 'numeric', month: 'short' }),
      icon: ic, desc: descs[i], temp_max: 27 + (i % 4), temp_min: 22 + (i % 3)
    };
  });
  return {
    source: 'demo',
    current: { temp: 26, humidity: 78, rain: 0, wind: '東', speed: 12, icon: '02d', desc: '局部多雲（示範資料）', warnings: [] },
    rainDistricts: [],
    forecast
  };
}
