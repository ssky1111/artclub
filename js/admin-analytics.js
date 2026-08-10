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
  { key: 'daily', labelKey: 'analytics.modeDaily' },
  { key: 'gesture', labelKey: 'analytics.modeGesture' },
  { key: 'part', labelKey: 'analytics.modePart' },
  { key: 'croquis', labelKey: 'analytics.modeCroquis' },
  { key: 'copy', labelKey: 'analytics.modeCopy' },
  { key: 'other', labelKey: 'analytics.modeOther' },
];

let viewDate = dateKey();

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

function trendDays(rows, endDate, days = 7) {
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
    const trendFrom = addDays(viewDate, -6);
    const raw = await fetchSessions(trendFrom, viewDate);
    const names = await fetchUsernames(raw.map((r) => r.user_id));
    const rows = filterExcluded(raw, names);
    const users = aggregateByUser(rows, viewDate);
    const modes = aggregateByMode(rows, viewDate);
    const trend = trendDays(rows, viewDate, 7);

    renderSummary(users);
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
