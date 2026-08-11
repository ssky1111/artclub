-- ARTCLUB: artworks.kind を本番に追加（Supabase SQL Editor で実行）
-- drawing = 通常スケッチ / sheet = まとめ画
-- 未実行だと解析・ギャラリーが kind 前提のクエリで落ちることがある。

alter table public.artworks
  add column if not exists kind text default 'drawing';

-- 既存行の埋める（まとめ画は prompt_id / パスで判定）
update public.artworks
set kind = 'sheet'
where coalesce(kind, 'drawing') = 'drawing'
  and (
    prompt_id like '%:sheet'
    or prompt_id like '%:sheet:%'
    or storage_path like '%/sheet-%'
  );

update public.artworks
set kind = 'drawing'
where kind is null;

-- 値の制約（既存不正値があれば先に直す）
do $$ begin
  alter table public.artworks
    drop constraint if exists artworks_kind_check;
  alter table public.artworks
    add constraint artworks_kind_check
    check (kind in ('drawing', 'sheet'));
exception when others then null;
end $$;

create index if not exists idx_artworks_kind
  on public.artworks (kind, created_at desc);
