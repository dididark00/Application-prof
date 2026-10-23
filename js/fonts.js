// Polices d'écriture (ex. Marelle, police cursive libre du ministère, licence OFL).
// Une police fournie avec l'application est chargée depuis /fonts ; une police importée par
// l'enseignante est enregistrée sur l'appareil (et incluse dans la sauvegarde).
import * as store from './store.js';

// Polices livrées avec l'application (fichiers dans /fonts, licence dans /fonts/OFL.txt).
// Marelle : © Ministère de l'Éducation nationale, L. Bourcellier, J. Fabreguettes, R. Wagner — SIL OFL 1.1.
// Fichiers d'origine non modifiés.
export const BUNDLED = [
  { name: 'Marelle', label: 'Marelle — attaché', file: 'fonts/Marelle-Regular.ttf' },
  { name: 'Marelle 2', label: 'Marelle 2 — attaché (variante)', file: 'fonts/Marelle2-Regular.ttf' },
  { name: 'Marelle Baton', label: 'Marelle Bâton — script', file: 'fonts/MarelleBaton-Regular.ttf' },
  { name: 'Marelle Baton 2', label: 'Marelle Bâton 2 — script (variante)', file: 'fonts/MarelleBaton2-Regular.ttf' },
  // Andika : © SIL Global — SIL OFL 1.1 (fonts/OFL-Andika.txt). Police conçue pour les lecteurs débutants :
  // « a » et « g » simples, I / l / 1 bien distincts. Fichiers web d'origine non modifiés.
  { name: 'Andika', label: 'Andika — script des débutants (maternelle, CP)', file: 'fonts/Andika-Regular.woff2' },
  { name: 'Andika Gras', label: 'Andika gras — capitales et grandes lettres', file: 'fonts/Andika-Bold.woff2' },
];
export const FALLBACKS = [['cursive', 'Cursive du système (approximative)'], ['Arial', 'Script (Arial)']];

const loaded = new Set();

export function imported() { return store.getSettings().fonts || []; }
export function available() {
  return [...BUNDLED.map(f => [f.name, f.label]), ...imported().map(f => [f.name, `${f.name} (importée)`]), ...FALLBACKS];
}

async function loadFace(name, source) {
  if (loaded.has(name)) return true;
  try { const face = new FontFace(name, source); await face.load(); document.fonts.add(face); loaded.add(name); return true; } catch { return false; }
}

/** Charge toutes les polices connues ; à appeler au démarrage. */
export async function loadAll() {
  await Promise.all(BUNDLED.map(f => loadFace(f.name, `url(${f.file})`)));
  for (const f of imported()) { const b = await store.getBlob(f.blobId); if (b) await loadFace(f.name, await b.arrayBuffer()); }
}

/** Importe un fichier de police (.ttf, .otf, .woff, .woff2). */
export async function importFont(file) {
  const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]+/g, ' ').replace(/\s*(regular|normal)$/i, '').trim() || 'Police';
  if (BUNDLED.some(f => f.name === name)) return name; // déjà fournie avec l'application
  const buf = await file.arrayBuffer();
  if (!await loadFace(name, buf)) throw new Error('Ce fichier n’est pas une police lisible par le navigateur.');
  const blobId = await store.putBlob(new Blob([buf], { type: file.type || 'font/ttf' }));
  const others = imported().filter(f => f.name !== name);
  await store.setSettings({ fonts: [...others, { name, blobId, file: file.name }] });
  return name;
}

/** Rapport hauteur des minuscules (x) / taille de police, mesuré pour aligner sur le Seyès. */
/** Hauteur des capitales rapportée à la taille de la police. */
export function capHeightRatio(name) {
  try { const c = document.createElement('canvas').getContext('2d'); c.font = `100px "${name}", cursive`; const r = (c.measureText('HEMIT').actualBoundingBoxAscent || 0) / 100; return r > 0.3 && r < 1 ? r : 0.7; } catch { return 0.7; }
}
export function xHeightRatio(name) {
  try {
    const c = document.createElement('canvas').getContext('2d');
    c.font = `100px "${name}", cursive`;
    const m = c.measureText('xvnmu');
    const r = (m.actualBoundingBoxAscent || 0) / 100;
    return r > 0.15 && r < 0.9 ? r : 0.42;
  } catch { return 0.42; }
}
