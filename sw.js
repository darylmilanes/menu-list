const CACHE_NAME = 'menu-list-v2';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png'
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

  // Handle navigation requests: network-first, fallback to cache, then offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(resp => {
        // update cache with latest navigation response
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return resp;
      }).catch(() => caches.match(event.request).then(r => r || caches.match('/offline.html')))
    );
    return;
  }

  // For same-origin requests, try cache first then network
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(response => {
        if (response) return response;
        return fetch(event.request).then(networkRes => {
          // put a copy in runtime cache
          return caches.open(CACHE_NAME).then(cache => {
            try { cache.put(event.request, networkRes.clone()); } catch (e) {}
            return networkRes;
          });
        }).catch(() => caches.match('/offline.html'));
      })
    );
  }
});
