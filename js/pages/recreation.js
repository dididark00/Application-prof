// Organisation › Surveillances de récréation : planning de l'école, réparti équitablement
// entre les adultes selon leurs jours de présence (temps partiel, décharge), modifiable case par case.
import * as store from '../store.js';
import * as model from '../model.js';
import { h, icon, toast, field } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { printDocument } from '../print.js';

const DEF = { days: [1, 2, 4, 5], slots: [{ id: 'm', label: 'Matin' }, { id: 'a', label: 'Après-midi' }], zones: ['Cour'], perZone: 1, people: [], grid: {} };
export const planOf = () => store.all('recreplan')[0] || null;
async function save(patch, label = 'Planning des récréations', quiet = true) {
  const p = planOf();
  if (p) return store.update(p.id, patch, label, { quiet });
  return store.create('recreplan', { ...structuredClone(DEF), ...patch }, label);
}
const key = (d, s, z) => `${d}|${s}|${z}`;

/** Répartition équilibrée : à chaque case, les adultes présents ce jour-là qui ont le moins de surveillances. */
export function distribute(plan) {
  const grid = {}; const count = Object.fromEntries(plan.people.map(p => [p.name, 0]));
  for (const d of plan.days) for (const s of plan.slots) {
    const busy = new Set();
    for (const z of plan.zones) {
      const avail = plan.people.filter(p => !(p.days?.length) || p.days.includes(d)).filter(p => !busy.has(p.name))
        .sort((a, b) => count[a.name] - count[b.name] || a.name.localeCompare(b.name, 'fr'));
      const chosen = avail.slice(0, plan.perZone || 1).map(p => p.name);
      chosen.forEach(n => { count[n]++; busy.add(n); });
      grid[key(d, s.id, z)] = chosen;
    }
  }
  return { grid, count };
}
export function counts(plan) {
  const c = Object.fromEntries(plan.people.map(p => [p.name, 0]));
  for (const v of Object.values(plan.grid || {})) for (const n of v) if (n in c) c[n]++;
  return c;
}

export function render({ rerender }) {
  const p = planOf() || structuredClone(DEF);
  const people = p.people || [];
  const c = counts(p);
  const holes = []; for (const d of p.days) for (const s of p.slots) for (const z of p.zones) if (!(p.grid?.[key(d, s.id, z)] || []).length) holes.push(1);
  const cell = (d, s, z) => {
    const cur = p.grid?.[key(d, s.id, z)] || [];
    const sel = h('select', { 'aria-label': `${model.JOURS[d]} ${s.label} ${z}`, 'data-testid': 'recre-cell', onchange: async (e) => { const g = { ...(planOf()?.grid || {}) }; g[key(d, s.id, z)] = e.target.value ? [e.target.value] : []; await save({ grid: g }, 'Surveillance modifiée', false); } },
      h('option', { value: '' }, '—'), people.map(x => h('option', { value: x.name, selected: cur[0] === x.name, disabled: x.days?.length && !x.days.includes(d) }, x.name)));
    return h('td', {}, sel, cur.slice(1).map(n => h('div', { class: 'small' }, n)));
  };
  const table = () => h('table', { class: 'table recre-table', 'data-testid': 'recre-table' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), p.days.map(d => h('th', {}, model.JOURS[d])))),
    h('tbody', {}, p.slots.flatMap(s => p.zones.map(z => h('tr', {}, h('th', {}, `${s.label}${p.zones.length > 1 ? ' — ' + z : ''}`), p.days.map(d => cell(d, s, z)))))));
  const printTab = () => h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, h('th', {}, ''), p.days.map(d => h('th', {}, model.JOURS[d])))),
    h('tbody', {}, p.slots.flatMap(s => p.zones.map(z => h('tr', {}, h('th', {}, `${s.label}${p.zones.length > 1 ? ' — ' + z : ''}`), p.days.map(d => h('td', {}, (p.grid?.[key(d, s.id, z)] || []).join(', '))))))));
  const pname = h('input', { placeholder: 'ex. Mme Martin', 'data-testid': 'recre-name' });
  const pdays = new Set();
  return h('div', { class: 'page' },
    pageHeader('Surveillances de récréation', { favKey: 'organisation/recreation', actions: [h('button', { class: 'btn', type: 'button', 'data-testid': 'recre-print', onclick: () => printDocument(h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, 'Surveillances de récréation'), h('p', {}, `Établi le ${model.frShort(model.todayIso())}`)), printTab(),
      h('p', {}, Object.entries(c).map(([n, k]) => `${n} : ${k}`).join(' · '))), { orientation: 'landscape' }) }, icon('print', 16), 'Imprimer')] }),
    subTabs(),
    h('p', { class: 'muted' }, 'Planning de l’école : adultes, jours de présence (temps partiel), récréations et zones. « Répartir » équilibre le nombre de surveillances ; chaque case reste modifiable.'),
    h('div', { class: 'grid-2' },
      h('section', { class: 'card stack' }, h('h2', {}, 'Adultes'),
        people.length ? h('ul', { class: 'plain', 'data-testid': 'recre-people' }, people.map((x, i) => h('li', { class: 'row' }, h('strong', {}, x.name), h('span', { class: 'muted small' }, x.days?.length ? x.days.map(d => model.JOURS[d].slice(0, 3)).join(', ') : 'tous les jours'), h('span', { class: 'badge' }, `${c[x.name] || 0}`),
          h('button', { class: 'btn btn-link small', type: 'button', onclick: () => save({ people: people.filter((_, j) => j !== i) }, 'Adulte retiré', false) }, 'retirer')))) : h('p', { class: 'muted' }, 'Ajoutez les adultes qui surveillent.'),
        h('div', { class: 'row' }, pname, ...p.days.map(d => h('label', { class: 'chip' }, h('input', { type: 'checkbox', onchange: (e) => { e.target.checked ? pdays.add(d) : pdays.delete(d); } }), model.JOURS[d].slice(0, 3))),
          h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'recre-add', onclick: async () => { const n = pname.value.trim(); if (!n) return; if (people.some(x => x.name === n)) { toast('Déjà dans la liste'); return; } await save({ people: [...people, { name: n, days: [...pdays].sort() }] }, 'Adulte ajouté', false); } }, '+ Ajouter')),
        h('p', { class: 'muted small' }, 'Cochez les jours de présence (aucun = tous les jours).')),
      h('section', { class: 'card stack' }, h('h2', {}, 'Récréations et zones'),
        field('Jours', h('div', { class: 'chips' }, [1, 2, 3, 4, 5].map(d => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: p.days.includes(d), onchange: (e) => { const s = new Set(p.days); e.target.checked ? s.add(d) : s.delete(d); save({ days: [...s].sort() }, 'Jours', false); } }), model.JOURS[d])))),
        field('Récréations (une par ligne)', h('textarea', { rows: 3, onchange: (e) => save({ slots: e.target.value.split('\n').map(x => x.trim()).filter(Boolean).map((l, i) => ({ id: p.slots[i]?.id || `s${i}`, label: l })) }, 'Récréations', false) }, p.slots.map(s => s.label).join('\n'))),
        field('Zones (une par ligne)', h('textarea', { rows: 2, onchange: (e) => save({ zones: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) }, 'Zones', false) }, p.zones.join('\n'))))),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'recre-distribute', disabled: !people.length, onclick: async () => { const r = distribute({ ...p, people }); await save({ grid: r.grid }, 'Répartition des surveillances', false); toast('Surveillances réparties équitablement'); } }, 'Répartir équitablement'),
      holes.length ? h('span', { class: 'warn-text small' }, `${holes.length} case(s) sans adulte`) : null),
    h('section', { class: 'card' }, h('div', { class: 'table-wrap' }, table())));
  void rerender;
}
