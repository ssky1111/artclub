-- Storage: photos バケット（お題写真 / admin アップロード）

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  true,
  10485760,
  array['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'application/json']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read" on storage.objects;
create policy "public read"
  on storage.objects for select
  using (bucket_id = 'photos');

drop policy if exists "anon insert" on storage.objects;
create policy "anon insert"
  on storage.objects for insert
  with check (bucket_id = 'photos');

drop policy if exists "anon update" on storage.objects;
create policy "anon update"
  on storage.objects for update
  using (bucket_id = 'photos');

drop policy if exists "anon delete" on storage.objects;
create policy "anon delete"
  on storage.objects for delete
  using (bucket_id = 'photos');
