-- ユーザーが決める一意 ID（表示名 username とは別）
alter table public.profiles
  add column if not exists handle text;

-- 未設定は NULL のまま。設定後は大小無視で一意
create unique index if not exists profiles_handle_lower_key
  on public.profiles (lower(handle));
