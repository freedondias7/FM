const CACHE_NAME = "fm-tracker-v20-google-sync-final";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        for (const url of APP_SHELL) {
          try {
            await cache.add(url);
          } catch (_) {}
        }

        await self.skipWaiting();
      })
  );
});


self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});


self.addEventListener("fetch", event => {
  const request = event.request;

  // Only handle normal GET requests from this app.
  // Google Apps Script requests must NOT be intercepted by the service worker.
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {

        if (response && response.ok) {

          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache =>
              cache.put(request, copy)
            )
            .catch(() => {});
        }

        return response;
      })
      .catch(() =>
        caches.match(request)
      )
  );
});
