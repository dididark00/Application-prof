// Lecture du texte d'une image (OCR), entièrement sur l'appareil.
// Moteur : tesseract-wasm (Tesseract compilé en WebAssembly), modèle français « tessdata fast ».
// Les fichiers (≈ 4,7 Mo, dossier ocr/) ne sont chargés qu'à la première utilisation.
// Le moteur tourne dans un Worker ; on lui parle avec le petit protocole de messages
// qu'il comprend (celui de la bibliothèque Comlink), réimplémenté ici sans dépendance.
const BASE = new URL('../ocr/', import.meta.url);

let engine = null; // { port, ready: Promise }
let progressFn = null;

function uuid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }

/** Envoie une requête et attend la réponse portant le même identifiant. */
function request(ep, msg, transfer = []) {
  return new Promise((resolve, reject) => {
    const id = uuid();
    const onMsg = (ev) => {
      if (!ev.data || ev.data.id !== id) return;
      ep.removeEventListener('message', onMsg);
      const v = ev.data;
      if (v.type === 'HANDLER' && v.name === 'proxy') { v.value.start?.(); resolve({ port: v.value }); return; }
      if (v.type === 'HANDLER' && v.name === 'throw') { const e = v.value; reject(new Error(e?.value?.message || String(e?.value || 'Erreur du moteur de lecture'))); return; }
      resolve(v.value);
    };
    ep.addEventListener('message', onMsg);
    ep.start?.();
    ep.postMessage({ id, ...msg }, transfer);
  });
}
const call = (ep, method, args = [], transfer = []) => request(ep, { type: 'APPLY', path: [method], argumentList: args.map(value => ({ type: 'RAW', value })) }, transfer);

async function start(onStatus) {
  onStatus?.('Chargement du moteur de lecture…');
  const worker = new Worker(new URL('tesseract-worker.js', BASE));
  const { port1, port2 } = new MessageChannel();
  port1.onmessage = (e) => { if (progressFn && e.data?.progress != null) progressFn(e.data.progress); };
  const remote = await call(worker, 'createOCREngine', [{}, port2], [port2]);
  const port = remote.port;
  onStatus?.('Chargement du modèle français…');
  const model = await (await fetch(new URL('fra.traineddata', BASE))).arrayBuffer();
  await call(port, 'loadModel', [model], [model]);
  return { worker, port, progress: port1 };
}

export function isSupported() { return typeof WebAssembly === 'object' && typeof Worker === 'function' && typeof MessageChannel === 'function'; }

async function getEngine(onStatus) {
  if (!engine) engine = start(onStatus).catch((e) => { engine = null; throw e; });
  return engine;
}

/** Image (Blob/File) → ImageData redimensionnée raisonnablement (2 500 px de large au plus). */
export async function toImageData(blob, maxSide = 2500) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), hgt = Math.round(bmp.height * k);
  const c = document.createElement('canvas'); c.width = w; c.height = hgt;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hgt);
  ctx.drawImage(bmp, 0, 0, w, hgt);
  bmp.close?.();
  return ctx.getImageData(0, 0, w, hgt);
}

/**
 * Lit le texte d'une image. onStatus(texte) et onProgress(0-100) sont facultatifs.
 * Renvoie le texte brut (lignes et paragraphes conservés).
 */
export async function recognize(blob, { onStatus, onProgress } = {}) {
  const e = await getEngine(onStatus);
  onStatus?.('Préparation de l’image…');
  const img = blob instanceof ImageData ? blob : await toImageData(blob);
  await call(e.port, 'loadImage', [img]);
  onStatus?.('Lecture du texte…');
  progressFn = onProgress || null;
  try { return cleanText(await call(e.port, 'getText')); }
  finally { progressFn = null; await call(e.port, 'clearImage').catch(() => {}); }
}

/** Remet en forme le texte lu : coupures de mots en fin de ligne, espaces, lignes vides multiples. */
export function cleanText(t) {
  return String(t || '')
    .replace(/\r/g, '')
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ ([;:!?»])/g, ' $1')
    .trim();
}

export function stop() { if (engine) engine.then(e => e.worker.terminate()).catch(() => {}); engine = null; }
