// ============================================================
// Diamond-BETT Service Worker
// Cache Version: bump CACHE_VERSION whenever you push new code
// ============================================================
const CACHE_VERSION = 'v1';
const CACHE_NAME = `diamond-bett-${CACHE_VERSION}`;

// Static assets to pre-cache on first visit
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/css/reset.css',
  '/css/layout.css',
  '/css/home.css',
  '/css/components.css',
  '/css/agent.css',
  '/css/deposit.css',
  '/css/auth.css',
  '/css/tasks.css',
  '/css/account.css',
  '/css/admin.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/ui.js',
  '/js/auth.js',
  '/js/deposit.js',
  '/js/withdraw.js',
  '/js/games.js',
  '/js/wheel.js',
  '/js/agent.js',
  '/js/main.js',
  '/html/home.html',
  '/html/tasks.html',
  '/html/agent.html',
  '/html/modals.html',
  '/html/account.html',
  '/html/admin.html',
  '/html/cs.html',
];

// ── INSTALL: Pre-cache all static assets ──────────────────
self.addEventListener('install', event => {
  // Activate immediately without waiting for old SW to die
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// ── ACTIVATE: Delete old version caches ───────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('diamond-bett-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Routing strategy ───────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ❌ NEVER cache Supabase API/Auth/Realtime — always network
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    return; // Let browser handle normally (no SW intercept)
  }

  // HTML partials & navigation → Network-first, fallback cache
  if (
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets (CSS, JS, images, fonts) → Cache-first, then network
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|webp|svg|ico|woff|woff2|ttf)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else → Network only (safe default)
});
