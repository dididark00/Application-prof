// Leçons numérotées par discipline, liées aux séances, avec dates de distribution réelles.
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { bound, iconBtn, pickMany } from '../forms.js';
import { filesBlock } from '../pedago-ui.js';

let openId = null;
const filt = { subject: '' };

export function nextNumber(classId, subject) {
  return Math.max(0, ...store.all('lesson').filter(l => l.classId === classId && l.subject === subject).map(l => Number(l.number) || 0)) + 1;
}

export function render({ query, rerender }) {
  if (query.open) openId = query.open;
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Leçons'), subTabs(), missing);
  const list = P.ofClass('lesson', cls.id).filter(l => !filt.subject || l.subject === filt.subject)
    .sort((a, b) => (a.subject || '').localeCompare(b.subject || '') || (Number(a.number) || 0) - (Number(b.number) || 0));
  return h('div', { class: 'page' },
    pageHeader('Leçons', { favKey: 'preparer/lecons', subtitle: `${cls.name} · numérotées par discipline`,
      actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-lesson', onclick: () => newLesson(cls) }, icon('plus', 16), 'Nouvelle leçon')] }),
    subTabs(),
    h('div', { class: 'filters' }, h('select', { 'aria-label': 'Discipline', onchange: (e) => { filt.subject = e.target.value; rerender(); } }, h('option', { value: '' }, 'Toutes disciplines'), model.subjects().map(s => h('option', { value: s, selected: filt.subject === s }, s)))),
    list.length ? h('div', { class: 'stack' }, list.map(l => card(l, cls, rerender))) : emptyState('Aucune leçon', 'Une leçon (trace écrite) est liée aux séances où elle est construite, et sa distribution réelle est datée.'));
}

async function newLesson(cls) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' }, field('Discipline', h('select', { name: 'subject' }, model.subjects().map(s => h('option', { value: s }, s)))), field('Titre', h('input', { name: 'title', required: true }))));
  modal({ title: 'Nouvelle leçon', body: form, actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, onClick: async () => {
    const d = formData(form); if (!d.title) return false;
    const id = store.uid(); openId = id;
    await store.create('lesson', { id, classId: cls.id, subject: d.subject, title: d.title, number: nextNumber(cls.id, d.subject), content: '', levels: [], sessionIds: [], fileIds: [], correctionFileIds: [], distributions: [] }, `Leçon « ${d.title} »`);
  } }] });
}

function card(l, cls, rerender) {
  const open = openId === l.id;
  const sessions = (l.sessionIds || []).map(id => store.get(id)).filter(x => x && !x.deletedAt);
  const save = (patch, label, quiet = true) => store.update(l.id, patch, label, { quiet });
  return h('section', { class: 'card', 'data-testid': 'lesson-card' },
    h('div', { class: 'card-head' },
      h('h2', {}, `${l.subject} n° ${l.number} — ${l.title}`),
      h('div', { class: 'row' }, (l.distributions || []).length ? badge(`distribuée le ${model.frShort(l.distributions.at(-1).date)}`, 'ok') : badge('non distribuée', 'muted'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => { openId = open ? null : l.id; rerender(); } }, open ? 'Replier' : 'Ouvrir'))),
    open ? h('div', {},
      h('div', { class: 'grid-3' },
        bound({ label: 'Numéro', type: 'number', value: l.number, onSave: (v) => save({ number: v }, 'Numéro') }),
        bound({ label: 'Titre', type: 'text', value: l.title, onSave: (v) => save({ title: v }, 'Titre') }),
        bound({ label: 'Discipline', type: 'select', value: l.subject, options: model.subjects(), onSave: (v) => save({ subject: v }, 'Discipline') })),
      bound({ label: 'Contenu (trace écrite)', value: l.content, onSave: (v) => save({ content: v }, 'Contenu') }),
      h('div', { class: 'linked' }, h('div', { class: 'linked-head' }, h('strong', {}, 'Séances liées'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
          const items = P.ofClass('session', cls.id).map(s => ({ id: s.id, label: P.sessionTitle(s), detail: s.subject, group: s.sequenceId ? P.sequenceTitle(store.get(s.sequenceId)) : 'Hors séquence' }));
          const sel = await pickMany({ title: 'Séances où la leçon est construite ou utilisée', items, selected: l.sessionIds || [] });
          if (sel) await save({ sessionIds: sel }, 'Séances liées', false);
        } }, 'Choisir…')),
        sessions.length ? h('ul', { class: 'linked-list' }, sessions.map(s => h('li', {}, h('a', { href: `#/seance/${s.id}` }, P.sessionTitle(s))))) : h('p', { class: 'muted small' }, 'Aucune.')),
      filesBlock(l.id, { title: 'Document de la leçon' }),
      filesBlock(l.id, { title: 'Corrections et photos du tableau', key: 'correctionFileIds' }),
      h('div', { class: 'linked' }, h('div', { class: 'linked-head' }, h('strong', {}, 'Distributions réelles'),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'distribute', onclick: () => distributeDialog(l, cls) }, 'Noter une distribution')),
        (l.distributions || []).length ? h('ul', { class: 'linked-list' }, l.distributions.map(d => h('li', {}, `${model.frDate(d.date)} — ${d.targets || 'toute la classe'}${d.note ? ` (${d.note})` : ''}`,
          h('button', { class: 'btn btn-link small', type: 'button', onclick: () => save({ distributions: store.get(l.id).distributions.filter(x => x.id !== d.id) }, 'Distribution retirée', false) }, 'retirer')))) : h('p', { class: 'muted small' }, 'Pas encore distribuée. La date réelle servira au rattrapage des absents (étape 3).')),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-ghost-danger btn-small', type: 'button', onclick: async () => {
        if (!await confirmDialog('Mettre la leçon à la corbeille ?', 'Vous pourrez la restaurer depuis la corbeille.', { confirmLabel: 'Mettre à la corbeille', danger: true })) return;
        await store.remove(l.id, `Leçon ${l.title} mise à la corbeille`);
      } }, 'Mettre à la corbeille'))) : null);
}

export function distributeDialog(l, cls, date = model.todayIso()) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Date', h('input', { name: 'date', type: 'date', value: date })),
    field('Destinataires', h('input', { name: 'targets', placeholder: 'toute la classe', value: (cls.levels || []).length > 1 ? '' : '' }), 'ex. CE2, groupe 2, ou laisser vide pour toute la classe'),
    field('Remarque', h('input', { name: 'note' })));
  modal({ title: `Distribution — ${l.title}`, body: form, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form); if (!d.date) return false;
    await store.update(l.id, { distributions: [...(store.get(l.id).distributions || []), { id: store.uid(), date: d.date, targets: d.targets, note: d.note }] }, `Leçon ${l.title} distribuée le ${model.frShort(d.date)}`);
    toast('Distribution enregistrée');
  } }] });
}
