/**
 * app.js — 画面の組み立てと配線。
 */

import {
  MENUS, DRILLS, PRINCIPLES, CATEGORIES,
  levelFor, levelLabel, scaleMenu, menuDuration, focusForDate, availableCategories,
} from './theory.js';
import {
  getSettings, saveSettings, getHistory, addSession, updateLastSession, clearAll,
  dateKey, addDays, dailyTotals, stats,
} from './storage.js';
import { createPhotoQueue, localFiles, testUnsplashKey } from './images.js';
import { createSessionRunner } from './session.js';
import { putDrawing, getDrawing, deleteAllDrawings, shrinkImage } from './db.js';
import { $, $$, el, showScreen, toast, fmtDuration } from './ui.js';

let settings = getSettings();
let pendingDrawing = null;   // ふりかえり画面で選ばれた画像（保存前）

/* ==================== ホーム ==================== */

function renderHome() {
  const history = getHistory();
  const s = stats(history);
  const level = levelFor(s.sessions);
  const today = dateKey();
  const focus = focusForDate(today);

  $('#streak-count').textContent = String(s.streak);
  $('#total-stat').textContent = `通算 ${s.sessions} 回 / ${s.minutes} 分`;
  $('#level-badge').textContent = `Lv.${level} ${levelLabel(level)}`;

  const doneToday = dailyTotals(history).has(today);
  const status = $('#today-status');
  status.textContent = doneToday ? '今日は完了' : '今日はまだ';
  status.classList.toggle('done', doneToday);

  $('#focus-title').textContent = focus.title;
  $('#focus-desc').textContent = focus.desc;

  renderStreakDots(history);
  renderMenus(level);
  renderCategories(level);

  const sourceLabel = { unsplash: 'Unsplash', picsum: 'Lorem Picsum', local: '端末内の画像' }[settings.source];
  $('#source-note').textContent = `お題の取得元：${sourceLabel}`;
}

function renderStreakDots(history) {
  const totals = dailyTotals(history);
  const wrap = $('#streak-dots');
  wrap.innerHTML = '';
  for (let i = 13; i >= 0; i--) {
    const day = addDays(dateKey(), -i);
    const dot = el('i', totals.has(day) ? 'dot on' : 'dot');
    dot.title = day;
    wrap.append(dot);
  }
}

function renderMenus(level) {
  const wrap = $('#menu-cards');
  wrap.innerHTML = '';
  for (const base of MENUS) {
    const menu = scaleMenu(base, level);
    const card = el('button', 'menu-card');
    card.append(
      el('div', 'menu-title', menu.title),
      el('div', 'menu-sub muted', menu.subtitle),
      el('div', 'menu-steps muted small',
        menu.steps.map((s) => `${DRILLS[s.drill].name}×${s.count}`).join(' · ')),
      el('div', 'menu-time', `約${fmtDuration(menuDuration(menu))}`),
    );
    card.addEventListener('click', () => startSession(menu));
    wrap.append(card);
  }
}

function renderCategories(level) {
  const wrap = $('#category-chips');
  wrap.innerHTML = '';
  const unlocked = new Set(availableCategories(level).map((c) => c.id));
  for (const cat of CATEGORIES) {
    const locked = !unlocked.has(cat.id);
    const on = settings.categories.includes(cat.id);
    const chip = el('button', `chip${on && !locked ? ' on' : ''}${locked ? ' locked' : ''}`);
    chip.textContent = locked ? `${cat.label}（Lv.${cat.levelMin}〜）` : cat.label;
    chip.disabled = locked;
    chip.title = locked ? `レベル${cat.levelMin}で解禁されます` : '';
    chip.addEventListener('click', () => {
      const next = new Set(settings.categories);
      next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
      if (next.size === 0) return toast('ジャンルは1つ以上えらんでください');
      settings = saveSettings({ categories: [...next] });
      renderCategories(level);
    });
    wrap.append(chip);
  }
}

/* ==================== セッション ==================== */

const runner = createSessionRunner({
  onFinish: (result) => finishSession(result),
  onQuit: (partial) => {
    if (partial) {
      saveResult(partial);
      toast(`途中まででも記録しました（${Math.round(partial.seconds / 60)}分）`);
    }
    renderHome();
    showScreen('home');
  },
});

let lastMenu = null;

function startSession(menu) {
  lastMenu = menu;
  settings = getSettings();
  const queue = createPhotoQueue(settings, (msg) => toast(msg));
  runner.start({ menu, queue, settings, focus: focusForDate(dateKey()) });
}

function saveResult(result) {
  return addSession({
    id: `s${Date.now()}`,
    date: dateKey(),
    ts: Date.now(),
    ...result,
  });
}

function finishSession(result) {
  const entry = saveResult(result);
  pendingDrawing = null;
  $('#drawing-preview').hidden = true;
  $('#review-note').value = '';
  $$('.rate-btn').forEach((b) => b.classList.remove('on'));

  const focus = focusForDate(entry.date);
  $('#review-focus').textContent = focus.title;

  const drillLines = Object.entries(entry.byDrill)
    .map(([id, sec]) => `<li><span>${DRILLS[id]?.name || id}</span><b>${fmtDuration(sec)}</b></li>`)
    .join('');
  const s = stats();
  const short = entry.seconds < 60;
  $('#review-summary').innerHTML =
    `<div class="review-big">${short ? entry.seconds : Math.round(entry.seconds / 60)}` +
    `<span>${short ? '秒' : '分'}</span></div>` +
    `<ul class="review-drills">${drillLines}</ul>` +
    `<div class="muted small">連続 ${s.streak} 日 / 通算 ${s.sessions} 回</div>`;

  showScreen('review');
}

/* ==================== ふりかえり ==================== */

function wireReview() {
  $$('.rate-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.rate-btn').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
    });
  });

  $('#drawing-btn').addEventListener('click', () => $('#drawing-input').click());
  $('#drawing-input').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      pendingDrawing = await shrinkImage(file);
      const preview = $('#drawing-preview');
      preview.src = URL.createObjectURL(pendingDrawing);
      preview.hidden = false;
    } catch {
      toast('画像を読み込めませんでした');
    }
    e.target.value = '';
  });

  $('#review-save').addEventListener('click', async () => {
    const rated = $$('.rate-btn').find((b) => b.classList.contains('on'));
    const entry = updateLastSession({
      rating: rated ? Number(rated.dataset.rate) : null,
      note: $('#review-note').value.trim() || null,
      hasDrawing: !!pendingDrawing,
    });
    if (pendingDrawing && entry) {
      try { await putDrawing(entry.id, pendingDrawing); }
      catch { toast('絵の保存に失敗しました（記録は残ります）'); }
    }
    pendingDrawing = null;
    renderHome();
    showScreen('home');
  });

  $('#review-again').addEventListener('click', () => {
    if (lastMenu) startSession(lastMenu);
  });
}

/* ==================== 記録 ==================== */

function renderLog() {
  const history = getHistory();
  const s = stats(history);
  $('#st-streak').textContent = String(s.streak);
  $('#st-best').textContent = String(s.best);
  $('#st-sessions').textContent = String(s.sessions);
  $('#st-minutes').textContent = String(s.minutes);

  renderHeatmap(history);
  renderDrillBars(s);
  renderNotes(history);
}

function heatLevel(seconds) {
  if (!seconds) return 0;
  if (seconds < 180) return 1;
  if (seconds < 600) return 2;
  if (seconds < 1200) return 3;
  return 4;
}

function renderHeatmap(history) {
  const totals = dailyTotals(history);
  const wrap = $('#heatmap');
  wrap.innerHTML = '';
  const today = dateKey();
  // 今日を含む週の土曜までを埋めて、13週ぶんを縦7マスで並べる
  const todayDow = new Date(today + 'T00:00:00').getDay();
  const end = addDays(today, 6 - todayDow);
  for (let i = 90; i >= 0; i--) {
    const day = addDays(end, -i);
    const seconds = totals.get(day) || 0;
    const cell = el('i', `cell h${day > today ? 'x' : heatLevel(seconds)}`);
    cell.title = day > today ? day : `${day}：${seconds ? Math.round(seconds / 60) + '分' : '練習なし'}`;
    wrap.append(cell);
  }
}

function renderDrillBars(s) {
  const wrap = $('#drill-bars');
  wrap.innerHTML = '';
  const entries = [...s.byDrill.entries()].sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    wrap.append(el('p', 'muted small', 'まだ記録がありません。'));
    return;
  }
  const max = entries[0][1];
  for (const [id, sec] of entries) {
    const bar = el('div', 'bar');
    bar.style.width = `${Math.max(4, (sec / max) * 100)}%`;
    const track = el('div', 'bar-track');
    track.append(bar);

    const row = el('div', 'bar-row');
    row.append(
      el('div', 'bar-label', DRILLS[id]?.name || id),
      track,
      el('div', 'bar-value muted small', fmtDuration(sec)),
    );
    wrap.append(row);
  }
}

function renderNotes(history) {
  const wrap = $('#note-list');
  wrap.innerHTML = '';
  const notes = history.filter((h) => h.note || h.hasDrawing).slice(-20).reverse();
  if (!notes.length) {
    wrap.append(el('p', 'muted small', 'ふりかえりのメモがここに並びます。'));
    return;
  }
  const ratingText = { 1: 'むずかしかった', 2: 'まあまあ', 3: 'つかめた' };
  for (const entry of notes) {
    const item = el('div', 'note-item');
    const head = el('div', 'note-head');
    head.append(
      el('span', 'note-date', entry.date),
      el('span', 'muted small', focusForDate(entry.date).title),
    );
    if (entry.rating) head.append(el('span', `rate-tag r${entry.rating}`, ratingText[entry.rating]));
    item.append(head);
    if (entry.note) item.append(el('p', 'note-body', entry.note));
    if (entry.hasDrawing) {
      const img = el('img', 'note-thumb');
      getDrawing(entry.id)
        .then((blob) => { if (blob) img.src = URL.createObjectURL(blob); })
        .catch(() => {});
      item.append(img);
    }
    wrap.append(item);
  }
}

/* ==================== 設定 ==================== */

function renderSettings() {
  settings = getSettings();
  $$('#source-radios input').forEach((r) => { r.checked = r.value === settings.source; });
  $('#unsplash-key').value = settings.unsplashKey || '';
  $('#opt-sound').checked = settings.sound;
  $('#opt-autoflip').checked = settings.autoFlip;
  $('#opt-keepawake').checked = settings.keepAwake;
  $('#opt-orientation').value = settings.orientation;
  $('#local-count').textContent = `${localFiles.items.length}枚`;
  updateSourceVisibility();
  renderTheory();
}

function updateSourceVisibility() {
  $('#unsplash-config').hidden = settings.source !== 'unsplash';
  $('#local-config').hidden = settings.source !== 'local';
}

function renderTheory() {
  const wrap = $('#theory-list');
  if (wrap.childElementCount) return;
  for (const p of PRINCIPLES) {
    const item = el('div', 'theory-item');
    item.append(
      el('h3', null, p.title),
      el('p', 'muted small', p.body),
      el('p', 'source muted small', p.source),
    );
    wrap.append(item);
  }
}

function wireSettings() {
  $$('#source-radios input').forEach((radio) => {
    radio.addEventListener('change', () => {
      settings = saveSettings({ source: radio.value });
      updateSourceVisibility();
    });
  });

  $('#key-save').addEventListener('click', () => {
    settings = saveSettings({ unsplashKey: $('#unsplash-key').value.trim() });
    $('#key-status').textContent = '保存しました';
  });

  $('#key-test').addEventListener('click', async () => {
    const key = $('#unsplash-key').value.trim();
    const status = $('#key-status');
    if (!key) return void (status.textContent = 'キーを入れてください');
    status.textContent = '接続中…';
    try {
      const { remaining } = await testUnsplashKey(key);
      settings = saveSettings({ unsplashKey: key });
      status.textContent = `OK（この時間あと ${remaining ?? '?'} 回）`;
    } catch (err) {
      status.textContent = `NG：${err.message}`;
    }
  });

  $('#local-btn').addEventListener('click', () => $('#local-input').click());
  $('#local-input').addEventListener('change', (e) => {
    const count = localFiles.set(e.target.files || []);
    $('#local-count').textContent = `${count}枚`;
  });

  const bind = (sel, key) => $(sel).addEventListener('change', (e) => {
    settings = saveSettings({ [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  });
  bind('#opt-sound', 'sound');
  bind('#opt-autoflip', 'autoFlip');
  bind('#opt-keepawake', 'keepAwake');
  bind('#opt-orientation', 'orientation');

  $('#export-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ settings: { ...settings, unsplashKey: '' }, history: getHistory() }, null, 2)],
      { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `croqui-${dateKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#reset-btn').addEventListener('click', async () => {
    if (!confirm('練習記録と設定をすべて消します。元に戻せません。')) return;
    clearAll();
    await deleteAllDrawings().catch(() => {});
    settings = getSettings();
    renderSettings();
    renderHome();
    toast('消しました');
  });
}

/* ==================== 起動 ==================== */

function wireNav() {
  $$('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;
      if (target === 'log') renderLog();
      if (target === 'settings') renderSettings();
      if (target === 'home') renderHome();
      showScreen(target);
    });
  });
}

function init() {
  wireNav();
  wireReview();
  wireSettings();
  renderHome();
  showScreen('home');

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
