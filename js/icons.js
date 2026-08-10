/**
 * icons.js — 画面で使うアイコン。
 *
 * 絵文字をやめた理由は3つ。
 *   1. 端末ごとに絵が違う（iPhone と Android と PC で別物になる）
 *   2. 色を変えられないので、テーマを切り替えても浮く
 *   3. 大きさと重心が揃わず、並べたときにガタつく
 *
 * アイコンフォントや CDN を使わないのは、オフラインでも同じ見た目で
 * 立ち上がってほしいのと、外部への通信を1本も増やしたくないため。
 * すべて 24×24 の線画で、太さと端の処理を揃えて自前で引いてある。
 */

const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.8" ' +
               'stroke-linecap="round" stroke-linejoin="round"';
const FILL = 'fill="currentColor" stroke="none"';

const PATHS = {
  /* 操作 */
  close:    '<path d="M6 6l12 12M18 6L6 18"/>',
  back:     '<path d="M15 5l-7 7 7 7"/>',
  forward:  '<path d="M9 5l7 7-7 7"/>',
  // 歯車は小さく描くと太陽に見えるので、つまみ付きのスライダーにしてある
  settings: '<path d="M4 8h10M18 8h2M4 16h4M12 16h8"/><circle cx="16" cy="8" r="2.2"/><circle cx="10" cy="16" r="2.2"/>',
  info:     '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8.2v.2"/>',
  check:    '<path d="M5 13l4 4L19 7"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',

  /* 練習 */
  play:     '<path d="M8 5l11 7-11 7z"/>',
  pause:    '<path d="M9 5v14M15 5v14"/>',
  next:     '<path d="M6 5l9 7-9 7z"/><path d="M18 5v14"/>',
  grid:     '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  flip:     '<path d="M12 4v16"/><path d="M8 8L4 12l4 4"/><path d="M16 8l4 4-4 4"/>',
  timer:    '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',

  /* 描く */
  pencil:   '<path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14 6l3 3"/>',
  eraser:   '<path d="M8 20h11"/><path d="M15.5 4.5l4 4-8 8h-5l-2.5-2.5z"/>',
  undo:     '<path d="M4 9h10a5 5 0 010 10h-6"/><path d="M8 5L4 9l4 4"/>',
  trash:    '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  expand:   '<path d="M4 9V4h5M20 15v5h-5M4 15v5h5M20 9V4h-5"/>',
  collapse: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  camera:   '<path d="M3 8h4l2-2h6l2 2h4v12H3z"/><circle cx="12" cy="13" r="3.5"/>',

  /* ホーム */
  home:     '<path d="M4 11l8-7 8 7v9H4z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  flame:    '<path d="M13 2c.5 3 4 4.5 4 8.5A5 5 0 017 11c0-1.6.6-2.8 1.5-3.8.1 1.3.7 2.1 1.4 2.6.5-3 1.6-5.5 3.1-7.8z"/>',
  target:   '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',
  bone:     '<path d="M7 17l10-10"/><circle cx="5.5" cy="18.5" r="2.2"/><circle cx="8" cy="16" r="2.2"/><circle cx="18.5" cy="5.5" r="2.2"/><circle cx="16" cy="8" r="2.2"/>',
  // 非公開の目印。小さく出すので、つるは細く胴は角丸の箱にしてある
  lock:     '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 018 0v3"/>',
  repeat:   '<path d="M4 9h13a3 3 0 013 3v1"/><path d="M8 5L4 9l4 4"/><path d="M20 15H7a3 3 0 01-3-3v-1"/><path d="M16 19l4-4-4-4"/>',
  // react-icons MdAutorenew（差し替え＝更新の矢印）
  photoSwap: {
    filled: true,
    path: '<path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8A5.87 5.87 0 0 1 6 12c0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/>',
  },
};

/** SVG 文字列を返す。CSS の color がそのまま線の色になる。 */
export function icon(name, size = 24) {
  const entry = PATHS[name];
  if (!entry) return '';
  const filled = typeof entry === 'object' && entry.filled;
  const path = typeof entry === 'object' ? entry.path : entry;
  const attrs = filled ? FILL : STROKE;
  return `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" ` +
         `aria-hidden="true" ${attrs}>${path}</svg>`;
}

/** el() で作った要素にアイコンを入れる用。 */
export function iconEl(name, size = 24) {
  const span = document.createElement('span');
  span.className = 'icon-wrap';
  span.innerHTML = icon(name, size);
  return span;
}

/** 画面の中の <button data-icon="..."> をまとめて置き換える。 */
export function paintIcons(root = document) {
  for (const node of root.querySelectorAll('[data-icon]')) {
    const label = node.dataset.iconLabel;
    node.innerHTML = icon(node.dataset.icon, Number(node.dataset.iconSize) || 22) +
                     (label ? `<span>${label}</span>` : '');
  }
}
