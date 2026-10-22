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
  let periods = year ? model.periodsOf(year) : preset.periods.map(p => ({ ...p, id: store.uid() }));
  if (!year) {
    items.push({ create: { type: 'year', data: { id: yearId, demo: true, label: preset.label, zone: 'C', source: preset.source, start: preset.start, end: preset.end,
      periods, noSchoolDays: preset.noSchoolDays } } });
  }
  const classId = store.uid();
  items.push({ create: { type: 'class', data: { id: classId, yearId, demo: true, name: 'CE2 (démo)', levels: ['CE2'], school: 'École fictive des Tilleuls', classDays: [1, 2, 4, 5], serviceDays: [1, 2],
    service: { type: 'mi-temps', detail: 'Lundi, mardi (fictif)' }, binome: { name: 'Collègue fictive', detail: 'Jeudi, vendredi' } } } });
  const sids = [];
  ELEVES.forEach(([firstName, lastName], i) => {
    const sid = store.uid(); sids.push(sid);
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
  demoPedago(items, classId, periods);
  demoClassLife(items, classId, yearId, sids);
  demoMultiLevel(items, yearId, periods);
  await store.batch(items, 'Chargement des données de démonstration');
  await store.setSettings({ currentYearId: yearId, currentClassId: classId });
}

const D = (type, data) => ({ create: { type, data: { ...data, demo: true } } });

/** Préparation et planification fictives : EDT, programmation, séquence, séances, journal, intervention, sortie. */
function demoPedago(items, classId, periods) {
  const all = periods.map(p => p.id);
  const slot = (day, start, end, subject, label = '', mode = 'dirigé') => ({ id: store.uid(), day, start, end, subject, label, mode, levels: [] });
  const week = [];
  for (const d of [1, 2, 4, 5]) {
    week.push(slot(d, '08:30', '08:45', 'Français', 'Rituels', 'rituel'), slot(d, '08:45', '09:45', 'Français'), slot(d, '09:45', '10:30', 'Mathématiques'),
      slot(d, '10:45', '11:30', 'Mathématiques', 'Calcul mental et problèmes'), slot(d, '11:30', '12:00', 'Français', 'Lecture'),
      slot(d, '13:30', '14:30', d % 2 ? 'Questionner le monde' : 'Langues vivantes'), slot(d, '14:30', '15:15', d < 3 ? 'Arts plastiques' : 'EMC'), slot(d, '15:30', '16:30', 'EPS'));
  }
  const mathsMon = week.find(x => x.day === 1 && x.start === '09:45');
  const mathsTue = week.find(x => x.day === 2 && x.start === '09:45');
  items.push(D('timetable', { classId, name: 'EDT de référence (exemple)', periodIds: all, versions: [{ from: '', slots: week }] }));

  const progId = store.uid();
  items.push(D('programmation', { id: progId, classId, subject: 'Mathématiques', level: 'CE2', subdomains: ['Nombres', 'Calcul', 'Grandeurs et mesures', 'Espace et géométrie'],
    references: 'Exemple fictif — à remplacer par vos références vérifiées', owner: 'commun' }));
  const notions = [[0, 'Nombres', 'Nombres jusqu\u2019à 1 000 (exemple)'], [1, 'Nombres', 'Nombres jusqu\u2019à 10 000 (exemple)'], [1, 'Calcul', 'Addition posée (exemple)'],
    [2, 'Calcul', 'Soustraction posée (exemple)'], [1, 'Grandeurs et mesures', 'Longueurs (exemple)'], [3, 'Espace et géométrie', 'Symétrie (exemple)']];
  const nIds = notions.map(([pi, sub, title], k) => { const id = store.uid(); items.push(D('notion', { id, programmationId: progId, periodId: periods[pi]?.id, subdomain: sub, title, order: k * 10, competencyIds: [] })); return id; });

  const seqId = store.uid();
  items.push(D('sequence', { id: seqId, classId, number: 2, title: 'Les nombres jusqu\u2019à 10 000 (exemple)', subject: 'Mathématiques', subdomain: 'Nombres', periodId: periods[1]?.id, levels: ['CE2'],
    objectifGeneral: 'Lire, écrire et représenter les nombres jusqu\u2019à 10 000 (exemple).', prerequis: 'Nombres jusqu\u2019à 1 000.', notionIds: [nIds[1]], competencyIds: [], fileIds: [], manualRefs: [], owner: 'moi' }));
  const ph = (kind, duration, extra = {}) => ({ id: store.uid(), kind, title: '', duration, ...extra });
  const s1 = store.uid(), s2 = store.uid(), s3 = store.uid();
  const base = { classId, sequenceId: seqId, subject: 'Mathématiques', subdomain: 'Nombres', levels: ['CE2'], mode: 'quotidien', teacherMode: 'dirigé', competencyIds: [], fileIds: [], manualRefs: [], variants: [], checklist: {} };
  items.push(D('session', { ...base, id: s1, order: 1, title: 'Découvrir le millier (exemple)', objective: 'Comprendre que 10 centaines font 1 millier.', organisation: 'collectif puis binômes',
    criteres: 'Je sais grouper 10 centaines en 1 millier.', trace: 'Exemple de trace écrite.', avant: 'Préparer les plaques et barres (matériel de numération).', copies: [{ id: store.uid(), label: 'Fiche d\u2019entraînement (exemple)', perStudent: 1, extra: 2 }],
    phases: [ph('rappel', 5, { but: 'Réactiver les centaines.', consigne: 'Combien de dizaines dans 300 ? (exemple)' }), ph('recherche', 15, { consigne: 'Comment représenter 1 000 avec le matériel ? (exemple)' }),
      ph('institution', 10, { trace: '10 centaines = 1 millier (exemple)' }), ph('entrainement', 10, { exercices: 'Fiche d\u2019exemple' }), ph('bilan', 5, { question: 'Qu\u2019avons-nous appris ?' })] }));
  items.push(D('session', { ...base, id: s2, order: 2, title: 'Lire et écrire les nombres jusqu\u2019à 10 000 (exemple)', objective: 'Lire et écrire des nombres à 4 chiffres.', copies: [], phases: P_default() }));
  items.push(D('session', { ...base, id: s3, order: 3, title: 'Le zéro intermédiaire (exemple)', objective: 'Écrire des nombres avec des zéros intermédiaires.', copies: [], phases: P_default() }));

  // Cahier journal : séance 1 faite le lundi 2 novembre, séance 2 prévue le mardi 3.
  items.push(D('occurrence', { classId, date: '2026-11-02', start: '09:45', end: '10:30', slotId: mathsMon.id, subject: 'Mathématiques', levels: [], mode: 'dirigé', sessionId: s1, status: 'prévue', note: '' }));
  items.push(D('occurrence', { classId, date: '2026-11-03', start: '09:45', end: '10:30', slotId: mathsTue.id, subject: 'Mathématiques', levels: [], mode: 'dirigé', sessionId: s2, status: 'prévue' }));
  items.push(D('progression', { classId, subject: 'Mathématiques', level: 'CE2', subdomain: '', periodId: periods[1]?.id, programmationId: progId, owner: 'commun', extraColumns: ['Calcul mental'],
    rows: [{ id: store.uid(), week: 1, sequenceId: seqId, title: '', objective: 'Le millier', support: 'Manuel d\u2019exemple p. ?', status: 'En cours', adjustments: '', extra: { 'Calcul mental': 'Tables d\u2019addition (exemple)' }, notionIds: [nIds[1]] }] }));
  // Intervention confirmée à partir du 16 novembre seulement (jeudi 13 h 30).
  items.push(D('intervention', { classId, title: 'Natation (exemple fictif)', status: 'confirmée', contact: 'Intervenant fictif', place: 'Piscine fictive', startDate: '2026-11-16', endDate: '2027-01-29',
    slots: [{ id: store.uid(), day: 4, start: '13:30', end: '14:30' }], levels: [], subject: 'EPS', travelMin: 15, prepMin: null, fileIds: [] }));
  items.push(D('intervention', { classId, title: 'Prévention routière (exemple, dates à fixer)', status: 'à planifier', contact: '', place: '', startDate: '', endDate: '', slots: [], levels: [], fileIds: [] }));
  // Sortie le jeudi 5 novembre au matin : conflit avec les séances prévues.
  items.push(D('event', { date: '2026-11-05', start: '09:00', end: '11:30', title: 'Sortie au musée (exemple fictif)', kind: 'sortie', classId, blocksClass: true, personal: false, levels: [], notes: '' }));
  items.push(D('manual', { title: 'Manuel d\u2019exemple (fictif)', publisher: 'Éditeur fictif', kind: 'manuel', subject: 'Mathématiques', level: 'CE2', pages: [], fileIds: [] }));
  items.push(D('lesson', { classId, subject: 'Mathématiques', number: 1, title: 'Le millier (exemple)', content: '10 centaines = 1 millier.', sessionIds: [s1], fileIds: [], correctionFileIds: [], distributions: [] }));
  items.push(D('homework', { classId, title: 'Relire la leçon n° 1 (exemple)', details: '', givenDate: '2026-11-02', dueDate: '2026-11-03', subject: 'Mathématiques', targets: { kind: 'classe', values: [] }, sessionId: s1, lessonId: null, status: 'préparé', fileIds: [] }));
  items.push(D('task', { title: 'Préparer les plaques de numération (exemple)', due: '2026-11-02', category: 'préparation', done: false }));
}
function P_default() { return [['rappel', 5], ['recherche', null], ['institution', null], ['entrainement', null], ['bilan', 5]].map(([kind, duration]) => ({ id: store.uid(), kind, title: '', duration })); }

/** Vie de classe fictive : appel, services, groupes, liste, évaluation, bibliothèque, responsabilités. */
function demoClassLife(items, classId, yearId, sids) {
  const [lou, nino, jade, malo, ines, sacha] = sids;
  // Appel du lundi 2 novembre matin (validé) : Lou absente de 9 h 30 à 10 h 30, Nino absent.
  // Alba (indice 10) est partie le 16 octobre ; Côme (indice 11) arrive le 2 novembre.
  const marks = Object.fromEntries([...sids.slice(0, 10), sids[11]].map(id => [id, { status: 'présent' }]));
  marks[lou] = { status: 'partiel', from: '09:30', to: '10:30', comment: 'rendez-vous (exemple)' }; marks[nino] = { status: 'absent' };
  items.push(D('attendance', { classId, date: '2026-11-02', half: 'matin', marks, validated: true, validatedAt: '2026-11-02T08:45:00.000Z' }));
  const plans = {}; sids.slice(0, 9).forEach((id, i) => { plans[id] = { Cantine: i % 3 ? [1, 2, 4, 5] : [1, 2, 4], Étude: i % 4 === 0 ? [1, 4] : [] }; });
  items.push(D('serviceplan', { classId, plans }));
  items.push(D('groupset', { classId, name: 'Équipes (exemple)', kind: 'équipes', permanent: true, groups: [
    { id: store.uid(), name: 'Les Hiboux', color: '#2f6f8f', memberIds: [lou, nino, jade], roles: { [lou]: 'secrétaire' }, activity: '', material: '', order: 1 },
    { id: store.uid(), name: 'Les Renards', color: '#d9534f', memberIds: [malo, ines, sacha], roles: {}, activity: '', material: '', order: 2 }] }));
  items.push(D('list', { classId, title: 'Documents de rentrée (exemple)', columns: [{ id: store.uid(), label: 'Attestation d\u2019assurance scolaire', type: 'lien', options: [], link: 'assurance' }, { id: 'c-cahier', label: 'Cahier de liaison signé', type: 'case', options: [], link: null }], values: { [lou]: { 'c-cahier': true } } }));
  items.push(D('evaluation', { classId, title: 'Les nombres jusqu\u2019à 1 000 (exemple)', date: '2026-10-12', subject: 'Mathématiques', sequenceId: null, mode: 'maîtrise', conditions: 'individuel, 30 min',
    items: [{ id: 'i1', label: 'Lire et écrire les nombres', maxPoints: null, competencyId: null }, { id: 'i2', label: 'Comparer et ranger', maxPoints: null, competencyId: null }],
    results: { [lou]: { items: { i1: { level: 'A' }, i2: { level: 'ECA' } } }, [jade]: { items: { i1: { level: 'NA' } } }, [nino]: { absent: true, catchup: 'à rattraper' } }, versions: [] }));
  items.push(D('book', { title: 'Album d\u2019exemple (fictif)', author: 'Auteur fictif', category: 'album', level: 'CE2', ref: 'ALB', sequenceIds: [], copies: [{ id: 'cp1', code: 'ALB-1', state: 'disponible' }, { id: 'cp2', code: 'ALB-2', state: 'disponible' }] }));
  const jobs = [{ id: 'j1', label: 'Distribuer le matériel', count: 1 }, { id: 'j2', label: 'Effacer le tableau', count: 1 }];
  items.push(D('jobs', { classId, jobs, history: [{ from: '2026-11-02', map: { j1: [jade], j2: [malo] } }] }));
  void yearId;
}

/** Petite classe multiniveau fictive : deux activités parallèles et un conflit de présence de l'enseignant. */
function demoMultiLevel(items, yearId, periods) {
  const classId = store.uid();
  items.push(D('class', { id: classId, yearId, name: 'CE1-CE2 (démo)', levels: ['CE1', 'CE2'], school: 'École fictive des Tilleuls', classDays: [1, 2, 4, 5], serviceDays: [],
    service: { type: 'temps plein', detail: '' }, binome: { name: '', detail: '' } }));
  [['Ana', 'Fictive', 'CE1'], ['Léo', 'Inventé', 'CE1'], ['Mia', 'Exemple', 'CE1'], ['Tom', 'Essai', 'CE2'], ['Zoé', 'Modèle', 'CE2'], ['Yanis', 'Démo', 'CE2']].forEach(([f, l, lv], i) => {
    const sid = store.uid();
    items.push(D('student', { id: sid, firstName: f, lastName: l, birthDate: `${lv === 'CE1' ? 2019 : 2018}-0${(i % 9) + 1}-1${i}`, contacts: [] }));
    items.push(D('enrollment', { studentId: sid, classId, level: lv, start: '2026-09-01', end: null }));
  });
  const sl = (day, start, end, subject, levels, mode, label = '') => ({ id: store.uid(), day, start, end, subject, levels, mode, label });
  const slots = [];
  for (const d of [1, 2, 4, 5]) slots.push(
    sl(d, '08:30', '09:00', 'Français', [], 'rituel', 'Rituels'),
    sl(d, '09:00', '10:00', 'Français', ['CE1'], 'dirigé', 'Lecture CE1'),
    sl(d, '09:00', '10:00', 'Français', ['CE2'], 'autonomie', 'Écriture CE2'),
    // Conflit volontaire : deux ateliers dirigés en même temps.
    sl(d, '10:15', '11:00', 'Mathématiques', ['CE1'], 'dirigé', 'Numération CE1'),
    sl(d, '10:15', '11:00', 'Mathématiques', ['CE2'], 'atelier dirigé', 'Calcul CE2'),
    sl(d, '11:00', '11:45', 'Questionner le monde', [], 'dirigé'));
  items.push(D('timetable', { classId, name: 'EDT multiniveau (exemple)', periodIds: periods.map(p => p.id), versions: [{ from: '', slots }] }));
}

export async function removeDemo() {
  // Une année de démo qui contient désormais vos propres classes est conservée.
  const keep = new Set(store.all('class', { includeDeleted: true }).filter(c => !c.demo).map(c => c.yearId));
  const yearsToKeep = store.all('year', { includeDeleted: true }).filter(y => y.demo && keep.has(y.id));
  if (yearsToKeep.length) await store.batch(yearsToKeep.map(y => ({ id: y.id, patch: { demo: false } })), 'Année conservée (contient vos classes)');
  // Les inscriptions de vos élèves dans une classe de démo partent avec la classe ; vos élèves restent.
  const demoClasses = new Set(store.all('class', { includeDeleted: true }).filter(c => c.demo).map(c => c.id));
  const demoProgs = new Set(store.all('programmation', { includeDeleted: true }).filter(p => p.demo || demoClasses.has(p.classId)).map(p => p.id));
  // Tout ce qui a été saisi dans une classe de démonstration part avec elle ; vos propres élèves restent.
  return store.purgeWhere(r => r.demo === true || (r.type !== 'student' && r.classId && demoClasses.has(r.classId)) || (r.type === 'notion' && demoProgs.has(r.programmationId)), 'Suppression des données de démonstration');
}
