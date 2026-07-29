import { CONFIG } from '../config.js';

const jget = async (url) => {
  try { const r = await fetch(url); if (!r.ok) return null; return await r.json(); }
  catch { return null; }
};

const tget = async (url) => {
  try { const r = await fetch(url); if (!r.ok) return null; return await r.text(); }
  catch { return null; }
};

// 香港 18 區
const DISTRICTS = [
  { code: 'CW',   name: '中西區' },
  { code: 'WC',   name: '灣仔區' },
  { code: 'E',    name: '東區' },
  { code: 'S',    name: '南區' },
  { code: 'YTM',  name: '油尖旺區' },
  { code: 'SSP',  name: '深水埗區' },
  { code: 'KC',   name: '九龍城區' },
  { code: 'WTS',  name: '黃大仙區' },
  { code: 'KT',   name: '觀塘區' },
  { code: 'TW',   name: '荃灣區' },
  { code: 'TM',   name: '屯門區' },
  { code: 'YL',   name: '元朗區' },
  { code: 'N',    name: '北區' },
  { code: 'TP',   name: '大埔區' },
  { code: 'SK',   name: '西貢區' },
  { code: 'ST',   name: '沙田區' },
  { code: 'QT',   name: '葵青區' },
  { code: 'ISL',  name: '離島區' }
];

// 分區氣象站英中對照表
const STATION_ZH = {
  'Chek Lap Kok': '赤鱲角',
  'Cheung Chau': '長洲',
  'Clear Water Bay': '清水灣',
  'Happy Valley': '跑馬地',
  'HK Observatory': '香港天文台',
  'HK Park': '香港公園',
  'Kai Tak Runway Park': '啟德跑道公園',
  'Kau Sai Chau': '滘西洲',
  "King's Park": '京士柏',
  'Kowloon City': '九龍城',
  'Kwun Tong': '觀塘',
  'Lau Fau Shan': '流浮山',
  'Ngong Ping': '昂坪',
  'Pak Tam Chung': '北潭涌',
  'Peng Chau': '坪洲',
  'Sai Kung': '西貢',
  'Sha Tin': '沙田',
  'Sham Shui Po': '深水埗',
  'Shau Kei Wan': '筲箕灣',
  'Shek Kong': '石崗',
  'Sheung Shui': '上水',
  'Stanley': '赤柱',
  'Ta Kwu Ling': '打鼓嶺',
  'Tai Lung': '大隴',
  'Tai Mei Tuk': '大美督',
  'Tai Mo Shan': '大帽山',
  'Tai Po': '大埔',
  "Tate's Cairn": '大老山',
  'The Peak': '山頂',
  'Tseung Kwan O': '將軍澳',
  'Tsing Yi': '青衣',
  'Tsuen Wan Ho Koon': '荃灣可觀',
  'Tsuen Wan Shing Mun Valley': '荃灣城門谷',
  'Tuen Mun': '屯門',
  'Waglan Island': '橫瀾島',
  'Wetland Park': '濕地公園',
  'Wong Chuk Hang': '黃竹坑',
  'Wong Tai Sin': '黃大仙',
  'Yuen Long Park': '元朗公園'
};

// 氣象站 → 18 區代碼
const STATION_DISTRICT = {
  'Chek Lap Kok': 'ISL',
  'Cheung Chau': 'ISL',
  'Clear Water Bay': 'SK',
  'Happy Valley': 'WC',
  'HK Observatory': 'YTM',
  'HK Park': 'CW',
  'Kai Tak Runway Park': 'KC',
  'Kau Sai Chau': 'SK',
  "King's Park": 'YTM',
  'Kowloon City': 'KC',
  'Kwun Tong': 'KT',
  'Lau Fau Shan': 'YL',
  'Ngong Ping': 'ISL',
  'Pak Tam Chung': 'SK',
  'Peng Chau': 'ISL',
  'Sai Kung': 'SK',
  'Sha Tin': 'ST',
  'Sham Shui Po': 'SSP',
  'Shau Kei Wan': 'E',
  'Shek Kong': 'YL',
  'Sheung Shui': 'N',
  'Stanley': 'S',
  'Ta Kwu Ling': 'N',
  'Tai Lung': 'N',
  'Tai Mei Tuk': 'TP',
  'Tai Mo Shan': 'TW',
  'Tai Po': 'TP',
  "Tate's Cairn": 'ST',
  'The Peak': 'CW',
  'Tseung Kwan O': 'SK',
  'Tsing Yi': 'QT',
  'Tsuen Wan Ho Koon': 'TW',
  'Tsuen Wan Shing Mun Valley': 'TW',
  'Tuen Mun': 'TM',
  'Waglan Island': 'ISL',
  'Wetland Park': 'YL',
  'Wong Chuk Hang': 'S',
  'Wong Tai Sin': 'WTS',
  'Yuen Long Park': 'YL'
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

// 分區即時氣溫（最新一分鐘平均）— CSV 解析 + 18 區分組 + 濕度
export async function getRegionalTemp() {
  try {
    const [csv, rhr] = await Promise.all([
      tget(CONFIG.weather.regionalTemp),
      jget(CONFIG.weather.rhrread)
    ]);
    if (!csv) return demoRegionalTemp();
    return parseRegionalTempCsv(csv, rhr);
  } catch (err) {
    console.error('[hko] 分區氣溫失敗:', err.message);
    return demoRegionalTemp();
  }
}

function parseRegionalTempCsv(csv, rhr) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return demoRegionalTemp();

  // 解析時間戳（第一欄所有列相同）
  const firstData = lines[1].split(',');
  const dtRaw = firstData[0];
  let observedAt = null;
  if (dtRaw && /^\d{12}$/.test(dtRaw)) {
    const y = dtRaw.slice(0, 4), mo = dtRaw.slice(4, 6), d = dtRaw.slice(6, 8);
    const h = dtRaw.slice(8, 10), mi = dtRaw.slice(10, 12);
    observedAt = `${y}-${mo}-${d} ${h}:${mi}`;
  }

  // 從 rhrread 取得各站濕度（以中文站名對應）
  const humidityMap = {};
  if (rhr?.humidity?.data) {
    for (const h of rhr.humidity.data) {
      if (h.place && h.value != null) humidityMap[h.place] = h.value;
    }
  }
  // 天文台濕度作為全域 fallback
  const globalHumidity = humidityMap['香港天文台'] ?? null;

  const stations = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 3) continue;
    const en = (cols[1] || '').trim();
    const tempStr = (cols[2] || '').trim();
    const temp = num(tempStr);
    if (temp == null) continue; // 跳過 N/A
    const zh = STATION_ZH[en] || en;
    const district = STATION_DISTRICT[en] || null;
    // 濕度：優先該站，否則用全域
    const humidity = humidityMap[zh] ?? globalHumidity;
    stations.push({ en, zh, temp, humidity, district });
  }

  if (!stations.length) return demoRegionalTemp();

  // 排序：高 → 低
  stations.sort((a, b) => b.temp - a.temp);

  const temps = stations.map(s => s.temp);
  const max = Math.max(...temps);
  const min = Math.min(...temps);
  const mean = +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
  const maxStation = stations.find(s => s.temp === max);
  const minStation = stations.find(s => s.temp === min);

  // 18 區分組摘要
  const districts = DISTRICTS.map(d => {
    const ds = stations.filter(s => s.district === d.code);
    if (!ds.length) return { code: d.code, name: d.name, count: 0 };
    const dt = ds.map(s => s.temp);
    const dh = ds.map(s => s.humidity).filter(v => v != null);
    return {
      code: d.code,
      name: d.name,
      count: ds.length,
      tempMax: Math.max(...dt),
      tempMin: Math.min(...dt),
      tempMean: +(dt.reduce((a, b) => a + b, 0) / dt.length).toFixed(1),
      humidity: dh.length ? +(dh.reduce((a, b) => a + b, 0) / dh.length).toFixed(0) : null
    };
  }).filter(d => d.count > 0);

  return {
    source: 'hko',
    observedAt,
    stations,
    districts,
    summary: { max, min, mean, maxStation, minStation, count: stations.length }
  };
}

function demoRegionalTemp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const observedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const raw = [
    ['Tai Mo Shan', 21.7], ['The Peak', 24.5], ['Ngong Ping', 23.4], ["Tate's Cairn", 23.8],
    ['Lau Fau Shan', 26.9], ['Ta Kwu Ling', 26.9], ['Wetland Park', 25.9], ['Tai Mei Tuk', 25.9],
    ['HK Observatory', 27.4], ['King\'s Park', 26.6], ['HK Park', 26.9], ['Happy Valley', 28.1],
    ['Sha Tin', 27.8], ['Tai Po', 27.2], ['Sai Kung', 27.2], ['Clear Water Bay', 25.9],
    ['Tseung Kwan O', 26.4], ['Kwun Tong', 26.6], ['Kowloon City', 26.8], ['Sham Shui Po', 27.3],
    ['Wong Tai Sin', 27.4], ['Chek Lap Kok', 27.7], ['Tsing Yi', 27.4], ['Tuen Mun', 26.5],
    ['Yuen Long Park', 26.1], ['Stanley', 26.4], ['Cheung Chau', 26.0], ['Peng Chau', 26.8],
    ['Waglan Island', 26.2], ['Shau Kei Wan', 26.6]
  ];
  const stations = raw.map(([en, temp]) => ({
    en,
    zh: STATION_ZH[en] || en,
    temp,
    humidity: 80 + Math.round(Math.random() * 10),
    district: STATION_DISTRICT[en] || null
  })).sort((a, b) => b.temp - a.temp);
  const temps = stations.map(s => s.temp);
  const max = Math.max(...temps), min = Math.min(...temps);
  const mean = +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);

  const districts = DISTRICTS.map(d => {
    const ds = stations.filter(s => s.district === d.code);
    if (!ds.length) return null;
    const dt = ds.map(s => s.temp);
    const dh = ds.map(s => s.humidity).filter(v => v != null);
    return {
      code: d.code,
      name: d.name,
      count: ds.length,
      tempMax: Math.max(...dt),
      tempMin: Math.min(...dt),
      tempMean: +(dt.reduce((a, b) => a + b, 0) / dt.length).toFixed(1),
      humidity: dh.length ? +(dh.reduce((a, b) => a + b, 0) / dh.length).toFixed(0) : null
    };
  }).filter(Boolean);

  return {
    source: 'demo',
    observedAt,
    stations,
    districts,
    summary: {
      max, min, mean,
      maxStation: stations.find(s => s.temp === max),
      minStation: stations.find(s => s.temp === min),
      count: stations.length
    }
  };
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