/**
 * repo.js — リポジトリに同梱する写真。
 *
 * 端末の IndexedDB に入れた写真は、その端末でしか出ない。
 * 別の端末でも、他の人が開いても同じお題が出るようにするには、
 * 画像そのものをリポジトリに置くしかない（このアプリにはサーバーが無いので）。
 *
 *   photos/manifest.json … タグ付きの一覧
 *   photos/<file>        … 画像そのもの
 *
 * 管理画面から GitHub の Contents API で直接置ける。
 * トークンはこの端末の localStorage にだけ入り、リポジトリには絶対に書き込まない。
 * トークンを使いたくない場合のために、手で commit する用の書き出しも用意してある。
 */

const MANIFEST_URL = './photos/manifest.json';
// 保存キーは名前を変えない。変えると、すでに入っている設定が読めなくなるだけなので
const CFG_KEY = 'drawpamine.repo.v1';

let manifestCache = null;

/** リポジトリに同梱されている写真の一覧。無ければ空。 */
export async function loadManifest({ fresh = false } = {}) {
  if (manifestCache && !fresh) return manifestCache;
  try {
    const res = await fetch(MANIFEST_URL, { cache: fresh ? 'reload' : 'default' });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const photos = Array.isArray(data?.photos) ? data.photos : [];
    manifestCache = photos.filter((p) => p && typeof p.file === 'string');
  } catch {
    manifestCache = [];      // まだ1枚も置いていない状態が普通なので、失敗は静かに扱う
  }
  return manifestCache;
}

/** manifest の1件を、library / images と同じ形にそろえる。 */
export function manifestPhotoUrl(entry) {
  return `./photos/${entry.file}`;
}

/* ---------- 管理画面の設定（トークンなど） ---------- */

export function getRepoConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
    return { owner: '', repo: '', branch: 'main', token: '', ...raw };
  } catch {
    return { owner: '', repo: '', branch: 'main', token: '' };
  }
}

export function saveRepoConfig(patch) {
  const next = { ...getRepoConfig(), ...patch };
  try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch { /* 保存できなくても続ける */ }
  return next;
}

/* ---------- GitHub Contents API ---------- */

const API = 'https://api.github.com';

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function ghJson(res) {
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* HTML のエラーページなど */ }
  if (!res.ok) throw new Error(body?.message || `${res.status} ${res.statusText}`);
  return body;
}

/** すでに置いてあるファイルの sha。無ければ null（新規作成）。 */
async function fileSha({ owner, repo, branch, token }, path) {
  const url = `${API}/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: headers(token) });
  if (res.status === 404) return null;
  const body = await ghJson(res);
  return body?.sha || null;
}

async function putFile(cfg, path, base64, message) {
  const sha = await fileSha(cfg, path);
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(path)}`, {
    method: 'PUT',
    headers: { ...headers(cfg.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: base64,
      branch: cfg.branch,
      ...(sha ? { sha } : {}),
    }),
  });
  return ghJson(res);
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

export function textToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function manifestJson(entries) {
  return JSON.stringify({
    version: 1,
    updatedAt: new Date().toISOString(),
    note: 'ARTCLUB のお題写真。file は photos/ からの相対パス。',
    photos: entries,
  }, null, 2);
}

/** 拡張子は blob の型から決める。名前をそのまま使うと日本語ファイル名で事故る。 */
export function fileNameFor(photo) {
  const ext = (photo.blob?.type || 'image/jpeg').includes('png') ? 'png' : 'jpg';
  return `${photo.id}.${ext}`;
}

/**
 * 写真をまとめて置く。1件ずつ PUT するので、途中で失敗しても
 * それまでの分はリポジトリに残る（manifest は最後に書くので、そこだけ整合が取れる）。
 */
export async function pushPhotos(cfg, photos, onProgress = () => {}) {
  if (!cfg.owner || !cfg.repo) throw new Error('owner/repo が空です');
  if (!cfg.token) throw new Error('トークンが空です');

  const existing = await loadManifest({ fresh: true });
  const byFile = new Map(existing.map((e) => [e.file, e]));

  let done = 0;
  for (const photo of photos) {
    const file = fileNameFor(photo);
    onProgress(++done, photos.length, photo);
    await putFile(cfg, `photos/${file}`, await blobToBase64(photo.blob),
                  `お題の写真を追加: ${file}`);
    byFile.set(file, {
      file,
      tags: photo.tags || [],
      name: photo.name || null,
      source: photo.source || 'Unsplash',
      credit: photo.credit || null,
    });
  }

  const entries = [...byFile.values()];
  await putFile(cfg, 'photos/manifest.json', textToBase64(manifestJson(entries)),
                `お題の写真の一覧を更新（${entries.length}枚）`);
  manifestCache = entries;
  return entries;
}

/** 接続確認。押した瞬間に「書き込めるのか」が分かるようにしておく。 */
export async function testRepo(cfg) {
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}`, { headers: headers(cfg.token) });
  const body = await ghJson(res);
  return { name: body.full_name, canPush: !!body.permissions?.push, branch: body.default_branch };
}
