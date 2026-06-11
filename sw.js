/* COIN QUEST service worker — network-first with offline fallback.
   Network-first means the latest deployed version always wins when online,
   while the cached app shell keeps it working offline.
   Bump CACHE when you change any shell asset. */
const CACHE = 'coinquest-v66';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png',
];

self.addEventListener('install', (e) => {
  // Precache the shell, but DON'T skipWaiting automatically — the page shows
  // an "update ready" banner and skips waiting only when the user taps refresh.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

// page asks us to activate the new version immediately
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith((async () => {
    // network-first: always try the live version when online
    try {
      const res = await fetch(req);
      if (res.ok && new URL(req.url).origin === self.location.origin) {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch (err) {
      // offline: serve from cache, falling back to the app shell for navigations
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      return Response.error();
    }
  })());
});
