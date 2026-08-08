/**
 * images.js — お題の写真をどこから持ってくるか。
 *
 * 3系統:
 *   unsplash … Access Key を使って /photos/random からジャンル指定で取る（要キー）
 *   picsum   … Lorem Picsum。キー不要だがジャンル指定はできない
 *   local    … 端末内で選んだ画像
 *
 * どの系統でも同じ形の Photo を返す:
 *   { url, credit: { name, link, source }, downloadLocation? }
 */

import { CATEGORIES } from './theory.js';

const UNSPLASH_API = 'https://api.unsplash.com';
const UTM = 'utm_source=Croqui&utm_medium=referral';

/** 端末内の画像（設定画面で選ばれたもの）。リロードで消える。 */
export const localFiles = {
  items: [],
  set(files) {
    this.clear();
    this.items = [...files].map((file) => ({
      url: URL.createObjectURL(file),
      credit: { name: file.name, link: null, source: '端末内の画像' },
    }));
    return this.items.length;
  },
  clear() {
    for (const item of this.items) URL.revokeObjectURL(item.url);
    this.items = [];
  },
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function orientationParam(orientation) {
  return orientation === 'any' ? '' : `&orientation=${orientation}`;
}

async function fetchUnsplashBatch(key, category, orientation, count) {
  const query = encodeURIComponent(category.query);
  const url = `${UNSPLASH_API}/photos/random?query=${query}&count=${count}` +
              `&content_filter=high${orientationParam(orientation)}`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });

  if (res.status === 401) throw new UnsplashError('キーが正しくないようです', 'auth');
  if (res.status === 403) throw new UnsplashError('Unsplash の時間あたり上限に達しました', 'rate');
  if (!res.ok) throw new UnsplashError(`Unsplash からの応答エラー (${res.status})`, 'http');

  const data = await res.json();
  const list = Array.isArray(data) ? data : [data];
  return list.map((photo) => ({
    url: photo.urls.regular,
    credit: {
      name: photo.user?.name || 'Unknown',
      link: `${photo.user?.links?.html}?${UTM}`,
      source: 'Unsplash',
      photoLink: `${photo.links?.html}?${UTM}`,
    },
    downloadLocation: photo.links?.download_location || null,
    categoryId: category.id,
  }));
}

export class UnsplashError extends Error {
  constructor(message, kind) {
    super(message);
    this.kind = kind;
  }
}

/** Unsplash のガイドライン上、写真を「使った」時点で1回叩くことになっている。 */
function triggerDownload(photo, key) {
  if (!photo.downloadLocation || !key) return;
  fetch(photo.downloadLocation, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => {});
}

function picsumPhoto() {
  const seed = Math.random().toString(36).slice(2, 10);
  return {
    url: `https://picsum.photos/seed/${seed}/1200/1500`,
    credit: { name: 'おためしの写真', link: 'https://picsum.photos', source: 'Lorem Picsum' },
  };
}

/**
 * 写真キュー。先読みしておくので、タイマーが切り替わった瞬間に白画面にならない。
 * onNotice: 取得元をやむなく切り替えたときに呼ばれる（UI にトーストを出す用）。
 */
export function createPhotoQueue(settings, onNotice = () => {}, { queryOverride = null } = {}) {
  const buffer = [];
  const seen = new Set();
  let source = settings.source;
  let filling = null;

  // 解剖レッスン中は、選んだジャンルではなく部位（手・脚・足）で引く
  const categories = queryOverride
    ? [{ id: 'lesson', label: 'レッスン', query: queryOverride }]
    : CATEGORIES.filter((c) => settings.categories.includes(c.id));
  const activeCategories = categories.length ? categories : CATEGORIES;

  async function fill() {
    if (source === 'local') {
      if (!localFiles.items.length) {
        source = 'picsum';
        onNotice('端末の画像が選ばれていないので、おためしの写真を使います');
        return fill();
      }
      // ローカルは枚数が少ないので、シャッフルして詰め直す
      const shuffled = [...localFiles.items].sort(() => Math.random() - 0.5);
      buffer.push(...shuffled);
      return;
    }

    if (source === 'unsplash') {
      try {
        const batch = await fetchUnsplashBatch(
          settings.unsplashKey, pick(activeCategories), settings.orientation, 10,
        );
        const fresh = batch.filter((p) => !seen.has(p.url));
        fresh.forEach((p) => seen.add(p.url));
        buffer.push(...(fresh.length ? fresh : batch));
        return;
      } catch (err) {
        source = 'picsum';
        onNotice(`${err.message}。おためしの写真に切り替えます`);
      }
    }

    for (let i = 0; i < 10; i++) buffer.push(picsumPhoto());
  }

  function ensure() {
    if (buffer.length > 3 || filling) return filling || Promise.resolve();
    filling = fill().finally(() => { filling = null; });
    return filling;
  }

  return {
    get source() { return source; },

    /** 次の1枚。画像の読み込み完了まで待ってから返す。 */
    async next() {
      if (!buffer.length) await ensure();
      const photo = buffer.shift() || picsumPhoto();
      ensure();
      if (source === 'unsplash') triggerDownload(photo, settings.unsplashKey);
      await preload(photo.url).catch(() => {});
      return photo;
    },

    /** セッション開始前に先読みしておく。 */
    prime() { return ensure(); },
  };
}

export function preload(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

/** 設定画面の「接続テスト」用。 */
export async function testUnsplashKey(key) {
  const res = await fetch(`${UNSPLASH_API}/photos/random?count=1`, {
    headers: { Authorization: `Client-ID ${key}` },
  });
  if (res.status === 401) throw new UnsplashError('キーが違うようです', 'auth');
  if (res.status === 403) throw new UnsplashError('回数制限中です（1時間あたり上限）', 'rate');
  if (!res.ok) throw new UnsplashError(`エラー (${res.status})`, 'http');
  const remaining = res.headers.get('X-Ratelimit-Remaining');
  return { remaining };
}
