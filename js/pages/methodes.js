// Préparer › Disciplines et méthodes : pour chaque discipline et sous-domaine de la classe, le manuel,
// le fichier ou la méthode utilisés (Accès, Picot, Retz, MDI…). Proposés dans les fiches de séquence
// et de séance, et repris dans le dossier de remplacement. Une seule saisie, utilisée partout.
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import { h, icon, toast, badge, modal, field } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { printDocument } from '../print.js';

/** Méthodes de la classe : [{ id, subject, subdomain, manualIds, note }] */
export const methodsOf = (cls) => store.get(cls.id)?.methods || [];
const saveMethods = (cls, list, label, quiet = false) => store.update(cls.id, { methods: list }, label, { quiet });
/** Sous-domaines connus d'une discipline (programmations et séquences de la classe). */
function knownSubdomains(cls, subject) {
  const out = new Set();
  for (const p of P.ofClass('programmation', cls.id).filter(x => x.subject === subject)) for (const d of p.subdomains || []) out.add(d);
  for (const s of P.ofClass('sequence', cls.id).filter(x => x.subject === subject && x.subdomain)) out.add(s.subdomain);
  return [...out];
}
/** Méthode applicable à une fiche (discipline + sous-domaine, sinon la discipline seule). */
export function methodFor(cls, subject, subdomain = '') {
  const ms = methodsOf(cls).filter(m => m.subject === subject);
  const n = (x) => String(x || '').trim().toLowerCase();
  return ms.find(m => subdomain && n(m.subdomain) === n(subdomain)) || ms.find(m => !m.subdomain) || null;
}
function newManual(subject, done) {
  const t = h('input', { placeholder: 'ex. Accès CE2, Picot, MDI Questionner le monde', 'data-testid': 'new-method-title' });
  const kind = h('select', {}, ['manuel', 'guide du maître', 'cahier / fichier élève', 'méthode', 'site / ressource en ligne', 'autre'].map(k => h('option', { value: k }, k)));
  modal({ title: `Nouveau — ${subject}`, body: h('div', { class: 'form' }, field('Titre', t), field('Type', kind), h('p', { class: 'muted small' }, 'Pages, scans et éditeur se complètent ensuite dans Préparer › Manuels.')),
    actions: [{ label: 'Annuler' }, { label: 'Ajouter', primary: true, testid: 'new-method-ok', onClick: async () => {
      if (!t.value.trim()) return false;
      const nm = await store.create('manual', { title: t.value.trim(), author: '', publisher: '', edition: '', kind: kind.value, subject, level: '', pages: [] }, `Manuel ${t.value.trim()}`);
      await done(nm.id);
    } }] });
}
export const manualTitle = (id) => store.get(id)?.title || '(manuel supprimé)';

export function render({ rerender }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return h('div', { class: 'page' }, pageHeader('Disciplines et méthodes'), subTabs(), miss);
  const list = methodsOf(cls);
  const manuals = store.all('manual').filter(m => !m.deletedAt).sort((a, b) => (a.title || '').localeCompare(b.title || '', 'fr'));
  const upd = (id, patch, label, quiet = true) => saveMethods(cls, methodsOf(cls).map(m => (m.id === id ? { ...m, ...patch } : m)), label, quiet);
  const row = (m) => h('tr', { 'data-testid': 'method-row' },
    h('td', {}, h('input', { value: m.subdomain || '', placeholder: 'toute la discipline', 'aria-label': 'Sous-domaine', list: `dl-sub-${m.subject.replace(/\W/g, '')}`, onchange: (e) => upd(m.id, { subdomain: e.target.value.trim() }, 'Sous-domaine', false) })),
    h('td', {}, h('div', { class: 'chips' }, (m.manualIds || []).map(id => h('span', { class: 'chip' }, manualTitle(id), ' ', h('button', { class: 'linklike', type: 'button', 'aria-label': 'Retirer', onclick: () => upd(m.id, { manualIds: m.manualIds.filter(x => x !== id) }, 'Méthode retirée', false) }, '×'))),
      h('select', { 'aria-label': 'Ajouter un manuel ou une méthode', 'data-testid': 'method-manual', onchange: async (e) => {
        const v = e.target.value; if (!v) return;
        if (v === '__new') { e.target.value = ''; newManual(m.subject, (id) => upd(m.id, { manualIds: [...(m.manualIds || []), id] }, 'Méthode ajoutée', false)); return; }
        await upd(m.id, { manualIds: [...new Set([...(m.manualIds || []), v])] }, 'Méthode ajoutée', false);
      } }, h('option', { value: '' }, '+ manuel / méthode…'), manuals.map(x => h('option', { value: x.id }, `${x.title}${x.kind && x.kind !== 'manuel' ? ' (' + x.kind + ')' : ''}`)), h('option', { value: '__new' }, '+ Nouveau (titre seulement)…')))),
    h('td', {}, h('input', { value: m.note || '', placeholder: 'ex. jours 1 à 4 du guide, fichier p. 18…', 'aria-label': 'Précisions', onchange: (e) => upd(m.id, { note: e.target.value }, 'Précisions') })),
    h('td', {}, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Supprimer la ligne', onclick: () => saveMethods(cls, methodsOf(cls).filter(x => x.id !== m.id), 'Ligne supprimée') }, icon('trash', 14))));
  const subjects = model.subjects();
  const used = subjects.filter(s => list.some(m => m.subject === s));
  const unused = subjects.filter(s => !used.includes(s));
  const add = (subject, subdomain = '') => saveMethods(cls, [...methodsOf(cls), { id: store.uid(), subject, subdomain, manualIds: [], note: '' }], `${subject} ajoutée`);
  return h('div', { class: 'page' },
    pageHeader('Disciplines et méthodes', { favKey: 'preparer/methodes', subtitle: cls.name, actions: [
      h('button', { class: 'btn', type: 'button', 'data-testid': 'methods-print', onclick: () => printDocument(printMethods(cls)) }, icon('print', 16), 'Imprimer')] }),
    subTabs(),
    h('p', { class: 'muted' }, 'Pour chaque discipline (et sous-domaine si besoin) : le manuel, le fichier ou la méthode que vous utilisez. Ils sont proposés dans les fiches de séquence et de séance, et repris dans le dossier de remplacement.'),
    used.map(subject => {
      const rows = list.filter(m => m.subject === subject);
      const known = knownSubdomains(cls, subject).filter(d => !rows.some(r => (r.subdomain || '').toLowerCase() === d.toLowerCase()));
      return h('section', { class: 'card stack', 'data-testid': 'method-subject', style: { borderLeft: `5px solid ${model.subjectColor(subject)}` } },
        h('h2', {}, subject), h('datalist', { id: `dl-sub-${subject.replace(/\W/g, '')}` }, knownSubdomains(cls, subject).map(d => h('option', { value: d }))),
        h('div', { class: 'table-wrap' }, h('table', { class: 'table methods-table' }, h('thead', {}, h('tr', {}, ['Sous-domaine', 'Manuels et méthodes', 'Précisions', ''].map(t => h('th', {}, t)))), h('tbody', {}, rows.map(row)))),
        h('div', { class: 'row wrap' }, h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'method-add-sub', onclick: () => add(subject, '') }, '+ Sous-domaine'),
          known.length ? [h('span', { class: 'muted small' }, 'Sous-domaines de vos programmations :'), known.map(d => h('button', { class: 'btn btn-small', type: 'button', onclick: () => add(subject, d) }, `+ ${d}`))] : null));
    }),
    unused.length ? h('section', { class: 'card' }, h('h2', {}, 'Ajouter une discipline'), h('div', { class: 'row wrap' }, unused.map(s => h('button', { class: 'btn btn-small', type: 'button', 'data-testid': `method-add-${s}`, onclick: () => add(s) }, `+ ${s}`))),
      h('p', { class: 'muted small' }, 'La liste des disciplines se règle dans Réglages › Général.')) : null,
    !manuals.length ? h('p', { class: 'muted small' }, 'Astuce : les manuels se décrivent en détail (pages, scans) dans Préparer › Manuels ; ici, « + Nouveau » suffit pour noter un titre.') : null);
}

export function printMethods(cls) {
  const list = methodsOf(cls);
  return h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, 'Disciplines et méthodes'), h('p', {}, cls.name)),
    h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, ['Discipline', 'Sous-domaine', 'Manuels et méthodes', 'Précisions'].map(t => h('th', {}, t)))),
      h('tbody', {}, list.map(m => h('tr', {}, h('td', {}, m.subject), h('td', {}, m.subdomain || ''), h('td', {}, (m.manualIds || []).map(manualTitle).join(', ')), h('td', {}, m.note || ''))))));
}

/** Suggestion dans une fiche : « Méthode de la classe : Accès — Ajouter ». */
export function methodHint(rec) {
  const cls = store.get(rec.classId); if (!cls || !rec.subject) return null;
  const m = methodFor(cls, rec.subject, rec.subdomain || store.get(rec.sequenceId)?.subdomain || '');
  if (!m || !(m.manualIds || []).length) return null;
  const have = new Set((rec.manualRefs || []).map(r => r.manualId));
  const missing = m.manualIds.filter(id => !have.has(id) && store.get(id));
  if (!missing.length) return null;
  return h('p', { class: 'small method-hint', 'data-testid': 'method-hint' }, badge('méthode de la classe', 'info'), ' ', missing.map(manualTitle).join(', '), m.note ? ` (${m.note})` : '', ' ',
    h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'method-hint-add', onclick: async () => { await store.update(rec.id, { manualRefs: [...(store.get(rec.id).manualRefs || []), ...missing.map(id => ({ id: store.uid(), manualId: id, pages: '', exercises: '' }))] }, 'Méthode de la classe ajoutée'); toast('Ajoutée : précisez les pages et exercices vérifiés.'); } }, 'Ajouter à la fiche'));
}
