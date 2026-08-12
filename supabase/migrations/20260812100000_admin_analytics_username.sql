-- OAuth で email が JWT に載らない管理者向け（profiles.username）

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
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and trim(p.username) in ('しゃお')
  );
$$;

revoke all on function public.is_artclub_admin() from public;
grant execute on function public.is_artclub_admin() to authenticated;
