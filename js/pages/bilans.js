// Bilans guidés : le rituel du vendredi (bilan de la semaine) et l'assistant de fin de période.
// Rien n'est calculé en cachette : chaque ligne renvoie vers la page où l'on agit.
import * as store from '../store.js';
import * as model from '../model.js';
import * as PL from '../planning.js';
import * as P from '../pedago.js';
import * as A from '../avancement.js';
import * as E from '../eleve.js';
import { h, badge, icon } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { shiftDialog } from './cahier.js';
import { livretEvals } from './livrets.js';

const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const step = (state, title, body, action) => h('li', { class: `bl-step ${state}`, 'data-testid': 'bl-step', 'data-state': state },
  h('span', { class: 'bl-mark', 'aria-hidden': 'true' }, state === 'ok' ? '♡' : state === 'todo' ? '!' : '·'),
  h('div', { class: 'bl-body' }, h('strong', {}, title), body ? h('div', { class: 'small' }, body) : null),
  action || null);
const link = (href, label, testid) => h('a', { class: 'btn btn-small', href, 'data-testid': testid || null }, label);

// ───────── Rituel du vendredi
/** Semaine affichée : la semaine en cours, ou celle qui vient de finir le week-end. */
function weekOf(date) { return model.mondayOf(date); }

export function weekReview(cls, monday) {
  const days = Array.from({ length: 7 }, (_, i) => model.addDays(monday, i));
  const today = model.todayIso();
  const entries = days.flatMap(d => PL.dayPlan(cls, d).entries).filter(e => e.kind !== 'event' && !PL.groupOf(e, cls));
  const count = (st) => entries.filter(e => e.status === st).length;
  const unchecked = PL.uncheckedPast(cls, { days: 6, until: days[6] < today ? days[6] : today }).filter(e => e.date >= monday);
  const nextMonday = model.addDays(monday, 7);
  const nextDays = Array.from({ length: 7 }, (_, i) => model.addDays(nextMonday, i));
  const nextEntries = nextDays.flatMap(d => { try { return PL.dayPlan(cls, d).entries; } catch { return []; } }).filter(e => e.kind !== 'event' && !['annulée', 'reportée'].includes(e.status) && !PL.groupOf(e, cls));
  const noFiche = nextEntries.filter(e => !e.session);
  const mats = PL.materials(cls, nextDays).filter(r => r.kind !== 'copie' || r.status === 'à faire');
  const prepared = !!store.get(cls.id)?.weekMode?.[nextMonday] || nextEntries.some(e => e.kind === 'occ');
  const year = store.get(cls.yearId);
  const per = model.periodOfDate(year, monday) || A.currentPeriod(cls, today);
  const late = per ? A.bySubject(cls, per, today).filter(g => g.pace?.label === 'en retard') : [];
  return { days, entries, done: count('faite'), partial: count('partielle'), postponed: count('reportée'), cancelled: count('annulée'), unchecked, nextMonday, nextEntries, noFiche, mats, prepared, late, per };
}

function renderWeek(cls, query, rerender) {
  const today = model.todayIso();
  const base = /^\d{4}-\d{2}-\d{2}$/.test(query.d || '') ? query.d : today; // le week-end : la semaine qui vient de finir
  const monday = weekOf(base);
  const r = weekReview(cls, monday);
  const total = r.entries.length;
  const go = (d) => { location.hash = `#/bilan-semaine?d=${d}`; };
  return h('div', { class: 'page' },
    pageHeader('Bilan de la semaine', { favKey: 'aujourdhui/bilan-semaine', subtitle: `${cls.name} · semaine du ${model.frShort(monday)}` }),
    subTabs(),
    h('div', { class: 'daynav' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Semaine précédente', onclick: () => go(model.addDays(monday, -7)) }, icon('chevleft')),
      h('strong', {}, `Du ${model.frShort(monday)} au ${model.frShort(model.addDays(monday, 4))}`),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Semaine suivante', onclick: () => go(model.addDays(monday, 7)) }, icon('chevright'))),
    h('p', { class: 'muted' }, 'Dix minutes le vendredi : on clôt la semaine, on regarde le rythme, on prépare la suivante. Chaque ligne mène là où l’on agit.'),
    h('section', { class: 'card bl-stats', 'data-testid': 'bl-week-stats' },
      h('h2', {}, '1. Ce qui a été fait'),
      total ? h('div', { class: 'bl-tiles' },
        [['faites', r.done, 'ok'], ['partielles', r.partial, 'info'], ['reportées', r.postponed, 'warn'], ['annulées', r.cancelled, 'muted'], ['pas cochées', r.unchecked.length, r.unchecked.length ? 'warn' : 'ok']].map(([l, n, k]) =>
          h('div', { class: `bl-tile ${k}` }, h('b', {}, String(n)), h('span', {}, l)))) : h('p', { class: 'muted' }, 'Aucune activité au cahier journal cette semaine.'),
      r.unchecked.length ? h('ul', { class: 'unchecked-list' }, r.unchecked.map(e => h('li', { 'data-testid': 'bl-unchecked' },
        h('span', {}, h('a', { href: `#/cahier?d=${e.date}` }, model.frDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' })), ` · ${e.start} · `, h('strong', {}, e.title)),
        h('span', { class: 'row wrap' },
          h('button', { class: 'btn btn-small', type: 'button', onclick: () => PL.setStatus(e, cls, 'faite').then(rerender) }, '♡ Faite'),
          e.session?.sequenceId ? h('button', { class: 'btn btn-small btn-primary', type: 'button', onclick: () => shiftDialog(cls, e) }, 'Décaler la séquence…') : null)))) : null),
    h('section', { class: 'card', 'data-testid': 'bl-week-pace' },
      h('h2', {}, '2. Le rythme par matière'),
      r.late.length ? h('ul', { class: 'plain' }, r.late.map(g => h('li', { class: 'row wrap' }, badge('en retard', 'warn'), h('strong', {}, g.subject),
        h('span', { class: 'muted small' }, `${Math.round(g.score * 100)} % fait de ce qui est prévu sur la période`))))
        : h('p', {}, '♡ Aucune matière en retard sur la période.'),
      link('#/avancement', 'Voir l’avancement complet')),
    h('section', { class: 'card', 'data-testid': 'bl-week-next' },
      h('h2', {}, `3. La semaine prochaine (du ${model.frShort(r.nextMonday)})`),
      h('ul', { class: 'bl-steps' },
        step(r.prepared ? 'ok' : 'todo', r.prepared ? 'Semaine préparée' : 'Semaine pas encore préparée', r.prepared ? null : 'L’emploi du temps et vos progressions pré-remplissent le cahier journal.',
          link(`#/cahier?d=${r.nextMonday}&v=semaine${r.prepared ? '' : '&prep=1'}`, r.prepared ? 'Voir la semaine' : 'Préparer la semaine prochaine', 'bl-prepare')),
        step(r.noFiche.length ? 'todo' : 'ok', r.noFiche.length ? `${plural(r.noFiche.length, 'créneau')} sans fiche de séance` : 'Tous les créneaux ont une fiche',
          r.noFiche.length ? r.noFiche.slice(0, 6).map(e => `${model.frDate(e.date, { weekday: 'short' })} ${e.start} ${e.subject || e.title}`).join(' · ') : null,
          r.noFiche.length ? link(`#/cahier?d=${r.noFiche[0].date}`, 'Compléter') : null),
        step(r.mats.length ? 'todo' : 'ok', r.mats.length ? `${plural(r.mats.length, 'élément')} à préparer (photocopies, matériel)` : 'Rien à photocopier ni à préparer',
          r.mats.length ? r.mats.slice(0, 6).map(m => m.label || m.title || m.text || '').filter(Boolean).join(' · ') : null,
          r.mats.length ? link(`#/taches`, 'Liste « À imprimer »') : null))));
}

// ───────── Fin de période
export function periodReview(cls, per) {
  const students = model.studentsOfClass(cls.id, { date: per.end < model.todayIso() ? per.end : model.todayIso() });
  const evs = livretEvals(cls, per);
  const missingEval = (ev) => students.filter(({ student: s }) => { const r = ev.results?.[s.id]; return !r || (!r.absent && !Object.values(r.items || {}).some(x => x?.level || (x?.points ?? '') !== '')); });
  const evGaps = evs.map(ev => ({ ev, missing: missingEval(ev) })).filter(x => x.missing.length);
  const catchups = evs.flatMap(ev => students.filter(({ student: s }) => ev.results?.[s.id]?.absent && ev.results[s.id].catchup !== 'rattrapé').map(({ student: s }) => ({ ev, s })));
  const reports = store.all('report').filter(r => r.classId === cls.id && r.periodId === per.id);
  const withApp = students.filter(({ student: s }) => reports.find(r => r.studentId === s.id && (r.general || '').trim()));
  const finalized = students.filter(({ student: s }) => reports.find(r => r.studentId === s.id && r.status === 'finalisé'));
  const noObs = students.filter(({ student: s }) => !E.of('observation', s.id).some(o => o.date >= per.start && o.date <= per.end));
  const seqs = P.ofClass('sequence', cls.id).filter(s => s.periodId === per.id);
  const openSeqs = seqs.map(seq => ({ seq, ...P.journalProgress(P.sessionsOfSequence(seq.id).map(x => x.id)) })).filter(x => x.total && x.done < x.total);
  const unsigned = store.all('carnet').filter(x => (!x.classId || x.classId === cls.id) && x.written && !x.signed);
  const year = store.get(cls.yearId); const ps = model.periodsOf(year); const next = ps[ps.findIndex(p => p.id === per.id) + 1] || null;
  const nextSeqs = next ? P.ofClass('sequence', cls.id).filter(s => s.periodId === next.id) : [];
  return { students, evs, evGaps, catchups, withApp, finalized, noObs, seqs, openSeqs, unsigned, next, nextSeqs };
}

let selPer = null;
function renderPeriod(cls, rerender) {
  const year = store.get(cls.yearId); const ps = model.periodsOf(year);
  const today = model.todayIso();
  const per = ps.find(p => p.id === selPer) || model.periodOfDate(year, today) || ps.at(-1);
  if (!per) return h('div', { class: 'page' }, pageHeader('Fin de période'), subTabs(), h('p', { class: 'muted' }, 'Aucune période définie (Réglages › Année).'));
  const pi = ps.indexOf(per);
  const r = periodReview(cls, per);
  const n = r.students.length;
  const steps = [
    step(r.evs.length ? (r.evGaps.length ? 'todo' : 'ok') : 'todo', r.evs.length ? (r.evGaps.length ? `${plural(r.evGaps.length, 'évaluation')} pas complètement saisie${r.evGaps.length > 1 ? 's' : ''}` : `${plural(r.evs.length, 'évaluation')} saisie${r.evs.length > 1 ? 's' : ''} pour toute la classe`) : 'Aucune évaluation reliée au livret',
      r.evGaps.length ? r.evGaps.slice(0, 5).map(x => `${x.ev.title} : ${x.missing.length} élève(s)`).join(' · ') : null,
      r.evGaps.length ? link(`#/evaluations/${r.evGaps[0].ev.id}`, 'Compléter') : link('#/evaluations', 'Évaluations')),
    step(r.catchups.length ? 'todo' : 'ok', r.catchups.length ? `${plural(r.catchups.length, 'évaluation')} à rattraper (absents)` : 'Aucun rattrapage en attente',
      r.catchups.length ? r.catchups.slice(0, 5).map(x => `${x.s.firstName} — ${x.ev.title}`).join(' · ') : null, r.catchups.length ? link('#/rattrapage', 'Rattrapage') : null),
    step(r.noObs.length ? 'todo' : 'ok', r.noObs.length ? `${plural(r.noObs.length, 'élève')} sans observation sur la période` : 'Chaque élève a au moins une observation',
      r.noObs.length ? r.noObs.slice(0, 8).map(({ student: s }) => s.firstName).join(', ') : null, r.noObs.length ? link(`#/eleve/${r.noObs[0].student.id}?t=suivi`, 'Ajouter') : null),
    step(r.openSeqs.length ? 'todo' : 'ok', r.openSeqs.length ? `${plural(r.openSeqs.length, 'séquence')} pas terminée${r.openSeqs.length > 1 ? 's' : ''}` : (r.seqs.length ? 'Séquences de la période terminées' : 'Aucune séquence rattachée à la période'),
      r.openSeqs.length ? r.openSeqs.slice(0, 5).map(x => `${x.seq.title || 'Sans titre'} (${x.done}/${x.total})`).join(' · ') + ' — à décaler sur la période suivante ou à clore' : null,
      r.openSeqs.length ? link(`#/sequence/${r.openSeqs[0].seq.id}`, 'Ouvrir') : null),
    step(n && r.withApp.length === n ? 'ok' : 'todo', `Appréciations du livret : ${r.withApp.length}/${n}`, r.finalized.length ? `${r.finalized.length} livret(s) marqué(s) finalisé(s)` : null,
      link('#/livrets', r.withApp.length === n ? 'Générer les livrets' : 'Écrire les appréciations', 'bl-livrets')),
    step(r.unsigned.length ? 'todo' : 'ok', r.unsigned.length ? `${plural(r.unsigned.length, 'mot')} du carnet pas encore signé${r.unsigned.length > 1 ? 's' : ''}` : 'Carnet de liaison à jour', null, r.unsigned.length ? link('#/messages', 'Carnet') : null),
    r.next ? step(r.nextSeqs.length ? 'ok' : 'todo', r.nextSeqs.length ? `Période ${pi + 2} : ${plural(r.nextSeqs.length, 'séquence')} déjà prévue${r.nextSeqs.length > 1 ? 's' : ''}` : `Période ${pi + 2} : aucune séquence encore rattachée`,
      'Programmations, progressions et séquences de la période suivante.', link('#/progressions', 'Préparer la suite')) : null];
  const todo = steps.filter(x => x?.dataset.state === 'todo').length;
  return h('div', { class: 'page' },
    pageHeader('Fin de période', { favKey: 'aujourdhui/fin-periode', subtitle: `${cls.name} · période ${pi + 1} — du ${model.frShort(per.start)} au ${model.frShort(per.end)}` }),
    subTabs(),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Période' }, ps.map((p, i) => h('button', { type: 'button', class: p.id === per.id ? 'on' : '', onclick: () => { selPer = p.id; rerender(); } }, `P${i + 1}`))),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, todo ? `${plural(todo, 'point')} à régler avant les vacances` : '♡ Tout est prêt pour la fin de période'),
        h('span', { class: 'cj-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': steps.filter(Boolean).length, 'aria-valuenow': steps.filter(Boolean).length - todo, 'aria-label': 'Points réglés' },
          h('span', { style: { width: `${Math.round((steps.filter(Boolean).length - todo) / steps.filter(Boolean).length * 100)}%` } }))),
      h('ol', { class: 'bl-steps', 'data-testid': 'bl-period' }, steps)),
    h('p', { class: 'muted small' }, 'Les livrets reprennent les évaluations reliées à la période (Ma classe › Livrets et bilans). Rien n’est modifié depuis cette page.'));
}

function guard(title, fn) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return h('div', { class: 'page' }, pageHeader(title), subTabs(), miss);
  return fn(cls);
}
export const week = { render: ({ query, rerender }) => guard('Bilan de la semaine', (cls) => renderWeek(cls, query, rerender)) };
export const period = { render: ({ rerender }) => guard('Fin de période', (cls) => renderPeriod(cls, rerender)) };
