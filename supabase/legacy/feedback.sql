-- ARTCLUB feedback（Supabase SQL Editor で実行）
-- 右端タブの吹き出しフォームから INSERT。中身は管理者が読む。
-- メール通知: worker/feedback-mail をデプロイし、
--   フロントからの POST または Database Webhook（Insert → /api/feedback-mail）で送る。

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

-- 誰でも送れる（ログイン不要）
drop policy if exists "anyone insert feedback" on public.feedback;
create policy "anyone insert feedback"
  on public.feedback for insert
  with check (
    char_length(trim(message)) >= 1
    and char_length(message) <= 4000
  );

-- 管理者だけ読める（JWT の email）
drop policy if exists "admins read feedback" on public.feedback;
create policy "admins read feedback"
  on public.feedback for select
  using (
    (auth.jwt() ->> 'email') in (
      'yuisskweb@gmail.com',
      'sayu.u.u.u.u@gmail.com'
    )
  );

grant insert on public.feedback to anon, authenticated;
grant select on public.feedback to authenticated;
