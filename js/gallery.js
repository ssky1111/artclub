/**
 * gallery.js — みんなのスケッチギャラリー / 個別スケッチ
 *
 * 画像: Supabase Storage (artworks バケット)
 * メタ: Supabase Database (artworks / artwork_likes / profiles)
 *
 * スキーマは supabase/artworks.sql を参照。
 */

import { SUPABASE_URL, SUPABASE_KEY } from './supabase.js';
import { getSession, getUser, getUsername, ensureFreshSession } from './auth.js';
import { brandForOgp } from './export.js';

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

export function workPageUrl(workOrId) {
  if (workOrId && typeof workOrId === 'object') {
    const key = workOrId.short_id || workOrId.id;
    return key ? `${SITE_ORIGIN}/work/${key}` : SITE_ORIGIN;
  }
  return workOrId ? `${SITE_ORIGIN}/work/${workOrId}` : SITE_ORIGIN;
}

/** URL用の短いID（8桁）。衝突したら呼び出し側で作り直す。 */
export function makeShortId(len = 8) {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = '';
  for (const b of bytes) out += alphabet[b % 62];
  return out;
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
    kind: row.kind || 'drawing',
    og_image_url: row.og_image_url || null,
  };
}

/** 表示名。自分の作品はプロフィール名を優先（「わたし」にはしない）。メールは出さない。 */
export function artworkDisplayName(work) {
  if (!work) return '';
  const clean = (name) => {
    const s = String(name || '').trim();
    return !s || s.includes('@') ? '' : s;
  };
  const me = getUser();
  const isMine = me?.id && work.user_id === me.id;
  if (isMine) {
    return clean(getUsername()) || clean(work.username) || '';
  }
  return clean(work.username) || 'anonymous';
}

/** プロフィールのユーザーネームを Auth ユーザーに同期する。 */
export async function upsertProfile(username) {
  const user = getUser();
  if (!user) return null;
  const cleaned = String(username || '').trim().slice(0, 32);
  if (cleaned.includes('@')) return null;
  const body = {
    id: user.id,
    username: cleaned || null,
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

/** 自分のプロフィールを DB から読む。別端末ログイン時のユーザーネーム復元用。 */
export async function fetchMyProfile() {
  const user = getUser();
  if (!user?.id) return null;
  const params = new URLSearchParams({
    select: 'id,username,updated_at',
    id: `eq.${user.id}`,
    limit: '1',
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?${params}`, {
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!res.ok) return null;
  const [row] = await res.json().catch(() => []);
  return row || null;
}

/**
 * スケッチを保存する。user_id は常にログイン中の Auth ユーザー。
 * kind: 'drawing' | 'sheet'
 * og_image_url: ARTCLUB 入りの OGP 用画像（別ファイル）
 */
export async function uploadArtwork(drawingBlob, promptId, {
  isPublic = true,
  sessionId = null,
  mode = null,
  allowCopy = false,
  kind = 'drawing',
} = {}) {
  await ensureFreshSession();
  const user = getUser();
  if (!user?.id) throw new Error('not logged in');
  if (!promptId) throw new Error('prompt_id required');

  const compressed = await shrinkForUpload(drawingBlob);
  const ts = Date.now();
  // 先頭のフォルダ名が自分の user id であることが Storage 側の許可条件
  const path = `${user.id}/${kind === 'sheet' ? 'sheet-' : ''}${ts}.webp`;

  const putImage = (body, objectPath, contentType) => fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`,
    {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': contentType },
      body,
    },
  );

  let uploadRes = await putImage(compressed, path, 'image/webp');
  // 弾かれたら、トークンが古かった可能性を潰してから1回だけやり直す
  if (uploadRes.status === 400 || uploadRes.status === 401 || uploadRes.status === 403) {
    await ensureFreshSession({ force: true });
    if (!getSession()?.access_token) {
      throw new Error('ログインの期限が切れました。ログインし直してから投稿してください。');
    }
    uploadRes = await putImage(compressed, path, 'image/webp');
  }
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    if (/row-level security|Unauthorized/i.test(text)) {
      throw new Error(
        'Storage のポリシーに拒否されました。Supabase の artworks バケットに '
        + 'supabase/storage-policies.sql のポリシーが入っているか確認してください。'
        + ` (${uploadRes.status} ${text})`,
      );
    }
    throw new Error(`upload failed: ${uploadRes.status} ${text}`);
  }

  const imageUrl = publicUrl(path);

  // OGP用（右下 ARTCLUB）。失敗しても本体投稿は通す
  let ogImageUrl = null;
  try {
    const branded = await brandForOgp(drawingBlob);
    if (branded) {
      const ogBlob = await shrinkForUpload(branded);
      const ogPath = `${user.id}/og-${ts}.jpg`;
      const ogRes = await putImage(ogBlob, ogPath, 'image/jpeg');
      if (ogRes.ok) ogImageUrl = publicUrl(ogPath);
    }
  } catch (err) {
    console.warn('[og brand]', err);
  }

  const visibility = isPublic ? 'public' : 'private';
  const shortId = makeShortId(8);
  const fullRow = {
    user_id: user.id,
    prompt_id: promptId,
    image_url: imageUrl,
    storage_path: path,
    is_public: isPublic,
    visibility,
    session_id: sessionId,
    mode,
    username: getUsername() || null,
    allow_copy: !!allowCopy,
    short_id: shortId,
    kind,
    og_image_url: ogImageUrl,
  };
  const legacyRow = {
    user_id: user.id,
    prompt_id: promptId,
    image_url: imageUrl,
    storage_path: path,
    is_public: isPublic,
    username: fullRow.username,
  };

  let dbRes = await fetch(`${SUPABASE_URL}/rest/v1/artworks`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(fullRow),
  });
  // short_id 衝突時は1回だけ作り直す
  if (!dbRes.ok) {
    const errText = await dbRes.text();
    if (/short_id|duplicate|unique/i.test(errText)) {
      fullRow.short_id = makeShortId(8);
      dbRes = await fetch(`${SUPABASE_URL}/rest/v1/artworks`, {
        method: 'POST',
        headers: authHeaders({
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(fullRow),
      });
    } else {
      // kind / og_image_url / short_id 未移行でも動くように段階的に落とす
      const midRow = { ...fullRow };
      delete midRow.og_image_url;
      delete midRow.kind;
      dbRes = await fetch(`${SUPABASE_URL}/rest/v1/artworks`, {
        method: 'POST',
        headers: authHeaders({
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(midRow),
      });
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
    }
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

/** 同じお題のスケッチ。新しい順。公開＋自分の非公開。 */
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
  const rows = (await res.json()).map(normalizeArtwork).filter((w) => w.kind !== 'sheet');
  return attachLikeState(rows);
}

/** みんなの公開スケッチ（タイムライン用）。新しい順。 */
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
    .filter((w) => w.kind !== 'sheet')
    .slice(0, limit);
  return attachLikeState(rows);
}

/**
 * 模写モード用。模写OKの公開スケッチを新しい順で1ページ分返す。
 * 自分の絵・非公開・まとめ画像は除く。いいね順は呼び出し側でプールして並べ替える。
 * @returns {{ works: object[], fetched: number }}
 */
export async function fetchCopyableArtworksPage({ limit = 40, offset = 0 } = {}) {
  const take = Math.max(1, limit);
  const base = {
    order: 'created_at.desc',
    limit: String(take),
    offset: String(Math.max(0, offset)),
  };
  let params = new URLSearchParams({
    ...base,
    allow_copy: 'eq.true',
    select: '*,artwork_likes(count)',
  });
  let res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?${params}`, {
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!res.ok) {
    params = new URLSearchParams({
      ...base,
      select: '*,artwork_likes(count)',
    });
    res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?${params}`, {
      headers: authHeaders({ Accept: 'application/json' }),
    });
  }
  if (!res.ok) {
    params = new URLSearchParams({ ...base, select: '*' });
    res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?${params}`, {
      headers: authHeaders({ Accept: 'application/json' }),
    });
  }
  if (!res.ok) return { works: [], fetched: 0 };

  const raw = await res.json();
  const fetched = Array.isArray(raw) ? raw.length : 0;
  const me = getUser()?.id;
  const rows = (raw || [])
    .map(normalizeArtwork)
    .filter((w) => w.visibility !== 'private' && w.is_public !== false)
    .filter((w) => w.kind !== 'sheet')
    .filter((w) => w.allow_copy === true)
    .filter((w) => !me || w.user_id !== me);

  return { works: await attachLikeState(rows), fetched };
}

/**
 * 模写モード用。模写OKの公開スケッチをいいね多い順で返す（先頭 limit 件）。
 * PostgREST では like 集計ソートが難しいので、多めに取ってクライアントで並べ替える。
 */
export async function fetchTopCopyableArtworks({ limit = 30 } = {}) {
  const take = Math.max(limit * 5, 100);
  const { works } = await fetchCopyableArtworksPage({ limit: take, offset: 0 });
  return works
    .sort((a, b) => {
      const likeDiff = (b.like_count || 0) - (a.like_count || 0);
      if (likeDiff) return likeDiff;
      return new Date(b.created_at) - new Date(a.created_at);
    })
    .slice(0, limit);
}

/** 自分のスケッチ（公開・非公開どちらも）。 */
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
  const rows = (await res.json()).map(normalizeArtwork).filter((w) => w.kind !== 'sheet');
  return attachLikeState(rows);
}

export async function fetchArtwork(id) {
  if (!id) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const params = new URLSearchParams({
    select: '*,artwork_likes(count)',
    limit: '1',
  });
  params.set(isUuid ? 'id' : 'short_id', `eq.${id}`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?${params}`, {
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  // short_id 未移行の古いリンク用に uuid でもう一度
  if (!rows.length && !isUuid) {
    const fallback = new URLSearchParams({
      select: '*,artwork_likes(count)',
      id: `eq.${id}`,
      limit: '1',
    });
    const res2 = await fetch(`${SUPABASE_URL}/rest/v1/artworks?${fallback}`, {
      headers: authHeaders({ Accept: 'application/json' }),
    });
    if (!res2.ok) return null;
    const rows2 = await res2.json();
    const [work2] = await attachLikeState(rows2.map(normalizeArtwork));
    return work2 || null;
  }
  const [work] = await attachLikeState(rows.map(normalizeArtwork));
  return work || null;
}

export async function updateArtwork(id, patch) {
  if (!id || !patch || !Object.keys(patch).length) return null;
  await ensureFreshSession();
  const user = getUser();
  if (!user?.id) throw new Error('not logged in');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?id=eq.${id}`, {
    method: 'PATCH',
    headers: authHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`artwork update failed: ${res.status} ${text}`);
  }
  const rows = await res.json().catch(() => []);
  return normalizeArtwork(rows[0] || null);
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
  await ensureFreshSession();
  const user = getUser();
  if (!user?.id) throw new Error('not logged in');
  const compressed = await shrinkForUpload(blob);
  const ts = Date.now();
  const path = `${user.id}/share-${ts}.webp`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'image/webp' },
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
