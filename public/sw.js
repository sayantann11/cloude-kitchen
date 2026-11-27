/* Service worker: app shell offline, instant repeat visits.
 * - Hashed build assets (/assets/*): cache-first (file names change on every release).
 * - Page navigations: network-first, fall back to the cached shell when offline.
 * - Map tiles: cache-first with a size cap.
 * - Firebase / Google APIs: never touched (Firestore has its own offline cache).
 */
const VERSION = 'mk-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const TILES = `${VERSION}-tiles`;
const MAX_TILES = 400;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(['/', '/manifest.webmanifest', '/icons/icon.svg'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith(cacheFirst(req, TILES, true));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(SHELL).then(c => c.put('/', copy));
      return res;
    }).catch(() => caches.match('/', { cacheName: SHELL }).then(r => r || Response.error())));
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(cacheFirst(req, ASSETS, false));
  }
});

async function cacheFirst(req, name, trim) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') {
    cache.put(req, res.clone());
    if (trim) cache.keys().then(keys => { if (keys.length > MAX_TILES) keys.slice(0, keys.length - MAX_TILES).forEach(k => cache.delete(k)); });
  }
  return res;
}
