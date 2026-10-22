// Règles métier partagées : années, périodes, classes, niveaux, inscriptions.
import * as store from './store.js';

export const NIVEAUX = ['TPS', 'PS', 'MS', 'GS', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
const CYCLE_DE = { TPS: 1, PS: 1, MS: 1, GS: 1, CP: 2, CE1: 2, CE2: 2, CM1: 3, CM2: 3 };

export function cycles(levels = []) {
  return [...new Set(levels.map(l => CYCLE_DE[l]).filter(Boolean))].sort();
}
export function cycleLabel(levels) {
  const c = cycles(levels);
  return c.length ? c.map(n => `cycle ${n}`).join(' + ') : '—';
}
export function sortLevels(levels) {
  return [...levels].sort((a, b) => NIVEAUX.indexOf(a) - NIVEAUX.indexOf(b));
}

// Calendrier officiel 2026-2027, zone C (académies de Créteil, Montpellier, Paris, Toulouse, Versailles).
// Source : service-public.gouv.fr, actualité A18563, consultée le 19/10/2026.
// Les vacances commencent après la classe du dernier jour indiqué ; reprise le matin du jour indiqué.
export const PRESETS = {
  'zoneC-2026-2027': {
    label: '2026-2027',
    zone: 'C',
    source: 'service-public.gouv.fr (actualité A18563), consulté le 19/10/2026',
    start: '2026-09-01',
    end: '2027-07-02',
    periods: [
      { name: 'Période 1', start: '2026-09-01', end: '2026-10-16' },
      { name: 'Période 2', start: '2026-11-02', end: '2026-12-18' },
      { name: 'Période 3', start: '2027-01-04', end: '2027-02-05' },
      { name: 'Période 4', start: '2027-02-22', end: '2027-04-02' },
      { name: 'Période 5', start: '2027-04-19', end: '2027-07-02' },
    ],
    noSchoolDays: [{ date: '2027-05-07', label: 'Pas de classe (pont, toutes zones)' }],
  },
};

export function todayIso(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function frDate(iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', opts);
}
export function frShort(iso) { return iso ? frDate(iso, { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''; }
export function frDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ───── Années
export function years() {
  return store.all('year').sort((a, b) => (b.start || '').localeCompare(a.start || ''));
}
export function currentYear() {
  const s = store.getSettings();
  const y = s.currentYearId && store.get(s.currentYearId);
  return y && !y.deletedAt ? y : null;
}
/** Situe une date dans l'année : période en cours, vacances entre deux périodes, hors année. */
export function situate(year, date = todayIso()) {
  if (!year) return { kind: 'none' };
  const ps = (year.periods || []).slice().sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (date >= p.start && date <= p.end) return { kind: 'period', period: p, index: i };
    const next = ps[i + 1];
    if (next && date > p.end && date < next.start) return { kind: 'holidays', after: p, before: next };
  }
  if (ps.length && date < ps[0].start) return { kind: 'before', next: ps[0] };
  if (ps.length && date > ps[ps.length - 1].end) return { kind: 'after' };
  return { kind: 'unknown' };
}

// ───── Classes
export function classesOfYear(yearId) {
  return store.all('class').filter(c => c.yearId === yearId).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
export function currentClass() {
  const s = store.getSettings();
  const c = s.currentClassId && store.get(s.currentClassId);
  return c && !c.deletedAt ? c : null;
}

// ───── Élèves et inscriptions
// Un élève (identité, contacts) est distinct de ses inscriptions (classe, niveau, dates).
// Ainsi un départ ou une arrivée ne modifie pas les listes des jours précédents.
export function enrollmentsOfClass(classId) {
  return store.all('enrollment').filter(e => e.classId === classId);
}
export function enrollmentsOfStudent(studentId) {
  return store.all('enrollment').filter(e => e.studentId === studentId)
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
}
export function isActiveOn(enr, date) {
  return (!enr.start || enr.start <= date) && (!enr.end || enr.end >= date);
}
/** Élèves inscrits dans la classe à une date donnée (par défaut aujourd'hui). */
export function studentsOfClass(classId, { date = todayIso(), includeLeft = false, includeFuture = false } = {}) {
  const out = [];
  for (const e of enrollmentsOfClass(classId)) {
    const active = isActiveOn(e, date);
    const left = e.end && e.end < date;
    const future = e.start && e.start > date;
    if (active || (includeLeft && left) || (includeFuture && future)) {
      const s = store.get(e.studentId);
      if (s && !s.deletedAt) out.push({ student: s, enrollment: e, status: active ? 'actif' : left ? 'parti' : 'à venir' });
    }
  }
  return out.sort((a, b) => fullName(a.student).localeCompare(fullName(b.student), 'fr'));
}
export function fullName(s, order = 'nom') {
  if (!s) return '';
  return order === 'prenom' ? `${s.firstName || ''} ${s.lastName || ''}`.trim() : `${(s.lastName || '').toUpperCase()} ${s.firstName || ''}`.trim();
}
export function age(birthIso, at = todayIso()) {
  if (!birthIso) return null;
  const [by, bm, bd] = birthIso.split('-').map(Number);
  const [y, m, d] = at.split('-').map(Number);
  let a = y - by; if (m < bm || (m === bm && d < bd)) a--;
  return a;
}
