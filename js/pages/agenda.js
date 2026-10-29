// Agenda (personnel et professionnel), événements datés, tâches et échéances.
import * as store from '../store.js';
import * as model from '../model.js';
import * as PL from '../planning.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { levelChips } from '../pedago-ui.js';
import * as O from '../orga.js';

const CATS = ['préparation', 'administratif', 'familles', 'formation', 'personnel', 'autre'];

// ───────── Agenda (Planifier)
export function render({ query }) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.d || '') ? query.d : model.todayIso();
  const view = query.v === 'mois' ? 'mois' : 'semaine';
  const go = (d, v = view) => { location.hash = `#/agenda?d=${d}&v=${v}`; };
  const cls = model.currentClass();
  const nav = h('div', { class: 'daynav' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Précédent', onclick: () => go(view === 'mois' ? shiftMonth(date, -1) : model.addDays(date, -7)) }, icon('chevleft')),
    h('input', { type: 'date', value: date, 'aria-label': 'Date', onchange: (e) => e.target.value && go(e.target.value) }),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Suivant', onclick: () => go(view === 'mois' ? shiftMonth(date, 1) : model.addDays(date, 7)) }, icon('chevright')),
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => go(model.todayIso()) }, 'Aujourd’hui'),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' }, [['semaine', 'Semaine'], ['mois', 'Mois']].map(([v, l]) => h('button', { type: 'button', class: view === v ? 'on' : '', onclick: () => go(date, v) }, l))));
  const days = view === 'mois' ? monthDays(date) : Array.from({ length: 7 }, (_, i) => model.addDays(model.mondayOf(date), i));
  return h('div', { class: 'page' },
    pageHeader('Agenda', { favKey: 'planifier/agenda', subtitle: view === 'mois' ? model.frDate(date, { month: 'long', year: 'numeric' }) : `Semaine du ${model.frDate(model.mondayOf(date))}`,
      actions: [
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-event', onclick: () => eventDialog({ date }) }, icon('plus', 16), 'Événement'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'new-task', onclick: () => taskDialog({ due: date }) }, icon('check', 16), 'Tâche'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'export-ics', title: 'Fichier .ics à ouvrir dans l’agenda du téléphone ou de l’ordinateur', onclick: async () => { const R = await import('../rappels.js'); const r = await R.exportIcs(); if (r !== 'annulé') toast('Ouvrez le fichier « classeur-agenda.ics » : votre agenda importe les événements, rendez-vous et tâches, avec leurs alertes.', { timeout: 9000 }); } }, icon('calendar', 16), 'Vers mon agenda')] }),
    subTabs(), nav,
    h('div', { class: `agenda agenda-${view}`, 'data-testid': 'agenda' },
      view === 'mois' ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => h('div', { class: 'agenda-dow' }, d)) : null,
      days.map(d => dayCell(d, cls, view, date))),
    h('p', { class: 'muted small' }, 'Un événement qui « mobilise la classe » (sortie, visite, réunion sur temps de classe…) apparaît aussi dans le cahier journal, où les conflits avec les séances prévues sont signalés.'));
}

function shiftMonth(iso, n) { const [y, m] = iso.split('-').map(Number); return model.todayIso(new Date(y, m - 1 + n, 1)); }
function monthDays(iso) {
  const [y, m] = iso.split('-').map(Number);
  const first = model.todayIso(new Date(y, m - 1, 1));
  const start = model.mondayOf(first);
  const out = []; for (let i = 0; i < 42; i++) { const d = model.addDays(start, i); if (i >= 35 && d.slice(5, 7) !== first.slice(5, 7)) break; out.push(d); }
  return out;
}

function dayCell(d, cls, view, ref) {
  const evs = PL.eventsOn(d);
  const tasks = store.all('task').filter(t => t.due === d);
  const plan = cls ? PL.dayPlan(cls, d) : null;
  const today = d === model.todayIso();
  const other = view === 'mois' && d.slice(5, 7) !== ref.slice(5, 7);
  const compact = view === 'mois';
  return h('div', { class: `agenda-day ${today ? 'today' : ''} ${other ? 'other' : ''}` },
    h('div', { class: 'agenda-date' }, h('span', {}, model.frDate(d, compact ? { day: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' })),
      h('button', { class: 'add-mini', type: 'button', 'aria-label': `Ajouter un événement le ${model.frDate(d)}`, onclick: () => eventDialog({ date: d }) }, '+')),
    plan && plan.school.ok ? h('a', { class: 'agenda-class', href: `#/cahier?d=${d}` }, `${cls.name} : ${plan.entries.filter(e => e.kind !== 'event').length} créneau(x)`, plan.warnings.length ? ' ⚠' : '') : null,
    evs.map(e => h('button', { class: `agenda-ev ${e.personal ? 'perso' : ''}`, type: 'button', 'data-testid': 'agenda-event', onclick: () => eventDialog(e) }, e.start ? `${e.start} ` : '', e.title)),
    O.meetingsOn(d).map(m => h('a', { class: 'agenda-ev agenda-meeting', href: `#/reunions/${m.id}`, 'data-testid': 'agenda-meeting' }, m.start ? `${m.start} ` : '', m.title, m.cancelled ? ' (annulée)' : '')),
    O.pesItems().filter(x => x.date === d && x.kind !== 'objectif').map(x => h('a', { class: `agenda-ev agenda-pes ${x.done ? 'done' : ''}`, href: x.kind === 'visite' ? `#/pes/${x.id}` : '#/pes' }, x.kind === 'visite' ? `${x.start ? x.start + ' ' : ''}${x.title}` : `Échéance : ${x.title}`)),
    tasks.map(t => h('button', { class: `agenda-task ${t.done ? 'done' : ''}`, type: 'button', onclick: () => taskDialog(t) }, t.done ? '☑ ' : '☐ ', t.title)));
}

export function eventDialog(e = {}) {
  const editing = !!e.id;
  const cls = model.currentClass();
  let levels = e.levels || [];
  const form = h('form', { class: 'form', onsubmit: (ev) => ev.preventDefault() },
    h('div', { class: 'grid-2' }, field('Intitulé', h('input', { name: 'title', required: true, value: e.title || '' })),
      field('Type', h('select', { name: 'kind' }, PL.EVENT_KINDS.map(k => h('option', { value: k, selected: e.kind === k }, k))))),
    h('div', { class: 'grid-2' }, field('Date', h('input', { name: 'date', type: 'date', required: true, value: e.date || model.todayIso() })), field('Jusqu’au (plusieurs jours)', h('input', { name: 'endDate', type: 'date', value: e.endDate || '' }))),
    h('div', { class: 'grid-2' }, field('Début (vide = journée)', h('input', { name: 'start', type: 'time', value: e.start || '' })), field('Fin', h('input', { name: 'end', type: 'time', value: e.end || '' }))),
    h('div', { class: 'chips' },
      h('label', { class: 'chip' }, h('input', { type: 'checkbox', name: 'personal', checked: !!e.personal }), 'Personnel'),
      cls ? h('label', { class: 'chip' }, h('input', { type: 'checkbox', name: 'blocksClass', checked: !!e.blocksClass }), `Mobilise la classe ${cls.name}`) : null),
    cls && (cls.levels || []).length > 1 ? h('div', { class: 'field' }, h('label', {}, 'Niveaux concernés (aucun = toute la classe)'), levelChips(levels, cls.levels, (v) => { levels = v; })) : null,
    field('Notes', h('textarea', { name: 'notes', rows: 2 }, e.notes || '')));
  const errors = h('div', { class: 'form-errors', role: 'alert' });
  const actions = [{ label: 'Annuler' }];
  if (editing) actions.unshift({ label: 'Supprimer', danger: true, onClick: async () => { await store.remove(e.id, `Événement ${e.title} mis à la corbeille`); toast('Événement mis à la corbeille', { action: 'Annuler', onAction: () => store.undo() }); } });
  actions.push({ label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form);
    if (!d.title || !d.date) { errors.textContent = 'Intitulé et date obligatoires.'; return false; }
    if (d.endDate && d.endDate < d.date) { errors.textContent = 'La date de fin précède la date de début.'; return false; }
    if (d.start && d.end && d.end <= d.start) { errors.textContent = 'L’heure de fin doit suivre l’heure de début.'; return false; }
    if (d.start && !d.end) { errors.textContent = 'Indiquez aussi l’heure de fin.'; return false; }
    const data = { ...d, endDate: d.endDate || null, levels, classId: d.blocksClass && cls ? cls.id : null };
    if (d.personal) data.blocksClass = false;
    if (editing) await store.update(e.id, data, `Événement ${d.title}`);
    else await store.create('event', data, `Événement ${d.title}`);
    toast('Événement enregistré');
  } });
  modal({ title: editing ? 'Événement' : 'Nouvel événement', body: h('div', {}, form, errors), actions });
}

export const EFFORTS = ['moins de 5 min', '5 à 30 min', 'plus de 30 min'];
export const TASK_LISTS = [['faire', 'À faire'], ['imprimer', 'À imprimer']];
const toggleDone = (t) => store.update(t.id, { done: !t.done, doneAt: t.done ? null : new Date().toISOString() }, t.done ? 'Tâche rouverte' : 'Tâche faite');
/** Petite carte de tâche (case à cocher, durée estimée, priorité, importante). */
export function taskCard(t, { compact = false } = {}) {
  return h('div', { class: `task-card ${t.done ? 'done' : ''} ${t.important ? 'important' : ''}`, 'data-testid': 'task-card' },
    h('div', { class: 'task-card-head' }, h('input', { type: 'checkbox', checked: !!t.done, 'aria-label': `Tâche faite : ${t.title}`, onchange: () => toggleDone(t) }),
      h('button', { class: 'linklike task-title', type: 'button', onclick: () => taskDialog(t) }, t.title)),
    compact ? null : h('div', { class: 'row task-tags' }, t.effort ? h('span', { class: 'tag' }, t.effort) : null, t.priority ? h('span', { class: `tag prio prio-${t.priority}`, title: 'Priorité' }, String(t.priority)) : null,
      t.important ? badge('important', 'warn') : null, t.list === 'imprimer' ? badge('à imprimer', 'info') : null));
}
export function taskDialog(t = {}) {
  const editing = !!t.id;
  const form = h('form', { class: 'form', onsubmit: (ev) => ev.preventDefault() },
    field('Tâche', h('input', { name: 'title', required: true, value: t.title || '', 'data-testid': 'task-title' })),
    h('div', { class: 'grid-2' }, field('Échéance', h('input', { name: 'due', type: 'date', value: t.due || '', 'data-testid': 'task-due' })), field('Catégorie', h('select', { name: 'category' }, CATS.map(c => h('option', { value: c, selected: t.category === c }, c))))),
    h('div', { class: 'grid-3' },
      field('Liste', h('select', { name: 'list', 'data-testid': 'task-list-sel' }, TASK_LISTS.map(([v, l]) => h('option', { value: v, selected: (t.list || 'faire') === v }, l)))),
      field('Durée estimée', h('select', { name: 'effort', 'data-testid': 'task-effort' }, h('option', { value: '' }, '—'), EFFORTS.map(x => h('option', { value: x, selected: t.effort === x }, x)))),
      field('Priorité', h('select', { name: 'priority', 'data-testid': 'task-priority' }, [['', '—'], ['1', '1 (haute)'], ['2', '2'], ['3', '3 (basse)']].map(([v, l]) => h('option', { value: v, selected: String(t.priority || '') === v }, l))))),
    h('label', { class: 'inline' }, h('input', { type: 'checkbox', name: 'important', checked: !!t.important, 'data-testid': 'task-important' }), 'Important (affiché en haut d’Aujourd’hui)'),
    field('Notes', h('textarea', { name: 'notes', rows: 2 }, t.notes || '')));
  const actions = [{ label: 'Annuler' }];
  if (editing) {
    actions.unshift({ label: 'Supprimer', danger: true, onClick: async () => { await store.remove(t.id, 'Tâche mise à la corbeille'); toast('Tâche mise à la corbeille', { action: 'Annuler', onAction: () => store.undo() }); } });
    actions.splice(1, 0, { label: t.done ? 'Rouvrir' : 'Marquer faite', onClick: () => toggleDone(t) });
  }
  actions.push({ label: 'Enregistrer', primary: true, testid: 'task-save', onClick: async () => {
    const d = formData(form); if (!d.title) return false;
    const data = { ...d, important: !!form.querySelector('[name=important]').checked, priority: d.priority ? Number(d.priority) : null };
    if (editing) await store.update(t.id, data, 'Tâche modifiée'); else await store.create('task', { ...data, done: false }, `Tâche « ${d.title} »`);
  } });
  modal({ title: editing ? 'Tâche' : 'Nouvelle tâche', body: form, actions });
}

// ───────── Mes tâches : calendrier de la semaine, liste, archives ; « À faire » et « À imprimer »
let taskView = 'calendrier';
let taskWeek = 0;
export function weekTasksCalendar({ offset, onNav, withTasks = true, withEvents = true, days = [1, 2, 3, 4, 5, 6, 7], list = null, testid = 'week-cal', compact = false }) {
  const today = model.todayIso();
  const monday = model.addDays(model.mondayOf(today), offset * 7);
  const tasks = store.all('task').filter(t => !t.done && (!list || (t.list || 'faire') === list));
  const col = (d) => {
    const iso = model.addDays(monday, d - 1);
    const evs = withEvents ? PL.eventsOn(iso).filter(e => !e.personal || true) : [];
    const ts = withTasks ? tasks.filter(t => t.due === iso).sort((a, b) => (a.priority || 9) - (b.priority || 9)) : [];
    return h('div', { class: `wk-day ${iso === today ? 'today' : ''}` },
      h('div', { class: 'wk-head' }, h('span', { class: 'muted small' }, model.JOURS[d].slice(0, 3)), h('strong', {}, String(Number(iso.slice(8)))),
        h('button', { class: 'icon-btn wk-add', type: 'button', 'aria-label': `Ajouter une tâche le ${model.frShort(iso)}`, onclick: () => taskDialog({ due: iso, list: list || 'faire' }) }, icon('plus', 14))),
      evs.map(e => h('button', { class: 'wk-event', type: 'button', onclick: () => eventDialog(e) }, e.start ? h('span', { class: 'muted small' }, e.start + ' ') : null, e.title)),
      ts.map(t => taskCard(t, { compact })));
  };
  return h('div', { class: `wk-cal ${compact ? 'wk-compact' : ''}`, 'data-testid': testid },
    h('div', { class: 'row wk-nav' }, h('strong', {}, `Semaine du ${model.frDate(monday, { day: 'numeric', month: 'long' })}`),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Semaine précédente', onclick: () => onNav(offset - 1) }, icon('chevleft', 16)),
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => onNav(0) }, 'Cette semaine'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Semaine suivante', onclick: () => onNav(offset + 1) }, icon('chevright', 16))),
    h('div', { class: 'wk-grid', style: { '--wk-cols': days.length } }, days.map(col)));
}
export function renderTasks({ rerender }) {
  const today = model.todayIso();
  const tasks = store.all('task');
  const open = tasks.filter(t => !t.done);
  const quick = h('input', { placeholder: 'Nouvelle tâche… (Entrée pour ajouter, pour aujourd’hui)', 'aria-label': 'Nouvelle tâche', 'data-testid': 'quick-task' });
  quick.addEventListener('keydown', async (e) => { if (e.key === 'Enter' && quick.value.trim()) { await store.create('task', { title: quick.value.trim(), due: today, category: 'autre', list: 'faire', done: false }, 'Tâche ajoutée'); } });
  const section = (key, label) => {
    const mine = open.filter(t => (t.list || 'faire') === key);
    const monday = model.addDays(model.mondayOf(today), taskWeek * 7), sunday = model.addDays(monday, 6);
    const elsewhere = mine.filter(t => !t.due || t.due < monday || t.due > sunday).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const groups = [['En retard', mine.filter(t => t.due && t.due < today), 'warn'], ['Aujourd’hui', mine.filter(t => t.due === today), 'info'],
      ['À venir', mine.filter(t => t.due && t.due > today).sort((a, b) => a.due.localeCompare(b.due)), ''], ['Sans échéance', mine.filter(t => !t.due), 'muted']];
    return h('section', { class: 'card stack', 'data-testid': `tasks-${key}` }, h('h2', { class: 'section-band' }, label.toUpperCase()),
      taskView === 'calendrier' ? [weekTasksCalendar({ offset: taskWeek, onNav: (o) => { taskWeek = o; rerender(); }, list: key, withEvents: key === 'faire', testid: `week-cal-${key}` }),
        elsewhere.length ? h('details', { open: true }, h('summary', {}, `Autres dates et sans date (${elsewhere.length})`), h('div', { class: 'task-grid' }, elsewhere.map(t => h('div', {}, h('span', { class: 'muted small' }, t.due ? model.frShort(t.due) : 'sans date'), taskCard(t))))) : null]
      : taskView === 'liste' ? [groups.map(([t, list, k]) => list.length ? h('div', {}, h('h3', {}, t, ' ', badge(String(list.length), k)), h('div', { class: 'task-grid', 'data-testid': 'task-list' }, list.map(x => taskCard(x)))) : null), mine.length ? null : h('p', { class: 'muted' }, 'Rien en cours.')]
      : (() => { const done = tasks.filter(t => t.done && (t.list || 'faire') === key).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')).slice(0, 60); return done.length ? h('div', { class: 'task-grid' }, done.map(x => taskCard(x))) : h('p', { class: 'muted' }, 'Aucune tâche faite.'); })());
  };
  const upcoming = []; for (let k = 0; k < 14; k++) { const d = model.addDays(today, k); for (const e of PL.eventsOn(d)) if (e.date === d || k === 0) upcoming.push({ d, e }); }
  return h('div', { class: 'page' },
    pageHeader('Mes tâches et rendez-vous', { favKey: 'aujourdhui/taches', actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'task-new', onclick: () => taskDialog({}) }, icon('plus', 16), 'Tâche'), h('button', { class: 'btn', type: 'button', onclick: () => eventDialog({}) }, 'Rendez-vous')] }),
    subTabs(),
    h('div', { class: 'row wrap' }, h('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' }, [['calendrier', 'Calendrier'], ['liste', 'Liste'], ['archives', 'Archives']].map(([v, l]) => h('button', { type: 'button', class: taskView === v ? 'on' : '', 'data-testid': `tasks-view-${v}`, onclick: () => { taskView = v; rerender(); } }, l))), quick),
    section('faire', 'À faire'), section('imprimer', 'À imprimer'),
    h('section', { class: 'card' }, h('h2', {}, 'Rendez-vous et événements (14 jours)'),
      upcoming.length ? h('ul', { class: 'plain' }, upcoming.map(({ d, e }) => h('li', {}, h('strong', {}, model.frDate(d, { weekday: 'short', day: 'numeric', month: 'short' })), ` ${e.start || ''} `, h('button', { class: 'linklike', type: 'button', onclick: () => eventDialog(e) }, e.title), e.personal ? badge('perso', 'muted') : null)))
        : emptyState('Rien de prévu')));
}
