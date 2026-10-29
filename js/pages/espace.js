// Aujourd'hui › « Mon espace » : tableau de bord inspiré de l'espace de travail de l'enseignante —
// à faire aujourd'hui, important, matériel à préparer, notes ; à droite la semaine et le plan du jour.
// Tout vient des données déjà saisies (tâches, agenda, cahier journal) : rien n'est ressaisi.
import * as store from '../store.js';
import * as model from '../model.js';
import * as PL from '../planning.js';
import { h, icon, badge } from '../ui.js';
import { bound } from '../forms.js';
import { taskCard, taskDialog, weekTasksCalendar } from './agenda.js';

let weekOffset = 0;
const nextSchoolDays = (cls, from, n) => { const out = []; let d = from; for (let k = 0; out.length < n && k < 20; k++, d = model.addDays(d, 1)) if (PL.isSchoolDay(cls, d).ok && PL.isMyDay(cls, d)) out.push(d); return out; };

export function espace({ cls, planCard, rerender }) {
  const s = store.getSettings();
  const today = model.todayIso();
  const open = store.all('task').filter(t => !t.done);
  const todo = open.filter(t => (t.list || 'faire') === 'faire' && t.due && t.due <= today).sort((a, b) => (a.priority || 9) - (b.priority || 9) || (a.due || '').localeCompare(b.due || ''));
  const add = h('input', { placeholder: '+ Ajouter pour aujourd’hui (Entrée)', 'aria-label': 'Ajouter une tâche pour aujourd’hui', 'data-testid': 'espace-add', class: 'espace-add' });
  add.addEventListener('keydown', async (e) => { if (e.key === 'Enter' && add.value.trim()) await store.create('task', { title: add.value.trim(), due: today, list: 'faire', category: 'autre', done: false }, 'Tâche ajoutée'); });
  const important = open.filter(t => t.important).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const soon = []; for (let k = 0; k < 7; k++) { const d = model.addDays(today, k); for (const e of PL.eventsOn(d)) if (e.date === d || k === 0) soon.push({ d, e }); }
  const days = cls ? nextSchoolDays(cls, today, 3) : [];
  const mats = cls ? PL.materials(cls, days).filter(r => r.kind !== 'copie' || r.status === 'à faire') : [];
  const prints = open.filter(t => t.list === 'imprimer');
  const card = (title, icn, body, extra = null, testid = null) => h('section', { class: 'card espace-card', 'data-testid': testid }, h('div', { class: 'card-head' }, h('h2', { class: 'pill-title' }, icn ? icon(icn, 16) : null, ' ', title), extra), body);
  const left = h('div', { class: 'stack' },
    card('À faire aujourd’hui', 'check', h('div', { class: 'stack-sm' }, todo.length ? todo.map(t => taskCard(t)) : h('p', { class: 'muted small' }, 'Rien d’autre à faire aujourd’hui.'), add),
      h('a', { class: 'btn btn-small', href: '#/taches' }, 'Mes tâches'), 'espace-todo'),
    important.length || soon.length ? card('Important', 'alert', h('div', { class: 'stack-sm' },
      important.map(t => taskCard(t, { compact: true })),
      soon.map(({ d, e }) => h('div', { class: 'espace-event' }, h('strong', {}, d === today ? 'Aujourd’hui' : model.frDate(d, { weekday: 'short', day: 'numeric' })), ` ${e.start || ''} · ${e.title}`))), null, 'espace-important') : null,
    card('Le matériel à préparer', 'edit', mats.length || prints.length ? h('div', { class: 'mat-grid' },
      mats.slice(0, 8).map(r => h('a', { class: 'mat-card', href: `#/cahier?d=${r.date}` }, h('strong', {}, r.entry?.title || r.label), h('span', { class: 'small' }, r.label + (r.kind === 'copie' ? ` — ${r.count} ex.` : '')), h('span', { class: 'muted small' }, r.date === today ? 'aujourd’hui' : model.frDate(r.date, { weekday: 'short', day: 'numeric' })))),
      prints.map(t => h('div', { class: 'mat-card' }, taskCard(t, { compact: true }), h('span', { class: 'muted small' }, 'à imprimer'))))
      : h('p', { class: 'muted small' }, 'Rien à préparer pour les prochains jours de classe. Le matériel des fiches de séance programmées et les tâches « À imprimer » apparaissent ici.'),
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => taskDialog({ list: 'imprimer', due: today }) }, '+ À imprimer'), 'espace-materiel'),
    card('Notes', 'file', bound({ value: s.dashNotes || '', placeholder: 'Projet sortie de fin d’année, idées, choses à ne pas oublier…', compact: true, testid: 'espace-notes', onSave: (v) => store.setSettings({ dashNotes: v }) }), null, 'espace-notes-card'));
  const right = h('div', { class: 'stack' },
    h('section', { class: 'card espace-card' }, weekTasksCalendar({ offset: weekOffset, onNav: (o) => { weekOffset = o; rerender(); }, days: [1, 2, 3, 4, 5], testid: 'espace-week', compact: true })),
    planCard);
  return h('div', { class: 'espace' },
    h('div', { class: 'dash-banner', 'data-testid': 'espace-banner' }, h('span', {}, (s.dashTitle || 'Mon espace enseignante').toUpperCase())),
    h('div', { class: 'espace-grid' }, left, right));
}
