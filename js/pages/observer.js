// Observation éclair (téléphone ou tablette, pendant la classe) : compétence → niveau → élève, en deux gestes.
// Avec une compétence : le niveau est rangé dans l'évaluation « Observations en classe » du jour (donc dans le livret)
// et une observation datée est ajoutée au suivi de l'élève. Sans compétence : observation simple (réussite, difficulté…).
import * as store from '../store.js';
import * as model from '../model.js';
import * as PL from '../planning.js';
import * as E from '../eleve.js';
import { h, toast } from '../ui.js';
import { pageHeader, subTabs, needClass, avatar } from '../components.js';
import { competencyLabel, competencyIndex } from './referentiels.js';
import { scale } from './evaluations.js';

const ui = { comp: '', subject: '', level: 'A', kind: 'réussite', note: '' };

/** Compétences des séances du jour (et sujet de chacune). */
function todaysComps(cls, date) {
  const out = []; const seen = new Set();
  for (const e of PL.dayPlan(cls, date).entries) {
    const ids = [...(e.session?.competencyIds || []), ...(e.session?.sequenceId ? store.get(e.session.sequenceId)?.competencyIds || [] : [])];
    for (const id of ids) if (!seen.has(id)) { seen.add(id); out.push({ id, subject: e.subject || e.session?.subject || '', when: e.start }); }
  }
  return out;
}

export async function recordLevel(cls, date, { compId, subject, level, student, note = '' }) {
  const idx = competencyIndex();
  const label = competencyLabel(compId, idx);
  const title = `Observations en classe — ${model.frShort(date)}${subject ? ` · ${subject}` : ''}`;
  let ev = store.all('evaluation').find(x => !x.deletedAt && x.classId === cls.id && x.source === 'observation' && x.date === date && (x.subject || '') === (subject || ''));
  if (!ev) ev = await store.create('evaluation', { classId: cls.id, title, subject: subject || '', date, mode: 'maîtrise', items: [], results: {}, versions: [], conditions: 'observation en classe', source: 'observation' }, title);
  ev = store.get(ev.id);
  let item = ev.items.find(i => i.competencyId === compId);
  const items = item ? ev.items : [...ev.items, (item = { id: store.uid(), label, maxPoints: null, competencyId: compId })];
  const results = structuredClone(ev.results || {});
  const r = results[student.id] || {}; r.items = { ...(r.items || {}), [item.id]: { ...(r.items?.[item.id] || {}), level } };
  if (note) r.observation = [r.observation, note].filter(Boolean).join(' · ');
  results[student.id] = r;
  const kind = ['A', 'D'].includes(level) ? 'réussite' : 'difficulté';
  await store.batch([
    { id: ev.id, patch: { items, results } },
    { create: { type: 'observation', data: { studentId: student.id, date, kind, domain: subject || '', text: `${label} : ${level}${note ? ` — ${note}` : ''}`, action: '', followUp: '', done: false } } }],
    `Observation : ${student.firstName} — ${level}`);
}

export function render({ rerender }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return h('div', { class: 'page' }, pageHeader('Observation éclair'), subTabs(), miss);
  const date = model.todayIso();
  const comps = todaysComps(cls, date);
  const idx = competencyIndex();
  const sc = scale();
  if (ui.comp && !comps.some(c => c.id === ui.comp) && !idx.has(ui.comp)) ui.comp = '';
  const students = model.studentsOfClass(cls.id, { date });
  const todayObs = store.all('observation').filter(o => !o.deletedAt && o.date === date);
  const last = (sid) => todayObs.filter(o => o.studentId === sid).at(-1);

  const tap = async (s) => {
    if (ui.comp) await recordLevel(cls, date, { compId: ui.comp, subject: ui.subject, level: ui.level, student: s, note: ui.note.trim() });
    else await store.create('observation', { studentId: s.id, date, kind: ui.kind, domain: '', text: ui.note.trim() || `${ui.kind} observée en classe`, action: '', followUp: '', done: false }, `Observation : ${s.firstName}`);
    toast(`${s.firstName} : ${ui.comp ? ui.level : ui.kind} ♡ (la flèche Annuler défait)`);
    rerender();
  };

  return h('div', { class: 'page observer' },
    pageHeader('Observation éclair', { favKey: 'aujourdhui/observer', subtitle: `${cls.name} · ${model.frDate(date)}` }),
    subTabs(),
    h('section', { class: 'card stack' },
      h('div', { class: 'field' }, h('label', {}, '1. Compétence observée'),
        h('div', { class: 'chips obs-comps', role: 'radiogroup', 'aria-label': 'Compétence' },
          h('button', { type: 'button', class: `chip ${ui.comp ? '' : 'on'}`, role: 'radio', 'aria-checked': String(!ui.comp), onclick: () => { ui.comp = ''; rerender(); } }, 'Sans compétence'),
          comps.map(c => h('button', { type: 'button', class: `chip ${ui.comp === c.id ? 'on' : ''}`, role: 'radio', 'aria-checked': String(ui.comp === c.id), 'data-testid': 'obs-comp', onclick: () => { ui.comp = c.id; ui.subject = c.subject; rerender(); } },
            h('small', {}, `${c.when} ${c.subject}`), ' ', competencyLabel(c.id, idx)))),
        comps.length ? null : h('p', { class: 'muted small' }, 'Aucune compétence dans les séances du jour : reliez des compétences à vos fiches ou séquences pour les retrouver ici.')),
      ui.comp ? h('div', { class: 'field' }, h('label', {}, '2. Niveau'), h('div', { class: 'lvl-seg big', role: 'radiogroup', 'aria-label': 'Niveau' },
        sc.map(([k, l]) => h('button', { type: 'button', class: `lvl-btn lvl-${k} ${ui.level === k ? 'on' : ''}`, role: 'radio', 'aria-checked': String(ui.level === k), title: l, 'data-testid': 'obs-level', onclick: () => { ui.level = k; rerender(); } }, k))))
        : h('div', { class: 'field' }, h('label', {}, '2. Type'), h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Type' },
          E.OBS_KINDS.map(k => h('button', { type: 'button', class: ui.kind === k ? 'on' : '', onclick: () => { ui.kind = k; rerender(); } }, k)))),
      h('div', { class: 'field' }, h('label', {}, 'Petit mot (facultatif, gardé pour les élèves suivants)'),
        h('input', { type: 'text', value: ui.note, placeholder: 'ex. a aidé un camarade, a utilisé la droite graduée', oninput: (e) => { ui.note = e.target.value; } }))),
    h('h2', {}, '3. Touchez l’élève'),
    h('div', { class: 'obs-grid', 'data-testid': 'obs-grid' }, students.map(({ student: s }) => {
      const l = last(s.id);
      return h('button', { type: 'button', class: 'obs-student', 'data-testid': 'obs-student', onclick: () => tap(s) },
        avatar(s, 40), h('span', { class: 'obs-name' }, s.firstName), l ? h('span', { class: 'obs-last' }, l.text.split(' : ').at(-1).slice(0, 18)) : null);
    })),
    h('p', { class: 'muted small' }, 'Avec une compétence, le niveau va dans l’évaluation « Observations en classe » du jour (Ma classe › Évaluations), donc dans le livret, et une observation est ajoutée au suivi de l’élève.'));
}
