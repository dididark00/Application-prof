// Devoirs : datés, liés aux séances et leçons, destinataires classe / niveau / élèves.
// Préparé ≠ donné en classe ≠ transmis aux familles (jamais automatique).
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
    h('p', { class: 'muted small' }, 'Les familles ont les devoirs par le cahier de texte des élèves, un mot imprimé, un e-mail ou l’application de l’école. Familles › Aperçu parent montre ce que chaque famille peut recevoir.'),
    list.length ? h('div', { class: 'stack', 'data-testid': 'homework-list' }, groupByDue(list).map(([due, xs]) => h('div', { class: 'card hw-day', 'data-testid': 'homework-day' },
      h('div', { class: 'card-head' }, h('h2', {}, `Pour le ${model.frDate(due, { weekday: 'long', day: 'numeric', month: 'long' })}`),
        h('div', { class: 'row' },
          xs.some(x => x.status !== 'donné') ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => store.batch(xs.filter(x => x.status !== 'donné').map(x => ({ id: x.id, patch: { status: 'donné' } })), 'Devoirs donnés en classe') }, xs.length > 1 ? 'Tout marquer donné' : 'Marquer donné') : badge('donné', 'ok'),
          h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'hw-add-day', onclick: () => homeworkDialog(cls, { dueDate: due, givenDate: xs[0].givenDate }) }, icon('plus', 14), 'Ajouter'))),
      h('ul', { class: 'hw-lines' }, xs.map(x => {
        const s = x.sessionId ? store.get(x.sessionId) : null; const l = x.lessonId ? store.get(x.lessonId) : null;
        return h('li', { class: 'hw-line', 'data-testid': 'homework-line', style: { '--c': model.subjectColor(x.subject) } },
          h('div', { class: 'hw-line-head' }, h('span', { class: 'hw-subject' }, x.subject || 'Sans discipline'), h('strong', {}, x.title),
            x.status === 'donné' ? null : badge(x.status || 'préparé', 'muted'),
            h('span', { class: 'row hw-actions' },
              h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'hw-edit', onclick: () => homeworkDialog(cls, x) }, 'Modifier'),
              h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Mettre « ${x.title} » à la corbeille`, onclick: async () => { await store.remove(x.id, 'Devoir mis à la corbeille'); toast('Devoir mis à la corbeille', { action: 'Annuler', onAction: () => store.undo() }); } }, icon('trash', 16)))),
          x.details ? h('p', { class: 'pre small' }, x.details) : null,
          h('p', { class: 'muted small' }, [`donné le ${model.frShort(x.givenDate)}`, targetLabel(x)].join(' · '),
            s ? [' · Séance : ', h('a', { href: `#/seance/${s.id}` }, P.sessionTitle(s))] : null, l ? ` · Leçon n° ${l.number} ${l.title}` : ''),
          (x.fileIds || []).length ? filesBlock(x.id, { title: 'Pièces jointes' }) : h('details', { class: 'small' }, h('summary', {}, 'Pièces jointes'), filesBlock(x.id, { title: 'Pièces jointes' })));
      }))))) : emptyState('Aucun devoir', filt.when === 'avenir' ? 'Aucun devoir à venir.' : ''));
}

/** Devoirs regroupés par date d'échéance (une carte par jour, une ligne par discipline). */
function groupByDue(list) {
  const m = new Map();
  for (const x of list) { const k = x.dueDate || ''; if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  const order = model.subjects();
  for (const xs of m.values()) xs.sort((a, b) => ((a.groupId || a.id) === (b.groupId || b.id) ? (a.order ?? 0) - (b.order ?? 0) : 0) || order.indexOf(a.subject) - order.indexOf(b.subject));
  return [...m.entries()];
}

export function targetLabel(x) {
  const t = x.targets || { kind: 'classe' };
  if (t.kind === 'classe') return 'toute la classe';
  if (t.kind === 'niveau') return (t.values || []).join(', ');
  return `${(t.values || []).length} élève(s) : ${(t.values || []).map(id => store.get(id)?.firstName).filter(Boolean).join(', ')}`;
}

export function homeworkDialog(cls, x = {}) {
  const editing = !!x.id;
  // Un même « devoir » peut regrouper plusieurs disciplines (groupId commun) : on les édite ensemble.
  const group = editing ? (x.groupId ? P.ofClass('homework', cls.id).filter(y => y.groupId === x.groupId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [x]) : [];
  const first = group[0] || x;
  const students = model.studentsOfClass(cls.id);
  const chosen = new Set(first.targets?.kind === 'élèves' ? first.targets.values : []);
  const levels = new Set(first.targets?.kind === 'niveau' ? first.targets.values : []);
  const sessions = P.ofClass('session', cls.id);
  const lessons = P.ofClass('lesson', cls.id);
  const kindSel = h('select', { name: 'kind' }, [['classe', 'Toute la classe'], ['niveau', 'Un ou plusieurs niveaux'], ['élèves', 'Des élèves']].map(([v, l]) => h('option', { value: v, selected: (first.targets?.kind || 'classe') === v }, l)));
  const lvBox = h('div', { class: 'chips' }, (cls.levels || []).map(l => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: levels.has(l), onchange: (e) => { e.target.checked ? levels.add(l) : levels.delete(l); } }), l)));
  const stBox = h('div', { class: 'chips' }, students.map(({ student: s }) => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: chosen.has(s.id), onchange: (e) => { e.target.checked ? chosen.add(s.id) : chosen.delete(s.id); } }), `${s.firstName} ${s.lastName}`)));
  const sync = () => { lvBox.hidden = kindSel.value !== 'niveau'; stBox.hidden = kindSel.value !== 'élèves'; };
  kindSel.addEventListener('change', sync); sync();
  const today = model.todayIso();

  // Lignes : une par discipline.
  const rows = (group.length ? group : [{ subject: x.subject || '', title: x.title || '', details: x.details || '', sessionId: x.sessionId || null, lessonId: x.lessonId || null }])
    .map(r => ({ id: r.id || null, subject: r.subject || '', title: r.title || '', details: r.details || '', sessionId: r.sessionId || null, lessonId: r.lessonId || null }));
  const rowsBox = h('div', { class: 'hw-rows', 'data-testid': 'hw-rows' });
  const subjOpts = (v) => [h('option', { value: '' }, 'Discipline…'), ...model.subjects().map(s => h('option', { value: s, selected: v === s }, s))];
  const drawRows = () => rowsBox.replaceChildren(...rows.map((r, i) => h('div', { class: 'hw-row', 'data-testid': 'hw-row' },
    h('div', { class: 'hw-row-main' },
      h('select', { 'aria-label': 'Discipline', 'data-testid': 'hw-subject', onchange: (e) => { r.subject = e.target.value; } }, subjOpts(r.subject)),
      h('input', { value: r.title, placeholder: 'Travail demandé, ex. Apprendre la leçon n° 3', 'aria-label': 'Travail demandé', 'data-testid': 'hw-title', oninput: (e) => { r.title = e.target.value; } }),
      rows.length > 1 ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retirer cette discipline', onclick: () => { rows.splice(i, 1); drawRows(); } }, icon('trash', 16)) : null),
    h('details', { open: !!(r.details || r.sessionId || r.lessonId) || null }, h('summary', { class: 'small muted' }, 'Détails, séance ou leçon liée'),
      h('div', { class: 'form' },
        h('textarea', { rows: 2, placeholder: 'Détails (facultatif)', 'aria-label': 'Détails', oninput: (e) => { r.details = e.target.value; } }, r.details),
        h('div', { class: 'grid-2' },
          field('Séance liée', h('select', { onchange: (e) => { r.sessionId = e.target.value || null; } }, h('option', { value: '' }, '—'), sessions.map(s => h('option', { value: s.id, selected: s.id === r.sessionId }, P.sessionTitle(s))))),
          field('Leçon liée', h('select', { onchange: (e) => { r.lessonId = e.target.value || null; } }, h('option', { value: '' }, '—'), lessons.map(l => h('option', { value: l.id, selected: l.id === r.lessonId }, `${l.subject} n° ${l.number} ${l.title}`))))))))));
  drawRows();
  const addRow = h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'hw-add-row', onclick: () => { rows.push({ id: null, subject: '', title: '', details: '', sessionId: null, lessonId: null }); drawRows(); rowsBox.querySelector('.hw-row:last-child select')?.focus(); } }, icon('plus', 14), 'Ajouter une discipline');

  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' },
      field('Donné le', h('input', { name: 'givenDate', type: 'date', value: first.givenDate || x.givenDate || today })),
      field('Pour le', h('input', { name: 'dueDate', type: 'date', required: true, value: first.dueDate || x.dueDate || model.addDays(first.givenDate || x.givenDate || today, 1) }))),
    h('div', { class: 'field' }, h('label', {}, 'Devoirs (une ligne par discipline)'), rowsBox, addRow),
    field('Pour qui', kindSel), lvBox, stBox);
  const errors = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: editing ? 'Modifier les devoirs' : 'Nouveaux devoirs', wide: true, body: h('div', {}, form, errors), actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, testid: 'hw-save', onClick: async () => {
    const d = formData(form);
    const filled = rows.filter(r => r.title.trim());
    if (!filled.length || !d.dueDate) { errors.textContent = 'Indiquez au moins un travail et la date.'; return false; }
    if (rows.some(r => !r.title.trim() && r.subject)) { errors.textContent = 'Une discipline n’a pas de travail : complétez-la ou retirez la ligne.'; return false; }
    if (d.dueDate < d.givenDate) { errors.textContent = 'La date d’échéance précède la date où le devoir est donné.'; return false; }
    const targets = d.kind === 'classe' ? { kind: 'classe', values: [] } : { kind: d.kind, values: d.kind === 'niveau' ? [...levels] : [...chosen] };
    if (d.kind !== 'classe' && !targets.values.length) { errors.textContent = 'Choisissez au moins un destinataire.'; return false; }
    const groupId = filled.length > 1 ? (first.groupId || store.uid()) : (first.groupId || null);
    const common = { givenDate: d.givenDate, dueDate: d.dueDate, targets, groupId };
    const ops = filled.map((r, i) => {
      const data = { ...common, title: r.title.trim(), details: r.details, subject: r.subject, sessionId: r.sessionId, lessonId: r.lessonId, order: i };
      return r.id ? { id: r.id, patch: data } : { create: { type: 'homework', data: { ...data, classId: cls.id, status: 'préparé', fileIds: [] } } };
    });
    const kept = new Set(filled.map(r => r.id).filter(Boolean));
    for (const g of group) if (!kept.has(g.id)) ops.push({ id: g.id, patch: { deletedAt: new Date().toISOString() } });
    await store.batch(ops, filled.length > 1 ? `Devoirs (${filled.length} disciplines)` : `Devoir « ${filled[0].title.trim()} »`);
    toast(filled.length > 1 ? `${filled.length} devoirs enregistrés` : 'Devoir enregistré');
  } }] });
}
