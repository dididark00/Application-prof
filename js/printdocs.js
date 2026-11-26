// Documents imprimables (A4) : fiche de séance, séquence, EDT, cahier journal, matériel, devoirs.
import * as store from './store.js';
import * as model from './model.js';
import * as P from './pedago.js';
import * as PL from './planning.js';
import { h } from './ui.js';
import * as EPS from './eps.js';
import { manualRefsText } from './pedago-ui.js';
import { competencyIndex, competencyLabel, competencySource } from './pages/referentiels.js';

const head = (title, sub) => h('header', { class: 'print-head' }, h('h1', {}, title), sub ? h('p', {}, sub) : null);
const h2 = (t) => h('h2', { class: 'print-h2' }, t);

// ───────── Mise en page colorée (d'après les modèles de l'enseignante : fiche de séquence et fiche de préparation « INSPE »)
/** Tableau à 4 colonnes : intitulé | valeur | intitulé | valeur. */
const kv4 = (pairs, { blank = false, skipEmpty = false } = {}) => {
  const shown = pairs.filter(([, v]) => blank || !skipEmpty || (v != null && String(v).trim() !== ''));
  if (!shown.length) return null;
  const rows = []; for (let i = 0; i < shown.length; i += 2) rows.push(shown.slice(i, i + 2));
  return h('table', { class: 'print-table kv4' }, h('tbody', {}, rows.map(r => h('tr', {}, r.flatMap(([k, v]) => [h('th', {}, k), h('td', {}, blank ? '' : (v ?? ''))]),
    r.length < 2 ? [h('th', {}), h('td', {})] : null))));
};
const teacher = () => store.getSettings().userName || '';
const nbStudents = (cls) => model.studentsOfClass(cls.id).length;
const yearLabel = (cls) => store.get(cls.yearId)?.label || '';
const docFoot = (cls, what) => h('p', { class: 'print-footer' }, [cls.name, what, yearLabel(cls)].filter(Boolean).join(' · '));
const lines = (...xs) => xs.filter(x => x && String(x).trim()).join('\n');
const pre = (label, v) => (v && String(v).trim() ? `${label} : ${v}` : '');

/** Une phase → les 6 colonnes du déroulement (durée et modalité, phase, consignes, élèves, enseignant, différenciation et évaluation). */
function phaseCells(ph) {
  const def = P.PHASE_KINDS[ph.kind] || P.PHASE_KINDS.libre;
  return [
    lines(ph.duration ? `${ph.duration} min` : '', ph.modalite),
    h('strong', {}, ph.title || def.label),
    lines(pre('But', ph.but), ph.consigne, pre('Exercices', ph.exercices), pre('Relances', ph.relances), pre('Au tableau', ph.tableau), pre('Trace', ph.trace), pre('Où', ph.traceLieu), pre('Question', ph.question), pre('Suite', ph.suite)),
    lines(ph.eleves, pre('Attendu', ph.reponses)),
    lines(ph.enseignant, pre('Correction', ph.correction), pre('Vérification', ph.verification)),
    lines(ph.differenciation, pre('Critères', ph.criteres), pre('Difficultés', ph.difficultes), pre('Autonomie', ph.autonomie)),
  ];
}

/** Parties de la fiche de séance que l'on peut cocher à l'impression ou à l'export. */
export const FICHE_PARTS = [
  { group: 'Identification', items: [['enseignante', 'Enseignante'], ['classe', 'Classe'], ['dates', 'Date et horaire'], ['duree', 'Durée'], ['domaine', 'Domaine'], ['place', 'Place'], ['sequence', 'Séquence'], ['seance', 'Séance']] },
  { group: 'Cadre pédagogique', items: [['competences', 'Compétences'], ['objectif', 'Objectif'], ['prerequis', 'Prérequis'], ['criteres', 'Critères de réussite'], ['materiel', 'Matériel et supports'], ['cahier', 'Trace et cahier'], ['manuel', 'Manuel'], ['vocabulaire', 'Vocabulaire'], ['photocopies', 'Photocopies'], ['problematique', 'Problématique']] },
  { group: 'Déroulement', items: [['multiniveau', 'Multiniveau'], ['deroulement', 'Déroulement des phases'], ['col-eleves', 'Activité des élèves'], ['col-ens', 'Rôle de l’enseignante'], ['col-diff', 'Différenciation et évaluation']] },
  { group: 'Après la séance', items: [['instit', 'Institutionnalisation, correction et évaluation'], ['bilan', 'Bilan après la séance'], ['checklist', 'Checklist avant visite (mode Visite)']] },
];
export const FICHE_LAYOUTS = [['tableau', 'Tableau (format actuel)'], ['blocs', 'Sans tableau (rubriques à la suite)']];

/** Rubriques à la suite, sans tableau : intitulé en couleur puis le texte. */
const blocks = (pairs, { blank = false, skipEmpty = false, compact = false } = {}) => {
  const shown = pairs.filter(([, v]) => blank || !skipEmpty || (v != null && String(v).trim() !== ''));
  if (!shown.length) return null;
  if (compact && !blank) return h('p', { class: 'fb-meta' }, shown.flatMap(([k, v], i) => [i ? ' · ' : '', h('b', {}, `${k} : `), String(v ?? '').replace(/\n/g, ' ; ')]));
  return h('div', { class: 'fb-list' }, shown.map(([k, v]) => h('div', { class: `fb-item${blank ? ' fb-blank' : ''}` }, h('div', { class: 'fb-label' }, k), h('div', { class: 'fb-val pre' }, blank ? '' : (v ?? '')))));
};

export function printSession(id, { blank = false, show = null, layout = 'tableau' } = {}) {
  const s = store.get(id); const cls = store.get(s.classId);
  const seq = s.sequenceId ? store.get(s.sequenceId) : null;
  const full = blank || s.mode === 'visite';
  const on = (k) => !show || (show instanceof Set ? show.has(k) : show.includes(k));
  const pick = (pairs) => pairs.filter(([k]) => on(k)).map(([, l, v]) => [l, v]);
  const flat = layout === 'blocs';
  const fields = (pairs, opts = {}) => (flat ? blocks : kv4)(pick(pairs), opts);
  const o = { blank, skipEmpty: !full };
  const idx = competencyIndex();
  const comps = [s.competencesText, ...(s.competencyIds || []).map(c => `${competencyLabel(c, idx)} (${competencySource(c, idx)})`)].filter(Boolean).join('\n');
  const occs = P.occurrencesOfSession(s.id).filter(x => x.status !== 'reportée');
  const dates = occs.map(x => `${model.frDate(x.date, { weekday: 'long', day: 'numeric', month: 'long' })}${x.start ? ` · ${x.start.replace(':', ' h ')} à ${(x.end || '').replace(':', ' h ')}` : ''}`).join('\n');
  const levels = (s.levels?.length ? s.levels : cls.levels).join(', ');
  const ident = fields([['enseignante', 'Enseignante', teacher()], ['classe', 'Classe', `${cls.name} — ${nbStudents(cls)} élèves${levels && levels !== cls.name ? ' · ' + levels : ''}`],
    ['dates', 'Date et horaire', dates], ['duree', 'Durée', model.durationLabel(P.sessionDuration(s))],
    ['domaine', 'Domaine', [s.subject, s.subdomain].filter(Boolean).join(' — ')], ['place', 'Place', lines(s.place, s.organisation ? `Organisation : ${s.organisation}` : '')],
    ['sequence', 'Séquence', seq ? P.sequenceTitle(seq) : ''], ['seance', 'Séance', [P.sessionNumber(s) ? `n° ${P.sessionNumber(s)}${s.optional ? ' (si nécessaire)' : ''}` : '', s.title].filter(Boolean).join(' — ')]],
    { blank, skipEmpty: flat, compact: true });
  const cadre = fields([['competences', 'Compétences', comps], ['objectif', 'Objectif', s.objective], ['prerequis', 'Prérequis', s.prerequis], ['criteres', 'Critères de réussite', s.criteres],
    ['materiel', 'Matériel et supports', lines(s.avant, pre('À projeter', s.projeter), pre('À imprimer', s.imprimer), pre('À distribuer', s.distribuer), (s.fileIds || []).map(f => store.get(f)?.name).filter(Boolean).join(', '))],
    ['cahier', 'Trace et cahier', lines(s.cahier, pre('Correction', s.correction))],
    ['manuel', 'Manuel', manualRefsText(s.manualRefs)], ['vocabulaire', 'Vocabulaire', s.vocabulaire],
    ['photocopies', 'Photocopies', (s.copies || []).map(c => `${c.label} (${c.perStudent}/élève + ${c.extra})`).join(' ; ')]], o);
  const sections = [
    h('header', { class: 'print-head print-head-center' }, h('h1', {}, 'Fiche de préparation'), blank ? null : h('p', { class: 'print-sub' }, P.sessionTitle(s))),
    ident,
    cadre || (on('problematique') && s.problematique) ? h2('Cadre pédagogique') : null, cadre,
    on('problematique') && s.problematique ? h('p', { class: 'print-problem' }, h('strong', {}, 'Problématique : '), s.problematique) : null,
  ];
  if (!blank && on('multiniveau') && (s.variants || []).some(v => v.objective || v.consigne || v.support)) {
    sections.push(h2('Multiniveau'), flat
      ? h('div', { class: 'fb-list' }, s.variants.filter(v => v.objective || v.consigne || v.support).map(v => h('div', { class: 'fb-item' }, h('div', { class: 'fb-label' }, v.level), h('div', { class: 'fb-val pre' }, lines(pre('Objectif', v.objective), pre('Consigne', v.consigne), pre('Support', v.support))))))
      : h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, ['Niveau', 'Objectif', 'Consigne', 'Support'].map(t => h('th', {}, t)))),
        h('tbody', {}, s.variants.map(v => h('tr', {}, h('td', {}, v.level), h('td', {}, v.objective || ''), h('td', {}, v.consigne || ''), h('td', {}, v.support || ''))))));
  }
  if (on('deroulement')) {
    const phases = blank ? P.defaultPhases().map(p => ({ ...p, duration: null })) : (s.phases || []);
    // Colonnes : durée, phase, consignes toujours ; élèves, enseignante, différenciation au choix.
    const cols = [[null, 'Durée et modalité', 10], [null, 'Phase', 14], [null, 'Déroulement et consignes', 24], ['col-eleves', 'Activité des élèves', 17], ['col-ens', 'Rôle de l’enseignante', 17], ['col-diff', 'Différenciation et évaluation', 18]];
    const keep = cols.map((c, i) => [c, i]).filter(([c]) => !c[0] || on(c[0]));
    const total = keep.reduce((t, [c]) => t + c[2], 0);
    sections.push(h2(blank ? 'Déroulement de la séance' : `Déroulement de la séance${P.sessionDuration(s) ? ' — ' + model.durationLabel(P.sessionDuration(s)) : ''}`));
    if (flat) {
      sections.push(h('div', { class: 'fb-phases' }, phases.map(ph => {
        const cells = phaseCells(blank ? { kind: ph.kind } : ph);
        const body = keep.slice(2).map(([c, i]) => [c[1], cells[i]]).filter(([, v]) => blank || (v && String(v).trim()));
        return h('div', { class: 'fb-phase' },
          h('div', { class: 'fb-phase-head' }, cells[1], cells[0] ? h('span', { class: 'fb-phase-dur' }, String(cells[0]).replace(/\n/g, ' · ')) : null),
          body.map(([l, v]) => h('div', { class: `fb-sub${blank ? ' fb-blank' : ''}` }, h('span', { class: 'fb-sub-label' }, l), h('div', { class: 'pre' }, blank ? '' : v))));
      })));
    } else {
      sections.push(h('table', { class: 'print-table deroule' },
        h('thead', {}, h('tr', {}, keep.map(([c]) => h('th', { style: { width: `${Math.round(c[2] * 100 / total)}%` } }, c[1])))),
        h('tbody', {}, phases.map(ph => { const cells = phaseCells(blank ? { kind: ph.kind } : ph); return h('tr', {}, keep.map(([, i]) => h('td', {}, cells[i]))); }))));
    }
  }
  const instit = on('instit') ? (flat ? blocks : kv4)([['Trace ou synthèse', s.trace], ['Correction attendue', s.correctionAttendue], ['Évaluation', s.evaluation], ['Prolongement', s.prolongement]], { blank, skipEmpty: flat && !full }) : null;
  if (instit) sections.push(h('div', { class: 'keep' }, h2('Institutionnalisation, correction et évaluation'), instit));
  // Bilan : celui saisi au cahier journal pour chaque date, sinon des lignes à remplir à la main.
  if (on('bilan')) {
    const bilans = blank ? [] : occs.filter(x => x.after && Object.values(x.after).some(Boolean));
    sections.push(h('div', { class: 'keep' }, h2('Bilan après la séance'), bilans.length
      ? bilans.map(x => [bilans.length > 1 ? h('p', { class: 'print-mini' }, model.frDate(x.date, { weekday: 'long', day: 'numeric', month: 'long' })) : null,
        (flat ? blocks : kv4)(P.AFTER_FIELDS.map(f => [f.label, x.after[f.key]]), { skipEmpty: true })])
      : h('div', { class: 'print-lines' }, ['Réussites observées', 'Obstacles rencontrés', 'Élèves à reprendre et remédiation prévue'].map(l => h('p', {}, `${l} : `)))));
  }
  if (full && on('checklist')) {
    sections.push(h('div', { class: 'keep' }, h2('Checklist avant visite / INSPE'), h('ul', { class: 'print-check' }, P.VISIT_CHECKLIST.map(([k, l]) => h('li', {}, `${!blank && s.checklist?.[k] ? '☑' : '☐'} ${l}`)))));
  }
  sections.push(docFoot(cls, 'Fiches de préparation'));
  return h('div', { class: `print-doc fiche${flat ? ' fiche-blocs' : ''}` }, sections);
}

export function printSequence(id, { blank = false } = {}) {
  const s = store.get(id); const cls = store.get(s.classId); const year = store.get(cls.yearId);
  const sessions = P.sessionsOfSequence(id);
  const idx = competencyIndex();
  const o = { blank };
  const per = model.periodsOf(year).find(p => p.id === s.periodId);
  const comps = [s.competencesText, ...(s.competencyIds || []).map(c => competencyLabel(c, idx))].filter(Boolean).join('\n');
  const total = sessions.reduce((t, x) => t + P.sessionDuration(x), 0);
  const out = [
    h('header', { class: 'print-head print-head-center' }, h('h1', {}, 'Fiche de séquence'), blank ? null : h('p', { class: 'print-sub' }, P.sequenceTitle(s)),
      h('p', { class: 'print-meta' }, [cls.name, year?.label, teacher()].filter(Boolean).join(' • '))),
    h2('Identification de la séquence'),
    kv4([['Enseignante', teacher()], ['Classe', `${cls.name} — ${nbStudents(cls)} élèves`],
      ['Période et dates', per ? `${model.periodLabel(year, s.periodId)} — du ${model.frShort(per.start)} au ${model.frShort(per.end)}` : model.periodLabel(year, s.periodId)], ['Durée totale', model.durationLabel(total)],
      ['Discipline', s.subject], ['Domaine', s.subdomain],
      ['N° séquence', s.number ? `S${s.number}` : ''], ['Nombre de séances', sessions.length || ''],
      ['Titre de séquence', s.title], ['Place dans la progression', (s.notionIds || []).map(n => store.get(n)?.title).filter(Boolean).join(' ; ')]], o),
    h2('Cadre pédagogique'),
    kv4([['Compétence(s) officielle(s)', lines(s.attendus, comps)], ['Objectif général', lines(s.objectifGeneral, s.objectifsInter)],
      ['Prérequis', s.prerequis], ['Critères de réussite', s.criteres],
      ['Notions / vocabulaire', s.notionsVocab], ['Problématique', s.problematique],
      ['Matériel / supports', lines(s.supportsEleves, s.supportsEnseignant, s.materiel, s.documents, manualRefsText(s.manualRefs))], ['Traces et cahiers', s.traces],
      ['Différenciation', lines(s.adaptations, pre('Élèves fragiles', s.fragiles), pre('AESH', s.aesh), pre('Approfondissement', s.approfondissement))],
      ['Évaluation prévue', lines(pre('Diagnostique', s.evalDiag), pre('Formative', s.evalFormative), pre('Finale', s.evalFinale))]], o),
  ];
  const rows = blank ? Array.from({ length: 6 }, () => null) : sessions;
  out.push(h2('Déroulement de la séquence'), h('table', { class: 'print-table deroule' },
    h('thead', {}, h('tr', {}, [['Séance', '16%'], ['Date / durée', '14%'], ['Objectif opérationnel', '22%'], ['Déroulement / activité centrale', '30%'], ['Trace / évaluation', '18%']].map(([t, w]) => h('th', { style: { width: w } }, t)))),
    h('tbody', {}, rows.map((x, i) => h('tr', {},
      h('td', {}, h('strong', {}, P.sessionShort(x, i)), x?.title ? ` · ${x.title}` : ''),
      h('td', {}, x ? lines(P.occurrencesOfSession(x.id).filter(o2 => o2.status !== 'reportée').map(o2 => model.frShort(o2.date)).join(', '), model.durationLabel(P.sessionDuration(x))) : ''),
      h('td', {}, x?.objective || ''),
      h('td', {}, x ? (x.phases || []).map(ph => `${P.PHASE_KINDS[ph.kind]?.label || 'Phase'}${ph.duration ? ` (${ph.duration} min)` : ''}${ph.consigne ? ' : ' + ph.consigne : ''}`).join('\n') : ''),
      h('td', {}, x ? lines(x.trace, x.criteres) : ''))))));
  const done = sessions.filter(x => P.occurrencesOfSession(x.id).some(o2 => o2.status === 'faite')).length;
  out.push(h('div', { class: 'keep' }, h2('Institutionnalisation, évaluation et prolongement'),
    kv4([['Trace ou synthèse', s.traceSynthese], ['Correction attendue', s.correctionAttendue],
      ['Évaluation', lines(pre('Diagnostique', s.evalDiag), pre('Formative', s.evalFormative), pre('Finale', s.evalFinale))], ['Prolongement', s.prolongement],
      ['Gestion des besoins', lines(s.adaptations, pre('AESH', s.aesh))], ['Bilan de progression', lines(s.bilanProgression, !blank && sessions.length ? `${done}/${sessions.length} séance(s) faite(s) au cahier journal` : '')]], o)));
  out.push(h('div', { class: 'keep' }, h2('Bilan après la séquence'), kv4(P.sequenceBilan(cls).map(f => [f.label, s[f.key]]), o)));
  out.push(docFoot(cls, 'Fiche de séquence'));
  return h('div', { class: 'print-doc fiche' }, out);
}

export function printTimetable(tt, version, cls) {
  const days = model.classDays(cls);
  const slots = version?.slots || [];
  const times = [...new Set(slots.map(s => s.start))].sort();
  const year = store.get(cls.yearId);
  return h('div', { class: 'print-doc' }, head(`Emploi du temps — ${cls.name}`, `${tt.name || ''} · ${(tt.periodIds || []).map(p => model.periodLabel(year, p)).join(', ')}${version?.from ? ` · en vigueur à partir du ${model.frDate(version.from)}` : ''}`),
    h('table', { class: 'print-table edt-print' },
      h('thead', {}, h('tr', {}, h('th', { style: { width: '9%' } }, 'Heure'), days.map(d => h('th', {}, model.JOURS[d])))),
      h('tbody', {}, times.map(t => h('tr', {}, h('th', {}, t), days.map(d => h('td', {}, slots.filter(s => s.day === d && s.start === t).map(s =>
        h('div', { class: 'edt-cell', style: { borderLeftColor: model.subjectColor(s.subject) } }, h('strong', {}, s.subject || ''), s.label ? ` — ${s.label}` : '', h('div', { class: 'small' }, `${s.start}–${s.end}${s.levels?.length ? ' · ' + s.levels.join(', ') : ''}${s.mode && s.mode !== 'dirigé' ? ' · ' + s.mode : ''}`))))))))));
}

/** Séquence et compétences officielles d'une activité (fiche, séquence et activité du jour réunies). */
function compsOf(e, s) {
  const seq = store.get(e.occ?.sequenceId) || store.get(s?.sequenceId) || store.get(e.session?.sequenceId);
  const ids = [...new Set([...(s?.competencyIds || []), ...(seq?.competencyIds || []), ...(e.occ?.competencyIds || [])])];
  const idx = new Map(); for (const r of store.all('referential')) for (const i of r.items || []) idx.set(i.id, i);
  return { seq, comps: ids.map(id => idx.get(id)).filter(Boolean).map(i => `${i.code ? i.code + ' — ' : ''}${i.label}`), text: s?.competencesText || '' };
}
/** Texte de déroulement libre : « 10 min Recherche : … » → durée et phase en gras. */
function derouleLines(txt) {
  return String(txt).split('\n').filter(l => l.trim()).map(l => {
    const m = l.match(/^\s*((?:\d+\s*(?:min|mn|')\.?\s*)?[^:]{1,40}?)\s*:\s*(.*)$/);
    return h('div', { class: 'cjp-line' }, m ? [h('strong', {}, m[1]), ` : ${m[2]}`] : l);
  });
}
const cjSec = (label, content) => (content == null || content === '' || (Array.isArray(content) && !content.length) ? null : h('div', { class: 'cjp-sec' }, h('div', { class: 'cjp-label' }, label), content));
function entryCard(e, cls, multi) {
  const s = e.status === 'faite' || e.status === 'partielle' ? (e.occ?.snapshot || e.session) : e.session;
  const o = e.occ || {};
  const col = model.subjectColor(e.subject);
  const dur = e.allDay ? 0 : model.minutes(e.end) - model.minutes(e.start);
  const tags = [o.org === 'groupes' ? 'groupes' : '', o.decloisonnement ? 'décloisonnement' : '', o.horsHoraires ? 'hors horaires' : '', o.lieu && o.lieu !== 'Classe' ? o.lieu : '', e.mode && e.mode !== 'dirigé' ? e.mode : '', multi ? (e.levels?.length ? e.levels : cls.levels).join(', ') : ''].filter(Boolean);
  const objective = o.objective || s?.objective;
  const { seq, comps, text: compsText } = compsOf(e, s);
  const phases = (s?.phases || []).filter(ph => ph.title || ph.duration || ph.consigne || ph.but || ph.eleves || ph.exercices || ph.question);
  const roleLines = (t) => String(t || '').replace(/\s*;\s*(?=(?:Élèves|Enseignante?|Différenciation[^:]{0,25}|Matériel|Consigne|Trace|Aide|Critères?)\s*:)/g, '\n').replace(/\s*;\s*$/, '');
  const deroule = o.deroule ? h('div', {}, derouleLines(o.deroule))
    : phases.length ? h('table', { class: 'cjp-phases' }, h('tbody', {}, phases.map(ph => h('tr', {},
      h('td', { class: 'cjp-ph-dur' }, ph.duration ? `${ph.duration} min` : ''),
      h('td', { class: 'cjp-ph-name' }, h('strong', {}, ph.title || P.PHASE_KINDS[ph.kind]?.label || 'Phase'), ph.modalite ? h('div', { class: 'cjp-ph-mod' }, ph.modalite) : null),
      h('td', { class: 'pre' }, [ph.but ? `But : ${ph.but}` : '', roleLines(ph.consigne), ph.exercices ? `Exercices : ${ph.exercices}` : '', ph.question, ph.eleves ? `Élèves : ${ph.eleves}` : '', ph.differenciation ? `Différenciation : ${ph.differenciation}` : ''].filter(Boolean).join('\n')))))) : null;
  const materiel = [o.materiel || s?.avant, s?.projeter ? `À projeter : ${s.projeter}` : '', s?.imprimer ? `À imprimer : ${s.imprimer}` : '', s?.distribuer ? `À distribuer : ${s.distribuer}` : ''].filter(Boolean).join('\n');
  const infos = [cjSec('Compétences', comps.length || compsText ? h('ul', { class: 'cjp-list' }, comps.map(c => h('li', {}, c)), compsText ? h('li', {}, compsText) : null) : null),
    cjSec('Critères de réussite', s?.criteres ? h('div', { class: 'pre' }, s.criteres) : null),
    cjSec('Matériel', materiel ? h('div', { class: 'pre' }, materiel) : null), cjSec('Trace écrite', s?.trace ? h('div', { class: 'pre' }, s.trace) : null)].filter(Boolean);
  const subdomain = o.domain || s?.subdomain;
  return h('section', { class: 'cjp-card', style: { borderLeftColor: col, '--c': col } },
    h('div', { class: 'cjp-top' },
      h('div', { class: 'cjp-title' }, h('span', { class: 'cjp-time' }, e.allDay ? 'Journée' : `${e.start} – ${e.end}`), dur > 0 ? h('span', { class: 'cjp-dur' }, model.durationLabel(dur)) : null,
        h('strong', {}, e.title || e.subject || ''), e.status && e.status !== 'prévue' ? h('span', { class: 'cjp-status' }, e.status) : null),
      h('div', { class: 'cjp-meta' }, e.subject ? h('span', { class: 'cjp-subject' }, e.subject) : null, subdomain ? h('span', {}, subdomain) : null,
        seq ? h('span', {}, h('b', {}, 'Séquence : '), P.sequenceTitle(seq)) : null, tags.length ? h('span', {}, tags.join(' · ')) : null),
      objective ? h('div', { class: 'cjp-obj' }, h('span', { class: 'cjp-obj-label' }, 'Objectif'), h('div', { class: 'pre' }, objective)) : null,
      infos.length ? h('div', { class: `cjp-grid cjp-grid-${Math.min(infos.length, 2)}` }, infos) : null),
    cjSec('Déroulement', deroule),
    cjSec('Notes', o.notes ? h('div', { class: 'pre' }, o.notes) : null), cjSec('Bilan', o.note ? h('div', { class: 'pre' }, o.note) : null));
}
/** Les pauses (récréation, pause méridienne) entre deux activités. */
function breakBar(prev, next) {
  const a = model.minutes(prev.end), b = model.minutes(next.start);
  if (!(b - a >= 10) || prev.allDay || next.allDay) return null;
  const label = a <= 12 * 60 + 30 && b >= 12 * 60 + 30 || b - a >= 60 ? 'Pause méridienne' : 'Récréation';
  return h('div', { class: 'cjp-break' }, h('span', {}, label), ` ${prev.end} - ${next.start}`);
}

export function printDay(cls, date, { hide = new Set() } = {}) {
  const plan = PL.dayPlan(cls, date);
  const multi = (cls.levels || []).length > 1;
  const entries = plan.entries.filter(e => !hide.has(PL.groupOf(e, cls)));
  // Activités au même moment pour des groupes différents : côte à côte.
  const clusters = [];
  for (const e of entries) { const c = clusters.at(-1); if (c && e.start < c.end && PL.otherGroups(cls, [...c.items, e]).length) { c.items.push(e); if (e.end > c.end) c.end = e.end; } else clusters.push({ start: e.start, end: e.end, allDay: e.allDay, items: [e] }); }
  const items = []; clusters.forEach((c, i) => {
    if (i) { const br = breakBar(clusters[i - 1], c); if (br) items.push(br); }
    items.push(c.items.length === 1 ? entryCard(c.items[0], cls, multi) : h('div', { class: 'cjp-par', style: { gridTemplateColumns: `repeat(${c.items.length}, 1fr)` } },
      c.items.map(e => h('div', {}, h('div', { class: 'cjp-group' }, PL.groupOf(e, cls) || cls.name), entryCard(e, cls, multi)))));
  });
  return h('div', { class: 'print-doc cjp' },
    h('header', { class: 'cjp-head' }, h('span', { class: 'cjp-tag' }, 'Cahier-journal'), h('h1', {}, model.frDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())), h('span', { class: 'cjp-class' }, cls.name)),
    plan.school.ok ? null : h('p', { class: 'print-warn' }, plan.school.reason),
    plan.warnings.length ? h('p', { class: 'print-warn' }, plan.warnings.map(w => w.message).join(' ')) : null,
    entries.length ? items : h('p', { class: 'muted' }, 'Aucune activité prévue.'),
    docFoot(cls, `Cahier-journal du ${model.frDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}`));
}

export function printWeek(cls, monday, { hide = new Set() } = {}) {
  const days = model.classDays(cls).map(d => model.addDays(monday, d - 1));
  return h('div', { class: 'print-doc' }, head(`Cahier journal — semaine du ${model.frDate(monday)}`, cls.name),
    h('table', { class: 'print-table week-print' }, h('thead', {}, h('tr', {}, days.map(d => h('th', {}, model.frDate(d, { weekday: 'long', day: 'numeric', month: 'short' }))))),
      h('tbody', {}, h('tr', {}, days.map(d => { const p = PL.dayPlan(cls, d); return h('td', {}, p.school.ok ? p.entries.filter(e => !hide.has(PL.groupOf(e, cls))).map(e => h('div', { class: 'week-item', style: { borderLeftColor: model.subjectColor(e.subject) } }, h('strong', {}, `${e.start} ${e.subject || ''}${PL.groupOf(e, cls) ? ` (${PL.groupOf(e, cls)})` : ''}`), h('div', {}, e.title), e.status !== 'prévue' ? h('div', { class: 'small' }, e.status) : null)) : h('em', {}, p.school.reason)); })))));
}

export function printMaterials(cls, dates, title) {
  const rows = PL.materials(cls, dates);
  return h('div', { class: 'print-doc' }, head(title, cls.name),
    h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, ['Jour', 'Séance', 'À préparer', 'Exemplaires', 'Statut'].map(t => h('th', {}, t)))),
      h('tbody', {}, rows.map(r => h('tr', {}, h('td', {}, model.frDate(r.date, { weekday: 'short', day: 'numeric', month: 'short' })), h('td', {}, `${r.entry.start} ${r.entry.title}`), h('td', {}, r.label), h('td', {}, r.kind === 'copie' ? String(r.count) : ''), h('td', {}, r.status ? `☐ ${r.status}` : '☐'))))));
}

export function printHomework(cls, list) {
  const target = (x) => x.targets?.kind === 'classe' || !x.targets ? 'Classe' : `${x.targets.kind} : ${(x.targets.values || []).map(v => store.get(v) ? `${store.get(v).firstName} ${store.get(v).lastName}` : v).join(', ')}`;
  return h('div', { class: 'print-doc' }, head('Devoirs', cls.name),
    h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, ['Pour le', 'Donné le', 'Discipline', 'Travail', 'Pour qui'].map(t => h('th', {}, t)))),
      h('tbody', {}, list.map(x => h('tr', {}, h('td', {}, model.frDate(x.dueDate, { weekday: 'short', day: 'numeric', month: 'short' })), h('td', {}, model.frShort(x.givenDate)), h('td', {}, x.subject || ''), h('td', {}, h('strong', {}, x.title), x.details ? h('div', { class: 'small pre' }, x.details) : null), h('td', {}, target(x)))))));
}

/** Dossier de la semaine : cahier journal, matériel et photocopies, fiches de séance et schémas EPS. */
export function printWeekDossier(cls, monday) {
  const days = model.classDays(cls).map(d => model.addDays(monday, d - 1));
  const ids = [];
  for (const d of days) for (const e of PL.dayPlan(cls, d).entries) if (e.sessionId && !ids.includes(e.sessionId) && store.get(e.sessionId) && !store.get(e.sessionId).deletedAt) ids.push(e.sessionId);
  const parts = [printWeek(cls, monday), printMaterials(cls, days, `Matériel et photocopies — semaine du ${model.frDate(monday)}`)];
  for (const id of ids) {
    parts.push(printSession(id));
    for (const d of EPS.diagramsOfSession(id)) {
      const notes = [['Consignes', 'consignes'], ['Matériel', 'materiel'], ['Rotations', 'rotations'], ['Points de vigilance', 'vigilance']].filter(([, k]) => d.notes?.[k]);
      parts.push(h('div', { class: 'print-doc eps-print' }, head(`Schéma EPS — ${d.title}`, P.sessionTitle(store.get(id))), EPS.render(d),
        notes.length ? h('div', { class: 'eps-notes' }, notes.map(([l, k]) => h('div', {}, h('strong', {}, l), h('p', { class: 'pre' }, d.notes[k])))) : null));
    }
  }
  return h('div', { class: 'dossier', 'data-sessions': ids.length }, parts.map((p, i) => (i ? h('div', { class: 'page-break' }, p) : p)));
}
