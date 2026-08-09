/**
 * app.js — 画面の組み立てと配線。
 */

import {
  buildDaily, MODES, PARTS, DRILLS, PRINCIPLES, PICKABLE_DRILLS,
  TIME_CHOICES, COUNT_CHOICES, timeLabel, buildCustomMenu, buildPartMenu,
  levelLabel, menuDuration, availableCategories,
} from './theory.js';
import {
  getSettings, saveSettings, getHistory, addSession, updateLastSession, clearAll,
  dateKey, addDays, dailyTotals, drawingsByDay, totalDrawings, roundsToday, stats,
} from './storage.js';
import { LESSONS, PD_BOOKS, lessonById } from './anatomy.js';
import { createPhotoQueue, localFiles, testUnsplashKey } from './images.js';
import { searchPlatesMulti, createPlateQueue } from './commons.js';
import {
  ensureLessonCards, cardsForLesson, dueCards, weakestLesson,
  grade, reminderFor, injectWeakStep, buildReviewMenu,
} from './review.js';
import { createSessionRunner } from './session.js';
import { putDrawing, getDrawing, deleteAllDrawings, deleteAllPhotos } from './db.js';
import {
  TAG_GROUPS, ALL_TAGS, allPhotos, everyPhoto, bundledPhotos, photoUrl,
  addFiles, setTags, removePhoto, createLibraryQueue,
} from './library.js';
import {
  loadManifest, getRepoConfig, saveRepoConfig, pushPhotos, testRepo,
  manifestJson, fileNameFor, manifestPhotoUrl,
} from './repo.js';
import { totalXp, levelProgress, graceStreak, bestGraceStreak, takeLevelUp, resetGame } from './game.js';
import { composeSheet, downloadBlob, downloadEach, shareToX } from './export.js';
import { translateTitle, termsIn } from './glossary.js';
import { sfx } from './timer.js';
import { $, $$, el, showScreen, toast } from './ui.js';
import { icon, paintIcons } from './icons.js';
import { t, tr, getLang, setLang, applyI18n, fmtDur, fmtCount } from './i18n.js';

/*
 * index.html の data-build と揃えておく番号。
 *
 * GitHub Pages は HTML を10分キャッシュするので、更新の直後に
 * 「古い index.html ＋ 新しい app.js」の組み合わせが起きる。
 * そうなると、新しい JS が探している要素が HTML に無く、
 * 最初の1つで例外が飛んでホームが真っ白になる。
 * 番号が食い違ったら、キャッシュを外して1回だけ読み直す。
 */
const BUILD = '11';

function shellIsCurrent() {
  if (document.body.dataset.build === BUILD) {
    sessionStorage.removeItem('artclub.reloading');
    return true;
  }
  if (sessionStorage.getItem('artclub.reloading')) return true;   // 無限に往復させない
  sessionStorage.setItem('artclub.reloading', '1');
  caches?.keys?.().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    .catch(() => {})
    .finally(() => location.reload());
  return false;
}

let settings = getSettings();
let pendingDrawings = [];    // その回に描いた絵（保存前）

/** 言語で切り替わる部分は、この関数を呼べば全部描き直る。 */
function repaint() {
  applyI18n();
  paintIcons();
  renderHome();
  const screen = document.body.dataset.screen;
  if (screen === 'log') renderLog();
  if (screen === 'settings') renderSettings();
  if (screen === 'library') renderLibrary();
}

/* ==================== ホーム ==================== */

function renderHome() {
  const history = getHistory();
  const today = dateKey();
  const { streak } = graceStreak(history);
  const xp = levelProgress(totalXp(history));

  $('#streak-count').textContent = String(streak);
  $('#level-num').textContent = `Lv.${xp.level}`;
  $('#level-name').textContent = levelLabel(Math.min(5, xp.level), getLang());
  $('#xp-fill').style.width = `${xp.ratio * 100}%`;

  const doneToday = dailyTotals(history).has(today);
  const status = $('#today-status');
  status.textContent = doneToday ? t('home.todayDone') : t('home.todayYet');
  status.classList.toggle('done', doneToday);

  const s = stats(history);
  $('#total-drawings').textContent = String(totalDrawings(history));
  $('#total-time').textContent = String(s.minutes);

  renderWeekBars(history);
  renderDaily(history);
  renderModes();
  renderExtras();
}

/**
 * 直近7日。マスの中にその日の枚数をそのまま書く。
 * 棒の高さで表すと、1枚と2枚の違いが読み取れないうえに、
 * 「何枚描いたか」を知りたいだけなのに目盛りを探すことになる。
 */
function renderWeekBars(history) {
  const byDay = drawingsByDay(history);
  const wrap = $('#week-bars');
  wrap.innerHTML = '';
  const today = dateKey();
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(addDays(today, -i));
  const max = Math.max(1, ...days.map((d) => byDay.get(d) || 0));

  const dow = getLang() === 'ja'
    ? ['日', '月', '火', '水', '木', '金', '土']
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  for (const day of days) {
    const count = byDay.get(day) || 0;
    const col = el('div', `week-col${count ? ' on' : ''}${day === today ? ' today' : ''}`);
    const label = count ? (getLang() === 'ja' ? `${count}枚` : String(count)) : '';
    const box = el('div', 'week-box', label);
    // 枚数が多い日ほど濃くする。0枚の日は色を付けない
    if (count) box.style.setProperty('--fill', String(0.35 + 0.65 * (count / max)));
    col.append(box, el('div', 'week-dow', dow[new Date(`${day}T00:00:00`).getDay()]));
    col.title = `${day}：${fmtCount(count)}`;
    wrap.append(col);
  }
}

/**
 * きょうのデイリー。
 *
 * 中身（ジェスチャードローイング → 部位練習 → クロッキー）も、かかる時間も書かない。
 * 「11分」と書いてあると、11分ある日にしか押さなくなる。
 * 押してから中身が出てくるほうが、実際には手が動く。
 *
 * 1日1周までは無料、2周目から先はいずれ有料にする。いまは全部開けてある。
 */
function renderDaily(history) {
  const rounds = roundsToday('daily', history);
  const daily = buildDaily();

  const top = $('#menu-primary');
  top.innerHTML = '';

  const hero = el('div', 'card primary-card');

  const headRow = el('div', 'primary-head');
  headRow.append(el('div', 'menu-kicker', t('home.todayLabel')));
  if (rounds > 0) {
    const done = el('div', 'done-badge');
    done.append(
      el('span', 'done-check', '\u2713'),
      el('span', 'done-text', rounds === 1 ? t('home.roundDone') : t('home.roundN', { n: rounds })),
    );
    headRow.append(done);
  }
  hero.append(headRow);

  hero.append(el('div', 'menu-title big', tr(daily, 'title')));

  const cta = el('button', 'btn primary big', t('home.startPlain'));
  cta.addEventListener('click', () => {
    // 2周目からは、いずれ課金の壁になるところ。いまは説明を出して素通しする
    if (rounds > 0) return openPaywall();
    startSession(daily);
  });
  hero.append(cta);

  if (rounds > 0) hero.append(el('span', 'free-badge', t('home.freeNow')));
  top.append(hero);
}

/** モードは3つだけ。 */
function renderModes() {
  const wrap = $('#mode-cards');
  wrap.innerHTML = '';
  for (const mode of MODES) {
    const card = el('button', 'menu-card');
    card.append(
      el('div', 'menu-title', tr(mode, 'title')),
      el('div', 'menu-sub muted', tr(mode, 'subtitle')),
    );
    if (mode.steps) {
      card.append(el('div', 'menu-time', fmtDur(menuDuration(mode))));
    }
    // ドリルの説明は、名前だけ見ても分からない人のために畳んで置いておく
    const drill = DRILLS[mode.drillId];
    if (drill?.about) {
      const why = el('details', 'why');
      const sum = el('summary', null, getLang() === 'ja' ? 'これって何？' : 'What is this?');
      why.append(sum, el('p', null, tr(drill, 'about')));
      why.addEventListener('click', (e) => e.stopPropagation());
      card.append(why);
    }
    card.addEventListener('click', () => {
      if (mode.picker === 'part') return openPartSheet();
      startSession(mode);
    });
    wrap.append(card);
  }
}

function renderExtras() {
  const wrap = $('#extra-cards');
  wrap.innerHTML = '';

  const rows = [
    { title: t('home.custom'), sub: t('home.customSub'), go: openSetup },
    { title: t('home.library'), sub: '', go: openLibrary, count: true },
    { title: t('home.books'), sub: t('home.booksSub'), go: openBooks },
  ];

  for (const row of rows) {
    const card = el('button', 'menu-card slim');
    card.append(el('div', 'menu-title', row.title));
    const right = el('div', 'menu-time', row.sub);
    if (row.count) {
      right.textContent = '…';
      everyPhoto().then((ps) => { right.textContent = fmtCount(ps.length); }).catch(() => {});
    }
    card.append(right);
    card.addEventListener('click', row.go);
    wrap.append(card);
  }
}

function openPaywall() { $('#pay-sheet').hidden = false; }

/** レベルアップだけ祝う（バッジは外した）。 */
function celebrate(history = getHistory()) {
  const level = takeLevelUp(totalXp(history));
  if (!level) return;
  if (settings.sfx) sfx.levelUp?.();
  const box = el('div', 'celebrate');
  box.append(el('div', 'big', '🎉'),
             el('div', 'title', getLang() === 'ja' ? `レベル ${level} になった` : `Level ${level}`));
  document.body.append(box);
  setTimeout(() => box.remove(), 1800);
}

function renderCategories() {
  const wrap = $('#category-chips');
  wrap.innerHTML = '';
  for (const cat of availableCategories()) {
    const on = settings.categories.includes(cat.id);
    const chip = el('button', `chip${on ? ' on' : ''}`, getLang() === 'en' ? cat.en : cat.label);
    chip.addEventListener('click', () => {
      const next = new Set(settings.categories);
      next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
      if (next.size === 0) return toast(t('toast.pickGenre'));
      settings = saveSettings({ categories: [...next] });
      renderCategories();
    });
    wrap.append(chip);
  }
}

/* ==================== 部位練習 ==================== */

let currentPart = PARTS[0];

function openPartSheet() {
  renderPartChips();
  $('#part-sheet').hidden = false;
}

function renderPartChips() {
  const wrap = $('#part-chips');
  wrap.innerHTML = '';
  for (const part of PARTS) {
    const chip = el('button', `chip${currentPart.id === part.id ? ' on' : ''}`,
                    getLang() === 'en' ? part.en : part.label);
    chip.addEventListener('click', () => { currentPart = part; renderPartChips(); });
    wrap.append(chip);
  }
  const menu = buildPartMenu(currentPart);
  $('#part-note').textContent = tr(menu, 'subtitle');

  // 構造レッスンがある部位だけ、読みに行く導線を出す
  const lesson = currentPart.lessonId ? lessonById(currentPart.lessonId) : null;
  const link = $('#part-lesson');
  link.hidden = !lesson;
  if (lesson) {
    link.textContent = getLang() === 'ja'
      ? `${tr(lesson, 'name')}の構造を読む`
      : `Read how the ${tr(lesson, 'name').toLowerCase()} are built`;
    link.onclick = () => { $('#part-sheet').hidden = true; openLesson(lesson.id); };
  }
}

function wirePartSheet() {
  $('#part-close').addEventListener('click', () => { $('#part-sheet').hidden = true; });
  $('#part-sheet').addEventListener('click', (e) => {
    if (e.target.id === 'part-sheet') $('#part-sheet').hidden = true;
  });
  $('#part-start').addEventListener('click', () => {
    $('#part-sheet').hidden = true;
    startSession(buildPartMenu(currentPart), { tags: currentPart.tags, part: currentPart });
  });

  $('#pay-close').addEventListener('click', () => { $('#pay-sheet').hidden = true; });
  $('#pay-sheet').addEventListener('click', (e) => {
    if (e.target.id === 'pay-sheet') $('#pay-sheet').hidden = true;
  });
  $('#pay-continue').addEventListener('click', () => {
    $('#pay-sheet').hidden = true;
    startSession(buildDaily());
  });
}

/* ==================== はじめる前の設定 ==================== */

const setup = { tags: [], seconds: 60, count: 5, drill: 'gesture' };

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
    const chip = el('button', `chip${setup.seconds === sec ? ' on' : ''}`, fmtDur(sec));
    chip.addEventListener('click', () => { setup.seconds = sec; renderSetupChips(); });
    time.append(chip);
  }

  const count = $('#setup-count');
  count.innerHTML = '';
  for (const n of COUNT_CHOICES) {
    const chip = el('button', `chip${setup.count === n ? ' on' : ''}`, fmtCount(n));
    chip.addEventListener('click', () => { setup.count = n; renderSetupChips(); });
    count.append(chip);
  }

  const drills = $('#setup-drill');
  drills.innerHTML = '';
  for (const id of PICKABLE_DRILLS) {
    const chip = el('button', `chip${setup.drill === id ? ' on' : ''}`, tr(DRILLS[id], 'name'));
    chip.addEventListener('click', () => { setup.drill = id; renderSetupChips(); });
    drills.append(chip);
  }
  $('#setup-drill-note').textContent = tr(DRILLS[setup.drill], 'about')
    || (tr(DRILLS[setup.drill], 'steps') || []).join(' → ');
  $('#setup-start').textContent = t('setup.start', { d: fmtDur(setup.seconds * setup.count) });
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
  const photos = await everyPhoto({ fresh: true });
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
    ? photos.filter((p) => libFilter.every((tag) => p.tags.includes(tag)))
    : photos;

  fillPhotoGrid($('#lib-grid'), shown, openPhoto);
}

function fillPhotoGrid(grid, photos, onPick) {
  grid.innerHTML = '';
  for (const photo of photos) {
    const item = el('button', 'lib-item');
    const img = el('img');
    img.src = photoUrl(photo);
    img.loading = 'lazy';
    item.append(img);
    if (photo.bundled) item.append(el('span', 'lib-badge', t('lib.builtin')));
    if (photo.tags.length) item.append(el('div', 'lib-tags', photo.tags.join('・')));
    item.addEventListener('click', () => onPick(photo));
    grid.append(item);
  }
}

/** 写真1枚。タグを付け替えられて、これまでの記録も見られる。 */
function openPhoto(photo) {
  $('#photo-big').src = photoUrl(photo);

  const tags = $('#photo-tags');
  tags.innerHTML = '';
  for (const group of TAG_GROUPS) {
    tags.append(el('div', 'label', group.name));
    const row = el('div', 'chips');
    for (const tag of group.tags) {
      const chip = el('button', `chip${photo.tags.includes(tag) ? ' on' : ''}`, tag);
      // 同梱の写真のタグはリポジトリ側の manifest が持っているので、ここでは触らせない
      if (photo.bundled) chip.disabled = true;
      else chip.addEventListener('click', async () => {
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

  const del = $('#photo-delete');
  del.hidden = !!photo.bundled;
  del.onclick = async () => {
    if (!confirm(t('lib.deleteConfirm'))) return;
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
    wrap.append(el('p', 'muted small', t('lib.noneYet')));
    return;
  }
  attempts.forEach(({ entry, shot }, i) => {
    const box = el('div', `attempt${i === attempts.length - 1 ? ' latest' : ''}`);
    const img = el('img');
    getDrawing(`${entry.id}#${shot.index}`)
      .then((blob) => { if (blob) img.src = URL.createObjectURL(blob); })
      .catch(() => {});
    box.append(img, el('div', 'attempt-meta',
      `${entry.date}・${shot.seconds ? fmtDur(shot.seconds) : '—'}`));
    wrap.append(box);
  });
}

function wireLibrary() {
  $('#lib-add').addEventListener('click', () => $('#lib-input').click());
  $('#lib-input').addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    toast(t('lib.importing', { n: files.length }));
    const added = await addFiles(files, libFilter);
    e.target.value = '';
    await renderLibrary();
    toast(t('lib.imported', { n: added.length }));
  });
  $('#photo-close').addEventListener('click', () => { $('#photo-sheet').hidden = true; });
  $('#photo-sheet').addEventListener('click', (e) => {
    if (e.target.id === 'photo-sheet') $('#photo-sheet').hidden = true;
  });
}

/* ==================== 管理画面（#admin） ==================== */

const PASS_KEY = 'drawpamine.admin.v1';
let adminOpen = false;

async function hash(text) {
  if (!crypto?.subtle) return `plain:${text}`;      // file:// では subtle が無いことがある
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function storedPass() {
  try { return localStorage.getItem(PASS_KEY) || ''; } catch { return ''; }
}

async function openAdmin() {
  showScreen('admin');
  const hasPass = !!storedPass();
  $('#admin-gate-note').textContent = hasPass ? t('admin.enterPass') : t('admin.setPass');
  $('#admin-pass').value = '';
  $('#admin-msg').textContent = '';
  $('#admin-gate').hidden = adminOpen;
  $('#admin-body').hidden = !adminOpen;
  $('#admin-lock').hidden = !adminOpen;
  if (adminOpen) await renderAdmin();
}

async function renderAdmin() {
  const [mine, bundled] = await Promise.all([allPhotos({ fresh: true }), bundledPhotos()]);

  const untagged = mine.filter((p) => !p.tags.length).length;
  $('#admin-untagged').textContent = untagged ? t('admin.needTag', { n: untagged }) : '';
  fillPhotoGrid($('#admin-grid'), mine, openPhoto);
  fillPhotoGrid($('#admin-bundled'), bundled, openPhoto);

  const cfg = getRepoConfig();
  $('#repo-path').value = cfg.owner && cfg.repo ? `${cfg.owner}/${cfg.repo}` : '';
  $('#repo-branch').value = cfg.branch || 'main';
  $('#repo-token').value = cfg.token || '';
  $('#repo-push').textContent = t('admin.push', { n: mine.length });
}

function readRepoForm() {
  const [owner, repo] = ($('#repo-path').value || '').trim().split('/');
  return saveRepoConfig({
    owner: (owner || '').trim(),
    repo: (repo || '').trim(),
    branch: ($('#repo-branch').value || 'main').trim(),
    token: ($('#repo-token').value || '').trim(),
  });
}

function wireAdmin() {
  $('#admin-enter').addEventListener('click', async () => {
    const value = $('#admin-pass').value;
    if (!value) return void ($('#admin-msg').textContent = t('admin.enterPass'));
    const digest = await hash(value);
    if (!storedPass()) {
      try { localStorage.setItem(PASS_KEY, digest); } catch { /* 保存できなくても開ける */ }
    } else if (storedPass() !== digest) {
      $('#admin-msg').textContent = t('admin.wrong');
      return;
    }
    adminOpen = true;
    await openAdmin();
  });

  $('#admin-pass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#admin-enter').click();
  });

  $('#admin-lock').addEventListener('click', () => { adminOpen = false; openAdmin(); });
  $('#admin-open').addEventListener('click', () => { location.hash = '#admin'; openAdmin(); });

  $('#admin-add').addEventListener('click', () => $('#admin-input').click());
  $('#admin-input').addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    toast(t('lib.importing', { n: files.length }));
    const added = await addFiles(files, []);
    e.target.value = '';
    await renderAdmin();
    toast(t('lib.imported', { n: added.length }));
  });

  $('#repo-test').addEventListener('click', async () => {
    const cfg = readRepoForm();
    const status = $('#repo-status');
    status.textContent = '…';
    try {
      const info = await testRepo(cfg);
      status.textContent = `OK — ${info.name}${info.canPush ? '' : '（書き込み権限なし）'}`;
    } catch (err) {
      status.textContent = `NG：${err.message}`;
    }
  });

  $('#repo-push').addEventListener('click', async () => {
    const cfg = readRepoForm();
    const status = $('#repo-status');
    const mine = await allPhotos({ fresh: true });
    if (!mine.length) return void (status.textContent = t('lib.empty'));
    try {
      await pushPhotos(cfg, mine, (i, n) => { status.textContent = t('admin.pushing', { i, n }); });
      status.textContent = t('admin.pushed', { n: mine.length });
      await loadManifest({ fresh: true });
      await renderAdmin();
    } catch (err) {
      status.textContent = t('admin.pushFail', { m: err.message });
    }
  });

  // トークンを使いたくない人向け。落としたものを photos/ に置いて commit すれば同じ結果になる
  $('#repo-export').addEventListener('click', async () => {
    const mine = await allPhotos({ fresh: true });
    if (!mine.length) return void toast(t('lib.empty'));
    const entries = mine.map((p) => ({
      file: fileNameFor(p), tags: p.tags || [], name: p.name || null, source: 'Unsplash',
    }));
    downloadBlob(new Blob([manifestJson(entries)], { type: 'application/json' }), 'manifest.json');
    for (let i = 0; i < mine.length; i++) {
      await new Promise((r) => setTimeout(r, 350));
      downloadBlob(mine[i].blob, fileNameFor(mine[i]));
    }
  });
}

/* ==================== 解剖学の本 ==================== */

let currentBook = PD_BOOKS[0];

function openBooks() {
  showScreen('books');
  renderBookTabs();
  renderBook();
}

function renderBookTabs() {
  const wrap = $('#book-tabs');
  wrap.innerHTML = '';
  for (const book of PD_BOOKS) {
    const chip = el('button', `chip${currentBook.id === book.id ? ' on' : ''}`, book.author);
    chip.addEventListener('click', () => { currentBook = book; renderBookTabs(); renderBook(); });
    wrap.append(chip);
  }
}

function renderBook() {
  const book = currentBook;
  $('#book-title').textContent = getLang() === 'ja'
    ? `${book.titleJa}（${book.title}）`
    : `${book.title} — ${book.author}, ${book.year}`;
  $('#book-note').textContent = `${book.author}, ${book.year} — ${tr(book, 'note')}`;
  $('#book-gallery').innerHTML = '';
  $('#book-status').textContent = '';
  loadBookPlates(book);
}

async function loadBookPlates(book) {
  const gallery = $('#book-gallery');
  const status = $('#book-status');
  status.textContent = t('books.loading');
  try {
    const plates = await searchPlatesMulti(book.queries, { limit: 8, width: 900 });
    if (!plates.length) { status.textContent = t('books.none'); return; }
    status.textContent = '';
    for (const plate of plates.slice(0, 16)) {
      const thumb = el('button', 'plate-thumb');
      const img = el('img');
      img.src = plate.url;
      img.alt = plate.title;
      img.loading = 'lazy';
      thumb.append(img);
      thumb.addEventListener('click', () => openLightbox(plate, { translate: true }));
      gallery.append(thumb);
    }
  } catch (err) {
    status.textContent = `${t('books.none')}（${err.message}）`;
  }
}

/* ==================== 解剖レッスン ==================== */

let currentLesson = null;

function openLesson(id) {
  const lesson = lessonById(id);
  if (!lesson) return;
  currentLesson = lesson;

  $('#lesson-name').textContent = tr(lesson, 'name');
  $('#lesson-tagline').textContent = tr(lesson, 'tagline');
  $('#lesson-problem').textContent = tr(lesson, 'problem');

  const steps = $('#lesson-steps');
  steps.innerHTML = '';
  for (const step of tr(lesson, 'steps')) {
    const item = el('div', 'lesson-step');
    item.append(el('h3', null, step.title), el('p', null, step.body));
    steps.append(item);
  }

  fillList('#lesson-proportions', tr(lesson, 'proportions'));

  const mistakes = $('#lesson-mistakes');
  mistakes.innerHTML = '';
  for (const m of tr(lesson, 'mistakes')) {
    const row = el('div', 'mistake');
    row.append(el('div', 'mistake-bad', `✕ ${m.bad}`), el('div', 'mistake-fix', `→ ${m.fix}`));
    mistakes.append(row);
  }

  const books = $('#lesson-books');
  books.innerHTML = '';
  books.append(el('div', 'label', t('lesson.sources')));
  for (const b of PD_BOOKS) {
    books.append(el('p', 'muted small', `${b.author}『${b.title}』${b.year} — ${tr(b, 'note')}`));
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
  status.textContent = t('books.loading');
  try {
    const plates = await searchPlatesMulti(lesson.refQueries, { limit: 8, width: 800 });
    if (!plates.length) { status.textContent = t('books.none'); return; }
    status.textContent = '';
    for (const plate of plates.slice(0, 12)) {
      const thumb = el('button', 'plate-thumb');
      const img = el('img');
      img.src = plate.url;
      img.alt = plate.title;
      img.loading = 'lazy';
      thumb.append(img);
      thumb.addEventListener('click', () => openLightbox(plate, { translate: true }));
      gallery.append(thumb);
    }
  } catch (err) {
    status.textContent = `${t('books.none')}（${err.message}）`;
  }
}

/**
 * 図版の拡大。英語のタイトルはそのまま出しても読めないので、
 * 用語辞書で置き換えた日本語と、出てくる用語の対訳表を下に付ける。
 */
function openLightbox(plate, { translate = false } = {}) {
  $('#lightbox-img').src = plate.url;
  $('#lightbox-img').alt = plate.title;
  const caption = $('#lightbox-caption');
  caption.innerHTML = '';

  if (translate && getLang() === 'ja') {
    caption.append(el('div', 'plate-ja', translateTitle(plate.title)));
    caption.append(el('div', 'muted small', `${t('books.original')}：${plate.title}`));
    const terms = termsIn(`${plate.title} ${plate.description || ''}`);
    if (terms.length) {
      const list = el('div', 'term-list');
      list.append(el('div', 'label', t('books.glossary')));
      for (const term of terms.slice(0, 14)) {
        list.append(el('span', 'term', `${term.en} = ${term.ja}`));
      }
      caption.append(list);
    }
  } else {
    caption.append(el('div', null, plate.title));
  }

  const credit = el('div', 'muted small');
  credit.textContent = `${plate.credit.name} / ${plate.credit.source}`;
  caption.append(credit);
  if (plate.credit.link) {
    const a = el('a', 'small', 'Wikimedia Commons');
    a.href = plate.credit.link;
    a.target = '_blank';
    a.rel = 'noopener';
    caption.append(a);
  }
  $('#lightbox').hidden = false;
}

function wireLesson() {
  $('#plate-reload').addEventListener('click', () => currentLesson && loadPlates(currentLesson));
  $('#book-reload').addEventListener('click', () => renderBook());
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

/*
 * セッションの進行役は、最初に必要になったときに作る。
 * 読み込んだ瞬間に作ると、その中で画面の要素を掴みに行くので、
 * 古い HTML が残っている端末ではそこで例外が飛び、init まで到達しない。
 * 「古い HTML を検出して読み直す」判定より先に落ちてしまうと直しようがない。
 */
let runner = null;

function getRunner() {
  runner ||= createSessionRunner({
    onFinish: (result) => finishSession(result),
    onQuit: (partial) => {
      if (partial) {
        saveResult(partial);
        toast(t('toast.partial', { m: Math.round(partial.seconds / 60) }));
      }
      renderHome();
      showScreen('home');
    },
  });
  return runner;
}

let lastStart = null;   // 「もう1セットやる」用に、直前の開始手順をそのまま覚えておく

const notice = (msg) => toast(msg);

/**
 * ふだんのメニュー。期限の来た復習があれば、その部位のドリルを1本ねじ込む。
 * 復習を別画面のタスクにすると誰もやらないので、いつもの導線に混ぜてしまう。
 */
async function startSession(menu, { tags = null, part = null } = {}) {
  lastStart = () => startSession(menu, { tags, part });
  settings = getSettings();
  const weak = weakestLesson();

  // 自分の写真（＋リポジトリ同梱）が1枚でもあればそこから出す。
  const own = await everyPhoto().catch(() => []);
  const matching = tags?.length
    ? own.filter((p) => tags.every((tag) => p.tags.includes(tag)))
    : own;
  const useLibrary = matching.length > 0;

  const queues = {
    photo: useLibrary
      ? createLibraryQueue(tags || [], notice)
      : createPhotoQueue(settings, notice, part?.query ? { queryOverride: part.query } : {}),
  };
  // デイリーの真ん中はその日の部位。タグの付いた写真があればそこから、無ければ検索で出す
  if (part) {
    const tagged = own.filter((p) => part.tags.every((tag) => p.tags.includes(tag)));
    queues.part = tagged.length
      ? createLibraryQueue(part.tags, notice)
      : createPhotoQueue(settings, notice, { queryOverride: part.query });
  }
  if (weak) {
    queues[`weak:${weak.id}`] =
      createPhotoQueue(settings, notice, { queryOverride: weak.photoQuery });
  }
  getRunner().start({
    menu: weak ? injectWeakStep(menu, weak) : menu,
    queues,
    settings,
    lessonId: part?.lessonId || weak?.id || null,
    lessonMode: 'weak',
    focus: { id: null },
    reminder: weak ? reminderFor(weak.id) : null,
  });
}

/** 解剖レッスンの練習：図版の模写と、同じ部位の写真を混ぜて回す。 */
function startLesson(lesson) {
  lastStart = () => startLesson(lesson);
  settings = getSettings();
  const partPhotos = createPhotoQueue(settings, notice, { queryOverride: lesson.photoQuery });
  getRunner().start({
    menu: lesson.practice,
    queues: {
      photo: partPhotos,
      [`weak:${lesson.id}`]: partPhotos,
      plate: createPlateQueue(lesson.refQueries, notice),
    },
    settings,
    focus: { id: null },
    lessonId: lesson.id,
    lessonMode: 'lesson',
    reminder: reminderFor(lesson.id),
  });
}

/** 復習だけをやる。 */
function startMenuWithLesson(menu, lesson, lessonMode) {
  lastStart = () => startMenuWithLesson(menu, lesson, lessonMode);
  settings = getSettings();
  const partPhotos = createPhotoQueue(settings, notice, { queryOverride: lesson.photoQuery });
  getRunner().start({
    menu,
    queues: { photo: partPhotos, [`weak:${lesson.id}`]: partPhotos },
    settings,
    focus: { id: null },
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

async function finishSession(result) {
  const entry = saveResult(result);
  if (settings.sfx) sfx.fanfare();

  pendingDrawings = result.drawings || [];
  renderDrawingStrip();
  $('#review-note').value = '';
  $$('.rate-btn').forEach((b) => b.classList.remove('on'));

  renderReviewChecks(entry.lessonId, entry.lessonMode);

  const drillLines = Object.entries(entry.byDrill)
    .map(([id, sec]) => `<li><span>${tr(DRILLS[id], 'name') || id}</span><b>${fmtDur(sec)}</b></li>`)
    .join('');
  const s = stats();
  const short = entry.seconds < 60;
  $('#review-summary').innerHTML =
    `<div class="review-big">${short ? entry.seconds : Math.round(entry.seconds / 60)}` +
    `<span>${short ? t('common.sec') : t('common.min')}</span></div>` +
    `<ul class="review-drills">${drillLines}</ul>` +
    `<div class="muted small">${t('rev.streakLine', { s: s.streak, n: s.sessions })}</div>`;

  showScreen('review');

  if (pendingDrawings.length > 0) {
    const blob = await composeSheet(pendingDrawings.map((s) => s.blob), {
      date: dateKey(),
    });
    if (blob) {
      sheetBlob = blob;
      $('#sheet-img').src = URL.createObjectURL(blob);
      $('#sheet-preview').hidden = false;
    }
  } else {
    $('#sheet-preview').hidden = true;
  }
}

/* ==================== ふりかえり ==================== */

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

/**
 * その回に描いた絵をならべる。
 * 以前はここを押すと消えていた。押して消えるのは事故にしかならないので、
 * 押したら大きくなり、消すのは拡大した先でもう一度選ぶ形にした。
 */
function renderDrawingStrip() {
  const strip = $('#drawing-strip');
  strip.innerHTML = '';
  const has = pendingDrawings.length > 0;
  strip.hidden = !has;
  $('#strip-actions').hidden = !has;
  $('#dl-all').disabled = !has;

  pendingDrawings.forEach((shot, i) => {
    const item = el('button', 'strip-item');
    const img = el('img');
    img.src = URL.createObjectURL(shot.blob);
    item.append(img);
    item.addEventListener('click', () => openDrawing(i));
    strip.append(item);
  });
}

let drawingIndex = -1;

function openDrawing(index) {
  const shot = pendingDrawings[index];
  if (!shot) return;
  drawingIndex = index;
  $('#draw-img').src = URL.createObjectURL(shot.blob);
  $('#draw-lightbox').hidden = false;
}

function wireDrawingLightbox() {
  const close = () => { $('#draw-lightbox').hidden = true; drawingIndex = -1; };
  $('#draw-close').addEventListener('click', close);
  $('#draw-lightbox').addEventListener('click', (e) => {
    if (e.target.id === 'draw-lightbox') close();
  });
  $('#draw-dl').addEventListener('click', () => {
    const shot = pendingDrawings[drawingIndex];
    if (shot) downloadBlob(shot.blob, `artclub-${dateKey()}-${drawingIndex + 1}.jpg`);
  });
  $('#draw-remove').addEventListener('click', () => {
    if (drawingIndex < 0) return;
    pendingDrawings.splice(drawingIndex, 1);
    close();
    renderDrawingStrip();
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

  $('#dl-all').addEventListener('click', () => {
    downloadEach(pendingDrawings.map((s) => s.blob), `artclub-${dateKey()}`);
  });

  $('#sheet-dl').addEventListener('click', () => {
    if (sheetBlob) downloadBlob(sheetBlob, `artclub-${dateKey()}.jpg`);
  });

  $('#share-x').addEventListener('click', () => {
    const seconds = getHistory().at(-1)?.seconds || 0;
    shareToX(t('rev.shareText', { n: pendingDrawings.length, d: fmtDur(seconds) }));
  });

  $('#review-save').addEventListener('click', async () => {
    const rated = $$('.rate-btn').find((b) => b.classList.contains('on'));
    const checkBtns = $$('#review-checks .check-btn');
    const missed = [];
    for (const btn of checkBtns) {
      const ok = btn.classList.contains('on');
      grade(btn.dataset.cardId, ok);          // ここで次に出る日が決まる
      if (!ok) missed.push(btn.textContent);
    }
    const entry = updateLastSession({
      rating: rated ? Number(rated.dataset.rate) : null,
      note: $('#review-note').value.trim() || null,
      hasDrawing: pendingDrawings.length > 0,
      drawingCount: pendingDrawings.length || null,
      shots: pendingDrawings.map((shot, i) => ({
        index: i, photoId: shot.photoId || null, seconds: shot.seconds || null,
      })),
      missed: missed.length ? missed : null,
    });
    if (entry) {
      try {
        await Promise.all(pendingDrawings.map((shot, i) => putDrawing(`${entry.id}#${i}`, shot.blob)));
      } catch { toast(t('toast.saveFail')); }
    }
    pendingDrawings = [];
    sheetBlob = null;
    renderHome();
    showScreen('home');
    celebrate();
  });

  $('#review-again').addEventListener('click', () => lastStart?.());
}

let sheetBlob = null;

/* ==================== 記録 ==================== */

function renderLog() {
  const history = getHistory();
  const s = stats(history);
  $('#st-streak').textContent = String(graceStreak(history).streak);
  $('#st-best').textContent = String(bestGraceStreak(history));
  $('#st-minutes').textContent = String(s.minutes);
  $('#st-drawings').textContent = String(totalDrawings(history));

  const dow = $('#cal-dow');
  dow.innerHTML = '';
  const labels = getLang() === 'ja'
    ? ['日', '月', '火', '水', '木', '金', '土']
    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  for (const label of labels) dow.append(el('span', null, label));

  renderCalendar(history);
  renderDrillBars(s);
  renderNotes(history);
}

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

function renderCalendar(history = getHistory()) {
  calMonth ||= monthKey(dateKey());
  const [year, month] = calMonth.split('-').map(Number);
  $('#cal-title').textContent = getLang() === 'ja'
    ? `${year}年 ${month}月`
    : new Date(year, month - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' });

  const totals = dailyTotals(history);
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
    }

    cell.title = seconds ? `${dayKey}：${fmtDur(seconds)}` : dayKey;
    cell.addEventListener('click', () => openDaySheet(dayKey, history));
    grid.append(cell);
  }
}

/** その日に描いたものを全部ならべる。押すと拡大＋ダウンロード。 */
async function openDaySheet(dayKey, history = getHistory()) {
  const entries = history.filter((h) => h.date === dayKey);
  $('#sheet-date').textContent = dayKey;

  const seconds = entries.reduce((sum, e) => sum + (e.seconds || 0), 0);
  $('#sheet-title').textContent = seconds ? t('log.drew', { d: fmtDur(seconds) }) : t('log.restDay');

  const shots = $('#sheet-shots');
  shots.innerHTML = '';
  const blobs = [];
  for (const entry of entries) {
    const count = entry.drawingCount || (entry.hasDrawing ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const blob = await getDrawing(`${entry.id}#${i}`).catch(() => null)
        || (i === 0 ? await getDrawing(entry.id).catch(() => null) : null);
      if (blob) blobs.push(blob);
    }
  }
  shots.hidden = blobs.length === 0;
  blobs.forEach((blob, i) => {
    const item = el('button', 'strip-item');
    const img = el('img');
    img.src = URL.createObjectURL(blob);
    item.append(img);
    item.addEventListener('click', () => {
      $('#draw-img').src = URL.createObjectURL(blob);
      drawingIndex = -1;                       // 過去の絵はここから消せない
      $('#draw-remove').hidden = true;
      $('#draw-dl').onclick = () => downloadBlob(blob, `artclub-${dayKey}-${i + 1}.jpg`);
      $('#draw-lightbox').hidden = false;
    });
    shots.append(item);
  });

  const body = $('#sheet-body');
  body.innerHTML = '';
  for (const entry of entries) {
    const block = el('div', 'note-item');
    const head = el('div', 'note-head');
    head.append(el('span', 'note-date', entry.menuTitle || '—'));
    if (entry.lessonId) head.append(el('span', 'rate-tag', tr(lessonById(entry.lessonId), 'name') || ''));
    block.append(head);
    const drills = Object.entries(entry.byDrill || {})
      .map(([id, sec]) => `${tr(DRILLS[id], 'name') || id} ${fmtDur(sec)}`).join(' / ');
    if (drills) block.append(el('p', 'muted small', drills));
    if (entry.note) block.append(el('p', 'note-body', entry.note));
    body.append(block);
  }
  if (!entries.length) body.append(el('p', 'muted small', t('log.noRecord')));

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
    wrap.append(el('p', 'muted small', t('log.noRecord')));
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
      el('div', 'bar-label', tr(DRILLS[id], 'name') || id),
      track,
      el('div', 'bar-value muted small', fmtDur(sec)),
    );
    wrap.append(row);
  }
}

function renderNotes(history) {
  const wrap = $('#note-list');
  wrap.innerHTML = '';
  const notes = history.filter((h) => h.note || h.hasDrawing || h.missed?.length).slice(-20).reverse();
  if (!notes.length) {
    wrap.append(el('p', 'muted small', t('log.noNotes')));
    return;
  }
  const ratingText = { 1: t('rev.rate1'), 2: t('rev.rate2'), 3: t('rev.rate3') };
  for (const entry of notes) {
    const item = el('div', 'note-item');
    const head = el('div', 'note-head');
    head.append(el('span', 'note-date', entry.date));
    if (entry.rating) head.append(el('span', `rate-tag r${entry.rating}`, ratingText[entry.rating]));
    if (entry.lessonId) head.append(el('span', 'rate-tag', tr(lessonById(entry.lessonId), 'name') || ''));
    item.append(head);
    if (entry.note) item.append(el('p', 'note-body', entry.note));
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
  $('#opt-alpha').value = String(Math.round((settings.penAlpha ?? 1) * 100));
  $('#local-count').textContent = fmtCount(localFiles.items.length);
  updateSourceVisibility();
  renderLangChips();
  renderCategories();
  renderTheory();
}

function renderLangChips() {
  const wrap = $('#lang-chips');
  wrap.innerHTML = '';
  for (const [code, label] of [['ja', '日本語'], ['en', 'English']]) {
    const chip = el('button', `chip${getLang() === code ? ' on' : ''}`, label);
    chip.addEventListener('click', () => switchLang(code));
    wrap.append(chip);
  }
}

function switchLang(code) {
  setLang(code);
  $('#lang-btn').textContent = code === 'ja' ? 'EN' : 'JA';
  repaint();
}

function updateSourceVisibility() {
  $('#unsplash-config').hidden = settings.source !== 'unsplash';
  $('#local-config').hidden = settings.source !== 'local';
}

function renderTheory() {
  const wrap = $('#theory-list');
  wrap.innerHTML = '';
  for (const p of PRINCIPLES) {
    const item = el('div', 'theory-item');
    item.append(
      el('h3', null, tr(p, 'title')),
      el('p', 'muted small', tr(p, 'body')),
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
    $('#key-status').textContent = t('common.save');
  });

  $('#key-test').addEventListener('click', async () => {
    const key = $('#unsplash-key').value.trim();
    const status = $('#key-status');
    if (!key) return void (status.textContent = t('set.key'));
    status.textContent = '…';
    try {
      const { remaining } = await testUnsplashKey(key);
      settings = saveSettings({ unsplashKey: key });
      status.textContent = `OK（${remaining ?? '?'}）`;
    } catch (err) {
      status.textContent = `NG：${err.message}`;
    }
  });

  $('#local-btn').addEventListener('click', () => $('#local-input').click());
  $('#local-input').addEventListener('change', (e) => {
    const count = localFiles.set(e.target.files || []);
    $('#local-count').textContent = fmtCount(count);
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
  $('#opt-alpha').addEventListener('input', (e) => {
    settings = saveSettings({ penAlpha: Number(e.target.value) / 100 });
  });
  bind('#opt-autoflip', 'autoFlip');
  bind('#opt-keepawake', 'keepAwake');
  bind('#opt-orientation', 'orientation');

  $('#export-btn').addEventListener('click', () => {
    const blob = new Blob(
      [JSON.stringify({ settings: { ...settings, unsplashKey: '' }, history: getHistory() }, null, 2)],
      { type: 'application/json' });
    downloadBlob(blob, `artclub-${dateKey()}.json`);
  });

  $('#reset-btn').addEventListener('click', async () => {
    if (!confirm(t('set.resetConfirm'))) return;
    clearAll();
    resetGame();
    await deleteAllDrawings().catch(() => {});
    await deleteAllPhotos().catch(() => {});
    settings = getSettings();
    renderSettings();
    renderHome();
    toast(t('set.erased'));
  });
}

/* ==================== 起動 ==================== */

function wireNav() {
  $$('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;
      if (target === 'library') { openLibrary(); return; }
      if (target === 'log') renderLog();
      if (target === 'home') renderHome();
      if (target === 'settings') renderSettings();
      showScreen(target);
    });
  });

  $('#lang-btn').addEventListener('click', () => switchLang(getLang() === 'ja' ? 'en' : 'ja'));
}

const THEME_COLORS = { light: '#f7f7f5', dark: '#000000', paper: '#f5f4ee' };

function applyTheme() {
  document.body.dataset.theme = settings.theme;
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

/** 苦手な部位のレッスンは、部位練習から辿れるようにしておく。 */
function wireLessonLinks() {
  window.addEventListener('hashchange', () => {
    if (location.hash.replace('#', '') === 'admin') openAdmin();
  });
}

function init() {
  applyTheme();
  applyI18n();
  paintIcons();
  $('#lang-btn').textContent = getLang() === 'ja' ? 'EN' : 'JA';

  wireNav();
  wireReview();
  wireDrawingLightbox();
  wireLesson();
  wireSetup();
  wirePartSheet();
  wireLibrary();
  wireCalendar();
  wireSettings();
  wireAdmin();
  wireLessonLinks();

  renderHome();

  // /admin でも #admin でも入れるようにしておく（GitHub Pages では 404.html が #admin に流す）
  const wantsAdmin = location.hash.replace('#', '') === 'admin'
                     || /\/admin\/?$/.test(location.pathname);
  if (wantsAdmin) openAdmin();
  else showScreen('home');

  document.addEventListener('pointerdown', () => { if (settings.sfx) sfx.unlock(); }, { once: true });

  document.addEventListener('pointerdown', (e) => {
    if (!settings.sfx) return;
    const button = e.target.closest('button');
    if (!button || button.disabled || button.closest('.pad-wrap')) return;
    sfx.tap();
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    // updateViaCache: 'none' … sw.js 自体が古いまま使われると、直しても直らなくなる
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
  }
}

// 古い HTML に新しい JS が当たっている場合は、ここで読み直して init は走らせない
if (shellIsCurrent()) init();

// レッスンは部位練習から開く。外からも呼べるようにしておく（テストと将来の導線用）
export { openLesson };
