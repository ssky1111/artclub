# artclub-work-ogp

`https://artclub.space/work/{id}` 向け Cloudflare Worker。

## 役割

- 作品ごとの OGP（X カード用）
- 作品の簡易公開ページ
- 通常の ArtClub UI は GitHub Pages のまま

## デプロイ

```bash
cd worker/work-ogp
npx wrangler login
npx wrangler deploy
```

Cloudflare Dashboard で Routes を追加:

- `artclub.space/work/*` → この Worker

DNS は既存の artclub.space（Pages / カスタムドメイン）を維持し、`/work/*` だけ Worker に振る。

## Supabase

先にリポジトリ直下の `supabase/artworks.sql` を SQL Editor で実行する。
