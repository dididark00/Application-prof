// Sauvegarde complète (données + fichiers + historique) et restauration vérifiée.
import * as db from './db.js';
import * as store from './store.js';

export const FORMAT = 'classeur-sauvegarde';
export const APP_VERSION = '0.5.12';

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin);
}
function b64ToBlob(b64, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}
async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function buildBackup() {
  const [records, blobs, audit, meta] = await Promise.all([db.getAll('records'), db.getAll('blobs'), db.getAll('audit'), db.getAll('meta')]);
  const blobsOut = [];
  for (const b of blobs) blobsOut.push({ id: b.id, mime: b.blob.type, size: b.blob.size, base64: bufToB64(await b.blob.arrayBuffer()) });
  const data = { records, blobs: blobsOut, audit, meta };
  const json = JSON.stringify(data);
  return {
    format: FORMAT,
    schemaVersion: store.SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: { records: records.length, blobs: blobsOut.length, audit: audit.length },
    checksum: await sha256(json),
    dataJson: json,
  };
}

export function backupFilename(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `sauvegarde-classeur-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}h${p(d.getMinutes())}.json`;
}

/** Lit et vérifie un fichier de sauvegarde sans rien modifier. */
export async function readBackup(file) {
  let obj;
  try { obj = JSON.parse(await file.text()); } catch { throw new Error('Ce fichier n’est pas une sauvegarde lisible (JSON invalide).'); }
  if (!obj || obj.format !== FORMAT) throw new Error('Ce fichier n’est pas une sauvegarde de cette application.');
  if (typeof obj.schemaVersion !== 'number') throw new Error('Version de sauvegarde inconnue.');
  if (obj.schemaVersion > store.SCHEMA_VERSION) throw new Error(`Cette sauvegarde provient d’une version plus récente de l’application (format ${obj.schemaVersion}). Mettez l’application à jour avant de la restaurer.`);
  if (typeof obj.dataJson !== 'string') throw new Error('Sauvegarde incomplète : données absentes.');
  const sum = await sha256(obj.dataJson);
  if (sum !== obj.checksum) throw new Error('La sauvegarde est altérée ou incomplète (empreinte de contrôle différente). Restauration refusée.');
  const data = JSON.parse(obj.dataJson);
  const counts = { records: data.records.length, blobs: data.blobs.length, audit: data.audit.length };
  if (counts.records !== obj.counts.records || counts.blobs !== obj.counts.blobs) throw new Error('Le nombre d’éléments ne correspond pas à l’en-tête de la sauvegarde.');
  const byType = {};
  for (const r of data.records) if (!r.deletedAt) byType[r.type] = (byType[r.type] || 0) + 1;
  return { header: obj, data: migrate(data, obj.schemaVersion), counts, byType };
}

/** Migrations des anciens formats (aucune pour l'instant : format 1). */
function migrate(data, fromVersion) {
  if (fromVersion === store.SCHEMA_VERSION) return data;
  return data;
}

/** Remplace toutes les données par la sauvegarde, puis vérifie le résultat. */
export async function restoreBackup(parsed) {
  const { data } = parsed;
  const blobs = data.blobs.map(b => ({ id: b.id, blob: b64ToBlob(b.base64, b.mime) }));
  const meta = data.meta.filter(m => m.key !== 'schemaVersion').concat([{ key: 'schemaVersion', value: store.SCHEMA_VERSION }]);
  await db.replaceAll({ records: data.records, blobs, audit: data.audit, meta });
  const [r, b] = await Promise.all([db.getAll('records'), db.getAll('blobs')]);
  const sizesOk = data.blobs.every(x => { const got = b.find(y => y.id === x.id); return got && got.blob.size === x.size; });
  const ok = r.length === data.records.length && b.length === data.blobs.length && sizesOk;
  await store.reloadFromDb();
  if (!ok) throw new Error('La vérification après restauration a échoué. Rechargez la page et réessayez avec la sauvegarde.');
  return { records: r.length, blobs: b.length };
}

export async function wipeAll() {
  await db.clearAll();
  await store.reloadFromDb();
}
