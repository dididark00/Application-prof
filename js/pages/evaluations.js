// Évaluations liées aux séquences et compétences. Maîtrise et notes sont saisies séparément :
// aucune conversion silencieuse. Case vide = non évalué ; « NA » = non acquis ; absent = exclu.
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState, download } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { bound } from '../forms.js';
import { competencyLabel, competencyIndex, pickCompetencies } from './referentiels.js';
import { toCsv } from '../csv.js';
import { printDocument } from '../print.js';

export const DEFAULT_SCALE = [['NA', 'Non acquis'], ['ECA', 'En cours d’acquisition'], ['A', 'Acquis'], ['D', 'Dépassé']];
export function scale() { const s = store.getSettings().evalScale; return Array.isArray(s) && s.length ? s : DEFAULT_SCALE; }
const KIND = { NA: 'warn', ECA: 'info', A: 'ok', D: 'ok' };
export const levelKind = (l) => KIND[l] || 'muted';

export function render({ params, rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Évaluations'), subTabs(), missing);
  if (params[0]) return detail(params[0], rerender);
  const list = P.ofClass('evaluation', cls.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return h('div', { class: 'page' },
    pageHeader('Évaluations', { favKey: 'classe/evaluations', subtitle: cls.name, actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-eval', onclick: () => newEval(cls) }, icon('plus', 16), 'Nouvelle évaluation')] }),
    subTabs(),
    list.length ? h('div', { class: 'dash' }, list.map(ev => {
      const st = stats(ev, cls);
      return h('a', { class: 'card card-link', href: `#/evaluations/${ev.id}` }, h('h2', {}, ev.title),
        h('p', { class: 'muted' }, [model.frShort(ev.date), ev.subject, ev.sequenceId ? P.sequenceTitle(store.get(ev.sequenceId)) : ''].filter(Boolean).join(' · ')),
        h('p', {}, `${st.done}/${st.total} élève(s) saisis`, st.absent ? ` · ${st.absent} absent(s)` : '', st.toCatch ? ` · ${st.toCatch} à rattraper` : ''));
    })) : emptyState('Aucune évaluation', 'Créez une grille : compétences en lignes de colonnes, élèves en lignes, maîtrise et/ou points.'));
}

function stats(ev, cls) {
  const students = model.studentsOfClass(cls.id, { date: ev.date || model.todayIso() });
  let done = 0, absent = 0, toCatch = 0;
  for (const { student: s } of students) {
    const r = ev.results?.[s.id];
    if (r?.absent) { absent++; if (r.catchup !== 'rattrapé') toCatch++; } else if (r && Object.values(r.items || {}).some(x => x?.level || (x?.points ?? '') !== '')) done++;
  }
  return { total: students.length, done, absent, toCatch };
}

function newEval(cls) {
  const seqs = P.ofClass('sequence', cls.id);
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' }, field('Titre', h('input', { name: 'title', required: true, placeholder: 'ex. Évaluation P1 — nombres' })), field('Date', h('input', { name: 'date', type: 'date', value: model.todayIso() }))),
    h('div', { class: 'grid-3' },
      field('Discipline', h('select', { name: 'subject' }, model.subjects().map(s => h('option', { value: s }, s)))),
      field('Séquence', h('select', { name: 'sequenceId' }, h('option', { value: '' }, '—'), seqs.map(s => h('option', { value: s.id }, P.sequenceTitle(s))))),
      field('Mode', h('select', { name: 'mode' }, [['maîtrise', 'Niveaux de maîtrise'], ['notes', 'Points / barème'], ['les deux', 'Les deux (saisis séparément)']].map(([v, l]) => h('option', { value: v }, l))))),
    field('Compétences ou items (une par ligne)', h('textarea', { name: 'items', rows: 5, placeholder: 'Lire, écrire et représenter des nombres jusqu’à 10 000\nPoser et effectuer une addition' }), 'Vous pourrez aussi lier des compétences des référentiels validés.'));
  modal({ title: 'Nouvelle évaluation', wide: true, body: form, actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, onClick: async () => {
    const d = formData(form); if (!d.title) return false;
    const items = d.items.split('\n').map(x => x.trim()).filter(Boolean).map(label => ({ id: store.uid(), label, maxPoints: null, competencyId: null }));
    const ev = await store.create('evaluation', { classId: cls.id, title: d.title, date: d.date, subject: d.subject, sequenceId: d.sequenceId || null, mode: d.mode, items, results: {}, versions: [], conditions: '' }, `Évaluation « ${d.title} »`);
    location.hash = `#/evaluations/${ev.id}`;
  } }] });
}

function detail(id, rerender) {
  const ev = store.get(id);
  if (!ev || ev.deletedAt) return h('div', { class: 'page' }, pageHeader('Évaluation introuvable'), h('a', { href: '#/evaluations' }, '← Évaluations'));
  const cls = store.get(ev.classId);
  const students = model.studentsOfClass(cls.id, { date: ev.date || model.todayIso() });
  const sc = scale();
  const idx = competencyIndex();
  const showLevel = ev.mode !== 'notes', showPts = ev.mode !== 'maîtrise';
  const saveRes = (sid, patch, label = 'Résultat', quiet = true) => { const cur = structuredClone(store.get(ev.id).results || {}); cur[sid] = { ...(cur[sid] || {}), ...patch }; return store.update(ev.id, { results: cur }, `${ev.title} : ${label}`, { quiet }); };
  const saveItem = (sid, itemId, patch) => { const cur = structuredClone(store.get(ev.id).results || {}); const r = cur[sid] || {}; r.items = { ...(r.items || {}), [itemId]: { ...(r.items?.[itemId] || {}), ...patch } }; cur[sid] = r; return store.update(ev.id, { results: cur }, `${ev.title} : saisie`, { quiet: true }); };

  const colStats = (it) => { const c = {}; for (const { student: s } of students) { const r = ev.results?.[s.id]; if (r?.absent) continue; const l = r?.items?.[it.id]?.level; c[l || '—'] = (c[l || '—'] || 0) + 1; } return c; };

  const grid = h('div', { class: 'table-wrap' }, h('table', { class: 'table eval-grid', 'data-testid': 'eval-grid' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Élève'), h('th', {}, 'Absent'), ev.items.map(it => h('th', { class: 'eval-item' }, h('button', { class: 'linklike', type: 'button', onclick: () => itemDialog(ev, it) }, it.label), it.competencyId ? h('div', { class: 'small muted' }, competencyLabel(it.competencyId, idx)) : null, showPts && it.maxPoints ? h('div', { class: 'small muted' }, `/ ${it.maxPoints}`) : null)),
      showPts ? h('th', {}, 'Total') : null, (ev.versions || []).length ? h('th', {}, 'Version') : null, h('th', {}, 'Observation'))),
    h('tbody', {}, students.map(({ student: s }) => {
      const r = ev.results?.[s.id] || {};
      const total = ev.items.reduce((t, it) => t + (Number(r.items?.[it.id]?.points) || 0), 0);
      const max = ev.items.reduce((t, it) => t + (Number(it.maxPoints) || 0), 0);
      return h('tr', { class: r.absent ? 'row-absent' : '' }, h('td', {}, h('a', { href: `#/eleve/${s.id}?t=suivi` }, `${s.firstName} ${s.lastName}`)),
        h('td', {}, h('input', { type: 'checkbox', checked: !!r.absent, 'aria-label': `${s.firstName} absent`, 'data-testid': 'eval-absent', onchange: (e) => saveRes(s.id, { absent: e.target.checked, catchup: e.target.checked ? 'à rattraper' : null }, 'absence', false) }),
          r.absent ? h('select', { 'aria-label': 'Rattrapage', onchange: (e) => saveRes(s.id, { catchup: e.target.value, catchupDate: e.target.value === 'rattrapé' ? model.todayIso() : null }, 'rattrapage', false) }, ['à rattraper', 'rattrapé', 'non rattrapé'].map(x => h('option', { value: x, selected: r.catchup === x }, x))) : null),
        ev.items.map(it => {
          const v = r.items?.[it.id] || {};
          return h('td', {}, r.absent ? h('span', { class: 'muted' }, 'abs.') : h('div', { class: 'eval-cell' },
            showLevel ? h('select', { class: `lvl-${v.level || 'none'}`, 'aria-label': `${s.firstName} — ${it.label}`, 'data-testid': 'eval-level', onchange: (e) => { e.target.className = `lvl-${e.target.value || 'none'}`; saveItem(s.id, it.id, { level: e.target.value }); } },
              h('option', { value: '' }, '— non évalué'), sc.map(([k, l]) => h('option', { value: k, selected: v.level === k, title: l }, k))) : null,
            showPts ? h('input', { type: 'number', step: '0.5', min: 0, max: it.maxPoints || null, value: v.points ?? '', class: 'pts', 'aria-label': `${s.firstName} — ${it.label} (points)`, onchange: (e) => saveItem(s.id, it.id, { points: e.target.value === '' ? null : Number(e.target.value) }) }) : null));
        }),
        showPts ? h('td', { class: 'nowrap' }, r.absent ? '' : `${total}${max ? ' / ' + max : ''}`) : null,
        (ev.versions || []).length ? h('td', {}, h('select', { 'aria-label': 'Version passée', onchange: (e) => saveRes(s.id, { versionId: e.target.value || null }, 'version') }, h('option', { value: '' }, 'standard'), ev.versions.map(vv => h('option', { value: vv.id, selected: r.versionId === vv.id }, vv.label)))) : null,
        h('td', {}, bound({ type: 'text', compact: true, value: r.observation, placeholder: 'observation, conditions…', onSave: (v) => saveRes(s.id, { observation: v }, 'observation') })));
    })),
    showLevel ? h('tfoot', {}, h('tr', {}, h('th', {}, 'Répartition'), h('td', {}), ev.items.map(it => { const c = colStats(it); return h('td', { class: 'small' }, [...sc.map(([k]) => c[k] ? `${k} ${c[k]}` : ''), c['—'] ? `non évalués ${c['—']}` : ''].filter(Boolean).join(' · ')); }),
      showPts ? h('td', {}) : null, (ev.versions || []).length ? h('td', {}) : null, h('td', {}))) : null));

  const printDoc = (blank) => h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, ev.title), h('p', {}, [cls.name, model.frDate(ev.date), ev.subject].filter(Boolean).join(' · '))),
    h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, h('th', { style: { width: '20%' } }, 'Élève'), ev.items.map(it => h('th', {}, it.label)), h('th', {}, 'Observation'))),
      h('tbody', {}, students.map(({ student: s }) => { const r = ev.results?.[s.id] || {};
        return h('tr', {}, h('td', {}, `${(s.lastName || '').toUpperCase()} ${s.firstName}`), ev.items.map(it => h('td', {}, blank ? '' : r.absent ? 'abs.' : [r.items?.[it.id]?.level, r.items?.[it.id]?.points != null ? `${r.items[it.id].points}${it.maxPoints ? '/' + it.maxPoints : ''}` : ''].filter(Boolean).join(' · '))), h('td', {}, blank ? '' : r.observation || '')); }))),
    h('p', { class: 'print-foot' }, `Légende : ${sc.map(([k, l]) => `${k} = ${l}`).join(' · ')} · case vide = non évalué`));

  return h('div', { class: 'page' },
    h('p', {}, h('a', { href: '#/evaluations', class: 'back' }, '← Évaluations')),
    pageHeader(ev.title, { subtitle: [cls.name, model.frDate(ev.date), ev.subject, ev.mode].filter(Boolean).join(' · '), actions: [
      h('button', { class: 'btn', type: 'button', onclick: () => itemDialog(ev) }, icon('plus', 16), 'Item'),
      h('button', { class: 'btn', type: 'button', onclick: () => versionDialog(ev) }, 'Version adaptée'),
      h('button', { class: 'btn', type: 'button', 'data-testid': 'print-eval', onclick: () => printDocument(printDoc(false), { orientation: 'landscape' }) }, icon('print', 16), 'Imprimer'),
      h('button', { class: 'btn', type: 'button', onclick: () => printDocument(printDoc(true), { orientation: 'landscape' }) }, 'Grille vierge'),
      h('button', { class: 'btn', type: 'button', onclick: () => download(`${ev.title.replace(/[^\w-]+/g, '_')}.csv`, toCsv([['Nom', 'Prénom', 'Absent', ...ev.items.flatMap(it => [`${it.label} (maîtrise)`, `${it.label} (points)`]), 'Observation'],
        ...students.map(({ student: s }) => { const r = ev.results?.[s.id] || {}; return [s.lastName, s.firstName, r.absent ? 'oui' : '', ...ev.items.flatMap(it => [r.items?.[it.id]?.level || '', r.items?.[it.id]?.points ?? '']), r.observation || '']; })]), 'text/csv;charset=utf-8') }, icon('download', 16), 'CSV'),
      h('button', { class: 'btn btn-ghost-danger', type: 'button', 'aria-label': 'Mettre à la corbeille', onclick: async () => { if (!await confirmDialog('Mettre l’évaluation à la corbeille ?', 'Les résultats partent avec elle (restaurable).', { confirmLabel: 'Mettre à la corbeille', danger: true })) return; await store.remove(ev.id, 'Évaluation mise à la corbeille'); location.hash = '#/evaluations'; } }, icon('trash', 16))] }),
    h('section', { class: 'card' }, h('div', { class: 'grid-3' },
      bound({ label: 'Conditions de passation', type: 'text', value: ev.conditions, placeholder: 'ex. individuel, 30 min, consignes lues', onSave: (v) => store.update(ev.id, { conditions: v }, 'Conditions', { quiet: true }) }),
      bound({ label: 'Mode', type: 'select', value: ev.mode, options: [['maîtrise', 'Niveaux de maîtrise'], ['notes', 'Points'], ['les deux', 'Les deux']], onSave: (v) => store.update(ev.id, { mode: v }, 'Mode de l’évaluation') }),
      h('div', { class: 'field' }, h('label', {}, 'Légende'), h('p', { class: 'small' }, sc.map(([k, l]) => `${k} : ${l}`).join(' · '), h('br'), 'Vide : non évalué (différent de « non acquis »).'))),
      (ev.versions || []).length ? h('p', { class: 'small' }, 'Versions : ', ev.versions.map(v => `${v.label}${v.note ? ` (${v.note})` : ''}`).join(' ; ')) : null),
    ev.items.length ? h('section', { class: 'card' }, grid) : emptyState('Aucun item', 'Ajoutez des items ou des compétences à évaluer.'),
    h('p', { class: 'muted small' }, 'Aucune note n’est convertie en niveau de maîtrise (ni l’inverse). Les absents sont signalés au rattrapage.'));
  void rerender;
}

function itemDialog(ev, it = null) {
  let comp = it?.competencyId || null;
  const compBtn = h('button', { class: 'btn btn-small', type: 'button', onclick: async () => { const sel = await pickCompetencies(comp ? [comp] : []); if (sel) { comp = sel[0] || null; compBtn.textContent = comp ? competencyLabel(comp) : 'Lier une compétence officielle'; } } }, comp ? competencyLabel(comp) : 'Lier une compétence officielle');
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() }, field('Item / compétence', h('input', { name: 'label', value: it?.label || '' })), field('Barème (points, facultatif)', h('input', { name: 'maxPoints', type: 'number', min: 0, step: '0.5', value: it?.maxPoints ?? '' })), compBtn);
  const actions = [{ label: 'Annuler' }];
  if (it) actions.unshift({ label: 'Supprimer', danger: true, onClick: async () => { if (!await confirmDialog('Supprimer l’item ?', 'Les résultats de cet item seront retirés (annulable).', { confirmLabel: 'Supprimer', danger: true })) return false; await store.update(ev.id, { items: store.get(ev.id).items.filter(x => x.id !== it.id) }, 'Item supprimé'); } });
  actions.push({ label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form); const label = d.label || (comp ? competencyLabel(comp) : ''); if (!label) return false;
    const rec = { id: it?.id || store.uid(), label, maxPoints: d.maxPoints === '' ? null : Number(d.maxPoints), competencyId: comp };
    const items = store.get(ev.id).items;
    await store.update(ev.id, { items: it ? items.map(x => x.id === it.id ? rec : x) : [...items, rec] }, it ? 'Item modifié' : 'Item ajouté');
  } });
  modal({ title: it ? 'Item' : 'Nouvel item', body: form, actions });
}
function versionDialog(ev) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() }, field('Nom de la version', h('input', { name: 'label', placeholder: 'ex. version adaptée (énoncés lus, moins d’items)' })), field('Description', h('input', { name: 'note' })));
  modal({ title: 'Version adaptée', body: form, actions: [{ label: 'Annuler' }, { label: 'Ajouter', primary: true, onClick: async () => { const d = formData(form); if (!d.label) return false; await store.update(ev.id, { versions: [...(ev.versions || []), { id: store.uid(), ...d }] }, 'Version adaptée ajoutée'); } }] });
}

/** Résultats d'un élève sur une période : par compétence/item, sans conversion. */
export function resultsOf(studentId, classId, from, to) {
  return P.ofClass('evaluation', classId).filter(ev => (!from || ev.date >= from) && (!to || ev.date <= to)).flatMap(ev => {
    const r = ev.results?.[studentId]; if (!r) return [];
    if (r.absent) return [{ ev, absent: true, catchup: r.catchup }];
    return ev.items.map(it => ({ ev, item: it, level: r.items?.[it.id]?.level || '', points: r.items?.[it.id]?.points ?? null })).filter(x => x.level || x.points != null);
  });
}
