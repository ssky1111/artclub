-- user_prefs / practice_sessions（きろく・設定）

create table if not exists public.user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  cards jsonb not null default '{}'::jsonb,
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

create table if not exists public.practice_sessions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  day_date date not null,
  ts bigint not null default 0,
  menu_id text,
  seconds integer not null default 0,
  drawing_count integer not null default 0,
  has_drawing boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

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

grant select, insert, update, delete on public.user_prefs to authenticated;
grant select, insert, update, delete on public.practice_sessions to authenticated;
