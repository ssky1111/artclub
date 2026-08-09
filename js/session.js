/**
 * session.js — 練習セッションの進行役。
 *
 * メニュー（ドリルの並び）を受け取り、
 *   ドリル説明 → 画像 N 枚をタイマーで回す → 次のドリル → … → 終了
 * を回して、結果（ドリル別の秒数）を返す。
 */

import { DRILLS } from './theory.js';
import { createTimer, sfx } from './timer.js';
import { createPad } from './draw.js';
import { $, $$, showScreen, toast, fmtClock } from './ui.js';
import { paintIcons } from './icons.js';
import { t, tr, fmtDur, getLang } from './i18n.js';
import { saveSettings } from './storage.js';

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
    bridgeCue: $('#bridge-cue'),
    bridgeTheory: $('#bridge-theory'),
    bridgeMeta: $('#bridge-meta'),
    bridgeReminder: $('#bridge-reminder'),
    stage: document.querySelector('.stage'),
    padWrap: $('#pad-wrap'),
    refMini: $('#ref-mini'),
    refMiniImg: $('#ref-mini-img'),
    padDrill: $('#pad-drill'),
    padProgress: $('#pad-progress'),
    padTime: $('#pad-time'),
    padTimeNum: $('.pad-time-num'),
    padTimebar: $('#pad-timebar-fill'),
    padSteps: $('#pad-steps'),
    padRef: document.querySelector('.pad-ref'),
    padRefImg: $('#pad-ref-img'),
    padHint: $('#pad-hint'),
    padOpacity: $('#pad-opacity'),
  };

  const pad = createPad($('#pad'));

  const beeper = sfx;
  let state = null;
  let wakeLock = null;
  let lastBeepAt = -1;

  const timer = createTimer({
    onTick(remaining, progress) {
      dom.timebar.style.transform = `scaleX(${progress})`;
      dom.timeLeft.textContent = fmtClock(remaining);
      dom.padTimeNum.textContent = fmtClock(remaining);
      dom.padTimebar.style.transform = `scaleX(${1 - progress})`;
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
          source: step.source || 'photo',   // 'photo' = 写真 / 'plate' = 図版 / 'part' = その日の部位
          // 同じドリルでも、その回が何のためのものかは名前を変えて示す（部位練習など）
          label: step.label || null,
          labelEn: step.labelEn || null,
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

  /** その回の見出し。部位練習のように、ドリル名だけでは足りないときに step.label が勝つ。 */
  function stepTitle(item, drill) {
    if (!item.label) return tr(drill, 'name');
    return getLang() === 'en' ? (item.labelEn || item.label) : item.label;
  }

  async function showBridge(item, isFirst) {
    const drill = DRILLS[item.drillId];
    timer.stop();
    dom.bridgeLabel.textContent = t('sess.next');
    dom.bridgeTitle.textContent = stepTitle(item, drill);
    dom.bridgeTheory.textContent = tr(drill, 'theory');
    const cue = tr(drill, 'cue');
    dom.bridgeCue.hidden = !cue;
    dom.bridgeCue.textContent = cue || '';
    dom.bridgeMeta.textContent =
      t('sess.sheetsBy', { n: item.countInStep, t: fmtDur(item.seconds) });

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
    dom.drillName.textContent = stepTitle(item, drill);
    dom.drillProgress.textContent = `${item.indexInStep} / ${item.countInStep}`;
    dom.drillCue.textContent = tr(drill, 'cue');
    dom.attrBox.hidden = true;

    showScreen('session');
    setPad(true);              // 紙に描く人は上の道具から閉じられる
    dom.stageMessage.hidden = false;
    dom.stageMessage.textContent =
      item.source === 'plate' ? t('sess.loadingPlate') : t('sess.loading');

    const photo = await takePhoto(item);
    prefetch(state.plan[state.cursor + 1]);

    if (!photo) {
      dom.stageMessage.textContent = t('sess.loadFail');
      return;
    }

    dom.stageMessage.hidden = true;
    dom.img.src = photo.url;
    dom.refMiniImg.src = photo.url;
    dom.padRefImg.src = photo.url;      // 広い画面では左半分にそのまま出す
    dom.padDrill.textContent = stepTitle(item, drill);
    dom.padProgress.textContent = `${item.indexInStep} / ${item.countInStep}`;
    dom.padSteps.innerHTML = (tr(drill, 'steps') || [])
      .map((line) => `<li>${escapeHtml(line)}</li>`).join('');
    state.currentPhotoId = photo.photoId || null;
    renderAttribution(photo);

    const flipped = state.flipForced || (state.settings.autoFlip && Math.random() < 0.5);
    applyView(drill, { flipped });

    timer.start(item.seconds);
    setPauseIcon();
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

  /**
   * いま描いてあるものを1枚として確定し、キャンバスを空にする。
   * 次の写真に変わっても前の線が残っていると、どこから描き始めるのか分からなくなるため。
   */
  async function harvestDrawing() {
    if (!pad.hasContent) return;
    const blob = await pad.toBlob().catch(() => null);
    if (blob) state.drawings.push({ blob, photoId: state.currentPhotoId, seconds: state.itemSeconds });
    pad.clear();
    if (state.settings.sfx) sfx.check();
    toast(t('sess.saved', { n: state.drawings.length }), 1400);
  }

  function record(item, seconds) {
    state.byDrill[item.drillId] = (state.byDrill[item.drillId] || 0) + seconds;
    state.totalSeconds += seconds;
  }

  async function advance(skipped = false) {
    await harvestDrawing();          // 次の絵に移る前に、描いたものを1枚として確定する
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

  async function finish() {
    timer.stop();
    releaseWakeLock();
    await harvestDrawing();
    closePad();
    onFinish({
      drawings: state.drawings,
      menuId: state.menu.id,
      menuTitle: state.menu.title,
      seconds: state.totalSeconds,
      byDrill: state.byDrill,
      focusId: state.focus.id,
      lessonId: state.lessonId,
      lessonMode: state.lessonMode,
    });
  }

  async function quit() {
    timer.stop();
    releaseWakeLock();
    await harvestDrawing();
    closePad();
    // 途中でやめても、そこまでの分は記録する（1分でも「やった」に入れる）
    if (state?.current) record(state.current, Math.round(state.current.seconds - timer.remaining));
    const partial = state && state.totalSeconds > 20
      ? { menuId: state.menu.id, menuTitle: state.menu.title, seconds: state.totalSeconds,
          byDrill: state.byDrill, focusId: state.focus.id, lessonId: state.lessonId,
          lessonMode: state.lessonMode, drawings: state.drawings, partial: true }
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
      setPauseIcon();
    }
  });

  /* ---------- 操作 ---------- */

  function togglePause() {
    timer.toggle();
    setPauseIcon();
  }

  function setPauseIcon() {
    dom.pauseBtn.dataset.icon = timer.running ? 'pause' : 'play';
    dom.padTime.classList.toggle('paused', !timer.running);
    paintIcons(dom.pauseBtn.parentNode);
  }

  /**
   * 画面内に描くモード。
   * 以前は「写真だけ出て、透明のボタンを押すとペンが出る」形にしていたが、
   * 押すものが見えないので誰も気づかなかった。最初から開いた状態で始める。
   */
  function setPad(open) {
    dom.padWrap.hidden = !open;
    dom.stage.classList.toggle('with-pad', open);
    $('#tool-pad').classList.toggle('on', open);
    if (open) requestAnimationFrame(() => pad.resize());
    else dom.refMini.classList.remove('big');
  }

  function togglePad() { setPad(dom.padWrap.hidden); }

  function closePad() {
    dom.padWrap.hidden = true;
    dom.stage.classList.remove('with-pad');
    $('#tool-pad').classList.remove('on');
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
  $('#tool-pad').addEventListener('click', togglePad);
  $('#tool-grid').addEventListener('click', toggleGrid);
  $('#tool-flip').addEventListener('click', toggleFlip);
  $('#quit-btn').addEventListener('click', quit);
  $('#peek-btn').addEventListener('click', peek);

  $('.pad-tools').addEventListener('click', (e) => {
    const tool = e.target.closest('[data-pad]')?.dataset.pad;
    const size = e.target.closest('[data-size]')?.dataset.size;
    if (size) {
      pad.setSize(Number(size));
      pad.setEraser(false);
      $$('.pad-size').forEach((b) => b.classList.toggle('on', b.dataset.size === size));
      $$('.pad-btn[data-pad="pen"], .pad-btn[data-pad="eraser"]')
        .forEach((b) => b.classList.toggle('on', b.dataset.pad === 'pen'));
      return;
    }
    if (!tool) return;
    if (tool === 'undo') return void pad.undo();
    if (tool === 'clear') return void pad.clear();
    pad.setEraser(tool === 'eraser');
    $$('.pad-btn[data-pad="pen"], .pad-btn[data-pad="eraser"]')
      .forEach((b) => b.classList.toggle('on', b.dataset.pad === tool));
  });

  /*
   * 線の濃さ。あたりを薄く取ってから本線を乗せたい人向け。
   * 道具をいじる時間は描く時間から引かれるので、スライダー1本だけにしてある。
   */
  dom.padOpacity.addEventListener('input', (e) => {
    const alpha = Number(e.target.value) / 100;
    pad.setAlpha(alpha);
    dom.padOpacity.style.setProperty('--a', String(alpha));
    if (state) state.settings = saveSettings({ penAlpha: alpha });
  });

  // 手順は写真の上に乗るので、邪魔になったら畳めるようにする
  $('#hint-toggle').addEventListener('click', () => {
    const open = dom.padHint.classList.toggle('open');
    if (state) state.settings = saveSettings({ hintOpen: open });
  });

  window.addEventListener('resize', () => { if (!dom.padWrap.hidden) pad.resize(); });

  $('#pad-next').addEventListener('click', () => advance(true));
  $('#pad-quit').addEventListener('click', quit);
  $('#pad-time').addEventListener('click', togglePause);
  dom.refMini.addEventListener('click', () => dom.refMini.classList.toggle('big'));
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
    else if (e.key === 'd') togglePad();
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); pad.undo(); }
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
        drawings: [],
        totalSeconds: 0,
        gridForced: false,
        flipForced: false,
        pending: {},
        awaitingBridge: false,
      };
      pad.clear();
      pad.setAlpha(settings.penAlpha ?? 1);
      dom.padOpacity.value = String(Math.round((settings.penAlpha ?? 1) * 100));
      dom.padOpacity.style.setProperty('--a', String(settings.penAlpha ?? 1));
      dom.padHint.classList.toggle('open', settings.hintOpen !== false);
      Object.values(queues).forEach((q) => q.prime?.());
      if (settings.source === 'unsplash' && !settings.unsplashKey) {
        toast('Unsplash のキーが未設定です。設定から入れてください');
      }
      advance();
    },
    get active() { return state !== null; },
  };
}
