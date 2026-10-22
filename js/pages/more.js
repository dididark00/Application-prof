// Menu « Plus » du téléphone : toutes les rubriques et réglages.
import { h, icon } from '../ui.js';
import { pageHeader } from '../components.js';
import { visibleRubriques, subHref } from '../router.js';

export function render() {
  return h('div', { class: 'page' },
    pageHeader('Plus'),
    h('div', { class: 'stack' },
      visibleRubriques().map(r => h('section', { class: 'card' },
        h('h2', {}, icon(r.icone, 18), ' ', r.titre),
        h('ul', { class: 'more-list' }, r.sous.map(s => h('li', {}, h('a', { href: subHref(r, s) }, s.titre, s.route ? null : h('span', { class: 'later-tag' }, `ét. ${s.etape}`))))))),
      h('section', { class: 'card' }, h('ul', { class: 'more-list' },
        h('li', {}, h('a', { href: '#/recherche' }, icon('search', 16), ' Recherche')),
        h('li', {}, h('a', { href: '#/reglages' }, icon('settings', 16), ' Réglages')),
        h('li', {}, h('a', { href: '#/reglages/sauvegarde' }, icon('download', 16), ' Sauvegarde'))))));
}
