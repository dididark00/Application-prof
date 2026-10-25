// « Où j'en suis » : avancement dans les programmes, calculé à partir de ce qui existe déjà
// (programmations, progressions, séquences, cahier journal, référentiels). Rien n'est saisi deux fois :
// tout est déduit. Les suggestions sont des indications, jamais des modifications automatiques.
import * as store from './store.js';
import * as model from './model.js';
import * as P from './pedago.js';
import * as PL from './planning.js';
import * as CP from './cahier-plus.js';
import { coverage } from './pages/referentiels.js';

/** Période affichée : celle du jour, sinon la prochaine (pendant les vacances), sinon la dernière. */
export function currentPeriod(cls, date = model.todayIso()) {
  const ps = model.periodsOf(store.get(cls.yearId));
  return model.periodOfDate(store.get(cls.yearId), date) || ps.find(p => p.start > date) || ps.at(-1) || null;
}

function schoolDays(cls, a, b) {
  let n = 0;
  for (let d = a; d <= b; d = model.addDays(d, 1)) if (PL.isSchoolDay(cls, d).ok) n++;
  return n;
}
/** Part du temps écoulé (jours de classe) dans la période et dans l'année. */
export function calendar(cls, per, date = model.todayIso()) {
  const year = store.get(cls.yearId);
  const frac = (a, b) => {
    if (!a || !b) return { done: 0, total: 0, frac: 0 };
    const total = schoolDays(cls, a, b);
    const done = date < a ? 0 : date > b ? total : schoolDays(cls, a, model.addDays(date, -1));
    return { done, total, frac: total ? done / total : 0 };
  };
  const p = frac(per?.start, per?.end);
  const weeks = model.weeksOfPeriod(per);
  const wk = weeks.find(w => date >= w.monday && date <= model.addDays(w.monday, 6));
  return { period: p, year: frac(year?.start, year?.end), weeks: weeks.length, week: wk?.n || (date > (per?.end || '') ? weeks.length : 0) };
}

const pace = (score, expected, total) => {
  if (!total) return null;
  if (score >= 0.999) return { label: 'terminé', kind: 'ok' };
  if (expected < 0.08 && score === 0) return { label: 'à démarrer', kind: 'muted' };
  const d = score - expected;
  if (d > 0.15) return { label: 'en avance', kind: 'ok' };
  if (d < -0.2) return { label: 'en retard', kind: 'warn' };
  return { label: 'dans les temps', kind: 'info' };
};

/** Avancement par discipline pour une période. */
export function bySubject(cls, per, date = model.todayIso()) {
  const cal = calendar(cls, per, date);
  const out = new Map();
  const get = (s) => { const k = s || '(sans matière)'; if (!out.has(k)) out.set(k, { subject: k, notions: [], sequences: [], sessions: { total: 0, done: 0, partial: 0, planned: 0 }, rows: { total: 0, done: 0 }, minutes: 0, minutesWeek: 0, progressions: [] }); return out.get(k); };
  for (const prog of P.ofClass('programmation', cls.id)) {
    for (const n of P.notionsOf(prog.id).filter(n => n.periodId === per?.id)) get(prog.subject).notions.push({ notion: n, status: P.notionStatus(n), prog });
  }
  for (const seq of P.ofClass('sequence', cls.id).filter(s => s.periodId === per?.id)) {
    const ids = P.sessionsOfSequence(seq.id).map(s => s.id);
    const jp = P.journalProgress(ids);
    const g = get(seq.subject); g.sequences.push({ seq, ...jp });
    g.sessions.total += jp.total; g.sessions.done += jp.done; g.sessions.partial += jp.partial; g.sessions.planned += jp.planned;
  }
  for (const pr of P.ofClass('progression', cls.id).filter(p => p.periodId === per?.id)) {
    const g = get(pr.subject); g.progressions.push(pr);
    for (const r of pr.rows || []) { g.rows.total++; if (r.status === 'Réalisé') g.rows.done++; }
  }
  // Temps de classe : prévu chaque semaine par l'EDT, réellement fait dans la période (cahier journal).
  if (per) {
    const { version } = PL.timetableForDate(cls, per.start > date ? per.start : date);
    for (const [subj, v] of Object.entries(PL.weeklyMinutes(version?.slots || [], cls.levels || []))) if (subj !== '(sans matière)') get(subj).minutesWeek = v.total;
    for (const o of store.all('occurrence').filter(o => o.classId === cls.id && o.date >= per.start && o.date <= per.end && o.date <= date && ['faite', 'partielle'].includes(o.status))) {
      const m = model.minutes(o.end || '00:00') - model.minutes(o.start || '00:00');
      if (m > 0 && o.subject) get(o.subject).minutes += m;
    }
  }
  return [...out.values()].map(g => {
    let score = 0, total = 0, basis = '';
    if (g.sessions.total) { total = g.sessions.total; score = (g.sessions.done + g.sessions.partial / 2) / total; basis = 'séances faites'; }
    else if (g.notions.length) { total = g.notions.length; score = g.notions.reduce((a, n) => a + (n.status === 'terminée' ? 1 : n.status === 'prévue' ? 0 : 0.5), 0) / total; basis = 'notions'; }
    else if (g.rows.total) { total = g.rows.total; score = g.rows.done / total; basis = 'lignes de progression'; }
    return { ...g, score, total, basis, pace: pace(score, cal.period.frac, total) };
  }).filter(g => g.total || g.minutesWeek).sort((a, b) => a.subject.localeCompare(b.subject, 'fr'));
}

/** Couverture des compétences des référentiels qui concernent la classe. */
export function competencies(cls) {
  const cov = coverage();
  const lv = new Set(cls.levels || []);
  return store.all('referential').filter(r => r.status !== 'archivé' && (!r.levels?.length || r.levels.some(l => lv.has(l)))).map(r => {
    const items = (r.items || []).filter(i => !i.levels?.length || i.levels.some(l => lv.has(l)));
    let worked = 0, linked = 0, evaluated = 0; const never = [];
    for (const i of items) {
      const c = cov.get(i.id);
      const w = c && c.day.size, l = c && (c.session.size || c.sequence.size || c.notion.size);
      if (w) worked++; else never.push({ item: i, linked: !!l });
      if (l) linked++;
      if (c && c.evaluation.size) evaluated++;
    }
    return { ref: r, total: items.length, worked, linked, evaluated, never };
  }).filter(x => x.total);
}

/** Suggestions concrètes pour la suite, de la plus utile à la moins urgente. */
export function suggestions(cls, per, date = model.todayIso()) {
  const out = [];
  const cal = calendar(cls, per, date);
  const ps = model.periodsOf(store.get(cls.yearId));
  const left = Math.max(0, cal.weeks - cal.week);
  // 1. Semaine en cours / prochaine pas encore préparée
  for (const [label, m] of [['cette semaine', model.mondayOf(date)], ['la semaine prochaine', model.addDays(model.mondayOf(date), 7)]]) {
    if (store.get(cls.id)?.weekMode?.[m] || PL.isBlankWeek(cls, m)) continue;
    const n = CP.weekProposals(cls, m).length;
    if (n) { out.push({ kind: 'info', key: `prep-${m}`, text: `Préparer ${label} : ${n} créneau(x) de l’emploi du temps peuvent être pré-remplis (fiches habituelles et progressions).`, href: `#/cahier?d=${m}&v=semaine`, action: 'Préparer' }); break; }
  }
  // 2. Séances reportées ou partielles jamais refaites
  const occ = store.all('occurrence').filter(o => o.classId === cls.id && o.sessionId);
  const doneIds = new Set(occ.filter(o => o.status === 'faite').map(o => o.sessionId));
  const pendingIds = new Set(occ.filter(o => o.status === 'prévue' && o.date >= date).map(o => o.sessionId));
  const redo = occ.filter(o => ['reportée', 'partielle'].includes(o.status) && !doneIds.has(o.sessionId) && !pendingIds.has(o.sessionId));
  for (const o of [...new Map(redo.map(o => [o.sessionId, o])).values()].slice(0, 6)) {
    const s = store.get(o.sessionId); if (!s || s.deletedAt) continue;
    out.push({ kind: 'warn', key: `redo-${o.id}`, text: `Séance ${o.status} le ${model.frShort(o.date)} et pas encore replacée : ${P.sessionTitle(s)}.`, href: `#/cahier?d=${o.date}`, action: 'Voir le jour' });
  }
  // 3. Séances des séquences de la période jamais placées dans le cahier journal
  const placed = new Set(occ.filter(o => !['annulée', 'reportée'].includes(o.status)).map(o => o.sessionId));
  for (const seq of P.ofClass('sequence', cls.id).filter(s => s.periodId === per?.id)) {
    const free = P.sessionsOfSequence(seq.id).filter(s => !placed.has(s.id));
    if (free.length) out.push({ kind: left <= 2 ? 'warn' : 'info', key: `seq-${seq.id}`, text: `${free.length} séance(s) de « ${P.sequenceTitle(seq)} » pas encore placée(s) dans le cahier journal${left ? ` — il reste ${left} semaine(s) dans la période` : ''}.`, href: `#/sequence/${seq.id}`, action: 'Ouvrir la séquence' });
  }
  // 4. Notions de la période pas encore commencées (si la période est bien entamée)
  if (cal.period.frac >= 0.4) for (const prog of P.ofClass('programmation', cls.id)) {
    const todo = P.notionsOf(prog.id).filter(n => n.periodId === per?.id && P.notionStatus(n) === 'prévue');
    if (todo.length) out.push({ kind: cal.period.frac >= 0.7 ? 'warn' : 'info', key: `notions-${prog.id}`, text: `${prog.subject} : ${todo.length} notion(s) de la période pas encore commencée(s) (${todo.slice(0, 3).map(n => n.title).join(', ')}${todo.length > 3 ? '…' : ''}).`, href: `#/programmation/${prog.id}`, action: 'Programmation' });
  }
  // 5. Notions des périodes passées non terminées
  const past = new Set(ps.filter(p => p.end < date && p.id !== per?.id).map(p => p.id));
  for (const prog of P.ofClass('programmation', cls.id)) {
    const late = P.notionsOf(prog.id).filter(n => past.has(n.periodId) && P.notionStatus(n) !== 'terminée');
    if (late.length) out.push({ kind: 'warn', key: `late-${prog.id}`, text: `${prog.subject} : ${late.length} notion(s) des périodes précédentes non terminée(s) (${late.slice(0, 3).map(n => `${n.title} — ${P.notionStatus(n)}`).join(', ')}${late.length > 3 ? '…' : ''}).`, href: `#/programmation/${prog.id}`, action: 'Programmation' });
  }
  // 6. Disciplines de l'EDT sans progression pour la période
  if (per) {
    const { version } = PL.timetableForDate(cls, per.start > date ? per.start : date);
    const withProg = new Set(P.ofClass('progression', cls.id).filter(p => p.periodId === per.id).map(p => p.subject));
    const subj = Object.keys(PL.weeklyMinutes(version?.slots || [], cls.levels || [])).filter(s => s !== '(sans matière)' && !withProg.has(s));
    if (subj.length && (P.ofClass('progression', cls.id).length || P.ofClass('programmation', cls.id).length)) out.push({ kind: 'muted', key: 'noprog', text: `Pas encore de progression cette période pour : ${subj.join(', ')}. Sans progression, le pré-remplissage du cahier journal ne peut pas proposer de séance pour ces créneaux.`, href: '#/progressions', action: 'Progressions' });
  }
  // 7. Compétences jamais travaillées
  const comps = competencies(cls);
  for (const c of comps) if (c.never.length && c.total) {
    const unlinked = c.never.filter(n => !n.linked).length;
    out.push({ kind: 'muted', key: `comp-${c.ref.id}`, text: `${c.ref.name} : ${c.never.length} compétence(s) sur ${c.total} pas encore travaillée(s) dans le cahier journal${unlinked ? `, dont ${unlinked} reliée(s) à aucune séance ni séquence` : ''}.`, href: `#/referentiels/${c.ref.id}`, action: 'Voir' });
  }
  // 8. Séquences de la période sans compétence reliée : leur couverture ne peut pas être suivie
  const noComp = P.ofClass('sequence', cls.id).filter(s => s.periodId === per?.id && !(s.competencyIds || []).length && !P.sessionsOfSequence(s.id).some(x => (x.competencyIds || []).length));
  if (noComp.length && comps.length) out.push({ kind: 'muted', key: 'nocomp', text: `${noComp.length} séquence(s) de la période sans compétence reliée (${noComp.slice(0, 2).map(P.sequenceTitle).join(', ')}${noComp.length > 2 ? '…' : ''}) : reliez-les pour suivre la couverture des programmes.`, href: `#/sequence/${noComp[0].id}`, action: 'Relier' });
  return out;
}
