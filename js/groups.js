// Groupes : ensembles de groupes (binômes, équipes, académies, ateliers, besoins),
// permanents ou propres à une séance. Un élève n'est que dans un groupe d'un même ensemble.
import * as store from './store.js';
import * as model from './model.js';
import * as V from './vie.js';

export const KINDS = ['binômes', 'équipes', 'académies', 'ateliers', 'groupes de besoin', 'autre'];
export const COLORS = ['#d9534f', '#2f6f8f', '#3f8f3f', '#e0a020', '#7a4a9a', '#1f8f8a', '#b5532f', '#5a4fa3'];

export function setsOf(classId) { return store.all('groupset').filter(s => s.classId === classId).sort((a, b) => (b.permanent - a.permanent) || (a.name || '').localeCompare(b.name || '', 'fr')); }
/** Tous les groupes (aplatis) d'une classe. */
export function groupsOf(classId, { permanentOnly = false } = {}) {
  return setsOf(classId).filter(s => !permanentOnly || s.permanent).flatMap(s => (s.groups || []).map(g => ({ ...g, setId: s.id, setName: s.name, name: `${s.name} — ${g.name}` })));
}
export function groupById(id) {
  for (const s of store.all('groupset')) { const g = (s.groups || []).find(x => x.id === id); if (g) return { ...g, setId: s.id, name: `${s.name} — ${g.name}` }; }
  return null;
}

/** Élèves absents toute la journée à l'appel (exclus d'une répartition aléatoire). */
export function absentsOn(cls, date) {
  return new Set(model.studentsOfClass(cls.id, { date }).map(x => x.student.id).filter(id => V.HALVES.every(([h]) => V.attendanceOf(cls.id, date, h)?.marks?.[id]?.status === 'absent')));
}

/** Répartition aléatoire équilibrée (Fisher-Yates), par taille ou par nombre de groupes. */
export function randomGroups(ids, { size = null, count = null }) {
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const n = count ? Math.max(1, count) : Math.max(1, Math.round(a.length / Math.max(1, size || 2)));
  const out = Array.from({ length: Math.min(n, a.length || 1) }, () => []);
  a.forEach((id, i) => out[i % out.length].push(id));
  return out;
}

export function newGroup(i, members = []) {
  return { id: store.uid(), name: `Groupe ${i + 1}`, color: COLORS[i % COLORS.length], memberIds: members, roles: {}, activity: '', material: '', order: i + 1 };
}

/** Copie figée d'un ensemble, pour une séance datée : modifier les groupes ensuite ne la change pas. */
export function snapshotSet(set) {
  return { setId: set.id, name: set.name, kind: set.kind, takenAt: new Date().toISOString(),
    groups: (set.groups || []).map(g => ({ name: g.name, color: g.color, memberIds: [...(g.memberIds || [])], roles: { ...(g.roles || {}) }, activity: g.activity || '', material: g.material || '', order: g.order })) };
}
