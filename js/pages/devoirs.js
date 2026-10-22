// Devoirs : datés, liés aux séances et leçons, destinataires classe / niveau / élèves.
// Préparé ≠ donné en classe ≠ publié aux familles (publication : étape 5, jamais automatique).
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { filesBlock } from '../pedago-ui.js';
import { printDocument } from '../print.js';
import { printHomework } from '../printdocs.js';

const filt = { when: 'avenir' };

export function render({ query, rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Devoirs'), subTabs(), missing);
  if (query.session) { const sid = query.session; history.replaceState(null, '', '#/devoirs'); document.getElementById('main').dataset.route = location.hash; setTimeout(() => homeworkDialog(cls, { sessionId: sid, subject: store.get(sid)?.subject }), 0); }
  const today = model.todayIso();
  const all = P.ofClass('homework', cls.id).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const list = filt.when === 'avenir' ? all.filter(x => (x.dueDate || '') >= today) : all.slice().reverse();
  return h('div', { class: 'page' },
    pageHeader('Devoirs', { favKey: 'planifier/devoirs', subtitle: cls.name,
      actions: [
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-homework', onclick: () => homeworkDialog(cls) }, icon('plus', 16), 'Nouveau devoir'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'print-homework', onclick: () => printDocument(printHomework(cls, list)) }, icon('print', 16), 'Imprimer')] }),
    subTabs(),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Filtre' }, [['avenir', 'À venir'], ['tous', 'Tous']].map(([v, l]) => h('button', { type: 'button', class: filt.when === v ? 'on' : '', onclick: () => { filt.when = v; rerender(); } }, l))),
    h('p', { class: 'muted small' }, 'La publication aux familles arrivera avec le portail familles (étape 5) et ne se fera jamais sans votre action.'),
    list.length ? h('div', { class: 'stack', 'data-testid': 'homework-list' }, list.map(x => {
      const s = x.sessionId ? store.get(x.sessionId) : null; const l = x.lessonId ? store.get(x.lessonId) : null;
      return h('div', { class: 'card' }, h('div', { class: 'card-head' },
        h('h2', {}, `Pour le ${model.frDate(x.dueDate, { weekday: 'long', day: 'numeric', month: 'long' })} — ${x.title}`),
        h('div', { class: 'row' }, badge(x.status || 'préparé', x.status === 'donné' ? 'ok' : 'muted'),
          x.status !== 'donné' ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => store.update(x.id, { status: 'donné' }, 'Devoir donné en classe') }, 'Marquer donné') : null,
          h('button', { class: 'btn btn-small', type: 'button', onclick: () => homeworkDialog(cls, x) }, 'Modifier'),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mettre à la corbeille', onclick: async () => { await store.remove(x.id, 'Devoir mis à la corbeille'); toast('Devoir mis à la corbeille', { action: 'Annuler', onAction: () => store.undo() }); } }, icon('trash', 16)))),
        h('p', { class: 'muted' }, [x.subject, `donné le ${model.frShort(x.givenDate)}`, targetLabel(x)].filter(Boolean).join(' · ')),
        x.details ? h('p', { class: 'pre' }, x.details) : null,
        s || l ? h('p', { class: 'small' }, s ? ['Séance : ', h('a', { href: `#/seance/${s.id}` }, P.sessionTitle(s))] : null, s && l ? ' · ' : '', l ? `Leçon n° ${l.number} ${l.title}` : '') : null,
        filesBlock(x.id, { title: 'Pièces jointes' }));
    })) : emptyState('Aucun devoir', filt.when === 'avenir' ? 'Aucun devoir à venir.' : ''));
}

export function targetLabel(x) {
  const t = x.targets || { kind: 'classe' };
  if (t.kind === 'classe') return 'toute la classe';
  if (t.kind === 'niveau') return (t.values || []).join(', ');
  return `${(t.values || []).length} élève(s) : ${(t.values || []).map(id => store.get(id)?.firstName).filter(Boolean).join(', ')}`;
}

export function homeworkDialog(cls, x = {}) {
  const editing = !!x.id;
  const students = model.studentsOfClass(cls.id);
  const chosen = new Set(x.targets?.kind === 'élèves' ? x.targets.values : []);
  const levels = new Set(x.targets?.kind === 'niveau' ? x.targets.values : []);
  const sessions = P.ofClass('session', cls.id);
  const lessons = P.ofClass('lesson', cls.id);
  const kindSel = h('select', { name: 'kind' }, [['classe', 'Toute la classe'], ['niveau', 'Un ou plusieurs niveaux'], ['élèves', 'Des élèves']].map(([v, l]) => h('option', { value: v, selected: (x.targets?.kind || 'classe') === v }, l)));
  const lvBox = h('div', { class: 'chips' }, (cls.levels || []).map(l => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: levels.has(l), onchange: (e) => { e.target.checked ? levels.add(l) : levels.delete(l); } }), l)));
  const stBox = h('div', { class: 'chips' }, students.map(({ student: s }) => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: chosen.has(s.id), onchange: (e) => { e.target.checked ? chosen.add(s.id) : chosen.delete(s.id); } }), `${s.firstName} ${s.lastName}`)));
  const sync = () => { lvBox.hidden = kindSel.value !== 'niveau'; stBox.hidden = kindSel.value !== 'élèves'; };
  kindSel.addEventListener('change', sync); sync();
  const today = model.todayIso();
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Travail demandé', h('input', { name: 'title', required: true, value: x.title || '', placeholder: 'ex. Apprendre la leçon n° 3' })),
    field('Détails', h('textarea', { name: 'details', rows: 2 }, x.details || '')),
    h('div', { class: 'grid-3' },
      field('Donné le', h('input', { name: 'givenDate', type: 'date', value: x.givenDate || today })),
      field('Pour le', h('input', { name: 'dueDate', type: 'date', required: true, value: x.dueDate || model.addDays(x.givenDate || today, 1) })),
      field('Discipline', h('select', { name: 'subject' }, h('option', { value: '' }, '—'), model.subjects().map(s => h('option', { value: s, selected: x.subject === s }, s))))),
    field('Pour qui', kindSel), lvBox, stBox,
    h('div', { class: 'grid-2' },
      field('Séance liée', h('select', { name: 'sessionId' }, h('option', { value: '' }, '—'), sessions.map(s => h('option', { value: s.id, selected: s.id === x.sessionId }, P.sessionTitle(s))))),
      field('Leçon liée', h('select', { name: 'lessonId' }, h('option', { value: '' }, '—'), lessons.map(l => h('option', { value: l.id, selected: l.id === x.lessonId }, `${l.subject} n° ${l.number} ${l.title}`))))));
  const errors = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: editing ? 'Modifier le devoir' : 'Nouveau devoir', wide: true, body: h('div', {}, form, errors), actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form);
    if (!d.title || !d.dueDate) { errors.textContent = 'Travail et date sont obligatoires.'; return false; }
    if (d.dueDate < d.givenDate) { errors.textContent = 'La date d’échéance précède la date où le devoir est donné.'; return false; }
    const targets = d.kind === 'classe' ? { kind: 'classe', values: [] } : { kind: d.kind, values: d.kind === 'niveau' ? [...levels] : [...chosen] };
    if (d.kind !== 'classe' && !targets.values.length) { errors.textContent = 'Choisissez au moins un destinataire.'; return false; }
    const data = { title: d.title, details: d.details, givenDate: d.givenDate, dueDate: d.dueDate, subject: d.subject, targets, sessionId: d.sessionId || null, lessonId: d.lessonId || null };
    if (editing) await store.update(x.id, data, 'Devoir modifié');
    else await store.create('homework', { ...data, classId: cls.id, status: 'préparé', fileIds: [] }, `Devoir « ${d.title} »`);
    toast('Devoir enregistré');
  } }] });
}
