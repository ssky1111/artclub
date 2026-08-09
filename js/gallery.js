/**
 * gallery.js — みんなの作品ギャラリー
 *
 * 描き終わった後、同じお題を描いた他のユーザーの作品を閲覧できる。
 * 作品は Supabase Storage (artworks バケット) に画像を、
 * Supabase Database (artworks テーブル) にメタデータを保存する。
 *
 * RLS: 誰でも閲覧可能、自分の作品だけ投稿・削除可能。
 *
 * テーブル定義（Supabase SQL Editor で実行）:
 *
 *   create table public.artworks (
 *     id uuid primary key default gen_random_uuid(),
 *     user_id uuid not null references auth.users(id) on delete cascade,
 *     prompt_id text not null,
 *     image_url text not null,
 *     storage_path text not null,
 *     created_at timestamptz not null default now()
 *   );
 *   create index idx_artworks_prompt on public.artworks(prompt_id, created_at desc);
 *   create index idx_artworks_user on public.artworks(user_id);
 *
 *   alter table public.artworks enable row level security;
 *   create policy "anyone can view" on public.artworks for select using (true);
 *   create policy "auth users insert own" on public.artworks for insert
 *     with check (auth.uid() = user_id);
 *   create policy "owner can delete" on public.artworks for delete
 *     using (auth.uid() = user_id);
 *
 * Storage バケット "artworks" は public read, auth write で作成。
 */

import { SUPABASE_URL, SUPABASE_KEY } from './supabase.js';
import { getSession, getUser } from './auth.js';

const BUCKET = 'artworks';

function authHeaders() {
  const session = getSession();
  const token = session?.access_token || SUPABASE_KEY;
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

function publicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function shrinkForUpload(blob, maxSide = 1000, quality = 0.80) {
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

export async function uploadArtwork(drawingBlob, promptId, { isPublic = true } = {}) {
  const user = getUser();
  if (!user) throw new Error('not logged in');

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

  const row = {
    user_id: user.id,
    prompt_id: promptId,
    image_url: imageUrl,
    storage_path: path,
    is_public: isPublic,
  };

  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/artworks`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
  if (!dbRes.ok) {
    const text = await dbRes.text();
    throw new Error(`db insert failed: ${dbRes.status} ${text}`);
  }

  const [inserted] = await dbRes.json();
  return inserted;
}

export async function fetchArtworks(promptId, { limit = 50 } = {}) {
  const user = getUser();
  const userId = user?.id;
  const filter = userId
    ? `or=(is_public.eq.true,user_id.eq.${userId})`
    : 'is_public=eq.true';
  const params = new URLSearchParams({
    prompt_id: `eq.${promptId}`,
    order: 'created_at.desc',
    limit: String(limit),
  });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?${params}&${filter}`, {
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
  });
  if (!res.ok) return [];
  return await res.json();
}

export async function uploadShareImage(blob) {
  const user = getUser();
  if (!user) throw new Error('not logged in');
  const ts = Date.now();
  const path = `${user.id}/share-${ts}.webp`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'image/webp', 'x-upsert': 'true' },
    body: blob,
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  return publicUrl(path);
}

export async function deleteArtwork(id, storagePath) {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }).catch(() => {});

  await fetch(`${SUPABASE_URL}/rest/v1/artworks?id=eq.${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}
