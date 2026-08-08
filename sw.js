/**
 * sw.js — アプリ本体だけをキャッシュする。お題の写真はキャッシュしない
 * （毎回ちがう写真が出ることに意味があるし、端末を圧迫したくないので）。
 */

const CACHE = 'croqui-v3';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
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
  './js/draw.js',
  './manifest.webmanifest',
  './icons/icon.svg',
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
  if (url.origin !== self.location.origin) return;   // Unsplash / Picsum は素通し

  // アプリ本体はネットワーク優先・失敗したらキャッシュ（更新が反映されるように）
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
  );
});
