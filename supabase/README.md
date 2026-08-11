# ARTCLUB Supabase

## プロジェクト

| 環境 | 名前 | project_id | 用途 |
| --- | --- | --- | --- |
| main | artclub main | `clifnylwatvtrikrfpft` | 本番 `artclub.space` |
| dev | ArtClub Dev | `fuggnreupdntutktient` | 開発・検証（`dev.artclub.space` / `localhost`） |

## フロントの接続先

`js/supabase.js` が `location.hostname` で切り替える。

| ホスト | Auth / DB | 教材 photos |
| --- | --- | --- |
| `artclub.space` | main（本番） | **本番 Storage（共有）** |
| `dev.artclub.space` | dev | **本番 Storage（共有）** |
| `localhost` | dev | **本番 Storage（共有）** |

未知のホストは接続拒否。教材のアップロード・削除・タグも本番 `photos` に直接触る（二重管理しない）。  
ユーザー作品の `artworks` など DB 側は環境ごと。

## マイグレーション運用（apply）

**apply = 特定の Supabase プロジェクトに SQL を実行すること。**  
DB を変えるときは必ず `supabase/migrations/*.sql` を新規追加する。legacy や SQL Editor だけの本番直書きはしない。

### やり方

1. **エージェント** … Supabase MCP の `apply_migration`（`list_migrations` で未適用確認）
2. **人手** … Dashboard → 対象プロジェクト → SQL Editor

### 新しい変更を足すとき

1. `supabase/migrations/YYYYMMDDHHMMSS_snake_name.sql` を追加
2. **dev** に apply → `dev.artclub.space` で確認
3. コードは `dev` へマージ
4. 本番 apply は **「リリース作業を行って」** と同時（コードの `dev`→`main` とセット）

### リリース時（「リリース作業を行って」）

1. `list_migrations` で本番の未適用を特定
2. 未適用をタイムスタンプ順に本番へ `apply_migration`
3. `dev` → `main` のコードマージ
4. 適用した migration とマージ結果を報告

### 現状の baseline

1. `profiles_artworks_likes`
2. `storage_artworks`
3. `storage_photos`
4. `user_prefs_sessions`
5. `admin_analytics`（`is_artclub_admin` + sessions 管理者読み取り）
6. `feedback`
