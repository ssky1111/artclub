/**
 * feedback.js — 右端タブ + 吹き出し UI。Supabase に保存する。
 * 全面シートにしないのでページのスクロールは触らない。
 */

import { SUPABASE_URL, SUPABASE_KEY } from './supabase.js';
import { getSession, getUser, getUsername } from './auth.js';
import { $, toast } from './ui.js';
import { t } from './i18n.js';

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
 * @param {{ message: string }} input
 */
export async function submitFeedback(input) {
  const message = String(input?.message || '').trim();
  if (!message) throw new Error('empty');
  if (message.length > 4000) throw new Error('too long');

  const user = getUser();
  const body = {
    message,
    contact: null,
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
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`feedback failed: ${res.status} ${text}`);
  }
  return true;
}

/** 右端タブと吹き出しフォームを配線する */
export function initFeedback() {
  const tab = $('#feedback-tab');
  const sheet = $('#feedback-sheet');
  const message = $('#feedback-message');
  const send = $('#feedback-send');
  if (!tab || !sheet || !message || !send) return;

  sheet.hidden = true;
  tab.setAttribute('aria-expanded', 'false');

  const open = () => {
    sheet.hidden = false;
    tab.setAttribute('aria-expanded', 'true');
    tab.classList.add('is-open');
    requestAnimationFrame(() => message.focus());
  };
  const close = () => {
    sheet.hidden = true;
    tab.setAttribute('aria-expanded', 'false');
    tab.classList.remove('is-open');
    message.blur();
  };

  tab.addEventListener('click', (e) => {
    e.stopPropagation();
    if (sheet.hidden) open();
    else close();
  });
  $('#feedback-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheet.hidden) close();
  });
  document.addEventListener('click', (e) => {
    if (sheet.hidden) return;
    if (e.target.closest('#feedback-sheet, #feedback-tab')) return;
    close();
  });

  send.addEventListener('click', async () => {
    const text = message.value.trim();
    if (!text) return toast(t('fb.empty'));
    send.disabled = true;
    const prev = send.textContent;
    send.textContent = t('fb.sending');
    try {
      await submitFeedback({ message: text });
      message.value = '';
      close();
      toast(t('fb.thanks'));
    } catch (err) {
      console.error('[feedback]', err);
      toast(t('fb.fail'));
    } finally {
      send.disabled = false;
      send.textContent = prev;
    }
  });
}
