/**
 * supabase.js — Supabase Storage でお題写真を管理する。
 *
 * 写真は Supabase Storage の "photos" バケットに置く。
 * メタデータ（タグ・名前など）は同バケット内の manifest.json / custom-tags.json に保存。
 * SDK は使わず REST API を直接叩く。
 *
 * Auth / DB はホストごとに切替。教材の photos・manifest・タグは常に本番 Storage を共有する
 *（dev / localhost でも二重管理しない）。
 */

const PROD = {
  url: 'https://clifnylwatvtrikrfpft.supabase.co',
  key: 'sb_publishable_kzKAxV0nVjU4ts-ewGHgRg_HmaQPFRj',
};
const DEV = {
  url: 'https://fuggnreupdntutktient.supabase.co',
  key: 'sb_publishable_vs2GFcc2mV1yjGCZkRIyNA_YP0ocE_l',
};

const ENV_MAP = {
  'artclub.space':     PROD,
  'dev.artclub.space': DEV,
  'localhost':         DEV,
};
const env = ENV_MAP[location.hostname];
if (!env) throw new Error(`Unknown host: ${location.hostname} — Supabase 接続を拒否しました`);

/** Auth / REST（環境ごと） */
export const SUPABASE_URL = env.url;
export const SUPABASE_KEY = env.key;

/** 教材 photos / manifest / タグ（常に本番） */
export const PHOTOS_URL = PROD.url;
export const PHOTOS_KEY = PROD.key;

const BUCKET = 'photos';

function hdrs(extra = {}) {
  return {
    apikey: PHOTOS_KEY,
    Authorization: `Bearer ${PHOTOS_KEY}`,
    ...extra,
  };
}

const storageUrl = (path) => `${PHOTOS_URL}/storage/v1/object/${BUCKET}/${path}`;
const publicUrl  = (path) => `${PHOTOS_URL}/storage/v1/object/public/${BUCKET}/${path}`;

let manifestCache = null;

/* ---------- manifest (メタデータ) ---------- */

/** WebP 変換後の対になるパス（pxxx.jpg → pxxx.webp）。 */
export function webpTwin(file) {
  return typeof file === 'string' ? file.replace(/\.(jpe?g|png)$/i, '.webp') : file;
}

/**
 * manifest が古い拡張子のまま残っている条目を、Storage 上の .webp に合わせて直す。
 * WebP 変換で JPG を消したあと manifest 保存だけ失敗したケースの復旧用。
 */
export async function repairManifestExtensions() {
  const entries = await loadManifest({ fresh: true });
  let changed = 0;
  for (const entry of entries) {
    if (!entry?.file || !/\.(jpe?g|png)$/i.test(entry.file)) continue;
    const twin = webpTwin(entry.file);
    const [oldRes, twinRes] = await Promise.all([
      fetch(publicUrl(entry.file), { method: 'HEAD', cache: 'reload' }).catch(() => null),
      fetch(publicUrl(twin), { method: 'HEAD', cache: 'reload' }).catch(() => null),
    ]);
    const oldOk = !!oldRes?.ok;
    const twinOk = !!twinRes?.ok;
    if (!oldOk && twinOk) {
      entry.file = twin;
      changed++;
    }
  }
  if (changed) await saveManifest(entries);
  return changed;
}

export async function loadManifest({ fresh = false } = {}) {
  if (manifestCache && !fresh) return manifestCache;
  try {
    const res = await fetch(publicUrl('manifest.json'), { cache: fresh ? 'reload' : 'default' });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    manifestCache = Array.isArray(data?.photos) ? data.photos : [];
  } catch {
    manifestCache = [];
  }
  return manifestCache;
}

async function saveManifest(entries) {
  const body = JSON.stringify({
    version: 1,
    updatedAt: new Date().toISOString(),
    photos: entries,
  }, null, 2);

  const res = await fetch(storageUrl('manifest.json'), {
    method: 'POST',
    headers: hdrs({
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    }),
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`manifest save failed: ${res.status} ${text}`);
  }
  manifestCache = entries;
  return entries;
}

/* ---------- カスタムタグ ---------- */

const TAGS_FILE = 'custom-tags.json';

let tagConfig = null;

function normalizeTagConfig(data) {
  if (Array.isArray(data)) return { custom: data, removed: [] };
  const custom = Array.isArray(data?.custom) ? data.custom : [];
  // 旧 hidden は「削除済み」として引き継ぐ（復元UIは出さない）
  const removed = [...new Set([
    ...(Array.isArray(data?.removed) ? data.removed : []),
    ...(Array.isArray(data?.hidden) ? data.hidden : []),
  ])].filter((t) => t && !custom.includes(t));
  return { custom, removed };
}

export async function loadTagConfig() {
  if (tagConfig) return tagConfig;
  try {
    const res = await fetch(publicUrl(TAGS_FILE), { cache: 'reload' });
    if (!res.ok) {
      tagConfig = { custom: [], removed: [] };
      return tagConfig;
    }
    const data = await res.json();
    tagConfig = normalizeTagConfig(data);
    return tagConfig;
  } catch {
    tagConfig = { custom: [], removed: [] };
    return tagConfig;
  }
}

async function saveTagConfig(cfg) {
  const next = {
    custom: Array.isArray(cfg.custom) ? cfg.custom : [],
    removed: Array.isArray(cfg.removed) ? cfg.removed : [],
  };
  tagConfig = next;
  const res = await fetch(storageUrl(TAGS_FILE), {
    method: 'POST',
    headers: hdrs({
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    }),
    body: JSON.stringify(next),
  });
  if (!res.ok) throw new Error(`tags save failed: ${res.status}`);
  return tagConfig;
}

export async function loadCustomTags() {
  const cfg = await loadTagConfig();
  return cfg.custom;
}

export async function loadRemovedTags() {
  const cfg = await loadTagConfig();
  return cfg.removed || [];
}

export async function saveCustomTags(tags, { revive = [] } = {}) {
  const cfg = await loadTagConfig();
  const custom = tags || [];
  const reviveSet = new Set(revive);
  const removed = (cfg.removed || []).filter((t) => !custom.includes(t) && !reviveSet.has(t));
  return saveTagConfig({ custom, removed });
}

export function invalidateTagConfig() { tagConfig = null; }

/**
 * タグを Storage から本削除する。
 * - 全写真の manifest.tags から外す
 * - カスタム一覧から外す
 * - 組み込みタグも一覧に出さないよう removed に入れる
 * @returns {{ photos: number }}
 */
export async function deleteTagEverywhere(tag) {
  const name = String(tag || '').trim();
  if (!name) return { photos: 0 };

  const entries = await loadManifest({ fresh: true });
  let photos = 0;
  for (const entry of entries) {
    if (!Array.isArray(entry.tags) || !entry.tags.includes(name)) continue;
    entry.tags = entry.tags.filter((t) => t !== name);
    photos++;
  }
  if (photos) await saveManifest(entries);

  invalidateTagConfig();
  const cfg = await loadTagConfig();
  const nextCustom = (cfg.custom || []).filter((t) => t !== name);
  const nextRemoved = [...new Set([...(cfg.removed || []), name])];
  await saveTagConfig({ custom: nextCustom, removed: nextRemoved });

  return { photos };
}

/* ---------- 写真のアップロード ---------- */

/** アップロードは WebP 前提。旧データ互換で type を見る。 */
function extForBlob(blob) {
  const type = blob?.type || '';
  if (type.includes('webp')) return 'webp';
  if (type.includes('png')) return 'png';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  return 'webp';
}

export async function uploadPhoto(blob, id) {
  const ext = extForBlob(blob);
  const path = `${id}.${ext}`;
  const contentType = blob.type || (ext === 'webp' ? 'image/webp' : `image/${ext === 'jpg' ? 'jpeg' : ext}`);

  const res = await fetch(storageUrl(path), {
    method: 'POST',
    headers: hdrs({
      'Content-Type': contentType,
      'x-upsert': 'true',
    }),
    body: blob,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upload failed: ${res.status} ${text}`);
  }
  return { path, url: publicUrl(path) };
}

export async function deletePhotoFromStorage(path) {
  const res = await fetch(`${PHOTOS_URL}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: hdrs({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: [path] }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`delete failed: ${res.status} ${text}`);
  }
}

/* ---------- まとめて操作 ---------- */

export async function pushToSupabase(photos, onProgress = () => {}) {
  const existing = await loadManifest({ fresh: true });
  const byFile = new Map(existing.map((e) => [e.file, e]));

  let done = 0;
  for (const photo of photos) {
    onProgress(++done, photos.length, photo);
    // shrinkImage 済みの WebP を上げ、manifest も必ず .webp で書く
    const { path: file } = await uploadPhoto(photo.blob, photo.id);
    const stem = photo.id;
    for (const key of [...byFile.keys()]) {
      if (key.replace(/\.[^.]+$/, '') === stem) byFile.delete(key);
    }
    byFile.set(file, {
      file,
      tags: photo.tags || [],
      name: photo.name || null,
      addedAt: photo.addedAt || Date.now(),
    });
  }

  const entries = [...byFile.values()];
  await saveManifest(entries);
  return entries;
}

export async function updateTags(file, tags) {
  const entries = await loadManifest({ fresh: true });
  const entry = entries.find((e) => e.file === file);
  if (entry) {
    entry.tags = tags;
    await saveManifest(entries);
  }
  return entries;
}

export async function bulkUpdateTags(files, tags) {
  const entries = await loadManifest({ fresh: true });
  for (const file of files) {
    const entry = entries.find((e) => e.file === file);
    if (entry) entry.tags = [...new Set([...entry.tags, ...tags])];
  }
  await saveManifest(entries);
  return entries;
}

export async function bulkRemoveTags(files, tags) {
  const entries = await loadManifest({ fresh: true });
  for (const file of files) {
    const entry = entries.find((e) => e.file === file);
    if (entry) entry.tags = entry.tags.filter((t) => !tags.includes(t));
  }
  await saveManifest(entries);
  return entries;
}

export async function removeFromSupabase(file) {
  await deletePhotoFromStorage(file);
  const entries = await loadManifest({ fresh: true });
  const next = entries.filter((e) => e.file !== file);
  await saveManifest(next);
  return next;
}

export function supabasePhotoUrl(entry) {
  return publicUrl(entry.file);
}

export async function supabasePhotos() {
  const entries = await loadManifest();
  return entries.map((entry) => {
    const file = entry.file;
    const twin = webpTwin(file);
    return {
      id: `sb:${file}`,
      url: publicUrl(file),
      // manifest が .jpg のまま・実体は .webp、というズレへの保険
      fallbackUrl: twin !== file ? publicUrl(twin) : null,
      blob: null,
      tags: entry.tags || [],
      name: entry.name || file,
      bundled: true,
      supabase: true,
      addedAt: entry.addedAt || 0,
      file,
    };
  });
}

export async function convertToWebp(entry, maxSide = 1000, quality = 0.82) {
  const oldPath = entry.file;
  const id = oldPath.replace(/\.[^.]+$/, '');
  const newPath = `${id}.webp`;

  // 旧ファイルが既に消えていて .webp だけ残っている場合でも、manifest を直せるようにする
  let srcBlob = null;
  for (const path of [oldPath, newPath, webpTwin(oldPath)]) {
    const res = await fetch(publicUrl(path), { cache: 'reload' });
    if (res.ok) {
      srcBlob = await res.blob();
      break;
    }
  }
  if (!srcBlob) throw new Error(`fetch failed: ${oldPath}`);

  // 既に WebP なら再エンコードせず、manifest のファイル名だけ直す
  const alreadyWebp = (srcBlob.type || '').includes('webp') || oldPath === newPath;
  const webpBlob = alreadyWebp && oldPath.endsWith('.webp')
    ? srcBlob
    : await new Promise((resolve, reject) => {
      const img = new Image();
      const u = URL.createObjectURL(srcBlob);
      img.onload = () => {
        URL.revokeObjectURL(u);
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('encode failed'))),
          'image/webp',
          quality,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(u); reject(new Error('decode failed')); };
      img.src = u;
    });

  if (!(alreadyWebp && oldPath === newPath)) {
    const up = await fetch(storageUrl(newPath), {
      method: 'POST',
      headers: hdrs({ 'Content-Type': 'image/webp', 'x-upsert': 'true' }),
      body: webpBlob,
    });
    if (!up.ok) {
      const text = await up.text();
      throw new Error(`upload failed: ${up.status} ${text}`);
    }
  }

  // 先に manifest を直してから旧 JPG を消す（逆だと、保存失敗時に写真アイコン地獄になる）
  const entries = await loadManifest({ fresh: true });
  const stem = id;
  let touched = false;
  for (const e of entries) {
    if (!e?.file) continue;
    const eStem = e.file.replace(/\.[^.]+$/, '');
    if (e.file === oldPath || e.file === newPath || eStem === stem) {
      if (e.file !== newPath) {
        e.file = newPath;
        touched = true;
      }
    }
  }
  if (touched || !entries.some((e) => e.file === newPath)) {
    // loadManifest の自動 heal で既に直っている場合もある
    if (touched) await saveManifest(entries);
  }

  if (newPath !== oldPath) {
    await fetch(`${PHOTOS_URL}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: hdrs({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: [oldPath] }),
    }).catch(() => {});
  }

  return newPath;
}

export async function testConnection() {
  const res = await fetch(`${PHOTOS_URL}/storage/v1/bucket/${BUCKET}`, {
    headers: hdrs(),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.json();
}
