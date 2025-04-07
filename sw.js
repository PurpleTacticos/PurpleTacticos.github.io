const CACHE_NAME = 'v1';
const ASSETS = [
  '/',
  '/index.html',
  '/search.html',
  '/legal.html',
  '/styles/main.css',
  '/scripts/app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.5/purify.min.js'
];

// Fixed install event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  ); // Added missing closing )
});

// Fixed fetch event
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request)
      .then(res => res || fetch(e.request))
  ); // Added missing closing )
});

// Add activate event for better control
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});