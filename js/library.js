/**
 * library.js — 自分でアップロードしたお題の写真。
 *
 * 検索APIから引いてくる写真は、狙ったものが出てこない（人物を頼んでも布や風景が出る）。
 * 自分で集めた写真にタグを付けて、そこから出題するほうが確実に早い。
 *
 * 写真は端末の IndexedDB に入る。外には出ない。
 */

import { putPhoto, getPhoto, listPhotos, deletePhoto, shrinkImage } from './db.js';
import { loadManifest, manifestPhotoUrl } from './repo.js';
import { supabasePhotos, loadCustomTags, loadHiddenTags } from './supabase.js';

/** よく使うタグ。これ以外も自由に足せる。 */
export const TAG_GROUPS = [
  { name: '範囲',   tags: ['全身', '半身', '顔', '手', '足'] },
  { name: '性別',   tags: ['女性', '男性', 'どちらでも'] },
  { name: '姿勢',   tags: ['立ち', '座り', '寝', '動き'] },
  { name: 'その他', tags: ['服のしわ', '筋肉が見える', '逆光', '難しい'] },
];

export const ALL_TAGS = TAG_GROUPS.flatMap((g) => g.tags);

let customTags = [];
let hiddenTags = [];

export async function refreshCustomTags() {
  customTags = await loadCustomTags();
  hiddenTags = await loadHiddenTags();
  return customTags;
}

export function getCustomTags() { return customTags; }
export function getHiddenTags() { return hiddenTags; }

export function allTagsWithCustom() {
  const all = [...ALL_TAGS, ...customTags.filter((t) => !ALL_TAGS.includes(t))];
  return all.filter((t) => !hiddenTags.includes(t));
}

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

/**
 * リポジトリに同梱されている写真も、端末の写真と同じ形にそろえて混ぜる。
 * 同梱側は消せないので bundled: true を立てておく。
 */
export async function bundledPhotos() {
  const entries = await loadManifest();
  return entries.map((entry) => ({
    id: `repo:${entry.file}`,
    url: manifestPhotoUrl(entry),
    blob: null,
    tags: entry.tags || [],
    name: entry.name || entry.file,
    source: entry.source || 'Unsplash',
    credit: entry.credit || null,
    bundled: true,
    addedAt: 0,
  }));
}

/** 端末の写真＋同梱の写真＋Supabaseの写真。お題を出すときはこちらを使う。 */
export async function everyPhoto({ fresh = false } = {}) {
  const [mine, bundled, sb] = await Promise.all([
    allPhotos({ fresh }),
    bundledPhotos(),
    supabasePhotos().catch(() => []),
  ]);
  return [...mine, ...bundled, ...sb];
}

/** タグでしぼる。タグを1つも選んでいなければ全部。 */
export async function photosWithTags(tags = []) {
  const photos = await everyPhoto();
  if (!tags.length) return photos;
  return photos.filter((p) => tags.every((t) => p.tags.includes(t)));
}

/** 表示用のURL。端末の写真は Blob から作り、同梱の写真はそのままのパス。 */
export function photoUrl(photo) {
  return photo.blob ? URL.createObjectURL(photo.blob) : photo.url;
}

/**
 * セッション用のキュー。images.js のキューと同じ形で使える。
 * 同じ写真が続けて出ないよう、ひと回りしてから戻ってくるようにしている。
 */
export function createWeightedQueue(weights, onNotice = () => {}) {
  let pools = [];
  let loading = null;
  const urls = [];

  async function load() {
    const all = await everyPhoto();
    pools = weights.map(({ tags, weight }) => {
      const matched = all.filter((p) => tags.every((t) => p.tags.includes(t)));
      matched.sort(() => Math.random() - 0.5);
      return { photos: matched, weight, cursor: 0 };
    });
    const total = pools.reduce((s, p) => s + p.photos.length, 0);
    if (!total) onNotice('その条件の写真がありません。写真の管理から追加してください');
  }

  function pick() {
    const available = pools.filter((p) => p.photos.length > 0);
    if (!available.length) return null;
    const totalWeight = available.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * totalWeight;
    for (const p of available) {
      r -= p.weight;
      if (r <= 0) {
        const photo = p.photos[p.cursor % p.photos.length];
        p.cursor++;
        return photo;
      }
    }
    const last = available[available.length - 1];
    const photo = last.photos[last.cursor % last.photos.length];
    last.cursor++;
    return photo;
  }

  function ensure() {
    if (pools.length || loading) return loading || Promise.resolve();
    loading = load().finally(() => { loading = null; });
    return loading;
  }

  return {
    async next() {
      await ensure();
      const photo = pick();
      if (!photo) return null;
      const url = photo.blob ? URL.createObjectURL(photo.blob) : photo.url;
      if (photo.blob) urls.push(url);
      return {
        url,
        photoId: photo.id,
        credit: photo.credit || {
          name: photo.name || (photo.bundled ? '同梱の写真' : '自分の写真'),
          link: null,
          source: photo.bundled ? (photo.source || 'Unsplash') : '自分でいれた写真',
        },
      };
    },
    dispose() { urls.forEach((u) => URL.revokeObjectURL(u)); },
  };
}

export function createLibraryQueue(tags, onNotice = () => {}, noticeText = null) {
  let pool = [];
  let cursor = 0;
  let loading = null;
  const urls = [];

  async function load() {
    pool = await photosWithTags(tags);
    if (!pool.length) {
      onNotice(noticeText || 'その条件の写真がありません。写真の管理から追加してください');
    }
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
      const url = photo.blob ? URL.createObjectURL(photo.blob) : photo.url;
      if (photo.blob) urls.push(url);
      return {
        url,
        photoId: photo.id,             // 同じ写真の前回と比べるために持ち回る
        credit: photo.credit || {
          name: photo.name || (photo.bundled ? '同梱の写真' : '自分の写真'),
          link: null,
          source: photo.bundled ? (photo.source || 'Unsplash') : '自分でいれた写真',
        },
      };
    },
    prime() { return ensure(); },
    release() { urls.forEach(URL.revokeObjectURL); urls.length = 0; },
  };
}
