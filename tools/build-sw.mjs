// Génère sw.js avec la liste exacte des fichiers de l'application et une version
// calculée à partir de leur contenu : toute modification déclenche une mise à jour.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const include = ['index.html', 'manifest.webmanifest', 'css', 'js', 'icons', 'fonts', 'data'];
const files = [];
const walk = (p) => {
  const st = statSync(p);
  if (st.isDirectory()) for (const f of readdirSync(p)) walk(join(p, f));
  else files.push(relative(root, p));
};
for (const i of include) walk(join(root, i));
files.sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(root, f)));
const version = hash.digest('hex').slice(0, 12);

const sw = `// Fichier généré par tools/build-sw.mjs — ne pas modifier à la main.
// Met en cache l'application pour un fonctionnement hors connexion.
// Les données ne passent jamais par ce fichier : elles restent dans IndexedDB.
const CACHE = 'classeur-${version}';
const ASSETS = ${JSON.stringify(['./', ...files], null, 2)};

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
`;
writeFileSync(join(root, 'sw.js'), sw);
console.log(`sw.js : ${files.length} fichiers, version ${version}`);
