import * as store from '../store.js';
import * as model from '../model.js';
import * as Theme from '../theme.js';
import * as LB from '../labels.js';
import * as FO from '../fonts.js';
import * as backup from '../backup.js';
import * as demo from '../demo.js';
import * as P from '../pedago.js';
import * as E from '../eleve.js';
import * as C from '../confidential.js';
import * as V from '../vie.js';
import { ROADMAP, STATUTS, RUBRIQUES } from '../roadmap.js';
import { h, icon, toast, modal, confirmDialog, field, formData, download, pickFiles, formatSize, badge, emptyState } from '../ui.js';
import { pageHeader, demoBadge } from '../components.js';
import { synchroTab } from './synchro.js';
import { archiveDialog, openArchiveDialog } from './archives.js';

const TABS = [
  ['general', 'Général'],
  ['annees', 'Années et périodes'],
  ['classes', 'Classes'],
  ['modules', 'Modules'],
  ['charte', 'Charte visuelle'],
  ['sauvegarde', 'Sauvegarde'],
  ['synchro', 'Synchronisation (Nuage)'],
  ['rappels', 'Rappels et agenda'],
  ['connexions', 'Connexions'],
  ['historique', 'Historique'],
  ['corbeille', 'Corbeille'],
  ['documents', 'Documents et confidentialité'],
  ['reprise', 'Reprise d\u2019année'],
  ['demo', 'Démonstration'],
  ['feuille', 'Feuille de route'],
];

export async function render({ params }) {
  const tab = TABS.some(t => t[0] === params[0]) ? params[0] : 'general';
  const content = await ({ general, annees, classes, modules, charte: charteTab, sauvegarde, synchro: synchroTab, rappels: rappelsTab, connexions, historique, corbeille, demo: demoTab, feuille, reprise, documents })[tab]();
  return h('div', { class: 'page' },
    pageHeader('Réglages', { favKey: 'reglages' }),
    h('nav', { class: 'subtabs', 'aria-label': 'Réglages' }, TABS.map(([id, label]) =>
      h('a', { href: `#/reglages/${id}`, class: id === tab ? 'active' : '', 'aria-current': id === tab ? 'page' : null }, label))),
    content);
}

// ───────── Général
function general() {
  const s = store.getSettings();
  const form = h('form', { class: 'card form', onsubmit: async (e) => {
    e.preventDefault();
    const d = formData(form);
    const subjects = [...new Set(d.subjects.split('\n').map(x => x.trim()).filter(Boolean))];
    await store.setSettings({ appName: d.appName || 'Classeur', userName: d.userName, subjects: subjects.length ? subjects : null });
    toast('Réglages enregistrés');
  } },
    h('h2', {}, 'Identité'),
    field('Nom de l’application', h('input', { name: 'appName', value: s.appName, maxlength: 40 }), 'Nom provisoire, modifiable à tout moment.'),
    field('Votre prénom (auteur des modifications)', h('input', { name: 'userName', value: s.userName, maxlength: 60 }), 'Apparaît dans l’historique des modifications et dans la répartition avec la binôme.'),
    h('h2', {}, 'Disciplines'),
    field('Une discipline par ligne', h('textarea', { name: 'subjects', rows: 8, 'data-testid': 'subjects' }, model.subjects().join('\n')), 'Utilisées dans l’emploi du temps, les programmations, les fiches et les fichiers. Renommer une discipline ne modifie pas les fiches existantes.'),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Enregistrer')));
  return h('div', { class: 'stack' }, appearance(), form,
    h('div', { class: 'card' }, h('h2', {}, 'À propos'),
      h('p', {}, `Version ${backup.APP_VERSION} — étapes 1 (socle), 2 (préparation et planification), 3 (usage en classe) et 4 (organisation et atelier). Les données sont enregistrées dans ce navigateur, sur cet appareil.`),
      h('p', { class: 'muted' }, 'Service, binôme et niveaux se règlent dans l’onglet Classes. Calendrier et périodes dans Années et périodes.')));
}

function appearance() {
  const t = Theme.current();
  const c = { ...Theme.DEFAULT_CUSTOM, ...(t.custom || {}) };
  const custom = (key, label, help) => field(label, h('input', { type: 'color', value: c[key], 'data-testid': `custom-${key}`,
    oninput: (e) => { c[key] = e.target.value; Theme.apply({ ...Theme.current(), name: 'perso', custom: { ...c } }); },
    onchange: () => Theme.set({ name: 'perso', custom: { ...c } }) }), help);
  return h('div', { class: 'card form', 'data-testid': 'appearance' },
    h('h2', {}, 'Apparence'),
    h('div', { class: 'theme-grid', role: 'radiogroup', 'aria-label': 'Couleurs' }, Theme.THEMES.map(([id, label, sw]) =>
      h('button', { type: 'button', role: 'radio', 'aria-checked': String(t.name === id), class: `theme-choice${t.name === id ? ' on' : ''}`, 'data-testid': `theme-${id}`, onclick: () => Theme.set({ name: id, custom: id === 'perso' ? c : t.custom }) },
        h('span', { class: 'theme-swatches' }, (sw || [c.fond, c.accent, c.menu]).map(col => h('span', { style: { background: col } }))), label))),
    t.name === 'perso' ? h('div', { class: 'grid-3', 'data-testid': 'custom-colors' },
      custom('accent', 'Couleur principale', 'Boutons, liens, titres actifs. Assombrie automatiquement si besoin pour rester lisible.'),
      custom('menu', 'Couleur du menu actif'),
      custom('fond', 'Couleur du fond')) : h('p', { class: 'muted small' }, 'Choisissez « Mes couleurs » pour composer votre propre thème.'),
    field('Mode sombre', h('select', { 'data-testid': 'theme-mode', onchange: (e) => Theme.set({ mode: e.target.value }) }, Theme.MODES.map(([v, l]) => h('option', { value: v, selected: t.mode === v }, l))), 'Le soir, l’application passe dans la version sombre du même thème. Impressions, projection et diaporamas restent sur fond blanc.'));
}

// ───────── Charte visuelle (étiquettes, affichages)
function charteTab() {
  const c = LB.charte();
  const save = (patch, label) => store.setSettings({ charte: { ...LB.charte(), ...patch } }).then(() => toast(label || 'Charte enregistrée'));
  const fonts = FO.available();
  const sample = LB.S('svg', { viewBox: '0 0 105 74', width: '105mm', height: '74mm', class: 'charte-sample' });
  LB.drawLabel(sample, { line1: 'Exemple', line2: 'Ma classe', emblem: { kind: 'symbol', key: 'etoile' } }, 105, 74, {});
  return h('div', { class: 'stack' }, h('div', { class: 'card form', 'data-testid': 'charte' },
    h('h2', {}, 'Charte visuelle'),
    h('p', { class: 'muted small' }, 'Utilisée par défaut pour les étiquettes, affichages, titres et cartes d’ateliers. Chaque série peut ensuite être ajustée.'),
    h('div', { class: 'grid-2' },
      field('Police principale', h('select', { 'data-testid': 'charte-font', onchange: (e) => save({ font: e.target.value }) }, fonts.map(([v, l]) => h('option', { value: v, selected: c.font === v }, l)))),
      field('Bordure', h('select', { onchange: (e) => save({ border: e.target.value }) }, LB.BORDERS.map(([v, l]) => h('option', { value: v, selected: c.border === v }, l))))),
    field('Couleurs de la charte', h('div', { class: 'row' }, c.colors.map((col, i) => h('input', { type: 'color', value: col, 'aria-label': `Couleur ${i + 1}`, 'data-testid': 'charte-color', onchange: (e) => save({ colors: c.colors.map((x, j) => (j === i ? e.target.value : x)) }) })))),
    field('Épaisseur de la bordure (mm)', h('input', { type: 'number', min: 0.2, max: 4, step: 0.1, value: c.borderWidth, onchange: (e) => save({ borderWidth: Number(e.target.value) || 1 }) })),
    h('div', { class: 'charte-preview' }, sample),
    h('p', {}, h('a', { class: 'btn btn-small', href: '#/etiquettes' }, 'Ouvrir le générateur d’étiquettes'))));
}

// ───────── Années
function annees() {
  const ys = model.years();
  return h('div', { class: 'stack' },
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => yearDialog(null) }, icon('plus', 16), 'Nouvelle année scolaire'),
      h('button', { class: 'btn', type: 'button', 'data-testid': 'archive-consult', onclick: () => openArchiveDialog() }, 'Consulter une archive')),
    h('p', { class: 'muted small' }, 'Fin d’année : « Archiver » range l’année de côté (elle reste consultable ici). Pour libérer la place, « Archiver dans un fichier » enregistre toute l’année dans un fichier vérifié, puis la retire de l’appareil.'),
    ys.length ? ys.map(y => h('div', { class: 'card', 'data-testid': 'year-card' },
      h('div', { class: 'card-head' },
        h('h2', {}, y.label, ' ', demoBadge(y), y.archived ? badge('Archivée', 'muted') : null, y.zone ? badge(`Zone ${y.zone}`) : null),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: () => yearDialog(y) }, icon('edit', 16), 'Modifier'),
          h('button', { class: 'btn', type: 'button', onclick: async () => {
            await store.update(y.id, { archived: !y.archived }, y.archived ? 'Désarchivage d’une année' : 'Archivage d’une année');
          } }, y.archived ? 'Désarchiver' : 'Archiver'),
          y.archived ? h('button', { class: 'btn', type: 'button', 'data-testid': 'archive-file', onclick: () => archiveDialog(y) }, icon('download', 16), 'Archiver dans un fichier…') : null,
          h('button', { class: 'btn btn-ghost-danger', type: 'button', onclick: async () => {
            const n = model.classesOfYear(y.id).length;
            if (!await confirmDialog('Mettre l’année à la corbeille ?', `${y.label}${n ? ` contient ${n} classe(s), qui resteront dans la base mais ne seront plus accessibles depuis le sélecteur.` : ''} Vous pourrez la restaurer depuis la corbeille.`, { confirmLabel: 'Mettre à la corbeille', danger: true })) return;
            await store.remove(y.id, `Année ${y.label} mise à la corbeille`);
            toast('Année mise à la corbeille', { action: 'Annuler', onAction: () => store.undo() });
          } }, icon('trash', 16)))),
      h('p', { class: 'muted' }, `Du ${model.frDate(y.start)} au ${model.frDate(y.end)}`, y.source ? ` · Calendrier : ${y.source}` : ''),
      h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Période'), h('th', {}, 'Début'), h('th', {}, 'Fin'))),
        h('tbody', {}, (y.periods || []).map(p => h('tr', {}, h('td', {}, p.name), h('td', {}, model.frDate(p.start)), h('td', {}, model.frDate(p.end)))))),
      (y.noSchoolDays || []).length ? h('p', { class: 'muted' }, 'Jours sans classe : ', y.noSchoolDays.map(d => `${model.frDate(d.date)} (${d.label})`).join(', ')) : null,
    )) : emptyState('Aucune année scolaire', 'Créez votre première année. Un préréglage du calendrier officiel 2026-2027 (zone C) est disponible.'));
}

function yearDialog(year) {
  const editing = !!year;
  const preset = model.PRESETS['zoneC-2026-2027'];
  let periods = editing ? structuredClone(year.periods || []) : [];
  const presetSel = h('select', { name: 'preset' },
    h('option', { value: 'zoneC-2026-2027' }, 'Calendrier officiel 2026-2027 — zone C (Créteil, Paris, Versailles…)'),
    h('option', { value: '' }, 'Saisie manuelle'));
  const label = h('input', { name: 'label', required: true, value: editing ? year.label : preset.label });
  const start = h('input', { name: 'start', type: 'date', required: true, value: editing ? year.start : preset.start });
  const end = h('input', { name: 'end', type: 'date', required: true, value: editing ? year.end : preset.end });
  const tbody = h('tbody');
  const errors = h('div', { class: 'form-errors', role: 'alert' });

  const drawPeriods = () => {
    tbody.replaceChildren(...periods.map((p, i) => h('tr', {},
      h('td', {}, h('input', { value: p.name, 'aria-label': 'Nom de la période', oninput: (e) => { p.name = e.target.value; } })),
      h('td', {}, h('input', { type: 'date', value: p.start, 'aria-label': 'Début', oninput: (e) => { p.start = e.target.value; } })),
      h('td', {}, h('input', { type: 'date', value: p.end, 'aria-label': 'Fin', oninput: (e) => { p.end = e.target.value; } })),
      h('td', {}, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retirer la période', onclick: () => { periods.splice(i, 1); drawPeriods(); } }, icon('x', 16))))));
  };
  const applyPreset = () => {
    if (presetSel.value) {
      label.value = preset.label; start.value = preset.start; end.value = preset.end;
      periods = preset.periods.map(p => ({ ...p, id: store.uid() }));
    } else {
      periods = [1, 2, 3, 4, 5].map(n => ({ id: store.uid(), name: `Période ${n}`, start: '', end: '' }));
    }
    drawPeriods();
  };
  presetSel.addEventListener('change', applyPreset);
  if (!editing) applyPreset(); else drawPeriods();

  const body = h('div', { class: 'form' },
    editing ? null : field('Point de départ', presetSel, 'Dates issues de service-public.gouv.fr (consulté le 19/10/2026). Vérifiez-les et modifiez-les si besoin.'),
    h('div', { class: 'grid-3' }, field('Nom', label), field('Début', start), field('Fin', end)),
    h('h3', {}, 'Périodes'),
    h('table', { class: 'table table-edit' }, h('thead', {}, h('tr', {}, h('th', {}, 'Nom'), h('th', {}, 'Début'), h('th', {}, 'Fin'), h('th', {}, ''))), tbody),
    h('button', { class: 'btn', type: 'button', onclick: () => { periods.push({ id: store.uid(), name: `Période ${periods.length + 1}`, start: '', end: '' }); drawPeriods(); } }, icon('plus', 16), 'Ajouter une période'),
    errors);

  modal({ title: editing ? `Modifier ${year.label}` : 'Nouvelle année scolaire', body, wide: true, actions: [
    { label: 'Annuler' },
    { label: 'Enregistrer', primary: true, onClick: async () => {
      const errs = validateYear(label.value.trim(), start.value, end.value, periods);
      if (errs.length) { errors.replaceChildren(...errs.map(e => h('p', {}, e))); return false; }
      const data = { label: label.value.trim(), start: start.value, end: end.value, periods: periods.map(p => ({ ...p, name: p.name.trim() })) };
      if (editing) await store.update(year.id, data, `Modification de l’année ${data.label}`);
      else {
        if (presetSel.value) Object.assign(data, { zone: preset.zone, source: preset.source, noSchoolDays: preset.noSchoolDays });
        const y = await store.create('year', data, `Création de l’année ${data.label}`);
        await store.setSettings({ currentYearId: y.id, currentClassId: null });
      }
      toast('Année enregistrée');
    } }] });
}

export function validateYear(label, start, end, periods) {
  const errs = [];
  if (!label) errs.push('Le nom de l’année est obligatoire.');
  if (!start || !end) errs.push('Les dates de début et de fin sont obligatoires.');
  else if (start > end) errs.push('La date de fin doit suivre la date de début.');
  const ps = periods.slice().sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  ps.forEach((p) => {
    if (!p.name.trim()) errs.push('Chaque période doit avoir un nom.');
    if (!p.start || !p.end) errs.push(`${p.name || 'Une période'} : dates manquantes.`);
    else {
      if (p.start > p.end) errs.push(`${p.name} : la fin précède le début.`);
      if (start && end && (p.start < start || p.end > end)) errs.push(`${p.name} : en dehors des dates de l’année.`);
    }
  });
  for (let i = 1; i < ps.length; i++) if (ps[i].start && ps[i - 1].end && ps[i].start <= ps[i - 1].end) errs.push(`${ps[i - 1].name} et ${ps[i].name} se chevauchent.`);
  return [...new Set(errs)];
}

// ───────── Classes
function classes() {
  const y = model.currentYear();
  if (!y) return emptyState('Aucune année sélectionnée', 'Créez d’abord une année scolaire.', h('a', { class: 'btn btn-primary', href: '#/reglages/annees' }, 'Créer une année'));
  const cs = model.classesOfYear(y.id);
  return h('div', { class: 'stack' },
    h('p', { class: 'muted' }, `Classes de l’année ${y.label}.`),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => classDialog(null, y) }, icon('plus', 16), 'Nouvelle classe')),
    cs.length ? cs.map(c => {
      const n = model.studentsOfClass(c.id).length;
      return h('div', { class: 'card', 'data-testid': 'class-card' },
        h('div', { class: 'card-head' }, h('h2', {}, c.name, ' ', demoBadge(c)),
          h('div', { class: 'row' },
            h('button', { class: 'btn', type: 'button', onclick: () => classDialog(c, y) }, icon('edit', 16), 'Modifier'),
            h('button', { class: 'btn btn-ghost-danger', type: 'button', 'aria-label': 'Mettre la classe à la corbeille', onclick: async () => {
              if (!await confirmDialog('Mettre la classe à la corbeille ?', `${c.name} (${n} élève(s) inscrit(s)). Les élèves et leurs inscriptions sont conservés ; vous pourrez restaurer la classe depuis la corbeille.`, { confirmLabel: 'Mettre à la corbeille', danger: true })) return;
              await store.remove(c.id, `Classe ${c.name} mise à la corbeille`);
              toast('Classe mise à la corbeille', { action: 'Annuler', onAction: () => store.undo() });
            } }, icon('trash', 16)))),
        h('dl', { class: 'dl' },
          h('dt', {}, 'Niveaux'), h('dd', {}, (c.levels || []).join(', ') || '—', ' · ', model.cycleLabel(c.levels)),
          h('dt', {}, 'École'), h('dd', {}, c.school || '—'),
          h('dt', {}, 'Service'), h('dd', {}, [c.service?.type, c.service?.detail].filter(Boolean).join(' — ') || '—'),
          h('dt', {}, 'Binôme'), h('dd', {}, [c.binome?.name, c.binome?.detail].filter(Boolean).join(' — ') || '—'),
          h('dt', {}, 'Élèves inscrits aujourd’hui'), h('dd', {}, String(n))));
    }) : emptyState('Aucune classe', 'Créez votre classe pour inscrire des élèves.'));
}

function classDialog(c, year) {
  const editing = !!c;
  const levels = new Set(editing ? c.levels : ['CE2']);
  const classDays = new Set(model.classDays(c));
  const serviceDays = new Set(editing ? c.serviceDays || [] : []);
  const cyc = h('span', { class: 'muted' });
  const updCycle = () => { cyc.textContent = `Cycle déduit : ${model.cycleLabel([...levels])}`; };
  updCycle();
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Nom de la classe', h('input', { name: 'name', required: true, maxlength: 60, value: editing ? c.name : '', placeholder: 'ex. CE2 B' })),
    h('fieldset', {}, h('legend', {}, 'Niveaux (plusieurs possibles pour une classe multiniveau)'),
      h('div', { class: 'chips' }, model.NIVEAUX.map(l => h('label', { class: 'chip' },
        h('input', { type: 'checkbox', checked: levels.has(l), onchange: (e) => { e.target.checked ? levels.add(l) : levels.delete(l); updCycle(); } }), l))),
      cyc),
    field('École', h('input', { name: 'school', value: editing ? c.school || '' : '' })),
    h('div', { class: 'grid-2' },
      field('Service', h('select', { name: 'serviceType' }, ['temps plein', 'mi-temps', 'temps partiel', 'complément de service', 'autre'].map(t => h('option', { value: t, selected: (editing ? c.service?.type : 'mi-temps') === t }, t)))),
      field('Jours ou détails du service', h('input', { name: 'serviceDetail', value: editing ? c.service?.detail || '' : '', placeholder: 'ex. lundi, mardi' }))),
    h('div', { class: 'grid-2' },
      field('Binôme (prénom, nom)', h('input', { name: 'binomeName', value: editing ? c.binome?.name || '' : '' })),
      field('Jours de la binôme', h('input', { name: 'binomeDetail', value: editing ? c.binome?.detail || '' : '' }))),
    h('fieldset', {}, h('legend', {}, 'Jours de classe'), h('div', { class: 'chips' }, [1, 2, 3, 4, 5, 6].map(d => h('label', { class: 'chip' },
      h('input', { type: 'checkbox', checked: classDays.has(d), onchange: (e) => { e.target.checked ? classDays.add(d) : classDays.delete(d); } }), model.JOURS[d])))),
    h('fieldset', {}, h('legend', {}, 'Mes jours dans cette classe (vide = tous)'), h('div', { class: 'chips' }, [1, 2, 3, 4, 5, 6].map(d => h('label', { class: 'chip' },
      h('input', { type: 'checkbox', checked: serviceDays.has(d), onchange: (e) => { e.target.checked ? serviceDays.add(d) : serviceDays.delete(d); } }), model.JOURS[d]))),
      h('small', { class: 'hint' }, 'Les autres jours sont signalés « jour de la binôme » dans le cahier journal.')),
    h('p', { class: 'muted' }, 'Informations de référence. Pour échanger avec la binôme : Organisation › Transmissions (copie, impression, ou dépôt dans un dossier Nuage partagé avec elle).'));
  const errors = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: editing ? `Modifier ${c.name}` : 'Nouvelle classe', body: h('div', {}, form, errors), wide: true, actions: [
    { label: 'Annuler' },
    { label: 'Enregistrer', primary: true, onClick: async () => {
      const d = formData(form);
      if (!d.name) { errors.textContent = 'Le nom est obligatoire.'; return false; }
      if (!levels.size) { errors.textContent = 'Choisissez au moins un niveau.'; return false; }
      if (!classDays.size) { errors.textContent = 'Choisissez au moins un jour de classe.'; return false; }
      const data = { name: d.name, school: d.school, levels: model.sortLevels([...levels]), service: { type: d.serviceType, detail: d.serviceDetail }, binome: { name: d.binomeName, detail: d.binomeDetail },
        classDays: [...classDays].sort(), serviceDays: [...serviceDays].sort() };
      if (editing) await store.update(c.id, data, `Modification de la classe ${d.name}`);
      else {
        const created = await store.create('class', { ...data, yearId: year.id }, `Création de la classe ${d.name}`);
        await store.setSettings({ currentClassId: created.id });
      }
      toast('Classe enregistrée');
    } }] });
}

// ───────── Modules
function modules() {
  const hidden = new Set(store.getSettings().hiddenModules || []);
  const toggle = async (key, on) => {
    const cur = new Set(store.getSettings().hiddenModules || []);
    on ? cur.delete(key) : cur.add(key);
    await store.setSettings({ hiddenModules: [...cur] });
  };
  return h('div', { class: 'stack' },
    h('p', { class: 'muted' }, 'Masquer un module le retire de la navigation, des favoris et de la recherche. Aucune donnée n’est effacée : réaffichez-le pour la retrouver.'),
    RUBRIQUES.map(r => h('div', { class: 'card' },
      h('label', { class: 'switch-row' },
        h('input', { type: 'checkbox', checked: !hidden.has(r.id), disabled: r.id === 'aujourdhui', 'data-testid': `mod-${r.id}`, onchange: (e) => toggle(r.id, e.target.checked) }),
        h('strong', {}, r.titre), r.id === 'aujourdhui' ? h('span', { class: 'muted' }, ' (toujours visible)') : null),
      h('div', { class: 'chips' }, r.sous.map(s => h('label', { class: 'chip' },
        h('input', { type: 'checkbox', checked: !hidden.has(`${r.id}/${s.id}`), disabled: hidden.has(r.id) || s.route === 'aujourdhui', onchange: (e) => toggle(`${r.id}/${s.id}`, e.target.checked) }),
        s.titre, s.route ? null : h('span', { class: 'later-tag' }, `ét. ${s.etape}`)))))));
}

// ───────── Sauvegarde
async function sauvegarde() {
  const s = store.getSettings();
  let persisted = null, estimate = null;
  try { persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null; } catch { /* inconnu */ }
  try { estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null; } catch { /* inconnu */ }
  const days = s.lastBackupAt ? Math.floor((Date.now() - new Date(s.lastBackupAt)) / 86400000) : null;

  const exportBtn = h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'export-backup', onclick: async () => {
    exportBtn.disabled = true;
    try {
      const b = await backup.buildBackup();
      download(backup.backupFilename(), JSON.stringify(b), 'application/json');
      await store.setSettings({ lastBackupAt: new Date().toISOString() });
      toast(`Sauvegarde exportée : ${b.counts.records} éléments, ${b.counts.blobs} fichier(s).`, { kind: 'success' });
    } catch (e) { toast(`Échec de l’export : ${e.message}`, { kind: 'error' }); }
    finally { exportBtn.disabled = false; }
  } }, icon('download', 16), 'Exporter une sauvegarde complète');

  const restoreBtn = h('button', { class: 'btn', type: 'button', 'data-testid': 'restore-backup', onclick: async () => {
    const [file] = await pickFiles({ accept: '.json,application/json', multiple: false });
    if (!file) return;
    let parsed;
    try { parsed = await backup.readBackup(file); }
    catch (e) { modal({ title: 'Restauration impossible', body: h('p', {}, e.message), actions: [{ label: 'Fermer', primary: true }] }); return; }
    const labels = { year: 'année(s)', class: 'classe(s)', student: 'élève(s)', enrollment: 'inscription(s)', file: 'fichier(s) / lien(s)', folder: 'dossier(s)', inbox: 'élément(s) à classer' };
    modal({ title: 'Restaurer cette sauvegarde ?', wide: true, body: h('div', {},
      h('p', {}, `Sauvegarde du ${model.frDateTime(parsed.header.exportedAt)} (format ${parsed.header.schemaVersion}, application ${parsed.header.appVersion}). Empreinte de contrôle vérifiée.`),
      h('ul', {}, Object.entries(parsed.byType).map(([t, n]) => h('li', {}, `${n} ${labels[t] || t}`)), h('li', {}, `${parsed.counts.blobs} contenu(s) de fichier`)),
      h('p', { class: 'warn' }, 'Toutes les données actuelles de cet appareil seront remplacées. Si vous voulez les garder, exportez d’abord une sauvegarde.')),
    actions: [
      { label: 'Annuler' },
      { label: 'Exporter l’état actuel d’abord', onClick: async () => { const b = await backup.buildBackup(); download(backup.backupFilename(), JSON.stringify(b), 'application/json'); return false; } },
      { label: 'Remplacer et restaurer', danger: true, onClick: async () => {
        try {
          const r = await backup.restoreBackup(parsed);
          toast(`Restauration vérifiée : ${r.records} éléments et ${r.blobs} fichier(s) relus correctement.`, { kind: 'success', timeout: 9000 });
        } catch (e) { toast(e.message, { kind: 'error', timeout: 0 }); }
      } }] });
  } }, icon('upload', 16), 'Restaurer une sauvegarde…');

  return h('div', { class: 'stack' },
    h('div', { class: 'card' },
      h('h2', {}, 'Où sont vos données ?'),
      h('p', {}, h('strong', {}, 'Dans ce navigateur, sur cet appareil uniquement.'), ' Elles restent après la fermeture, mais ne sont ni copiées en ligne ni synchronisées avec vos autres appareils.'),
      h('ul', {},
        h('li', {}, 'Stockage protégé contre le nettoyage automatique : ', persisted === true ? badge('oui', 'ok') : persisted === false ? badge('non accordé par le navigateur', 'warn') : badge('inconnu', 'muted'),
          persisted === false ? h('span', { class: 'muted' }, ' — installez l’application (icône sur l’écran d’accueil) ou exportez régulièrement.') : null),
        estimate ? h('li', {}, `Espace utilisé : ${formatSize(estimate.usage)}${estimate.quota ? ` sur ${formatSize(estimate.quota)} disponibles pour le site` : ''}`) : null,
        h('li', {}, 'Dernière sauvegarde exportée : ', s.lastBackupAt ? `${model.frDateTime(s.lastBackupAt)}${days > 7 ? ` (il y a ${days} jours)` : ''}` : h('strong', {}, 'jamais'))),
      h('p', { class: 'muted' }, 'Effacer les données du site dans le navigateur, ou désinstaller le navigateur, supprime ces données. La sauvegarde exportée est votre filet de sécurité : rangez-la sur une clé USB ou un espace en ligne de votre choix.')),
    h('div', { class: 'card' },
      h('h2', {}, 'Sauvegarde complète'),
      h('p', {}, 'Un seul fichier .json contenant toutes les données, les fichiers déposés et l’historique, avec une empreinte de contrôle. Il peut être restauré sur cet appareil ou un autre.'),
      h('div', { class: 'row' }, exportBtn, restoreBtn)),
    h('div', { class: 'card' },
      h('h2', {}, 'Synchronisation entre appareils'),
      h('p', {}, 'Par Nuage (apps.education.fr, gratuit, serveurs du ministère), avec un fichier chiffré par mot de passe : ', h('a', { href: '#/reglages/synchro' }, 'Réglages › Synchronisation (Nuage)'), '. Aucun service payant, aucun serveur propre à l’application.')),
    h('div', { class: 'card danger-zone' },
      h('h2', {}, 'Tout effacer sur cet appareil'),
      h('p', {}, 'Supprime définitivement toutes les données de l’application dans ce navigateur.'),
      h('button', { class: 'btn btn-danger', type: 'button', onclick: async () => {
        if (!await confirmDialog('Tout effacer ?', 'Toutes les années, classes, élèves, fichiers et l’historique de cet appareil seront supprimés définitivement. Avez-vous exporté une sauvegarde ?', { confirmLabel: 'Continuer', danger: true })) return;
        if (!await confirmDialog('Confirmation finale', 'Cette action est irréversible.', { confirmLabel: 'Tout effacer définitivement', danger: true })) return;
        await backup.wipeAll();
        toast('Toutes les données de cet appareil ont été effacées.');
      } }, 'Tout effacer…')));
}

// ───────── Rappels et agenda
async function rappelsTab() {
  const R = await import('../rappels.js');
  const p = R.prefs();
  const set = (k, v) => store.setSettings({ reminders: { ...R.prefs(), [k]: v } }, { quiet: true });
  const chk = (k, label) => h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: !!p[k], 'data-testid': `rem-${k}`, onchange: (e) => set(k, e.target.checked) }), label);
  const perm = R.canNotify() ? Notification.permission : 'indisponible';
  return h('div', { class: 'stack' },
    h('section', { class: 'card stack' }, h('h2', {}, 'Rappels'),
      chk('tasks', 'Tâches du jour ou en retard'), chk('rdv', 'Rendez-vous avec les familles'), chk('events', 'Événements de l’agenda'), chk('prep', 'La veille à partir de 15 h : séances de demain sans fiche'),
      h('label', { class: 'inline' }, 'Prévenir', h('input', { type: 'number', min: 0, max: 240, value: p.before, style: { width: '5em' }, onchange: (e) => set('before', Number(e.target.value) || 0) }), 'minutes avant'),
      h('p', { class: 'muted small' }, 'Ces rappels s’affichent quand l’application est ouverte (bandeau, et notification du système si vous l’autorisez). Une application web ne peut pas sonner quand elle est fermée sans passer par un serveur : pour cela, envoyez vos rendez-vous vers l’agenda de votre téléphone (ci-dessous), c’est lui qui sonnera.'),
      h('div', { class: 'row' }, perm === 'granted' ? badge('notifications autorisées', 'ok') : perm === 'denied' ? badge('notifications refusées dans le navigateur', 'warn') : perm === 'indisponible' ? badge('notifications non disponibles sur ce navigateur', 'muted')
        : h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'rem-permission', onclick: async () => { await R.askPermission(); location.reload(); } }, 'Autoriser les notifications'))),
    h('section', { class: 'card stack' }, h('h2', {}, 'Vers l’agenda de mon téléphone ou de mon ordinateur'),
      h('p', {}, 'Crée un fichier .ics (format standard) avec les événements, rendez-vous et tâches à venir, et leurs alertes. Ouvrez-le avec l’Agenda (iPhone, Android, Outlook, Thunderbird, Agenda d’apps.education.fr…). Refaites l’export après des changements : les éléments déjà importés sont mis à jour, pas dupliqués.'),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'rem-ics', onclick: () => R.exportIcs() }, 'Exporter l’agenda (.ics)')),
      h('p', { class: 'muted small' }, 'Pour un rendez-vous, seul le prénom de l’élève figure dans le fichier. Rien de confidentiel n’y est mis.')));
}

// ───────── Connexions
function connexions() {
  const rows = [
    ['Synchronisation entre appareils', 'Par Nuage (apps.education.fr)', 'ok', 'Fichier chiffré par appareil, fusion élément par élément (Réglages › Synchronisation).'],
    ['Google Drive', 'Non développé', 'muted', 'Les liens Drive s’enregistrent et s’ouvrent depuis Fichiers, sans connexion.'],
    ['Canva', 'Non développé', 'muted', 'Les liens Canva s’enregistrent et s’ouvrent depuis Fichiers.'],
    ['Agendas externes', 'Export .ics', 'ok', 'Réglages › Rappels et agenda, ou Agenda › « Vers mon agenda ».'],
    ['LSU', 'Export tableau', 'ok', 'Livrets et bilans › Exporter les appréciations. Import direct réservé aux éditeurs validés par le ministère.'],
    ['IA', 'Sur l’appareil seulement', 'muted', 'Si le navigateur (Chrome) propose son IA intégrée en français : boutons « Simplifier » / « Reformuler ». Aucune IA en ligne.'],
    ['Mail académique', 'Non développé', 'muted', 'Dépend du fournisseur et des accès autorisés : à vérifier avant développement.'],
    ['Communication avec les familles', 'Par l’ENT de l’école', 'ok', 'Familles › Publications, Messages, Rendez-vous, Documents, Aperçu parent : préparé ici, diffusé sur l’ENT (comptes parents et droits gérés par l’ENT).'],
  ];
  return h('div', { class: 'stack' },
    h('p', { class: 'muted' }, 'Aucune connexion externe n’est active. Aucun mot de passe n’est demandé ni stocké par l’application.'),
    h('div', { class: 'card' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Service'), h('th', {}, 'Statut'), h('th', {}, 'Alternative disponible maintenant'))),
      h('tbody', {}, rows.map(([n, st, k, alt]) => h('tr', {}, h('td', {}, n), h('td', {}, badge(st, k)), h('td', {}, alt)))))));
}

// ───────── Historique
async function historique() {
  const log = await store.auditLog(300);
  const typeLabel = { year: 'Année', class: 'Classe', student: 'Élève', enrollment: 'Inscription', file: 'Fichier', folder: 'Dossier', inbox: 'Réception', referential: 'Référentiel', attendance: 'Appel', serviceplan: 'Services', serviceexc: 'Exception de service', studentdoc: 'Document élève', observation: 'Observation', levelmark: 'Niveau', aid: 'Aide', portfolio: 'Portfolio', need: 'Besoin particulier', plan: 'Dispositif', publication: 'Publication', recreplan: 'Surveillances de récréation', rdvslot: 'Créneau de rendez-vous', infoconf: 'Informations confidentielles', studentinfo: 'Informations de l’année', incident: 'Rapport d’incident', soin: 'Registre de soins', aeshsheet: 'Fiche AESH', familynote: 'Mot aux familles', rewardjar: 'Pot de récompense', exchange: 'Échange', list: 'Liste', evaluation: 'Évaluation', report: 'Bilan de période', catchup: 'Rattrapage', layout: 'Plan de classe', groupset: 'Groupes', jobs: 'Responsabilités', book: 'Livre', loan: 'Prêt', slideshow: 'Diaporama', programmation: 'Programmation', notion: 'Notion', progression: 'Progression', sequence: 'Séquence', session: 'Fiche de séance', occurrence: 'Cahier journal', timetable: 'Emploi du temps', intervention: 'Intervention', event: 'Événement', task: 'Tâche', homework: 'Devoir', lesson: 'Leçon', manual: 'Manuel', lot: 'Lot' };
  return h('div', { class: 'stack' },
    h('p', { class: 'muted' }, 'Les 300 dernières modifications, avec leur auteur. Le bouton « Annuler » du haut de l’écran revient sur les dernières actions de cette session.'),
    log.length ? h('div', { class: 'card' }, h('table', { class: 'table', 'data-testid': 'audit-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Auteur'), h('th', {}, 'Action'), h('th', {}, 'Élément'))),
      h('tbody', {}, log.map(a => h('tr', {}, h('td', {}, model.frDateTime(a.at)), h('td', {}, a.author), h('td', {}, a.label), h('td', {}, typeLabel[a.recordType] || a.recordType || '')))))) : emptyState('Aucune modification enregistrée'));
}

// ───────── Corbeille
function corbeille() {
  const items = store.trash();
  const name = (r) => r.name || r.label || r.title || (r.firstName ? `${r.firstName} ${r.lastName || ''}` : null) || r.text?.slice(0, 40) || (r.type === 'occurrence' ? `${r.subject || 'Séance'} du ${model.frShort(r.date)}` : r.type);
  const typeLabel = { year: 'Année', class: 'Classe', student: 'Élève', enrollment: 'Inscription', file: 'Fichier', folder: 'Dossier', inbox: 'Réception', referential: 'Référentiel', attendance: 'Appel', serviceplan: 'Services', serviceexc: 'Exception de service', studentdoc: 'Document élève', observation: 'Observation', levelmark: 'Niveau', aid: 'Aide', portfolio: 'Portfolio', need: 'Besoin particulier', plan: 'Dispositif', infoconf: 'Informations confidentielles', studentinfo: 'Informations de l’année', incident: 'Rapport d’incident', soin: 'Registre de soins', aeshsheet: 'Fiche AESH', familynote: 'Mot aux familles', rewardjar: 'Pot de récompense', exchange: 'Échange', list: 'Liste', evaluation: 'Évaluation', report: 'Bilan de période', catchup: 'Rattrapage', layout: 'Plan de classe', groupset: 'Groupes', jobs: 'Responsabilités', book: 'Livre', loan: 'Prêt', slideshow: 'Diaporama', programmation: 'Programmation', notion: 'Notion', progression: 'Progression', sequence: 'Séquence', session: 'Fiche de séance', occurrence: 'Cahier journal', timetable: 'Emploi du temps', intervention: 'Intervention', event: 'Événement', task: 'Tâche', homework: 'Devoir', lesson: 'Leçon', manual: 'Manuel' };
  return h('div', { class: 'stack' },
    h('p', { class: 'muted' }, 'Les éléments supprimés restent ici jusqu’à leur suppression définitive. Ils sont exclus de la recherche et des listes.'),
    items.length ? h('div', { class: 'card' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Élément'), h('th', {}, 'Type'), h('th', {}, 'Supprimé le'), h('th', {}, ''))),
      h('tbody', {}, items.map(r => h('tr', {},
        h('td', {}, name(r)), h('td', {}, typeLabel[r.type] || r.type), h('td', {}, `${model.frDateTime(r.deletedAt)} par ${r.deletedBy || '?'}`),
        h('td', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: async () => { await store.restore(r.id); toast('Élément restauré'); } }, 'Restaurer'),
          h('button', { class: 'btn btn-ghost-danger', type: 'button', onclick: async () => {
            if (!await confirmDialog('Supprimer définitivement ?', `« ${name(r)} » sera effacé sans retour possible (sauf depuis une sauvegarde exportée).`, { confirmLabel: 'Supprimer définitivement', danger: true })) return;
            await store.purge(r.id); toast('Supprimé définitivement');
          } }, 'Supprimer définitivement'))))))) : emptyState('La corbeille est vide'));
}

// ───────── Démonstration
function demoTab() {
  const has = demo.hasDemo();
  return h('div', { class: 'stack' }, h('div', { class: 'card' },
    h('h2', {}, 'Données fictives de démonstration'),
    h('p', {}, 'Pour essayer l’application : une classe « CE2 (démo) » de 12 élèves aux noms inventés, responsables fictifs (téléphones 06 00 00 00 xx, adresses en .invalid), une arrivée en novembre et un départ fin octobre ; un emploi du temps, une programmation et une séquence de maths d’exemple, deux séances au cahier journal (2 et 3 novembre), une sortie le 5 novembre qui crée un conflit, une intervention à partir du 16 novembre. Une seconde classe « CE1-CE2 (démo) » montre le multiniveau. Tout est marqué « Démo » ou « exemple ».'),
    has ? h('p', {}, badge('Chargées', 'ok')) : null,
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary', type: 'button', disabled: has, 'data-testid': 'load-demo', onclick: async () => {
        try { await demo.loadDemo(); toast('Données de démonstration chargées'); } catch (e) { toast(e.message, { kind: 'error' }); }
      } }, 'Charger les données fictives'),
      h('button', { class: 'btn btn-ghost-danger', type: 'button', disabled: !has, 'data-testid': 'remove-demo', onclick: async () => {
        if (!await confirmDialog('Retirer les données de démonstration ?', 'Seuls les éléments marqués « Démo » sont supprimés définitivement. Vos propres données ne sont pas touchées.', { confirmLabel: 'Retirer', danger: true })) return;
        const n = await demo.removeDemo(); toast(`${n} élément(s) de démonstration retiré(s)`);
      } }, 'Retirer les données fictives'))));
}

// ───────── Documents des élèves, services et confidentialité
function documents() {
  const st = store.getSettings();
  const docs = (Array.isArray(st.docTemplates) && st.docTemplates.length ? st.docTemplates : E.DEFAULT_DOCS);
  const docsTa = h('textarea', { rows: 7, 'data-testid': 'doc-templates' }, docs.map(d => `${d.category === 'autorisation' ? 'A' : 'D'}${d.validity ? '+' : ''} ${d.label}`).join('\n'));
  const usagesTa = h('textarea', { rows: 5 }, (Array.isArray(st.imageUsages) && st.imageUsages.length ? st.imageUsages : E.DEFAULT_IMAGE_USAGES).join('\n'));
  const svcTa = h('textarea', { rows: 4 }, V.services().join('\n'));
  const pin = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'new-password', placeholder: C.hasPin() ? 'nouveau code' : 'code (4 chiffres ou plus)', 'data-testid': 'set-pin' });
  return h('div', { class: 'stack' },
    h('div', { class: 'card form' }, h('h2', {}, 'Documents et autorisations demandés chaque année'),
      h('p', { class: 'muted small' }, 'Une ligne par élément. Commencez par « D » pour un document, « A » pour une autorisation ; ajoutez « + » pour une date de validité (ex. « D+ Attestation d’assurance »). Les états déjà saisis sont conservés.'),
      docsTa,
      h('h3', {}, 'Usages pour le droit à l’image'), usagesTa,
      h('label', { class: 'inline' }, 'Usage vérifié pour les publications aux familles', h('select', { 'data-testid': 'pub-usage', onchange: (e) => store.setSettings({ publicationUsage: e.target.value }, { quiet: true }) },
        (Array.isArray(st.imageUsages) && st.imageUsages.length ? st.imageUsages : E.DEFAULT_IMAGE_USAGES).map(u => h('option', { value: u, selected: (st.publicationUsage || E.DEFAULT_IMAGE_USAGES.find(x => /ENT/.test(x))) === u }, u)))),
      h('h3', {}, 'Services (cantine, étude, garderie…)'), svcTa,
      h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
        const lines = docsTa.value.split('\n').map(l => l.trim()).filter(Boolean);
        const templates = lines.map(l => { const m = l.match(/^([DA])(\+)?\s+(.*)$/i); const label = m ? m[3].trim() : l; const prev = docs.find(d => d.label === label);
          return { id: prev?.id || label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-'), label, category: m && m[1].toUpperCase() === 'A' ? 'autorisation' : 'document', validity: !!(m && m[2]) }; });
        await store.setSettings({ docTemplates: templates, imageUsages: usagesTa.value.split('\n').map(x => x.trim()).filter(Boolean), services: svcTa.value.split('\n').map(x => x.trim()).filter(Boolean) });
        toast('Listes enregistrées');
      } }, 'Enregistrer'))),
    h('div', { class: 'card form' }, h('h2', {}, 'Informations confidentielles'),
      h('p', {}, 'Besoins particuliers, PPRE/PAP/PPS/PAI/AESH et santé sont masqués par défaut, jamais affichés dans la recherche ni en projection, et exclus des exports par défaut.'),
      h('p', { class: 'warn' }, 'Sur cet appareil, il s’agit d’un masquage d’affichage, pas d’un chiffrement : toute personne ayant accès à votre session de navigateur pourrait lire la sauvegarde. Protégez aussi l’appareil par son code de verrouillage. Les fichiers déposés dans Nuage, eux, sont chiffrés par votre mot de passe de synchronisation.'),
      field(C.hasPin() ? 'Changer le code' : 'Définir un code (facultatif)', pin),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { if (pin.value.length < 4) { toast('Au moins 4 caractères', { kind: 'error' }); return; } await C.setPin(pin.value); toast('Code enregistré'); } }, 'Enregistrer le code'),
        C.hasPin() ? h('button', { class: 'btn btn-ghost-danger', type: 'button', onclick: async () => { await C.setPin(''); toast('Code retiré'); } }, 'Retirer le code') : null)));
}

// ───────── Reprise d'une année précédente
function reprise() {
  const cls = model.currentClass();
  if (!cls) return emptyState('Aucune classe sélectionnée', 'Créez d’abord la classe de la nouvelle année.');
  const sources = store.all('class').filter(c => c.id !== cls.id).map(c => ({ c, y: store.get(c.yearId) })).filter(x => x.y && !x.y.deletedAt);
  const what = { programmations: true, sequences: true, lecons: true, edt: false };
  const src = h('select', { 'aria-label': 'Classe source', 'data-testid': 'reprise-source' }, sources.map(({ c, y }) => h('option', { value: c.id }, `${c.name} — ${y.label}`)));
  return h('div', { class: 'stack' }, h('div', { class: 'card' },
    h('h2', {}, `Reprendre des modèles dans ${cls.name}`),
    h('p', {}, 'Copie les modèles d’une autre classe (autre année) dans la classe sélectionnée. Les copies sont indépendantes : modifier l’une ne change pas l’autre.'),
    h('p', { class: 'warn' }, 'Ne sont jamais repris : élèves, cahier journal réalisé, devoirs donnés, résultats, bilans de séquence et de période, paiements, autorisations.'),
    (() => { const n = store.all('loan').filter(l => !l.returnedAt).length; return n ? h('p', { class: 'warn' }, `${n} prêt(s) de livres encore en cours : ils restent ouverts (jamais marqués rendus automatiquement). Voir Ma classe › Bibliothèque.`) : null; })(),
    sources.length ? h('div', { class: 'form' },
      field('Depuis', src),
      h('div', { class: 'chips' }, [['programmations', 'Programmations et notions'], ['sequences', 'Séquences et fiches de séance'], ['lecons', 'Leçons (sans distributions)'], ['edt', 'Emplois du temps']].map(([k, l]) =>
        h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: what[k], onchange: (e) => { what[k] = e.target.checked; } }), l))),
      h('p', { class: 'muted small' }, 'Les périodes sont associées dans l’ordre (P1 → P1…). Manuels, référentiels et fichiers sont déjà communs à toutes les années.'),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'reprise-run', onclick: async () => {
        const n = await P.copyFromClass(src.value, cls.id, what);
        toast(n ? `${n} élément(s) repris dans ${cls.name}` : 'Rien à reprendre.', { action: n ? 'Annuler' : null, onAction: () => store.undo() });
      } }, 'Reprendre')))
      : h('p', { class: 'muted' }, 'Aucune autre classe : la reprise servira à la rentrée suivante, depuis la classe de cette année.')));
}

// ───────── Feuille de route
function feuille() {
  const counts = {};
  for (const r of ROADMAP) counts[r.statut] = (counts[r.statut] || 0) + 1;
  const kind = { fait: 'ok', partiel: 'info', configurer: 'warn', afaire: 'muted' };
  const etapes = { 1: 'Socle', 2: 'Préparation liée', 3: 'Usage en classe', 4: 'Organisation', 5: 'Collaboration et connexions' };
  return h('div', { class: 'stack' },
    h('p', {}, `Tout le périmètre du cahier des charges, suivi fonction par fonction : ${ROADMAP.length} entrées — `,
      Object.entries(STATUTS).map(([k, l]) => [h('span', { class: 'nowrap' }, badge(`${l} : ${counts[k] || 0}`, kind[k])), ' '])),
    Object.entries(etapes).map(([n, t]) => h('div', { class: 'card' },
      h('h2', {}, `Étape ${n} — ${t}`),
      h('table', { class: 'table roadmap' }, h('tbody', {}, ROADMAP.filter(r => String(r.etape) === n).map(r => h('tr', {},
        h('td', { class: 'nowrap muted' }, r.section), h('td', {}, r.titre, r.note ? h('div', { class: 'muted small' }, r.note) : null), h('td', {}, badge(STATUTS[r.statut], kind[r.statut])))))))));
}
