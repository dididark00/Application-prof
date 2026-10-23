// Synchronisation entre appareils par un dossier partagé (Nuage d'apps.education.fr, ou tout autre dossier).
// Chaque appareil écrit SON fichier « .classeur » (instantané complet, compressé et chiffré par mot de passe)
// et lit ceux des autres : les éléments sont fusionnés un par un (le plus récent gagne, la version écartée
// reste dans l'historique), les fichiers joints sont ajoutés, les suppressions définitives sont propagées.
// Aucun serveur de l'application : le transport, c'est Nuage (ou une clé USB, un e-mail…).
import * as store from './store.js';
import * as db from './db.js';
import * as D from './device.js';
import { APP_VERSION } from './backup.js';

export const FORMAT = 'classeur-synchro';
export const EXT = '.classeur';
/** Réglages propres à chaque appareil : jamais transmis. */
export const DEVICE_KEYS = ['currentYearId', 'currentClassId', 'lastBackupAt', '_keyAt'];
const ITER = 250000;

// ───── Outils
const enc = new TextEncoder(); const dec = new TextDecoder();
function b64(buf) { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s) { const bin = atob(s); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
async function gzip(bytes) { if (typeof CompressionStream === 'undefined') return { data: bytes, gz: false }; return { data: new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()), gz: true }; }
async function gunzip(bytes) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); }
async function keyFrom(password, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export function slug(s) { return String(s || 'appareil').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'appareil'; }
export async function fileName() { const me = await D.identity(); return `classeur-${slug(me.name)}-${me.id.slice(0, 8)}${EXT}`; }

// ───── Mot de passe (mémorisé sur l'appareil si l'utilisatrice le souhaite)
export async function savedPassword() { return (await D.get('syncPassword')) || ''; }
export async function rememberPassword(pw) { if (pw) await D.set('syncPassword', pw); else await D.del('syncPassword'); }

// ───── Construction du fichier de l'appareil
export async function buildFile(password) {
  if (!password || password.length < 8) throw new Error('Choisissez un mot de passe de synchronisation d’au moins 8 caractères.');
  const me = await D.identity();
  const settings = store.getSettings();
  const shared = Object.fromEntries(Object.entries(settings).filter(([k]) => !DEVICE_KEYS.includes(k)));
  const blobs = [];
  for (const x of await db.getAll('blobs')) blobs.push({ id: x.id, mime: x.blob.type, size: x.blob.size, base64: b64(await x.blob.arrayBuffer()) });
  const payload = { records: store.rawRecords(), blobs, tombstones: store.getTombstones(), settings: shared, keyAt: settings._keyAt || {} };
  const { data, gz } = await gzip(enc.encode(JSON.stringify(payload)));
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(password, salt), data);
  const seenMap = (await D.get('seen')) || {};
  const head = { seen: Object.fromEntries(Object.entries(seenMap).map(([k, v]) => [k, { mergedAt: v.mergedAt }])), format: FORMAT, version: 1, appVersion: APP_VERSION, schemaVersion: store.SCHEMA_VERSION, deviceId: me.id, deviceName: me.name, at: new Date().toISOString(), counts: { records: payload.records.length, blobs: blobs.length }, gz, kdf: { name: 'PBKDF2-SHA256', iterations: ITER, salt: b64(salt) }, iv: b64(iv), payload: b64(cipher) };
  return new File([JSON.stringify(head)], await fileName(), { type: 'application/json' });
}

/** Lit un fichier d'un autre appareil : vérifie le format et déchiffre. */
export async function readFile(file, password) {
  let head;
  try { head = JSON.parse(await file.text()); } catch { throw new Error(`« ${file.name} » n’est pas un fichier de synchronisation lisible.`); }
  if (!head || head.format !== FORMAT) throw new Error(`« ${file.name} » n’est pas un fichier de synchronisation de cette application.`);
  if (head.schemaVersion > store.SCHEMA_VERSION) throw new Error(`« ${file.name} » vient d’une version plus récente de l’application : mettez cet appareil à jour (rechargez la page).`);
  let plain;
  try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(head.iv) }, await keyFrom(password, unb64(head.kdf.salt)), unb64(head.payload))); }
  catch { throw new Error(`Mot de passe de synchronisation incorrect pour « ${file.name} » (ou fichier abîmé).`); }
  if (head.gz) plain = await gunzip(plain);
  const payload = JSON.parse(dec.decode(plain));
  if (payload.records.length !== head.counts.records) throw new Error(`« ${file.name} » est incomplet.`);
  return { head, payload };
}

const stamp = (r) => r.updatedAt || r.createdAt || '';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Calcule la fusion sans rien écrire. lastSeenAt = date de la précédente fusion avec cet appareil
 * (pour reconnaître un vrai conflit : élément modifié des deux côtés depuis).
 */
export function plan(payload, { local = store.rawRecords(), localTomb = store.getTombstones(), localSettings = store.getSettings(), haveBlobs = new Set(), lastSeenAt = '' } = {}) {
  const byId = new Map(local.map(r => [r.id, r]));
  const puts = []; const note = []; const deletes = []; let added = 0, updated = 0, conflicts = 0, keptLocal = 0;
  const tomb = payload.tombstones || {};
  for (const r of payload.records) {
    if (localTomb[r.id]) continue; // supprimé définitivement ici : ne revient pas
    const l = byId.get(r.id);
    if (!l) { puts.push(r); added++; continue; }
    if (same(l, r)) continue;
    const both = lastSeenAt && stamp(l) > lastSeenAt && stamp(r) > lastSeenAt;
    if (stamp(r) > stamp(l)) { puts.push(r); updated++; if (both) { conflicts++; note.push({ record: l, label: 'Modifié sur deux appareils : version de cet appareil écartée (plus ancienne)' }); } }
    else { keptLocal++; if (both) { conflicts++; note.push({ record: r, label: 'Modifié sur deux appareils : version de l’autre appareil écartée (plus ancienne)' }); } }
  }
  for (const id of Object.keys(tomb)) if (byId.has(id)) deletes.push(id);
  const blobs = (payload.blobs || []).filter(b => !haveBlobs.has(b.id));
  // Réglages partagés : chaque clé garde la valeur la plus récente.
  const rk = payload.keyAt || {}; const lk = localSettings._keyAt || {};
  const settingsPatch = {}; const keyAt = {};
  for (const [k, v] of Object.entries(payload.settings || {})) {
    if (DEVICE_KEYS.includes(k)) continue;
    if ((rk[k] || '') > (lk[k] || '') && !same(v, localSettings[k])) { settingsPatch[k] = v; keyAt[k] = rk[k]; }
  }
  return { puts, deletes, note, blobs, tomb, settingsPatch: Object.keys(settingsPatch).length ? settingsPatch : null, keyAt, counts: { added, updated, conflicts, keptLocal, deleted: deletes.length, files: blobs.length } };
}

/** Part des éléments du fichier déjà présents ici (0 à 1) : faible = deux contenus sans rapport (risque de doublons). */
export function overlap(payload) {
  if (!payload.records.length) return 1;
  let n = 0; for (const r of payload.records) if (store.get(r.id)) n++;
  return n / payload.records.length;
}
/** Faut-il demander « fusionner ou remplacer » ? Oui si cet appareil a ses propres données, sans rapport avec celles du fichier. */
export async function needsChoice(payload) { return hasOwnData() && overlap(payload) < 0.5 && await neverSynced(); }

/** Fusionne le contenu (déjà lu) d'un fichier d'un autre appareil dans cet appareil. */
export async function mergeParsed({ head, payload }) {
  const me = await D.identity();
  if (head.deviceId === me.id) return { head, own: true, counts: { added: 0, updated: 0, conflicts: 0, keptLocal: 0, deleted: 0, files: 0 } };
  const seen = (await D.get('seen')) || {};
  // Point commun : la dernière fusion entre les deux appareils, dans un sens ou dans l'autre.
  const base = [seen[head.deviceId]?.mergedAt || '', head.seen?.[me.id]?.mergedAt || ''].sort().at(-1);
  const p = plan(payload, { haveBlobs: await store.blobIds(), lastSeenAt: base });
  const blobs = p.blobs.map(b => ({ id: b.id, blob: new Blob([unb64(b.base64)], { type: b.mime || 'application/octet-stream' }) }));
  await store.applyExternal({ puts: p.puts, deletes: p.deletes, blobs, tomb: p.tomb, settingsPatch: p.settingsPatch, keyAt: p.keyAt, note: p.note }, `Synchronisation : ${head.deviceName}`);
  seen[head.deviceId] = { name: head.deviceName, fileAt: head.at, mergedAt: new Date().toISOString() };
  await D.set('seen', seen);
  return { head, counts: p.counts };
}
export async function mergeFile(file, password) { return mergeParsed(await readFile(file, password)); }

export function summary(c) {
  const parts = [];
  if (c.added) parts.push(`${c.added} ajouté(s)`); if (c.updated) parts.push(`${c.updated} mis à jour`);
  if (c.deleted) parts.push(`${c.deleted} supprimé(s)`); if (c.files) parts.push(`${c.files} fichier(s) joint(s)`);
  if (c.conflicts) parts.push(`${c.conflicts} modifié(s) des deux côtés : la version la plus récente est gardée, l’autre est dans l’historique`);
  return parts.length ? parts.join(', ') : 'rien de nouveau';
}

// ───── Dossier synchronisé (ordinateur : Chrome, Edge — API d'accès aux dossiers)
export const folderSupported = () => typeof window.showDirectoryPicker === 'function';
export async function chooseFolder() {
  const h = await window.showDirectoryPicker({ id: 'classeur-nuage', mode: 'readwrite' });
  await D.set('folder', h); await D.set('folderSeen', {});
  return h;
}
export async function folder() { return (await D.get('folder')) || null; }
export async function forgetFolder() { await D.del('folder'); await D.del('folderSeen'); }
export async function folderPermission(h, ask = false) {
  if (!h) return 'none';
  const opts = { mode: 'readwrite' };
  let st = await h.queryPermission?.(opts) ?? 'granted';
  if (st !== 'granted' && ask) st = await h.requestPermission(opts);
  return st;
}

/** Lit les fichiers des autres appareils présents dans le dossier, fusionne, puis écrit le fichier de cet appareil. */
export async function syncFolder(password, { onStatus } = {}) {
  const h = await folder();
  if (!h) throw new Error('Aucun dossier choisi.');
  if (await folderPermission(h, true) !== 'granted') throw new Error('Accès au dossier refusé par le navigateur.');
  const mine = await fileName();
  const fseen = (await D.get('folderSeen')) || {};
  const reports = [];
  for await (const [name, entry] of h.entries()) {
    if (entry.kind !== 'file' || !name.endsWith(EXT) || name === mine) continue;
    const f = await entry.getFile();
    if (fseen[name] === f.lastModified) continue;
    onStatus?.(`Lecture de ${name}…`);
    const parsed = await readFile(f, password);
    if (await needsChoice(parsed.payload)) throw new Error(`Cet appareil a déjà ses propres données, sans rapport avec celles de « ${parsed.head.deviceName} ». Pour éviter les doublons, utilisez une première fois « Récupérer depuis Nuage » et choisissez entre fusionner et remplacer.`);
    const r = await mergeParsed(parsed);
    fseen[name] = f.lastModified;
    if (!r.own) reports.push({ name: r.head.deviceName, at: r.head.at, counts: r.counts });
  }
  await D.set('folderSeen', fseen);
  onStatus?.('Écriture du fichier de cet appareil…');
  const out = await buildFile(password);
  const fh = await h.getFileHandle(mine, { create: true });
  const w = await fh.createWritable(); await w.write(out); await w.close();
  const at = new Date().toISOString();
  await D.set('lastSync', at);
  return { reports, at, file: mine };
}

/** Partage (téléphone, tablette) ou téléchargement du fichier de cet appareil. */
export async function sendFile(password) {
  const f = await buildFile(password);
  if (navigator.canShare?.({ files: [f] })) {
    try { await navigator.share({ files: [f], title: 'Synchronisation Classeur' }); await D.set('lastSync', new Date().toISOString()); return 'partagé'; }
    catch (e) { if (e.name === 'AbortError') return 'annulé'; }
  }
  const url = URL.createObjectURL(f); const a = document.createElement('a'); a.href = url; a.download = f.name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  await D.set('lastSync', new Date().toISOString());
  return 'téléchargé';
}

/** Premier branchement d'un appareil : remplace ses données par celles du fichier (au lieu de fusionner). */
export async function replaceFrom(file, password) { return replaceParsed(await readFile(file, password)); }
export async function replaceParsed({ head, payload }) {
  const keep = Object.fromEntries(Object.entries(store.getSettings()).filter(([k]) => DEVICE_KEYS.includes(k) && k !== '_keyAt'));
  const blobs = payload.blobs.map(b => ({ id: b.id, blob: new Blob([unb64(b.base64)], { type: b.mime || 'application/octet-stream' }) }));
  const audit = [{ at: new Date().toISOString(), author: `Synchronisation : ${head.deviceName}`, label: `Données remplacées par celles de « ${head.deviceName} »`, action: 'remplacement (synchronisation)', batch: crypto.randomUUID?.() || String(Date.now()), recordId: null, recordType: 'lot', before: null, after: { count: payload.records.length } }];
  await db.replaceAll({ records: payload.records, blobs, audit, meta: [{ key: 'schemaVersion', value: store.SCHEMA_VERSION }, { key: 'settings', value: { ...payload.settings, ...keep, _keyAt: payload.keyAt || {} } }, { key: 'tombstones', value: payload.tombstones || {} }] });
  await store.reloadFromDb();
  const seen = (await D.get('seen')) || {};
  seen[head.deviceId] = { name: head.deviceName, fileAt: head.at, mergedAt: new Date().toISOString() };
  await D.set('seen', seen);
  return { head, counts: { records: payload.records.length, files: blobs.length } };
}

/** Cet appareil a-t-il déjà des données à lui (élèves ou classes) ? */
export function hasOwnData() { return store.all('student').length + store.all('class').length > 0; }
export async function neverSynced() { const s = (await D.get('seen')) || {}; return Object.keys(s).length === 0; }

// ───── Synchronisation automatique (dossier choisi, mot de passe mémorisé, accès déjà accordé)
let autoTimer = null; let running = false;
export async function autoReady() {
  const h = await folder(); const pw = await savedPassword();
  return !!(h && pw && (await folderPermission(h)) === 'granted' && store.getSettings().syncAuto !== false);
}
export async function autoSync(notify) {
  if (running || !(await autoReady())) return null;
  running = true;
  try {
    const r = await syncFolder(await savedPassword());
    const changed = r.reports.filter(x => summary(x.counts) !== 'rien de nouveau');
    if (changed.length && notify) notify(`Synchronisé avec ${changed.map(x => `${x.name} (${summary(x.counts)})`).join(' ; ')}`);
    return r;
  } catch (e) { notify?.(`Synchronisation non faite : ${e.message}`, true); return null; }
  finally { running = false; }
}
export function startAuto(notify) {
  autoSync(notify);
  store.subscribe((evt) => {
    if (evt.kind !== 'change' || String(evt.label || '').startsWith('Synchronisation')) return;
    clearTimeout(autoTimer); autoTimer = setTimeout(() => autoSync(notify), 2 * 60 * 1000);
  });
  setInterval(() => autoSync(notify), 15 * 60 * 1000);
}
