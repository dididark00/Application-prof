// Planification : emploi du temps versionné par période, construction d'une journée,
// conflits, reports, interventions, temps par matière, matériel et photocopies.
import * as store from './store.js';
import * as model from './model.js';
import * as P from './pedago.js';

export const MODES = [
  ['dirigé', 'Travail dirigé (enseignant)', true],
  ['autonomie', 'Autonomie', false],
  ['atelier dirigé', 'Atelier dirigé (enseignant)', true],
  ['atelier autonome', 'Atelier autonome', false],
  ['rituel', 'Rituel', true],
  ['intervention', 'Intervenant', false],
];
export const needsTeacher = (mode) => (MODES.find(m => m[0] === mode) || [null, null, true])[2];
export const OCC_STATUS = { prévue: 'muted', faite: 'ok', partielle: 'warn', reportée: 'warn', annulée: 'muted' };
export const EVENT_KINDS = ['sortie', 'absence', 'visite', 'réunion', 'intervention', 'formation', 'rendez-vous', 'personnel', 'autre'];

// ───────── Emploi du temps
export function timetablesOf(classId) { return store.all('timetable').filter(t => t.classId === classId); }
export function timetableForDate(cls, date) {
  const year = store.get(cls.yearId);
  const per = model.periodOfDate(year, date);
  if (!per) return { period: null, timetable: null, version: null };
  const tt = timetablesOf(cls.id).find(t => (t.periodIds || []).includes(per.id)) || null;
  return { period: per, timetable: tt, version: tt ? versionAt(tt, date) : null };
}
/** Version en vigueur à une date : une modification datée ne réécrit pas les journées passées. */
export function versionAt(tt, date) {
  const vs = (tt.versions || []).slice().sort((a, b) => (a.from || '').localeCompare(b.from || ''));
  let cur = vs[0] || null;
  for (const v of vs) if (!v.from || v.from <= date) cur = v;
  return cur;
}
export function firstDayOf(tt) {
  const year = (() => { const c = store.get(tt.classId); return c && store.get(c.yearId); })();
  const ps = model.periodsOf(year).filter(p => (tt.periodIds || []).includes(p.id));
  return ps.length ? ps[0].start : null;
}

export function isSchoolDay(cls, date) {
  const year = store.get(cls.yearId);
  const per = model.periodOfDate(year, date);
  if (!per) return { ok: false, reason: model.situate(year, date).kind === 'holidays' ? 'Vacances scolaires' : 'Hors période scolaire' };
  if (!model.classDays(cls).includes(model.weekday(date))) return { ok: false, reason: 'Pas de classe ce jour-là' };
  const ns = (year.noSchoolDays || []).find(d => d.date === date);
  if (ns) return { ok: false, reason: ns.label || 'Jour sans classe' };
  return { ok: true, period: per };
}
export const isMyDay = (cls, date) => !model.hasBinome(cls) || !cls.serviceDays?.length || cls.serviceDays.includes(model.weekday(date));

// ───────── Journée
function activeInterventions(cls, date) {
  return store.all('intervention').filter(i => i.classId === cls.id && i.status === 'confirmée' && i.startDate && i.startDate <= date && (!i.endDate || i.endDate >= date));
}
export function eventsOn(date, { classId = null, includePersonal = true } = {}) {
  return store.all('event').filter(e => (e.date === date || (e.endDate && e.date <= date && e.endDate >= date))
    && (includePersonal || !e.personal) && (!classId || !e.classId || e.classId === classId));
}

function entryFromOcc(o, slot = null) {
  const session = o.sessionId ? store.get(o.sessionId) : null;
  return { key: `o:${o.id}`, kind: 'occ', date: o.date, start: o.start, end: o.end, subject: o.subject || session?.subject || slot?.subject || '',
    // Une séance faite garde le titre qu'elle avait ce jour-là (instantané).
    title: (['faite', 'partielle'].includes(o.status) && o.snapshot?.title != null) ? `${o.snapshot.sequenceTitle && o.snapshot.number ? `S${o.snapshot.number} · ` : ''}${o.snapshot.title || 'Séance'}`
      : session ? P.sessionTitle(session) : (o.title || slot?.label || o.subject || 'Activité'), levels: o.levels || slot?.levels || [],
    mode: o.mode || slot?.mode || 'dirigé', status: o.status || 'prévue', occ: o, slot, session: session && !session.deletedAt ? session : null,
    sessionId: o.sessionId || null, intervention: o.interventionId ? store.get(o.interventionId) : null };
}

/** Construit la journée d'une classe : EDT en vigueur + séances datées + interventions + événements. */
/** Semaine vierge : choix par semaine, sinon réglage par défaut de la classe. */
export function isBlankWeek(cls, date) {
  const c = store.get(cls.id) || cls; const m = model.mondayOf(date);
  return c.weekMode?.[m] ? c.weekMode[m] === 'vierge' : c.journalMode === 'vierge';
}
export async function setWeekMode(cls, monday, mode) {
  const cur = { ...(store.get(cls.id).weekMode || {}) }; cur[monday] = mode;
  return store.update(cls.id, { weekMode: cur }, mode === 'vierge' ? 'Semaine partie de zéro' : 'Semaine construite depuis l’emploi du temps');
}
export function dayPlan(cls, date, { ignoreBlank = false } = {}) {
  const school = isSchoolDay(cls, date);
  const wd = model.weekday(date);
  const occs = store.all('occurrence').filter(o => o.classId === cls.id && o.date === date);
  const usedOcc = new Set();
  const entries = [];
  if (school.ok) {
    const { version } = timetableForDate(cls, date);
    // Semaine « vierge » : l'EDT n'est pas posé, seules les activités ajoutées à la main apparaissent.
    const blank = !ignoreBlank && isBlankWeek(cls, date);
    for (const slot of (blank ? [] : version?.slots || []).filter(s => s.day === wd)) {
      const o = occs.find(x => x.slotId === slot.id);
      if (o) { usedOcc.add(o.id); entries.push(entryFromOcc(o, slot)); }
      else entries.push({ key: `s:${date}:${slot.id}`, kind: 'slot', date, start: slot.start, end: slot.end, subject: slot.subject, title: slot.label || slot.subject || 'Créneau',
        levels: slot.levels || [], mode: slot.mode || 'dirigé', status: 'prévue', slot, session: null, sessionId: null });
    }
    for (const iv of activeInterventions(cls, date)) for (const sl of (iv.slots || []).filter(s => s.day === wd)) {
      const o = occs.find(x => x.interventionId === iv.id && x.interventionSlotId === sl.id);
      if (o) { usedOcc.add(o.id); entries.push(entryFromOcc(o)); continue; }
      entries.push({ key: `i:${date}:${iv.id}:${sl.id}`, kind: 'intervention', date, start: sl.start, end: sl.end, subject: iv.subject || '', title: `Intervention : ${iv.title}`,
        levels: iv.levels || [], mode: 'intervention', status: 'prévue', intervention: iv, interventionSlot: sl, session: null, sessionId: null });
    }
  }
  for (const o of occs) if (!usedOcc.has(o.id)) entries.push(entryFromOcc(o));
  for (const e of eventsOn(date, { classId: cls.id, includePersonal: false }).filter(e => e.classId === cls.id)) {
    entries.push({ key: `e:${e.id}`, kind: 'event', date, start: e.start || '00:00', end: e.end || '23:59', allDay: !e.start, subject: '', title: e.title, levels: e.levels || [],
      mode: e.blocksClass ? 'dirigé' : 'autonomie', status: 'prévue', event: e, blocks: !!e.blocksClass });
  }
  entries.sort((a, b) => (a.start || '').localeCompare(b.start || '') || (a.end || '').localeCompare(b.end || ''));
  const warnings = conflicts(entries, cls);
  return { date, school, entries, warnings, myDay: isMyDay(cls, date) };
}

const active = (e) => !['reportée', 'annulée'].includes(e.status) && (e.kind !== 'event' || e.blocks);
const overlap = (a, b) => a.start < b.end && b.start < a.end;
const levelsOf = (e, cls) => (e.levels?.length ? e.levels : cls.levels || []);
const teacherOf = (e) => (e.kind === 'event' ? e.blocks : needsTeacher(e.mode));

/** Conflits : mêmes élèves sur deux activités, ou deux activités exigeant l'enseignant en même temps. */
export function conflicts(entries, cls) {
  const out = [];
  const act = entries.filter(active);
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i], b = act[j];
    if (!overlap(a, b)) continue;
    const common = levelsOf(a, cls).filter(l => levelsOf(b, cls).includes(l));
    if (common.length) out.push({ type: 'eleves', a, b, message: `« ${a.title} » et « ${b.title} » se chevauchent (${a.start}–${a.end} / ${b.start}–${b.end}) pour les ${common.join(', ')}.` });
    else if (teacherOf(a) && teacherOf(b)) out.push({ type: 'enseignant', a, b, message: `Deux activités exigent l’enseignant en même temps : « ${a.title} » (${levelsOf(a, cls).join(', ')}) et « ${b.title} » (${levelsOf(b, cls).join(', ')}), ${a.start > b.start ? a.start : b.start}–${a.end < b.end ? a.end : b.end}.` });
  }
  return out;
}

// ───────── Matérialisation d'une entrée en séance datée
export function occDataFromEntry(e, cls) {
  const base = { classId: cls.id, date: e.date, start: e.start, end: e.end, subject: e.subject, levels: e.levels || [], mode: e.mode, status: 'prévue', sessionId: e.sessionId || null };
  if (e.kind === 'slot') return { ...base, slotId: e.slot.id, title: e.slot.label || '' };
  if (e.kind === 'intervention') return { ...base, interventionId: e.intervention.id, interventionSlotId: e.interventionSlot.id, title: e.title };
  return base;
}
/** Applique une modification à une entrée : crée la séance datée si elle n'existait pas encore. */
export async function patchEntry(e, cls, patch, label, opts = {}) {
  if (e.kind === 'occ') return store.update(e.occ.id, patch, label, opts);
  if (e.kind === 'event') return store.update(e.event.id, patch, label, opts);
  return store.create('occurrence', { ...occDataFromEntry(e, cls), ...patch }, label);
}
export async function setStatus(e, cls, status) {
  const session = e.session || (e.sessionId ? store.get(e.sessionId) : null);
  const patch = { status };
  // « Réalisé » : on garde une photo de la fiche telle qu'elle a été faite.
  if (status === 'faite' || status === 'partielle') { patch.snapshot = P.snapshotOf(session); patch.doneAt = new Date().toISOString(); }
  else { patch.snapshot = null; patch.doneAt = null; }
  return patchEntry(e, cls, patch, `Séance du ${model.frShort(e.date)} : ${status}`);
}

// ───────── Reports
/** Créneaux libres de la même matière dans les semaines suivantes ; l'enseignant choisit. */
export function postponeCandidates(cls, e, { days = 28, max = 6 } = {}) {
  const out = [];
  for (let k = 1; k <= days && out.length < max; k++) {
    const d = model.addDays(e.date, k);
    const plan = dayPlan(cls, d);
    if (!plan.school.ok) continue;
    for (const x of plan.entries) {
      if (out.length >= max) break;
      const free = (x.kind === 'slot' || (x.kind === 'occ' && !x.sessionId && x.status === 'prévue'));
      if (free && (!e.subject || x.subject === e.subject)) out.push({ date: d, entry: x });
    }
  }
  return out;
}
export async function postpone(e, cls, target) {
  const origId = e.kind === 'occ' ? e.occ.id : store.uid();
  const newId = target.entry?.kind === 'occ' ? target.entry.occ.id : store.uid();
  const items = [];
  if (e.kind === 'occ') items.push({ id: origId, patch: { status: 'reportée', postponedTo: newId, snapshot: null } });
  else items.push({ create: { type: 'occurrence', data: { ...occDataFromEntry(e, cls), id: origId, status: 'reportée', postponedTo: newId } } });
  const carry = { sessionId: e.sessionId || null, title: e.kind === 'occ' ? (e.occ.title || '') : (e.slot?.label || e.title || ''), postponedFrom: origId, status: 'prévue' };
  if (target.entry?.kind === 'occ') items.push({ id: newId, patch: carry });
  else if (target.entry) items.push({ create: { type: 'occurrence', data: { ...occDataFromEntry({ ...target.entry, sessionId: e.sessionId }, cls), ...carry, id: newId } } });
  else items.push({ create: { type: 'occurrence', data: { classId: cls.id, date: target.date, start: target.start, end: target.end, subject: e.subject, levels: e.levels || [], mode: e.mode, ...carry, id: newId } } });
  await store.batch(items, `Report de « ${e.title} » du ${model.frShort(e.date)} au ${model.frShort(target.date)}`);
  return newId;
}

// ───────── Temps par matière
export function weeklyMinutes(slots, levels) {
  const out = {};
  for (const s of slots || []) {
    const m = model.minutes(s.end) - model.minutes(s.start);
    if (m <= 0) continue;
    const subj = s.subject || '(sans matière)';
    out[subj] ||= { total: 0, byLevel: {} };
    out[subj].total += m;
    for (const l of (s.levels?.length ? s.levels : levels)) out[subj].byLevel[l] = (out[subj].byLevel[l] || 0) + m;
  }
  return out;
}

// ───────── Matériel et photocopies d'une période de jours
export function materials(cls, dates) {
  const rows = [];
  for (const d of dates) {
    const plan = dayPlan(cls, d);
    for (const e of plan.entries.filter(x => x.session && !['reportée', 'annulée'].includes(x.status))) {
      const s = e.session;
      const lv = e.levels?.length ? e.levels : (s.levels?.length ? s.levels : cls.levels);
      const n = model.studentsOfClass(cls.id, { date: d }).filter(x => lv.includes(x.enrollment.level)).length;
      for (const c of s.copies || []) rows.push({ date: d, entry: e, kind: 'copie', id: c.id, label: c.label || 'Photocopie', count: n * (Number(c.perStudent) || 0) + (Number(c.extra) || 0), status: e.occ?.copyStatus?.[c.id] || 'à faire', fileId: c.fileId });
      for (const [k, l] of [['avant', 'À préparer'], ['imprimer', 'À imprimer'], ['projeter', 'À projeter']]) if (s[k]) rows.push({ date: d, entry: e, kind: k, label: `${l} : ${s[k]}`, status: null });
    }
  }
  return rows;
}
