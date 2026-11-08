// Livrets et bilans de période : appréciations modifiables, appuyées sur les résultats
// et observations de la période. Prépare les éléments à reporter dans le LSU
// (export tabulaire) : ce n'est pas un export officiel LSU et ne remplace pas le service.
import * as store from '../store.js';
import * as model from '../model.js';
import * as E from '../eleve.js';
import * as V from '../vie.js';
import * as P from '../pedago.js';
import { competencyIndex, competencyLabel } from './referentiels.js';
import { h, icon, toast, badge, emptyState, download, modal, field } from '../ui.js';
import { pageHeader, subTabs, needClass, avatar } from '../components.js';
import { bound } from '../forms.js';
import { resultsOf, scale, levelKind, inLivret, EVAL_KINDS } from './evaluations.js';
import { toCsv } from '../csv.js';
import { printDocument } from '../print.js';
import { appreciationDialog } from './redaction.js';

let selPeriod = null;
let selRange = null; // { start, end } : dates choisies (semestre, année, ou libres)

/** Plage du livret : une période, ou des dates (semestre, année, libres). `id` sert de clé aux bilans enregistrés. */
function rangeOf(periods) {
  if (selRange) {
    const inside = periods.map((p, i) => [p, i]).filter(([p]) => p.start >= selRange.start && p.end <= selRange.end);
    const label = inside.length > 1 && inside[0][0].start === selRange.start && inside.at(-1)[0].end === selRange.end
      ? (inside.length === periods.length ? 'Année' : `Périodes ${inside[0][1] + 1} à ${inside.at(-1)[1] + 1}`)
      : `Du ${model.frShort(selRange.start)} au ${model.frShort(selRange.end)}`;
    return { id: `dates:${selRange.start}:${selRange.end}`, start: selRange.start, end: selRange.end, label, custom: true };
  }
  return null;
}
function rangeDialog(periods, rerender) {
  const half = Math.ceil(periods.length / 2);
  const quick = [
    periods.length > 1 ? ['Semestre 1', periods[0].start, periods[half - 1].end] : null,
    periods.length > 1 ? ['Semestre 2', periods[half].start, periods.at(-1).end] : null,
    ['Toute l’année', periods[0].start, periods.at(-1).end]].filter(Boolean);
  const from = h('input', { type: 'date', value: selRange?.start || periods[0]?.start, 'data-testid': 'range-from' });
  const to = h('input', { type: 'date', value: selRange?.end || model.todayIso(), 'data-testid': 'range-to' });
  let dlg = null;
  const pick = (a, b) => { selRange = { start: a, end: b }; dlg?.close(); rerender(); };
  dlg = modal({ title: 'Dates du livret', body: h('div', { class: 'stack' },
    h('p', { class: 'muted small' }, 'Le livret reprend toutes les évaluations faites entre ces deux dates (vous pouvez ensuite en retirer ou en ajouter).'),
    h('div', { class: 'row wrap' }, quick.map(([l, a, b]) => h('button', { class: 'btn', type: 'button', 'data-testid': 'range-quick', onclick: () => pick(a, b) }, l))),
    h('div', { class: 'grid-2' }, field('Du', from), field('Au', to))),
    actions: [{ label: 'Annuler' }, { label: 'Utiliser ces dates', primary: true, testid: 'range-go', onClick: () => { if (!from.value || !to.value || from.value > to.value) { toast('Vérifiez les deux dates.'); return false; } selRange = { start: from.value, end: to.value }; rerender(); } }] });
}

// ───── Synthèse par compétence : chaque compétence une seule fois, avec tous ses résultats datés et un niveau retenu.
const compKey = (it) => it.competencyId ? `c:${it.competencyId}` : `l:${(it.label || '').trim().toLowerCase()}`;
/** Niveau proposé : moyenne des résultats, pondérée vers les plus récents (les progrès comptent davantage). */
export function retainedLevel(levels, sc) {
  const keys = sc.map(([k]) => k); const xs = levels.map(l => keys.indexOf(l)).filter(i => i >= 0);
  if (!xs.length) return '';
  let w = 0, t = 0; xs.forEach((x, i) => { const wi = i + 1; w += wi; t += wi * x; });
  return keys[Math.min(keys.length - 1, Math.round(t / w))];
}
export function compSynth(res, sc, rep = null, idx = competencyIndex()) {
  const bySub = {};
  for (const r of res.filter(x => !x.absent && (x.level || x.points != null)).sort((a, b) => (a.ev.date || '').localeCompare(b.ev.date || ''))) {
    const sub = r.ev.subject || 'Autre';
    const key = compKey(r.item);
    const c = idx.get(r.item.competencyId);
    const row = ((bySub[sub] ||= new Map()).get(key)) || { key, label: r.item.competencyId ? competencyLabel(r.item.competencyId, idx) : r.item.label, domain: c?.domain || '', results: [] };
    row.results.push({ date: r.ev.date, level: r.level, points: r.points, max: Number(r.item.maxPoints) || 0, title: r.ev.title });
    bySub[sub].set(key, row);
  }
  for (const m of Object.values(bySub)) for (const row of m.values()) {
    row.proposed = retainedLevel(row.results.map(x => x.level).filter(Boolean), sc);
    row.level = rep?.compLevels?.[row.key] || row.proposed;
    row.forced = !!rep?.compLevels?.[row.key] && rep.compLevels[row.key] !== row.proposed;
  }
  return Object.fromEntries(Object.entries(bySub).map(([k, m]) => [k, [...m.values()]]));
}
const MATERNELLE = ['TPS', 'PS', 'MS', 'GS'];

/** Évaluations qui alimentent le livret d'une période : celles de la période, sauf exclues, plus celles ajoutées. */
export function livretEvals(cls, per) {
  const conf = store.get(cls.id)?.livretEvals?.[per.id] || {};
  const ex = new Set(conf.excluded || []), add = new Set(conf.added || []);
  // Par défaut : les évaluations « dans le livret » de la période (sommatives, contrôle continu) ; cases à cocher pour retirer ou ajouter.
  return P.ofClass('evaluation', cls.id).filter(ev => (ev.date >= per.start && ev.date <= per.end && !ex.has(ev.id) && inLivret(ev)) || add.has(ev.id)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}
async function setLivretEvals(cls, per, patch) {
  const cur = { ...(store.get(cls.id).livretEvals || {}) }; cur[per.id] = { excluded: [], added: [], ...(cur[per.id] || {}), ...patch };
  await store.update(cls.id, { livretEvals: cur }, 'Évaluations du livret');
}
/** Résultats d'un élève limités aux évaluations retenues pour le livret. */
function livretResults(cls, per, sid) {
  const ids = new Set(livretEvals(cls, per).map(e => e.id));
  return resultsOf(sid, cls.id, null, null).filter(r => ids.has(r.ev.id));
}

function reportOf(classId, periodId, studentId) { return store.all('report').find(r => r.classId === classId && r.periodId === periodId && r.studentId === studentId) || null; }
async function saveReport(cls, per, s, patch, label) {
  const cur = reportOf(cls.id, per.id, s.id);
  if (cur) return store.update(cur.id, patch, label, { quiet: true });
  return store.create('report', { classId: cls.id, periodId: per.id, studentId: s.id, subjects: {}, general: '', status: 'brouillon', ...patch }, label);
}

function summary(res) {
  const bySub = {};
  for (const r of res.filter(x => !x.absent)) {
    const k = r.ev.subject || 'Autre';
    bySub[k] ||= { levels: {}, pts: 0, max: 0, items: 0 };
    if (r.level) bySub[k].levels[r.level] = (bySub[k].levels[r.level] || 0) + 1;
    if (r.points != null) { bySub[k].pts += r.points; bySub[k].max += Number(r.item.maxPoints) || 0; }
    bySub[k].items++;
  }
  return bySub;
}
function draft(sub, sm, sc) {
  if (!sm) return '';
  const parts = sc.map(([k, l]) => sm.levels[k] ? `${l.toLowerCase()} : ${sm.levels[k]}` : '').filter(Boolean);
  return `${sub} — ${sm.items} élément(s) évalué(s)${parts.length ? ` (${parts.join(', ')})` : ''}${sm.max ? `, ${sm.pts}/${sm.max} points` : ''}.`;
}

// ───── Notes et niveaux par discipline (proposés d'après les évaluations, modifiables)
const optsOf = (cls) => ({ sur: 20, notes: true, niveaux: true, profil: true, detail: true, dates: true, absences: true, signatures: true, names: '', accord: '', ...(store.get(cls.id)?.livretOptions || {}) });
/** Proposition : note sur « sur » (points des évaluations retenues) et niveau le plus représentatif. */
export function suggestMark(sm, sc, sur = 20) {
  if (!sm) return { note: '', level: '' };
  const note = sm.max ? String(Math.round((sm.pts / sm.max) * sur * 2) / 2).replace('.', ',') : '';
  const keys = sc.map(([k]) => k); const n = keys.reduce((t, k) => t + (sm.levels[k] || 0), 0);
  let level = '';
  if (n) { const mean = keys.reduce((t, k, i) => t + i * (sm.levels[k] || 0), 0) / n; level = keys[Math.min(keys.length - 1, Math.round(mean))]; }
  return { note, level };
}
const markOf = (rep, sub) => rep?.marks?.[sub] || {};

export function render({ rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Livrets et bilans'), subTabs(), missing);
  const mat = (cls.levels || []).every(l => MATERNELLE.includes(l));
  const year = store.get(cls.yearId); const periods = model.periodsOf(year);
  const basePer = periods.find(p => p.id === selPeriod) || model.periodOfDate(year, model.todayIso()) || periods[0];
  if (!basePer) return h('div', { class: 'page' }, pageHeader('Livrets et bilans'), subTabs(), emptyState('Aucune période définie'));
  const custom = rangeOf(periods);
  const pi = custom ? -1 : periods.indexOf(basePer);
  const per = custom || { ...basePer, label: `Période ${pi + 1}` };
  const students = model.studentsOfClass(cls.id, { date: per.end > model.todayIso() ? model.todayIso() : per.end, includeLeft: false });
  const sc = scale();
  const subjects = model.subjects();

  const card = ({ student: s }) => {
    const rep = reportOf(cls.id, per.id, s.id);
    const res = livretResults(cls, per, s.id);
    const sm = summary(res);
    const obs = E.of('observation', s.id).filter(o => o.date >= per.start && o.date <= per.end);
    const abs = V.attendanceOfStudent(s.id).filter(x => x.a.date >= per.start && x.a.date <= per.end && x.m.status === 'absent').length;
    const subs = subjects.filter(x => sm[x] || rep?.subjects?.[x]);
    return h('section', { class: 'card', 'data-testid': 'report-card' },
      h('div', { class: 'card-head' }, h('h2', {}, avatar(s, 32), ` ${s.firstName} ${s.lastName}`),
        h('div', { class: 'row' }, rep?.status === 'finalisé' ? badge('finalisé', 'ok') : badge('brouillon', 'muted'),
          h('button', { class: 'btn btn-small', type: 'button', onclick: () => saveReport(cls, per, s, { status: rep?.status === 'finalisé' ? 'brouillon' : 'finalisé' }, 'Statut du bilan').then(rerender) }, rep?.status === 'finalisé' ? 'Repasser en brouillon' : 'Marquer finalisé'),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Imprimer le bilan de ${s.firstName}`, onclick: () => generateDialog(cls, per, pi, [s], mat) }, icon('print', 16)))),
      h('div', { class: 'grid-2' },
        h('div', {}, h('h3', {}, mat ? 'Observations de réussite' : 'Résultats de la période'),
          !mat && Object.keys(sm).length ? h('ul', { class: 'plain' }, Object.entries(sm).map(([k, v]) => h('li', {}, h('strong', {}, `${k} : `), sc.map(([lv]) => v.levels[lv] ? badge(`${lv} ${v.levels[lv]}`, levelKind(lv)) : null), v.max ? ` ${v.pts}/${v.max} pts` : ''))) : (!mat ? h('p', { class: 'muted small' }, 'Aucun résultat saisi sur la période.') : null),
          obs.length ? h('ul', { class: 'plain small' }, obs.slice(0, 6).map(o => h('li', {}, `${model.frShort(o.date)} · ${o.kind} : ${o.text}`))) : h('p', { class: 'muted small' }, 'Aucune observation sur la période.'),
          h('p', { class: 'muted small' }, `${abs} demi-journée(s) d’absence sur la période.`)),
        h('div', {},
          subs.map(sub => h('div', {}, markRow(cls, per, s, sub, sm[sub], sc, rerender), bound({ label: `${sub}`, value: rep?.subjects?.[sub], compact: true, onSave: (v) => saveReport(cls, per, s, { subjects: { ...(reportOf(cls.id, per.id, s.id)?.subjects || {}), [sub]: v } }, `Appréciation ${sub}`) }),
            sm[sub] && !rep?.subjects?.[sub] ? h('button', { class: 'btn btn-link small', type: 'button', onclick: () => saveReport(cls, per, s, { subjects: { ...(reportOf(cls.id, per.id, s.id)?.subjects || {}), [sub]: draft(sub, sm[sub], sc) } }, `Brouillon ${sub}`).then(rerender) }, 'proposer un brouillon factuel') : null)),
          h('div', { class: 'row' }, h('select', { 'aria-label': 'Ajouter une discipline', onchange: (e) => { if (!e.target.value) return; saveReport(cls, per, s, { subjects: { ...(rep?.subjects || {}), [e.target.value]: rep?.subjects?.[e.target.value] || '' } }, 'Discipline ajoutée').then(rerender); } },
            h('option', { value: '' }, '+ discipline'), subjects.filter(x => !subs.includes(x)).map(x => h('option', { value: x }, x)))),
          bound({ label: mat ? 'Synthèse des acquis' : 'Appréciation générale', value: rep?.general, testid: 'report-general', onSave: (v) => saveReport(cls, per, s, { general: v }, 'Appréciation générale') }),
          h('button', { class: 'btn btn-link small', type: 'button', 'data-testid': 'report-help', onclick: () => appreciationDialog(s, { initial: reportOf(cls.id, per.id, s.id)?.general || '', onUse: (text) => saveReport(cls, per, s, { general: text }, 'Appréciation générale').then(rerender) }) }, 'Aide à la rédaction (phrases-types)'))),
      !mat ? compPanel(cls, per, s, res, sc, rerender) : null);
  };

  return h('div', { class: 'page' },
    pageHeader(mat ? 'Carnets de suivi des apprentissages' : 'Livrets et bilans', { favKey: 'classe/livrets', subtitle: `${cls.name} · ${per.label}`, actions: [
      h('button', { class: 'btn', type: 'button', 'data-testid': 'export-lsu', onclick: () => {
        const rows = students.map(({ student: s }) => { const r = reportOf(cls.id, per.id, s.id); return [s.lastName, s.firstName, ...subjects.map(x => r?.subjects?.[x] || ''), r?.general || '', r?.status || 'brouillon']; });
        download(`bilans-${per.label.replace(/[^\w-]+/g, '_')}-${cls.name.replace(/[^\w-]+/g, '_')}.csv`, toCsv([['Nom', 'Prénom', ...subjects, 'Appréciation générale', 'Statut'], ...rows]), 'text/csv;charset=utf-8');
        toast('Export des appréciations (à reporter dans le LSU)');
      } }, icon('download', 16), 'Exporter les appréciations'),
      h('button', { class: 'btn', type: 'button', 'data-testid': 'livrets-fill-marks', onclick: () => fillMarks(cls, per, students, sc).then(rerender) }, 'Reprendre les notes des évaluations'),
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'livrets-generate', onclick: () => generateDialog(cls, per, pi, students.map(x => x.student), mat) }, icon('print', 16), mat ? 'Générer les carnets de la classe' : 'Générer les livrets de la classe')] }),
    subTabs(),
    h('div', { class: 'row wrap' },
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Période' }, periods.map((p, i) => h('button', { type: 'button', class: !custom && p.id === per.id ? 'on' : '', onclick: () => { selPeriod = p.id; selRange = null; rerender(); } }, `P${i + 1}`)),
        h('button', { type: 'button', class: custom ? 'on' : '', 'data-testid': 'livret-range', onclick: () => rangeDialog(periods, rerender) }, custom ? `${custom.label} ✎` : 'Autres dates…')),
      h('span', { class: 'muted small' }, `Du ${model.frShort(per.start)} au ${model.frShort(per.end)}`)),
    evalPanel(cls, per, rerender, mat),
    mat ? null : classStats(cls, per, students),
    h('p', { class: 'muted small' }, 'Les résultats et observations de la période sont affichés pour vous aider ; les appréciations restent entièrement rédigées et modifiées par vous. L’export est un tableau à reporter dans le LSU : la compatibilité d’un import direct n’a pas été vérifiée et l’application ne remplace pas le service officiel.'),
    students.length ? h('div', { class: 'stack' }, students.map(card)) : emptyState('Aucun élève'));
}

/** Compétences évaluées de l'élève : une ligne par compétence, ses résultats datés, le niveau retenu (modifiable). */
function compPanel(cls, per, s, res, sc, rerender) {
  const rep = reportOf(cls.id, per.id, s.id);
  const syn = compSynth(res, sc, rep);
  const n = Object.values(syn).reduce((t, l) => t + l.length, 0);
  if (!n) return null;
  const setLv = async (key, v) => { const cur = { ...(reportOf(cls.id, per.id, s.id)?.compLevels || {}) }; if (v) cur[key] = v; else delete cur[key]; await saveReport(cls, per, s, { compLevels: cur }, 'Niveau retenu'); rerender(); };
  return h('details', { class: 'comp-panel', 'data-testid': 'comp-panel' }, h('summary', {}, `${n} compétence(s) évaluée(s) — niveaux retenus pour le livret`),
    Object.entries(syn).map(([sub, rows]) => h('div', {}, h('h4', {}, sub), h('ul', { class: 'plain comp-rows' }, rows.map(r => h('li', { 'data-testid': 'comp-row' },
      h('span', { class: 'comp-label' }, r.label),
      h('span', { class: 'comp-hist' }, r.results.map(x => h('span', { class: `chip lvl-${x.level || 'none'}`, title: `${x.title} — ${model.frShort(x.date)}` }, `${model.frShort(x.date)} ${x.level || (x.points != null ? `${x.points}${x.max ? '/' + x.max : ''}` : '')}`))),
      h('select', { 'aria-label': `Niveau retenu : ${r.label}`, 'data-testid': 'comp-level', onchange: (e) => setLv(r.key, e.target.value === r.proposed ? '' : e.target.value) },
        h('option', { value: '' }, r.proposed ? `retenu : ${r.proposed} (proposé)` : '—'), sc.map(([k, l]) => h('option', { value: k, selected: r.forced && r.level === k }, `${k} — ${l}`)))))))),
    h('p', { class: 'muted small' }, 'Niveau proposé : moyenne des résultats, en donnant plus de poids aux plus récents. Choisissez un autre niveau si besoin.'));
}

/** Note et niveau d'une discipline (carte de l'élève). */
function markRow(cls, per, s, sub, smSub, sc, rerender) {
  const o = optsOf(cls); if (!o.notes && !o.niveaux) return null;
  const rep = reportOf(cls.id, per.id, s.id); const m = markOf(rep, sub); const sug = suggestMark(smSub, sc, o.sur);
  const save = (patch) => saveReport(cls, per, s, { marks: { ...(reportOf(cls.id, per.id, s.id)?.marks || {}), [sub]: { ...markOf(reportOf(cls.id, per.id, s.id), sub), ...patch } } }, `Note ${sub}`);
  return h('div', { class: 'row wrap mark-row', 'data-testid': 'mark-row' },
    o.niveaux ? h('select', { 'aria-label': `Niveau en ${sub}`, 'data-testid': 'mark-level', onchange: (e) => save({ level: e.target.value }) },
      h('option', { value: '' }, sug.level ? `Niveau (proposé : ${sug.level})` : 'Niveau'), sc.map(([k, l]) => h('option', { value: k, selected: m.level === k }, `${k} — ${l}`))) : null,
    o.notes ? h('label', { class: 'inline small' }, 'Note', h('input', { class: 'money-input', inputmode: 'decimal', value: m.note || '', placeholder: sug.note || '—', 'aria-label': `Note en ${sub}`, 'data-testid': 'mark-note', onchange: (e) => save({ note: e.target.value.trim() }) }), ` / ${o.sur}`) : null,
    (sug.note && !m.note) || (sug.level && !m.level) ? h('button', { class: 'btn btn-link small', type: 'button', onclick: () => save({ note: m.note || sug.note, level: m.level || sug.level }).then(rerender) }, 'reprendre la proposition') : null);
}
/** Remplit les notes et niveaux vides de toute la classe d'après les évaluations retenues. */
async function fillMarks(cls, per, students, sc) {
  const o = optsOf(cls); let n = 0;
  for (const { student: s } of students) {
    const sm = summary(livretResults(cls, per, s.id)); const rep = reportOf(cls.id, per.id, s.id); const marks = { ...(rep?.marks || {}) }; let changed = false;
    for (const sub of Object.keys(sm)) { const sug = suggestMark(sm[sub], sc, o.sur); const cur = marks[sub] || {}; const next = { ...cur, note: cur.note || sug.note, level: cur.level || sug.level }; if (next.note !== cur.note || next.level !== cur.level) { marks[sub] = next; changed = true; } }
    if (changed) { await saveReport(cls, per, s, { marks, subjects: { ...Object.fromEntries(Object.keys(sm).map(k => [k, ''])), ...(rep?.subjects || {}) } }, 'Notes reprises des évaluations'); n++; }
  }
  toast(n ? `Notes et niveaux proposés pour ${n} élève(s) — modifiables` : 'Rien à reprendre (déjà rempli, ou pas de résultats sur la période).');
}

/** Choix avant de générer : ce qui figure sur le livret remis aux familles. */
// Accords grammaticaux des documents : « L’enseignante », « Les enseignantes », « L’enseignant », « Les enseignants ».
const ACCORDS = [['f1', 'Une enseignante'], ['fn', 'Des enseignantes'], ['m1', 'Un enseignant'], ['mn', 'Des enseignants / une équipe mixte']];
const ACCORD_WORD = { f1: ['L’enseignante', 'Enseignante'], fn: ['Les enseignantes', 'Enseignantes'], m1: ['L’enseignant', 'Enseignant'], mn: ['Les enseignants', 'Enseignants'] };
const defaultNames = (cls) => [store.getSettings().userName, model.hasBinome(cls) ? cls.binome?.name : ''].filter(Boolean).join(' et ');
const defaultAccord = (cls) => (model.hasBinome(cls) && cls.binome?.name ? 'fn' : 'f1');

function generateDialog(cls, per, pi, students, mat) {
  const o = optsOf(cls);
  const box = (k, l) => h('label', { class: 'inline' }, h('input', { type: 'checkbox', name: k, checked: !!o[k], 'data-testid': `gen-${k}` }), l);
  const sur = h('select', { name: 'sur', 'data-testid': 'gen-sur' }, [10, 20, 100].map(v => h('option', { value: v, selected: Number(o.sur) === v }, `/${v}`)));
  const form = h('div', { class: 'form' },
    mat ? null : h('div', { class: 'stack-sm' }, box('niveaux', 'Niveaux d’acquisition par discipline'), h('div', { class: 'row' }, box('notes', 'Notes'), sur), box('profil', 'Profil en étoile et jauge de maîtrise par discipline'), box('detail', 'Tableau des compétences (une ligne par compétence, niveau retenu coché)'), box('dates', 'Dates et résultats de chaque évaluation sous la compétence'), box('absences', 'Absences de la période')),
    h('div', { class: 'grid-2' },
      field('Nom(s) sur les documents', h('input', { name: 'names', value: o.names || defaultNames(cls), 'data-testid': 'gen-names', placeholder: 'ex. Julia T. et Elena E.' })),
      field('Accords', h('select', { name: 'accord', 'data-testid': 'gen-accord' }, ACCORDS.map(([v, l]) => h('option', { value: v, selected: (o.accord || defaultAccord(cls)) === v }, l))))),
    box('signatures', 'Cadre de signatures (enseignante(s), direction, famille)'),
    h('p', { class: 'muted small' }, 'Appréciations et légende de l’échelle figurent toujours. Pour un PDF : « Enregistrer au format PDF » dans la fenêtre d’impression.'));
  modal({ title: mat ? 'Générer les carnets de suivi' : `Générer ${students.length > 1 ? 'les livrets' : 'le livret'} — ${per.label.toLowerCase()}`, body: form,
  actions: [{ label: 'Annuler' }, { label: 'Générer', primary: true, testid: 'gen-go', onClick: async (ev) => {
    const next = { ...o, sur: Number(form.querySelector('[name=sur]')?.value || o.sur), names: form.querySelector('[name=names]').value.trim(), accord: form.querySelector('[name=accord]').value };
    for (const k of ['niveaux', 'notes', 'profil', 'detail', 'dates', 'absences', 'signatures']) { const i = form.querySelector(`[name=${k}]`); if (i) next[k] = i.checked; }
    if (JSON.stringify(next) !== JSON.stringify(o)) await store.update(cls.id, { livretOptions: next }, 'Options du livret', { quiet: true });
    printDocument(h('div', {}, students.map(s => h('div', { class: 'livret-page' }, printReport(cls, per, pi, s, mat, next)))));
    void ev;
  } }] });
}

/** Livret pour la famille : niveaux, notes, compétences, appréciations, absences, signatures (sans observations privées). */
function printReport(cls, per, pi, s, mat, o = optsOf(cls)) {
  const rep = reportOf(cls.id, per.id, s.id);
  const res = livretResults(cls, per, s.id);
  const sm = summary(res);
  const sc = scale(); const label = Object.fromEntries(sc);
  const idx = competencyIndex();
  const year = store.get(cls.yearId);
  const bySub = {};
  for (const r of res.filter(x => !x.absent && x.level || (!x.absent && x.points != null))) (bySub[r.ev.subject || 'Autre'] ||= []).push(r);
  const order = model.subjects();
  const subs = [...new Set([...Object.keys(rep?.subjects || {}), ...Object.keys(rep?.marks || {}), ...(mat ? [] : Object.keys(bySub))])].filter(x => x).sort((a, b) => ((order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)) || a.localeCompare(b));
  const obs = mat ? E.of('observation', s.id).filter(x => x.date >= per.start && x.date <= per.end && x.kind === 'réussite') : [];
  const port = mat ? E.of('portfolio', s.id).filter(p => (p.date || '') >= per.start && (p.date || '') <= per.end) : [];
  const abs = V.attendanceOfStudent(s.id).filter(x => x.a.date >= per.start && x.a.date <= per.end && x.m.status === 'absent').length;
  const teacher = o.names || defaultNames(cls);
  const [W, Wcap] = ACCORD_WORD[o.accord || defaultAccord(cls)] || ACCORD_WORD.f1;
  const notes = subs.map(sub => String(markOf(rep, sub).note || '').trim()).filter(Boolean).map(x => Number(x.replace(',', '.'))).filter(Number.isFinite);
  const syn = mat ? {} : compSynth(res, sc, rep, idx);
  const head = h('header', { class: 'livret-head' },
    h('div', { class: 'livret-school' }, h('strong', {}, cls.school || 'École'), h('div', {}, `Année scolaire ${year?.label || ''}`)),
    h('div', { class: 'livret-title' }, h('h1', {}, mat ? 'Carnet de suivi des apprentissages' : 'Livret scolaire'), h('div', { class: 'print-sub' }, `${per.label} — du ${model.frShort(per.start)} au ${model.frShort(per.end)}`)),
    h('div', { class: 'livret-student' }, h('strong', { class: 'livret-name' }, `${s.firstName} ${s.lastName}`), h('div', {}, `Classe : ${cls.name}`), teacher ? h('div', {}, `${Wcap} : ${teacher}`) : null));
  const legend = !mat && (o.niveaux || o.detail) ? h('p', { class: 'livret-legend' }, h('strong', {}, 'Positionnement : '), sc.map(([k, l]) => `${k} = ${l}`).join(' · ')) : null;
  const subBlock = (sub) => {
    const m = markOf(rep, sub); const rows = syn[sub] || [];
    const domains = [...new Set(rows.map(r => r.domain))];
    const compRow = (r) => h('tr', {},
      h('td', { class: 'livret-comp' }, r.label, o.dates && r.results.length ? h('div', { class: 'livret-ev' }, r.results.map(x => `${model.frShort(x.date)} : ${x.level || ''}${x.points != null && x.max ? ` ${x.points}/${x.max}` : ''}`).join(' · ')) : null),
      sc.map(([k]) => h('td', { class: `livret-pos ${r.level === k ? `on lv-${k}` : ''}` }, r.level === k ? '●' : '')));
    return h('section', { class: 'livret-sub' },
      h('div', { class: 'livret-sub-head' }, h('span', { class: 'livret-sub-name' }, sub),
        o.niveaux && m.level ? h('span', { class: `livret-level lv-${m.level}` }, `${m.level} · ${label[m.level] || ''}`) : null,
        o.notes && m.note ? h('span', { class: 'livret-note' }, `${m.note} / ${o.sur}`) : null),
      o.detail && rows.length ? h('table', { class: 'print-table livret-items' },
        h('thead', {}, h('tr', {}, h('th', { class: 'livret-comp' }, 'Compétences évaluées'), sc.map(([k, l]) => h('th', { class: 'livret-pos', title: l }, h('span', {}, l))))),
        h('tbody', {}, domains.length > 1 || domains[0] ? domains.flatMap(d => [d ? h('tr', { class: 'livret-domain' }, h('td', { colspan: sc.length + 1 }, d)) : null, ...rows.filter(r => r.domain === d).map(compRow)]) : rows.map(compRow))) : null,
      rep?.subjects?.[sub] ? h('div', { class: 'livret-app' }, h('span', { class: 'livret-app-label' }, 'Appréciation'), h('p', { class: 'pre' }, rep.subjects[sub])) : null);
  };
  return h('div', { class: 'print-doc livret' }, head,
    mat ? [
      h('h2', { class: 'print-h2' }, 'Réussites observées'),
      obs.length || port.length ? h('ul', {}, obs.map(x => h('li', {}, `${model.frShort(x.date)} — ${x.text}`)), port.map(p => h('li', {}, `${p.date ? model.frShort(p.date) + ' — ' : ''}${p.title}${(p.competencyIds || []).length ? ` (${p.competencyIds.map(c => idx.get(c)?.label || '').filter(Boolean).join(' ; ')})` : ''}`))) : h('p', { class: 'muted' }, '—'),
      subs.map(sub => rep?.subjects?.[sub] ? h('section', { class: 'livret-sub' }, h('div', { class: 'livret-sub-head' }, h('span', { class: 'livret-sub-name' }, sub)), h('p', { class: 'livret-app pre' }, rep.subjects[sub])) : null)]
    : [legend, o.profil ? profile(syn, sc) : null, subs.length ? subs.map(subBlock) : h('p', { class: 'muted' }, 'Aucun résultat ni appréciation pour cette période.'),
      o.notes && notes.length > 1 ? h('p', { class: 'livret-avg' }, h('strong', {}, 'Moyenne générale indicative : '), `${String(Math.round(notes.reduce((a, b) => a + b, 0) / notes.length * 10) / 10).replace('.', ',')} / ${o.sur}`) : null],
    h('section', { class: 'livret-sub livret-general' }, h('div', { class: 'livret-sub-head' }, h('span', { class: 'livret-sub-name' }, mat ? 'Synthèse des acquis' : 'Appréciation générale')), h('p', { class: 'livret-app pre' }, rep?.general || '')),
    o.absences ? h('p', { class: 'small' }, `Absences sur la période : ${abs} demi-journée(s).`) : null,
    o.signatures === false ? null : h('table', { class: 'print-table livret-sign' }, h('tbody', {}, h('tr', {}, [W, 'La direction', 'Les responsables légaux (vu et pris connaissance)'].map(t => h('td', {}, h('div', { class: 'livret-sign-label' }, t), h('div', { class: 'livret-sign-box' })))))));
}

/** Maîtrise d'un ensemble de compétences : moyenne des niveaux retenus (0 = premier niveau, 1 = dernier). */
export function mastery(rows, sc) {
  const keys = sc.map(([k]) => k); const xs = rows.map(r => keys.indexOf(r.level)).filter(i => i >= 0);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length / Math.max(1, keys.length - 1) : null;
}
const short = (t, n = 18) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
/** Profil de l'élève : étoile par discipline (3 disciplines ou plus), sinon jauges ; une jauge par discipline. */
function profile(syn, sc) {
  const axes = Object.entries(syn).map(([sub, rows]) => ({ sub, v: mastery(rows, sc), n: rows.length })).filter(a => a.v != null);
  if (!axes.length) return null;
  const gauge = (a) => h('div', { class: 'lp-gauge' }, h('span', { class: 'lp-name' }, a.sub), h('span', { class: 'lp-bar' }, h('span', { style: { width: `${Math.round(a.v * 100)}%` } })), h('span', { class: 'lp-pct' }, `${Math.round(a.v * 100)} %`));
  let star = null;
  if (axes.length >= 3) {
    const NS = 'http://www.w3.org/2000/svg'; const S = (t, at) => { const e = document.createElementNS(NS, t); for (const [k, v] of Object.entries(at)) e.setAttribute(k, v); return e; };
    const W = 300, C = W / 2, R = 92; const svg = S('svg', { viewBox: `-50 0 ${W + 100} ${W - 40}`, class: 'lp-star', role: 'img', 'aria-label': `Profil : ${axes.map(a => `${a.sub} ${Math.round(a.v * 100)} %`).join(', ')}` });
    const g = S('g', { transform: `translate(0,-20)` }); svg.append(g);
    const pt = (i, r) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / axes.length; return [C + r * Math.cos(ang), C + r * Math.sin(ang)]; };
    for (const f of [0.25, 0.5, 0.75, 1]) g.append(S('polygon', { points: axes.map((_, i) => pt(i, R * f).join(',')).join(' '), fill: 'none', stroke: '#d9d0f2', 'stroke-width': f === 1 ? 1.2 : 0.7 }));
    axes.forEach((a, i) => { const [x, y] = pt(i, R); g.append(S('line', { x1: C, y1: C, x2: x, y2: y, stroke: '#e3dbfa', 'stroke-width': 0.7 }));
      const [lx, ly] = pt(i, R + 16); const t = S('text', { x: lx, y: ly + 3, 'text-anchor': lx < C - 5 ? 'end' : lx > C + 5 ? 'start' : 'middle', 'font-size': 11, 'font-weight': 600, fill: '#4b3596' }); t.textContent = short(a.sub); g.append(t); });
    g.append(S('polygon', { points: axes.map((a, i) => pt(i, R * Math.max(0.04, a.v)).join(',')).join(' '), fill: 'rgba(106,79,196,.28)', stroke: '#6a4fc4', 'stroke-width': 1.6 }));
    axes.forEach((a, i) => { const [x, y] = pt(i, R * Math.max(0.04, a.v)); g.append(S('circle', { cx: x, cy: y, r: 2.6, fill: '#6a4fc4' })); });
    star = svg;
  }
  return h('section', { class: 'livret-profile', 'data-testid': 'livret-profile' }, star, h('div', { class: 'lp-gauges' }, h('div', { class: 'lp-title' }, 'Maîtrise par discipline'), axes.map(gauge),
    h('p', { class: 'lp-note' }, `Moyenne des niveaux retenus : 0 % = ${sc[0]?.[1] || ''}, 100 % = ${sc.at(-1)?.[1] || ''}.`)));
}

/** Statistiques de la classe sur la plage : répartition des niveaux retenus, maîtrise par élève, profil de la classe. */
function classStats(cls, per, students) {
  const sc = scale(); const keys = sc.map(([k]) => k);
  const per_s = students.map(({ student: s }) => { const syn = compSynth(livretResults(cls, per, s.id), sc, reportOf(cls.id, per.id, s.id)); return { s, syn, rows: Object.values(syn).flat() }; }).filter(x => x.rows.length);
  if (!per_s.length) return null;
  const dist = Object.fromEntries(keys.map(k => [k, 0])); let ne = 0;
  for (const x of per_s) for (const r of x.rows) { if (dist[r.level] != null) dist[r.level]++; else ne++; }
  const total = Object.values(dist).reduce((a, b) => a + b, 0) + ne;
  const subs = [...new Set(per_s.flatMap(x => Object.keys(x.syn)))];
  const classSyn = Object.fromEntries(subs.map(sub => [sub, per_s.flatMap(x => x.syn[sub] || [])]));
  const ranked = per_s.map(x => ({ s: x.s, v: mastery(x.rows, sc) })).filter(x => x.v != null).sort((a, b) => b.v - a.v);
  return h('details', { class: 'card class-stats', 'data-testid': 'class-stats' }, h('summary', {}, h('strong', {}, 'Statistiques de la classe'), h('span', { class: 'muted small' }, ` — ${per_s.length} élève(s) évalué(s), ${total} niveau(x) retenu(s)`)),
    h('div', { class: 'cs-dist', role: 'img', 'aria-label': `Répartition : ${keys.map(k => `${k} ${dist[k]}`).join(', ')}` },
      [...keys.map(k => [k, dist[k]]), ['NE', ne]].filter(([, n]) => n).map(([k, n]) => h('span', { class: `cs-seg lv-${k}`, style: { flexGrow: String(n) }, title: `${k} : ${n}` }, `${k} ${Math.round(n / total * 100)} %`))),
    h('div', { class: 'cs-grid' },
      profile(classSyn, sc),
      h('div', {}, h('div', { class: 'lp-title' }, 'Maîtrise par élève'), h('div', { class: 'cs-students' }, ranked.map(x => h('div', { class: 'lp-gauge' }, h('span', { class: 'lp-name' }, x.s.firstName), h('span', { class: 'lp-bar' }, h('span', { style: { width: `${Math.round(x.v * 100)}%` } })), h('span', { class: 'lp-pct' }, `${Math.round(x.v * 100)} %`)))))),
    h('p', { class: 'muted small' }, 'Calculé sur les niveaux retenus des compétences évaluées de la plage choisie. À usage de l’enseignante : rien de tout cela n’apparaît dans les livrets des familles.'));
}

/** Choix des évaluations reliées au livret de la période. */
function evalPanel(cls, per, rerender, mat) {
  const inPeriod = P.ofClass('evaluation', cls.id).filter(ev => ev.date >= per.start && ev.date <= per.end);
  const conf = store.get(cls.id)?.livretEvals?.[per.id] || {};
  const ex = new Set(conf.excluded || []), add = new Set(conf.added || []);
  const others = P.ofClass('evaluation', cls.id).filter(ev => !(ev.date >= per.start && ev.date <= per.end));
  const kept = livretEvals(cls, per).length;
  return h('details', { class: 'card', 'data-testid': 'livret-evals', open: !inPeriod.length && !add.size ? false : undefined },
    h('summary', {}, h('strong', {}, `Évaluations reliées au ${mat ? 'carnet' : 'livret'} : ${kept}`), h('span', { class: 'muted small' }, ' — cochez celles qui comptent ; les résultats alimentent les bilans et le document généré')),
    inPeriod.length || add.size ? h('ul', { class: 'plain' }, [...inPeriod, ...others.filter(ev => add.has(ev.id))].map(ev => h('li', {}, h('label', { class: 'inline' },
      h('input', { type: 'checkbox', checked: add.has(ev.id) || (!ex.has(ev.id) && inLivret(ev)), 'data-testid': 'livret-eval', onchange: async (e) => {
        const inP = ev.date >= per.start && ev.date <= per.end;
        const nEx = new Set(conf.excluded || []), nAdd = new Set(conf.added || []);
        if (e.target.checked) { nEx.delete(ev.id); if (!inP || !inLivret(ev)) nAdd.add(ev.id); } else { nAdd.delete(ev.id); if (inP) nEx.add(ev.id); }
        await setLivretEvals(cls, per, { excluded: [...nEx], added: [...nAdd] });
      } }), `${ev.title}`, h('span', { class: 'muted small' }, ` · ${ev.subject || ''} · ${model.frShort(ev.date)} · ${(EVAL_KINDS.find(k => k[0] === (ev.kind || 'sommative')) || ['', ''])[1].toLowerCase()} · ${(ev.items || []).length} item(s)`))))) : h('p', { class: 'muted small' }, 'Aucune évaluation sur cette période : créez-les dans Ma classe › Évaluations (une ligne par compétence ou item).'),
    others.filter(ev => !add.has(ev.id)).length ? h('select', { 'aria-label': 'Ajouter une évaluation d’une autre date', 'data-testid': 'livret-eval-add', onchange: async (e) => { if (!e.target.value) return; await setLivretEvals(cls, per, { added: [...add, e.target.value] }); } },
      h('option', { value: '' }, '+ Ajouter une évaluation d’une autre date…'), others.filter(ev => !add.has(ev.id)).map(ev => h('option', { value: ev.id }, `${ev.title} (${model.frShort(ev.date)})`))) : null);
}
