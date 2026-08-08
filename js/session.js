/**
 * session.js — 練習セッションの進行役。
 *
 * メニュー（ドリルの並び）を受け取り、
 *   ドリル説明 → 画像 N 枚をタイマーで回す → 次のドリル → … → 終了
 * を回して、結果（ドリル別の秒数）を返す。
 */

import { DRILLS } from './theory.js';
import { createTimer, sfx } from './timer.js';
import { $, showScreen, toast, fmtClock } from './ui.js';

export function createSessionRunner({ onFinish, onQuit }) {
  const dom = {
    img: $('#ref-image'),
    stageInner: $('#stage-inner'),
    grid: $('#grid-overlay'),
    cover: $('#memory-cover'),
    peekBtn: $('#peek-btn'),
    peekLeft: $('#peek-left'),
    drillName: $('#drill-name'),
    drillProgress: $('#drill-progress'),
    drillCue: $('#drill-cue'),
    timebar: $('#timebar-fill'),
    timeLeft: $('#time-left'),
    pauseBtn: $('#pause-btn'),
    attrBox: $('#attr-box'),
    stageMessage: $('#stage-message'),
    bridgeLabel: $('#bridge-label'),
    bridgeTitle: $('#bridge-title'),
    bridgeTheory: $('#bridge-theory'),
    bridgeCue: $('#bridge-cue'),
    bridgeMeta: $('#bridge-meta'),
    bridgeReminder: $('#bridge-reminder'),
  };

  const beeper = sfx;
  let state = null;
  let wakeLock = null;
  let lastBeepAt = -1;

  const timer = createTimer({
    onTick(remaining, progress) {
      dom.timebar.style.transform = `scaleX(${progress})`;
      dom.timeLeft.textContent = fmtClock(remaining);
      const whole = Math.ceil(remaining);
      if (state?.settings.sound && whole <= 3 && whole > 0 && whole !== lastBeepAt) {
        lastBeepAt = whole;
        beeper.tick();
      }
      maybeHideForMemory(remaining);
    },
    onDone() {
      if (state?.settings.sound) beeper.done();
      advance();
    },
  });

  /* ---------- 表示の加工（ドリルごとに「見え方」を変える） ---------- */

  function applyView(drill, { flipped }) {
    const v = drill.view || {};
    const filters = [];
    if (v.posterize === 3) filters.push('url(#f-posterize3)');
    if (v.posterize === 2) filters.push('url(#f-posterize2)');
    if (v.invert) filters.push('invert(1)');
    if (v.blur) filters.push(`blur(${v.blur}px)`);
    if (v.contrast) filters.push(`contrast(${v.contrast})`);
    dom.img.style.filter = filters.join(' ') || 'none';

    const transforms = [];
    if (v.rotate) transforms.push(`rotate(${v.rotate}deg)`);
    if (flipped) transforms.push('scaleX(-1)');
    dom.img.style.transform = transforms.join(' ') || 'none';

    dom.grid.hidden = !state.gridForced && !v.grid;
    dom.cover.hidden = true;
    dom.cover.classList.remove('peeking');
  }

  function maybeHideForMemory(remaining) {
    const v = DRILLS[state?.current?.drillId]?.view;
    if (!v?.hideAfter || state.peeking) return;
    const elapsed = state.itemSeconds - remaining;
    const shouldHide = elapsed >= v.hideAfter;
    if (shouldHide === !dom.cover.hidden) return;
    dom.cover.hidden = !shouldHide;
  }

  /* ---------- 進行 ---------- */

  function buildQueue(menu) {
    const queue = [];
    menu.steps.forEach((step, stepIndex) => {
      for (let i = 0; i < step.count; i++) {
        queue.push({
          drillId: step.drill,
          seconds: step.seconds,
          source: step.source || 'photo',   // 'photo' = 写真 / 'plate' = 解剖図版
          stepIndex,
          indexInStep: i + 1,
          countInStep: step.count,
        });
      }
    });
    return queue;
  }

  /** その項目がどのキューから絵を取るか。図版が無ければ写真で代用する。 */
  function queueFor(item) {
    return state.queues[item.source] || state.queues.photo;
  }

  /** 次の項目の絵を先に読み込んでおく。取得元ごとに分けて持つ。 */
  function prefetch(item) {
    if (!item) return;
    if (state.pending[item.source]) return;
    state.pending[item.source] = queueFor(item).next().catch(() => null);
  }

  async function takePhoto(item) {
    const waiting = state.pending[item.source];
    state.pending[item.source] = null;
    const photo = await (waiting || queueFor(item).next().catch(() => null));
    // 図版が取れなかったときは写真にフォールバック（練習を止めない）
    if (!photo && item.source === 'plate') {
      return state.queues.photo.next().catch(() => null);
    }
    return photo;
  }

  async function showBridge(item, isFirst) {
    const drill = DRILLS[item.drillId];
    timer.stop();
    dom.bridgeLabel.textContent = isFirst ? 'はじめのドリル' : '次のドリル';
    dom.bridgeTitle.textContent = drill.name;
    dom.bridgeTheory.textContent = drill.theory;
    dom.bridgeCue.textContent = drill.cue;
    dom.bridgeMeta.textContent =
      `${item.countInStep}枚 × ${fmtClock(item.seconds)}${item.seconds >= 60 ? '' : '秒'}`;

    // 復習対象のドリルのときだけ「前回の宿題」を1行出す
    const reminder = item.source.startsWith('weak:') ? state.reminder : null;
    dom.bridgeReminder.hidden = !reminder;
    dom.bridgeReminder.textContent = reminder || '';

    showScreen('bridge');
    state.awaitingBridge = true;
    prefetch(item);   // 説明を読んでいる間に読み込んでおく
  }

  async function runItem(item) {
    state.current = item;
    state.itemSeconds = item.seconds;
    state.peeksLeft = DRILLS[item.drillId].view?.peeks ?? 0;
    state.peeking = false;
    lastBeepAt = -1;
    dom.peekLeft.textContent = String(state.peeksLeft);
    dom.peekBtn.hidden = state.peeksLeft === 0;

    const drill = DRILLS[item.drillId];
    dom.drillName.textContent = drill.name;
    dom.drillProgress.textContent = `${item.indexInStep} / ${item.countInStep}`;
    dom.drillCue.textContent = drill.cue;
    dom.attrBox.hidden = true;

    showScreen('session');
    dom.stageMessage.hidden = false;
    dom.stageMessage.textContent = item.source === 'plate' ? '図版を読み込み中…' : '写真を読み込み中…';

    const photo = await takePhoto(item);
    prefetch(state.plan[state.cursor + 1]);

    if (!photo) {
      dom.stageMessage.textContent = '絵を取得できませんでした。設定の取得元を確認してください。';
      return;
    }

    dom.stageMessage.hidden = true;
    dom.img.src = photo.url;
    renderAttribution(photo);

    const flipped = state.flipForced || (state.settings.autoFlip && Math.random() < 0.5);
    applyView(drill, { flipped });

    timer.start(item.seconds);
    dom.pauseBtn.textContent = '⏸';
  }

  function renderAttribution(photo) {
    const { name, link, source, photoLink, kind = '写真' } = photo.credit;
    dom.attrBox.innerHTML = link
      ? `<a href="${photoLink || link}" target="_blank" rel="noopener">${kind}</a> by ` +
        `<a href="${link}" target="_blank" rel="noopener">${escapeHtml(name)}</a> on ${escapeHtml(source)}`
      : `${escapeHtml(name)}（${escapeHtml(source)}）`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function record(item, seconds) {
    state.byDrill[item.drillId] = (state.byDrill[item.drillId] || 0) + seconds;
    state.totalSeconds += seconds;
  }

  async function advance(skipped = false) {
    const done = state.current;
    if (done) {
      const spent = skipped ? Math.max(0, done.seconds - timer.remaining) : done.seconds;
      record(done, Math.round(spent));
    }
    state.cursor++;
    const item = state.plan[state.cursor];
    if (!item) return finish();
    const isNewStep = !done || item.stepIndex !== done.stepIndex;
    if (isNewStep) return showBridge(item, !done);
    return runItem(item);
  }

  function finish() {
    timer.stop();
    releaseWakeLock();
    onFinish({
      menuId: state.menu.id,
      menuTitle: state.menu.title,
      seconds: state.totalSeconds,
      byDrill: state.byDrill,
      focusId: state.focus.id,
      lessonId: state.lessonId,
      lessonMode: state.lessonMode,
    });
  }

  function quit() {
    timer.stop();
    releaseWakeLock();
    // 途中でやめても、そこまでの分は記録する（1分でも「やった」に入れる）
    if (state?.current) record(state.current, Math.round(state.current.seconds - timer.remaining));
    const partial = state && state.totalSeconds > 20
      ? { menuId: state.menu.id, menuTitle: state.menu.title, seconds: state.totalSeconds,
          byDrill: state.byDrill, focusId: state.focus.id, lessonId: state.lessonId,
          lessonMode: state.lessonMode, partial: true }
      : null;
    state = null;
    onQuit(partial);
  }

  /* ---------- 画面を消させない ---------- */

  async function requestWakeLock() {
    if (!state.settings.keepAwake || !('wakeLock' in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* 未対応なら諦める */ }
  }

  function releaseWakeLock() {
    wakeLock?.release?.().catch(() => {});
    wakeLock = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && timer.running) {
      timer.pause();
      dom.pauseBtn.textContent = '▶';
    }
  });

  /* ---------- 操作 ---------- */

  function togglePause() {
    timer.toggle();
    dom.pauseBtn.textContent = timer.running ? '⏸' : '▶';
  }

  function toggleGrid() {
    state.gridForced = !state.gridForced;
    dom.grid.hidden = !state.gridForced && !DRILLS[state.current.drillId].view?.grid;
  }

  function toggleFlip() {
    state.flipForced = !state.flipForced;
    applyView(DRILLS[state.current.drillId], { flipped: state.flipForced });
  }

  function peek() {
    if (!state.peeksLeft) return;
    const item = state.current;
    state.peeksLeft--;
    state.peeking = true;
    dom.peekLeft.textContent = String(state.peeksLeft);
    dom.cover.hidden = true;
    timer.extend(3);   // 見ていた分は時間を足す
    setTimeout(() => {
      if (!state || state.current !== item) return;   // 先に進んでいたら何もしない
      state.peeking = false;
      dom.cover.hidden = false;
      dom.peekBtn.hidden = state.peeksLeft === 0;
    }, 3000);
  }

  $('#pause-btn').addEventListener('click', togglePause);
  $('#time-left').addEventListener('click', togglePause);
  $('#skip-btn').addEventListener('click', () => advance(true));
  $('#tool-grid').addEventListener('click', toggleGrid);
  $('#tool-flip').addEventListener('click', toggleFlip);
  $('#quit-btn').addEventListener('click', quit);
  $('#peek-btn').addEventListener('click', peek);
  $('#attr-btn').addEventListener('click', () => { dom.attrBox.hidden = !dom.attrBox.hidden; });

  $('#bridge-start').addEventListener('click', () => {
    if (!state?.awaitingBridge) return;
    state.awaitingBridge = false;
    requestWakeLock();
    runItem(state.plan[state.cursor]);
  });

  $('#bridge-skip').addEventListener('click', () => {
    if (!state?.awaitingBridge) return;
    const stepIndex = state.plan[state.cursor].stepIndex;
    while (state.plan[state.cursor] && state.plan[state.cursor].stepIndex === stepIndex) state.cursor++;
    const next = state.plan[state.cursor];
    state.awaitingBridge = false;
    if (!next) return finish();
    showBridge(next, false);
  });

  document.addEventListener('keydown', (e) => {
    if (!state) return;
    const inSession = document.getElementById('screen-session').classList.contains('is-active');
    const inBridge = document.getElementById('screen-bridge').classList.contains('is-active');
    if (inBridge && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      $('#bridge-start').click();
      return;
    }
    if (!inSession) return;
    if (e.code === 'Space') { e.preventDefault(); togglePause(); }
    else if (e.code === 'ArrowRight') advance(true);
    else if (e.key === 'g') toggleGrid();
    else if (e.key === 'f') toggleFlip();
    else if (e.code === 'Escape') quit();
  });

  return {
    async start({ menu, queues, settings, focus, lessonId = null, lessonMode = 'weak', reminder = null }) {
      state = {
        menu,
        plan: buildQueue(menu),
        queues,
        settings,
        focus,
        lessonId,
        lessonMode,
        reminder,
        cursor: -1,
        byDrill: {},
        totalSeconds: 0,
        gridForced: false,
        flipForced: false,
        pending: {},
        awaitingBridge: false,
      };
      Object.values(queues).forEach((q) => q.prime?.());
      if (settings.source === 'unsplash' && !settings.unsplashKey) {
        toast('Unsplash のキーが未設定です。設定から入れてください');
      }
      advance();
    },
    get active() { return state !== null; },
  };
}
