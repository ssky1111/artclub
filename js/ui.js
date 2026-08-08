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
