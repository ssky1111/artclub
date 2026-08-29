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
import { $, $$, showScreen, toast, fmtClock, confirmDialog, hintList } from './ui.js';
import { t, tr, fmtDur, getLang } from './i18n.js';
import { saveSettings, getSettings } from './storage.js';
import { paintIcons } from './icons.js';

export function createSessionRunner({ onFinish, onQuit }) {
  const dom = {
    grid: $('#grid-overlay'),
    cover: $('#memory-cover'),
    peekBtn: $('#peek-btn'),
    peekLeft: $('#peek-left'),
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
    padOpacityNum: $('#pad-opacity-num'),
    padRefSwap: $('#pad-ref-swap'),
    refMiniSwap: $('#ref-mini-swap'),
    bridgeDesc: $('#bridge-desc'),
    padLockMsg: $('#pad-lock-msg'),
    padGuide: $('#pad-guide'),
    memoryStartDraw: $('#memory-start-draw'),
  };

  const pad = createPad($('#pad'));
  // HTML で選ばれている太さ（既定＝真ん中）に合わせる
  const initialSize = $('.pad-size.on')?.dataset.size;
  if (initialSize) pad.setSize(Number(initialSize));

  const beeper = sfx;
  let state = null;
  let wakeLock = null;
  let lastBeepAt = -1;

  const timer = createTimer({
    onTick(value, progress, meta = {}) {
      const isUnlimited = !!(meta.unlimited || state?.current?.unlimited);
      if (isUnlimited) {
        dom.padTimebar.style.transform = 'scaleX(0)';
        dom.padTimeNum.textContent = fmtClock(value);
        setTimeUnit(true);
        return;
      }
      setTimeUnit(false);
      dom.padTimeNum.textContent = fmtClock(value);
      dom.padTimebar.style.transform = `scaleX(${1 - progress})`;
      const whole = Math.ceil(value);
      if (state?.settings.sound && whole <= 3 && whole > 0 && whole !== lastBeepAt) {
        lastBeepAt = whole;
        beeper.tick();
      }
      maybeHideForMemory(value);
    },
    onDone() {
      if (state?.settings.sound) beeper.done();
      // 記憶クロッキー: 見る → 描く → 見比べ → 次へ
      if (state?.memoryPhase === 'look') {
        enterMemoryDrawPhase();
        return;
      }
      if (state?.memoryPhase === 'draw') {
        enterMemoryComparePhase();
        return;
      }
      advance();
    },
  });

  function setTimeUnit(elapsedMode) {
    const unit = dom.padTime?.querySelector('.pad-time-unit');
    if (unit) unit.textContent = elapsedMode ? t('sess.elapsed') : t('sess.left');
  }

  /* ---------- 表示の加工（ドリルごとに「見え方」を変える） ---------- */

  function applyView(drill, { flipped }) {
    const v = drill.view || {};
    const filters = [];
    if (v.posterize === 3) filters.push('url(#f-posterize3)');
    if (v.posterize === 2) filters.push('url(#f-posterize2)');
    if (v.invert) filters.push('invert(1)');
    if (v.blur) filters.push(`blur(${v.blur}px)`);
    if (v.contrast) filters.push(`contrast(${v.contrast})`);
    const filter = filters.join(' ') || 'none';

    const transforms = [];
    if (v.rotate) transforms.push(`rotate(${v.rotate}deg)`);
    if (flipped) transforms.push('scaleX(-1)');
    const transform = transforms.join(' ') || 'none';

    for (const img of [dom.padRefImg, dom.refMiniImg]) {
      if (!img) continue;
      img.style.filter = filter;
      img.style.transform = transform;
    }

    if (dom.grid) dom.grid.hidden = !state.gridForced && !v.grid;
    if (dom.cover) {
      dom.cover.hidden = true;
      dom.cover.classList.remove('peeking');
    }
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
          seconds: step.unlimited ? 0 : step.seconds,
          unlimited: !!step.unlimited,
          // source 未指定ならドリル名に合わせる（ジェスチャー→ジェスチャータグ用キュー）
          source: step.source
            || (step.drill === 'gesture' ? 'gesture'
              : step.drill === 'croquis' ? 'croquis'
              : step.drill === 'composePose' ? 'composePose'
              : step.drill === 'memoryCroquis' ? 'memoryCroquis'
              : step.drill === 'copy' ? 'copy'
              : 'photo'),
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
    if (!isFirst) timer.stop();
    if (isFirst) requestWakeLock();
    dom.bridgeLabel.hidden = true;
    dom.bridgeTitle.textContent = stepTitle(item, drill);
    dom.bridgeTheory.textContent = tr(drill, 'theory');


    const isGesture = item.drillId === 'gesture';
    const isComposePose = item.drillId === 'composePose';
    const isMemoryCroquis = item.drillId === 'memoryCroquis';
    const showHints = isGesture || isComposePose || isMemoryCroquis;
    dom.bridgeDesc.hidden = !showHints;
    if (showHints) {
      const hints = tr(drill, 'hints');
      // 構図・記憶は一文のリード文なので箇条書きにしない
      if (isComposePose || isMemoryCroquis) {
        const p = document.createElement('p');
        p.className = 'bridge-lead';
        p.textContent = Array.isArray(hints) ? (hints[0] || '') : String(hints || '');
        dom.bridgeDesc.replaceChildren(p);
      } else {
        dom.bridgeDesc.replaceChildren(hintList(hints, 'bridge-hints'));
      }
    }
    const memLook = drill.view?.memorizeSeconds;
    const memDraw = drill.view?.drawSeconds;
    const memCompare = drill.view?.compareSeconds;
    dom.bridgeMeta.textContent = item.unlimited
      ? (getLang() === 'en' ? `${item.countInStep} · no time limit` : `${item.countInStep}枚 · 時間無制限`)
      : isMemoryCroquis && memLook && memDraw
        ? (getLang() === 'en'
          ? `look ${memLook / 60} min → draw ${memDraw / 60} min → compare ${memCompare || 15}s`
          : `見る${memLook / 60}分 → 描く${memDraw / 60}分 → 見比べ${memCompare || 15}秒`)
        : `${item.countInStep}枚×${item.seconds < 60 ? item.seconds + '秒' : (item.seconds / 60) + '分'}`;

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
    if (dom.peekLeft) dom.peekLeft.textContent = String(state.peeksLeft);
    if (dom.peekBtn) dom.peekBtn.hidden = state.peeksLeft === 0;

    const drill = DRILLS[item.drillId];
    dom.attrBox.hidden = true;

    showScreen('session');
    ensurePad();
    applyRefCornerMode();
    updateSaveNextLabel();
    dom.stageMessage.hidden = false;
    dom.stageMessage.textContent =
      item.source === 'plate' ? t('sess.loadingPlate') : t('sess.loading');

    const photo = await takePhoto(item);
    prefetch(state.plan[state.cursor + 1]);

    if (!photo) {
      state.currentPhotoId = null;
      state.referenceArtworkId = null;
      dom.stageMessage.textContent = t('sess.loadFail');
      return;
    }

    dom.stageMessage.hidden = true;
    setRefSrc(photo);
    dom.padDrill.textContent = stepTitle(item, drill);
    dom.padProgress.textContent = `${item.indexInStep} / ${item.countInStep}`;
    dom.padSteps.innerHTML = (tr(drill, 'steps') || [])
      .map((line) => `<li>${escapeHtml(line)}</li>`).join('');
    state.currentPhotoId = photo.photoId || null;
    renderAttribution(photo);

    const flipped = state.flipForced || (state.settings.autoFlip && Math.random() < 0.5);
    applyView(drill, { flipped });

    setReferenceLocked(!!state.referenceLocked);
    clearMemoryUi();

    if (item.drillId === 'memoryCroquis') {
      beginMemoryLookPhase(drill);
      return;
    }

    if (item.unlimited) {
      setTimeUnit(true);
      timer.start(0, { unlimited: true });
    } else {
      setTimeUnit(false);
      timer.start(item.seconds);
    }
    setPauseIcon();
  }

  function clearMemoryUi() {
    if (state) state.memoryPhase = null;
    if (dom.padWrap) {
      dom.padWrap.classList.remove('is-memory-look', 'is-memory-draw', 'is-memory-compare');
    }
    if (dom.padLockMsg) {
      dom.padLockMsg.hidden = true;
      const p = dom.padLockMsg.querySelector('p');
      if (p) p.textContent = t('sess.memoryLook');
    }
    if (dom.padGuide) {
      dom.padGuide.hidden = true;
      dom.padGuide.textContent = t('sess.memoryDrawGuide');
    }
    if (dom.memoryStartDraw) dom.memoryStartDraw.hidden = true;
    if (dom.cover) {
      dom.cover.hidden = true;
      dom.cover.classList.remove('peeking');
    }
    const canvas = $('#pad');
    if (canvas) canvas.style.pointerEvents = '';
    requestAnimationFrame(() => pad.resize());
  }

  /** 記憶クロッキー: 見るフェーズ（描けない） */
  function beginMemoryLookPhase(drill) {
    const look = Number(drill.view?.memorizeSeconds) || 60;
    state.memoryPhase = 'look';
    state.peeksLeft = 0;
    pad.clear();
    pad.resetHistory();
    if (dom.peekBtn) dom.peekBtn.hidden = true;
    if (dom.padWrap) {
      dom.padWrap.classList.add('is-memory-look');
      dom.padWrap.classList.remove('is-memory-draw', 'is-memory-compare');
    }
    if (dom.padLockMsg) dom.padLockMsg.hidden = true;
    if (dom.padGuide) {
      dom.padGuide.hidden = false;
      dom.padGuide.textContent = t('sess.memoryLook');
    }
    if (dom.memoryStartDraw) dom.memoryStartDraw.hidden = false;
    setReferenceLocked(true);
    setTimeUnit(false);
    lastBeepAt = -1;
    timer.start(look);
    setPauseIcon();
    requestAnimationFrame(() => pad.resize());
  }

  /** 記憶クロッキー: 描くフェーズ（写真を隠す） */
  function enterMemoryDrawPhase() {
    if (!state?.current) return;
    const drill = DRILLS[state.current.drillId] || {};
    const draw = Number(drill.view?.drawSeconds) || 120;
    state.memoryPhase = 'draw';
    state.peeksLeft = drill.view?.peeks ?? 0;
    state.peeking = false;
    if (dom.peekLeft) dom.peekLeft.textContent = String(state.peeksLeft);
    if (dom.peekBtn) dom.peekBtn.hidden = state.peeksLeft === 0;

    if (dom.padWrap) {
      dom.padWrap.classList.remove('is-memory-look');
      dom.padWrap.classList.add('is-memory-draw');
    }
    if (dom.padLockMsg) dom.padLockMsg.hidden = true;
    if (dom.padGuide) {
      dom.padGuide.hidden = false;
      dom.padGuide.textContent = t('sess.memoryDrawGuide');
    }
    if (dom.memoryStartDraw) dom.memoryStartDraw.hidden = true;
    const canvas = $('#pad');
    if (canvas) canvas.style.pointerEvents = '';
    if (dom.cover) {
      dom.cover.hidden = false;
      const inner = dom.cover.querySelector('[data-i18n="sess.memory"], .memory-cover-inner p');
      if (inner && inner.matches('p')) inner.textContent = t('sess.memory');
    }
    setReferenceLocked(true);
    lastBeepAt = -1;
    setTimeUnit(false);
    timer.start(draw);
    setPauseIcon();
    requestAnimationFrame(() => pad.resize());
  }

  /** 記憶クロッキー: 見比べフェーズ（写真と描いた絵を並べて見る） */
  function enterMemoryComparePhase() {
    if (!state?.current) return;
    const drill = DRILLS[state.current.drillId] || {};
    const compare = Number(drill.view?.compareSeconds) || 15;
    state.memoryPhase = 'compare';
    state.peeking = false;
    if (dom.peekBtn) dom.peekBtn.hidden = true;

    if (dom.padWrap) {
      dom.padWrap.classList.remove('is-memory-look', 'is-memory-draw');
      dom.padWrap.classList.add('is-memory-compare');
    }
    if (dom.padLockMsg) dom.padLockMsg.hidden = true;
    if (dom.padGuide) {
      // 見比べ中はガイド文言なし（お題と絵を見るだけ）
      dom.padGuide.hidden = true;
      dom.padGuide.textContent = '';
    }
    if (dom.memoryStartDraw) dom.memoryStartDraw.hidden = true;
    if (dom.cover) {
      dom.cover.hidden = true;
      dom.cover.classList.remove('peeking');
    }
    const canvas = $('#pad');
    if (canvas) canvas.style.pointerEvents = 'none';
    setReferenceLocked(true);
    lastBeepAt = -1;
    setTimeUnit(false);
    timer.start(compare);
    setPauseIcon();
    requestAnimationFrame(() => pad.resize());
  }

  /** 次の課題があるときは「保存して次へ」、最後は「保存して終わる」。 */
  function updateSaveNextLabel() {
    const btn = $('#pad-next');
    if (!btn || !state?.plan) return;
    const hasNext = state.cursor + 1 < state.plan.length;
    const key = hasNext ? 'sess.saveNext' : 'sess.saveFinish';
    btn.dataset.i18nLabel = key;
    btn.dataset.iconLabel = t(key);
    paintIcons(btn.parentElement || document);
  }

  function setReferenceLocked(locked) {
    for (const btn of [dom.padRefSwap, dom.refMiniSwap]) {
      if (btn) btn.hidden = locked;
    }
  }

  function applyRefCornerMode() {
    // セッション中に設定が変わっても拾えるよう、都度最新を見る
    const fresh = getSettings();
    if (state?.settings) state.settings.showRefCorner = !!fresh.showRefCorner;
    const on = !!fresh.showRefCorner;
    dom.padWrap?.classList.toggle('show-ref-corner', on);
  }

  function setRefSrc(photo) {
    const apply = (url) => {
      if (dom.refMiniImg) dom.refMiniImg.src = url;
      if (dom.padRefImg) dom.padRefImg.src = url;
    };
    apply(photo.url);
    if (photo.fallbackUrl && photo.fallbackUrl !== photo.url) {
      const onErr = () => {
        if (dom.padRefImg) dom.padRefImg.removeEventListener('error', onErr);
        apply(photo.fallbackUrl);
      };
      dom.padRefImg?.addEventListener('error', onErr, { once: true });
    }
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
    if (blob) {
      const seconds = state.current?.unlimited
        ? Math.round(timer.elapsed)
        : state.itemSeconds;
      state.drawings.push({
        blob,
        photoId: state.currentPhotoId,
        seconds,
        referenceArtworkId: state.referenceArtworkId || null,
        drillId: state.current?.drillId || null,
        source: state.current?.source || null,
        label: state.current?.label || null,
      });
    }
    pad.clear();
    if (state.settings.sfx) sfx.check();
    toast(t('sess.saved', { n: state.drawings.length }), 1400);
  }

  function record(item, seconds) {
    state.byDrill[item.drillId] = (state.byDrill[item.drillId] || 0) + seconds;
    state.totalSeconds += seconds;
  }

  function spentSeconds(item, { skipped = false } = {}) {
    if (!item) return 0;
    if (item.unlimited) return Math.max(0, timer.elapsed);
    // 記憶クロッキーは見る+描くだけを数える（見比べは練習時間に含めない）
    if (item.drillId === 'memoryCroquis') {
      const look = Number(DRILLS.memoryCroquis?.view?.memorizeSeconds) || 60;
      const draw = Number(DRILLS.memoryCroquis?.view?.drawSeconds) || 120;
      if (state?.memoryPhase === 'look') return Math.max(0, look - timer.remaining);
      if (state?.memoryPhase === 'draw') return look + Math.max(0, draw - timer.remaining);
      if (state?.memoryPhase === 'compare') return look + draw;
      return skipped ? 0 : look + draw;
    }
    if (!skipped) return item.seconds;
    return Math.max(0, item.seconds - timer.remaining);
  }

  async function advance(skipped = false) {
    if (!skipped) await harvestDrawing();
    pad.resetHistory();
    const done = state.current;
    if (done) {
      const spent = spentSeconds(done, { skipped });
      if (spent > 0) record(done, Math.round(spent));
    }
    clearMemoryUi();
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
    clearMemoryUi();
    await onFinish({
      drawings: state.drawings,
      menuId: state.menu.id,
      menuTitle: state.menu.title,
      partId: state.menu.partId || null,
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

    const savedCount = state?.drawings.length || 0;
    const onFirstShot = (state?.cursor === 0) && savedCount === 0;
    const unsaved = pad.hasContent;

    // 1枚目の途中やめは収穫せず「やってない」
    if (onFirstShot) {
      if (unsaved && !(await confirmDialog(t('sess.quitEmpty')))) {
        timer.resume();
        return;
      }
      clearMemoryUi();
      state = null;
      await onQuit(null);
      return;
    }

    if (savedCount > 0 || unsaved) {
      if (!(await confirmDialog(t('sess.quitConfirm')))) {
        timer.resume();
        return;
      }
    }
    await harvestDrawing();

    if (state?.current) {
      const spent = spentSeconds(state.current, { skipped: true });
      if (spent > 0) record(state.current, Math.round(spent));
    }
    const partial = state && state.drawings.length > 0
      ? { menuId: state.menu.id, menuTitle: state.menu.title, partId: state.menu.partId || null,
          seconds: state.totalSeconds,
          byDrill: state.byDrill, focusId: state.focus.id, lessonId: state.lessonId,
          lessonMode: state.lessonMode, drawings: state.drawings, partial: true,
          drawingCount: state.drawings.length, hasDrawing: true }
      : null;
    clearMemoryUi();
    state = null;
    await onQuit(partial);
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
    dom.padTime.classList.toggle('paused', !timer.running);
  }

  /** 描画パッドは常時表示（お題写真だけの stage は廃止）。 */
  function ensurePad() {
    if (dom.padWrap) dom.padWrap.hidden = false;
    dom.stage?.classList.add('with-pad');
    requestAnimationFrame(() => pad.resize());
  }

  function toggleGrid() {
    state.gridForced = !state.gridForced;
    if (dom.grid) {
      dom.grid.hidden = !state.gridForced && !DRILLS[state.current.drillId].view?.grid;
    }
    $$('.pad-btn[data-pad="grid"]').forEach((b) => b.classList.toggle('on', state.gridForced));
  }

  function toggleFlip() {
    state.flipForced = !state.flipForced;
    applyView(DRILLS[state.current.drillId], { flipped: state.flipForced });
    $$('.pad-btn[data-pad="flip"]').forEach((b) => b.classList.toggle('on', state.flipForced));
  }

  function peek() {
    if (!state.peeksLeft || !dom.cover) return;
    const item = state.current;
    state.peeksLeft--;
    state.peeking = true;
    if (dom.peekLeft) dom.peekLeft.textContent = String(state.peeksLeft);
    dom.cover.hidden = true;
    timer.extend(3);   // 見ていた分は時間を足す
    setTimeout(() => {
      if (!state || state.current !== item) return;   // 先に進んでいたら何もしない
      state.peeking = false;
      dom.cover.hidden = false;
      if (dom.peekBtn) dom.peekBtn.hidden = state.peeksLeft === 0;
    }, 3000);
  }

  $('#peek-btn')?.addEventListener('click', peek);

  dom.memoryStartDraw?.addEventListener('click', () => {
    if (state?.memoryPhase !== 'look') return;
    timer.stop();
    enterMemoryDrawPhase();
  });

  $('.pad-tools').addEventListener('click', (e) => {
    const tool = e.target.closest('[data-pad]')?.dataset.pad;
    const size = e.target.closest('[data-size]')?.dataset.size;
    if (size) {
      pad.setSize(Number(size));
      $$('.pad-size').forEach((b) => b.classList.toggle('on', b.dataset.size === size));
      return;
    }
    if (!tool) return;
    if (tool === 'undo') return void pad.undo();
    if (tool === 'clear') return void pad.clear();
    if (tool === 'grid') return void toggleGrid();
    if (tool === 'flip') return void toggleFlip();
    if (tool !== 'pen' && tool !== 'eraser') return;
    pad.setEraser(tool === 'eraser');
    $$('.pad-btn[data-pad="pen"], .pad-btn[data-pad="eraser"]')
      .forEach((b) => b.classList.toggle('on', b.dataset.pad === tool));
  });

  /*
   * 線の濃さ。あたりを薄く取ってから本線を乗せたい人向け。
   * 道具をいじる時間は描く時間から引かれるので、スライダー1本だけにしてある。
   */
  function updateOpacity(val) {
    const clamped = Math.max(5, Math.min(100, Math.round(val)));
    const alpha = clamped / 100;
    pad.setAlpha(alpha);
    dom.padOpacity.value = String(clamped);
    dom.padOpacityNum.value = String(clamped);
    dom.padOpacity.parentElement.style.setProperty('--a', String(alpha));
    if (state) state.settings = saveSettings({ penAlpha: alpha });
  }

  dom.padOpacity.addEventListener('input', (e) => updateOpacity(Number(e.target.value)));
  dom.padOpacityNum.addEventListener('change', (e) => updateOpacity(Number(e.target.value)));

  // 手順は写真の上に乗るので、邪魔になったら畳めるようにする
  $('#hint-toggle').addEventListener('click', () => {
    const open = dom.padHint.classList.toggle('open');
    if (state) state.settings = saveSettings({ hintOpen: open });
  });

  window.addEventListener('resize', () => { if (state) pad.resize(); });

  $('#pad-next').addEventListener('click', () => advance(false));
  $('#pad-skip').addEventListener('click', () => advance(true));
  $('#pad-quit').addEventListener('click', quit);
  $('#pad-time').addEventListener('click', togglePause);
  dom.refMini.addEventListener('click', () => dom.refMini.classList.toggle('big'));

  async function swapPhoto() {
    if (!state?.current) return;
    const item = state.current;
    const photo = await queueFor(item).next().catch(() => null);
    if (!photo) return;
    setRefSrc(photo);
    state.currentPhotoId = photo.photoId || null;
    renderAttribution(photo);
  }
  for (const btn of [dom.padRefSwap, dom.refMiniSwap]) {
    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      swapPhoto();
    });
  }

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
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); pad.undo(); }
    else if (e.key === 'f') toggleFlip();
    else if (e.code === 'Escape') quit();
  });

  return {
    async start({
      menu, queues, settings, focus, lessonId = null, lessonMode = 'weak',
      reminder = null, referenceLocked = false, referenceArtworkId = null,
    }) {
      state = {
        menu,
        plan: buildQueue(menu),
        queues,
        settings,
        focus,
        lessonId,
        lessonMode,
        reminder,
        referenceLocked: !!referenceLocked,
        referenceArtworkId: referenceArtworkId || null,
        cursor: -1,
        byDrill: {},
        drawings: [],
        totalSeconds: 0,
        gridForced: false,
        flipForced: false,
        pending: {},
        awaitingBridge: false,
      };
      pad.resetHistory();
      const initAlpha = settings.penAlpha ?? 0.9;
      pad.setAlpha(initAlpha);
      const initVal = String(Math.round(initAlpha * 100));
      dom.padOpacity.value = initVal;
      dom.padOpacityNum.value = initVal;
      dom.padOpacity.parentElement.style.setProperty('--a', String(initAlpha));
      dom.padHint.classList.toggle('open', settings.hintOpen !== false);
      setReferenceLocked(!!referenceLocked);
      applyRefCornerMode();
      Object.values(queues).forEach((q) => q.prime?.());
      if (settings.source === 'unsplash' && !settings.unsplashKey) {
        toast('Unsplash のキーが未設定です。設定から入れてください');
      }
      advance();
    },
    get active() { return state !== null; },
  };
}
