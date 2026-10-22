// Impression : le document est placé dans #print-root, seul élément imprimé.
import { h } from './ui.js';

export function printDocument(node, { orientation = 'portrait', color = true } = {}) {
  const root = document.getElementById('print-root');
  const style = h('style', { id: 'page-style' }, `@page { size: A4 ${orientation}; margin: 12mm; }`);
  document.getElementById('page-style')?.remove();
  document.head.append(style);
  root.replaceChildren(node.cloneNode(true));
  root.classList.toggle('bw', !color);
  document.body.classList.add('printing');
  const cleanup = () => { document.body.classList.remove('printing'); root.replaceChildren(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

/** Tableau imprimable : en-têtes répétés sur chaque page, lignes jamais coupées. */
export function printTable({ title, subtitle, columns, rows, footer }) {
  return h('div', { class: 'print-doc' },
    h('header', { class: 'print-head' }, h('h1', {}, title), subtitle ? h('p', {}, subtitle) : null),
    h('table', { class: 'print-table' },
      h('thead', {}, h('tr', {}, columns.map(c => h('th', { style: c.width ? { width: c.width } : null }, c.label)))),
      h('tbody', {}, rows.map(r => h('tr', {}, r.map(v => h('td', {}, v ?? '')))))),
    footer ? h('p', { class: 'print-foot' }, footer) : null);
}
