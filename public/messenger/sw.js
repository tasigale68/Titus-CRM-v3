// Titus Messenger Service Worker
var CACHE_NAME = 'titus-messenger-v2';
var SHELL_URLS = [
  '/messenger/',
  '/messenger/styles.css',
  '/messenger/app.js',
  '/messenger/chat.js',
  '/messenger/attachments.js',
  '/messenger/voice-input.js',
  '/messenger/notifications.js'
];

// Install - cache app shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(SHELL_URLS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches, claim clients
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch - cache first for shell, network only for /api/
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Network only for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network only for non-GET requests
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache first for app shell, then network with cache update
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // Return cached version, but update cache in background
        event.waitUntil(
          fetch(event.request).then(function(response) {
            if (response.ok && url.pathname.startsWith('/messenger/')) {
              return caches.open(CACHE_NAME).then(function(cache) {
                return cache.put(event.request, response);
              });
            }
          }).catch(function() { /* offline, ignore */ })
        );
        return cached;
      }
      return fetch(event.request).then(function(response) {
        if (response.ok && url.pathname.startsWith('/messenger/')) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(function() {
      // Offline fallback for navigation
      if (event.request.mode === 'navigate') {
        return caches.match('/messenger/');
      }
    })
  );
});

// Push notifications
self.addEventListener('push', function(event) {
  if (!event.data) return;

  var data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'Titus Messenger', body: event.data.text() || 'New message' };
  }

  var options = {
    body: data.body || 'New message',
    icon: '/images/icon-192.png',
    badge: '/images/icon-192.png',
    vibrate: [100, 50, 100],
    tag: data.conversationId ? 'conv-' + data.conversationId : 'general',
    renotify: true,
    data: {
      conversationId: data.conversationId || null,
      type: data.type || 'message'
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Titus Messenger', options)
  );
});

// Notification click - open or focus conversation
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  var conversationId = event.notification.data ? event.notification.data.conversationId : null;
  var url = conversationId
    ? '/messenger/#chat/' + conversationId
    : '/messenger/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      // Try to focus an existing messenger window
      for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        if (client.url.indexOf('/messenger') !== -1 && 'focus' in client) {
          if (conversationId) {
            client.postMessage({ type: 'open_conversation', conversationId: conversationId });
          }
          return client.focus();
        }
      }
      // No existing window, open new one
      return self.clients.openWindow(url);
    })
  );
});
