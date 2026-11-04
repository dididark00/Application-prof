// Livrets et bilans de période : appréciations modifiables, appuyées sur les résultats
// et observations de la période. Prépare les éléments à reporter dans le LSU
// (export tabulaire) : ce n'est pas un export officiel LSU et ne remplace pas le service.
import * as store from '../store.js';
import * as model from '../model.js';
import * as E from '../eleve.js';
import * as V from '../vie.js';
import * as P from '../pedago.js';
import { competencyIndex, competencyLabel } from './referentiels.js';
import { h, icon, toast, badge, emptyState, download, modal } from '../ui.js';
import { pageHeader, subTabs, needClass, avatar } from '../components.js';
import { bound } from '../forms.js';
import { resultsOf, scale, levelKind } from './evaluations.js';
import { toCsv } from '../csv.js';
import { printDocument } from '../print.js';
import { appreciationDialog } from './redaction.js';

let selPeriod = null;
const MATERNELLE = ['TPS', 'PS', 'MS', 'GS'];

/** Évaluations qui alimentent le livret d'une période : celles de la période, sauf exclues, plus celles ajoutées. */
export function livretEvals(cls, per) {
  const conf = store.get(cls.id)?.livretEvals?.[per.id] || {};
  const ex = new Set(conf.excluded || []), add = new Set(conf.added || []);
  return P.ofClass('evaluation', cls.id).filter(ev => (ev.date >= per.start && ev.date <= per.end && !ex.has(ev.id)) || add.has(ev.id)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
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
const optsOf = (cls) => ({ sur: 20, notes: true, niveaux: true, detail: true, absences: true, ...(store.get(cls.id)?.livretOptions || {}) });
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
  const per = periods.find(p => p.id === selPeriod) || model.periodOfDate(year, model.todayIso()) || periods[0];
  if (!per) return h('div', { class: 'page' }, pageHeader('Livrets et bilans'), subTabs(), emptyState('Aucune période définie'));
  const pi = periods.indexOf(per);
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
          h('button', { class: 'btn btn-link small', type: 'button', 'data-testid': 'report-help', onclick: () => appreciationDialog(s, { initial: reportOf(cls.id, per.id, s.id)?.general || '', onUse: (text) => saveReport(cls, per, s, { general: text }, 'Appréciation générale').then(rerender) }) }, 'Aide à la rédaction (phrases-types)'))));
  };

  return h('div', { class: 'page' },
    pageHeader(mat ? 'Carnets de suivi des apprentissages' : 'Livrets et bilans', { favKey: 'classe/livrets', subtitle: `${cls.name} · P${pi + 1}`, actions: [
      h('button', { class: 'btn', type: 'button', 'data-testid': 'export-lsu', onclick: () => {
        const rows = students.map(({ student: s }) => { const r = reportOf(cls.id, per.id, s.id); return [s.lastName, s.firstName, ...subjects.map(x => r?.subjects?.[x] || ''), r?.general || '', r?.status || 'brouillon']; });
        download(`bilans-P${pi + 1}-${cls.name.replace(/[^\w-]+/g, '_')}.csv`, toCsv([['Nom', 'Prénom', ...subjects, 'Appréciation générale', 'Statut'], ...rows]), 'text/csv;charset=utf-8');
        toast('Export des appréciations (à reporter dans le LSU)');
      } }, icon('download', 16), 'Exporter les appréciations'),
      h('button', { class: 'btn', type: 'button', 'data-testid': 'livrets-fill-marks', onclick: () => fillMarks(cls, per, students, sc).then(rerender) }, 'Reprendre les notes des évaluations'),
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'livrets-generate', onclick: () => generateDialog(cls, per, pi, students.map(x => x.student), mat) }, icon('print', 16), mat ? 'Générer les carnets de la classe' : 'Générer les livrets de la classe')] }),
    subTabs(),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Période' }, periods.map((p, i) => h('button', { type: 'button', class: p.id === per.id ? 'on' : '', onclick: () => { selPeriod = p.id; rerender(); } }, `P${i + 1}`))),
    evalPanel(cls, per, rerender, mat),
    h('p', { class: 'muted small' }, 'Les résultats et observations de la période sont affichés pour vous aider ; les appréciations restent entièrement rédigées et modifiées par vous. L’export est un tableau à reporter dans le LSU : la compatibilité d’un import direct n’a pas été vérifiée et l’application ne remplace pas le service officiel.'),
    students.length ? h('div', { class: 'stack' }, students.map(card)) : emptyState('Aucun élève'));
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
function generateDialog(cls, per, pi, students, mat) {
  const o = optsOf(cls);
  const box = (k, l) => h('label', { class: 'inline' }, h('input', { type: 'checkbox', name: k, checked: !!o[k], 'data-testid': `gen-${k}` }), l);
  const sur = h('select', { name: 'sur', 'data-testid': 'gen-sur' }, [10, 20, 100].map(v => h('option', { value: v, selected: Number(o.sur) === v }, `/${v}`)));
  const form = h('div', { class: 'form' },
    mat ? null : h('div', { class: 'stack-sm' }, box('niveaux', 'Niveaux d’acquisition par discipline'), h('div', { class: 'row' }, box('notes', 'Notes'), sur), box('detail', 'Détail des compétences évaluées'), box('absences', 'Absences de la période')),
    h('p', { class: 'muted small' }, 'Appréciations, légende de l’échelle et cadre de signatures (enseignante, direction, famille) figurent toujours. Pour un PDF : « Enregistrer au format PDF » dans la fenêtre d’impression.'));
  modal({ title: mat ? 'Générer les carnets de suivi' : `Générer ${students.length > 1 ? 'les livrets' : 'le livret'} — période ${pi + 1}`, body: form,
  actions: [{ label: 'Annuler' }, { label: 'Générer', primary: true, testid: 'gen-go', onClick: async (ev) => {
    const next = { ...o, sur: Number(form.querySelector('[name=sur]')?.value || o.sur) };
    for (const k of ['niveaux', 'notes', 'detail', 'absences']) { const i = form.querySelector(`[name=${k}]`); if (i) next[k] = i.checked; }
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
  const subs = [...new Set([...Object.keys(rep?.subjects || {}), ...Object.keys(rep?.marks || {}), ...(mat ? [] : Object.keys(bySub))])].sort((a, b) => ((order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)) || a.localeCompare(b));
  const obs = mat ? E.of('observation', s.id).filter(x => x.date >= per.start && x.date <= per.end && x.kind === 'réussite') : [];
  const port = mat ? E.of('portfolio', s.id).filter(p => (p.date || '') >= per.start && (p.date || '') <= per.end) : [];
  const abs = V.attendanceOfStudent(s.id).filter(x => x.a.date >= per.start && x.a.date <= per.end && x.m.status === 'absent').length;
  const teacher = [store.getSettings().userName, model.hasBinome(cls) ? cls.binome?.name : ''].filter(Boolean).join(' et ');
  const notes = subs.map(sub => String(markOf(rep, sub).note || '').trim()).filter(Boolean).map(x => Number(x.replace(',', '.'))).filter(Number.isFinite);
  const head = h('header', { class: 'livret-head' },
    h('div', { class: 'livret-school' }, h('strong', {}, cls.school || 'École'), h('div', {}, `Année scolaire ${year?.label || ''}`)),
    h('div', { class: 'livret-title' }, h('h1', {}, mat ? 'Carnet de suivi des apprentissages' : 'Livret scolaire'), h('div', { class: 'print-sub' }, `Période ${pi + 1} — du ${model.frShort(per.start)} au ${model.frShort(per.end)}`)),
    h('div', { class: 'livret-student' }, h('strong', {}, `${s.firstName} ${s.lastName}`), h('div', {}, `Classe : ${cls.name}`), teacher ? h('div', {}, `Enseignante${teacher.includes(' et ') ? 's' : ''} : ${teacher}`) : null));
  const legend = !mat && o.niveaux ? h('p', { class: 'livret-legend' }, h('strong', {}, 'Niveaux : '), sc.map(([k, l]) => `${k} = ${l}`).join(' · ')) : null;
  const subBlock = (sub) => {
    const m = markOf(rep, sub); const items = bySub[sub] || [];
    return h('section', { class: 'livret-sub' },
      h('div', { class: 'livret-sub-head' }, h('span', { class: 'livret-sub-name' }, sub),
        o.niveaux && m.level ? h('span', { class: `livret-level lv-${m.level}` }, `${m.level} · ${label[m.level] || ''}`) : null,
        o.notes && m.note ? h('span', { class: 'livret-note' }, `${m.note} / ${o.sur}`) : null),
      o.detail && items.length ? h('table', { class: 'print-table livret-items' }, h('tbody', {}, items.map(r => h('tr', {},
        h('td', {}, r.item.competencyId ? competencyLabel(r.item.competencyId, idx) : r.item.label, h('div', { class: 'livret-ev' }, `${r.ev.title} — ${model.frShort(r.ev.date)}`)),
        h('td', { class: 'livret-cell' }, r.level ? `${r.level}` : ''), o.notes ? h('td', { class: 'livret-cell' }, r.points != null && r.item.maxPoints ? `${r.points}/${r.item.maxPoints}` : '') : null)))) : null,
      rep?.subjects?.[sub] ? h('p', { class: 'livret-app pre' }, rep.subjects[sub]) : null);
  };
  return h('div', { class: 'print-doc livret' }, head,
    mat ? [
      h('h2', { class: 'print-h2' }, 'Réussites observées'),
      obs.length || port.length ? h('ul', {}, obs.map(x => h('li', {}, `${model.frShort(x.date)} — ${x.text}`)), port.map(p => h('li', {}, `${p.date ? model.frShort(p.date) + ' — ' : ''}${p.title}${(p.competencyIds || []).length ? ` (${p.competencyIds.map(c => idx.get(c)?.label || '').filter(Boolean).join(' ; ')})` : ''}`))) : h('p', { class: 'muted' }, '—'),
      subs.map(sub => rep?.subjects?.[sub] ? h('section', { class: 'livret-sub' }, h('div', { class: 'livret-sub-head' }, h('span', { class: 'livret-sub-name' }, sub)), h('p', { class: 'livret-app pre' }, rep.subjects[sub])) : null)]
    : [legend, subs.length ? subs.map(subBlock) : h('p', { class: 'muted' }, 'Aucun résultat ni appréciation pour cette période.'),
      o.notes && notes.length > 1 ? h('p', { class: 'livret-avg' }, h('strong', {}, 'Moyenne générale indicative : '), `${String(Math.round(notes.reduce((a, b) => a + b, 0) / notes.length * 10) / 10).replace('.', ',')} / ${o.sur}`) : null],
    h('section', { class: 'livret-sub livret-general' }, h('div', { class: 'livret-sub-head' }, h('span', { class: 'livret-sub-name' }, mat ? 'Synthèse des acquis' : 'Appréciation générale')), h('p', { class: 'livret-app pre' }, rep?.general || '')),
    o.absences ? h('p', { class: 'small' }, `Absences sur la période : ${abs} demi-journée(s).`) : null,
    h('table', { class: 'print-table livret-sign' }, h('tbody', {}, h('tr', {}, ['L’enseignante', 'La direction', 'Les responsables légaux (vu et pris connaissance)'].map(t => h('td', {}, h('div', { class: 'livret-sign-label' }, t), h('div', { class: 'livret-sign-box' })))))));
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
      h('input', { type: 'checkbox', checked: add.has(ev.id) || !ex.has(ev.id), 'data-testid': 'livret-eval', onchange: async (e) => {
        const inP = ev.date >= per.start && ev.date <= per.end;
        const nEx = new Set(conf.excluded || []), nAdd = new Set(conf.added || []);
        if (inP) { e.target.checked ? nEx.delete(ev.id) : nEx.add(ev.id); } else { e.target.checked ? nAdd.add(ev.id) : nAdd.delete(ev.id); }
        await setLivretEvals(cls, per, { excluded: [...nEx], added: [...nAdd] });
      } }), `${ev.title}`, h('span', { class: 'muted small' }, ` · ${ev.subject || ''} · ${model.frShort(ev.date)} · ${(ev.items || []).length} item(s)`))))) : h('p', { class: 'muted small' }, 'Aucune évaluation sur cette période : créez-les dans Ma classe › Évaluations (une ligne par compétence ou item).'),
    others.filter(ev => !add.has(ev.id)).length ? h('select', { 'aria-label': 'Ajouter une évaluation d’une autre date', 'data-testid': 'livret-eval-add', onchange: async (e) => { if (!e.target.value) return; await setLivretEvals(cls, per, { added: [...add, e.target.value] }); } },
      h('option', { value: '' }, '+ Ajouter une évaluation d’une autre date…'), others.filter(ev => !add.has(ev.id)).map(ev => h('option', { value: ev.id }, `${ev.title} (${model.frShort(ev.date)})`))) : null);
}
