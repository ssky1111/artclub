/**
 * gallery.js — みんなの作品ギャラリー / 個別作品
 *
 * 画像: Supabase Storage (artworks バケット)
 * メタ: Supabase Database (artworks / artwork_likes / profiles)
 *
 * スキーマは supabase/artworks.sql を参照。
 */

import { SUPABASE_URL, SUPABASE_KEY } from './supabase.js';
import { getSession, getUser, getUsername, ensureFreshSession } from './auth.js';

const BUCKET = 'artworks';
const SITE_ORIGIN = 'https://artclub.space';

function authHeaders(extra = {}) {
  const session = getSession();
  const token = session?.access_token || SUPABASE_KEY;
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

function publicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

export function workPageUrl(id) {
  return `${SITE_ORIGIN}/work/${id}`;
}

function shrinkForUpload(blob, maxSide = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
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
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

function normalizeArtwork(row) {
  if (!row) return null;
  const likes = Array.isArray(row.artwork_likes) ? row.artwork_likes : [];
  const likeCount = likes[0]?.count != null
    ? Number(likes[0].count)
    : (row.like_count != null ? Number(row.like_count) : 0);
  return {
    ...row,
    visibility: row.visibility || (row.is_public === false ? 'private' : 'public'),
    allow_copy: row.allow_copy === true,
    like_count: likeCount,
    liked_by_me: !!row.liked_by_me,
  };
}

/** プロフィールのユーザーネームを Auth ユーザーに同期する。 */
export async function upsertProfile(username) {
  const user = getUser();
  if (!user || !username) return null;
  const body = {
    id: user.id,
    username: String(username).trim().slice(0, 32),
    updated_at: new Date().toISOString(),
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    }),
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  return rows[0] || null;
}

/**
 * 作品を保存する。user_id は常にログイン中の Auth ユーザー。
 */
export async function uploadArtwork(drawingBlob, promptId, {
  isPublic = true,
  sessionId = null,
  mode = null,
  allowCopy = false,
} = {}) {
  await ensureFreshSession();
  const user = getUser();
  if (!user) throw new Error('not logged in');
  if (!promptId) throw new Error('prompt_id required');

  const compressed = await shrinkForUpload(drawingBlob);
  const ts = Date.now();
  const path = `${user.id}/${ts}.webp`;

  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
    },
    body: compressed,
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`upload failed: ${uploadRes.status} ${text}`);
  }

  const imageUrl = publicUrl(path);
  const visibility = isPublic ? 'public' : 'private';
  const fullRow = {
    user_id: user.id,
    prompt_id: promptId,
    image_url: imageUrl,
    storage_path: path,
    is_public: isPublic,
    visibility,
    session_id: sessionId,
    mode,
    username: getUsername() || user.email?.split('@')[0] || null,
    allow_copy: !!allowCopy,
  };
  const legacyRow = {
    user_id: user.id,
    prompt_id: promptId,
    image_url: imageUrl,
    storage_path: path,
    is_public: isPublic,
  };

  let dbRes = await fetch(`${SUPABASE_URL}/rest/v1/artworks`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(fullRow),
  });
  // マイグレーション前の古い列構成でも動くようにする
  if (!dbRes.ok) {
    dbRes = await fetch(`${SUPABASE_URL}/rest/v1/artworks`, {
      method: 'POST',
      headers: authHeaders({
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }),
      body: JSON.stringify(legacyRow),
    });
  }
  if (!dbRes.ok) {
    const text = await dbRes.text();
    throw new Error(`db insert failed: ${dbRes.status} ${text}`);
  }

  const [inserted] = await dbRes.json();
  return normalizeArtwork(inserted);
}

async function attachLikeState(works) {
  const user = getUser();
  if (!works.length) return works;
  const ids = works.map((w) => w.id).filter(Boolean);
  if (!ids.length) return works;

  let liked = new Set();
  if (user) {
    const params = new URLSearchParams({
      select: 'artwork_id',
      user_id: `eq.${user.id}`,
      artwork_id: `in.(${ids.join(',')})`,
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/artwork_likes?${params}`, {
      headers: authHeaders({ Accept: 'application/json' }),
    });
    if (res.ok) {
      const rows = await res.json();
      liked = new Set(rows.map((r) => r.artwork_id));
    }
  }

  return works.map((w) => ({
    ...w,
    liked_by_me: liked.has(w.id),
  }));
}

/** 同じお題の作品。新しい順。公開＋自分の非公開。 */
export async function fetchArtworks(promptId, { limit = 10 } = {}) {
  if (!promptId) return [];
  const base = {
    prompt_id: `eq.${promptId}`,
    order: 'created_at.desc',
    limit: String(limit),
  };
  let params = new URLSearchParams({ ...base, select: '*,artwork_likes(count)' });
  let res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?${params}`, {
    headers: authHeaders({ Accept: 'application/json' }),
  });
  // likes テーブル未作成時は素の一覧に落とす
  if (!res.ok) {
    params = new URLSearchParams({ ...base, select: '*' });
    res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?${params}`, {
      headers: authHeaders({ Accept: 'application/json' }),
    });
  }
  if (!res.ok) return [];
  const rows = (await res.json()).map(normalizeArtwork);
  return attachLikeState(rows);
}

/** みんなの公開作品（タイムライン用）。新しい順。 */
export async function fetchPublicArtworks({ limit = 40 } = {}) {
  let params = new URLSearchParams({
    order: 'created_at.desc',
    limit: String(Math.max(limit * 2, limit)),
    select: '*,artwork_likes(count)',
  });
  let res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?${params}`, {
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!res.ok) {
    params = new URLSearchParams({
      order: 'created_at.desc',
      limit: String(Math.max(limit * 2, limit)),
      select: '*',
    });
    res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?${params}`, {
      headers: authHeaders({ Accept: 'application/json' }),
    });
  }
  if (!res.ok) return [];
  // ログイン中は自分の非公開もRLSで見えるので、みんな用は公開だけ残す
  const rows = (await res.json()).map(normalizeArtwork)
    .filter((w) => w.visibility !== 'private' && w.is_public !== false)
    .slice(0, limit);
  return attachLikeState(rows);
}

/** 自分の作品（公開・非公開どちらも）。 */
export async function fetchMyArtworks({ limit = 60 } = {}) {
  const user = getUser();
  if (!user) return [];
  const base = {
    user_id: `eq.${user.id}`,
    order: 'created_at.desc',
    limit: String(limit),
  };
  let params = new URLSearchParams({ ...base, select: '*,artwork_likes(count)' });
  let res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?${params}`, {
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!res.ok) {
    params = new URLSearchParams({ ...base, select: '*' });
    res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?${params}`, {
      headers: authHeaders({ Accept: 'application/json' }),
    });
  }
  if (!res.ok) return [];
  const rows = (await res.json()).map(normalizeArtwork);
  return attachLikeState(rows);
}

export async function fetchArtwork(id) {
  if (!id) return null;
  const params = new URLSearchParams({
    select: '*,artwork_likes(count)',
    id: `eq.${id}`,
    limit: '1',
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?${params}`, {
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  const [work] = await attachLikeState(rows.map(normalizeArtwork));
  return work || null;
}

export async function toggleLike(artworkId, liked) {
  const user = getUser();
  if (!user) throw new Error('not logged in');

  if (liked) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/artwork_likes?artwork_id=eq.${artworkId}&user_id=eq.${user.id}`,
      { method: 'DELETE', headers: authHeaders() },
    );
    if (!res.ok) throw new Error(`unlike failed: ${res.status}`);
    return false;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/artwork_likes`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    body: JSON.stringify({ artwork_id: artworkId, user_id: user.id }),
  });
  if (!res.ok) throw new Error(`like failed: ${res.status}`);
  return true;
}

export async function uploadShareImage(blob) {
  const user = getUser();
  if (!user) throw new Error('not logged in');
  const compressed = await shrinkForUpload(blob);
  const ts = Date.now();
  const path = `${user.id}/share-${ts}.webp`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'image/webp', 'x-upsert': 'true' },
    body: compressed,
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  return publicUrl(path);
}

export async function deleteArtwork(id, storagePath) {
  if (storagePath) {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).catch(() => {});
  }

  await fetch(`${SUPABASE_URL}/rest/v1/artworks?id=eq.${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}
