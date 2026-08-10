# ARTCLUB feedback → メール

フィードバックが DB に入ったら `yuisskweb@gmail.com` にメール通知する Worker。

## 1. Resend

1. [Resend](https://resend.com/) でアカウント作成
2. API Key を発行
3. （本番）`artclub.space` ドメインを Verify し、`FROM_EMAIL` をそのドメインに

## 2. Worker デプロイ

```bash
cd worker/feedback-mail
npx wrangler deploy
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put WEBHOOK_SECRET          # 好きな長い乱数
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY  # クライアント通知用（任意）
```

Cloudflare Dashboard → Routes:

- `artclub.space/api/feedback-mail` → この Worker

## 3. 通知の経路（どちらか、または両方）

### A. フロントから（すぐ動く）

`feedback.js` が INSERT 成功後に `{ id }` を POST する。  
Worker が Service Role で行を取得してメールする（5分以内の投稿のみ）。

### B. Supabase Database Webhook（推奨・バックアップ）

Supabase Dashboard → Database → Webhooks:

- Table: `feedback`
- Events: `Insert`
- URL: `https://artclub.space/api/feedback-mail`
- HTTP Headers: `x-webhook-secret: <WEBHOOK_SECRETと同じ値>`

## フロントについて

フロントは Supabase の `feedback` に直接 INSERT する。  
Resend のキーは Worker にしか置かない。
