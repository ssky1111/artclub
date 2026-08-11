# ARTCLUB Supabase

## プロジェクト

| 環境 | 名前 | project_id | 用途 |
| --- | --- | --- | --- |
| main | artclub main | `clifnylwatvtrikrfpft` | 本番 `artclub.space` |
| dev | ArtClub Dev | `fuggnreupdntutktient` | 開発・検証 |

## マイグレーション運用

- 正本は `supabase/migrations/*.sql`（タイムスタンプ順）
- `supabase/legacy/` は昔の手貼り SQL（参照用・新規実行しない）
- **先に dev、確認後に main** へ当てる
- エージェントは Supabase MCP の `apply_migration` を使う
- 人手なら SQL Editor でも可（同じファイルを順に実行）

### 新しい変更を足すとき

1. `supabase/migrations/YYYYMMDDHHMMSS_snake_name.sql` を追加
2. dev に `apply_migration`
3. アプリ（dev 向けキー）で確認
4. 問題なければ main にも `apply_migration`
5. コードと一緒に `dev` ブランチへマージ

### 現状の baseline

1. `profiles_artworks_likes`
2. `storage_artworks`
3. `storage_photos`
4. `user_prefs_sessions`
5. `admin_analytics`（`is_artclub_admin` + sessions 管理者読み取り）
6. `feedback`

## フロントの接続先

いまの `js/supabase.js` は本番 URL/キー固定。
dev DB を使うときはキー差し替え（別途 `js/supabase.dev.js` やビルド無しの切替）を用意する。
