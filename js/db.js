/**
 * db.js — 自分の描いた絵の写真を置くところ。
 * localStorage に入れるには大きすぎるので IndexedDB に Blob で持つ。端末の外には出ない。
 */

const DB_NAME = 'croqui';
const STORE = 'drawings';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const req = fn(transaction.objectStore(STORE));
    transaction.oncomplete = () => { db.close(); resolve(req?.result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function putDrawing(id, blob) {
  return tx('readwrite', (store) => store.put(blob, id));
}

export async function getDrawing(id) {
  return tx('readonly', (store) => store.get(id));
}

export async function deleteAllDrawings() {
  return tx('readwrite', (store) => store.clear());
}

/**
 * カメラの写真はそのままだと数MBあるので、長辺 1000px の JPEG に落としてから保存する。
 */
export function shrinkImage(file, maxSide = 1000, quality = 0.72) {
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
