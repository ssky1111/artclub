/**
 * feedback-line — Supabase Database Webhook → LINE Messaging API
 *
 * feedback INSERT を受け取り、自分の LINE にプッシュする。
 * シークレットは Worker の環境変数のみ（フロントには出さない）。
 */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() });
    }
    if (request.method !== 'POST') {
      return json({ error: 'method not allowed' }, 405);
    }

    const secret = env.WEBHOOK_SECRET || '';
    if (secret) {
      const got = request.headers.get('x-webhook-secret')
        || request.headers.get('x-artclub-webhook-secret')
        || '';
      if (got !== secret) return json({ error: 'unauthorized' }, 401);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'invalid json' }, 400);
    }

    // Supabase Database Webhooks: { type, table, record, ... }
    const record = payload?.record || payload?.feedback || payload;
    const message = String(record?.message || '').trim();
    if (!message) return json({ error: 'no message' }, 400);

    const token = env.LINE_CHANNEL_ACCESS_TOKEN;
    const userId = env.LINE_USER_ID;
    if (!token || !userId) {
      return json({ error: 'LINE env missing', stored: true }, 500);
    }

    const lines = [
      'ARTCLUB フィードバック',
      '',
      message.slice(0, 800),
    ];
    if (record.contact) lines.push('', `連絡先: ${String(record.contact).slice(0, 120)}`);
    if (record.username) lines.push(`ユーザー: ${String(record.username).slice(0, 64)}`);
    if (record.page_path) lines.push(`ページ: ${String(record.page_path).slice(0, 160)}`);
    lines.push('', `id: ${record.id || '—'}`);

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: lines.join('\n').slice(0, 4900) }],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return json({ error: 'line push failed', detail: text.slice(0, 300) }, 502);
    }
    return json({ ok: true });
  },
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-webhook-secret, x-artclub-webhook-secret',
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });
}
