const CACHE_NAME = "fm-tracker-v21-cache-first-shell";

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


function isAppShellRequest(request, url) {
  if (request.mode === "navigate") return true;

  const path = "." + url.pathname.replace(/\/[^/]*\/\.\.\//, "/");

  return APP_SHELL.some(shellUrl => url.pathname.endsWith(
    shellUrl.replace("./", "/")
  )) || url.pathname === "/" || url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/manifest.json");
}


self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle normal GET requests from this app.
  // Google Apps Script requests must NOT be intercepted by the service worker.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // ----------------------------------------------------------------
  // APP SHELL (the page itself, "/", manifest.json):
  // cache-first, stale-while-revalidate.
  //
  // Serve the cached copy immediately so the app appears (and the
  // Android/Chrome splash screen dismisses) without waiting on a
  // network round trip. A fresh copy is fetched in the background
  // and stored for next time. If nothing is cached yet (first ever
  // load), fall back to the network like before.
  // ----------------------------------------------------------------
  if (isAppShellRequest(request, url)) {

    event.respondWith(
      caches.match(request).then(cached => {

        const networkFetch = fetch(request)
          .then(response => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(request, copy))
                .catch(() => {});
            }
            return response;
          })
          .catch(() => null);

        if (cached) {
          // Update the cache in the background; don't block on it.
          networkFetch.catch(() => {});
          return cached;
        }

        return networkFetch.then(response =>
          response || caches.match(request)
        );
      })
    );

    return;
  }

  // ----------------------------------------------------------------
  // EVERYTHING ELSE (same-origin GET): network-first, cache fallback,
  // unchanged from before.
  // ----------------------------------------------------------------
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
