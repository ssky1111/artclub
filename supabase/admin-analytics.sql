-- ARTCLUB 管理用 analytics（Supabase SQL Editor で実行）
-- 管理者 JWT（指定メール）が全ユーザーの practice_sessions を読めるようにする。

drop policy if exists "admins read all sessions" on public.practice_sessions;
create policy "admins read all sessions"
  on public.practice_sessions for select
  using (
    (auth.jwt() ->> 'email') in (
      'yuisskweb@gmail.com',
      'sayu.u.u.u.u@gmail.com'
    )
  );
