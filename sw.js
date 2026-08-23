const CACHE_NAME = 'fm-tracker-shell-v15-sync-fix';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const url of APP_SHELL) {
        try {
          await cache.add(url);
        } catch (_) {}
      }

      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle same-origin GET requests.
  if (
    req.method !== 'GET' ||
    new URL(req.url).origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {

      const network = fetch(req)
        .then(response => {

          if (response && response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => cache.put(req, copy));
          }

          return response;
        })
        .catch(() => cached);

      // Keep the existing app behavior:
      // cached app loads immediately, network refreshes cache.
      return cached || network;
    })
  );
});
