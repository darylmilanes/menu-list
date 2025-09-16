const CACHE_NAME = 'menu-list-v1';
const PRECACHE_URLS = [
  '.',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => {
        if (k !== CACHE_NAME) return caches.delete(k);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Serve same-origin requests with cache-first, fallback to network
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(response => {
        if (response) return response;
        return fetch(event.request).then(networkRes => {
          // put a copy in runtime cache
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkRes.clone());
            return networkRes;
          });
        }).catch(() => caches.match('/index.html'));
      })
    );
  }
});
