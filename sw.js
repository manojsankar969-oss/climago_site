const CACHE_NAME = 'climego-v2';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', event => {
    self.skipWaiting(); // Force new SW to take over immediately
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim(); // Take control of all clients immediately
});

self.addEventListener('fetch', event => {
    // Network first strategy for API calls and critical files to ensure freshness
    if (event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Stale-while-revalidate for other assets
    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(response => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
                return response || fetchPromise;
            });
        })
    );
});
