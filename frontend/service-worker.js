/**
 * SUCCESSION Service Worker
 * Provides offline PWA support and asset caching.
 * Version bumped to recover clients from stale/broken cached pages after integration fixes.
 */

const CACHE_NAME = 'succession-cache-v5';

const PRECACHE_URLS = [
  './',
  './index.html',
  './app.html',
  './home.html',
  './intro.html',
  './login.html',
  './register.html',
  './privacy.html',
  './terms.html',
  './manifest.webmanifest',
  './css/main.css',
  './css/layout.css',
  './css/components.css',
  './css/forms.css',
  './css/responsive.css',
  './css/succession-theme.css',
  './css/ui-integration.css',
  './css/spa-components.css',
  './css/fonts.css',
  './css/tokens.css',
  './css/base.css',
  './css/fx.css',
  './css/site.css',
  './css/auth.css',
  './css/legal.css',
  './js/fx.js',
  './js/site.js',
  './site/css/fonts.css',
  './site/css/tokens.css',
  './site/css/base.css',
  './site/css/components.css',
  './site/css/auth.css',
  './site/css/site.css',
  './site/css/fx.css',
  './site/css/app.css',
  './site/js/fx.js',
  './site/js/site.js',
  './site/js/charts.js',
  './js/app.js',
  './js/router.js',
  './js/api.js',
  './js/auth.js',
  './js/state.js',
  './js/validators.js',
  './js/i18n/en.json',
  './js/i18n/hi.json',
  './js/i18n/kn.json',
  './js/offline/db.js',
  './js/offline/queue.js',
  './js/offline/sync.js',
  './js/offline/connectivity.js',
  './js/offline/qr.js',
  './js/offline/signing.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((k) => {
            if (k !== CACHE_NAME) {
              return caches.delete(k);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Skip caching API/backend requests (handled by queue.js in IndexedDB / live API).
  if (
    url.port === '8000' ||
    url.port === '8001' ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/orders') ||
    url.pathname.startsWith('/transactions') ||
    url.pathname.startsWith('/disputes') ||
    url.pathname.startsWith('/settlements') ||
    url.pathname.startsWith('/passbook') ||
    url.pathname.startsWith('/notifications') ||
    url.pathname.startsWith('/scale-photos') ||
    url.pathname.startsWith('/voice') ||
    url.pathname.startsWith('/ai') ||
    url.pathname.startsWith('/sync') ||
    url.pathname.startsWith('/assayer')
  ) {
    return;
  }

  // Network-first for navigations to avoid serving stale/broken HTML pages.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          // SPA fallback for app routes; static pages resolve to cached copies when available.
          return caches.match('./index.html') || caches.match('./');
        })
    );
    return;
  }

  // Stale-while-revalidate for static assets.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

