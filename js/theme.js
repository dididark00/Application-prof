// Thème de couleurs et mode sombre. Le choix est enregistré dans les réglages (donc dans la
// sauvegarde) et recopié sur l'appareil pour s'appliquer dès l'ouverture, sans clignotement.
import * as store from './store.js';

export const THEMES = [
  ['pastel', 'Pastel doux', ['#fdf8f4', '#a64862', '#efe6f6']],
  ['bleu', 'Bleu frais', ['#f3f7fb', '#2b5f9e', '#e2edf8']],
  ['ecole', 'Coloré école', ['#fafafa', '#b04c14', '#fff1c9']],
  ['vert', 'Vert sapin (d’origine)', ['#f6f3ee', '#2f5d50', '#e3eee9']],
  ['perso', 'Mes couleurs', null],
];
export const DEFAULT_CUSTOM = { accent: '#7b5ea7', menu: '#f3e3c3', fond: '#fbf8f2' };

// ───── Petits calculs de couleurs (pour le thème « Mes couleurs »)
const hex = (c) => { const m = String(c).replace('#', ''); return [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16) || 0); };
const toHex = (a) => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
function lum(c) { return hex(c).map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); }
export function contrast(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => p - q); return (y + 0.05) / (x + 0.05); }
/** Assombrit (ou éclaircit) une couleur jusqu'à un contraste lisible sur le fond donné. */
function readable(c, on, target = 4.5, toward = '#000000') { let out = c; for (let i = 0; i < 20 && contrast(out, on) < target; i++) out = mix(out, toward, 0.08); return out; }

/** Variables CSS dérivées des 3 couleurs choisies, en clair et en sombre. */
export function customVars(c, dark) {
  const { accent, menu, fond } = { ...DEFAULT_CUSTOM, ...(c || {}) };
  if (!dark) {
    const a = readable(accent, '#ffffff');
    return {
      '--bg': fond, '--surface-2': mix(fond, '#ffffff', 0.4), '--ink': mix('#000000', a, 0.15), '--ink-2': readable(mix('#666666', a, 0.15), fond),
      '--line': mix(fond, '#000000', 0.09), '--line-soft': mix(fond, '#000000', 0.05), '--line-strong': mix(fond, '#000000', 0.18), '--input-line': mix(fond, '#000000', 0.14),
      '--accent': a, '--accent-hover': mix(a, '#000000', 0.15), '--accent-ink': '#ffffff', '--accent-soft': mix(a, '#ffffff', 0.86),
      '--nav-active': menu, '--focus': mix(a, '#ffffff', 0.4), '--topbar-bg': fond + 'f0', '--toast-bg': mix(a, '#1a1a1a', 0.75), '--preview-bg': mix(fond, '#000000', 0.07),
    };
  }
  const bg = mix(accent, '#141216', 0.88), surf = mix(accent, '#1e1b21', 0.84);
  const a = readable(mix(accent, '#ffffff', 0.35), surf, 4.5, '#ffffff');
  return {
    '--bg': bg, '--surface': surf, '--surface-2': mix(surf, '#ffffff', 0.05), '--ink': '#f1edf2', '--ink-2': '#b9b1bc',
    '--line': mix(surf, '#ffffff', 0.14), '--line-soft': mix(surf, '#ffffff', 0.09), '--line-strong': mix(surf, '#ffffff', 0.24), '--input-line': mix(surf, '#ffffff', 0.2),
    '--accent': a, '--accent-hover': mix(a, '#ffffff', 0.15), '--accent-ink': mix(accent, '#000000', 0.8), '--accent-soft': mix(accent, surf, 0.7),
    '--nav-active': mix(menu, surf, 0.78), '--focus': a, '--topbar-bg': bg + 'f0', '--toast-bg': mix(surf, '#ffffff', 0.12), '--preview-bg': mix(surf, '#ffffff', 0.08),
  };
}
export const MODES = [
  ['soir', 'Automatique le soir (19 h – 7 h)'],
  ['appareil', 'Comme l’appareil'],
  ['clair', 'Toujours clair'],
  ['sombre', 'Toujours sombre'],
];
const KEY = 'classeur-theme';
const DEFAULT = { name: 'pastel', mode: 'soir', custom: null };

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
  const dark = isDark(t.mode);
  root.dataset.mode = dark ? 'sombre' : 'clair';
  root.removeAttribute('style');
  if (t.name === 'perso') for (const [k, v] of Object.entries(customVars(t.custom, dark))) root.style.setProperty(k, v);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg').trim() || '#fdf8f4';
  try { localStorage.setItem(KEY, JSON.stringify({ name: t.name, mode: t.mode, custom: t.custom })); } catch { /* ignoré */ }
}
export async function set(patch) {
  const t = { ...current(), ...patch };
  apply(t);
  await store.setSettings({ theme: { name: t.name, mode: t.mode, custom: t.custom } });
}
/** Applique tout de suite le thème mémorisé, puis surveille l'heure et le réglage de l'appareil. */
export function init() {
  apply();
  setInterval(() => apply(), 60_000);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => apply());
}
