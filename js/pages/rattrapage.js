// Rattrapage : croise les plages d'absence (appel) avec les séances réellement faites
// et les supports réellement distribués au niveau de l'élève. L'enseignante choisit.
// Statuts : à remettre / remis (documents), à rattraper / rattrapé (activités, évaluations).
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import * as PL from '../planning.js';
import * as V from '../vie.js';
import { h, icon, toast, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { printDocument } from '../print.js';

const sel = { studentId: null, from: null, to: null };
const overlap = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

/** Propositions de rattrapage pour un élève sur une période. */
export function proposals(cls, s, from, to) {
  const lvl = model.enrollmentsOfStudent(s.id).find(e => e.classId === cls.id)?.level;
  const out = [];
  for (let d = from; d <= to; d = model.addDays(d, 1)) {
    const ranges = V.absenceRanges(cls, s.id, d);
    if (!ranges.length) continue;
    const verified = ranges.every(r => r.verified);
    const plan = PL.dayPlan(cls, d);
    for (const e of plan.entries) {
      if (e.kind === 'event' || !['faite', 'partielle'].includes(e.status)) continue; // seulement ce qui a réellement eu lieu
      if (e.levels?.length && lvl && !e.levels.includes(lvl)) continue;
      if (!ranges.some(r => overlap(e.start, e.end, r.start, r.end))) continue;
      const snap = e.occ?.snapshot || e.session;
      const variant = (e.session?.variants || []).find(v => v.level === lvl && (v.objective || v.consigne || v.support));
      const adapt = (e.session?.adaptations || []).find(a => (a.studentIds || []).includes(s.id));
      out.push({ key: `seance:${e.occ.id}`, kind: 'séance', refId: e.occ.id, date: d, label: `${e.start} ${e.subject} — ${snap?.title || e.title}${e.status === 'partielle' ? ' (faite partiellement)' : ''}`, verified,
        detail: [snap?.objective && `Objectif : ${snap.objective}`, variant && `Pour les ${lvl} : ${[variant.objective, variant.consigne, variant.support].filter(Boolean).join(' · ')}`, adapt && `Adaptation prévue : ${[adapt.consigne, adapt.support, adapt.quantite, adapt.modalite, adapt.temps].filter(Boolean).join(' · ')}`].filter(Boolean).join('\n') });
      for (const fid of snap?.fileIds || []) { const f = store.get(fid); if (f && !f.deletedAt) out.push({ key: `doc:${e.occ.id}:${fid}`, kind: 'document', refId: fid, date: d, label: f.name, verified }); }
      for (const c of e.session?.copies || []) out.push({ key: `copie:${e.occ.id}:${c.id}`, kind: 'document', refId: c.id, date: d, label: c.label || 'Photocopie', verified });
    }
    for (const l of store.all('lesson').filter(x => x.classId === cls.id)) for (const dist of (l.distributions || []).filter(x => x.date === d)) {
      if (dist.targets && lvl && !dist.targets.includes(lvl) && !/classe/i.test(dist.targets)) continue;
      out.push({ key: `lecon:${l.id}:${d}`, kind: 'leçon', refId: l.id, date: d, label: `${l.subject} n° ${l.number} — ${l.title}`, verified });
    }
    for (const hw of store.all('homework').filter(x => x.classId === cls.id && x.givenDate === d)) {
      const t = hw.targets || { kind: 'classe' };
      if (t.kind === 'niveau' && !t.values.includes(lvl)) continue;
      if (t.kind === 'élèves' && !t.values.includes(s.id)) continue;
      out.push({ key: `devoir:${hw.id}`, kind: 'devoir', refId: hw.id, date: d, label: `${hw.title} (pour le ${model.frShort(hw.dueDate)})`, verified });
    }
    for (const ev of store.all('evaluation').filter(x => x.classId === cls.id && x.date === d && x.results?.[s.id]?.absent && x.results[s.id].catchup !== 'rattrapé')) {
      out.push({ key: `eval:${ev.id}`, kind: 'évaluation', refId: ev.id, date: d, label: ev.title, verified });
    }
  }
  return out;
}
const initialStatus = (kind) => (['document', 'leçon', 'devoir'].includes(kind) ? 'à remettre' : 'à rattraper');
const doneStatus = (kind) => (['document', 'leçon', 'devoir'].includes(kind) ? 'remis' : 'rattrapé');

export function render({ rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Rattrapage'), subTabs(), missing);
  const today = model.todayIso();
  sel.from ||= model.addDays(today, -14); sel.to ||= today;
  const students = model.studentsOfClass(cls.id, { includeLeft: true });
  const withAbs = students.filter(({ student: s }) => { for (let d = sel.from; d <= sel.to; d = model.addDays(d, 1)) if (V.absenceRanges(cls, s.id, d).length) return true; return false; });
  const s = sel.studentId ? store.get(sel.studentId) : null;
  const props = s ? proposals(cls, s, sel.from, sel.to) : [];
  const existing = s ? store.all('catchup').filter(c => c.studentId === s.id) : [];
  const already = new Set(existing.flatMap(c => c.items.map(i => i.key)));
  const chosen = new Set(props.filter(p => !already.has(p.key)).map(p => p.key));

  return h('div', { class: 'page' },
    pageHeader('Rattrapage', { favKey: 'classe/rattrapage', subtitle: cls.name }),
    subTabs(),
    h('div', { class: 'filters' },
      h('label', { class: 'inline' }, 'Du', h('input', { type: 'date', value: sel.from, onchange: (e) => { sel.from = e.target.value || sel.from; rerender(); } })),
      h('label', { class: 'inline' }, 'au', h('input', { type: 'date', value: sel.to, onchange: (e) => { sel.to = e.target.value || sel.to; rerender(); } })),
      h('select', { 'aria-label': 'Élève', 'data-testid': 'catchup-student', onchange: (e) => { sel.studentId = e.target.value || null; rerender(); } }, h('option', { value: '' }, `Choisir un élève (${withAbs.length} absent(s) sur la période)`),
        students.map(({ student: x }) => h('option', { value: x.id, selected: x.id === sel.studentId }, `${x.firstName} ${x.lastName}${withAbs.some(w => w.student.id === x.id) ? ' — absences' : ''}`)))),
    !s ? h('section', { class: 'card' }, h('h2', {}, 'Élèves absents sur la période'),
      withAbs.length ? h('ul', { class: 'plain' }, withAbs.map(({ student: x }) => { const open = store.all('catchup').filter(c => c.studentId === x.id).flatMap(c => c.items).filter(i => i.status === initialStatus(i.kind)).length;
        return h('li', {}, h('button', { class: 'linklike', type: 'button', onclick: () => { sel.studentId = x.id; rerender(); } }, `${x.firstName} ${x.lastName}`), open ? badge(`${open} en attente`, 'warn') : null); })) : h('p', { class: 'muted' }, 'Aucune absence enregistrée à l’appel sur cette période.'),
      h('p', { class: 'muted small' }, 'Seules les séances marquées « faites » (ou partiellement) au cahier journal, qui recoupent l’absence et concernent le niveau de l’élève, sont proposées.'))
      : h('div', { class: 'stack' },
        h('section', { class: 'card' }, h('h2', {}, `Propositions pour ${s.firstName}`),
          props.length ? h('div', {}, h('ul', { class: 'catch-list', 'data-testid': 'catchup-proposals' }, props.map(p => h('li', { class: already.has(p.key) ? 'muted' : '' },
            h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: chosen.has(p.key), disabled: already.has(p.key), onchange: (e) => { e.target.checked ? chosen.add(p.key) : chosen.delete(p.key); } }),
              h('span', {}, h('strong', {}, `${model.frDate(p.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${p.kind}`), ` ${p.label}`)),
            p.verified ? null : badge('appel non validé', 'muted'), already.has(p.key) ? badge('déjà dans une fiche', 'info') : null,
            p.detail ? h('div', { class: 'small pre muted' }, p.detail) : null))),
            h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'create-catchup', onclick: async () => {
              const items = props.filter(p => chosen.has(p.key)).map(p => ({ id: store.uid(), key: p.key, kind: p.kind, refId: p.refId, date: p.date, label: p.label, detail: p.detail || '', status: initialStatus(p.kind), doneAt: null }));
              if (!items.length) { toast('Rien de sélectionné', { kind: 'error' }); return; }
              await store.create('catchup', { classId: cls.id, studentId: s.id, from: sel.from, to: sel.to, items }, `Fiche de rattrapage de ${s.firstName}`);
              toast('Fiche de rattrapage créée');
            } }, 'Créer la fiche de rattrapage'))
            : h('p', { class: 'muted' }, 'Rien à proposer : pas d’absence, ou aucune séance marquée faite pendant l’absence.')),
        existing.map(c => h('section', { class: 'card', 'data-testid': 'catchup-sheet' },
          h('div', { class: 'card-head' }, h('h2', {}, `Fiche du ${model.frShort(c.createdAt)} (absences du ${model.frShort(c.from)} au ${model.frShort(c.to)})`),
            h('div', { class: 'row' }, h('button', { class: 'btn btn-small', type: 'button', onclick: () => printDocument(printSheet(cls, s, c)) }, icon('print', 14), 'Imprimer'),
              h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mettre la fiche à la corbeille', onclick: () => store.remove(c.id, 'Fiche de rattrapage mise à la corbeille') }, icon('trash', 16)))),
          h('ul', { class: 'catch-list' }, c.items.map(it => h('li', {},
            h('span', {}, h('strong', {}, `${model.frShort(it.date)} · ${it.kind}`), ` ${it.label}`),
            h('select', { 'aria-label': `Statut : ${it.label}`, 'data-testid': 'catchup-status', onchange: async (e) => {
              const items = store.get(c.id).items.map(x => x.id === it.id ? { ...x, status: e.target.value, doneAt: e.target.value === doneStatus(x.kind) ? model.todayIso() : null } : x);
              await store.update(c.id, { items }, `Rattrapage : ${e.target.value}`);
              if (it.kind === 'évaluation' && e.target.value === 'rattrapé') { const ev = store.get(it.refId); if (ev) { const r = structuredClone(ev.results || {}); r[s.id] = { ...(r[s.id] || {}), catchup: 'rattrapé', catchupDate: model.todayIso() }; await store.update(ev.id, { results: r }, 'Évaluation rattrapée'); } }
            } }, [initialStatus(it.kind), doneStatus(it.kind)].map(x => h('option', { value: x, selected: it.status === x }, x))),
            it.doneAt ? h('span', { class: 'muted small' }, ` le ${model.frShort(it.doneAt)}`) : null)))))));
}

/** Fiche imprimable (famille) : uniquement les séances, documents, leçons et devoirs. */
function printSheet(cls, s, c) {
  return h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, `Rattrapage — ${s.firstName} ${s.lastName}`), h('p', {}, `${cls.name} · absences du ${model.frShort(c.from)} au ${model.frShort(c.to)}`)),
    h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, ['Date', 'Type', 'À rattraper', 'Statut'].map(t => h('th', {}, t)))),
      h('tbody', {}, c.items.map(it => h('tr', {}, h('td', {}, model.frShort(it.date)), h('td', {}, it.kind), h('td', {}, it.label, it.detail ? h('div', { class: 'small' }, it.detail.split('\n').filter(l => !l.startsWith('Adaptation')).join(' · ')) : null), h('td', {}, `☐ ${it.status}`))))));
}
