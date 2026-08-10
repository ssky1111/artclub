/**
 * auth.js — Supabase Auth (GoTrue REST API)
 *
 * SDK を使わず REST で OAuth ログインを処理する。
 * access_token / refresh_token は localStorage に保存し、
 * 期限切れ前に自動で更新する。
 */

import { SUPABASE_URL, SUPABASE_KEY } from './supabase.js';

const STORAGE_KEY = 'artclub.auth';
const REDIRECT_URL = 'https://artclub.space';

let session = null;
let user = null;
let usernameMem = '';
let refreshTimer = 0;
const listeners = [];

function authHeaders(accessToken) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${accessToken}`,
  };
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, saved_at: Date.now() })); } catch {}
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

function clearUsernameCache() {
  usernameMem = '';
}

function cacheUsername(name) {
  const trimmed = String(name || '').trim().slice(0, 32);
  usernameMem = trimmed;
  return trimmed;
}

/** ログイン状態の変化だけ UI に伝える。トークン更新で毎回 notify しない。 */
let lastNotifyUserId = undefined;

function notify() {
  const uid = user?.id ?? null;
  if (lastNotifyUserId !== undefined && uid === lastNotifyUserId) return;
  lastNotifyUserId = uid;
  for (const fn of listeners) {
    try { fn(user); } catch {}
  }
}

function decodeJwt(token) {
  try {
    const part = String(token).split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

/**
 * アクセストークンの残り秒数。
 * トークンの exp を直接見る。保存時刻を自前で数えると、端末の時計や
 * 保存漏れでズレて「まだ有効なはず」の期限切れトークンで投稿してしまう。
 */
function secondsLeft(sess = session) {
  const exp = decodeJwt(sess?.access_token)?.exp;
  if (exp) return exp - Date.now() / 1000;
  const stored = load();
  const elapsed = stored?.saved_at ? (Date.now() - stored.saved_at) / 1000 : Infinity;
  return (stored?.expires_in || 3600) - elapsed;
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  const ms = Math.max((secondsLeft() - 60) * 1000, 10_000);
  refreshTimer = setTimeout(() => refreshSession(), ms);
}

let refreshing = null;

/** 更新は同時に1回だけ。リフレッシュトークンは使うたび変わるので、並行して叩くと壊れる。 */
function refreshSession() {
  if (!session?.refresh_token) return Promise.resolve(false);
  if (!refreshing) {
    refreshing = doRefresh().finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function doRefresh() {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
  } catch {
    return false;   // 圏外なだけでログアウトさせない
  }
  if (!res.ok) {
    // リフレッシュトークン自体が無効なときだけ、ログインし直してもらう
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      session = null;
      user = null;
      clear();
      notify();
    }
    return false;
  }
  const data = await res.json().catch(() => null);
  if (!data?.access_token) return false;
  // 待っている間にログアウトされていたら、ここで session を戻さない
  if (!session) return false;
  session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
  user = data.user || user;
  save(session);
  scheduleRefresh();
  notify();
  return true;
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
    scheduleRefresh();
    notify();
    return user;
  }

  const stored = load();
  if (stored?.access_token) {
    session = stored;
    if (secondsLeft() < 300) {
      const ok = await refreshSession();
      if (!ok && session?.access_token && !user) {
        try {
          user = await fetchUser(session.access_token);
          scheduleRefresh();
        } catch { /* refresh / fetch どちらも失敗 */ }
      }
    } else {
      try {
        user = await fetchUser(session.access_token);
        scheduleRefresh();
      } catch {
        await refreshSession();
      }
    }
    if (user) notify();
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
  refreshing = null;
  session = null;
  user = null;
  clear();
  clearUsernameCache();
  notify();
}

export function getUser() { return user; }
export function getSession() { return session; }

/** 投稿の直前に呼ぶ。期限が近い（or force）ときだけ更新する。 */
export async function ensureFreshSession({ force = false } = {}) {
  if (!session?.refresh_token) return session;
  if (force || secondsLeft() < 300) await refreshSession();
  return session;
}

export function onAuthChange(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function userName(u = user) {
  if (!u) return '';
  return getUsername();
}

export function getUsername() {
  return usernameMem || '';
}

/**
 * DB の profiles からユーザーネームを読む。
 * 新しい端末でも再入力を求めないための入口。
 */
export async function hydrateUsername() {
  if (!user) return '';
  try {
    const { fetchMyProfile } = await import('./gallery.js');
    const profile = await fetchMyProfile();
    if (profile?.username) {
      cacheUsername(profile.username);
      notify();
      return profile.username;
    }
  } catch { /* オフライン等 */ }
  return getUsername();
}

export function setUsername(name) {
  cacheUsername(name);
  // 他ユーザーのスケッチカードに出す名前
  import('./gallery.js')
    .then((m) => m.upsertProfile(name))
    .catch(() => {});
  notify();
}

export function hasUsername() {
  return !!getUsername();
}
