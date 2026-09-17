const CACHE = 'rested-v15';
const SHELL = [
  './', './index.html', './css/app.css', './manifest.webmanifest',
  './js/app.js', './js/age.js', './js/sleep-data.js', './js/model.js',
  './js/engine.js', './js/store.js', './js/history-data.js',
  './js/insights.js', './js/content.js', './js/learning.js', './js/flags.js',
  './js/format.js',
  './js/views/index.js', './js/views/tabs.js', './js/views/onboarding.js',
  './js/views/today.js', './js/views/edit-sleep.js', './js/views/history.js',
  './js/views/insights.js', './js/views/settings.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => {
  if (!e.data) return;
  if (e.data.type === 'get-version' && e.ports[0]) {
    e.ports[0].postMessage({ version: CACHE });
  }
  if (e.data.type === 'skip-waiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
