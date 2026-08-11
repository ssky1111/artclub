# artclub Worker（OGP + 作品ページ）

`/work/{id}` 向け Cloudflare Worker。

## 役割

- 作品ごとの OGP（X カード用）
- 作品の公開ページ（ヘッダー付き・インラインCSS）
- `{id}` は **short_id（8桁）** または従来の uuid

## 環境

| 環境 | Worker 名 | URL | Supabase |
|------|-----------|-----|----------|
| Production | `artclub` | `artclub.space/work/*` | artclub main |
| Development | `artclub-dev` | `dev.artclub.space/work/*` | ArtClub Dev |

## 自動デプロイ（GitHub Actions）

`worker/work-ogp/` 以下を変更して push すると自動デプロイされる。

- `main` ブランチ → Production Worker
- `dev` ブランチ → Development Worker

### GitHub Secrets（要設定）

| Secret 名 | 説明 |
|-----------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API トークン（Workers 編集権限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID |

## 手動デプロイ

```bash
cd worker/work-ogp
npx wrangler deploy            # Production
npx wrangler deploy --env dev  # Development
```

## 初回セットアップ（Cloudflare Dashboard）

- `dev.artclub.space` の DNS レコード追加（CNAME → Workers プロキシ）
- Routes は `wrangler.toml` で管理済み
