-- 管理者向け: practice_sessions 全件読み取り
-- JWT に email が乗らない OAuth もあるので auth.users.email を見る

create or replace function public.is_artclub_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(u.email) in (
        'yuisskweb@gmail.com',
        'sayu.u.u.u.u@gmail.com'
      )
  );
$$;

revoke all on function public.is_artclub_admin() from public;
grant execute on function public.is_artclub_admin() to authenticated;

drop policy if exists "admins read all sessions" on public.practice_sessions;
create policy "admins read all sessions"
  on public.practice_sessions for select
  using (public.is_artclub_admin());
