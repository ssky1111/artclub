# ARTCLUB プロジェクト

## 基本ルール
- 日本語で会話する
- プッシュ前に必ずコードレビューを行う（動作確認ポイントを洗い出してからプッシュ）
- プッシュしたら **dev ブランチにマージ**まで行う（本番 `main` へのマージは人が判断する）
- 作業の起点・PR の base は **dev**（指定がない限り）。`main` は本番用
- sayu.u.u.u.u@gmail.com と yuisskweb@gmail.com は管理者

## ブランチ運用
- `dev` … 開発・検証の統合先（エージェントのマージ先）
- `main` … 本番（`artclub.space`）。 promot は明示指示があるときだけ
- feature ブランチは `cursor/<name>-8d3b` 形式で作り、完了後に `dev` へマージ

## 技術スタック
- 静的SPA（ビルドツールなし、vanilla ES modules）
- Supabase GoTrue REST API（認証）
- Supabase Storage & Database REST API（作品保存）
- IndexedDB（ローカル描画/写真保存）
- Service Worker（オフラインキャッシュ、PWA）
- DotGothic16フォント（日本語UI）、Special Gothic Expanded One（英語/ロゴ）
