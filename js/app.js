/**
 * app.js — 画面の組み立てと配線。
 */

import {
  buildDaily, partForDate, MODES, PARTS, ACTIVE_PARTS, DRILLS, PICKABLE_DRILLS,
  TIME_CHOICES, COUNT_CHOICES, GESTURE_COUNT_CHOICES, ROUND_COUNT_CHOICES, timeLabel, buildCustomMenu, buildPartMenu, buildCopyMenu, buildGestureMenu, buildCroquisMenu,
  levelLabel, menuDuration,
} from './theory.js';
import {
  getSettings, saveSettings, getHistory, addSession, updateLastSession,
  dateKey, addDays, dailyTotals, drawingsByDay, totalDrawings, roundsToday, stats,
  recentReviewNotes, hydrateUserData, resetUserCaches, syncSessionNow,
} from './storage.js';
import { LESSONS, PD_BOOKS, lessonById } from './anatomy.js';
import { createPhotoQueue } from './images.js';
import { searchPlatesMulti, createPlateQueue } from './commons.js';
import {
  ensureLessonCards, dueCards, weakestLesson,
  reminderFor, injectWeakStep, buildReviewMenu,
} from './review.js';
import { createSessionRunner } from './session.js';
import {
  TAG_GROUPS, ALL_TAGS, everyPhoto, bundledPhotos, photoUrl, setPhotoSrc,
  createLibraryQueue, createWeightedQueue,
  refreshCustomTags, getCustomTags, getHiddenTags, allTagsWithCustom,
} from './library.js';
import {
  getRepoConfig, saveRepoConfig, testRepo,
} from './repo.js';
import {
  loadManifest as sbLoadManifest, pushToSupabase, testConnection as sbTest,
  supabasePhotos, updateTags as sbUpdateTags, bulkUpdateTags, bulkRemoveTags,
  removeFromSupabase, loadCustomTags, saveCustomTags, supabasePhotoUrl,
  saveHiddenTags, invalidateTagConfig, convertToWebp, repairManifestExtensions,
} from './supabase.js';
import { totalXp, levelProgress, graceStreak, bestGraceStreak, takeLevelUp } from './game.js';
import { composeSheet, cropToInkVertical, downloadBlob, downloadEach, saveImageBlob, isAppleTouchDevice, shareToX } from './export.js';
import { translateTitle, termsIn } from './glossary.js';
import { sfx } from './timer.js';
import { $, $$, el, showScreen, toast, confirmDialog, weekReviewDialog, freePeriodDialog, restorePageScroll, setScreenShownHook } from './ui.js';
import { icon, paintIcons } from './icons.js';
import { t, tr, getLang, setLang, applyLang, applyI18n, fmtDur, fmtCount } from './i18n.js';
window.__i18n = { t };
import { initAuth, loginWithProvider, logout, getUser, getUserEmail, onAuthChange, hasUsername, setUsername, getUsername, hydrateUsername } from './auth.js';
import {
  uploadArtwork, uploadShareImage, fetchArtworks, fetchArtwork, fetchPublicArtworks, fetchMyArtworks,
  fetchCopyableArtworksPage, deleteArtwork, updateArtwork, toggleLike, workPageUrl, upsertProfile, artworkDisplayName,
} from './gallery.js';
import { initFeedback } from './feedback.js';
import {
  wireAdminAnalytics, openAdminAnalytics,
} from './admin-analytics.js';
/*
 * index.html の data-build と揃えておく番号。
 *
 * GitHub Pages は HTML を10分キャッシュするので、更新の直後に
 * 「古い index.html ＋ 新しい app.js」の組み合わせが起きる。
 * そうなると、新しい JS が探している要素が HTML に無く、
 * 最初の1つで例外が飛んでホームが真っ白になる。
 * 番号が食い違ったら、キャッシュを外して1回だけ読み直す。
 */
const BUILD = '209';
const SITE_PASS_KEY = 'artclub.sitePass';
const SITE_PASS = 'njsj0203';
/** サイトパスワード解除の有効期限（約1週間） */
const SITE_PASS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function refreshHomeIfVisible() {
  if (document.body.dataset.screen === 'home') renderHome();
}

/** ログイン後のクラウド復元が終わってから画面を描く */
function repaintAfterHydrate() {
  updateAuthUI(getUser());
  refreshHomeIfVisible();
  const screen = document.body.dataset.screen;
  if (screen === 'log') renderLog();
  if (screen === 'settings') renderSettings();
}

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
  updateAuthUI(getUser());
  paintIcons();
  renderHome();
  const screen = document.body.dataset.screen;
  if (screen === 'log') renderLog();
  if (screen === 'settings') renderSettings();
  if (screen === 'library') renderLibrary();
  if (screen === 'work') renderWorkCtr();
}

/* ==================== ホーム ==================== */

function renderHome() {
  const history = getHistory();
  const { streak } = graceStreak(history);
  const xp = levelProgress(totalXp(history));

  const streakEl = $('#streak-count');
  if (streakEl) streakEl.textContent = String(streak);
  const levelEl = $('#level-num');
  if (levelEl) levelEl.textContent = `Lv.${xp.level}`;
  const levelName = $('#level-name');
  if (levelName) levelName.textContent = '';
  const xpFill = $('#xp-fill');
  if (xpFill) xpFill.style.width = `${xp.ratio * 100}%`;

  const s = stats(history);
  const drawingsEl = $('#total-drawings');
  if (drawingsEl) drawingsEl.textContent = String(totalDrawings(history));
  const timeEl = $('#total-time');
  if (timeEl) timeEl.textContent = String(s.minutes);

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
  if (!wrap) return;
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
 */
function renderDaily(history) {
  const loggedIn = !!getUser();
  const rounds = loggedIn ? roundsToday('daily', history) : 0;
  const part = partForDate(dateKey());
  const daily = buildDaily(part);

  const top = $('#menu-primary');
  if (!top) return;
  top.innerHTML = '';

  const pendingDaily = !loggedIn || rounds === 0;
  const hero = el('div', `card primary-card${pendingDaily ? ' daily-pending' : ''}`);

  const headRow = el('div', 'primary-head');
  headRow.append(el('div', 'menu-kicker', t('home.todayLabel')));
  // 周回数はログイン中のクラウド履歴だけ。ログアウトでは出さない
  if (loggedIn && rounds > 0) {
    const done = el('div', 'done-badge');
    done.append(
      el('span', 'done-check', '\u2713'),
      el('span', 'done-text', rounds === 1 ? t('home.roundDone') : t('home.roundN', { n: rounds })),
    );
    headRow.append(done);
  } else if (pendingDaily) {
    const pending = el('div', 'pending-badge');
    pending.append(
      el('span', 'pending-check', '\u2713'),
      el('span', 'pending-text', t('home.todayYet')),
    );
    headRow.append(pending);
  }
  hero.append(headRow);

  hero.append(el('div', 'menu-title big', tr(daily, 'title')));

  const cta = el('button', 'btn primary big', t('home.startPlain'));
  cta.addEventListener('click', () => startDaily(daily, part));
  hero.append(cta);

  top.append(hero);
}

/** モードは3つだけ。 */
function renderModes() {
  const wrap = $('#mode-cards');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const mode of MODES) {
    const card = el('button', 'menu-card');
    card.append(el('div', 'menu-title', tr(mode, 'title')));
    const subtitle = tr(mode, 'subtitle');
    if (subtitle) card.append(el('div', 'menu-sub muted', subtitle));
    if (mode.steps) {
      card.append(el('div', 'menu-time', fmtDur(menuDuration(mode))));
    } else if (mode.unlimited) {
      card.append(el('div', 'menu-time', t('copy.unlimited')));
    }
    if (mode.id !== 'copyMode') {
      card.append(el('span', 'free-badge', t('home.freeNow')));
    }
    card.addEventListener('click', () => {
      if (mode.picker === 'part') return openPartSheet();
      if (mode.picker === 'copy') return openCopySheet();
      if (mode.picker === 'gestureCount') return openGestureSheet();
      if (mode.picker === 'croquisCount') return openCroquisSheet();
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


/* ==================== ジェスチャードローイング ==================== */

let gestureCount = 10;

function openGestureSheet() {
  renderGestureChips();
  $('#gesture-sheet').hidden = false;
}

function renderGestureChips() {
  const wrap = $('#gesture-count-chips');
  wrap.innerHTML = '';
  for (const n of GESTURE_COUNT_CHOICES) {
    const chip = el('button', `chip${gestureCount === n ? ' on' : ''}`,
                    getLang() === 'ja' ? `${n}体` : String(n));
    chip.addEventListener('click', () => { gestureCount = n; renderGestureChips(); });
    wrap.append(chip);
  }
  const note = $('#gesture-note');
  if (note) {
    note.textContent = getLang() === 'ja'
      ? `1体1分 × ${gestureCount}体（合計 ${gestureCount}分）`
      : `1 min each × ${gestureCount} (total ${gestureCount} min)`;
  }
  const start = $('#gesture-start');
  if (start) start.textContent = t('setup.start', { d: fmtDur(60 * gestureCount) });
}

function wireGestureSheet() {
  $('#gesture-close').addEventListener('click', () => { $('#gesture-sheet').hidden = true; });
  $('#gesture-sheet').addEventListener('click', (e) => {
    if (e.target.id === 'gesture-sheet') $('#gesture-sheet').hidden = true;
  });
  $('#gesture-start').addEventListener('click', () => {
    $('#gesture-sheet').hidden = true;
    startSession(buildGestureMenu(gestureCount));
  });
}

/* ==================== クロッキー ==================== */

let croquisCount = 2;

function openCroquisSheet() {
  renderCroquisChips();
  $('#croquis-sheet').hidden = false;
}

function renderCroquisChips() {
  const wrap = $('#croquis-count-chips');
  wrap.innerHTML = '';
  for (const n of ROUND_COUNT_CHOICES) {
    const chip = el('button', `chip${croquisCount === n ? ' on' : ''}`,
                    getLang() === 'ja' ? `${n}枚` : String(n));
    chip.addEventListener('click', () => { croquisCount = n; renderCroquisChips(); });
    wrap.append(chip);
  }
  const note = $('#croquis-note');
  if (note) {
    note.textContent = getLang() === 'ja'
      ? `1枚3分 × ${croquisCount}枚（合計 ${croquisCount * 3}分）`
      : `3 min each × ${croquisCount} (total ${croquisCount * 3} min)`;
  }
  const start = $('#croquis-start');
  if (start) start.textContent = t('setup.start', { d: fmtDur(180 * croquisCount) });
}

function wireCroquisSheet() {
  $('#croquis-close').addEventListener('click', () => { $('#croquis-sheet').hidden = true; });
  $('#croquis-sheet').addEventListener('click', (e) => {
    if (e.target.id === 'croquis-sheet') $('#croquis-sheet').hidden = true;
  });
  $('#croquis-start').addEventListener('click', () => {
    $('#croquis-sheet').hidden = true;
    startSession(buildCroquisMenu(croquisCount));
  });
}

/* ==================== 部位練習 ==================== */

let currentPart = ACTIVE_PARTS[0] || PARTS[0];
let partCount = 1;

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

  const countWrap = $('#part-count-chips');
  if (countWrap) {
    countWrap.innerHTML = '';
    for (const n of ROUND_COUNT_CHOICES) {
      const chip = el('button', `chip${partCount === n ? ' on' : ''}`,
                      getLang() === 'ja' ? `${n}枚` : String(n));
      chip.addEventListener('click', () => { partCount = n; renderPartChips(); });
      countWrap.append(chip);
    }
  }

  const menu = buildPartMenu(currentPart, partCount);
  $('#part-note').textContent = tr(menu, 'subtitle');
  const start = $('#part-start');
  if (start) start.textContent = t('setup.start', { d: fmtDur(120 * partCount) });
}

function wirePartSheet() {
  $('#part-close').addEventListener('click', () => { $('#part-sheet').hidden = true; });
  $('#part-sheet').addEventListener('click', (e) => {
    if (e.target.id === 'part-sheet') $('#part-sheet').hidden = true;
  });
  $('#part-start').addEventListener('click', async () => {
    $('#part-sheet').hidden = true;
    const menu = buildPartMenu(currentPart, partCount);
    await maybeShowFreePeriodNotice(menu);
    await weekReviewDialog(recentReviewNotes(7));
    startSession(menu, { tags: currentPart.tags, part: currentPart, skipFreePeriod: true });
  });
}

/* ==================== 模写モード ==================== */

const COPY_PAGE_SIZE = 24;
const COPY_FETCH_SIZE = 60;

let copyPool = [];
let copyPoolIds = new Set();
let copyRenderedIds = new Set();
let copyApiOffset = 0;
let copyHasMoreApi = true;
let copyLoadingMore = false;
let copySelectedWork = null;
let copyScrollObserver = null;

function resetCopySheetState() {
  copyPool = [];
  copyPoolIds = new Set();
  copyRenderedIds = new Set();
  copyApiOffset = 0;
  copyHasMoreApi = true;
  copyLoadingMore = false;
  copySelectedWork = null;
  if (copyScrollObserver) {
    copyScrollObserver.disconnect();
    copyScrollObserver = null;
  }
}

function sortCopyPool() {
  copyPool.sort((a, b) => {
    const likeDiff = (b.like_count || 0) - (a.like_count || 0);
    if (likeDiff) return likeDiff;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function createArtworkQueue(work) {
  const photo = {
    url: work.image_url,
    photoId: `artwork:${work.id}`,
    credit: {
      kind: getLang() === 'en' ? 'Sketch' : 'スケッチ',
      name: artworkDisplayName(work),
      link: workPageUrl(work),
      photoLink: workPageUrl(work),
      source: 'ARTCLUB',
    },
  };
  return {
    async next() { return photo; },
  };
}

function startCopySession(work) {
  if (!work?.image_url) return;
  const menu = buildCopyMenu(work);
  lastStart = () => startCopySession(work);
  settings = getSettings();
  getRunner().start({
    menu,
    queues: { copy: createArtworkQueue(work) },
    settings,
    focus: { id: null },
    lessonId: null,
    lessonMode: 'copy',
    reminder: null,
    referenceLocked: true,
    referenceArtworkId: work.id || null,
  });
}

async function openCopySheet() {
  resetCopySheetState();
  const startBtn = $('#copy-start');
  if (startBtn) startBtn.disabled = true;
  const status = $('#copy-status');
  const grid = $('#copy-grid');
  if (grid) grid.innerHTML = '';
  if (status) status.textContent = t('gal.loading');
  $('#copy-sheet').hidden = false;
  wireCopyGridInfiniteScroll();

  try {
    await loadMoreCopyWorks({ fillViewport: true });
    if (status) {
      status.textContent = copyRenderedIds.size
        ? t('copy.pickHint')
        : t('copy.empty');
    }
  } catch {
    resetCopySheetState();
    if (grid) grid.innerHTML = '';
    if (status) status.textContent = t('copy.loadFail');
  }
}

function copyGridSentinel() {
  const grid = $('#copy-grid');
  if (!grid) return null;
  let sentinel = $('#copy-grid-sentinel');
  if (!sentinel) {
    sentinel = el('div', 'copy-grid-sentinel');
    sentinel.id = 'copy-grid-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
  }
  grid.append(sentinel);
  return sentinel;
}

function appendCopyGridItems(works) {
  const grid = $('#copy-grid');
  if (!grid || !works.length) return;
  const sentinel = $('#copy-grid-sentinel');
  for (const work of works) {
    if (!work?.id || copyRenderedIds.has(work.id)) continue;
    copyRenderedIds.add(work.id);
    const btn = el('button', `copy-pick${copySelectedWork?.id === work.id ? ' on' : ''}`);
    btn.type = 'button';
    btn.dataset.artworkId = work.id;
    const img = el('img');
    img.src = work.image_url;
    img.alt = work.username || '';
    img.loading = 'lazy';
    const meta = el('div', 'copy-pick-meta');
    const name = artworkDisplayName(work);
    meta.append(el('span', 'copy-pick-user', name));
    meta.append(el('span', 'copy-pick-likes', `♥ ${work.like_count || 0}`));
    btn.append(img, meta);
    btn.addEventListener('click', () => {
      copySelectedWork = work;
      grid.querySelectorAll('.copy-pick.on').forEach((node) => node.classList.remove('on'));
      btn.classList.add('on');
      const startBtn = $('#copy-start');
      if (startBtn) startBtn.disabled = false;
      const status = $('#copy-status');
      if (status) status.textContent = t('copy.selected', { n: name });
    });
    if (sentinel) grid.insertBefore(btn, sentinel);
    else grid.append(btn);
  }
  copyGridSentinel();
}

async function mergeCopyPoolPage() {
  if (!copyHasMoreApi) return false;
  const { works, fetched } = await fetchCopyableArtworksPage({
    limit: COPY_FETCH_SIZE,
    offset: copyApiOffset,
  });
  copyApiOffset += COPY_FETCH_SIZE;
  if (fetched < COPY_FETCH_SIZE) copyHasMoreApi = false;
  let added = 0;
  for (const work of works) {
    if (!work?.id || copyPoolIds.has(work.id)) continue;
    copyPoolIds.add(work.id);
    copyPool.push(work);
    added += 1;
  }
  if (added) sortCopyPool();
  return fetched > 0;
}

/** 未表示分をいいね順で追記。足りなければ API から足す。 */
async function loadMoreCopyWorks({ fillViewport = false } = {}) {
  if (copyLoadingMore) return;
  copyLoadingMore = true;
  const status = $('#copy-status');
  const grid = $('#copy-grid');
  try {
    let guard = 0;
    do {
      guard += 1;
      // 未表示が足りなければ API を足す（フィルタで減るので数回まわる）
      while (
        copyPool.filter((w) => !copyRenderedIds.has(w.id)).length < COPY_PAGE_SIZE
        && copyHasMoreApi
        && guard < 16
      ) {
        const got = await mergeCopyPoolPage();
        guard += 1;
        if (!got) break;
      }

      const pending = copyPool.filter((w) => !copyRenderedIds.has(w.id)).slice(0, COPY_PAGE_SIZE);
      if (!pending.length) break;
      appendCopyGridItems(pending);

      if (!fillViewport || !grid) break;
      // 高さが足りずセンチネルが見えたままだと止めるので、埋まるまで続ける
      if (grid.scrollHeight > grid.clientHeight + 8) break;
      if (!copyHasMoreApi && copyPool.every((w) => copyRenderedIds.has(w.id))) break;
    } while (guard < 16);

    if (status && copyRenderedIds.size && status.textContent === t('gal.loading')) {
      status.textContent = t('copy.pickHint');
    }
  } finally {
    copyLoadingMore = false;
    // 下端が見えたままなら続けて読む（IO が再発火しない対策）
    requestAnimationFrame(() => {
      if ($('#copy-sheet')?.hidden) return;
      if (!copyHasMoreApi && copyPool.every((w) => copyRenderedIds.has(w.id))) return;
      const g = $('#copy-grid');
      const s = $('#copy-grid-sentinel');
      if (!g || !s) return;
      const gr = g.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      if (sr.top <= gr.bottom + 140) void loadMoreCopyWorks();
    });
  }
}

function wireCopyGridInfiniteScroll() {
  const grid = $('#copy-grid');
  if (!grid) return;
  const sentinel = copyGridSentinel();
  if (!sentinel) return;
  if (copyScrollObserver) copyScrollObserver.disconnect();
  copyScrollObserver = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    if ($('#copy-sheet')?.hidden) return;
    if (!copyHasMoreApi && copyPool.every((w) => copyRenderedIds.has(w.id))) return;
    void loadMoreCopyWorks();
  }, { root: grid, rootMargin: '120px', threshold: 0 });
  copyScrollObserver.observe(sentinel);
}

function wireCopySheet() {
  $('#copy-close')?.addEventListener('click', () => { $('#copy-sheet').hidden = true; });
  $('#copy-sheet')?.addEventListener('click', (e) => {
    if (e.target.id === 'copy-sheet') $('#copy-sheet').hidden = true;
  });
  $('#copy-start')?.addEventListener('click', async () => {
    if (!copySelectedWork) return;
    const startBtn = $('#copy-start');
    if (startBtn) startBtn.disabled = true;
    try {
      const fresh = await fetchArtwork(copySelectedWork.short_id || copySelectedWork.id);
      if (!fresh || !fresh.allow_copy || fresh.visibility === 'private') {
        toast(t('copy.unavailable'));
        return;
      }
      $('#copy-sheet').hidden = true;
      startCopySession(fresh);
    } catch {
      toast(t('copy.loadFail'));
    } finally {
      if (startBtn) startBtn.disabled = !copySelectedWork;
    }
  });
}

/**
 * DAILY 開始。
 * 未ログインなら先にログイン →（必要なら無料開放中）→ 振り返りワード → セッション開始。
 */
async function startDaily(daily, part) {
  if (!getUser()) {
    requireLogin(() => startDaily(daily, part));
    return;
  }
  await maybeShowFreePeriodNotice(daily);
  await weekReviewDialog(recentReviewNotes(7));
  startSession(daily, { part, skipFreePeriod: true });
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
  const photos = await everyPhoto();
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

/** 写真1枚。タグは同梱／クラウド側のものを表示するだけ。 */
function openPhoto(photo) {
  $('#photo-big').src = photoUrl(photo);

  const tags = $('#photo-tags');
  tags.innerHTML = '';
  for (const group of TAG_GROUPS) {
    tags.append(el('div', 'label', group.name));
    const row = el('div', 'chips');
    for (const tag of group.tags) {
      const chip = el('button', `chip${photo.tags.includes(tag) ? ' on' : ''}`, tag);
      chip.disabled = true;
      row.append(chip);
    }
    tags.append(row);
  }

  renderPhotoHistory(photo.id);

  const del = $('#photo-delete');
  del.hidden = true;
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
    const artId = shot.artworkId || shot.shortId;
    if (artId) {
      fetchArtwork(artId)
        .then((work) => { if (work?.image_url) img.src = work.image_url; })
        .catch(() => {});
    }
    box.append(img, el('div', 'attempt-meta',
      `${entry.date}・${shot.seconds ? fmtDur(shot.seconds) : '—'}`));
    wrap.append(box);
  });
}

function wireLibrary() {
  const addBtn = $('#lib-add');
  if (addBtn) addBtn.hidden = true;
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

const ADMIN_EMAILS = new Set(['yuisskweb@gmail.com', 'sayu.u.u.u.u@gmail.com']);

function isAdminUser() {
  const email = getUserEmail();
  return !!(email && ADMIN_EMAILS.has(email));
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
  // 端末ローカルお題は廃止。管理は Supabase 側へ。
  $('#admin-untagged').textContent = '';
  fillPhotoGrid($('#admin-grid'), [], openPhoto);
  fillPhotoGrid($('#admin-bundled'), await bundledPhotos(), openPhoto);

  const cfg = getRepoConfig();
  $('#repo-path').value = cfg.owner && cfg.repo ? `${cfg.owner}/${cfg.repo}` : '';
  $('#repo-branch').value = cfg.branch || 'main';
  $('#repo-token').value = cfg.token || '';
  $('#repo-push').textContent = t('admin.push', { n: 0 });

  try {
    const fixed = await repairManifestExtensions();
    if (fixed) toast(`${fixed}件の写真URLをWebPに直しました`);
  } catch { /* */ }

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
  $('#admin-open')?.addEventListener('click', () => { navigateTo('admin'); });

  $('#admin-add').addEventListener('click', () => {
    toast('端末への写真追加はやめました。下の Supabase から上げてください');
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

  $('#repo-push').addEventListener('click', () => {
    $('#repo-status').textContent = '端末ローカル写真は廃止しました。Supabase を使ってください';
  });

  $('#repo-export').addEventListener('click', () => {
    toast('端末ローカル写真は廃止しました');
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

/** デイリー無料枠（2回）を超えたら、模写以外は「無料開放中」案内を出す */
const DAILY_FREE_LIMIT = 2;

function shouldShowFreePeriodNotice(menu) {
  if (!menu || menu.id === 'copyMode') return false;
  return roundsToday('daily') >= DAILY_FREE_LIMIT;
}

async function maybeShowFreePeriodNotice(menu) {
  if (!shouldShowFreePeriodNotice(menu)) return;
  await freePeriodDialog(menu.id === 'daily' ? 'daily' : 'other');
}

async function startSession(menu, { tags = null, part = null, skipFreePeriod = false } = {}) {
  if (!getUser()) {
    requireLogin(() => startSession(menu, { tags, part, skipFreePeriod }));
    return;
  }
  // 他ダイアログより先に出す（呼び出し側で先出し済みなら skip）
  if (!skipFreePeriod) await maybeShowFreePeriodNotice(menu);
  lastStart = () => startSession(menu, { tags, part, skipFreePeriod: true });
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
  const { drawings, ...rest } = result;     // 画像そのものは履歴に入れない（artworks へ）
  return addSession({
    id: `s${Date.now()}`,
    date: dateKey(),
    ts: Date.now(),
    ...rest,
  });
}

let pendingSessionMeta = null;
/** まとめ画の work（short_id / artworkId）。OGP・シェア用 */
let pendingSheetMeta = null;

function sessionModeFrom(entry) {
  if (!entry) return 'Croquis';
  if (entry.menuId === 'daily') return 'Daily';
  if (entry.menuId === 'copyMode') return 'Copy';
  if (entry.menuId?.startsWith('part-')) return 'Part';
  if (entry.menuId === 'gestureMode' || (entry.byDrill?.gesture && !entry.byDrill?.croquis)) {
    return 'Gesture';
  }
  if (entry.menuId === 'croquisMode' || entry.byDrill?.croquis) return 'Croquis';
  return entry.menuTitle || 'Practice';
}

/** 1枚ごとのカテゴリ。Daily 内のジェスチャー／部位／クロッキーを分けて保存する。 */
function shotModeFrom(shot, sessionMode = null) {
  const source = String(shot?.source || '');
  const drill = String(shot?.drillId || '');
  const label = String(shot?.label || '');
  if (source === 'copy' || drill === 'copy') return 'Copy';
  if (source === 'gesture' || drill === 'gesture') return 'Gesture';
  if (source === 'part' || label.includes('部位') || /^Body part/i.test(label)) return 'Part';
  if (source === 'croquis' || drill === 'croquis') return 'Croquis';
  return sessionMode || 'Practice';
}

/** アトリエ表示用。保存済み mode を日本語／英語のカテゴリ名にする。 */
function artworkModeLabel(work) {
  const raw = String(work?.mode || '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase();
  if (key === 'gesture' || key === 'gesturemode' || raw.includes('ジェスチャー') || /gesture/i.test(raw)) {
    return t('atelier.modeGesture');
  }
  if (key === 'part' || key === 'partmode' || key.startsWith('part-') || raw.includes('部位') || /body\s*part/i.test(raw)) {
    return t('atelier.modePart');
  }
  if (key === 'croquis' || key === 'croquismode' || raw.includes('クロッキー') || /croquis/i.test(raw)) {
    return t('atelier.modeCroquis');
  }
  if (key === 'daily' || raw === 'DAILY' || raw.includes('デイリー')) {
    return t('atelier.modeDaily');
  }
  if (key === 'copy' || key === 'copymode' || raw.includes('模写') || /^copy$/i.test(raw)) {
    return t('atelier.modeCopy');
  }
  if (key === 'practice' || raw === '練習') return t('atelier.modeOther');
  return raw;
}

function formatErr(err) {
  const raw = err?.message || String(err || 'unknown');
  return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
}

/** ふりかえりメタを履歴へ。画像本体は端末に残さず、アップロード後の artworkId を付ける。 */
async function persistPendingMeta() {
  return updateLastSession({
    hasDrawing: pendingDrawings.length > 0,
    drawingCount: pendingDrawings.length || null,
    hasSheet: !!sheetBlob || !!pendingSheetMeta?.artworkId,
    shots: pendingDrawings.map((shot, i) => ({
      index: i,
      photoId: shot.photoId || null,
      seconds: shot.seconds || null,
      artworkId: shot.artworkId || null,
      shortId: shot.shortId || null,
    })),
    sheetArtworkId: pendingSheetMeta?.artworkId || null,
    sheetShortId: pendingSheetMeta?.shortId || null,
  });
}

async function syncPendingShotArtwork(shot) {
  if (!shot?.artworkId || !getUser()) return;
  const isPublic = publishEnabled() && !shot.excludeFromGallery;
  await updateArtwork(shot.artworkId, {
    is_public: isPublic,
    visibility: isPublic ? 'public' : 'private',
    allow_copy: isPublic && !!shot.allowCopy,
  });
}

async function syncAllPendingShotArtworks() {
  if (!getUser() || !pendingDrawings.length) return;
  await Promise.all(pendingDrawings.map((shot) => syncPendingShotArtwork(shot).catch((err) => {
    console.error('[artwork sync]', err);
  })));
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
    if (shot.uploaded) {
      if (shot.artworkId) {
        try {
          await syncPendingShotArtwork(shot);
        } catch (err) {
          failed++;
          lastErr = err;
          console.error('[artwork sync]', err);
        }
      }
      continue;
    }
    const promptId = shot.photoId || `session:${sessionId || 'local'}:${i}`;
    try {
      shot.uploading = true;
      const isPublic = globalPublic && !shot.excludeFromGallery;
      const work = await uploadArtwork(shot.blob, promptId, {
        isPublic,
        sessionId,
        mode: shotModeFrom(shot, mode),
        allowCopy: !!shot.allowCopy,
        kind: 'drawing',
      });
      shot.uploaded = true;
      shot.artworkId = work?.id || null;
      shot.shortId = work?.short_id || null;
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

  // まとめ画も work URL を発行（OGP用）。公開設定は一括公開に合わせる
  if (sheetBlob && !pendingSheetMeta?.uploaded) {
    try {
      const sheetWork = await uploadArtwork(sheetBlob, `session:${sessionId || 'local'}:sheet`, {
        isPublic: globalPublic,
        sessionId,
        mode,
        allowCopy: false,
        kind: 'sheet',
      });
      pendingSheetMeta = {
        uploaded: true,
        artworkId: sheetWork?.id || null,
        shortId: sheetWork?.short_id || null,
      };
      uploaded++;
    } catch (err) {
      failed++;
      lastErr = err;
      console.error('[sheet upload]', err);
    }
  }

  if (uploaded) {
    updateLastSession({
      shots: drawings.map((shot, i) => ({
        index: i,
        photoId: shot.photoId || null,
        seconds: shot.seconds || null,
        artworkId: shot.artworkId || null,
        shortId: shot.shortId || null,
      })),
      sheetArtworkId: pendingSheetMeta?.artworkId || null,
      sheetShortId: pendingSheetMeta?.shortId || null,
      hasDrawing: true,
      drawingCount: drawings.length,
      hasSheet: !!(pendingSheetMeta?.artworkId || sheetBlob),
    });
  }
  // アップロード中にトグルを変えた場合に備え、最終状態を再同期
  await syncAllPendingShotArtworks();
  if (!quiet) {
    if (failed) toast(`${t('gal.uploadFail')}\n${formatErr(lastErr)}`, 8000);
    else if (uploaded) toast(t('gal.uploaded'));
  }
  return { uploaded, failed, lastErr };
}

async function finishLeavingReview() {
  persistAllowCopyPreference();
  await syncAllPendingShotArtworks();
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
  pendingSheetMeta = null;
  sheetBlob = null;
}

async function finishSession(result) {
  const entry = saveResult(result);
  if (getUser() && entry) {
    try {
      await syncSessionNow(entry);
    } catch (err) {
      console.error('[session sync]', err);
    }
  }
  if (settings.sfx) sfx.fanfare();

  pendingDrawings = result.drawings || [];
  const copyDefault = defaultAllowCopyOn();
  pendingDrawings.forEach((shot) => {
    if (shot.excludeFromGallery == null) shot.excludeFromGallery = false;
    if (shot.allowCopy == null) shot.allowCopy = copyDefault;
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
    if (bulkCopy) bulkCopy.checked = copyDefault;
    syncBulkToggles();
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

  // ふりかえりに入った時点で履歴メタを書き、ログイン中ならクラウド投稿する
  await persistPendingMeta();
  if (getUser() && pendingDrawings.length) {
    // まとめ画ができてから投稿（まとめ画の work URL / OGP 用）
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

/** 公開スケッチの「模写OK」初期値。prefs の defaultAllowCopy（未設定は true） */
function defaultAllowCopyOn() {
  return getSettings().defaultAllowCopy !== false;
}

/** 公開する人向け：今回の模写OK設定を次回の初期値として保存 */
function persistAllowCopyPreference() {
  if (!getUser() || !pendingDrawings.length || !publishEnabled()) return;
  const publicShots = pendingDrawings.filter((s) => !s.excludeFromGallery);
  if (!publicShots.length) return;
  saveSettings({
    defaultAllowCopy: publicShots.every((s) => !!s.allowCopy),
  });
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
    if (!on) shot.allowCopy = false;
  });
  renderDrawingStrip();
  syncDrawExcludeButton();
  void syncAllPendingShotArtworks();
}

function setAllAllowCopy(on) {
  pendingDrawings.forEach((shot) => {
    shot.allowCopy = !!on;
  });
  renderDrawingStrip();
  persistAllowCopyPreference();
  void syncAllPendingShotArtworks();
}

function setShotExcluded(index, excluded) {
  const shot = pendingDrawings[index];
  if (!shot) return;
  shot.excludeFromGallery = !!excluded;
  if (excluded) shot.allowCopy = false;
  const wrap = $(`#drawing-strip .strip-shot[data-index="${index}"]`);
  if (wrap) {
    wrap.classList.toggle('is-excluded', !!excluded);
    const pub = wrap.querySelector('.strip-control-group--publish input[type="checkbox"]');
    const pubLabel = wrap.querySelector('.strip-control-group--publish .toggle-row');
    if (pub && pubLabel) {
      pub.checked = publishEnabled() && !excluded;
      pubLabel.classList.toggle('is-off', !pub.checked);
    }
    const copy = wrap.querySelector('.strip-control-group--copy input[type="checkbox"]');
    const copyLabel = wrap.querySelector('.strip-control-group--copy .toggle-row');
    if (copy && copyLabel) {
      copy.checked = !!shot.allowCopy;
      copyLabel.classList.toggle('is-off', !copy.checked);
    }
  }
  if (drawingIndex === index) {
    const lbBtn = $('#draw-exclude');
    if (lbBtn && !lbBtn.hidden) lbBtn.textContent = excludeLabel(excluded);
  }
  syncBulkToggles();
  if (excluded) persistAllowCopyPreference();
  void syncPendingShotArtwork(shot);
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

      const pubGroup = el('div', 'strip-control-group strip-control-group--publish');
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
      pubGroup.append(pubLabel);
      controls.append(pubGroup);

      const copyGroup = el('div', 'strip-control-group strip-control-group--copy');
      const copyLabel = el('label', `toggle-row${shot.allowCopy ? '' : ' is-off'}`);
      const copyText = el('span', null, t('gal.allowCopy'));
      const copyInput = el('input');
      copyInput.type = 'checkbox';
      copyInput.checked = !!shot.allowCopy;
      copyInput.addEventListener('change', () => {
        shot.allowCopy = !!copyInput.checked;
        copyLabel.classList.toggle('is-off', !copyInput.checked);
        syncBulkToggles();
        persistAllowCopyPreference();
        void syncPendingShotArtwork(shot);
      });
      const copyTrack = el('span', 'toggle-track');
      copyLabel.append(copyText, copyInput, copyTrack);
      copyGroup.append(copyLabel);
      controls.append(copyGroup);

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
  $('#draw-dl').addEventListener('click', async () => {
    const shot = pendingDrawings[drawingIndex];
    if (!shot) return;
    const btn = $('#draw-dl');
    if (btn) btn.disabled = true;
    try {
      const blob = (await cropToInkVertical(shot.blob)) || shot.blob;
      downloadBlob(blob, `artclub-${dateKey()}-${drawingIndex + 1}.jpg`);
    } catch {
      downloadBlob(shot.blob, `artclub-${dateKey()}-${drawingIndex + 1}.jpg`);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
  $('#draw-share-x').addEventListener('click', async () => {
    const shot = pendingDrawings[drawingIndex];
    if (!shot) return;
    const btn = $('#draw-share-x');
    const text = t('rev.shareText', {
      n: 1,
      d: fmtDur(shot.seconds || getHistory().at(-1)?.seconds || 0),
    });
    if (getUser()) {
      btn.disabled = true;
      try {
        await uploadPendingArtworks({ quiet: true });
        const key = shot.shortId || shot.artworkId;
        if (key) shareToX(`${text}\n${workPageUrl(key)}`);
        else {
          const url = await uploadShareImage(shot.blob);
          shareToX(`${text}\n${url}`);
        }
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
      const sheetKey = pendingSheetMeta?.shortId || pendingSheetMeta?.artworkId;
      const shot = pendingDrawings.find((s) => s.artworkId || s.shortId);
      if (sheetKey) {
        shareToX(`${text}\n${workPageUrl(sheetKey)}`);
      } else if (shot) {
        shareToX(`${text}\n${workPageUrl(shot.shortId || shot.artworkId)}`);
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

/* ==================== みんなのスケッチギャラリー ==================== */

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
  // 同じスケッチが複数 prompt にまたがることは稀だが念のため
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
  thumb.addEventListener('click', () => openWorkPage(work));

  const meta = el('div', 'gallery-item-meta');
  meta.append(el('span', 'gallery-username', artworkDisplayName(work)));

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
let workFetchToken = 0;
let workCanGoBack = false;

function workRouteKey(work) {
  return work?.short_id || work?.id || '';
}

/** スケッチページへ。履歴に残すので左上の←で元の画面に戻れる。 */
function openWorkPage(work) {
  const key = workRouteKey(work);
  if (!key) return;
  openWorkPageById(key);
}

/** ID / short_id だけ分かっているとき（きろくなど） */
function openWorkPageById(id) {
  if (!id) return;
  workCanGoBack = true;
  navigateTo(`work/${id}`);
}

function openAtelierWork(work) {
  openWorkPage(work);
}

function setWorkPageState({ loading = false, missing = false } = {}) {
  const loadingEl = $('#work-loading');
  const missingEl = $('#work-missing');
  const content = $('#work-content');
  if (loadingEl) loadingEl.hidden = !loading;
  if (missingEl) missingEl.hidden = !missing;
  if (content) content.hidden = loading || missing;
}

function updateWorkAuthUI(u = getUser()) {
  const signup = $('#work-signup-btn');
  const login = $('#work-login-btn');
  const label = $('#work-login-label');
  if (!signup || !login || !label) return;
  if (u) {
    signup.hidden = true;
    setAuthAccountButton(login, label, u);
  } else {
    signup.hidden = false;
    setAuthAccountButton(login, label, null);
  }
}

function renderWorkCtr() {
  const list = $('#work-ctr-steps');
  if (!list) return;
  const part = partForDate(dateKey());
  const partLabel = getLang() === 'en' ? part.en : part.label;
  list.innerHTML = '';
  for (const key of ['work.ctrStepGesture', 'work.ctrStepPart', 'work.ctrStepCroquis']) {
    const li = el('li');
    li.textContent = key === 'work.ctrStepPart'
      ? t('work.ctrStepPart', { part: partLabel })
      : t(key);
    list.append(li);
  }
}

function fillWorkPage(work, userId = getUser()?.id) {
  currentArtwork = work;
  setWorkPageState({ loading: false, missing: false });
  const img = $('#work-img');
  if (img) {
    img.src = work.image_url || '';
    img.alt = work.username || '';
  }
  const userEl = $('#work-user');
  if (userEl) userEl.textContent = artworkDisplayName(work);

  const delBtn = $('#work-delete');
  if (delBtn) delBtn.hidden = work.user_id !== userId;

  const dlBtn = $('#work-download');
  if (dlBtn) {
    const mine = work.user_id === userId;
    dlBtn.hidden = !mine;
    if (mine) {
      dlBtn.textContent = isAppleTouchDevice() ? t('gal.savePhoto') : t('common.download');
    }
  }

  const copyBtn = $('#work-copy');
  const canCopy = !!work.allow_copy && work.user_id !== userId;
  if (copyBtn) copyBtn.hidden = !canCopy;

  const likeBtn = $('#work-like');
  const likeCount = $('#work-like-count');
  if (likeBtn) {
    likeBtn.hidden = false;
    likeBtn.classList.toggle('on', !!work.liked_by_me);
  }
  if (likeCount) likeCount.textContent = String(work.like_count || 0);

  const share = $('#work-share');
  if (share) {
    if (work.id || work.short_id) {
      share.hidden = false;
      share.href = workPageUrl(work);
    } else {
      share.hidden = true;
    }
  }
  updateWorkAuthUI();
  renderWorkCtr();
}

async function showWorkRoute(workId) {
  showScreen('work');
  updateWorkAuthUI();
  renderWorkCtr();
  if (!workId) {
    currentArtwork = null;
    setWorkPageState({ missing: true });
    return;
  }
  const token = ++workFetchToken;
  setWorkPageState({ loading: true });
  try {
    const work = await fetchArtwork(workId);
    if (token !== workFetchToken) return;
    if (work) fillWorkPage(work);
    else {
      currentArtwork = null;
      setWorkPageState({ missing: true });
      toast(t('gal.workNotFound'));
    }
  } catch {
    if (token !== workFetchToken) return;
    currentArtwork = null;
    setWorkPageState({ missing: true });
    toast(t('gal.workNotFound'));
  }
}

function goBackFromWork() {
  if (workCanGoBack) {
    workCanGoBack = false;
    history.back();
    return;
  }
  navigateTo('home', { replace: true });
}

function wireGallery() {
  $('#work-back')?.addEventListener('click', goBackFromWork);

  $('#work-like')?.addEventListener('click', async () => {
    if (!currentArtwork) return;
    if (!getUser()) return toast(t('gal.loginToLike'));
    try {
      const nowLiked = await toggleLike(currentArtwork.id, !!currentArtwork.liked_by_me);
      currentArtwork.liked_by_me = nowLiked;
      currentArtwork.like_count = Math.max(
        0,
        (currentArtwork.like_count || 0) + (nowLiked ? 1 : -1),
      );
      $('#work-like')?.classList.toggle('on', nowLiked);
      const countEl = $('#work-like-count');
      if (countEl) countEl.textContent = String(currentArtwork.like_count);
      loadSamePromptGallery();
    } catch {
      toast(t('gal.uploadFail'));
    }
  });

  $('#work-delete')?.addEventListener('click', async () => {
    if (!currentArtwork) return;
    if (!(await confirmDialog(t('gal.deleteConfirm')))) return;
    try {
      await deleteArtwork(currentArtwork.id, currentArtwork.storage_path);
      loadSamePromptGallery();
      goBackFromWork();
      if (document.body.dataset.screen === 'atelier') renderAtelier();
    } catch { toast(t('gal.uploadFail')); }
  });

  $('#work-download')?.addEventListener('click', async () => {
    if (!currentArtwork?.image_url) return;
    const btn = $('#work-download');
    if (btn) btn.disabled = true;
    try {
      const res = await fetch(currentArtwork.image_url);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const blob = await res.blob();
      const base = `artclub-${currentArtwork.short_id || currentArtwork.id || dateKey()}`;
      const ext = (blob.type || '').includes('png') ? 'png'
        : (blob.type || '').includes('webp') ? 'webp'
          : 'jpg';
      const result = await saveImageBlob(blob, `${base}.${ext}`);
      if (result === 'downloaded') toast(t('gal.downloaded'));
      else if (result === 'shared' && isAppleTouchDevice()) toast(t('gal.savedPhotoHint'));
    } catch {
      toast(t('gal.downloadFail'));
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  $('#work-copy')?.addEventListener('click', () => {
    if (!currentArtwork) return;
    startCopySession(currentArtwork);
  });

  const openAuth = () => openAuthSheet();
  $('#work-signup-btn')?.addEventListener('click', openAuth);
  $('#work-login-btn')?.addEventListener('click', openAuth);
  $('#work-account-btn')?.addEventListener('click', openAuth);

  $('#work-ctr-start')?.addEventListener('click', () => startDailyFromCtr());
}

function startDailyFromCtr() {
  const part = partForDate(dateKey());
  const daily = buildDaily(part);
  startDaily(daily, part);
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
  void renderNotes();
}

let calMonth = null;   // 'YYYY-MM'

/** 履歴エントリの表紙用アートワーク ID（1枚目）。 */
function coverArtworkId(entry) {
  if (!entry) return null;
  const shot = (entry.shots || []).find((s) => s.artworkId || s.shortId);
  return shot?.artworkId || shot?.shortId || null;
}

/** セッション定義から、その回の croquis 枚の shot インデックスを出す。 */
function menuStepsForEntry(entry) {
  if (!entry?.menuId) return null;
  if (entry.menuId === 'croquisMode') {
    const n = Math.max(1, (entry.shots || []).length || Math.round((entry.seconds || 360) / 180));
    return buildCroquisMenu(n).steps;
  }
  if (entry.menuId === 'gestureMode') {
    // 体数は可変。履歴の枚数から復元（1体1分）
    const n = Math.max(1, (entry.shots || []).length || Math.round((entry.seconds || 600) / 60));
    return buildGestureMenu(n).steps;
  }
  if (entry.menuId === 'daily') return buildDaily(partForDate(entry.date)).steps;
  if (entry.menuId.startsWith('part-')) {
    const part = PARTS.find((p) => entry.menuId === `part-${p.id}`);
    if (!part) return null;
    const n = Math.max(1, (entry.shots || []).length || Math.round((entry.seconds || 120) / 120));
    return buildPartMenu(part, n).steps;
  }
  return null;
}

function croquisShotIndices(steps) {
  const indices = [];
  let i = 0;
  for (const step of steps || []) {
    for (let c = 0; c < (step.count || 0); c++) {
      // DAILY 3枚目など drill=croquis でも source=part は部位練習
      if (step.drill === 'croquis' && step.source !== 'part') indices.push(i);
      i++;
    }
  }
  return indices;
}

/** その回の croquis 分だけ artwork ID を返す（ジェスチャー等は除く）。 */
function croquisArtworkIdsFromEntry(entry) {
  const shots = entry?.shots || [];
  const steps = menuStepsForEntry(entry);
  if (steps) {
    return croquisShotIndices(steps)
      .map((idx) => shots[idx]?.artworkId || shots[idx]?.shortId)
      .filter(Boolean);
  }
  if (entry.menuId === 'croquisMode') {
    return shots.map((s) => s.artworkId || s.shortId).filter(Boolean);
  }
  if (entry.byDrill?.croquis && !entry.byDrill?.gesture) {
    return shots.map((s) => s.artworkId || s.shortId).filter(Boolean);
  }
  return [];
}

/** 手動未指定の日: その日の croquis スケッチから表紙を選ぶ。 */
function calendarCoverId(dayKey, history = getHistory()) {
  const dayEntries = history
    .filter((h) => h.date === dayKey)
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  for (const entry of dayEntries) {
    const ids = croquisArtworkIdsFromEntry(entry);
    if (ids.length) return ids[0];
  }
  return null;
}

async function loadArtworkUrl(id) {
  if (!id) return null;
  try {
    const work = await fetchArtwork(id);
    return work?.image_url || null;
  } catch {
    return null;
  }
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

    const coverId = calendarCoverId(dayKey, history);
    if (coverId || entry?.hasDrawing) {
      cell.classList.add('has-drawing');
      if (coverId) {
        const img = el('img');
        loadArtworkUrl(coverId).then((url) => { if (url) img.src = url; }).catch(() => {});
        cell.prepend(img);
      }
    }

    cell.title = seconds ? `${dayKey}：${fmtDur(seconds)}` : dayKey;
    cell.addEventListener('click', () => openDaySheet(dayKey, history));
    grid.append(cell);
  }
}

/** その日に描いたものを全部ならべる。押すと作品ページへ。 */
async function openDaySheet(dayKey, history = getHistory()) {
  const entries = history.filter((h) => h.date === dayKey);
  $('#sheet-date').textContent = dayKey;

  const seconds = entries.reduce((sum, e) => sum + (e.seconds || 0), 0);
  $('#sheet-title').textContent = seconds ? t('log.drew', { d: fmtDur(seconds) }) : t('log.restDay');

  const shots = $('#sheet-shots');
  shots.innerHTML = '';
  const items = [];
  const seen = new Set();
  for (const entry of entries) {
    for (const shot of entry.shots || []) {
      const id = shot.artworkId || shot.shortId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const url = await loadArtworkUrl(id);
      if (url) items.push({ url, id });
    }
    const sheetId = entry.sheetArtworkId || entry.sheetShortId;
    if (sheetId && !seen.has(sheetId)) {
      seen.add(sheetId);
      const url = await loadArtworkUrl(sheetId);
      if (url) items.push({ url, id: sheetId });
    }
  }
  shots.hidden = items.length === 0;
  items.forEach((item) => {
    const btn = el('button', 'strip-item');
    const img = el('img');
    img.src = item.url;
    btn.append(img);
    btn.addEventListener('click', () => {
      $('#day-sheet').hidden = true;
      openWorkPageById(item.id);
    });
    shots.append(btn);
  });

  const body = $('#sheet-body');
  body.innerHTML = '';
  for (const entry of entries) {
    const block = el('div', 'note-item');
    const head = el('div', 'note-head');
    const title = entry.menuTitle || sessionLabel(entry) || '—';
    const time = formatSessionTime(entry);
    head.append(el('span', 'note-date', time ? `${title} · ${time}` : title));
    if (entry.lessonId && !entry.menuTitle) {
      const lessonName = tr(lessonById(entry.lessonId), 'name');
      if (lessonName) head.append(el('span', 'rate-tag', lessonName));
    }
    block.append(head);
    const drills = Object.entries(entry.byDrill || {})
      .map(([id, sec]) => `${tr(DRILLS[id], 'name') || id} ${fmtDur(sec)}`).join(' / ');
    if (drills) block.append(el('p', 'muted small', drills));
    if (entry.note) block.append(el('p', 'note-body', entry.note));

    const sheetId = entry.sheetArtworkId || entry.sheetShortId;
    if (sheetId) {
      const sheetUrl = await loadArtworkUrl(sheetId);
      if (sheetUrl) {
        const wrap = el('div', 'day-sheet-summary');
        const img = el('img', 'day-sheet-summary-img');
        img.src = sheetUrl;
        img.alt = '';
        const dl = el('button', 'btn primary small');
        dl.type = 'button';
        dl.textContent = t('common.download');
        dl.addEventListener('click', () => {
          fetch(sheetUrl).then((r) => r.blob()).then((blob) => {
            downloadBlob(blob, `artclub-${dayKey}-${entry.id}.webp`);
          }).catch(() => {});
        });
        wrap.append(img, dl);
        block.append(wrap);
      }
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

/** きろく用。ローカル時刻の HH:MM */
function formatSessionTime(entry) {
  if (!entry?.ts) return '';
  const d = new Date(entry.ts);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function historyRecordShowable(entry) {
  if (!entry) return false;
  if (entry.note?.trim()) return true;
  if (entry.hasSheet || entry.sheetArtworkId || entry.sheetShortId) return true;
  if (entry.hasDrawing || entry.drawingCount) return true;
  return (entry.shots || []).some((s) => s.artworkId || s.shortId);
}

/** きろく用。まとめ画像 ID を優先、なければ1枚目。 */
function historyCoverArtworkId(entry) {
  if (!entry) return null;
  const sheetId = entry.sheetArtworkId || entry.sheetShortId;
  if (sheetId) return sheetId;
  return coverArtworkId(entry);
}

async function renderHistoryRecordPost(entry) {
  const post = el('article', 'tl-post');
  const main = el('div', 'tl-main');

  const meta = el('header', 'tl-meta');
  const title = entry.menuTitle || sessionLabel(entry) || '—';
  meta.append(el('span', 'tl-name', title));
  meta.append(el('span', 'tl-dot', '·'));
  meta.append(el('time', 'tl-time', formatTlDate(entry)));
  const time = formatSessionTime(entry);
  if (time) {
    meta.append(el('span', 'tl-dot', '·'));
    meta.append(el('span', 'tl-time', time));
  }
  if (entry.seconds) {
    meta.append(el('span', 'tl-menu', fmtDur(entry.seconds)));
  }
  main.append(meta);

  const note = entry.note?.trim();
  if (note) main.append(el('p', 'tl-body', note));

  const imageId = historyCoverArtworkId(entry);
  if (imageId) {
    const url = await loadArtworkUrl(imageId);
    if (url) {
      const media = el('button', 'tl-media');
      media.type = 'button';
      const img = el('img');
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      media.append(img);
      media.addEventListener('click', () => openWorkPageById(imageId));
      main.append(media);
    }
  }

  post.append(main);
  return post;
}

async function renderNotes() {
  const wrap = $('#note-list');
  wrap.innerHTML = '';

  const history = getHistory()
    .filter(historyRecordShowable)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));

  if (!history.length) {
    wrap.append(el('p', 'muted small tl-empty', t('log.noNotes')));
    if (!getUser()) {
      const hint = el('p', 'muted small', t('log.loginNotes'));
      hint.style.marginTop = '6px';
      wrap.append(hint);
      const btn = el('button', 'btn primary small', t('auth.login'));
      btn.type = 'button';
      btn.style.marginTop = '10px';
      btn.addEventListener('click', () => openAuthSheet());
      wrap.append(btn);
    }
    return;
  }

  for (const entry of history.slice(0, 50)) {
    wrap.append(await renderHistoryRecordPost(entry));
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
  $('#opt-theme').value = settings.theme || 'light';
  const skin = settings.skin === 'pastel-rpg' ? 'pastel-rpg' : 'default';
  $('#opt-skin').value = skin;
  $('#opt-sound').checked = settings.sound;
  $('#opt-sfx').checked = settings.sfx;
  $('#opt-autoflip').checked = settings.autoFlip;
  $('#opt-keepawake').checked = settings.keepAwake;
  $('#opt-orientation').value = settings.orientation;
  $('#opt-alpha').value = String(Math.round((settings.penAlpha ?? 0.9) * 100));
  renderLangChips();
  applyTheme();
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
    if (name.includes('@')) {
      toast(t('auth.usernameNoEmail'));
      return;
    }
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

/** アトリエTL用。投稿の日付 + ローカル時刻 HH:MM（自分・他人とも同じ） */
function formatArtworkTime(work) {
  if (!work?.created_at) return '';
  const d = new Date(work.created_at);
  if (Number.isNaN(d.getTime())) return '';
  const date = `${d.getMonth() + 1}/${d.getDate()}`;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${date} · ${hh}:${mm}`;
}

/** 非公開の目印。文字を置くと名前や日付とぶつかるので、鍵マークだけにする。 */
function privateBadge() {
  const badge = el('span', 'atelier-badge private');
  badge.innerHTML = icon('lock', 12);
  badge.title = t('atelier.privateBadge');
  badge.setAttribute('role', 'img');   // 中の svg は aria-hidden なので、名前はこちらで持つ
  badge.setAttribute('aria-label', t('atelier.privateBadge'));
  return badge;
}

function renderArtworkTlPost(work, { mine = false } = {}) {
  const post = el('article', 'tl-post');
  post.dataset.artworkId = work.id || '';
  const name = artworkDisplayName(work);
  const main = el('div', 'tl-main');

  const meta = el('header', 'tl-meta');
  meta.append(el('span', 'tl-name', name));
  meta.append(el('span', 'tl-dot', '·'));
  const posted = el('time', 'tl-time', formatArtworkTime(work));
  if (work.created_at) posted.setAttribute('datetime', work.created_at);
  meta.append(posted);
  if (work.mode) {
    const modeLabel = artworkModeLabel(work);
    if (modeLabel) meta.append(el('span', 'atelier-badge mode', modeLabel));
  }
  if (mine && work.visibility === 'private') {
    meta.append(privateBadge());
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

  const meId = getUser()?.id;
  const canCopy = !mine && !!work.allow_copy && !!work.image_url && work.user_id !== meId;
  if (canCopy) {
    const copyBtn = el('button', 'tl-copy', t('atelier.copyStart'));
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', () => startCopySession(work));
    actions.append(copyBtn);
  }
  main.append(actions);

  post.append(main);
  return post;
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
    const btn = el('button', 'btn primary small', t('auth.login'));
    btn.type = 'button';
    btn.style.marginTop = '10px';
    btn.addEventListener('click', () => openAuthSheet());
    feed.append(btn);
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
    fetchPublicArtworks({ limit: 120 }).catch(() => []),
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

  // いいねが多いお題を上に
  promptIds.sort((a, b) => {
    const score = (id) => byPrompt.get(id).reduce((s, w) => s + (w.like_count || 0), 0);
    return score(b) - score(a);
  });

  const appendPromptCard = (promptId) => {
    const topWorks = [...byPrompt.get(promptId)]
      .sort((a, b) => {
        const likeDiff = (b.like_count || 0) - (a.like_count || 0);
        if (likeDiff) return likeDiff;
        return new Date(b.created_at) - new Date(a.created_at);
      })
      .slice(0, 10); // 2行 × 横5枚

    const card = el('section', 'atelier-prompt-card');
    const block = el('div', 'atelier-prompt-block');

    const photo = photos.get(promptId);
    if (photo) {
      const img = el('img', 'atelier-prompt-photo');
      img.alt = '';
      setPhotoSrc(img, photo);
      block.append(img);
    } else {
      block.append(el('div', 'atelier-prompt-photo is-empty', '—'));
    }

    for (const work of topWorks) {
      const btn = el('button', `atelier-thumb${work.user_id === getUser()?.id ? ' is-mine' : ''}`);
      btn.type = 'button';
      const frame = el('div', 'atelier-thumb-frame');
      const img = el('img');
      img.src = work.image_url;
      img.alt = work.username || '';
      img.loading = 'lazy';
      frame.append(img);
      if (work.like_count > 0) {
        frame.append(el('span', 'atelier-thumb-likes', `♥ ${work.like_count}`));
      }
      btn.append(frame);
      btn.addEventListener('click', () => openAtelierWork(work));
      block.append(btn);
    }

    card.append(block);
    list.append(card);
  };

  for (const promptId of promptIds) appendPromptCard(promptId);
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

/* ==================== URL ルーティング（パスで分ける） ==================== */

function appBasePath() {
  return location.pathname.indexOf('/artclub') === 0 ? '/artclub' : '';
}

function parseRoute(rawInput = '') {
  const raw = String(rawInput || '').replace(/^#/, '').replace(/^\/+|\/+$/g, '').trim();
  if (!raw || raw === 'home') return { root: 'home', parts: ['home'] };
  const parts = raw.split('/').map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  }).filter(Boolean);
  return { root: parts[0] || 'home', parts };
}

function pathForRoute(route) {
  const clean = String(route || 'home').replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  const base = appBasePath();
  if (!clean || clean === 'home') return base ? `${base}/` : '/';
  return `${base}/${clean}`;
}

function currentRouteKey() {
  const route = routeFromLocation();
  if (!route?.root || route.root === 'home') return 'home';
  return route.parts.join('/');
}

function routeFromLocation() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const segs = path.split('/').filter(Boolean);
  const idx = segs[0] === 'artclub' ? 1 : 0;
  const root = segs[idx];

  // 別HTML・Worker のパスは SPA では扱わない
  if (root === 'privacy' || root === 'terms') {
    return { root: 'home', parts: ['home'] };
  }

  if (root === 'atelier') {
    const sub = segs[idx + 1];
    return { root: 'atelier', parts: sub ? ['atelier', sub] : ['atelier'] };
  }
  if (root === 'work' && segs[idx + 1]) {
    return { root: 'work', parts: ['work', segs[idx + 1]] };
  }
  if (['home', 'log', 'settings', 'admin', 'library', 'auth', 'daily'].includes(root)) {
    return { root, parts: segs.slice(idx) };
  }
  if (!root) return { root: 'home', parts: ['home'] };

  // 旧 #hash 互換
  return parseRoute(location.hash);
}

/** 古い #atelier などのリンクを /atelier に寄せる。OAuth のトークン hash は触らない。 */
function migrateHashRouteToPath() {
  const hash = location.hash || '';
  if (!hash || hash.includes('access_token') || hash.includes('error=')) return;
  const raw = hash.replace(/^#/, '').trim();
  if (!raw) return;
  const path = pathForRoute(raw);
  history.replaceState(null, '', path);
}

function navigateTo(route, { replace = false } = {}) {
  const next = String(route || 'home').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'home';
  const url = pathForRoute(next);
  const sameRoute = currentRouteKey() === next && !location.hash;
  if (sameRoute) {
    // 振り返りなど URL を変えず showScreen だけした画面から戻るときも反映する
    applyRoute(routeFromLocation());
    return;
  }
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  applyRoute(routeFromLocation());
}

function applyRoute(route = routeFromLocation()) {
  const root = route.root || 'home';
  const sub = route.parts[1];

  if (root === 'admin') {
    if (sub === 'analytics') {
      showScreen('admin-analytics');
      openAdminAnalytics();
      return;
    }
    openAdmin();
    return;
  }
  if (root === 'work') {
    showWorkRoute(route.parts[1]);
    return;
  }
  if (root === 'auth') {
    showScreen('home');
    openAuthSheet();
    return;
  }
  if (root === 'daily') {
    showScreen('home');
    startDailyFromCtr();
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
    if (!getUser()) {
      openAuthSheet();
      navigateTo('home', { replace: true });
      return;
    }
    renderSettings();
    showScreen('settings');
    return;
  }
  if (root === 'library') {
    openLibrary();
    return;
  }

  showScreen('home');
}

function wireRoutes() {
  window.addEventListener('popstate', () => applyRoute(routeFromLocation()));
  window.addEventListener('hashchange', () => {
    if ((location.hash || '').includes('access_token')) return;
    const raw = (location.hash || '').replace(/^#/, '').trim();
    if (raw) navigateTo(raw, { replace: true });
  });
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
  const skin = settings.skin || 'default';
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

function authAccountLabel(u) {
  if (!u) return t('auth.login');
  return getUsername() || t('auth.account');
}

function setAuthAccountButton(btn, labelEl, u) {
  if (!btn || !labelEl) return;
  btn.hidden = false;
  labelEl.textContent = authAccountLabel(u);
  btn.title = authAccountLabel(u);
}

function updateAuthUI(u) {
  const label = $('#auth-login-label');
  const btn = $('#auth-btn');
  const signup = $('#auth-signup-btn');
  const settingsBtn = $('#header-settings-btn');
  const atelierSignup = $('#atelier-signup-btn');
  const atelierLogin = $('#atelier-login-btn');
  const atelierLabel = $('#atelier-login-label');
  const atelierSettings = $('#atelier-settings-btn');
  const logSettings = $('#log-settings-btn');

  if (u) {
    setAuthAccountButton(btn, label, u);
    if (signup) signup.hidden = true;
    if (settingsBtn) settingsBtn.hidden = false;
    if (atelierSignup) atelierSignup.hidden = true;
    setAuthAccountButton(atelierLogin, atelierLabel, u);
    if (atelierSettings) atelierSettings.hidden = false;
    if (logSettings) logSettings.hidden = false;
  } else {
    setAuthAccountButton(btn, label, null);
    if (signup) signup.hidden = false;
    if (settingsBtn) settingsBtn.hidden = true;
    if (atelierSignup) atelierSignup.hidden = false;
    setAuthAccountButton(atelierLogin, atelierLabel, null);
    if (atelierSettings) atelierSettings.hidden = true;
    if (logSettings) logSettings.hidden = true;
  }
  updateWorkAuthUI(u);

  const loggedIn = !!u;
  const heroCard = $('.streak-card.hero');
  if (heroCard) heroCard.hidden = !loggedIn;
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
    if (name.includes('@')) {
      toast(t('auth.usernameNoEmail') === 'auth.usernameNoEmail'
        ? 'メールアドレスは使えません'
        : t('auth.usernameNoEmail'));
      return;
    }
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
      $('#auth-info-name').textContent = authAccountLabel(u);
    } else {
      buttons.hidden = false;
      userInfo.hidden = true;
      if (loginNote) loginNote.hidden = false;
      if (privacyNote) privacyNote.hidden = false;
    }
  }

  window.__openAuthSheet = () => {
    renderSheet();
    sheet.hidden = false;
  };

  $('#auth-btn').addEventListener('click', () => {
    renderSheet();
    sheet.hidden = false;
  });
  $('#auth-signup-btn')?.addEventListener('click', () => {
    renderSheet();
    sheet.hidden = false;
  });
  $('#atelier-login-btn')?.addEventListener('click', () => {
    renderSheet();
    sheet.hidden = false;
  });
  $('#atelier-signup-btn')?.addEventListener('click', () => {
    renderSheet();
    sheet.hidden = false;
  });

  $('#auth-close').addEventListener('click', () => {
    sheet.hidden = true;
    restorePageScroll();
  });

  // X / Twitter (OAuth 2.0)。Dashboard の「X / Twitter (OAuth 2.0)」に対応する provider 名は `x`。
  // 旧 `twitter`（OAuth 1.0a）は別プロバイダで、未有効だと provider is not enabled になる。
  $('#login-x').addEventListener('click', () => loginWithProvider('x'));
  $('#login-google').addEventListener('click', () => loginWithProvider('google'));

  $('#auth-change-username').addEventListener('click', () => {
    sheet.hidden = true;
    showUsernameSheet();
  });

  $('#auth-logout').addEventListener('click', async () => {
    await logout();
    resetUserCaches();
    settings = getSettings();
    applyTheme();
    renderSheet();
    sheet.hidden = true;
    restorePageScroll();
    updateAuthUI(null);
  });

  let authHandledUserId = null;
  let bootstrapping = true;

  onAuthChange((u) => {
    if (bootstrapping) return;
    updateAuthUI(u);
    const uid = u?.id ?? null;
    if (!u) {
      authHandledUserId = null;
      resetUserCaches();
      settings = getSettings();
      applyTheme();
      applyRoute(routeFromLocation());
      return;
    }
    if (uid === authHandledUserId) {
      repaintAfterHydrate();
      return;
    }
    authHandledUserId = uid;
    // 端末に名前が無くても、DB にあれば復元してからユーザーネーム入力を出すか決める
    Promise.all([hydrateUsername(), hydrateUserData()])
      .then(([name, data]) => {
        if (data?.lang) {
          applyLang(data.lang);
          applyI18n();
          $('#lang-btn').textContent = getLang() === 'ja' ? 'EN' : 'JA';
        }
        settings = getSettings();
        applyTheme();
        updateAuthUI(getUser());
        if (!name && !hasUsername()) {
          sheet.hidden = true;
          restorePageScroll();
          showUsernameSheet(() => {
            applyRoute(routeFromLocation());
            repaintAfterHydrate();
            if (pendingStart) {
              const fn = pendingStart;
              pendingStart = null;
              fn();
            }
          });
          return;
        }
        sheet.hidden = true;
        restorePageScroll();
        applyRoute(routeFromLocation());
        repaintAfterHydrate();
        if (pendingStart) {
          const fn = pendingStart;
          pendingStart = null;
          fn();
        }
      })
      .catch((err) => {
        console.error('[auth hydrate]', err);
        repaintAfterHydrate();
      });
  });

  window.__finishAuthBootstrap = () => { bootstrapping = false; };
  window.__setAuthHandledUserId = (id) => { authHandledUserId = id; };
}

function openAuthSheet() {
  if (typeof window.__openAuthSheet === 'function') window.__openAuthSheet();
  else $('#auth-sheet').hidden = false;
}

/** 起動時: 認証 → クラウド復元 → 初回描画（空の 0 表示を防ぐ） */
async function bootstrapApp() {
  try {
    const u = await initAuth();
    if (u) {
      window.__setAuthHandledUserId?.(u.id);
      const [name, data] = await Promise.all([hydrateUsername(), hydrateUserData()]);
      if (data?.lang) {
        applyLang(data.lang);
        applyI18n();
        $('#lang-btn').textContent = getLang() === 'ja' ? 'EN' : 'JA';
      }
      settings = getSettings();
      applyTheme();
      updateAuthUI(u);
      if (!name && !hasUsername()) {
        showUsernameSheet(() => {
          applyRoute(routeFromLocation());
          repaintAfterHydrate();
        });
        return;
      }
    } else {
      await hydrateUserData();
      settings = getSettings();
      applyTheme();
      updateAuthUI(u);
    }
  } catch (err) {
    console.error('[bootstrap]', err);
  } finally {
    window.__finishAuthBootstrap?.();
    applyRoute(routeFromLocation());
    repaintAfterHydrate();
  }
}

function isSiteUnlocked() {
  try {
    const until = Number(localStorage.getItem(SITE_PASS_KEY) || 0);
    if (!until) return false;
    if (Date.now() > until) {
      localStorage.removeItem(SITE_PASS_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function markSiteUnlocked() {
  try {
    localStorage.setItem(SITE_PASS_KEY, String(Date.now() + SITE_PASS_TTL_MS));
  } catch { /* */ }
  document.documentElement.dataset.siteUnlocked = '1';
  const gate = $('#site-gate');
  if (gate) gate.hidden = true;
}

function siteGateCopy(key, fallback) {
  const text = t(key);
  return text === key ? fallback : text;
}

function wireSiteGate(onUnlock) {
  const gate = $('#site-gate');
  const input = $('#site-pass');
  const btn = $('#site-pass-btn');
  const msg = $('#site-pass-msg');
  const note = $('#site-gate-note');
  if (!gate) {
    onUnlock();
    return;
  }

  // localStorage では解除済みでも、HTML属性が無いとゲートが残ったまま
  // ハンドラ未設定で「入力しても入れない」状態になる
  if (isSiteUnlocked()) {
    markSiteUnlocked();
    onUnlock();
    return;
  }

  gate.hidden = false;
  if (note) note.textContent = siteGateCopy('siteGate.note', 'テスト公開中です。パスワードを入力してください。');
  if (input) input.placeholder = siteGateCopy('siteGate.ph', 'パスワード');
  if (btn) btn.textContent = siteGateCopy('siteGate.enter', '入室');

  function showGateError(text) {
    if (!msg) return;
    msg.textContent = text;
    msg.classList.add('is-error');
    gate.classList.remove('is-shake');
    // reflow してアニメ再発火
    void gate.offsetWidth;
    gate.classList.add('is-shake');
  }

  function tryUnlock(e) {
    e?.preventDefault?.();
    if (!input) return;
    const value = String(input.value || '').trim();
    if (!value) {
      showGateError(siteGateCopy('siteGate.needPass', 'パスワードを入力してください'));
      input.focus();
      return;
    }
    if (value !== SITE_PASS) {
      showGateError(siteGateCopy('siteGate.wrong', 'パスワードが違います'));
      input.select();
      input.focus();
      return;
    }
    if (msg) {
      msg.textContent = '';
      msg.classList.remove('is-error');
    }
    markSiteUnlocked();
    onUnlock();
    restorePageScroll();
  }

  // 閉じられない：背景クリック・Esc では閉じない
  gate.addEventListener('click', (e) => {
    if (e.target === gate) e.stopPropagation();
  });
  gate.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') e.preventDefault();
  });
  btn?.addEventListener('click', tryUnlock);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryUnlock(e);
  });
  // 入力し直したらエラー表示を消す
  input?.addEventListener('input', () => {
    if (!msg) return;
    msg.textContent = '';
    msg.classList.remove('is-error');
  });
  input?.focus();
}

function startApp() {
  migrateHashRouteToPath();
  bootstrapApp();
  restorePageScroll();
}

function init() {
  applyTheme();
  // GitHub Pages の 404 経由で来たパスを復元
  try {
    const saved = sessionStorage.getItem('artclub.spaPath');
    if (saved) {
      sessionStorage.removeItem('artclub.spaPath');
      history.replaceState(null, '', saved);
    }
  } catch { /* */ }

  applyI18n();
  paintIcons();
  $('#lang-btn').textContent = getLang() === 'ja' ? 'EN' : 'JA';

  wireNav();
  wireAuth();
  initFeedback();
  wireReview();
  wireAtelier();
  wireDrawingLightbox();
  wireLesson();
  wireSetup();
  wirePartSheet();
  wireGestureSheet();
  wireCroquisSheet();
  wireCopySheet();
  wireLibrary();
  wireCalendar();
  wireSettings();
  wireAdmin();
  wireAdminAnalytics({ onNavigate: navigateTo });
  wireRoutes();

  setScreenShownHook((name) => {
    if (name === 'home') renderHome();
  });

  wireSiteGate(startApp);

  window.addEventListener('pageshow', (e) => {
    if (e.persisted && getUser()) {
      Promise.all([hydrateUsername(), hydrateUserData()])
        .then(() => repaintAfterHydrate())
        .catch((err) => console.error('[pageshow hydrate]', err));
    }
    restorePageScroll();
  });
  window.addEventListener('focus', restorePageScroll);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) restorePageScroll();
  });

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
