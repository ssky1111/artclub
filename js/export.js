/**
 * export.js — 描いたものを外に出す。
 *
 * 端末のなかにだけ貯めていても、見返さないし人にも見せられない。
 * 1枚ずつのダウンロードと、その回の全部を1枚にまとめたコンタクトシートの両方を用意する。
 * シェアは画像を自動で添付できない（Web Share API が画像に対応していない環境が多い）ので、
 * 「まとめ画像をダウンロード → 文面つきで投稿画面をひらく」の2手に分けてある。
 */

const PAPER = '#fffdf8';
const INK = '#2b2a27';
const SOFT = '#8b8b85';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

/** 1枚ずつ順番に落とす。ブラウザがまとめてブロックしないよう少し間隔をあける。 */
export async function downloadEach(blobs, prefix = 'artclub') {
  for (let i = 0; i < blobs.length; i++) {
    downloadBlob(blobs[i], `${prefix}-${String(i + 1).padStart(2, '0')}.jpg`);
    await new Promise((r) => setTimeout(r, 350));
  }
}

/**
 * その回に描いたものを1枚のコンタクトシートにする。
 * 並び順＝描いた順なので、上から下へ「今日の流れ」がそのまま見える。
 */
export async function composeSheet(blobs, { title = 'ARTCLUB', subtitle = '' } = {}) {
  if (!blobs.length) return null;

  const images = [];
  for (const blob of blobs) {
    try { images.push(await loadImage(blob)); } catch { /* 壊れた1枚は飛ばす */ }
  }
  if (!images.length) return null;

  // 枚数から列数を決める。1〜2枚は横に並べ、それ以上は3列。
  const cols = images.length <= 2 ? images.length : (images.length <= 6 ? 2 : 3);
  const rows = Math.ceil(images.length / cols);

  const cell = 640;
  const gap = 20;
  const pad = 40;
  const headH = 96;
  const footH = 56;

  const canvas = document.createElement('canvas');
  canvas.width = pad * 2 + cols * cell + (cols - 1) * gap;
  canvas.height = pad + headH + rows * cell + (rows - 1) * gap + footH;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = INK;
  ctx.textBaseline = 'top';
  ctx.font = '700 44px ui-rounded, "Hiragino Maru Gothic ProN", system-ui, sans-serif';
  ctx.fillText(title, pad, pad);
  if (subtitle) {
    ctx.fillStyle = SOFT;
    ctx.font = '400 26px system-ui, sans-serif';
    ctx.fillText(subtitle, pad, pad + 52);
  }

  images.forEach((img, i) => {
    const cx = pad + (i % cols) * (cell + gap);
    const cy = pad + headH + Math.floor(i / cols) * (cell + gap);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx, cy, cell, cell);

    // 切り取ると絵の意味が変わるので、はみ出させずに収める
    const scale = Math.min(cell / img.width, cell / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, cx + (cell - w) / 2, cy + (cell - h) / 2, w, h);

    ctx.fillStyle = SOFT;
    ctx.font = '400 22px system-ui, sans-serif';
    ctx.fillText(String(i + 1), cx + 10, cy + 8);
  });

  ctx.fillStyle = SOFT;
  ctx.font = '400 22px system-ui, sans-serif';
  ctx.fillText('artclub — reference photos from Unsplash',
               pad, canvas.height - footH + 8);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
}

/** X（Twitter）の投稿画面をひらく。画像は自動では乗らないので文面だけ。 */
export function shareToX(text, url = location.href.split('#')[0]) {
  const intent = new URL('https://twitter.com/intent/tweet');
  intent.searchParams.set('text', text);
  if (url && url.startsWith('http')) intent.searchParams.set('url', url);
  window.open(intent.toString(), '_blank', 'noopener');
}
