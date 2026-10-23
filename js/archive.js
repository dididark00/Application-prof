// Archivage d'une année terminée : tout ce qui appartient à l'année part dans un fichier
// (chiffré si un mot de passe est donné), vérifié, puis retiré de l'appareil pour libérer la place.
// L'archive se consulte ensuite en lecture seule (élèves, bilans, résultats, cahier journal) sans rien réimporter.
// Restent toujours dans l'application : référentiels, manuels, bibliothèque, contacts, fichiers et dossiers,
// modèles de l'atelier, réglages, comptes de la coopérative reportés, et les élèves encore inscrits ailleurs.
import * as store from './store.js';
import * as db from './db.js';
import { APP_VERSION } from './backup.js';

export const FORMAT = 'classeur-archive';
const SHARED = new Set(['referential', 'manual', 'book', 'contact', 'folder', 'file', 'inbox', 'material', 'matmove', 'game', 'labelset', 'epsdiagram', 'slideshow', 'recreplan', 'year']);
const DATED_PERSONAL = new Set(['event', 'task']);
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => { const bin = atob(s); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; };
async function sha256(bytes) { const d = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function keyFrom(pw, salt) { const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 250000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }

export function blobIdsOf(r) {
  const ids = [];
  if (r.blobId) ids.push(r.blobId);
  if (r.photoBlobId) ids.push(r.photoBlobId);
  for (const v of r.versions || []) if (v.blobId) ids.push(v.blobId);
  for (const p of r.photos || []) if (p.blobId) ids.push(p.blobId);
  return ids;
}

/** Ensemble des éléments qui appartiennent à l'année (et à elle seule). */
export function yearMembers(yearId, all = store.rawRecords()) {
  const year = all.find(r => r.id === yearId);
  if (!year) return { ids: new Set(), kept: [] };
  const inRange = (d) => d && d >= year.start && d <= year.end;
  const classes = new Set(all.filter(r => r.type === 'class' && r.yearId === yearId).map(r => r.id));
  const enrolls = all.filter(r => r.type === 'enrollment');
  const otherClasses = new Set(all.filter(r => r.type === 'class' && r.yearId !== yearId).map(r => r.id));
  const students = new Set(), sharedStudents = new Set();
  for (const s of all.filter(r => r.type === 'student')) {
    const mine = enrolls.filter(e => e.studentId === s.id);
    if (mine.length && mine.every(e => classes.has(e.classId))) students.add(s.id);
    else if (mine.some(e => classes.has(e.classId)) && mine.some(e => otherClasses.has(e.classId))) sharedStudents.add(s.id);
  }
  const ids = new Set([yearId, ...classes, ...students]);
  const kept = [];
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of all) {
      if (ids.has(r.id)) continue;
      let take = false;
      if (r.type === 'year') continue;
      if (r.type === 'file') take = (r.studentIds || []).length > 0 && r.studentIds.every(id => students.has(id)); // photos, justificatifs des seuls élèves de l'année
      else if (SHARED.has(r.type)) take = false;
      else if (r.type === 'account') take = r.yearId === yearId && !all.some(a => a.type === 'account' && a.opening?.fromAccountId === r.id);
      else if (DATED_PERSONAL.has(r.type)) take = classes.has(r.classId) || (r.type === 'event' ? inRange(r.date) && (r.endDate || r.date) <= year.end : r.done && inRange(r.due));
      else if (r.yearId === yearId || classes.has(r.classId)) take = true;
      else if (r.studentId && students.has(r.studentId)) take = r.type !== 'loan' || !!r.returnedAt;
      else if (r.studentId && sharedStudents.has(r.studentId)) take = r.yearId === yearId || inRange(r.date);
      else {
        for (const [k, v] of Object.entries(r)) if (k !== 'id' && k.endsWith('Id') && typeof v === 'string' && ids.has(v) && !SHARED.has(r.type)) { take = true; break; }
      }
      if (take) { ids.add(r.id); grew = true; }
    }
  }
  const openLoans = all.filter(r => r.type === 'loan' && !r.returnedAt && students.has(r.studentId));
  if (openLoans.length) kept.push(`${openLoans.length} prêt(s) de livre non rendu(s) : restent dans l’application`);
  if (sharedStudents.size) kept.push(`${sharedStudents.size} élève(s) inscrit(s) aussi dans une autre année : leur fiche reste, seules les données de cette année partent`);
  return { ids, kept, students, classes };
}

/** Aperçu : nombre d'éléments par type, nombre de fichiers joints et taille estimée. */
export async function preview(yearId) {
  const all = store.rawRecords();
  const m = yearMembers(yearId, all);
  const recs = all.filter(r => m.ids.has(r.id));
  const keptRecs = all.filter(r => !m.ids.has(r.id));
  const stillUsed = new Set(keptRecs.flatMap(blobIdsOf));
  const blobIds = [...new Set(recs.flatMap(blobIdsOf))].filter(id => !stillUsed.has(id));
  let bytes = enc.encode(JSON.stringify(recs)).length;
  for (const id of blobIds) { const b = await db.get('blobs', id); if (b) bytes += b.blob.size; }
  const byType = {}; for (const r of recs) byType[r.type] = (byType[r.type] || 0) + 1;
  return { records: recs, blobIds, bytes, byType, kept: m.kept, students: m.students.size };
}

/** Construit le fichier d'archive. Mot de passe facultatif (chiffrement AES-256). */
export async function build(yearId, password = '') {
  const year = store.get(yearId);
  const p = await preview(yearId);
  const blobs = [];
  for (const id of p.blobIds) { const b = await db.get('blobs', id); if (b) blobs.push({ id, mime: b.blob.type, size: b.blob.size, base64: b64(await b.blob.arrayBuffer()) }); }
  const payload = enc.encode(JSON.stringify({ records: p.records, blobs }));
  const head = { format: FORMAT, appVersion: APP_VERSION, schemaVersion: store.SCHEMA_VERSION, yearId, yearLabel: year.label, start: year.start, end: year.end, at: new Date().toISOString(), counts: { records: p.records.length, blobs: blobs.length }, checksum: await sha256(payload) };
  let body;
  if (password) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    body = { ...head, encrypted: true, salt: b64(salt), iv: b64(iv), payload: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(password, salt), payload)) };
  } else body = { ...head, encrypted: false, payload: dec.decode(payload) };
  const name = `archive-classeur-${String(year.label).replace(/[^\w-]+/g, '-')}.json`;
  return { file: new File([JSON.stringify(body)], name, { type: 'application/json' }), head, preview: p };
}

/** Lit et vérifie une archive (empreinte et nombres d'éléments). */
export async function read(file, password = '') {
  let body; try { body = JSON.parse(await file.text()); } catch { throw new Error('Ce fichier n’est pas une archive lisible.'); }
  if (body?.format !== FORMAT) throw new Error('Ce fichier n’est pas une archive d’année de cette application.');
  let bytes;
  if (body.encrypted) {
    if (!password) throw new Error('Cette archive est protégée : indiquez son mot de passe.');
    try { bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(body.iv) }, await keyFrom(password, unb64(body.salt)), unb64(body.payload))); }
    catch { throw new Error('Mot de passe incorrect (ou fichier abîmé).'); }
  } else bytes = enc.encode(body.payload);
  if (await sha256(bytes) !== body.checksum) throw new Error('L’archive est abîmée ou incomplète (empreinte de contrôle différente).');
  const data = JSON.parse(dec.decode(bytes));
  if (data.records.length !== body.counts.records || data.blobs.length !== body.counts.blobs) throw new Error('Le nombre d’éléments ne correspond pas à l’en-tête de l’archive.');
  return { head: body, data };
}

/** Retire l'année de l'appareil, seulement si l'archive relue contient bien tout. */
export async function removeYear(yearId, verified) {
  const p = await preview(yearId);
  const inArchive = new Set(verified.data.records.map(r => r.id));
  const missing = p.records.filter(r => !inArchive.has(r.id) || JSON.stringify(verified.data.records.find(x => x.id === r.id)) !== JSON.stringify(r));
  if (missing.length) throw new Error(`${missing.length} élément(s) ont changé depuis la création de l’archive : refaites l’archive avant de retirer l’année.`);
  const blobsIn = new Set(verified.data.blobs.map(b => b.id));
  if (p.blobIds.some(id => !blobsIn.has(id))) throw new Error('Des fichiers joints manquent dans l’archive : refaites-la.');
  const ids = new Set(p.records.map(r => r.id));
  const n = await store.purgeWhere(r => ids.has(r.id), `Année ${verified.head.yearLabel} archivée dans un fichier et retirée de l’appareil`);
  const s = store.getSettings();
  if (ids.has(s.currentYearId) || ids.has(s.currentClassId)) await store.setSettings({ currentYearId: null, currentClassId: null });
  return n;
}
