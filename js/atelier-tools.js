// Outils spécialisés de l'Atelier : géométrie (quadrillages, symétrie, reproduction,
// figures, angles) et cartes (planisphère, continents, France) à partir de données sourcées.
// Tout est dessiné en millimètres sur une page A4 ; tracés exacts, version corrigée séparée.
const NS = 'http://www.w3.org/2000/svg';
export function S(tag, attrs = {}, text) { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; }
export const PAGE = { w: 210, h: 297 };
export function page(title, landscape = false) {
  const w = landscape ? PAGE.h : PAGE.w, hh = landscape ? PAGE.w : PAGE.h;
  const svg = S('svg', { xmlns: NS, viewBox: `0 0 ${w} ${hh}`, width: `${w}mm`, height: `${hh}mm`, class: 'atelier-page', 'font-family': 'Arial, Helvetica, sans-serif', 'data-landscape': landscape ? '1' : null });
  svg.append(S('rect', { x: 0, y: 0, width: w, height: hh, fill: '#fff' }));
  if (title) svg.append(S('text', { x: 15, y: 16, 'font-size': 6, 'font-weight': 700 }, title));
  return svg;
}
const RED = '#c0392b';

/** Générateur pseudo-aléatoire reproductible (même numéro = même fiche). */
export function rng(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));

// ───────── Quadrillages
export function quadrillage(o, title) {
  const svg = page(title);
  const x0 = 15, y0 = 24, x1 = PAGE.w - 15, y1 = PAGE.h - 12;
  const p = Math.max(1, Number(o.pas) || 5);
  const c = o.couleur || '#7a9cc6';
  const g = S('g', { 'data-testid': 'grid' });
  if (o.type === 'millimétré') {
    for (let x = x0, i = 0; x <= x1 + 0.01; x += 1, i++) g.append(S('line', { x1: x, x2: x, y1: y0, y2: y1, stroke: c, 'stroke-width': i % 10 === 0 ? 0.3 : i % 5 === 0 ? 0.18 : 0.06 }));
    for (let y = y0, i = 0; y <= y1 + 0.01; y += 1, i++) g.append(S('line', { x1: x0, x2: x1, y1: y, y2: y, stroke: c, 'stroke-width': i % 10 === 0 ? 0.3 : i % 5 === 0 ? 0.18 : 0.06 }));
  } else if (o.type === 'points') {
    for (let y = y0; y <= y1 + 0.01; y += p) for (let x = x0; x <= x1 + 0.01; x += p) g.append(S('circle', { cx: x, cy: y, r: 0.35, fill: c }));
  } else if (o.type === 'isométrique') {
    const dy = p * Math.sqrt(3) / 2;
    for (let j = 0, y = y0; y <= y1 + 0.01; j++, y += dy) for (let x = x0 + (j % 2 ? p / 2 : 0); x <= x1 + 0.01; x += p) g.append(S('circle', { cx: x, cy: y, r: 0.35, fill: c }));
  } else {
    for (let x = x0; x <= x1 + 0.01; x += p) g.append(S('line', { x1: x, x2: x, y1: y0, y2: y1, stroke: c, 'stroke-width': 0.15 }));
    for (let y = y0; y <= y1 + 0.01; y += p) g.append(S('line', { x1: x0, x2: x1, y1: y, y2: y, stroke: c, 'stroke-width': 0.15 }));
  }
  svg.append(g);
  return svg;
}

function gridBox(g, x, y, cols, rows, p, color = '#9ab3d5') {
  for (let i = 0; i <= cols; i++) g.append(S('line', { x1: x + i * p, x2: x + i * p, y1: y, y2: y + rows * p, stroke: color, 'stroke-width': 0.15 }));
  for (let j = 0; j <= rows; j++) g.append(S('line', { x1: x, x2: x + cols * p, y1: y + j * p, y2: y + j * p, stroke: color, 'stroke-width': 0.15 }));
}
/** Polygone simple (sans croisement) de n sommets sur les nœuds d'un quadrillage. */
function randomPolygon(r, n, cMin, cMax, rMin, rMax) {
  const pts = []; const key = new Set();
  let guard = 0;
  while (pts.length < n && guard++ < 500) { const p = [ri(r, cMin, cMax), ri(r, rMin, rMax)]; const k = p.join(','); if (!key.has(k)) { key.add(k); pts.push(p); } }
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
}
const poly = (pts, x, y, p, attrs) => S('polygon', { points: pts.map(([c, l]) => `${x + c * p},${y + l * p}`).join(' '), fill: 'none', 'stroke-linejoin': 'round', ...attrs });

// ───────── Symétrie axiale : compléter la figure ; la correction trace le symétrique en rouge.
export function symetrie(o, corr, title) {
  const svg = page(title || 'Trace le symétrique de chaque figure par rapport à l’axe rouge.');
  const r = rng(o.graine);
  const p = Number(o.pas) || 5;
  const n = Math.min(6, Math.max(1, Number(o.exercices) || 4));
  const nPts = { facile: 3, moyen: 5, difficile: 7 }[o.difficulte] || 5;
  const cols = 16, rows = 12; // 80 × 60 mm
  for (let k = 0; k < n; k++) {
    const x = 15 + (k % 2) * (cols * p + 10), y = 26 + Math.floor(k / 2) * (rows * p + 10);
    const g = S('g', { 'data-testid': 'exercise' });
    gridBox(g, x, y, cols, rows, p);
    let pts, mirror, axis;
    if (o.axe === 'horizontal') {
      pts = randomPolygon(r, nPts, 1, cols - 1, 1, rows / 2 - 1); mirror = ([c, l]) => [c, rows - l];
      axis = S('line', { x1: x - 2, x2: x + cols * p + 2, y1: y + rows / 2 * p, y2: y + rows / 2 * p, stroke: RED, 'stroke-width': 0.6 });
    } else if (o.axe === 'oblique') {
      const m = rows; // carré m × m, axe = diagonale
      pts = randomPolygon(r, nPts, 1, m - 2, 0, m - 1).map(([c, l]) => (c > l ? [c, l] : [l, c])).filter(([c, l]) => c !== l);
      if (pts.length < 3) pts = [[3, 1], [6, 2], [5, 4]];
      const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
      pts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
      mirror = ([c, l]) => [l, c];
      axis = S('line', { x1: x, y1: y, x2: x + m * p, y2: y + m * p, stroke: RED, 'stroke-width': 0.6 });
    } else {
      pts = randomPolygon(r, nPts, 1, cols / 2 - 1, 1, rows - 1); mirror = ([c, l]) => [cols - c, l];
      axis = S('line', { x1: x + cols / 2 * p, x2: x + cols / 2 * p, y1: y - 2, y2: y + rows * p + 2, stroke: RED, 'stroke-width': 0.6 });
    }
    g.append(axis, poly(pts, x, y, p, { stroke: '#1d3d6e', 'stroke-width': 0.6, 'data-role': 'figure' }));
    if (corr) g.append(poly(pts.map(mirror), x, y, p, { stroke: RED, 'stroke-width': 0.6, 'stroke-dasharray': '1.5 0.8', 'data-role': 'correction', 'data-points': JSON.stringify(pts.map(mirror)) }));
    g.setAttribute('data-figure', JSON.stringify(pts));
    svg.append(g);
  }
  svg.append(S('text', { x: 15, y: PAGE.h - 8, 'font-size': 3, fill: '#888' }, `Fiche n° ${o.graine} — même numéro, même fiche.`));
  return svg;
}

// ───────── Reproduction sur quadrillage
export function reproduction(o, corr, title) {
  const svg = page(title || 'Reproduis la figure sur le quadrillage de droite.');
  const r = rng(o.graine);
  const p = Number(o.pas) || 5;
  const n = Math.min(4, Math.max(1, Number(o.exercices) || 3));
  const nPts = { facile: 4, moyen: 6, difficile: 8 }[o.difficulte] || 6;
  const cols = 16, rows = 11;
  for (let k = 0; k < n; k++) {
    const y = 26 + k * (rows * p + 8);
    const g = S('g', { 'data-testid': 'exercise' });
    gridBox(g, 15, y, cols, rows, p); gridBox(g, 15 + cols * p + 10, y, cols, rows, p);
    const pts = randomPolygon(r, nPts, 1, cols - 1, 1, rows - 1);
    g.append(poly(pts, 15, y, p, { stroke: '#1d3d6e', 'stroke-width': 0.6 }));
    if (corr) g.append(poly(pts, 15 + cols * p + 10, y, p, { stroke: RED, 'stroke-width': 0.6, 'data-role': 'correction' }));
    svg.append(g);
  }
  return svg;
}

// ───────── Figures à mesurer ou à tracer (dimensions exactes en cm)
export const FIGURE_HELP = 'Une figure par ligne : segment 7 · carré 5 · rectangle 6 x 3 · triangle rectangle 4 x 3 · cercle 3 (rayon)';
export function parseFigures(text) {
  return String(text || '').split('\n').map(l => l.trim().toLowerCase().replace(',', '.')).filter(Boolean).map(l => {
    const nums = (l.match(/\d+(\.\d+)?/g) || []).map(Number);
    if (l.startsWith('segment')) return { kind: 'segment', a: nums[0] || 5 };
    if (l.startsWith('carré') || l.startsWith('carre')) return { kind: 'carré', a: nums[0] || 4 };
    if (l.startsWith('rectangle')) return { kind: 'rectangle', a: nums[0] || 6, b: nums[1] || 3 };
    if (l.startsWith('triangle')) return { kind: 'triangle rectangle', a: nums[0] || 4, b: nums[1] || 3 };
    if (l.startsWith('cercle')) return { kind: 'cercle', a: nums[0] || 3 };
    return null;
  }).filter(Boolean);
}
const fmtCm = (v) => `${String(Math.round(v * 10) / 10).replace('.', ',')} cm`;
export function figures(o, corr, title) {
  const tracer = o.mode === 'tracer';
  const svg = page(title || (tracer ? 'Trace les figures demandées (en cm).' : 'Mesure les côtés de chaque figure.'));
  const figs = parseFigures(o.liste).slice(0, 8);
  let y = 30; let letter = 0;
  const L = () => String.fromCharCode(65 + (letter++ % 26));
  for (const f of figs) {
    const g = S('g', { 'data-testid': 'figure', 'data-kind': f.kind });
    const a = f.a * 10, b = (f.b || 0) * 10; // mm
    const hgt = f.kind === 'segment' ? 10 : f.kind === 'cercle' ? 2 * a : f.kind === 'carré' ? a : b;
    if (y + hgt + 14 > PAGE.h - 10) break;
    const x = 25;
    const consigne = { segment: `Segment [${String.fromCharCode(65 + letter)}${String.fromCharCode(66 + letter)}] de ${fmtCm(f.a)}`, 'carré': `Carré de ${fmtCm(f.a)} de côté`, rectangle: `Rectangle de ${fmtCm(f.a)} sur ${fmtCm(f.b)}`, 'triangle rectangle': `Triangle rectangle : côtés de l’angle droit ${fmtCm(f.a)} et ${fmtCm(f.b)}`, cercle: `Cercle de rayon ${fmtCm(f.a)}` }[f.kind];
    if (tracer) g.append(S('text', { x: 15, y: y - 3, 'font-size': 4 }, `• ${consigne}`));
    const draw = !tracer || corr;
    const col = tracer ? RED : '#1d3d6e';
    if (draw) {
      if (f.kind === 'segment') { const [A, B] = [L(), L()]; g.append(S('line', { x1: x, y1: y + 4, x2: x + a, y2: y + 4, stroke: col, 'stroke-width': 0.4, 'data-mm': a })); for (const [px, n] of [[x, A], [x + a, B]]) { g.append(S('line', { x1: px, x2: px, y1: y + 2.5, y2: y + 5.5, stroke: col, 'stroke-width': 0.4 })); g.append(S('text', { x: px - 1.5, y: y + 10, 'font-size': 4 }, n)); } }
      else if (f.kind === 'cercle') { const O = L(); g.append(S('circle', { cx: x + a, cy: y + a, r: a, fill: 'none', stroke: col, 'stroke-width': 0.4, 'data-mm': a })); g.append(S('circle', { cx: x + a, cy: y + a, r: 0.6, fill: col })); g.append(S('text', { x: x + a + 1.5, y: y + a - 1.5, 'font-size': 4 }, O)); }
      else {
        const pts = f.kind === 'triangle rectangle' ? [[x, y], [x, y + b], [x + a, y + b]] : f.kind === 'carré' ? [[x, y], [x + a, y], [x + a, y + a], [x, y + a]] : [[x, y], [x + a, y], [x + a, y + b], [x, y + b]];
        g.append(S('polygon', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: col, 'stroke-width': 0.4, 'data-mm': `${a}x${b || a}` }));
        pts.forEach(([px, py]) => g.append(S('text', { x: px + (px === x ? -4.5 : 1.5), y: py + (py === y ? -1.5 : 4.5), 'font-size': 4 }, L())));
        if (f.kind === 'triangle rectangle') g.append(S('polyline', { points: `${x},${y + b - 3} ${x + 3},${y + b - 3} ${x + 3},${y + b}`, fill: 'none', stroke: col, 'stroke-width': 0.3 }));
      }
    }
    if (!tracer) {
      const lines = f.kind === 'cercle' ? ['Rayon : ……'] : f.kind === 'segment' ? ['Longueur : ……'] : f.kind === 'carré' ? ['Côté : ……'] : ['Longueur : ……', 'Largeur : ……'];
      const answers = f.kind === 'cercle' || f.kind === 'segment' || f.kind === 'carré' ? [fmtCm(f.a)] : [fmtCm(f.a), fmtCm(f.b)];
      lines.forEach((t, i) => g.append(S('text', { x: 140, y: y + 5 + i * 7, 'font-size': 4, fill: corr ? RED : '#222' }, corr ? t.replace('……', answers[i]) : t)));
    }
    svg.append(g);
    y += hgt + (tracer ? 22 : 16);
  }
  svg.append(S('text', { x: 15, y: PAGE.h - 8, 'font-size': 3, fill: '#888' }, 'Dimensions exactes à l’impression à 100 % (taille réelle).'));
  return svg;
}

// ───────── Angles : classer ou mesurer
export function angles(o, corr, title) {
  const mesurer = o.mode === 'mesurer';
  const svg = page(title || (mesurer ? 'Mesure chaque angle avec ton rapporteur.' : 'Angle aigu, droit ou obtus ?'));
  const r = rng(o.graine);
  const n = Math.min(12, Math.max(1, Number(o.nombre) || 8));
  for (let k = 0; k < n; k++) {
    const v = (o.droits !== false && k % 4 === 1) ? 90 : ri(r, 3, 33) * 5; // 15° à 165°, multiples de 5
    const rot = ri(r, 0, 11) * 30;
    const cx = 35 + (k % 3) * 62, cy = 70 + Math.floor(k / 3) * 58, len = 26;
    const g = S('g', { 'data-testid': 'angle', 'data-deg': v });
    const ray = (deg) => [cx + len * Math.cos(-deg * Math.PI / 180), cy + len * Math.sin(-deg * Math.PI / 180)];
    const [ax, ay] = ray(rot), [bx, by] = ray(rot + v);
    g.append(S('path', { d: `M${ax},${ay} L${cx},${cy} L${bx},${by}`, fill: 'none', stroke: '#1d3d6e', 'stroke-width': 0.5 }));
    if (v === 90) { const u = ray(rot).map((c, i) => (c - [cx, cy][i]) / len * 4), w = ray(rot + 90).map((c, i) => (c - [cx, cy][i]) / len * 4); g.append(S('path', { d: `M${cx + u[0]},${cy + u[1]} L${cx + u[0] + w[0]},${cy + u[1] + w[1]} L${cx + w[0]},${cy + w[1]}`, fill: 'none', stroke: '#1d3d6e', 'stroke-width': 0.3 })); }
    else { const a0 = ray(rot).map((c, i) => [cx, cy][i] + (c - [cx, cy][i]) * 0.3), a1 = ray(rot + v).map((c, i) => [cx, cy][i] + (c - [cx, cy][i]) * 0.3); g.append(S('path', { d: `M${a0[0]},${a0[1]} A${len * 0.3},${len * 0.3} 0 ${v > 180 ? 1 : 0} 0 ${a1[0]},${a1[1]}`, fill: 'none', stroke: '#1d3d6e', 'stroke-width': 0.3 })); }
    g.append(S('text', { x: cx - 25, y: cy + 16, 'font-size': 4 }, `${k + 1}.`));
    const type = v < 90 ? 'aigu' : v === 90 ? 'droit' : 'obtus';
    g.append(S('text', { x: cx - 18, y: cy + 16, 'font-size': 4, fill: corr ? RED : '#222' }, corr ? (mesurer ? `${v}° (${type})` : type) : (mesurer ? '…… °' : 'aigu – droit – obtus')));
    svg.append(g);
  }
  return svg;
}

// ───────── Cartes (données : data/maps, voir data/maps/SOURCES.txt)
const MAPS = {};
export async function loadMap(name) {
  if (MAPS[name]) return MAPS[name];
  const r = await fetch(`data/maps/${name}.json`);
  if (!r.ok) throw new Error('Carte introuvable');
  MAPS[name] = await r.json();
  return MAPS[name];
}
export const mapReady = (name) => !!MAPS[name];
const CONT_COLORS = { Afrique: '#f2c14e', Asie: '#e58e73', Europe: '#7fb3d5', 'Amérique du Nord': '#8fcf9f', 'Amérique du Sud': '#c39bd3', Océanie: '#f5b7b1', Antarctique: '#e5e8e8' };
const REG_COLORS = ['#f6d6a8', '#cfe3c1', '#c9dcf0', '#efc9d6', '#e3d5f0', '#f3e3b0', '#cfe9e6', '#f0d0b8', '#dfe8c4', '#d6d9f2', '#f2cfcf', '#d4ecd9', '#ece0c8'];

export function carte(o, corr, title) {
  const name = String(o.carte || '').startsWith('France') ? 'france' : 'monde';
  const data = MAPS[name];
  const landscape = name === 'monde';
  const svg = page(title, landscape);
  const pw = landscape ? PAGE.h : PAGE.w, ph = landscape ? PAGE.w : PAGE.h;
  if (!data) { svg.append(S('text', { x: pw / 2, y: ph / 2, 'font-size': 6, 'text-anchor': 'middle', fill: '#888' }, 'Chargement de la carte…')); return svg; }
  const show = corr || o.legendee; // version légendée = noms écrits
  const deps = o.carte === 'France : départements';
  // 1. Noms à placer (position dans le repère de la carte, taille en mm).
  const names = [];
  if (name === 'monde') {
    if (o.continents_noms !== false) for (const [k, [x, y]] of Object.entries(data.labels.continents)) names.push({ x, y, text: k, size: 4, kind: 'continent' });
    if (o.oceans) for (const [k, list] of Object.entries(data.labels.oceans)) list.forEach(([x, y], i) => names.push({ x, y, text: k, size: 3.4, kind: 'ocean', dup: i > 0 }));
  } else {
    if (o.unites !== false) (deps ? data.departements : data.regions).forEach(u => names.push({ x: u.lx, y: u.ly, text: deps ? `${u.code}` : u.name, size: deps ? 2.2 : 2.8, kind: deps ? 'departement' : 'region', full: u.name }));
    if (o.fleuves) data.rivers.forEach(r => names.push({ x: r.lx, y: r.ly, text: r.name, size: 2.8, kind: 'fleuve' }));
    if (o.relief) data.mountains.forEach(m => names.push({ x: m.lx, y: m.ly, text: m.name, size: 2.8, kind: 'relief' }));
  }
  const numbered = !show && o.numeros && !deps ? names.filter(n => !n.dup) : [];
  const cols = landscape ? 5 : 3;
  const legendH = numbered.length ? Math.ceil(numbered.length / cols) * 6 + 4 : 0;
  // 2. Mise à l'échelle de la carte dans la page.
  const margin = 12, top = title ? 22 : 12, bottom = 10 + legendH;
  const scale = Math.min((pw - 2 * margin) / data.width, (ph - top - bottom) / data.height);
  const ox = (pw - data.width * scale) / 2, oy = top;
  const g = S('g', { transform: `translate(${ox} ${oy}) scale(${scale})`, 'data-testid': 'map' });
  const fs = (mm) => mm / scale;
  if (name === 'monde') {
    g.append(S('path', { d: data.outline, fill: o.couleurs ? '#e8f3fb' : '#fff', stroke: '#888', 'stroke-width': fs(0.3) }));
    const continents = o.carte === 'Continents';
    for (const c of data.countries) {
      const fill = o.couleurs ? (continents ? CONT_COLORS[c.continent] || '#ddd' : '#f3eee2') : '#fff';
      g.append(S('path', { d: c.d, fill, stroke: continents && o.couleurs ? fill : '#555', 'stroke-width': fs(continents && o.couleurs ? 0.05 : 0.15), 'data-continent': c.continent }));
    }
    if (o.lignes) for (const l of data.lines) { const main = l.name === 'Équateur' || l.name.startsWith('Méridien'); g.append(S('path', { d: l.d, fill: 'none', stroke: main ? RED : '#999', 'stroke-width': fs(0.25), 'stroke-dasharray': main ? null : `${fs(1)} ${fs(1)}`, 'data-line': l.name })); }
    if (o.fleuves) for (const r of data.rivers) g.append(S('path', { d: r.d, fill: 'none', stroke: '#2f6fbf', 'stroke-width': fs(0.3) }));
  } else {
    for (const n of data.neighbors) g.append(S('path', { d: n.d, fill: '#f1f1f1', stroke: '#bbb', 'stroke-width': fs(0.2) }));
    const units = deps ? data.departements : data.regions;
    units.forEach((u, i) => g.append(S('path', { d: u.d, fill: o.couleurs ? REG_COLORS[i % REG_COLORS.length] : '#fff', stroke: '#666', 'stroke-width': fs(deps ? 0.15 : 0.25), 'data-code': u.code })));
    g.append(S('path', { d: data.outline, fill: 'none', stroke: '#333', 'stroke-width': fs(0.5) }));
    if (o.relief) for (const m of data.mountains) g.append(S('path', { d: m.d, fill: '#b9925a', 'fill-opacity': 0.35, stroke: '#8a6a3a', 'stroke-width': fs(0.2) }));
    if (o.fleuves) for (const r of data.rivers) g.append(S('path', { d: r.d, fill: 'none', stroke: '#2f6fbf', 'stroke-width': fs(0.45), 'data-river': r.name }));
    if (o.villes) for (const c of data.cities) { g.append(S('circle', { cx: c.x, cy: c.y, r: fs(c.capital ? 1.2 : 0.8), fill: c.capital ? RED : '#222' })); if (show) g.append(S('text', { x: c.x, y: c.y - fs(1.6), 'font-size': fs(2.4), 'text-anchor': 'middle', 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': fs(0.6) }, c.name)); }
  }
  // 3. Noms (version légendée ou corrigée) ou numéros (version vierge à compléter).
  const ink = corr && !o.legendee ? RED : '#222';
  if (show) for (const n of names) g.append(S('text', { x: n.x, y: n.y, 'font-size': fs(n.size), 'text-anchor': 'middle', fill: ink, 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': fs(0.6), 'data-name': n.text }, n.text));
  else numbered.forEach((n, i) => { const m = S('g', { 'data-testid': 'map-number' }); m.append(S('circle', { cx: n.x, cy: n.y, r: fs(2.3), fill: '#fff', stroke: '#222', 'stroke-width': fs(0.25) }), S('text', { x: n.x, y: n.y + fs(0.95), 'font-size': fs(2.6), 'text-anchor': 'middle' }, String(i + 1))); g.append(m); });
  svg.append(g);
  if (numbered.length) {
    const lw = (pw - 2 * margin) / cols;
    const ly = ph - bottom + 4;
    numbered.forEach((n, i) => svg.append(S('text', { x: margin + (i % cols) * lw, y: ly + Math.floor(i / cols) * 6, 'font-size': 3.2, 'data-testid': 'legend-line' }, `${i + 1}. …………………………`)));
  }
  svg.append(S('text', { x: margin, y: ph - 4, 'font-size': 2.3, fill: '#888' }, `Sources : ${data.sources}. Projection : ${data.projection}.`));
  return svg;
}
