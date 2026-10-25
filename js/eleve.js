// Données de suivi d'un élève : documents, autorisations, droit à l'image (par usage),
// observations, niveaux datés, aides, portfolio, échanges, besoins particuliers.
// Les documents et autorisations sont rattachés à une année : jamais reportés d'une année à l'autre.
import * as store from './store.js';
import * as model from './model.js';

export const DEFAULT_DOCS = [
  { id: 'renseignements', label: 'Fiche de renseignements', category: 'document' },
  { id: 'assurance', label: 'Attestation d’assurance scolaire', category: 'document', validity: true },
  { id: 'urgence', label: 'Fiche d’urgence', category: 'document' },
  { id: 'sortie-seul', label: 'Autorisation de sortie seul', category: 'autorisation' },
  { id: 'sorties', label: 'Autorisation pour les sorties scolaires', category: 'autorisation' },
];
export const DEFAULT_IMAGE_USAGES = ['Affichage dans l’école', 'Cahier de vie / journal de classe', 'Site ou ENT de l’école', 'Presse locale', 'Vidéo (spectacle, projet)'];
export const DOC_STATUS = ['à recevoir', 'reçu', 'à compléter'];
export const AUTH_STATUS = ['à renseigner', 'autorisé', 'refusé'];
export const STATUS_KIND = { 'à recevoir': 'warn', reçu: 'ok', 'à compléter': 'warn', 'à renseigner': 'muted', autorisé: 'ok', refusé: 'warn' };

export function docTemplates() {
  const s = store.getSettings();
  const docs = Array.isArray(s.docTemplates) && s.docTemplates.length ? s.docTemplates : DEFAULT_DOCS;
  const usages = Array.isArray(s.imageUsages) && s.imageUsages.length ? s.imageUsages : DEFAULT_IMAGE_USAGES;
  return [...docs, ...usages.map(u => ({ id: `image:${u}`, label: u, category: 'image' }))];
}
export const statusesOf = (t) => (t.category === 'document' ? DOC_STATUS : AUTH_STATUS);
export const defaultStatus = (t) => statusesOf(t)[0];

export function yearOfStudent(studentId, date = model.todayIso()) {
  const e = model.enrollmentsOfStudent(studentId).find(x => model.isActiveOn(x, date)) || model.enrollmentsOfStudent(studentId).at(-1);
  const c = e && store.get(e.classId);
  return c?.yearId || null;
}
export function docOf(studentId, yearId, templateId) {
  return store.all('studentdoc').find(d => d.studentId === studentId && d.yearId === yearId && d.templateId === templateId) || null;
}
/** Enregistre (création ou mise à jour) l'état d'un document pour un élève et une année. */
export async function setDoc(studentId, yearId, template, patch, label, opts = {}) {
  const cur = docOf(studentId, yearId, template.id);
  if (cur) return store.update(cur.id, patch, label || `${template.label}`, opts);
  return store.create('studentdoc', { studentId, yearId, templateId: template.id, label: template.label, category: template.category, status: defaultStatus(template), reminders: [], ...patch }, label || template.label);
}
export function docState(d, t, today = model.todayIso()) {
  const status = d?.status || defaultStatus(t);
  const expired = t.validity && d?.validUntil && d.validUntil < today;
  return { status, expired, kind: expired ? 'warn' : STATUS_KIND[status] };
}

export const OBS_KINDS = ['réussite', 'difficulté', 'comportement', 'remarque'];
export const LEVELS = ['à consolider', 'en cours', 'acquis', 'dépassé'];
export const LEVEL_KIND = { 'à consolider': 'warn', 'en cours': 'info', acquis: 'ok', dépassé: 'ok' };
export const AID_EFFECTS = ['efficace', 'partiellement efficace', 'peu efficace'];
export const NEED_CATEGORIES = ['dys (lecture, écriture, calcul…)', 'handicap', 'attention / concentration', 'langage', 'santé', 'autre'];
export const NEED_SOURCES = ['confirmé par un document', 'observation de l’enseignante'];
export const PLAN_KINDS = ['PPRE', 'PAP', 'PPS', 'PAI', 'AESH'];
export const PLAN_STATUS = ['envisagé', 'en cours', 'terminé'];
export const EXCHANGE_KINDS = ['rendez-vous', 'message (copié)', 'mot dans le cahier', 'téléphone', 'mail', 'échange à la sortie', 'autre'];

export const of = (type, studentId) => store.all(type).filter(r => r.studentId === studentId).sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
export function latestLevels(studentId) {
  const out = {};
  for (const l of of('levelmark', studentId)) if (!out[l.domain]) out[l.domain] = l;
  return out;
}
