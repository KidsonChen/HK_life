// 後端設定：對應真實開放 API 端點（香港天文台 / DATA.GOV.HK）
// demo=true 時強制全部使用示範資料；false 時僅在上游失敗才 fallback。
export const CONFIG = {
  demo: process.env.HK_DEMO === '1' || process.env.HK_DEMO === 'true',
  port: process.env.PORT || 3001,
  weather: {
    rhrread: 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc',
    fnd: 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=tc'
  },
  traffic: {
    datastore: 'https://data.gov.hk/api/action/datastore_search',
    incidentResourceId: 'c61c7896-9b13-40b8-9d23-1e4fc4069e8c',
    accidentResourceId: 'b7bd05c5-3a79-4a8d-9725-d3a76c6c2e7d'
  },
  transport: {
    citybus: {
      baseUrl: 'https://rt.data.gov.hk/v2/transport/citybus',
      company: 'CTB'
    },
    // 官方 dataset: hk-td-tis_21-etakmb（九巴及龍運實時到站）
    kmb: {
      baseUrl: 'https://data.etabus.gov.hk/v1/transport/kmb'
    },
    // 官方 dataset: mtr-data2-nexttrain-data（港鐵實時列車）
    mtrHeavy: {
      baseUrl: 'https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php'
    },
    mtrLrt: {
      baseUrl: 'https://rt.data.gov.hk/v1/transport/mtr/lrt'
    }
  },
  // 快取秒數
  cacheTtl: 30
};

// 港鐵重鐵各線與車站（Next Train API 官方代碼）
export const MTR_LINES = [
  {
    code: 'TWL', name: '荃灣線', termini: '荃灣 ⇄ 中環', color: '#E60012',
    stations: [
      ['CEN', '中環'], ['ADM', '金鐘'], ['TST', '尖沙咀'], ['JOR', '佐敦'], ['YMT', '油麻地'],
      ['MOK', '旺角'], ['PRE', '太子'], ['SSP', '深水埗'], ['CSW', '長沙灣'], ['LCK', '荔枝角'],
      ['MEF', '美孚'], ['LAK', '荔景'], ['KWF', '葵芳'], ['KWH', '葵興'], ['TWH', '大窩口'], ['TSW', '荃灣']
    ]
  },
  {
    code: 'KTL', name: '觀塘線', termini: '黃埔 ⇄ 調景嶺', color: '#00A040',
    stations: [
      ['WHA', '黃埔'], ['HOM', '何文田'], ['YMT', '油麻地'], ['MOK', '旺角'], ['PRE', '太子'],
      ['SKM', '石硤尾'], ['KOT', '九龍塘'], ['LOF', '樂富'], ['WTS', '黃大仙'], ['DIH', '鑽石山'],
      ['CHH', '彩虹'], ['KOB', '九龍灣'], ['NTK', '牛頭角'], ['KWT', '觀塘'], ['LAT', '藍田'],
      ['YAT', '油塘'], ['TIK', '調景嶺']
    ]
  },
  {
    code: 'ISL', name: '港島線', termini: '堅尼地城 ⇄ 柴灣', color: '#0860A8',
    stations: [
      ['KET', '堅尼地城'], ['HKU', '香港大學'], ['SYP', '西營盤'], ['SHW', '上環'], ['CEN', '中環'],
      ['ADM', '金鐘'], ['WAC', '灣仔'], ['CAB', '銅鑼灣'], ['TIH', '天后'], ['FOH', '炮台山'],
      ['NOP', '北角'], ['QUB', '鰂魚涌'], ['TAK', '太古'], ['SWH', '西灣河'], ['SKW', '筲箕灣'],
      ['HFC', '杏花邨'], ['CHW', '柴灣']
    ]
  },
  {
    code: 'TKL', name: '將軍澳線', termini: '北角 ⇄ 寶琳/康城', color: '#7D499D',
    stations: [
      ['NOP', '北角'], ['QUB', '鰂魚涌'], ['YAT', '油塘'], ['TIK', '調景嶺'], ['TKO', '將軍澳'],
      ['LHP', '康城'], ['HAH', '坑口'], ['POA', '寶琳']
    ]
  },
  {
    code: 'TML', name: '屯馬線', termini: '烏溪沙 ⇄ 屯門', color: '#9C2E00',
    stations: [
      ['WKS', '烏溪沙'], ['MOS', '馬鞍山'], ['HEO', '恆安'], ['TSH', '大水坑'], ['SHM', '石門'],
      ['CIO', '第一城'], ['STW', '沙田圍'], ['CKT', '車公廟'], ['TAW', '大圍'], ['HIK', '顯徑'],
      ['DIH', '鑽石山'], ['KAT', '啟德'], ['SUW', '宋皇臺'], ['TKW', '土瓜灣'], ['HOM', '何文田'],
      ['HUH', '紅磡'], ['ETS', '尖東'], ['AUS', '柯士甸'], ['NAC', '南昌'], ['MEF', '美孚'],
      ['TWW', '荃灣西'], ['KSR', '錦上路'], ['YUL', '元朗'], ['LOP', '朗屏'], ['TIS', '天水圍'],
      ['SIH', '兆康'], ['TUM', '屯門']
    ]
  },
  {
    code: 'EAL', name: '東鐵線', termini: '金鐘 ⇄ 羅湖/落馬洲', color: '#5EB7E8',
    stations: [
      ['ADM', '金鐘'], ['EXC', '會展'], ['HUH', '紅磡'], ['MKK', '旺角東'], ['KOT', '九龍塘'],
      ['TAW', '大圍'], ['SHT', '沙田'], ['FOT', '火炭'], ['RAC', '馬場'], ['UNI', '大學'],
      ['TAP', '大埔墟'], ['TWO', '太和'], ['FAN', '粉嶺'], ['SHS', '上水'], ['LOW', '羅湖'], ['LMC', '落馬洲']
    ]
  },
  {
    code: 'SIL', name: '南港島線', termini: '金鐘 ⇄ 海怡半島', color: '#CBD300',
    stations: [
      ['ADM', '金鐘'], ['OCP', '海洋公園'], ['WCH', '黃竹坑'], ['LET', '利東'], ['SOH', '海怡半島']
    ]
  },
  {
    code: 'TCL', name: '東涌線', termini: '香港 ⇄ 東涌', color: '#F7943E',
    stations: [
      ['HOK', '香港'], ['KOW', '九龍'], ['OLY', '奧運'], ['NAC', '南昌'], ['LAK', '荔景'],
      ['TSY', '青衣'], ['SUN', '欣澳'], ['TUC', '東涌']
    ]
  },
  {
    code: 'AEL', name: '機場快線', termini: '香港 ⇄ 博覽館', color: '#00888E',
    stations: [
      ['HOK', '香港'], ['KOW', '九龍'], ['TSY', '青衣'], ['AIR', '機場'], ['AWE', '博覽館']
    ]
  },
  {
    code: 'DRL', name: '迪士尼線', termini: '欣澳 ⇄ 迪士尼', color: '#EB6EA5',
    stations: [
      ['SUN', '欣澳'], ['DIS', '迪士尼']
    ]
  }
];

// 全域車站代碼 → 中文名（供目的地顯示）
export const MTR_STATION_NAMES = Object.fromEntries(
  MTR_LINES.flatMap(l => l.stations)
);

export const LRT_STATIONS = [
  { id: '010', name: '元朗' }, { id: '020', name: '大棠路' }, { id: '030', name: '康樂路' },
  { id: '040', name: '屏山' }, { id: '050', name: '水邊圍' }, { id: '060', name: '豐年路' },
  { id: '070', name: '天耀' }, { id: '080', name: '樂湖' }, { id: '090', name: '天瑞' },
  { id: '100', name: '翠湖' }, { id: '110', name: '天榮' }, { id: '120', name: '天悅' },
  { id: '130', name: '天秀' }, { id: '140', name: '濕地公園' }, { id: '150', name: '天恆' },
  { id: '160', name: '天逸' }, { id: '170', name: '天富' }, { id: '180', name: '頌富' }
];
