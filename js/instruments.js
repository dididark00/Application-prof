// Instruments de géométrie virtuels pour l'affichage en grand (TNI, tablette) :
// règle graduée, équerre, rapporteur (déplaçables et orientables) et compas qui trace sur l'annotation.
// L'échelle suit la feuille affichée : 1 cm de règle = 1 cm de la fiche A4 projetée.
const NS = 'http://www.w3.org/2000/svg';
const S = (tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };

function ruler() {
  const g = S('g');
  g.append(S('rect', { x: 0, y: 0, width: 205, height: 28, rx: 2, fill: 'rgba(255,255,230,.82)', stroke: '#555', 'stroke-width': 0.4 }));
  for (let mm = 0; mm <= 200; mm++) {
    const x = 2.5 + mm, h = mm % 10 === 0 ? 8 : mm % 5 === 0 ? 5.5 : 3.5;
    g.append(S('line', { x1: x, x2: x, y1: 0, y2: h, stroke: '#222', 'stroke-width': mm % 10 === 0 ? 0.3 : 0.18 }));
    if (mm % 10 === 0) g.append(S('text', { x, y: 13.5, 'font-size': 4, 'text-anchor': 'middle', fill: '#222' }, String(mm / 10)));
  }
  return { node: g, w: 205, h: 28, cx: 102.5, cy: 14 };
}
function squareTool() {
  const g = S('g');
  g.append(S('polygon', { points: '0,0 0,100 60,100', fill: 'rgba(220,240,255,.8)', stroke: '#2f5d8f', 'stroke-width': 0.6 }));
  g.append(S('polygon', { points: '12,40 12,88 38,88', fill: 'rgba(255,255,255,.5)', stroke: '#2f5d8f', 'stroke-width': 0.3 }));
  for (let mm = 0; mm <= 95; mm++) { const h = mm % 10 === 0 ? 5 : mm % 5 === 0 ? 3.5 : 2; g.append(S('line', { x1: 0, x2: h, y1: 100 - mm, y2: 100 - mm, stroke: '#222', 'stroke-width': 0.15 })); }
  for (let mm = 0; mm <= 55; mm++) { const h = mm % 10 === 0 ? 5 : mm % 5 === 0 ? 3.5 : 2; g.append(S('line', { x1: mm, x2: mm, y1: 100, y2: 100 - h, stroke: '#222', 'stroke-width': 0.15 })); }
  g.append(S('path', { d: 'M0,92 L8,92 L8,100', fill: 'none', stroke: '#c0392b', 'stroke-width': 0.5 }));
  return { node: g, w: 60, h: 100, cx: 20, cy: 66 };
}
function protractor() {
  const g = S('g'); const r = 60, cx = 62, cy = 62;
  g.append(S('path', { d: `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy} Z`, fill: 'rgba(230,255,230,.8)', stroke: '#2b6b3f', 'stroke-width': 0.5 }));
  for (let a = 0; a <= 180; a++) {
    const t = a * Math.PI / 180, h = a % 10 === 0 ? 6 : a % 5 === 0 ? 4 : 2.2;
    g.append(S('line', { x1: cx + r * Math.cos(t), y1: cy - r * Math.sin(t), x2: cx + (r - h) * Math.cos(t), y2: cy - (r - h) * Math.sin(t), stroke: '#222', 'stroke-width': 0.15 }));
    if (a % 10 === 0) {
      g.append(S('text', { x: cx + (r - 10) * Math.cos(t), y: cy - (r - 10) * Math.sin(t) + 1.2, 'font-size': 3.2, 'text-anchor': 'middle', fill: '#222' }, String(a)));
      g.append(S('text', { x: cx + (r - 15.5) * Math.cos(t), y: cy - (r - 15.5) * Math.sin(t) + 1.2, 'font-size': 2.6, 'text-anchor': 'middle', fill: '#c0392b' }, String(180 - a)));
    }
  }
  g.append(S('line', { x1: cx - r, x2: cx + r, y1: cy, y2: cy, stroke: '#222', 'stroke-width': 0.3 }));
  g.append(S('line', { x1: cx, x2: cx, y1: cy, y2: cy - 6, stroke: '#c0392b', 'stroke-width': 0.4 }));
  g.append(S('circle', { cx, cy, r: 0.9, fill: '#c0392b' }));
  return { node: g, w: 124, h: 64, cx, cy };
}

/**
 * Ajoute la barre d'instruments à un affichage en grand.
 * board : élément qui contient la feuille ; canvas : calque d'annotation ; getCtx() : son contexte 2D.
 */
export function attachInstruments({ wrap, board, canvas, getCtx, bar, color = () => '#c0392b' }) {
  const layer = document.createElement('div'); layer.className = 'instr-layer';
  wrap.append(layer);
  const pxPerMm = () => {
    const svg = board.querySelector('svg');
    const vb = svg?.viewBox?.baseVal;
    // Feuille de l'Atelier : 1 unité = 1 mm. Autre contenu : millimètre d'écran (96 ppp).
    if (svg && vb && vb.width && String(svg.getAttribute('width') || '').endsWith('mm')) return svg.getBoundingClientRect().width / vb.width;
    return 96 / 25.4;
  };
  const add = (make, name) => {
    const t = make(); const k = pxPerMm();
    const svg = S('svg', { width: t.w * k, height: t.h * k, viewBox: `0 0 ${t.w} ${t.h}`, class: 'instr', 'data-testid': `instr-${name}` });
    svg.append(t.node);
    const el = document.createElement('div'); el.className = 'instr-wrap';
    let x = (layer.clientWidth - t.w * k) / 2, y = (layer.clientHeight - t.h * k) / 2, rot = 0;
    const place = () => { el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`; el.style.transformOrigin = `${t.cx * k}px ${t.cy * k}px`; };
    const rotH = document.createElement('button'); rotH.type = 'button'; rotH.className = 'instr-rot'; rotH.title = 'Tourner (glisser)'; rotH.textContent = '↻';
    const close = document.createElement('button'); close.type = 'button'; close.className = 'instr-close'; close.textContent = '×'; close.title = 'Retirer';
    close.onclick = () => el.remove();
    const angle = document.createElement('span'); angle.className = 'instr-angle';
    el.append(svg, rotH, close, angle); layer.append(el); place();
    let mode = null, sx = 0, sy = 0, ox = 0, oy = 0;
    el.addEventListener('pointerdown', (e) => {
      if (e.target === close) return;
      mode = e.target === rotH ? 'rot' : 'move'; sx = e.clientX; sy = e.clientY; ox = x; oy = y;
      el.setPointerCapture(e.pointerId); e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!mode) return;
      if (mode === 'move') { x = ox + e.clientX - sx; y = oy + e.clientY - sy; }
      else { const lr = layer.getBoundingClientRect(); const cx = lr.left + x + t.cx * k, cy = lr.top + y + t.cy * k; rot = Math.round(Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90); angle.textContent = `${((rot % 360) + 360) % 360}°`; }
      place();
    });
    el.addEventListener('pointerup', () => { mode = null; setTimeout(() => { angle.textContent = ''; }, 800); });
    return el;
  };
  // Compas : appuyer sur le centre, glisser jusqu'au rayon voulu, relâcher → le cercle est tracé.
  let compass = false;
  const info = document.createElement('span'); info.className = 'instr-info'; info.setAttribute('data-testid', 'compass-info');
  const preview = S('svg', { class: 'instr-compass' });
  layer.append(preview);
  layer.addEventListener('pointerdown', (e) => {
    if (!compass || e.target.closest('.instr-wrap')) return;
    const lr = layer.getBoundingClientRect(); const c = { x: e.clientX - lr.left, y: e.clientY - lr.top };
    layer.setPointerCapture(e.pointerId);
    const circle = S('circle', { cx: c.x, cy: c.y, r: 0, fill: 'none', stroke: color(), 'stroke-width': 3, 'stroke-dasharray': '6 4' });
    const pin = S('circle', { cx: c.x, cy: c.y, r: 4, fill: '#222' });
    preview.replaceChildren(circle, pin);
    const mv = (ev) => { const r = Math.hypot(ev.clientX - lr.left - c.x, ev.clientY - lr.top - c.y); circle.setAttribute('r', r); info.textContent = `rayon ${(r / pxPerMm() / 10).toFixed(1).replace('.', ',')} cm`; };
    const up = (ev) => {
      layer.removeEventListener('pointermove', mv); layer.removeEventListener('pointerup', up);
      const r = Math.hypot(ev.clientX - lr.left - c.x, ev.clientY - lr.top - c.y);
      preview.replaceChildren();
      const cr = canvas.getBoundingClientRect(); const ctx = getCtx();
      if (r > 3 && ctx) { ctx.save(); ctx.strokeStyle = color(); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x + lr.left - cr.left, c.y + lr.top - cr.top, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    };
    layer.addEventListener('pointermove', mv); layer.addEventListener('pointerup', up);
  });
  const btn = (label, testid, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-small'; b.textContent = label; b.setAttribute('data-testid', testid); b.onclick = fn; return b; };
  const compassBtn = btn('Compas', 'instr-compass', () => { compass = !compass; compassBtn.classList.toggle('btn-primary', compass); layer.classList.toggle('compass-on', compass); info.textContent = compass ? 'Appuyez sur le centre, glissez jusqu’au rayon, relâchez.' : ''; });
  bar.prepend(btn('Règle', 'instr-add-regle', () => add(ruler, 'regle')), btn('Équerre', 'instr-add-equerre', () => add(squareTool, 'equerre')), btn('Rapporteur', 'instr-add-rapporteur', () => add(protractor, 'rapporteur')), compassBtn, info);
  return { pxPerMm };
}
