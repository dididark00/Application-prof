import { RUBRIQUES } from './roadmap.js';
import * as store from './store.js';

export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '') || 'aujourdhui';
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0], params: parts.slice(1), query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

let renderFn = () => {};
export function setRenderer(fn) { renderFn = fn; }
export function navigate(hash) {
  if (location.hash === hash) renderFn(); else location.hash = hash;
}

/** Lien vers une sous-page : route réalisée ou page « à venir ». */
export function subHref(rub, sub) {
  return sub.route ? `#/${sub.route}` : `#/avenir/${rub.id}/${sub.id}`;
}

/** Rubrique et sous-page correspondant à la route courante. */
export function currentLocation(route = parseHash()) {
  if (route.name === 'avenir') return { rub: route.params[0], sub: route.params[1] };
  const ALIASES = { eleve: ['classe', 'eleves'], referentiels: ['preparer', 'programmes'], programmation: ['preparer', 'programmations'], progression: ['preparer', 'progressions'],
    sequence: ['preparer', 'sequences'], seance: ['preparer', 'preparations'] };
  if (ALIASES[route.name] && !RUBRIQUES.some(r => r.sous.some(s => s.route === route.name))) return { rub: ALIASES[route.name][0], sub: ALIASES[route.name][1] };
  for (const r of RUBRIQUES) for (const s of r.sous) if (s.route === route.name) return { rub: r.id, sub: s.id };
  return { rub: null, sub: null };
}

/** Modules masqués : identifiants « rubrique » ou « rubrique/sous-page ». */
export function isHidden(rubId, subId) {
  const s = store.getSettings(); const hidden = s.hiddenModules || [];
  // Transmissions binôme : masquées tant que la classe affichée n'a pas de binôme.
  if (rubId === 'organisation' && subId === 'transmissions') { const c = s.currentClassId && store.get(s.currentClassId); if (c && (c.binome?.active === false || !(c.binome?.name || c.serviceDays?.length))) return true; }
  return hidden.includes(rubId) || (subId && hidden.includes(`${rubId}/${subId}`));
}
export function visibleRubriques() {
  return RUBRIQUES.filter(r => !isHidden(r.id)).map(r => ({ ...r, sous: r.sous.filter(s => !isHidden(r.id, s.id)) }));
}

/** Toutes les pages (pour favoris et recherche). */
export function allPages() {
  const out = [];
  for (const r of visibleRubriques()) for (const s of r.sous) out.push({ key: `${r.id}/${s.id}`, title: s.titre, rubrique: r.titre, href: subHref(r, s), ready: !!s.route, etape: s.etape });
  out.push({ key: 'reglages', title: 'Réglages', rubrique: '', href: '#/reglages', ready: true });
  return out;
}
