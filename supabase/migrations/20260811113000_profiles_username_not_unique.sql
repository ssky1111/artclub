-- profiles.username は表示名。重複を許可する（一意制約は将来の handle 用に分ける）。
alter table public.profiles drop constraint if exists profiles_username_key;
