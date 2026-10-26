// Aujourd'hui › Mode en classe : un écran simple pour le téléphone ou la tablette pendant la journée.
// Ce qui se passe maintenant et ensuite, et 4 gestes : appel, timer, noter (carnet en 2 touches), séance faite.
import * as store from '../store.js';
import * as model from '../model.js';
import * as PL from '../planning.js';
import * as V from '../vie.js';
import * as T from '../timer.js';
import { h, icon, toast, badge } from '../ui.js';
import { CARNET_CATS } from './familles.js';

const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
/** Activité en cours et suivante, d'après le cahier journal du jour. */
export function nowAndNext(cls, date = model.todayIso(), hm = nowHM()) {
  const plan = PL.dayPlan(cls, date);
  const list = plan.entries.filter(e => !e.allDay && e.status !== 'annulée' && e.status !== 'reportée');
  return { plan, current: list.find(e => e.start <= hm && hm < e.end) || null, next: list.find(e => e.start > hm) || null };
}

let pickFor = null;
export function render({ query, rerender }) {
  const cls = model.currentClass();
  if (!cls) { location.hash = '#/aujourdhui'; return h('div'); }
  const today = model.todayIso(); const hm = query.t && /^\d\d:\d\d$/.test(query.t) ? query.t : nowHM();
  const { plan, current, next } = nowAndNext(cls, today, hm);
  const half = hm < '12:00' ? 'matin' : 'après-midi';
  const att = V.attendanceOf(cls.id, today, half);
  const students = model.studentsOfClass(cls.id, { date: today }).map(x => x.student);
  const entry = (e, label) => e ? h('div', { class: 'ec-entry', style: { borderLeftColor: model.subjectColor(e.subject) } },
    h('span', { class: 'muted small' }, `${label} · ${e.start}–${e.end}`), h('strong', {}, e.title), e.subject && e.subject !== e.title ? h('span', { class: 'muted' }, e.subject) : null,
    e.session?.objective || e.occ?.objective ? h('span', { class: 'small' }, `Objectif : ${e.occ?.objective || e.session.objective}`) : null) : null;
  const noteGrid = pickFor ? h('div', { class: 'ec-cats', 'data-testid': 'ec-cats' }, h('p', {}, h('strong', {}, store.get(pickFor)?.firstName), ' :'),
    CARNET_CATS.map(([k, l, kind]) => h('button', { type: 'button', class: `btn ec-cat ec-${kind}`, 'data-testid': `ec-cat-${k}`, onclick: async () => {
      await store.create('carnet', { classId: cls.id, studentId: pickFor, date: today, category: k, text: '', written: false, signed: false }, `Noté : ${l.toLowerCase()} (${store.get(pickFor)?.firstName})`);
      toast(`${store.get(pickFor)?.firstName} : ${l.toLowerCase()} noté. Annulable.`, { action: 'Annuler', onAction: () => store.undo() }); pickFor = null; rerender();
    } }, l)), h('button', { class: 'btn', type: 'button', onclick: () => { pickFor = null; rerender(); } }, 'Annuler'))
    : h('div', { class: 'ec-students', 'data-testid': 'ec-students' }, students.map(s => h('button', { type: 'button', class: 'btn ec-student', 'data-testid': 'ec-student', onclick: () => { pickFor = s.id; rerender(); } }, s.firstName)));
  return h('div', { class: 'page enclasse', 'data-testid': 'enclasse' },
    h('div', { class: 'row ec-head' }, h('h1', {}, `${hm.replace(':', ' h ')} · ${cls.name}`), h('a', { class: 'btn btn-small', href: '#/aujourdhui' }, 'Quitter le mode en classe')),
    !plan.school.ok ? h('p', { class: 'banner' }, plan.school.reason) : null,
    h('section', { class: 'card ec-now' }, entry(current, 'Maintenant') || h('p', { class: 'muted' }, 'Pas d’activité en ce moment.'), entry(next, 'Ensuite'),
      current && current.status !== 'faite' ? h('button', { class: 'btn btn-primary ec-big', type: 'button', 'data-testid': 'ec-done', onclick: async () => { await PL.setStatus(current, cls, 'faite'); toast('Séance marquée faite.', { action: 'Annuler', onAction: () => store.undo() }); } }, '✓ Séance faite') : current ? badge('faite', 'ok') : null),
    h('div', { class: 'ec-actions' },
      h('a', { class: `btn ec-big ${att?.validated ? '' : 'btn-primary'}`, href: `#/appel?d=${today}&h=${encodeURIComponent(half)}`, 'data-testid': 'ec-appel' }, `Appel du ${half}${att?.validated ? ' ✓' : ''}`),
      h('button', { class: 'btn ec-big', type: 'button', 'data-testid': 'ec-timer', onclick: () => T.open() }, icon('clock', 20), 'Timer'),
      h('a', { class: 'btn ec-big', href: '#/projection' }, 'Projeter')),
    h('section', { class: 'card' }, h('h2', {}, 'Noter (carnet de liaison) : touchez un prénom'), noteGrid));
}
