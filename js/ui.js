/** ui.js — 画面切り替えなどの小道具 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** 練習終了後やシート閉じたあとに、縦スクロールが戻らないことがあるので明示的に復帰させる */
export function restorePageScroll() {
  const onSession = document.body.dataset.screen === 'session';
  if (!onSession) document.body.classList.remove('in-session');
  for (const node of [document.documentElement, document.body]) {
    node.style.overflow = '';
    node.style.position = '';
    node.style.height = '';
    node.style.width = '';
    node.style.top = '';
    node.style.touchAction = '';
  }
  if (!onSession) {
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    document.body.style.setProperty('-webkit-overflow-scrolling', 'touch');
  }
}

let screenShownHook = null;

/** 画面切り替え後に描画する処理（app.js から登録。循環 import を避ける） */
export function setScreenShownHook(fn) {
  screenShownHook = fn;
}

export function showScreen(name) {
  const screen = document.getElementById(`screen-${name}`);
  const already = document.body.dataset.screen === name && screen?.classList.contains('is-active');
  if (!already) {
    $$('.screen').forEach((el) => el.classList.remove('is-active'));
    if (screen) screen.classList.add('is-active');
    document.body.dataset.screen = name;
    document.documentElement.dataset.screen = name;
    document.body.classList.toggle('in-session', name === 'session');
    if (name !== 'session') restorePageScroll();
    window.scrollTo(0, 0);
    document.querySelectorAll('.tabbar button')
      .forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  }
  screenShownHook?.(name);
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

/** ドリル説明などの箇条書き（黒丸リスト） */
export function hintList(hints, className = 'hint-list') {
  const ul = document.createElement('ul');
  ul.className = className;
  for (const line of hints || []) {
    ul.append(el('li', null, line));
  }
  return ul;
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
      restorePageScroll();
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
 * notes が空でも「まだありません」を出してから進む。
 */
export function weekReviewDialog(notes = []) {
  const { t } = window.__i18n ?? {};
  const wrap = $('#week-review-dialog');
  const list = $('#week-review-list');
  const empty = $('#week-review-empty');
  const lead = $('#week-review-lead');
  const okBtn = $('#week-review-ok');
  const title = $('#week-review-title');
  const hasNotes = notes.length > 0;

  title.textContent = '直近1週間分の振り返りワード';
  list.innerHTML = '';
  list.hidden = !hasNotes;
  empty.hidden = hasNotes;
  lead.hidden = !hasNotes;

  if (hasNotes) {
    for (const item of notes) {
      const li = document.createElement('li');
      const date = document.createElement('span');
      date.className = 'week-review-date';
      date.textContent = item.date;
      li.append(date, document.createTextNode(item.note));
      list.append(li);
    }
  }

  okBtn.textContent = t ? t('home.startPlain') : 'はじめる';
  wrap.hidden = false;

  return new Promise((resolve) => {
    function done() {
      wrap.hidden = true;
      okBtn.removeEventListener('click', onOk);
      wrap.removeEventListener('click', onBackdrop);
      restorePageScroll();
      resolve();
    }
    function onOk() { done(); }
    function onBackdrop(e) { if (e.target === wrap) done(); }

    okBtn.addEventListener('click', onOk);
    wrap.addEventListener('click', onBackdrop);
    okBtn.focus();
  });
}
