const VERSION = 'v2'; // Update this to force cache refresh
const CORE_CACHE_NAME = `smart-attendance-core-${VERSION}`;
const DYNAMIC_CACHE_NAME = `smart-attendance-dynamic-${VERSION}`;
const OFFLINE_URL = '/offline.html'; // Fallback page

const CORE_ASSETS = [
  OFFLINE_URL,
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install + Cache Core Assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CORE_CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .catch(err => console.error('Cache install failed:', err))
  );
  self.skipWaiting();
});

// Clean Old Caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (![CORE_CACHE_NAME, DYNAMIC_CACHE_NAME].includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Handling
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (e.g., POST API calls)
  if (request.method !== 'GET') return;

  // Core Assets: Stale-While-Revalidate
  if (CORE_ASSETS.includes(url.pathname) || url.pathname === '/') {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        const fetchPromise = fetch(request).then(networkResponse => {
          caches.open(CORE_CACHE_NAME).then(cache => cache.put(request, networkResponse));
          return networkResponse.clone();
        }).catch(() => cachedResponse || caches.match(OFFLINE_URL));
        return cachedResponse || fetchPromise;
      })
    );
  }
  // Dynamic Assets: Cache First
  else {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        return cachedResponse || fetch(request).then(networkResponse => {
          caches.open(DYNAMIC_CACHE_NAME).then(cache => cache.put(request, networkResponse));
          return networkResponse.clone();
        }).catch(() => caches.match(OFFLINE_URL));
      })
    );
  }
});
