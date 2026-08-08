/**
 * library.js — 自分でアップロードしたお題の写真。
 *
 * 検索APIから引いてくる写真は、狙ったものが出てこない（人物を頼んでも布や風景が出る）。
 * 自分で集めた写真にタグを付けて、そこから出題するほうが確実に早い。
 *
 * 写真は端末の IndexedDB に入る。外には出ない。
 */

import { putPhoto, getPhoto, listPhotos, deletePhoto, shrinkImage } from './db.js';

/** よく使うタグ。これ以外も自由に足せる。 */
export const TAG_GROUPS = [
  { name: '範囲',   tags: ['全身', '半身', '顔', '手', '足'] },
  { name: '性別',   tags: ['女性', '男性', 'どちらでも'] },
  { name: '姿勢',   tags: ['立ち', '座り', '寝', '動き'] },
  { name: 'その他', tags: ['服のしわ', '筋肉が見える', '逆光', '難しい'] },
];

export const ALL_TAGS = TAG_GROUPS.flatMap((g) => g.tags);

let cache = null;

export async function allPhotos({ fresh = false } = {}) {
  if (!cache || fresh) cache = (await listPhotos()) || [];
  return [...cache].sort((a, b) => b.addedAt - a.addedAt);
}

export function invalidate() { cache = null; }

/** ファイルを取り込む。縮小してから入れる。 */
export async function addFiles(files, tags = []) {
  const added = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const blob = await shrinkImage(file);
      const photo = {
        id: `p${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        blob,
        tags: [...tags],
        name: file.name,
        addedAt: Date.now(),
      };
      await putPhoto(photo);
      added.push(photo);
    } catch { /* 読めない画像は飛ばす */ }
  }
  invalidate();
  return added;
}

export async function setTags(id, tags) {
  const photo = await getPhoto(id);
  if (!photo) return null;
  photo.tags = tags;
  await putPhoto(photo);
  invalidate();
  return photo;
}

export async function removePhoto(id) {
  await deletePhoto(id);
  invalidate();
}

/** タグでしぼる。タグを1つも選んでいなければ全部。 */
export async function photosWithTags(tags = []) {
  const photos = await allPhotos();
  if (!tags.length) return photos;
  return photos.filter((p) => tags.every((t) => p.tags.includes(t)));
}

/**
 * セッション用のキュー。images.js のキューと同じ形で使える。
 * 同じ写真が続けて出ないよう、ひと回りしてから戻ってくるようにしている。
 */
export function createLibraryQueue(tags, onNotice = () => {}) {
  let pool = [];
  let cursor = 0;
  let loading = null;
  const urls = [];

  async function load() {
    pool = await photosWithTags(tags);
    if (!pool.length) onNotice('その条件の写真がありません。写真の管理から追加してください');
    pool.sort(() => Math.random() - 0.5);
  }

  function ensure() {
    if (pool.length || loading) return loading || Promise.resolve();
    loading = load().finally(() => { loading = null; });
    return loading;
  }

  return {
    async next() {
      await ensure();
      if (!pool.length) return null;
      const photo = pool[cursor % pool.length];
      cursor++;
      const url = URL.createObjectURL(photo.blob);
      urls.push(url);
      return {
        url,
        photoId: photo.id,             // 同じ写真の前回と比べるために持ち回る
        credit: { name: photo.name || '自分の写真', link: null, source: '自分でいれた写真' },
      };
    },
    prime() { return ensure(); },
    release() { urls.forEach(URL.revokeObjectURL); urls.length = 0; },
  };
}
