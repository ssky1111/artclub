/**
 * library.js — お題の写真。
 *
 * 同梱写真＋Supabase 上の写真だけ。端末 IndexedDB への個人ライブラリは廃止。
 */

import { loadManifest, manifestPhotoUrl } from './repo.js';
import { supabasePhotos, loadCustomTags, loadRemovedTags } from './supabase.js';

/** よく使うタグ。これ以外も自由に足せる。 */
export const TAG_GROUPS = [
  { name: '範囲',   tags: ['全身', '半身', '顔', '手', '足'] },
  { name: '性別',   tags: ['女性', '男性', 'どちらでも'] },
  { name: '姿勢',   tags: ['立ち', '座り', '寝', '動き'] },
  { name: 'その他', tags: ['服のしわ', '筋肉が見える', '逆光', '難しい'] },
];

export const ALL_TAGS = TAG_GROUPS.flatMap((g) => g.tags);

let customTags = [];
let removedTags = [];

export async function refreshCustomTags() {
  customTags = await loadCustomTags();
  removedTags = await loadRemovedTags();
  return customTags;
}

export function getCustomTags() { return customTags; }

/** @deprecated */
export function getHiddenTags() { return []; }

export function getRemovedTags() { return removedTags; }

/** 使えるタグ一覧（削除済みは出さない） */
export function allTagsWithCustom() {
  const removed = new Set(removedTags);
  const base = ALL_TAGS.filter((t) => !removed.has(t));
  const extra = customTags.filter((t) => !ALL_TAGS.includes(t) && !removed.has(t));
  return [...base, ...extra];
}

/**
 * グループ付きの表示用タグ一覧。
 * 本タグから削除済みのものは出さない。カスタムは「その他」に足す。
 */
export function tagGroupsVisible() {
  const removed = new Set(removedTags);
  const customOnly = customTags.filter((t) => !ALL_TAGS.includes(t) && !removed.has(t));
  const groups = TAG_GROUPS
    .map((g) => ({ name: g.name, tags: g.tags.filter((t) => !removed.has(t)) }))
    .filter((g) => g.tags.length);
  if (customOnly.length) {
    const other = groups.find((g) => g.name === 'その他');
    if (other) other.tags = [...other.tags, ...customOnly];
    else groups.push({ name: 'その他', tags: customOnly });
  }
  return groups;
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

/** お題キューに出してよい写真か（非アクティブは一覧専用）。 */
export function isPromptActive(photo) {
  return !!photo && !photo.inactive;
}

/** 同梱の写真＋Supabaseの写真。一覧表示は非アクティブも含む。 */
export async function everyPhoto({ includeInactive = true } = {}) {
  const [bundled, sb] = await Promise.all([
    bundledPhotos(),
    supabasePhotos().catch(() => []),
  ]);
  const all = [...bundled, ...sb];
  return includeInactive ? all : all.filter(isPromptActive);
}

/** タグでしぼる（お題用なので非アクティブは除外）。タグを1つも選んでいなければ全部。 */
export async function photosWithTags(tags = []) {
  const photos = await everyPhoto({ includeInactive: false });
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

/** Fisher–Yates。偏りのある Array.sort(Math.random) は使わない。 */
function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * その人がまだ描いていないお題を先に、描いたことがあるものを後に並べる。
 * それぞれのグループ内はランダム。seenIds が空なら全体をシャッフル。
 */
export function orderPreferUnseen(pool, seenIds = null) {
  if (!pool?.length) return [];
  if (!seenIds?.size) return shuffle(pool);
  const unseen = [];
  const seen = [];
  for (const photo of pool) {
    (seenIds.has(photo.id) ? seen : unseen).push(photo);
  }
  return [...shuffle(unseen), ...shuffle(seen)];
}

/**
 * セッション用のキュー。images.js のキューと同じ形で使える。
 * 同じ写真が続けて出ないよう、ひと回りしてから戻ってくるようにしている。
 * seenIds があれば未実施のお題を優先する。
 */
export function createWeightedQueue(weights, onNotice = () => {}, { photos = null, seenIds = null } = {}) {
  let pools = [];
  let loading = null;
  const urls = [];

  async function load() {
    const all = (photos || await everyPhoto({ includeInactive: false }))
      .filter(isPromptActive);
    pools = weights.map(({ tags, weight }) => {
      const matched = all.filter((p) => tags.every((t) => p.tags.includes(t)));
      return { photos: orderPreferUnseen(matched, seenIds), weight, cursor: 0 };
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

export function createLibraryQueue(tags, onNotice = () => {}, noticeText = null, { photos = null, seenIds = null } = {}) {
  let pool = [];
  let cursor = 0;
  let loading = null;
  const urls = [];

  async function load() {
    if (photos) {
      const poolSource = photos.filter(isPromptActive);
      pool = tags?.length
        ? poolSource.filter((p) => tags.every((t) => p.tags.includes(t)))
        : [...poolSource];
    } else {
      pool = await photosWithTags(tags);
    }
    if (!pool.length) {
      onNotice(noticeText || 'その条件の写真がありません。写真の管理から追加してください');
    }
    pool = orderPreferUnseen(pool, seenIds);
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
