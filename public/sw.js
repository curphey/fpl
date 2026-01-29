// FPL Insights Service Worker
const CACHE_NAME = 'fpl-insights-v1';

// ===========================================================================
// Push Notifications
// ===========================================================================

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const { title, body, icon, badge, data: notificationData, url } = data;

    const options = {
      body: body || 'New notification from FPL Insights',
      icon: icon || '/icons/icon-192.png',
      badge: badge || '/icons/icon-192.png',
      data: { url: url || '/', ...notificationData },
      vibrate: [100, 50, 100],
      requireInteraction: data.type === 'deadline', // Keep deadline alerts visible
      actions: getActionsForType(data.type),
    };

    event.waitUntil(
      self.registration.showNotification(title || 'FPL Insights', options)
    );
  } catch (error) {
    console.error('Error showing notification:', error);
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  const action = event.action;

  // Handle specific actions
  let targetUrl = url;
  if (action === 'view-transfers') {
    targetUrl = '/transfers';
  } else if (action === 'view-team') {
    targetUrl = '/team';
  } else if (action === 'view-live') {
    targetUrl = '/live';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open a new window if none found
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle notification close (for analytics)
self.addEventListener('notificationclose', (event) => {
  // Could send analytics here
  console.log('Notification closed:', event.notification.tag);
});

// Get action buttons based on notification type
function getActionsForType(type) {
  switch (type) {
    case 'deadline':
      return [
        { action: 'view-team', title: 'View Team' },
        { action: 'view-transfers', title: 'Transfers' },
      ];
    case 'price_change':
      return [{ action: 'view-transfers', title: 'View Transfers' }];
    case 'injury':
      return [{ action: 'view-transfers', title: 'Find Replacement' }];
    case 'league_update':
      return [{ action: 'view-live', title: 'View Results' }];
    default:
      return [];
  }
}

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/captain',
  '/fixtures',
  '/transfers',
  '/live',
  '/offline',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API requests - always fetch fresh
  if (url.pathname.startsWith('/api/')) return;

  // Skip external requests
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone response before caching
        const responseClone = response.clone();

        // Cache successful responses
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }

        return response;
      })
      .catch(async () => {
        // Network failed, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // If it's a navigation request, show offline page
        if (request.mode === 'navigate') {
          const offlinePage = await caches.match('/offline');
          if (offlinePage) return offlinePage;
        }

        // Return a basic offline response
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      })
  );
});
