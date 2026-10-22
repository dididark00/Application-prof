// Page honnête pour une fonction pas encore développée : aucun bouton factice.
import { h } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { RUBRIQUES, ROADMAP, STATUTS } from '../roadmap.js';
import { isHidden } from '../router.js';

const ETAPES = { 2: 'Préparation liée', 3: 'Usage en classe', 4: 'Organisation', 5: 'Collaboration et connexions' };

export function render({ params }) {
  const rub = RUBRIQUES.find(r => r.id === params[0]);
  const sub = rub?.sous.find(s => s.id === params[1]) || rub?.sous[0];
  if (!rub || !sub) return h('div', { class: 'page' }, pageHeader('Page inconnue'));
  if (sub.route) { setTimeout(() => { location.replace(`#/${sub.route}`); }, 0); return h('div', { class: 'page' }, pageHeader(sub.titre), h('p', {}, h('a', { href: `#/${sub.route}` }, 'Ouvrir la page'))); }
  if (isHidden(rub.id, sub.id)) return h('div', { class: 'page' }, pageHeader(sub.titre), h('p', {}, 'Ce module est masqué. Réaffichez-le dans Réglages › Modules.'));
  const items = ROADMAP.filter(r => r.etape === sub.etape);
  return h('div', { class: 'page' },
    pageHeader(sub.titre, { favKey: `${rub.id}/${sub.id}`, subtitle: `${rub.titre} · prévu à l’étape ${sub.etape} (${ETAPES[sub.etape] || ''})` }),
    subTabs(),
    h('div', { class: 'card later-card', 'data-testid': 'placeholder' },
      h('h2', {}, 'Pas encore disponible'),
      h('p', {}, 'Cette partie n’est pas encore développée. Elle reste dans la feuille de route et arrivera à l’étape indiquée ; rien ici n’est simulé.'),
      h('details', {}, h('summary', {}, `Ce que contiendra l’étape ${sub.etape}`),
        h('ul', {}, items.map(r => h('li', {}, r.titre, r.statut !== 'afaire' ? ` (${STATUTS[r.statut]})` : '')))),
      h('p', {}, h('a', { href: '#/reglages/feuille' }, 'Voir toute la feuille de route'))));
}
