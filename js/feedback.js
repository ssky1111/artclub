/**
 * feedback.js — フィードバックを Supabase に保存する。
 */

import { SUPABASE_URL, SUPABASE_KEY } from './supabase.js';
import { getSession, getUser, getUsername } from './auth.js';

function authHeaders(extra = {}) {
  const session = getSession();
  const token = session?.access_token || SUPABASE_KEY;
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

/**
 * @param {{ message: string, contact?: string }} input
 */
export async function submitFeedback(input) {
  const message = String(input?.message || '').trim();
  if (!message) throw new Error('empty');
  if (message.length > 4000) throw new Error('too long');

  const user = getUser();
  const body = {
    message,
    contact: String(input?.contact || '').trim().slice(0, 200) || null,
    page_path: `${location.pathname}${location.search}${location.hash}`.slice(0, 500),
    user_id: user?.id || null,
    username: getUsername() || null,
    user_agent: String(navigator.userAgent || '').slice(0, 400) || null,
    meta: {
      lang: document.documentElement.lang || null,
      screen: document.body?.dataset?.screen || null,
    },
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`feedback failed: ${res.status} ${text}`);
  }
  return true;
}
