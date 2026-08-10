# artclub-work-ogp

`https://artclub.space/work/{id}` 向け Cloudflare Worker。

## 役割

- 作品ごとの OGP（X カード用）
- 作品の公開ページ（ヘッダー付き・インラインCSS。SPA を /work に出すと CSS が壊れる）
- 通常の ARTCLUB UI は GitHub Pages のまま
- `{id}` は **short_id（8桁）** または従来の uuid

## デプロイ

```bash
cd worker/work-ogp
npx wrangler login
npx wrangler deploy
```

Cloudflare Dashboard で Routes を追加:

- `artclub.space/work/*` → この Worker

**重要:** `/work/*` を Pages の `index.html` に Rewrite しないこと。  
相対パス `./css/styles.css` が `/work/css/styles.css` になり画面が壊れる。

DNS は既存の artclub.space（Pages / カスタムドメイン）を維持し、`/work/*` だけ Worker に振る。

## Supabase

先にリポジトリ直下の `supabase/artworks.sql` を SQL Editor で実行する。

テーブル（`artworks` / `profiles` / `artwork_likes`）に加え、
**Storage の `artworks` バケットと RLS ポリシー**もこの SQL に含まれている。
`short_id` 列もここで追加される。
