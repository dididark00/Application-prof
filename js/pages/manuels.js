// Manuels : références configurables (Picot, Accès, Retz…) sans contenu prérempli,
// pages repérées et pièces jointes (scans, PDF), privées par défaut.
import * as store from '../store.js';
import * as model from '../model.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { bound, iconBtn } from '../forms.js';
import { filesBlock } from '../pedago-ui.js';

const KINDS = ['manuel', 'guide du maître', 'cahier / fichier élève', 'autre'];
// Suggestions : seuls l'éditeur ou la collection sont proposés ; tout le reste est à compléter.
const SUGGEST = [{ title: 'Méthode Picot', publisher: '' }, { title: 'Accès', publisher: 'Accès Éditions' }, { title: '', publisher: 'Retz' }];

let openId = null;

export function render({ query, rerender }) {
  if (query.open) openId = query.open;
  const list = store.all('manual').sort((a, b) => (a.subject || '').localeCompare(b.subject || '') || a.title.localeCompare(b.title, 'fr'));
  return h('div', { class: 'page' },
    pageHeader('Manuels', { favKey: 'preparer/manuels', subtitle: 'Références communes à toutes vos classes et années.',
      actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-manual', onclick: () => manualDialog() }, icon('plus', 16), 'Ajouter un manuel')] }),
    subTabs(),
    h('div', { class: 'card notice' }, h('p', {}, 'Les fiches de séance et de séquence citent un manuel avec des pages et exercices vérifiés. Les scans restent privés sur cet appareil. La recherche dans le texte des scans (OCR) est prévue plus tard, en option, avec indication du texte incertain.')),
    list.length ? h('div', { class: 'stack' }, list.map(m => card(m, rerender))) : emptyState('Aucun manuel', 'Ajoutez les manuels et guides que vous utilisez.'));
}

function card(m, rerender) {
  const open = openId === m.id;
  const uses = ['session', 'sequence'].flatMap(t => store.all(t)).filter(x => (x.manualRefs || []).some(r => r.manualId === m.id));
  return h('section', { class: 'card', 'data-testid': 'manual-card' },
    h('div', { class: 'card-head' },
      h('h2', {}, m.title, ' ', m.kind ? badge(m.kind, 'muted') : null, m.level ? badge(m.level) : null),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => { openId = open ? null : m.id; rerender(); } }, open ? 'Replier' : 'Pages et fichiers'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => manualDialog(m) }, 'Modifier'),
        iconBtn('trash', 'Mettre à la corbeille', async () => {
          if (uses.length && !await confirmDialog('Manuel cité', `${uses.length} fiche(s) citent ce manuel. Elles afficheront « manuel supprimé » tant qu’il est à la corbeille.`, { confirmLabel: 'Mettre à la corbeille', danger: true })) return;
          await store.remove(m.id, `Manuel ${m.title} mis à la corbeille`); toast('Manuel mis à la corbeille', { action: 'Annuler', onAction: () => store.undo() });
        }))),
    h('p', { class: 'muted' }, [m.author, m.publisher, m.edition && `édition ${m.edition}`, m.subject].filter(Boolean).join(' · ') || 'Informations à compléter', uses.length ? ` · cité dans ${uses.length} fiche(s)` : ''),
    open ? h('div', {},
      h('h3', {}, 'Pages repérées'),
      h('div', { class: 'stack-sm' }, (m.pages || []).map(p => h('div', { class: 'copy-row' },
        bound({ type: 'text', value: p.page, placeholder: 'page(s)', compact: true, onSave: (v) => store.update(m.id, { pages: store.get(m.id).pages.map(x => x.id === p.id ? { ...x, page: v } : x) }, 'Page', { quiet: true }) }),
        bound({ type: 'text', value: p.note, placeholder: 'contenu (notion, exercices…)', compact: true, onSave: (v) => store.update(m.id, { pages: store.get(m.id).pages.map(x => x.id === p.id ? { ...x, note: v } : x) }, 'Page', { quiet: true }) }),
        iconBtn('x', 'Retirer', () => store.update(m.id, { pages: store.get(m.id).pages.filter(x => x.id !== p.id) }, 'Page retirée'))))),
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => store.update(m.id, { pages: [...(m.pages || []), { id: store.uid(), page: '', note: '' }] }, 'Page ajoutée') }, '+ page'),
      filesBlock(m.id, { title: 'Pièces jointes (scans, PDF, images)' })) : null);
}

function manualDialog(m = null) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    m ? null : h('div', { class: 'row' }, h('span', { class: 'muted small' }, 'Raccourcis :'), SUGGEST.map(sg => h('button', { class: 'btn btn-small', type: 'button', onclick: () => {
      if (sg.title) form.querySelector('[name=title]').value = sg.title; if (sg.publisher) form.querySelector('[name=publisher]').value = sg.publisher;
    } }, sg.title || sg.publisher))),
    field('Titre', h('input', { name: 'title', required: true, value: m?.title || '' })),
    h('div', { class: 'grid-3' }, field('Auteur', h('input', { name: 'author', value: m?.author || '' })), field('Éditeur', h('input', { name: 'publisher', value: m?.publisher || '' })), field('Édition / année', h('input', { name: 'edition', value: m?.edition || '' }))),
    h('div', { class: 'grid-3' },
      field('Type', h('select', { name: 'kind' }, KINDS.map(k => h('option', { value: k, selected: m?.kind === k }, k)))),
      field('Discipline', h('select', { name: 'subject' }, h('option', { value: '' }, '—'), model.subjects().map(s => h('option', { value: s, selected: m?.subject === s }, s)))),
      field('Niveau', h('select', { name: 'level' }, h('option', { value: '' }, '—'), model.NIVEAUX.map(l => h('option', { value: l, selected: m?.level === l }, l))))),
    field('Notes', h('textarea', { name: 'notes', rows: 2 }, m?.notes || '')));
  modal({ title: m ? 'Modifier le manuel' : 'Ajouter un manuel', wide: true, body: form, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form);
    if (!d.title) return false;
    if (m) await store.update(m.id, d, `Manuel ${d.title}`);
    else await store.create('manual', { ...d, pages: [], fileIds: [] }, `Manuel ${d.title} ajouté`);
  } }] });
}
