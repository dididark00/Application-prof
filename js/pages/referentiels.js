// Référentiels (programmes officiels) : sourcés, datés, versionnés, vérifiés avant intégration.
// La liste des textes en vigueur (quel programme pour quel niveau) est fournie avec ses sources ;
// les intitulés détaillés des compétences sont importés depuis le texte officiel, vérifiés puis validés.
import * as store from '../store.js';
import * as model from '../model.js';
import { h, icon, toast, modal, field, formData, confirmDialog, download, pickFiles, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { parseCsv, toCsv } from '../csv.js';
import { pickMany } from '../forms.js';
import * as PR from '../programmes.js';

let rerenderRef = () => {};
export function render({ params, rerender }) {
  if (rerender) rerenderRef = rerender;
  if (params[0]) return detail(params[0]);
  const refs = store.all('referential').sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr') || (b.version || '').localeCompare(a.version || ''));
  return h('div', { class: 'page' },
    pageHeader('Programmes et référentiels', { favKey: 'preparer/programmes', subtitle: 'Compétences officielles importées et vérifiées par vous, avec leur source et leur version.',
      actions: [
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-ref', onclick: () => newDialog() }, icon('plus', 16), 'Nouveau référentiel'),
        h('button', { class: 'btn', type: 'button', onclick: () => download('modele-referentiel.csv', toCsv([['Code', 'Domaine', 'Sous-domaine', 'Intitulé', 'Niveaux'], ['', '', '', '', 'CE1, CE2']]), 'text/csv;charset=utf-8') }, icon('download', 16), 'Modèle CSV'),
      ] }),
    subTabs(),
    h('details', { class: 'card how', 'data-testid': 'ref-how', open: !refs.length }, h('summary', {}, h('strong', {}, 'À quoi ça sert ? Comment tout est relié')),
      h('ol', {},
        h('li', {}, h('strong', {}, 'Importer les compétences : '), 'dans « Programmes en vigueur » ci-dessous, le bouton « Importer les compétences » d’une ligne (ex. Mathématiques CE2) recopie la liste officielle des compétences du programme (BO) dans l’application. C’est votre « référentiel ».'),
        h('li', {}, h('strong', {}, 'Relire et valider : '), 'ouvrez-le, relisez (la page du PDF officiel est indiquée), puis « Valider ». Seuls les référentiels validés sont proposés ensuite.'),
        h('li', {}, h('strong', {}, 'Relier : '), 'dans une programmation (notions), une séquence ou une fiche de séance, le bouton « Compétences officielles… » permet de cocher les compétences travaillées.'),
        h('li', {}, h('strong', {}, 'Le reste suit tout seul : '), 'le cahier journal reprend les fiches (donc leurs compétences), les évaluations peuvent viser les mêmes compétences, les livrets s’appuient sur les résultats.'),
        h('li', {}, h('strong', {}, 'Vérifier la couverture : '), 'dans chaque référentiel, la colonne « Travaillée » montre où et quand chaque compétence a été travaillée (fiches, séquences, jours faits au cahier journal, évaluations) et celles qui ne le sont pas encore.')),
      h('p', { class: 'muted small' }, 'Facultatif : vous pouvez aussi écrire les compétences en texte libre dans vos fiches, comme dans vos modèles.')),
    officialCard(refs),
    h('h2', { style: { marginTop: '18px' } }, 'Mes référentiels'),
    h('p', { class: 'muted' }, 'Importez les compétences depuis le texte officiel (copier-coller ou CSV), vérifiez l’aperçu, puis validez. Seuls les référentiels validés sont proposés dans les fiches.'),
    refs.length ? h('div', { class: 'stack' }, refs.map(r => h('div', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h2', {}, h('a', { href: `#/referentiels/${r.id}` }, r.name), ' ', badge(`v${r.version || '?'}`, 'muted'), r.status === 'validé' ? badge('validé', 'ok') : badge('à vérifier', 'warn')),
        h('a', { class: 'btn btn-small', href: `#/referentiels/${r.id}` }, 'Ouvrir')),
      h('p', { class: 'muted' }, `${(r.items || []).length} compétence(s) · ${(r.levels || []).join(', ') || 'tous niveaux'} · Source : ${r.source || '—'}${r.publishedAt ? ` · texte du ${model.frShort(r.publishedAt)}` : ''}`))))
      : emptyState('Aucun référentiel', 'Les fiches acceptent aussi les compétences en texte libre, comme dans vos modèles. Le référentiel permet en plus de relier séances, évaluations et bilans à des compétences identifiées.'));
}

function newDialog(base = null, pre = null) {
  const p = pre || {};
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Nom', h('input', { name: 'name', required: true, value: base?.name || p.name || '', placeholder: 'ex. Programme cycle 2 — mathématiques' })),
    h('div', { class: 'grid-3' },
      field('Version', h('input', { name: 'version', value: base ? nextVersion(base.version) : '1', required: true })),
      field('Date du texte officiel', h('input', { name: 'publishedAt', type: 'date', value: base?.publishedAt || p.publishedAt || '' })),
      field('Niveaux (séparés par des virgules)', h('input', { name: 'levels', value: (base?.levels || p.levels || []).join(', ') }))),
    field('Source (obligatoire)', h('input', { name: 'source', required: true, value: base?.source || p.source || '', placeholder: 'ex. BO n° …, Éduscol, adresse de la page' }), 'Indiquez précisément d’où viennent les intitulés.'));
  const errors = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: base ? `Nouvelle version de « ${base.name} »` : 'Nouveau référentiel', body: h('div', {}, form, errors, base ? h('p', { class: 'muted' }, 'Les compétences sont recopiées dans la nouvelle version (à vérifier). L’ancienne version reste intacte : les fiches qui y renvoient gardent leur référence.') : null),
    actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, onClick: async () => {
      const d = formData(form);
      if (!d.name || !d.source || !d.version) { errors.textContent = 'Nom, source et version sont obligatoires.'; return false; }
      const levels = d.levels.split(',').map(x => x.trim().toUpperCase()).filter(l => model.NIVEAUX.includes(l));
      const items = base ? (base.items || []).map(i => ({ ...i, id: store.uid(), previousId: i.id })) : [];
      const r = await store.create('referential', { name: d.name, version: d.version, publishedAt: d.publishedAt, source: d.source, levels, items, status: 'à vérifier', previousVersionId: base?.id || null }, `Référentiel ${d.name} v${d.version}`);
      location.hash = `#/referentiels/${r.id}`;
    } }] });
}
// ───── Programmes en vigueur (références officielles fournies)
const offState = { levels: null, all: false };
function officialCard(refs) {
  const cls = model.currentClass();
  const mine = model.sortLevels(cls?.levels || []);
  const levels = offState.all || !mine.length ? model.NIVEAUX : mine;
  const rows = PR.forLevels(levels);
  const body = h('tbody', {}, rows.map(r => {
    const name = `${r.subject} — ${r.levels.length > 2 ? cycleOf(r.levels) : r.levels.join(', ')}`;
    const source = `${r.t.title}, ${r.t.bo}${r.pdf ? ` — ${r.pdf}` : ''}`;
    const key = `${r.text}|${r.pack || ''}|${r.domain || ''}|${r.sub || ''}|${r.levels.join(',')}`;
    const existing = refs.find(x => x.officialKey === key) || refs.find(x => !x.officialKey && x.source === source);
    return h('tr', { 'data-testid': 'official-row' },
      h('td', {}, h('strong', {}, r.subject), r.label ? h('div', { class: 'muted small' }, r.label) : null),
      h('td', {}, r.levels.join(', '), r.nouveauFor.length ? h('div', {}, badge(`nouveau en ${r.nouveauFor.join(', ')}`, 'info')) : null),
      h('td', {}, h('div', {}, r.t.title), h('a', { href: r.t.boUrl, target: '_blank', rel: 'noopener' }, r.t.bo), r.t.note ? h('div', { class: 'muted small' }, r.t.note) : null, r.note ? h('div', { class: 'muted small' }, r.note) : null),
      h('td', { class: 'nowrap' }, r.pdf ? h('a', { class: 'btn btn-small', href: r.pdf, target: '_blank', rel: 'noopener' }, icon('download', 14), 'Texte (PDF)') : null, ' ',
        existing ? h('a', { class: 'btn btn-small', href: `#/referentiels/${existing.id}` }, 'Ouvrir le référentiel')
          : r.pack ? h('button', { class: 'btn btn-small btn-primary', type: 'button', 'data-testid': 'official-import', onclick: (e) => importOfficial(r, name, source, key, e.currentTarget) }, icon('download', 14), 'Importer les compétences')
          : h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'official-create', onclick: () => newDialog(null, { name, publishedAt: r.t.date, levels: r.levels, source }) }, icon('plus', 14), 'Créer le référentiel')));
  }));
  return h('div', { class: 'card', 'data-testid': 'official' },
    h('div', { class: 'card-head' }, h('h2', {}, `Programmes officiels en vigueur (${PR.YEAR})`),
      mine.length ? h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: offState.all, 'data-testid': 'official-all', onchange: (e) => { offState.all = e.target.checked; rerenderRef(); } }), 'Tous les niveaux (TPS au CM2)') : null),
    h('p', { class: 'muted small' }, `${offState.all || !mine.length ? 'Tous les niveaux' : `Niveaux de la classe : ${mine.join(', ')}`}. Références relevées le ${model.frDate(PR.CHECKED_AT)} sur Éduscol (`,
      ...[1, 2, 3].flatMap((c, i) => [i ? ', ' : '', h('a', { href: PR.EDUSCOL[c], target: '_blank', rel: 'noopener' }, `cycle ${c}`)]),
      '). Les programmes changent progressivement : vérifiez sur Éduscol en début d’année.'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Discipline / domaine'), h('th', {}, 'Niveaux'), h('th', {}, 'Texte officiel'), h('th', {}, ''))), body)),
    h('p', { class: 'muted small' }, '« Importer les compétences » crée un référentiel « à vérifier » à partir des textes officiels (extraction automatique des PDF du ministère, avec la page de chaque intitulé). Relisez-le, puis validez-le : seuls les référentiels validés sont proposés dans les fiches.'));
}

/** Importe les compétences extraites du texte officiel pour une ligne du tableau (une seule fois). */
async function importOfficial(r, name, source, key, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Import…'; }
  try {
    const items = await PR.packItems(r, r.levels);
    if (!items.length) { toast('Aucune compétence extraite pour ces niveaux.', { kind: 'error' }); return; }
    const ref = await store.create('referential', { name, version: '1', publishedAt: r.t.date, source, levels: r.levels, officialKey: key, pdf: r.pdf || r.t.pdf || '', status: 'à vérifier', previousVersionId: null,
      extracted: { at: PR.CHECKED_AT, how: 'Extraction automatique du PDF officiel, contrôlée mot à mot contre le texte ; intitulés signalés « à relire » quand le contrôle n’est pas concluant.' },
      items: items.map(i => ({ id: store.uid(), code: i.code, domain: i.domain, subdomain: i.subdomain, label: i.label, levels: i.levels.filter(l => r.levels.includes(l)), page: i.page, check: !!i.check })) }, `Référentiel officiel « ${name} » importé`);
    toast(`${items.length} compétence(s) importée(s) — à relire puis valider`);
    location.hash = `#/referentiels/${ref.id}`;
  } catch (e) { toast(`Import impossible : ${e.message}`, { kind: 'error' }); }
  finally { if (btn) { btn.disabled = false; } }
}
function cycleOf(levels) { const c = model.cycles(levels); return c.length === 1 ? `cycle ${c[0]}` : levels.join(', '); }

function nextVersion(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? String(n + 1) : `${v || ''}-2`; }

function detail(id) {
  const r = store.get(id);
  if (!r || r.deletedAt) return h('div', { class: 'page' }, pageHeader('Référentiel introuvable'), h('a', { href: '#/referentiels' }, '← Référentiels'));
  const locked = r.status === 'validé';
  const used = usage(r);
  const cov = coverage();
  const items = (r.items || []).slice().sort((a, b) => (a.code || '').localeCompare(b.code || '', 'fr', { numeric: true }));
  return h('div', { class: 'page' },
    h('p', {}, h('a', { href: '#/referentiels', class: 'back' }, '← Référentiels')),
    pageHeader(`${r.name}`, { subtitle: `Version ${r.version} · ${r.status} · source : ${r.source}${r.publishedAt ? ` · texte du ${model.frDate(r.publishedAt)}` : ''}`,
      actions: [
        !locked ? h('button', { class: 'btn', type: 'button', 'data-testid': 'ref-import', onclick: () => importDialog(r) }, icon('upload', 16), 'Importer des lignes') : null,
        !locked ? h('button', { class: 'btn', type: 'button', onclick: () => itemDialog(r) }, icon('plus', 16), 'Ajouter') : null,
        !locked ? h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'ref-validate', onclick: async () => {
          if (!items.length) { toast('Aucune compétence à valider.', { kind: 'error' }); return; }
          if (!await confirmDialog('Valider ce référentiel ?', `Vous confirmez avoir vérifié les ${items.length} intitulé(s) et la source. Une fois validé, il devient non modifiable ; une correction passera par une nouvelle version.`, { confirmLabel: 'Valider' })) return;
          await store.update(r.id, { status: 'validé', validatedAt: new Date().toISOString() }, `Validation du référentiel ${r.name} v${r.version}`);
        } }, icon('check', 16), 'Valider après vérification') : null,
        locked ? h('button', { class: 'btn', type: 'button', onclick: () => newDialog(r) }, 'Nouvelle version') : null,
        h('button', { class: 'btn', type: 'button', onclick: () => download(`referentiel-${r.name.replace(/[^\w-]+/g, '_')}-v${r.version}.csv`,
          toCsv([['Code', 'Domaine', 'Sous-domaine', 'Intitulé', 'Niveaux'], ...items.map(i => [i.code, i.domain, i.subdomain, i.label, (i.levels || []).join(', ')])]), 'text/csv;charset=utf-8') }, icon('download', 16), 'CSV'),
        h('button', { class: 'btn btn-ghost-danger', type: 'button', 'aria-label': 'Mettre à la corbeille', onclick: async () => {
          if (used && !await confirmDialog('Référentiel utilisé', `${used} fiche(s) y font référence. Elles garderont l’identifiant mais n’afficheront plus l’intitulé tant que le référentiel est à la corbeille.`, { confirmLabel: 'Mettre à la corbeille', danger: true })) return;
          await store.remove(r.id, `Référentiel ${r.name} mis à la corbeille`); location.hash = '#/referentiels';
        } }, icon('trash', 16))] }),
    locked ? h('p', { class: 'muted' }, `Validé le ${model.frDateTime(r.validatedAt)}. Non modifiable : créez une nouvelle version pour corriger.`) : h('div', { class: 'card notice' }, h('p', {}, 'À vérifier : relisez chaque intitulé par rapport au texte officiel avant de valider.'),
      r.extracted ? h('p', { class: 'small' }, `${r.extracted.how} ${items.filter(i => i.check).length} intitulé(s) à relire en priorité. `, r.pdf ? h('a', { href: r.pdf, target: '_blank', rel: 'noopener' }, 'Ouvrir le texte officiel (PDF)') : null) : null),
    h('div', { class: 'card' }, items.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table', 'data-testid': 'ref-items' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Code'), h('th', {}, 'Domaine'), h('th', {}, 'Sous-domaine'), h('th', {}, 'Intitulé'), h('th', {}, 'Niveaux'), r.extracted ? h('th', {}, 'Page') : null, h('th', {}, 'Travaillée'), locked ? null : h('th', {}, ''))),
      h('tbody', {}, items.map(i => h('tr', { class: i.check && !locked ? 'to-check' : '', 'data-testid': 'ref-item' }, h('td', {}, i.code), h('td', {}, i.domain), h('td', {}, i.subdomain), h('td', {}, i.label, i.check && !locked ? h('div', {}, badge('à relire', 'warn')) : null), h('td', {}, (i.levels || []).join(', ')),
        r.extracted ? h('td', {}, i.page ? (r.pdf ? h('a', { href: `${r.pdf}#page=${i.page}`, target: '_blank', rel: 'noopener' }, `p. ${i.page}`) : `p. ${i.page}`) : '') : null,
        h('td', { 'data-testid': 'ref-coverage' }, covCell(cov.get(i.id))),
        locked ? null : h('td', { class: 'row' },
          h('button', { class: 'btn btn-small', type: 'button', onclick: () => itemDialog(r, i) }, 'Modifier'),
          h('button', { class: 'btn btn-small btn-ghost-danger', type: 'button', onclick: async () => {
            await store.update(r.id, { items: store.get(r.id).items.filter(x => x.id !== i.id) }, 'Compétence retirée');
            toast('Compétence retirée', { action: 'Annuler', onAction: () => store.undo() });
          } }, 'Retirer'))))))) : emptyState('Aucune compétence', 'Importez des lignes (copier-coller depuis un tableur) ou ajoutez-les une à une.')));
}

/** Où chaque compétence est travaillée : notions, séquences, fiches, jours du cahier journal, évaluations. */
export function coverage() {
  const out = new Map();
  const add = (cid, k, v) => { if (!out.has(cid)) out.set(cid, { notion: new Set(), sequence: new Set(), session: new Set(), day: new Set(), evaluation: new Set() }); out.get(cid)[k].add(v); };
  for (const t of ['notion', 'sequence', 'session']) for (const x of store.all(t)) for (const c of x.competencyIds || []) add(c, t, x.id);
  const sessComps = new Map(store.all('session').map(x => [x.id, x.competencyIds || []]));
  const seqComps = new Map(store.all('sequence').map(x => [x.id, x.competencyIds || []]));
  for (const o of store.all('occurrence')) {
    if (!o.sessionId || !['faite', 'partielle'].includes(o.status)) continue;
    const se = store.get(o.sessionId);
    for (const c of new Set([...(sessComps.get(o.sessionId) || []), ...(seqComps.get(se?.sequenceId) || [])])) add(c, 'day', o.date);
  }
  for (const e of store.all('evaluation')) for (const it of e.items || []) for (const c of [it.competencyId, ...(it.competencyIds || [])].filter(Boolean)) add(c, 'evaluation', e.id);
  for (const e of store.all('evaluation')) for (const c of e.competencyIds || []) add(c, 'evaluation', e.id);
  return out;
}
function covCell(cv) {
  if (!cv) return h('span', { class: 'muted small' }, 'pas encore reliée');
  const parts = [['session', 'fiche'], ['sequence', 'séquence'], ['notion', 'notion'], ['day', 'jour fait'], ['evaluation', 'évaluation']].filter(([k]) => cv[k].size).map(([k, l]) => `${cv[k].size} ${l}${cv[k].size > 1 ? 's' : ''}`);
  const days = [...cv.day].sort();
  return h('span', { class: 'small', title: days.length ? `Travaillée les : ${days.map(model.frShort).join(', ')}` : '' }, parts.join(' · '), days.length ? h('div', { class: 'muted' }, `dernière fois : ${model.frShort(days.at(-1))}`) : null);
}

function usage(r) {
  const ids = new Set((r.items || []).map(i => i.id));
  return ['session', 'sequence', 'notion'].flatMap(t => store.all(t)).filter(x => (x.competencyIds || []).some(c => ids.has(c))).length;
}

function itemDialog(r, item = null) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-3' }, field('Code', h('input', { name: 'code', value: item?.code || '' })), field('Domaine', h('input', { name: 'domain', value: item?.domain || '' })), field('Sous-domaine', h('input', { name: 'subdomain', value: item?.subdomain || '' }))),
    field('Intitulé (tel que dans le texte officiel)', h('textarea', { name: 'label', rows: 3 }, item?.label || '')),
    field('Niveaux', h('input', { name: 'levels', value: (item?.levels || r.levels || []).join(', ') })));
  modal({ title: item ? 'Modifier la compétence' : 'Ajouter une compétence', body: form, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form);
    if (!d.label) return false;
    const rec = { id: item?.id || store.uid(), code: d.code, domain: d.domain, subdomain: d.subdomain, label: d.label, levels: d.levels.split(',').map(x => x.trim().toUpperCase()).filter(l => model.NIVEAUX.includes(l)), page: item?.page || null, check: false };
    const cur = store.get(r.id).items || [];
    await store.update(r.id, { items: item ? cur.map(x => x.id === item.id ? rec : x) : [...cur, rec] }, item ? 'Compétence modifiée' : 'Compétence ajoutée');
  } }] });
}

function importDialog(r) {
  const ta = h('textarea', { rows: 8, placeholder: 'Code;Domaine;Sous-domaine;Intitulé;Niveaux', 'aria-label': 'Lignes à importer' });
  const preview = h('div');
  let rows = [];
  const analyse = () => {
    const raw = parseCsv(ta.value);
    const head = raw[0] && /intitul/i.test(raw[0].join(' '));
    rows = (head ? raw.slice(1) : raw).map(c => ({ code: c[0] || '', domain: c[1] || '', subdomain: c[2] || '', label: c[3] || '', levels: (c[4] || '').split(/[,/ ]+/).map(x => x.trim().toUpperCase()).filter(l => model.NIVEAUX.includes(l)) }));
    const bad = rows.filter(x => !x.label).length;
    preview.replaceChildren(h('p', {}, `${rows.length - bad} ligne(s) valides${bad ? `, ${bad} sans intitulé (ignorées)` : ''}. Vérifiez l’aperçu :`),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('tbody', {}, rows.slice(0, 200).map(x => h('tr', { class: x.label ? '' : 'row-error' }, h('td', {}, x.code), h('td', {}, x.domain), h('td', {}, x.subdomain), h('td', {}, x.label), h('td', {}, x.levels.join(', '))))))));
  };
  ta.addEventListener('input', analyse);
  modal({ title: 'Importer des compétences', wide: true, body: h('div', { class: 'form' },
    h('p', {}, 'Collez des lignes depuis un tableur (colonnes : Code ; Domaine ; Sous-domaine ; Intitulé ; Niveaux), ou choisissez un fichier CSV. Les lignes sont ajoutées au référentiel, qui reste « à vérifier ».'),
    h('button', { class: 'btn', type: 'button', onclick: async () => { const [f] = await pickFiles({ accept: '.csv,.txt', multiple: false }); if (f) { ta.value = await f.text(); analyse(); } } }, icon('upload', 16), 'Choisir un fichier CSV'),
    ta, preview), actions: [{ label: 'Annuler' }, { label: 'Ajouter ces lignes', primary: true, onClick: async () => {
      const ok = rows.filter(x => x.label).map(x => ({ ...x, id: store.uid() }));
      if (!ok.length) return false;
      await store.update(r.id, { items: [...(store.get(r.id).items || []), ...ok] }, `Import de ${ok.length} compétence(s)`);
      toast(`${ok.length} compétence(s) ajoutée(s) — à vérifier`, { action: 'Annuler', onAction: () => store.undo() });
    } }] });
}

// ───── Utilitaires partagés avec les fiches
export function competencyIndex() {
  const map = new Map();
  for (const r of store.all('referential')) for (const i of r.items || []) map.set(i.id, { ...i, ref: r });
  return map;
}
export function competencyLabel(id, idx = competencyIndex()) {
  const c = idx.get(id);
  return c ? `${c.code ? c.code + ' — ' : ''}${c.label}` : '(compétence d’un référentiel supprimé)';
}
export function competencySource(id, idx = competencyIndex()) {
  const c = idx.get(id); return c ? `${c.ref.name} v${c.ref.version}` : '';
}
export async function pickCompetencies(selected = [], { levels = [] } = {}) {
  const items = [];
  for (const r of store.all('referential').filter(x => x.status === 'validé')) {
    for (const i of r.items || []) {
      if (levels.length && (i.levels || []).length && !i.levels.some(l => levels.includes(l))) continue;
      items.push({ id: i.id, label: `${i.code ? i.code + ' — ' : ''}${i.label}`, detail: [i.domain, i.subdomain].filter(Boolean).join(' › '), group: `${r.name} v${r.version}` });
    }
  }
  return pickMany({ title: 'Compétences officielles (référentiels validés)', items, selected, emptyText: 'Aucun référentiel validé. Importez et validez un référentiel dans Préparer › Programmes et référentiels.' });
}
