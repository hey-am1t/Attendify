const CACHE_VERSION = 'v4';
const CORE_CACHE_NAME = `attendify-core-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `attendify-dynamic-${CACHE_VERSION}`;

// 1. App Shell & AI Models
// We must explicitly cache the Face-API model weights so the AI works offline.
const CORE_ASSETS = [
  './',
  'index.html',
  'dashboard.html',
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js',
  // --- ADDED: AI Model Weights for TinyFaceDetector ---
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights/tiny_face_detector_model-weights_manifest.json',
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights/tiny_face_detector_model-shard1'
];

self.addEventListener('install', event => {
  console.log(`[Service Worker] Installing ${CACHE_VERSION}...`);
  event.waitUntil(
    caches.open(CORE_CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching Core Assets including AI Models.');
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log(`[Service Worker] Activating ${CACHE_VERSION}...`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CORE_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 2. Intelligent Fetch Strategy
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return; // Ignore POST requests

  const requestUrl = new URL(event.request.url);

  // STRATEGY A: Stale-While-Revalidate for HTML files (App Updates)
  // Shows the cached version instantly, but downloads the newest version in the background for next time.
  if (event.request.mode === 'navigate' || requestUrl.pathname.endsWith('.html')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          caches.open(CORE_CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => {
          console.log('[Service Worker] Network failed, relying entirely on cache.');
        });
        
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // STRATEGY B: Cache-First for static assets (Scripts, CSS, Images, AI Models)
  // Saves bandwidth and loads lightning fast.
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
          cache.put(event.request.url, networkResponse.clone());
          return networkResponse;
        });
      }).catch(error => console.error('[Service Worker] Fetch failed:', error));
    })
  );
});
