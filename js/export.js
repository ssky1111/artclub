const PAPER = '#ffffff';
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

  const W = 1200;
  const H = 630;
  const pad = 32;
  const gap = 16;
  const leftW = 200;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = INK;
  ctx.textBaseline = 'top';
  ctx.font = '700 32px "Special Gothic Expanded One", "Arial Black", system-ui, sans-serif';
  ctx.fillText('ARTCLUB', pad, pad);

  if (date) {
    ctx.fillStyle = SOFT;
    ctx.font = '600 20px "Special Gothic Expanded One", "Arial Black", system-ui, sans-serif';
    ctx.fillText(date, pad, pad + 44);
  }

  const areaX = pad + leftW;
  const areaW = W - areaX - pad;
  const areaY = pad;
  const areaH = H - pad * 2;

  const n = images.length;
  const cols = Math.min(n, Math.ceil(Math.sqrt(n * (areaW / areaH))));
  const rows = Math.ceil(n / cols);
  const cell = Math.min(
    (areaW - (cols - 1) * gap) / cols,
    (areaH - (rows - 1) * gap) / rows,
  );
  const totalW = cols * cell + (cols - 1) * gap;
  const totalH = rows * cell + (rows - 1) * gap;
  const offX = areaX + (areaW - totalW) / 2;
  const offY = areaY + (areaH - totalH) / 2;

  images.forEach((img, i) => {
    const cx = offX + (i % cols) * (cell + gap);
    const cy = offY + Math.floor(i / cols) * (cell + gap);
    const scale = Math.min(cell / img.width, cell / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, cx + (cell - w) / 2, cy + (cell - h) / 2, w, h);
  });

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
}

export function shareToX(text, url = location.href.split('#')[0]) {
  const intent = new URL('https://twitter.com/intent/tweet');
  intent.searchParams.set('text', text);
  if (url && url.startsWith('http')) intent.searchParams.set('url', url);
  window.open(intent.toString(), '_blank', 'noopener');
}
