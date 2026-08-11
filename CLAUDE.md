# ARTCLUB プロジェクト

## 基本ルール
- 日本語で会話する
- プッシュ前に必ずコードレビューを行う（動作確認ポイントを洗い出してからプッシュ）
- プッシュしたら **dev ブランチにマージ**まで行う（本番 `main` へのマージは人が判断する。例外は下の「リリース作業」）
- 作業の起点・PR の base は **dev**（指定がない限り）。`main` は本番用
- sayu.u.u.u.u@gmail.com と yuisskweb@gmail.com は管理者

## ブランチ運用
- `dev` … 開発・検証の統合先（エージェントのマージ先）
- `main` … 本番（`artclub.space`）。通常の feature マージ先にしない
- feature ブランチは `cursor/<name>-8d3b` 形式で作り、完了後に `dev` へマージ

## リリース作業（トリガー文言）

ユーザーが **「リリース作業を行って」**（同義: 「リリースして」「本番に出して」）と言ったら、コードだけ出さず次を **セットで** 実行する。

1. **差分確認** … `origin/dev` にあって `origin/main` に無いコミット／PR を洗い出す
2. **マイグレーション同期** … `supabase/migrations/` と Supabase MCP `list_migrations` で、本番（`clifnylwatvtrikrfpft`）に未適用のものを特定し、タイムスタンプ順に `apply_migration`（危険な変更なら止めて報告）
3. **コードを main へ** … `dev` → `main` の PR 作成（または既存のリリース PR 更新）→ レビューポイントを書いたうえで **main へマージ**まで行う（このトリガー時のみ main マージ可）
4. **報告** … 適用した migration 名、マージしたコミット／PR、確認してほしい点を短く返す

補足:
- DB を先に当ててからコードを出す（列追加など additive が原則）。削除系はコード先行が必要なので判断して順序を変える
- 教材 `photos` は本番 Storage 共有のため、リリースで Storage をコピーする必要はない
- 「リリース」と言わなければ、平时どおり `dev` まで。本番 apply / main マージはしない

## データベースを変えるとき（必須）

スキーマや RLS・Storage ポリシーを変える作業では、必ず:

1. `supabase/migrations/YYYYMMDDHHMMSS_snake_name.sql` を **新規追加**（正本。手貼りだけ・legacy への追加は禁止）
2. 先に **dev**（`fuggnreupdntutktient`）へ `apply_migration`
3. `dev.artclub.space` / localhost で確認
4. 本番への apply は **「リリース作業」と同時**（または明示指示があったとき）

「ちょっと SQL Editor で本番だけ直す」はしない。コード変更と schema 変更は同じ feature に載せる。

## 技術スタック
- 静的SPA（ビルドツールなし、vanilla ES modules）
- Supabase GoTrue REST API（認証）
- Supabase Storage & Database REST API（作品保存）
- IndexedDB（ローカル描画/写真保存）
- Service Worker（オフラインキャッシュ、PWA）
- DotGothic16フォント（日本語UI）、Special Gothic Expanded One（英語/ロゴ）

## Supabase スキーマ
- 正本は `supabase/migrations/*.sql`（dev → main の順で適用）
- 手順は `supabase/README.md`
- プロジェクト: main=`clifnylwatvtrikrfpft` / dev=`fuggnreupdntutktient`
- 旧手貼り SQL は `supabase/legacy/`（新規実行しない）
- DDL は Supabase MCP `apply_migration` か SQL Editor で当てる
- 教材 photos は常に本番 Storage（Auth/DB のみホスト切替）。詳細は `supabase/README.md`
