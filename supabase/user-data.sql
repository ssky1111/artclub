-- ARTCLUB user data (Supabase SQL Editor で実行)
-- 練習履歴・設定・カレンダー表紙など、端末 localStorage に置いていたものを DB へ。

-- ---------- user_prefs（1ユーザー1行） ----------
create table if not exists public.user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  cards jsonb not null default '{}'::jsonb,
  game jsonb not null default '{}'::jsonb,
  lang text not null default 'ja',
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
  using (auth.uid() = user_id);

-- ---------- practice_sessions（きろく） ----------
create table if not exists public.practice_sessions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  day_date date not null,
  ts bigint not null default 0,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists idx_practice_sessions_user_day
  on public.practice_sessions(user_id, day_date desc);

create index if not exists idx_practice_sessions_user_ts
  on public.practice_sessions(user_id, ts desc);

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
  using (auth.uid() = user_id);

drop policy if exists "users delete own sessions" on public.practice_sessions;
create policy "users delete own sessions"
  on public.practice_sessions for delete
  using (auth.uid() = user_id);

-- ---------- calendar_covers（その日のマスに出すスケッチ） ----------
create table if not exists public.calendar_covers (
  user_id uuid not null references auth.users(id) on delete cascade,
  day_date date not null,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, day_date)
);

create index if not exists idx_calendar_covers_artwork
  on public.calendar_covers(artwork_id);

alter table public.calendar_covers enable row level security;

drop policy if exists "users read own covers" on public.calendar_covers;
create policy "users read own covers"
  on public.calendar_covers for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own covers" on public.calendar_covers;
create policy "users insert own covers"
  on public.calendar_covers for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own covers" on public.calendar_covers;
create policy "users update own covers"
  on public.calendar_covers for update
  using (auth.uid() = user_id);

drop policy if exists "users delete own covers" on public.calendar_covers;
create policy "users delete own covers"
  on public.calendar_covers for delete
  using (auth.uid() = user_id);
