// Cahier journal : fiche d'une activité du jour (comme dans les cahiers journaux en ligne) —
// durée, organisation, domaine, discipline, décloisonnement, hors horaires, intitulé, objectif,
// séquence, déroulement, matériel, lieu, pièces jointes, notes, compétences.
// Tout est enregistré sur la séance datée : l'emploi du temps et la fiche de séance ne changent pas.
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import * as PL from '../planning.js';
import { h, icon, toast, modal, field, badge, pickFiles, safeUrl } from '../ui.js';
import { levelChips } from '../pedago-ui.js';
import { addFiles } from './files.js';
import { competencyIndex } from './referentiels.js';

export const LIEUX = ['Classe', 'Cour', 'Gymnase', 'Salle de motricité', 'BCD / bibliothèque', 'Salle informatique', 'Piscine', 'Extérieur'];
const minutes = (a, b) => (a && b ? model.minutes(b) - model.minutes(a) : 0);
export const durLabel = (a, b) => { const m = minutes(a, b); return m > 0 ? model.durationLabel(m) : ''; };

/** Domaines déjà utilisés (programmations, séquences, activités) : proposés, jamais imposés. */
function domainSuggestions(cls) {
  const out = new Set();
  for (const p of P.ofClass('programmation', cls.id)) for (const d of p.subdomains || []) out.add(d);
  for (const s of P.ofClass('sequence', cls.id)) if (s.subdomain) out.add(s.subdomain);
  for (const o of store.all('occurrence').filter(x => x.classId === cls.id && x.domain)) out.add(o.domain);
  return [...out].sort((a, b) => a.localeCompare(b, 'fr'));
}

/**
 * Ouvre la fiche d'activité. e = entrée du cahier journal (créneau, séance datée…) ou null pour une nouvelle activité.
 */
export function activityDialog(cls, e, date) {
  const occ = e?.occ || {};
  const s = e?.session || null;
  const val = (k, fallback = '') => occ[k] ?? fallback;
  let levels = e?.levels || [];
  let files = [...(occ.fileIds || [])];
  let comps = [...(occ.competencyIds || [])];
  const dl = h('datalist', { id: 'dl-domaines' }, domainSuggestions(cls).map(d => h('option', { value: d })));
  const dlLieu = h('datalist', { id: 'dl-lieux' }, LIEUX.map(d => h('option', { value: d })));
  const start = h('input', { type: 'time', value: e?.start || '09:00', 'data-testid': 'act-start' });
  const end = h('input', { type: 'time', value: e?.end || '09:45', 'data-testid': 'act-end' });
  const dur = h('input', { type: 'number', min: 5, step: 5, value: minutes(start.value, end.value) || 45, style: { width: '6em' }, 'data-testid': 'act-duration', 'aria-label': 'Durée en minutes' });
  const syncDur = () => { const m = minutes(start.value, end.value); if (m > 0) dur.value = m; };
  start.addEventListener('change', () => { const m = Number(dur.value) || 45; end.value = model.hhmm(model.minutes(start.value) + m); });
  end.addEventListener('change', syncDur);
  dur.addEventListener('change', () => { const m = Math.max(5, Number(dur.value) || 45); end.value = model.hhmm(model.minutes(start.value) + m); });
  const org = val('org', 'classe');
  const radio = (v, l) => h('label', { class: 'inline' }, h('input', { type: 'radio', name: 'act-org', value: v, checked: org === v, 'data-testid': `act-org-${v}` }), l);
  const subject = h('select', { 'data-testid': 'act-subject' }, h('option', { value: '' }, '—'), model.subjects().map(x => h('option', { value: x, selected: x === (e?.subject || '') }, x)));
  const domain = h('input', { list: 'dl-domaines', value: val('domain', s ? (store.get(s.sequenceId)?.subdomain || s.subdomain || '') : ''), placeholder: 'ex. Nombres, calcul et résolution de problèmes', 'data-testid': 'act-domain' });
  const declo = h('input', { type: 'checkbox', checked: !!occ.decloisonnement, 'data-testid': 'act-declo' });
  const hors = h('input', { type: 'checkbox', checked: !!occ.horsHoraires, 'data-testid': 'act-hors' });
  const title = h('input', { value: occ.title || (s ? '' : (e?.title && e.title !== e.subject ? e.title : '')), placeholder: s ? P.sessionTitle(s) : 'ex. Calcul mental, rituel, évaluation', 'data-testid': 'act-title' });
  const objective = h('textarea', { rows: 2, placeholder: s?.objective || '', 'data-testid': 'act-objective' }, val('objective'));
  const seqs = P.ofClass('sequence', cls.id).sort((a, b) => (a.subject || '').localeCompare(b.subject || '') || (a.number || 0) - (b.number || 0));
  const seqSel = h('select', { 'data-testid': 'act-sequence' }, h('option', { value: '' }, s?.sequenceId ? `(celle de la fiche : ${P.sequenceTitle(store.get(s.sequenceId))})` : '—'),
    seqs.map(q => h('option', { value: q.id, selected: q.id === occ.sequenceId }, `${q.subject ? q.subject + ' · ' : ''}${P.sequenceTitle(q)}`)));
  const deroule = h('textarea', { rows: 5, placeholder: s ? (s.phases || []).map(ph => `${ph.duration ? ph.duration + ' min ' : ''}${ph.title || P.PHASE_KINDS[ph.kind]?.label || ''}${ph.consigne ? ' : ' + ph.consigne : ''}`).join('\n') : 'ex. 5 min Rappel : …\n15 min Recherche : …\n10 min Mise en commun : …', 'data-testid': 'act-deroule' }, val('deroule'));
  const materiel = h('textarea', { rows: 2, placeholder: s?.materiel || '', 'data-testid': 'act-materiel' }, val('materiel'));
  const lieu = h('input', { list: 'dl-lieux', value: val('lieu'), placeholder: 'Classe', 'data-testid': 'act-lieu' });
  const notes = h('textarea', { rows: 2, 'data-testid': 'act-notes' }, val('notes'));
  const mode = h('select', {}, PL.MODES.map(([v, l]) => h('option', { value: v, selected: v === (e?.mode || 'dirigé') }, l)));

  // Pièces jointes
  const fileList = h('ul', { class: 'plain small', 'data-testid': 'act-files' });
  const drawFiles = () => fileList.replaceChildren(...files.map(id => store.get(id)).filter(f => f && !f.deletedAt).map(f => h('li', {}, icon('file', 14), ' ', f.name, ' ',
    h('button', { class: 'linklike', type: 'button', 'aria-label': `Retirer ${f.name}`, onclick: () => { files = files.filter(x => x !== f.id); drawFiles(); } }, 'retirer'))));
  drawFiles();
  const existing = h('select', { 'aria-label': 'Joindre un fichier existant', onchange: (ev) => { if (ev.target.value && !files.includes(ev.target.value)) { files.push(ev.target.value); drawFiles(); } ev.target.value = ''; } },
    h('option', { value: '' }, 'Joindre un fichier existant…'), store.all('file').filter(f => !f.deletedAt).sort((a, b) => (a.name || '').localeCompare(b.name || '')).slice(0, 400).map(f => h('option', { value: f.id }, f.name)));
  const addBtn = h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'act-add-file', onclick: async () => {
    const picked = await pickFiles({}); if (!picked.length) return;
    const created = await addFiles(picked, null, { subject: subject.value || '' }); files.push(...created.map(c => c.id)); drawFiles();
  } }, icon('plus', 14), 'Ajouter des fichiers');

  // Compétences : recherche dans les référentiels (code ou intitulé)
  const idx = competencyIndex();
  const lv = new Set(cls.levels || []);
  const pool = [...idx.values()].filter(c => !c.ref.levels?.length || c.ref.levels.some(l => lv.has(l)));
  const q = h('input', { type: 'search', placeholder: pool.length ? 'Chercher une compétence (code ou mot)…' : 'Aucun référentiel : Préparer › Programmes et référentiels', disabled: !pool.length, 'data-testid': 'act-comp-search' });
  const results = h('div', { class: 'pick-list act-comp-results' });
  const chosenBox = h('div', { class: 'chips', 'data-testid': 'act-comps' });
  const drawComps = () => {
    chosenBox.replaceChildren(...comps.map(id => { const c = idx.get(id); return h('span', { class: 'chip' }, c ? (c.code || c.label.slice(0, 40)) : '?', ' ', h('button', { class: 'linklike', type: 'button', 'aria-label': 'Retirer', onclick: () => { comps = comps.filter(x => x !== id); drawComps(); } }, '×')); }));
    const t = q.value.trim().toLowerCase();
    results.replaceChildren(...(t.length < 2 ? [] : pool.filter(c => `${c.code || ''} ${c.label}`.toLowerCase().includes(t)).slice(0, 12).map(c => h('button', { class: 'quick-item', type: 'button', 'data-testid': 'act-comp-item', onclick: () => { if (!comps.includes(c.id)) comps.push(c.id); q.value = ''; drawComps(); } },
      h('strong', {}, c.code || ''), h('span', {}, c.label)))));
  };
  q.addEventListener('input', drawComps); drawComps();

  const sessSel = !e ? h('select', { 'data-testid': 'act-session' }, h('option', { value: '' }, '— aucune (activité décrite ici)'), P.ofClass('session', cls.id).map(x => h('option', { value: x.id }, `${P.sessionTitle(x)}${x.subject ? ' (' + x.subject + ')' : ''}`))) : null;
  const multi = (cls.levels || []).length > 1;
  const body = h('div', { class: 'form act-form' }, dl, dlLieu,
    sessSel ? field('Fiche de séance (facultatif)', sessSel) : null,
    h('div', { class: 'grid-3' }, field('Début', start), field('Fin', end), field('Durée (min)', dur)),
    h('div', { class: 'row wrap' }, radio('classe', 'Classe entière'), radio('groupes', 'Groupes'),
      cls.declo?.enabled || occ.decloisonnement ? h('label', { class: 'inline' }, declo, 'Décloisonnement') : null, h('label', { class: 'inline' }, hors, 'Hors horaires')),
    multi ? h('div', { class: 'field' }, h('label', {}, 'Niveaux (aucun = toute la classe)'), levelChips(levels, cls.levels, (v) => { levels = v; })) : null,
    h('div', { class: 'grid-2' }, field('Domaine', domain), field('Discipline', subject)),
    field('Intitulé', title),
    field('Objectif', objective),
    h('div', { class: 'grid-2' }, field('Séquence', seqSel), field('Encadrement', mode)),
    s ? h('p', { class: 'small' }, 'Fiche de séance liée : ', h('a', { href: `#/seance/${s.id}` }, P.sessionTitle(s)), h('span', { class: 'muted' }, ' — les champs vides reprennent la fiche (texte grisé).')) : null,
    field('Déroulement de la séance', deroule),
    h('div', { class: 'grid-2' }, field('Matériel', materiel), field('Lieu', lieu)),
    h('div', { class: 'field' }, h('label', {}, 'Pièces jointes'), fileList, h('div', { class: 'row' }, addBtn, existing)),
    field('Notes', notes),
    h('div', { class: 'field' }, h('label', {}, 'Compétences'), chosenBox, q, results),
    e ? h('p', { class: 'muted small' }, 'Ne change que cette date : l’emploi du temps et la fiche de séance restent inchangés.') : null);

  modal({ title: e ? `Activité du ${model.frDate(e.date)} — ${e.start}` : `Nouvelle activité — ${model.frDate(date)}`, wide: true, body,
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, testid: 'act-save', onClick: async () => {
      if (!start.value || !end.value || end.value <= start.value) { toast('Horaire invalide : la fin doit suivre le début.', { kind: 'error' }); return false; }
      const data = { start: start.value, end: end.value, subject: subject.value, mode: mode.value, levels,
        org: body.querySelector('input[name=act-org]:checked')?.value || 'classe', domain: domain.value.trim(), decloisonnement: declo.checked, horsHoraires: hors.checked,
        title: title.value.trim(), objective: objective.value.trim(), sequenceId: seqSel.value || null, deroule: deroule.value.trim(), materiel: materiel.value.trim(),
        lieu: lieu.value.trim(), fileIds: files, notes: notes.value.trim(), competencyIds: comps };
      if (e) await PL.patchEntry(e, cls, data, `Activité du ${model.frShort(e.date)} modifiée`);
      else { const sid = sessSel?.value || null; if (sid && !data.subject) data.subject = store.get(sid)?.subject || ''; await store.create('occurrence', { classId: cls.id, date, status: 'prévue', sessionId: sid, ...data }, `Activité ajoutée le ${model.frShort(date)}`); }
    } }] });
}

/** Détails saisis dans la fiche d'activité, affichés sur la carte du cahier journal. */
export function activityDetails(e, shown) {
  const o = e.occ || {};
  const out = [];
  const tags = [o.org === 'groupes' ? badge('groupes', 'info') : null, o.decloisonnement ? badge('décloisonnement', 'info') : null, o.horsHoraires ? badge('hors horaires', 'muted') : null,
    o.lieu && o.lieu !== 'Classe' ? badge(o.lieu, 'muted') : null, o.domain ? h('span', { class: 'muted small' }, o.domain) : null].filter(Boolean);
  if (tags.length) out.push(h('div', { class: 'row small act-tags' }, tags));
  const seq = o.sequenceId ? store.get(o.sequenceId) : null;
  if (seq && !seq.deletedAt) out.push(h('p', { class: 'small' }, h('strong', {}, 'Séquence : '), h('a', { href: `#/sequence/${seq.id}` }, P.sequenceTitle(seq))));
  if (o.objective && o.objective !== shown?.objective) out.push(h('p', { class: 'small' }, h('strong', {}, 'Objectif : '), o.objective));
  if (o.deroule) out.push(h('details', { class: 'small act-deroule' }, h('summary', {}, 'Déroulement'), h('p', { class: 'pre' }, o.deroule)));
  if (o.materiel) out.push(h('p', { class: 'small' }, h('strong', {}, 'Matériel : '), o.materiel));
  if (o.notes) out.push(h('p', { class: 'small' }, h('strong', {}, 'Notes : '), o.notes));
  const files = (o.fileIds || []).map(id => store.get(id)).filter(f => f && !f.deletedAt);
  if (files.length) out.push(h('p', { class: 'small' }, icon('file', 14), ' ', files.map(f => f.kind === 'link' && safeUrl(f.url) ? h('a', { href: safeUrl(f.url), target: '_blank', rel: 'noopener noreferrer' }, f.name) : h('a', { href: `#/fichiers?open=${f.id}` }, f.name)).reduce((a, x) => [...a, a.length ? ', ' : '', x], [])));
  return out;
}
