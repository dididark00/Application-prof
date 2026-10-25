import * as store from '../store.js';
import * as model from '../model.js';
import { embedOf, previewLink } from '../embeds.js';
import { h, icon, toast, modal, field, formData, confirmDialog, pickFiles, download, formatSize, badge, emptyState, safeUrl } from '../ui.js';
import { pageHeader, subTabs, demoBadge } from '../components.js';
import { toCsv } from '../csv.js';

const filt = { q: '', tag: '', subject: '', level: '', kind: '', fav: false };
export const MATIERES = ['Français', 'Mathématiques', 'Questionner le monde', 'Histoire-géographie', 'Sciences', 'Langues vivantes', 'Arts plastiques', 'Éducation musicale', 'EPS', 'EMC', 'Autre'];
const BIG = 40 * 1024 * 1024;

const previewable = (mime = '') => mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('text/') || mime.startsWith('audio/') || mime.startsWith('video/');

export function render({ query, rerender }) {
  const folderId = query.folder || null;
  const folder = folderId ? store.get(folderId) : null;
  const folders = store.all('folder');
  const all = store.all('file');
  const searching = filt.q || filt.tag || filt.subject || filt.level || filt.kind || filt.fav;
  const q = filt.q.toLowerCase();
  const files = all.filter(f => (searching ? true : (f.folderId || null) === folderId)
    && (!q || f.name.toLowerCase().includes(q) || (f.tags || []).some(t => t.toLowerCase().includes(q)) || (f.description || '').toLowerCase().includes(q))
    && (!filt.tag || (f.tags || []).includes(filt.tag))
    && (!filt.subject || f.subject === filt.subject)
    && (!filt.level || f.level === filt.level)
    && (!filt.kind || f.kind === filt.kind)
    && (!filt.fav || f.favorite))
    .sort((a, b) => (b.favorite - a.favorite) || a.name.localeCompare(b.name, 'fr'));
  const subFolders = searching ? [] : folders.filter(f => (f.parentId || null) === folderId).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const tags = [...new Set(all.flatMap(f => f.tags || []))].sort((a, b) => a.localeCompare(b, 'fr'));

  const crumbs = [];
  for (let f = folder; f; f = f.parentId ? store.get(f.parentId) : null) crumbs.unshift(f);

  const drop = h('div', { class: 'dropzone', 'data-testid': 'dropzone',
    ondragover: (e) => { e.preventDefault(); drop.classList.add('over'); },
    ondragleave: () => drop.classList.remove('over'),
    ondrop: async (e) => { e.preventDefault(); drop.classList.remove('over'); await addFiles([...e.dataTransfer.files], folderId); } },
    'Glissez des fichiers ici ou utilisez « Déposer des fichiers ».');

  const page = h('div', { class: 'page' },
    pageHeader('Fichiers et ressources', { favKey: 'preparer/fichiers', subtitle: 'Stockés sur cet appareil et inclus dans la sauvegarde exportée.',
      actions: [
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'upload-files', onclick: async () => addFiles(await pickFiles(), folderId) }, icon('upload', 16), 'Déposer des fichiers'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'add-link', onclick: () => linkDialog(null, folderId) }, icon('link', 16), 'Ajouter un lien'),
        h('button', { class: 'btn', type: 'button', onclick: () => folderDialog(null, folderId) }, icon('folder', 16), 'Nouveau dossier'),
        h('button', { class: 'btn', type: 'button', onclick: () => exportIndex(all) }, icon('download', 16), 'Index CSV'),
      ] }),
    subTabs(),
    h('div', { class: 'card' },
      h('div', { class: 'filters' },
        h('input', { type: 'search', placeholder: 'Rechercher nom, tag, description…', value: filt.q, 'aria-label': 'Rechercher dans les fichiers', onchange: (e) => { filt.q = e.target.value; rerender(); } }),
        sel('Tag', tags, filt.tag, v => { filt.tag = v; rerender(); }),
        sel('Matière', MATIERES, filt.subject, v => { filt.subject = v; rerender(); }),
        sel('Niveau', model.NIVEAUX, filt.level, v => { filt.level = v; rerender(); }),
        h('select', { 'aria-label': 'Type', onchange: (e) => { filt.kind = e.target.value; rerender(); } }, [['', 'Fichiers et liens'], ['blob', 'Fichiers'], ['link', 'Liens']].map(([v, l]) => h('option', { value: v, selected: filt.kind === v }, l))),
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: filt.fav, onchange: (e) => { filt.fav = e.target.checked; rerender(); } }), 'Favoris'),
        searching ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => { Object.assign(filt, { q: '', tag: '', subject: '', level: '', kind: '', fav: false }); rerender(); } }, 'Effacer les filtres') : null),
      searching ? h('p', { class: 'muted small' }, 'Recherche dans tous les dossiers.') :
        h('nav', { class: 'crumbs', 'aria-label': 'Dossiers' }, h('a', { href: '#/fichiers' }, 'Tous les fichiers'), crumbs.map(c => [' › ', h('a', { href: `#/fichiers?folder=${c.id}` }, c.name)]),
          folder ? h('span', { class: 'row inline-actions' },
            h('button', { class: 'btn btn-small', type: 'button', onclick: () => folderDialog(folder, folder.parentId) }, 'Renommer'),
            h('button', { class: 'btn btn-small btn-ghost-danger', type: 'button', onclick: async () => {
              const hasContent = all.some(f => f.folderId === folder.id) || folders.some(f => f.parentId === folder.id);
              if (hasContent) { toast('Videz d’abord ce dossier (déplacez ou supprimez son contenu).', { kind: 'error' }); return; }
              await store.remove(folder.id, `Dossier ${folder.name} mis à la corbeille`);
              location.hash = folder.parentId ? `#/fichiers?folder=${folder.parentId}` : '#/fichiers';
            } }, 'Supprimer le dossier')) : null),
      drop,
      subFolders.length || files.length ? h('ul', { class: 'file-list', 'data-testid': 'file-list' },
        subFolders.map(f => h('li', { class: 'file-item' }, icon('folder'), h('a', { class: 'file-name', href: `#/fichiers?folder=${f.id}` }, f.name), demoBadge(f),
          h('span', { class: 'muted small' }, `${all.filter(x => x.folderId === f.id).length} élément(s)`))),
        files.map(fileRow)) : emptyState(searching ? 'Aucun résultat' : 'Ce dossier est vide')));

  if (query.open) {
    const f = store.get(query.open);
    // On retire « open » de l'adresse pour ne pas rouvrir l'aperçu à chaque actualisation.
    history.replaceState(null, '', folderId ? `#/fichiers?folder=${folderId}` : '#/fichiers');
    document.getElementById('main').dataset.route = location.hash;
    if (f && !f.deletedAt) setTimeout(() => (f.kind === 'link' ? linkDialog(f) : preview(f)), 0);
  }
  return page;
}

function sel(label, options, value, onChange) {
  return h('select', { 'aria-label': label, onchange: (e) => onChange(e.target.value) }, h('option', { value: '' }, `${label} : tous`), options.map(o => h('option', { value: o, selected: value === o }, o)));
}

function fileRow(f) {
  const cur = f.kind === 'blob' ? f.versions[f.versions.length - 1] : null;
  const url = f.kind === 'link' ? safeUrl(f.url) : null;
  return h('li', { class: 'file-item' },
    icon(f.kind === 'link' ? 'link' : 'file'),
    h('div', { class: 'file-main' },
      f.kind === 'link'
        ? h('a', { class: 'file-name', href: url || '#', target: '_blank', rel: 'noopener noreferrer' }, f.name)
        : h('button', { class: 'file-name linklike', type: 'button', onclick: () => preview(f) }, f.name),
      h('div', { class: 'file-meta' },
        demoBadge(f),
        f.kind === 'link' ? badge(linkHost(f.url), 'muted') : null,
        cur ? h('span', {}, `${formatSize(cur.size)} · ${model.frShort(cur.at)}${f.versions.length > 1 ? ` · ${f.versions.length} versions` : ''}`) : null,
        f.subject ? badge(f.subject) : null, f.level ? badge(f.level) : null,
        (f.tags || []).map(t => badge(`#${t}`, 'muted')),
        (f.studentIds || []).length ? badge(`${f.studentIds.length} élève(s)`, 'info') : null)),
    h('div', { class: 'file-actions' },
      h('button', { class: `icon-btn fav ${f.favorite ? 'on' : ''}`, type: 'button', 'aria-label': f.favorite ? 'Retirer des favoris' : 'Mettre en favori', 'aria-pressed': f.favorite ? 'true' : 'false',
        onclick: () => store.update(f.id, { favorite: !f.favorite }, f.favorite ? 'Retrait des favoris' : 'Mise en favori') }, icon('star', 16)),
      f.kind === 'blob' ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => preview(f) }, 'Aperçu') : null,
      f.kind === 'link' && embedOf(f.url) ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'link-preview', onclick: () => previewLink(f) }, 'Aperçu') : null,
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => (f.kind === 'link' ? linkDialog(f) : metaDialog(f)) }, 'Modifier'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Mettre ${f.name} à la corbeille`, onclick: async () => {
        await store.remove(f.id, `${f.name} mis à la corbeille`);
        toast('Mis à la corbeille', { action: 'Annuler', onAction: () => store.undo() });
      } }, icon('trash', 16))));
}

function linkHost(u) {
  const e = embedOf(u); if (e) return e.service;
  try { const host = new URL(u).hostname.replace(/^www\./, ''); if (host.includes('canva')) return 'Canva'; if (host.includes('drive.google') || host.includes('docs.google')) return 'Google Drive'; return host; } catch { return 'lien'; }
}

export async function addFiles(list, folderId = null, extra = {}) {
  if (!list || !list.length) return [];
  const big = list.filter(f => f.size > BIG);
  if (big.length && !await confirmDialog('Fichiers volumineux', `${big.map(f => f.name).join(', ')} dépasse(nt) ${formatSize(BIG)}. Ils occuperont de la place sur l’appareil et alourdiront la sauvegarde. Continuer ?`, { confirmLabel: 'Continuer' })) return [];
  const items = [];
  for (const file of list) {
    const blobId = await store.putBlob(file);
    items.push({ create: { type: 'file', data: { kind: 'blob', name: file.name, folderId, tags: [], subject: '', level: '', favorite: false, yearId: model.currentYear()?.id || null, studentIds: [],
      versions: [{ blobId, name: file.name, size: file.size, mime: file.type || guessMime(file.name), at: new Date().toISOString() }], ...extra } } });
  }
  const created = await store.batch(items, `Dépôt de ${list.length} fichier(s)`);
  toast(`${list.length} fichier(s) enregistré(s) sur cet appareil`, { action: 'Annuler', onAction: () => store.undo(), kind: 'success' });
  return created;
}

export function guessMime(name) {
  const ext = name.split('.').pop().toLowerCase();
  return ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', txt: 'text/plain', md: 'text/plain', csv: 'text/csv',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', mp3: 'audio/mpeg', mp4: 'video/mp4', odt: 'application/vnd.oasis.opendocument.text' })[ext] || 'application/octet-stream';
}

/** Texte lu dans une image (OCR sur l'appareil) : enregistré avec le fichier, donc retrouvé par la recherche. */
function ocrBlock(f, blob) {
  const out = h('textarea', { rows: 6, class: 'ocr-text', 'data-testid': 'file-ocr-text', placeholder: 'Le texte lu apparaîtra ici, modifiable.', onchange: (e) => store.update(f.id, { ocrText: e.target.value }, `Texte de ${f.name}`, { quiet: true }) }, f.ocrText || '');
  const status = h('span', { class: 'muted small', 'aria-live': 'polite' });
  const btn = h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'file-ocr', onclick: async () => {
    btn.disabled = true;
    try {
      const O = await import('../ocr.js');
      const text = await O.recognize(blob, { onStatus: (t) => { status.textContent = t; }, onProgress: (p) => { status.textContent = `Lecture du texte… ${p} %`; } });
      out.value = text; status.textContent = text ? 'Texte lu : vérifiez-le, il peut contenir des erreurs.' : 'Aucun texte reconnu.';
      await store.update(f.id, { ocrText: text }, `Texte lu dans ${f.name}`, { quiet: true });
    } catch (e) { status.textContent = `Lecture impossible : ${e.message}`; }
    finally { btn.disabled = false; }
  } }, f.ocrText ? 'Relire le texte' : 'Lire le texte de l’image');
  return h('section', { class: 'ocr-block' }, h('h3', {}, 'Texte de l’image'), h('div', { class: 'row' }, btn, status), out,
    h('p', { class: 'muted small' }, 'Lecture faite sur l’appareil : l’image n’est envoyée nulle part. Le texte est enregistré avec le fichier et retrouvé par la recherche.'));
}

async function preview(f) {
  const versions = f.versions || [];
  const cur = versions[versions.length - 1];
  const blob = cur ? await store.getBlob(cur.blobId) : null;
  const body = h('div', { class: 'preview' });
  const urls = [];
  if (!blob) body.append(h('p', { class: 'warn' }, 'Contenu introuvable sur cet appareil.'));
  else {
    const mime = cur.mime || blob.type;
    const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: mime })); urls.push(url);
    if (mime.startsWith('image/')) body.append(h('img', { src: url, alt: f.name, class: 'preview-img' }), ocrBlock(f, blob));
    else if (mime === 'application/pdf') body.append(h('iframe', { src: url, title: f.name, class: 'preview-frame' }));
    else if (mime.startsWith('text/')) body.append(h('pre', { class: 'preview-text' }, (await blob.text()).slice(0, 200000)));
    else if (mime.startsWith('audio/')) body.append(h('audio', { src: url, controls: true }));
    else if (mime.startsWith('video/')) body.append(h('video', { src: url, controls: true, class: 'preview-img' }));
    else body.append(h('p', {}, /presentation|pptx/.test(mime) || /\.pptx$/i.test(f.name)
      ? 'Les fichiers PowerPoint ne s’affichent pas directement dans le navigateur. Téléchargez-le pour l’ouvrir, ou exportez-le en PDF depuis PowerPoint, LibreOffice ou Google Slides puis déposez le PDF ici pour l’afficher.'
      : 'Aperçu non disponible pour ce format dans le navigateur. Téléchargez le fichier pour l’ouvrir.'));
  }
  body.append(h('h3', {}, 'Versions'), h('table', { class: 'table' }, h('tbody', {}, versions.slice().reverse().map((v, i) => h('tr', {},
    h('td', {}, i === 0 ? badge('actuelle', 'ok') : `v${versions.length - i}`), h('td', {}, v.name), h('td', {}, model.frDateTime(v.at)), h('td', {}, formatSize(v.size)),
    h('td', { class: 'row' },
      h('button', { class: 'btn btn-small', type: 'button', onclick: async () => { const b = await store.getBlob(v.blobId); if (b) download(v.name, b); } }, 'Télécharger'),
      i > 0 ? h('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
        await store.update(f.id, { versions: [...versions, { ...v, at: new Date().toISOString(), restoredFrom: v.at }] }, `Version précédente de ${f.name} rétablie`);
        toast('Version rétablie comme actuelle (les autres versions sont conservées)');
      } }, 'Rétablir') : null))))));
  modal({ title: f.name, wide: true, body, onClose: () => urls.forEach(u => URL.revokeObjectURL(u)), actions: [
    { label: 'Nouvelle version…', onClick: async () => {
      const [nf] = await pickFiles({ multiple: false });
      if (!nf) return false;
      const blobId = await store.putBlob(nf);
      await store.update(f.id, { versions: [...versions, { blobId, name: nf.name, size: nf.size, mime: nf.type || guessMime(nf.name), at: new Date().toISOString() }] }, `Nouvelle version de ${f.name}`);
      toast('Nouvelle version enregistrée ; les précédentes restent disponibles.');
    } },
    { label: 'Télécharger', primary: true, onClick: () => { if (blob) download(cur.name, blob); return false; } },
  ] });
}

function metaFields(f) {
  const cls = model.currentClass();
  const students = cls ? model.studentsOfClass(cls.id, { includeLeft: true, includeFuture: true }) : [];
  const folders = store.all('folder');
  const chosen = new Set(f?.studentIds || []);
  return {
    node: h('div', {},
      field('Nom', h('input', { name: 'name', required: true, value: f?.name || '' })),
      field('Description', h('textarea', { name: 'description', rows: 2 }, f?.description || '')),
      h('div', { class: 'grid-3' },
        field('Dossier', h('select', { name: 'folderId' }, h('option', { value: '' }, 'Racine'), folders.map(d => h('option', { value: d.id, selected: f?.folderId === d.id }, d.name)))),
        field('Matière', h('select', { name: 'subject' }, h('option', { value: '' }, '—'), MATIERES.map(m => h('option', { value: m, selected: f?.subject === m }, m)))),
        field('Niveau', h('select', { name: 'level' }, h('option', { value: '' }, '—'), model.NIVEAUX.map(m => h('option', { value: m, selected: f?.level === m }, m))))),
      h('div', { class: 'grid-2' },
        field('Tags (séparés par des virgules)', h('input', { name: 'tags', value: (f?.tags || []).join(', '), placeholder: 'ex. poésie, automne' })),
        field('Projet', h('input', { name: 'project', value: f?.project || '' }))),
      field('Année', h('select', { name: 'yearId' }, h('option', { value: '' }, 'Toutes les années'), model.years().map(y => h('option', { value: y.id, selected: f?.yearId === y.id }, y.label)))),
      students.length ? h('fieldset', {}, h('legend', {}, `Élèves concernés (${cls.name})`), h('div', { class: 'chips' }, students.map(({ student: s }) =>
        h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: chosen.has(s.id), onchange: (e) => { e.target.checked ? chosen.add(s.id) : chosen.delete(s.id); } }), `${s.firstName} ${s.lastName}`)))) : null),
    read: (form) => {
      const d = formData(form);
      return { name: d.name, description: d.description, folderId: d.folderId || null, subject: d.subject, level: d.level, project: d.project, yearId: d.yearId || null,
        tags: [...new Set(d.tags.split(',').map(t => t.trim()).filter(Boolean))], studentIds: [...chosen] };
    },
  };
}

function metaDialog(f) {
  const m = metaFields(f);
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() }, m.node);
  modal({ title: 'Modifier les informations', wide: true, body: form, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    const d = m.read(form);
    if (!d.name) return false;
    await store.update(f.id, d, `Informations de ${d.name}`);
    toast('Enregistré', { action: 'Annuler', onAction: () => store.undo() });
  } }] });
}

export function linkDialog(f, folderId = null) {
  const m = metaFields(f);
  const url = h('input', { name: 'url', type: 'url', required: true, value: f?.url || '', placeholder: 'https://…' });
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() }, field('Adresse du lien (Drive, Canva, site…)', url, 'Le lien s’ouvre dans un nouvel onglet. Liens Google Drive, Docs, Slides, Sheets et Canva : aperçu dans l’application (bouton « Aperçu ») si le document est partagé par lien. Aucune connexion à votre compte n’est demandée.'), m.node);
  const errors = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: f ? 'Modifier le lien' : 'Ajouter un lien', wide: true, body: h('div', {}, form, errors), actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    const u = safeUrl(url.value.trim());
    if (!u) { errors.textContent = 'Adresse invalide : elle doit commencer par http:// ou https://.'; return false; }
    const d = m.read(form);
    d.name = d.name || linkHost(u);
    if (f) await store.update(f.id, { ...d, url: u }, `Lien ${d.name} modifié`);
    else await store.create('file', { ...d, kind: 'link', url: u, folderId: d.folderId || folderId, favorite: false, versions: [] }, `Lien ${d.name} ajouté`);
    toast('Lien enregistré', { action: 'Annuler', onAction: () => store.undo() });
  } }] });
}

function folderDialog(folder, parentId) {
  const name = h('input', { name: 'name', required: true, value: folder?.name || '' });
  modal({ title: folder ? 'Renommer le dossier' : 'Nouveau dossier', body: h('form', { class: 'form', onsubmit: (e) => e.preventDefault() }, field('Nom', name)), actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    const n = name.value.trim(); if (!n) return false;
    if (folder) await store.update(folder.id, { name: n }, 'Dossier renommé');
    else await store.create('folder', { name: n, parentId: parentId || null }, `Dossier ${n} créé`);
  } }] });
}

function exportIndex(all) {
  const folderName = (id) => (id ? store.get(id)?.name || '' : '');
  const rows = all.map(f => [f.name, f.kind === 'link' ? 'Lien' : 'Fichier', folderName(f.folderId), f.subject, f.level, (f.tags || []).join(', '), f.kind === 'link' ? f.url : '', f.kind === 'blob' ? formatSize(f.versions.at(-1)?.size) : '', model.frShort(f.updatedAt)]);
  download(`index-fichiers-${model.todayIso()}.csv`, toCsv([['Nom', 'Type', 'Dossier', 'Matière', 'Niveau', 'Tags', 'Lien', 'Taille', 'Modifié le'], ...rows]), 'text/csv;charset=utf-8');
}
