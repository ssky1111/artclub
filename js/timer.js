/**
 * timer.js — カウントダウン／無制限の経過計測。
 * setInterval の誤差が積もらないよう、経過は常に performance.now() の差分から出す。
 */

export function createTimer({ onTick, onDone }) {
  let durationMs = 0;
  let remainingMs = 0;
  let elapsedMs = 0;
  let startedAt = 0;
  let raf = 0;
  let running = false;
  let unlimited = false;

  function liveElapsedMs() {
    if (!running) return elapsedMs;
    return elapsedMs + (performance.now() - startedAt);
  }

  function loop() {
    if (!running) return;
    if (unlimited) {
      const elapsedSec = liveElapsedMs() / 1000;
      onTick?.(elapsedSec, 0, { unlimited: true, elapsed: elapsedSec });
      raf = requestAnimationFrame(loop);
      return;
    }
    const elapsed = performance.now() - startedAt;
    remainingMs = Math.max(0, durationMs - elapsed);
    onTick?.(remainingMs / 1000, 1 - remainingMs / durationMs, { unlimited: false });
    if (remainingMs <= 0) {
      running = false;
      onDone?.();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  return {
    /** @param {number} seconds カウントダウン秒。unlimited 時は無視 */
    start(seconds, { unlimited: asUnlimited = false } = {}) {
      cancelAnimationFrame(raf);
      unlimited = !!asUnlimited;
      elapsedMs = 0;
      startedAt = performance.now();
      running = true;
      if (unlimited) {
        durationMs = 0;
        remainingMs = 0;
        loop();
        return;
      }
      durationMs = Math.max(0, Number(seconds) || 0) * 1000;
      remainingMs = durationMs;
      loop();
    },
    pause() {
      if (!running) return;
      if (unlimited) elapsedMs = liveElapsedMs();
      else {
        const elapsed = performance.now() - startedAt;
        remainingMs = Math.max(0, durationMs - elapsed);
        durationMs = remainingMs;
      }
      running = false;
      cancelAnimationFrame(raf);
    },
    resume() {
      if (running) return;
      if (unlimited) {
        startedAt = performance.now();
        running = true;
        loop();
        return;
      }
      if (remainingMs <= 0) return;
      startedAt = performance.now();
      running = true;
      loop();
    },
    toggle() { running ? this.pause() : this.resume(); },
    stop() {
      if (unlimited && running) elapsedMs = liveElapsedMs();
      running = false;
      cancelAnimationFrame(raf);
      if (!unlimited) remainingMs = 0;
    },
    /** 残りに秒を足す（記憶ドリルの「もう一度見る」で使う） */
    extend(seconds) {
      if (unlimited) return;
      remainingMs += seconds * 1000;
      durationMs += seconds * 1000;
    },
    get running() { return running; },
    get remaining() { return unlimited ? 0 : remainingMs / 1000; },
    get elapsed() { return liveElapsedMs() / 1000; },
    get unlimited() { return unlimited; },
  };
}

/**
 * 効果音。音声ファイルを1つも持たずに WebAudio で作る。
 * ファミコンっぽく聞こえるのは、矩形波と短い減衰と、音階を階段状に上げているから。
 */
export function createBeeper() {
  let ctx = null;
  let muted = false;

  function audio() {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /** 1音鳴らす。at は「今から何秒後か」。 */
  function note(freq, { at = 0, dur = 0.12, type = 'square', gain = 0.12, slide = 0 } = {}) {
    if (muted) return;
    try {
      const c = audio();
      const t0 = c.currentTime + at;
      const osc = c.createOscillator();
      const amp = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(amp).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* 音が出せない環境では黙って諦める */ }
  }

  const NOTES = { C: 523.25, D: 587.33, E: 659.25, G: 783.99, A: 880, C2: 1046.5, E2: 1318.5, G2: 1568 };

  return {
    set mute(value) { muted = value; },
    get mute() { return muted; },

    /** ブラウザは操作なしに音を鳴らせないので、最初のタップで起こしておく */
    unlock() { try { audio(); } catch { /* まだ鳴らせないだけ */ } },

    tick(pitch = 880) { note(pitch, { dur: 0.07, gain: 0.09 }); },
    done() { note(NOTES.C2, { dur: 0.1 }); note(NOTES.E2, { at: 0.09, dur: 0.14 }); },

    start() { note(NOTES.G, { dur: 0.07 }); note(NOTES.C2, { at: 0.06, dur: 0.11 }); },
    tap() { note(NOTES.E2, { dur: 0.05, gain: 0.07, type: 'triangle' }); },
    check() { note(NOTES.E, { dur: 0.06 }); note(NOTES.G, { at: 0.05, dur: 0.1 }); },

    /** セッション完了。上がっていく4音 */
    fanfare() {
      [NOTES.C, NOTES.E, NOTES.G, NOTES.C2].forEach((f, i) =>
        note(f, { at: i * 0.09, dur: 0.16, gain: 0.13 }));
    },

    /** レベルアップ。もう一段上まで駆け上がる */
    levelUp() {
      [NOTES.C, NOTES.E, NOTES.G, NOTES.C2, NOTES.E2, NOTES.G2].forEach((f, i) =>
        note(f, { at: i * 0.075, dur: 0.18, gain: 0.13 }));
    },

    /** バッジ獲得。キラッとした2音 */
    badge() {
      note(NOTES.E2, { at: 0, dur: 0.12, type: 'triangle', gain: 0.14 });
      note(NOTES.G2, { at: 0.1, dur: 0.22, type: 'triangle', gain: 0.14 });
    },
  };
}

/** アプリ全体で1つだけ持つ。AudioContext をいくつも作らないため。 */
export const sfx = createBeeper();
