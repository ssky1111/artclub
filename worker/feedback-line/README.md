# ARTCLUB feedback → LINE

フィードバックが DB に入ったら、自分の LINE に通知する Worker。

## 難しさ

難しくない。一度だけ LINE Developers で Bot を作ればよい（15分程度）。

## 1. LINE Messaging API

1. [LINE Developers](https://developers.line.biz/) でプロバイダー作成
2. Messaging API チャネル作成
3. **Channel access token** を発行
4. 自分の LINE でその公式アカウントを友だち追加
5. 自分の **User ID** を取得  
   - チャネルの「応答メッセージ」をオフにして Webhook を一時 ON → 自分から何か送る → Webhook の `source.userId`  
   - またはチャネル基本設定の「あなたのユーザーID」（ある場合）

## 2. Worker デプロイ

```bash
cd worker/feedback-line
npx wrangler deploy
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put LINE_USER_ID
npx wrangler secret put WEBHOOK_SECRET   # 好きな長い乱数
```

Routes 例: `artclub.space/api/feedback-line`

## 3. Supabase Database Webhook

Supabase Dashboard → Database → Webhooks:

- Table: `feedback`
- Events: `Insert`
- URL: `https://artclub.space/api/feedback-line`（デプロイ先）
- HTTP Headers: `x-webhook-secret: <WEBHOOK_SECRETと同じ値>`

これで INSERT のたびに LINE に届く。

## フロントについて

フロントは Supabase の `feedback` に直接 INSERT するだけ。  
LINE トークンは Worker にしか置かない。
