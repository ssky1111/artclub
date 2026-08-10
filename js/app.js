/**
 * app.js — 画面の組み立てと配線。
 */

import {
  buildDaily, partForDate, MODES, PARTS, ACTIVE_PARTS, DRILLS, PICKABLE_DRILLS,
  TIME_CHOICES, COUNT_CHOICES, timeLabel, buildCustomMenu, buildPartMenu,
  levelLabel, menuDuration,
} from './theory.js';
import {
  getSettings, saveSettings, getHistory, addSession, updateLastSession,
  dateKey, addDays, dailyTotals, drawingsByDay, totalDrawings, roundsToday, stats,
  recentReviewNotes,
} from './storage.js';
import { LESSONS, PD_BOOKS, lessonById } from './anatomy.js';
import { createPhotoQueue } from './images.js';
import { searchPlatesMulti, createPlateQueue } from './commons.js';
import {
  ensureLessonCards, dueCards, weakestLesson,
  reminderFor, injectWeakStep, buildReviewMenu,
} from './review.js';
import { createSessionRunner } from './session.js';
import { putDrawing, getDrawing } from './db.js';
import {
  TAG_GROUPS, ALL_TAGS, allPhotos, everyPhoto, bundledPhotos, photoUrl, setPhotoSrc,
  addFiles, setTags, removePhoto, createLibraryQueue, createWeightedQueue,
  refreshCustomTags, getCustomTags, getHiddenTags, allTagsWithCustom,
} from './library.js';
import {
  loadManifest, getRepoConfig, saveRepoConfig, pushPhotos, testRepo,
  manifestJson, fileNameFor, manifestPhotoUrl,
} from './repo.js';
import {
  loadManifest as sbLoadManifest, pushToSupabase, testConnection as sbTest,
  supabasePhotos, updateTags as sbUpdateTags, bulkUpdateTags, bulkRemoveTags,
  removeFromSupabase, loadCustomTags, saveCustomTags, supabasePhotoUrl,
  saveHiddenTags, invalidateTagConfig, convertToWebp, repairManifestExtensions,
} from './supabase.js';
import { totalXp, levelProgress, graceStreak, bestGraceStreak, takeLevelUp } from './game.js';
import { composeSheet, downloadBlob, downloadEach, shareToX } from './export.js';
import { translateTitle, termsIn } from './glossary.js';
import { sfx } from './timer.js';
import { $, $$, el, showScreen, toast, confirmDialog, weekReviewDialog } from './ui.js';
import { icon, paintIcons } from './icons.js';
import { t, tr, getLang, setLang, applyI18n, fmtDur, fmtCount } from './i18n.js';
window.__i18n = { t };
import { initAuth, loginWithProvider, logout, getUser, onAuthChange, userName, userAvatar, hasUsername, setUsername, getUsername } from './auth.js';
import {
  uploadArtwork, uploadShareImage, fetchArtworks, fetchPublicArtworks, fetchMyArtworks,
  deleteArtwork, toggleLike, workPageUrl, upsertProfile,
} from './gallery.js';

/*
 * index.html の data-build と揃えておく番号。
 *
 * GitHub Pages は HTML を10分キャッシュするので、更新の直後に
 * 「古い index.html ＋ 新しい app.js」の組み合わせが起きる。
 * そうなると、新しい JS が探している要素が HTML に無く、
 * 最初の1つで例外が飛んでホームが真っ白になる。
 * 番号が食い違ったら、キャッシュを外して1回だけ読み直す。
 */
const BUILD = '75';

function shellIsCurrent() {
  if (document.body.dataset.build === BUILD) {
    sessionStorage.removeItem('artclub.reloading');
    return true;
  }
  // 古い HTML/JS の食い違いで壊れるので、キャッシュを捨てて1回だけ読み直す
  if (sessionStorage.getItem('artclub.reloading')) return true;
  sessionStorage.setItem('artclub.reloading', '1');
  Promise.resolve()
    .then(() => (caches?.keys ? caches.keys() : []))
    .then((keys) => Promise.all((keys || []).map((k) => caches.delete(k))))
    .then(() => (navigator.serviceWorker?.getRegistrations
      ? navigator.serviceWorker.getRegistrations()
      : []))
    .then((regs) => Promise.all((regs || []).map((r) => r.unregister())))
    .catch(() => {})
    .finally(() => { location.reload(); });
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
  $('#level-name').textContent = '';
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
    const box = el('div', 'week-box');
    if (count) {
      // 数字は累計と同じ太い英字フォント。単位だけ和文
      const countEl = el('span', 'week-count');
      countEl.append(el('span', 'week-num', String(count)));
      if (getLang() === 'ja') countEl.append(el('span', 'week-unit', '枚'));
      box.append(countEl);
    }
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
  const part = partForDate(dateKey());
  const daily = buildDaily(part);

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
    if (rounds >= 4) return openPaywall(() => startDaily(daily, part));
    startDaily(daily, part);
  });
  hero.append(cta);

  if (rounds >= 4) hero.append(el('span', 'free-badge', t('home.freeNow')));
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
    card.append(el('span', 'free-badge', t('home.freeNow')));
    card.addEventListener('click', () => {
      openPaywall(() => {
        if (mode.picker === 'part') return openPartSheet();
        startSession(mode);
      });
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

let paywallCallback = null;
function openPaywall(onContinue) {
  paywallCallback = onContinue || null;
  $('#pay-sheet').hidden = false;
}

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


/* ==================== 部位練習 ==================== */

let currentPart = ACTIVE_PARTS[0] || PARTS[0];

function openPartSheet() {
  renderPartChips();
  $('#part-sheet').hidden = false;
}

function renderPartChips() {
  const wrap = $('#part-chips');
  wrap.innerHTML = '';
  // タグ未整備の部位は出さない（足などが紛れないように）
  for (const part of ACTIVE_PARTS) {
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
  $('#part-start').addEventListener('click', async () => {
    $('#part-sheet').hidden = true;
    await weekReviewDialog(recentReviewNotes(7));
    startSession(buildPartMenu(currentPart), { tags: currentPart.tags, part: currentPart });
  });

  $('#pay-close').addEventListener('click', () => { $('#pay-sheet').hidden = true; });
  $('#pay-sheet').addEventListener('click', (e) => {
    if (e.target.id === 'pay-sheet') $('#pay-sheet').hidden = true;
  });
  $('#pay-continue').addEventListener('click', () => {
    $('#pay-sheet').hidden = true;
    if (paywallCallback) {
      paywallCallback();
      paywallCallback = null;
    } else {
      const part = partForDate(dateKey());
      startDaily(buildDaily(part), part);
    }
  });
}

/** DAILY 開始。直近1週間の振り返り（無ければ案内）を先にモーダルで出す。 */
async function startDaily(daily, part) {
  await weekReviewDialog(recentReviewNotes(7));
  startSession(daily, { part });
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
    if (!(await confirmDialog(t('lib.deleteConfirm')))) return;
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
const SESSION_KEY = 'drawpamine.admin.session';
let adminOpen = false;

function isSessionAuth() {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}
function setSessionAuth() {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* */ }
}

async function hash(text) {
  if (!crypto?.subtle) return `plain:${text}`;      // file:// では subtle が無いことがある
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function storedPass() {
  try { return localStorage.getItem(PASS_KEY) || ''; } catch { return ''; }
}

const ADMIN_EMAILS = ['yuisskweb@gmail.com', 'sayu.u.u.u.u@gmail.com'];

function isAdminUser() {
  const u = getUser();
  return u?.email && ADMIN_EMAILS.includes(u.email);
}

async function openAdmin() {
  showScreen('admin');
  if (!adminOpen && (isSessionAuth() || isAdminUser())) adminOpen = true;
  $('#admin-gate-note').textContent = t('admin.enterPass');
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

  // 旧 JPG 参照が残っていれば、実体の WebP に manifest を直す
  try {
    const fixed = await repairManifestExtensions();
    if (fixed) toast(`${fixed}件の写真URLをWebPに直しました`);
  } catch { /* 表示は fallbackUrl でも生きる */ }

  await renderSupabaseGrid();
  await renderTagManager();
}

/* ---------- Supabase 写真グリッド ---------- */

const sbSelected = new Set();
const sbUploadTags = new Set();
let sbLastClickedIndex = -1;

function renderUploadTagChips() {
  const wrap = $('#sb-upload-tags');
  wrap.innerHTML = '';
  const allT = allTagsWithCustom();
  for (const tag of allT) {
    const chip = el('button', `chip${sbUploadTags.has(tag) ? ' on' : ''}`, tag);
    chip.addEventListener('click', () => {
      if (sbUploadTags.has(tag)) sbUploadTags.delete(tag); else sbUploadTags.add(tag);
      chip.classList.toggle('on');
    });
    wrap.append(chip);
  }
}

async function renderSupabaseGrid() {
  const grid = $('#sb-grid');
  grid.innerHTML = '';
  sbSelected.clear();
  sbLastClickedIndex = -1;
  updateSelectBar();
  renderUploadTagChips();

  try {
    const photos = await supabasePhotos();
    $('#sb-status').textContent = `${photos.length} 枚`;

    for (const photo of photos) {
      const btn = el('button', 'lib-item');
      btn.dataset.file = photo.id.replace('sb:', '');
      const img = document.createElement('img');
      setPhotoSrc(img, photo);
      img.alt = photo.name || '';
      img.loading = 'lazy';
      btn.append(img);
      if (photo.tags.length) {
        btn.append(el('div', 'lib-tags', photo.tags.join(' ')));
      }
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'sb-check';
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        const items = [...grid.querySelectorAll('.lib-item')];
        const idx = items.indexOf(btn);
        if (e.shiftKey && sbLastClickedIndex >= 0 && sbLastClickedIndex !== idx) {
          const from = Math.min(sbLastClickedIndex, idx);
          const to = Math.max(sbLastClickedIndex, idx);
          for (let i = from; i <= to; i++) {
            const item = items[i];
            const itemCb = item.querySelector('.sb-check');
            if (itemCb && !itemCb.checked) {
              itemCb.checked = true;
              const file = item.dataset.file;
              sbSelected.add(file);
              item.classList.add('selected');
            }
          }
          updateSelectBar();
        } else {
          toggleSelect(btn, photo, cb.checked);
        }
        sbLastClickedIndex = idx;
      });
      cb.addEventListener('change', (e) => {
        if (!e.isTrusted) toggleSelect(btn, photo, cb.checked);
      });
      btn.append(cb);
      btn.addEventListener('click', (e) => {
        const items = [...grid.querySelectorAll('.lib-item')];
        const idx = items.indexOf(btn);
        if (e.shiftKey) {
          e.preventDefault();
          if (sbLastClickedIndex >= 0 && sbLastClickedIndex !== idx) {
            const from = Math.min(sbLastClickedIndex, idx);
            const to = Math.max(sbLastClickedIndex, idx);
            const selecting = !btn.classList.contains('selected');
            for (let i = from; i <= to; i++) {
              const item = items[i];
              const itemCb = item.querySelector('.sb-check');
              if (!itemCb) continue;
              if (selecting && !itemCb.checked) {
                itemCb.checked = true;
                sbSelected.add(item.dataset.file);
                item.classList.add('selected');
              } else if (!selecting && itemCb.checked) {
                itemCb.checked = false;
                sbSelected.delete(item.dataset.file);
                item.classList.remove('selected');
              }
            }
            updateSelectBar();
          } else {
            cb.checked = !cb.checked;
            toggleSelect(btn, photo, cb.checked);
          }
          sbLastClickedIndex = idx;
          return;
        }
        openSbPhoto(photo);
      });
      grid.append(btn);
    }
  } catch (err) {
    $('#sb-status').textContent = `読み込みエラー: ${err.message}`;
  }
}

function toggleSelect(btn, photo, force) {
  const file = photo.id.replace('sb:', '');
  const checked = force !== undefined ? force : !sbSelected.has(file);
  const cb = btn.querySelector('.sb-check');
  if (checked) {
    sbSelected.add(file);
    btn.classList.add('selected');
    if (cb) cb.checked = true;
  } else {
    sbSelected.delete(file);
    btn.classList.remove('selected');
    if (cb) cb.checked = false;
  }
  updateSelectBar();
}

function updateSelectBar() {
  const bar = $('#sb-select-bar');
  const n = sbSelected.size;
  bar.hidden = n === 0;
  $('#sb-select-count').textContent = `${n}枚選択中`;
  $('#sb-grid').classList.toggle('selecting', n > 0);
}

function openSbPhoto(photo) {
  const sheet = $('#photo-sheet');
  sheet.hidden = false;
  $('#photo-big').src = photo.url;

  const tagsWrap = $('#photo-tags');
  tagsWrap.innerHTML = '';
  const allT = allTagsWithCustom();
  for (const tag of allT) {
    const chip = el('button', `chip${photo.tags.includes(tag) ? ' on' : ''}`, tag);
    chip.addEventListener('click', async () => {
      const current = photo.tags.includes(tag)
        ? photo.tags.filter((t2) => t2 !== tag)
        : [...photo.tags, tag];
      chip.classList.toggle('on');
      const file = photo.id.replace('sb:', '');
      await sbUpdateTags(file, current);
      photo.tags = current;
    });
    tagsWrap.append(chip);
  }

  const delBtn = $('#photo-delete');
  delBtn.hidden = false;
  delBtn.onclick = async () => {
    if (!(await confirmDialog('この写真を Supabase から消しますか？'))) return;
    const file = photo.id.replace('sb:', '');
    await removeFromSupabase(file);
    sheet.hidden = true;
    await renderSupabaseGrid();
  };
}

/* ---------- タグ管理 ---------- */

async function renderTagManager() {
  await refreshCustomTags();
  const wrap = $('#tag-manage-list');
  wrap.innerHTML = '';

  const custom = getCustomTags();
  const hidden = getHiddenTags();
  const visible = allTagsWithCustom();

  for (const tag of visible) {
    const chip = el('button', 'chip on', `${tag} ×`);
    chip.addEventListener('click', async () => {
      if (!(await confirmDialog(`「${tag}」を削除しますか？`))) return;
      invalidateTagConfig();
      if (custom.includes(tag)) {
        await saveCustomTags(custom.filter((t2) => t2 !== tag));
      } else {
        await saveHiddenTags([...hidden, tag]);
      }
      await renderTagManager();
      renderUploadTagChips();
      toast(`「${tag}」を削除しました`);
    });
    wrap.append(chip);
  }

  if (hidden.length) {
    const restore = el('button', 'btn ghost small', `非表示のタグを復元（${hidden.length}件）`);
    restore.style.marginTop = '8px';
    restore.addEventListener('click', async () => {
      invalidateTagConfig();
      await saveHiddenTags([]);
      await renderTagManager();
      renderUploadTagChips();
      toast('すべてのタグを復元しました');
    });
    wrap.append(restore);
  }
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
    const fixed = await hash('vg5!E8MNMX!OISEm');
    const digest = await hash(value);
    if (digest !== fixed) {
      $('#admin-msg').textContent = t('admin.wrong');
      return;
    }
    adminOpen = true;
    setSessionAuth();
    await openAdmin();
  });

  $('#admin-pass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#admin-enter').click();
  });

  $('#admin-lock').addEventListener('click', () => { adminOpen = false; openAdmin(); });
  $('#admin-open')?.addEventListener('click', () => { location.hash = '#admin'; openAdmin(); });

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

  /* ---------- Supabase ---------- */

  let sbUploadWithTags = true;
  $('#sb-add').addEventListener('click', () => { sbUploadWithTags = true; $('#sb-input').click(); });
  $('#sb-add-notag').addEventListener('click', () => { sbUploadWithTags = false; $('#sb-input').click(); });
  $('#sb-input').addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    const tags = sbUploadWithTags ? [...sbUploadTags] : [];
    const status = $('#sb-status');
    status.textContent = `${files.length} 枚を WebP 変換してアップロード中…`;
    try {
      const { shrinkImage } = await import('./db.js');
      const photos = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        // 長辺1000px・WebP。Storage / manifest とも .webp で揃える
        const blob = await shrinkImage(file);
        photos.push({
          id: `p${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
          blob,
          tags: [...tags],
          name: file.name,
          addedAt: Date.now(),
        });
      }
      await pushToSupabase(photos, (i, n) => {
        status.textContent = `WebPアップロード中… ${i}/${n}`;
      });
      e.target.value = '';
      const tagMsg = tags.length ? `（${tags.join('・')}）` : '';
      status.textContent = `${photos.length} 枚を WebP でアップロードしました${tagMsg}`;
      await renderSupabaseGrid();
    } catch (err) {
      status.textContent = `エラー: ${err.message}`;
    }
  });

  $('#sb-select-all').addEventListener('click', () => {
    for (const btn of $$('#sb-grid .lib-item')) {
      const file = btn.dataset.file;
      if (file && !sbSelected.has(file)) {
        sbSelected.add(file);
        btn.classList.add('selected');
        const cb = btn.querySelector('.sb-check');
        if (cb) cb.checked = true;
      }
    }
    updateSelectBar();
  });

  $('#sb-deselect').addEventListener('click', () => {
    sbSelected.clear();
    for (const btn of $$('#sb-grid .lib-item')) {
      btn.classList.remove('selected');
      const cb = btn.querySelector('.sb-check');
      if (cb) cb.checked = false;
    }
    updateSelectBar();
  });

  $('#sb-bulk-tag-btn').addEventListener('click', () => {
    if (!sbSelected.size) return;
    const sheet = $('#bulk-tag-sheet');
    sheet.hidden = false;
    const chips = $('#bulk-tag-chips');
    chips.innerHTML = '';
    const allT = allTagsWithCustom();
    const chosen = new Set();
    for (const tag of allT) {
      const chip = el('button', 'chip', tag);
      chip.addEventListener('click', () => {
        chip.classList.toggle('on');
        if (chosen.has(tag)) chosen.delete(tag); else chosen.add(tag);
      });
      chips.append(chip);
    }
    $('#bulk-tag-apply').onclick = async () => {
      if (!chosen.size) return;
      await bulkUpdateTags([...sbSelected], [...chosen]);
      sheet.hidden = true;
      toast(`${sbSelected.size}枚にタグを付けました`);
      sbSelected.clear();
      await renderSupabaseGrid();
    };
    $('#bulk-tag-remove').onclick = async () => {
      if (!chosen.size) return;
      await bulkRemoveTags([...sbSelected], [...chosen]);
      sheet.hidden = true;
      toast(`${sbSelected.size}枚からタグを外しました`);
      sbSelected.clear();
      await renderSupabaseGrid();
    };
  });

  $('#bulk-tag-close').addEventListener('click', () => { $('#bulk-tag-sheet').hidden = true; });

  $('#sb-bulk-convert').addEventListener('click', async () => {
    const entries = await sbLoadManifest({ fresh: true });
    const targets = [...sbSelected].filter((f) => !f.endsWith('.webp'));
    if (!targets.length) return toast('すべてWebPです');
    if (!(await confirmDialog(`${targets.length}枚をWebP変換しますか？`))) return;
    const status = $('#sb-status');
    let done = 0;
    for (const file of targets) {
      status.textContent = `WebP変換中… ${++done}/${targets.length}`;
      const entry = entries.find((e) => e.file === file);
      if (entry) {
        try { await convertToWebp(entry); } catch { /* skip */ }
      }
    }
    sbSelected.clear();
    status.textContent = `${targets.length}枚をWebPに変換しました`;
    await renderSupabaseGrid();
  });

  $('#sb-bulk-delete').addEventListener('click', async () => {
    const n = sbSelected.size;
    if (!n) return;
    if (!(await confirmDialog(`${n}枚の写真を削除しますか？`))) return;
    const status = $('#sb-status');
    let done = 0;
    for (const file of [...sbSelected]) {
      status.textContent = `削除中… ${++done}/${n}`;
      try { await removeFromSupabase(file); } catch { /* 個別の失敗は飛ばす */ }
    }
    sbSelected.clear();
    status.textContent = `${n}枚を削除しました`;
    await renderSupabaseGrid();
  });

  /* ---------- タグ管理 ---------- */

  $('#tag-add-btn').addEventListener('click', async () => {
    const input = $('#tag-new-input');
    const name = input.value.trim();
    if (!name) return;
    const existing = [...ALL_TAGS, ...getCustomTags()];
    if (existing.includes(name)) return toast('そのタグはすでにあります');
    const next = [...getCustomTags(), name];
    await saveCustomTags(next);
    input.value = '';
    await renderTagManager();
    toast(`「${name}」を追加しました`);
  });

  $('#tag-new-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#tag-add-btn').click();
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
      navigateTo('home');
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
let pendingStart = null;

function requireLogin(onSuccess) {
  if (getUser()) { onSuccess(); return; }
  pendingStart = onSuccess;
  $('#auth-sheet').hidden = false;
}

async function startSession(menu, { tags = null, part = null } = {}) {
  if (!getUser()) {
    requireLogin(() => startSession(menu, { tags, part }));
    return;
  }
  lastStart = () => startSession(menu, { tags, part });
  settings = getSettings();
  const weak = weakestLesson();

  // お題は管理画面（Supabase）に上げた写真だけから出す。外部検索には落とさない。
  const own = await supabasePhotos().catch(() => []);
  const fromAdmin = { photos: own };
  const silent = () => {};   // 使わないキューの空通知は出さない
  const needed = new Set(
    (menu.steps || []).map((s) => s.source
      || (s.drill === 'gesture' ? 'gesture'
        : s.drill === 'croquis' ? 'croquis'
        : 'photo')),
  );
  if (weak) needed.add(`weak:${weak.id}`);

  const queues = {};

  // フォールバック用。メニューが photo を直接使うときだけ空を知らせる
  if (needed.has('photo') || !own.length) {
    const matching = tags?.length
      ? own.filter((p) => tags.every((tag) => p.tags.includes(tag)))
      : own;
    queues.photo = createLibraryQueue(
      matching.length && tags?.length ? tags : [],
      notice,
      own.length ? '管理画面の写真に、そのタグが付いたものがありません' : '管理画面に写真がありません',
      fromAdmin,
    );
  } else {
    queues.photo = createLibraryQueue([], silent, null, fromAdmin);
  }

  // 部位練習 / デイリーの部位ステップ：選んだ部位タグの写真だけ（フォールバックなし）
  if (needed.has('part') && part) {
    const tagged = own.filter((p) => part.tags.every((tag) => p.tags.includes(tag)));
    queues.part = tagged.length
      ? createLibraryQueue(part.tags, silent, null, fromAdmin)
      : createLibraryQueue(part.tags, notice, `『${part.label}』タグの写真がありません`, fromAdmin);
  }

  // 互換：古いメニューが partMix を参照しても手＋上半身だけ
  if (needed.has('partMix')) {
    const partPhotos = own.filter((p) =>
      p.tags.includes('手') || p.tags.includes('上半身'));
    queues.partMix = partPhotos.length
      ? createWeightedQueue([
        { tags: ['手'], weight: 7 },
        { tags: ['上半身'], weight: 3 },
      ], silent, { photos: partPhotos })
      : createLibraryQueue(['手'], notice, '手・上半身の写真がありません', fromAdmin);
  }

  // ジェスチャードローイング → 必ず『動き』タグから
  if (needed.has('gesture')) {
    const gesturePhotos = own.filter((p) => p.tags.includes('動き'));
    queues.gesture = gesturePhotos.length
      ? createLibraryQueue(['動き'], silent, null, fromAdmin)
      : createLibraryQueue([], notice, '『動き』タグの写真がありません', fromAdmin);
  }

  // クロッキー → 全身タグ（無ければ管理写真全体。エラーにはしない）
  if (needed.has('croquis')) {
    const croquisPhotos = own.filter((p) => p.tags.includes('全身'));
    queues.croquis = croquisPhotos.length
      ? createLibraryQueue(['全身'], silent, null, fromAdmin)
      : createLibraryQueue([], silent, null, fromAdmin);
  }

  if (weak) {
    queues[`weak:${weak.id}`] = createLibraryQueue([], silent, null, fromAdmin);
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
  if (!getUser()) {
    requireLogin(() => startLesson(lesson));
    return;
  }
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

let pendingSessionMeta = null;

function sessionModeFrom(entry) {
  if (!entry) return 'Croquis';
  if (entry.menuId === 'daily') return 'Daily';
  if (entry.menuId?.startsWith('part-')) return 'Part';
  if (entry.menuId === 'gestureMode' || (entry.byDrill?.gesture && !entry.byDrill?.croquis)) {
    return 'Gesture';
  }
  if (entry.menuId === 'croquisMode' || entry.byDrill?.croquis) return 'Croquis';
  return entry.menuTitle || 'Practice';
}

function formatErr(err) {
  const raw = err?.message || String(err || 'unknown');
  return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
}

async function persistPendingLocally() {
  const entryId = pendingSessionMeta?.sessionId;
  if (!entryId || !pendingDrawings.length) {
    if (entryId && sheetBlob) {
      try { await putDrawing(`${entryId}#sheet`, sheetBlob); } catch {}
    }
    return updateLastSession({
      hasDrawing: pendingDrawings.length > 0,
      drawingCount: pendingDrawings.length || null,
      hasSheet: !!sheetBlob,
      shots: pendingDrawings.map((shot, i) => ({
        index: i,
        photoId: shot.photoId || null,
        seconds: shot.seconds || null,
        artworkId: shot.artworkId || null,
      })),
    });
  }
  try {
    await Promise.all([
      ...pendingDrawings.map((shot, i) => putDrawing(`${entryId}#${i}`, shot.blob)),
      ...(sheetBlob ? [putDrawing(`${entryId}#sheet`, sheetBlob)] : []),
    ]);
  } catch (err) {
    console.error('[local save]', err);
    toast(`${t('toast.saveFail')}\n${formatErr(err)}`, 6000);
  }
  return updateLastSession({
    hasDrawing: true,
    drawingCount: pendingDrawings.length,
    hasSheet: !!sheetBlob,
    shots: pendingDrawings.map((shot, i) => ({
      index: i,
      photoId: shot.photoId || null,
      seconds: shot.seconds || null,
      artworkId: shot.artworkId || null,
    })),
  });
}

async function uploadPendingArtworks({ quiet = false } = {}) {
  const user = getUser();
  if (!user || !pendingDrawings.length) return { uploaded: 0, failed: 0 };
  const drawings = [...pendingDrawings];
  const globalPublic = $('#publish-toggle')?.checked !== false;
  const sessionId = pendingSessionMeta?.sessionId || null;
  const mode = pendingSessionMeta?.mode || null;
  if (getUsername()) {
    upsertProfile(getUsername()).catch(() => {});
  }
  let uploaded = 0;
  let failed = 0;
  let lastErr = null;
  for (let i = 0; i < drawings.length; i++) {
    const shot = drawings[i];
    if (shot.uploaded) continue;
    const promptId = shot.photoId || `session:${sessionId || 'local'}:${i}`;
    try {
      shot.uploading = true;
      const isPublic = globalPublic && !shot.excludeFromGallery;
      const work = await uploadArtwork(shot.blob, promptId, {
        isPublic,
        sessionId,
        mode,
        allowCopy: !!shot.allowCopy,
      });
      shot.uploaded = true;
      shot.artworkId = work?.id || null;
      if (!shot.photoId) shot.photoId = promptId;
      uploaded++;
    } catch (err) {
      failed++;
      lastErr = err;
      console.error('[artworks upload]', err);
    } finally {
      shot.uploading = false;
    }
  }
  if (uploaded) {
    updateLastSession({
      shots: drawings.map((shot, i) => ({
        index: i,
        photoId: shot.photoId || null,
        seconds: shot.seconds || null,
        artworkId: shot.artworkId || null,
      })),
    });
  }
  if (!quiet) {
    if (failed) toast(`${t('gal.uploadFail')}\n${formatErr(lastErr)}`, 8000);
    else if (uploaded) toast(t('gal.uploaded'));
  }
  return { uploaded, failed, lastErr };
}

async function finishLeavingReview() {
  updateLastSession({
    rating: null,
    note: $('#review-note').value.trim() || null,
    hasDrawing: pendingDrawings.length > 0,
    drawingCount: pendingDrawings.length || null,
    hasSheet: !!sheetBlob,
    shots: pendingDrawings.map((shot, i) => ({
      index: i,
      photoId: shot.photoId || null,
      seconds: shot.seconds || null,
      artworkId: shot.artworkId || null,
    })),
    missed: null,
  });
  pendingDrawings = [];
  pendingSessionMeta = null;
  sheetBlob = null;
}

async function finishSession(result) {
  const entry = saveResult(result);
  if (settings.sfx) sfx.fanfare();

  pendingDrawings = result.drawings || [];
  pendingDrawings.forEach((shot) => {
    if (shot.excludeFromGallery == null) shot.excludeFromGallery = false;
    if (shot.allowCopy == null) shot.allowCopy = false;
  });
  galleryPromptIds = pendingDrawings.map((d) => d.photoId).filter(Boolean);
  pendingSessionMeta = {
    sessionId: entry?.id || null,
    mode: sessionModeFrom(entry),
  };
  $('#gallery-card').hidden = true;
  $('#review-note').value = '';

  const canPublish = pendingDrawings.length > 0 && !!getUser();
  const publishRow = $('#publish-row');
  const publishNote = $('#publish-note');
  // 一括トグル（全て公開／全て模写OK）に寄せたので、旧マスタ行は出さない
  if (publishRow) publishRow.hidden = true;
  if (publishNote) publishNote.hidden = true;
  if (canPublish) {
    $('#publish-toggle').checked = true;
    updatePublishNote(true);
    const bulkPub = $('#bulk-publish');
    const bulkCopy = $('#bulk-copy');
    if (bulkPub) bulkPub.checked = true;
    if (bulkCopy) bulkCopy.checked = false;
  }

  $('#sheet-preview').hidden = true;
  renderDrawingStrip();
  showScreen('review');

  if (pendingDrawings.length > 0) {
    const blob = await composeSheet(
      pendingDrawings.map((s) => s.blob),
      { date: dateKey(), crop: true },
    );
    if (blob) {
      sheetBlob = blob;
      $('#sheet-img').src = URL.createObjectURL(blob);
      $('#sheet-preview').hidden = false;
    }
  }

  // ふりかえりに入った時点で端末保存＋クラウド投稿する
  await persistPendingLocally();
  if (getUser() && pendingDrawings.length) {
    void uploadPendingArtworks();
  }

  loadSamePromptGallery();
}

/* ==================== ふりかえり ==================== */

/**
 * その回に描いた絵をならべる。
 * 以前はここを押すと消えていた。押して消えるのは事故にしかならないので、
 * 押したら大きくなり、消すのは拡大した先でもう一度選ぶ形にした。
 */
function publishEnabled() {
  return !!getUser() && $('#publish-toggle')?.checked !== false;
}

function excludeLabel(excluded) {
  return excluded ? t('gal.include') : t('gal.exclude');
}

function syncBulkToggles() {
  const bulk = $('#strip-bulk');
  const bulkPub = $('#bulk-publish');
  const bulkCopy = $('#bulk-copy');
  const bulkPubRow = $('#bulk-publish-row');
  const bulkCopyRow = $('#bulk-copy-row');
  if (!bulk || !bulkPub || !bulkCopy) return;

  const loggedIn = !!getUser() && pendingDrawings.length > 0;
  bulk.hidden = !loggedIn;
  if (!loggedIn) return;

  const allPublic = pendingDrawings.every((s) => !s.excludeFromGallery);
  const allCopy = pendingDrawings.length > 0 && pendingDrawings.every((s) => !!s.allowCopy);
  bulkPub.checked = publishEnabled() && allPublic;
  bulkCopy.checked = allCopy;
  bulkPubRow?.classList.toggle('is-off', !bulkPub.checked);
  bulkCopyRow?.classList.toggle('is-off', !bulkCopy.checked);
}

function setAllPublish(on) {
  const pub = $('#publish-toggle');
  if (pub) pub.checked = !!on;
  updatePublishNote(!!on);
  pendingDrawings.forEach((shot) => {
    shot.excludeFromGallery = !on;
  });
  renderDrawingStrip();
  syncDrawExcludeButton();
}

function setAllAllowCopy(on) {
  pendingDrawings.forEach((shot) => {
    shot.allowCopy = !!on;
  });
  renderDrawingStrip();
}

function setShotExcluded(index, excluded) {
  const shot = pendingDrawings[index];
  if (!shot) return;
  shot.excludeFromGallery = !!excluded;
  const wrap = $(`#drawing-strip .strip-shot[data-index="${index}"]`);
  if (wrap) {
    wrap.classList.toggle('is-excluded', !!excluded);
    const pub = wrap.querySelector('.strip-shot-controls .toggle-row input[type="checkbox"]');
    const pubLabel = wrap.querySelector('.strip-shot-controls .toggle-row');
    if (pub && pubLabel) {
      pub.checked = publishEnabled() && !excluded;
      pubLabel.classList.toggle('is-off', !pub.checked);
    }
  }
  if (drawingIndex === index) {
    const lbBtn = $('#draw-exclude');
    if (lbBtn && !lbBtn.hidden) lbBtn.textContent = excludeLabel(excluded);
  }
  syncBulkToggles();
}

function renderDrawingStrip() {
  const strip = $('#drawing-strip');
  strip.innerHTML = '';
  const has = pendingDrawings.length > 0;
  strip.hidden = !has;
  $('#strip-actions').hidden = !has;
  $('#dl-all').disabled = !has;

  const showPublish = publishEnabled();

  pendingDrawings.forEach((shot, i) => {
    const wrap = el('div', `strip-shot${shot.excludeFromGallery ? ' is-excluded' : ''}`);
    wrap.dataset.index = String(i);

    const item = el('button', 'strip-item');
    item.type = 'button';
    const img = el('img');
    img.src = URL.createObjectURL(shot.blob);
    img.alt = '';
    item.append(img);
    item.addEventListener('click', () => openDrawing(i));
    wrap.append(item);

    if (getUser()) {
      const controls = el('div', 'strip-shot-controls');

      const pubLabel = el('label', `toggle-row${(!showPublish || shot.excludeFromGallery) ? ' is-off' : ''}`);
      const pubText = el('span', null, t('gal.postThis'));
      const pubInput = el('input');
      pubInput.type = 'checkbox';
      pubInput.checked = showPublish && !shot.excludeFromGallery;
      pubInput.disabled = !showPublish;
      pubInput.addEventListener('change', () => {
        setShotExcluded(i, !pubInput.checked);
        pubLabel.classList.toggle('is-off', !pubInput.checked);
      });
      const pubTrack = el('span', 'toggle-track');
      pubLabel.append(pubText, pubInput, pubTrack);
      controls.append(pubLabel);

      const copyLabel = el('label', `toggle-row${shot.allowCopy ? '' : ' is-off'}`);
      const copyText = el('span', null, t('gal.allowCopy'));
      const copyInput = el('input');
      copyInput.type = 'checkbox';
      copyInput.checked = !!shot.allowCopy;
      copyInput.addEventListener('change', () => {
        shot.allowCopy = !!copyInput.checked;
        copyLabel.classList.toggle('is-off', !copyInput.checked);
        syncBulkToggles();
      });
      const copyTrack = el('span', 'toggle-track');
      copyLabel.append(copyText, copyInput, copyTrack);
      controls.append(copyLabel);

      wrap.append(controls);
    }

    strip.append(wrap);
  });

  syncBulkToggles();
}

let drawingIndex = -1;

function syncDrawExcludeButton() {
  const btn = $('#draw-exclude');
  if (!btn) return;
  const shot = pendingDrawings[drawingIndex];
  const can = !!shot && publishEnabled();
  btn.hidden = !can;
  if (can) btn.textContent = excludeLabel(!!shot.excludeFromGallery);
}

function openDrawing(index) {
  const shot = pendingDrawings[index];
  if (!shot) return;
  drawingIndex = index;
  $('#draw-img').src = URL.createObjectURL(shot.blob);
  $('#draw-remove').hidden = false;
  syncDrawExcludeButton();
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
    if (shot) {
      downloadBlob(shot.blob, `artclub-${dateKey()}-${drawingIndex + 1}.jpg`);
    }
  });
  $('#draw-share-x').addEventListener('click', async () => {
    const shot = pendingDrawings[drawingIndex];
    if (!shot) return;
    const btn = $('#draw-share-x');
    const text = t('rev.shareText', { n: 1, d: '' });
    if (getUser()) {
      btn.disabled = true;
      try {
        const url = await uploadShareImage(shot.blob);
        shareToX(`${text}\n${url}`);
      } catch { shareToX(text); }
      btn.disabled = false;
    } else {
      shareToX(text);
    }
  });
  $('#draw-exclude').addEventListener('click', () => {
    if (drawingIndex < 0 || !publishEnabled()) return;
    const shot = pendingDrawings[drawingIndex];
    if (!shot) return;
    setShotExcluded(drawingIndex, !shot.excludeFromGallery);
  });
  $('#draw-remove').addEventListener('click', () => {
    if (drawingIndex < 0) return;
    pendingDrawings.splice(drawingIndex, 1);
    close();
    renderDrawingStrip();
  });
}

function updatePublishNote(isPublic) {
  const note = $('#publish-note');
  if (!note) return;
  note.textContent = isPublic ? '' : t('gal.private');
  note.hidden = isPublic;
}

function wireReview() {
  $('#publish-toggle').addEventListener('change', (e) => {
    updatePublishNote(e.target.checked);
    renderDrawingStrip();
    syncDrawExcludeButton();
  });

  $('#bulk-publish')?.addEventListener('change', (e) => {
    setAllPublish(e.target.checked);
  });
  $('#bulk-copy')?.addEventListener('change', (e) => {
    setAllAllowCopy(e.target.checked);
  });

  $('#dl-all').addEventListener('click', () => {
    downloadEach(
      pendingDrawings.map((s) => s.blob),
      `artclub-${dateKey()}`,
    );
  });

  $('#sheet-dl').addEventListener('click', () => {
    if (sheetBlob) downloadBlob(sheetBlob, `artclub-${dateKey()}.jpg`);
  });

  $('#share-x').addEventListener('click', async () => {
    const btn = $('#share-x');
    const seconds = getHistory().at(-1)?.seconds || 0;
    const text = t('rev.shareText', { n: pendingDrawings.length, d: fmtDur(seconds) });
    btn.disabled = true;
    try {
      await uploadPendingArtworks();
      const workId = pendingDrawings.find((s) => s.artworkId)?.artworkId;
      if (workId) {
        shareToX(`${text}\n${workPageUrl(workId)}`);
      } else if (sheetBlob && getUser()) {
        const url = await uploadShareImage(sheetBlob);
        shareToX(`${text}\n${url}`);
      } else {
        shareToX(text);
      }
    } catch (err) {
      console.error('[share]', err);
      toast(`${t('gal.uploadFail')}\n${formatErr(err)}`, 8000);
      shareToX(text);
    }
    btn.disabled = false;
  });

  $('#review-home').addEventListener('click', async () => {
    await finishLeavingReview();
    navigateTo('home');
    celebrate();
  });

  $('#review-again').addEventListener('click', async () => {
    await finishLeavingReview();
    lastStart?.();
  });

  wireGallery();
}

/* ==================== みんなの作品ギャラリー ==================== */

let galleryPromptIds = [];

async function loadSamePromptGallery() {
  const card = $('#gallery-card');
  const grid = $('#gallery-grid');
  const empty = $('#gallery-empty');
  const loading = $('#gallery-loading');
  const countEl = $('#gallery-count');
  if (!card || !galleryPromptIds.length) {
    if (card) card.hidden = true;
    return;
  }

  card.hidden = false;
  grid.innerHTML = '';
  empty.hidden = true;
  loading.hidden = false;
  countEl.textContent = '';

  // 投稿設定（全体／スケッチ単位）は保存・シェア時に反映する。
  // ここでは他の人のスケッチだけ先に見せる。

  const uniqueIds = [...new Set(galleryPromptIds.filter(Boolean))];
  let allWorks = [];
  for (const pid of uniqueIds) {
    const works = await fetchArtworks(pid, { limit: 10 }).catch(() => []);
    allWorks.push(...works);
  }
  // 同じ作品が複数 prompt にまたがることは稀だが念のため
  const seen = new Set();
  allWorks = allWorks.filter((w) => {
    if (seen.has(w.id)) return false;
    seen.add(w.id);
    return true;
  });
  allWorks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  allWorks = allWorks.slice(0, 10);

  loading.hidden = true;
  if (!allWorks.length) {
    empty.hidden = false;
    return;
  }

  countEl.textContent = t('gal.count', { n: allWorks.length });
  const userId = getUser()?.id;
  for (const work of allWorks) {
    grid.append(renderGalleryCard(work, userId));
  }
}

function renderGalleryCard(work, userId) {
  const item = el('div', `gallery-item${work.user_id === userId ? ' is-mine' : ''}`);
  const thumb = el('button', 'gallery-item-thumb');
  const img = el('img');
  img.src = work.image_url;
  img.loading = 'lazy';
  img.alt = work.username || '';
  thumb.append(img);
  thumb.addEventListener('click', () => openGalleryLightbox(work, userId));

  const meta = el('div', 'gallery-item-meta');
  meta.append(el('span', 'gallery-username', work.username || 'anonymous'));

  const likeBtn = el('button', `gallery-like-btn${work.liked_by_me ? ' on' : ''}`);
  likeBtn.type = 'button';
  likeBtn.innerHTML = `<span class="gallery-heart">♥</span><span>${work.like_count || 0}</span>`;
  likeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!getUser()) return toast(t('gal.loginToLike'));
    try {
      const nowLiked = await toggleLike(work.id, !!work.liked_by_me);
      work.liked_by_me = nowLiked;
      work.like_count = Math.max(0, (work.like_count || 0) + (nowLiked ? 1 : -1));
      likeBtn.classList.toggle('on', nowLiked);
      likeBtn.innerHTML = `<span class="gallery-heart">♥</span><span>${work.like_count}</span>`;
    } catch {
      toast(t('gal.uploadFail'));
    }
  });
  meta.append(likeBtn);

  item.append(thumb, meta);
  return item;
}

let currentArtwork = null;

function openGalleryLightbox(work, userId) {
  currentArtwork = work;
  $('#gallery-lb-img').src = work.image_url;
  $('#gallery-lb-user').textContent = work.username || 'anonymous';
  const delBtn = $('#gallery-lb-delete');
  delBtn.hidden = work.user_id !== userId;
  const copyBtn = $('#gallery-lb-copy');
  const canCopy = !!work.allow_copy && work.user_id !== userId;
  if (copyBtn) copyBtn.hidden = !canCopy;
  const likeBtn = $('#gallery-lb-like');
  const likeCount = $('#gallery-lb-like-count');
  likeBtn.hidden = false;
  likeBtn.classList.toggle('on', !!work.liked_by_me);
  likeCount.textContent = String(work.like_count || 0);
  const share = $('#gallery-lb-share');
  if (work.id) {
    share.hidden = false;
    share.href = workPageUrl(work.id);
  } else {
    share.hidden = true;
  }
  $('#gallery-lightbox').hidden = false;
}

function wireGallery() {
  const lb = $('#gallery-lightbox');

  $('#gallery-lb-close').addEventListener('click', () => { lb.hidden = true; });
  lb.addEventListener('click', (e) => { if (e.target === lb) lb.hidden = true; });

  $('#gallery-lb-like').addEventListener('click', async () => {
    if (!currentArtwork) return;
    if (!getUser()) return toast(t('gal.loginToLike'));
    try {
      const nowLiked = await toggleLike(currentArtwork.id, !!currentArtwork.liked_by_me);
      currentArtwork.liked_by_me = nowLiked;
      currentArtwork.like_count = Math.max(
        0,
        (currentArtwork.like_count || 0) + (nowLiked ? 1 : -1),
      );
      $('#gallery-lb-like').classList.toggle('on', nowLiked);
      $('#gallery-lb-like-count').textContent = String(currentArtwork.like_count);
      loadSamePromptGallery();
    } catch {
      toast(t('gal.uploadFail'));
    }
  });

  $('#gallery-lb-delete').addEventListener('click', async () => {
    if (!currentArtwork) return;
    if (!(await confirmDialog(t('gal.deleteConfirm')))) return;
    try {
      await deleteArtwork(currentArtwork.id, currentArtwork.storage_path);
      lb.hidden = true;
      loadSamePromptGallery();
      if (document.body.dataset.screen === 'atelier') renderAtelier();
    } catch { toast(t('gal.uploadFail')); }
  });

  const copyBtn = $('#gallery-lb-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      toast(t('atelier.copySoon'));
    });
  }
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
      if ($('#draw-exclude')) $('#draw-exclude').hidden = true;
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
    head.append(el('span', 'note-date', entry.menuTitle || sessionLabel(entry) || '—'));
    if (entry.lessonId && !entry.menuTitle) {
      const lessonName = tr(lessonById(entry.lessonId), 'name');
      if (lessonName) head.append(el('span', 'rate-tag', lessonName));
    }
    block.append(head);
    const drills = Object.entries(entry.byDrill || {})
      .map(([id, sec]) => `${tr(DRILLS[id], 'name') || id} ${fmtDur(sec)}`).join(' / ');
    if (drills) block.append(el('p', 'muted small', drills));
    if (entry.note) block.append(el('p', 'note-body', entry.note));

    const sheet = await getDrawing(`${entry.id}#sheet`).catch(() => null);
    if (sheet) {
      const dl = el('button', 'btn primary small');
      dl.type = 'button';
      dl.textContent = t('rev.dlSheet');
      dl.addEventListener('click', () => {
        downloadBlob(sheet, `artclub-${dayKey}-${entry.id}.jpg`);
      });
      block.append(dl);
    }
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

function sessionLabel(entry) {
  if (entry?.menuTitle) return entry.menuTitle;
  if (entry?.lessonId) {
    const name = tr(lessonById(entry.lessonId), 'name');
    if (name) return t('log.practisedPart', { n: name });
  }
  return '';
}

function formatTlDate(entry) {
  if (entry?.ts) {
    const d = new Date(entry.ts);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }
  }
  if (!entry?.date) return '';
  const m = String(entry.date).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[2])}/${Number(m[3])}` : entry.date;
}

function avatarGlyph(name) {
  const s = String(name || '').trim();
  return s ? s.slice(0, 1) : 'あ';
}

function renderNotes(history) {
  const wrap = $('#note-list');
  wrap.innerHTML = '';
  // メモか絵があるセッションをTL投稿として新しい順に
  const posts = history
    .filter((h) => h.note || h.hasDrawing)
    .slice(-30)
    .reverse();
  if (!posts.length) {
    wrap.append(el('p', 'muted small tl-empty', t('log.noNotes')));
    return;
  }

  const displayName = getUsername() || t('log.me');
  for (const entry of posts) {
    const post = el('article', 'tl-post');
    post.dataset.sessionId = entry.id || '';

    const avatar = el('div', 'tl-avatar', avatarGlyph(displayName));
    const main = el('div', 'tl-main');

    const meta = el('header', 'tl-meta');
    meta.append(el('span', 'tl-name', displayName));
    meta.append(el('span', 'tl-dot', '·'));
    const time = el('time', 'tl-time', formatTlDate(entry));
    if (entry.date) time.dateTime = entry.date;
    meta.append(time);
    const label = sessionLabel(entry);
    if (label) meta.append(el('span', 'tl-menu', label));
    main.append(meta);

    if (entry.note) main.append(el('p', 'tl-body', entry.note));

    if (entry.hasDrawing) {
      const media = el('div', 'tl-media');
      const img = el('img');
      img.alt = label || t('rev.drawn');
      img.loading = 'lazy';
      media.append(img);
      main.append(media);
      loadDrawing(entry.id)
        .then((blob) => { if (blob) img.src = URL.createObjectURL(blob); })
        .catch(() => { media.remove(); });
    }

    const actions = el('div', 'tl-actions');
    const likeBtn = el('button', 'tl-like');
    likeBtn.type = 'button';
    likeBtn.setAttribute('aria-label', t('log.like'));
    likeBtn.dataset.liked = '0';
    likeBtn.innerHTML = `<span class="gallery-heart">♥</span><span class="tl-like-count">0</span>`;
    // いまは自分のローカル記録用の見た目だけ。クラウドいいねは後で接続する
    likeBtn.addEventListener('click', () => {
      const on = likeBtn.dataset.liked === '1';
      const next = !on;
      likeBtn.dataset.liked = next ? '1' : '0';
      likeBtn.classList.toggle('on', next);
      const n = Number(likeBtn.querySelector('.tl-like-count')?.textContent || 0);
      likeBtn.querySelector('.tl-like-count').textContent = String(Math.max(0, n + (next ? 1 : -1)));
    });
    actions.append(likeBtn);
    main.append(actions);

    post.append(avatar, main);
    wrap.append(post);
  }
}

/* ==================== 設定 ==================== */

function renderSettings() {
  settings = getSettings();

  const u = getUser();
  const profileCard = $('#profile-card');
  profileCard.hidden = !u;
  if (u) {
    $('#profile-username').value = getUsername();
  }
  $('#opt-theme').value = settings.theme;
  $('#opt-skin').value = settings.skin || 'pastel-rpg';
  $('#opt-sound').checked = settings.sound;
  $('#opt-sfx').checked = settings.sfx;
  $('#opt-autoflip').checked = settings.autoFlip;
  $('#opt-keepawake').checked = settings.keepAwake;
  $('#opt-orientation').value = settings.orientation;
  $('#opt-alpha').value = String(Math.round((settings.penAlpha ?? 0.8) * 100));
  renderLangChips();
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


function wireSettings() {
  $('#profile-save').addEventListener('click', () => {
    const name = $('#profile-username').value.trim();
    if (!name) return;
    setUsername(name);
    updateAuthUI(getUser());
    toast(t('auth.saved'));
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
  $('#opt-skin').addEventListener('change', (e) => {
    settings = saveSettings({ skin: e.target.value });
    applyTheme();
  });
  $('#opt-alpha').addEventListener('input', (e) => {
    settings = saveSettings({ penAlpha: Number(e.target.value) / 100 });
  });
  bind('#opt-autoflip', 'autoFlip');
  bind('#opt-keepawake', 'keepAwake');
  bind('#opt-orientation', 'orientation');
}

/* ==================== アトリエ ==================== */

let atelierTab = 'public';
let atelierWired = false;
let atelierPhotoIndex = null;

function formatArtworkTime(work) {
  if (!work?.created_at) return '';
  const d = new Date(work.created_at);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function renderArtworkTlPost(work, { mine = false } = {}) {
  const post = el('article', 'tl-post');
  post.dataset.artworkId = work.id || '';
  const name = work.username || t('log.me');
  const avatar = el('div', 'tl-avatar', avatarGlyph(name));
  const main = el('div', 'tl-main');

  const meta = el('header', 'tl-meta');
  meta.append(el('span', 'tl-name', name));
  meta.append(el('span', 'tl-dot', '·'));
  meta.append(el('time', 'tl-time', formatArtworkTime(work)));
  if (work.mode) meta.append(el('span', 'tl-menu', work.mode));
  if (mine && work.visibility === 'private') {
    meta.append(el('span', 'atelier-badge private', t('atelier.privateBadge')));
  }
  if (work.allow_copy) {
    meta.append(el('span', 'atelier-badge copy', t('atelier.copyable')));
  }
  main.append(meta);

  if (work.image_url) {
    const media = el('button', 'tl-media');
    media.type = 'button';
    const img = el('img');
    img.src = work.image_url;
    img.alt = name;
    img.loading = 'lazy';
    media.append(img);
    media.addEventListener('click', () => openAtelierWork(work));
    main.append(media);
  }

  const actions = el('div', 'tl-actions');
  const likeBtn = el('button', `tl-like${work.liked_by_me ? ' on' : ''}`);
  likeBtn.type = 'button';
  likeBtn.innerHTML = `<span class="gallery-heart">♥</span><span class="tl-like-count">${work.like_count || 0}</span>`;
  likeBtn.addEventListener('click', async () => {
    if (!getUser()) return toast(t('gal.loginToLike'));
    try {
      const nowLiked = await toggleLike(work.id, !!work.liked_by_me);
      work.liked_by_me = nowLiked;
      work.like_count = Math.max(0, (work.like_count || 0) + (nowLiked ? 1 : -1));
      likeBtn.classList.toggle('on', nowLiked);
      likeBtn.querySelector('.tl-like-count').textContent = String(work.like_count);
    } catch (err) {
      toast(`${t('gal.uploadFail')}\n${formatErr(err)}`, 6000);
    }
  });
  actions.append(likeBtn);
  main.append(actions);

  post.append(avatar, main);
  return post;
}

function openAtelierWork(work) {
  openGalleryLightbox(work, getUser()?.id);
}

async function ensureAtelierPhotoIndex() {
  if (atelierPhotoIndex) return atelierPhotoIndex;
  const photos = await everyPhoto().catch(() => []);
  const map = new Map();
  for (const p of photos) {
    if (p?.id) map.set(p.id, p);
  }
  atelierPhotoIndex = map;
  return map;
}

function switchAtelierTab(tab, { syncHash = true } = {}) {
  atelierTab = (tab === 'mine' || tab === 'prompt') ? tab : 'public';
  $$('[data-atelier-tab]').forEach((btn) => {
    btn.classList.toggle('on', btn.dataset.atelierTab === atelierTab);
  });
  $('#atelier-public').hidden = atelierTab !== 'public';
  $('#atelier-mine').hidden = atelierTab !== 'mine';
  $('#atelier-prompt').hidden = atelierTab !== 'prompt';
  if (atelierTab === 'public') renderAtelierPublic();
  if (atelierTab === 'mine') renderAtelierMine();
  if (atelierTab === 'prompt') renderAtelierByPrompt();
  if (syncHash) navigateTo(atelierRoute(atelierTab), { replace: true });
}

function atelierRoute(tab) {
  if (tab === 'mine') return 'atelier/mine';
  if (tab === 'prompt') return 'atelier/prompt';
  return 'atelier';
}

async function renderAtelierPublic() {
  const feed = $('#atelier-public-feed');
  const empty = $('#atelier-public-empty');
  feed.innerHTML = '';
  empty.hidden = true;
  const works = await fetchPublicArtworks({ limit: 40 }).catch(() => []);
  if (!works.length) {
    empty.hidden = false;
    return;
  }
  for (const work of works) feed.append(renderArtworkTlPost(work));
}

async function renderAtelierMine() {
  const feed = $('#atelier-mine-feed');
  const empty = $('#atelier-mine-empty');
  const login = $('#atelier-mine-login');
  feed.innerHTML = '';
  empty.hidden = true;
  login.hidden = true;
  if (!getUser()) {
    login.hidden = false;
    return;
  }
  const works = await fetchMyArtworks({ limit: 60 }).catch(() => []);
  if (!works.length) {
    empty.hidden = false;
    return;
  }
  for (const work of works) feed.append(renderArtworkTlPost(work, { mine: true }));
}

async function renderAtelierByPrompt() {
  const list = $('#atelier-prompt-list');
  const empty = $('#atelier-prompt-empty');
  list.innerHTML = '';
  empty.hidden = true;

  const [publicWorks, myWorks, photos] = await Promise.all([
    fetchPublicArtworks({ limit: 80 }).catch(() => []),
    getUser() ? fetchMyArtworks({ limit: 80 }).catch(() => []) : Promise.resolve([]),
    ensureAtelierPhotoIndex(),
  ]);

  const byPrompt = new Map();
  const add = (work) => {
    if (!work?.prompt_id || String(work.prompt_id).startsWith('session:')) return;
    const bucket = byPrompt.get(work.prompt_id) || [];
    if (!bucket.some((w) => w.id === work.id)) bucket.push(work);
    byPrompt.set(work.prompt_id, bucket);
  };
  publicWorks.forEach(add);
  myWorks.forEach(add);

  const promptIds = [...byPrompt.keys()];
  if (!promptIds.length) {
    empty.hidden = false;
    return;
  }

  const me = getUser()?.id;
  for (const promptId of promptIds) {
    const works = byPrompt.get(promptId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const card = el('section', 'atelier-prompt-card');
    const head = el('div', 'atelier-prompt-head');
    head.append(el('span', 'atelier-prompt-label', t('atelier.promptPhoto')));
    head.append(el('span', 'atelier-prompt-count', `${works.length}`));
    card.append(head);

    const photo = photos.get(promptId);
    if (photo) {
      const img = el('img', 'atelier-prompt-photo');
      img.alt = t('atelier.promptPhoto');
      setPhotoSrc(img, photo);
      card.append(img);
    } else {
      card.append(el('div', 'atelier-prompt-photo is-empty', t('atelier.noPromptPhoto')));
    }

    const scroller = el('div', 'atelier-hscroll');
    // 自分の絵を先に
    const ordered = [
      ...works.filter((w) => w.user_id === me),
      ...works.filter((w) => w.user_id !== me),
    ];
    for (const work of ordered) {
      const btn = el('button', `atelier-thumb${work.user_id === me ? ' is-mine' : ''}`);
      btn.type = 'button';
      const frame = el('div', 'atelier-thumb-frame');
      const img = el('img');
      img.src = work.image_url;
      img.alt = work.username || '';
      img.loading = 'lazy';
      frame.append(img);
      btn.append(frame);
      const meta = el('div', 'atelier-thumb-meta');
      meta.append(el('span', null, work.user_id === me ? t('atelier.you') : (work.username || '—')));
      if (work.allow_copy) meta.append(el('span', 'atelier-badge copy', t('atelier.copyable')));
      if (work.visibility === 'private') meta.append(el('span', 'atelier-badge private', t('atelier.privateBadge')));
      btn.append(meta);
      btn.addEventListener('click', () => openAtelierWork(work));
      scroller.append(btn);
    }
    card.append(scroller);
    list.append(card);
  }
}


function renderAtelier() {
  switchAtelierTab(atelierTab || 'public', { syncHash: false });
}

function wireAtelier() {
  if (atelierWired) return;
  atelierWired = true;
  $$('[data-atelier-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigateTo(atelierRoute(btn.dataset.atelierTab));
    });
  });
}

/* ==================== URL ルーティング ==================== */

function parseRoute(hash = location.hash) {
  const raw = String(hash || '').replace(/^#/, '').trim();
  if (!raw) return { root: 'home', parts: [] };
  const parts = raw.split('/').map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  }).filter(Boolean);
  return { root: parts[0] || 'home', parts };
}

function routeFromLocation() {
  const path = location.pathname.replace(/\/+$/, '');
  const segs = path.split('/').filter(Boolean);
  const idx = segs[0] === 'artclub' ? 1 : 0;
  const root = segs[idx];
  if (root === 'atelier') {
    const sub = segs[idx + 1];
    return { root: 'atelier', parts: sub ? ['atelier', sub] : ['atelier'] };
  }
  if (['home', 'log', 'settings', 'admin', 'library'].includes(root) && !segs[idx + 1]) {
    return { root, parts: [root] };
  }
  return parseRoute(location.hash);
}

function navigateTo(route, { replace = false } = {}) {
  const clean = String(route || 'home').replace(/^#/, '');
  const next = clean || 'home';
  const hash = `#${next}`;
  const current = (location.hash || '#home').replace(/^#/, '') || 'home';
  if (current === next) {
    applyRoute(parseRoute(hash));
    return;
  }
  // replaceState は hashchange が飛ばないので自分で適用。通常遷移は hash 代入に任せる。
  if (replace) {
    history.replaceState(null, '', hash);
    applyRoute(parseRoute(hash));
    return;
  }
  location.hash = next;
}

function applyRoute(route = routeFromLocation()) {
  const root = route.root || 'home';
  const sub = route.parts[1];

  if (root === 'admin') {
    openAdmin();
    return;
  }
  if (root === 'work') {
    showScreen('home');
    renderHome();
    return;
  }

  if (root === 'atelier') {
    atelierTab = (sub === 'mine' || sub === 'prompt') ? sub : 'public';
    showScreen('atelier');
    renderAtelier();
    return;
  }
  if (root === 'log') {
    renderLog();
    showScreen('log');
    return;
  }
  if (root === 'settings') {
    renderSettings();
    showScreen('settings');
    return;
  }
  if (root === 'library') {
    openLibrary();
    return;
  }

  renderHome();
  showScreen('home');
}

function wireRoutes() {
  window.addEventListener('hashchange', () => applyRoute(parseRoute(location.hash)));
}

/* ==================== 起動 ==================== */

function wireNav() {
  $$('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;
      if (target === 'library') {
        navigateTo('library');
        return;
      }
      if (target === 'atelier') {
        navigateTo(atelierRoute(atelierTab || 'public'));
        return;
      }
      if (target === 'log' || target === 'home' || target === 'settings') {
        navigateTo(target);
        return;
      }
      showScreen(target);
    });
  });

  $('#lang-btn').addEventListener('click', () => switchLang(getLang() === 'ja' ? 'en' : 'ja'));
}

const THEME_COLORS = {
  light: '#f4f4f1',
  dark: '#000000',
  paper: '#f5f4ee',
};
const SKIN_THEME_COLORS = {
  'pastel-rpg': {
    light: '#f6f0f8',
    dark: '#2a2438',
    paper: '#f8f2e8',
  },
};

function applyTheme() {
  const theme = settings.theme || 'light';
  const skin = settings.skin || 'pastel-rpg';
  document.body.dataset.theme = theme;
  if (skin && skin !== 'default') document.body.dataset.skin = skin;
  else delete document.body.dataset.skin;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bySkin = SKIN_THEME_COLORS[skin]?.[theme];
    meta.content = bySkin || THEME_COLORS[theme] || THEME_COLORS.light;
  }
}

function wireCalendar() {
  $('#cal-prev').addEventListener('click', () => { calMonth = shiftMonth(calMonth, -1); renderCalendar(); });
  $('#cal-next').addEventListener('click', () => { calMonth = shiftMonth(calMonth, 1); renderCalendar(); });
  $('#sheet-close').addEventListener('click', () => { $('#day-sheet').hidden = true; });
  $('#day-sheet').addEventListener('click', (e) => {
    if (e.target.id === 'day-sheet') $('#day-sheet').hidden = true;
  });
}

function updateAuthUI(u) {
  const avatarWrap = $('#auth-avatar-wrap');
  const label = $('#auth-login-label');
  const btn = $('#auth-btn');
  avatarWrap.hidden = true;
  if (u) {
    label.textContent = userName(u);
    btn.title = userName(u);
  } else {
    label.textContent = t('auth.login');
    btn.title = t('auth.login');
  }

  const loggedIn = !!u;
  const heroStats = $('.hero-stats');
  if (heroStats) heroStats.hidden = !loggedIn;
  const streakMain = $('.streak-main');
  if (streakMain) streakMain.hidden = !loggedIn;
  const xpRow = $('.xp-row');
  if (xpRow) xpRow.hidden = !loggedIn;
  const levelChip = $('.level-chip');
  if (levelChip) levelChip.hidden = !loggedIn;
  const streakSub = $('.streak-sub');
  if (streakSub) streakSub.hidden = !loggedIn;
  const weekBlock = $('.week-block');
  if (weekBlock) weekBlock.hidden = !loggedIn;
  const logTab = $('[data-tab="log"]');
  if (logTab) logTab.hidden = !loggedIn;
}

function showUsernameSheet(onDone) {
  const sheet = $('#username-sheet');
  const input = $('#username-input');
  const existing = getUsername();
  input.value = existing || '';
  sheet.hidden = false;
  input.focus();

  function submit() {
    const name = input.value.trim();
    if (!name) return;
    setUsername(name);
    sheet.hidden = true;
    updateAuthUI(getUser());
    if (onDone) onDone();
  }

  function close() { sheet.hidden = true; }

  $('#username-ok').onclick = submit;
  $('#username-close').onclick = close;
  input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
}

function wireAuth() {
  const sheet = $('#auth-sheet');
  const buttons = sheet.querySelector('.auth-buttons');
  const userInfo = $('#auth-user-info');

  function renderSheet() {
    const u = getUser();
    const loginNote = $('#auth-login-note');
    const privacyNote = $('#auth-privacy-note');
    if (u) {
      buttons.hidden = true;
      userInfo.hidden = false;
      if (loginNote) loginNote.hidden = true;
      if (privacyNote) privacyNote.hidden = true;
      $('#auth-info-avatar').hidden = true;
      $('#auth-info-name').textContent = userName(u);
    } else {
      buttons.hidden = false;
      userInfo.hidden = true;
      if (loginNote) loginNote.hidden = false;
      if (privacyNote) privacyNote.hidden = false;
    }
  }

  $('#auth-btn').addEventListener('click', () => {
    renderSheet();
    sheet.hidden = false;
  });

  $('#auth-close').addEventListener('click', () => {
    sheet.hidden = true;
  });

  $('#login-x').addEventListener('click', () => loginWithProvider('twitter'));
  $('#login-google').addEventListener('click', () => loginWithProvider('google'));

  $('#auth-change-username').addEventListener('click', () => {
    sheet.hidden = true;
    showUsernameSheet();
  });

  $('#auth-logout').addEventListener('click', async () => {
    await logout();
    renderSheet();
    sheet.hidden = true;
    updateAuthUI(null);
  });

  onAuthChange((u) => {
    updateAuthUI(u);
    if (u && !hasUsername()) {
      sheet.hidden = true;
      showUsernameSheet(() => {
        if (pendingStart) {
          const fn = pendingStart;
          pendingStart = null;
          fn();
        }
      });
      return;
    }
    if (u && pendingStart) {
      sheet.hidden = true;
      const fn = pendingStart;
      pendingStart = null;
      fn();
    }
  });

  initAuth().then((u) => updateAuthUI(u));
}

function init() {
  applyTheme();
  applyI18n();
  paintIcons();
  $('#lang-btn').textContent = getLang() === 'ja' ? 'EN' : 'JA';

  wireNav();
  wireAuth();
  wireReview();
  wireAtelier();
  wireDrawingLightbox();
  wireLesson();
  wireSetup();
  wirePartSheet();
  wireLibrary();
  wireCalendar();
  wireSettings();
  wireAdmin();
  wireRoutes();

  applyRoute(routeFromLocation());

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
