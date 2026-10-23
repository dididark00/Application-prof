// Réglages propres à CET appareil (jamais copiés dans une sauvegarde ni synchronisés) :
// identité de l'appareil, mot de passe de synchronisation mémorisé, dossier Nuage choisi, suivi des fichiers lus.
// Rangés dans une petite base IndexedDB séparée.
const NAME = 'classeur-appareil';
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}
export async function get(key) {
  const db = await open();
  return new Promise((resolve, reject) => { const q = db.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
}
export async function set(key, value) {
  const db = await open();
  return new Promise((resolve, reject) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
}
export async function del(key) {
  const db = await open();
  return new Promise((resolve, reject) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
}

function guessName() {
  const ua = navigator.userAgent || '';
  const kind = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'Tablette' : /iPhone|Android.*Mobile/i.test(ua) ? 'Téléphone' : 'Ordinateur';
  return kind;
}
/** Identité de l'appareil : créée une fois. */
export async function identity() {
  let id = await get('identity');
  if (!id) { id = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(), name: guessName() }; await set('identity', id); }
  return id;
}
export async function rename(name) { const id = await identity(); id.name = String(name || '').trim() || id.name; await set('identity', id); return id; }
