// Données de démonstration : entièrement fictives et marquées `demo: true`.
// Les noms, téléphones et adresses sont inventés (domaine « .invalid » réservé, numéros 06 00 00 00 xx).
import * as store from './store.js';
import * as model from './model.js';

const ELEVES = [
  ['Lou', 'Exemple'], ['Nino', 'Fictif'], ['Jade', 'Démo'], ['Malo', 'Essai'], ['Inès', 'Modèle'],
  ['Sacha', 'Brouillon'], ['Rose', 'Croquis'], ['Timéo', 'Esquisse'], ['Lina', 'Maquette'], ['Noé', 'Ébauche'],
  ['Alba', 'Prototype'], ['Côme', 'Spécimen'],
];

export function hasDemo() {
  return store.all('class', { includeDeleted: true }).some(c => c.demo);
}

export async function loadDemo() {
  if (hasDemo()) throw new Error('Les données de démonstration sont déjà chargées.');
  const preset = model.PRESETS['zoneC-2026-2027'];
  const items = [];
  let year = model.years().find(y => y.label === preset.label && !y.demo);
  let yearId = year ? year.id : store.uid();
  if (!year) {
    items.push({ create: { type: 'year', data: { id: yearId, demo: true, label: preset.label, zone: 'C', source: preset.source, start: preset.start, end: preset.end,
      periods: preset.periods.map(p => ({ ...p, id: store.uid() })), noSchoolDays: preset.noSchoolDays } } });
  }
  const classId = store.uid();
  items.push({ create: { type: 'class', data: { id: classId, yearId, demo: true, name: 'CE2 (démo)', levels: ['CE2'], school: 'École fictive des Tilleuls',
    service: { type: 'mi-temps', detail: 'Lundi, mardi (fictif)' }, binome: { name: 'Collègue fictive', detail: 'Jeudi, vendredi' } } } });
  ELEVES.forEach(([firstName, lastName], i) => {
    const sid = store.uid();
    const n = String(i + 10).padStart(2, '0');
    items.push({ create: { type: 'student', data: { id: sid, demo: true, firstName, lastName, birthDate: `2018-${String((i % 12) + 1).padStart(2, '0')}-${String((i * 3 % 27) + 1).padStart(2, '0')}`,
      contacts: [
        { id: store.uid(), name: `Responsable ${lastName} 1`, relation: 'Mère', phone: `06 00 00 00 ${n}`, email: `famille.${lastName.toLowerCase()}@exemple.invalid`, legal: true, priority: true, emergency: true, pickup: true },
        { id: store.uid(), name: `Responsable ${lastName} 2`, relation: 'Père', phone: `07 00 00 00 ${n}`, email: '', legal: true, priority: false, emergency: true, pickup: true },
      ] } } });
    // Une arrivée en cours d'année et un départ, pour montrer l'historique des listes.
    const start = i === 11 ? '2026-11-02' : preset.start;
    const end = i === 10 ? '2026-10-16' : null;
    items.push({ create: { type: 'enrollment', data: { demo: true, studentId: sid, classId, level: 'CE2', start, end, endReason: end ? 'Déménagement (fictif)' : '' } } });
  });
  items.push({ create: { type: 'folder', data: { demo: true, name: 'Démo — Français', parentId: null } } });
  items.push({ create: { type: 'file', data: { demo: true, kind: 'link', name: 'Lien d’exemple (site fictif)', url: 'https://example.org/', tags: ['démo'], subject: 'Français', level: 'CE2', yearId, folderId: null, favorite: false, versions: [] } } });
  await store.batch(items, 'Chargement des données de démonstration');
  await store.setSettings({ currentYearId: yearId, currentClassId: classId });
}

export async function removeDemo() {
  // Une année de démo qui contient désormais vos propres classes est conservée.
  const keep = new Set(store.all('class', { includeDeleted: true }).filter(c => !c.demo).map(c => c.yearId));
  const yearsToKeep = store.all('year', { includeDeleted: true }).filter(y => y.demo && keep.has(y.id));
  if (yearsToKeep.length) await store.batch(yearsToKeep.map(y => ({ id: y.id, patch: { demo: false } })), 'Année conservée (contient vos classes)');
  // Les inscriptions de vos élèves dans une classe de démo partent avec la classe ; vos élèves restent.
  const demoClasses = new Set(store.all('class', { includeDeleted: true }).filter(c => c.demo).map(c => c.id));
  return store.purgeWhere(r => r.demo === true || (r.type === 'enrollment' && demoClasses.has(r.classId)), 'Suppression des données de démonstration');
}
