/**
 * app.js — 画面の組み立てと配線。
 */

import {
  MENUS, DRILLS, PRINCIPLES, CATEGORIES,
  TIME_CHOICES, COUNT_CHOICES, timeLabel, buildCustomMenu,
  levelFor, levelLabel, scaleMenu, menuDuration, focusForDate, availableCategories,
} from './theory.js';
import {
  getSettings, saveSettings, getHistory, addSession, updateLastSession, clearAll,
  dateKey, addDays, dailyTotals, stats,
} from './storage.js';
import { LESSONS, PD_BOOKS, lessonById } from './anatomy.js';
import { createPhotoQueue, localFiles, testUnsplashKey } from './images.js';
import { searchPlatesMulti, createPlateQueue } from './commons.js';
import {
  ensureLessonCards, cardsForLesson, dueCards, weakestLesson,
  grade, reminderFor, injectWeakStep, buildReviewMenu, syncWeakParts,
} from './review.js';
import { createSessionRunner } from './session.js';
import { putDrawing, getDrawing, deleteAllDrawings, deleteAllPhotos, shrinkImage } from './db.js';
import {
  TAG_GROUPS, ALL_TAGS, allPhotos, addFiles, setTags, removePhoto, createLibraryQueue,
} from './library.js';
import {
  totalXp, levelProgress, graceStreak, bestGraceStreak, badges, takeNewBadges, primeBadges,
  takeLevelUp, dailyQuests, resetGame,
} from './game.js';
import { sfx } from './timer.js';
import { $, $$, el, showScreen, toast, fmtDuration } from './ui.js';
import { icon, paintIcons } from './icons.js';

let settings = getSettings();
let pendingDrawings = [];    // その回に描いた絵（保存前）


/* ==================== ホーム ==================== */

function renderHome() {
  const history = getHistory();
  const s = stats(history);
  const level = levelFor(s.sessions);
  const today = dateKey();
  const focus = focusForDate(today);
  const { streak } = graceStreak(history);
  const xp = levelProgress(totalXp(history));

  $('#streak-count').textContent = String(streak);
  $('#level-num').textContent = `Lv.${xp.level}`;
  $('#level-name').textContent = levelLabel(Math.min(5, xp.level));
  $('#xp-fill').style.width = `${xp.ratio * 100}%`;

  const doneToday = dailyTotals(history).has(today);
  const status = $('#today-status');
  status.textContent = doneToday ? '今日は完了' : '今日はまだ';
  status.classList.toggle('done', doneToday);

  $('#focus-title').textContent = focus.title;
  $('#focus-desc').textContent = focus.desc;

  allPhotos().then((ps) => { $('#library-count').textContent = String(ps.length); }).catch(() => {});
  renderStreakDots(history);
  renderQuests(history);
  renderBadges(history);
  renderLessonChips();
  renderMenus(level);
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

function renderQuests(history) {
  const list = $('#quest-list');
  list.innerHTML = '';
  for (const quest of dailyQuests(history)) {
    const item = el('li', `quest${quest.done ? ' done' : ''}`);
    const main = el('div', 'quest-main');
    main.append(el('div', 'quest-title', quest.title), el('div', 'quest-detail', quest.detail));
    const mark = el('span', 'quest-mark');
    mark.innerHTML = quest.done ? icon('check', 20) : '';
    const ico = el('span', 'quest-icon');
    ico.innerHTML = icon(quest.icon, 20);
    item.append(ico, main, mark);
    list.append(item);
  }
}

function renderBadges(history) {
  const list = badges(history);
  const earned = list.filter((b) => b.earned).length;
  $('#badge-count').textContent = `${earned} / ${list.length}`;

  const grid = $('#badge-grid');
  grid.innerHTML = '';
  for (const badge of list) {
    const item = el('div', `badge-item ${badge.earned ? 'earned' : 'locked'}`);
    item.append(el('div', 'badge-face', badge.earned ? badge.icon : '？'),
                el('div', 'badge-name', badge.earned ? badge.name : '？？？'));
    item.title = badge.earned ? `${badge.name} — ${badge.desc}` : badge.desc;
    grid.append(item);
  }
}

/** レベルアップとバッジ獲得を、順番に1つずつ見せる。 */
function celebrate(history = getHistory()) {
  const events = [];
  const level = takeLevelUp(totalXp(history));
  if (level) events.push({ big: '🎉', title: `レベル ${level} になった`, sound: 'levelUp' });
  for (const badge of takeNewBadges(history)) {
    events.push({ big: badge.icon, title: `${badge.name} を獲得`, sound: 'badge' });
  }
  if (!events.length) return;

  events.forEach((event, i) => {
    setTimeout(() => {
      if (settings.sfx) sfx[event.sound]?.();
      const box = el('div', 'celebrate');
      box.append(el('div', 'big', event.big), el('div', 'title', event.title));
      document.body.append(box);
      setTimeout(() => box.remove(), 1800);
    }, i * 1400);
  });
}

/**
 * 押すものが4つ並ぶと、どれを押すか考える時間ができてしまう。
 * ふだんは1枚だけ大きく出し、残りは下に小さく置く。
 */
function renderMenus(level) {
  const menus = MENUS.map((base) => scaleMenu(base, level));
  const primary = menus.find((m) => m.id === 'daily') || menus[0];

  const top = $('#menu-primary');
  top.innerHTML = '';
  const hero = el('button', 'menu-card primary-card');
  hero.append(
    el('div', 'menu-kicker', 'きょうの練習'),
    el('div', 'menu-title big', 'じぶんで決めて描く'),
    el('div', 'menu-sub', '何を・何分・何枚・どう描くかを選んでから始めます'),
    el('div', 'menu-time', '時間はここで決められます'),
  );
  hero.addEventListener('click', openSetup);
  top.append(hero);

  const wrap = $('#menu-cards');
  wrap.innerHTML = '';
  for (const menu of menus) {
    if (menu === primary) continue;
    const card = el('button', 'menu-card slim');
    card.append(el('div', 'menu-title', menu.title),
                el('div', 'menu-time', `約${fmtDuration(menuDuration(menu))}`));
    card.addEventListener('click', () => startSession(menu));
    wrap.append(card);
  }
}

function renderCategories() {
  const wrap = $('#category-chips');
  wrap.innerHTML = '';
  for (const cat of availableCategories()) {
    const on = settings.categories.includes(cat.id);
    const chip = el('button', `chip${on ? ' on' : ''}`, cat.label);
    chip.addEventListener('click', () => {
      const next = new Set(settings.categories);
      next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
      if (next.size === 0) return toast('ジャンルは1つ以上えらんでください');
      settings = saveSettings({ categories: [...next] });
      renderCategories();
    });
    wrap.append(chip);
  }
}

/* ==================== はじめる前の設定 ==================== */

/*
 * 「30秒固定では描けない」という声のとおり、時間は本人が決めるもの。
 * 何を・何分・何枚・どう描くか、をここで選んでから始める。
 */
const setup = { tags: [], seconds: 120, count: 5, drill: 'gesture' };

function openSetup() {
  renderSetupTags();
  renderSetupChips();
  $('#setup-sheet').hidden = false;
}

function renderSetupTags() {
  const wrap = $('#setup-tags');
  wrap.innerHTML = '';
  for (const tag of ALL_TAGS) {
    const chip = el('button', `chip${setup.tags.includes(tag) ? ' on' : ''}`, tag);
    chip.addEventListener('click', () => {
      const next = new Set(setup.tags);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      setup.tags = [...next];
      renderSetupTags();
    });
    wrap.append(chip);
  }
}

function renderSetupChips() {
  const time = $('#setup-time');
  time.innerHTML = '';
  for (const sec of TIME_CHOICES) {
    const chip = el('button', `chip${setup.seconds === sec ? ' on' : ''}`, timeLabel(sec));
    chip.addEventListener('click', () => { setup.seconds = sec; renderSetupChips(); });
    time.append(chip);
  }

  const count = $('#setup-count');
  count.innerHTML = '';
  for (const n of COUNT_CHOICES) {
    const chip = el('button', `chip${setup.count === n ? ' on' : ''}`, `${n}枚`);
    chip.addEventListener('click', () => { setup.count = n; renderSetupChips(); });
    count.append(chip);
  }

  const drills = $('#setup-drill');
  drills.innerHTML = '';
  for (const id of ['gesture', 'mass', 'landmark', 'contour', 'notan', 'memory']) {
    const chip = el('button', `chip${setup.drill === id ? ' on' : ''}`, DRILLS[id].name);
    chip.addEventListener('click', () => { setup.drill = id; renderSetupChips(); });
    drills.append(chip);
  }
  $('#setup-drill-note').textContent = (DRILLS[setup.drill].steps || []).join(' → ');
  $('#setup-total').textContent = fmtDuration(setup.seconds * setup.count);
}

function wireSetup() {
  $('#setup-close').addEventListener('click', () => { $('#setup-sheet').hidden = true; });
  $('#setup-sheet').addEventListener('click', (e) => {
    if (e.target.id === 'setup-sheet') $('#setup-sheet').hidden = true;
  });
  $('#setup-start').addEventListener('click', () => {
    $('#setup-sheet').hidden = true;
    startSession(buildCustomMenu(setup), { tags: setup.tags });
  });
}

/* ==================== 写真の管理 ==================== */

let libFilter = [];

async function openLibrary() {
  showScreen('library');
  await renderLibrary();
}

async function renderLibrary() {
  const photos = await allPhotos({ fresh: true });
  $('#lib-empty').hidden = photos.length > 0;

  const filter = $('#lib-filter');
  filter.innerHTML = '';
  for (const tag of ALL_TAGS) {
    const chip = el('button', `chip${libFilter.includes(tag) ? ' on' : ''}`, tag);
    chip.addEventListener('click', () => {
      const next = new Set(libFilter);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      libFilter = [...next];
      renderLibrary();
    });
    filter.append(chip);
  }

  const shown = libFilter.length
    ? photos.filter((p) => libFilter.every((t) => p.tags.includes(t)))
    : photos;

  const grid = $('#lib-grid');
  grid.innerHTML = '';
  for (const photo of shown) {
    const item = el('button', 'lib-item');
    const img = el('img');
    img.src = URL.createObjectURL(photo.blob);
    item.append(img);
    if (photo.tags.length) item.append(el('div', 'lib-tags', photo.tags.join('・')));
    item.addEventListener('click', () => openPhoto(photo));
    grid.append(item);
  }
  $('#library-count').textContent = String(photos.length);
}

/** 写真1枚。タグを付け替えられて、これまでの記録も見られる。 */
function openPhoto(photo) {
  $('#photo-big').src = URL.createObjectURL(photo.blob);

  const tags = $('#photo-tags');
  tags.innerHTML = '';
  for (const group of TAG_GROUPS) {
    tags.append(el('div', 'label', group.name));
    const row = el('div', 'chips');
    for (const tag of group.tags) {
      const chip = el('button', `chip${photo.tags.includes(tag) ? ' on' : ''}`, tag);
      chip.addEventListener('click', async () => {
        const next = new Set(photo.tags);
        next.has(tag) ? next.delete(tag) : next.add(tag);
        photo.tags = [...next];
        await setTags(photo.id, photo.tags);
        openPhoto(photo);
        renderLibrary();
      });
      row.append(chip);
    }
    tags.append(row);
  }

  renderPhotoHistory(photo.id);

  $('#photo-delete').onclick = async () => {
    if (!confirm('この写真を消します。よろしいですか？')) return;
    await removePhoto(photo.id);
    $('#photo-sheet').hidden = true;
    renderLibrary();
  };
  $('#photo-sheet').hidden = false;
}

/** 同じ写真を前にどれくらいの時間で描いたか。並べて見えると伸びが分かる。 */
function renderPhotoHistory(photoId) {
  const wrap = $('#photo-history');
  wrap.innerHTML = '';
  const attempts = [];
  for (const entry of getHistory()) {
    for (const shot of entry.shots || []) {
      if (shot.photoId === photoId) attempts.push({ entry, shot });
    }
  }
  if (!attempts.length) {
    wrap.append(el('p', 'muted small', 'まだこの写真では描いていません。'));
    return;
  }
  attempts.forEach(({ entry, shot }, i) => {
    const box = el('div', `attempt${i === attempts.length - 1 ? ' latest' : ''}`);
    const img = el('img');
    getDrawing(`${entry.id}#${shot.index}`)
      .then((blob) => { if (blob) img.src = URL.createObjectURL(blob); })
      .catch(() => {});
    box.append(img, el('div', 'attempt-meta',
      `${entry.date}・${shot.seconds ? fmtDuration(shot.seconds) : '—'}`));
    wrap.append(box);
  });
}

function wireLibrary() {
  $('#library-cta').addEventListener('click', openLibrary);
  $('#lib-add').addEventListener('click', () => $('#lib-input').click());
  $('#lib-input').addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    toast(`${files.length}枚を取り込んでいます…`);
    const added = await addFiles(files, libFilter);
    e.target.value = '';
    await renderLibrary();
    toast(`${added.length}枚いれました。タップしてタグを付けてください`);
  });
  $('#photo-close').addEventListener('click', () => { $('#photo-sheet').hidden = true; });
  $('#photo-sheet').addEventListener('click', (e) => {
    if (e.target.id === 'photo-sheet') $('#photo-sheet').hidden = true;
  });
}

/* ==================== 解剖レッスン ==================== */

function renderLessonChips() {
  const wrap = $('#lesson-chips');
  wrap.innerHTML = '';
  for (const lesson of LESSONS) {
    const chip = el('button', 'chip lesson-chip', lesson.name);
    chip.addEventListener('click', () => openLesson(lesson.id));
    wrap.append(chip);
  }
}

let currentLesson = null;

function openLesson(id) {
  const lesson = lessonById(id);
  if (!lesson) return;
  currentLesson = lesson;

  $('#lesson-name').textContent = lesson.name;
  $('#lesson-tagline').textContent = lesson.tagline;
  $('#lesson-problem').textContent = lesson.problem;

  const steps = $('#lesson-steps');
  steps.innerHTML = '';
  for (const step of lesson.steps) {
    const item = el('div', 'lesson-step');
    item.append(el('h3', null, step.title), el('p', null, step.body));
    steps.append(item);
  }

  fillList('#lesson-landmarks', lesson.landmarks);
  fillList('#lesson-proportions', lesson.proportions);

  const mistakes = $('#lesson-mistakes');
  mistakes.innerHTML = '';
  for (const m of lesson.mistakes) {
    const row = el('div', 'mistake');
    row.append(el('div', 'mistake-bad', `✕ ${m.bad}`), el('div', 'mistake-fix', `→ ${m.fix}`));
    mistakes.append(row);
  }

  const books = $('#lesson-books');
  books.innerHTML = '';
  books.append(el('div', 'label', '出典（すべて著作権保護期間が満了した書籍）'));
  for (const b of PD_BOOKS) {
    books.append(el('p', 'muted small', `${b.author}『${b.title}』${b.year} — ${b.note}`));
  }

  $('#lesson-review').hidden = dueCards().every((c) => c.lessonId !== lesson.id);

  $('#plate-gallery').innerHTML = '';
  $('#plate-status').textContent = '';
  showScreen('lesson');
  loadPlates(lesson);
}

function fillList(sel, items) {
  const list = $(sel);
  list.innerHTML = '';
  for (const text of items) list.append(el('li', null, text));
}

async function loadPlates(lesson) {
  const gallery = $('#plate-gallery');
  const status = $('#plate-status');
  gallery.innerHTML = '';
  status.textContent = '図版を探しています…';
  try {
    const plates = await searchPlatesMulti(lesson.refQueries, { limit: 8, width: 800 });
    if (!plates.length) {
      status.textContent = '図版が見つかりませんでした（通信環境かCommons側の問題かもしれません）。' +
                           '解説と練習はこのまま使えます。';
      return;
    }
    status.textContent = '';
    for (const plate of plates.slice(0, 12)) {
      const thumb = el('button', 'plate-thumb');
      const img = el('img');
      img.src = plate.url;
      img.alt = plate.title;
      img.loading = 'lazy';
      thumb.append(img);
      thumb.addEventListener('click', () => openLightbox(plate));
      gallery.append(thumb);
    }
  } catch (err) {
    status.textContent = `図版を取得できませんでした（${err.message}）。解説と練習はこのまま使えます。`;
  }
}

function openLightbox(plate) {
  $('#lightbox-img').src = plate.url;
  $('#lightbox-img').alt = plate.title;
  const caption = $('#lightbox-caption');
  caption.innerHTML = '';
  caption.append(el('div', null, plate.title));
  const credit = el('div', 'muted small');
  credit.textContent = `${plate.credit.name} / ${plate.credit.source}`;
  caption.append(credit);
  if (plate.credit.link) {
    const a = el('a', 'small', 'Commons で見る');
    a.href = plate.credit.link;
    a.target = '_blank';
    a.rel = 'noopener';
    caption.append(a);
  }
  $('#lightbox').hidden = false;
}

function wireLesson() {
  $('#plate-reload').addEventListener('click', () => currentLesson && loadPlates(currentLesson));
  $('#lesson-practice').addEventListener('click', () => currentLesson && startLesson(currentLesson));
  $('#lesson-review').addEventListener('click', () => {
    if (currentLesson) startMenuWithLesson(buildReviewMenu(currentLesson), currentLesson, 'weak');
  });
  $('#lightbox-close').addEventListener('click', () => { $('#lightbox').hidden = true; });
  $('#lightbox').addEventListener('click', (e) => {
    if (e.target.id === 'lightbox') $('#lightbox').hidden = true;
  });
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

let lastStart = null;   // 「もう1セットやる」用に、直前の開始手順をそのまま覚えておく

const notice = (msg) => toast(msg);

/**
 * ふだんのメニュー。期限の来た復習があれば、その部位のドリルを1本ねじ込む。
 * 復習を別画面のタスクにすると誰もやらないので、いつもの導線に混ぜてしまう。
 */
function startSession(menu, { tags = null } = {}) {
  lastStart = () => startSession(menu, { tags });
  settings = getSettings();
  const weak = weakestLesson();
  // タグが選ばれていれば自分の写真から、そうでなければ検索した写真から
  const queues = {
    photo: tags
      ? createLibraryQueue(tags, notice)
      : createPhotoQueue(settings, notice),
  };
  if (weak) {
    queues[`weak:${weak.id}`] =
      createPhotoQueue(settings, notice, { queryOverride: weak.photoQuery });
  }
  runner.start({
    menu: weak ? injectWeakStep(menu, weak) : menu,
    queues,
    settings,
    focus: focusForDate(dateKey()),
    lessonId: weak?.id || null,
    lessonMode: 'weak',
    reminder: weak ? reminderFor(weak.id) : null,
  });
}

/** 解剖レッスンの練習：図版の模写と、同じ部位の写真を混ぜて回す。 */
function startLesson(lesson) {
  lastStart = () => startLesson(lesson);
  settings = getSettings();
  const partPhotos = createPhotoQueue(settings, notice, { queryOverride: lesson.photoQuery });
  runner.start({
    menu: lesson.practice,
    queues: {
      photo: partPhotos,
      [`weak:${lesson.id}`]: partPhotos,
      plate: createPlateQueue(lesson.refQueries, notice),
    },
    settings,
    focus: focusForDate(dateKey()),
    lessonId: lesson.id,
    lessonMode: 'lesson',
    reminder: reminderFor(lesson.id),
  });
}

/** 復習だけをやる（ホームの「◯◯を復習」から）。 */
function startMenuWithLesson(menu, lesson, lessonMode) {
  lastStart = () => startMenuWithLesson(menu, lesson, lessonMode);
  settings = getSettings();
  const partPhotos = createPhotoQueue(settings, notice, { queryOverride: lesson.photoQuery });
  runner.start({
    menu,
    queues: { photo: partPhotos, [`weak:${lesson.id}`]: partPhotos },
    settings,
    focus: focusForDate(dateKey()),
    lessonId: lesson.id,
    lessonMode,
    reminder: reminderFor(lesson.id),
  });
}

function saveResult(result) {
  const { drawings, ...rest } = result;     // 画像そのものは履歴（localStorage）に入れない
  return addSession({
    id: `s${Date.now()}`,
    date: dateKey(),
    ts: Date.now(),
    ...rest,
  });
}

function finishSession(result) {
  const entry = saveResult(result);
  if (settings.sfx) sfx.fanfare();

  // 画面内のキャンバスに描いていたら、撮り直さなくていいように引き継ぐ
  pendingDrawings = result.drawings || [];
  renderDrawingStrip();
  $('#review-note').value = '';
  $$('.rate-btn').forEach((b) => b.classList.remove('on'));

  const focus = focusForDate(entry.date);
  $('#review-focus').textContent = focus.title;
  renderReviewChecks(entry.lessonId, entry.lessonMode);

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

/**
 * その部位のチェック項目を出す。ここでの ○✕ がそのまま復習カードの採点になる。
 * レッスンをやった直後は全項目、ふだんのメニューに苦手が混ざっただけのときは
 * 期限の来ているものだけを出す（毎回全部聞かれると答えるのが面倒になるため）。
 */
function renderReviewChecks(lessonId, lessonMode) {
  const card = $('#review-checks-card');
  const list = $('#review-checks');
  const lesson = lessonId ? lessonById(lessonId) : null;
  list.innerHTML = '';
  card.hidden = !lesson;
  if (!lesson) return;

  ensureLessonCards(lesson.id);
  const cards = lessonMode === 'lesson'
    ? cardsForLesson(lesson.id)
    : dueCards().filter((c) => c.lessonId === lesson.id).slice(0, 4);

  if (!cards.length) { card.hidden = true; return; }

  for (const item of cards) {
    const li = el('li');
    const btn = el('button', 'check-btn', item.text);
    btn.dataset.cardId = item.id;
    btn.addEventListener('click', () => {
      btn.classList.toggle('on');
      if (settings.sfx && btn.classList.contains('on')) sfx.check();
    });
    li.append(btn);
    list.append(li);
  }
}

/** その回に描いた絵をならべる。押すと外せる。 */
function renderDrawingStrip() {
  const strip = $('#drawing-strip');
  strip.innerHTML = '';
  strip.hidden = pendingDrawings.length === 0;
  $('#drawing-count').textContent = pendingDrawings.length
    ? `${pendingDrawings.length}枚`
    : '';
  pendingDrawings.forEach((shot, i) => {
    const item = el('button', 'strip-item');
    const img = el('img');
    img.src = URL.createObjectURL(shot.blob);
    item.append(img);
    item.title = '押すと外す';
    item.addEventListener('click', () => {
      pendingDrawings.splice(i, 1);
      renderDrawingStrip();
    });
    strip.append(item);
  });
}

function wireReview() {
  $$('.rate-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.rate-btn').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      if (settings.sfx) sfx.tap();
    });
  });

  $('#drawing-btn').addEventListener('click', () => $('#drawing-input').click());
  $('#drawing-input').addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])];
    for (const file of files) {
      try { pendingDrawings.push({ blob: await shrinkImage(file), photoId: null, seconds: null }); }
      catch { toast('画像を読み込めませんでした'); }
    }
    renderDrawingStrip();
    e.target.value = '';
  });

  $('#review-save').addEventListener('click', async () => {
    const rated = $$('.rate-btn').find((b) => b.classList.contains('on'));
    const checkBtns = $$('#review-checks .check-btn');
    const missed = [];
    for (const btn of checkBtns) {
      const ok = btn.classList.contains('on');
      grade(btn.dataset.cardId, ok);          // ここで次に出る日が決まる
      if (!ok) missed.push(btn.firstChild.textContent);
    }
    const entry = updateLastSession({
      rating: rated ? Number(rated.dataset.rate) : null,
      note: $('#review-note').value.trim() || null,
      hasDrawing: pendingDrawings.length > 0,
      drawingCount: pendingDrawings.length || null,
      // どの写真を何秒で描いたか。あとで「前は何分だったか」を出すのに使う
      shots: pendingDrawings.map((shot, i) => ({
        index: i, photoId: shot.photoId || null, seconds: shot.seconds || null,
      })),
      missed: missed.length ? missed : null,   // 次回の宿題になる
    });
    if (entry) {
      try {
        // 1枚目がカレンダーの顔になる
        await Promise.all(pendingDrawings.map((shot, i) => putDrawing(`${entry.id}#${i}`, shot.blob)));
      } catch { toast('絵の保存に失敗しました（記録は残ります）'); }
    }
    pendingDrawings = [];
    renderHome();
    showScreen('home');
    celebrate();
  });

  $('#review-again').addEventListener('click', () => lastStart?.());
}

/* ==================== 記録 ==================== */

function renderLog() {
  const history = getHistory();
  const s = stats(history);
  $('#st-streak').textContent = String(graceStreak(history).streak);
  $('#st-best').textContent = String(bestGraceStreak(history));
  $('#st-minutes').textContent = String(s.minutes);

  renderCalendar(history);
  renderDrillBars(s);
  renderNotes(history);
}

/* ---------- 絵を貼るカレンダー ---------- */

let calMonth = null;   // 'YYYY-MM'

/** 1枚目の絵。古い記録は連番なしのキーで入っているので、そちらも見る。 */
async function loadDrawing(entryId) {
  return (await getDrawing(`${entryId}#0`)) || (await getDrawing(entryId));
}

function monthKey(dateStr) { return dateStr.slice(0, 7); }

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 月表示のカレンダー。その日に描いた絵の写真があればマスに貼り、
 * 無ければ練習量で色を濃くする。「過去が見える」ことが続ける理由になるので。
 */
function renderCalendar(history = getHistory()) {
  calMonth ||= monthKey(dateKey());
  const [year, month] = calMonth.split('-').map(Number);
  $('#cal-title').textContent = `${year}年 ${month}月`;

  const totals = dailyTotals(history);
  // 1日にセッションが複数あることがあるので、絵がある方を優先して1つ選ぶ
  const byDay = new Map();
  for (const entry of history) {
    const current = byDay.get(entry.date);
    if (!current || (entry.hasDrawing && !current.hasDrawing)) byDay.set(entry.date, entry);
  }

  const grid = $('#calendar');
  grid.innerHTML = '';
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = dateKey();

  for (let i = 0; i < first.getDay(); i++) grid.append(el('div', 'cal-cell empty'));

  for (let day = 1; day <= daysInMonth; day++) {
    const dayKey = `${calMonth}-${String(day).padStart(2, '0')}`;
    const seconds = totals.get(dayKey) || 0;
    const entry = byDay.get(dayKey);

    const cell = el('button', 'cal-cell');
    if (seconds) cell.classList.add(`l${heatLevel(seconds)}`, 'filled');
    if (dayKey === today) cell.classList.add('today');
    cell.append(el('span', 'cal-num', String(day)));

    if (entry?.hasDrawing) {
      cell.classList.add('has-drawing');
      const img = el('img');
      loadDrawing(entry.id).then((blob) => { if (blob) img.src = URL.createObjectURL(blob); }).catch(() => {});
      cell.prepend(img);
    } else if (entry?.lessonId) {
      cell.append(el('span', 'cal-dot', '🦴'));
    }

    cell.title = seconds ? `${dayKey}：${fmtDuration(seconds)}` : dayKey;
    cell.addEventListener('click', () => openDaySheet(dayKey, history));
    grid.append(cell);
  }
}

function openDaySheet(dayKey, history = getHistory()) {
  const entries = history.filter((h) => h.date === dayKey);
  $('#sheet-date').textContent = dayKey;

  const seconds = entries.reduce((sum, e) => sum + (e.seconds || 0), 0);
  $('#sheet-title').textContent = seconds ? `${fmtDuration(seconds)} 描いた` : 'この日は休み';

  const image = $('#sheet-image');
  const withDrawing = entries.find((e) => e.hasDrawing);
  image.hidden = true;
  if (withDrawing) {
    loadDrawing(withDrawing.id)
      .then((blob) => { if (blob) { image.src = URL.createObjectURL(blob); image.hidden = false; } })
      .catch(() => {});
  }

  const body = $('#sheet-body');
  body.innerHTML = '';
  for (const entry of entries) {
    const block = el('div', 'note-item');
    const head = el('div', 'note-head');
    head.append(el('span', 'note-date', entry.menuTitle || '練習'));
    if (entry.lessonId) head.append(el('span', 'rate-tag', lessonById(entry.lessonId)?.name || ''));
    block.append(head);
    const drills = Object.entries(entry.byDrill || {})
      .map(([id, sec]) => `${DRILLS[id]?.name || id} ${fmtDuration(sec)}`).join(' / ');
    if (drills) block.append(el('p', 'muted small', drills));
    if (entry.note) block.append(el('p', 'note-body', entry.note));
    body.append(block);
  }
  if (!entries.length) body.append(el('p', 'muted small', '記録はありません。'));

  $('#day-sheet').hidden = false;
}

function heatLevel(seconds) {
  if (!seconds) return 0;
  if (seconds < 180) return 1;
  if (seconds < 600) return 2;
  if (seconds < 1200) return 3;
  return 4;
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
  const notes = history.filter((h) => h.note || h.hasDrawing || h.missed?.length).slice(-20).reverse();
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
    if (entry.lessonId) head.append(el('span', 'rate-tag', lessonById(entry.lessonId)?.name || ''));
    item.append(head);
    if (entry.note) item.append(el('p', 'note-body', entry.note));
    if (entry.missed?.length) {
      const todo = el('div', 'todo');
      todo.append(el('span', 'label', '次回の宿題'));
      for (const text of entry.missed) todo.append(el('div', 'todo-item', `・${text}`));
      item.append(todo);
    }
    if (entry.hasDrawing) {
      const img = el('img', 'note-thumb');
      loadDrawing(entry.id)
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
  $('#opt-theme').value = settings.theme;
  $('#opt-sound').checked = settings.sound;
  $('#opt-sfx').checked = settings.sfx;
  $('#opt-autoflip').checked = settings.autoFlip;
  $('#opt-keepawake').checked = settings.keepAwake;
  $('#opt-orientation').value = settings.orientation;
  $('#local-count').textContent = `${localFiles.items.length}枚`;
  updateSourceVisibility();
  renderCategories();
  renderWeakChips();
  renderTheory();
}

function renderWeakChips() {
  const wrap = $('#weak-chips');
  wrap.innerHTML = '';
  for (const lesson of LESSONS) {
    const on = settings.weakParts.includes(lesson.id);
    const chip = el('button', `chip${on ? ' on' : ''}`, lesson.name);
    chip.addEventListener('click', () => {
      const next = new Set(settings.weakParts);
      next.has(lesson.id) ? next.delete(lesson.id) : next.add(lesson.id);
      settings = saveSettings({ weakParts: [...next] });
      syncWeakParts(settings.weakParts);      // 選んだ瞬間から復習に出す
      renderWeakChips();
      toast(next.has(lesson.id)
        ? `${lesson.name}を復習に入れました`
        : `${lesson.name}を外しました（出ているカードは予定どおり残ります）`);
    });
    wrap.append(chip);
  }
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
  bind('#opt-sfx', 'sfx');
  $('#opt-theme').addEventListener('change', (e) => {
    settings = saveSettings({ theme: e.target.value });
    applyTheme();
  });
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
    resetGame();
    await deleteAllDrawings().catch(() => {});
    await deleteAllPhotos().catch(() => {});
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
      if (target === 'library') { openLibrary(); return; }
      if (target === 'settings') renderSettings();
      if (target === 'home') renderHome();
      showScreen(target);
    });
  });
}

const THEME_COLORS = { light: '#f7f7f5', dark: '#000000', paper: '#f5f4ee' };

function applyTheme() {
  document.body.dataset.theme = settings.theme;
  // ブラウザのUI（アドレスバー）の色も合わせる
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLORS[settings.theme] || THEME_COLORS.light;
}

function wireCalendar() {
  $('#cal-prev').addEventListener('click', () => { calMonth = shiftMonth(calMonth, -1); renderCalendar(); });
  $('#cal-next').addEventListener('click', () => { calMonth = shiftMonth(calMonth, 1); renderCalendar(); });
  $('#sheet-close').addEventListener('click', () => { $('#day-sheet').hidden = true; });
  $('#day-sheet').addEventListener('click', (e) => {
    if (e.target.id === 'day-sheet') $('#day-sheet').hidden = true;
  });
}

function init() {
  applyTheme();
  paintIcons();
  wireNav();
  wireReview();
  wireLesson();
  wireSetup();
  wireLibrary();
  wireCalendar();
  wireSettings();
  primeBadges();          // 初回は既存の達成を黙って既読にする
  renderHome();
  showScreen('home');

  // ブラウザは操作なしに音を出せないので、最初のタップで鳴らせるようにしておく
  document.addEventListener('pointerdown', () => { if (settings.sfx) sfx.unlock(); }, { once: true });

  // ボタンはすべて押した瞬間に鳴らす（キャンバスの道具だけは連打するので鳴らさない）
  document.addEventListener('pointerdown', (e) => {
    if (!settings.sfx) return;
    const button = e.target.closest('button');
    if (!button || button.disabled || button.closest('.pad-wrap')) return;
    sfx.tap();
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
