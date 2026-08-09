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

export async function downloadEach(blobs, prefix = 'artclub') {
  for (let i = 0; i < blobs.length; i++) {
    downloadBlob(blobs[i], `${prefix}-${String(i + 1).padStart(2, '0')}.jpg`);
    await new Promise((r) => setTimeout(r, 350));
  }
}

export async function composeSheet(blobs, { date = '' } = {}) {
  if (!blobs.length) return null;

  const images = [];
  for (const blob of blobs) {
    try { images.push(await loadImage(blob)); } catch { /* skip broken */ }
  }
  if (!images.length) return null;

  const cols = images.length <= 2 ? images.length : (images.length <= 6 ? 2 : 3);
  const rows = Math.ceil(images.length / cols);

  const cell = 640;
  const gap = 20;
  const pad = 40;
  const headH = 72;
  const footH = 56;

  const canvas = document.createElement('canvas');
  canvas.width = pad * 2 + cols * cell + (cols - 1) * gap;
  canvas.height = pad + headH + rows * cell + (rows - 1) * gap + footH;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (date) {
    ctx.fillStyle = INK;
    ctx.textBaseline = 'top';
    ctx.font = '700 36px ui-rounded, "Hiragino Maru Gothic ProN", system-ui, sans-serif';
    const dateW = ctx.measureText(date).width;
    ctx.fillText(date, (canvas.width - dateW) / 2, pad);
  }

  images.forEach((img, i) => {
    const cx = pad + (i % cols) * (cell + gap);
    const cy = pad + headH + Math.floor(i / cols) * (cell + gap);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx, cy, cell, cell);

    const scale = Math.min(cell / img.width, cell / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, cx + (cell - w) / 2, cy + (cell - h) / 2, w, h);
  });

  ctx.fillStyle = SOFT;
  ctx.textBaseline = 'bottom';
  ctx.font = '600 18px ui-rounded, "Hiragino Maru Gothic ProN", system-ui, sans-serif';
  const label = 'ARTCLUB';
  const labelW = ctx.measureText(label).width;
  ctx.fillText(label, (canvas.width - labelW) / 2, canvas.height - 16);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
}

export function shareToX(text, url = location.href.split('#')[0]) {
  const intent = new URL('https://twitter.com/intent/tweet');
  intent.searchParams.set('text', text);
  if (url && url.startsWith('http')) intent.searchParams.set('url', url);
  window.open(intent.toString(), '_blank', 'noopener');
}
