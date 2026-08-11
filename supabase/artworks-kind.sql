-- ARTCLUB: 本番 artworks の不足カラムを追加（Supabase SQL Editor で実行）
-- kind: drawing = 通常スケッチ / sheet = まとめ画
-- short_id: 共有 URL 用の短い ID
-- 未実行だと投稿が legacy に落ちて session_id/mode が消え、解析が枚数カウントになる。

alter table public.artworks
  add column if not exists kind text default 'drawing';

alter table public.artworks
  add column if not exists short_id text;

alter table public.artworks
  add column if not exists og_image_url text;

-- 既存行の kind を埋める（まとめ画は prompt_id / パスで判定）
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

-- short_id が空なら uuid から仮埋め
update public.artworks
set short_id = substr(replace(id::text, '-', ''), 1, 8)
where short_id is null;

do $$ begin
  alter table public.artworks
    drop constraint if exists artworks_kind_check;
  alter table public.artworks
    add constraint artworks_kind_check
    check (kind in ('drawing', 'sheet'));
exception when others then null;
end $$;

create unique index if not exists idx_artworks_short_id on public.artworks(short_id);
create index if not exists idx_artworks_kind
  on public.artworks (kind, created_at desc);
