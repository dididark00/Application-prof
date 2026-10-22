// Accès bas niveau à IndexedDB. Trois magasins :
//  - records : tous les objets métier {id, type, ...}
//  - blobs   : contenu binaire des fichiers {id, blob}
//  - audit   : historique des modifications
//  - meta    : réglages et informations techniques {key, value}

export const DB_NAME = 'classeur';
export const DB_VERSION = 1;

let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('records')) {
        const s = db.createObjectStore('records', { keyPath: 'id' });
        s.createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('audit')) {
        const a = db.createObjectStore('audit', { keyPath: 'seq', autoIncrement: true });
        a.createIndex('recordId', 'recordId');
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Base bloquée : fermez les autres onglets de l’application.'));
  });
  return dbPromise;
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction annulée'));
  });
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(storeName) {
  const db = await openDb();
  return reqP(db.transaction(storeName).objectStore(storeName).getAll());
}

export async function get(storeName, key) {
  const db = await openDb();
  return reqP(db.transaction(storeName).objectStore(storeName).get(key));
}

/** Écrit atomiquement : puts = {store: [values]}, deletes = {store: [keys]} */
export async function write({ puts = {}, deletes = {} }) {
  const db = await openDb();
  const names = [...new Set([...Object.keys(puts), ...Object.keys(deletes)])];
  const tx = db.transaction(names, 'readwrite');
  for (const [name, vals] of Object.entries(puts)) for (const v of vals) tx.objectStore(name).put(v);
  for (const [name, keys] of Object.entries(deletes)) for (const k of keys) tx.objectStore(name).delete(k);
  return done(tx);
}

export async function clearAll() {
  const db = await openDb();
  const tx = db.transaction(['records', 'blobs', 'audit', 'meta'], 'readwrite');
  for (const n of ['records', 'blobs', 'audit', 'meta']) tx.objectStore(n).clear();
  return done(tx);
}

/** Remplace tout le contenu en une seule transaction (restauration). */
export async function replaceAll({ records, blobs, audit, meta }) {
  const db = await openDb();
  const tx = db.transaction(['records', 'blobs', 'audit', 'meta'], 'readwrite');
  for (const n of ['records', 'blobs', 'audit', 'meta']) tx.objectStore(n).clear();
  for (const r of records) tx.objectStore('records').put(r);
  for (const b of blobs) tx.objectStore('blobs').put(b);
  for (const a of audit) tx.objectStore('audit').put(a);
  for (const m of meta) tx.objectStore('meta').put(m);
  return done(tx);
}
