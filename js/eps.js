// Schémas d'EPS : éléments (plots, cerceaux, bancs, tapis, joueurs, flèches…), terrains,
// modèles et dessin SVG. Un schéma est un enregistrement unique, relié à une séance et à une phase :
// la fiche de séance et le cahier journal affichent toujours sa version actuelle.
import * as store from './store.js';

export const W = 1000, H = 600;
const NS = 'http://www.w3.org/2000/svg';
export function S(tag, attrs = {}, text) { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; }

export const FIELDS = [['gymnase', 'Gymnase'], ['terrain', 'Terrain extérieur'], ['cour', 'Cour'], ['libre', 'Espace libre']];
export const ITEMS = {
  plot: { label: 'Plot', w: 26, h: 26 },
  cerceau: { label: 'Cerceau', w: 50, h: 50 },
  banc: { label: 'Banc', w: 130, h: 22 },
  tapis: { label: 'Tapis', w: 110, h: 70 },
  ballon: { label: 'Ballon', w: 18, h: 18 },
  but: { label: 'But / caisse', w: 70, h: 26 },
  joueur: { label: 'Joueur', w: 32, h: 32 },
  enseignant: { label: 'Enseignant', w: 36, h: 36 },
  zone: { label: 'Zone', w: 220, h: 140 },
  ligne: { label: 'Limite / ligne', line: true },
  deplacement: { label: 'Flèche de déplacement', line: true, arrow: true },
  passe: { label: 'Flèche de passe', line: true, arrow: true, dashed: true },
  texte: { label: 'Texte', w: 120, h: 30 },
};
export const DEFAULT_COLORS = ['#d9534f', '#2f6f8f', '#3f8f3f', '#e0a020', '#7a4a9a', '#222222'];

export const diagramsOfSession = (sid) => store.all('epsdiagram').filter(d => d.sessionId === sid).sort((a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt || '').localeCompare(b.createdAt || ''));
export const diagramsOfPhase = (sid, pid) => diagramsOfSession(sid).filter(d => d.phaseId === pid);

export function newItem(kind, x = W / 2, y = H / 2, extra = {}) {
  const d = ITEMS[kind];
  if (d.line) return { id: store.uid(), kind, x1: x - 80, y1: y, x2: x + 80, y2: y, color: kind === 'ligne' ? '#ffffff' : '#222222', label: '', ...extra };
  return { id: store.uid(), kind, x: x - d.w / 2, y: y - d.h / 2, w: d.w, h: d.h, rot: 0, color: kind === 'joueur' ? DEFAULT_COLORS[0] : kind === 'plot' ? '#e0a020' : kind === 'cerceau' ? '#2f6f8f' : '#555555', label: kind === 'texte' ? 'Texte' : '', ...extra };
}

/** Modèles de départ (positions indicatives, non cotées). */
export const TEMPLATES = {
  parcours: { label: 'Parcours (4 ateliers)', field: 'gymnase', make: () => [
    newItem('zone', 180, 150, { label: 'Atelier 1 : sauter' }), newItem('zone', 820, 150, { label: 'Atelier 2 : ramper' }), newItem('zone', 820, 450, { label: 'Atelier 3 : rouler' }), newItem('zone', 180, 450, { label: 'Atelier 4 : lancer' }),
    newItem('cerceau', 140, 150), newItem('cerceau', 200, 150), newItem('banc', 820, 150), newItem('tapis', 820, 450), newItem('plot', 150, 450), newItem('plot', 210, 450),
    newItem('deplacement', 0, 0, { x1: 300, y1: 150, x2: 690, y2: 150 }), newItem('deplacement', 0, 0, { x1: 820, y1: 240, x2: 820, y2: 360 }), newItem('deplacement', 0, 0, { x1: 690, y1: 450, x2: 300, y2: 450 }), newItem('deplacement', 0, 0, { x1: 180, y1: 360, x2: 180, y2: 240 }),
    newItem('enseignant', 500, 300)] },
  collectif: { label: 'Jeu collectif (2 équipes)', field: 'terrain', make: () => [
    newItem('ligne', 0, 0, { x1: 500, y1: 40, x2: 500, y2: 560 }),
    ...[150, 300, 450].map((y, i) => newItem('joueur', 330, y, { color: DEFAULT_COLORS[0], label: String(i + 1) })),
    ...[150, 300, 450].map((y, i) => newItem('joueur', 670, y, { color: DEFAULT_COLORS[1], label: String(i + 1) })),
    newItem('ballon', 360, 300), newItem('but', 60, 300, { rot: 90 }), newItem('but', 940, 300, { rot: 90 }),
    newItem('passe', 0, 0, { x1: 340, y1: 160, x2: 340, y2: 285 }), newItem('enseignant', 500, 560)] },
  ateliers: { label: 'Ateliers tournants (3 groupes)', field: 'gymnase', make: () => [
    newItem('zone', 200, 300, { label: 'Atelier A' }), newItem('zone', 500, 300, { label: 'Atelier B' }), newItem('zone', 800, 300, { label: 'Atelier C' }),
    newItem('deplacement', 0, 0, { x1: 320, y1: 230, x2: 380, y2: 230 }), newItem('deplacement', 0, 0, { x1: 620, y1: 230, x2: 680, y2: 230 }), newItem('deplacement', 0, 0, { x1: 800, y1: 390, x2: 200, y2: 390 }),
    newItem('enseignant', 500, 520)] },
};

function fieldBg(svg, f) {
  if (f === 'libre') { svg.append(S('rect', { x: 0, y: 0, width: W, height: H, fill: '#ffffff' })); return; }
  const fill = f === 'terrain' ? '#cfe6c4' : f === 'cour' ? '#e6e3dc' : '#f3e2c6';
  svg.append(S('rect', { x: 0, y: 0, width: W, height: H, fill }));
  svg.append(S('rect', { x: 20, y: 20, width: W - 40, height: H - 40, fill: 'none', stroke: '#ffffff', 'stroke-width': 4 }));
  if (f !== 'cour') { svg.append(S('line', { x1: W / 2, y1: 20, x2: W / 2, y2: H - 20, stroke: '#ffffff', 'stroke-width': 3 })); svg.append(S('circle', { cx: W / 2, cy: H / 2, r: 60, fill: 'none', stroke: '#ffffff', 'stroke-width': 3 })); }
}

function itemNode(it) {
  const d = ITEMS[it.kind] || ITEMS.plot;
  if (d.line) {
    const g = S('g', { 'data-id': it.id, 'data-kind': it.kind, class: 'eps-item' });
    g.append(S('line', { x1: it.x1, y1: it.y1, x2: it.x2, y2: it.y2, stroke: 'transparent', 'stroke-width': 18 }));
    g.append(S('line', { x1: it.x1, y1: it.y1, x2: it.x2, y2: it.y2, stroke: it.color, 'stroke-width': it.kind === 'ligne' ? 4 : 3, 'stroke-dasharray': d.dashed ? '12 8' : null, 'marker-end': d.arrow ? `url(#arrow-${it.color.replace('#', '')})` : null }));
    if (it.label) g.append(S('text', { x: (it.x1 + it.x2) / 2, y: (it.y1 + it.y2) / 2 - 8, 'text-anchor': 'middle', 'font-size': 16, fill: '#222' }, it.label));
    return g;
  }
  const g = S('g', { 'data-id': it.id, 'data-kind': it.kind, class: 'eps-item', transform: `translate(${it.x} ${it.y}) rotate(${it.rot || 0} ${it.w / 2} ${it.h / 2})` });
  const { w, h } = it; const c = it.color;
  const shape = {
    plot: () => S('polygon', { points: `${w / 2},0 ${w},${h} 0,${h}`, fill: c, stroke: '#333', 'stroke-width': 1.5 }),
    cerceau: () => S('ellipse', { cx: w / 2, cy: h / 2, rx: w / 2 - 3, ry: h / 2 - 3, fill: 'none', stroke: c, 'stroke-width': 6 }),
    banc: () => S('rect', { width: w, height: h, rx: 4, fill: '#b98b5a', stroke: '#6d4c2c', 'stroke-width': 2 }),
    tapis: () => S('rect', { width: w, height: h, rx: 10, fill: '#5b8fd1', stroke: '#2f5d8f', 'stroke-width': 2 }),
    ballon: () => S('circle', { cx: w / 2, cy: h / 2, r: Math.min(w, h) / 2, fill: '#ffffff', stroke: '#222', 'stroke-width': 2 }),
    but: () => S('rect', { width: w, height: h, fill: '#ffffff', stroke: '#222', 'stroke-width': 3 }),
    joueur: () => S('circle', { cx: w / 2, cy: h / 2, r: Math.min(w, h) / 2, fill: c, stroke: '#222', 'stroke-width': 2 }),
    enseignant: () => S('rect', { width: w, height: h, rx: 6, fill: '#222', stroke: '#222' }),
    zone: () => S('rect', { width: w, height: h, rx: 12, fill: c, 'fill-opacity': 0.12, stroke: c, 'stroke-width': 3, 'stroke-dasharray': '10 6' }),
    texte: () => S('rect', { width: w, height: h, fill: 'transparent' }),
  }[it.kind] || (() => S('rect', { width: w, height: h, fill: c }));
  g.append(shape());
  const lab = it.kind === 'enseignant' ? (it.label || 'E') : it.label;
  if (lab) {
    const inside = ['joueur', 'enseignant'].includes(it.kind);
    g.append(S('text', { x: w / 2, y: it.kind === 'zone' ? 24 : inside ? h / 2 + 6 : it.kind === 'texte' ? h / 2 + 7 : h + 18, 'text-anchor': 'middle', 'font-size': it.kind === 'texte' ? 20 : 16, 'font-weight': inside || it.kind === 'zone' ? 700 : 400, fill: inside ? '#fff' : '#222' }, lab));
  }
  return g;
}

/** SVG complet d'un schéma (aperçu, impression, projection, export image). */
export function render(d, { legend = true, selected = null } = {}) {
  const items = d.items || [];
  const lg = legend ? legendOf(d) : [];
  const extra = lg.length ? 60 : 0;
  const svg = S('svg', { xmlns: NS, viewBox: `0 0 ${W} ${H + extra}`, class: 'eps-svg', 'data-testid': 'eps-svg' });
  const defs = S('defs');
  for (const c of new Set(items.filter(i => ITEMS[i.kind]?.arrow).map(i => i.color))) {
    const m = S('marker', { id: `arrow-${c.replace('#', '')}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    m.append(S('path', { d: 'M0,0 L10,5 L0,10 z', fill: c })); defs.append(m);
  }
  svg.append(defs);
  fieldBg(svg, d.field || 'gymnase');
  for (const it of [...items].sort((a, b) => (a.kind === 'zone' ? -1 : 0) - (b.kind === 'zone' ? -1 : 0))) {
    const n = itemNode(it);
    if (selected === it.id) n.classList.add('sel');
    svg.append(n);
  }
  if (d.dims?.w && d.dims?.h) svg.append(S('text', { x: W - 24, y: H - 28, 'text-anchor': 'end', 'font-size': 15, fill: '#444' }, `Dimensions indiquées : ${d.dims.w} m × ${d.dims.h} m (croquis, pas à l’échelle exacte)`));
  else svg.append(S('text', { x: W - 24, y: H - 28, 'text-anchor': 'end', 'font-size': 14, fill: '#666' }, 'Croquis non coté'));
  if (lg.length) {
    svg.append(S('rect', { x: 0, y: H, width: W, height: extra, fill: '#ffffff' }));
    let x = 20;
    for (const l of lg) {
      const sw = S('g', { transform: `translate(${x} ${H + 18})` });
      if (l.line) sw.append(S('line', { x1: 0, y1: 12, x2: 30, y2: 12, stroke: l.color, 'stroke-width': 3, 'stroke-dasharray': l.dashed ? '8 5' : null }));
      else sw.append(S('rect', { x: 0, y: 2, width: 22, height: 20, rx: 4, fill: l.color, stroke: '#333' }));
      sw.append(S('text', { x: 36, y: 18, 'font-size': 16, fill: '#222' }, l.label));
      svg.append(sw);
      x += 50 + l.label.length * 8.5;
      if (x > W - 120) break;
    }
  }
  return svg;
}

/** Légende automatique : éléments utilisés et couleurs d'équipes. */
export function legendOf(d) {
  const out = []; const seen = new Set();
  for (const it of d.items || []) {
    const def = ITEMS[it.kind]; if (!def || it.kind === 'texte' || it.kind === 'zone') continue;
    const key = it.kind === 'joueur' ? `j${it.color}` : it.kind;
    if (seen.has(key)) continue; seen.add(key);
    const team = it.kind === 'joueur' ? (d.teams || {})[it.color] : null;
    out.push({ label: it.kind === 'joueur' ? (team ? `Joueur — ${team}` : 'Joueur') : def.label, color: it.kind === 'ligne' ? '#999999' : it.color, line: !!def.line, dashed: !!def.dashed });
  }
  return out;
}
