// Sécurité et obligations de l'école : exercices incendie et PPMS (prévus, faits, trace datée),
// conseils d'école et APC (comptés depuis Réunions et 108 h). Les nombres attendus sont modifiables :
// ils varient selon la circonscription (note de rentrée de la DSDEN).
import * as store from '../store.js';
import * as model from '../model.js';
import { h, icon, toast, modal, field, formData, badge, confirmDialog } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { printDocument, printTable } from '../print.js';

export const DRILLS = [
  { kind: 'incendie', label: 'Exercice d’évacuation incendie', target: 2, hint: 'Le premier dans le mois qui suit la rentrée ; moins de 6 mois entre deux exercices. Signer le registre de sécurité (date, durée d’évacuation).' },
  { kind: 'ppms-rm', label: 'Exercice PPMS « risques majeurs »', target: 1, hint: 'Confinement ou mise à l’abri. Retour d’expérience transmis par la direction.' },
  { kind: 'ppms-ai', label: 'Exercice PPMS « attentat-intrusion »', target: 1, hint: 'S’échapper ou se cacher. Varier le scénario d’un exercice à l’autre.' },
];
const yearOf = () => { const cls = model.currentClass(); return cls ? store.get(cls.yearId) : store.all('year').find(y => !y.deletedAt) || null; };
const targets = (y) => ({ ...Object.fromEntries(DRILLS.map(d => [d.kind, d.target])), conseil: 3, ...(y?.safetyTargets || {}) });
export const drillsOf = (y) => store.all('drill').filter(d => !d.deletedAt && d.yearId === y?.id).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

/** État des obligations de l'année : pour l'accueil, la fin de période et cette page. */
export function safetyStatus(y = yearOf(), today = model.todayIso()) {
  if (!y) return [];
  const t = targets(y); const list = drillsOf(y);
  const ps = model.periodsOf(y); const start = ps[0]?.start || today;
  return DRILLS.map(d => {
    const done = list.filter(x => x.kind === d.kind && x.done);
    const planned = list.filter(x => x.kind === d.kind && !x.done && x.date >= today);
    const late = d.kind === 'incendie' && !done.length && today > model.addDays(start, 31);
    return { ...d, target: t[d.kind], done, planned, late, ok: done.length >= t[d.kind] };
  });
}

function drillDialog(y, kind, rec = null, { asDone = true } = {}) {
  const def = DRILLS.find(d => d.kind === kind);
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('p', { class: 'muted small' }, def.hint),
    h('div', { class: 'grid-3' },
      field('Date', h('input', { type: 'date', name: 'date', value: rec?.date || model.todayIso(), required: true, 'data-testid': 'drill-date' })),
      field('Heure', h('input', { type: 'time', name: 'time', value: rec?.time || '' })),
      asDone || rec?.done ? field(kind === 'incendie' ? 'Durée d’évacuation' : 'Durée', h('input', { name: 'duration', value: rec?.duration || '', placeholder: 'ex. 2 min 30', 'data-testid': 'drill-duration' })) : null),
    asDone || rec?.done ? field('Observations (déroulement, difficultés, améliorations)', h('textarea', { name: 'notes', rows: 3 }, rec?.notes || '')) : null);
  const actions = [{ label: 'Annuler' }];
  if (rec) actions.unshift({ label: 'Supprimer', danger: true, onClick: async () => { if (!await confirmDialog('Supprimer cet exercice ?', 'Il part à la corbeille (restaurable).', { confirmLabel: 'Supprimer', danger: true })) return false; if (rec.eventId && store.get(rec.eventId)) await store.remove(rec.eventId, 'Événement retiré'); await store.remove(rec.id, 'Exercice supprimé'); } });
  actions.push({ label: asDone || rec?.done ? 'Enregistrer' : 'Prévoir (ajouté à l’agenda)', primary: true, testid: 'drill-save', onClick: async () => {
    const d = formData(form); if (!d.date) return false;
    const done = rec ? (rec.done || asDone) : asDone;
    if (rec) { await store.update(rec.id, { ...d, done }, def.label); if (rec.eventId && store.get(rec.eventId)) await store.update(rec.eventId, { date: d.date, start: d.time || '', end: d.time ? endOf(d.time) : '' }, 'Agenda'); }
    else {
      let eventId = null;
      if (!done) { const ev = await store.create('event', { title: def.label, date: d.date, start: d.time || '', end: d.time ? endOf(d.time) : '', endDate: null, notes: def.hint, personal: false, blocksClass: false, classId: null, levels: [] }, `Agenda : ${def.label}`); eventId = ev.id; }
      await store.create('drill', { yearId: y.id, kind, ...d, done, eventId }, def.label);
    }
    toast(done ? 'Exercice noté au registre' : 'Exercice prévu et ajouté à l’agenda');
  } });
  modal({ title: rec ? def.label : (asDone ? `Noter : ${def.label.toLowerCase()}` : `Prévoir : ${def.label.toLowerCase()}`), body: form, actions });
}
const endOf = (t) => { const [a, b] = t.split(':').map(Number); const m = a * 60 + b + 30; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

export function render({ rerender }) {
  const y = yearOf();
  if (!y) return h('div', { class: 'page' }, pageHeader('Sécurité et obligations'), subTabs(), h('p', { class: 'muted' }, 'Créez d’abord une année scolaire dans Réglages.'));
  const st = safetyStatus(y);
  const t = targets(y);
  const list = drillsOf(y);
  const meetings = store.all('meeting').filter(m => !m.deletedAt && m.date >= (model.periodsOf(y)[0]?.start || '') && m.date <= (model.periodsOf(y).at(-1)?.end || '9999'));
  const ce = meetings.filter(m => m.kind === 'conseil d’école'); const cm = meetings.filter(m => m.kind === 'conseil des maîtres' || m.kind === 'conseil de cycle');
  const setTarget = async (k, v) => { await store.update(y.id, { safetyTargets: { ...(y.safetyTargets || {}), [k]: Math.max(0, Number(v) || 0) } }, 'Nombre d’exercices attendus'); rerender(); };
  const tgt = (k) => h('input', { type: 'number', min: 0, max: 9, value: t[k], class: 'num-input', 'aria-label': 'Nombre attendu dans l’année', onchange: (e) => setTarget(k, e.target.value) });
  const printReg = () => printDocument(printTable({ title: 'Registre des exercices de sécurité', subtitle: `${y.label}`, columns: ['Date', 'Heure', 'Exercice', 'Durée', 'Observations'].map(label => ({ label })),
    rows: list.filter(x => x.done).map(x => [model.frDate(x.date), x.time || '', DRILLS.find(d => d.kind === x.kind)?.label || x.kind, x.duration || '', x.notes || '']),
    footer: 'À reporter et signer dans le registre de sécurité de l’école.' }));

  return h('div', { class: 'page' },
    pageHeader('Sécurité et obligations', { favKey: 'orga/securite', subtitle: y.label, actions: [h('button', { class: 'btn', type: 'button', onclick: printReg }, icon('print', 16), 'Imprimer le registre')] }),
    subTabs(),
    h('p', { class: 'muted small' }, 'Nombres attendus par défaut : 2 exercices incendie, au moins 1 PPMS « risques majeurs » et 1 PPMS « attentat-intrusion », 3 conseils d’école (un par trimestre). Ils varient selon votre circonscription : modifiez-les d’après la note de rentrée de votre DSDEN.'),
    h('div', { class: 'stack' }, st.map(d => h('section', { class: 'card', 'data-testid': 'drill-card', 'data-kind': d.kind },
      h('div', { class: 'card-head' }, h('h2', {}, d.label),
        h('div', { class: 'row' }, d.ok ? badge(`${d.done.length}/${d.target} ♡`, 'ok') : d.late ? badge('en retard', 'warn') : badge(`${d.done.length}/${d.target}`, d.planned.length ? 'info' : 'muted'), h('label', { class: 'inline small' }, 'attendus :', tgt(d.kind)))),
      h('p', { class: 'small muted' }, d.hint),
      d.late ? h('p', { class: 'banner warn' }, 'Le premier exercice incendie se fait dans le mois qui suit la rentrée.') : null,
      [...d.done, ...d.planned].length ? h('ul', { class: 'plain drill-list' }, [...d.done, ...d.planned].map(x => h('li', {},
        x.done ? badge('fait', 'ok') : badge('prévu', 'info'), ` ${model.frDate(x.date)}${x.time ? ` à ${x.time}` : ''}${x.duration ? ` · ${x.duration}` : ''}${x.notes ? ` · ${x.notes}` : ''} `,
        h('button', { class: 'btn btn-link small', type: 'button', onclick: () => drillDialog(y, d.kind, x) }, 'modifier'),
        x.done ? null : h('button', { class: 'btn btn-link small', type: 'button', 'data-testid': 'drill-mark-done', onclick: () => drillDialog(y, d.kind, x, { asDone: true }) }, 'noter comme fait')))) : null,
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn btn-small btn-primary', type: 'button', 'data-testid': 'drill-done', onclick: () => drillDialog(y, d.kind, null, { asDone: true }) }, 'Noter un exercice fait'),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'drill-plan', onclick: () => drillDialog(y, d.kind, null, { asDone: false }) }, 'Prévoir (agenda)'))))),
    h('section', { class: 'card', 'data-testid': 'obligations-card' }, h('h2', {}, 'Conseils et APC'),
      h('ul', { class: 'plain' },
        h('li', { class: 'row wrap' }, ce.length >= t.conseil ? badge(`${ce.length}/${t.conseil} ♡`, 'ok') : badge(`${ce.length}/${t.conseil}`, 'muted'), h('strong', {}, 'Conseils d’école'), h('span', { class: 'muted small' }, 'au moins un par trimestre ; le bilan des exercices de sécurité est à l’ordre du jour'), h('a', { class: 'btn btn-small', href: '#/reunions' }, 'Réunions')),
        h('li', { class: 'row wrap' }, badge(String(cm.length), 'muted'), h('strong', {}, 'Conseils des maîtres et de cycle'), h('a', { class: 'btn btn-small', href: '#/reunions' }, 'Réunions')),
        h('li', { class: 'row wrap' }, h('strong', {}, 'APC et 108 h'), h('span', { class: 'muted small' }, 'suivi des heures et des séances d’APC'), h('a', { class: 'btn btn-small', href: '#/heures?t=apc' }, '108 h et APC')))));
}
