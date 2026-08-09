/**
 * supabase.js — Supabase Storage でお題写真を管理する。
 *
 * 写真は Supabase Storage の "photos" バケットに置く。
 * メタデータ（タグ・名前など）は同バケット内の manifest.json に保存。
 * SDK は使わず REST API を直接叩く。
 */

export const SUPABASE_URL = 'https://clifnylwatvtrikrfpft.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_kzKAxV0nVjU4ts-ewGHgRg_HmaQPFRj';
const BUCKET = 'photos';

function hdrs(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...extra,
  };
}

const storageUrl = (path) => `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
const publicUrl  = (path) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

let manifestCache = null;

/* ---------- manifest (メタデータ) ---------- */

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

export async function loadTagConfig() {
  if (tagConfig) return tagConfig;
  try {
    const res = await fetch(publicUrl(TAGS_FILE), { cache: 'reload' });
    if (!res.ok) return { custom: [], hidden: [] };
    const data = await res.json();
    if (Array.isArray(data)) return { custom: data, hidden: [] };
    return { custom: data.custom || [], hidden: data.hidden || [] };
  } catch {
    return { custom: [], hidden: [] };
  }
}

async function saveTagConfig(cfg) {
  tagConfig = cfg;
  const body = JSON.stringify(cfg);
  const res = await fetch(storageUrl(TAGS_FILE), {
    method: 'POST',
    headers: hdrs({
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    }),
    body,
  });
  if (!res.ok) throw new Error(`tags save failed: ${res.status}`);
  return cfg;
}

export async function loadCustomTags() {
  const cfg = await loadTagConfig();
  return cfg.custom;
}

export async function loadHiddenTags() {
  const cfg = await loadTagConfig();
  return cfg.hidden;
}

export async function saveCustomTags(tags) {
  const cfg = await loadTagConfig();
  cfg.custom = tags;
  return saveTagConfig(cfg);
}

export async function saveHiddenTags(hidden) {
  const cfg = await loadTagConfig();
  cfg.hidden = hidden;
  return saveTagConfig(cfg);
}

export function invalidateTagConfig() { tagConfig = null; }

/* ---------- 写真のアップロード ---------- */

export async function uploadPhoto(blob, id) {
  const ext = (blob.type || 'image/jpeg').includes('png') ? 'png' : 'jpg';
  const path = `${id}.${ext}`;

  const res = await fetch(storageUrl(path), {
    method: 'POST',
    headers: hdrs({
      'Content-Type': blob.type || 'image/jpeg',
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
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
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
    const ext = (photo.blob?.type || 'image/jpeg').includes('png') ? 'png' : 'jpg';
    const file = `${photo.id}.${ext}`;
    onProgress(++done, photos.length, photo);
    await uploadPhoto(photo.blob, photo.id);
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
  return entries.map((entry) => ({
    id: `sb:${entry.file}`,
    url: supabasePhotoUrl(entry),
    blob: null,
    tags: entry.tags || [],
    name: entry.name || entry.file,
    bundled: true,
    supabase: true,
    addedAt: entry.addedAt || 0,
  }));
}

export async function testConnection() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, {
    headers: hdrs(),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.json();
}
