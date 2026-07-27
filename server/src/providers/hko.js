import { CONFIG } from '../config.js';

// 香港天文台：即時天氣 + 九天預報
export async function getWeather() {
  try {
    const [rhr, fnd] = await Promise.all([
      fetch(CONFIG.weather.rhrread).then(r => r.json()),
      fetch(CONFIG.weather.fnd).then(r => r.json())
    ]);
    return normalize(rhr, fnd);
  } catch (err) {
    console.error('[hko] 天氣獲取失敗:', err.message);
    return demo();
  }
}

function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }

function normalize(rhr, fnd) {
  // 新 API 格式：temperature.data[].value, humidity.data[].value
  const tempData = rhr?.temperature?.data || [];
  const temp = tempData.length > 0 ? tempData[0].value : null;

  const humidityData = rhr?.humidity?.data || [];
  const humidity = humidityData.length > 0 ? humidityData[0].value : null;

  // 雨量：找 main 為 TRUE 的（香港天文台總雨量）
  const rainfallData = rhr?.rainfall?.data || [];
  const mainRain = rainfallData.find(r => r.main === 'TRUE' || r.main === true);
  const rain = mainRain?.max ?? null;

  // 新 API 無 wind 欄位
  const wind = null;
  const speed = null;

  // 天氣警告
  const warnings = [];
  if (rhr?.warningMessage && typeof rhr.warningMessage === 'string' && rhr.warningMessage.trim()) {
    warnings.push(rhr.warningMessage.trim());
  }
  if (rhr?.tcmessage && typeof rhr.tcmessage === 'string' && rhr.tcmessage.trim()) {
    warnings.push(rhr.tcmessage.trim());
  }

  // 圖示：新 API 用數字代碼
  const iconCode = rhr?.icon?.[0];
  const icon = mapIcon(iconCode);

  // 描述
  const desc = rhr?.weatherDesc || '香港天文台觀測';

  // 九天預報
  const forecast = parseForecast(fnd);

  return {
    source: 'hko',
    current: {
      temp, humidity, rain, wind, speed,
      icon, desc, warnings
    },
    forecast
  };
}

function mapIcon(code) {
  if (!code && code !== 0) return '01d';
  const c = Number(code);
  // HKO icon codes: 50=晴, 51/52=雲, 53/54=雨, 60/61=雷暴, 62=雨, 64=雷暴, 70=風, 80=霧
  if ([60, 61, 64].includes(c)) return '11d';  // 雷暴
  if ([53, 54, 62].includes(c)) return '10d';  // 雨
  if ([51, 52].includes(c)) return '03d';      // 多雲
  if ([80, 81, 82].includes(c)) return '50d';  // 霧
  if ([70, 71].includes(c)) return '50d';      // 風
  if (c === 50) return '01d';                  // 晴
  if (c >= 90) return '01d';                   // 極端
  return '02d';                                 // 局部多雲
}

function parseForecast(fnd) {
  // HKO fnd 格式：weatherForecast 直接是陣列
  const details = Array.isArray(fnd?.weatherForecast) ? fnd.weatherForecast
    : (fnd?.weatherForecast?.forecastDetail || []);
  if (!details.length) return [];

  return details.slice(0, 7).map((d, i) => {
    // forecastDate: "20260728"
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

function demo() {
  const icons = ['01d', '02d', '03d', '10d', '10d', '04d', '01d'];
  const descs = ['晴朗', '局部多雲', '多雲', '有雨', '有雨', '陰', '晴朗'];
  const now = new Date();
  const forecast = icons.map((ic, i) => {
    const d = new Date(now); d.setDate(now.getDate() + i);
    return {
      dt: Math.floor(d.getTime() / 1000),
      dayLabel: d.toLocaleDateString('zh-HK', { weekday: 'short', day: 'numeric', month: 'short' }),
      icon: ic,
      desc: descs[i],
      temp_max: 27 + (i % 4),
      temp_min: 22 + (i % 3)
    };
  });
  return {
    source: 'demo',
    current: {
      temp: 26, humidity: 78, rain: 0, wind: '東', speed: 12,
      icon: '02d', desc: '局部多雲（示範資料）', warnings: []
    },
    forecast
  };
}