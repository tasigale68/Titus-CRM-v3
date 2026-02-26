var CACHE_NAME = 'titus-sw-v1';
var SHELL = ['/mobile/', '/mobile/css/app.css', '/mobile/js/app.js', '/mobile/js/api.js', '/mobile/js/router.js'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE_NAME).then(function(c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(names) {
    return Promise.all(names.filter(function(n) { return n !== CACHE_NAME; }).map(function(n) { return caches.delete(n); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(function() {
      return new Response(JSON.stringify({ offline: true, error: 'You are offline' }), { headers: { 'Content-Type': 'application/json' } });
    }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function(r) { return r || fetch(e.request); }));
});
