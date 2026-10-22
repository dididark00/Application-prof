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

// ───── Matières (liste modifiable dans Réglages)
export const DEFAULT_SUBJECTS = ['Français', 'Mathématiques', 'Questionner le monde', 'Langues vivantes', 'Arts plastiques', 'Éducation musicale', 'EPS', 'EMC', 'Autre'];
export function subjects() {
  const s = store.getSettings().subjects;
  return Array.isArray(s) && s.length ? s : DEFAULT_SUBJECTS;
}
const PALETTE = ['#2f6f8f', '#b5532f', '#6a8f2f', '#8f2f6a', '#a3801f', '#2f8f7a', '#5a4fa3', '#8f4a2f', '#3f7f3f', '#7a5c8f'];
export function subjectColor(name) {
  if (!name) return '#777';
  const i = subjects().indexOf(name);
  if (i >= 0) return PALETTE[i % PALETTE.length];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// ───── Répartition des enseignements avec la binôme
export function owners(cls = currentClass()) {
  const me = store.getSettings().userName || 'Moi';
  const bin = cls?.binome?.name || 'Binôme';
  return [['moi', me], ['binome', bin], ['commun', 'Commun']];
}
export function ownerLabel(key, cls) { return (owners(cls).find(o => o[0] === key) || [null, ''])[1]; }

// ───── Jours de classe (1 = lundi … 5 = vendredi, 6 = samedi)
export const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export function classDays(cls) { return cls?.classDays?.length ? cls.classDays : [1, 2, 4, 5]; }
export function weekday(iso) { const [y, m, d] = iso.split('-').map(Number); const w = new Date(y, m - 1, d).getDay(); return w === 0 ? 7 : w; }
export function addDays(iso, n) { const [y, m, d] = iso.split('-').map(Number); return todayIso(new Date(y, m - 1, d + n)); }
export function mondayOf(iso) { return addDays(iso, 1 - weekday(iso)); }
export function diffDays(a, b) { const p = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((p(b) - p(a)) / 86400000); }

// ───── Périodes
export function periodsOf(year) { return (year?.periods || []).slice().sort((a, b) => a.start.localeCompare(b.start)); }
export function periodOfDate(year, date) { return periodsOf(year).find(p => date >= p.start && date <= p.end) || null; }
export function periodLabel(year, periodId) {
  const ps = periodsOf(year); const i = ps.findIndex(p => p.id === periodId);
  return i >= 0 ? `P${i + 1}` : '';
}
/** Semaines d'une période : S1 = semaine contenant le premier jour. */
export function weeksOfPeriod(p) {
  if (!p) return [];
  const out = []; let mon = mondayOf(p.start); let n = 1;
  while (mon <= p.end) { out.push({ n, monday: mon, friday: addDays(mon, 4) }); mon = addDays(mon, 7); n++; }
  return out;
}
export function minutes(hhmm) { if (!hhmm) return 0; const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); }
export function hhmm(min) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`; }
export function durationLabel(min) { if (!min) return ''; const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h${m ? ' ' + String(m).padStart(2, '0') : ''}` : `${m} min`; }
