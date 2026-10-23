// Fichier généré par tools/build-sw.mjs — ne pas modifier à la main.
// Met en cache l'application pour un fonctionnement hors connexion.
// Les données ne passent jamais par ce fichier : elles restent dans IndexedDB.
const CACHE = 'classeur-20905fee70e2';
const ASSETS = [
  "./",
  "css/app.css",
  "fonts/Marelle-Regular.ttf",
  "fonts/Marelle2-Regular.ttf",
  "fonts/MarelleBaton-Regular.ttf",
  "fonts/MarelleBaton2-Regular.ttf",
  "fonts/OFL.txt",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "js/backup.js",
  "js/components.js",
  "js/confidential.js",
  "js/csv.js",
  "js/db.js",
  "js/demo.js",
  "js/eleve.js",
  "js/finance.js",
  "js/fonts.js",
  "js/forms.js",
  "js/groups.js",
  "js/main.js",
  "js/model.js",
  "js/orga.js",
  "js/pages/agenda.js",
  "js/pages/appel.js",
  "js/pages/argent.js",
  "js/pages/atelier.js",
  "js/pages/bibliotheque.js",
  "js/pages/cahier.js",
  "js/pages/contacts.js",
  "js/pages/devoirs.js",
  "js/pages/diaporamas.js",
  "js/pages/differenciation.js",
  "js/pages/edt.js",
  "js/pages/evaluations.js",
  "js/pages/files.js",
  "js/pages/heures.js",
  "js/pages/inbox.js",
  "js/pages/interventions.js",
  "js/pages/lecons.js",
  "js/pages/listes.js",
  "js/pages/livrets.js",
  "js/pages/manuels.js",
  "js/pages/materiel.js",
  "js/pages/more.js",
  "js/pages/pes.js",
  "js/pages/placeholder.js",
  "js/pages/plan.js",
  "js/pages/programmations.js",
  "js/pages/progressions.js",
  "js/pages/projection.js",
  "js/pages/rattrapage.js",
  "js/pages/referentiels.js",
  "js/pages/remplacement.js",
  "js/pages/responsabilites.js",
  "js/pages/reunions.js",
  "js/pages/seance.js",
  "js/pages/search.js",
  "js/pages/sequences.js",
  "js/pages/services.js",
  "js/pages/settings.js",
  "js/pages/student-tabs.js",
  "js/pages/student.js",
  "js/pages/students.js",
  "js/pages/today.js",
  "js/pages/transmissions.js",
  "js/pages/trombi.js",
  "js/pedago-ui.js",
  "js/pedago.js",
  "js/planning.js",
  "js/print.js",
  "js/printdocs.js",
  "js/programmes.js",
  "js/quickadd.js",
  "js/roadmap.js",
  "js/router.js",
  "js/search.js",
  "js/shell.js",
  "js/store.js",
  "js/theme.js",
  "js/timer.js",
  "js/ui.js",
  "js/vie.js",
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
