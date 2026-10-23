// Aujourd'hui › Registre d'appel : le mois en un coup d'œil, à partir des appels du matin et de l'après-midi.
// Onglets : statistiques (présences totales, matin, après-midi), registre (grille élèves × jours),
// absences (justification de chaque demi-journée, cumul des retards, alerte à 4 demi-journées injustifiées),
// préférences (tri, regroupement par niveau, repas spécial, élève non pris en compte).
import * as store from '../store.js';
import * as model from '../model.js';
import * as V from '../vie.js';
import * as PL from '../planning.js';
import { h, icon, toast, badge, emptyState, download, modal, field } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { printDocument } from '../print.js';
import { toCsv } from '../csv.js';

export const JUSTIFS = [['à justifier', '?', 'just-todo'], ['injustifiée', '!', 'just-no'], ['motif légitime', '✓', 'just-ok'], ['autre motif', '✓', 'just-other']];
const TABS = [['stats', 'Statistiques'], ['registre', 'Registre'], ['absences', 'Absences'], ['prefs', 'Préférences']];
const PRESENT = new Set(['présent', 'retard', 'départ', 'partiel']);
let tab = 'stats';

export const prefsOf = (cls) => ({ sort: 'nom', group: false, excluded: [], meal: [], ...(store.get(cls.id)?.appelPrefs || {}) });
/** Élèves de la classe dans l'ordre choisi (nom ou prénom, regroupés par niveau si demandé). */
export function orderedStudents(cls, date) {
  const p = prefsOf(cls);
  const key = (x) => (p.sort === 'prenom' ? `${x.student.firstName} ${x.student.lastName}` : `${x.student.lastName} ${x.student.firstName}`);
  return model.studentsOfClass(cls.id, { date }).sort((a, b) => (p.group ? (a.enrollment?.level || '').localeCompare(b.enrollment?.level || '') : 0) || key(a).localeCompare(key(b), 'fr'));
}
const monthDays = (ym) => { const [y, m] = ym.split('-').map(Number); const n = new Date(y, m, 0).getDate(); return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`); };

/** Statistiques du mois : par demi-journée (seulement celles où l'appel a été fait). */
export function monthStats(cls, ym) {
  const p = prefsOf(cls); const excl = new Set(p.excluded);
  const recs = store.all('attendance').filter(a => a.classId === cls.id && a.date.startsWith(ym));
  const out = { total: { halves: 0, possible: 0, present: 0, absent: 0 }, matin: { halves: 0, possible: 0, present: 0, absent: 0 }, 'après-midi': { halves: 0, possible: 0, present: 0, absent: 0 } };
  for (const a of recs) {
    const ids = model.studentsOfClass(cls.id, { date: a.date }).map(x => x.student.id).filter(id => !excl.has(id));
    const marked = ids.filter(id => a.marks?.[id]?.status);
    if (!marked.length) continue;
    for (const k of ['total', a.half]) {
      const o = out[k]; o.halves++; o.possible += marked.length;
      for (const id of marked) { if (PRESENT.has(a.marks[id].status)) o.present++; else if (a.marks[id].status === 'absent') o.absent++; }
    }
  }
  return out;
}
/** Absences et retards d'un élève sur le mois. */
export function studentMonth(cls, sid, ym) {
  const recs = store.all('attendance').filter(a => a.classId === cls.id && a.date.startsWith(ym) && a.marks?.[sid]?.status).sort((x, y) => (x.date + x.half).localeCompare(y.date + y.half));
  const abs = [], late = [];
  for (const a of recs) {
    const m = a.marks[sid];
    if (m.status === 'absent') abs.push({ a, m, justif: m.justif || 'à justifier' });
    if (m.status === 'retard' && m.time) late.push(Math.max(0, model.minutes(m.time) - model.minutes(V.halfTimes(cls, a.half).start)));
  }
  return { abs, lateMin: late.reduce((s, x) => s + x, 0), lateN: late.length, unjust: abs.filter(x => x.justif === 'injustifiée' || x.justif === 'à justifier').length, unjustSure: abs.filter(x => x.justif === 'injustifiée').length };
}
async function setJustif(a, sid, justif, motif) {
  const cur = store.get(a.id); const marks = structuredClone(cur.marks || {});
  marks[sid] = { ...(marks[sid] || {}), justif, ...(motif != null ? { motif } : {}) };
  await store.update(a.id, { marks }, `Absence ${justif} (${model.frShort(a.date)} ${a.half})`, { quiet: true });
}

export function render({ query, rerender }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return h('div', { class: 'page' }, pageHeader('Registre d’appel'), subTabs(), miss);
  if (TABS.some(t => t[0] === query.t)) tab = query.t;
  const ym = /^\d{4}-\d{2}$/.test(query.m || '') ? query.m : model.todayIso().slice(0, 7);
  const shift = (n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const go = (m, t = tab) => { location.hash = `#/registre?m=${m}&t=${t}`; };
  const label = new Date(`${ym}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const body = { stats, registre, absences, prefs }[tab](cls, ym, rerender);
  return h('div', { class: 'page' },
    pageHeader('Registre d’appel', { favKey: 'aujourdhui/registre', subtitle: cls.name, actions: [
      h('button', { class: 'btn', type: 'button', 'data-testid': 'reg-print', onclick: () => printDocument(printRegister(cls, ym), { orientation: 'landscape' }) }, icon('print', 16), 'Imprimer le mois'),
      h('button', { class: 'btn', type: 'button', 'data-testid': 'reg-csv', onclick: () => download(`registre-${ym}.csv`, csvRegister(cls, ym), 'text/csv;charset=utf-8') }, icon('download', 16), 'Tableau (CSV)')] }),
    subTabs(),
    h('div', { class: 'daynav' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mois précédent', 'data-testid': 'reg-prev', onclick: () => go(shift(-1)) }, icon('chevleft')),
      h('strong', { class: 'reg-month', 'data-testid': 'reg-month' }, label),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mois suivant', onclick: () => go(shift(1)) }, icon('chevright'))),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' }, TABS.map(([k, l]) => h('a', { class: k === tab ? 'on seg-link' : 'seg-link', href: `#/registre?m=${ym}&t=${k}`, 'data-testid': `reg-tab-${k}` }, l))),
    body);
}

// ───── Statistiques
function donut(pct) {
  const deg = Math.round((pct / 100) * 360);
  return h('div', { class: 'reg-donut', style: { background: `conic-gradient(var(--reg-ok) 0 ${deg}deg, var(--reg-ko) ${deg}deg 360deg)` } }, h('span', {}, `${String(pct).replace('.', ',')} %`));
}
function stats(cls, ym) {
  const s = monthStats(cls, ym);
  const card = (title, o) => { const pct = o.possible ? Math.round(o.present / o.possible * 1000) / 10 : 0;
    return h('section', { class: 'card reg-stat', 'data-testid': 'reg-stat' }, o.possible ? donut(pct) : h('div', { class: 'reg-donut empty' }, '—'),
      h('div', {}, h('h2', {}, title), h('p', { class: 'muted' }, `${o.halves} demi-journée(s)`),
        h('table', { class: 'reg-figs' }, h('tbody', {}, h('tr', {}, h('td', {}, 'Possibles'), h('td', {}, String(o.possible))), h('tr', {}, h('td', {}, h('span', { class: 'sq ok' }), 'Présents'), h('td', {}, String(o.present))), h('tr', {}, h('td', {}, h('span', { class: 'sq ko' }), 'Absents'), h('td', {}, String(o.absent)))))));
  };
  return h('div', { class: 'stack' }, calendar(cls, ym), card('Présences totales', s.total), card('Présences matin', s.matin), card('Présences après-midi', s['après-midi']),
    h('p', { class: 'muted small' }, 'Calcul sur les demi-journées où l’appel a été fait. Retards, départs anticipés et absences partielles comptent comme présences, comme dans le registre officiel. Les élèves « non pris en compte » (Préférences) sont exclus.'));
}
function calendar(cls, ym) {
  const days = monthDays(ym); const first = model.weekday(days[0]);
  const done = (d, half) => { const a = V.attendanceOf(cls.id, d, half); return a ? (a.validated ? 'ok' : 'wip') : ''; };
  return h('section', { class: 'card reg-cal', 'data-testid': 'reg-cal' }, h('div', { class: 'reg-cal-grid' },
    ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(j => h('span', { class: 'muted small' }, j)),
    Array.from({ length: first - 1 }, () => h('span')),
    days.map(d => { const school = PL.isSchoolDay(cls, d).ok; const m = done(d, 'matin'), a = done(d, 'après-midi');
      return h('a', { class: `reg-day ${school ? '' : 'off'} ${d === model.todayIso() ? 'today' : ''}`, href: `#/appel?d=${d}`, title: school ? 'Faire ou voir l’appel' : PL.isSchoolDay(cls, d).reason }, String(Number(d.slice(8))),
        h('span', { class: 'dots' }, m ? h('i', { class: m }) : null, a ? h('i', { class: a }) : null)); })),
    h('p', { class: 'muted small' }, '● appel validé · ○ appel commencé. Touchez un jour pour ouvrir l’appel.'));
}

// ───── Registre (grille)
function cellFor(m) {
  if (!m?.status) return h('span', { class: 'reg-c none' });
  if (m.status === 'absent') { const j = JUSTIFS.find(x => x[0] === (m.justif || 'à justifier')); return h('span', { class: `reg-c abs ${j[2]}`, title: `absent — ${j[0]}${m.motif ? ' : ' + m.motif : ''}` }, j[1]); }
  if (m.status === 'présent') return h('span', { class: 'reg-c ok', title: 'présent' });
  return h('span', { class: 'reg-c late', title: m.status + (m.time ? ` (${m.time})` : '') }, m.status === 'retard' ? 'R' : m.status === 'départ' ? 'D' : '½');
}
function registre(cls, ym) {
  const days = monthDays(ym).filter(d => PL.isSchoolDay(cls, d).ok || store.all('attendance').some(a => a.classId === cls.id && a.date === d));
  const st = orderedStudents(cls, `${ym}-15`).filter(x => !prefsOf(cls).excluded.includes(x.student.id));
  if (!days.length) return emptyState('Pas de jour de classe ce mois-ci');
  const rec = (d, half) => V.attendanceOf(cls.id, d, half);
  return h('div', { class: 'table-wrap reg-wrap' }, h('table', { class: 'reg-table', 'data-testid': 'reg-table' },
    h('thead', {}, h('tr', {}, h('th', { class: 'reg-name' }, ''), days.map(d => h('th', { colspan: 2 }, h('a', { href: `#/appel?d=${d}` }, h('span', { class: 'small muted' }, model.frDate(d, { weekday: 'short' }).slice(0, 2)), h('br'), d.slice(8))))),
      h('tr', { class: 'reg-total' }, h('th', { class: 'reg-name' }, 'TOTAL'), days.flatMap(d => V.HALVES.map(([half]) => { const a = rec(d, half); return h('td', {}, a ? String(st.filter(x => PRESENT.has(a.marks?.[x.student.id]?.status)).length) : ''); })))),
    h('tbody', {}, st.map(({ student: s }) => h('tr', {}, h('th', { class: 'reg-name' }, h('a', { href: `#/eleve/${s.id}` }, h('strong', {}, (s.lastName || '').toUpperCase()), h('br'), h('span', { class: 'muted' }, s.firstName))),
      days.flatMap(d => V.HALVES.map(([half]) => h('td', {}, h('a', { href: `#/appel?d=${d}&h=${encodeURIComponent(half)}`, 'aria-label': `${s.firstName} ${model.frShort(d)} ${half}` }, cellFor(rec(d, half)?.marks?.[s.id]))))))))));
}

// ───── Absences et justifications
function absences(cls, ym, rerender) {
  const st = orderedStudents(cls, `${ym}-15`).filter(x => !prefsOf(cls).excluded.includes(x.student.id));
  const rows = st.map(({ student: s }) => ({ s, ...studentMonth(cls, s.id, ym) }));
  const legend = h('p', { class: 'reg-legend small' }, JUSTIFS.map(([l, sym, c]) => h('span', {}, h('span', { class: `reg-c abs ${c}` }, sym), ` ${l} `)), h('span', {}, '☀︎ matin / ☾ après-midi'));
  const pick = (x, s) => {
    const motif = h('input', { value: x.m.motif || '', placeholder: 'ex. maladie, rendez-vous médical, deuil…' });
    modal({ title: `Absence de ${s.firstName} — ${model.frDate(x.a.date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${x.a.half}`, body: h('div', { class: 'form' }, field('Motif donné par la famille', motif), h('p', { class: 'muted small' }, 'Les motifs recevables sont fixés par le Code de l’éducation ; en cas de doute sérieux, l’absence peut être comptée comme non justifiée.')),
      actions: JUSTIFS.map(([l]) => ({ label: l, primary: l === 'motif légitime', testid: `just-${l.replace(/\W+/g, '-')}`, onClick: async () => { await setJustif(x.a, s.id, l, motif.value.trim()); rerender(); } })) });
  };
  const withAbs = rows.filter(r => r.abs.length || r.lateN);
  return h('div', { class: 'stack' }, legend,
    withAbs.length ? withAbs.map(r => h('section', { class: `card reg-abs ${r.unjust >= 4 ? 'alert' : ''}`, 'data-testid': 'reg-abs-card' },
      h('h2', {}, `${(r.s.lastName || '').toUpperCase()} ${r.s.firstName}`),
      h('div', { class: 'reg-abs-figs' }, h('div', {}, h('span', { class: 'muted small' }, 'Cumul des retards'), h('strong', {}, `${r.lateMin} min`), r.lateN ? h('span', { class: 'muted small' }, ` (${r.lateN})`) : null),
        h('div', {}, h('span', { class: 'muted small' }, 'Absences non justifiées'), h('strong', { 'data-testid': 'reg-unjust' }, String(r.unjust)), h('span', { class: 'muted small' }, ' demi-journée(s)'))),
      r.unjust >= 4 ? h('p', { class: 'warn-text small', 'data-testid': 'reg-alert' }, '4 demi-journées ou plus sans motif légitime ce mois-ci : seuil de signalement à la direction (article L131-8 du Code de l’éducation). Un contact avec la famille est attendu dès la première absence non justifiée.') : null,
      r.abs.length ? h('div', { class: 'row' }, r.abs.map(x => { const j = JUSTIFS.find(y => y[0] === x.justif);
        return h('button', { type: 'button', class: 'reg-chip', 'data-testid': 'reg-chip', title: `${x.justif}${x.m.motif ? ' : ' + x.m.motif : ''}`, onclick: () => pick(x, r.s) }, h('span', { class: `reg-c abs ${j[2]}` }, j[1]), ` ${model.frDate(x.a.date, { weekday: 'short', day: '2-digit' })} ${x.a.half === 'matin' ? '☀︎' : '☾'}`); })) : null))
      : emptyState('Aucune absence ni retard ce mois-ci'));
}

// ───── Préférences
function prefs(cls, ym, rerender) {
  const p = prefsOf(cls);
  const save = (patch) => store.update(cls.id, { appelPrefs: { ...prefsOf(cls), ...patch } }, 'Préférences de l’appel', { quiet: true }).then(rerender);
  const toggleIn = (k, id, on) => { const set = new Set(prefsOf(cls)[k]); on ? set.add(id) : set.delete(id); return save({ [k]: [...set] }); };
  return h('div', { class: 'stack' },
    h('p', { class: 'card notice small' }, 'Ordre de la liste et options utilisées pour l’appel, le registre et les statistiques.'),
    h('div', { class: 'row' },
      h('label', { class: 'inline' }, h('input', { type: 'radio', name: 'regsort', checked: p.sort === 'nom', onchange: () => save({ sort: 'nom' }) }), 'Trier par nom'),
      h('label', { class: 'inline' }, h('input', { type: 'radio', name: 'regsort', checked: p.sort === 'prenom', 'data-testid': 'reg-sort-prenom', onchange: () => save({ sort: 'prenom' }) }), 'Trier par prénom'),
      h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: p.group, onchange: (e) => save({ group: e.target.checked }) }), 'Grouper par niveau')),
    h('section', { class: 'card' }, h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Élève'), h('th', {}, 'Repas spécial'), h('th', {}, 'Non pris en compte'))),
      h('tbody', {}, orderedStudents(cls, model.todayIso()).map(({ student: s }) => h('tr', {}, h('td', {}, `${(s.lastName || '').toUpperCase()} ${s.firstName}`),
        h('td', {}, h('input', { type: 'checkbox', checked: p.meal.includes(s.id), 'aria-label': `Repas spécial ${s.firstName}`, 'data-testid': 'reg-meal', onchange: (e) => toggleIn('meal', s.id, e.target.checked) })),
        h('td', {}, h('input', { type: 'checkbox', checked: p.excluded.includes(s.id), 'aria-label': `Non pris en compte ${s.firstName}`, 'data-testid': 'reg-excl', onchange: (e) => toggleIn('excluded', s.id, e.target.checked) })))))))),
    h('p', { class: 'muted small' }, '« Repas spécial » s’affiche à l’appel et dans la liste de cantine. « Non pris en compte » : l’élève reste dans la classe mais n’entre pas dans le registre ni les statistiques (ex. élève inscrit dans une autre classe pour l’appel).'));
}

// ───── Impression et tableau
function printRegister(cls, ym) {
  const days = monthDays(ym).filter(d => PL.isSchoolDay(cls, d).ok);
  const st = orderedStudents(cls, `${ym}-15`).filter(x => !prefsOf(cls).excluded.includes(x.student.id));
  const sym = (m) => (!m?.status ? '' : m.status === 'présent' ? '•' : m.status === 'absent' ? (JUSTIFS.find(x => x[0] === (m.justif || 'à justifier'))[1] === '✓' ? 'A✓' : 'A') : m.status === 'retard' ? 'R' : m.status === 'départ' ? 'D' : '½');
  const s = monthStats(cls, ym).total;
  return h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, `Registre d’appel — ${new Date(`${ym}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`), h('p', {}, cls.name)),
    h('table', { class: 'print-table reg-print' }, h('thead', {}, h('tr', {}, h('th', {}, 'Élève'), days.map(d => h('th', { colspan: 2 }, d.slice(8))))),
      h('tbody', {}, st.map(({ student: x }) => h('tr', {}, h('td', {}, `${(x.lastName || '').toUpperCase()} ${x.firstName}`), days.flatMap(d => V.HALVES.map(([half]) => h('td', {}, sym(V.attendanceOf(cls.id, d, half)?.marks?.[x.id])))))))),
    h('p', { class: 'print-foot' }, `• présent · A absent (✓ justifiée) · R retard · D départ anticipé · ½ absence partielle — Présences : ${s.present}/${s.possible} (${s.possible ? Math.round(s.present / s.possible * 1000) / 10 : 0} %)`));
}
function csvRegister(cls, ym) {
  const rows = [['Date', 'Demi-journée', 'Nom', 'Prénom', 'Statut', 'Heure', 'Justification', 'Motif']];
  for (const a of store.all('attendance').filter(x => x.classId === cls.id && x.date.startsWith(ym)).sort((x, y) => (x.date + x.half).localeCompare(y.date + y.half)))
    for (const { student: s } of orderedStudents(cls, a.date)) { const m = a.marks?.[s.id]; if (m?.status) rows.push([a.date, a.half, s.lastName, s.firstName, m.status, m.time || '', m.status === 'absent' ? (m.justif || 'à justifier') : '', m.motif || '']); }
  return toCsv(rows);
}
void toast;
