import * as store from './store.js';
import * as model from './model.js';
import { h, icon, toast } from './ui.js';
import { visibleRubriques, subHref, currentLocation } from './router.js';

/** En-tête de page avec étoile de favori et actions. */
export function pageHeader(title, { subtitle, favKey, actions = [] } = {}) {
  let star = null;
  if (favKey) {
    const favs = store.getSettings().favorites || [];
    const on = favs.includes(favKey);
    star = h('button', { class: `icon-btn fav ${on ? 'on' : ''}`, type: 'button', 'aria-pressed': on ? 'true' : 'false',
      'aria-label': on ? 'Retirer des favoris' : 'Ajouter aux favoris', title: on ? 'Retirer des favoris' : 'Ajouter aux favoris',
      onclick: async () => {
        const cur = store.getSettings().favorites || [];
        await store.setSettings({ favorites: on ? cur.filter(k => k !== favKey) : [...cur, favKey] });
        toast(on ? 'Retiré des favoris' : 'Ajouté aux favoris');
      } }, icon('star', 18));
  }
  return h('header', { class: 'page-head' },
    h('div', { class: 'page-title' }, h('h1', {}, title, star), subtitle ? h('p', { class: 'muted' }, subtitle) : null),
    actions.length ? h('div', { class: 'page-actions' }, actions) : null);
}

/** Onglets des sous-pages de la rubrique courante (utile sur tablette/téléphone). */
export function subTabs() {
  const loc = currentLocation();
  const rub = visibleRubriques().find(r => r.id === loc.rub);
  if (!rub || rub.sous.length < 2) return null;
  return h('nav', { class: 'subtabs', 'aria-label': rub.titre },
    rub.sous.map(s => h('a', { href: subHref(rub, s), class: `${loc.sub === s.id ? 'active' : ''} ${s.route ? '' : 'later'}`, 'aria-current': loc.sub === s.id ? 'page' : null }, s.titre)));
}

/** Rappel quand aucune classe n'est configurée. */
export function needClass() {
  const y = model.currentYear();
  const c = model.currentClass();
  if (c) return null;
  return h('div', { class: 'card notice' },
    h('h2', {}, y ? 'Aucune classe dans cette année' : 'Commencez par créer une année scolaire'),
    h('p', {}, y ? 'Créez votre classe (niveaux, binôme, service) pour pouvoir y inscrire des élèves.'
      : 'L’année contient les périodes ; la classe contient les niveaux et les élèves. Un préréglage zone C 2026-2027 est proposé.'),
    h('div', { class: 'row' },
      h('a', { class: 'btn btn-primary', href: y ? '#/reglages/classes' : '#/reglages/annees' }, y ? 'Créer une classe' : 'Créer une année'),
      h('a', { class: 'btn', href: '#/reglages/demo' }, 'Ou essayer avec des données fictives')));
}

export function demoBadge(rec) {
  return rec && rec.demo ? h('span', { class: 'badge badge-demo', title: 'Donnée fictive de démonstration' }, 'Démo') : null;
}

export function avatar(student, size = 40) {
  const el = h('span', { class: 'avatar', style: { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size / 2.6)}px` } },
    ((student.firstName || '?')[0] + ((student.lastName || '')[0] || '')).toUpperCase());
  if (student.photoBlobId) {
    store.getBlob(student.photoBlobId).then(b => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      el.replaceChildren(h('img', { src: url, alt: '', onload: () => URL.revokeObjectURL(url) }));
    });
  }
  return el;
}
