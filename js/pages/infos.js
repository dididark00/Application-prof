// Ma classe › Informations élèves : la double page « Informations élèves » de l'agenda,
// remplie automatiquement à partir des fiches (aucune double saisie) et modifiable case par case.
import * as store from '../store.js';
import * as model from '../model.js';
import * as E from '../eleve.js';
import * as V from '../vie.js';
import * as C from '../confidential.js';
import * as I from '../infos.js';
import * as FI from '../finance.js';
import { h, icon, toast, modal, field, confirmDialog, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { printDocument } from '../print.js';

const view = { q: '', only: '' };

export function render({ rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Informations élèves'), subTabs(), missing);
  const today = model.todayIso();
  const students = model.studentsOfClass(cls.id, { includeFuture: true }).map(x => x.student);
  const unlocked = C.isUnlocked();
  const all = I.columns().filter(c => !c.hidden);
  const cols = all.filter(c => !c.sensitive || unlocked);
  const hiddenConf = all.filter(c => c.sensitive && !unlocked).length;

  const tbody = h('tbody');
  const foot = h('tfoot');
  const draw = () => {
    const q = view.q.trim().toLowerCase();
    const list = students.filter(s => !q || `${s.firstName} ${s.lastName}`.toLowerCase().includes(q))
      .filter(s => !view.only || I.cell(cols.find(c => c.key === view.only) || cols[0], s, cls, today).mark === 'oui');
    tbody.replaceChildren(...list.map((s, i) => h('tr', { 'data-testid': 'info-row' },
      h('th', { scope: 'row', class: 'info-name' }, h('span', { class: 'muted small' }, `${i + 1}. `), h('a', { href: `#/eleve/${s.id}` }, `${(s.lastName || '').toUpperCase()} ${s.firstName}`)),
      cols.map(c => cellNode(c, s, cls, today, draw)))));
    foot.replaceChildren(h('tr', {}, h('th', {}, `${list.length} élève(s)`), cols.map(c => {
      const n = list.filter(s => I.cell(c, s, cls, today).mark === 'oui').length;
      return h('td', { class: 'muted small' }, c.kind === 'texte' ? '' : String(n));
    })));
  };
  draw();

  const onlySel = h('select', { 'aria-label': 'Filtrer', 'data-testid': 'info-only', onchange: (e) => { view.only = e.target.value; draw(); } },
    h('option', { value: '' }, 'Tous les élèves'), cols.filter(c => c.kind !== 'texte').map(c => h('option', { value: c.key, selected: view.only === c.key }, `Seulement : ${c.label}`)));

  return h('div', { class: 'page' },
    pageHeader('Informations élèves', { favKey: 'classe/infos', subtitle: cls.name, actions: [
      h('button', { class: 'btn', type: 'button', 'data-testid': 'info-columns', onclick: () => columnsDialog(rerender) }, icon('settings', 16), 'Colonnes'),
      h('button', { class: 'btn', type: 'button', 'data-testid': 'info-print', onclick: () => printDialog(cls, students, today) }, icon('print', 16), 'Imprimer')] }),
    subTabs(),
    h('p', { class: 'muted' }, 'Le tableau de votre agenda, rempli à partir des fiches : changer une case ici met à jour la fiche de l’élève, et inversement. Cliquez sur une case pour la modifier.'),
    h('div', { class: 'row' },
      h('input', { type: 'search', placeholder: 'Chercher un élève', value: view.q, 'aria-label': 'Chercher un élève', oninput: (e) => { view.q = e.target.value; draw(); } }),
      onlySel,
      hiddenConf ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'unlock', onclick: async () => { if (await C.unlock()) rerender(); } }, icon('lock', 14), `Afficher les ${hiddenConf} colonnes confidentielles`)
        : all.some(c => c.sensitive) ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => { C.lock(); rerender(); } }, 'Masquer les colonnes confidentielles') : null),
    students.length ? h('div', { class: 'table-wrap info-wrap' }, h('table', { class: 'table info-table', 'data-testid': 'info-table' },
      h('thead', {}, h('tr', {}, h('th', { class: 'info-name' }, 'Nom et prénom'), cols.map(c => h('th', { title: `${c.label} — ${I.KINDS[c.kind]}`, class: c.sensitive ? 'conf' : '' }, h('span', { class: 'info-vert' }, c.short || c.label))))),
      tbody, foot)) : emptyState('Aucun élève dans la classe'),
    h('p', { class: 'muted small' }, '✓ oui / reçu / autorisé · ✗ refusé ou expiré · ◐ en partie · … à recevoir ou à renseigner. Les colonnes confidentielles (dispositifs, santé, famille) sont masquées tant que vous ne les affichez pas, et ne sont jamais projetées ni indexées dans la recherche.'));
}

function cellNode(c, s0, cls, today, redraw) {
  // Toujours la fiche à jour : après un clic, la case affiche la nouvelle valeur (et non celle d'avant).
  const s = store.get(s0.id) || s0;
  const v = I.cell(c, s, cls, today);
  const td = h('td', { class: `info-cell mark-${v.mark || 'vide'}`, title: v.title, 'data-col': c.key });
  const showText = v.text && (['service', 'plan', 'projet'].includes(c.kind) || v.mark === 'partiel' || v.text === 'expirée');
  const content = [I.SYMBOL[v.mark], showText ? h('span', { class: 'small' }, ` ${v.text}`) : null];
  const yearId = cls.yearId;
  const fresh = () => store.get(s.id);
  const btn = (fn, label) => h('button', { type: 'button', class: 'info-btn', 'aria-label': `${c.label} — ${s.firstName} : ${label}`, 'data-testid': `info-${c.key}`, onclick: fn }, content);
  switch (c.kind) {
    case 'case':
      td.append(btn(async () => { await I.setFree(c, fresh(), yearId, !I.freeValue(c, fresh(), yearId)); redraw(); }, v.mark === 'oui' ? 'oui' : 'non'));
      break;
    case 'texte': {
      const inp = h('input', { class: 'info-text', value: v.text || '', 'aria-label': `${c.label} — ${s.firstName}`, 'data-testid': `info-${c.key}`, onchange: async (e) => { await I.setFree(c, fresh(), yearId, e.target.value.trim()); } });
      td.append(inp); break;
    }
    case 'doc': {
      const t = E.docTemplates().find(x => x.id === c.ref);
      if (!t) { td.append('?'); break; }
      td.append(btn(async () => {
        const sts = E.statusesOf(t); const cur = E.docState(E.docOf(s.id, yearId, t.id), t, today).status;
        const next = sts[(sts.indexOf(cur) + 1) % sts.length];
        await E.setDoc(s.id, yearId, t, { status: next, date: today }, `${t.label} — ${s.firstName} : ${next}`, { quiet: true });
        redraw();
      }, v.text));
      break;
    }
    case 'depart':
      td.append(btn(async () => {
        const cur = fresh(); const on = cur.departure?.mode === c.ref;
        await store.update(s.id, { departure: { ...(cur.departure || {}), mode: on ? '' : c.ref } }, `Sortie habituelle — ${s.firstName}`, { quiet: true });
        redraw();
      }, v.mark === 'oui' ? 'oui' : 'non'));
      break;
    case 'service':
      td.append(btn(() => serviceDialog(c, s, cls, redraw), v.text || 'non inscrit'));
      break;
    case 'image':
      td.append(h('a', { class: 'info-btn', href: `#/eleve/${s.id}?t=documents`, 'data-testid': `info-${c.key}` }, content));
      break;
    case 'plan':
      td.append(h('a', { class: 'info-btn', href: `#/eleve/${s.id}?t=besoins` }, content));
      break;
    case 'projet':
      td.append(h('a', { class: 'info-btn', href: `#/argent/projet/${c.ref}` }, content));
      break;
    default: td.append(...content);
  }
  return td;
}

function serviceDialog(c, s, cls, redraw) {
  const days = model.classDays(cls);
  const cur = new Set(V.planOf(cls.id)?.plans?.[s.id]?.[c.ref] || []);
  const boxes = days.map(d => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: cur.has(d), value: d }), model.JOURS[d]));
  modal({ title: `${c.ref} — ${s.firstName}`, body: h('div', { class: 'form' }, h('p', { class: 'muted small' }, 'Jours habituels (semaine type). Les changements ponctuels se notent dans Aujourd’hui › Cantine et services.'), h('div', { class: 'chips' }, boxes)),
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
      const p = await V.ensurePlan(cls.id);
      const plans = structuredClone(store.get(p.id).plans || {});
      plans[s.id] = { ...(plans[s.id] || {}), [c.ref]: boxes.map(b => b.querySelector('input')).filter(i => i.checked).map(i => Number(i.value)) };
      await store.update(p.id, { plans }, `Semaine type : ${c.ref}`, { quiet: true });
      redraw();
    } }] });
}

function columnsDialog(rerender) {
  let cols = I.columns().map(c => ({ ...c }));
  const list = h('div', { class: 'stack' });
  const tpls = E.docTemplates().filter(t => t.category !== 'image');
  const projs = FI.projects(model.currentYear()?.id);
  const refField = (c) => {
    if (c.kind === 'doc') return h('select', { 'aria-label': 'Document', onchange: (e) => { c.ref = e.target.value; } }, tpls.map(t => h('option', { value: t.id, selected: c.ref === t.id }, t.label)));
    if (c.kind === 'service') return h('select', { 'aria-label': 'Service', onchange: (e) => { c.ref = e.target.value; } }, V.services().map(x => h('option', { value: x, selected: c.ref === x }, x)));
    if (c.kind === 'depart') return h('select', { 'aria-label': 'Sortie', onchange: (e) => { c.ref = e.target.value; } }, V.DEPARTURES.map(x => h('option', { value: x, selected: c.ref === x }, x)));
    if (c.kind === 'plan') return h('input', { value: c.ref || '', 'aria-label': 'Dispositifs', placeholder: 'PPRE, PAP', onchange: (e) => { c.ref = e.target.value; } });
    if (c.kind === 'projet') return h('select', { 'aria-label': 'Projet', onchange: (e) => { c.ref = e.target.value; } }, projs.length ? projs.map(p => h('option', { value: p.id, selected: c.ref === p.id }, p.title)) : h('option', { value: '' }, 'aucun projet'));
    return h('span', { class: 'muted small' }, c.sensitive ? 'confidentiel' : c.yearly ? 'propre à l’année' : 'gardé d’une année sur l’autre');
  };
  const draw = () => list.replaceChildren(...cols.map((c, i) => h('div', { class: 'col-row', 'data-testid': 'col-row' },
    h('input', { type: 'checkbox', checked: !c.hidden, 'aria-label': `Afficher ${c.label}`, onchange: (e) => { c.hidden = !e.target.checked; } }),
    h('input', { value: c.label, 'aria-label': 'Intitulé', onchange: (e) => { c.label = e.target.value; } }),
    h('input', { value: c.short || '', 'aria-label': 'Intitulé court', placeholder: 'abrégé', size: 8, onchange: (e) => { c.short = e.target.value; } }),
    h('span', { class: 'small' }, I.KINDS[c.kind]), refField(c),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Monter', disabled: i === 0, onclick: () => { [cols[i - 1], cols[i]] = [cols[i], cols[i - 1]]; draw(); } }, icon('up', 14)),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Descendre', disabled: i === cols.length - 1, onclick: () => { [cols[i + 1], cols[i]] = [cols[i], cols[i + 1]]; draw(); } }, icon('down', 14)),
    I.DEFAULT_COLUMNS.some(d => d.key === c.key) ? null : h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Supprimer ${c.label}`, onclick: () => { cols.splice(i, 1); draw(); } }, icon('trash', 14)))));
  draw();
  const nl = h('input', { placeholder: 'ex. Allergie, Vélo, Natation', 'aria-label': 'Nouvelle colonne', 'data-testid': 'new-col-label' });
  const nk = h('select', { 'aria-label': 'Type', 'data-testid': 'new-col-kind' }, Object.entries(I.KINDS).map(([k, l]) => h('option', { value: k, selected: k === 'case' }, l)));
  const nconf = h('input', { type: 'checkbox' }); const nyear = h('input', { type: 'checkbox' });
  const add = h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'add-col', onclick: () => {
    if (!nl.value.trim()) return;
    const kind = nk.value;
    const ref = { doc: tpls[0]?.id, service: V.services()[0], depart: 'transport', plan: 'PPRE', projet: projs[0]?.id }[kind];
    cols.push({ key: `c${Date.now().toString(36)}`, label: nl.value.trim(), kind, ref, sensitive: nconf.checked || kind === 'plan', yearly: nyear.checked });
    nl.value = ''; draw();
  } }, '+ Ajouter');
  modal({ title: 'Colonnes du tableau', wide: true, body: h('div', { class: 'form' },
    h('p', { class: 'muted small' }, 'Décochez pour masquer une colonne (les données restent sur les fiches). Les colonnes d’origine ne se suppriment pas, elles se masquent.'),
    list,
    h('h3', {}, 'Ajouter une colonne'),
    h('div', { class: 'row' }, nl, nk, h('label', { class: 'inline' }, nconf, 'confidentielle'), h('label', { class: 'inline' }, nyear, 'propre à l’année'), add)),
  actions: [
    { label: 'Revenir aux colonnes d’origine', onClick: async () => { if (!await confirmDialog('Revenir aux colonnes d’origine ?', 'Les colonnes ajoutées disparaissent du tableau ; les valeurs déjà saisies restent enregistrées.')) return false; await I.saveColumns(null); rerender(); } },
    { label: 'Annuler' },
    { label: 'Enregistrer', primary: true, onClick: async () => { await I.saveColumns(cols); toast('Colonnes enregistrées'); rerender(); } }] });
}

function printDialog(cls, students, today) {
  const unlocked = C.isUnlocked();
  const blank = h('input', { type: 'checkbox', 'data-testid': 'print-blank' });
  const conf = h('input', { type: 'checkbox', disabled: !unlocked });
  const rowsN = h('input', { type: 'number', min: students.length, max: 40, value: Math.max(30, students.length), 'aria-label': 'Nombre de lignes' });
  modal({ title: 'Imprimer les informations élèves', body: h('div', { class: 'form' },
    h('label', { class: 'inline' }, blank, 'Grille vierge à remplir à la main (noms seulement)'),
    field('Nombre de lignes de la grille', rowsN),
    h('label', { class: 'inline' }, conf, 'Inclure les colonnes confidentielles'),
    unlocked ? h('p', { class: 'muted small' }, 'À ne laisser qu’entre les mains des adultes concernés.') : h('p', { class: 'muted small' }, 'Affichez d’abord les colonnes confidentielles pour pouvoir les imprimer.')),
  actions: [{ label: 'Annuler' }, { label: 'Imprimer', primary: true, onClick: () => {
    const cols = I.columns().filter(c => !c.hidden && (!c.sensitive || conf.checked));
    const n = Math.max(students.length, Number(rowsN.value) || students.length);
    const rows = Array.from({ length: n }, (_, i) => students[i] || null);
    const doc = h('div', { class: 'print-doc' },
      h('header', { class: 'print-head' }, h('h1', {}, 'Informations élèves'), h('p', {}, `${cls.name} · ${store.get(cls.yearId)?.label || ''}${blank.checked ? '' : ` · état au ${model.frShort(today)}`}`)),
      h('table', { class: 'print-table info-print' },
        h('thead', {}, h('tr', {}, h('th', { class: 'num' }, ''), h('th', {}, 'Nom et prénom'), cols.map(c => h('th', { class: 'vert' }, h('span', {}, c.short || c.label))))),
        h('tbody', {}, rows.map((s, i) => h('tr', {}, h('td', { class: 'num' }, String(i + 1)), h('td', {}, s ? `${(s.lastName || '').toUpperCase()} ${s.firstName}` : ''),
          cols.map(c => { if (!s || blank.checked) return h('td', {}, ''); const v = I.cell(c, s, cls, today); return h('td', {}, `${I.SYMBOL[v.mark]}${v.text && (v.mark !== 'oui' || c.kind === 'service' || c.kind === 'plan') ? ' ' + v.text : ''}`); }))))),
      blank.checked ? null : h('p', { class: 'print-foot' }, '✓ oui / reçu / autorisé · ✗ refusé ou expiré · ◐ en partie · … à recevoir'));
    printDocument(doc, { orientation: 'landscape' });
  } }] });
}
