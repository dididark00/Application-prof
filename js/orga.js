// Organisation professionnelle : réunions, 108 h / APC, transmissions, PES, répertoire.
// Règle de comptage unique : les heures « 108 h » sont calculées à partir de leurs sources
// (réunion, séance d'APC, activité saisie) ; une même activité n'est jamais comptée deux fois.
import * as store from './store.js';
import * as model from './model.js';

// ───── Répertoire
export const CONTACT_ROLES = ['direction', 'collègue', 'ATSEM', 'AESH', 'RASED', 'infirmière / médecin scolaire', 'psychologue EN', 'conseiller pédagogique', 'inspection', 'INSPE / formateur', 'tuteur', 'intervenant', 'mairie / périscolaire', 'association', 'autre'];
export const contacts = () => store.all('contact').sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
export const contactName = (id) => store.get(id)?.name || '';

// ───── Réunions et rendez-vous
export const MEETING_KINDS = ['conseil des maîtres', 'conseil de cycle', 'conseil d’école', 'équipe éducative', 'équipe de suivi de scolarisation (ESS)', 'rendez-vous parents', 'animation pédagogique', 'formation', 'réunion de rentrée', 'rendez-vous', 'autre'];
// Catégorie 108 h proposée par défaut selon le type de réunion (modifiable sur chaque réunion).
export const DEFAULT_108 = {
  'conseil des maîtres': 'conseils', 'conseil de cycle': 'conseils', 'rendez-vous parents': 'conseils', 'réunion de rentrée': 'conseils',
  'conseil d’école': 'conseil_ecole', 'animation pédagogique': 'animations', 'formation': 'animations',
  'équipe éducative': 'besoins', 'équipe de suivi de scolarisation (ESS)': 'besoins',
};
export const meetings = () => store.all('meeting').sort((a, b) => (b.date + (b.start || '')).localeCompare(a.date + (a.start || '')));
export const meetingsOn = (d) => store.all('meeting').filter(m => m.date === d);
export const meetingsOfStudent = (id) => meetings().filter(m => (m.studentIds || []).includes(id));
export const tasksOfMeeting = (id) => store.all('task').filter(t => t.meetingId === id);
export function meetingMinutes(m) {
  if (m.start && m.end) return Math.max(0, model.minutes(m.end) - model.minutes(m.start));
  return Number(m.duration) || 0;
}

// ───── 108 heures
// Répartition annuelle d'un service à temps plein : configurable, à vérifier auprès de la circonscription.
export const H108_CATS = [
  ['apc', 'APC (activités pédagogiques complémentaires)'],
  ['besoins', 'Identification des besoins, préparation des APC, projets inter-cycles'],
  ['animations', 'Animations pédagogiques et formation'],
  ['conseils', 'Conseils des maîtres, de cycle, relations avec les parents'],
  ['conseil_ecole', 'Conseils d’école'],
];
export const H108_FULL = { apc: 36, besoins: 24, animations: 18, conseils: 24, conseil_ecole: 6 };
export const H108_SOURCE = 'Répartition indicative d’un temps plein (108 h) ; adapter à la quotité de service et aux consignes de la circonscription (les stagiaires ont souvent un service spécifique).';
export function h108Targets(year) {
  const t = year?.h108?.targets;
  if (t) return t;
  const q = Number(year?.h108?.quotite) || 100;
  return Object.fromEntries(Object.entries(H108_FULL).map(([k, v]) => [k, Math.round(v * q / 100 * 2) / 2]));
}
/**
 * Lignes 108 h d'une année : activités saisies + réunions comptées + séances d'APC réalisées.
 * Chaque ligne garde sa source (kind/id) : rien n'est recopié, donc rien n'est compté deux fois.
 */
export function h108Lines(yearId) {
  const y = store.get(yearId);
  const inYear = (d) => !y || ((!y.start || d >= y.start) && (!y.end || d <= y.end));
  const out = [];
  for (const a of store.all('hours')) if (a.yearId === yearId) out.push({ kind: 'activité', id: a.id, date: a.date, title: a.title, cat: a.cat, planned: Number(a.planned) || 0, done: a.done ? (Number(a.realMinutes) || Number(a.planned) || 0) : 0, status: a.done ? 'réalisé' : 'prévu', href: null, rec: a });
  for (const m of store.all('meeting')) if (m.count108 && inYear(m.date)) {
    const min = meetingMinutes(m);
    const past = m.date <= model.todayIso();
    out.push({ kind: 'réunion', id: m.id, date: m.date, title: m.title, cat: m.cat108 || DEFAULT_108[m.kind] || 'conseils', planned: min, done: past && !m.cancelled ? min : 0, status: m.cancelled ? 'annulé' : past ? 'réalisé' : 'prévu', href: `#/reunions/${m.id}`, rec: m });
  }
  for (const g of store.all('apc')) if (g.yearId === yearId) for (const s of g.sessions || []) {
    out.push({ kind: 'APC', id: `${g.id}:${s.id}`, date: s.date, title: `APC — ${g.title}`, cat: 'apc', planned: Number(s.minutes) || 0, done: s.done ? (Number(s.minutes) || 0) : 0, status: s.done ? 'réalisé' : 'prévu', href: `#/heures?t=apc&g=${g.id}`, rec: g });
  }
  return out.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}
export function h108Totals(lines) {
  const t = Object.fromEntries(H108_CATS.map(([k]) => [k, { planned: 0, done: 0 }]));
  for (const l of lines) { if (l.status === 'annulé') continue; const c = t[l.cat] || (t[l.cat] = { planned: 0, done: 0 }); c.planned += l.planned; c.done += l.done; }
  return t;
}

// ───── Transmissions binôme
export const HANDOVER_KINDS = [['fait', 'Fait'], ['à terminer', 'À terminer'], ['information', 'Information']];
export const handovers = (classId) => store.all('handover').filter(x => x.classId === classId).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));

// ───── PES (professeur stagiaire)
export const PES_KINDS = [['echeance', 'Échéance INSPE / administrative'], ['visite', 'Visite'], ['objectif', 'Objectif de formation']];
export const VISIT_TYPES = ['tuteur·rice terrain', 'formateur·rice INSPE', 'conseiller·e pédagogique', 'inspection', 'autre'];
export const pesItems = (kind) => store.all('pesitem').filter(x => !kind || x.kind === kind).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
