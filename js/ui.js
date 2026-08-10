/** ui.js — 画面切り替えなどの小道具 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function showScreen(name) {
  $$('.screen').forEach((el) => el.classList.remove('is-active'));
  const screen = document.getElementById(`screen-${name}`);
  if (screen) screen.classList.add('is-active');
  window.scrollTo(0, 0);
  document.body.classList.toggle('in-session', name === 'session');
  document.body.dataset.screen = name;          // 下のタブを出す画面を CSS 側で決める
  document.querySelectorAll('.tabbar button')
    .forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
}

let toastTimer = 0;
export function toast(message, ms = 2800) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.hidden = true; }, 250);
  }, ms);
}

export function fmtClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return String(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}分`;
  return `${Math.floor(m / 60)}時間${m % 60}分`;
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function confirmDialog(message, { okLabel, cancelLabel } = {}) {
  const { t } = window.__i18n ?? {};
  const wrap = $('#confirm-dialog');
  const msgEl = $('#confirm-dialog-msg');
  const okBtn = $('#confirm-dialog-ok');
  const cancelBtn = $('#confirm-dialog-cancel');

  msgEl.textContent = message;
  okBtn.textContent = okLabel ?? (t ? t('common.ok') : 'OK');
  cancelBtn.textContent = cancelLabel ?? (t ? t('common.cancel') : 'やめる');
  wrap.hidden = false;

  return new Promise((resolve) => {
    function done(result) {
      wrap.hidden = true;
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      wrap.removeEventListener('click', onBackdrop);
      resolve(result);
    }
    function onOk() { done(true); }
    function onCancel() { done(false); }
    function onBackdrop(e) { if (e.target === wrap) done(false); }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    wrap.addEventListener('click', onBackdrop);
    okBtn.focus();
  });
}

/**
 * DAILY 開始前の振り返りモーダル。
 * notes: [{ date, note }] — 無ければすぐ resolve。
 */
export function weekReviewDialog(notes) {
  if (!notes?.length) return Promise.resolve();

  const { t } = window.__i18n ?? {};
  const wrap = $('#week-review-dialog');
  const list = $('#week-review-list');
  const okBtn = $('#week-review-ok');
  const title = $('#week-review-title');

  title.textContent = '直近1週間分の振り返りワード';
  list.innerHTML = '';
  for (const item of notes) {
    const li = document.createElement('li');
    const date = document.createElement('span');
    date.className = 'week-review-date';
    date.textContent = item.date;
    li.append(date, document.createTextNode(item.note));
    list.append(li);
  }
  okBtn.textContent = t ? t('home.startPlain') : 'はじめる';
  wrap.hidden = false;

  return new Promise((resolve) => {
    function done() {
      wrap.hidden = true;
      okBtn.removeEventListener('click', onOk);
      wrap.removeEventListener('click', onBackdrop);
      resolve();
    }
    function onOk() { done(); }
    function onBackdrop(e) { if (e.target === wrap) done(); }

    okBtn.addEventListener('click', onOk);
    wrap.addEventListener('click', onBackdrop);
    okBtn.focus();
  });
}
