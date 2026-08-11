-- Storage: artworks バケット（投稿画像）

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artworks',
  'artworks',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "artworks public read" on storage.objects;
create policy "artworks public read"
  on storage.objects for select
  using (bucket_id = 'artworks');

drop policy if exists "artworks auth upload" on storage.objects;
create policy "artworks auth upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'artworks'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "artworks auth update" on storage.objects;
create policy "artworks auth update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'artworks'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'artworks'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "artworks auth delete" on storage.objects;
create policy "artworks auth delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'artworks'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
