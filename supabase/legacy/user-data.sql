-- ARTCLUB user data（Supabase SQL Editor で実行）
--
-- 端末 localStorage / IndexedDB をやめたあとの「アカウントに紐くデータ」の設計。
--
-- ========== どこまで DB に持つか ==========
--
-- 【必須・このファイル】
--   user_prefs ………… 設定 / 言語 / 復習カード / 軽いゲーム状態（1ユーザー1行）
--   practice_sessions … きろく本体（連続日数・分・Daily無料枠・ふりかえりメモ）
--
-- 【必須・別ファイル済み】
--   profiles …………… ユーザーネーム（supabase/artworks.sql）
--   artworks …………… スケッチ画像メタ（同上）+ Storage
--
-- 【持たない】
--   認証トークン ………… 端末 localStorage（artclub.auth）のみ
--   管理用シークレット … GitHub token / admin session（端末のみ）
--   ルーティング一時値 … sessionStorage（spaPath / reloading）
--   セッション中の未投稿キャンバス … メモリのみ（投稿後は artworks）
--   ゲストの履歴 ………… アカウント無しではクラウド不可（ログイン後に残る）
--   個人お題写真ライブラリ … プロダクトとして持たない（同梱 + 共有 Storage）
--
-- 【任意・いまは導出で足りる】
--   カレンダー表紙 …… practice_sessions.payload.shots[].artworkId と
--                       artworks.session_id から出せる。手動で表紙を選ぶ UI が
--                       必要になったら calendar_covers を追加する。
--
-- payload（jsonb）にはノート・shots・byDrill など可変フィールドを丸ごと入れる。
-- 集計でよく使う値だけ列に出してインデックスできるようにする。

-- ---------- user_prefs（1ユーザー1行） ----------
create table if not exists public.user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- テーマ / スキン / 効果音 / ペン濃さ / hintOpen など UI 設定一式
  settings jsonb not null default '{}'::jsonb,
  -- Leitner 復習カード { [lessonId]: { box, due, correct, ... } }
  cards jsonb not null default '{}'::jsonb,
  -- いまは seenLevel 程度。XP 自体は sessions から都度計算
  game jsonb not null default '{}'::jsonb,
  lang text not null default 'ja' check (lang in ('ja', 'en')),
  updated_at timestamptz not null default now()
);

alter table public.user_prefs enable row level security;

drop policy if exists "users read own prefs" on public.user_prefs;
create policy "users read own prefs"
  on public.user_prefs for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own prefs" on public.user_prefs;
create policy "users insert own prefs"
  on public.user_prefs for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own prefs" on public.user_prefs;
create policy "users update own prefs"
  on public.user_prefs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- practice_sessions（きろく） ----------
create table if not exists public.practice_sessions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  day_date date not null,
  ts bigint not null default 0,
  menu_id text,
  seconds integer not null default 0,
  drawing_count integer not null default 0,
  has_drawing boolean not null default false,
  -- 可変フィールド一式（note / shots / byDrill / sheetArtworkId など）
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 既存環境向け（create 済みテーブルに列を足す）
alter table public.practice_sessions add column if not exists menu_id text;
alter table public.practice_sessions add column if not exists seconds integer not null default 0;
alter table public.practice_sessions add column if not exists drawing_count integer not null default 0;
alter table public.practice_sessions add column if not exists has_drawing boolean not null default false;

create index if not exists idx_practice_sessions_user_day
  on public.practice_sessions(user_id, day_date desc);

create index if not exists idx_practice_sessions_user_ts
  on public.practice_sessions(user_id, ts desc);

create index if not exists idx_practice_sessions_user_menu_day
  on public.practice_sessions(user_id, menu_id, day_date desc);

alter table public.practice_sessions enable row level security;

drop policy if exists "users read own sessions" on public.practice_sessions;
create policy "users read own sessions"
  on public.practice_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own sessions" on public.practice_sessions;
create policy "users insert own sessions"
  on public.practice_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own sessions" on public.practice_sessions;
create policy "users update own sessions"
  on public.practice_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users delete own sessions" on public.practice_sessions;
create policy "users delete own sessions"
  on public.practice_sessions for delete
  using (auth.uid() = user_id);

-- API ロール（Supabase 既定でも通ることが多いが明示しておく）
grant select, insert, update, delete on public.user_prefs to authenticated;
grant select, insert, update, delete on public.practice_sessions to authenticated;
