-- ARTCLUB artworks schema (Supabase SQL Editor で実行)
-- 既存テーブルを壊さず拡張する。

-- ---------- profiles（Auth ユーザーと 1:1） ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by everyone" on public.profiles;
create policy "profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "users can upsert own profile" on public.profiles;
create policy "users can upsert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------- artworks ----------
create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_id text not null,
  image_url text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.artworks
  add column if not exists session_id text,
  add column if not exists mode text,
  add column if not exists visibility text,
  add column if not exists username text,
  add column if not exists is_public boolean default true;

alter table public.artworks
  add column if not exists allow_copy boolean default false;

-- visibility が空なら is_public から埋める
update public.artworks
set visibility = case when coalesce(is_public, true) then 'public' else 'private' end
where visibility is null;

alter table public.artworks
  alter column visibility set default 'public';

do $$ begin
  alter table public.artworks
    add constraint artworks_visibility_check
    check (visibility in ('public', 'private'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_artworks_prompt on public.artworks(prompt_id, created_at desc);
create index if not exists idx_artworks_user on public.artworks(user_id, created_at desc);
create index if not exists idx_artworks_visibility on public.artworks(visibility, created_at desc);

alter table public.artworks enable row level security;

drop policy if exists "anyone can view" on public.artworks;
drop policy if exists "public or own artworks are viewable" on public.artworks;
create policy "public or own artworks are viewable"
  on public.artworks for select
  using (visibility = 'public' or auth.uid() = user_id);

drop policy if exists "auth users insert own" on public.artworks;
create policy "auth users insert own"
  on public.artworks for insert
  with check (auth.uid() = user_id);

drop policy if exists "owner can update" on public.artworks;
create policy "owner can update"
  on public.artworks for update
  using (auth.uid() = user_id);

drop policy if exists "owner can delete" on public.artworks;
create policy "owner can delete"
  on public.artworks for delete
  using (auth.uid() = user_id);

-- ---------- likes ----------
create table if not exists public.artwork_likes (
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (artwork_id, user_id)
);

create index if not exists idx_likes_artwork on public.artwork_likes(artwork_id);

alter table public.artwork_likes enable row level security;

drop policy if exists "likes are viewable by everyone" on public.artwork_likes;
create policy "likes are viewable by everyone"
  on public.artwork_likes for select using (true);

drop policy if exists "auth users like" on public.artwork_likes;
create policy "auth users like"
  on public.artwork_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "auth users unlike" on public.artwork_likes;
create policy "auth users unlike"
  on public.artwork_likes for delete
  using (auth.uid() = user_id);

-- ---------- Storage: artworks バケット ----------
-- 画像アップロード先。公開読み取り / ログインユーザーは自分のフォルダだけ書き込み。
-- （テーブル RLS だけでは足りず、ここが無いと投稿が黙って失敗する）

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artworks',
  'artworks',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "artworks public read" on storage.objects;
create policy "artworks public read"
  on storage.objects for select
  using (bucket_id = 'artworks');

drop policy if exists "artworks auth upload" on storage.objects;
create policy "artworks auth upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'artworks'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "artworks auth update" on storage.objects;
create policy "artworks auth update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'artworks'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'artworks'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "artworks auth delete" on storage.objects;
create policy "artworks auth delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'artworks'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

