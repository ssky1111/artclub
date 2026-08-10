/**
 * Cloudflare Worker — /work/{id} の OGP + スケッチページ
 *
 * - X などのクローラ → og:* meta 付き HTML
 * - ブラウザ → ヘッダー付きのスケッチページ（インラインCSS）
 * - id は short_id（8桁）または従来の uuid のどちらでも可
 *
 * Routes: artclub.space/work/*
 * （必ずこの Worker に振ること。Pages の index を /work に出すと CSS が壊れる）
 */

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|twitterbot|linkedinbot|embedly|quora|pinterest|redditbot|applebot|whatsapp|telegram|discord|preview/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchArtwork(env, id) {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/artworks`);
  url.searchParams.set('select', 'id,short_id,image_url,og_image_url,kind,username,mode,created_at,visibility,prompt_id');
  url.searchParams.set(UUID_RE.test(id) ? 'id' : 'short_id', `eq.${id}`);
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

function workKey(work) {
  return work.short_id || work.id;
}

function renderWorkHtml(env, work, { forBot = false } = {}) {
  const origin = env.SITE_ORIGIN || 'https://artclub.space';
  const key = workKey(work);
  const pageUrl = `${origin}/work/${key}`;
  const kindLabel = work.kind === 'sheet' ? 'まとめ' : modeLabel(work.mode);
  const title = work.kind === 'sheet'
    ? `ARTCLUB - ${kindLabel}`
    : `ARTCLUB - 3分${kindLabel}`;
  const desc = work.username
    ? (work.kind === 'sheet'
      ? `${work.username} さんのまとめ`
      : `${work.username} さんが描いたスケッチ`)
    : 'ARTCLUB で描いたクロッキー';
  const image = work.og_image_url || work.image_url;
  const authLink = `${origin}/#auth`;
  const dailyLink = `${origin}/#daily`;

  if (forBot) {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ARTCLUB">
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
<meta property="og:site_name" content="ARTCLUB">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<link rel="canonical" href="${escapeHtml(pageUrl)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Special+Gothic+Expanded+One&display=swap">
<style>
  :root {
    --bg: #f4f4f1;
    --surface: #ffffff;
    --text: #111111;
    --muted: #8b8b85;
    --brand-ink: #c96f94;
    --line: transparent;
    --surface-2: #efefeb;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    font-family: "DotGothic16", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 16px 16px 40px;
  }
  .wrap { width: min(100%, 560px); margin: 0 auto; }
  .topbar {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    margin-bottom: 18px;
  }
  .back {
    width: 40px; height: 40px; padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border: none; border-radius: 0; background: transparent;
    color: var(--text); cursor: pointer;
  }
  .back:hover { background: transparent; }
  .back svg { display: block; }
  .brand {
    font-family: "Special Gothic Expanded One", sans-serif;
    font-weight: 400; letter-spacing: .04em; font-size: 20px;
    color: var(--text); margin: 0; text-decoration: none;
    min-width: 0;
  }
  .brand:hover,
  .brand:focus,
  .brand:active { color: var(--text); }
  .auth {
    display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;
  }
  .auth a {
    display: inline-flex; align-items: center; justify-content: center;
    height: 36px; padding: 0 12px; border-radius: 999px;
    text-decoration: none; font-weight: 700; font-size: 13px;
    white-space: nowrap;
  }
  .auth .signup {
    background: transparent; color: var(--text);
    border: 1px solid #e4e4e0;
  }
  .auth .login {
    background: var(--surface); color: var(--text); border: none;
  }
  .card {
    background: var(--surface);
    border: none;
    border-radius: 22px;
    padding: 18px;
  }
  h1 { font-size: 20px; margin: 0 0 6px; line-height: 1.35; font-weight: 700; }
  .meta { color: var(--muted); font-size: 13px; margin: 0 0 14px; line-height: 1.5; }
  img.work {
    width: 100%; height: auto; display: block; border-radius: 14px;
    background: var(--surface-2);
  }
  .ctr { margin-top: 28px; }
  .ctr-lead {
    margin: 0 0 12px; text-align: center;
    font-size: 15px; font-weight: 700; letter-spacing: .02em;
  }
  .ctr-card {
    background: var(--surface);
    border: none;
    border-radius: 22px;
    padding: 20px 18px;
  }
  .ctr-kicker {
    font-size: 12px; letter-spacing: .06em; color: var(--brand-ink); font-weight: 700;
    margin: 0 0 6px;
  }
  .ctr-title {
    font-family: "Special Gothic Expanded One", sans-serif;
    font-size: 32px; font-weight: 400; letter-spacing: .04em;
    margin: 0 0 14px; line-height: 1.2;
  }
  .ctr-start {
    display: flex; align-items: center; justify-content: center;
    width: 100%; padding: 15px 20px; border-radius: 999px;
    background: #111111; color: #fff; text-decoration: none;
    font-weight: 700; font-size: 17px;
  }
</style>
</head>
<body>
  <div class="wrap">
    <header class="topbar">
      <button class="back" type="button" aria-label="戻る" onclick="if(history.length>1)history.back();else location.href='${escapeHtml(origin)}/';">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
      </button>
      <a class="brand" href="${escapeHtml(origin)}/">ARTCLUB</a>
      <div class="auth">
        <a class="signup" href="${escapeHtml(authLink)}">新規登録</a>
        <a class="login" href="${escapeHtml(authLink)}">ログイン</a>
      </div>
    </header>
    <main class="card">
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">${escapeHtml(desc)}</p>
      <img class="work" src="${escapeHtml(image)}" alt="${escapeHtml(desc)}">
    </main>
    <section class="ctr">
      <p class="ctr-lead">ドローイング練習してみよう</p>
      <div class="ctr-card">
        <div class="ctr-kicker">今日の練習</div>
        <div class="ctr-title">DAILY</div>
        <a class="ctr-start" href="${escapeHtml(dailyLink)}">はじめる</a>
      </div>
    </section>
  </div>
</body>
</html>`;
}

function notFoundHtml(origin = 'https://artclub.space') {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found</title>
<style>body{font-family:system-ui;padding:40px;background:#f4f4f1;color:#111}a{color:#c96f94}</style>
</head><body><h1>スケッチが見つかりません</h1>
<p><a href="${escapeHtml(origin)}/">ARTCLUB へ戻る</a></p></body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/work\/([^/]+)\/?$/);
    const origin = env.SITE_ORIGIN || 'https://artclub.space';

    if (match) {
      const id = decodeURIComponent(match[1]);
      // CSS など誤って /work/ 配下に来た静的パスはアプリ本体へ
      if (id.includes('.') || id === 'css' || id === 'js' || id === 'icons') {
        return Response.redirect(`${origin}/`, 302);
      }
      const work = await fetchArtwork(env, id);
      if (!work) {
        return new Response(notFoundHtml(origin), {
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

    // /work 以外がこの Worker に来たときのフォールバック（通常は Routes で来ない）
    return Response.redirect(`${origin}/`, 302);
  },
};
