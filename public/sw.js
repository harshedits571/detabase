const CACHE_NAME = 'ew-os-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force installation immediately
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // Clear old caches!
          }
        })
      );
    })
  );
  self.clients.claim();
});

// NETWORK-FIRST STRATEGY: Always try to get the newest file from the internet first!
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // We got a successful response from the live internet, cache the new version!
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // If there is NO internet, ONLY THEN load the cached version.
        return caches.match(event.request);
      })
  );
});
