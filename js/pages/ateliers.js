// Planifier › Ateliers et rotations : à partir d'un jeu de groupes (Ma classe › Plan de classe et groupes),
// tableau de rotation « quel groupe à quel atelier, à quelle séance », imprimable et projetable.
// Chaque groupe passe une fois par chaque atelier ; l'ordre de départ suit l'« ordre de rotation » des groupes.
import * as store from '../store.js';
import * as model from '../model.js';
import * as G from '../groups.js';
import { h, icon, toast, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { printDocument } from '../print.js';

const st = { setId: null, workshops: null, dates: [] };

/** Rotation circulaire : à la séance k, le groupe g est à l'atelier (g + k) mod n. */
export function rotation(groupCount, workshopCount, sessions = workshopCount) {
  const out = [];
  for (let k = 0; k < sessions; k++) out.push(Array.from({ length: groupCount }, (_, g) => (g + k) % workshopCount));
  return out;
}

export function render({ rerender }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return h('div', { class: 'page' }, pageHeader('Ateliers et rotations'), subTabs(), miss);
  const sets = G.setsOf(cls.id);
  const set = sets.find(s => s.id === st.setId) || sets.find(s => s.kind === 'ateliers') || sets[0];
  if (!set) return h('div', { class: 'page' }, pageHeader('Ateliers et rotations', { favKey: 'planifier/ateliers' }), subTabs(),
    emptyState('Aucun groupe', 'Créez d’abord des groupes dans Ma classe › Plan de classe et groupes.', h('a', { class: 'btn btn-primary', href: '#/plan' }, 'Créer des groupes')));
  if (st.setId !== set.id) { st.setId = set.id; st.workshops = null; }
  const groups = set.groups.slice().sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
  if (!st.workshops) st.workshops = groups.map((g, i) => g.activity || `Atelier ${i + 1}`);
  const n = st.workshops.length;
  const grid = rotation(groups.length, n, n);
  while (st.dates.length < n) st.dates.push('');
  const label = (k) => st.dates[k] ? model.frDate(st.dates[k], { weekday: 'short', day: 'numeric', month: 'short' }) : `Séance ${k + 1}`;
  const table = () => h('table', { class: 'table rot-table', 'data-testid': 'rot-table' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), st.workshops.map(w => h('th', {}, w)))),
    h('tbody', {}, grid.map((row, k) => h('tr', {}, h('th', {}, label(k)),
      st.workshops.map((_, w) => { const gi = row.indexOf(w); const g = groups[gi];
        return h('td', { style: g ? { background: `${g.color}22`, borderLeft: `4px solid ${g.color}` } : null }, g ? g.name : '—'); })))));
  const doc = () => h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, 'Rotation des ateliers'), h('p', {}, `${cls.name} · ${set.name}`)), table(),
    h('h2', {}, 'Groupes'), h('ul', {}, groups.map(g => h('li', {}, h('strong', {}, `${g.name} : `), (g.memberIds || []).map(id => store.get(id)?.firstName).filter(Boolean).join(', ')))));
  return h('div', { class: 'page' },
    pageHeader('Ateliers et rotations', { favKey: 'planifier/ateliers', subtitle: cls.name, actions: [h('button', { class: 'btn', type: 'button', 'data-testid': 'rot-print', onclick: () => printDocument(doc(), { orientation: 'landscape' }) }, icon('print', 16), 'Imprimer')] }),
    subTabs(),
    h('p', { class: 'muted' }, 'Chaque groupe passe une fois par chaque atelier. Les groupes et leurs membres se règlent dans Ma classe › Plan de classe et groupes (ordre de rotation compris).'),
    h('section', { class: 'card stack' },
      h('label', { class: 'inline' }, 'Groupes', h('select', { 'data-testid': 'rot-set', onchange: (e) => { st.setId = e.target.value; st.workshops = null; rerender(); } }, sets.map(s => h('option', { value: s.id, selected: s.id === set.id }, s.name)))),
      h('h3', {}, 'Ateliers'),
      h('div', { class: 'grid-2' }, st.workshops.map((w, i) => h('input', { value: w, 'aria-label': `Atelier ${i + 1}`, 'data-testid': 'rot-workshop', onchange: (e) => { st.workshops[i] = e.target.value || `Atelier ${i + 1}`; rerender(); } }))),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-small', type: 'button', onclick: () => { st.workshops.push(`Atelier ${st.workshops.length + 1}`); rerender(); } }, '+ atelier'),
        st.workshops.length > 1 ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => { st.workshops.pop(); rerender(); } }, '− atelier') : null,
        n !== groups.length ? h('span', { class: 'muted small' }, n > groups.length ? `${n - groups.length} atelier(s) sans groupe à chaque séance (atelier en autonomie ou libre).` : `${groups.length - n} groupe(s) en attente : ajoutez des ateliers.`) : null),
      h('h3', {}, 'Dates des séances (facultatif)'),
      h('div', { class: 'row' }, Array.from({ length: n }, (_, k) => h('input', { type: 'date', value: st.dates[k] || '', 'aria-label': `Date de la séance ${k + 1}`, onchange: (e) => { st.dates[k] = e.target.value; rerender(); } })))),
    n < groups.length ? h('p', { class: 'card notice' }, 'Il y a plus de groupes que d’ateliers : certains groupes n’auraient pas d’atelier. Ajoutez des ateliers.') : h('section', { class: 'card' }, h('div', { class: 'table-wrap' }, table())),
    h('p', { class: 'muted small' }, 'Pour projeter les groupes et leur atelier du jour : Aujourd’hui › Projection › Groupes.'));
  void toast;
}
