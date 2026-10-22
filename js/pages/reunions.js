// Réunions et rendez-vous : ordre du jour, notes, compte rendu, décisions, tâches (avec
// responsable et échéance, visibles dans Tâches), documents, élèves concernés, 108 h.
// Les réunions apparaissent dans l'agenda (lecture directe, pas de copie).
import * as store from '../store.js';
import * as model from '../model.js';
import * as O from '../orga.js';
import * as C from '../confidential.js';
import { h, icon, toast, modal, field, formData, badge, emptyState, confirmDialog } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { bound, recField, pickMany, iconBtn } from '../forms.js';
import { filesBlock } from '../pedago-ui.js';
import { printDocument } from '../print.js';
import { contactDialog } from './contacts.js';

const filt = { q: '', kind: '', when: 'avenir' };
const SENSITIVE_KINDS = ['équipe éducative', 'équipe de suivi de scolarisation (ESS)'];

export function render({ params, rerender }) {
  if (params[0]) return detail(params[0], rerender);
  const today = model.todayIso();
  const all = O.meetings();
  const list = all.filter(m => (!filt.kind || m.kind === filt.kind) && (filt.when === 'tout' || (filt.when === 'avenir' ? m.date >= today : m.date < today))
    && (!filt.q || `${m.title} ${m.kind} ${m.place || ''}`.toLowerCase().includes(filt.q.toLowerCase())));
  if (filt.when === 'avenir') list.reverse();
  const openTasks = store.all('task').filter(t => t.meetingId && !t.done).length;
  return h('div', { class: 'page' },
    pageHeader('Réunions et rendez-vous', { favKey: 'organisation/reunions', subtitle: `${all.length} réunion(s) · ${openTasks} tâche(s) issue(s) de réunions à faire`,
      actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-meeting', onclick: () => meetingDialog() }, icon('plus', 16), 'Nouvelle réunion')] }),
    subTabs(),
    h('div', { class: 'filters' },
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Période' }, [['avenir', 'À venir'], ['passe', 'Passées'], ['tout', 'Toutes']].map(([k, l]) => h('button', { type: 'button', class: filt.when === k ? 'on' : '', onclick: () => { filt.when = k; rerender(); } }, l))),
      h('select', { 'aria-label': 'Type', onchange: (e) => { filt.kind = e.target.value; rerender(); } }, h('option', { value: '' }, 'Tous les types'), O.MEETING_KINDS.map(k => h('option', { value: k, selected: filt.kind === k }, k))),
      h('input', { type: 'search', placeholder: 'Rechercher…', value: filt.q, 'aria-label': 'Rechercher', onchange: (e) => { filt.q = e.target.value; rerender(); } })),
    list.length ? h('div', { class: 'stack' }, list.map(m => {
      const tasks = O.tasksOfMeeting(m.id);
      return h('a', { class: 'card link-card', href: `#/reunions/${m.id}`, 'data-testid': 'meeting-card' },
        h('div', { class: 'card-head' }, h('h2', {}, m.title, ' ', badge(m.kind, 'muted'), m.cancelled ? badge('annulée', 'warn') : null),
          h('span', { class: 'muted' }, `${model.frDate(m.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${m.start ? ` · ${m.start}${m.end ? '–' + m.end : ''}` : ''}`)),
        h('p', { class: 'muted small' }, [m.place, m.count108 ? `108 h : ${model.durationLabel(O.meetingMinutes(m)) || 'durée à préciser'}` : null,
          (m.decisions || []).length ? `${m.decisions.length} décision(s)` : null, tasks.length ? `${tasks.filter(t => !t.done).length}/${tasks.length} tâche(s) à faire` : null, m.minutes ? 'compte rendu rédigé' : null].filter(Boolean).join(' · ')));
    })) : emptyState('Aucune réunion', filt.when === 'avenir' ? 'Ajoutez les conseils, équipes éducatives, rendez-vous avec les familles…' : 'Aucune réunion dans cette vue.'));
}

export function meetingDialog(m = {}, { onCreated } = {}) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' }, field('Intitulé', h('input', { name: 'title', required: true, value: m.title || '', 'data-testid': 'meeting-title' })),
      field('Type', h('select', { name: 'kind', 'data-testid': 'meeting-kind' }, O.MEETING_KINDS.map(k => h('option', { value: k, selected: m.kind === k }, k))))),
    h('div', { class: 'grid-3' }, field('Date', h('input', { name: 'date', type: 'date', required: true, value: m.date || model.todayIso(), 'data-testid': 'meeting-date' })),
      field('Début', h('input', { name: 'start', type: 'time', value: m.start || '', 'data-testid': 'meeting-start' })), field('Fin', h('input', { name: 'end', type: 'time', value: m.end || '', 'data-testid': 'meeting-end' }))),
    field('Lieu', h('input', { name: 'place', value: m.place || '' })),
    h('label', { class: 'inline' }, h('input', { type: 'checkbox', name: 'count108', checked: m.count108 ?? true, 'data-testid': 'meeting-108' }), 'Compte dans les 108 h'));
  const err = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: 'Nouvelle réunion', body: h('div', {}, form, err), actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, onClick: async () => {
    const d = formData(form);
    if (!d.title.trim() || !d.date) { err.textContent = 'Intitulé et date obligatoires.'; return false; }
    if (d.start && d.end && d.end <= d.start) { err.textContent = 'L’heure de fin doit suivre l’heure de début.'; return false; }
    const r = await store.create('meeting', { ...d, count108: !!d.count108, cat108: O.DEFAULT_108[d.kind] || 'conseils', contactIds: [], studentIds: [], decisions: [], fileIds: [], agenda: '', notes: '', minutes: '', sensitive: SENSITIVE_KINDS.includes(d.kind) }, `Réunion « ${d.title} »`);
    if (onCreated) onCreated(r); else location.hash = `#/reunions/${r.id}`;
  } }] });
}

function detail(id, rerender) {
  const m = store.get(id);
  if (!m || m.deletedAt) return h('div', { class: 'page' }, pageHeader('Réunion introuvable'), h('a', { href: '#/reunions' }, '← Réunions'));
  const up = (patch, label) => store.update(m.id, patch, label);
  const tasks = O.tasksOfMeeting(m.id);
  const people = (m.contactIds || []).map(id => store.get(id)).filter(Boolean);
  const students = (m.studentIds || []).map(id => store.get(id)).filter(Boolean);
  const notesBlock = () => h('div', { class: 'fields' },
    recField(m.id, 'agenda', { label: 'Ordre du jour', testid: 'm-agenda' }),
    recField(m.id, 'notes', { label: 'Notes prises pendant la réunion', testid: 'm-notes' }),
    recField(m.id, 'minutes', { label: 'Compte rendu', testid: 'm-minutes' }));
  return h('div', { class: 'page' },
    h('p', {}, h('a', { href: '#/reunions', class: 'back' }, '← Réunions')),
    pageHeader(m.title, { subtitle: `${m.kind} · ${model.frDate(m.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${m.start ? ` · ${m.start}${m.end ? '–' + m.end : ''}` : ''}${m.place ? ` · ${m.place}` : ''}`,
      actions: [h('button', { class: 'btn', type: 'button', 'data-testid': 'meeting-print', onclick: () => printMinutes(m) }, icon('print', 16), 'Compte rendu (PDF)'),
        h('button', { class: 'btn btn-ghost-danger', type: 'button', onclick: async () => { if (await confirmDialog('Mettre la réunion à la corbeille ?', 'Les tâches créées restent dans vos tâches.', { danger: true, confirmLabel: 'Corbeille' })) { await store.remove(m.id, 'Réunion mise à la corbeille'); location.hash = '#/reunions'; } } }, 'Corbeille')] }),
    h('div', { class: 'grid-2' },
      h('section', { class: 'card form' }, h('h2', {}, 'Informations'),
        h('div', { class: 'grid-2' },
          bound({ label: 'Intitulé', type: 'text', value: m.title, onSave: (v) => v.trim() && up({ title: v.trim() }, 'Intitulé de réunion') }),
          bound({ label: 'Type', type: 'select', value: m.kind, options: O.MEETING_KINDS, onSave: (v) => up({ kind: v, cat108: O.DEFAULT_108[v] || m.cat108 }, 'Type de réunion') })),
        h('div', { class: 'grid-3' },
          bound({ label: 'Date', type: 'date', value: m.date, onSave: (v) => v && up({ date: v }, 'Date de réunion') }),
          bound({ label: 'Début', type: 'time', value: m.start, onSave: (v) => up({ start: v }, 'Heure de réunion') }),
          bound({ label: 'Fin', type: 'time', value: m.end, onSave: (v) => up({ end: v }, 'Heure de réunion') })),
        bound({ label: 'Lieu', type: 'text', value: m.place, onSave: (v) => up({ place: v }, 'Lieu de réunion') }),
        h('div', { class: 'chips' },
          bound({ label: 'Compte dans les 108 h', type: 'checkbox', value: m.count108, testid: 'm-count108', onSave: (v) => up({ count108: v }, '108 h') }),
          bound({ label: 'Annulée', type: 'checkbox', value: m.cancelled, onSave: (v) => up({ cancelled: v }, 'Réunion annulée') }),
          bound({ label: 'Contenu confidentiel', type: 'checkbox', value: m.sensitive, onSave: (v) => up({ sensitive: v }, 'Confidentialité de la réunion') })),
        m.count108 ? bound({ label: 'Catégorie 108 h', type: 'select', value: m.cat108 || 'conseils', options: O.H108_CATS, onSave: (v) => up({ cat108: v }, 'Catégorie 108 h') }) : null,
        m.count108 && !(m.start && m.end) ? bound({ label: 'Durée (minutes) si pas d’horaires', type: 'number', value: m.duration, onSave: (v) => up({ duration: v }, 'Durée de réunion') }) : null),
      h('section', { class: 'card' }, h('h2', {}, 'Participants et élèves'),
        h('div', { class: 'linked-head' }, h('strong', {}, 'Participants'), h('span', { class: 'row' },
          h('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
            const sel = await pickMany({ title: 'Participants (contacts de l’école)', items: O.contacts().map(c => ({ id: c.id, label: c.name, detail: c.role })), selected: m.contactIds || [], emptyText: 'Aucun contact : ajoutez-en avec « Nouveau contact ».' });
            if (sel) await up({ contactIds: sel }, 'Participants');
          } }, 'Choisir…'),
          h('button', { class: 'btn btn-small', type: 'button', onclick: () => contactDialog(null, { onSaved: (c) => c && up({ contactIds: [...(m.contactIds || []), c.id] }, 'Participant ajouté') }) }, 'Nouveau contact'))),
        people.length ? h('ul', { class: 'linked-list' }, people.map(c => h('li', {}, c.name, h('span', { class: 'muted small' }, ` · ${c.role}`)))) : h('p', { class: 'muted small' }, 'Aucun participant choisi.'),
        bound({ label: 'Autres participants (texte libre)', type: 'text', value: m.others, onSave: (v) => up({ others: v }, 'Participants') }),
        h('div', { class: 'linked-head' }, h('strong', {}, 'Élèves concernés'), h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'm-students', onclick: async () => {
          const cls = model.currentClass();
          const items = cls ? model.studentsOfClass(cls.id).map(({ student: s }) => ({ id: s.id, label: model.fullName(s, 'prenom') })) : [];
          const sel = await pickMany({ title: 'Élèves concernés', items, selected: m.studentIds || [] });
          if (sel) await up({ studentIds: sel }, 'Élèves concernés');
        } }, 'Choisir…')),
        students.length ? h('p', {}, students.map((s, i) => [i ? ', ' : '', h('a', { href: `#/eleve/${s.id}?t=echanges` }, model.fullName(s, 'prenom'))])) : h('p', { class: 'muted small' }, 'La réunion apparaîtra dans l’onglet « Échanges » des élèves choisis.'))),
    h('section', { class: 'card' }, h('h2', {}, 'Ordre du jour, notes et compte rendu'), m.sensitive ? C.gate(notesBlock, rerender) : notesBlock()),
    h('div', { class: 'grid-2' },
      h('section', { class: 'card' }, h('h2', {}, 'Décisions'),
        (m.decisions || []).length ? h('ol', { class: 'linked-list' }, m.decisions.map((d, i) => h('li', {}, d.text, iconBtn('trash', 'Retirer la décision', () => up({ decisions: m.decisions.filter((_, j) => j !== i) }, 'Décision retirée'))))) : h('p', { class: 'muted small' }, 'Aucune décision notée.'),
        addLine('Nouvelle décision…', 'm-decision', (t) => up({ decisions: [...(m.decisions || []), { id: store.uid(), text: t }] }, 'Décision ajoutée'))),
      h('section', { class: 'card' }, h('h2', {}, 'Tâches'),
        tasks.length ? h('ul', { class: 'linked-list' }, tasks.map(t => h('li', { class: 'task' },
          h('input', { type: 'checkbox', checked: !!t.done, 'aria-label': `Tâche faite : ${t.title}`, onchange: (e) => store.update(t.id, { done: e.target.checked, doneAt: e.target.checked ? new Date().toISOString() : null }, e.target.checked ? 'Tâche faite' : 'Tâche rouverte') }),
          h('span', { class: t.done ? 'muted' : '' }, t.title), t.owner ? badge(t.owner, 'muted') : null, t.due ? badge(`pour le ${model.frShort(t.due)}`, t.due < model.todayIso() && !t.done ? 'warn' : 'info') : null))) : h('p', { class: 'muted small' }, 'Aucune tâche.'),
        taskForm(m))),
    h('section', { class: 'card' }, filesBlock(m.id, { title: 'Documents' })));
}

function addLine(placeholder, testid, onAdd) {
  const input = h('input', { placeholder, 'data-testid': testid, 'aria-label': placeholder });
  const go = async () => { const t = input.value.trim(); if (t) { input.value = ''; await onAdd(t); } };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  return h('div', { class: 'row' }, input, h('button', { class: 'btn btn-small', type: 'button', onclick: go }, 'Ajouter'));
}

function taskForm(m) {
  const title = h('input', { placeholder: 'Tâche…', 'data-testid': 'm-task-title', 'aria-label': 'Tâche' });
  const owner = h('input', { placeholder: 'Responsable', list: 'm-owners', 'data-testid': 'm-task-owner', 'aria-label': 'Responsable' });
  const due = h('input', { type: 'date', 'data-testid': 'm-task-due', 'aria-label': 'Échéance' });
  const names = [store.getSettings().userName || 'moi', model.currentClass()?.binome?.name, ...(m.contactIds || []).map(O.contactName)].filter(Boolean);
  return h('div', { class: 'form' }, h('datalist', { id: 'm-owners' }, names.map(n => h('option', { value: n }))),
    h('div', { class: 'grid-3' }, title, owner, due),
    h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'm-task-add', onclick: async () => {
      if (!title.value.trim()) return;
      await store.create('task', { title: title.value.trim(), owner: owner.value.trim(), due: due.value, category: 'administratif', done: false, meetingId: m.id, notes: `Issue de la réunion « ${m.title} » du ${model.frShort(m.date)}` }, 'Tâche issue d’une réunion');
    } }, 'Ajouter la tâche'),
    h('p', { class: 'muted small' }, 'Les tâches apparaissent aussi dans Aujourd’hui › Tâches et dans l’agenda à leur échéance.'));
}

function printMinutes(m) {
  const tasks = O.tasksOfMeeting(m.id);
  const students = (m.studentIds || []).map(id => store.get(id)).filter(Boolean);
  const showPrivate = !m.sensitive || C.isUnlocked();
  printDocument(h('div', { class: 'print-doc' },
    h('div', { class: 'print-head' }, h('h1', {}, `Compte rendu — ${m.title}`),
      h('p', {}, `${m.kind} · ${model.frDate(m.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${m.start ? ` · ${m.start}${m.end ? '–' + m.end : ''}` : ''}${m.place ? ` · ${m.place}` : ''}`)),
    h('p', {}, h('strong', {}, 'Participants : '), [...(m.contactIds || []).map(id => { const c = store.get(id); return c ? `${c.name} (${c.role})` : ''; }), m.others].filter(Boolean).join(', ') || '—'),
    students.length ? h('p', {}, h('strong', {}, 'Élèves concernés : '), students.map(s => model.fullName(s, 'prenom')).join(', ')) : null,
    showPrivate ? [m.agenda ? [h('h2', {}, 'Ordre du jour'), h('p', { class: 'pre' }, m.agenda)] : null,
      m.minutes ? [h('h2', {}, 'Compte rendu'), h('p', { class: 'pre' }, m.minutes)] : (m.notes ? [h('h2', {}, 'Notes'), h('p', { class: 'pre' }, m.notes)] : null)]
      : h('p', {}, '(Contenu confidentiel non imprimé : déverrouillez-le d’abord pour l’inclure.)'),
    (m.decisions || []).length ? [h('h2', {}, 'Décisions'), h('ol', {}, m.decisions.map(d => h('li', {}, d.text)))] : null,
    tasks.length ? [h('h2', {}, 'Tâches'), h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Tâche'), h('th', {}, 'Responsable'), h('th', {}, 'Échéance'), h('th', {}, 'Fait'))),
      h('tbody', {}, tasks.map(t => h('tr', {}, h('td', {}, t.title), h('td', {}, t.owner || ''), h('td', {}, t.due ? model.frShort(t.due) : ''), h('td', {}, t.done ? 'oui' : '')))))] : null));
}
