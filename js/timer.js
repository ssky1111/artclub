/**
 * timer.js — カウントダウン。
 * setInterval の誤差が積もらないよう、経過は常に performance.now() の差分から出す。
 */

export function createTimer({ onTick, onDone }) {
  let durationMs = 0;
  let remainingMs = 0;
  let startedAt = 0;
  let raf = 0;
  let running = false;

  function loop() {
    if (!running) return;
    const elapsed = performance.now() - startedAt;
    remainingMs = Math.max(0, durationMs - elapsed);
    onTick?.(remainingMs / 1000, 1 - remainingMs / durationMs);
    if (remainingMs <= 0) {
      running = false;
      onDone?.();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  return {
    start(seconds) {
      cancelAnimationFrame(raf);
      durationMs = seconds * 1000;
      remainingMs = durationMs;
      startedAt = performance.now();
      running = true;
      loop();
    },
    pause() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      durationMs = remainingMs;
    },
    resume() {
      if (running || remainingMs <= 0) return;
      startedAt = performance.now();
      running = true;
      loop();
    },
    toggle() { running ? this.pause() : this.resume(); },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      remainingMs = 0;
    },
    /** 残りに秒を足す（記憶ドリルの「もう一度見る」で使う） */
    extend(seconds) {
      remainingMs += seconds * 1000;
      durationMs += seconds * 1000;
    },
    get running() { return running; },
    get remaining() { return remainingMs / 1000; },
  };
}

/** 残り3秒のカチッ音。音声ファイルを持たずに WebAudio で鳴らす。 */
export function createBeeper() {
  let ctx = null;
  return {
    tick(pitch = 880) {
      try {
        ctx ||= new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = pitch;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.13);
      } catch { /* 音が出せない環境では黙って諦める */ }
    },
    done() { this.tick(1320); },
  };
}
