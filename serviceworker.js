const CACHE_VERSION = 'v8'; // Bumped to v8 for this update
const CORE_CACHE_NAME = `attendify-core-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `attendify-dynamic-${CACHE_VERSION}`;

// 1. App Shell & AI Models
const CORE_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js',
  // AI Model Weights
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights/tiny_face_detector_model-weights_manifest.json',
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights/tiny_face_detector_model-shard1'
];

self.addEventListener('install', event => {
  console.log(`[Service Worker] Installing ${CACHE_VERSION}...`);
  event.waitUntil(
    caches.open(CORE_CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching Core Assets including AI Models.');
      // Use catch() so if one minor icon is missing, it doesn't fail the whole install
      return cache.addAll(CORE_ASSETS).catch(err => console.error("Asset caching error:", err));
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

  // --- CRITICAL FIX: API BYPASS ---
  // Do NOT let the Service Worker cache Google Script API calls (Employee Lists, etc.)
  // Let the frontend index.html handle API fallbacks.
  if (requestUrl.hostname.includes('script.google.com') || requestUrl.hostname.includes('script.googleusercontent.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // --- STRATEGY A: Stale-While-Revalidate for HTML ---
  if (event.request.mode === 'navigate' || requestUrl.pathname.endsWith('.html')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          caches.open(CORE_CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => {
          console.log('[Service Worker] Network failed, relying on HTML cache.');
        });
        
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // --- STRATEGY B: Cache-First for static assets (Scripts, CSS, Images, AI Models) ---
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        // SAFE CACHING: Only cache valid, successful responses (Prevents "Poisoned Cache")
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
            return networkResponse;
        }

        return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
          cache.put(event.request.url, networkResponse.clone());
          return networkResponse;
        });
      }).catch(error => {
          console.error('[Service Worker] Static fetch failed:', error);
      });
    })
  );
});
