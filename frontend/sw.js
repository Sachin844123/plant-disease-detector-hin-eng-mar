/* Service worker: caches the app shell so the PWA opens instantly and can be
   installed to the home screen. Diagnosis itself still needs the server — the
   CNN runs there, not in the browser. */

const CACHE = "plant-disease-v1";
const SHELL = [
  "/",
  "/app/styles.css",
  "/app/app.js",
  "/manifest.webmanifest",
  "/app/icons/icon-192.png",
  "/app/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll rejects if any single file 404s, which would leave the SW
      // permanently uninstalled; cache each file independently instead.
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never cache predictions or health checks — a stale diagnosis is worse
  // than no diagnosis.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((response) => {
            if (response.ok && url.origin === self.location.origin) {
              const copy = response.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return response;
          })
          .catch(() => caches.match("/"))
    )
  );
});
