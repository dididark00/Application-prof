import * as store from '../store.js';
import * as model from '../model.js';
import * as backup from '../backup.js';
import * as demo from '../demo.js';
import { ROADMAP, STATUTS, RUBRIQUES } from '../roadmap.js';
import { h, icon, toast, modal, confirmDialog, field, formData, download, pickFiles, formatSize, badge, emptyState } from '../ui.js';
import { pageHeader, demoBadge } from '../components.js';

const TABS = [
  ['general', 'Général'],
  ['annees', 'Années et périodes'],
  ['classes', 'Classes'],
  ['modules', 'Modules'],
  ['sauvegarde', 'Sauvegarde'],
  ['connexions', 'Connexions'],
  ['historique', 'Historique'],
  ['corbeille', 'Corbeille'],
  ['demo', 'Démonstration'],
  ['feuille', 'Feuille de route'],
];

export async function render({ params }) {
  const tab = TABS.some(t => t[0] === params[0]) ? params[0] : 'general';
  const content = await ({ general, annees, classes, modules, sauvegarde, connexions, historique, corbeille, demo: demoTab, feuille })[tab]();
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
    await store.setSettings({ appName: d.appName || 'Classeur', userName: d.userName });
    toast('Réglages enregistrés');
  } },
    h('h2', {}, 'Identité'),
    field('Nom de l’application', h('input', { name: 'appName', value: s.appName, maxlength: 40 }), 'Nom provisoire, modifiable à tout moment.'),
    field('Votre prénom (auteur des modifications)', h('input', { name: 'userName', value: s.userName, maxlength: 60 }), 'Apparaît dans l’historique des modifications.'),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Enregistrer')));
  return h('div', { class: 'stack' }, form,
    h('div', { class: 'card' }, h('h2', {}, 'À propos'),
      h('p', {}, `Version ${backup.APP_VERSION} — étape 1 (socle). Les données sont enregistrées dans ce navigateur, sur cet appareil.`),
      h('p', { class: 'muted' }, 'Service, binôme et niveaux se règlent dans l’onglet Classes. Calendrier et périodes dans Années et périodes.')));
}

// ───────── Années
function annees() {
  const ys = model.years();
  return h('div', { class: 'stack' },
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => yearDialog(null) }, icon('plus', 16), 'Nouvelle année scolaire')),
    ys.length ? ys.map(y => h('div', { class: 'card', 'data-testid': 'year-card' },
      h('div', { class: 'card-head' },
        h('h2', {}, y.label, ' ', demoBadge(y), y.archived ? badge('Archivée', 'muted') : null, y.zone ? badge(`Zone ${y.zone}`) : null),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: () => yearDialog(y) }, icon('edit', 16), 'Modifier'),
          h('button', { class: 'btn', type: 'button', onclick: async () => {
            await store.update(y.id, { archived: !y.archived }, y.archived ? 'Désarchivage d’une année' : 'Archivage d’une année');
          } }, y.archived ? 'Désarchiver' : 'Archiver'),
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
    h('p', { class: 'muted' }, 'Le partage réel avec la binôme (compte, droits) arrive à l’étape 5. Ici, ce sont des informations de référence.'));
  const errors = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: editing ? `Modifier ${c.name}` : 'Nouvelle classe', body: h('div', {}, form, errors), wide: true, actions: [
    { label: 'Annuler' },
    { label: 'Enregistrer', primary: true, onClick: async () => {
      const d = formData(form);
      if (!d.name) { errors.textContent = 'Le nom est obligatoire.'; return false; }
      if (!levels.size) { errors.textContent = 'Choisissez au moins un niveau.'; return false; }
      const data = { name: d.name, school: d.school, levels: model.sortLevels([...levels]), service: { type: d.serviceType, detail: d.serviceDetail }, binome: { name: d.binomeName, detail: d.binomeDetail } };
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
      h('h2', {}, 'Sauvegarde en ligne et synchronisation'),
      h('p', {}, badge('Non configurée', 'warn'), ' La synchronisation automatique entre appareils demande un service en ligne (base de données et authentification). Elle est prévue à l’étape 5, après comparaison des offres gratuites (limites, hébergement des données d’élèves) soumise à votre accord. Aucun service n’est souscrit.')),
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

// ───────── Connexions
function connexions() {
  const rows = [
    ['Sauvegarde en ligne / synchronisation', 'À configurer (étape 5)', 'warn', 'Export/restauration manuels d’une sauvegarde complète (Réglages › Sauvegarde).'],
    ['Google Drive', 'Non développé', 'muted', 'Les liens Drive s’enregistrent et s’ouvrent depuis Fichiers, sans connexion.'],
    ['Canva', 'Non développé', 'muted', 'Les liens Canva s’enregistrent et s’ouvrent depuis Fichiers.'],
    ['Agendas externes', 'Non développé', 'muted', 'Prévu : import/export de fichiers .ics (étape 2).'],
    ['LSU', 'Non développé', 'muted', 'Préparation des bilans prévue à l’étape 3 ; compatibilité d’export à vérifier avant tout développement.'],
    ['Mail académique', 'Non développé', 'muted', 'Dépend du fournisseur et des accès autorisés : à vérifier avant développement.'],
    ['Comptes et portail familles', 'Non développé', 'muted', 'Étape 5, avec contrôle des droits côté serveur.'],
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
  const typeLabel = { year: 'Année', class: 'Classe', student: 'Élève', enrollment: 'Inscription', file: 'Fichier', folder: 'Dossier', inbox: 'Réception', lot: 'Lot' };
  return h('div', { class: 'stack' },
    h('p', { class: 'muted' }, 'Les 300 dernières modifications, avec leur auteur. Le bouton « Annuler » du haut de l’écran revient sur les dernières actions de cette session.'),
    log.length ? h('div', { class: 'card' }, h('table', { class: 'table', 'data-testid': 'audit-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Auteur'), h('th', {}, 'Action'), h('th', {}, 'Élément'))),
      h('tbody', {}, log.map(a => h('tr', {}, h('td', {}, model.frDateTime(a.at)), h('td', {}, a.author), h('td', {}, a.label), h('td', {}, typeLabel[a.recordType] || a.recordType || '')))))) : emptyState('Aucune modification enregistrée'));
}

// ───────── Corbeille
function corbeille() {
  const items = store.trash();
  const name = (r) => r.name || r.label || (r.firstName ? `${r.firstName} ${r.lastName || ''}` : null) || r.text?.slice(0, 40) || r.type;
  const typeLabel = { year: 'Année', class: 'Classe', student: 'Élève', enrollment: 'Inscription', file: 'Fichier', folder: 'Dossier', inbox: 'Réception' };
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
    h('p', {}, 'Pour essayer l’application : une classe « CE2 (démo) » de 12 élèves aux noms inventés, responsables fictifs (téléphones 06 00 00 00 xx, adresses en .invalid), une arrivée en novembre et un départ fin octobre. Tout est marqué « Démo ».'),
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

// ───────── Feuille de route
function feuille() {
  const counts = {};
  for (const r of ROADMAP) counts[r.statut] = (counts[r.statut] || 0) + 1;
  const kind = { fait: 'ok', partiel: 'info', configurer: 'warn', afaire: 'muted' };
  const etapes = { 1: 'Socle', 2: 'Préparation liée', 3: 'Usage en classe', 4: 'Organisation', 5: 'Collaboration et connexions' };
  return h('div', { class: 'stack' },
    h('p', {}, `Tout le périmètre du cahier des charges, suivi fonction par fonction : ${ROADMAP.length} entrées — `,
      Object.entries(STATUTS).map(([k, l]) => h('span', { class: 'nowrap' }, badge(`${l} : ${counts[k] || 0}`, kind[k]), ' '))),
    Object.entries(etapes).map(([n, t]) => h('div', { class: 'card' },
      h('h2', {}, `Étape ${n} — ${t}`),
      h('table', { class: 'table roadmap' }, h('tbody', {}, ROADMAP.filter(r => String(r.etape) === n).map(r => h('tr', {},
        h('td', { class: 'nowrap muted' }, r.section), h('td', {}, r.titre, r.note ? h('div', { class: 'muted small' }, r.note) : null), h('td', {}, badge(STATUTS[r.statut], kind[r.statut])))))))));
}
