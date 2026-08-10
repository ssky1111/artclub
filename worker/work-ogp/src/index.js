/**
 * Cloudflare Worker — /work/{id} の OGP + 作品ページ
 *
 * - X などのクローラ → og:* meta 付き HTML
 * - ブラウザ → 作品画像とユーザーネームを見せる簡易ページ
 * - それ以外のパス → GitHub Pages へプロキシ（Routes で /work/* のみなら不要）
 */

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|twitterbot|linkedinbot|embedly|quora|pinterest|redditbot|applebot|whatsapp|telegram|discord|preview/i;

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchArtwork(env, id) {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/artworks`);
  url.searchParams.set('select', 'id,image_url,username,mode,created_at,visibility,prompt_id');
  url.searchParams.set('id', `eq.${id}`);
  url.searchParams.set('limit', '1');

  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  const work = rows[0];
  if (!work) return null;
  if (work.visibility && work.visibility !== 'public') return null;
  return work;
}

function modeLabel(mode) {
  if (!mode) return 'クロッキー';
  const m = String(mode).toLowerCase();
  if (m.includes('gesture')) return 'ジェスチャードローイング';
  if (m.includes('part')) return '部位練習';
  if (m.includes('daily')) return 'DAILY';
  if (m.includes('croquis')) return 'クロッキー';
  return mode;
}

function renderWorkHtml(env, work, { forBot = false } = {}) {
  const origin = env.SITE_ORIGIN || 'https://artclub.space';
  const pageUrl = `${origin}/work/${work.id}`;
  const title = `ArtClub - 3分${modeLabel(work.mode)}`;
  const desc = work.username
    ? `${work.username} さんが描いた作品`
    : 'ArtClub で描いたクロッキー';
  const image = work.image_url;
  const appLink = `${origin}/#work/${work.id}`;

  if (forBot) {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ArtClub">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<link rel="canonical" href="${escapeHtml(pageUrl)}">
</head>
<body>
  <p>${escapeHtml(title)}</p>
  <img src="${escapeHtml(image)}" alt="">
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ArtClub">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<link rel="canonical" href="${escapeHtml(pageUrl)}">
<style>
  :root { color-scheme: light; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font-family: "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
    background: #f6f3ee; color: #1c1a17; padding: 24px;
  }
  .card {
    width: min(100%, 520px); background: #fffdf8; border-radius: 18px;
    padding: 20px; box-shadow: 0 10px 40px rgba(40, 20, 10, .08);
  }
  .brand {
    font-weight: 800; letter-spacing: .04em; font-size: 14px; color: #e03d7f;
    margin-bottom: 10px;
  }
  h1 { font-size: 22px; margin: 0 0 6px; line-height: 1.3; }
  .meta { color: #6b6560; font-size: 14px; margin: 0 0 16px; }
  img {
    width: 100%; height: auto; display: block; border-radius: 12px;
    background: #f0ebe3;
  }
  .actions { margin-top: 16px; display: flex; gap: 10px; flex-wrap: wrap; }
  a.btn {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 10px 16px; border-radius: 999px; text-decoration: none;
    font-weight: 700; font-size: 14px;
  }
  a.primary { background: #1c1a17; color: #fff; }
  a.ghost { background: #efe9e1; color: #1c1a17; }
</style>
</head>
<body>
  <main class="card">
    <div class="brand">ARTCLUB</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">${escapeHtml(desc)}</p>
    <img src="${escapeHtml(image)}" alt="${escapeHtml(desc)}">
    <div class="actions">
      <a class="btn primary" href="${escapeHtml(appLink)}">ArtClub で見る</a>
      <a class="btn ghost" href="${escapeHtml(origin)}/">トップへ</a>
    </div>
  </main>
</body>
</html>`;
}

function notFoundHtml() {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>Not found</title></head>
<body style="font-family:system-ui;padding:40px"><h1>作品が見つかりません</h1>
<p><a href="https://artclub.space/">ArtClub へ戻る</a></p></body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/work\/([^/]+)\/?$/);

    if (match) {
      const id = decodeURIComponent(match[1]);
      const work = await fetchArtwork(env, id);
      if (!work) {
        return new Response(notFoundHtml(), {
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      const ua = request.headers.get('user-agent') || '';
      const forBot = BOT_RE.test(ua);
      return new Response(renderWorkHtml(env, work, { forBot }), {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': forBot ? 'public, max-age=300' : 'public, max-age=60',
        },
      });
    }

    // /work/* 以外は Pages へ（Worker をルート全体に付けた場合のフォールバック）
    const pagesBase = env.PAGES_BASE || '';
    const target = `${env.PAGES_ORIGIN || 'https://ssky1111.github.io'}${pagesBase}${url.pathname}${url.search}`;
    return fetch(new Request(target, request));
  },
};
