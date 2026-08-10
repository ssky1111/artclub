/**
 * sw.js — アプリ本体だけをキャッシュする。お題の写真はキャッシュしない
 * （毎回ちがう写真が出ることに意味があるし、端末を圧迫したくないので）。
 */

const CACHE = 'artclub-v181';
const SHELL = [
  './',
  './index.html',
  './privacy/',
  './privacy/index.html',
  './terms/',
  './terms/index.html',
  './privacy.html',
  './terms.html',
  './css/styles.css',
  './js/app.js',
  './js/auth.js',
  './js/gallery.js',
  './js/feedback.js',
  './js/theory.js',
  './js/session.js',
  './js/storage.js',
  './js/images.js',
  './js/timer.js',
  './js/db.js',
  './js/ui.js',
  './js/anatomy.js',
  './js/commons.js',
  './js/review.js',
  './js/game.js',
  './js/icons.js',
  './js/library.js',
  './js/draw.js',
  './js/i18n.js',
  './js/export.js',
  './js/repo.js',
  './js/supabase.js',
  './js/glossary.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then((hit) =>
        hit || fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        }),
      ),
    );
    return;
  }
  if (url.origin !== self.location.origin) return;

  /*
   * アプリ本体はネットワーク優先・失敗したらキャッシュ。
   * cache:'no-cache' を付けているのは、ブラウザの HTTP キャッシュを挟むと
   * 「HTML だけ古い / JS だけ新しい」が起きて画面が壊れるため。
   * 中身が変わっていなければ 304 が返るだけなので、通信量はほぼ増えない。
   */
  event.respondWith(
    fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
  );
});
