import * as store from '../store.js';
import * as model from '../model.js';
import { h, icon, toast, modal, field, pickFiles, formatSize, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { MATIERES, guessMime } from './files.js';

let showDone = false;

export function render({ rerender }) {
  const items = store.all('inbox').filter(i => showDone || i.status !== 'classé').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pending = store.all('inbox').filter(i => i.status !== 'classé').length;
  return h('div', { class: 'page' },
    pageHeader('Boîte de réception', { favKey: 'organisation/reception', subtitle: 'Déposez vite une photo, un PDF ou une note ; classez-les plus tard.',
      actions: [
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'inbox-note', onclick: () => noteDialog() }, icon('edit', 16), 'Note'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'inbox-file', onclick: async () => depositFiles(await pickFiles({ accept: 'image/*,application/pdf,*/*' })) }, icon('upload', 16), 'Photo ou fichier'),
      ] }),
    subTabs(),
    h('div', { class: 'card' },
      h('div', { class: 'filters' }, h('span', {}, `${pending} élément(s) à classer`),
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: showDone, onchange: (e) => { showDone = e.target.checked; rerender(); } }), 'Afficher les éléments classés')),
      items.length ? h('ul', { class: 'file-list', 'data-testid': 'inbox-list' }, items.map(itemRow)) : emptyState('Rien à classer', 'Les éléments déposés ici attendent d’être rangés.')),
    h('p', { class: 'muted small' }, 'Aujourd’hui : classement vers Fichiers. Les destinations tâche, événement d’agenda, observation d’élève et document à recevoir arriveront avec leurs modules (étapes 2 et 3).'));
}

function itemRow(it) {
  return h('li', { class: `file-item ${it.status === 'classé' ? 'done' : ''}` },
    icon(it.kind === 'note' ? 'edit' : 'file'),
    h('div', { class: 'file-main' },
      h('strong', {}, it.title || it.name || 'Note'),
      it.kind === 'note' ? h('p', { class: 'note-text' }, it.text) : null,
      h('div', { class: 'file-meta' }, h('span', {}, model.frDateTime(it.createdAt)), it.size ? h('span', {}, formatSize(it.size)) : null,
        it.status === 'classé' ? badge('classé', 'ok') : badge('à classer', 'warn'))),
    h('div', { class: 'file-actions' },
      it.status !== 'classé' ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => classifyDialog(it) }, 'Classer dans Fichiers') : null,
      it.status !== 'classé' ? h('button', { class: 'btn btn-small', type: 'button', onclick: async () => { await store.update(it.id, { status: 'classé', classifiedAs: { type: 'traité' } }, 'Élément marqué comme traité'); toast('Marqué comme traité', { action: 'Annuler', onAction: () => store.undo() }); } }, 'Marquer traité') : null,
      it.classifiedAs?.type === 'file' ? h('a', { class: 'btn btn-small', href: `#/fichiers?open=${it.classifiedAs.id}` }, 'Voir le fichier') : null,
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mettre à la corbeille', onclick: async () => { await store.remove(it.id, 'Élément de réception mis à la corbeille'); toast('Mis à la corbeille', { action: 'Annuler', onAction: () => store.undo() }); } }, icon('trash', 16))));
}

export function noteDialog() {
  const title = h('input', { placeholder: 'Titre (facultatif)' });
  const text = h('textarea', { rows: 5, placeholder: 'Votre note…', 'aria-label': 'Note' });
  modal({ title: 'Nouvelle note à classer', body: h('div', { class: 'form' }, field('Titre', title), field('Note', text)), actions: [{ label: 'Annuler' }, { label: 'Déposer', primary: true, onClick: async () => {
    if (!text.value.trim()) return false;
    await store.create('inbox', { kind: 'note', title: title.value.trim(), text: text.value.trim(), status: 'à classer' }, 'Note déposée dans la boîte de réception');
    toast('Note déposée dans la boîte de réception', { action: 'Annuler', onAction: () => store.undo() });
  } }] });
}

export async function depositFiles(files) {
  if (!files.length) return;
  const items = [];
  for (const f of files) {
    const blobId = await store.putBlob(f);
    items.push({ create: { type: 'inbox', data: { kind: 'blob', name: f.name, blobId, mime: f.type || guessMime(f.name), size: f.size, status: 'à classer' } } });
  }
  await store.batch(items, `${files.length} élément(s) déposé(s) dans la boîte de réception`);
  toast(`${files.length} élément(s) déposé(s)`, { action: 'Annuler', onAction: () => store.undo() });
}

function classifyDialog(it) {
  const name = h('input', { value: it.kind === 'note' ? `${it.title || 'Note'} ${model.todayIso()}.txt` : it.name });
  const folder = h('select', {}, h('option', { value: '' }, 'Racine'), store.all('folder').map(d => h('option', { value: d.id }, d.name)));
  const subject = h('select', {}, h('option', { value: '' }, '—'), MATIERES.map(m => h('option', { value: m }, m)));
  const tags = h('input', { placeholder: 'tags séparés par des virgules' });
  modal({ title: 'Classer dans Fichiers', body: h('div', { class: 'form' }, field('Nom', name), field('Dossier', folder), field('Matière', subject), field('Tags', tags)), actions: [{ label: 'Annuler' }, { label: 'Classer', primary: true, onClick: async () => {
    let blobId = it.blobId, size = it.size, mime = it.mime;
    if (it.kind === 'note') {
      const b = new Blob([`${it.title ? it.title + '\n\n' : ''}${it.text}\n`], { type: 'text/plain' });
      blobId = await store.putBlob(b); size = b.size; mime = 'text/plain';
    }
    const fileId = store.uid();
    // Le contenu n'est pas copié : le fichier reprend le même contenu, la réception ne le référence plus.
    await store.batch([
      { create: { type: 'file', data: { id: fileId, kind: 'blob', name: name.value.trim() || 'Sans titre', folderId: folder.value || null, subject: subject.value, level: '', favorite: false, studentIds: [],
        yearId: model.currentYear()?.id || null, tags: tags.value.split(',').map(t => t.trim()).filter(Boolean), versions: [{ blobId, name: name.value.trim(), size, mime, at: new Date().toISOString() }] } } },
      { id: it.id, patch: { status: 'classé', blobId: null, classifiedAs: { type: 'file', id: fileId } } },
    ], 'Classement d’un élément de réception');
    toast('Classé dans Fichiers', { action: 'Annuler', onAction: () => store.undo() });
  } }] });
}
