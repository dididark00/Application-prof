// Menu « Plus » du téléphone : toutes les rubriques et réglages, avec filtre et raccourcis.
import { h, icon } from '../ui.js';
import { pageHeader } from '../components.js';
import { visibleRubriques, subHref } from '../router.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
let filterText = '';

function visits() { try { return JSON.parse(localStorage.getItem('classeur.visits') || '{}'); } catch { return {}; } }
function openState() { try { return JSON.parse(localStorage.getItem('classeur.moreOpen') || '{}'); } catch { return {}; } }
function saveOpen(id, open) { try { const o = openState(); o[id] = open; localStorage.setItem('classeur.moreOpen', JSON.stringify(o)); } catch { /* */ } }

export function render() {
  const rubs = visibleRubriques();
  const v = visits();
  const top = rubs.flatMap(r => r.sous.filter(s => s.route && v[s.route]).map(s => ({ r, s, n: v[s.route] }))).sort((a, b) => b.n - a.n).slice(0, 6);
  const opened = openState();
  const list = h('div', { class: 'stack', 'data-testid': 'more-sections' });
  const draw = () => {
    const q = norm(filterText.trim());
    const sections = rubs.map(r => ({ r, sous: q ? r.sous.filter(s => norm(s.titre).includes(q) || norm(r.titre).includes(q)) : r.sous })).filter(x => x.sous.length);
    list.replaceChildren(...sections.map(({ r, sous }) => {
      const d = h('details', { class: 'card more-group', open: q ? true : opened[r.id] !== false, 'data-testid': 'more-group', ontoggle: (e) => { if (!q) saveOpen(r.id, e.target.open); } },
        h('summary', {}, h('h2', {}, icon(r.icone, 18), ' ', r.titre, h('span', { class: 'muted small' }, ` (${sous.length})`))),
        h('ul', { class: 'more-list' }, sous.map(s => h('li', {}, h('a', { href: subHref(r, s) }, s.titre, s.route ? null : h('span', { class: 'later-tag' }, `ét. ${s.etape}`))))));
      return d;
    }), sections.length ? '' : h('p', { class: 'muted' }, 'Aucune page ne correspond. Essayez la recherche dans vos données : ', h('a', { href: `#/recherche?q=${encodeURIComponent(filterText)}` }, 'Rechercher')));
  };
  draw();
  return h('div', { class: 'page' },
    pageHeader('Plus'),
    h('input', { type: 'search', class: 'more-filter', placeholder: 'Trouver une page (ex. registre, cantine, import…)', 'aria-label': 'Trouver une page', 'data-testid': 'more-filter', value: filterText, oninput: (e) => { filterText = e.target.value; draw(); } }),
    top.length ? h('section', { class: 'card', 'data-testid': 'more-top' }, h('h2', {}, 'Les plus utilisées'),
      h('div', { class: 'fav-grid' }, top.map(({ r, s }) => h('a', { class: 'fav-tile', href: subHref(r, s) }, s.titre)))) : null,
    list,
    h('section', { class: 'card' }, h('ul', { class: 'more-list' },
      h('li', {}, h('a', { href: '#/recherche' }, icon('search', 16), ' Recherche')),
      h('li', {}, h('a', { href: '#/reglages' }, icon('settings', 16), ' Réglages')),
      h('li', {}, h('a', { href: '#/reglages/sauvegarde' }, icon('download', 16), ' Sauvegarde')))));
}
