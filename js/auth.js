/**
 * auth.js — Supabase Auth (GoTrue REST API)
 *
 * SDK を使わず REST で OAuth ログインを処理する。
 * access_token / refresh_token は localStorage に保存し、
 * 期限切れ前に自動で更新する。
 */

import { SUPABASE_URL, SUPABASE_KEY } from './supabase.js';

const STORAGE_KEY = 'artclub.auth';
const USERNAME_KEY = 'artclub.username';
const REDIRECT_URL = 'https://artclub.space';

let session = null;
let user = null;
let refreshTimer = 0;
const listeners = [];

function authHeaders(accessToken) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${accessToken}`,
  };
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clear() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

function notify() {
  for (const fn of listeners) {
    try { fn(user); } catch {}
  }
}

function scheduleRefresh(expiresIn) {
  clearTimeout(refreshTimer);
  const ms = Math.max((expiresIn - 60) * 1000, 10_000);
  refreshTimer = setTimeout(() => refreshSession(), ms);
}

async function refreshSession() {
  if (!session?.refresh_token) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
    user = data.user || user;
    save(session);
    scheduleRefresh(data.expires_in);
    notify();
  } catch {
    session = null;
    user = null;
    clear();
    notify();
  }
}

async function fetchUser(accessToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw new Error(res.status);
  return await res.json();
}

function parseHashTokens() {
  const hash = location.hash.substring(1);
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: parseInt(params.get('expires_in') || '3600', 10),
  };
}

/* ---------- public ---------- */

export async function initAuth() {
  const hashTokens = parseHashTokens();
  if (hashTokens) {
    history.replaceState(null, '', location.pathname + location.search);
    session = hashTokens;
    save(session);
    try {
      user = await fetchUser(session.access_token);
    } catch {}
    scheduleRefresh(session.expires_in);
    notify();
    return user;
  }

  const stored = load();
  if (stored?.access_token) {
    session = stored;
    try {
      user = await fetchUser(session.access_token);
      scheduleRefresh(session.expires_in);
      notify();
    } catch {
      await refreshSession();
    }
  }
  return user;
}

export function loginWithProvider(provider) {
  const url = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  url.searchParams.set('provider', provider);
  url.searchParams.set('redirect_to', REDIRECT_URL);
  location.href = url.toString();
}

export async function logout() {
  if (session?.access_token) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: authHeaders(session.access_token),
      });
    } catch {}
  }
  clearTimeout(refreshTimer);
  session = null;
  user = null;
  clear();
  notify();
}

export function getUser() { return user; }
export function getSession() { return session; }

export function onAuthChange(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function userName(u = user) {
  if (!u) return '';
  const custom = getUsername();
  if (custom) return custom;
  return u.email?.split('@')[0] || '';
}

export function userAvatar() {
  return '';
}

export function getUsername() {
  try { return localStorage.getItem(USERNAME_KEY) || ''; } catch { return ''; }
}

export function setUsername(name) {
  try { localStorage.setItem(USERNAME_KEY, name); } catch {}
  // 他ユーザーの作品カードに出す名前。失敗してもローカルは残す
  import('./gallery.js')
    .then((m) => m.upsertProfile(name))
    .catch(() => {});
  notify();
}

export function hasUsername() {
  return !!getUsername();
}
