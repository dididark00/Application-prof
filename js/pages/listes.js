// Listes personnalisables à partir des élèves de la classe.
// Une colonne liée (document, autorisation, droit à l'image) lit et écrit directement
// la fiche élève : aucune double saisie. Une colonne libre reste propre à la liste.
import * as store from '../store.js';
import * as model from '../model.js';
import * as E from '../eleve.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState, download } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { toCsv } from '../csv.js';
import { printDocument, printTable } from '../print.js';
import * as FI from '../finance.js';
import { movementDialog } from './argent.js';

const TYPES = [['case', 'Case à cocher'], ['date', 'Date'], ['texte', 'Texte'], ['montant', 'Montant (€)'], ['choix', 'Choix dans une liste'], ['lien', 'Lié à la fiche élève (document, autorisation, image)'], ['paiement', 'Paiement d’un projet (lié à Argent et projets)']];
const view = { q: '', sort: 'nom', filterCol: '', filterVal: '', selected: new Set() };

export function render({ params, rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Listes'), subTabs(), missing);
  if (params[0]) return detail(params[0], cls, rerender);
  const lists = store.all('list').filter(l => l.classId === cls.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const templates = store.all('list').filter(l => l.classId !== cls.id);
  return h('div', { class: 'page' },
    pageHeader('Listes', { favKey: 'classe/listes', subtitle: cls.name, actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-list', onclick: () => newList(cls) }, icon('plus', 16), 'Nouvelle liste')] }),
    subTabs(),
    h('p', { class: 'muted' }, 'Exemples : documents de rentrée, matériel, livres rendus, poésie récitée, mots signés, sorties. Les colonnes liées mettent à jour la fiche de l’élève.'),
    lists.length ? h('div', { class: 'dash' }, lists.map(l => h('a', { class: 'card card-link', href: `#/listes/${l.id}` }, h('h2', {}, l.title), h('p', { class: 'muted' }, `${l.columns.length} colonne(s) · créée le ${model.frShort(l.createdAt)}`)))) : emptyState('Aucune liste'),
    templates.length ? h('section', { class: 'card' }, h('h2', {}, 'Réutiliser une liste d’une autre classe ou année'),
      h('p', { class: 'muted small' }, 'Seules les colonnes sont reprises, avec les élèves de cette classe ; les valeurs restent dans la liste d’origine.'),
      h('ul', { class: 'plain' }, templates.map(t => h('li', {}, `${t.title} (${store.get(t.classId)?.name || 'classe supprimée'}) `, h('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
        const l = await store.create('list', { classId: cls.id, title: t.title, columns: t.columns.map(c => ({ ...c })), values: {}, fromListId: t.id }, `Liste « ${t.title} » reprise`);
        location.hash = `#/listes/${l.id}`;
      } }, 'Reprendre'))))) : null);
}

function newList(cls) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() }, field('Titre', h('input', { name: 'title', required: true, placeholder: 'ex. Documents de rentrée' })),
    h('p', { class: 'muted small' }, 'Les colonnes s’ajoutent ensuite.'));
  modal({ title: 'Nouvelle liste', body: form, actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, onClick: async () => {
    const d = formData(form); if (!d.title) return false;
    const l = await store.create('list', { classId: cls.id, title: d.title, columns: [], values: {} }, `Liste « ${d.title} »`);
    location.hash = `#/listes/${l.id}`;
  } }] });
}

function columnDialog(l, col = null) {
  const tpls = E.docTemplates();
  const type = h('select', { name: 'type' }, TYPES.map(([v, t]) => h('option', { value: v, selected: (col?.type || 'case') === v }, t)));
  const opts = h('input', { name: 'options', value: (col?.options || []).join(', '), placeholder: 'ex. oui, non, à relancer' });
  const link = h('select', { name: 'link' }, tpls.map(t => h('option', { value: t.id, selected: col?.link === t.id }, `${t.category === 'image' ? 'Droit à l’image — ' : ''}${t.label}`)));
  const projs = FI.projects(store.get(l.classId)?.yearId);
  const proj = h('select', { name: 'projectId' }, projs.length ? projs.map(p => h('option', { value: p.id, selected: col?.projectId === p.id }, p.title)) : h('option', { value: '' }, 'Aucun projet : créez-le dans Organisation › Argent et projets'));
  const optsF = field('Choix (séparés par des virgules)', opts); const linkF = field('Donnée de la fiche élève', link); const projF = field('Projet', proj);
  const sync = () => { optsF.hidden = type.value !== 'choix'; linkF.hidden = type.value !== 'lien'; projF.hidden = type.value !== 'paiement'; };
  type.addEventListener('change', sync); sync();
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() }, field('Intitulé', h('input', { name: 'label', value: col?.label || '' })), field('Type', type), optsF, linkF, projF);
  const actions = [{ label: 'Annuler' }];
  if (col) actions.unshift({ label: 'Supprimer la colonne', danger: true, onClick: async () => {
    if (!await confirmDialog('Supprimer la colonne ?', col.type === 'lien' ? 'Les données de la fiche élève ne sont pas effacées.' : 'Les valeurs de cette colonne seront perdues (annulable).', { confirmLabel: 'Supprimer', danger: true })) return false;
    await store.update(l.id, { columns: store.get(l.id).columns.filter(c => c.id !== col.id) }, 'Colonne supprimée');
  } });
  actions.push({ label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form);
    const t = tpls.find(x => x.id === d.link);
    if (d.type === 'paiement' && !d.projectId) { toast('Choisissez un projet.', { kind: 'error' }); return false; }
    const label = d.label || (d.type === 'lien' ? t?.label : '') || (d.type === 'paiement' ? store.get(d.projectId)?.title : '') || 'Colonne';
    const rec = { id: col?.id || store.uid(), label, type: d.type, options: d.type === 'choix' ? d.options.split(',').map(x => x.trim()).filter(Boolean) : [], link: d.type === 'lien' ? d.link : null, projectId: d.type === 'paiement' ? d.projectId : null };
    const cols = store.get(l.id).columns;
    await store.update(l.id, { columns: col ? cols.map(c => c.id === col.id ? rec : c) : [...cols, rec] }, col ? 'Colonne modifiée' : 'Colonne ajoutée');
  } });
  modal({ title: col ? 'Modifier la colonne' : 'Ajouter une colonne', body: form, actions });
}

/** Valeur d'une cellule : lue dans la liste, ou dans la fiche élève pour une colonne liée. */
function cellValue(l, col, s, yearId) {
  if (col.type === 'paiement') { const p = store.get(col.projectId); return p && !p.deletedAt ? { p, ...FI.studentInProject(p, s.id) } : null; }
  if (col.type === 'lien') { const t = E.docTemplates().find(x => x.id === col.link); if (!t) return null; const d = E.docOf(s.id, yearId, t.id); return { t, d, st: E.docState(d, t) }; }
  return l.values?.[s.id]?.[col.id] ?? '';
}
const positive = (t) => (t.category === 'document' ? 'reçu' : 'autorisé');

async function setCell(l, col, s, yearId, v, quiet = true) {
  if (col.type === 'lien') {
    const t = E.docTemplates().find(x => x.id === col.link);
    await E.setDoc(s.id, yearId, t, { status: v, date: model.todayIso() }, `${t.label} — ${s.firstName} : ${v} (depuis la liste « ${l.title} »)`, { quiet });
    return;
  }
  const cur = structuredClone(store.get(l.id).values || {});
  cur[s.id] = { ...(cur[s.id] || {}), [col.id]: v };
  await store.update(l.id, { values: cur }, `Liste « ${l.title} » : ${col.label}`, { quiet });
}

function cellText(l, col, s, yearId) {
  const v = cellValue(l, col, s, yearId);
  if (col.type === 'lien') return v ? `${v.st.status}${v.st.expired ? ' (expirée)' : ''}` : '';
  if (col.type === 'paiement') return !v ? '' : !v.participant ? 'non participant' : v.rest <= 0 ? `réglé (${FI.euros(v.paid)})` : v.paid ? `${FI.euros(v.paid)} — reste ${FI.euros(v.rest)}` : `à payer ${FI.euros(v.rest)}`;
  if (col.type === 'case') return v ? '✓' : '';
  if (col.type === 'date') return v ? model.frShort(v) : '';
  if (col.type === 'montant') return v !== '' && v != null ? `${Number(v).toFixed(2).replace('.', ',')} €` : '';
  return v ?? '';
}

function detail(id, cls, rerender) {
  const l = store.get(id);
  if (!l || l.deletedAt) return h('div', { class: 'page' }, pageHeader('Liste introuvable'), h('a', { href: '#/listes' }, '← Listes'));
  const lc = store.get(l.classId);
  const yearId = lc?.yearId;
  let rows = model.studentsOfClass(l.classId).map(x => x.student);
  if (view.q) rows = rows.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(view.q.toLowerCase()));
  const fcol = l.columns.find(c => c.id === view.filterCol);
  if (fcol && view.filterVal) rows = rows.filter(s => { const t = cellText(l, fcol, s, yearId); return view.filterVal === '__vide' ? !t : view.filterVal === '__rempli' ? !!t : t.includes(view.filterVal); });
  const scol = l.columns.find(c => c.id === view.sort);
  rows.sort((a, b) => scol ? cellText(l, scol, a, yearId).localeCompare(cellText(l, scol, b, yearId), 'fr') : model.fullName(a).localeCompare(model.fullName(b), 'fr'));
  const sumCols = l.columns.filter(c => c.type === 'montant');

  const cell = (col, s) => {
    const v = cellValue(l, col, s, yearId);
    if (col.type === 'lien') {
      if (!v) return h('span', { class: 'muted' }, '?');
      const on = v.st.status === positive(v.t);
      return h('span', { class: 'inline' }, h('input', { type: 'checkbox', checked: on, 'aria-label': `${col.label} : ${s.firstName}`, 'data-testid': 'cell-link', onchange: (e) => setCell(l, col, s, yearId, e.target.checked ? positive(v.t) : E.defaultStatus(v.t)).then(rerender) }),
        badge(v.st.status, v.st.kind), v.st.expired ? badge('expirée', 'warn') : null);
    }
    if (col.type === 'paiement') {
      if (!v) return h('span', { class: 'muted' }, 'projet supprimé');
      if (!v.participant) return h('span', { class: 'muted small' }, 'non participant');
      return h('span', { class: 'inline' }, badge(cellText(l, col, s, yearId), v.rest <= 0 ? 'ok' : 'warn'),
        v.rest > 0 ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'cell-pay', onclick: () => movementDialog({ projectId: v.p.id, studentId: s.id, kind: 'versement', abs: v.rest }) }, '+ versement') : null);
    }
    if (col.type === 'case') return h('input', { type: 'checkbox', checked: !!v, 'aria-label': `${col.label} : ${s.firstName}`, 'data-testid': 'cell-case', onchange: (e) => setCell(l, col, s, yearId, e.target.checked) });
    if (col.type === 'choix') return h('select', { 'aria-label': `${col.label} : ${s.firstName}`, onchange: (e) => setCell(l, col, s, yearId, e.target.value) }, h('option', { value: '' }, '—'), col.options.map(o => h('option', { value: o, selected: v === o }, o)));
    return h('input', { type: col.type === 'date' ? 'date' : col.type === 'montant' ? 'number' : 'text', step: col.type === 'montant' ? '0.01' : null, value: v ?? '', 'aria-label': `${col.label} : ${s.firstName}`, onchange: (e) => setCell(l, col, s, yearId, e.target.value) });
  };

  const bulk = h('div', { class: 'row' }, h('span', { class: 'muted small' }, `${view.selected.size} sélectionné(s) :`),
    l.columns.filter(c => ['case', 'lien'].includes(c.type)).map(c => h('button', { class: 'btn btn-small', type: 'button', disabled: !view.selected.size, onclick: async () => {
      const targets = rows.filter(s => view.selected.has(s.id));
      if (!await confirmDialog('Action groupée', `Cocher « ${c.label} » pour ${targets.length} élève(s) ?${c.type === 'lien' ? ' Leur fiche sera mise à jour.' : ''}`, { confirmLabel: 'Cocher' })) return;
      for (const s of targets) { const v = cellValue(l, c, s, yearId); await setCell(l, c, s, yearId, c.type === 'lien' ? positive(v.t) : true, false); }
      toast(`${targets.length} élève(s) mis à jour`, { action: 'Annuler', onAction: () => store.undo() });
    } }, `Cocher « ${c.label} »`)));

  const printDoc = (blank) => printTable({ title: l.title, subtitle: `${lc?.name || ''} · ${blank ? 'version vierge' : `état au ${model.frDate(model.todayIso())}`}`,
    columns: [{ label: 'Élève', width: '26%' }, ...l.columns.map(c => ({ label: c.label }))],
    rows: rows.map(s => [`${(s.lastName || '').toUpperCase()} ${s.firstName}`, ...l.columns.map(c => blank ? '' : cellText(l, c, s, yearId))]) });

  return h('div', { class: 'page' },
    h('p', {}, h('a', { href: '#/listes', class: 'back' }, '← Listes')),
    pageHeader(l.title, { subtitle: `${lc?.name || ''} · ${rows.length} élève(s)`, actions: [
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'add-column', onclick: () => columnDialog(l) }, icon('plus', 16), 'Colonne'),
      h('button', { class: 'btn', type: 'button', 'data-testid': 'print-list-filled', onclick: () => printDocument(printDoc(false), { orientation: l.columns.length > 4 ? 'landscape' : 'portrait' }) }, icon('print', 16), 'Imprimer'),
      h('button', { class: 'btn', type: 'button', onclick: () => printDocument(printDoc(true), { orientation: l.columns.length > 4 ? 'landscape' : 'portrait' }) }, 'Version vierge'),
      h('button', { class: 'btn', type: 'button', onclick: () => download(`${l.title.replace(/[^\w-]+/g, '_')}.csv`, toCsv([['Nom', 'Prénom', ...l.columns.map(c => c.label)], ...rows.map(s => [s.lastName, s.firstName, ...l.columns.map(c => cellText(l, c, s, yearId))])]), 'text/csv;charset=utf-8') }, icon('download', 16), 'CSV'),
      h('button', { class: 'btn btn-ghost-danger', type: 'button', 'aria-label': 'Mettre la liste à la corbeille', onclick: async () => { await store.remove(l.id, `Liste « ${l.title} » mise à la corbeille`); location.hash = '#/listes'; } }, icon('trash', 16))] }),
    h('div', { class: 'card' },
      h('div', { class: 'filters' },
        h('input', { type: 'search', placeholder: 'Filtrer par nom…', value: view.q, 'aria-label': 'Filtrer', onchange: (e) => { view.q = e.target.value; rerender(); } }),
        h('select', { 'aria-label': 'Trier', onchange: (e) => { view.sort = e.target.value; rerender(); } }, h('option', { value: 'nom' }, 'Tri par nom'), l.columns.map(c => h('option', { value: c.id, selected: view.sort === c.id }, `Tri : ${c.label}`))),
        h('select', { 'aria-label': 'Filtrer une colonne', onchange: (e) => { view.filterCol = e.target.value; view.filterVal = view.filterCol ? '__vide' : ''; rerender(); } }, h('option', { value: '' }, 'Toutes les lignes'), l.columns.map(c => h('option', { value: c.id, selected: view.filterCol === c.id }, `Filtre : ${c.label}`))),
        fcol ? h('select', { 'aria-label': 'Valeur du filtre', 'data-testid': 'filter-val', onchange: (e) => { view.filterVal = e.target.value; rerender(); } }, [['__vide', 'vide / non coché'], ['__rempli', 'rempli / coché'], ...(fcol.type === 'lien' ? E.statusesOf(E.docTemplates().find(t => t.id === fcol.link) || { category: 'document' }).map(x => [x, x]) : (fcol.options || []).map(x => [x, x]))].map(([v, t]) => h('option', { value: v, selected: view.filterVal === v }, t))) : null),
      l.columns.length ? bulk : null,
      l.columns.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table list-table', 'data-testid': 'list-table' },
        h('thead', {}, h('tr', {}, h('th', {}, h('input', { type: 'checkbox', 'aria-label': 'Tout sélectionner', checked: rows.length && rows.every(s => view.selected.has(s.id)), onchange: (e) => { rows.forEach(s => (e.target.checked ? view.selected.add(s.id) : view.selected.delete(s.id))); rerender(); } })),
          h('th', {}, 'Élève'), l.columns.map(c => h('th', {}, h('button', { class: 'linklike', type: 'button', title: 'Modifier la colonne', onclick: () => columnDialog(l, c) }, c.label), c.type === 'lien' ? h('span', { class: 'later-tag', title: 'Mis à jour sur la fiche élève' }, 'fiche') : null)))),
        h('tbody', {}, rows.map(s => h('tr', {}, h('td', {}, h('input', { type: 'checkbox', 'aria-label': `Sélectionner ${s.firstName}`, checked: view.selected.has(s.id), onchange: (e) => { e.target.checked ? view.selected.add(s.id) : view.selected.delete(s.id); rerender(); } })),
          h('td', {}, h('a', { href: `#/eleve/${s.id}?t=documents` }, `${s.firstName} ${s.lastName}`)), l.columns.map(c => h('td', {}, cell(c, s)))))),
        sumCols.length ? h('tfoot', {}, h('tr', {}, h('th', {}), h('th', {}, 'Total'), l.columns.map(c => h('td', {}, c.type === 'montant' ? `${rows.reduce((t, s) => t + (Number(l.values?.[s.id]?.[c.id]) || 0), 0).toFixed(2).replace('.', ',')} €` : '')))) : null))
        : emptyState('Aucune colonne', 'Ajoutez des colonnes : case, date, texte, montant, choix, ou une donnée liée à la fiche élève (assurance, autorisation, droit à l’image).')),
    h('p', { class: 'muted small' }, 'Colonne « Montant » : simple suivi dans la liste. Colonne « Paiement d’un projet » : lit et alimente le journal financier (Organisation › Argent et projets), sans double saisie.'));
}
