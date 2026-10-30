// Répertoire de l'école et des intervenants (adultes uniquement : les contacts des familles
// restent sur les fiches élèves). Exclu de la recherche globale et de toute projection.
import * as store from '../store.js';
import * as O from '../orga.js';
import { h, icon, toast, modal, field, formData, badge, emptyState, safeUrl } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { printDocument, printTable } from '../print.js';

const filt = { q: '', role: '' };

export function render({ rerender }) {
  const list = O.contacts().filter(c => (!filt.role || c.role === filt.role) && (!filt.q || `${c.name} ${c.role} ${c.classe || ''} ${c.org || ''} ${c.notes || ''}`.toLowerCase().includes(filt.q.toLowerCase())));
  return h('div', { class: 'page' },
    pageHeader('Contacts de l’école', { favKey: 'organisation/contacts', subtitle: 'Équipe, partenaires et intervenants. Les responsables des élèves sont sur les fiches élèves.',
      actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-contact', onclick: () => contactDialog() }, icon('plus', 16), 'Nouveau contact'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'new-colleague', onclick: () => contactDialog(null, { role: 'collègue' }) }, icon('plus', 16), 'Collègue'),
        h('button', { class: 'btn', type: 'button', onclick: () => printDocument(printTable({ title: 'Contacts de l’école', columns: ['Nom', 'Rôle', 'Structure', 'Téléphone', 'Email', 'Disponibilités'].map(label => ({ label })), rows: O.contacts().map(c => [c.name, c.role, c.org || '', c.phone || '', c.email || '', c.availability || '']) })) }, icon('print', 16), 'Imprimer')] }),
    subTabs(),
    h('div', { class: 'filters' },
      h('input', { type: 'search', placeholder: 'Nom, rôle, structure…', value: filt.q, 'aria-label': 'Rechercher', onchange: (e) => { filt.q = e.target.value; rerender(); } }),
      h('select', { 'aria-label': 'Rôle', onchange: (e) => { filt.role = e.target.value; rerender(); } }, h('option', { value: '' }, 'Tous les rôles'), O.CONTACT_ROLES.map(r => h('option', { value: r, selected: filt.role === r }, r)))),
    list.length ? h('div', { class: 'grid-2' }, list.map(c => h('section', { class: 'card', 'data-testid': 'contact-card' },
      h('div', { class: 'card-head' }, h('h2', {}, c.name, ' ', badge(c.role || 'autre'), c.classe ? [' ', badge(c.classe, 'info')] : null), h('button', { class: 'btn btn-small', type: 'button', onclick: () => contactDialog(c) }, 'Modifier')),
      c.org ? h('p', { class: 'muted' }, c.org) : null,
      h('p', {}, c.phone ? h('a', { href: `tel:${c.phone.replace(/\s/g, '')}` }, c.phone) : null, c.phone && c.email ? ' · ' : null, c.email ? h('a', { href: `mailto:${c.email}` }, c.email) : null),
      c.availability ? h('p', { class: 'small' }, h('strong', {}, 'Disponibilités : '), c.availability) : null,
      c.url && safeUrl(c.url) ? h('p', { class: 'small' }, h('a', { href: safeUrl(c.url), target: '_blank', rel: 'noopener' }, 'Lien')) : null,
      c.notes ? h('p', { class: 'small muted' }, c.notes) : null)))
      : emptyState('Aucun contact', 'Ajoutez la direction, l’ATSEM, l’AESH, le RASED, les intervenants… Ils pourront être invités aux réunions et reliés aux projets.'));
}

export function contactDialog(c = null, { onSaved, role = null } = {}) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' }, field('Nom', h('input', { name: 'name', required: true, value: c?.name || '' })),
      field('Rôle', h('select', { name: 'role' }, O.CONTACT_ROLES.map(r => h('option', { value: r, selected: (c?.role || role) === r }, r))))),
    field('Classe dont il ou elle s’occupe (collègues)', h('input', { name: 'classe', value: c?.classe || '', placeholder: 'ex. CM1, CE2 A, décharge de direction', 'data-testid': 'contact-classe' })),
    h('div', { class: 'grid-3' }, field('Structure', h('input', { name: 'org', value: c?.org || '', placeholder: 'école, mairie, association…' })),
      field('Téléphone', h('input', { name: 'phone', type: 'tel', value: c?.phone || '' })), field('Email', h('input', { name: 'email', type: 'email', value: c?.email || '' }))),
    h('div', { class: 'grid-2' }, field('Disponibilités', h('input', { name: 'availability', value: c?.availability || '', placeholder: 'ex. lundi et jeudi matin' })), field('Lien (site, agenda…)', h('input', { name: 'url', value: c?.url || '' }))),
    field('Notes', h('textarea', { name: 'notes', rows: 2 }, c?.notes || '')));
  const actions = [{ label: 'Annuler' }];
  if (c) actions.unshift({ label: 'Supprimer', danger: true, onClick: async () => { await store.remove(c.id, `Contact ${c.name} mis à la corbeille`); toast('Contact mis à la corbeille', { action: 'Annuler', onAction: () => store.undo() }); } });
  actions.push({ label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form); if (!d.name.trim()) return false;
    const r = c ? await store.update(c.id, d, `Contact ${d.name}`) : await store.create('contact', d, `Contact ${d.name}`);
    onSaved?.(r || c);
  } });
  modal({ title: c ? 'Contact' : 'Nouveau contact', body: form, actions });
}
