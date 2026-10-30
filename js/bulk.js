// Suppression groupée : choisir des éléments (ou tous) et les mettre à la corbeille en une fois.
// Liste rangée par groupe (discipline, séquence, période), filtrable, avec « tout le groupe ».
// Tout reste récupérable dans Réglages › Corbeille (vidée automatiquement après le délai choisi).
import * as store from './store.js';
import { h, toast, modal } from './ui.js';

const coll = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

/**
 * items : [{ id, label, detail, group, children: [ids liés supprimés avec lui] }]
 * childOption : libellé d'une case « avec … » (ex. « avec leurs fiches de séance ») ; sinon les enfants partent avec si childAlways.
 */
export function bulkDelete({ title, items, childOption = null, childAlways = false, testid = 'bulk' }) {
  if (!items.length) { toast('Rien à supprimer.'); return; }
  items = [...items].sort((a, b) => coll.compare(a.group || '', b.group || '') || coll.compare(a.label || '', b.label || ''));
  const chosen = new Set();
  const open = new Set(); const folded = items.length > 30; // longues listes : groupes repliés, dépliés par la recherche
  const groups = []; const byGroup = new Map();
  for (const it of items) { const g = it.group || ''; if (!byGroup.has(g)) { byGroup.set(g, []); groups.push(g); } byGroup.get(g).push(it); }
  const q = h('input', { type: 'search', placeholder: 'Filtrer (titre, discipline, séquence…)', 'aria-label': 'Filtrer', 'data-testid': `${testid}-filter` });
  const list = h('div', { class: 'bulk-list' });
  const all = h('input', { type: 'checkbox', 'data-testid': `${testid}-all` });
  const info = h('p', { class: 'small bulk-info', 'data-testid': `${testid}-info` });
  const match = (it) => { const t = q.value.trim().toLowerCase(); return !t || `${it.label} ${it.detail || ''} ${it.group || ''}`.toLowerCase().includes(t); };
  const shown = () => items.filter(match);
  const upd = () => {
    info.textContent = chosen.size ? `${chosen.size} élément(s) sélectionné(s) — ils iront à la corbeille (récupérables).` : 'Cochez ce que vous voulez supprimer.';
    const s = shown(); all.checked = s.length > 0 && s.every(it => chosen.has(it.id)); all.indeterminate = !all.checked && s.some(it => chosen.has(it.id));
  };
  const draw = () => {
    list.replaceChildren(...groups.flatMap(g => {
      const its = byGroup.get(g).filter(match); if (!its.length) return [];
      const gAll = h('input', { type: 'checkbox', 'aria-label': `Tout le groupe ${g}`, 'data-testid': `${testid}-group`, checked: its.every(it => chosen.has(it.id)),
        onchange: (e) => { for (const it of its) e.target.checked ? chosen.add(it.id) : chosen.delete(it.id); draw(); } });
      gAll.indeterminate = !gAll.checked && its.some(it => chosen.has(it.id));
      const isOpen = !g || !folded || open.has(g) || q.value.trim();
      const head = g ? h('div', { class: 'bulk-group' }, gAll,
        h('button', { type: 'button', class: 'bulk-toggle', 'aria-expanded': String(!!isOpen), 'data-testid': `${testid}-toggle`, onclick: () => { open.has(g) ? open.delete(g) : open.add(g); draw(); } },
          folded ? h('span', { 'aria-hidden': 'true' }, isOpen ? '▾ ' : '▸ ') : null, g, h('span', { class: 'muted small' }, ` ${its.filter(it => chosen.has(it.id)).length}/${its.length}`))) : null;
      return [head, ...(isOpen ? its : []).map(it => h('label', { class: `bulk-item${chosen.has(it.id) ? ' on' : ''}` },
        h('input', { type: 'checkbox', checked: chosen.has(it.id), 'data-testid': `${testid}-item`, onchange: (e) => { e.target.checked ? chosen.add(it.id) : chosen.delete(it.id); draw(); } }),
        h('span', { class: 'bulk-text' }, h('span', { class: 'bulk-label' }, it.label),
          it.detail || it.children?.length ? h('span', { class: 'muted small' }, [it.detail, it.children?.length && !it.detail ? `${it.children.length} élément(s) lié(s)` : ''].filter(Boolean).join(' · ')) : null)))].filter(Boolean);
    }));
    if (!list.children.length) list.append(h('p', { class: 'muted small' }, 'Aucun résultat.'));
    upd();
  };
  q.addEventListener('input', draw);
  all.addEventListener('change', () => { for (const it of shown()) all.checked ? chosen.add(it.id) : chosen.delete(it.id); draw(); });
  const withChildren = childOption ? h('input', { type: 'checkbox', checked: true, 'data-testid': `${testid}-children` }) : null;
  draw();
  modal({ title, wide: true, body: h('div', { class: 'stack-sm' },
    q,
    h('div', { class: 'row wrap bulk-bar' }, h('label', { class: 'inline' }, all, h('strong', {}, `Tout sélectionner (${items.length})`)),
      h('button', { class: 'btn btn-small btn-link', type: 'button', onclick: () => { chosen.clear(); draw(); } }, 'Tout décocher')),
    list,
    withChildren ? h('label', { class: 'inline' }, withChildren, childOption) : null, info),
  actions: [{ label: 'Annuler' }, { label: 'Mettre à la corbeille', danger: true, testid: `${testid}-go`, onClick: async () => {
    if (!chosen.size) { toast('Rien de sélectionné.'); return false; }
    const at = new Date().toISOString(); const ids = new Set();
    for (const it of items.filter(x => chosen.has(x.id))) { ids.add(it.id); if (childAlways || withChildren?.checked) (it.children || []).forEach(c => ids.add(c)); }
    await store.batch([...ids].filter(id => store.get(id)).map(id => ({ id, patch: { deletedAt: at, deletedBy: store.getSettings().userName || '' } })), `${chosen.size} élément(s) mis à la corbeille`);
    toast(`${ids.size} élément(s) mis à la corbeille.`, { action: 'Annuler', onAction: () => store.undo(), timeout: 12000 });
  } }] });
}
