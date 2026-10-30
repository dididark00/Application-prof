// Suppression groupée : choisir des éléments (ou tous) et les mettre à la corbeille en une fois.
// Tout reste récupérable dans Réglages › Corbeille (vidée automatiquement après le délai choisi).
import * as store from './store.js';
import { h, toast, modal, badge } from './ui.js';

/**
 * items : [{ id, label, detail, children: [ids liés supprimés avec lui] }]
 * childOption : libellé d'une case « avec … » (ex. « avec leurs fiches de séance ») ; sinon les enfants partent toujours.
 */
export function bulkDelete({ title, items, childOption = null, childAlways = false, testid = 'bulk' }) {
  if (!items.length) { toast('Rien à supprimer.'); return; }
  const chosen = new Set();
  const boxes = items.map(it => h('label', { class: 'bulk-item' }, h('input', { type: 'checkbox', 'data-testid': `${testid}-item`, onchange: (e) => { e.target.checked ? chosen.add(it.id) : chosen.delete(it.id); upd(); } }),
    h('span', {}, h('strong', {}, it.label), it.detail ? h('span', { class: 'muted small' }, ` — ${it.detail}`) : null, it.children?.length ? [' ', badge(`+ ${it.children.length}`, 'muted')] : null)));
  const all = h('input', { type: 'checkbox', 'data-testid': `${testid}-all`, onchange: (e) => { boxes.forEach((b, i) => { b.querySelector('input').checked = e.target.checked; e.target.checked ? chosen.add(items[i].id) : chosen.delete(items[i].id); }); upd(); } });
  const withChildren = childOption ? h('input', { type: 'checkbox', checked: true, 'data-testid': `${testid}-children` }) : null;
  const info = h('p', { class: 'small', 'data-testid': `${testid}-info` });
  const upd = () => { info.textContent = chosen.size ? `${chosen.size} élément(s) sélectionné(s) : ils iront à la corbeille (récupérables).` : 'Cochez ce que vous voulez supprimer.'; };
  upd();
  modal({ title, wide: true, body: h('div', { class: 'stack' },
    h('label', { class: 'inline' }, all, h('strong', {}, `Tout sélectionner (${items.length})`)),
    h('div', { class: 'bulk-list' }, boxes),
    withChildren ? h('label', { class: 'inline' }, withChildren, childOption) : null, info),
  actions: [{ label: 'Annuler' }, { label: 'Mettre à la corbeille', danger: true, testid: `${testid}-go`, onClick: async () => {
    if (!chosen.size) { toast('Rien de sélectionné.'); return false; }
    const at = new Date().toISOString(); const ids = new Set();
    for (const it of items.filter(x => chosen.has(x.id))) { ids.add(it.id); if (childAlways || withChildren?.checked) (it.children || []).forEach(c => ids.add(c)); }
    await store.batch([...ids].filter(id => store.get(id)).map(id => ({ id, patch: { deletedAt: at, deletedBy: store.getSettings().userName || '' } })), `${chosen.size} élément(s) mis à la corbeille`);
    toast(`${ids.size} élément(s) mis à la corbeille.`, { action: 'Annuler', onAction: () => store.undo(), timeout: 12000 });
  } }] });
}
