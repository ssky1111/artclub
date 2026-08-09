/**
 * draw.js — 練習画面に組み込む簡易キャンバス。
 *
 * 紙とペンが手元にない日でも始められるようにするためのもので、
 * お絵描きアプリの置き換えではない。だから機能は
 *   ペン / 消しゴム / 太さ3段階 / 元に戻す / 全消し
 * だけに絞ってある。レイヤーもブラシ設定も入れない。
 * 練習中に道具をいじる時間は、描く時間から引かれているので。
 *
 * 描いたものはセッション終了時にそのまま「今日の絵」として記録に残せる。
 */

const UNDO_LIMIT = 12;

export function createPad(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const undoStack = [];
  let drawing = false;
  let dirty = false;
  let last = null;

  const state = {
    color: '#1c1a17',
    size: 4,
    eraser: false,
    // 線の濃さ。あたりを薄く取ってから上に重ねたい人がいるので、0.15 まで下げられる
    alpha: 1,
  };

  /** 見た目のサイズと実ピクセルを合わせる。ぼやけ防止。 */
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width === w && canvas.height === h) return;

    // 描きかけを保ったままサイズを変える
    const prev = canvas.width ? document.createElement('canvas') : null;
    if (prev && canvas.width) {
      prev.width = canvas.width;
      prev.height = canvas.height;
      prev.getContext('2d').drawImage(canvas, 0, 0);
    }
    canvas.width = w;
    canvas.height = h;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (prev) ctx.drawImage(prev, 0, 0, rect.width, rect.height);
  }

  function pushUndo() {
    try {
      undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    } catch { /* 巨大すぎるときは諦める */ }
  }

  function pointFrom(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      // 対応しているペンなら筆圧で太さを変える。指やマウスは 0.5 が来る
      p: event.pressure && event.pressure !== 0.5 ? event.pressure : 0.6,
    };
  }

  function stroke(from, to) {
    ctx.globalCompositeOperation = state.eraser ? 'destination-out' : 'source-over';
    // 消しゴムは薄くしない。薄い消しゴムは「消えない消しゴム」にしかならないので
    ctx.globalAlpha = state.eraser ? 1 : state.alpha;
    ctx.strokeStyle = state.color;
    ctx.lineWidth = state.size * (state.eraser ? 3 : 0.6 + to.p);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function onDown(event) {
    if (!event.isPrimary) return;
    canvas.setPointerCapture(event.pointerId);
    pushUndo();
    drawing = true;
    dirty = true;
    last = pointFrom(event);
    stroke(last, { ...last, x: last.x + 0.01 });   // 点だけ打った場合にも印を残す
  }

  function onMove(event) {
    if (!drawing) return;
    // 途中の座標も拾って、速く動かしたときのカクつきを減らす
    const points = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
    for (const e of points) {
      const point = pointFrom(e);
      stroke(last, point);
      last = point;
    }
  }

  function onUp() { drawing = false; last = null; }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onUp);
  // 描いている間に画面がスクロールしたり拡大したりしないように
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

  return {
    state,
    resize,

    setSize(size) { state.size = size; },
    setEraser(on) { state.eraser = on; },
    setAlpha(alpha) {
      const v = Math.min(1, Math.max(0.05, Number(alpha) || 1));
      state.alpha = v * v;
    },
    setColor(color) { state.color = color; state.eraser = false; },

    undo() {
      const snapshot = undoStack.pop();
      if (!snapshot) return false;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(snapshot, 0, 0);
      ctx.restore();
      return true;
    },

    clear() {
      pushUndo();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      dirty = false;
    },

    resetHistory() {
      undoStack.length = 0;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      dirty = false;
    },

    get hasContent() { return dirty; },

    /** 記録に残すときは、透明のままだと真っ黒に見えるので紙の色を敷く。 */
    toBlob(background = '#fffdf8') {
      return new Promise((resolve) => {
        if (!dirty) return resolve(null);
        const out = document.createElement('canvas');
        out.width = canvas.width;
        out.height = canvas.height;
        const octx = out.getContext('2d');
        octx.fillStyle = background;
        octx.fillRect(0, 0, out.width, out.height);
        octx.drawImage(canvas, 0, 0);
        const scale = Math.min(1, 1000 / Math.max(out.width, out.height));
        if (scale < 1) {
          const small = document.createElement('canvas');
          small.width = Math.round(out.width * scale);
          small.height = Math.round(out.height * scale);
          small.getContext('2d').drawImage(out, 0, 0, small.width, small.height);
          small.toBlob((blob) => resolve(blob), 'image/webp', 0.8);
        } else {
          out.toBlob((blob) => resolve(blob), 'image/webp', 0.8);
        }
      });
    },
  };
}
