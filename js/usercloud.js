/**
 * usercloud.js — ユーザーデータの Supabase 永続化。
 *
 * localStorage に残すのは認証トークンと管理用シークレットだけ。
 * 練習履歴・設定・復習カード・言語・ゲーム状態はここ経由。
 * カレンダー表紙は sessions の shots から導出（専用テーブルは当面不要）。
 */

import { SUPABASE_URL, SUPABASE_KEY } from './supabase.js';
import { getSession, getUser, ensureFreshSession } from './auth.js';

function authHeaders(extra = {}) {
  const session = getSession();
  const token = session?.access_token || SUPABASE_KEY;
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function ready() {
  if (!getUser()) return false;
  try { await ensureFreshSession(); } catch { /* 続行 */ }
  return !!getUser();
}

/* ---------- prefs ---------- */

export async function fetchUserPrefs() {
  if (!(await ready())) return null;
  const user = getUser();
  const params = new URLSearchParams({
    select: 'settings,cards,game,lang,updated_at',
    user_id: `eq.${user.id}`,
    limit: '1',
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_prefs?${params}`, {
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!res.ok) return null;
  const [row] = await res.json();
  return row || null;
}

export async function upsertUserPrefs(patch) {
  if (!(await ready())) return null;
  const user = getUser();
  const body = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
    ...patch,
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_prefs`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`prefs upsert failed: ${res.status} ${text}`);
  }
  const rows = await res.json().catch(() => []);
  return rows[0] || body;
}

/* ---------- practice sessions ---------- */

function sessionRow(entry) {
  return {
    id: entry.id,
    user_id: getUser().id,
    day_date: entry.date,
    ts: Number(entry.ts) || 0,
    menu_id: entry.menuId || null,
    seconds: Number(entry.seconds) || 0,
    drawing_count: Number(entry.drawingCount) || 0,
    has_drawing: !!(entry.hasDrawing || entry.drawingCount),
    payload: entry,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchPracticeSessions({ limit = 1000 } = {}) {
  if (!(await ready())) return [];
  const user = getUser();
  const params = new URLSearchParams({
    select: 'id,day_date,ts,menu_id,seconds,drawing_count,payload,updated_at',
    user_id: `eq.${user.id}`,
    order: 'ts.asc',
    limit: String(limit),
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/practice_sessions?${params}`, {
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`sessions fetch failed: ${res.status} ${text}`);
  }
  const rows = await res.json();
  return rows.map((row) => {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    return {
      ...payload,
      id: row.id || payload.id,
      date: row.day_date || payload.date,
      ts: row.ts || payload.ts || 0,
      menuId: payload.menuId || row.menu_id || null,
      seconds: payload.seconds ?? row.seconds ?? 0,
      drawingCount: payload.drawingCount ?? row.drawing_count ?? 0,
      hasDrawing: payload.hasDrawing ?? (row.drawing_count > 0),
    };
  }).filter((e) => e.id && e.date);
}

export async function upsertPracticeSession(entry) {
  if (!(await ready()) || !entry?.id || !entry?.date) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/practice_sessions`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    }),
    body: JSON.stringify(sessionRow(entry)),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`session upsert failed: ${res.status} ${text}`);
  }
  return true;
}

/** ローカルにだけある履歴をまとめて上げる */
export async function upsertPracticeSessions(entries = []) {
  if (!(await ready()) || !entries.length) return 0;
  const rows = entries.filter((e) => e?.id && e?.date).map(sessionRow);
  if (!rows.length) return 0;
  // PostgREST は一度に大きすぎると落ちることがあるので分割
  const chunk = 80;
  let ok = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/practice_sessions`, {
      method: 'POST',
      headers: authHeaders({
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify(slice),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`sessions bulk upsert failed: ${res.status} ${text}`);
    }
    ok += slice.length;
  }
  return ok;
}

/* ---------- calendar covers（任意・未使用） ----------
 * カレンダー表紙は sessions.payload.shots[].artworkId から導出する。
 * 手動指定 UI が必要になったら supabase/user-data.sql に表を足してここを復活させる。
 */

