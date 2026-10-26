// Cadre de l'application : barre latérale, barre du haut, barre mobile.
import * as store from './store.js';
import * as model from './model.js';
import { h, icon, toast } from './ui.js';
import * as T from './timer.js';
import { visibleRubriques, subHref, currentLocation, parseHash, allPages, navigate } from './router.js';

let opts = {};

export function renderShell(o) {
  opts = o;
  refreshChrome();
}

export function refreshChrome() {
  renderSidebar();
  renderTopbar();
  renderBottom();
}

function hasDemo() { return store.all('class').some(c => c.demo) || store.all('student').some(s => s.demo); }

function renderSidebar() {
  const s = store.getSettings();
  const loc = currentLocation();
  const route = parseHash();
  const pages = allPages();
  const favs = (s.favorites || []).map(k => pages.find(p => p.key === k)).filter(Boolean);
  const side = document.getElementById('sidebar');
  side.replaceChildren(...[
    h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, (s.appName || 'C').slice(0, 1)), h('span', {}, s.appName || 'Classeur')),
    favs.length ? h('div', { class: 'nav-group' }, h('p', { class: 'nav-label' }, 'Favoris'),
      favs.map(f => h('a', { class: `nav-sub ${location.hash === f.href ? 'active' : ''}`, href: f.href }, icon('star', 14), f.title))) : null,
    h('nav', { class: 'nav-group' }, visibleRubriques().map(r => {
      const open = loc.rub === r.id;
      const first = r.sous[0];
      return h('div', { class: `nav-rub ${open ? 'open' : ''}` },
        h('a', { class: `nav-main ${open ? 'active' : ''}`, href: first ? subHref(r, first) : '#/' , 'aria-current': open ? 'true' : null }, icon(r.icone), r.titre),
        open ? h('div', { class: 'nav-subs' }, r.sous.map(sub =>
          h('a', { class: `nav-sub ${loc.sub === sub.id ? 'active' : ''} ${sub.route ? '' : 'later'}`, href: subHref(r, sub) },
            sub.titre, sub.route ? null : h('span', { class: 'later-tag', title: `Prévu à l’étape ${sub.etape}` }, `ét. ${sub.etape}`)))) : null);
    })),
    h('div', { class: 'nav-bottom' },
      h('a', { class: `nav-main ${route.name === 'reglages' ? 'active' : ''}`, href: '#/reglages' }, icon('settings'), 'Réglages'),
      hasDemo() ? h('p', { class: 'demo-flag' }, 'Données fictives de démonstration présentes') : null),
  ].filter(Boolean));
}

function saveIndicator() {
  const st = store.getSaveState();
  const map = {
    saved: ['ok', 'check', 'Enregistré sur cet appareil'],
    saving: ['pending', 'clock', 'Enregistrement…'],
    error: ['err', 'x', 'Erreur d’enregistrement'],
  };
  const [cls, ic, label] = map[st.status] || map.saved;
  return h('a', { class: `save-state save-${cls}`, href: '#/reglages/sauvegarde', title: st.error ? `${label} : ${st.error}` : `${label}. Ce n’est pas une sauvegarde en ligne : exportez régulièrement une sauvegarde.`, 'data-testid': 'save-state' },
    icon(ic, 14), h('span', { class: 'save-label' }, label));
}

function renderTopbar() {
  const s = store.getSettings();
  const years = model.years();
  const y = model.currentYear();
  // Un remplacement terminé n'encombre plus le choix de classe (Organisation › Remplacements pour le rouvrir).
  const classes = y ? model.classesOfYear(y.id).filter(c => !c.missionEnded || c.id === s.currentClassId) : [];
  const top = document.getElementById('topbar');

  const yearSel = h('select', { class: 'sel', 'aria-label': 'Année scolaire', 'data-testid': 'year-select',
    onchange: (e) => store.setSettings({ currentYearId: e.target.value || null, currentClassId: null }) },
    years.length ? years.map(x => h('option', { value: x.id, selected: y && x.id === y.id }, x.label + (x.archived ? ' (archivée)' : ''))) : h('option', { value: '' }, 'Aucune année'));
  const classSel = h('select', { class: 'sel', 'aria-label': 'Classe', 'data-testid': 'class-select',
    onchange: (e) => store.setSettings({ currentClassId: e.target.value || null }) },
    classes.length ? classes.map(c => h('option', { value: c.id, selected: c.id === s.currentClassId }, c.name + (c.demo ? ' · démo' : ''))) : h('option', { value: '' }, 'Aucune classe'));

  const searchInput = h('input', { type: 'search', name: 'q', placeholder: 'Rechercher…', 'aria-label': 'Recherche globale', value: parseHash().name === 'recherche' ? (parseHash().query.q || '') : '' });
  const searchForm = h('form', { class: 'search-form', role: 'search', onsubmit: (e) => { e.preventDefault(); navigate(`#/recherche?q=${encodeURIComponent(searchInput.value.trim())}`); } },
    icon('search', 16), searchInput);

  const undoBtn = h('button', { class: 'icon-btn', type: 'button', disabled: !store.canUndo(), 'data-testid': 'undo',
    title: store.canUndo() ? `Annuler : ${store.lastUndoLabel()}` : 'Rien à annuler', 'aria-label': 'Annuler la dernière modification',
    onclick: async () => { const l = await store.undo(); if (l) toast(`Annulé : ${l}`); } }, icon('undo'));

  top.replaceChildren(
    h('span', { class: 'mobile-brand' }, s.appName || 'Classeur'),
    h('div', { class: 'top-left' }, h('div', { class: 'selectors' }, yearSel, classSel)),
    searchForm,
    h('div', { class: 'top-right' },
      h('a', { class: 'icon-btn mobile-only', href: '#/recherche', 'aria-label': 'Rechercher' }, icon('search')),
      saveIndicator(),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Timer', title: 'Timer (le compte continue quand on change de page)', 'data-testid': 'timer-toggle', onclick: () => (T.getState().open ? T.recenter() : T.open()) }, icon('clock')),
      undoBtn,
      h('button', { class: 'btn btn-primary btn-add', type: 'button', 'data-testid': 'quick-add', onclick: () => opts.onQuickAdd() }, icon('plus', 18), h('span', { class: 'add-label' }, 'Ajouter'))),
  );
}

function renderBottom() {
  const loc = currentLocation();
  const route = parseHash();
  const items = [
    { href: '#/aujourdhui', label: 'Aujourd’hui', ic: 'sun', active: loc.rub === 'aujourdhui' },
    { href: '#/cahier', label: 'Planifier', ic: 'calendar', active: loc.rub === 'planifier' },
    { href: '#/eleves', label: 'Ma classe', ic: 'users', active: loc.rub === 'classe' },
    { href: '#/plus', label: 'Plus', ic: 'menu', active: !['aujourdhui', 'planifier', 'classe'].includes(loc.rub) || route.name === 'plus' },
  ];
  document.getElementById('bottomnav').replaceChildren(...items.map(i =>
    h('a', { href: i.href, class: i.active ? 'active' : '', 'aria-current': i.active ? 'page' : null }, icon(i.ic), h('span', {}, i.label))));
}
