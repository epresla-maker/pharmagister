const SW_VERSION = 'v3';
const CACHE_NAME = 'pharmagister-v3';
const STATIC_CACHE = 'pharmagister-static-v3';
const DYNAMIC_CACHE = 'pharmagister-dynamic-v3';

// Statikus fájlok, amiket mindig cache-elünk
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install - statikus cache
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - régi cache törlése
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      clearBadge()
    ])
  );
  self.clients.claim();
});

// Fetch - Network first, cache fallback stratégia
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip API requests - always network
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Skip Firebase requests
  if (url.hostname.includes('firebase') || url.hostname.includes('firestore')) {
    return;
  }

  event.respondWith(
    // Network first stratégia
    fetch(request)
      .then((response) => {
        // Clone the response
        const responseClone = response.clone();
        
        // Cache dynamic content
        if (response.status === 200) {
          caches.open(DYNAMIC_CACHE).then((cache) => {
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
        
        // Ha nincs cache és offline vagyunk, mutassuk az offline oldalt
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
        
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  console.log('[SW] Push data:', event.data?.text());
  
  // Detect platform for debugging
  const isAndroid = /Android/i.test(self.navigator?.userAgent || '');
  console.log('[SW] Platform:', isAndroid ? 'Android' : 'Other');
  
  let data = {
    title: 'Pharmagister',
    body: 'Új értesítésed érkezett!',
    icon: '/icons/icon-192x192.png',
    // Android requires monochrome badge icon (white silhouette on transparent)
    badge: '/icons/badge-monochrome.png',
    tag: 'pharmagister-notification-' + Date.now(),
    data: { url: '/' },
    // Android requires these for reliable delivery
    requireInteraction: true,
    renotify: true
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[SW] Parsed payload:', payload);
      data = {
        ...data,
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || data.tag,
        data: { url: payload.url || '/' }
      };
    } catch (e) {
      console.error('[SW] Failed to parse push data:', e);
      data.body = event.data.text();
    }
  }

  console.log('[SW] Showing notification with data:', data);
  
  const notificationPromise = self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction,
    renotify: data.renotify,
    actions: [
      { action: 'open', title: 'Megnyitás' },
      { action: 'close', title: 'Bezárás' }
    ],
    data: data.data
  });
  
  event.waitUntil(
    notificationPromise
      .then(() => {
        console.log('[SW] Notification shown successfully');
        return incrementBadge();
      })
      .catch(err => {
        console.error('[SW] Failed to show notification:', err);
      })
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    Promise.all([
      clearBadge(),
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Ha van már nyitva ablak, fókuszáljunk rá
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Ha nincs, nyissunk újat
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    ])
  );
});

// Background sync (jelentkezések, üzenetek)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-applications') {
    event.waitUntil(syncApplications());
  }
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncApplications() {
  // Background sync implementáció jelentkezésekhez
  console.log('[SW] Syncing applications...');
}

async function syncMessages() {
  // Background sync implementáció üzenetekhez
  console.log('[SW] Syncing messages...');
}

// Periodic background sync (ha támogatott)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-content') {
    event.waitUntil(updateContent());
  }
});

async function updateContent() {
  console.log('[SW] Periodic sync - updating content...');
}

// Badge management
let badgeCount = 0;

async function updateBadge(count) {
  badgeCount = count;
  // Service Worker-ben 'self' a globális objektum, nem 'navigator'
  if ('setAppBadge' in self.navigator) {
    try {
      if (count > 0) {
        await self.navigator.setAppBadge(count);
        console.log('[SW] Badge set to:', count);
      } else {
        await self.navigator.clearAppBadge();
        console.log('[SW] Badge cleared');
      }
    } catch (error) {
      console.error('[SW] Badge update error:', error);
    }
  } else {
    console.log('[SW] Badge API not supported in this browser');
  }
}

async function incrementBadge() {
  await updateBadge(badgeCount + 1);
}

async function clearBadge() {
  await updateBadge(0);
}

console.log('[SW] Service Worker loaded');
