// Étiquettes, affichages, titres et cartes d'ateliers : mise en page exacte en millimètres
// sur feuilles A4 (portrait ou paysage), emblèmes d'académies, charte visuelle.
import * as store from './store.js';
import * as model from './model.js';
import * as G from './groups.js';
import * as F from './fonts.js';

const NS = 'http://www.w3.org/2000/svg';
export function S(tag, attrs = {}, text) { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; }

// ───── Charte visuelle (Réglages › Charte visuelle)
export const BORDERS = [['simple', 'Trait simple'], ['double', 'Double trait'], ['pointilles', 'Pointillés'], ['arrondi', 'Coins arrondis'], ['aucun', 'Sans bordure']];
export const DEFAULT_CHARTE = { font: 'Marelle', titleFont: 'Marelle', colors: ['#a64862', '#2b5f9e', '#3f8f3f', '#e0a020', '#7a4a9a'], border: 'arrondi', borderWidth: 1, ink: '#222222' };
export function charte() { return { ...DEFAULT_CHARTE, ...(store.getSettings().charte || {}) }; }

// ───── Emblèmes (dessins simples, tracés dans un carré 100 × 100)
export const EMBLEMS = {
  etoile: { label: 'Étoile', d: 'M50 6 L62 38 L96 38 L68 58 L79 92 L50 71 L21 92 L32 58 L4 38 L38 38 Z' },
  coeur: { label: 'Cœur', d: 'M50 90 C20 68 4 50 4 32 C4 16 16 6 30 6 C40 6 47 12 50 20 C53 12 60 6 70 6 C84 6 96 16 96 32 C96 50 80 68 50 90 Z' },
  lune: { label: 'Lune', d: 'M64 6 A44 44 0 1 0 94 70 A36 36 0 1 1 64 6 Z' },
  soleil: { label: 'Soleil', d: 'M50 28 A22 22 0 1 1 49.9 28 Z M47 2 h6 v16 h-6 Z M47 82 h6 v16 h-6 Z M2 47 h16 v6 h-16 Z M82 47 h16 v6 h-16 Z M14 18 l4 -4 l12 12 l-4 4 Z M70 74 l4 -4 l12 12 l-4 4 Z M82 14 l4 4 l-12 12 l-4 -4 Z M26 70 l4 4 l-12 12 l-4 -4 Z' },
  feuille: { label: 'Feuille', d: 'M88 8 C40 8 10 34 12 70 C12 80 16 88 20 92 L24 88 C22 84 20 78 22 72 C42 76 84 60 88 8 Z' },
  flamme: { label: 'Flamme', d: 'M50 96 C26 96 14 80 14 62 C14 42 30 34 34 14 C44 24 46 36 44 46 C52 40 56 30 54 18 C74 32 86 48 86 64 C86 82 72 96 50 96 Z' },
  goutte: { label: 'Goutte', d: 'M50 4 C66 30 84 48 84 66 A34 34 0 0 1 16 66 C16 48 34 30 50 4 Z' },
  eclair: { label: 'Éclair', d: 'M58 2 L18 56 L46 56 L36 98 L82 38 L54 38 Z' },
  couronne: { label: 'Couronne', d: 'M8 80 L4 24 L28 48 L50 14 L72 48 L96 24 L92 80 Z M8 86 h84 v8 h-84 Z' },
  bouclier: { label: 'Bouclier', d: 'M50 4 L90 16 C90 54 76 80 50 96 C24 80 10 54 10 16 Z' },
  montagne: { label: 'Montagne', d: 'M2 92 L36 30 L50 52 L64 22 L98 92 Z' },
  vague: { label: 'Vague', d: 'M2 60 C14 40 30 40 40 54 C50 68 66 68 76 52 C84 40 94 40 98 46 L98 96 L2 96 Z' },
  flocon: { label: 'Flocon', d: 'M47 2 h6 v96 h-6 Z M2 47 h96 v6 h-96 Z M14 18 l4 -4 l68 68 l-4 4 Z M82 14 l4 4 l-68 68 l-4 -4 Z' },
  ancre: { label: 'Ancre', d: 'M46 6 h8 v10 h-8 Z M50 4 A9 9 0 1 1 49.9 4 Z M46 22 h8 v64 h-8 Z M30 34 h40 v7 h-40 Z M10 58 C10 82 30 94 50 94 C70 94 90 82 90 58 L80 62 C78 78 66 86 50 86 C34 86 22 78 20 62 Z' },
};
export function emblemNode(emblem, x, y, size, color, imageUrl = null) {
  if (!emblem) return null;
  if (emblem.kind === 'image' && imageUrl) return S('image', { href: imageUrl, x, y, width: size, height: size, preserveAspectRatio: 'xMidYMid meet' });
  const def = EMBLEMS[emblem.key];
  if (!def) return null;
  const g = S('g', { transform: `translate(${x} ${y}) scale(${size / 100})` });
  g.append(S('path', { d: def.d, fill: color || '#444', 'fill-rule': 'evenodd' }));
  return g;
}

// ───── Académies de la classe = ensembles de groupes de type « académies »
export function academySet(classId) { return G.setsOf(classId).find(s => s.kind === 'académies') || null; }
export function academyOf(classId, studentId) {
  const set = academySet(classId);
  const g = set?.groups?.find(x => (x.memberIds || []).includes(studentId));
  return g ? { id: g.id, name: g.name, color: g.color, emblem: g.emblem || null } : null;
}

// ───── Formats (dimensions réelles en mm)
export const FORMATS = [
  { id: '70x37', label: '70 × 37 mm — planche de 24 (3 × 8)', w: 70, h: 37, margin: 0, gap: 0 },
  { id: '63x38', label: '63,5 × 38,1 mm — planche de 21 (3 × 7)', w: 63.5, h: 38.1, margin: 7, gap: 2.5 },
  { id: '99x38', label: '99,1 × 38,1 mm — planche de 14, étiquettes de cahier', w: 99.1, h: 38.1, margin: 4.5, gap: 2 },
  { id: '105x74', label: '105 × 74 mm — porte-manteaux (A7, 8 par A4)', w: 105, h: 74, margin: 0, gap: 0 },
  { id: '148x105', label: '148 × 105 mm — A6, cartes d’ateliers (4 par A4)', w: 148, h: 105, margin: 0, gap: 0 },
  { id: 'a4p', label: '210 × 297 mm — affichage A4 portrait', w: 210, h: 297, margin: 0, gap: 0 },
  { id: 'a4l', label: '297 × 210 mm — titre A4 paysage', w: 297, h: 210, margin: 0, gap: 0 },
  { id: 'custom', label: 'Dimensions personnalisées', w: 80, h: 50, margin: 8, gap: 4 },
];

/** Grille sur A4 : orientation choisie pour maximiser le nombre d'étiquettes. */
export function layout(fmt) {
  const w = Number(fmt.w), h = Number(fmt.h), m = Math.max(0, Number(fmt.margin ?? 8)), gap = Math.max(0, Number(fmt.gap ?? 4));
  const fit = (pw, ph) => {
    const mm = w >= pw - 0.01 || h >= ph - 0.01 ? 0 : m; // pleine page : pas de marge
    const gg = mm ? gap : 0;
    const cols = Math.floor((pw - 2 * mm + gg) / (w + gg)), rows = Math.floor((ph - 2 * mm + gg) / (h + gg));
    return { pw, ph, cols: Math.max(0, cols), rows: Math.max(0, rows), margin: mm, gap: gg };
  };
  const p = fit(210, 297), l = fit(297, 210);
  const best = (l.cols * l.rows > p.cols * p.rows) ? l : p;
  const perPage = best.cols * best.rows;
  // Centrage de la grille sur la page.
  const usedW = best.cols * w + (best.cols - 1) * best.gap, usedH = best.rows * h + (best.rows - 1) * best.gap;
  return { ...best, w, h, perPage, ox: (best.pw - usedW) / 2, oy: (best.ph - usedH) / 2, landscape: best === l };
}

/** Mesure du texte (pour 1 mm de police) : largeur, hauteur au-dessus et au-dessous de la ligne de base. */
export function measure(text, font) {
  try {
    // Police pas encore chargée : on la charge pour les prochains dessins ; fitTexts() corrige ensuite à l'écran.
    try { if (document.fonts && !document.fonts.check(`20px ${F.family(font)}`)) document.fonts.load(`20px ${F.family(font)}`); } catch { /* */ }
    const fam = String(font).includes(',') ? font : F.family(font);
    const key = `${fam}|${text}|${document.fonts?.check?.(`20px ${fam}`) ? 1 : 0}`;
    if (MEASURES.has(key)) return MEASURES.get(key);
    // Mesure au pixel près : certaines polices d'écriture (Marelle) annoncent des dimensions fausses,
    // leurs boucles montent bien au-dessus. On dessine le mot et on cherche les pixels réellement encrés.
    const S = 40, W = Math.ceil(S * Math.max(4, String(text).length * 1.6)), H = S * 5, BASE = S * 3;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.font = `${S}px ${fam}`; c.textBaseline = 'alphabetic';
    const width = c.measureText(text || ' ').width / S;
    c.fillText(text || ' ', 4, BASE);
    const d = c.getImageData(0, 0, W, H).data;
    let top = BASE, bot = BASE;
    for (let y = 0; y < H; y++) { const row = y * W * 4; for (let x = 3; x < W * 4; x += 4) if (d[row + x] > 16) { if (y < top) top = y; if (y > bot) bot = y; break; } }
    const r = { w: width, asc: Math.max(0.3, (BASE - top) / S), desc: Math.max(0, (bot - BASE) / S) };
    MEASURES.set(key, r);
    return r;
  } catch { return { w: 0, asc: 0.72, desc: 0.2 }; }
}
const MEASURES = new Map();
/** Taille de police (mm) pour que le texte tienne dans la largeur ET la hauteur données (les écritures attachées ont de grandes boucles). */
export function fitSize(text, font, maxW, maxSize, maxH = Infinity) {
  const m = measure(text, font);
  const byW = m.w ? (maxW * 0.97) / m.w : maxSize;
  const byH = (m.asc + m.desc) ? maxH / (m.asc + m.desc) : maxSize;
  return Math.max(2, Math.min(maxSize, byW, byH));
}

/** Dessine une étiquette (coordonnées mm) dans le groupe g. */
export function drawLabel(g, item, w, h, style, urls = {}) {
  const ch = charte();
  const color = item.color || style.color || ch.colors[0];
  const font = style.font || ch.font;
  const border = style.border || ch.border;
  const bw = Number(style.borderWidth ?? ch.borderWidth) || 1;
  const bwIn = border === 'aucun' ? 0 : border === 'double' ? (Number(style.borderWidth ?? ch.borderWidth) || 1) * 3.2 + 0.5 : (Number(style.borderWidth ?? ch.borderWidth) || 1) + 0.5;
  const pad = Math.max(Math.min(w, h) * 0.08, bwIn + 1);
  if (style.fill) g.append(S('rect', { x: 0, y: 0, width: w, height: h, fill: mixLight(color), rx: border === 'arrondi' ? 4 : 0 }));
  if (border !== 'aucun') {
    const r = border === 'arrondi' ? Math.min(6, Math.min(w, h) * 0.12) : 0;
    g.append(S('rect', { x: bw / 2 + 0.5, y: bw / 2 + 0.5, width: w - bw - 1, height: h - bw - 1, rx: r, fill: 'none', stroke: color, 'stroke-width': bw, 'stroke-dasharray': border === 'pointilles' ? `${bw * 2} ${bw * 1.5}` : null }));
    if (border === 'double') g.append(S('rect', { x: bw * 2.5 + 0.5, y: bw * 2.5 + 0.5, width: w - bw * 5 - 1, height: h - bw * 5 - 1, fill: 'none', stroke: color, 'stroke-width': bw * 0.6 }));
  }
  if (style.cutMarks) g.append(S('rect', { x: 0, y: 0, width: w, height: h, fill: 'none', stroke: '#bbb', 'stroke-width': 0.15, 'stroke-dasharray': '1 1', class: 'cut' }));
  const emSize = item.emblem ? Math.min(h - 2 * pad, w * 0.28) : 0;
  const tx = pad + (emSize ? emSize + pad * 0.6 : 0);
  if (item.emblem) { const n = emblemNode(item.emblem, pad, (h - emSize) / 2, emSize, color, urls[item.emblem.blobId]); if (n) g.append(n); }
  const lines = [item.line1, item.line2, item.line3].filter(x => x != null && String(x).trim() !== '');
  const availW = w - tx - pad, availH = h - 2 * pad;
  const ratios = lines.length === 1 ? [1] : lines.length === 2 ? [0.62, 0.38] : [0.5, 0.27, 0.23];
  let y = pad;
  const cx = item.emblem ? tx + availW / 2 : w / 2;
  lines.forEach((t, i) => {
    const f = i === 0 ? font : style.font2 || font;
    const lh = availH * ratios[i];
    const maxSize = lh * (i === 0 ? 0.78 : 0.7);
    // Hauteur réelle des lettres (boucles, jambages) : elles restent dans leur bande, sans toucher le cadre ni la ligne voisine.
    const size = fitSize(String(t), f, availW, maxSize, lh * 0.94);
    const m = measure(String(t), f);
    const base = y + (lh - (m.asc + m.desc) * size) / 2 + m.asc * size;
    g.append(S('text', { x: cx, y: base, 'font-size': size, 'font-family': F.family(f), 'text-anchor': 'middle', fill: i === 0 ? (style.ink || ch.ink) : '#444', 'data-line': i, 'data-maxw': availW, 'data-band': `${y} ${lh}` }, String(t)));
    y += lh;
  });
}
/** Une fois les étiquettes affichées : réduit tout texte qui déborde encore (mesure réelle, police chargée). */
export function fitTexts(root) {
  for (const t of root.querySelectorAll('text[data-maxw]')) {
    let w = 0, bb = null; try { w = t.getComputedTextLength(); bb = t.getBBox(); } catch { continue; }
    if (!w) continue; // pas encore affiché
    const max = Number(t.getAttribute('data-maxw'));
    const [top, lh] = (t.getAttribute('data-band') || '').split(' ').map(Number);
    let fs = Number(t.getAttribute('font-size'));
    // Mesure réelle, police chargée : largeur, puis hauteur de la bande.
    const m = measure(t.textContent, t.getAttribute('font-family'));
    let nfs = fs;
    if (w > max * 0.97) nfs = fs * (max * 0.97 / w);
    if (lh && (m.asc + m.desc) * nfs > lh * 0.94) nfs = (lh * 0.94) / (m.asc + m.desc);
    if (nfs !== fs || (lh && bb && (bb.y < top - 0.01 || bb.y + bb.height > top + lh + 0.01))) {
      t.setAttribute('font-size', nfs);
      if (lh) t.setAttribute('y', top + (lh - (m.asc + m.desc) * nfs) / 2 + m.asc * nfs);
    }
  }
}
/** Réajuste maintenant puis quand les polices ont fini de se charger. */
export function fitWhenReady(root) {
  requestAnimationFrame(() => fitTexts(root));
  try { document.fonts?.ready.then(() => fitTexts(root)); } catch { /* */ }
}
function mixLight(hex) { const m = String(hex).replace('#', ''); const c = [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16) || 0).map(v => Math.round(v + (255 - v) * 0.85)); return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`; }

/** Pages SVG (A4, mm) pour une série d'étiquettes. */
export function pages(items, fmt, style, urls = {}) {
  const L = layout(fmt);
  if (!L.perPage) return [];
  const out = [];
  for (let start = 0; start < items.length; start += L.perPage) {
    const svg = S('svg', { xmlns: NS, viewBox: `0 0 ${L.pw} ${L.ph}`, width: `${L.pw}mm`, height: `${L.ph}mm`, class: 'label-page', 'data-orientation': L.landscape ? 'landscape' : 'portrait' });
    svg.append(S('rect', { x: 0, y: 0, width: L.pw, height: L.ph, fill: '#fff' }));
    items.slice(start, start + L.perPage).forEach((it, k) => {
      const col = k % L.cols, row = Math.floor(k / L.cols);
      const g = S('g', { transform: `translate(${L.ox + col * (L.w + L.gap)} ${L.oy + row * (L.h + L.gap)})`, 'data-testid': 'label' });
      drawLabel(g, it, L.w, L.h, style, urls);
      svg.append(g);
    });
    out.push(svg);
  }
  return out;
}

/** URLs temporaires des images (emblèmes importés) pour l'aperçu et l'impression. */
export async function imageUrls(items) {
  const ids = [...new Set(items.map(i => i.emblem?.kind === 'image' ? i.emblem.blobId : null).filter(Boolean))];
  const out = {};
  for (const id of ids) {
    const b = await store.getBlob(id);
    if (b) out[id] = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
  }
  return out;
}

/** Éléments d'une série « élèves » pour une classe (avec académie si elle existe). */
export function studentItems(classId, opts = {}) {
  return model.studentsOfClass(classId).map(({ student: s }) => {
    const a = opts.academy !== false ? academyOf(classId, s.id) : null;
    return { studentId: s.id, line1: s.firstName, line2: opts.lastName ? s.lastName : (opts.academyName && a ? a.name : ''), line3: opts.lastName && opts.academyName && a ? a.name : '',
      color: a?.color || null, emblem: a?.emblem || null, academyId: a?.id || null };
  }).sort((x, y) => x.line1.localeCompare(y.line1, 'fr'));
}

void F;
