// sw.js
const CACHE_VERSION = 'v4';
const OFFLINE_PAGE = '/offline.html';
const ASSETS = [
    '/',
    '/index.html',
    '/all-takes.html',
    '/search.html',
    '/legal.html',
    '/games.html',
    '/scripts/games.js',
    '/styles/main.css',
    'https://www.transparenttextures.com/patterns/football-pitch.png',
    'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.5/purify.min.js',

    '/scripts/app.js',
    
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request)
            .then(cachedResponse => {
                const fetchPromise = fetch(e.request).then(networkResponse => {
                    const cacheCopy = networkResponse.clone();
                    caches.open(CACHE_VERSION).then(cache => {
                        cache.put(e.request, cacheCopy);
                    });
                    return networkResponse;
                }).catch(() => {
                    if (e.request.mode === 'navigate') return caches.match(OFFLINE_PAGE);
                    return new Response('Offline');
                });
                return cachedResponse || fetchPromise;
            })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => 
            Promise.all(
                keys.filter(key => key !== CACHE_VERSION)
                    .map(key => caches.delete(key))
            )
        )
    );
});
