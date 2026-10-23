// Tableau « Informations élèves » (comme la double page d'un agenda d'enseignant).
// Chaque colonne lit et écrit à la source : fiche de renseignements et assurance (documents de l'année),
// droit à l'image (usages), cantine et garderie (semaine type), sortie (bus), PPRE/PAP/PPS/PAI (dispositifs).
// Les autres colonnes sont des cases ou du texte rangés :
//  - sur la fiche élève (durables : lunettes, gaucher…),
//  - par année (coopérative…),
//  - dans un enregistrement confidentiel séparé (situation familiale, RASED, suivi extérieur…).
import * as store from './store.js';
import * as E from './eleve.js';
import * as V from './vie.js';
import * as FI from './finance.js';

export const KINDS = {
  doc: 'Document de la fiche (statut)',
  image: 'Droit à l’image (tous les usages)',
  service: 'Service (semaine type)',
  depart: 'Sortie habituelle',
  plan: 'Dispositif (PPRE, PAP, PPS, PAI, AESH)',
  projet: 'Paiement d’un projet',
  case: 'Case à cocher',
  texte: 'Texte',
};

export const DEFAULT_COLUMNS = [
  { key: 'renseignements', label: 'Fiche de renseignements', short: 'Fiche rens.', kind: 'doc', ref: 'renseignements' },
  { key: 'coop', label: 'Coopérative', short: 'Coop.', kind: 'case', yearly: true },
  { key: 'assurance', label: 'Assurance', short: 'Assur.', kind: 'doc', ref: 'assurance' },
  { key: 'image', label: 'Droit à l’image', short: 'Image', kind: 'image' },
  { key: 'cantine', label: 'Cantine', short: 'Cantine', kind: 'service', ref: 'Cantine' },
  { key: 'garderie', label: 'Garderie', short: 'Garderie', kind: 'service', ref: 'Garderie du soir' },
  { key: 'bus', label: 'Bus / transport', short: 'Bus', kind: 'depart', ref: 'transport' },
  { key: 'pai', label: 'PAI', short: 'PAI', kind: 'plan', ref: 'PAI', sensitive: true },
  { key: 'ppre', label: 'PPRE / PAP / PPS', short: 'PPRE/PAP/PPS', kind: 'plan', ref: 'PPRE,PAP,PPS', sensitive: true },
  { key: 'suiviext', label: 'Suivi extérieur', short: 'Suivi ext.', kind: 'texte', sensitive: true },
  { key: 'rased', label: 'RASED', short: 'RASED', kind: 'texte', sensitive: true },
  { key: 'lunettes', label: 'Lunettes', short: 'Lunettes', kind: 'case' },
  { key: 'gaucher', label: 'Gaucher / gauchère', short: 'Gaucher', kind: 'case' },
  { key: 'famille', label: 'Situation familiale', short: 'Sit. fam.', kind: 'texte', sensitive: true },
  { key: 'profession', label: 'Profession des parents', short: 'Prof. parents', kind: 'texte', sensitive: true },
];

export function columns() {
  const c = store.getSettings().infoColumns;
  return Array.isArray(c) && c.length ? c : DEFAULT_COLUMNS.map(x => ({ ...x }));
}
export async function saveColumns(cols) { await store.setSettings({ infoColumns: cols }); }

// ───── Stockage des valeurs libres
export const confOf = (studentId) => store.all('infoconf').find(r => r.studentId === studentId) || null;
export const yearOf = (studentId, yearId) => store.all('studentinfo').find(r => r.studentId === studentId && r.yearId === yearId) || null;

export function freeValue(col, s, yearId) {
  if (col.sensitive) return confOf(s.id)?.values?.[col.key];
  if (col.yearly) return yearOf(s.id, yearId)?.values?.[col.key];
  return s.infos?.[col.key];
}
export async function setFree(col, s, yearId, value) {
  const label = `${col.label} — ${s.firstName}`;
  if (col.sensitive) {
    const cur = confOf(s.id);
    if (cur) return store.update(cur.id, { values: { ...(cur.values || {}), [col.key]: value } }, label, { quiet: true });
    return store.create('infoconf', { studentId: s.id, values: { [col.key]: value }, sensitive: true }, label);
  }
  if (col.yearly) {
    const cur = yearOf(s.id, yearId);
    if (cur) return store.update(cur.id, { values: { ...(cur.values || {}), [col.key]: value } }, label, { quiet: true });
    return store.create('studentinfo', { studentId: s.id, yearId, values: { [col.key]: value } }, label);
  }
  const fresh = store.get(s.id);
  return store.update(s.id, { infos: { ...(fresh?.infos || {}), [col.key]: value } }, label, { quiet: true });
}

/**
 * Valeur affichée d'une cellule : { mark: 'oui'|'non'|'partiel'|'attente'|'', text, title }.
 * 'oui' = coché / reçu / autorisé ; 'attente' = à recevoir, à renseigner ; 'non' = refusé ; 'partiel' = mélange.
 */
export function cell(col, s, cls, today) {
  const yearId = cls.yearId;
  switch (col.kind) {
    case 'doc': {
      const t = E.docTemplates().find(x => x.id === col.ref);
      if (!t) return { mark: '', text: '?', title: 'Document absent de la liste (Réglages)' };
      const st = E.docState(E.docOf(s.id, yearId, t.id), t, today);
      if (st.expired) return { mark: 'non', text: 'expirée', title: `${t.label} : expirée` };
      const m = { reçu: 'oui', autorisé: 'oui', refusé: 'non', 'à compléter': 'partiel' }[st.status] || 'attente';
      return { mark: m, text: st.status, title: `${t.label} : ${st.status}` };
    }
    case 'image': {
      const usages = E.docTemplates().filter(t => t.category === 'image');
      const sts = usages.map(t => E.docState(E.docOf(s.id, yearId, t.id), t, today).status);
      const yes = sts.filter(x => x === 'autorisé').length, no = sts.filter(x => x === 'refusé').length;
      const title = usages.map((t, i) => `${t.label} : ${sts[i]}`).join('\n');
      if (usages.length && yes === usages.length) return { mark: 'oui', text: 'autorisé', title };
      if (usages.length && no === usages.length) return { mark: 'non', text: 'refusé', title };
      if (yes || no) return { mark: 'partiel', text: `${yes}/${usages.length}`, title };
      return { mark: 'attente', text: 'à renseigner', title };
    }
    case 'service': {
      const days = V.planOf(cls.id)?.plans?.[s.id]?.[col.ref] || [];
      return days.length ? { mark: 'oui', text: days.map(d => ['', 'L', 'Ma', 'Me', 'J', 'V', 'S', 'D'][d]).join(' '), title: `${col.ref} : ${days.length} jour(s)` } : { mark: '', text: '', title: `${col.ref} : non inscrit` };
    }
    case 'depart': {
      const mode = s.departure?.mode || '';
      return mode === col.ref ? { mark: 'oui', text: '', title: `Sortie : ${mode}` } : { mark: '', text: '', title: mode ? `Sortie : ${mode}` : 'Sortie habituelle à renseigner' };
    }
    case 'plan': {
      const kinds = String(col.ref || '').split(',').map(x => x.trim()).filter(Boolean);
      const plans = E.of('plan', s.id).filter(p => kinds.includes(p.kind) && p.status !== 'terminé');
      return plans.length ? { mark: 'oui', text: [...new Set(plans.map(p => p.kind))].join(', '), title: plans.map(p => `${p.kind} (${p.status})`).join('\n') } : { mark: '', text: '', title: 'Aucun dispositif en cours' };
    }
    case 'projet': {
      const p = col.ref && store.get(col.ref);
      if (!p || p.deletedAt) return { mark: '', text: '?', title: 'Projet introuvable' };
      const x = FI.studentInProject(p, s.id);
      if (!x.expected) return { mark: '', text: '', title: 'Non concerné' };
      const m = x.paid >= x.expected ? 'oui' : x.paid > 0 ? 'partiel' : 'attente';
      return { mark: m, text: m === 'oui' ? '' : FI.euros(x.paid), title: `${p.title} : versé ${FI.euros(x.paid)} sur ${FI.euros(x.expected)}` };
    }
    case 'case': {
      const v = freeValue(col, s, yearId);
      return { mark: v ? 'oui' : '', text: '', title: v ? 'oui' : 'non' };
    }
    default: {
      const v = freeValue(col, s, yearId) || '';
      return { mark: '', text: v, title: v };
    }
  }
}
export const isEditable = (col) => ['case', 'texte', 'doc', 'depart', 'service'].includes(col.kind);
export const SYMBOL = { oui: '✓', non: '✗', partiel: '◐', attente: '…', '': '' };
