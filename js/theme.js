// Thème de couleurs et mode sombre. Le choix est enregistré dans les réglages (donc dans la
// sauvegarde) et recopié sur l'appareil pour s'appliquer dès l'ouverture, sans clignotement.
import * as store from './store.js';

export const THEMES = [
  ['pastel', 'Pastel doux', ['#fdf8f4', '#a64862', '#efe6f6']],
  ['bleu', 'Bleu frais', ['#f3f7fb', '#2b5f9e', '#e2edf8']],
  ['ecole', 'Coloré école', ['#fafafa', '#b04c14', '#fff1c9']],
  ['vert', 'Vert sapin (d’origine)', ['#f6f3ee', '#2f5d50', '#e3eee9']],
];
export const MODES = [
  ['soir', 'Automatique le soir (19 h – 7 h)'],
  ['appareil', 'Comme l’appareil'],
  ['clair', 'Toujours clair'],
  ['sombre', 'Toujours sombre'],
];
const KEY = 'classeur-theme';
const DEFAULT = { name: 'pastel', mode: 'soir' };

function cached() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
export function current() {
  let s = null; try { s = store.getSettings().theme; } catch { /* stockage pas encore prêt */ }
  return { ...DEFAULT, ...(cached() || {}), ...(s || {}) };
}
export function isDark(mode, now = new Date()) {
  if (mode === 'sombre') return true;
  if (mode === 'clair') return false;
  if (mode === 'appareil') return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const h = now.getHours(); return h >= 19 || h < 7;
}
export function apply(t = current()) {
  const root = document.documentElement;
  root.dataset.theme = THEMES.some(x => x[0] === t.name) ? t.name : DEFAULT.name;
  root.dataset.mode = isDark(t.mode) ? 'sombre' : 'clair';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg').trim() || '#fdf8f4';
  try { localStorage.setItem(KEY, JSON.stringify({ name: t.name, mode: t.mode })); } catch { /* ignoré */ }
}
export async function set(patch) {
  const t = { ...current(), ...patch };
  apply(t);
  await store.setSettings({ theme: { name: t.name, mode: t.mode } });
}
/** Applique tout de suite le thème mémorisé, puis surveille l'heure et le réglage de l'appareil. */
export function init() {
  apply();
  setInterval(() => apply(), 60_000);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => apply());
}
