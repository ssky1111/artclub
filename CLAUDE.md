# DrawParty プロジェクト

## 基本ルール
- 日本語で会話する
- プッシュ前に必ずコードレビューを行う（動作確認ポイントを洗い出してからプッシュ）
- **作業の流れは必ず `feature → dev`。`main` に直接マージしない**
- プッシュしたら **dev ブランチにマージ**まで行う（ここで止める）
- **`main` へのマージ／本番公開は、ユーザーが明示したときだけ**（「mainに公開」「本番に出して」等）。「マージして」だけでは **dev へのマージ**と解釈する。言われていない限り `main` には触らない
- 作業の起点・PR の base は **dev**（指定がない限り）
- sayu.u.u.u.u@gmail.com と yuisskweb@gmail.com は管理者

## ブランチ運用
- `dev` … 開発・検証の統合先（エージェントの通常マージ先。ここまでが完了）
- `main` … 本番（`artclub.space`）。**明示指示があるときだけ** `dev` から公開する
- feature ブランチは `cursor/<name>-8d3b` 形式で作り、完了後に **dev へマージ**（main へは直接出さない）
- 誤って main 向け PR を作ったら、base を **dev に付け替える**

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
