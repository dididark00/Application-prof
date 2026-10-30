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

export function printSession(id, { blank = false } = {}) {
  const s = store.get(id); const cls = store.get(s.classId);
  const seq = s.sequenceId ? store.get(s.sequenceId) : null;
  const full = blank || s.mode === 'visite';
  const o = { blank, skipEmpty: !full };
  const idx = competencyIndex();
  const comps = [s.competencesText, ...(s.competencyIds || []).map(c => `${competencyLabel(c, idx)} (${competencySource(c, idx)})`)].filter(Boolean).join('\n');
  const occs = P.occurrencesOfSession(s.id).filter(x => x.status !== 'reportée');
  const dates = occs.map(x => `${model.frDate(x.date, { weekday: 'long', day: 'numeric', month: 'long' })}${x.start ? ` · ${x.start.replace(':', ' h ')} à ${(x.end || '').replace(':', ' h ')}` : ''}`).join('\n');
  const levels = (s.levels?.length ? s.levels : cls.levels).join(', ');
  const sections = [
    h('header', { class: 'print-head print-head-center' }, h('h1', {}, 'Fiche de préparation'), blank ? null : h('p', { class: 'print-sub' }, P.sessionTitle(s))),
    kv4([['Enseignante', teacher()], ['Classe', `${cls.name} — ${nbStudents(cls)} élèves${levels && levels !== cls.name ? ' · ' + levels : ''}`],
      ['Date et horaire', dates], ['Durée', model.durationLabel(P.sessionDuration(s))],
      ['Domaine', [s.subject, s.subdomain].filter(Boolean).join(' — ')], ['Organisation', s.organisation],
      ['Séquence', seq ? P.sequenceTitle(seq) : ''], ['Séance', [P.sessionNumber(s) ? `n° ${P.sessionNumber(s)}` : '', s.title].filter(Boolean).join(' — ')]], { blank }),
    h2('Cadre pédagogique'),
    kv4([['Compétences', comps], ['Objectif', s.objective], ['Prérequis', s.prerequis], ['Critères de réussite', s.criteres],
      ['Matériel et supports', lines(s.avant, pre('À projeter', s.projeter), pre('À imprimer', s.imprimer), pre('À distribuer', s.distribuer), (s.fileIds || []).map(f => store.get(f)?.name).filter(Boolean).join(', '))],
      ['Trace et cahier', lines(s.trace, pre('Correction', s.correction))],
      ['Manuel', manualRefsText(s.manualRefs)], ['Vocabulaire', s.vocabulaire],
      ['Photocopies', (s.copies || []).map(c => `${c.label} (${c.perStudent}/élève + ${c.extra})`).join(' ; ')]], o),
    s.problematique ? h('p', { class: 'print-problem' }, h('strong', {}, 'Problématique : '), s.problematique) : null,
  ];
  if (!blank && (s.variants || []).some(v => v.objective || v.consigne || v.support)) {
    sections.push(h2('Multiniveau'), h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, ['Niveau', 'Objectif', 'Consigne', 'Support'].map(t => h('th', {}, t)))),
      h('tbody', {}, s.variants.map(v => h('tr', {}, h('td', {}, v.level), h('td', {}, v.objective || ''), h('td', {}, v.consigne || ''), h('td', {}, v.support || ''))))));
  }
  const phases = blank ? P.defaultPhases().map(p => ({ ...p, duration: null })) : (s.phases || []);
  sections.push(h2(blank ? 'Déroulement de la séance' : `Déroulement de la séance${P.sessionDuration(s) ? ' — ' + model.durationLabel(P.sessionDuration(s)) : ''}`),
    h('table', { class: 'print-table deroule' },
      h('thead', {}, h('tr', {}, [['Durée et modalité', '10%'], ['Phase', '14%'], ['Déroulement et consignes', '24%'], ['Activité des élèves', '17%'], ['Rôle de l’enseignant', '17%'], ['Différenciation et évaluation', '18%']].map(([t, w]) => h('th', { style: { width: w } }, t)))),
      h('tbody', {}, phases.map(ph => h('tr', {}, phaseCells(blank ? { kind: ph.kind } : ph).map(c => h('td', {}, c)))))));
  sections.push(h('div', { class: 'keep' }, h2('Après la séance'), kv4(P.AFTER_FIELDS.map(f => [f.label, '']), { blank: true })));
  if (full) {
    sections.push(h('div', { class: 'keep' }, h2('Checklist avant visite / INSPE'), h('ul', { class: 'print-check' }, P.VISIT_CHECKLIST.map(([k, l]) => h('li', {}, `${!blank && s.checklist?.[k] ? '☑' : '☐'} ${l}`)))));
  }
  sections.push(docFoot(cls, 'Fiches de préparation'));
  return h('div', { class: 'print-doc fiche' }, sections);
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
      h('td', {}, h('strong', {}, `S${i + 1}`), x?.title ? ` · ${x.title}` : ''),
      h('td', {}, x ? lines(P.occurrencesOfSession(x.id).filter(o2 => o2.status !== 'reportée').map(o2 => model.frShort(o2.date)).join(', '), model.durationLabel(P.sessionDuration(x))) : ''),
      h('td', {}, x?.objective || ''),
      h('td', {}, x ? (x.phases || []).map(ph => `${P.PHASE_KINDS[ph.kind]?.label || 'Phase'}${ph.duration ? ` (${ph.duration} min)` : ''}${ph.consigne ? ' : ' + ph.consigne : ''}`).join('\n') : ''),
      h('td', {}, x ? lines(x.trace, x.criteres) : ''))))));
  out.push(h('div', { class: 'keep' }, h2('Bilan de séquence'), kv4(P.SEQUENCE_BILAN.map(f => [f.label, s[f.key]]), o)));
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

function compText(e, s) {
  const seq = store.get(e.occ?.sequenceId) || store.get(s?.sequenceId);
  const ids = [...new Set([...(s?.competencyIds || []), ...(seq?.competencyIds || []), ...(e.occ?.competencyIds || [])])];
  const idx = new Map(); for (const r of store.all('referential')) for (const i of r.items || []) idx.set(i.id, i);
  const comps = ids.map(id => idx.get(id)).filter(Boolean).map(i => `${i.code ? i.code + ' ' : ''}${i.label}`);
  return [seq && `Séquence : ${P.sequenceTitle(seq)}`, comps.length && `Compétences : ${comps.join(' ; ')}`].filter(Boolean).join('\n');
}
function entryCard(e, cls, multi) {
  const s = e.status === 'faite' || e.status === 'partielle' ? (e.occ?.snapshot || e.session) : e.session;
  const o = e.occ || {};
  const col = model.subjectColor(e.subject);
  const dur = e.allDay ? 0 : model.minutes(e.end) - model.minutes(e.start);
  const tags = [o.org === 'groupes' ? 'groupes' : '', o.decloisonnement ? 'décloisonnement' : '', o.horsHoraires ? 'hors horaires' : '', o.lieu && o.lieu !== 'Classe' ? o.lieu : '', e.mode && e.mode !== 'dirigé' ? e.mode : '', multi ? (e.levels?.length ? e.levels : cls.levels).join(', ') : ''].filter(Boolean);
  const objective = o.objective || s?.objective;
  const deroule = o.deroule || (s ? (s.phases || []).map(ph => `${P.PHASE_KINDS[ph.kind]?.label || 'Phase'}${ph.duration ? ` (${ph.duration} min)` : ''}${ph.consigne ? ` : ${ph.consigne}` : ''}`).join('\n') : '');
  const block = (label, v) => (v && String(v).trim() ? h('div', { class: 'cj-block' }, h('strong', {}, `${label} : `), h('span', { class: 'pre' }, v)) : null);
  return h('section', { class: 'cj-card', style: { borderLeftColor: col, '--c': col } },
    h('div', { class: 'cj-title' }, h('strong', {}, e.title || e.subject || ''), dur > 0 ? h('span', { class: 'cj-dur' }, model.durationLabel(dur)) : null,
      h('span', { class: 'cj-time' }, e.allDay ? 'journée' : `${e.start} - ${e.end}`), e.status && e.status !== 'prévue' ? h('span', { class: 'cj-status' }, e.status) : null),
    h('div', { class: 'cj-sub' }, [e.subject, o.domain || s?.subdomain].filter(Boolean).join(' · '), tags.length ? ` · ${tags.join(' · ')}` : ''),
    objective ? h('div', { class: 'cj-obj' }, h('span', { class: 'cj-obj-label' }, 'Objectif'), h('div', { class: 'pre' }, objective)) : null,
    deroule ? h('div', { class: 'cj-block' }, h('strong', {}, 'Déroulement :'), h('div', { class: 'pre' }, deroule)) : null,
    block('Matériel', o.materiel || s?.avant), block('Différenciation', s?.differenciation), block('Notes', o.notes), block('Bilan', o.note),
    (() => { const t = compText(e, s); return t ? h('div', { class: 'cj-comp pre' }, t) : null; })());
}
/** Les pauses (récréation, pause méridienne) entre deux activités. */
function breakBar(prev, next) {
  const a = model.minutes(prev.end), b = model.minutes(next.start);
  if (!(b - a >= 10) || prev.allDay || next.allDay) return null;
  const label = a <= 12 * 60 + 30 && b >= 12 * 60 + 30 || b - a >= 60 ? 'Pause méridienne' : 'Récréation';
  return h('div', { class: 'cj-break' }, h('span', {}, label), ` ${prev.end} - ${next.start}`);
}

export function printDay(cls, date) {
  const plan = PL.dayPlan(cls, date);
  const multi = (cls.levels || []).length > 1;
  const entries = plan.entries;
  const items = []; entries.forEach((e, i) => { if (i) { const br = breakBar(entries[i - 1], e); if (br) items.push(br); } items.push(entryCard(e, cls, multi)); });
  return h('div', { class: 'print-doc cj' },
    h('header', { class: 'cj-head' }, h('span', { class: 'cj-tag' }, 'Cahier-journal'), h('h1', {}, model.frDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())), h('span', { class: 'cj-class' }, cls.name)),
    plan.school.ok ? null : h('p', { class: 'print-warn' }, plan.school.reason),
    plan.warnings.length ? h('p', { class: 'print-warn' }, plan.warnings.map(w => w.message).join(' ')) : null,
    entries.length ? items : h('p', { class: 'muted' }, 'Aucune activité prévue.'),
    docFoot(cls, `Cahier-journal du ${model.frDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}`));
}

export function printWeek(cls, monday) {
  const days = model.classDays(cls).map(d => model.addDays(monday, d - 1));
  return h('div', { class: 'print-doc' }, head(`Cahier journal — semaine du ${model.frDate(monday)}`, cls.name),
    h('table', { class: 'print-table week-print' }, h('thead', {}, h('tr', {}, days.map(d => h('th', {}, model.frDate(d, { weekday: 'long', day: 'numeric', month: 'short' }))))),
      h('tbody', {}, h('tr', {}, days.map(d => { const p = PL.dayPlan(cls, d); return h('td', {}, p.school.ok ? p.entries.map(e => h('div', { class: 'week-item', style: { borderLeftColor: model.subjectColor(e.subject) } }, h('strong', {}, `${e.start} ${e.subject || ''}`), h('div', {}, e.title), e.status !== 'prévue' ? h('div', { class: 'small' }, e.status) : null)) : h('em', {}, p.school.reason)); })))));
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
