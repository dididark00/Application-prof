// Programmation annuelle (modèle « Programmation annuelle » de l’enseignante) :
// une fiche par discipline et par niveau, notions réparties par période et sous-domaine.
import { bulkDelete } from '../bulk.js';
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState, pickFiles } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { bound } from '../forms.js';
import { sectionFields, ownerBadge, ownerSelect } from '../pedago-ui.js';
import { competencyIndex, competencyLabel } from './referentiels.js';
import { parseCsv } from '../csv.js';
import { printDocument } from '../print.js';

const view = { mode: 'sous-domaines' };
let rerender = () => {};

export function render({ params, rerender: rr }) {
  rerender = rr;
  if (params[0]) return detail(params[0]);
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Programmations'), subTabs(), missing);
  const list = P.ofClass('programmation', cls.id).sort((a, b) => (a.level || '').localeCompare(b.level || '') || model.subjects().indexOf(a.subject) - model.subjects().indexOf(b.subject));
  return h('div', { class: 'page' },
    pageHeader('Programmations annuelles', { favKey: 'preparer/programmations', subtitle: `${cls.name} · une fiche par discipline`,
      actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-prog', onclick: () => newDialog(cls) }, icon('plus', 16), 'Nouvelle programmation'),
        list.length ? h('button', { class: 'btn', type: 'button', 'data-testid': 'bulk-open', onclick: () => bulkDelete({ title: 'Supprimer des programmations', childAlways: true, items: list.map(p => ({ id: p.id, group: p.subject || 'Autre', label: `${p.subject} ${p.level || ''}`, detail: `${P.notionsOf(p.id).length} notion(s)`, children: P.notionsOf(p.id).map(n => n.id) })) }) }, icon('trash', 16), 'Supprimer…') : null] }),
    subTabs(),
    list.length ? h('div', { class: 'dash' }, list.map(p => {
      const notions = P.notionsOf(p.id);
      const done = notions.filter(n => P.notionStatus(n) === 'terminée').length;
      return h('a', { class: 'card card-link', href: `#/programmation/${p.id}` },
        h('h2', {}, p.subject, ' ', badge(p.level || '', 'muted'), ownerBadge(p.owner, cls)),
        h('p', { class: 'muted' }, (p.subdomains || []).join(' · ') || 'Sous-domaines à compléter'),
        h('p', {}, `${notions.length} notion(s) · ${done} terminée(s)`, p.validated?.date ? h('span', {}, ' · ', badge('version validée', 'ok')) : null));
    })) : emptyState('Aucune programmation', 'Créez une programmation par discipline : les notions réparties sur P1 à P5 alimenteront les progressions, les séquences et les bilans de période.'));
}

function newDialog(cls) {
  const levels = cls.levels || [];
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' },
      field('Discipline / domaine', h('select', { name: 'subject' }, model.subjects().map(s => h('option', { value: s }, s)))),
      field('Niveau', h('select', { name: 'level' }, levels.map(l => h('option', { value: l }, l))))),
    field('Sous-domaines (séparés par des virgules)', h('input', { name: 'subdomains', placeholder: 'ex. Nombres, Fractions, Opérations, Calcul mental, Problèmes, Mesures, Géométrie' })),
    field('Références', h('input', { name: 'references', placeholder: 'programme officiel en vigueur ; manuel utilisé ; édition' })),
    field('Répartition', h('select', { name: 'owner' }, h('option', { value: '' }, '—'), model.owners(cls).map(([v, l]) => h('option', { value: v }, l)))));
  modal({ title: 'Nouvelle programmation annuelle', body: form, actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, onClick: async () => {
    const d = formData(form);
    if (P.ofClass('programmation', cls.id).some(p => p.subject === d.subject && p.level === d.level) && !await confirmDialog('Programmation existante', `Une programmation ${d.subject} ${d.level} existe déjà. En créer une seconde ?`, { confirmLabel: 'Créer quand même' })) return false;
    const p = await store.create('programmation', { classId: cls.id, subject: d.subject, level: d.level, subdomains: splitList(d.subdomains), references: d.references, owner: d.owner }, `Programmation ${d.subject} ${d.level}`);
    location.hash = `#/programmation/${p.id}`;
  } }] });
}
const splitList = (s) => [...new Set((s || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean))];

function detail(id) {
  const p = store.get(id);
  if (!p || p.deletedAt) return h('div', { class: 'page' }, pageHeader('Programmation introuvable'), h('a', { href: '#/programmations' }, '← Programmations'));
  const cls = store.get(p.classId);
  const year = cls && store.get(cls.yearId);
  const periods = model.periodsOf(year);
  const notions = P.notionsOf(p.id);
  const progressions = store.all('progression').filter(x => x.programmationId === p.id);
  const sequences = P.ofClass('sequence', p.classId).filter(s => s.subject === p.subject && (!s.levels?.length || s.levels.includes(p.level)));

  const grid = view.mode === 'sous-domaines' ? subdomainGrid(p, periods, notions) : detailedGrid(p, periods, notions, sequences);

  return h('div', { class: 'page' },
    h('p', {}, h('a', { href: '#/programmations', class: 'back' }, '← Programmations')),
    pageHeader(`Programmation annuelle — ${p.subject}`, { subtitle: `${cls?.name || ''} · ${p.level} · ${year?.label || ''}`,
      actions: [
        h('button', { class: 'btn', type: 'button', onclick: () => importNotions(p, periods) }, icon('upload', 16), 'Importer un tableau'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'print-prog', onclick: () => printDocument(printProgrammation(p), { orientation: 'landscape' }) }, icon('print', 16), 'Imprimer'),
        h('button', { class: 'btn btn-ghost-danger', type: 'button', 'aria-label': 'Mettre à la corbeille', onclick: async () => {
          if (!await confirmDialog('Mettre la programmation à la corbeille ?', `Ses ${notions.length} notion(s) restent enregistrées et reviennent si vous la restaurez.`, { confirmLabel: 'Mettre à la corbeille', danger: true })) return;
          await store.remove(p.id, `Programmation ${p.subject} mise à la corbeille`); location.hash = '#/programmations';
        } }, icon('trash', 16))] }),
    h('section', { class: 'card' },
      h('div', { class: 'grid-2' },
        bound({ label: 'Sous-domaines (séparés par des virgules)', type: 'text', value: (p.subdomains || []).join(', '), testid: 'f-subdomains',
          onSave: async (v) => { await store.update(p.id, { subdomains: splitList(v) }, 'Sous-domaines'); } }),
        ownerSelect(p.id, cls)),
      sectionFields(p.id, [{ key: 'references', label: 'Références', placeholder: 'programme officiel en vigueur ; manuel utilisé ; édition', type: 'text' }])),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Vue annuelle par période'),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Présentation' },
          [['sous-domaines', 'Par sous-domaine'], ['detaillee', 'Détaillée']].map(([m, l]) => h('button', { type: 'button', class: view.mode === m ? 'on' : '', 'aria-pressed': view.mode === m ? 'true' : 'false',
            onclick: () => { view.mode = m; rerender(); } }, l)))),
      h('p', { class: 'muted small' }, 'Cliquez sur une notion pour la modifier, la déplacer ou la relier. Le statut est déduit des progressions : il n’est jamais saisi deux fois.'),
      grid),
    h('section', { class: 'card' }, h('h2', {}, 'Cohérence et suivi'),
      h('div', { class: 'grid-3' },
        bound({ label: 'Programmation antérieure validée (référence)', type: 'text', value: p.validated?.ref, onSave: (v) => store.update(p.id, { validated: { ...(store.get(p.id).validated || {}), ref: v } }, 'Référence validée', { quiet: true }) }),
        bound({ label: 'Date de validation', type: 'date', value: p.validated?.date, onSave: (v) => store.update(p.id, { validated: { ...(store.get(p.id).validated || {}), date: v } }, 'Date de validation', { quiet: true }) }),
        bound({ label: 'Modification autorisée ?', type: 'select', value: p.validated?.modif || '', options: ['', 'oui', 'non', 'à demander'], onSave: (v) => store.update(p.id, { validated: { ...(store.get(p.id).validated || {}), modif: v } }, 'Modification autorisée', { quiet: true }) })),
      h('div', {}, h('strong', {}, 'Liens vers progressions : '), periods.map((per, i) => {
        const pr = progressions.find(x => x.periodId === per.id);
        return pr ? h('a', { class: 'btn btn-small', href: `#/progression/${pr.id}` }, `P${i + 1}`)
          : h('button', { class: 'btn btn-small btn-dashed', type: 'button', title: `Créer la progression P${i + 1}`, onclick: () => createProgression(p, per) }, `+ P${i + 1}`);
      })),
      sectionFields(p.id, [{ key: 'bilan', label: 'Bilan / réajustements', placeholder: 'à compléter après mise en œuvre' }])));
}

export async function createProgression(p, period, extra = {}) {
  const pr = await store.create('progression', { classId: p.classId, level: p.level, subject: p.subject, subdomain: '', periodId: period.id, programmationId: p.id, owner: p.owner || '', extraColumns: [], rows: [], ...extra }, `Progression ${p.subject} créée`);
  location.hash = `#/progression/${pr.id}`;
  return pr;
}

function notionChip(n, onClick) {
  const st = P.notionStatus(n);
  return h('button', { class: `notion notion-${st.replace(' ', '-')}`, type: 'button', title: `Statut : ${st}`, onclick: onClick, 'data-testid': 'notion' }, n.title || 'Sans titre');
}

function subdomainGrid(p, periods, notions) {
  const cols = [...(p.subdomains || [])];
  if (notions.some(n => !n.subdomain || !cols.includes(n.subdomain))) cols.push('');
  if (!cols.length) cols.push('');
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table grid-table', 'data-testid': 'prog-grid' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Période'), cols.map(c => h('th', {}, c || (cols.length > 1 ? 'Autres' : 'Notions – apprentissages'))))),
    h('tbody', {}, periods.map((per, i) => h('tr', {}, h('th', { scope: 'row' }, `P${i + 1}`, h('div', { class: 'muted small' }, `${model.frShort(per.start)} – ${model.frShort(per.end)}`)),
      cols.map(c => {
        const cell = notions.filter(n => n.periodId === per.id && ((c && n.subdomain === c) || (!c && (!n.subdomain || !(p.subdomains || []).includes(n.subdomain)))));
        return h('td', {}, h('div', { class: 'cell-notions' }, cell.map(n => notionChip(n, () => notionDialog(p, n, periods))),
          h('button', { class: 'add-mini', type: 'button', 'aria-label': `Ajouter une notion en P${i + 1}${c ? ' — ' + c : ''}`, onclick: () => notionDialog(p, { periodId: per.id, subdomain: c }, periods) }, '+')));
      })))),
    notions.some(n => !n.periodId) ? h('tfoot', {}, h('tr', {}, h('th', {}, 'Sans période'), h('td', { colspan: cols.length }, notions.filter(n => !n.periodId).map(n => notionChip(n, () => notionDialog(p, n, periods)))))) : null));
}

function detailedGrid(p, periods, notions, sequences) {
  const idx = competencyIndex();
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table grid-table', 'data-testid': 'prog-grid' },
    h('thead', {}, h('tr', {}, ['Période', 'Compétences / repères officiels', 'Notions – apprentissages', 'Séquences prévues', 'Ressources'].map(t => h('th', {}, t)))),
    h('tbody', {}, periods.map((per, i) => {
      const cell = notions.filter(n => n.periodId === per.id);
      const comps = [...new Set(cell.flatMap(n => [...(n.competencyIds || []).map(c => competencyLabel(c, idx)), ...(n.competences ? [n.competences] : [])]))];
      const seqs = sequences.filter(s => s.periodId === per.id);
      return h('tr', {}, h('th', { scope: 'row' }, `P${i + 1}`),
        h('td', {}, comps.length ? h('ul', { class: 'plain' }, comps.map(c => h('li', {}, c))) : h('span', { class: 'muted' }, '—')),
        h('td', {}, h('div', { class: 'cell-notions' }, cell.map(n => notionChip(n, () => notionDialog(p, n, periods))),
          h('button', { class: 'add-mini', type: 'button', 'aria-label': `Ajouter une notion en P${i + 1}`, onclick: () => notionDialog(p, { periodId: per.id }, periods) }, '+'))),
        h('td', {}, seqs.length ? h('ul', { class: 'plain' }, seqs.map(s => h('li', {}, h('a', { href: `#/sequence/${s.id}` }, P.sequenceTitle(s))))) : h('span', { class: 'muted' }, '—')),
        h('td', {}, [...new Set(cell.map(n => n.resources).filter(Boolean))].join(' ; ') || h('span', { class: 'muted' }, '—')));
    }))));
}

function notionDialog(p, n, periods) {
  const editing = !!n.id;
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Notion – apprentissage', h('input', { name: 'title', required: true, value: n.title || '' })),
    h('div', { class: 'grid-2' },
      field('Période', h('select', { name: 'periodId' }, h('option', { value: '' }, 'Sans période'), periods.map((per, i) => h('option', { value: per.id, selected: per.id === n.periodId }, `P${i + 1}`)))),
      field('Sous-domaine', h('select', { name: 'subdomain' }, h('option', { value: '' }, '—'), (p.subdomains || []).map(s => h('option', { value: s, selected: s === n.subdomain }, s))))),
    field('Compétences / repères (texte)', h('textarea', { name: 'competences', rows: 2 }, n.competences || '')),
    field('Ressources', h('input', { name: 'resources', value: n.resources || '', placeholder: 'manuel / pages vérifiées' })),
    editing ? h('p', { class: 'muted small' }, `Statut déduit des progressions : ${P.notionStatus(n)}.`) : null);
  const actions = [{ label: 'Annuler' }];
  if (editing) {
    actions.unshift({ label: 'Supprimer', danger: true, onClick: async () => { await store.remove(n.id, `Notion « ${n.title} » mise à la corbeille`); toast('Notion mise à la corbeille', { action: 'Annuler', onAction: () => store.undo() }); } });
    actions.splice(1, 0, { label: '↑', onClick: () => move(n, -1) }, { label: '↓', onClick: () => move(n, 1) },
      { label: 'Compétences officielles…', onClick: async () => { const { pickCompetencies } = await import('./referentiels.js'); const sel = await pickCompetencies(n.competencyIds || [], { levels: [p.level] }); if (sel) await store.update(n.id, { competencyIds: sel }, 'Compétences de la notion'); } });
  }
  actions.push({ label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form);
    if (!d.title) return false;
    const data = { title: d.title, periodId: d.periodId || null, subdomain: d.subdomain, competences: d.competences, resources: d.resources };
    if (editing) await store.update(n.id, data, `Notion « ${d.title} »`);
    else await store.create('notion', { ...data, programmationId: p.id, order: (P.notionsOf(p.id).at(-1)?.order ?? 0) + 1, competencyIds: [] }, `Notion « ${d.title} » ajoutée`);
  } });
  modal({ title: editing ? 'Notion' : 'Nouvelle notion', body: form, actions });
}

async function move(n, dir) {
  const sibs = P.notionsOf(n.programmationId).filter(x => x.periodId === n.periodId && (x.subdomain || '') === (n.subdomain || ''));
  const i = sibs.findIndex(x => x.id === n.id), j = i + dir;
  if (j < 0 || j >= sibs.length) return;
  const all = P.notionsOf(n.programmationId);
  // Réindexe pour des ordres uniques, puis échange.
  const items = all.map((x, k) => ({ id: x.id, patch: { order: k * 10 } }));
  const oi = all.findIndex(x => x.id === sibs[i].id), oj = all.findIndex(x => x.id === sibs[j].id);
  items[oi].patch.order = oj * 10; items[oj].patch.order = oi * 10;
  await store.batch(items, 'Notion déplacée');
}

/** Import d'un tableau : Période ; Sous-domaine ; Notion ; Compétences ; Ressources. */
function importNotions(p, periods) {
  const ta = h('textarea', { rows: 8, placeholder: 'Période;Sous-domaine;Notion;Compétences;Ressources\nP1;Nombres;Nombres jusqu’à 10 000;;Manuel p. …', 'aria-label': 'Tableau à importer' });
  const preview = h('div');
  let rows = [];
  const analyse = () => {
    const raw = parseCsv(ta.value);
    const head = raw[0] && /notion/i.test(raw[0].join(' '));
    rows = (head ? raw.slice(1) : raw).flatMap(c => {
      const m = (c[0] || '').match(/(\d)/);
      const per = m ? periods[Number(m[1]) - 1] : null;
      // Une cellule peut contenir plusieurs notions séparées par « ; » ou des retours à la ligne.
      return (c[2] || '').split(/\s*[;\n]\s*/).filter(Boolean).map(title => ({ periodId: per?.id || null, periodLabel: per ? `P${m[1]}` : '?', subdomain: c[1] || '', title, competences: c[3] || '', resources: c[4] || '' }));
    });
    const newSub = [...new Set(rows.map(r => r.subdomain).filter(s => s && !(p.subdomains || []).includes(s)))];
    preview.replaceChildren(h('p', {}, `${rows.length} notion(s) à ajouter.${newSub.length ? ` Nouveaux sous-domaines : ${newSub.join(', ')}.` : ''}`),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('tbody', {}, rows.slice(0, 300).map(r => h('tr', { class: r.periodId ? '' : 'row-warn' }, h('td', {}, r.periodLabel), h('td', {}, r.subdomain), h('td', {}, r.title), h('td', {}, r.resources)))))));
  };
  ta.addEventListener('input', analyse);
  modal({ title: 'Importer des notions', wide: true, body: h('div', { class: 'form' },
    h('p', {}, 'Collez un tableau (depuis un tableur ou un document) : Période ; Sous-domaine ; Notion ; Compétences ; Ressources. Plusieurs notions dans une même cellule peuvent être séparées par « ; ».'),
    h('button', { class: 'btn', type: 'button', onclick: async () => { const [f] = await pickFiles({ accept: '.csv,.txt', multiple: false }); if (f) { ta.value = await f.text(); analyse(); } } }, icon('upload', 16), 'Choisir un fichier CSV'),
    ta, preview), actions: [{ label: 'Annuler' }, { label: 'Importer', primary: true, onClick: async () => {
      if (!rows.length) return false;
      const subs = [...new Set([...(p.subdomains || []), ...rows.map(r => r.subdomain).filter(Boolean)])];
      let order = (P.notionsOf(p.id).at(-1)?.order ?? 0);
      await store.batch([{ id: p.id, patch: { subdomains: subs } }, ...rows.map(r => ({ create: { type: 'notion', data: { programmationId: p.id, periodId: r.periodId, subdomain: r.subdomain, title: r.title, competences: r.competences, resources: r.resources, competencyIds: [], order: (order += 10) } } }))], `Import de ${rows.length} notion(s)`);
      toast(`${rows.length} notion(s) importée(s)`, { action: 'Annuler', onAction: () => store.undo() });
    } }] });
}

export function printProgrammation(p) {
  const cls = store.get(p.classId); const year = store.get(cls.yearId);
  const periods = model.periodsOf(year); const notions = P.notionsOf(p.id);
  const cols = (p.subdomains || []).length ? [...p.subdomains] : [''];
  if (notions.some(n => n.subdomain && !cols.includes(n.subdomain)) || (cols[0] !== '' && notions.some(n => !n.subdomain))) cols.push('Autres');
  const cellOf = (per, c) => notions.filter(n => n.periodId === per.id && (c === 'Autres' ? (!n.subdomain || !(p.subdomains || []).includes(n.subdomain)) : c === '' ? true : n.subdomain === c)).map(n => n.title).join(' ; ');
  return h('div', { class: 'print-doc' },
    h('header', { class: 'print-head print-head-center' }, h('h1', {}, `Programmation annuelle — ${p.subject} ${p.level}`),
      h('p', {}, [cls.name, year?.label, p.references, p.owner ? `Répartition : ${model.ownerLabel(p.owner, cls)}` : ''].filter(Boolean).join(' · '))),
    h('table', { class: 'print-table' },
      h('thead', {}, h('tr', {}, h('th', { style: { width: '8%' } }, 'Période'), cols.map(c => h('th', {}, c || 'Notions – apprentissages')))),
      h('tbody', {}, periods.map((per, i) => h('tr', { class: `per-row p${i % 5}` }, h('td', {}, h('strong', {}, `P${i + 1}`)), cols.map(c => h('td', {}, cellOf(per, c))))))),
    p.bilan ? h('p', { class: 'print-foot' }, `Bilan / réajustements : ${p.bilan}`) : null);
}
