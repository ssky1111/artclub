/**
 * feedback-mail — Supabase Database Webhook / クライアント通知 → メール
 *
 * feedback INSERT を受け取り、yuisskweb@gmail.com などにメールする。
 * Resend API を使う（RESEND_API_KEY は Worker の secret のみ）。
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
    const isDbWebhook = Boolean(payload?.record || payload?.type === 'INSERT');
    if (secret && isDbWebhook) {
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

    let record = payload?.record || payload?.feedback || null;
    if (!record?.message && payload?.id) {
      record = await fetchFeedbackById(env, String(payload.id));
      if (!record) return json({ error: 'feedback not found' }, 404);
    }
    if (!record) record = payload;

    const message = String(record?.message || '').trim();
    if (!message) return json({ error: 'no message' }, 400);

    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      return json({ error: 'RESEND_API_KEY missing', stored: true }, 500);
    }

    const to = env.FEEDBACK_NOTIFY_EMAIL || 'yuisskweb@gmail.com';
    const from = env.FROM_EMAIL || 'ARTCLUB <feedback@artclub.space>';
    const subject = 'ARTCLUB フィードバック';

    const lines = [
      message.slice(0, 4000),
      '',
      '---',
    ];
    if (record.username) lines.push(`ユーザー: ${String(record.username).slice(0, 64)}`);
    if (record.user_id) lines.push(`user_id: ${String(record.user_id).slice(0, 64)}`);
    if (record.page_path) lines.push(`ページ: ${String(record.page_path).slice(0, 200)}`);
    if (record.user_agent) lines.push(`UA: ${String(record.user_agent).slice(0, 200)}`);
    lines.push(`id: ${record.id || '—'}`);
    if (record.created_at) lines.push(`created_at: ${record.created_at}`);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: lines.join('\n').slice(0, 10000),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return json({ error: 'mail send failed', detail: text.slice(0, 300) }, 502);
    }
    return json({ ok: true });
  },
};

async function fetchFeedbackById(env, id) {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const base = env.SUPABASE_URL;
  if (!serviceKey || !base) return null;

  const url = new URL(`${base}/rest/v1/feedback`);
  url.searchParams.set('id', `eq.${id}`);
  url.searchParams.set('select', '*');
  url.searchParams.set('limit', '1');

  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  const row = rows?.[0];
  if (!row?.message) return null;

  const created = row.created_at ? Date.parse(row.created_at) : NaN;
  if (Number.isFinite(created) && Date.now() - created > 5 * 60 * 1000) {
    return null;
  }
  return row;
}

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
