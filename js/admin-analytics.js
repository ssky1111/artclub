/**
 * admin-analytics.js — 利用状況（管理者向け）
 * /admin/analytics … 管理者メールでログイン必須
 *
 * 自分（しゃお）と閲覧中の管理者は集計から除外する。
 */

import { SUPABASE_URL, SUPABASE_KEY } from './supabase.js';
import { getSession, getUser, ensureFreshSession } from './auth.js';
import { $, el } from './ui.js';
import { dateKey, addDays } from './storage.js';
import { t } from './i18n.js';

const ADMIN_EMAILS = ['yuisskweb@gmail.com', 'sayu.u.u.u.u@gmail.com'];

/** 解析から外すユーザーネーム（自分） */
const EXCLUDED_USERNAMES = new Set(['しゃお']);

const MODE_DEFS = [
  { key: 'daily', labelKey: 'analytics.modeDaily', color: '#1a1a1a' },
  { key: 'gesture', labelKey: 'analytics.modeGesture', color: '#5a9c1e' },
  { key: 'part', labelKey: 'analytics.modePart', color: '#c45c26' },
  { key: 'croquis', labelKey: 'analytics.modeCroquis', color: '#2a7a8c' },
  { key: 'copy', labelKey: 'analytics.modeCopy', color: '#8a6b4a' },
  { key: 'other', labelKey: 'analytics.modeOther', color: '#888888' },
];

const CHART_DAYS = 14;

let viewDate = dateKey();

function chartColors() {
  const text = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#111111';
  const muted = getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#666666';
  const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || text;
  return {
    total: text,
    users: accent || muted,
    modes: {
      daily: text,
      gesture: '#5a9c1e',
      part: '#c45c26',
      croquis: '#2a7a8c',
      copy: '#8a6b4a',
      other: muted,
    },
  };
}

function authHeaders(extra = {}) {
  const session = getSession();
  const token = session?.access_token || SUPABASE_KEY;
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

export function isAdminAnalyticsUser() {
  const u = getUser();
  return !!(u?.email && ADMIN_EMAILS.includes(u.email));
}

function normalizeMode(row) {
  const menuId = row.menu_id || row.payload?.menuId || '';
  if (menuId === 'daily') return 'daily';
  if (menuId === 'gestureMode') return 'gesture';
  if (menuId === 'croquisMode') return 'croquis';
  if (menuId === 'copyMode') return 'copy';
  if (String(menuId).startsWith('part-')) return 'part';
  return 'other';
}

function modeLabel(key) {
  const def = MODE_DEFS.find((m) => m.key === key);
  return def ? t(def.labelKey) : key;
}

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(Number(ts)).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${dateStr}（${wd}）`;
}

async function fetchSessions(fromDate, toDate) {
  await ensureFreshSession();
  if (!isAdminAnalyticsUser()) throw new Error('not admin');

  const params = new URLSearchParams({
    select: 'user_id,day_date,ts,menu_id,payload',
    day_date: `gte.${fromDate}`,
    order: 'day_date.desc,ts.desc',
    limit: '5000',
  });
  params.append('day_date', `lte.${toDate}`);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/practice_sessions?${params}`, {
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`fetch failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function fetchUsernames(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const params = new URLSearchParams({
    select: 'id,username',
    id: `in.(${ids.join(',')})`,
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?${params}`, {
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!res.ok) return new Map();
  const rows = await res.json();
  return new Map(rows.map((r) => [r.id, r.username || '']));
}

function isExcludedUser(userId, names) {
  const me = getUser()?.id;
  if (me && userId === me) return true;
  const name = String(names.get(userId) || '').trim().toLowerCase();
  return EXCLUDED_USERNAMES.has(name);
}

function filterExcluded(rows, names) {
  return rows.filter((row) => row.user_id && !isExcludedUser(row.user_id, names));
}

function emptyModeCounts() {
  return Object.fromEntries(MODE_DEFS.map((m) => [m.key, 0]));
}

function aggregateByUser(rows, day) {
  const byUser = new Map();
  for (const row of rows) {
    if (row.day_date !== day) continue;
    const uid = row.user_id;
    if (!byUser.has(uid)) {
      byUser.set(uid, {
        userId: uid,
        modes: emptyModeCounts(),
        rounds: 0,
        lastTs: 0,
      });
    }
    const u = byUser.get(uid);
    const mode = normalizeMode(row);
    u.modes[mode] = (u.modes[mode] || 0) + 1;
    u.rounds += 1;
    const ts = Number(row.ts) || 0;
    if (ts > u.lastTs) u.lastTs = ts;
  }
  return [...byUser.values()].sort((a, b) => b.rounds - a.rounds || b.lastTs - a.lastTs);
}

function aggregateByMode(rows, day) {
  const counts = emptyModeCounts();
  const users = Object.fromEntries(MODE_DEFS.map((m) => [m.key, new Set()]));
  for (const row of rows) {
    if (row.day_date !== day) continue;
    const mode = normalizeMode(row);
    counts[mode] += 1;
    users[mode].add(row.user_id);
  }
  return MODE_DEFS.map((m) => ({
    key: m.key,
    rounds: counts[m.key],
    users: users[m.key].size,
  }));
}

function trendDays(rows, endDate, days = CHART_DAYS) {
  const keys = [];
  for (let i = days - 1; i >= 0; i--) keys.push(addDays(endDate, -i));
  const map = new Map(keys.map((d) => [d, { rounds: 0, users: new Set(), modes: emptyModeCounts() }]));
  for (const row of rows) {
    const bucket = map.get(row.day_date);
    if (!bucket) continue;
    bucket.rounds += 1;
    bucket.users.add(row.user_id);
    const mode = normalizeMode(row);
    bucket.modes[mode] = (bucket.modes[mode] || 0) + 1;
  }
  return keys.map((d) => ({ date: d, ...map.get(d) }));
}

function userLabel(userId, names) {
  const name = names.get(userId);
  if (name) return name;
  return `${userId.slice(0, 8)}…`;
}

function svgEl(name, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) node.setAttribute(k, String(v));
  }
  return node;
}

function shortDate(dateStr) {
  return dateStr.slice(5); // MM-DD
}

function niceMax(value) {
  const n = Math.max(1, Number(value) || 1);
  if (n <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / step) * step;
}

function renderLegend(target, items) {
  if (!target) return;
  target.innerHTML = '';
  for (const item of items) {
    const row = el('span', 'analytics-legend-item');
    row.style.color = item.color;
    const swatch = el('span', 'analytics-legend-swatch');
    row.append(swatch, document.createTextNode(item.label));
    target.append(row);
  }
}

/**
 * series: [{ key, label, color, values: number[] }]
 * labels: string[] (x axis)
 */
function drawLineChart(svg, { labels, series, yLabel }) {
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const width = 640;
  const height = 220;
  const pad = { top: 16, right: 16, bottom: 36, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const n = labels.length;
  if (!n) return;

  const allVals = series.flatMap((s) => s.values);
  const maxY = niceMax(Math.max(0, ...allVals));
  const xAt = (i) => pad.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v) => pad.top + innerH - (v / maxY) * innerH;

  // grid + y ticks
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = (maxY / ticks) * i;
    const y = yAt(v);
    svg.append(svgEl('line', {
      class: 'analytics-chart-grid',
      x1: pad.left,
      x2: pad.left + innerW,
      y1: y,
      y2: y,
    }));
    const label = svgEl('text', {
      class: 'analytics-chart-axis',
      x: pad.left - 8,
      y: y + 3,
      'text-anchor': 'end',
    });
    label.textContent = String(Math.round(v));
    svg.append(label);
  }

  // x labels (間引き)
  const labelStep = n > 10 ? 2 : 1;
  for (let i = 0; i < n; i += labelStep) {
    const text = svgEl('text', {
      class: 'analytics-chart-axis',
      x: xAt(i),
      y: height - 12,
      'text-anchor': 'middle',
    });
    text.textContent = shortDate(labels[i]);
    svg.append(text);
  }

  if (yLabel) {
    const yl = svgEl('text', {
      class: 'analytics-chart-axis',
      x: 8,
      y: 12,
      'text-anchor': 'start',
    });
    yl.textContent = yLabel;
    svg.append(yl);
  }

  for (const s of series) {
    const pts = s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
    svg.append(svgEl('polyline', {
      class: 'analytics-chart-line',
      points: pts,
      stroke: s.color,
      'stroke-width': s.thick ? 3 : 2.25,
      opacity: s.thick ? 1 : 0.92,
    }));
    s.values.forEach((v, i) => {
      svg.append(svgEl('circle', {
        class: 'analytics-chart-dot',
        cx: xAt(i),
        cy: yAt(v),
        r: s.thick ? 3.5 : 3,
        fill: s.color,
      }));
    });
  }
}

function renderCharts(trend) {
  const labels = trend.map((d) => d.date);

  renderLegend($('#analytics-legend-total'), [
    { label: t('analytics.chartRounds'), color: TOTAL_COLOR },
    { label: t('analytics.chartUsers'), color: USERS_COLOR },
  ]);
  drawLineChart($('#analytics-chart-total'), {
    labels,
    yLabel: '',
    series: [
      {
        key: 'rounds',
        color: TOTAL_COLOR,
        thick: true,
        values: trend.map((d) => d.rounds),
      },
      {
        key: 'users',
        color: USERS_COLOR,
        values: trend.map((d) => d.users.size),
      },
    ],
  });

  const modeSeries = MODE_DEFS
    .filter((m) => m.key !== 'other')
    .map((m) => ({
      key: m.key,
      label: modeLabel(m.key),
      color: m.color,
      values: trend.map((d) => d.modes[m.key] || 0),
    }));

  renderLegend(
    $('#analytics-legend-modes'),
    modeSeries.map((s) => ({ label: s.label, color: s.color })),
  );
  drawLineChart($('#analytics-chart-modes'), {
    labels,
    series: modeSeries,
  });
}

function renderSummary(users) {
  const wrap = $('#analytics-summary');
  wrap.innerHTML = '';
  const total = users.reduce((n, u) => n + u.rounds, 0);
  const count = users.length;
  const avg = count ? (total / count).toFixed(1) : '0';

  for (const [label, value] of [
    [t('analytics.totalRounds'), String(total)],
    [t('analytics.userCount'), String(count)],
    [t('analytics.avgRounds'), avg],
  ]) {
    const card = el('div', 'analytics-stat');
    card.append(el('div', 'analytics-stat-label', label));
    card.append(el('div', 'analytics-stat-value', value));
    wrap.append(card);
  }
}

function renderModeSummary(modes) {
  const tbody = $('#analytics-modes');
  if (!tbody) return;
  tbody.innerHTML = '';
  const active = modes.filter((m) => m.rounds > 0);
  if (!active.length) {
    const tr = el('tr');
    const td = el('td', 'analytics-empty', t('analytics.noData'));
    td.colSpan = 3;
    tr.append(td);
    tbody.append(tr);
    return;
  }
  const maxRounds = Math.max(1, ...active.map((m) => m.rounds));
  for (const m of MODE_DEFS) {
    const row = modes.find((x) => x.key === m.key) || { rounds: 0, users: 0 };
    if (!row.rounds) continue;
    const tr = el('tr');
    tr.append(el('td', null, modeLabel(m.key)));
    const roundsTd = el('td', 'analytics-num', String(row.rounds));
    const barWrap = el('div', 'analytics-bar-wrap');
    const bar = el('div', 'analytics-bar');
    bar.style.width = `${Math.round((row.rounds / maxRounds) * 100)}%`;
    barWrap.append(bar);
    roundsTd.append(barWrap);
    tr.append(roundsTd);
    tr.append(el('td', 'analytics-num', String(row.users)));
    tbody.append(tr);
  }
}

function renderUserTable(users, names) {
  const thead = $('#analytics-users-head');
  const tbody = $('#analytics-users');
  if (!tbody) return;

  if (thead) {
    thead.innerHTML = '';
    const tr = el('tr');
    tr.append(el('th', null, t('analytics.user')));
    for (const m of MODE_DEFS) {
      if (m.key === 'other') continue;
      tr.append(el('th', 'analytics-num', modeLabel(m.key)));
    }
    tr.append(el('th', 'analytics-num', t('analytics.total')));
    tr.append(el('th', null, t('analytics.last')));
    thead.append(tr);
  }

  tbody.innerHTML = '';
  if (!users.length) {
    const tr = el('tr');
    const td = el('td', 'analytics-empty', t('analytics.noData'));
    td.colSpan = 7;
    tr.append(td);
    tbody.append(tr);
    return;
  }

  for (const u of users) {
    const tr = el('tr');
    tr.append(el('td', null, userLabel(u.userId, names)));
    for (const m of MODE_DEFS) {
      if (m.key === 'other') continue;
      const n = u.modes[m.key] || 0;
      tr.append(el('td', 'analytics-num', n ? String(n) : '—'));
    }
    const other = u.modes.other || 0;
    const totalLabel = other ? `${u.rounds}（+${other}）` : String(u.rounds);
    tr.append(el('td', 'analytics-num', totalLabel));
    tr.append(el('td', 'analytics-muted', fmtTime(u.lastTs)));
    tbody.append(tr);
  }
}

function renderTrend(trend) {
  const tbody = $('#analytics-trend');
  tbody.innerHTML = '';
  const maxRounds = Math.max(1, ...trend.map((d) => d.rounds));
  for (const d of trend) {
    const tr = el('tr');
    tr.append(el('td', null, d.date));
    const roundsTd = el('td', 'analytics-num', String(d.rounds));
    const barWrap = el('div', 'analytics-bar-wrap');
    const bar = el('div', 'analytics-bar');
    bar.style.width = `${Math.round((d.rounds / maxRounds) * 100)}%`;
    barWrap.append(bar);
    roundsTd.append(barWrap);
    tr.append(roundsTd);
    tr.append(el('td', 'analytics-num', String(d.users.size)));

    const parts = MODE_DEFS
      .filter((m) => (d.modes[m.key] || 0) > 0)
      .map((m) => `${modeLabel(m.key)} ${d.modes[m.key]}`);
    tr.append(el('td', 'analytics-muted analytics-mode-breakdown', parts.join(' · ') || '—'));
    tbody.append(tr);
  }
}

export async function renderAdminAnalytics() {
  const loading = $('#analytics-loading');
  const body = $('#analytics-body');
  const errEl = $('#analytics-error');
  if (!loading || !body) return;

  $('#analytics-date-label').textContent = fmtDateLabel(viewDate);
  loading.hidden = false;
  body.hidden = true;
  errEl.hidden = true;
  errEl.textContent = '';

  try {
    const trendFrom = addDays(viewDate, -(CHART_DAYS - 1));
    const raw = await fetchSessions(trendFrom, viewDate);
    const names = await fetchUsernames(raw.map((r) => r.user_id));
    const rows = filterExcluded(raw, names);
    const users = aggregateByUser(rows, viewDate);
    const modes = aggregateByMode(rows, viewDate);
    const trend = trendDays(rows, viewDate, CHART_DAYS);

    renderSummary(users);
    renderCharts(trend);
    renderModeSummary(modes);
    renderUserTable(users, names);
    renderTrend(trend);

    loading.hidden = true;
    body.hidden = false;
  } catch (err) {
    console.error('[analytics]', err);
    loading.hidden = true;
    errEl.hidden = false;
    errEl.textContent = err.message === 'not admin'
      ? t('analytics.needAdminLogin')
      : t('analytics.loadFail');
  }
}

export function setAnalyticsViewDate(dateStr) {
  viewDate = dateStr;
}

export function getAnalyticsViewDate() {
  return viewDate;
}

export function wireAdminAnalytics({ onNavigate }) {
  $('#analytics-prev')?.addEventListener('click', () => {
    setAnalyticsViewDate(addDays(getAnalyticsViewDate(), -1));
    onNavigate?.('admin/analytics');
    renderAdminAnalytics();
  });
  $('#analytics-next')?.addEventListener('click', () => {
    setAnalyticsViewDate(addDays(getAnalyticsViewDate(), 1));
    onNavigate?.('admin/analytics');
    renderAdminAnalytics();
  });
  $('#analytics-today')?.addEventListener('click', () => {
    setAnalyticsViewDate(dateKey());
    onNavigate?.('admin/analytics');
    renderAdminAnalytics();
  });
  $('#analytics-refresh')?.addEventListener('click', () => renderAdminAnalytics());
  $('#analytics-admin-link')?.addEventListener('click', () => onNavigate?.('admin'));
  $('#admin-analytics-link')?.addEventListener('click', () => onNavigate?.('admin/analytics'));
}

export async function openAdminAnalytics() {
  const gate = $('#analytics-gate');
  const shell = $('#analytics-shell');

  if (!isAdminAnalyticsUser()) {
    if (gate) gate.hidden = false;
    if (shell) shell.hidden = true;
    return;
  }
  if (gate) gate.hidden = true;
  if (shell) shell.hidden = false;
  await renderAdminAnalytics();
}
