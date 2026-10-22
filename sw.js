// Fichier généré par tools/build-sw.mjs — ne pas modifier à la main.
// Met en cache l'application pour un fonctionnement hors connexion.
// Les données ne passent jamais par ce fichier : elles restent dans IndexedDB.
const CACHE = 'classeur-eb4dbbb547e8';
const ASSETS = [
  "./",
  "css/app.css",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "js/backup.js",
  "js/components.js",
  "js/csv.js",
  "js/db.js",
  "js/demo.js",
  "js/main.js",
  "js/model.js",
  "js/pages/files.js",
  "js/pages/inbox.js",
  "js/pages/more.js",
  "js/pages/placeholder.js",
  "js/pages/search.js",
  "js/pages/settings.js",
  "js/pages/student.js",
  "js/pages/students.js",
  "js/pages/today.js",
  "js/print.js",
  "js/quickadd.js",
  "js/roadmap.js",
  "js/router.js",
  "js/search.js",
  "js/shell.js",
  "js/store.js",
  "js/ui.js",
  "manifest.webmanifest"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('classeur-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() => caches.match('./'))));
});
