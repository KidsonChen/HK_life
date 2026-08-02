// 檢查示意圖座標品質：重疊站、過近站、非 0/45/90 度線段、線段穿站
import { SCHEMATIC as S, elbow } from '../client/src/mtrSchematic.js';

const res = await fetch('http://localhost:3007/api/mtr/lines');
const lines = await res.json();

const codes = Object.keys(S);
const all = new Set(lines.flatMap(l => l.stations.map(s => s[0])));

const missing = [...all].filter(c => !S[c]);
const extra = codes.filter(c => !all.has(c));

// 重疊 / 過近
const dup = [], near = [];
for (let i = 0; i < codes.length; i++) {
  for (let j = i + 1; j < codes.length; j++) {
    const a = S[codes[i]], b = S[codes[j]];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (d === 0) dup.push([codes[i], codes[j]]);
    else if (d < 3.4) near.push([codes[i], codes[j], +d.toFixed(2)]);
  }
}

// 展開 elbow 後的所有線段
function segsOf(line) {
  const st = line.stations.map(s => s[0]).filter(c => S[c]);
  const out = [];
  for (let i = 0; i < st.length - 1; i++) {
    const pts = elbow(S[st[i]], S[st[i + 1]]);
    for (let k = 0; k < pts.length - 1; k++) out.push({ a: pts[k], b: pts[k + 1], from: st[i], to: st[i + 1] });
  }
  return { st, out };
}

// 角度檢查（elbow 展開後）
const badAngle = [];
for (const l of lines) {
  for (const s of segsOf(l).out) {
    const dx = Math.abs(s.b[0] - s.a[0]), dy = Math.abs(s.b[1] - s.a[1]);
    if (dx === 0 || dy === 0 || Math.abs(dx - dy) < 1e-9) continue;
    badAngle.push(`${l.code} ${s.from}→${s.to} (dx=${dx},dy=${dy})`);
  }
}

// 線段穿過不屬於該線的車站
const through = [];
for (const l of lines) {
  const { st, out } = segsOf(l);
  const own = new Set(st);
  for (const s of out) {
    for (const c of codes) {
      if (own.has(c)) continue;
      const p = S[c];
      const cross = (s.b[0]-s.a[0])*(p[1]-s.a[1]) - (s.b[1]-s.a[1])*(p[0]-s.a[0]);
      if (Math.abs(cross) > 1e-6) continue;
      const dot = (p[0]-s.a[0])*(s.b[0]-s.a[0]) + (p[1]-s.a[1])*(s.b[1]-s.a[1]);
      const len2 = (s.b[0]-s.a[0])**2 + (s.b[1]-s.a[1])**2;
      if (dot > 0 && dot < len2) through.push(`${l.code} ${s.from}→${s.to} 穿過 ${c}`);
    }
  }
}

const ok = !missing.length && !extra.length && !dup.length && !near.length && !badAngle.length && !through.length;
console.log('缺漏站:', missing.length ? missing.join(',') : '無');
console.log('多餘站:', extra.length ? extra.join(',') : '無');
console.log('完全重疊:', dup.length ? JSON.stringify(dup) : '無');
console.log('過近(<3.4):', near.length ? JSON.stringify(near) : '無');
console.log('角度不合:', badAngle.length);
badAngle.forEach(x => console.log('   ', x));
console.log('線段穿站:', through.length);
through.slice(0, 20).forEach(x => console.log('   ', x));
console.log(ok ? '\nPASS' : '\nFAIL');
process.exit(ok ? 0 : 1);
