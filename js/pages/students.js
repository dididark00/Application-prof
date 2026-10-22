import * as store from '../store.js';
import * as model from '../model.js';
import { h, icon, toast, modal, field, formData, download, pickFiles, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass, demoBadge, avatar } from '../components.js';
import { toCsv, parseCsv, parseDateFr, detectColumns } from '../csv.js';
import { printDocument, printTable } from '../print.js';

const state = { q: '', level: '', date: null, showLeft: false, showFuture: true, showArchived: false };

export function render(ctx) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Élèves', { favKey: 'classe/eleves' }), subTabs(), missing);
  const date = state.date || model.todayIso();
  const all = model.studentsOfClass(cls.id, { date, includeLeft: state.showLeft, includeFuture: state.showFuture });
  const q = state.q.toLowerCase();
  const rows = all.filter(({ student: s, enrollment: e }) =>
    (!q || `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)) &&
    (!state.level || e.level === state.level) &&
    (state.showArchived || !s.archived));
  const actives = all.filter(x => x.status === 'actif' && !x.student.archived);
  const byLevel = {};
  for (const x of actives) byLevel[x.enrollment.level] = (byLevel[x.enrollment.level] || 0) + 1;

  const list = h('div', { class: 'card' },
    h('div', { class: 'filters' },
      h('input', { type: 'search', placeholder: 'Filtrer par nom…', value: state.q, 'aria-label': 'Filtrer par nom',
        oninput: (e) => { state.q = e.target.value; redrawTable(); } }),
      (cls.levels || []).length > 1 ? h('select', { 'aria-label': 'Niveau', onchange: (e) => { state.level = e.target.value; redrawTable(); } },
        h('option', { value: '' }, 'Tous les niveaux'), cls.levels.map(l => h('option', { value: l, selected: state.level === l }, l))) : null,
      h('label', { class: 'inline' }, 'Inscrits au ', h('input', { type: 'date', value: date, 'data-testid': 'list-date', onchange: (e) => { state.date = e.target.value || null; rerender(); } })),
      h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: state.showLeft, onchange: (e) => { state.showLeft = e.target.checked; rerender(); } }), 'Partis'),
      h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: state.showFuture, onchange: (e) => { state.showFuture = e.target.checked; rerender(); } }), 'Arrivées à venir'),
      h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: state.showArchived, onchange: (e) => { state.showArchived = e.target.checked; redrawTable(); } }), 'Archivés')),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table table-click', 'data-testid': 'students-table' },
      h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Nom'), h('th', {}, 'Prénom'), h('th', {}, 'Niveau'), h('th', { class: 'hide-sm' }, 'Naissance'), h('th', {}, 'Statut'))),
      h('tbody', { id: 'students-tbody' }))));

  const page = h('div', { class: 'page' },
    pageHeader('Élèves', { favKey: 'classe/eleves', subtitle: `${cls.name} · ${actives.length} inscrit(s) au ${model.frDate(date)}${Object.keys(byLevel).length > 1 ? ' · ' + Object.entries(byLevel).map(([l, n]) => `${l} : ${n}`).join(', ') : ''}`,
      actions: [
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'add-student', onclick: () => studentDialog(cls) }, icon('plus', 16), 'Ajouter'),
        h('button', { class: 'btn', type: 'button', onclick: () => importDialog(cls) }, icon('upload', 16), 'Importer'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'export-csv', onclick: () => exportCsv(cls, rows, date) }, icon('download', 16), 'CSV'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'print-list', onclick: () => printDialog(cls, rows, date) }, icon('print', 16), 'Imprimer'),
      ] }),
    subTabs(),
    rows.length || all.length ? list : emptyState('Aucun élève inscrit', 'Ajoutez les élèves un par un ou importez une liste (CSV depuis un tableur ou ONDE).'));

  function redrawTable() {
    const tbody = page.querySelector('#students-tbody');
    if (!tbody) return;
    const q2 = state.q.toLowerCase();
    const r2 = all.filter(({ student: s, enrollment: e }) => (!q2 || `${s.firstName} ${s.lastName}`.toLowerCase().includes(q2)) && (!state.level || e.level === state.level) && (state.showArchived || !s.archived));
    tbody.replaceChildren(...(r2.length ? r2.map(({ student: s, enrollment: e, status }) => h('tr', { tabindex: '0', onclick: () => { location.hash = `#/eleve/${s.id}`; }, onkeydown: (ev) => { if (ev.key === 'Enter') location.hash = `#/eleve/${s.id}`; } },
      h('td', {}, avatar(s, 32)),
      h('td', {}, h('a', { href: `#/eleve/${s.id}` }, (s.lastName || '').toUpperCase()), ' ', demoBadge(s)),
      h('td', {}, s.firstName),
      h('td', {}, e.level || ''),
      h('td', { class: 'hide-sm' }, model.frShort(s.birthDate)),
      h('td', {}, status === 'actif' ? (e.start > (model.currentYear()?.start || '') ? badge(`arrivé(e) le ${model.frShort(e.start)}`, 'info') : '') : status === 'parti' ? badge(`parti(e) le ${model.frShort(e.end)}`, 'muted') : badge(`arrive le ${model.frShort(e.start)}`, 'info'),
        s.archived ? badge('archivé', 'muted') : null)))
      : [h('tr', {}, h('td', { colspan: 6, class: 'muted' }, 'Aucun élève ne correspond aux filtres.'))]));
  }
  function rerender() { ctx.rerender(); }
  queueMicrotask(redrawTable);
  return page;
}

// ───── Ajout / modification d'identité
export function studentDialog(cls, student = null, enrollment = null) {
  const y = store.get(cls.yearId);
  const editing = !!student;
  const today = model.todayIso();
  const defaultStart = y && today > y.start ? y.start : (y ? y.start : today);
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' },
      field('Prénom', h('input', { name: 'firstName', required: true, value: student?.firstName || '', autocomplete: 'off' })),
      field('Nom', h('input', { name: 'lastName', required: true, value: student?.lastName || '', autocomplete: 'off' }))),
    h('div', { class: 'grid-2' },
      field('Date de naissance', h('input', { name: 'birthDate', type: 'date', value: student?.birthDate || '' })),
      editing ? null : field('Niveau', h('select', { name: 'level' }, (cls.levels || []).map(l => h('option', { value: l }, l))))),
    editing ? null : field('Date d’arrivée dans la classe', h('input', { name: 'start', type: 'date', value: defaultStart }), 'Laissez le début d’année si l’élève est là depuis la rentrée ; indiquez la vraie date pour une arrivée en cours d’année.'));
  const errors = h('div', { class: 'form-errors', role: 'alert' });
  let confirmedDup = false;
  modal({ title: editing ? 'Modifier l’identité' : `Nouvel élève — ${cls.name}`, body: h('div', {}, form, errors), actions: [
    { label: 'Annuler' },
    { label: 'Enregistrer', primary: true, onClick: async () => {
      const d = formData(form);
      if (!d.firstName || !d.lastName) { errors.textContent = 'Prénom et nom sont obligatoires.'; return false; }
      const dup = store.all('student').find(s => s.id !== student?.id && s.firstName.toLowerCase() === d.firstName.toLowerCase() && s.lastName.toLowerCase() === d.lastName.toLowerCase() && (s.birthDate || '') === (d.birthDate || ''));
      if (dup && !confirmedDup) { errors.textContent = `Un élève ${d.firstName} ${d.lastName}${d.birthDate ? ' né le même jour' : ''} existe déjà. Cliquez à nouveau sur Enregistrer pour créer quand même une fiche distincte.`; confirmedDup = true; return false; }
      if (editing) {
        await store.update(student.id, { firstName: d.firstName, lastName: d.lastName, birthDate: d.birthDate }, `Modification de ${d.firstName} ${d.lastName}`);
        toast('Fiche mise à jour', { action: 'Annuler', onAction: () => store.undo() });
      } else {
        const sid = store.uid();
        await store.batch([
          { create: { type: 'student', data: { id: sid, firstName: d.firstName, lastName: d.lastName, birthDate: d.birthDate, contacts: [] } } },
          { create: { type: 'enrollment', data: { studentId: sid, classId: cls.id, level: d.level || cls.levels[0], start: d.start || defaultStart, end: null } } },
        ], `Ajout de ${d.firstName} ${d.lastName}`);
        toast(`${d.firstName} ${d.lastName} ajouté(e)`, { action: 'Annuler', onAction: () => store.undo() });
      }
    } }] });
}

// ───── Import CSV
function importDialog(cls) {
  const y = store.get(cls.yearId);
  const ta = h('textarea', { rows: 6, placeholder: 'Prénom;Nom;Date de naissance;Niveau\nLou;Exemple;12/03/2018;CE2', 'aria-label': 'Contenu CSV' });
  const start = h('input', { type: 'date', value: y?.start || model.todayIso() });
  const preview = h('div', { class: 'import-preview' });
  let parsed = [];

  const analyse = () => {
    const rows = parseCsv(ta.value);
    if (!rows.length) { preview.replaceChildren(); parsed = []; return; }
    let cols = detectColumns(rows[0]);
    let data = rows;
    if (cols.firstName != null && cols.lastName != null) data = rows.slice(1);
    else cols = { firstName: 0, lastName: 1, birthDate: 2, level: 3 };
    const existing = store.all('student');
    parsed = data.map((r, i) => {
      const it = { line: i + 1, firstName: r[cols.firstName] || '', lastName: r[cols.lastName] || '', birthRaw: cols.birthDate != null ? r[cols.birthDate] || '' : '', levelRaw: cols.level != null ? (r[cols.level] || '').toUpperCase().replace(/\s/g, '') : '' };
      it.birthDate = parseDateFr(it.birthRaw);
      it.level = (cls.levels.includes(it.levelRaw) ? it.levelRaw : (cls.levels.length === 1 ? cls.levels[0] : ''));
      it.errors = [];
      if (!it.firstName || !it.lastName) it.errors.push('prénom ou nom manquant');
      if (it.birthDate === null) it.errors.push(`date « ${it.birthRaw} » non reconnue`);
      if (!it.level) it.errors.push(`niveau « ${it.levelRaw} » absent de la classe`);
      it.dup = existing.some(s => s.firstName.toLowerCase() === it.firstName.toLowerCase() && s.lastName.toLowerCase() === it.lastName.toLowerCase() && (s.birthDate || '') === (it.birthDate || ''));
      it.include = !it.errors.length && !it.dup;
      return it;
    });
    preview.replaceChildren(
      h('p', {}, `${parsed.filter(p => p.include).length} ligne(s) prête(s) à importer sur ${parsed.length}. Les lignes en erreur ou déjà présentes sont décochées.`),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Importer'), h('th', {}, 'Prénom'), h('th', {}, 'Nom'), h('th', {}, 'Naissance'), h('th', {}, 'Niveau'), h('th', {}, 'Remarque'))),
        h('tbody', {}, parsed.map(p => h('tr', { class: p.errors.length ? 'row-error' : p.dup ? 'row-warn' : '' },
          h('td', {}, h('input', { type: 'checkbox', checked: p.include, disabled: p.errors.length > 0, 'aria-label': `Importer ${p.firstName} ${p.lastName}`, onchange: (e) => { p.include = e.target.checked; } })),
          h('td', {}, p.firstName), h('td', {}, p.lastName), h('td', {}, p.birthDate ? model.frShort(p.birthDate) : ''), h('td', {}, p.level),
          h('td', {}, p.errors.join(', ') || (p.dup ? 'déjà présent (doublon probable)' : 'ok'))))))));
  };
  ta.addEventListener('input', analyse);

  modal({ title: `Importer des élèves — ${cls.name}`, wide: true, body: h('div', { class: 'form' },
    h('p', {}, 'Collez des lignes depuis un tableur, ou choisissez un fichier CSV. Colonnes attendues : Prénom, Nom, Date de naissance (JJ/MM/AAAA), Niveau. Une ligne d’en-tête est reconnue automatiquement.'),
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: async () => {
      const [f] = await pickFiles({ accept: '.csv,.txt,text/csv', multiple: false });
      if (f) { ta.value = await f.text(); analyse(); }
    } }, icon('upload', 16), 'Choisir un fichier CSV')),
    ta, field('Date d’arrivée pour ces élèves', start), preview),
  actions: [{ label: 'Annuler' }, { label: 'Importer', primary: true, onClick: async () => {
    const ok = parsed.filter(p => p.include);
    if (!ok.length) { toast('Aucune ligne sélectionnée', { kind: 'error' }); return false; }
    const items = [];
    for (const p of ok) {
      const sid = store.uid();
      items.push({ create: { type: 'student', data: { id: sid, firstName: p.firstName, lastName: p.lastName, birthDate: p.birthDate || '', contacts: [] } } });
      items.push({ create: { type: 'enrollment', data: { studentId: sid, classId: cls.id, level: p.level, start: start.value || y?.start, end: null } } });
    }
    await store.batch(items, `Import de ${ok.length} élève(s)`);
    toast(`${ok.length} élève(s) importé(s)`, { action: 'Annuler', onAction: () => store.undo(), kind: 'success' });
  } }] });
}

// ───── Exports
function exportCsv(cls, rows, date) {
  const csv = toCsv([['Nom', 'Prénom', 'Niveau', 'Date de naissance', 'Arrivée', 'Départ'],
    ...rows.map(({ student: s, enrollment: e }) => [s.lastName, s.firstName, e.level, model.frShort(s.birthDate), model.frShort(e.start), model.frShort(e.end)])]);
  download(`eleves-${cls.name.replace(/[^\w-]+/g, '_')}-${date}.csv`, csv, 'text/csv;charset=utf-8');
  toast('Liste exportée en CSV (ouvrable dans un tableur)');
}

function printDialog(cls, rows, date) {
  const COLS = [
    { key: 'lastName', label: 'Nom', on: true, get: (s) => (s.lastName || '').toUpperCase() },
    { key: 'firstName', label: 'Prénom', on: true, get: (s) => s.firstName },
    { key: 'level', label: 'Niveau', on: (cls.levels || []).length > 1, get: (s, e) => e.level },
    { key: 'birth', label: 'Date de naissance', on: false, get: (s) => model.frShort(s.birthDate) },
    { key: 'contact', label: 'Responsable prioritaire', on: false, sensitive: true, get: (s) => (s.contacts || []).find(c => c.priority)?.name || '' },
    { key: 'phone', label: 'Téléphone prioritaire', on: false, sensitive: true, get: (s) => (s.contacts || []).find(c => c.priority)?.phone || '' },
  ];
  const cfg = { title: `${cls.name} — liste des élèves`, orientation: 'portrait', blank: 0, blankTitles: '', color: true, emptyRows: 0 };
  const previewHost = h('div', { class: 'a4-preview' });
  const doc = () => {
    const cols = COLS.filter(c => c.on);
    const extra = cfg.blankTitles.split(',').map(s => s.trim()).filter(Boolean);
    const blanks = Math.max(cfg.blank, extra.length);
    const columns = [...cols.map(c => ({ label: c.label })), ...Array.from({ length: blanks }, (_, i) => ({ label: extra[i] || '', width: '14%' }))];
    const body = rows.map(({ student: s, enrollment: e }) => [...cols.map(c => c.get(s, e)), ...Array.from({ length: blanks }, () => '')]);
    for (let i = 0; i < cfg.emptyRows; i++) body.push(columns.map(() => ''));
    return printTable({ title: cfg.title, subtitle: `Élèves inscrits au ${model.frDate(date)} · ${rows.length} élève(s)`, columns, rows: body });
  };
  const redraw = () => { previewHost.className = `a4-preview ${cfg.orientation} ${cfg.color ? '' : 'bw'}`; previewHost.replaceChildren(doc()); };
  const controls = h('div', { class: 'form' },
    field('Titre', h('input', { value: cfg.title, oninput: (e) => { cfg.title = e.target.value; redraw(); } })),
    h('fieldset', {}, h('legend', {}, 'Colonnes'), h('div', { class: 'chips' }, COLS.map(c => h('label', { class: 'chip' },
      h('input', { type: 'checkbox', checked: c.on, onchange: (e) => { c.on = e.target.checked; redraw(); } }), c.label, c.sensitive ? h('span', { class: 'later-tag', title: 'Donnée personnelle : à n’inclure que pour un destinataire autorisé' }, 'sensible') : null)))),
    field('Colonnes vierges à ajouter (titres séparés par des virgules)', h('input', { placeholder: 'ex. Cahier rendu, Mot signé, Sortie', oninput: (e) => { cfg.blankTitles = e.target.value; redraw(); } })),
    h('div', { class: 'grid-3' },
      field('Nombre de colonnes vierges', h('input', { type: 'number', min: 0, max: 12, value: 0, oninput: (e) => { cfg.blank = Math.min(12, Math.max(0, +e.target.value || 0)); redraw(); } })),
      field('Lignes vides en fin de liste', h('input', { type: 'number', min: 0, max: 30, value: 0, oninput: (e) => { cfg.emptyRows = Math.min(30, Math.max(0, +e.target.value || 0)); redraw(); } })),
      field('Orientation', h('select', { onchange: (e) => { cfg.orientation = e.target.value; redraw(); } }, h('option', { value: 'portrait' }, 'A4 portrait'), h('option', { value: 'landscape' }, 'A4 paysage')))),
    h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { cfg.color = e.target.checked; redraw(); } }), 'Couleur (décocher pour noir et blanc)'));
  redraw();
  modal({ title: 'Imprimer la liste', wide: true, body: h('div', { class: 'print-dialog' }, controls, h('div', {}, h('p', { class: 'muted small' }, 'Aperçu'), previewHost)),
    actions: [{ label: 'Fermer' }, { label: 'Imprimer / PDF', primary: true, onClick: () => { printDocument(doc(), { orientation: cfg.orientation, color: cfg.color }); return false; } }] });
}
