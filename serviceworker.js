/**
 * @fileoverview A more robust and modern service worker for the Smart Attendance PWA.
 * This version uses a "Stale-While-Revalidate" strategy for core assets.
 * Author: Amit Kumar
 * Version: 2.0
 */

const CORE_CACHE_NAME = 'attendify-core-v1';
const DYNAMIC_CACHE_NAME = 'attendify-dynamic-v1';

// App Shell: The essential files for the app to work offline.
const CORE_ASSETS = [
  './',
  'index.html', // Make sure your HTML file is named index.html
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png'
];

// 1. Install the service worker and cache the core assets.
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CORE_CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching Core Assets');
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. Activate the service worker and clean up old caches.
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
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

// 3. Intercept fetch requests to serve from cache or network.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Stale-While-Revalidate for core assets (HTML, manifest).
  if (CORE_ASSETS.includes(url.pathname) || url.pathname === '/') {
    event.respondWith(
      caches.open(CORE_CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          const fetchedResponsePromise = fetch(event.request).then(networkResponse => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          return cachedResponse || fetchedResponsePromise;
        });
      })
    );
  } 
  // Cache First for dynamic assets (like Google Fonts, Tailwind CSS).
  else {
    event.respondWith(
      caches.open(DYNAMIC_CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          return cachedResponse || fetch(event.request).then(networkResponse => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  }
});
