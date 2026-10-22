import * as store from '../store.js';
import * as model from '../model.js';
import { h, icon, toast, modal, field, formData, confirmDialog, pickFiles, badge, emptyState, safeUrl } from '../ui.js';
import { pageHeader, demoBadge, avatar } from '../components.js';
import { studentDialog } from './students.js';
import * as ST from './student-tabs.js';
import * as E from '../eleve.js';
import { openLoansOfStudent } from './bibliotheque.js';

const TABS = [['identite', 'Identité et contacts'], ['documents', 'Documents et autorisations'], ['suivi', 'Suivi pédagogique'], ['besoins', 'Besoins particuliers'], ['vie', 'Vie scolaire'], ['echanges', 'Échanges']];

export function render({ params, query, rerender }) {
  const tab = TABS.some(t => t[0] === query.t) ? query.t : 'identite';
  const s = store.get(params[0]);
  if (!s || s.deletedAt) return h('div', { class: 'page' }, pageHeader('Élève introuvable'), emptyState('Cette fiche n’existe pas ou a été mise à la corbeille.', '', h('a', { class: 'btn', href: '#/eleves' }, 'Retour à la liste')));
  const enrs = model.enrollmentsOfStudent(s.id);
  const today = model.todayIso();
  const current = enrs.find(e => model.isActiveOn(e, today)) || enrs[enrs.length - 1];
  const cls = current ? store.get(current.classId) : null;
  const files = store.all('file').filter(f => (f.studentIds || []).includes(s.id));

  return h('div', { class: 'page' },
    h('p', {}, h('a', { href: '#/eleves', class: 'back' }, '← Élèves')),
    h('header', { class: 'student-head' }, avatar(s, 72),
      h('div', {}, h('h1', {}, `${s.firstName} ${(s.lastName || '').toUpperCase()}`, ' ', demoBadge(s), s.archived ? badge('archivé', 'muted') : null),
        h('p', { class: 'muted' }, [cls ? `${cls.name} · ${current.level}` : 'Sans classe', s.birthDate ? `né(e) le ${model.frDate(s.birthDate)} (${model.age(s.birthDate)} ans)` : null].filter(Boolean).join(' · '))),
      h('div', { class: 'page-actions' },
        cls ? h('button', { class: 'btn', type: 'button', onclick: () => studentDialog(cls, s) }, icon('edit', 16), 'Identité') : null,
        h('button', { class: 'btn', type: 'button', onclick: () => photoAction(s) }, icon('user', 16), s.photoBlobId ? 'Changer la photo' : 'Photo'),
        s.photoBlobId ? h('button', { class: 'btn', type: 'button', onclick: async () => { await store.update(s.id, { photoBlobId: null }, `Retrait de la photo de ${s.firstName}`); toast('Photo retirée', { action: 'Annuler', onAction: () => store.undo() }); } }, 'Retirer la photo') : null,
        h('button', { class: 'btn', type: 'button', onclick: async () => { await store.update(s.id, { archived: !s.archived }, `${s.archived ? 'Désarchivage' : 'Archivage'} de ${s.firstName} ${s.lastName}`); toast(s.archived ? 'Élève désarchivé' : 'Élève archivé'); } }, s.archived ? 'Désarchiver' : 'Archiver'),
        h('button', { class: 'btn btn-ghost-danger', type: 'button', 'aria-label': 'Mettre à la corbeille', onclick: async () => {
          if (!await confirmDialog('Mettre la fiche à la corbeille ?', 'Pour un élève qui quitte la classe, préférez « Enregistrer un départ » : l’historique reste juste. La corbeille sert à corriger une erreur de saisie.', { confirmLabel: 'Mettre à la corbeille', danger: true })) return;
          await store.remove(s.id, `Fiche de ${s.firstName} ${s.lastName} mise à la corbeille`);
          location.hash = '#/eleves';
          toast('Fiche mise à la corbeille', { action: 'Annuler', onAction: () => store.undo() });
        } }, icon('trash', 16)))),

    h('nav', { class: 'subtabs', 'aria-label': 'Fiche élève' }, TABS.map(([id, label]) => h('a', { href: `#/eleve/${s.id}?t=${id}`, class: tab === id ? 'active' : '', 'aria-current': tab === id ? 'page' : null, 'data-testid': `tab-${id}` }, label))),
    tab === 'documents' ? ST.docsTab(s, E.yearOfStudent(s.id)) :
    tab === 'suivi' ? ST.suiviTab(s, cls, rerender) :
    tab === 'besoins' ? ST.besoinsTab(s, rerender) :
    tab === 'vie' ? ST.vieTab(s, cls) :
    tab === 'echanges' ? ST.echangesTab(s) :
    h('div', { class: 'stack' },
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Scolarité'),
        current && !current.end ? h('button', { class: 'btn', type: 'button', 'data-testid': 'record-departure', onclick: () => departureDialog(s, current) }, 'Enregistrer un départ') : null),
      h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Année'), h('th', {}, 'Classe'), h('th', {}, 'Niveau'), h('th', {}, 'Arrivée'), h('th', {}, 'Départ'), h('th', {}, ''))),
        h('tbody', {}, enrs.map(e => {
          const c = store.get(e.classId); const y = c && store.get(c.yearId);
          return h('tr', {}, h('td', {}, y?.label || '—'), h('td', {}, c?.name || '(classe supprimée)'), h('td', {}, e.level),
            h('td', {}, model.frShort(e.start)), h('td', {}, e.end ? `${model.frShort(e.end)}${e.endReason ? ` — ${e.endReason}` : ''}` : '—'),
            h('td', {}, h('button', { class: 'btn btn-small', type: 'button', onclick: () => enrollmentDialog(s, e, c) }, 'Modifier')));
        }))),
      h('p', { class: 'muted small' }, 'Un départ ou une arrivée est daté : les listes et l’historique des jours précédents restent exacts.')),

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Responsables et contacts'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'add-contact', onclick: () => contactDialog(s) }, icon('plus', 16), 'Ajouter')),
      (s.contacts || []).length ? h('div', { class: 'contacts' }, s.contacts.map(c => h('div', { class: 'contact' },
        h('div', {}, h('strong', {}, c.name), c.relation ? ` · ${c.relation}` : '',
          h('div', { class: 'tags' }, c.legal ? badge('responsable légal') : null, c.priority ? badge('contact prioritaire', 'ok') : null, c.emergency ? badge('urgence', 'warn') : null, c.pickup ? badge('autorisé à venir chercher', 'info') : null)),
        h('div', { class: 'contact-lines' },
          c.phone ? h('a', { href: `tel:${c.phone.replace(/[^\d+]/g, '')}` }, c.phone) : null,
          c.phone2 ? h('a', { href: `tel:${c.phone2.replace(/[^\d+]/g, '')}` }, c.phone2) : null,
          c.email ? h('a', { href: `mailto:${c.email}` }, c.email) : null,
          c.note ? h('span', { class: 'muted' }, c.note) : null),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-small', type: 'button', onclick: () => contactDialog(s, c) }, 'Modifier'),
          h('button', { class: 'btn btn-small btn-ghost-danger', type: 'button', onclick: async () => {
            await store.update(s.id, { contacts: s.contacts.filter(x => x.id !== c.id) }, `Retrait du contact ${c.name}`);
            toast('Contact retiré', { action: 'Annuler', onAction: () => store.undo() });
          } }, 'Retirer'))))) : h('p', { class: 'muted' }, 'Aucun contact renseigné.')),

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Fichiers liés'), h('a', { class: 'btn', href: '#/fichiers' }, 'Ouvrir les fichiers')),
      files.length ? h('ul', { class: 'link-list' }, files.map(f => h('li', {}, icon(f.kind === 'link' ? 'link' : 'file', 16), ' ',
        f.kind === 'link' && safeUrl(f.url) ? h('a', { href: safeUrl(f.url), target: '_blank', rel: 'noopener noreferrer' }, f.name) : h('a', { href: `#/fichiers?open=${f.id}` }, f.name))))
        : h('p', { class: 'muted' }, 'Aucun fichier lié. Dans Fichiers, « Modifier » permet de rattacher un fichier à des élèves.'))));
}

async function photoAction(s) {
  const [f] = await pickFiles({ accept: 'image/*', multiple: false });
  if (!f) return;
  try {
    const small = await resizeImage(f, 480);
    const id = await store.putBlob(small);
    await store.update(s.id, { photoBlobId: id }, `Photo de ${s.firstName}`);
    toast('Photo enregistrée (réduite à 480 px)');
  } catch (e) { toast(`Image illisible : ${e.message}`, { kind: 'error' }); }
}

export async function resizeImage(file, max) {
  const bmp = await createImageBitmap(file);
  const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('conversion impossible')), 'image/jpeg', 0.85));
}

function departureDialog(s, enr) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Dernier jour dans la classe', h('input', { name: 'end', type: 'date', required: true, value: model.todayIso() })),
    field('Motif (facultatif)', h('input', { name: 'endReason', placeholder: 'ex. déménagement, changement d’école' })),
    h('p', { class: 'muted' }, 'L’élève restera visible dans les listes et l’historique jusqu’à cette date, puis apparaîtra comme « parti ». Rien n’est effacé.'),
    openLoansOfStudent(s.id).length ? h('p', { class: 'warn' }, `${openLoansOfStudent(s.id).length} livre(s) de la bibliothèque encore prêté(s) : ils ne sont pas marqués rendus automatiquement.`) : null);
  modal({ title: `Départ de ${s.firstName}`, body: form, actions: [{ label: 'Annuler' }, { label: 'Enregistrer le départ', primary: true, onClick: async () => {
    const d = formData(form);
    if (!d.end) return false;
    if (enr.start && d.end < enr.start) { toast('Le départ ne peut pas précéder l’arrivée.', { kind: 'error' }); return false; }
    await store.update(enr.id, { end: d.end, endReason: d.endReason }, `Départ de ${s.firstName} ${s.lastName}`);
    toast('Départ enregistré', { action: 'Annuler', onAction: () => store.undo() });
  } }] });
}

function enrollmentDialog(s, enr, cls) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    cls ? field('Niveau', h('select', { name: 'level' }, (cls.levels || [enr.level]).map(l => h('option', { value: l, selected: l === enr.level }, l)))) : null,
    h('div', { class: 'grid-2' },
      field('Arrivée', h('input', { name: 'start', type: 'date', value: enr.start || '' })),
      field('Départ (vide si toujours présent)', h('input', { name: 'end', type: 'date', value: enr.end || '' }))),
    field('Motif du départ', h('input', { name: 'endReason', value: enr.endReason || '' })));
  modal({ title: 'Modifier l’inscription', body: form, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form);
    if (d.start && d.end && d.end < d.start) { toast('Le départ ne peut pas précéder l’arrivée.', { kind: 'error' }); return false; }
    await store.update(enr.id, { level: d.level || enr.level, start: d.start, end: d.end || null, endReason: d.end ? d.endReason : '' }, `Inscription de ${s.firstName} modifiée`);
    toast('Inscription mise à jour', { action: 'Annuler', onAction: () => store.undo() });
  } }] });
}

function contactDialog(s, c = null) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' },
      field('Nom et prénom', h('input', { name: 'name', required: true, value: c?.name || '' })),
      field('Lien avec l’élève', h('input', { name: 'relation', value: c?.relation || '', placeholder: 'mère, père, grand-parent, voisin…', list: 'relations' }))),
    h('datalist', { id: 'relations' }, ['Mère', 'Père', 'Responsable légal', 'Grand-mère', 'Grand-père', 'Tante', 'Oncle', 'Assistant(e) maternel(le)', 'Voisin(e)'].map(v => h('option', { value: v }))),
    h('div', { class: 'grid-2' },
      field('Téléphone', h('input', { name: 'phone', type: 'tel', value: c?.phone || '' })),
      field('Autre téléphone', h('input', { name: 'phone2', type: 'tel', value: c?.phone2 || '' }))),
    field('Email', h('input', { name: 'email', type: 'email', value: c?.email || '' })),
    h('div', { class: 'chips' },
      h('label', { class: 'chip' }, h('input', { type: 'checkbox', name: 'legal', checked: c ? c.legal : true }), 'Responsable légal'),
      h('label', { class: 'chip' }, h('input', { type: 'checkbox', name: 'priority', checked: c ? c.priority : !(s.contacts || []).some(x => x.priority) }), 'Contact prioritaire'),
      h('label', { class: 'chip' }, h('input', { type: 'checkbox', name: 'emergency', checked: c?.emergency }), 'À appeler en urgence'),
      h('label', { class: 'chip' }, h('input', { type: 'checkbox', name: 'pickup', checked: c?.pickup }), 'Autorisé à venir chercher')),
    field('Remarque', h('input', { name: 'note', value: c?.note || '' })));
  const errors = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: c ? 'Modifier le contact' : 'Nouveau contact', wide: true, body: h('div', {}, form, errors), actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form);
    if (!d.name) { errors.textContent = 'Le nom est obligatoire.'; return false; }
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) { errors.textContent = 'Adresse email invalide.'; return false; }
    let contacts = (s.contacts || []).slice();
    const rec = { ...(c || { id: store.uid() }), ...d };
    contacts = c ? contacts.map(x => x.id === c.id ? rec : x) : [...contacts, rec];
    // Un seul contact prioritaire.
    if (rec.priority) contacts = contacts.map(x => x.id === rec.id ? x : { ...x, priority: false });
    await store.update(s.id, { contacts }, `${c ? 'Modification' : 'Ajout'} du contact ${d.name}`);
    toast('Contact enregistré', { action: 'Annuler', onAction: () => store.undo() });
  } }] });
}
