-- feedback（右端タブ）

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message text not null check (char_length(message) between 1 and 4000),
  contact text,
  page_path text,
  user_id uuid references auth.users(id) on delete set null,
  username text,
  user_agent text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_feedback_created
  on public.feedback(created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "anyone insert feedback" on public.feedback;
create policy "anyone insert feedback"
  on public.feedback for insert
  with check (
    char_length(trim(message)) >= 1
    and char_length(message) <= 4000
  );

-- 管理者判定は is_artclub_admin()（JWT email 欠落対策）
drop policy if exists "admins read feedback" on public.feedback;
create policy "admins read feedback"
  on public.feedback for select
  using (public.is_artclub_admin());

grant insert on public.feedback to anon, authenticated;
grant select on public.feedback to authenticated;
