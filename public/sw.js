// Smart Service Worker for Mythical Creature Game
// Provides offline capabilities with intelligent caching strategies
// AUTO-VERSIONING: Cache name updates with each build

// Generate cache version from build timestamp (updates on each deployment)
const BUILD_TIMESTAMP = '__BUILD_TIMESTAMP__'; // Will be replaced during build
const CACHE_VERSION = BUILD_TIMESTAMP !== '__BUILD_TIMESTAMP__' ? BUILD_TIMESTAMP : Date.now();
const CACHE_NAME = `mythical-creature-v${CACHE_VERSION}`;
const RELEASE_READY_MESSAGE = 'MYTHICAL_VOID_RELEASE_READY';
const RELEASE_ACK_MESSAGE = 'MYTHICAL_VOID_RELEASE_ACK';
const releaseAcknowledgements = new Set();

const IS_DEVELOPMENT = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

// Assets to cache for offline use (static resources only)
const STATIC_ASSETS = [
  '/assets/'  // Vite-generated assets with fingerprints
];

self.addEventListener('install', function(event) {
  console.log('[ServiceWorker] Installing with cache:', CACHE_NAME);

  // CRITICAL: Skip waiting to activate immediately and clear old caches
  self.skipWaiting();

  // Pre-cache is optional in production (network-first for HTML means we don't need it)
  if (!IS_DEVELOPMENT) {
    console.log('[ServiceWorker] Ready for caching strategy');
  }
});

self.addEventListener('message', function(event) {
  if (
    event.data?.type === RELEASE_ACK_MESSAGE &&
    String(event.data.version) === String(CACHE_VERSION) &&
    event.source?.id
  ) {
    releaseAcknowledgements.add(event.source.id);
  }
});

self.addEventListener('activate', function(event) {
  console.log('[ServiceWorker] Activating:', CACHE_NAME);

  event.waitUntil((async function() {
    // Take control immediately and remove every prior release cache.
    await self.clients.claim();
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(function(cacheName) {
        if (cacheName !== CACHE_NAME) {
          console.log('[ServiceWorker] Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        }
        return null;
      })
    );

    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    clients.forEach(function(client) {
      client.postMessage({
        type: RELEASE_READY_MESSAGE,
        version: String(CACHE_VERSION)
      });
    });

    // Current clients acknowledge and reload themselves. A legacy game client
    // has no message handler, so refresh only that visible game route once.
    await new Promise(function(resolve) {
      setTimeout(resolve, 1200);
    });
    const currentClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    await Promise.all(currentClients.map(async function(client) {
      if (
        releaseAcknowledgements.has(client.id) ||
        client.visibilityState !== 'visible' ||
        typeof client.navigate !== 'function'
      ) {
        return;
      }
      const clientUrl = new URL(client.url);
      const isGameRoute = clientUrl.origin === self.location.origin &&
        /^\/(?:play|game)(?:\/|$)/.test(clientUrl.pathname);
      if (!isGameRoute) return;
      try {
        await client.navigate(client.url);
      } catch (_error) {
        // A closed or concurrently navigating client needs no recovery.
      }
    }));
  })());
});

self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // DEVELOPMENT: Pass through all requests
  if (IS_DEVELOPMENT) {
    return;
  }

  // PRODUCTION: Smart caching strategy
  const isHTMLRequest = event.request.destination === 'document' ||
                        url.pathname.endsWith('.html') ||
                        url.pathname === '/';

  const isAsset = url.pathname.startsWith('/assets/');

  if (isHTMLRequest) {
    // NETWORK-FIRST for HTML: Always get fresh HTML
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          // Clone and cache the response
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(function() {
          // Offline fallback: Try cache
          return caches.match(event.request).then(function(cachedResponse) {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Last resort: Try to return cached index.html
            return caches.match('/index.html');
          });
        })
    );
  } else if (isAsset) {
    // CACHE-FIRST for assets: They have fingerprints, so safe to cache aggressively
    event.respondWith(
      caches.match(event.request).then(function(cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then(function(response) {
          // Cache the fetched asset
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
    );
  } else {
    // NETWORK-FIRST for everything else (API calls, etc.)
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request);
      })
    );
  }
});
