const PAPER = '#ffffff';
const INK = '#2b2a27';
const SOFT = '#8b8b85';
/** お題サムネの縁（黒ではなくミディアムグレー） */
const PROMPT_FRAME = '#b0b0b0';

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

/** iPhone / iPad（写真アプリに保存したい端末） */
export function isAppleTouchDevice() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS は Mac 扱いになることがある
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
}

async function blobToJpeg(blob, quality = 0.92) {
  if (!blob) return null;
  if ((blob.type || '') === 'image/jpeg') return blob;
  const img = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b || blob), 'image/jpeg', quality);
  });
}

/**
 * 画像を端末に保存する。
 * iPhone などでは共有シート経由で「写真に追加」できるようにする。
 * 非対応環境は通常のダウンロードに落とす。
 */
export async function saveImageBlob(blob, filename = 'artclub.jpg') {
  if (!blob) return 'empty';

  let out = blob;
  let name = filename || 'artclub.jpg';
  const apple = isAppleTouchDevice();

  // 写真アプリ向けに JPEG へ寄せる（WebP だと保存できない端末がある）
  if (apple && !/^image\/(jpeg|png)$/i.test(blob.type || '')) {
    out = await blobToJpeg(blob);
    name = String(name).replace(/\.[a-z0-9]+$/i, '.jpg');
    if (!/\.jpe?g$/i.test(name)) name = `${name}.jpg`;
  }

  const type = out.type || 'image/jpeg';
  const file = new File([out], name, { type });

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'aborted';
      // 共有失敗時はダウンロードへ
    }
  }

  downloadBlob(out, name);
  return 'downloaded';
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

/**
 * 白い紙の余白を除き、線がある範囲だけに切り出す。
 * 薄い線も拾えるよう、白からの差で判定する。
 * axis: 'both' … 上下左右 / 'y' … 上下だけ（横幅はキャンバスのまま）
 */
export async function cropToInk(blob, {
  padRatio = 0.04,
  minPad = 12,
  threshold = 16,
  axis = 'both',
} = {}) {
  if (!blob) return null;
  const img = await loadImage(blob);
  const src = document.createElement('canvas');
  src.width = img.width;
  src.height = img.height;
  if (!src.width || !src.height) return blob;

  const ctx = src.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, src.width, src.height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = row + x * 4;
      const dr = 255 - data[i];
      const dg = 255 - data[i + 1];
      const db = 255 - data[i + 2];
      if (dr > threshold || dg > threshold || db > threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  // 線が無い／ほぼ全面に描いてあるときはそのまま
  if (maxX < 0) return blob;
  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;
  if (contentW * contentH > width * height * 0.92) return blob;

  const pad = Math.max(minPad, Math.round(Math.max(contentW, contentH) * padRatio));
  if (axis === 'y') {
    // single 用：縦の余白だけ落とす
    minX = 0;
    maxX = width - 1;
    minY = Math.max(0, minY - pad);
    maxY = Math.min(height - 1, maxY + pad);
  } else {
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width - 1, maxX + pad);
    maxY = Math.min(height - 1, maxY + pad);
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  if (w >= width && h >= height) return blob;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  octx.fillStyle = PAPER;
  octx.fillRect(0, 0, w, h);
  octx.drawImage(src, minX, minY, w, h, 0, 0, w, h);
  return new Promise((resolve) => out.toBlob((b) => resolve(b || blob), 'image/webp', 0.9));
}

/** single 画像用。上下の余白だけ切る。 */
export function cropToInkVertical(blob, opts = {}) {
  return cropToInk(blob, { ...opts, axis: 'y' });
}

export async function downloadEach(blobs, prefix = 'artclub') {
  for (let i = 0; i < blobs.length; i++) {
    let blob = blobs[i];
    try {
      blob = (await cropToInkVertical(blob)) || blob;
    } catch { /* keep original */ }
    downloadBlob(blob, `${prefix}-${String(i + 1).padStart(2, '0')}.jpg`);
    await new Promise((r) => setTimeout(r, 350));
  }
}

/**
 * お題写真を描いた絵の左上に重ねる（個別DL用）。
 * prompt が無いときは絵だけ（縦トリミング）を返す。
 */
export async function composeWithPrompt(drawingBlob, promptBlob, { crop = true } = {}) {
  if (!drawingBlob) return null;
  let drawSrc = drawingBlob;
  if (crop) {
    try { drawSrc = (await cropToInkVertical(drawingBlob)) || drawingBlob; } catch { /* keep */ }
  }
  if (!promptBlob) return drawSrc;

  const [drawImg, promptImg] = await Promise.all([
    loadImage(drawSrc),
    loadImage(promptBlob),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = drawImg.width;
  canvas.height = drawImg.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(drawImg, 0, 0);
  drawPromptCorner(ctx, promptImg, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}

/** セル／キャンバス左上にお題サムネを描く。縁は1pxグレー（控えめ）。 */
function drawPromptCorner(ctx, promptImg, cellX, cellY, cellW, cellH) {
  if (!promptImg || !cellW || !cellH) return;
  const corner = Math.max(56, Math.round(Math.min(cellW, cellH) * 0.3));
  const inset = Math.max(6, Math.round(corner * 0.08));
  const scale = Math.min(corner / promptImg.width, corner / promptImg.height);
  const pw = Math.round(promptImg.width * scale);
  const ph = Math.round(promptImg.height * scale);
  const x = cellX + inset;
  const y = cellY + inset;
  const frame = 1;

  ctx.fillStyle = PAPER;
  ctx.fillRect(x - frame, y - frame, pw + frame * 2, ph + frame * 2);
  ctx.drawImage(promptImg, x, y, pw, ph);
  ctx.strokeStyle = PROMPT_FRAME;
  ctx.lineWidth = frame;
  ctx.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
}

/**
 * 枚数を上列・下列（必要なら3段）にバランスよく割る。
 * 余りは上の行から順に1枚ずつ足す（例: 5→[3,2], 7→[4,3]）。
 */
function sheetRowCounts(n) {
  if (n <= 0) return [];
  if (n <= 3) return [n];
  const rowCount = n <= 8 ? 2 : 3;
  const base = Math.floor(n / rowCount);
  const rem = n % rowCount;
  return Array.from({ length: rowCount }, (_, i) => base + (i < rem ? 1 : 0));
}

/**
 * まとめ画。
 * prompts を渡すと、各セル左上に小さなお題を重ねる（セル基準なのでサイズ・位置が揃う）。
 */
export async function composeSheet(blobs, { date = '', crop = true, prompts = null } = {}) {
  if (!blobs.length) return null;

  const images = [];
  for (const blob of blobs) {
    try {
      const src = crop ? await cropToInk(blob) : blob;
      images.push(await loadImage(src));
    } catch { /* skip broken */ }
  }
  if (!images.length) return null;

  const promptImgs = [];
  if (Array.isArray(prompts) && prompts.length) {
    for (let i = 0; i < images.length; i++) {
      const p = prompts[i];
      if (!p) { promptImgs.push(null); continue; }
      try { promptImgs.push(await loadImage(p)); }
      catch { promptImgs.push(null); }
    }
  }

  const W = 1200;
  const H = 630;
  const pad = 28;
  const gap = 16;
  const topBand = 52;
  const bottomBand = 40;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // 日付は上中央
  if (date) {
    ctx.fillStyle = SOFT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 22px "Special Gothic Expanded One", "Arial Black", system-ui, sans-serif';
    ctx.fillText(date, W / 2, topBand / 2);
  }

  const areaX = pad;
  const areaW = W - pad * 2;
  const areaY = topBand;
  const areaH = H - topBand - bottomBand;

  const rowCounts = sheetRowCounts(images.length);
  const maxCols = Math.max(...rowCounts);
  const rowCount = rowCounts.length;
  const cell = Math.min(
    (areaW - (maxCols - 1) * gap) / maxCols,
    (areaH - (rowCount - 1) * gap) / rowCount,
  );
  const totalH = rowCount * cell + (rowCount - 1) * gap;
  const offY = areaY + (areaH - totalH) / 2;

  let index = 0;
  rowCounts.forEach((cols, row) => {
    const rowW = cols * cell + (cols - 1) * gap;
    const offX = areaX + (areaW - rowW) / 2;
    const cy = offY + row * (cell + gap);
    for (let c = 0; c < cols; c++) {
      const img = images[index];
      if (!img) return;
      const cx = offX + c * (cell + gap);
      const scale = Math.min(cell / img.width, cell / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, cx + (cell - w) / 2, cy + (cell - h) / 2, w, h);
      if (promptImgs[index]) {
        drawPromptCorner(ctx, promptImgs[index], cx, cy, cell, cell);
      }
      index++;
    }
  });

  // DrawParty は下中央（黒）
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 16px "Special Gothic Expanded One", "Arial Black", system-ui, sans-serif';
  ctx.fillText('DrawParty', W / 2, H - bottomBand / 2);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
}

/**
 * OGP用に右下へ DrawParty を焼き込む。
 * ギャラリー本体の絵はそのままにし、og_image_url 側で使う。
 */
export async function brandForOgp(blob, { label = 'DrawParty' } = {}) {
  if (!blob) return null;
  const img = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const fontSize = Math.max(16, Math.round(Math.min(img.width, img.height) * 0.045));
  const pad = Math.max(12, Math.round(fontSize * 0.75));
  ctx.font = `700 ${fontSize}px "Special Gothic Expanded One", "Arial Black", system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  // 白縁＋本体でどんな背景でも読めるようにする
  ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.18));
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeText(label, img.width - pad, img.height - pad);
  ctx.fillStyle = 'rgba(43, 42, 39, 0.82)';
  ctx.fillText(label, img.width - pad, img.height - pad);

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b || blob), 'image/jpeg', 0.9);
  });
}

export function shareToX(text, url = location.href.split('#')[0]) {
  const intent = new URL('https://twitter.com/intent/tweet');
  intent.searchParams.set('text', text);
  if (url && url.startsWith('http')) intent.searchParams.set('url', url);
  window.open(intent.toString(), '_blank', 'noopener');
}
