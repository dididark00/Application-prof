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
import * as F from './fonts.js';
import * as Theme from './theme.js';
import * as pTrombi from './pages/trombi.js';
import * as pListes from './pages/listes.js';
import * as pEvals from './pages/evaluations.js';
import * as pLivrets from './pages/livrets.js';
import * as pRattrapage from './pages/rattrapage.js';
import * as pDiff from './pages/differenciation.js';
import * as pPlan from './pages/plan.js';
import * as pJobs from './pages/responsabilites.js';
import * as pBiblio from './pages/bibliotheque.js';
import * as pAtelier from './pages/atelier.js';
import * as pDiapos from './pages/diaporamas.js';
import * as pContacts from './pages/contacts.js';
import * as pReunions from './pages/reunions.js';
import * as pHeures from './pages/heures.js';
import * as pTransm from './pages/transmissions.js';
import * as pPes from './pages/pes.js';
import * as pRempl from './pages/remplacement.js';
import * as pArgent from './pages/argent.js';
import * as pMateriel from './pages/materiel.js';
import * as pEtiquettes from './pages/etiquettes.js';
import * as pJeux from './pages/jeux.js';
import * as pEps from './pages/eps.js';
import * as pInfos from './pages/infos.js';
import * as pOutils from './pages/outils.js';
import * as pRedac from './pages/redaction.js';
import * as pFam from './pages/familles.js';
import * as pAteliers from './pages/ateliers.js';
import * as pExos from './pages/exercices.js';
import * as pRecre from './pages/recreation.js';
import * as pLiens from './pages/liens.js';
import * as pArchives from './pages/archives.js';
import * as pImporter from './pages/importer.js';
import * as pAvancement from './pages/avancement.js';
import * as pSorties from './pages/sorties.js';
import * as pMissions from './pages/missions.js';
import * as pMethodes from './pages/methodes.js';
import * as pRadar from './pages/radar.js';
import * as pEnClasse from './pages/enclasse.js';
import * as pRegistre from './pages/registre.js';

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
  trombi: pTrombi,
  listes: pListes,
  evaluations: pEvals,
  livrets: pLivrets,
  rattrapage: pRattrapage,
  differenciation: pDiff,
  plan: pPlan,
  responsabilites: pJobs,
  bibliotheque: pBiblio,
  atelier: pAtelier,
  diaporamas: pDiapos,
  contacts: pContacts,
  reunions: pReunions,
  heures: pHeures,
  transmissions: pTransm,
  pes: pPes,
  remplacement: pRempl,
  argent: pArgent,
  materiel: pMateriel,
  etiquettes: pEtiquettes,
  jeux: pJeux,
  eps: pEps,
  infos: pInfos,
  outils: pOutils,
  redaction: pRedac,
  ateliers: pAteliers,
  exercices: pExos,
  recreation: pRecre,
  liens: pLiens,
  archive: pArchives,
  importer: pImporter,
  avancement: pAvancement,
  sorties: pSorties, sortie: pSorties,
  missions: pMissions,
  methodes: pMethodes,
  radar: pRadar,
  enclasse: pEnClasse,
  registre: pRegistre,
  publications: { render: pFam.renderPublications },
  messages: { render: pFam.renderMessages },
  rdv: { render: pFam.renderRdv },
  documents: { render: pFam.renderDocuments },
  apercu: { render: pFam.renderApercu },
};

let rendering = false;
let pending = false;
// Pages les plus ouvertes sur cet appareil (raccourcis du menu « Plus ») : simple confort, jamais indispensable.
function countVisit(name) {
  try { const v = JSON.parse(localStorage.getItem('classeur.visits') || '{}'); v[name] = (v[name] || 0) + 1; localStorage.setItem('classeur.visits', JSON.stringify(v)); } catch { /* stockage indisponible */ }
}

export async function render() {
  // Une navigation pendant un affichage en cours (page asynchrone) n'est jamais perdue : on réaffiche ensuite.
  if (rendering) { pending = true; return; }
  rendering = true; pending = false;
  try {
    const route = parseHash();
    const page = ROUTES[route.name] || pToday;
    const main = document.getElementById('main');
    const scroll = window.scrollY;
    const sameRoute = main.dataset.route === location.hash;
    main.replaceChildren();
    const node = await page.render({ params: route.params, query: route.query, navigate, rerender: render });
    main.append(node);
    if (!sameRoute) countVisit(route.name);
    main.dataset.route = location.hash;
    if (sameRoute) window.scrollTo(0, scroll); else { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
    refreshChrome();
  } catch (e) {
    console.error(e);
    document.getElementById('main').replaceChildren(h('div', { class: 'card error' },
      h('h2', {}, 'Une erreur est survenue'), h('p', {}, e.message || String(e)),
      h('p', {}, 'Vos données enregistrées ne sont pas affectées. Rechargez la page ; si le problème persiste, exportez une sauvegarde depuis Réglages.')));
  } finally { rendering = false; if (pending) { pending = false; render(); } }
}

async function start() {
  Theme.init();
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
  Theme.apply();
  renderShell({ navigate, onQuickAdd: openQuickAdd });
  window.addEventListener('hashchange', render);
  store.subscribe((evt) => {
    if ((evt.kind === 'change' || evt.kind === 'settings') && evt.quiet) { refreshChrome(); return; }
    if (evt.kind === 'settings' || evt.kind === 'init') Theme.apply();
    if (evt.kind === 'change' || evt.kind === 'settings' || evt.kind === 'init') { ensureSelection(); render(); }
    if (evt.kind === 'save') refreshChrome();
  });
  await render();
  T.init();
  import('./rappels.js').then(R => R.start()).catch(() => {});
  // Polices d'écriture importées (ex. Marelle) : chargées puis la page est redessinée si besoin.
  F.loadAll().then(() => { if (location.hash.startsWith('#/atelier')) render(); }).catch(() => {});
  registerServiceWorker();
  // Synchronisation automatique par le dossier Nuage, si elle a été configurée sur cet appareil.
  import('./sync.js').then(SY => SY.startAuto((msg, err) => toast(msg, { kind: err ? 'error' : 'success', timeout: 8000 }))).catch(() => {});
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
    const cs = y ? model.classesOfYear(y.id).filter(x => !x.missionEnded) : [];
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

