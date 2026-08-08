/**
 * commons.js — Wikimedia Commons から著作権の切れた解剖図版を取ってくる。
 *
 * 図版のURLを直書きすると、ファイル名が変わっただけで全滅する。
 * なので検索APIを叩いて、そのとき実在するものだけを使う。
 * Commons の API は CORS 許可済み（origin=*）なので、サーバーを立てずに直接呼べる。
 *
 * ライセンスは PD / CC0 / CC BY / CC BY-SA だけ通す。それ以外は捨てる。
 */

const API = 'https://commons.wikimedia.org/w/api.php';
const ALLOWED_LICENSE = /public\s*domain|^pd([\s-]|$)|pd-|cc0|cc[\s-]?by/i;
// NC（非営利限定）と ND（改変禁止）は模写素材として扱いたくないので弾く。
// ALLOWED に cc-by が含まれる以上、これが無いと CC BY-NC まで通ってしまう。
const DENIED_LICENSE = /\bnc\b|\bnd\b|non[\s-]?commercial|no[\s-]?deriv/i;
const cache = new Map();

function stripTags(html) {
  return String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function toPhoto(page) {
  const info = page.imageinfo?.[0];
  if (!info?.thumburl) return null;                       // tif や大きすぎるものは thumburl だけ使う
  if (['AUDIO', 'VIDEO'].includes(info.mediatype)) return null;

  const meta = info.extmetadata || {};
  const license = stripTags(meta.LicenseShortName?.value) || '不明';
  if (!ALLOWED_LICENSE.test(license) || DENIED_LICENSE.test(license)) return null;

  const artist = stripTags(meta.Artist?.value);
  return {
    url: info.thumburl,
    title: page.title.replace(/^File:/, ''),
    description: stripTags(meta.ImageDescription?.value).slice(0, 300),
    credit: {
      kind: '図版',
      name: artist || page.title.replace(/^File:/, ''),
      link: info.descriptionurl,
      source: `Wikimedia Commons（${license}）`,
      license,
    },
  };
}

/**
 * 図版を検索する。ヒット0でも例外にはせず空配列を返す（練習を止めないため）。
 */
export async function searchPlates(query, { limit = 12, width = 1200 } = {}) {
  const key = `${query}|${limit}|${width}`;
  if (cache.has(key)) return cache.get(key);

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',            // File:
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mediatype',
    iiurlwidth: String(width),
  });

  const res = await fetch(`${API}?${params}`);
  if (!res.ok) throw new Error(`Commons からの応答エラー (${res.status})`);
  const data = await res.json();

  const pages = Object.values(data.query?.pages || {});
  const plates = pages.map(toPhoto).filter(Boolean);
  cache.set(key, plates);
  return plates;
}

/** 複数の検索語をまとめて引いて、混ぜて返す。 */
export async function searchPlatesMulti(queries, opts) {
  const results = await Promise.allSettled(queries.map((q) => searchPlates(q, opts)));
  const merged = [];
  const seen = new Set();
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const plate of r.value) {
      if (seen.has(plate.url)) continue;
      seen.add(plate.url);
      merged.push(plate);
    }
  }
  return merged;
}

/**
 * セッション用のキュー。images.js の createPhotoQueue と同じ形で使える。
 */
export function createPlateQueue(queries, onNotice = () => {}) {
  let pool = [];
  let cursor = 0;
  let loading = null;

  async function load() {
    try {
      pool = await searchPlatesMulti(queries, { limit: 12 });
      if (!pool.length) onNotice('図版が見つかりませんでした。写真だけで進めます');
      pool.sort(() => Math.random() - 0.5);
    } catch (err) {
      onNotice(`図版を取得できませんでした（${err.message}）`);
      pool = [];
    }
  }

  function ensure() {
    if (pool.length || loading) return loading || Promise.resolve();
    loading = load().finally(() => { loading = null; });
    return loading;
  }

  return {
    async next() {
      await ensure();
      if (!pool.length) return null;
      const plate = pool[cursor % pool.length];
      cursor++;
      return plate;
    },
    prime() { return ensure(); },
  };
}
