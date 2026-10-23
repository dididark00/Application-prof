// Organisation › Liens utiles : sites officiels et ressources, liste modifiable (simples liens, rien n'est reproduit).
import * as store from '../store.js';
import { h, icon, toast, safeUrl } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';

export const CHECKED = '23/10/2026';
export const DEFAULT_LINKS = [
  { cat: 'Officiel', title: 'Éduscol (programmes, ressources d’accompagnement)', url: 'https://eduscol.education.gouv.fr/' },
  { cat: 'Officiel', title: 'Bulletin officiel de l’Éducation nationale', url: 'https://www.education.gouv.fr/le-bulletin-officiel-de-l-education-nationale-de-la-jeunesse-et-des-sports' },
  { cat: 'Officiel', title: 'apps.education.fr (Nuage, classes virtuelles, agenda…)', url: 'https://apps.education.fr/' },
  { cat: 'Officiel', title: 'Mon aide numérique (guides des outils du ministère)', url: 'https://monaidenumerique.education.gouv.fr/' },
  { cat: 'École', title: 'Indices de position sociale des écoles (DEPP, data.gouv.fr)', url: 'https://www.data.gouv.fr/datasets/64265b6135b0c18d57538672' },
  { cat: 'Classe', title: 'Lumni (vidéos éducatives de l’audiovisuel public)', url: 'https://www.lumni.fr/' },
  { cat: 'Carrière', title: 'Mouvement, salaire, carrière : site de votre académie et I-Prof (ajoutez vos liens)', url: '' },
];
const links = () => { const l = store.getSettings().usefulLinks; return Array.isArray(l) ? l : DEFAULT_LINKS; };
const saveLinks = (l) => store.setSettings({ usefulLinks: l });

export function render() {
  const list = links();
  const cats = [...new Set(list.map(l => l.cat || 'Autre'))];
  const t = h('input', { placeholder: 'Intitulé', 'data-testid': 'link-title' }), u = h('input', { placeholder: 'https://…', 'data-testid': 'link-url' }), c = h('input', { placeholder: 'Catégorie', value: 'Mes liens', style: { width: '9em' } });
  return h('div', { class: 'page' },
    pageHeader('Liens utiles', { favKey: 'organisation/liens' }), subTabs(),
    h('p', { class: 'muted' }, `Sites officiels et ressources, vérifiés le ${CHECKED}. Ce sont de simples liens : l’application ne reproduit pas leur contenu. Ajoutez les vôtres (site de l’académie, ENT, circonscription…).`),
    cats.map(cat => h('section', { class: 'card' }, h('h2', {}, cat), h('ul', { class: 'plain', 'data-testid': 'links' }, list.map((l, i) => [l, i]).filter(([l]) => (l.cat || 'Autre') === cat).map(([l, i]) => h('li', { class: 'row' },
      safeUrl(l.url) ? h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, l.title) : h('span', {}, l.title),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Retirer ${l.title}`, onclick: () => saveLinks(list.filter((_, j) => j !== i)) }, icon('x', 14))))))),
    h('section', { class: 'card stack' }, h('h2', {}, 'Ajouter un lien'), h('div', { class: 'row' }, t, u, c,
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'link-add', onclick: () => {
        if (!t.value.trim() || !safeUrl(u.value.trim())) { toast('Intitulé et adresse en https:// nécessaires.', { kind: 'error' }); return; }
        saveLinks([...list, { cat: c.value.trim() || 'Mes liens', title: t.value.trim(), url: u.value.trim() }]);
      } }, '+ Ajouter')),
      h('button', { class: 'btn btn-link small', type: 'button', onclick: () => saveLinks(null) }, 'Revenir à la liste d’origine')));
}
