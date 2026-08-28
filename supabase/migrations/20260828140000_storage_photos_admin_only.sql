-- photos バケット: 読み取りは公開のまま、書き込みは管理者のみ
-- is_artclub_admin() は 20260811000005_admin_analytics.sql で定義済み

drop policy if exists "anon insert" on storage.objects;
drop policy if exists "anon update" on storage.objects;
drop policy if exists "anon delete" on storage.objects;

drop policy if exists "admins insert photos" on storage.objects;
create policy "admins insert photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos' and public.is_artclub_admin());

drop policy if exists "admins update photos" on storage.objects;
create policy "admins update photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'photos' and public.is_artclub_admin())
  with check (bucket_id = 'photos' and public.is_artclub_admin());

drop policy if exists "admins delete photos" on storage.objects;
create policy "admins delete photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos' and public.is_artclub_admin());
