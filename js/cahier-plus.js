// Cahier journal : pré-remplissage d'une semaine et export sur une période choisie.
// Pré-remplissage, pour chaque créneau de l'EDT encore sans fiche :
//  1. la « fiche habituelle » du créneau (rituels, lecture quotidienne…), marquée en favori sur le créneau ;
//  2. sinon la séance suivante prévue par la progression de la discipline pour cette semaine
//     (ligne liée à une séance, ou séances de la séquence non encore programmées, dans l'ordre).
// Rien n'est écrit sans validation ; ce qui est déjà rempli, fait, reporté ou annulé n'est jamais touché.
import * as store from './store.js';
import * as model from './model.js';
import * as P from './pedago.js';
import * as PL from './planning.js';
import { toCsv } from './csv.js';

export const habitualOf = (cls, slotId) => { const id = cls.habitual?.[slotId]; const s = id && store.get(id); return s && !s.deletedAt ? s : null; };
export async function setHabitual(cls, slotId, sessionId) {
  const cur = { ...(store.get(cls.id).habitual || {}) };
  if (sessionId) cur[slotId] = sessionId; else delete cur[slotId];
  return store.update(cls.id, { habitual: cur }, sessionId ? 'Fiche habituelle du créneau' : 'Fiche habituelle retirée', { quiet: false });
}

export function weekDays(cls, monday) { return model.classDays(cls).map(d => model.addDays(monday, d - 1)); }

const nrm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const subKeys = (sub) => nrm(sub).split(/\s*[/,;]\s*/).map(x => x.trim()).filter(x => x.length > 2);
const labelKey = (e) => nrm(`${e.slot?.label || ''} ${e.title || ''}`);

/** Propositions pour la semaine : [{ entry, sessionId, source }] */
export function weekProposals(cls, monday, shared = null) {
  const year = store.get(cls.yearId);
  const days = weekDays(cls, monday);
  // « shared » : séances déjà proposées les semaines précédentes (préparation sur plusieurs semaines).
  const used = shared || new Set(store.all('occurrence').filter(o => o.classId === cls.id && o.sessionId && !['annulée', 'reportée'].includes(o.status)).map(o => o.sessionId));
  // Une file de séances par progression (discipline, niveau, sous-domaine) et par semaine.
  const queues = []; const seen = new Set();
  for (const d of days) {
    const per = model.periodOfDate(year, d); if (!per) continue;
    const wk = model.weeksOfPeriod(per).find(w => d >= w.monday && d <= model.addDays(w.monday, 6)); if (!wk) continue;
    for (const pr of P.ofClass('progression', cls.id).filter(x => x.periodId === per.id)) {
      if (seen.has(pr.id)) continue; seen.add(pr.id);
      const ids = [];
      for (const r of (pr.rows || []).filter(r => r.week === wk.n && !['Réalisé', 'Reporté'].includes(r.status))) {
        if (r.sessionId) ids.push(r.sessionId);
        else if (r.sequenceId) ids.push(...P.sessionsOfSequence(r.sequenceId).map(s => s.id));
      }
      queues.push({ subject: pr.subject, level: pr.level || '', keys: subKeys(pr.subdomain), ids: ids.filter(id => !used.has(id) && store.get(id) && !store.get(id).deletedAt) });
    }
  }
  // Sous-domaine d'une progression (« Géométrie », « Picot », « Temps / Espace ») : ses séances vont dans les
  // créneaux dont l'intitulé contient ce mot. Si aucun créneau de la semaine ne le contient, comportement simple :
  // première séance disponible de la discipline.
  const weekLabels = days.flatMap(d => PL.dayPlan(cls, d, { ignoreBlank: true }).entries.filter(e => e.kind === 'slot').map(e => ({ subject: e.subject, label: labelKey(e) })));
  for (const q of queues) q.placeable = !q.keys.length || weekLabels.some(w => w.subject === q.subject && q.keys.some(k => w.label.includes(k)));
  const take = (subject, levels, label) => {
    const mine = queues.filter(q => q.subject === subject && (!levels?.length || !q.level || levels.includes(q.level)) && q.ids.length);
    const exact = mine.filter(q => q.keys.length && q.keys.some(k => label.includes(k)));
    const pool = exact.length ? exact : mine.filter(q => !q.keys.length || !q.placeable);
    for (const q of pool) { const id = q.ids.shift(); if (id) return id; }
    return null;
  };
  const out = [];
  for (const d of days) {
    const plan = PL.dayPlan(cls, d, { ignoreBlank: true });
    if (!plan.school.ok || !plan.myDay) continue;
    for (const e of plan.entries) {
      if (e.kind !== 'slot' || e.sessionId || e.status !== 'prévue') continue;
      const hab = habitualOf(cls, e.slot.id);
      if (hab) { out.push({ entry: e, sessionId: hab.id, source: 'habituelle' }); continue; }
      const sid = take(e.subject, e.levels, labelKey(e));
      if (sid) { used.add(sid); out.push({ entry: e, sessionId: sid, source: 'progression' }); }
    }
  }
  return out;
}

/** Propositions de plusieurs semaines (jusqu'aux vacances) : une séance n'est jamais proposée deux fois. */
export function rangeProposals(cls, monday, untilMonday) {
  const used = new Set(store.all('occurrence').filter(o => o.classId === cls.id && o.sessionId && !['annulée', 'reportée'].includes(o.status)).map(o => o.sessionId));
  const out = [];
  for (let m = monday; m <= untilMonday; m = model.addDays(m, 7)) if (!PL.isBlankWeek(cls, m) || m === monday) out.push(...weekProposals(cls, m, used));
  return out;
}
/** Lundi de la dernière semaine de la période en cours (avant les vacances). */
export function lastMondayOfPeriod(cls, date) {
  const p = model.periodOfDate(store.get(cls.yearId), date);
  return p ? model.mondayOf(p.end) : model.mondayOf(date);
}

export async function applyProposals(cls, list) {
  if (!list.length) return 0;
  await store.batch(list.map(p => ({ create: { type: 'occurrence', data: { ...PL.occDataFromEntry(p.entry, cls), sessionId: p.sessionId } } })), `Cahier journal pré-rempli (${list.length} créneau(x))`);
  return list.length;
}

// ───── Export sur une période
/** Bornes [début, fin] selon le choix : jour, semaine, mois, période, année, dates. */
export function rangeOf(kind, date, cls, from, to) {
  const year = store.get(cls.yearId);
  if (kind === 'jour') return [date, date];
  if (kind === 'semaine') { const m = model.mondayOf(date); return [m, model.addDays(m, 6)]; }
  if (kind === 'mois') { const [y, mo] = date.split('-').map(Number); const last = new Date(y, mo, 0).getDate(); return [`${date.slice(0, 7)}-01`, `${date.slice(0, 7)}-${String(last).padStart(2, '0')}`]; }
  if (kind === 'periode') { const p = model.periodOfDate(year, date) || model.periodsOf(year)[0]; return p ? [p.start, p.end] : [date, date]; }
  if (kind === 'annee') return [year?.start || date, year?.end || date];
  return [from || date, to || from || date];
}
export function schoolDaysBetween(cls, a, b) {
  const out = [];
  for (let d = a; d <= b; d = model.addDays(d, 1)) if (PL.isSchoolDay(cls, d).ok && PL.isMyDay(cls, d)) out.push(d);
  return out;
}
export function csvOf(cls, days) {
  const rows = [['Date', 'Début', 'Fin', 'Discipline', 'Séance', 'Statut', 'Bilan']];
  for (const d of days) for (const e of PL.dayPlan(cls, d).entries) rows.push([d, e.start || '', e.end || '', e.subject || '', e.session ? P.sessionTitle(e.session) : e.title, e.status, e.occ?.note || '']);
  return toCsv(rows);
}
