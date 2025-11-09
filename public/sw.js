// Simple Service Worker for Mythical Creature Game
// Provides basic offline capabilities
// DISABLED IN DEVELOPMENT - only caches in production

const CACHE_NAME = 'mythical-creature-v3';
const IS_DEVELOPMENT = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

const urlsToCache = [
  '/',
  '/index.html'
];

self.addEventListener('install', function(event) {
  console.log('[ServiceWorker] Install event');

  // Skip waiting to activate immediately
  self.skipWaiting();

  // Only cache in production
  if (!IS_DEVELOPMENT) {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(function(cache) {
          console.log('[ServiceWorker] Opened cache');
          return cache.addAll(urlsToCache);
        })
    );
  }
});

self.addEventListener('activate', function(event) {
  console.log('[ServiceWorker] Activate event');

  // Take control immediately
  event.waitUntil(self.clients.claim());

  // Clear old caches
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', function(event) {
  // IMPORTANT: Don't intercept requests in development mode
  if (IS_DEVELOPMENT) {
    console.log('[ServiceWorker] Development mode - passing through:', event.request.url);
    return; // Let the request go through normally
  }

  // Production mode: Use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).catch(function() {
          // If both cache and network fail, return offline page
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      }
    )
  );
});
