import { h, emptyState } from '../ui.js';
import { pageHeader } from '../components.js';
import { search } from '../search.js';
import { navigate } from '../router.js';

export function render({ query }) {
  const q = query.q || '';
  const input = h('input', { type: 'search', value: q, placeholder: 'Élève, fichier, tag, page…', 'aria-label': 'Rechercher', 'data-testid': 'search-page-input' });
  const form = h('form', { class: 'search-big', role: 'search', onsubmit: (e) => { e.preventDefault(); navigate(`#/recherche?q=${encodeURIComponent(input.value.trim())}`); } },
    input, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Rechercher'));
  const results = q ? search(q) : [];
  const groups = {};
  for (const r of results) (groups[r.group] ||= []).push(r);
  setTimeout(() => { if (!q) input.focus(); }, 0);
  return h('div', { class: 'page' },
    pageHeader('Recherche'),
    form,
    q ? (results.length ? h('div', { class: 'stack', 'data-testid': 'search-results' }, Object.entries(groups).map(([g, list]) =>
      h('section', { class: 'card' }, h('h2', {}, `${g} (${list.length})`),
        h('ul', { class: 'result-list' }, list.map(r => h('li', {}, h('a', { href: r.href }, r.title), r.detail ? h('span', { class: 'muted' }, ` — ${r.detail}`) : null))))))
      : emptyState(`Aucun résultat pour « ${q} »`, 'Les modules masqués et les coordonnées des familles ne sont pas inclus dans la recherche.'))
      : h('p', { class: 'muted' }, 'Recherche dans les élèves, classes, années, fichiers, liens, tags et notes. Les modules masqués et les coordonnées des familles en sont exclus.'));
}
