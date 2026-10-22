import * as store from './store.js';
import * as model from './model.js';
import { h, toast } from './ui.js';
import { parseHash, navigate, setRenderer } from './router.js';
import { renderShell, refreshChrome } from './shell.js';
import { openQuickAdd } from './quickadd.js';

import * as pToday from './pages/today.js';
import * as pStudents from './pages/students.js';
import * as pStudent from './pages/student.js';
import * as pFiles from './pages/files.js';
import * as pInbox from './pages/inbox.js';
import * as pSearch from './pages/search.js';
import * as pSettings from './pages/settings.js';
import * as pPlaceholder from './pages/placeholder.js';
import * as pMore from './pages/more.js';
import * as pRefs from './pages/referentiels.js';
import * as pProgs from './pages/programmations.js';
import * as pProgressions from './pages/progressions.js';
import * as pSequences from './pages/sequences.js';
import * as pSeance from './pages/seance.js';
import * as pManuels from './pages/manuels.js';
import * as pLecons from './pages/lecons.js';
import * as pEdt from './pages/edt.js';
import * as pCahier from './pages/cahier.js';
import * as pDevoirs from './pages/devoirs.js';
import * as pInterv from './pages/interventions.js';
import * as pAgenda from './pages/agenda.js';
import * as pAppel from './pages/appel.js';
import * as pServices from './pages/services.js';
import * as pProjection from './pages/projection.js';
import * as T from './timer.js';

// Table des routes réalisées. Toute autre sous-page affiche honnêtement « à venir ».
const ROUTES = {
  aujourdhui: pToday,
  eleves: pStudents,
  eleve: pStudent,
  fichiers: pFiles,
  reception: pInbox,
  recherche: pSearch,
  reglages: pSettings,
  avenir: pPlaceholder,
  plus: pMore,
  referentiels: pRefs,
  programmations: pProgs, programmation: pProgs,
  progressions: pProgressions, progression: pProgressions,
  sequences: pSequences, sequence: pSequences,
  preparations: pSeance, seance: pSeance,
  manuels: pManuels,
  lecons: pLecons,
  edt: pEdt,
  cahier: pCahier,
  devoirs: pDevoirs,
  interventions: pInterv,
  agenda: pAgenda,
  taches: { render: pAgenda.renderTasks },
  appel: pAppel,
  services: pServices,
  projection: pProjection,
  ecran: { render: pProjection.renderScreen },
};

let rendering = false;
export async function render() {
  if (rendering) return;
  rendering = true;
  try {
    const route = parseHash();
    const page = ROUTES[route.name] || pToday;
    const main = document.getElementById('main');
    const scroll = window.scrollY;
    const sameRoute = main.dataset.route === location.hash;
    main.replaceChildren();
    const node = await page.render({ params: route.params, query: route.query, navigate, rerender: render });
    main.append(node);
    main.dataset.route = location.hash;
    if (sameRoute) window.scrollTo(0, scroll); else { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
    refreshChrome();
  } catch (e) {
    console.error(e);
    document.getElementById('main').replaceChildren(h('div', { class: 'card error' },
      h('h2', {}, 'Une erreur est survenue'), h('p', {}, e.message || String(e)),
      h('p', {}, 'Vos données enregistrées ne sont pas affectées. Rechargez la page ; si le problème persiste, exportez une sauvegarde depuis Réglages.')));
  } finally { rendering = false; }
}

async function start() {
  setRenderer(render);
  try {
    await store.init();
  } catch (e) {
    document.getElementById('main').replaceChildren(h('div', { class: 'card error' },
      h('h2', {}, 'Impossible d’ouvrir le stockage de l’appareil'),
      h('p', {}, e.message || String(e)),
      h('p', {}, 'Le navigateur bloque peut-être le stockage (navigation privée, réglages de confidentialité). L’application ne peut pas enregistrer vos données dans ces conditions.')));
    return;
  }
  ensureSelection();
  renderShell({ navigate, onQuickAdd: openQuickAdd });
  window.addEventListener('hashchange', render);
  store.subscribe((evt) => {
    if ((evt.kind === 'change' || evt.kind === 'settings') && evt.quiet) { refreshChrome(); return; }
    if (evt.kind === 'change' || evt.kind === 'settings' || evt.kind === 'init') { ensureSelection(); render(); }
    if (evt.kind === 'save') refreshChrome();
  });
  await render();
  T.init();
  registerServiceWorker();
  // Demande de stockage persistant : le navigateur ne videra pas les données sans action de l'utilisatrice.
  if (navigator.storage && navigator.storage.persist) {
    try { await navigator.storage.persist(); } catch { /* ignoré : statut affiché dans Réglages */ }
  }
  window.__classeurReady = true;
}

/** Garde une année et une classe sélectionnées cohérentes. */
function ensureSelection() {
  const s = store.getSettings();
  let y = s.currentYearId && store.get(s.currentYearId);
  const patch = {};
  if (!y || y.deletedAt) {
    const ys = model.years().filter(x => !x.archived);
    y = ys[0] || model.years()[0] || null;
    if ((y ? y.id : null) !== s.currentYearId) patch.currentYearId = y ? y.id : null;
  }
  const c = s.currentClassId && store.get(s.currentClassId);
  if (!c || c.deletedAt || !y || c.yearId !== y.id) {
    const cs = y ? model.classesOfYear(y.id) : [];
    const id = cs[0] ? cs[0].id : null;
    if (id !== s.currentClassId) patch.currentClassId = id;
  }
  if (Object.keys(patch).length) store.setSettings(patch);
}

let reloadOnChange = false;
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloadOnChange) location.reload(); });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw && nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Une nouvelle version de l’application est disponible. Vos données sont conservées.', { action: 'Mettre à jour', onAction: () => { reloadOnChange = true; nw.postMessage('skipWaiting'); }, timeout: 0 });
        }
      });
    });
  }).catch((e) => console.warn('Service worker non enregistré', e));
}

if (location.protocol === 'file:') {
  document.getElementById('main').replaceChildren(h('div', { class: 'card error' },
    h('h2', {}, 'Ouvrez l’application via un serveur local'),
    h('p', {}, 'Les navigateurs bloquent les modules et le stockage quand le fichier est ouvert directement. Voir le fichier LISEZMOI.md : lancer « python3 -m http.server 8080 » dans le dossier puis ouvrir http://localhost:8080.')));
} else {
  start();
}

