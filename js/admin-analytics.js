/**
 * admin-analytics.js — デイリー利用状況（管理者向け）
 * /admin/analytics … 管理者メールでログイン必須
 */

import { SUPABASE_URL, SUPABASE_KEY } from './supabase.js';
import { getSession, getUser, ensureFreshSession } from './auth.js';
import { $, el } from './ui.js';
import { dateKey, addDays } from './storage.js';
import { t } from './i18n.js';

const ADMIN_EMAILS = ['yuisskweb@gmail.com', 'sayu.u.u.u.u@gmail.com'];

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

function isDailyRow(row) {
  const menuId = row.menu_id || row.payload?.menuId;
  return menuId === 'daily';
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

async function fetchDailySessions(fromDate, toDate) {
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
  return (await res.json()).filter(isDailyRow);
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

function aggregateByUser(rows, day) {
  const byUser = new Map();
  for (const row of rows) {
    if (row.day_date !== day) continue;
    const uid = row.user_id;
    if (!byUser.has(uid)) byUser.set(uid, { userId: uid, rounds: 0, lastTs: 0 });
    const u = byUser.get(uid);
    u.rounds += 1;
    const ts = Number(row.ts) || 0;
    if (ts > u.lastTs) u.lastTs = ts;
  }
  return [...byUser.values()].sort((a, b) => b.rounds - a.rounds || b.lastTs - a.lastTs);
}

function trendDays(rows, endDate, days = 7) {
  const keys = [];
  for (let i = days - 1; i >= 0; i--) keys.push(addDays(endDate, -i));
  const map = new Map(keys.map((d) => [d, { rounds: 0, users: new Set() }]));
  for (const row of rows) {
    const bucket = map.get(row.day_date);
    if (!bucket) continue;
    bucket.rounds += 1;
    bucket.users.add(row.user_id);
  }
  return keys.map((d) => ({ date: d, ...map.get(d) }));
}

function userLabel(userId, names) {
  const name = names.get(userId);
  if (name) return name;
  return `${userId.slice(0, 8)}…`;
}

function renderSummary(day, users) {
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

function renderUserTable(users, names) {
  const tbody = $('#analytics-users');
  tbody.innerHTML = '';
  if (!users.length) {
    const tr = el('tr');
    const td = el('td', 'analytics-empty', t('analytics.noData'));
    td.colSpan = 3;
    tr.append(td);
    tbody.append(tr);
    return;
  }
  for (const u of users) {
    const tr = el('tr');
    tr.append(el('td', null, userLabel(u.userId, names)));
    tr.append(el('td', 'analytics-num', String(u.rounds)));
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
    const rows = await fetchDailySessions(trendFrom, viewDate);
    const users = aggregateByUser(rows, viewDate);
    const names = await fetchUsernames(users.map((u) => u.userId));
    const trend = trendDays(rows, viewDate, 7);

    renderSummary(viewDate, users);
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
