// Simple Service Worker for Mythical Creature Game
// Provides basic offline capabilities

const CACHE_NAME = 'mythical-creature-v2';
const urlsToCache = [
  '/',
  '/index.html'
];

self.addEventListener('install', function(event) {
  // Cache resources during install
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
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
