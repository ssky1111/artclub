# ARTCLUB Supabase

## プロジェクト

| 環境 | 名前 | project_id | 用途 |
| --- | --- | --- | --- |
| main | artclub main | `clifnylwatvtrikrfpft` | 本番 `artclub.space` |
| dev | ArtClub Dev | `fuggnreupdntutktient` | 開発・検証（`dev.artclub.space` / `localhost`） |

## フロントの接続先

`js/supabase.js` が `location.hostname` で切り替える。

| ホスト | 接続先 |
| --- | --- |
| `artclub.space` | main（本番） |
| `dev.artclub.space` | dev |
| `localhost` | dev |

未知のホストは接続拒否。ファイルを置いただけでは DB は変わらない。スキーマ変更は下の apply が必要。

## マイグレーション運用（apply）

**apply = 特定の Supabase プロジェクトに SQL を実行すること。**  
`supabase/migrations/*.sql` は正本。実行しないと DB には反映されない。dev と main は別プロジェクトなので、片方に当ててももう片方は自動では変わらない。

### やり方（どこから）

1. **エージェント（推奨）**  
   Supabase MCP の `apply_migration`  
   - `project_id`: `fuggnreupdntutktient`（dev）または `clifnylwatvtrikrfpft`（main）  
   - `name`: スネークケースの名前（例: `add_artworks_kind`）  
   - `query`: 該当 `.sql` の中身

2. **人手**  
   [Supabase Dashboard](https://supabase.com/dashboard) → 対象プロジェクト → **SQL Editor** → 同じ SQL を実行

### 新しい変更を足すとき

1. `supabase/migrations/YYYYMMDDHHMMSS_snake_name.sql` を追加
2. **dev** に apply
3. `dev.artclub.space`（または localhost）で確認
4. 問題なければ **main** にも同じ SQL を apply
5. コードと一緒に `dev` ブランチへマージ

- 正本は `supabase/migrations/*.sql`（タイムスタンプ順）
- `supabase/legacy/` は昔の手貼り SQL（参照用・新規実行しない）

### 現状の baseline

1. `profiles_artworks_likes`
2. `storage_artworks`
3. `storage_photos`
4. `user_prefs_sessions`
5. `admin_analytics`（`is_artclub_admin` + sessions 管理者読み取り）
6. `feedback`
