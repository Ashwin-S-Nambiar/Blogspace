const CACHE = 'blogspace-v1';
const SHELL = [
  '/',
  '/index.css',
  '/site.webmanifest',
  '/icon.svg',
  '/js/main.js',
  '/js/api.js',
  '/js/cover.js',
  '/js/md.js',
  '/js/sound.js',
  '/js/store.js',
  '/js/tip.js',
  '/fonts/anybody-latin.woff2',
  '/fonts/literata-latin.woff2',
  '/fonts/literata-italic-latin.woff2',
  '/fonts/spline-sans-mono-latin.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function fromNetwork(request, key) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), 4000)),
    ]);
    if (res.ok) cache.put(key ?? request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(key ?? request, {
      ignoreSearch: !key && request.mode === 'navigate',
    });
    if (hit) return hit;
    throw new Error('offline');
  }
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/fonts/') && url.origin === location.origin) {
    e.respondWith(caches.match(request).then((hit) => hit ?? fromNetwork(request)));
    return;
  }
  if (url.origin === 'https://dummyjson.com' && url.pathname.startsWith('/comments/post/')) {
    e.respondWith(fromNetwork(request));
    return;
  }
  if (url.origin !== location.origin) return;
  if (request.mode === 'navigate') {
    e.respondWith(
      url.pathname === '/'
        ? fromNetwork(request, '/')
        : fetch(request).catch(() => caches.match('/')),
    );
    return;
  }
  e.respondWith(fromNetwork(request));
});
