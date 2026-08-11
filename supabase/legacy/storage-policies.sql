-- ARTCLUB / Storage（artworks バケット）のポリシーだけを入れ直す。
--
-- 「new row violates row-level security policy」で投稿が失敗するときは、
-- ここが入っていないのが原因。Supabase ダッシュボード → SQL Editor に
-- 貼って実行する。artworks.sql の Storage 部分と同じ内容。
--
-- ※ storage.objects へのポリシー作成が権限エラー（must be owner of table
--   objects）になる場合は、SQL ではなくダッシュボードの
--   Storage → artworks → Policies から同じ条件で作る。

-- ---------- バケット ----------
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

-- ---------- ポリシー ----------
-- 読み取りは誰でも。書き込みはログイン済みユーザーが「自分の user id の
-- フォルダ」にだけ。アプリは <user_id>/<timestamp>.webp というパスで上げる。

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

-- ---------- 確認 ----------
-- 実行後、これで4件（public read / auth upload / auth update / auth delete）
-- 返ってくれば入っている。
select policyname, cmd, roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'artworks%'
order by policyname;
