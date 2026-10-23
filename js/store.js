// Couche de données de l'application.
// Toutes les lectures se font en mémoire (rapide), toutes les écritures sont
// immédiatement enregistrées dans IndexedDB (persistant après fermeture).
// Chaque écriture produit une entrée d'historique (auteur/date, avant/après)
// et peut être annulée. Les suppressions vont d'abord à la corbeille.

import * as db from './db.js';

export const SCHEMA_VERSION = 1;

const records = new Map();
const listeners = new Set();
const undoStack = [];
let settings = {};
let tombstones = {}; // éléments supprimés définitivement : {id: date}, pour que la synchronisation ne les fasse pas revenir
let saveState = { status: 'saved', at: null, error: null };

const DEFAULT_SETTINGS = {
  appName: 'Classeur',
  userName: '',
  currentYearId: null,
  currentClassId: null,
  hiddenModules: [],
  favorites: [],
  lastBackupAt: null,
};

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const clone = (v) => (v == null ? v : structuredClone(v));
const nowIso = () => new Date().toISOString();

export async function init() {
  const [all, meta] = await Promise.all([db.getAll('records'), db.getAll('meta')]);
  records.clear();
  for (const r of all) records.set(r.id, r);
  const s = meta.find(m => m.key === 'settings');
  settings = { ...DEFAULT_SETTINGS, ...(s ? s.value : {}) };
  tombstones = meta.find(m => m.key === 'tombstones')?.value || {};
  const sv = meta.find(m => m.key === 'schemaVersion');
  if (!sv) await db.write({ puts: { meta: [{ key: 'schemaVersion', value: SCHEMA_VERSION }] } });
  undoStack.length = 0;
  emit({ kind: 'init' });
}

// ───────── Abonnements et état d'enregistrement
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(evt) { for (const fn of listeners) { try { fn(evt); } catch (e) { console.error(e); } } }
export function getSaveState() { return { ...saveState }; }
function setSave(status, error = null) {
  saveState = { status, at: status === 'saved' ? nowIso() : saveState.at, error };
  emit({ kind: 'save', state: saveState });
}

async function persist(op) {
  setSave('saving');
  try { await op(); setSave('saved'); }
  catch (e) { console.error(e); setSave('error', e.message || String(e)); throw e; }
}

// ───────── Lecture
export function get(id) { const r = records.get(id); return r ? clone(r) : null; }
/** Liste les enregistrements d'un type (hors corbeille par défaut). */
export function all(type, { includeDeleted = false } = {}) {
  const out = [];
  for (const r of records.values()) {
    if (r.type !== type) continue;
    if (!includeDeleted && r.deletedAt) continue;
    out.push(r);
  }
  return out.map(clone);
}
export function trash() {
  return [...records.values()].filter(r => r.deletedAt).map(clone)
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}
export function count() { return records.size; }

// ───────── Écriture (avec historique et annulation)
function author() { return settings.userName || 'Utilisatrice'; }

/** Applique un ensemble de changements {before, after} en une transaction. */
async function commit(changes, label, { undoable = true, action = 'modification', quiet = false } = {}) {
  const at = nowIso();
  const batch = uid();
  const puts = [];
  const dels = [];
  const audit = [];
  for (const c of changes) {
    if (c.after) puts.push(c.after); else dels.push(c.before.id);
    const r = c.after || c.before;
    audit.push({ at, author: author(), label, action: c.action || action, batch,
      recordId: r.id, recordType: r.type, before: clone(c.before), after: clone(c.after) });
  }
  await persist(() => db.write({ puts: { records: puts, audit }, deletes: { records: dels } }));
  for (const p of puts) records.set(p.id, clone(p));
  for (const d of dels) records.delete(d);
  if (undoable) { undoStack.push({ label, changes }); if (undoStack.length > 100) undoStack.shift(); }
  emit({ kind: 'change', label, quiet, ids: changes.map(c => (c.after || c.before).id) });
}

export async function create(type, data, label) {
  const at = nowIso();
  const rec = { ...clone(data), id: data.id || uid(), type, createdAt: at, updatedAt: at, createdBy: author() };
  await commit([{ before: null, after: rec, action: 'création' }], label || 'Création');
  return clone(rec);
}

export async function createMany(type, list, label) {
  const at = nowIso();
  const recs = list.map(d => ({ ...clone(d), id: d.id || uid(), type: d.type || type, createdAt: at, updatedAt: at, createdBy: author() }));
  await commit(recs.map(r => ({ before: null, after: r, action: 'création' })), label || 'Création multiple');
  return recs.map(clone);
}

/** opts.quiet : la page en cours d'édition n'est pas redessinée (saisie au fil de l'eau). */
export async function update(id, patch, label, opts = {}) {
  const before = records.get(id);
  if (!before) throw new Error('Élément introuvable');
  const after = { ...clone(before), ...clone(patch), id, type: before.type, updatedAt: nowIso(), updatedBy: author() };
  await commit([{ before: clone(before), after }], label || 'Modification', { quiet: !!opts.quiet });
  return clone(after);
}

/** Plusieurs modifications groupées (une seule annulation). items = [{id, patch}] ou [{create:{type,data}}] */
export async function batch(items, label, opts = {}) {
  const at = nowIso();
  const changes = [];
  for (const it of items) {
    if (it.create) {
      const rec = { ...clone(it.create.data), id: it.create.data.id || uid(), type: it.create.type, createdAt: at, updatedAt: at, createdBy: author() };
      changes.push({ before: null, after: rec, action: 'création' });
    } else {
      const before = records.get(it.id);
      if (!before) continue;
      changes.push({ before: clone(before), after: { ...clone(before), ...clone(it.patch), updatedAt: at, updatedBy: author() } });
    }
  }
  if (changes.length) await commit(changes, label, { quiet: !!opts.quiet });
  return changes.map(c => clone(c.after));
}

/** Suppression douce : l'élément va à la corbeille. */
export async function remove(id, label) {
  const before = records.get(id);
  if (!before) return;
  const after = { ...clone(before), deletedAt: nowIso(), deletedBy: author() };
  await commit([{ before: clone(before), after, action: 'mise à la corbeille' }], label || 'Mise à la corbeille');
}

export async function restore(id) {
  const before = records.get(id);
  if (!before) return;
  const after = clone(before); delete after.deletedAt; delete after.deletedBy;
  after.updatedAt = nowIso();
  await commit([{ before: clone(before), after, action: 'restauration' }], 'Restauration depuis la corbeille');
}

/** Suppression définitive (depuis la corbeille uniquement). Supprime aussi les contenus binaires associés. */
export async function purge(id) {
  const before = records.get(id);
  if (!before || !before.deletedAt) throw new Error('Seuls les éléments de la corbeille peuvent être supprimés définitivement.');
  const blobIds = blobIdsOf(before);
  const audit = [{ at: nowIso(), author: author(), label: 'Suppression définitive', action: 'suppression définitive',
    batch: uid(), recordId: id, recordType: before.type, before: null, after: null }];
  tombstones = { ...tombstones, [id]: nowIso() };
  await persist(() => db.write({ puts: { audit, meta: [{ key: 'tombstones', value: tombstones }] }, deletes: { records: [id], blobs: blobIds } }));
  records.delete(id);
  // Les annulations ne doivent plus viser cet élément.
  for (let i = undoStack.length - 1; i >= 0; i--) if (undoStack[i].changes.some(c => (c.after || c.before).id === id)) undoStack.splice(i, 1);
  emit({ kind: 'change', label: 'Suppression définitive', ids: [id] });
}

/** Suppression définitive d'un ensemble (utilisé uniquement pour retirer les données de démonstration). */
export async function purgeWhere(pred, label) {
  const victims = [...records.values()].filter(pred);
  if (!victims.length) return 0;
  const ids = victims.map(v => v.id);
  const blobIds = victims.flatMap(blobIdsOf);
  const audit = [{ at: nowIso(), author: author(), label, action: 'suppression définitive', batch: uid(), recordId: null, recordType: 'lot', before: null, after: { count: ids.length } }];
  const at = nowIso(); tombstones = { ...tombstones }; for (const id of ids) tombstones[id] = at;
  await persist(() => db.write({ puts: { audit, meta: [{ key: 'tombstones', value: tombstones }] }, deletes: { records: ids, blobs: blobIds } }));
  for (const id of ids) records.delete(id);
  const set = new Set(ids);
  for (let i = undoStack.length - 1; i >= 0; i--) if (undoStack[i].changes.some(c => set.has((c.after || c.before).id))) undoStack.splice(i, 1);
  emit({ kind: 'change', label, ids });
  return ids.length;
}

function blobIdsOf(rec) {
  const ids = [];
  if (rec.blobId) ids.push(rec.blobId);
  if (rec.photoBlobId) ids.push(rec.photoBlobId);
  if (Array.isArray(rec.versions)) for (const v of rec.versions) if (v.blobId) ids.push(v.blobId);
  return ids;
}

export function canUndo() { return undoStack.length > 0; }
export function lastUndoLabel() { return undoStack.length ? undoStack[undoStack.length - 1].label : null; }

export async function undo() {
  const entry = undoStack.pop();
  if (!entry) return null;
  const reversed = entry.changes.slice().reverse().map(c => ({
    before: c.after ? clone(records.get(c.after.id) || c.after) : null,
    after: c.before ? clone(c.before) : null,
    action: 'annulation',
  })).filter(c => c.before || c.after);
  await commit(reversed, `Annulation : ${entry.label}`, { undoable: false });
  return entry.label;
}

// ───────── Contenus binaires
export async function putBlob(blob) {
  const id = uid();
  await persist(() => db.write({ puts: { blobs: [{ id, blob }] } }));
  return id;
}
export async function getBlob(id) {
  const r = await db.get('blobs', id);
  return r ? r.blob : null;
}

// ───────── Réglages
export function getSettings() { return clone(settings); }
export async function setSettings(patch, opts = {}) {
  const at = nowIso();
  const keyAt = { ...(settings._keyAt || {}) };
  for (const k of Object.keys(patch || {})) keyAt[k] = at;
  settings = { ...settings, ...clone(patch), _keyAt: keyAt };
  await persist(() => db.write({ puts: { meta: [{ key: 'settings', value: settings }] } }));
  emit({ kind: 'settings', quiet: !!opts.quiet });
}

// ───────── Historique
export async function auditLog(limit = 200) {
  const all = await db.getAll('audit');
  return all.slice(-limit).reverse();
}

// ───────── Synchronisation : application de changements venus d'un autre appareil
export function getTombstones() { return { ...tombstones }; }
export function rawRecords() { return [...records.values()].map(clone); }

/**
 * Écrit des enregistrements reçus d'un autre appareil (tels quels, dates comprises),
 * supprime ceux supprimés définitivement là-bas, ajoute les contenus binaires manquants.
 * Chaque changement est tracé dans l'historique (avant/après) ; pas d'annulation (c'est une fusion).
 */
export async function applyExternal({ puts = [], deletes = [], blobs = [], tomb = {}, settingsPatch = null, keyAt = null, note = [] }, label) {
  const at = nowIso(); const b = uid();
  const audit = [
    ...puts.map(r => ({ at, author: label, label, action: 'synchronisation', batch: b, recordId: r.id, recordType: r.type, before: clone(records.get(r.id)) || null, after: clone(r) })),
    ...deletes.map(id => ({ at, author: label, label, action: 'suppression définitive (synchronisation)', batch: b, recordId: id, recordType: records.get(id)?.type || '', before: clone(records.get(id)) || null, after: null })),
    ...note.map(n => ({ at, author: label, label: n.label, action: 'version écartée (synchronisation)', batch: b, recordId: n.record.id, recordType: n.record.type, before: clone(n.record), after: null })),
  ];
  tombstones = { ...tombstones, ...tomb };
  const meta = [{ key: 'tombstones', value: tombstones }];
  if (settingsPatch) { settings = { ...settings, ...clone(settingsPatch), _keyAt: { ...(settings._keyAt || {}), ...(keyAt || {}) } }; meta.push({ key: 'settings', value: settings }); }
  await persist(() => db.write({ puts: { records: puts, audit, blobs, meta }, deletes: { records: deletes } }));
  for (const r of puts) records.set(r.id, clone(r));
  for (const id of deletes) records.delete(id);
  if (puts.length || deletes.length) emit({ kind: 'change', label, ids: [...puts.map(r => r.id), ...deletes] });
  if (settingsPatch) emit({ kind: 'settings' });
}
export async function blobIds() { const db_ = await db.getAll('blobs'); return new Set(db_.map(x => x.id)); }

// Utilisé par la sauvegarde et les tests
export async function reloadFromDb() { await init(); }
