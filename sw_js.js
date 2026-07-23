/* GAA Stats — Service Worker
   Cache-first strategy. Single file app — only the HTML needs caching.
   Bump CACHE_VERSION when deploying a new version of gaa_app-19.html

   ⚠️ If you deploy the app under a NEW filename, update FILES_TO_CACHE too.
      Bumping the version alone will just re-cache the old file. */
var CACHE_VERSION = 'gaa-v19-6';
var FILES_TO_CACHE = [
  '/gaastats1999/gaa_app-19.html',
  '/gaastats1999/'   /* also cache the root path in case that's the entry point */
];

/* ── Install: cache the app shell ── */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      /* {cache:'reload'} bypasses the browser's own HTTP cache.
         Without it, a host max-age header can serve a stale copy of the
         HTML into the new cache — the version looks bumped but the app
         on the sideline is unchanged. */
      return cache.addAll(FILES_TO_CACHE.map(function(u) {
        return new Request(u, {cache: 'reload'});
      }));
    }).then(function() {
      /* Force this SW to become active immediately without waiting.
         This does NOT reload open pages — a running match is unaffected. */
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
            return caches.open(CACHE_VERSION).then(function(cache) {
              return cache.put(e.request, response.clone());
            });
          }
        }).catch(function() { /* offline — no update needed */ });

        /* Hold the worker open until the background refresh finishes,
           otherwise the browser may kill it before cache.put completes. */
        e.waitUntil(networkFetch);

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
