const BASE = '/api';

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const api = {
  weather: () => getJson(`${BASE}/weather`),
  traffic: () => getJson(`${BASE}/traffic`),
  routes: (op) => getJson(`${BASE}/transport/${op}/routes`),
  stops: (op, route, dir) => getJson(`${BASE}/transport/${op}/stops?route=${encodeURIComponent(route)}&dir=${dir}`),
  eta: (op, { route, dir, stop, mode, line }) => {
    const q = new URLSearchParams({ stop });
    if (route) q.set('route', route);
    if (dir) q.set('dir', dir);
    if (mode) q.set('mode', mode);
    if (line) q.set('line', line);
    return getJson(`${BASE}/transport/${op}/eta?${q.toString()}`);
  },
  mtrLines: () => getJson(`${BASE}/mtr/lines`),
  lrtStations: () => getJson(`${BASE}/mtr/lrt-stations`)
};
