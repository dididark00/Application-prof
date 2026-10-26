// Organisation › Surveillances : récréations et accueils (ex. 8 h 20 – 8 h 30, 13 h 20 – 13 h 30), réparties
// équitablement (en minutes) entre les adultes selon leurs jours de présence, modifiables case par case.
import * as store from '../store.js';
import * as model from '../model.js';
import { h, icon, toast, field } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { printDocument } from '../print.js';

const DEF = { days: [1, 2, 4, 5], slots: [{ id: 'm', label: 'Récréation du matin', kind: 'récréation', start: '', end: '' }, { id: 'a', label: 'Récréation de l’après-midi', kind: 'récréation', start: '', end: '' }], zones: ['Cour'], perZone: 1, people: [], grid: {} };
const PRESETS = [['récréation', 'Récréation', '', ''], ['accueil', 'Accueil du matin', '08:20', '08:30'], ['accueil', 'Accueil de l’après-midi', '13:20', '13:30']];
const minOf = (s) => { const m = s.start && s.end ? model.minutes(s.end) - model.minutes(s.start) : 0; return m > 0 ? m : 15; };
const hm = (t) => (t ? t.replace(/^0(\d)/, '$1').replace(':', ' h ') : '');
export const slotLabel = (s) => `${s.label}${s.start && s.end ? ` (${hm(s.start)} – ${hm(s.end)})` : ''}`;
/** Créneaux dans l'ordre de la journée ; zones propres au créneau (ex. « Portail ») sinon celles de l'école. */
export const slotsOf = (plan) => [...(plan.slots || [])].sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
const zonesOf = (plan, s) => (s.zones?.length ? s.zones : plan.zones);
export const planOf = () => store.all('recreplan')[0] || null;
async function save(patch, label = 'Planning des récréations', quiet = true) {
  const p = planOf();
  if (p) return store.update(p.id, patch, label, { quiet });
  return store.create('recreplan', { ...structuredClone(DEF), ...patch }, label);
}
const key = (d, s, z) => `${d}|${s}|${z}`;

/** Répartition équilibrée : à chaque case, les adultes présents ce jour-là qui ont le moins de minutes de surveillance. */
export function distribute(plan) {
  const grid = {}; const count = Object.fromEntries(plan.people.map(p => [p.name, 0]));
  // Les créneaux les plus longs d'abord : l'équilibre en minutes est meilleur.
  const order = [...plan.slots].sort((a, b) => minOf(b) - minOf(a));
  for (const s of order) for (const d of plan.days) {
    const busy = new Set();
    for (const z of zonesOf(plan, s)) {
      const avail = plan.people.filter(p => !(p.days?.length) || p.days.includes(d)).filter(p => !busy.has(p.name))
        .sort((a, b) => count[a.name] - count[b.name] || a.name.localeCompare(b.name, 'fr'));
      const chosen = avail.slice(0, plan.perZone || 1).map(p => p.name);
      chosen.forEach(n => { count[n] += minOf(s); busy.add(n); });
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
/** Minutes de surveillance par adulte et par semaine. */
export function minutesBy(plan) {
  const c = Object.fromEntries(plan.people.map(p => [p.name, 0]));
  for (const s of plan.slots) for (const d of plan.days) for (const z of zonesOf(plan, s)) for (const n of plan.grid?.[key(d, s.id, z)] || []) if (n in c) c[n] += minOf(s);
  return c;
}
/** Surveillances d'un adulte à une date (pour « Aujourd'hui »). */
export function dutiesOn(name, date) {
  const p = planOf(); if (!p || !name) return [];
  const d = model.weekday(date); if (!p.days.includes(d)) return [];
  return slotsOf(p).flatMap(s => zonesOf(p, s).filter(z => (p.grid?.[key(d, s.id, z)] || []).includes(name)).map(z => ({ slot: s, zone: z })));
}

export function render({ rerender }) {
  const p = planOf() || structuredClone(DEF);
  const people = p.people || [];
  const c = counts(p); const mins = minutesBy(p);
  const holes = []; for (const d of p.days) for (const s of p.slots) for (const z of zonesOf(p, s)) if (!(p.grid?.[key(d, s.id, z)] || []).length) holes.push(1);
  const ordered = slotsOf(p);
  const rowLabel = (s, z) => `${slotLabel(s)}${zonesOf(p, s).length > 1 || s.zones?.length ? ' — ' + z : ''}`;
  const cell = (d, s, z) => {
    const cur = p.grid?.[key(d, s.id, z)] || [];
    const sel = h('select', { 'aria-label': `${model.JOURS[d]} ${slotLabel(s)} ${z}`, 'data-testid': 'recre-cell', onchange: async (e) => { const g = { ...(planOf()?.grid || {}) }; g[key(d, s.id, z)] = e.target.value ? [e.target.value] : []; await save({ grid: g }, 'Surveillance modifiée', false); } },
      h('option', { value: '' }, '—'), people.map(x => h('option', { value: x.name, selected: cur[0] === x.name, disabled: x.days?.length && !x.days.includes(d) }, x.name)));
    return h('td', {}, sel, cur.slice(1).map(n => h('div', { class: 'small' }, n)));
  };
  const table = () => h('table', { class: 'table recre-table', 'data-testid': 'recre-table' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), p.days.map(d => h('th', {}, model.JOURS[d])))),
    h('tbody', {}, ordered.flatMap(s => zonesOf(p, s).map(z => h('tr', { class: s.kind === 'accueil' ? 'recre-accueil' : '' }, h('th', {}, rowLabel(s, z)), p.days.map(d => cell(d, s, z)))))));
  const printTab = () => h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, h('th', {}, ''), p.days.map(d => h('th', {}, model.JOURS[d])))),
    h('tbody', {}, ordered.flatMap(s => zonesOf(p, s).map(z => h('tr', {}, h('th', {}, rowLabel(s, z)), p.days.map(d => h('td', {}, (p.grid?.[key(d, s.id, z)] || []).join(', '))))))));
  const pname = h('input', { placeholder: 'ex. Mme Martin', 'data-testid': 'recre-name' });
  const pdays = new Set();
  return h('div', { class: 'page' },
    pageHeader('Surveillances (récréations et accueils)', { favKey: 'organisation/recreation', actions: [h('button', { class: 'btn', type: 'button', 'data-testid': 'recre-print', onclick: () => printDocument(h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, 'Surveillances — récréations et accueils'), h('p', {}, `Établi le ${model.frShort(model.todayIso())}`)), printTab(),
      h('p', {}, Object.entries(c).map(([n, k]) => `${n} : ${k} (${model.durationLabel(mins[n] || 0) || '0 min'} par semaine)`).join(' · '))), { orientation: 'landscape' }) }, icon('print', 16), 'Imprimer')] }),
    subTabs(),
    h('p', { class: 'muted' }, 'Planning de l’école : adultes, jours de présence (temps partiel), récréations, accueils (montée des élèves le matin ou après la pause) et zones. « Répartir » équilibre le temps de surveillance de chacun ; chaque case reste modifiable.'),
    h('div', { class: 'grid-2' },
      h('section', { class: 'card stack' }, h('h2', {}, 'Adultes'),
        people.length ? h('ul', { class: 'plain', 'data-testid': 'recre-people' }, people.map((x, i) => h('li', { class: 'row' }, h('strong', {}, x.name), h('span', { class: 'muted small' }, x.days?.length ? x.days.map(d => model.JOURS[d].slice(0, 3)).join(', ') : 'tous les jours'), h('span', { class: 'badge', title: 'surveillances par semaine' }, `${c[x.name] || 0}`), h('span', { class: 'muted small' }, model.durationLabel(mins[x.name] || 0) || ''), h('label', { class: 'inline small' }, h('input', { type: 'radio', name: 'recre-me', checked: store.getSettings().recreMe === x.name, onchange: () => store.setSettings({ recreMe: x.name }) }), 'c’est moi'),
          h('button', { class: 'btn btn-link small', type: 'button', onclick: () => save({ people: people.filter((_, j) => j !== i) }, 'Adulte retiré', false) }, 'retirer')))) : h('p', { class: 'muted' }, 'Ajoutez les adultes qui surveillent.'),
        h('div', { class: 'row' }, pname, ...p.days.map(d => h('label', { class: 'chip' }, h('input', { type: 'checkbox', onchange: (e) => { e.target.checked ? pdays.add(d) : pdays.delete(d); } }), model.JOURS[d].slice(0, 3))),
          h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'recre-add', onclick: async () => { const n = pname.value.trim(); if (!n) return; if (people.some(x => x.name === n)) { toast('Déjà dans la liste'); return; } await save({ people: [...people, { name: n, days: [...pdays].sort() }] }, 'Adulte ajouté', false); } }, '+ Ajouter')),
        h('p', { class: 'muted small' }, 'Cochez les jours de présence (aucun = tous les jours).')),
      h('section', { class: 'card stack' }, h('h2', {}, 'Récréations, accueils et zones'),
        field('Jours', h('div', { class: 'chips' }, [1, 2, 3, 4, 5].map(d => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: p.days.includes(d), onchange: (e) => { const s = new Set(p.days); e.target.checked ? s.add(d) : s.delete(d); save({ days: [...s].sort() }, 'Jours', false); } }), model.JOURS[d])))),
        h('div', { class: 'field' }, h('label', {}, 'Surveillances de la journée'),
          h('div', { class: 'stack recre-slots', 'data-testid': 'recre-slots' }, ordered.map(sl => {
            const upd = (patch, label) => save({ slots: (planOf()?.slots || p.slots).map(x => (x.id === sl.id ? { ...x, ...patch } : x)) }, label, false);
            return h('div', { class: 'recre-slot' },
              h('input', { value: sl.label, 'aria-label': 'Nom', class: 'recre-name-in', onchange: (e) => upd({ label: e.target.value.trim() || sl.label }, 'Surveillance renommée') }),
              h('input', { type: 'time', value: sl.start || '', 'aria-label': 'Début', onchange: (e) => upd({ start: e.target.value }, 'Horaire') }),
              h('input', { type: 'time', value: sl.end || '', 'aria-label': 'Fin', onchange: (e) => upd({ end: e.target.value }, 'Horaire') }),
              h('input', { value: (sl.zones || []).join(', '), placeholder: 'lieu (facultatif)', title: 'Vide : les zones de l’école', 'aria-label': 'Lieux', class: 'recre-zone-in', onchange: (e) => upd({ zones: e.target.value.split(',').map(x => x.trim()).filter(Boolean) }, 'Lieux') }),
              h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Retirer ${sl.label}`, onclick: () => save({ slots: p.slots.filter(x => x.id !== sl.id) }, 'Surveillance retirée', false) }, icon('trash', 14)));
          })),
          h('div', { class: 'row wrap' }, PRESETS.map(([kind, label, a, b], i) => h('button', { class: 'btn btn-small', type: 'button', 'data-testid': `recre-add-slot-${i}`, onclick: () => save({ slots: [...p.slots, { id: store.uid(), kind, label, start: a, end: b, zones: kind === 'accueil' ? [] : [] }] }, `${label} ajouté`, false) },
            `+ ${label}${a ? ` (${hm(a)} – ${hm(b)})` : ''}`)))),
        field('Zones de l’école (une par ligne)', h('textarea', { rows: 2, onchange: (e) => save({ zones: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) }, 'Zones', false) }, p.zones.join('\n'))))),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'recre-distribute', disabled: !people.length, onclick: async () => { const r = distribute({ ...p, people }); await save({ grid: r.grid }, 'Répartition des surveillances', false); toast('Surveillances réparties équitablement'); } }, 'Répartir équitablement'),
      holes.length ? h('span', { class: 'warn-text small' }, `${holes.length} case(s) sans adulte`) : null),
    h('section', { class: 'card' }, h('div', { class: 'table-wrap' }, table())));
  void rerender;
}
