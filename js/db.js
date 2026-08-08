/**
 * db.js — 端末のなかに置くもの（IndexedDB）。
 *
 *   drawings … 自分が描いた絵。localStorage に入れるには大きすぎるので Blob で持つ
 *   photos   … 自分でアップロードしたお題の写真とタグ
 *
 * どちらも端末の外には出ない。
 */

const DB_NAME = 'croqui';
const DB_VERSION = 2;
const DRAWINGS = 'drawings';
const PHOTOS = 'photos';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DRAWINGS)) db.createObjectStore(DRAWINGS);
      if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const req = fn(transaction.objectStore(store));
    transaction.oncomplete = () => { db.close(); resolve(req?.result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

/* ---------- 描いた絵 ---------- */

export const putDrawing = (id, blob) => tx(DRAWINGS, 'readwrite', (s) => s.put(blob, id));
export const getDrawing = (id) => tx(DRAWINGS, 'readonly', (s) => s.get(id));
export const deleteAllDrawings = () => tx(DRAWINGS, 'readwrite', (s) => s.clear());

/* ---------- お題の写真 ---------- */

export const putPhoto = (photo) => tx(PHOTOS, 'readwrite', (s) => s.put(photo));
export const getPhoto = (id) => tx(PHOTOS, 'readonly', (s) => s.get(id));
export const listPhotos = () => tx(PHOTOS, 'readonly', (s) => s.getAll());
export const deletePhoto = (id) => tx(PHOTOS, 'readwrite', (s) => s.delete(id));
export const deleteAllPhotos = () => tx(PHOTOS, 'readwrite', (s) => s.clear());

/**
 * カメラや一眼の写真はそのままだと数MBあるので、長辺を落としてから保存する。
 * お題として見るだけなので、これ以上の解像度は要らない。
 */
export function shrinkImage(file, maxSide = 1400, quality = 0.82) {
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
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}
