// Fichiers reliés aux séances et aux moments du cahier journal, avec un rôle :
// « à projeter », « à imprimer » ou « ressource ». Le fichier n'est jamais copié : on garde sa référence
// (fileIds) et son rôle (fileRoles) sur la fiche de séance, l'occurrence, l'événement ou l'intervention.
import * as store from './store.js';
import * as model from './model.js';
import * as P from './pedago.js';
import * as PL from './planning.js';
import { h, modal, toast, pickFiles, safeUrl } from './ui.js';
import { pickMany } from './forms.js';
import { addFiles } from './pages/files.js';

export const ROLES = [['projeter', 'À projeter', '📽'], ['imprimer', 'À imprimer', '🖨'], ['ressource', 'Ressource', '📎']];
export const roleLabel = (r) => ROLES.find(x => x[0] === r)?.[1] || 'Ressource';
export const roleOf = (rec, id) => rec?.fileRoles?.[id] || 'ressource';
const alive = (id) => { const f = store.get(id); return f && !f.deletedAt ? f : null; };

/** Ajoute des fichiers à une fiche (ou autre enregistrement) avec un rôle. */
export async function attach(recId, ids, role = 'ressource', label = 'Fichier relié') {
  const rec = store.get(recId); if (!rec || !ids.length) return;
  const fileIds = [...new Set([...(rec.fileIds || []), ...ids])];
  const fileRoles = { ...(rec.fileRoles || {}) }; ids.forEach(id => { fileRoles[id] = role; });
  await store.update(recId, { fileIds, fileRoles }, label);
}
export const setRole = (recId, id, role) => store.update(recId, { fileRoles: { ...(store.get(recId).fileRoles || {}), [id]: role } }, `Fichier : ${roleLabel(role).toLowerCase()}`);
export async function detach(recId, id) {
  const rec = store.get(recId); const fileRoles = { ...(rec.fileRoles || {}) }; delete fileRoles[id];
  await store.update(recId, { fileIds: (rec.fileIds || []).filter(x => x !== id), fileRoles }, 'Fichier délié');
}

/** Où ranger un fichier joint à un moment du cahier journal : la fiche de séance s'il y en a une, sinon le moment lui-même. */
async function entryRecord(e, cls) {
  const sid = e.session?.id || e.sessionId;
  if (sid && store.get(sid)) return sid;
  if (e.kind === 'occ') return e.occ.id;
  if (e.kind === 'event') return e.event.id;
  if (e.kind === 'intervention' && e.intervention) return e.intervention.id;
  const occ = await PL.patchEntry(e, cls, {}, 'Moment du cahier journal');
  return occ?.id || null;
}

/** Fichiers d'un moment du cahier journal (fiche de séance, version réalisée, moment), avec leur rôle. */
export function entryFiles(e) {
  const recs = [e.session, e.occ, e.event, e.intervention].filter(Boolean);
  const out = new Map();
  for (const r of recs) for (const id of r.fileIds || []) if (!out.has(id) && alive(id)) out.set(id, { file: alive(id), role: roleOf(r, id), recId: r.id });
  for (const id of e.occ?.snapshot?.fileIds || []) if (!out.has(id) && alive(id)) out.set(id, { file: alive(id), role: e.occ.snapshot.fileRoles?.[id] || roleOf(e.session, id), recId: null });
  return [...out.values()];
}

const fileHref = (f) => (f.kind === 'link' && safeUrl(f.url) ? safeUrl(f.url) : `#/fichiers?open=${f.id}`);
/** Liste compacte par rôle (cahier journal). */
export function entryFilesView(e) {
  const list = entryFiles(e); if (!list.length) return null;
  return h('div', { class: 'small entry-files', 'data-testid': 'entry-files' }, ROLES.map(([r, l, ico]) => {
    const xs = list.filter(x => x.role === r); if (!xs.length) return null;
    return h('p', {}, `${ico} ${l} : `, xs.map(({ file: f, recId }, i) => [i ? ', ' : '', h('a', { href: fileHref(f), target: f.kind === 'link' ? '_blank' : null, rel: f.kind === 'link' ? 'noopener noreferrer' : null }, f.name),
      recId ? h('button', { class: 'btn btn-link small', type: 'button', title: 'Délier (le fichier reste dans Fichiers)', 'aria-label': `Délier ${f.name}`, onclick: () => detach(recId, f.id) }, '×') : null]));
  }));
}

function roleSeg(get, set) {
  const seg = h('div', { class: 'seg wrap', role: 'radiogroup', 'aria-label': 'Rôle du fichier' });
  const draw = () => seg.replaceChildren(...ROLES.map(([r, l, ico]) => h('button', { type: 'button', role: 'radio', class: get() === r ? 'on' : '', 'aria-checked': String(get() === r), 'data-testid': `role-${r}`, onclick: () => { set(r); draw(); } }, `${ico} ${l}`)));
  draw(); return seg;
}

/** Choisir le rôle puis des fichiers (existants ou nouveaux). Résout { ids, role } ou null. */
export function chooseFiles({ title = 'Joindre un fichier', role = 'ressource', subject = '', hint = '' } = {}) {
  return new Promise((resolve) => {
    let r = role; let choice = null;
    modal({ title, body: h('div', { class: 'form' }, h('p', { class: 'muted small' }, hint || 'Le fichier n’est pas copié : sa mise à jour se voit partout.'),
      h('div', { class: 'field' }, h('label', {}, 'Ce fichier est…'), roleSeg(() => r, (v) => { r = v; }))),
    onClose: async () => {
      if (!choice) return resolve(null);
      if (choice.drop) { const files = await choice.drop; if (!files.length) return resolve(null); const created = await addFiles(files, null, { subject }); return resolve(created.length ? { ids: created.map(c => c.id), role: r } : null); }
      const items = store.all('file').filter(f => !f.deletedAt).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
        .map(f => ({ id: f.id, label: f.name, detail: [f.kind === 'link' ? 'lien' : 'fichier', f.subject, f.level, (f.tags || []).join(', ')].filter(Boolean).join(' · ') }));
      const sel = await pickMany({ title: `Choisir dans mes fichiers (${roleLabel(r).toLowerCase()})`, items, emptyText: 'Aucun fichier : utilisez « Déposer un fichier ».' });
      resolve(sel?.length ? { ids: sel, role: r } : null);
    },
    actions: [{ label: 'Annuler' },
      { label: 'Déposer un fichier…', testid: 'files-drop', onClick: () => { choice = { drop: pickFiles() }; } },
      { label: 'Choisir dans mes fichiers…', primary: true, testid: 'files-pick', onClick: () => { choice = { pick: true }; } }] });
  });
}

/** Depuis le cahier journal : joindre un fichier à ce moment. */
export async function attachToEntry(cls, e) {
  const sid = e.session?.id || e.sessionId;
  const got = await chooseFiles({ title: `Joindre un fichier — ${e.title || e.subject || 'moment'}`, subject: e.subject || '',
    hint: sid ? 'Le fichier est ajouté à la fiche de séance : il la suivra si elle est reprogrammée ou réutilisée.' : 'Le fichier est joint à ce moment du cahier journal.' });
  if (!got) return;
  const recId = await entryRecord(e, cls); if (!recId) return toast('Impossible de joindre le fichier à ce moment.', { kind: 'error' });
  await attach(recId, got.ids, got.role, `${got.ids.length > 1 ? 'Fichiers joints' : 'Fichier joint'} (${roleLabel(got.role).toLowerCase()})`);
}

/** Depuis Fichiers : relier un ou plusieurs fichiers à une fiche de séance, une séquence ou un moment du cahier journal.
 * La liste des choix s'affiche directement dans la fenêtre (avec une recherche), puis « Relier ». */
export function linkFromFiles(fileIds) {
  const cls = model.currentClass();
  if (!cls) return toast('Choisissez d’abord une classe en haut de l’écran.', { kind: 'error' });
  let r = 'ressource'; let target = 'seance'; let date = model.todayIso(); let entryKey = ''; let pickId = ''; let q = '';
  const seqLabel = (id) => (id && store.get(id) && !store.get(id).deletedAt ? P.sequenceTitle(store.get(id)) : 'hors séquence');
  const options = () => (target === 'seance'
    ? P.ofClass('session', cls.id).map(s => ({ id: s.id, label: P.sessionTitle(s), group: `${s.subject || 'Autre'} · ${seqLabel(s.sequenceId)}` }))
    : P.ofClass('sequence', cls.id).map(s => ({ id: s.id, label: P.sequenceTitle(s), group: s.subject || 'Autre' })))
    .sort((a, b) => a.group.localeCompare(b.group, 'fr', { numeric: true }) || a.label.localeCompare(b.label, 'fr', { numeric: true }));
  const listBox = h('div', { class: 'pick-list link-pick', 'data-testid': 'link-list' });
  const drawList = () => {
    const t = q.trim().toLowerCase(); let last = null;
    const xs = options().filter(o => !t || `${o.label} ${o.group}`.toLowerCase().includes(t));
    listBox.replaceChildren(...(xs.length ? xs.flatMap(o => {
      const out = []; if (o.group !== last) { out.push(h('p', { class: 'pick-group' }, o.group)); last = o.group; }
      out.push(h('label', { class: 'pick-item' }, h('input', { type: 'radio', name: 'link-pick', checked: pickId === o.id, 'data-testid': 'link-pick', onchange: () => { pickId = o.id; } }), h('span', {}, o.label)));
      return out;
    }) : [h('p', { class: 'muted' }, target === 'seance' ? 'Aucune fiche de séance trouvée dans cette classe.' : 'Aucune séquence trouvée dans cette classe.')]));
  };
  const body = h('div', { class: 'form' });
  const draw = () => {
    const plan = PL.dayPlan(cls, date).entries;
    body.replaceChildren(
      h('div', { class: 'field' }, h('label', {}, 'Ce fichier est…'), roleSeg(() => r, (v) => { r = v; })),
      h('div', { class: 'field' }, h('label', {}, 'Relier à…'), h('div', { class: 'seg wrap', role: 'radiogroup' },
        [['seance', 'une fiche de séance'], ['sequence', 'une séquence'], ['moment', 'un moment du cahier journal']].map(([k, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(target === k), class: target === k ? 'on' : '', 'data-testid': `link-target-${k}`, onclick: () => { if (target !== k) { target = k; pickId = ''; q = ''; } draw(); } }, l)))),
      target === 'moment' ? h('div', { class: 'stack-sm' },
        h('div', { class: 'field' }, h('label', {}, 'Jour'), h('input', { type: 'date', value: date, 'data-testid': 'link-date', onchange: (ev) => { if (ev.target.value) { date = ev.target.value; entryKey = ''; draw(); } } })),
        plan.length ? h('div', { class: 'pick-list' }, plan.map(e => h('label', { class: 'pick-item' }, h('input', { type: 'radio', name: 'link-entry', checked: entryKey === e.key, 'data-testid': 'link-entry', onchange: () => { entryKey = e.key; } }),
          h('span', {}, h('strong', {}, `${e.allDay ? 'Journée' : e.start} ${e.title || e.subject || ''}`), e.session ? h('span', { class: 'muted small' }, ` — ${P.sessionTitle(e.session)}`) : null))))
          : h('p', { class: 'muted' }, 'Rien de prévu ce jour-là.'))
        : h('div', { class: 'stack-sm' },
          h('input', { type: 'search', value: q, placeholder: target === 'seance' ? 'Chercher une fiche (titre, discipline, séquence)…' : 'Chercher une séquence…', 'aria-label': 'Chercher', 'data-testid': 'link-search', oninput: (ev) => { q = ev.target.value; drawList(); } }),
          listBox,
          h('p', { class: 'muted small' }, target === 'seance' ? 'Le fichier suivra la fiche partout où elle est programmée dans le cahier journal.' : 'Le fichier rejoint les supports de la séquence (onglet Ressources de la séquence).')));
    if (target !== 'moment') drawList();
  };
  draw();
  modal({ title: fileIds.length > 1 ? `Relier ${fileIds.length} fichiers` : `Relier « ${store.get(fileIds[0])?.name || 'le fichier'} »`, wide: true, body,
    actions: [{ label: 'Annuler' }, { label: 'Relier', primary: true, testid: 'link-go', onClick: async () => {
      if (target === 'moment') {
        const e = PL.dayPlan(cls, date).entries.find(x => x.key === entryKey);
        if (!e) { toast('Choisissez un moment de la journée.'); return false; }
        const recId = await entryRecord(e, cls);
        await attach(recId, fileIds, r, `Relié au ${model.frShort(date)} (${roleLabel(r).toLowerCase()})`);
        toast(`Relié au cahier journal du ${model.frShort(date)}`, { action: 'Voir', onAction: () => { location.hash = `#/cahier?d=${date}`; } });
        return;
      }
      if (!pickId || !store.get(pickId)) { toast(target === 'seance' ? 'Choisissez une fiche de séance dans la liste.' : 'Choisissez une séquence dans la liste.'); return false; }
      await attach(pickId, fileIds, r, `Fichier relié ${target === 'seance' ? 'à la fiche' : 'à la séquence'} (${roleLabel(r).toLowerCase()})`);
      const id = pickId;
      toast(target === 'seance' ? 'Relié à la fiche de séance' : 'Relié à la séquence', { action: 'Voir', onAction: () => { location.hash = target === 'seance' ? `#/seance/${id}` : `#/sequence/${id}`; } });
    } }] });
}

/** Où un fichier est relié (fiches de séance, moments). */
export function usesOf(fileId) {
  return store.all('session').filter(s => !s.deletedAt && (s.fileIds || []).includes(fileId)).length
    + store.all('sequence').filter(s => !s.deletedAt && (s.fileIds || []).includes(fileId)).length
    + store.all('occurrence').filter(o => !o.deletedAt && (o.fileIds || []).includes(fileId)).length;
}
