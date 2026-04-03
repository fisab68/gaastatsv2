/* GAA Stats — Service Worker
   Cache-first strategy. Single file app — only the HTML needs caching.
   Bump CACHE_VERSION when deploying a new version of gaa_app-19.html */

var CACHE_VERSION = 'gaa-v19-3';
var FILES_TO_CACHE = [
  '/gaastats1999/gaa_app-19.html',
  '/gaastats1999/'   /* also cache the root path in case that's the entry point */
];

/* ── Install: cache the app shell ── */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      return cache.addAll(FILES_TO_CACHE);
    }).then(function() {
      /* Force this SW to become active immediately without waiting */
      return self.skipWaiting();
    })
  );
});

/* ── Activate: delete any old caches ── */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_VERSION;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    }).then(function() {
      /* Take control of all open clients immediately */
      return self.clients.claim();
    })
  );
});

/* ── Fetch: cache-first, fall back to network ── */
self.addEventListener('fetch', function(e) {
  /* Only handle GET requests */
  if (e.request.method !== 'GET') return;

  /* Only handle same-origin requests — ignore any third party */
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) {
        /* Serve from cache, then refresh cache in background */
        var networkFetch = fetch(e.request).then(function(response) {
          if (response && response.status === 200) {
            caches.open(CACHE_VERSION).then(function(cache) {
              cache.put(e.request, response.clone());
            });
          }
          return response;
        }).catch(function() { /* offline — no update needed */ });

        return cached;
      }

      /* Not in cache — try network, cache on success */
      return fetch(e.request).then(function(response) {
        if (!response || response.status !== 200) return response;
        var clone = response.clone();
        caches.open(CACHE_VERSION).then(function(cache) {
          cache.put(e.request, clone);
        });
        return response;
      }).catch(function() {
        /* Offline and not cached — nothing we can do */
        return new Response('Offline — open the app from your home screen.', {
          status: 503,
          headers: {'Content-Type': 'text/plain'}
        });
      });
    })
  );
});
