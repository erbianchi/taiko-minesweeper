const CACHE = 'taiko-minesweeper-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/js/app.js',
  '/css/script.css',
  '/music/music1.mp3',
  '/music/music2.mp3',
  '/music/music3.mp3',
  '/music/music4.mp3',
  '/music/music5.mp3',
  '/music/music6.mp3',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
