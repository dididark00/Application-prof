// Onglets de la fiche élève : documents et autorisations, suivi pédagogique,
// besoins particuliers (confidentiels), vie scolaire, échanges avec la famille.
import * as store from '../store.js';
import * as model from '../model.js';
import * as E from '../eleve.js';
import * as V from '../vie.js';
import * as C from '../confidential.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState, pickFiles } from '../ui.js';
import { bound, pickMany, iconBtn } from '../forms.js';
import { addFiles } from './files.js';
import { competencyLabel, competencyIndex, pickCompetencies } from './referentiels.js';

const fileLink = (id) => { const f = id && store.get(id); return f && !f.deletedAt ? h('a', { href: `#/fichiers?open=${f.id}` }, f.name) : null; };
async function attach(extra) { const fs = await pickFiles({ accept: 'image/*,application/pdf' }); if (!fs.length) return null; const c = await addFiles(fs, null, { tags: ['élève'], ...extra }); return c[0]?.id || null; }

// ───────── Documents et autorisations
export function docsTab(s, yearId) {
  if (!yearId) return emptyState('Pas d’année', 'Inscrivez l’élève dans une classe pour suivre ses documents de l’année.');
  const year = store.get(yearId);
  const today = model.todayIso();
  const tpls = E.docTemplates();
  const row = (t) => {
    const d = E.docOf(s.id, yearId, t.id);
    const st = E.docState(d, t, today);
    const save = (patch, label) => E.setDoc(s.id, yearId, t, patch, `${t.label} — ${s.firstName} : ${label}`);
    return h('tr', { 'data-testid': `doc-${t.id}` },
      h('td', {}, t.label, st.expired ? badge('expirée', 'warn') : null),
      h('td', {}, h('select', { 'aria-label': `Statut : ${t.label}`, class: `status-${st.kind}`, 'data-testid': 'doc-status', onchange: (e) => save({ status: e.target.value, date: d?.date || today }, e.target.value) }, E.statusesOf(t).map(x => h('option', { value: x, selected: st.status === x }, x)))),
      h('td', {}, h('input', { type: 'date', value: d?.date || '', 'aria-label': 'Date', onchange: (e) => save({ date: e.target.value }, 'date') })),
      h('td', {}, t.validity || t.category !== 'document' ? h('input', { type: 'date', value: d?.validUntil || '', 'aria-label': 'Valable jusqu’au', 'data-testid': 'doc-valid', onchange: (e) => save({ validUntil: e.target.value }, 'validité') }) : ''),
      h('td', {}, fileLink(d?.fileId) || h('button', { class: 'btn btn-small', type: 'button', onclick: async () => { const id = await attach({ studentIds: [s.id] }); if (id) await save({ fileId: id }, 'justificatif'); } }, 'Joindre')),
      h('td', {}, t.category === 'document' && st.status !== 'reçu' ? h('button', { class: 'btn btn-small', type: 'button', title: (d?.reminders || []).map(model.frShort).join(', '), onclick: () => save({ reminders: [...(d?.reminders || []), today] }, 'relance') }, `Relancer${d?.reminders?.length ? ` (${d.reminders.length})` : ''}`) : ''),
      h('td', {}, bound({ type: 'text', compact: true, value: d?.note, placeholder: 'remarque', onSave: (v) => save({ note: v }, 'remarque') })));
  };
  const section = (title, cat, hint) => h('section', { class: 'card' }, h('h2', {}, title), hint ? h('p', { class: 'muted small' }, hint) : null,
    h('div', { class: 'table-wrap' }, h('table', { class: 'table docs-table' },
      h('thead', {}, h('tr', {}, ['', 'Statut', 'Date', cat === 'document' ? 'Valable jusqu’au' : 'Jusqu’au', 'Justificatif', '', 'Remarque'].map(x => h('th', {}, x)))),
      h('tbody', {}, tpls.filter(t => t.category === cat).map(row)))));
  return h('div', { class: 'stack' },
    h('p', { class: 'muted' }, `Année ${year?.label || ''}. Chaque année repart de zéro : rien n’est reporté automatiquement. Liste des documents modifiable dans Réglages › Documents et confidentialité.`),
    section('Documents', 'document'),
    section('Autorisations', 'autorisation'),
    section('Droit à l’image, usage par usage', 'image', 'Chaque usage a son propre statut : une autorisation pour l’affichage en classe ne vaut pas pour le site de l’école ou la presse.'));
}

// ───────── Suivi pédagogique
export function suiviTab(s, cls, rerender) {
  const obs = E.of('observation', s.id);
  const lv = E.latestLevels(s.id);
  const levels = E.of('levelmark', s.id);
  const aids = E.of('aid', s.id);
  const port = E.of('portfolio', s.id);
  const idx = competencyIndex();
  return h('div', { class: 'stack' },
    h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Niveau par domaine (daté)'), h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'add-level', onclick: () => levelDialog(s) }, '+ Situer')),
      h('p', { class: 'muted small' }, 'Pas d’étiquette globale : chaque domaine a son niveau, daté, et son historique.'),
      Object.keys(lv).length ? h('div', { class: 'tags' }, Object.values(lv).map(l => h('span', { class: 'lvl' }, h('strong', {}, l.domain), ' ', badge(l.level, E.LEVEL_KIND[l.level]), h('span', { class: 'muted small' }, ` ${model.frShort(l.date)}`)))) : h('p', { class: 'muted' }, 'Aucun repère pour l’instant.'),
      levels.length > Object.keys(lv).length ? h('details', {}, h('summary', {}, 'Historique'), h('ul', { class: 'plain' }, levels.map(l => h('li', {}, `${model.frShort(l.date)} — ${l.domain} : ${l.level}${l.note ? ` (${l.note})` : ''}`)))) : null),
    h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Observations'), h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'add-observation', onclick: () => obsDialog(s) }, '+ Observation')),
      obs.length ? h('ul', { class: 'obs-list' }, obs.map(o => h('li', {},
        h('div', {}, h('strong', {}, model.frShort(o.date)), ' ', badge(o.kind, o.kind === 'réussite' ? 'ok' : o.kind === 'difficulté' ? 'warn' : 'muted'), o.domain ? badge(o.domain, 'muted') : null),
        h('p', { class: 'pre' }, o.text), o.action ? h('p', { class: 'small' }, h('strong', {}, 'Action : '), o.action, o.followUp ? ` · suivi le ${model.frShort(o.followUp)}` : '', o.done ? ' · ' : '', o.done ? badge('fait', 'ok') : null) : null,
        h('div', { class: 'row' }, h('button', { class: 'btn btn-link small', type: 'button', onclick: () => obsDialog(s, o) }, 'modifier'),
          o.action && !o.done ? h('button', { class: 'btn btn-link small', type: 'button', onclick: () => store.update(o.id, { done: true }, 'Action de suivi faite') }, 'action faite') : null)))) : h('p', { class: 'muted' }, 'Aucune observation.')),
    h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Aides efficaces'), h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'add-aid', onclick: () => aidDialog(s) }, '+ Aide')),
      h('p', { class: 'muted small' }, 'Les aides notées ici sont proposées dans les fiches de séance (différenciation) : vous choisissez de les appliquer ou non.'),
      aids.length ? h('ul', { class: 'obs-list' }, aids.map(a => h('li', {},
        h('div', {}, h('strong', {}, a.label), a.domain ? badge(a.domain, 'muted') : null, a.active === false ? badge('arrêtée', 'muted') : badge('en cours', 'info'),
          (a.effects || []).length ? badge(a.effects.at(-1).effect, a.effects.at(-1).effect === 'efficace' ? 'ok' : 'warn') : null),
        (a.effects || []).length ? h('ul', { class: 'plain small' }, a.effects.map(ef => h('li', {}, `${model.frShort(ef.date)} : ${ef.effect}${ef.note ? ` — ${ef.note}` : ''}`))) : null,
        h('div', { class: 'row' }, h('button', { class: 'btn btn-link small', type: 'button', onclick: () => effectDialog(a) }, 'noter l’effet'),
          h('button', { class: 'btn btn-link small', type: 'button', onclick: () => store.update(a.id, { active: a.active === false }, a.active === false ? 'Aide reprise' : 'Aide arrêtée') }, a.active === false ? 'reprendre' : 'arrêter'))))) : h('p', { class: 'muted' }, 'Aucune aide notée.')),
    h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Portfolio : productions et réussites'), h('button', { class: 'btn btn-small', type: 'button', onclick: () => portfolioDialog(s) }, '+ Production')),
      port.length ? h('ul', { class: 'obs-list' }, port.map(p => h('li', {}, h('strong', {}, `${model.frShort(p.date)} — ${p.title}`),
        (p.competencyIds || []).length ? h('div', { class: 'small' }, p.competencyIds.map(c => competencyLabel(c, idx)).join(' ; ')) : null,
        p.note ? h('p', { class: 'small' }, p.note) : null, (p.fileIds || []).map(fileLink)))) : h('p', { class: 'muted' }, 'Aucune production.')));
  void cls; void rerender;
}

function simpleDialog(title, fields, onSave, rec = null) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() }, fields);
  const actions = [{ label: 'Annuler' }];
  if (rec) actions.unshift({ label: 'Supprimer', danger: true, onClick: async () => { await store.remove(rec.id, `${title} supprimé(e)`); toast('Mis à la corbeille', { action: 'Annuler', onAction: () => store.undo() }); } });
  actions.push({ label: 'Enregistrer', primary: true, onClick: async () => onSave(formData(form)) });
  modal({ title, body: form, wide: true, actions });
}
const subjOpts = (sel) => [h('option', { value: '' }, '—'), ...model.subjects().map(x => h('option', { value: x, selected: x === sel }, x))];

function levelDialog(s) {
  simpleDialog(`Situer ${s.firstName}`, [
    h('div', { class: 'grid-3' }, field('Domaine', h('select', { name: 'domain' }, subjOpts(''))), field('Niveau', h('select', { name: 'level' }, E.LEVELS.map(l => h('option', { value: l }, l)))), field('Date', h('input', { name: 'date', type: 'date', value: model.todayIso() }))),
    field('Précision', h('input', { name: 'note', placeholder: 'ex. lecture de mots, calcul posé…' }))],
  async (d) => { if (!d.domain) { toast('Choisissez un domaine', { kind: 'error' }); return false; } await store.create('levelmark', { studentId: s.id, ...d }, `Niveau de ${s.firstName} en ${d.domain}`); });
}
function obsDialog(s, o = null) {
  simpleDialog(o ? 'Observation' : `Observation — ${s.firstName}`, [
    h('div', { class: 'grid-3' }, field('Date', h('input', { name: 'date', type: 'date', value: o?.date || model.todayIso() })), field('Type', h('select', { name: 'kind' }, E.OBS_KINDS.map(k => h('option', { value: k, selected: o?.kind === k }, k)))), field('Domaine', h('select', { name: 'domain' }, subjOpts(o?.domain)))),
    field('Observation', h('textarea', { name: 'text', rows: 3, 'data-testid': 'obs-text' }, o?.text || '')),
    h('div', { class: 'grid-2' }, field('Action prévue', h('input', { name: 'action', value: o?.action || '' })), field('Suivi le', h('input', { name: 'followUp', type: 'date', value: o?.followUp || '' })))],
  async (d) => { if (!d.text) return false; if (o) await store.update(o.id, d, 'Observation modifiée'); else await store.create('observation', { studentId: s.id, ...d, done: false }, `Observation sur ${s.firstName}`); }, o);
}
function aidDialog(s) {
  simpleDialog(`Aide pour ${s.firstName}`, [
    field('Aide', h('input', { name: 'label', placeholder: 'ex. consignes lues à voix haute, police agrandie, tableau de numération' })),
    h('div', { class: 'grid-2' }, field('Domaine', h('select', { name: 'domain' }, subjOpts(''))), field('Depuis le', h('input', { name: 'startedAt', type: 'date', value: model.todayIso() })))],
  async (d) => { if (!d.label) return false; await store.create('aid', { studentId: s.id, ...d, active: true, effects: [], date: d.startedAt }, `Aide pour ${s.firstName}`); });
}
function effectDialog(a) {
  simpleDialog(`Effet de l’aide « ${a.label} »`, [
    h('div', { class: 'grid-2' }, field('Date', h('input', { name: 'date', type: 'date', value: model.todayIso() })), field('Effet', h('select', { name: 'effect' }, E.AID_EFFECTS.map(x => h('option', { value: x }, x))))),
    field('Remarque', h('input', { name: 'note' }))],
  async (d) => { await store.update(a.id, { effects: [...(store.get(a.id).effects || []), d] }, 'Effet d’une aide noté'); });
}
function portfolioDialog(s) {
  let comps = [];
  let fileId = null;
  simpleDialog(`Production — ${s.firstName}`, [
    h('div', { class: 'grid-2' }, field('Titre', h('input', { name: 'title' })), field('Date', h('input', { name: 'date', type: 'date', value: model.todayIso() }))),
    field('Remarque', h('input', { name: 'note' })),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-small', type: 'button', onclick: async (e) => { const sel = await pickCompetencies(comps); if (sel) { comps = sel; e.target.textContent = `${sel.length} compétence(s)`; } } }, 'Compétences…'),
      h('button', { class: 'btn btn-small', type: 'button', onclick: async (e) => { fileId = await attach({ studentIds: [s.id], tags: ['portfolio'] }); if (fileId) e.target.textContent = 'Fichier joint ✓'; } }, 'Joindre une photo / un scan'))],
  async (d) => { if (!d.title) return false; await store.create('portfolio', { studentId: s.id, ...d, competencyIds: comps, fileIds: fileId ? [fileId] : [] }, `Portfolio de ${s.firstName}`); });
}

// ───────── Besoins particuliers (confidentiel)
export function besoinsTab(s, rerender) {
  return h('section', { class: 'card' }, h('h2', {}, 'Besoins particuliers et accompagnements'),
    h('p', { class: 'muted small' }, 'Distinguez ce qui est confirmé par un document de ce qui relève de vos observations. Aucune adaptation n’est appliquée automatiquement à partir d’un diagnostic.'),
    C.gate(() => {
      const needs = E.of('need', s.id); const plans = E.of('plan', s.id);
      return h('div', { class: 'stack', 'data-testid': 'sensitive' },
        h('div', {}, h('div', { class: 'card-head' }, h('h3', {}, 'Besoins'), h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'add-need', onclick: () => needDialog(s) }, '+ Besoin')),
          needs.length ? h('ul', { class: 'obs-list' }, needs.map(n => h('li', {}, h('strong', {}, n.category), ' ', badge(n.source, n.source.startsWith('confirmé') ? 'info' : 'muted'), h('span', { class: 'muted small' }, ` ${model.frShort(n.date)}`),
            n.detail ? h('p', { class: 'pre small' }, n.detail) : null, h('button', { class: 'btn btn-link small', type: 'button', onclick: () => needDialog(s, n) }, 'modifier')))) : h('p', { class: 'muted' }, 'Aucun.')),
        h('div', {}, h('div', { class: 'card-head' }, h('h3', {}, 'PPRE, PAP, PPS, PAI, AESH'), h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'add-plan', onclick: () => planDialog(s) }, '+ Dispositif')),
          plans.length ? h('ul', { class: 'obs-list' }, plans.map(p => h('li', {}, h('strong', {}, p.kind), ' ', badge(p.status, p.status === 'en cours' ? 'ok' : 'muted'),
            h('span', { class: 'muted small' }, ` ${p.start ? 'du ' + model.frShort(p.start) : ''}${p.end ? ' au ' + model.frShort(p.end) : ''}`),
            p.adaptations ? h('p', { class: 'pre small' }, h('strong', {}, 'Aménagements : '), p.adaptations) : null,
            p.schedule ? h('p', { class: 'small' }, h('strong', {}, 'Créneaux d’accompagnement : '), p.schedule) : null,
            (p.fileIds || []).length ? h('p', { class: 'small' }, p.fileIds.map(fileLink)) : null,
            h('button', { class: 'btn btn-link small', type: 'button', onclick: () => planDialog(s, p) }, 'modifier')))) : h('p', { class: 'muted' }, 'Aucun.')));
    }, rerender));
}
function needDialog(s, n = null) {
  simpleDialog('Besoin particulier', [
    h('div', { class: 'grid-3' }, field('Catégorie', h('select', { name: 'category' }, E.NEED_CATEGORIES.map(c => h('option', { value: c, selected: n?.category === c }, c)))),
      field('Origine', h('select', { name: 'source' }, E.NEED_SOURCES.map(c => h('option', { value: c, selected: n?.source === c }, c)))), field('Date', h('input', { name: 'date', type: 'date', value: n?.date || model.todayIso() }))),
    field('Détail', h('textarea', { name: 'detail', rows: 3 }, n?.detail || ''))],
  async (d) => { if (n) await store.update(n.id, d, 'Besoin modifié'); else await store.create('need', { studentId: s.id, ...d, sensitive: true }, 'Besoin particulier ajouté'); }, n);
}
function planDialog(s, p = null) {
  let fileIds = p?.fileIds || [];
  simpleDialog('Dispositif d’accompagnement', [
    h('div', { class: 'grid-3' }, field('Dispositif', h('select', { name: 'kind' }, E.PLAN_KINDS.map(c => h('option', { value: c, selected: p?.kind === c }, c)))),
      field('Statut', h('select', { name: 'status' }, E.PLAN_STATUS.map(c => h('option', { value: c, selected: p?.status === c }, c)))), field('Début', h('input', { name: 'start', type: 'date', value: p?.start || '' }))),
    h('div', { class: 'grid-2' }, field('Fin / révision', h('input', { name: 'end', type: 'date', value: p?.end || '' })), field('Créneaux d’accompagnement (AESH, RASED…)', h('input', { name: 'schedule', value: p?.schedule || '', placeholder: 'ex. lundi 9h-10h30' }))),
    field('Aménagements', h('textarea', { name: 'adaptations', rows: 3 }, p?.adaptations || '')),
    h('button', { class: 'btn btn-small', type: 'button', onclick: async (e) => { const id = await attach({ studentIds: [s.id], tags: ['confidentiel'] }); if (id) { fileIds = [...fileIds, id]; e.target.textContent = `${fileIds.length} document(s) joint(s)`; } } }, 'Joindre un document')],
  async (d) => { if (p) await store.update(p.id, { ...d, fileIds }, 'Dispositif modifié'); else await store.create('plan', { studentId: s.id, ...d, fileIds, sensitive: true }, 'Dispositif ajouté'); }, p);
}

// ───────── Vie scolaire
export function vieTab(s, cls) {
  const att = V.attendanceOfStudent(s.id);
  const count = (st) => att.filter(x => x.m.status === st).length;
  const plan = cls ? V.planOf(cls.id)?.plans?.[s.id] || {} : {};
  return h('div', { class: 'stack' },
    h('section', { class: 'card' }, h('h2', {}, 'Présences'),
      h('div', { class: 'tags' }, badge(`${count('absent')} demi-journée(s) d’absence`, 'warn'), badge(`${count('retard')} retard(s)`, 'warn'), badge(`${count('départ')} départ(s) anticipé(s)`, 'muted'), badge(`${count('partiel')} absence(s) partielle(s)`, 'muted')),
      att.filter(x => x.m.status !== 'présent').length ? h('ul', { class: 'plain' }, att.filter(x => x.m.status !== 'présent').slice(0, 40).map(({ a, m }) => h('li', {},
        h('a', { href: `#/appel?d=${a.date}&h=${encodeURIComponent(a.half)}` }, `${model.frShort(a.date)} ${a.half}`), ` : ${m.status}${m.time ? ' ' + m.time : ''}${m.from ? ` ${m.from}–${m.to}` : ''}${m.comment ? ` — ${m.comment}` : ''}`, a.validated ? null : badge('appel non validé', 'muted')))) : h('p', { class: 'muted' }, 'Aucune absence ni retard enregistré.')),
    h('section', { class: 'card' }, h('h2', {}, 'Services et sorties'),
      h('ul', { class: 'plain' }, V.services().map(svc => h('li', {}, h('strong', {}, `${svc} : `), (plan[svc] || []).length ? plan[svc].map(d => model.JOURS[d]).join(', ') : 'non inscrit')),
        h('li', {}, h('strong', {}, 'Sortie habituelle : '), s.departure?.mode || 'à renseigner'),
        h('li', {}, h('strong', {}, 'Personnes autorisées : '), (s.contacts || []).filter(c => c.pickup).map(c => c.name).join(', ') || 'aucune renseignée')),
      h('a', { class: 'btn btn-small', href: '#/services?t=semaine' }, 'Modifier la semaine type')));
}

// ───────── Échanges avec la famille
export function echangesTab(s) {
  const ex = E.of('exchange', s.id);
  return h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Échanges et rendez-vous'), h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'add-exchange', onclick: () => exchangeDialog(s) }, '+ Échange')),
    h('p', { class: 'muted small' }, 'Historique personnel, non partagé. La messagerie avec les familles et la prise de rendez-vous arriveront avec l’étape 5.'),
    ex.length ? h('ul', { class: 'obs-list' }, ex.map(x => h('li', {}, h('strong', {}, model.frShort(x.date)), ' ', badge(x.kind, 'muted'), x.with ? ` avec ${x.with}` : '',
      h('p', { class: 'pre small' }, x.summary || ''), x.followUp ? h('p', { class: 'small' }, `Suite : ${x.followUp}`) : null,
      h('button', { class: 'btn btn-link small', type: 'button', onclick: () => exchangeDialog(s, x) }, 'modifier')))) : h('p', { class: 'muted' }, 'Aucun échange noté.'));
}
function exchangeDialog(s, x = null) {
  simpleDialog('Échange avec la famille', [
    h('div', { class: 'grid-3' }, field('Date', h('input', { name: 'date', type: 'date', value: x?.date || model.todayIso() })), field('Type', h('select', { name: 'kind' }, E.EXCHANGE_KINDS.map(k => h('option', { value: k, selected: x?.kind === k }, k)))),
      field('Avec', h('select', { name: 'with' }, h('option', { value: '' }, '—'), (s.contacts || []).map(c => h('option', { value: c.name, selected: x?.with === c.name }, c.name))))),
    field('Résumé', h('textarea', { name: 'summary', rows: 3 }, x?.summary || '')), field('Suite à donner', h('input', { name: 'followUp', value: x?.followUp || '' }))],
  async (d) => { if (x) await store.update(x.id, d, 'Échange modifié'); else await store.create('exchange', { studentId: s.id, ...d }, `Échange avec la famille de ${s.firstName}`); }, x);
}
void pickMany; void iconBtn; void confirmDialog; void icon;
