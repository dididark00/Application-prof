// Écran projeté à widgets (esprit Digiscreen) : dispositions enregistrées, horloge à aiguilles, chronomètre.
// Les dispositions sont des réglages (synchronisés) : positions en % de l'écran, aucune donnée d'élève.
import * as store from './store.js';
import qrcode from './vendor/qrcode.mjs';

// Texte accentué (UTF-8) dans les QR codes.
qrcode.stringToBytes = (s) => Array.from(new TextEncoder().encode(s));

export const WIDGETS = [
  ['date', 'Date du jour'], ['message', 'Message'], ['programme', 'Programme du jour'], ['consigne', 'Consigne'],
  ['rituel', 'Rituels du matin'], ['tirage', 'Tirage au sort'], ['picto', 'Pictogramme'], ['feu', 'Feu du bruit'],
  ['timer', 'Timer'], ['chrono', 'Chronomètre'], ['horloge', 'Horloge'], ['groupes', 'Groupes'], ['devoirs', 'Devoirs'], ['support', 'Support'],
  ['qr', 'QR code'], ['des', 'Dés'], ['vote', 'Vote'], ['tableau', 'Tableau blanc'],
];
export const widgetLabel = (k) => WIDGETS.find(w => w[0] === k)?.[1] || k;

const it = (key, x, y, w, h, scale = 1) => ({ key, x, y, w, h, scale });
export const TEMPLATES = [
  ['vide', 'Vide', []],
  ['rituels', 'Rituels du matin', [it('rituel', 2, 3, 60, 62), it('horloge', 65, 3, 33, 50), it('tirage', 65, 56, 33, 40), it('programme', 2, 68, 60, 29, .8)]],
  ['classe', 'Travail en classe', [it('date', 2, 2, 50, 9), it('consigne', 2, 13, 64, 84), it('timer', 69, 2, 29, 44), it('picto', 69, 48, 16, 49), it('feu', 87, 48, 11, 49)]],
  ['ateliers', 'Ateliers', [it('groupes', 2, 2, 68, 95), it('timer', 72, 2, 26, 40), it('picto', 72, 44, 26, 30), it('feu', 72, 76, 26, 21)]],
];

export const layouts = () => (store.getSettings().screenLayouts || []).filter(l => l && Array.isArray(l.items));
export const layoutOf = (id) => layouts().find(l => l.id === id) || null;
export async function saveLayouts(list) { await store.setSettings({ screenLayouts: list }); }
export async function upsertLayout(l) { const list = layouts(); const i = list.findIndex(x => x.id === l.id); if (i >= 0) list[i] = l; else list.push(l); await saveLayouts(list); return l; }
export function newLayout(name, templateKey = 'vide') {
  const t = TEMPLATES.find(x => x[0] === templateKey) || TEMPLATES[0];
  return { id: store.uid(), name: name || t[1], items: t[2].map(x => ({ ...x })) };
}
/** Garde un widget dans l'écran (positions en %, taille minimale 6 %). */
export function clampItem(i) {
  const w = Math.max(6, Math.min(100, Math.round(i.w * 2) / 2)), hh = Math.max(6, Math.min(100, Math.round(i.h * 2) / 2));
  return { ...i, w, h: hh, x: Math.max(0, Math.min(100 - w, Math.round(i.x * 2) / 2)), y: Math.max(0, Math.min(100 - hh, Math.round(i.y * 2) / 2)) };
}

/** Première place libre (sans chevaucher) pour un nouveau widget, sinon en cascade. */
export function freeSpot(items, w = 28, hh = 30) {
  const hit = (x, y) => items.some(i => x < i.x + i.w && x + w > i.x && y < i.y + i.h && y + hh > i.y);
  for (let y = 2; y <= 100 - hh; y += 4) for (let x = 2; x <= 100 - w; x += 4) if (!hit(x, y)) return { x, y, w, h: hh };
  for (const [ww, h2] of [[20, 22], [14, 16]]) { const r = freeSpotStrict(items, ww, h2); if (r) return r; }
  const n = items.length % 6; return { x: 4 + n * 6, y: 4 + n * 6, w, h: hh };
}
function freeSpotStrict(items, w, hh) {
  for (let y = 1; y <= 100 - hh; y += 3) for (let x = 1; x <= 100 - w; x += 3) if (!items.some(i => x < i.x + i.w && x + w > i.x && y < i.y + i.h && y + hh > i.y)) return { x, y, w, h: hh };
  return null;
}

// ───────── Chronomètre (état partagé pupitre → écran)
export const CHRONO0 = { running: false, startedAt: null, elapsed: 0 };
export const chronoMs = (c, now = Date.now()) => !c ? 0 : (c.elapsed || 0) + (c.running && c.startedAt ? now - c.startedAt : 0);
export function chronoToggle(c = CHRONO0, now = Date.now()) { return c.running ? { running: false, startedAt: null, elapsed: chronoMs(c, now) } : { running: true, startedAt: now, elapsed: c.elapsed || 0 }; }
export function fmtChrono(ms) {
  const t = Math.floor(ms / 1000), hh = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = (n) => String(n).padStart(2, '0');
  return hh ? `${hh}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

// ───────── Horloge à aiguilles (SVG). Heure réelle ou heure fixe à lire (« 03:45 »).
export function clockTime(clock, now = new Date()) {
  if (clock?.mode === 'fixe' && /^\d{1,2}:\d{2}$/.test(clock.time || '')) { const [hh, mm] = clock.time.split(':').map(Number); return { h: hh % 24, m: mm % 60, s: 0 }; }
  return { h: now.getHours(), m: now.getMinutes(), s: now.getSeconds() };
}
export const handAngles = ({ h, m, s }) => ({ h: ((h % 12) + m / 60) * 30, m: (m + s / 60) * 6, s: s * 6 });
export function clockSvg(t, { seconds = false, minutes = true } = {}) {
  const a = handAngles(t);
  const ticks = Array.from({ length: 60 }, (_, i) => { const big = i % 5 === 0; if (!big && !minutes) return ''; const r1 = big ? 84 : 89, ang = i * 6 * Math.PI / 180;
    return `<line x1="${100 + r1 * Math.sin(ang)}" y1="${100 - r1 * Math.cos(ang)}" x2="${100 + 94 * Math.sin(ang)}" y2="${100 - 94 * Math.cos(ang)}" stroke="#222" stroke-width="${big ? 3 : 1}"/>`; }).join('');
  const nums = Array.from({ length: 12 }, (_, i) => { const n = i + 1, ang = n * 30 * Math.PI / 180;
    return `<text x="${100 + 70 * Math.sin(ang)}" y="${100 - 70 * Math.cos(ang) + 7}" text-anchor="middle" font-size="20" font-weight="700" fill="#222">${n}</text>`; }).join('');
  const mins = minutes ? Array.from({ length: 12 }, (_, i) => { const ang = i * 30 * Math.PI / 180;
    return `<text x="${100 + 104 * Math.sin(ang)}" y="${100 - 104 * Math.cos(ang) + 3.5}" text-anchor="middle" font-size="9" fill="#2f6f8f">${i * 5}</text>`; }).join('') : '';
  const hand = (ang, len, w, col, k) => `<line data-hand="${k}" data-angle="${Math.round(ang * 10) / 10}" x1="100" y1="100" x2="${100 + len * Math.sin(ang * Math.PI / 180)}" y2="${100 - len * Math.cos(ang * Math.PI / 180)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  return `<svg viewBox="-16 -16 232 232" role="img" aria-label="Horloge : ${t.h} h ${String(t.m).padStart(2, '0')}"><circle cx="100" cy="100" r="96" fill="#fff" stroke="#222" stroke-width="4"/>${ticks}${nums}${mins}`
    + `${hand(a.h, 48, 8, '#d9534f', 'h')}${hand(a.m, 78, 5, '#2f6f8f', 'm')}${seconds ? hand(a.s, 82, 1.5, '#e0a020', 's') : ''}<circle cx="100" cy="100" r="6" fill="#222"/></svg>`;
}
export const clockDigital = ({ h, m }) => `${h} h ${String(m).padStart(2, '0')}`;

// ───────── Petits outils : QR code, dés, vote
/** QR code en SVG (créé sur l'appareil, sans service en ligne). */
export function qrSvg(text) {
  if (!text) return '';
  const q = qrcode(0, 'M'); q.addData(String(text).slice(0, 1200)); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 8, scalable: true, alt: 'QR code' });
}
export const DICE_FACES = [6, 10, 20];
export function rollDice(count = 1, faces = 6, rnd = Math.random) { return Array.from({ length: Math.max(1, Math.min(6, count)) }, () => 1 + Math.floor(rnd() * faces)); }
const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]] };
/** Dé à points (6 faces) ou à chiffre. */
export function dieSvg(v, faces = 6) {
  const body = faces === 6 && PIPS[v] ? PIPS[v].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#222"/>`).join('')
    : `<text x="50" y="66" text-anchor="middle" font-size="${v > 9 ? 44 : 52}" font-weight="800" fill="#222">${v}</text>`;
  return `<svg viewBox="0 0 100 100" role="img" aria-label="Dé : ${v}"><rect x="4" y="4" width="92" height="92" rx="18" fill="#fff" stroke="#222" stroke-width="5"/>${body}</svg>`;
}
/** Options de vote : une par ligne (6 au plus), compteurs conservés quand le libellé ne change pas. */
export function voteOptions(text, prev = []) {
  return String(text || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6).map(label => ({ label, count: prev.find(o => o.label === label)?.count || 0 }));
}
