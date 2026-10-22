// Préparation pédagogique : définitions des fiches (d'après les modèles de l’enseignante)
// et règles de liaison entre programmation, progression, séquence, séance et cahier journal.
import * as store from './store.js';
import * as model from './model.js';

// ───────── Phases de séance : chaque type a ses propres rubriques (modèle « Fiche séance »).
const F = (key, label, placeholder = '', type = 'textarea') => ({ key, label, placeholder, type });
const DUREE = F('duration', 'Durée (min)', '', 'number');
const COMMUNS = [
  F('but', 'But'), F('consigne', 'Consigne exacte à donner'), F('modalite', 'Modalité', 'collectif / oral / ardoise…', 'text'),
  F('enseignant', 'Actions de l’enseignant'), F('eleves', 'Activité attendue des élèves'),
  F('reponses', 'Réponses attendues / éléments à faire émerger'), F('difficultes', 'Difficultés anticipées'),
  F('differenciation', 'Différenciation / rôle AESH'),
];
export const PHASE_KINDS = {
  rappel: { label: 'Mise en route / rappel', fields: [DUREE, ...COMMUNS] },
  recherche: { label: 'Recherche / découverte', fields: [DUREE, ...COMMUNS] },
  institution: { label: 'Mise en commun / institutionnalisation', fields: [DUREE, F('but', 'But'), F('relances', 'Questions / relances prévues'),
    F('tableau', 'Ce qu’il faut écrire / afficher au tableau'), F('reponses', 'Réponses attendues'),
    F('trace', 'Trace écrite', 'texte exact ou référence au document'), F('traceLieu', 'Où la trace est-elle collée / copiée ?', 'cahier / partie', 'text'),
    F('differenciation', 'Différenciation')] },
  entrainement: { label: 'Entraînement / application', fields: [DUREE, F('exercices', 'Exercice(s)', 'référence et page vérifiées'), F('consigne', 'Consigne exacte'),
    F('criteres', 'Critères de réussite'), F('correction', 'Correction'), F('differenciation', 'Différenciation', 'quantité, aide, support, manipulation…'),
    F('autonomie', 'Travail d’autonomie si terminé')] },
  bilan: { label: 'Bilan / retour sur l’objectif', fields: [DUREE, F('question', 'Question de bilan', 'Qu’avons-nous appris aujourd’hui ?'),
    F('verification', 'Vérification rapide', 'oral / ardoise / mini-exercice / ticket de sortie'), F('suite', 'Annonce de la suite')] },
  libre: { label: 'Phase libre', fields: [DUREE, ...COMMUNS] },
};
export function defaultPhases() {
  return [['rappel', 5], ['recherche', null], ['institution', null], ['entrainement', null], ['bilan', 5]]
    .map(([kind, duration]) => ({ id: store.uid(), kind, title: '', duration }));
}

// ───────── Rubriques de la fiche de séance (hors phases)
export const SESSION_SECTIONS = [
  { title: 'Objectifs et compétences', fields: [
    F('objective', 'Objectif d’apprentissage de la séance', 'formulé avec un verbe observable'),
    F('competencesText', 'Compétence(s) travaillée(s)'),
    F('criteres', 'Critère(s) de réussite annoncé(s) aux élèves'),
    F('prerequis', 'Prérequis mobilisés'),
    F('vocabulaire', 'Vocabulaire / notion')] },
  { title: 'Préparation matérielle', fields: [
    F('avant', 'À préparer avant la séance'), F('projeter', 'À projeter'), F('imprimer', 'À imprimer'),
    F('distribuer', 'À distribuer / faire coller', 'quoi ? dans quel cahier ?'), F('trace', 'Trace écrite prévue'),
    F('correction', 'Correction', 'collective / individuelle / projetée', 'text')] },
];
export const AFTER_FIELDS = [
  { key: 'atteint', label: 'Objectif atteint ?', type: 'select', options: ['', 'oui', 'partiellement', 'non'] },
  F('aReprendre', 'Élèves à reprendre'), F('erreurs', 'Erreur(s) fréquente(s) repérée(s)'),
  F('remediation', 'Remédiation prévue'), F('modifReuse', 'Modification avant réutilisation'),
];
export const VISIT_CHECKLIST = [
  ['objectif', 'Objectif clair et observable'], ['lien', 'Lien avec la programmation / progression'], ['consignes', 'Consignes écrites à l’avance'],
  ['materiel', 'Matériel prêt'], ['differenciation', 'Différenciation réellement prévue'], ['aesh', 'Rôle éventuel de l’AESH explicité'],
  ['criteres', 'Critères de réussite identifiés'], ['trace', 'Trace écrite prête'], ['correction', 'Correction anticipée'], ['suite', 'Bilan et suite prévus'],
];

// ───────── Rubriques de la fiche de séquence (modèle « Fiche de séquence »)
export const SEQUENCE_SECTIONS = [
  { title: 'Informations générales', fields: [F('prerequis', 'Prérequis')] },
  { title: 'Références et objectifs', fields: [
    F('attendus', 'Attendus de fin de cycle / repères'), F('competencesText', 'Compétences travaillées'),
    F('objectifGeneral', 'Objectif général de la séquence'), F('objectifsInter', 'Objectifs intermédiaires'),
    F('notionsVocab', 'Notions / vocabulaire à acquérir')] },
  { title: 'Matériel et supports', fields: [
    F('supportsEleves', 'Supports élèves', 'manuel, fiche, cahier, ardoise…'), F('supportsEnseignant', 'Supports enseignant', 'diaporama, affichage, correction…'),
    F('materiel', 'Matériel'), F('documents', 'Documents à projeter / imprimer')] },
  { title: 'Différenciation et besoins particuliers', fields: [
    F('adaptations', 'Adaptations prévues', 'lecture facilitée, consignes reformulées, quantité réduite, police adaptée, manipulation…'),
    F('aesh', 'Rôle de l’AESH si nécessaire'), F('fragiles', 'Étayer les élèves fragiles'),
    F('approfondissement', 'Approfondissement / autonomie pour les élèves rapides')] },
  { title: 'Évaluation', fields: [
    F('evalDiag', 'Évaluation diagnostique éventuelle'), F('evalFormative', 'Évaluation formative au fil de la séquence'),
    F('criteres', 'Critères de réussite'), F('evalFinale', 'Évaluation finale / production attendue')] },
];
export const SEQUENCE_BILAN = [F('acquis', 'Ce qui a été acquis'), F('difficultes', 'Difficultés rencontrées'), F('remediations', 'Remédiations prévues'), F('aReprendre', 'À reprendre / réinvestir plus tard')];

// ───────── Progression de période (modèle « Progression période »)
export const PROG_STATUSES = ['À venir', 'En cours', 'Réalisé', 'À reprendre', 'Reporté'];
export const PROG_STATUS_KIND = { 'À venir': 'muted', 'En cours': 'info', 'Réalisé': 'ok', 'À reprendre': 'warn', 'Reporté': 'warn' };
export const PROGRESSION_BILAN = [F('acquis', 'Acquis / réussites'), F('difficultes', 'Difficultés / remédiations'), F('decalees', 'Séances décalées'), F('consequences', 'Conséquences pour la période suivante')];

// ───────── Requêtes
export const ofClass = (type, classId) => store.all(type).filter(r => r.classId === classId);
export function sessionsOfSequence(seqId) {
  return store.all('session').filter(s => s.sequenceId === seqId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
export function sessionNumber(s) {
  if (!s?.sequenceId) return null;
  return sessionsOfSequence(s.sequenceId).findIndex(x => x.id === s.id) + 1;
}
export function sessionDuration(s) {
  const sum = (s.phases || []).reduce((t, p) => t + (Number(p.duration) || 0), 0);
  return Number(s.duration) || sum || 0;
}
export function occurrencesOfSession(sessionId) {
  return store.all('occurrence').filter(o => o.sessionId === sessionId).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}
export function notionsOf(programmationId) {
  return store.all('notion').filter(n => n.programmationId === programmationId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
export function sequenceTitle(seq) { return seq ? `${seq.number ? `Séq. ${seq.number} — ` : ''}${seq.title || 'Sans titre'}` : ''; }
export function sessionTitle(s) {
  if (!s) return '';
  const seq = s.sequenceId ? store.get(s.sequenceId) : null;
  const n = sessionNumber(s);
  return `${seq && n ? `S${n} · ` : ''}${s.title || 'Séance sans titre'}`;
}

/** Avancement d'une séance d'après le cahier journal (aucune mise à jour silencieuse : c'est une indication). */
export function journalProgress(sessionIds) {
  const occ = store.all('occurrence').filter(o => sessionIds.includes(o.sessionId));
  const done = new Set(occ.filter(o => o.status === 'faite').map(o => o.sessionId));
  const partial = new Set(occ.filter(o => o.status === 'partielle').map(o => o.sessionId));
  const planned = new Set(occ.filter(o => o.status === 'prévue').map(o => o.sessionId));
  return { total: sessionIds.length, done: done.size, partial: [...partial].filter(id => !done.has(id)).length, planned: planned.size };
}
export function suggestedStatus(row) {
  const ids = row.sessionId ? [row.sessionId] : row.sequenceId ? sessionsOfSequence(row.sequenceId).map(s => s.id) : [];
  if (!ids.length) return null;
  const p = journalProgress(ids);
  let status = 'À venir';
  if (p.done === p.total) status = 'Réalisé';
  else if (p.partial) status = 'À reprendre';
  else if (p.done) status = 'En cours';
  return { ...p, status };
}

/** Statut d'une notion de programmation, déduit des progressions (jamais saisi deux fois). */
export function notionStatus(notion) {
  const rows = store.all('progression').flatMap(p => p.rows || []).filter(r =>
    (r.notionIds || []).includes(notion.id) || (r.sequenceId && (store.get(r.sequenceId)?.notionIds || []).includes(notion.id)));
  if (!rows.length) return 'prévue';
  if (rows.some(r => r.status === 'À reprendre')) return 'à reprendre';
  if (rows.every(r => r.status === 'Réalisé')) return 'terminée';
  if (rows.some(r => r.status === 'Réalisé' || r.status === 'En cours')) return 'commencée';
  return 'prévue';
}
export const NOTION_KIND = { prévue: 'muted', commencée: 'info', terminée: 'ok', 'à reprendre': 'warn' };

// ───────── Lier / dupliquer
/** Copie indépendante d'une séance : modifier la copie n'altère pas l'original. */
export async function duplicateSession(id, { sequenceId } = {}) {
  const s = store.get(id);
  const copy = structuredClone(s);
  for (const k of ['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'deletedAt', 'deletedBy', 'demo']) delete copy[k];
  copy.phases = (copy.phases || []).map(p => ({ ...p, id: store.uid() }));
  copy.copiedFrom = id;
  copy.title = `${s.title || 'Séance'} (copie)`;
  if (sequenceId !== undefined) copy.sequenceId = sequenceId;
  copy.order = (sessionsOfSequence(copy.sequenceId).at(-1)?.order ?? 0) + 1;
  return store.create('session', copy, `Duplication de la séance ${s.title || ''}`);
}

export async function duplicateSequence(id) {
  const s = store.get(id);
  const newId = store.uid();
  const strip = (r) => { const c = structuredClone(r); for (const k of ['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'deletedAt', 'deletedBy', 'demo']) delete c[k]; return c; };
  const items = [{ create: { type: 'sequence', data: { ...strip(s), id: newId, title: `${s.title} (copie)`, copiedFrom: id } } }];
  for (const se of sessionsOfSequence(id)) items.push({ create: { type: 'session', data: { ...strip(se), sequenceId: newId, copiedFrom: se.id, phases: (se.phases || []).map(p => ({ ...p, id: store.uid() })) } } });
  await store.batch(items, `Duplication de la séquence ${s.title}`);
  return newId;
}

/** Instantané de ce qui a été réellement fait : une modification future de la fiche ne réécrit pas le passé. */
export function snapshotOf(session) {
  if (!session) return null;
  const keep = ['title', 'subject', 'subdomain', 'objective', 'competencesText', 'criteres', 'trace', 'phases', 'fileIds', 'manualRefs', 'updatedAt'];
  const snap = {};
  for (const k of keep) if (session[k] !== undefined) snap[k] = structuredClone(session[k]);
  snap.number = sessionNumber(session);
  snap.sequenceTitle = session.sequenceId ? sequenceTitle(store.get(session.sequenceId)) : '';
  return snap;
}

// ───────── Reprise d'une année précédente
/**
 * Copie les modèles d'une classe vers une autre (nouvelle année) : programmations + notions,
 * séquences + séances, leçons (sans distributions), EDT de référence. Ne copie JAMAIS le cahier
 * journal, les devoirs donnés, les résultats, les paiements ou les autorisations.
 */
export async function copyFromClass(srcClassId, dstClassId, what) {
  const src = store.get(srcClassId), dst = store.get(dstClassId);
  const srcPeriods = model.periodsOf(store.get(src.yearId)), dstPeriods = model.periodsOf(store.get(dst.yearId));
  const mapPeriod = (pid) => { const i = srcPeriods.findIndex(p => p.id === pid); return i >= 0 && dstPeriods[i] ? dstPeriods[i].id : null; };
  const strip = (r) => { const c = structuredClone(r); for (const k of ['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'deletedAt', 'deletedBy', 'demo']) delete c[k]; return c; };
  const items = [];
  const idMap = {};
  const nid = (old) => (idMap[old] ||= store.uid());
  if (what.programmations) {
    for (const p of ofClass('programmation', srcClassId)) {
      items.push({ create: { type: 'programmation', data: { ...strip(p), id: nid(p.id), classId: dstClassId, copiedFrom: p.id, validated: null, bilan: '' } } });
      for (const n of notionsOf(p.id)) items.push({ create: { type: 'notion', data: { ...strip(n), id: nid(n.id), programmationId: nid(p.id), periodId: mapPeriod(n.periodId), copiedFrom: n.id } } });
    }
  }
  if (what.sequences) {
    for (const s of ofClass('sequence', srcClassId)) {
      items.push({ create: { type: 'sequence', data: { ...strip(s), id: nid(s.id), classId: dstClassId, periodId: mapPeriod(s.periodId), copiedFrom: s.id,
        notionIds: (s.notionIds || []).map(x => idMap[x]).filter(Boolean), acquis: '', difficultes: '', remediations: '', aReprendre: '' } } });
    }
    for (const se of ofClass('session', srcClassId)) {
      items.push({ create: { type: 'session', data: { ...strip(se), id: nid(se.id), classId: dstClassId, sequenceId: se.sequenceId ? nid(se.sequenceId) : null, copiedFrom: se.id,
        phases: (se.phases || []).map(p => ({ ...p, id: store.uid() })), checklist: {} } } });
    }
  }
  if (what.lecons) {
    for (const l of ofClass('lesson', srcClassId)) {
      items.push({ create: { type: 'lesson', data: { ...strip(l), id: nid(l.id), classId: dstClassId, copiedFrom: l.id, distributions: [],
        sessionIds: (l.sessionIds || []).map(x => idMap[x]).filter(Boolean) } } });
    }
  }
  if (what.edt) {
    for (const t of ofClass('timetable', srcClassId)) {
      const last = (t.versions || []).at(-1);
      items.push({ create: { type: 'timetable', data: { classId: dstClassId, name: t.name, periodIds: (t.periodIds || []).map(mapPeriod).filter(Boolean), copiedFrom: t.id,
        versions: [{ from: '', slots: structuredClone(last?.slots || []).map(s => ({ ...s, id: store.uid() })) }] } } });
    }
  }
  if (!items.length) return 0;
  await store.batch(items, `Reprise des modèles de ${src.name} vers ${dst.name}`);
  return items.length;
}
