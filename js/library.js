/**
 * library.js — お題の写真。
 *
 * 同梱写真＋Supabase 上の写真だけ。端末 IndexedDB への個人ライブラリは廃止。
 */

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

/** 端末ローカルのお題は持たない（互換のため空配列）。 */
export async function allPhotos() {
  return [];
}

export function invalidate() { /* no local photo cache */ }

/** 端末への取り込みは廃止。UI から呼ばれた場合は何もしない。 */
export async function addFiles() {
  return [];
}

export async function setTags() {
  return null;
}

export async function removePhoto() {
  /* no-op */
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

/** 同梱の写真＋Supabaseの写真。お題を出すときはこちらを使う。 */
export async function everyPhoto() {
  const [bundled, sb] = await Promise.all([
    bundledPhotos(),
    supabasePhotos().catch(() => []),
  ]);
  return [...bundled, ...sb];
}

/** タグでしぼる。タグを1つも選んでいなければ全部。 */
export async function photosWithTags(tags = []) {
  const photos = await everyPhoto();
  if (!tags.length) return photos;
  return photos.filter((p) => tags.every((t) => p.tags.includes(t)));
}

/** 表示用のURL。 */
export function photoUrl(photo) {
  return photo.blob ? URL.createObjectURL(photo.blob) : photo.url;
}

/** img にセット。本体 URL が死んでいたら fallbackUrl（WebP 対）を試す。 */
export function setPhotoSrc(img, photoOrUrl) {
  if (!img) return;
  if (typeof photoOrUrl === 'string') {
    img.src = photoOrUrl;
    return;
  }
  const primary = photoOrUrl?.blob ? URL.createObjectURL(photoOrUrl.blob) : photoOrUrl?.url;
  const fallback = photoOrUrl?.fallbackUrl || null;
  if (!primary) return;
  img.onerror = null;
  if (fallback && fallback !== primary) {
    img.onerror = () => {
      img.onerror = null;
      img.src = fallback;
    };
  }
  img.src = primary;
}

/**
 * セッション用のキュー。images.js のキューと同じ形で使える。
 * 同じ写真が続けて出ないよう、ひと回りしてから戻ってくるようにしている。
 */
export function createWeightedQueue(weights, onNotice = () => {}, { photos = null } = {}) {
  let pools = [];
  let loading = null;
  const urls = [];

  async function load() {
    const all = photos || await everyPhoto();
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
        fallbackUrl: photo.fallbackUrl || null,
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

export function createLibraryQueue(tags, onNotice = () => {}, noticeText = null, { photos = null } = {}) {
  let pool = [];
  let cursor = 0;
  let loading = null;
  const urls = [];

  async function load() {
    if (photos) {
      pool = tags?.length
        ? photos.filter((p) => tags.every((t) => p.tags.includes(t)))
        : [...photos];
    } else {
      pool = await photosWithTags(tags);
    }
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
        fallbackUrl: photo.fallbackUrl || null,
        photoId: photo.id,
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
