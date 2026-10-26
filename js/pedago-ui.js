// Blocs d'interface partagés par les fiches (compétences, fichiers liés, manuels, rubriques).
import * as store from './store.js';
import * as model from './model.js';
import { h, icon, toast, badge, safeUrl, pickFiles } from './ui.js';
import { bound, pickMany } from './forms.js';
import { competencyIndex, competencyLabel, competencySource, pickCompetencies } from './pages/referentiels.js';
import { addFiles } from './pages/files.js';
import { methodHint } from './pages/methodes.js';

/** Rubriques d'une fiche, enregistrées automatiquement. */
export function sectionFields(recId, fields, { hideEmpty = false, prefix = '' } = {}) {
  const rec = store.get(recId);
  const shown = hideEmpty ? fields.filter(f => rec[f.key]) : fields;
  return h('div', { class: 'fields' }, shown.map(f => bound({ ...f, value: rec[f.key], testid: `f-${f.key}`,
    onSave: (v) => store.update(recId, { [f.key]: v }, `${prefix}${f.label}`, { quiet: true }) })));
}

/** Compétences officielles liées (référentiels validés) + texte libre déjà présent dans la fiche. */
export function competencyBlock(recId, { levels = [] } = {}) {
  const rec = store.get(recId);
  const idx = competencyIndex();
  const ids = rec.competencyIds || [];
  return h('div', { class: 'linked' },
    h('div', { class: 'linked-head' }, h('strong', {}, 'Compétences officielles liées'),
      h('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
        const sel = await pickCompetencies(ids, { levels });
        if (sel) await store.update(recId, { competencyIds: sel }, 'Compétences liées');
      } }, 'Choisir…')),
    ids.length ? h('ul', { class: 'linked-list' }, ids.map(id => h('li', {}, competencyLabel(id, idx), h('span', { class: 'muted small' }, ` · ${competencySource(id, idx)}`))))
      : h('p', { class: 'muted small' }, 'Aucune. La rubrique texte ci-dessus reste utilisable seule.'));
}

/** Fichiers et liens rattachés par référence (aucune copie). */
export function filesBlock(recId, { title = 'Fichiers et liens', key = 'fileIds' } = {}) {
  const rec = store.get(recId);
  const ids = (rec[key] || []).filter(id => { const f = store.get(id); return f && !f.deletedAt; });
  const setIds = (next, label) => store.update(recId, { [key]: next }, label);
  return h('div', { class: 'linked' },
    h('div', { class: 'linked-head' }, h('strong', {}, title),
      h('span', { class: 'row' },
        h('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
          const items = store.all('file').map(f => ({ id: f.id, label: f.name, detail: [f.kind === 'link' ? 'lien' : 'fichier', f.subject, f.level, (f.tags || []).join(', ')].filter(Boolean).join(' · ') }));
          const sel = await pickMany({ title: 'Lier des fichiers existants', items, selected: ids, emptyText: 'Aucun fichier dans Préparer › Fichiers.' });
          if (sel) await setIds(sel, 'Fichiers liés');
        } }, 'Lier un fichier'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
          const files = await pickFiles();
          if (!files.length) return;
          const created = await addFiles(files, null, { subject: rec.subject || '' });
          await setIds([...ids, ...created.map(c => c.id)], 'Nouveaux fichiers liés');
        } }, 'Déposer'))),
    ids.length ? h('ul', { class: 'linked-list' }, ids.map(id => {
      const f = store.get(id);
      const url = f.kind === 'link' ? safeUrl(f.url) : null;
      return h('li', {}, icon(f.kind === 'link' ? 'link' : 'file', 14), ' ',
        url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, f.name) : h('a', { href: `#/fichiers?open=${f.id}` }, f.name),
        h('button', { class: 'btn btn-link small', type: 'button', onclick: () => setIds(ids.filter(x => x !== id), 'Fichier délié') }, 'délier'));
    })) : h('p', { class: 'muted small' }, 'Aucun. Lier un fichier ne le copie pas : sa mise à jour se voit partout.'));
}

/** Références aux manuels : pages et exercices vérifiés. */
export function manualRefsBlock(recId) {
  const rec = store.get(recId);
  const refs = rec.manualRefs || [];
  const manuals = store.all('manual');
  const save = (next, label = 'Références manuel') => store.update(recId, { manualRefs: next }, label, { quiet: true });
  return h('div', { class: 'linked' },
    h('div', { class: 'linked-head' }, h('strong', {}, 'Manuels — pages et exercices vérifiés'),
      h('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
        if (!manuals.length) { toast('Ajoutez d’abord un manuel dans Préparer › Manuels.', { kind: 'error' }); return; }
        const sel = await pickMany({ title: 'Choisir un manuel', single: true, items: manuals.map(m => ({ id: m.id, label: m.title, detail: [m.publisher, m.edition, m.kind].filter(Boolean).join(' · ') })) });
        if (sel?.length) await store.update(recId, { manualRefs: [...refs, { id: store.uid(), manualId: sel[0], pages: '', exercises: '' }] }, 'Référence manuel ajoutée');
      } }, 'Ajouter')),
    methodHint(rec),
    refs.length ? h('div', { class: 'stack-sm' }, refs.map(r => {
      const m = store.get(r.manualId);
      return h('div', { class: 'manual-ref' }, h('strong', {}, m ? m.title : '(manuel supprimé)'),
        bound({ type: 'text', value: r.pages, placeholder: 'pages', compact: true, onSave: (v) => save(store.get(recId).manualRefs.map(x => x.id === r.id ? { ...x, pages: v } : x)) }),
        bound({ type: 'text', value: r.exercises, placeholder: 'exercices', compact: true, onSave: (v) => save(store.get(recId).manualRefs.map(x => x.id === r.id ? { ...x, exercises: v } : x)) }),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retirer la référence', onclick: () => store.update(recId, { manualRefs: refs.filter(x => x.id !== r.id) }, 'Référence manuel retirée') }, icon('x', 14)));
    })) : h('p', { class: 'muted small' }, 'Aucune référence. Ne notez que des pages vérifiées.'));
}

export function manualRefsText(refs = []) {
  return refs.map(r => { const m = store.get(r.manualId); return [m?.title, r.pages && `p. ${r.pages}`, r.exercises && `ex. ${r.exercises}`].filter(Boolean).join(' '); }).join(' ; ');
}

export function ownerBadge(owner, cls) {
  return owner ? badge(model.ownerLabel(owner, cls), owner === 'moi' ? 'ok' : owner === 'binome' ? 'info' : 'muted') : null;
}
export function ownerSelect(recId, cls) {
  const rec = store.get(recId);
  return bound({ label: 'Répartition', type: 'select', value: rec.owner || '', options: [['', '—'], ...model.owners(cls)],
    onSave: (v) => store.update(recId, { owner: v }, 'Répartition', { quiet: true }) });
}

export function levelChips(levels, available, onChange) {
  const set = new Set(levels);
  return h('div', { class: 'chips' }, available.map(l => h('label', { class: 'chip' },
    h('input', { type: 'checkbox', checked: set.has(l), onchange: (e) => { e.target.checked ? set.add(l) : set.delete(l); onChange(model.sortLevels([...set])); } }), l)));
}
