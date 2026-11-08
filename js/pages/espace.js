// Aujourd'hui › « Mon espace » : tableau de bord inspiré de l'espace de travail de l'enseignante —
// à faire aujourd'hui, important, matériel à préparer, notes ; à droite la semaine et le plan du jour.
// Tout vient des données déjà saisies (tâches, agenda, cahier journal) : rien n'est ressaisi.
import * as store from '../store.js';
import { safetyStatus } from './securite.js';
import * as D from '../device.js';
import * as model from '../model.js';
import * as PL from '../planning.js';
import { h, icon, badge } from '../ui.js';
import { bound } from '../forms.js';
import { taskCard, taskDialog, weekTasksCalendar } from './agenda.js';

let weekOffset = 0;
const nextSchoolDays = (cls, from, n) => { const out = []; let d = from; for (let k = 0; out.length < n && k < 20; k++, d = model.addDays(d, 1)) if (PL.isSchoolDay(cls, d).ok && PL.isMyDay(cls, d)) out.push(d); return out; };

const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
/**
 * Rappel de synchronisation et de sauvegarde (rempli après coup : l'état de l'appareil se lit en asynchrone).
 * - synchronisation configurée et dernier envoi ou dernière récupération il y a 3 jours ou plus ;
 * - sauvegarde exportée il y a 7 jours ou plus (ou jamais, s'il y a des données).
 */
export function syncReminder() {
  const slot = h('div', { class: 'moment-slot', 'data-testid': 'sync-reminder-slot' });
  (async () => {
    const days = (iso) => (iso ? Math.floor((Date.now() - new Date(iso)) / 86400000) : null);
    const lastSend = await D.get('lastSync'); const seen = (await D.get('seen')) || {};
    const lastRecv = Object.values(seen).map(x => x.mergedAt).filter(Boolean).sort().at(-1) || null;
    const configured = !!(lastSend || lastRecv || (await D.get('syncPassword')));
    const rows = [];
    const ds = days(lastSend), dr = days(lastRecv);
    if (configured && ((ds ?? 99) >= 3 || (dr ?? 99) >= 3)) rows.push(h('a', { class: 'moment-row', href: '#/reglages/synchro', 'data-testid': 'sync-reminder' },
      h('span', { class: 'moment-title' }, h('strong', {}, 'Synchroniser avec Nuage'),
        h('small', {}, [ds == null ? 'jamais envoyé' : `envoyé il y a ${ds} j`, dr == null ? 'jamais récupéré' : `récupéré il y a ${dr} j`].join(' · ')))));
    const lb = store.getSettings().lastBackupAt; const db = days(lb);
    if (store.count() > 0 && (db == null || db >= 7)) rows.push(h('a', { class: 'moment-row', href: '#/reglages/sauvegarde', 'data-testid': 'backup-reminder' },
      h('span', { class: 'moment-title' }, h('strong', {}, 'Faire une sauvegarde'), h('small', {}, db == null ? 'aucune sauvegarde exportée pour l’instant' : `la dernière date de ${db} jours`))));
    slot.replaceChildren(...rows);
  })().catch(() => {});
  return slot;
}

/** Anniversaires des élèves dans les 7 prochains jours (ceux du week-end sont annoncés le vendredi). */
export function upcomingBirthdays(cls, today, days = 7) {
  const out = [];
  for (const { student: s } of model.studentsOfClass(cls.id, { date: today })) {
    if (!s.birthDate) continue;
    for (let k = 0; k <= days; k++) { const d = model.addDays(today, k); if (d.slice(5) === s.birthDate.slice(5)) { out.push({ s, date: d, age: Number(d.slice(0, 4)) - Number(s.birthDate.slice(0, 4)), inDays: k }); break; } }
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}
function birthdays(cls, today) {
  const list = upcomingBirthdays(cls, today);
  if (!list.length) return null;
  return h('div', { class: 'moment-row bday', 'data-testid': 'birthdays' }, h('span', { class: 'moment-time', 'aria-hidden': 'true' }, '🎂'),
    h('span', { class: 'moment-title' }, h('strong', {}, list.map(b => b.s.firstName).join(', ')),
      h('small', {}, list.map(b => `${b.inDays === 0 ? 'aujourd’hui' : b.inDays === 1 ? 'demain' : model.frDate(b.date, { weekday: 'long' })} · ${b.age} ans`).join(' · '))));
}

/** Avant / pendant / après la classe : ce qu'il faut préparer, la journée à cocher, ce qu'il reste à clore. */
function moments(cls, today) {
  const plan = PL.dayPlan(cls, today);
  const entries = plan.entries.filter(e => e.kind !== 'event' && e.status !== 'reportée');
  const now = nowHM();
  const mats = PL.materials(cls, [today]).filter(r => r.kind !== 'copie' || r.status === 'à faire');
  const done = entries.filter(e => e.status === 'faite' || e.status === 'partielle').length;
  const past = entries.filter(e => e.end <= now && e.status === 'prévue');
  const earlier = PL.uncheckedPast(cls, { days: 13, until: model.addDays(today, -1) }).length; // séances des jours précédents restées « prévue »
  const unsigned = store.all('carnet').filter(x => (!x.classId || x.classId === cls.id) && x.written && !x.signed).length;
  const col = (title, cls2, count, body) => h('section', { class: `moment ${cls2}`, 'aria-label': title }, h('div', { class: 'moment-head' }, h('h2', {}, title), h('span', { class: 'moment-count' }, count)), h('div', { class: 'moment-body' }, body));
  const check = (e) => {
    const isDone = e.status === 'faite' || e.status === 'partielle';
    const cur = e.start <= now && now < e.end;
    return h('div', { class: `moment-row${cur ? ' current' : ''}${isDone ? ' done' : ''}${e.status === 'annulée' ? ' cancelled' : ''}`, 'data-testid': 'moment-row' },
      h('span', { class: 'moment-time' }, e.start),
      h('span', { class: 'moment-bar', style: { background: model.subjectColor(e.subject) } }),
      h('a', { class: 'moment-title', href: `#/cahier?d=${today}` }, h('strong', {}, e.title), h('small', {}, cur ? `${e.subject || ''} · en ce moment` : e.status === 'annulée' ? 'annulée' : e.subject || '')),
      e.status === 'annulée' ? null : h('button', { type: 'button', class: `moment-check${isDone ? ' on' : ''}`, 'aria-label': isDone ? `« ${e.title} » faite : décocher` : `Marquer « ${e.title} » faite`, 'data-testid': 'moment-check',
        onclick: () => PL.setStatus(e, cls, isDone ? 'prévue' : 'faite') }, isDone ? '♡' : ''));
  };
  // Jour sans classe : on garde « Avant » (anniversaires) et « Après » (séances à cocher, bilan de la semaine…), sans « Pendant ».
  const off = !plan.school.ok;
  return h('div', { class: `moments ${off ? 'moments-off' : ''}`, 'data-testid': 'moments' },
    off ? h('p', { class: 'muted moment-off' }, plan.school.reason) : null,
    col('Avant', 'm-avant', `${mats.length}`, [birthdays(cls, today), ...(mats.length ? mats.slice(0, 6).map(r => h('a', { class: 'moment-row', href: `#/cahier?d=${today}` }, h('span', { class: 'moment-time' }, r.entry.start), h('span', { class: 'moment-title' }, h('strong', {}, r.label), h('small', {}, r.kind === 'copie' ? `${r.count} ex.` : r.entry.title))))
      : [h('p', { class: 'muted small' }, off ? 'Pas de classe aujourd’hui.' : 'Rien à préparer pour aujourd’hui.')])]),
    off ? null : col('Pendant', 'm-pendant', `${done} / ${entries.length}`, entries.length ? entries.map(check) : h('p', { class: 'muted small' }, 'Aucune activité au cahier journal.')),
    col('Après', 'm-apres', `${past.length + earlier + unsigned}`, [
      h('a', { class: 'moment-row', href: `#/cahier?d=${today}`, 'data-testid': 'moment-tocheck' }, h('span', { class: 'moment-title' }, h('strong', {}, past.length + earlier ? `${past.length + earlier} séance(s) à cocher` : 'Séances à jour ♡'),
        h('small', {}, earlier ? `dont ${earlier} des jours précédents · faite ou décaler la séquence` : 'faite, reportée ou annulée'))),
      (() => { const dow = new Date(`${today}T12:00:00`).getDay(); return dow === 5 || dow === 6 || dow === 0 ? h('a', { class: 'moment-row', href: '#/bilan-semaine', 'data-testid': 'moment-bilan' }, h('span', { class: 'moment-title' }, h('strong', {}, 'Bilan de la semaine'), h('small', {}, '10 minutes : clore, regarder le rythme, préparer la suite'))) : null; })(),
      (() => { const per = model.periodOfDate(store.get(cls.yearId), today); return per && model.addDays(per.end, -13) <= today ? h('a', { class: 'moment-row', href: '#/fin-periode', 'data-testid': 'moment-finperiode' }, h('span', { class: 'moment-title' }, h('strong', {}, 'Fin de période'), h('small', {}, `jusqu’au ${model.frShort(per.end)} : évaluations, livrets, suite`))) : null; })(),
      (() => { const late = safetyStatus(store.get(cls.yearId)).filter(x => x.late); return late.length ? h('a', { class: 'moment-row', href: '#/securite', 'data-testid': 'moment-securite' }, h('span', { class: 'moment-title' }, h('strong', {}, 'Exercice incendie à faire'), h('small', {}, 'le premier se fait dans le mois qui suit la rentrée'))) : null; })(),
      (() => { const md = today.slice(5); return md >= '08-15' && md <= '09-30' ? h('a', { class: 'moment-row', href: '#/rentree', 'data-testid': 'moment-rentree' }, h('span', { class: 'moment-title' }, h('strong', {}, 'Assistant de rentrée'), h('small', {}, 'les étapes dans l’ordre, cochées au fur et à mesure'))) : null; })(),
      syncReminder(),
      h('a', { class: 'moment-row', href: '#/messages' }, h('span', { class: 'moment-title' }, h('strong', {}, unsigned ? `${unsigned} mot(s) à faire signer` : 'Carnet à jour'), h('small', {}, 'carnet de liaison'))),
      h('a', { class: 'moment-row', href: `#/cahier?d=${today}` }, h('span', { class: 'moment-title' }, h('strong', {}, 'Bilan du jour'), h('small', {}, 'deux lignes au cahier journal')))]));
}

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
    cls ? moments(cls, today) : null,
    h('div', { class: 'espace-grid' }, left, right));
}
