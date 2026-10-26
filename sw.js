const CACHE = 'stt-v2';
const ASSETS = ['./', './index.html', './manifest.json', './sw.js', './icons/icon.svg', './graveyard.gif', './graveyard-final-frame.png', './easter-eggs.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only intercept same-origin GETs; let GitHub API calls pass through normally
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  // Network first so new deploys show up right away; fall back to the cache when offline
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
