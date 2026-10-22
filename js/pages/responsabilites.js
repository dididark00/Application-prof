// Responsabilités (métiers de la classe) avec rotations datées : l'historique est conservé.
import * as store from '../store.js';
import * as model from '../model.js';
import { h, icon, toast, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { iconBtn } from '../forms.js';
import { printDocument, printTable } from '../print.js';

const DEFAULT_JOBS = ['Distribuer le matériel', 'Effacer le tableau', 'Arroser les plantes', 'Fermer les lumières', 'Ranger la bibliothèque', 'Responsable du calendrier'];

function recOf(classId) { return store.all('jobs').find(j => j.classId === classId) || null; }
export function currentAssignment(rec, date = model.todayIso()) {
  return (rec?.history || []).filter(x => x.from <= date).sort((a, b) => b.from.localeCompare(a.from))[0] || null;
}

export function render({ rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Responsabilités'), subTabs(), missing);
  const rec = recOf(cls.id);
  const today = model.todayIso();
  const students = model.studentsOfClass(cls.id).map(x => x.student);
  if (!rec) return h('div', { class: 'page' }, pageHeader('Responsabilités', { favKey: 'classe/responsabilites' }), subTabs(),
    emptyState('Aucune responsabilité', 'Commencez avec une liste proposée, modifiable ensuite.',
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'init-jobs', onclick: () => store.create('jobs', { classId: cls.id, jobs: DEFAULT_JOBS.map(label => ({ id: store.uid(), label, count: 1 })), history: [] }, 'Responsabilités créées') }, 'Créer les responsabilités')));
  const cur = currentAssignment(rec, today);
  const save = (patch, label, quiet = false) => store.update(rec.id, patch, label, { quiet });

  /** Rotation : chaque responsabilité passe aux élèves suivants, sans redonner la même à la même personne. */
  const rotate = async (from) => {
    const ids = students.map(s => s.id);
    if (!ids.length) return;
    const prev = currentAssignment(rec, from);
    const prevAll = Object.values(prev?.map || {}).flat();
    let start = prevAll.length ? (ids.indexOf(prevAll.at(-1)) + 1) % ids.length : 0;
    const map = {};
    for (const j of rec.jobs) {
      map[j.id] = [];
      for (let k = 0; k < (j.count || 1); k++) {
        let tries = 0;
        while (tries < ids.length && ((prev?.map?.[j.id] || []).includes(ids[start]) || Object.values(map).flat().includes(ids[start]))) { start = (start + 1) % ids.length; tries++; }
        map[j.id].push(ids[start]); start = (start + 1) % ids.length;
      }
    }
    const history = (rec.history || []).filter(x => x.from !== from).concat([{ from, map }]);
    await save({ history }, `Rotation des responsabilités au ${model.frShort(from)}`);
    toast('Nouvelle rotation enregistrée ; les précédentes restent dans l’historique.');
  };
  const setOne = async (jobId, idx, sid) => {
    const history = structuredClone(rec.history || []);
    let entry = history.find(x => x.from === today);
    if (!entry) { entry = { from: today, map: structuredClone(cur?.map || {}) }; history.push(entry); }
    const arr = entry.map[jobId] || []; arr[idx] = sid || null; entry.map[jobId] = arr;
    await save({ history }, 'Responsabilité attribuée');
  };
  const name = (id) => store.get(id)?.firstName || '—';
  const doc = () => printTable({ title: `Responsabilités — ${cls.name}`, subtitle: cur ? `à partir du ${model.frDate(cur.from)}` : '', columns: [{ label: 'Responsabilité' }, { label: 'Élève(s)' }], rows: rec.jobs.map(j => [j.label, (cur?.map?.[j.id] || []).map(name).join(', ')]) });

  return h('div', { class: 'page' },
    pageHeader('Responsabilités', { favKey: 'classe/responsabilites', subtitle: `${cls.name}${cur ? ` · depuis le ${model.frDate(cur.from)}` : ''}`, actions: [
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'rotate-jobs', onclick: () => rotate(today) }, 'Rotation (à partir d’aujourd’hui)'),
      h('button', { class: 'btn', type: 'button', onclick: () => printDocument(doc()) }, icon('print', 16), 'Imprimer / afficher')] }),
    subTabs(),
    h('section', { class: 'card' }, h('div', { class: 'table-wrap' }, h('table', { class: 'table', 'data-testid': 'jobs-table' },
      h('thead', {}, h('tr', {}, ['Responsabilité', 'Nombre', 'Élève(s) actuellement', ''].map(t => h('th', {}, t)))),
      h('tbody', {}, rec.jobs.map(j => h('tr', {},
        h('td', {}, h('input', { value: j.label, 'aria-label': 'Intitulé', onchange: (e) => save({ jobs: rec.jobs.map(x => x.id === j.id ? { ...x, label: e.target.value } : x) }, 'Responsabilité renommée', true) })),
        h('td', {}, h('input', { type: 'number', min: 1, max: 6, value: j.count || 1, style: { width: '64px' }, 'aria-label': 'Nombre d’élèves', onchange: (e) => save({ jobs: rec.jobs.map(x => x.id === j.id ? { ...x, count: Number(e.target.value) || 1 } : x) }, 'Nombre d’élèves') })),
        h('td', {}, Array.from({ length: j.count || 1 }, (_, k) => h('select', { 'aria-label': `${j.label} ${k + 1}`, onchange: (e) => setOne(j.id, k, e.target.value) }, h('option', { value: '' }, '—'), students.map(s => h('option', { value: s.id, selected: cur?.map?.[j.id]?.[k] === s.id }, s.firstName))))),
        h('td', {}, iconBtn('trash', 'Supprimer', () => save({ jobs: rec.jobs.filter(x => x.id !== j.id) }, 'Responsabilité supprimée')))))))),
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => save({ jobs: [...rec.jobs, { id: store.uid(), label: 'Nouvelle responsabilité', count: 1 }] }, 'Responsabilité ajoutée') }, '+ responsabilité')),
    (rec.history || []).length > 1 ? h('section', { class: 'card' }, h('h2', {}, 'Historique'), h('ul', { class: 'plain' }, rec.history.slice().sort((a, b) => b.from.localeCompare(a.from)).map(x => h('li', {}, h('strong', {}, `${model.frShort(x.from)} : `), rec.jobs.map(j => `${j.label} → ${(x.map[j.id] || []).map(name).join(', ') || '—'}`).join(' ; '))))) : null);
  void badge; void rerender;
}
