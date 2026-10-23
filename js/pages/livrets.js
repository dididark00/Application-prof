// Livrets et bilans de période : appréciations modifiables, appuyées sur les résultats
// et observations de la période. Prépare les éléments à reporter dans le LSU
// (export tabulaire) : ce n'est pas un export officiel LSU et ne remplace pas le service.
import * as store from '../store.js';
import * as model from '../model.js';
import * as E from '../eleve.js';
import * as V from '../vie.js';
import { h, icon, toast, badge, emptyState, download } from '../ui.js';
import { pageHeader, subTabs, needClass, avatar } from '../components.js';
import { bound } from '../forms.js';
import { resultsOf, scale, levelKind } from './evaluations.js';
import { toCsv } from '../csv.js';
import { printDocument } from '../print.js';
import { appreciationDialog } from './redaction.js';

let selPeriod = null;
const MATERNELLE = ['TPS', 'PS', 'MS', 'GS'];

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
    const res = resultsOf(s.id, cls.id, per.start, per.end);
    const sm = summary(res);
    const obs = E.of('observation', s.id).filter(o => o.date >= per.start && o.date <= per.end);
    const abs = V.attendanceOfStudent(s.id).filter(x => x.a.date >= per.start && x.a.date <= per.end && x.m.status === 'absent').length;
    const subs = subjects.filter(x => sm[x] || rep?.subjects?.[x]);
    return h('section', { class: 'card', 'data-testid': 'report-card' },
      h('div', { class: 'card-head' }, h('h2', {}, avatar(s, 32), ` ${s.firstName} ${s.lastName}`),
        h('div', { class: 'row' }, rep?.status === 'finalisé' ? badge('finalisé', 'ok') : badge('brouillon', 'muted'),
          h('button', { class: 'btn btn-small', type: 'button', onclick: () => saveReport(cls, per, s, { status: rep?.status === 'finalisé' ? 'brouillon' : 'finalisé' }, 'Statut du bilan').then(rerender) }, rep?.status === 'finalisé' ? 'Repasser en brouillon' : 'Marquer finalisé'),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Imprimer le bilan de ${s.firstName}`, onclick: () => printDocument(printReport(cls, per, pi, s, mat)) }, icon('print', 16)))),
      h('div', { class: 'grid-2' },
        h('div', {}, h('h3', {}, mat ? 'Observations de réussite' : 'Résultats de la période'),
          !mat && Object.keys(sm).length ? h('ul', { class: 'plain' }, Object.entries(sm).map(([k, v]) => h('li', {}, h('strong', {}, `${k} : `), sc.map(([lv]) => v.levels[lv] ? badge(`${lv} ${v.levels[lv]}`, levelKind(lv)) : null), v.max ? ` ${v.pts}/${v.max} pts` : ''))) : (!mat ? h('p', { class: 'muted small' }, 'Aucun résultat saisi sur la période.') : null),
          obs.length ? h('ul', { class: 'plain small' }, obs.slice(0, 6).map(o => h('li', {}, `${model.frShort(o.date)} · ${o.kind} : ${o.text}`))) : h('p', { class: 'muted small' }, 'Aucune observation sur la période.'),
          h('p', { class: 'muted small' }, `${abs} demi-journée(s) d’absence sur la période.`)),
        h('div', {},
          subs.map(sub => h('div', {}, bound({ label: `${sub}`, value: rep?.subjects?.[sub], compact: true, onSave: (v) => saveReport(cls, per, s, { subjects: { ...(reportOf(cls.id, per.id, s.id)?.subjects || {}), [sub]: v } }, `Appréciation ${sub}`) }),
            sm[sub] && !rep?.subjects?.[sub] ? h('button', { class: 'btn btn-link small', type: 'button', onclick: () => saveReport(cls, per, s, { subjects: { ...(reportOf(cls.id, per.id, s.id)?.subjects || {}), [sub]: draft(sub, sm[sub], sc) } }, `Brouillon ${sub}`).then(rerender) }, 'proposer un brouillon factuel') : null)),
          h('div', { class: 'row' }, h('select', { 'aria-label': 'Ajouter une discipline', onchange: (e) => { if (!e.target.value) return; saveReport(cls, per, s, { subjects: { ...(rep?.subjects || {}), [e.target.value]: rep?.subjects?.[e.target.value] || '' } }, 'Discipline ajoutée').then(rerender); } },
            h('option', { value: '' }, '+ discipline'), subjects.filter(x => !subs.includes(x)).map(x => h('option', { value: x }, x)))),
          bound({ label: mat ? 'Synthèse des acquis' : 'Appréciation générale', value: rep?.general, testid: 'report-general', onSave: (v) => saveReport(cls, per, s, { general: v }, 'Appréciation générale') }),
          h('button', { class: 'btn btn-link small', type: 'button', 'data-testid': 'report-help', onclick: () => appreciationDialog(s, { initial: reportOf(cls.id, per.id, s.id)?.general || '', onUse: (text) => saveReport(cls, per, s, { general: text }, 'Appréciation générale').then(rerender) }) }, 'Aide à la rédaction (phrases-types)'))));
  };

  return h('div', { class: 'page' },
    pageHeader(mat ? 'Carnets de suivi et synthèses' : 'Livrets et bilans', { favKey: 'classe/livrets', subtitle: `${cls.name} · P${pi + 1}`, actions: [
      h('button', { class: 'btn', type: 'button', 'data-testid': 'export-lsu', onclick: () => {
        const rows = students.map(({ student: s }) => { const r = reportOf(cls.id, per.id, s.id); return [s.lastName, s.firstName, ...subjects.map(x => r?.subjects?.[x] || ''), r?.general || '', r?.status || 'brouillon']; });
        download(`bilans-P${pi + 1}-${cls.name.replace(/[^\w-]+/g, '_')}.csv`, toCsv([['Nom', 'Prénom', ...subjects, 'Appréciation générale', 'Statut'], ...rows]), 'text/csv;charset=utf-8');
        toast('Export des appréciations (à reporter dans le LSU)');
      } }, icon('download', 16), 'Exporter les appréciations')] }),
    subTabs(),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Période' }, periods.map((p, i) => h('button', { type: 'button', class: p.id === per.id ? 'on' : '', onclick: () => { selPeriod = p.id; rerender(); } }, `P${i + 1}`))),
    h('p', { class: 'muted small' }, 'Les résultats et observations de la période sont affichés pour vous aider ; les appréciations restent entièrement rédigées et modifiées par vous. L’export est un tableau à reporter dans le LSU : la compatibilité d’un import direct n’a pas été vérifiée et l’application ne remplace pas le service officiel.'),
    students.length ? h('div', { class: 'stack' }, students.map(card)) : emptyState('Aucun élève'));
}

/** Bilan imprimable pour la famille : appréciations et résultats, sans observations privées ni données confidentielles. */
function printReport(cls, per, pi, s, mat) {
  const rep = reportOf(cls.id, per.id, s.id);
  const sm = summary(resultsOf(s.id, cls.id, per.start, per.end));
  const sc = scale();
  return h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, `${mat ? 'Synthèse' : 'Bilan'} de la période ${pi + 1} — ${s.firstName} ${s.lastName}`), h('p', {}, `${cls.name} · du ${model.frShort(per.start)} au ${model.frShort(per.end)}`)),
    h('table', { class: 'print-table kv' }, h('tbody', {}, [...new Set([...Object.keys(rep?.subjects || {}), ...(mat ? [] : Object.keys(sm))])].map(sub => h('tr', {}, h('th', { style: { width: '24%' } }, sub),
      h('td', {}, rep?.subjects?.[sub] || '', !mat && sm[sub] ? h('div', { class: 'small' }, sc.map(([k, l]) => sm[sub].levels[k] ? `${l} : ${sm[sub].levels[k]}` : '').filter(Boolean).join(' · ')) : null))))),
    h('h2', { class: 'print-h2' }, mat ? 'Synthèse des acquis' : 'Appréciation générale'), h('p', { class: 'pre' }, rep?.general || ''),
    h('p', { class: 'print-foot' }, 'Signature des responsables : ______________________'));
}
