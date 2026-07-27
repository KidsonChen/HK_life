// 香港生活資訊應用程式
'use strict';

// ===================================================================
// 設定 - 改用後端 server API
// ===================================================================
const API_BASE = '';

const LINE_LABELS = { citybus: '城巴', kmb: '九巴', mtr: '港鐵' };

// DOM 元素引用
const el = {
    currentWeather: document.getElementById('current-weather'),
    forecastList:   document.getElementById('forecast-list'),
    trafficMap:     document.getElementById('traffic-map'),
    citybus:        document.getElementById('citybus'),
    kmb:            document.getElementById('kmb'),
    mtr:            document.getElementById('mtr'),
    refreshBtn:     document.getElementById('refresh-btn')
};

// ===================================================================
// 工具函式
// ===================================================================
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c]));

function setBusy(node, busy) {
    if (node) node.setAttribute('aria-busy', busy ? 'true' : 'false');
}

function skeleton(lines = 1, cls = 'skeleton--line') {
    return Array.from({ length: lines }, () =>
        `<div class="skeleton ${cls}" role="status"><span class="visually-hidden">載入中…</span></div>`
    ).join('');
}

function errorState(message, onRetry) {
    const btn = onRetry
        ? `<button type="button" class="btn-retry" data-retry>${retryIcon()} 重試</button>` : '';
    return `<div class="state-msg state-msg--error">${warnIcon()} <span>${esc(message)}</span> ${btn}</div>`;
}

function emptyState(message) {
    return `<div class="state-msg">${esc(message)}</div>`;
}

// ===================================================================
// SVG 圖示
// ===================================================================
function weatherSVG(code) {
    const base = (code || '01d').slice(0, 2);
    const night = (code || '').endsWith('n');
    const sun = `<circle cx="12" cy="12" r="5" fill="currentColor"/>
        <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
        <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
        <line x1="4.5" y1="4.5" x2="6.5" y2="6.5"/><line x1="17.5" y1="17.5" x2="19.5" y2="19.5"/>
        <line x1="4.5" y1="19.5" x2="6.5" y2="17.5"/><line x1="17.5" y1="6.5" x2="19.5" y2="4.5"/></g>`;
    const moon = `<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z" fill="currentColor"/>`;
    const cloud = `<path d="M7 18a4 4 0 0 1 .5-7.97A5.5 5.5 0 0 1 18 11a3.5 3.5 0 0 1-.5 7H7z"
        fill="currentColor" fill-opacity=".85"/>`;
    const rain = `<g stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="8" y1="20" x2="7" y2="22"/><line x1="12" y1="20" x2="11" y2="22"/><line x1="16" y1="20" x2="15" y2="22"/></g>`;
    const bolt = `<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill="#FACC15" stroke="currentColor" stroke-width="1"/>`;
    const snow = `<g fill="currentColor"><circle cx="9" cy="20" r="1.2"/><circle cx="13" cy="21" r="1.2"/><circle cx="17" cy="20" r="1.2"/></g>`;
    const mist = `<g stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="4" y1="10" x2="20" y2="10"/><line x1="6" y1="14" x2="18" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></g>`;

    let inner;
    switch (base) {
        case '01': inner = night ? moon : sun; break;
        case '02': inner = `${cloud}<circle cx="9" cy="9" r="3" fill="currentColor"/>`; break;
        case '03': case '04': inner = cloud; break;
        case '09': inner = `${cloud}${rain}`; break;
        case '10': inner = `${cloud}${rain}`; break;
        case '11': inner = `${cloud}${bolt}`; break;
        case '13': inner = `${cloud}${snow}`; break;
        case '50': inner = mist; break;
        default: inner = sun;
    }
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
}

function retryIcon() {
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>`;
}
function warnIcon() {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
}

// ===================================================================
// 天氣（透過後端 server API）
// ===================================================================
async function fetchWeather() {
    setBusy(el.currentWeather, true);
    setBusy(el.forecastList, true);
    el.currentWeather.innerHTML = `<div class="skeleton skeleton--current"></div>`;
    el.forecastList.innerHTML = skeleton(7);
    try {
        const res = await fetch(`${API_BASE}/api/weather`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        updateCurrentWeather(d.current);
        updateForecast(d.forecast);
    } catch (err) {
        console.error('天氣數據獲取失敗:', err);
        el.currentWeather.innerHTML = errorState('無法載入天氣資料', fetchWeather);
        el.forecastList.innerHTML = '';
    } finally {
        setBusy(el.currentWeather, false);
        setBusy(el.forecastList, false);
    }
}

function updateCurrentWeather(data) {
    if (!data) return;

    const temp = data.temp ?? '—';
    const humidity = data.humidity ?? '—';
    const rain = data.rain ?? '—';
    const wind = data.wind ?? '';
    const speed = data.speed ?? '';
    const icon = data.icon || '01d';
    const desc = data.desc || '香港天文台觀測';
    const warnings = data.warnings || [];

    let warningHtml = '';
    if (warnings.length > 0) {
        warningHtml = `<div class="weather-warning">
            ${warnings.map(w =>
                `<div class="warning-badge">⚠️ ${esc(w)}</div>`
            ).join('')}
        </div>`;
    }

    const windStr = wind ? `${esc(String(wind))} ${esc(String(speed))}km/h` : '—';

    el.currentWeather.innerHTML = `
        <div class="current-weather__icon">${weatherSVG(icon)}</div>
        <div class="current-weather__body">
            <div class="current-weather__temp">${esc(String(temp))}°C</div>
            <div class="current-weather__desc">${esc(desc)}</div>
            <div class="current-weather__meta">
                <span class="chip">濕度 ${esc(String(humidity))}%</span>
                <span class="chip">風 ${windStr}</span>
                <span class="chip">雨量 ${esc(String(rain))}mm</span>
            </div>
            ${warningHtml}
        </div>`;
}

function updateForecast(forecast) {
    if (!forecast || !forecast.length) {
        el.forecastList.innerHTML = emptyState('暫無天氣預報');
        return;
    }

    el.forecastList.innerHTML = forecast.slice(0, 7).map(item => {
        const d = new Date(item.dt * 1000);
        const date = d.toLocaleDateString('zh-HK', { weekday: 'short', day: 'numeric', month: 'short' });
        const lo = Math.round(item.temp_min ?? item.main?.temp_min ?? 0);
        const hi = Math.round(item.temp_max ?? item.main?.temp_max ?? 0);
        const icon = item.icon || (item.weather?.[0]?.icon) || '02d';
        return `<div class="forecast-day">
            <div class="forecast-day__date">${esc(date)}</div>
            <div class="forecast-day__icon">${weatherSVG(icon)}</div>
            <div class="forecast-day__temp">${hi}° <span>${lo}°</span></div>
        </div>`;
    }).join('');
}

// ===================================================================
// 交通（透過後端 server API）
// ===================================================================
async function fetchTraffic() {
    setBusy(el.trafficMap, true);
    el.trafficMap.innerHTML = `<div class="skeleton skeleton--block"></div>`;
    try {
        const res = await fetch(`${API_BASE}/api/traffic`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        updateTraffic(d.items);
    } catch (err) {
        console.error('交通數據獲取失敗:', err);
        el.trafficMap.innerHTML = errorState('無法載入交通資料', fetchTraffic);
    } finally {
        setBusy(el.trafficMap, false);
    }
}

function trafficSeverity(status) {
    const s = (status || '').toLowerCase();
    if (/塞|擠|封|closed|jam|congest/.test(s)) return 'traffic-item--bad';
    if (/慢|緩|delay|slow/.test(s)) return 'traffic-item--warn';
    return '';
}

function updateTraffic(items) {
    if (!items || !items.length) {
        el.trafficMap.innerHTML = emptyState('目前沒有交通事件');
        return;
    }

    el.trafficMap.innerHTML = items.map(item => `
        <div class="traffic-item ${trafficSeverity(item.status)}">
            <span class="traffic-item__road">${esc(item.road)}</span>
            <span class="traffic-item__status">${esc(item.status)}</span>
        </div>`).join('');
}

// ===================================================================
// 運輸（透過後端 server API）
// ===================================================================
async function fetchTransport() {
    await Promise.all([fetchCitybus(), fetchKMB(), fetchMTR()]);
}

function transportShell(node, line) {
    setBusy(node, true);
    const label = LINE_LABELS[line] || '路線';
    node.innerHTML = `<div class="transport-col__head">
            <span class="transport-col__dot"></span>
            <span class="transport-col__title">${label}</span>
        </div>${skeleton(3)}`;
}

async function fetchCitybus() {
    transportShell(el.citybus, 'citybus');
    try {
        const res = await fetch(`${API_BASE}/api/transport/citybus/routes`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        const routes = (d || []).slice(0, 6).map(r => ({
            route: r.route,
            status: '正常運行'
        }));
        updateTransport(el.citybus, routes);
    } catch (err) {
        console.error('城巴數據獲取失敗:', err);
        el.citybus.insertAdjacentHTML('beforeend', errorState('無法載入城巴資料', fetchCitybus));
    } finally { setBusy(el.citybus, false); }
}

async function fetchKMB() {
    transportShell(el.kmb, 'kmb');
    try {
        const res = await fetch(`${API_BASE}/api/transport/kmb/routes`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        const routes = (d || []).slice(0, 6).map(r => ({
            route: r.route,
            status: '正常運行'
        }));
        updateTransport(el.kmb, routes);
    } catch (err) {
        console.error('九巴數據獲取失敗:', err);
        el.kmb.insertAdjacentHTML('beforeend', errorState('無法載入九巴資料', fetchKMB));
    } finally { setBusy(el.kmb, false); }
}

async function fetchMTR() {
    transportShell(el.mtr, 'mtr');
    try {
        const res = await fetch(`${API_BASE}/api/transport/mtr/routes`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        const lines = (d || []).slice(0, 6).map(r => ({
            line: r.name || r.code,
            status: '正常運行'
        }));
        updateTransport(el.mtr, lines);
    } catch (err) {
        console.error('港鐵數據獲取失敗:', err);
        el.mtr.insertAdjacentHTML('beforeend', errorState('無法載入港鐵資料', fetchMTR));
    } finally { setBusy(el.mtr, false); }
}

function updateTransport(node, items) {
    const label = node.querySelector('.transport-col__title')?.textContent || '';
    const hint = `<div class="transport-col__hint">查詢路線及抵達時間
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></div>`;
    if (!items || items.length === 0) {
        node.innerHTML = `<div class="transport-col__head">
            <span class="transport-col__dot"></span>
            <span class="transport-col__title">${label}</span></div>${emptyState('暫無資料')}${hint}`;
        return;
    }
    const rows = items.map(it => {
        const route = it.route || it.line || '路線';
        const status = it.status || '正常運行';
        const bad = /延誤|故障|暫停|closed|delay|suspend/.test(status);
        return `<div class="transport-item">
            <span class="transport-item__route">${esc(route)}</span>
            <span class="transport-item__status ${bad ? 'is-bad' : ''}">${esc(status)}</span>
        </div>`;
    }).join('');
    node.innerHTML = `<div class="transport-col__head">
        <span class="transport-col__dot"></span>
        <span class="transport-col__title">${label}</span></div>${rows}${hint}`;
}

// ===================================================================
// 初始化
// ===================================================================
function refreshAll() {
    el.refreshBtn?.classList.add('is-loading');
    Promise.allSettled([fetchWeather(), fetchTraffic(), fetchTransport()])
        .finally(() => setTimeout(() => el.refreshBtn?.classList.remove('is-loading'), 600));
}

document.addEventListener('DOMContentLoaded', () => {
    refreshAll();
    el.refreshBtn?.addEventListener('click', refreshAll);

    // 運輸卡片點擊 → 開啟詳細查詢
    [el.citybus, el.kmb, el.mtr].forEach(node => {
        node?.addEventListener('click', () => openModal(node.dataset.line));
        node?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(node.dataset.line); }
        });
        if (node) node.setAttribute('role', 'button');
        if (node) node.setAttribute('tabindex', '0');
    });

    // 重試按鈕（事件委派）
    document.addEventListener('click', (e) => {
        const retry = e.target.closest('[data-retry]');
        if (retry) {
            const fn = retry.closest('.state-msg')?.parentElement;
            if (fn === el.currentWeather) fetchWeather();
            else if (fn === el.trafficMap) fetchTraffic();
            else if (fn === el.citybus) fetchCitybus();
            else if (fn === el.kmb) fetchKMB();
            else if (fn === el.mtr) fetchMTR();
        }
    });
});

// ===================================================================
// 運輸詳細查詢（保留原始邏輯，使用後端 API）
// ===================================================================
const OPERATORS = {
    citybus: { label: '城巴', color: 'var(--line-citybus)', type: 'bus', company: 'CTB' },
    kmb:     { label: '九巴', color: 'var(--line-kmb)',     type: 'bus' },
    mtr:     { label: '港鐵', color: 'var(--line-mtr)',     type: 'mtr' }
};

const modal = {
    root: document.getElementById('route-modal'),
    operatorEl: document.getElementById('modal-operator'),
    titleEl: document.getElementById('modal-title'),
    search: document.getElementById('route-search'),
    dirBtns: document.querySelectorAll('.dir-btn'),
    routeList: document.getElementById('route-list'),
    stopPane: document.getElementById('stop-pane'),
    stopBack: document.getElementById('stop-back'),
    stopTitle: document.getElementById('stop-pane-title'),
    stopList: document.getElementById('stop-list'),
    current: { op: null, route: null, dir: 'outbound', mtrMode: null },
    lastFocus: null
};

function openModal(op) {
    const cfg = OPERATORS[op];
    if (!cfg) return;
    modal.current = { op, route: null, dir: 'outbound', mtrMode: null };
    modal.lastFocus = document.activeElement;
    modal.operatorEl.textContent = cfg.label;
    modal.operatorEl.style.setProperty('--line-color', cfg.color);
    modal.root.style.setProperty('--line-color', cfg.color);
    modal.titleEl.textContent = cfg.type === 'mtr' ? '港鐵查詢' : '路線查詢';
    modal.search.value = '';
    modal.dirBtns.forEach(b => b.classList.toggle('is-active', b.dataset.dir === 'outbound'));
    modal.search.style.display = cfg.type === 'mtr' ? 'none' : '';
    modal.dirBtns.forEach(b => b.closest('.modal__dir').style.display = cfg.type === 'mtr' ? 'none' : '');
    showRouteList();
    modal.root.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => modal.search.focus(), 60);
}

function closeModal() {
    stopEtaAutoRefresh();
    modal.root.hidden = true;
    document.body.style.overflow = '';
    modal.lastFocus?.focus();
}

function showRouteList() {
    stopEtaAutoRefresh();
    modal.stopPane.hidden = true;
    modal.routeList.hidden = false;
    modal.current.route = null;
    renderRouteList('');
}

async function renderRouteList(query) {
    const { op } = modal.current;
    const cfg = OPERATORS[op];
    modal.routeList.innerHTML = `<div class="skeleton skeleton--line"></div>`;

    let routes = [];
    let note = null;

    if (cfg.type === 'mtr') {
        renderMtrLines();
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/transport/${op}/routes`);
        if (res.ok) {
            routes = await res.json();
        } else {
            throw new Error(`HTTP ${res.status}`);
        }
    } catch (err) {
        console.error('路線清單獲取失敗:', err);
        routes = [];
        note = '即時路線清單暫時無法取得。';
    }

    const q = query.trim();
    if (q) routes = routes.filter(r => (r.route || '').toUpperCase().includes(q.toUpperCase()));
    if (!routes.length) { modal.routeList.innerHTML = emptyState('找不到相關路線'); return; }

    modal.routeList.innerHTML = (note ? `<div class="note-banner">${esc(note)}</div>` : '') +
        routes.slice(0, 60).map(r => `
        <button type="button" class="route-card" data-route="${esc(r.route)}">
            <span class="route-card__no">${esc(r.route)}</span>
            <span class="route-card__info">
                <span class="route-card__orig">${esc(r.orig || '')} →</span>
                <span class="route-card__dest">${esc(r.dest || '')}</span>
            </span>
            <span class="route-card__arrow">${arrowIcon()}</span>
        </button>`).join('');
}

function arrowIcon() {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;
}

function renderMtrLines() {
    stopEtaAutoRefresh();
    modal.routeList.hidden = true;
    modal.stopPane.hidden = false;
    modal.stopTitle.textContent = '選擇服務類別';
    modal.stopList.innerHTML = `
        <button type="button" class="stop-card" data-mtr-mode="heavy">
            <span class="stop-card__name">🚇 重鐵（市區線）</span>
            <span class="route-card__arrow">${arrowIcon()}</span>
        </button>
        <button type="button" class="stop-card" data-mtr-mode="lrt">
            <span class="stop-card__name">🚈 輕鐵（新界西北）</span>
            <span class="route-card__arrow">${arrowIcon()}</span>
        </button>`;
}

// 表格式資料（靜態，因為後端 API 提供）
const MTR_LINES = [
    { code: 'TWL', name: '荃灣線',  termini: '荃灣 ⇄ 中環',      color: '#E60012', freq: 2 },
    { code: 'KTL', name: '觀塘線',  termini: '調景嶺 ⇄ 黃埔',    color: '#658200', freq: 2 },
    { code: 'ISL', name: '港島線',  termini: '堅尼地城 ⇄ 柴灣',  color: '#0D6CBE', freq: 2 },
    { code: 'SSL', name: '南港島線', termini: '金鐘 ⇄ 海怡半島', color: '#B69E78', freq: 4 },
    { code: 'TCL', name: '東涌線',  termini: '東涌 ⇄ 香港',      color: '#F4A300', freq: 4 },
    { code: 'AEL', name: '機場快線', termini: '博覽館 ⇄ 香港',   color: '#0EAEEA', freq: 10 },
    { code: 'TML', name: '屯馬線',  termini: '烏溪沙 ⇄ 屯門',    color: '#9B3B8F', freq: 3 },
    { code: 'EAL', name: '東鐵線',  termini: '金鐘 ⇄ 羅湖/落馬洲', color: '#1FA65D', freq: 3 },
    { code: 'SIL', name: '將軍澳線', termini: '北角 ⇄ 寶琳',     color: '#A8CF38', freq: 3 },
    { code: 'DRL', name: '迪士尼線', termini: '欣澳 ⇄ 迪士尼',   color: '#FF74B4', freq: 8 }
];

const LRT_STATIONS = [
    { id: '010', name: '元朗' }, { id: '020', name: '大棠路' }, { id: '030', name: '康樂路' },
    { id: '040', name: '屏山' }, { id: '050', name: '水邊圍' }, { id: '060', name: '豐年路' },
    { id: '070', name: '天耀' }, { id: '080', name: '樂湖' }, { id: '090', name: '天瑞' },
    { id: '100', name: '翠湖' }, { id: '110', name: '天榮' }, { id: '120', name: '天悅' },
    { id: '130', name: '天秀' }, { id: '140', name: '濕地公園' }, { id: '150', name: '天恆' },
    { id: '160', name: '天逸' }, { id: '170', name: '天富' }, { id: '180', name: '頌富' }
];

function renderMtrHeavy() {
    modal.stopTitle.textContent = '重鐵路線 · 班次資訊';
    modal.stopList.innerHTML = `<div class="note-banner">
        <span>${warnIcon()}</span>
        <span>重鐵（市區線）無免費即時到站 API。以下為官方路線與參考班次；即時到站請用 MTR Mobile App。</span>
    </div>` + MTR_LINES.map(l => `
        <div class="route-card" style="cursor:default">
            <span class="route-card__no" style="background:${l.color}">${esc(l.code)}</span>
            <span class="route-card__info">
                <span class="route-card__dest">${esc(l.name)}</span>
                <span class="route-card__orig">${esc(l.termini)} · 約 ${l.freq} 分鐘一班</span>
            </span>
        </div>`).join('');
}

function renderLrtStations() {
    modal.routeList.hidden = true;
    modal.stopPane.hidden = false;
    modal.stopTitle.textContent = '選擇輕鐵站';
    modal.stopList.innerHTML = LRT_STATIONS.map(s => `
        <button type="button" class="stop-card" data-station="${s.id}">
            <span class="stop-card__name">${esc(s.name)}</span>
            <span class="route-card__arrow">${arrowIcon()}</span>
        </button>`).join('');
}

async function showStops(route, dir) {
    stopEtaAutoRefresh();
    const { op } = modal.current;
    const cfg = OPERATORS[op];
    modal.current.route = route;
    modal.routeList.hidden = true;
    modal.stopPane.hidden = false;
    modal.stopTitle.textContent = `${route} 號路線 · ${dir === 'inbound' ? '回程' : '去程'}`;
    modal.stopList.innerHTML = `<div class="skeleton skeleton--line"></div>`;

    let stops = [];
    try {
        const res = await fetch(`${API_BASE}/api/transport/${op}/stops?route=${encodeURIComponent(route)}&dir=${dir}`);
        if (res.ok) {
            stops = await res.json();
        } else {
            throw new Error(`HTTP ${res.status}`);
        }
    } catch (err) {
        console.error('站點清單獲取失敗:', err);
    }

    if (!stops.length) { modal.stopList.innerHTML = emptyState('此路線暫無站點資料'); return; }
    modal.stopList.innerHTML = stops.map(s => `
        <button type="button" class="stop-card" data-stop="${esc(s.id)}" data-name="${esc(s.name)}">
            <span class="stop-card__name">${esc(s.name)}</span>
            <span class="route-card__arrow">${arrowIcon()}</span>
        </button>`).join('');
}

async function showETA(stopId, stopName) {
    const { op, route, dir } = modal.current;
    modal.stopTitle.textContent = `抵達時間 · ${stopName}`;
    modal.stopList.innerHTML = `<div class="skeleton skeleton--line"></div>`;

    let etas = [];
    let note = null;

    try {
        const url = `${API_BASE}/api/transport/${op}/eta?stop=${encodeURIComponent(stopId)}${route ? '&route=' + encodeURIComponent(route) : ''}&dir=${dir}`;
        const res = await fetch(url);
        if (res.ok) {
            etas = await res.json();
        } else {
            throw new Error(`HTTP ${res.status}`);
        }
    } catch (err) {
        console.error('到站資料失敗:', err);
        note = '即時到站資料暫時無法取得。';
    }

    if (!etas.length) { modal.stopList.innerHTML = emptyState(note || '暫無到站資料'); return; }
    modal.stopList.innerHTML = (note ? `<div class="note-banner">${esc(note)}</div>` : '') +
        `<div class="eta-list">${etas.slice(0, 6).map(e => etaRow(e)).join('')}</div>`;
    startEtaAutoRefresh(stopId, stopName);
}

let etaRefreshTimer = null;
let etaCountdownTimer = null;
let etaRefreshCtx = null;

function startEtaAutoRefresh(stopId, stopName) {
    stopEtaAutoRefresh();
    etaRefreshCtx = { stopId, stopName };
    let secs = 30;
    const badge = document.createElement('div');
    badge.className = 'eta-refresh';
    badge.setAttribute('aria-live', 'polite');
    const titleEl = document.getElementById('stop-pane-title');
    if (titleEl) {
        badge.textContent = `每 30 秒自動更新 · ${secs}s`;
        titleEl.insertAdjacentElement('afterend', badge);
    }
    etaRefreshTimer = setInterval(() => {
        if (modal.root.hidden || !etaRefreshCtx) return;
        showETA(etaRefreshCtx.stopId, etaRefreshCtx.stopName);
    }, 30000);
    etaCountdownTimer = setInterval(() => {
        secs -= 1;
        if (secs <= 0) secs = 30;
        if (badge.isConnected) badge.textContent = `每 30 秒自動更新 · ${secs}s`;
    }, 1000);
}

function stopEtaAutoRefresh() {
    clearInterval(etaRefreshTimer); clearInterval(etaCountdownTimer);
    etaRefreshTimer = etaCountdownTimer = null;
    document.querySelector('.eta-refresh')?.remove();
}

function etaRow(e) {
    const soon = e.mins !== null && e.mins <= 3;
    const late = e.mins !== null && e.mins >= 15;
    const timeText = e.mins === null ? '到站' :
        (e.mins <= 0 ? '即將到站' : `${e.mins} 分鐘`);
    return `<div class="eta-row ${soon ? 'eta-row--soon' : ''} ${late ? 'eta-row--late' : ''}">
        <div>
            <div class="eta-row__dest">往 ${esc(e.dest || '')}</div>
            ${e.remark ? `<div class="eta-row__remark">${esc(e.remark)}</div>` : ''}
        </div>
        <div class="eta-row__time">
            <div class="eta-row__mins">${esc(timeText)}</div>
            <div class="eta-row__label">預計抵達</div>
        </div>
    </div>`;
}

// ===================================================================
// 彈窗事件委派
// ===================================================================
document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { closeModal(); return; }
    if (e.target.closest('#stop-back')) {
        if (modal.current.op === 'mtr') {
            if (modal.current.mtrMode) { modal.current.mtrMode = null; renderMtrLines(); }
            else showRouteList();
        } else { modal.stopPane.hidden = true; modal.routeList.hidden = false; }
        return;
    }
    const mtrMode = e.target.closest('[data-mtr-mode]');
    if (mtrMode) {
        modal.current.mtrMode = mtrMode.dataset.mtrMode;
        if (mtrMode.dataset.mtrMode === 'heavy') renderMtrHeavy();
        else renderLrtStations();
        return;
    }
    const dirBtn = e.target.closest('.dir-btn');
    if (dirBtn) {
        modal.dirBtns.forEach(b => b.classList.toggle('is-active', b === dirBtn));
        modal.current.dir = dirBtn.dataset.dir;
        if (modal.current.route) showStops(modal.current.route, modal.current.dir);
        else renderRouteList(modal.search.value);
        return;
    }
    const routeCard = e.target.closest('.route-card');
    if (routeCard) { showStops(routeCard.dataset.route, modal.current.dir); return; }
    const stopCard = e.target.closest('.stop-card');
    if (stopCard) {
        if (stopCard.dataset.station) showETA(stopCard.dataset.station, stopCard.querySelector('.stop-card__name')?.textContent || stopCard.dataset.station);
        else showETA(stopCard.dataset.stop, stopCard.dataset.name);
        return;
    }
});

modal.search?.addEventListener('input', (e) => renderRouteList(e.target.value));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.root.hidden) closeModal(); });