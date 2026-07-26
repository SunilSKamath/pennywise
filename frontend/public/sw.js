/* global caches, self */

// This is a one-time retirement worker. iOS Safari keeps service-worker cache
// storage separately for home-screen apps, and the previous app-shell worker
// could leave an installed copy unable to load after a release. Activate this
// worker once to remove every Pennywise cache and unregister service workers.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
  );
});
