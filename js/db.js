/**
 * db.js — 画像の縮小ユーティリティ。
 *
 * 以前は IndexedDB（drawings / photos）もここにあったが、端末永続化は廃止。
 * スケッチは artworks、お題写真は同梱／Supabase 側のみ。
 */

/**
 * カメラや一眼の写真はそのままだと数MBあるので、長辺を落としてから扱う。
 * お題として見る／管理画面から上げる用途向け。
 */
export function shrinkImage(file, maxSide = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))),
        'image/webp',
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}
