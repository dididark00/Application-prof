// Vie de classe au quotidien : appel par demi-journée, services (cantine, étude…), sorties.
import * as store from './store.js';
import * as model from './model.js';

export const HALVES = [['matin', 'Matin'], ['après-midi', 'Après-midi']];
export const MARKS = [
  ['présent', 'Présent', 'P'], ['absent', 'Absent', 'A'], ['retard', 'Retard', 'R'],
  ['départ', 'Départ anticipé', 'D'], ['partiel', 'Absence partielle', '½'],
];
export function halfTimes(cls, half) {
  const def = { matin: { start: '08:30', end: '11:30' }, 'après-midi': { start: '13:30', end: '16:30' } };
  return { ...def[half], ...(cls?.halfDays?.[half] || {}) };
}

export function attendanceOf(classId, date, half) {
  return store.all('attendance').find(a => a.classId === classId && a.date === date && a.half === half) || null;
}
export function attendanceOfStudent(studentId) {
  return store.all('attendance').filter(a => a.marks?.[studentId]).map(a => ({ a, m: a.marks[studentId] })).sort((x, y) => (y.a.date + y.a.half).localeCompare(x.a.date + x.a.half));
}

/**
 * Plages d'absence d'un élève un jour donné (heures), d'après l'appel.
 * verified = appel validé ; un appel non validé est signalé comme non vérifié.
 */
export function absenceRanges(cls, studentId, date) {
  const out = [];
  for (const [half] of HALVES) {
    const a = attendanceOf(cls.id, date, half);
    const m = a?.marks?.[studentId];
    if (!m) continue;
    const t = halfTimes(cls, half);
    const base = { half, verified: !!a.validated, comment: m.comment || '' };
    if (m.status === 'absent') out.push({ ...base, start: t.start, end: t.end, kind: 'absent' });
    else if (m.status === 'retard' && m.time) out.push({ ...base, start: t.start, end: m.time, kind: 'retard' });
    else if (m.status === 'départ' && m.time) out.push({ ...base, start: m.time, end: t.end, kind: 'départ' });
    else if (m.status === 'partiel' && m.from && m.to) out.push({ ...base, start: m.from, end: m.to, kind: 'partiel' });
  }
  return out;
}

// ───── Services
export const DEFAULT_SERVICES = ['Cantine', 'Étude', 'Garderie du matin', 'Garderie du soir'];
export function services() { const s = store.getSettings().services; return Array.isArray(s) && s.length ? s : DEFAULT_SERVICES; }
export function planOf(classId) { return store.all('serviceplan').find(p => p.classId === classId) || null; }
export async function ensurePlan(classId) { return planOf(classId) || store.create('serviceplan', { classId, plans: {} }, 'Semaine type des services'); }
export function exceptionsOn(classId, date) { return store.all('serviceexc').filter(e => e.classId === classId && e.date === date); }

/**
 * Pour une date : inscrits (semaine type ± exceptions datées) et présence prévue
 * (inscrits moins les absents connus à l'appel). Les deux sont distingués.
 */
export function serviceDay(cls, date, service) {
  const wd = model.weekday(date);
  const plan = planOf(cls.id);
  const exc = exceptionsOn(cls.id, date).filter(e => e.service === service);
  const rows = [];
  for (const { student: s } of model.studentsOfClass(cls.id, { date })) {
    const usual = (plan?.plans?.[s.id]?.[service] || []).includes(wd);
    const e = exc.find(x => x.studentId === s.id);
    const registered = e ? !!e.present : usual;
    const am = attendanceOf(cls.id, date, 'matin')?.marks?.[s.id]?.status;
    const pm = attendanceOf(cls.id, date, 'après-midi')?.marks?.[s.id]?.status;
    // Absent le matin et pas encore pointé l'après-midi : on ne le compte pas présent au service de midi.
    const absentAll = am === 'absent' && (pm === 'absent' || !pm);
    const absentSome = !absentAll && absenceRanges(cls, s.id, date).length > 0;
    if (registered || e) rows.push({ student: s, usual, exception: e || null, registered, expected: registered && !absentAll, absentAll, absentSome });
  }
  return rows.filter(r => r.registered).sort((a, b) => model.fullName(a.student).localeCompare(model.fullName(b.student), 'fr'));
}

export const DEPARTURES = ['accompagné', 'seul (autorisation)', 'garderie / étude', 'transport', 'autre'];
export function departureOn(cls, student, date) {
  const e = exceptionsOn(cls.id, date).find(x => x.service === '__départ' && x.studentId === student.id);
  return { usual: student.departure?.mode || '', usualNote: student.departure?.note || '', exception: e || null };
}
