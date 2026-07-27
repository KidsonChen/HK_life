// 運輸署「特別交通消息」XML（官方即時交通事件來源）
// https://resource.data.one.gov.hk/td/en/specialtrafficnews.xml
const STN_URL = 'https://resource.data.one.gov.hk/td/en/specialtrafficnews.xml';

export async function getTraffic() {
  try {
    const res = await fetch(STN_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseMessages(xml);
    if (!items.length) return demo();
    return { source: 'live', items };
  } catch (err) {
    console.error('[traffic] 獲取失敗:', err.message);
    return demo();
  }
}

// 輕量 XML 解析（不引入依賴）：抽出每個 <message> 的欄位
function parseMessages(xml) {
  const messages = [...xml.matchAll(/<message>([\s\S]*?)<\/message>/g)];
  return messages.map(m => {
    const block = m[1];
    const tag = (name) => {
      const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
      return match ? match[1].trim() : '';
    };
    const short = (tag('ChinShort') || tag('EngShort') || '').replace(/\s+/g, ' ');
    const full = (tag('ChinText') || tag('EngText') || short).trim();
    const status = Number(tag('CurrentStatus'));
    return {
      id: tag('msgID'),
      road: extractRoad(short),
      status: short,
      full,
      category: categorize(short),
      // CurrentStatus: 1=新事件, 2=已完結/解封, 3=更新中
      type: status === 2 ? 'resolved' : 'incident',
      time: tag('ReferenceDate').trim()
    };
  })
    // 只保留公路與港鐵事故（排除渡輪、內地鐵路、高鐵等）
    .filter(i => i.status && (i.category === 'road' || i.category === 'mtr'))
    .slice(0, 12);
}

// 分類：公路 / 港鐵 / 其他
function categorize(text) {
  // 先排除非本地鐵路與渡輪
  if (/內地鐵路|高速鐵路|高鐵|渡輪|航線|客運碼頭|班機/.test(text)) return 'other';
  if (/港鐵|東鐵|西鐵|屯馬|將軍澳綫|荃灣綫|觀塘綫|港島綫|南港島|東涌綫|機場快綫|輕鐵|地鐵/.test(text)) return 'mtr';
  if (/公路|隧道|幹線|大道|天橋|迴旋處|交匯處|橋|道|街|路/.test(text)) return 'road';
  return 'other';
}

// 從消息文字抽出道路名（顯示用途，抽不到就用前段文字）
function extractRoad(text) {
  // 去除常見前綴子句（因…、由於…、較早前…），再抓道路名
  const cleaned = text.replace(/^(較早前)?(因|由於)[^，,]*[，,]\s*/, '').replace(/^較早前/, '');
  // 排除「的/，/。」等字，確保「…封閉的屯門公路」只取「屯門公路」
  const m = cleaned.match(/([^\s，,。：:；;的]{2,8}(?:公路|隧道|幹線|大道|天橋|橋|道|街|路|綫|線))/);
  if (m) return m[1];
  return cleaned.slice(0, 12) || text.slice(0, 12);
}

function demo() {
  return {
    source: 'demo',
    items: [
      { id: 'd1', road: '紅磡海底隧道', status: '交通暢順', full: '紅磡海底隧道交通暢順。', category: 'road', type: 'incident', time: '' },
      { id: 'd2', road: '東區海底隧道', status: '交通暢順', full: '東區海底隧道交通暢順。', category: 'road', type: 'incident', time: '' },
      { id: 'd3', road: '西區海底隧道', status: '交通暢順', full: '西區海底隧道交通暢順。', category: 'road', type: 'incident', time: '' }
    ]
  };
}
