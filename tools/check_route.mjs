// 驗證路線演算法：對照幾組已知案例
import { findRoute } from '../client/src/mtrTransfer.js';

const lines = await (await fetch('http://localhost:3007/api/mtr/lines')).json();
const nameMap = Object.fromEntries(lines.flatMap(l => l.stations));
const codeOf = Object.fromEntries(lines.flatMap(l => l.stations).map(([c, n]) => [n, c]));

const cases = [
  ['太和', '荔枝角'],
  ['荃灣', '柴灣'],
  ['屯門', '柴灣'],
  ['中環', '金鐘'],
  ['東涌', '將軍澳'],
  ['羅湖', '尖沙咀']
];

for (const [a, b] of cases) {
  const r = findRoute(lines, codeOf[a], codeOf[b]);
  if (!r) { console.log(`${a} → ${b}: 無結果`); continue; }
  const via = r.segments.slice(0, -1).map(s => s.to).join(', ');
  console.log(`${a} → ${b}: ${r.transfers}轉 ${r.totalStops}站 約${r.est}分` + (via ? ` [轉乘: ${via}]` : ''));
  r.segments.forEach(s => console.log(`     ${s.lineName} ${s.from}→${s.to} (${s.stops}站)`));
}
