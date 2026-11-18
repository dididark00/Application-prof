// Tableaux lisibles sur téléphone : chaque ligne devient une carte, chaque cellule reçoit le nom de sa colonne.
// Aucun changement de données : on ajoute seulement des étiquettes (data-label) lues dans l'en-tête.
// Exclus : tableaux-grilles (programmations, emploi du temps, registre…) qui gardent le défilement horizontal.

const SKIP = ['grid-table', 'roadmap', 'no-cards'];

export function labelTable(t) {
  if (!t.classList.contains('table') || SKIP.some(c => t.classList.contains(c))) return;
  const rows = t.tHead ? [...t.tHead.rows] : [];
  if (!rows.length) return;
  const headRow = rows[0];
  const labels = [];
  // Intitulé seul : on ignore les boutons et menus de l'en-tête (ex. « Vides → A »).
  const headText = (th) => { const c = th.cloneNode(true); c.querySelectorAll('.btn, select, input, .no-label').forEach(x => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); };
  for (const th of headRow.cells) for (let i = 0; i < (th.colSpan || 1); i++) labels.push(headText(th));
  if (labels.length < 2) return;
  const apply = (tr) => { let i = 0; for (const td of tr.cells) { const l = labels[i] || ''; if (l && !td.dataset.label) td.dataset.label = l; i += td.colSpan || 1; } };
  for (const tb of t.tBodies) for (const tr of tb.rows) apply(tr);
  for (const tr of rows.slice(1)) apply(tr); // ex. ligne « Toute la classe » de la cantine
  t.dataset.cards = rows.length > 1 ? 'extra-head' : '1';
}

let queued = false;
export function watchTables(root) {
  const run = () => { queued = false; root.querySelectorAll('table.table').forEach(labelTable); };
  run();
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } }).observe(root, { childList: true, subtree: true });
}
