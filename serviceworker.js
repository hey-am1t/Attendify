const CORE_CACHE_NAME = 'attendify-core-v3';
const DYNAMIC_CACHE_NAME = 'attendify-dynamic-v3';

// App Shell: All essential files, including external libraries, for the app to work offline instantly.
const CORE_ASSETS = [
  './',
  'index.html',
  'dashboard.html',
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js'
];

// 1. Install the service worker and cache the core assets.
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CORE_CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching Core Assets for instant loading.');
      // addAll() is atomic: if one file fails, the whole operation fails.
      return cache.addAll(CORE_ASSETS).catch(error => {
        console.error('[Service Worker] Failed to cache core assets:', error);
      });
    })
  );
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();
});

// 2. Activate the service worker and clean up old caches.
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // If a cache's name is not in our current list of approved caches, delete it.
          if (cacheName !== CORE_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Tell the active service worker to take control of the page immediately.
  return self.clients.claim();
});

// 3. Intercept fetch requests: Cache-First Strategy
self.addEventListener('fetch', event => {
  // We only want to handle GET requests. POST requests (like submitting data) should always go to the network.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // If the request is found in the cache, return it immediately.
      if (cachedResponse) {
        // console.log('[Service Worker] Returning from cache:', event.request.url);
        return cachedResponse;
      }

      // If the request is not in the cache, fetch it from the network.
      return fetch(event.request).then(networkResponse => {
        // console.log('[Service Worker] Fetching from network and caching:', event.request.url);
        
        // Open the dynamic cache to store the new response.
        return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
          // We must clone the response because a response is a stream and can only be consumed once.
          cache.put(event.request.url, networkResponse.clone());
          // Return the network response to the browser.
          return networkResponse;
        });
      }).catch(error => {
        // This catch handles cases where the device is offline and the resource isn't cached.
        console.error('[Service Worker] Fetch failed:', error);
        // You could return a custom offline page here if you had one.
      });
    })
  );
});
