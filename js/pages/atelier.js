// Atelier pédagogique — outils de base : lignes Seyès, réglures, texte à compléter,
// droites graduées, tableau de numération, fractions, horloges.
// Tout est dessiné en millimètres (A4 à taille réelle à l'impression), avec version corrigée.
// On peut imprimer, enregistrer le support dans Fichiers (lié à une séance) ou l'afficher en grand.
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import { h, icon, toast, modal, field } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { pickMany } from '../forms.js';
import * as F from '../fonts.js';

const PAGE = { w: 210, h: 297 };
const TOOLS = [
  ['ecriture', 'Tableau d’écriture (Seyès)'], ['seyes', 'Lignes Seyès'], ['reglure', 'Réglure simple'], ['texte', 'Texte à compléter'],
  ['droite', 'Droite graduée'], ['numeration', 'Tableau de numération'], ['fractions', 'Fractions'], ['horloges', 'Horloges'],
];
const state = {
  tool: 'ecriture', correction: false, title: '',
  ecriture: { texte: 'Le chat dort sur le tapis.\nIl fait beau aujourd’hui.', police: '', hauteur: 1, ajuste: 100, interligne: 8, sauter: true, encre: '#1d3d6e', marge: 30, couleur: '#7aa7d8', marge_couleur: '#d9534f' },
  seyes: { interligne: 8, lignes: 26, marge: 30, couleur: '#7aa7d8', marge_couleur: '#d9534f', modele: '' },
  reglure: { ecart: 10, lignes: 24, couleur: '#888888' },
  texte: { source: 'Le [chat] dort sur le [tapis]. Il fait [beau] aujourd’hui.', banque: true, taille: 5 },
  droite: { debut: 0, fin: 20, pas: 1, sous: 0, etiquettes: 'extrémités', nb: 4 },
  numeration: { classes: 'milliers,unités', lignes: 6, nombres: '' },
  fractions: { liste: '1/2, 1/3, 3/4, 2/5, 5/8', forme: 'barre', colorier: true },
  horloges: { heures: '08:00, 09:30, 10:15, 11:45, 14:20, 16:05', aiguilles: true, numeros: true },
};

// ───── Petits outils de dessin SVG (unités : mm)
const NS = 'http://www.w3.org/2000/svg';
function S(tag, attrs = {}, text) { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; }
function page(title) {
  const svg = S('svg', { xmlns: NS, viewBox: `0 0 ${PAGE.w} ${PAGE.h}`, width: `${PAGE.w}mm`, height: `${PAGE.h}mm`, class: 'atelier-page', 'font-family': 'Arial, Helvetica, sans-serif' });
  svg.append(S('rect', { x: 0, y: 0, width: PAGE.w, height: PAGE.h, fill: '#fff' }));
  if (title) svg.append(S('text', { x: 15, y: 16, 'font-size': 6, 'font-weight': 700 }, title));
  return svg;
}

const DRAW = {
  /**
   * Tableau d'écriture : le texte tapé est écrit dans la police choisie (ex. Marelle),
   * la ligne de base posée sur la ligne épaisse du Seyès et la hauteur des minuscules
   * calée sur 1 (ou 2) interligne(s) fin(s), d'après la mesure réelle de la police.
   */
  ecriture(o) {
    const svg = page(state.title);
    const il = Number(o.interligne) || 8, step = il / 4, top = 24, left = 10, right = PAGE.w - 10;
    const font = currentFont(o);
    const xh = step * (Number(o.hauteur) || 1);
    const size = (xh / F.xHeightRatio(font)) * ((Number(o.ajuste) || 100) / 100);
    const nLines = Math.floor((PAGE.h - 10 - top) / il);
    for (let i = 0; i <= nLines; i++) {
      const y = top + i * il;
      svg.append(S('line', { x1: left, x2: right, y1: y, y2: y, stroke: o.couleur, 'stroke-width': 0.35 }));
      if (i < nLines) for (let k = 1; k < 4; k++) svg.append(S('line', { x1: left, x2: right, y1: y + k * step, y2: y + k * step, stroke: o.couleur, 'stroke-width': 0.12 }));
    }
    const x0 = left + Number(o.marge);
    for (let x = x0; x <= right; x += il) svg.append(S('line', { x1: x, x2: x, y1: top, y2: top + nLines * il, stroke: o.couleur, 'stroke-width': 0.12 }));
    svg.append(S('line', { x1: x0, x2: x0, y1: top - 4, y2: top + nLines * il, stroke: o.marge_couleur, 'stroke-width': 0.4 }));
    // Découpage en lignes selon la largeur réellement mesurée dans la police.
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${size * 10}px "${font}", cursive`;
    const width = (t) => ctx.measureText(t).width / 10;
    const maxW = right - x0 - 3;
    const lines = [];
    for (const para of String(o.texte || '').split('\n')) {
      let cur = '';
      for (const w of para.split(/\s+/).filter(Boolean)) {
        const t = cur ? `${cur} ${w}` : w;
        if (cur && width(t) > maxW) { lines.push(cur); cur = w; } else cur = t;
      }
      lines.push(cur);
    }
    const gap = o.sauter ? 2 : 1;
    // Première ligne de base : la 2e ligne épaisse (laisse la place aux hampes).
    lines.forEach((t, i) => {
      const y = top + (1 + i * gap) * il;
      if (y > top + nLines * il || !t) return;
      svg.append(S('text', { x: x0 + 2, y, 'font-size': size, 'font-family': `"${font}", cursive`, fill: o.encre, 'data-line': i }, t));
    });
    return svg;
  },
  seyes(o) {
    const svg = page(state.title);
    const il = Number(o.interligne) || 8, top = 24, left = 10, right = PAGE.w - 10;
    for (let i = 0; i <= o.lignes; i++) {
      const y = top + i * il;
      if (y > PAGE.h - 10) break;
      svg.append(S('line', { x1: left, x2: right, y1: y, y2: y, stroke: o.couleur, 'stroke-width': 0.35 }));
      if (i < o.lignes) for (let k = 1; k < 4; k++) { const yy = y + k * il / 4; if (yy < PAGE.h - 10) svg.append(S('line', { x1: left, x2: right, y1: yy, y2: yy, stroke: o.couleur, 'stroke-width': 0.12 })); }
    }
    for (let x = left + Number(o.marge); x <= right; x += il) svg.append(S('line', { x1: x, x2: x, y1: top, y2: Math.min(top + o.lignes * il, PAGE.h - 10), stroke: o.couleur, 'stroke-width': 0.12 }));
    svg.append(S('line', { x1: left + Number(o.marge), x2: left + Number(o.marge), y1: top - 4, y2: Math.min(top + o.lignes * il, PAGE.h - 10), stroke: o.marge_couleur, 'stroke-width': 0.4 }));
    if (o.modele) svg.append(S('text', { x: left + Number(o.marge) + 2, y: top + il, 'font-size': (il / 4) / F.xHeightRatio('Marelle'), 'font-family': '"Marelle", cursive', fill: '#333' }, o.modele));
    return svg;
  },
  reglure(o) {
    const svg = page(state.title);
    const e = Number(o.ecart) || 10;
    for (let i = 0; i < o.lignes; i++) { const y = 28 + i * e; if (y > PAGE.h - 10) break; svg.append(S('line', { x1: 12, x2: PAGE.w - 12, y1: y, y2: y, stroke: o.couleur, 'stroke-width': 0.3 })); }
    return svg;
  },
  texte(o, corr) {
    const svg = page(state.title || 'Complète le texte.');
    const words = []; const txt = o.source.replace(/\[([^\]]+)\]/g, (_, w) => { words.push(w); return `\u0001${words.length - 1}\u0001`; });
    const fs = Number(o.taille) || 5; const lineH = fs * 2.2; const maxW = PAGE.w - 30;
    let x = 15, y = 32;
    const charW = fs * 0.52;
    for (const tok of txt.split(/(\u0001\d+\u0001|\s+)/).filter(t => t !== '')) {
      if (/^\s+$/.test(tok)) { x += charW; continue; }
      const blank = tok.match(/^\u0001(\d+)\u0001$/);
      const w = blank ? Math.max(28, words[+blank[1]].length * charW + 6) : tok.length * charW;
      if (x + w > 15 + maxW) { x = 15; y += lineH; }
      if (blank) {
        svg.append(S('line', { x1: x, x2: x + w, y1: y + 1.2, y2: y + 1.2, stroke: '#333', 'stroke-width': 0.3 }));
        if (corr) svg.append(S('text', { x: x + 2, y, 'font-size': fs, fill: '#c0392b', 'font-weight': 700 }, words[+blank[1]]));
      } else svg.append(S('text', { x, y, 'font-size': fs }, tok));
      x += w;
    }
    if (o.banque && words.length) {
      y += lineH * 2;
      svg.append(S('rect', { x: 15, y: y - fs * 1.4, width: maxW, height: fs * 2.4, fill: 'none', stroke: '#999', 'stroke-dasharray': '2 1.5', 'stroke-width': 0.3 }));
      svg.append(S('text', { x: 18, y, 'font-size': fs * 0.9 }, `Mots : ${[...words].sort((a, b) => a.localeCompare(b, 'fr')).join('  ·  ')}`));
    }
    return svg;
  },
  droite(o, corr) {
    const svg = page(state.title);
    const a = Number(o.debut), b = Number(o.fin), step = Number(o.pas) || 1, sub = Number(o.sous) || 0;
    const n = Math.max(1, Math.round((b - a) / step));
    const x0 = 15, x1 = PAGE.w - 15, len = x1 - x0;
    const nb = Math.min(10, Math.max(1, Number(o.nb) || 1));
    for (let r = 0; r < nb; r++) {
      const y = 45 + r * ((PAGE.h - 70) / nb);
      svg.append(S('line', { x1: x0 - 3, x2: x1 + 3, y1: y, y2: y, stroke: '#222', 'stroke-width': 0.5 }));
      svg.append(S('path', { d: `M${x1 + 3},${y} l-3,-1.6 l0,3.2 z`, fill: '#222' }));
      for (let i = 0; i <= n; i++) {
        const x = x0 + (i * len) / n;
        svg.append(S('line', { x1: x, x2: x, y1: y - 3, y2: y + 3, stroke: '#222', 'stroke-width': 0.4 }));
        if (sub > 1 && i < n) for (let k = 1; k < sub; k++) { const xx = x + (k * len) / n / sub; svg.append(S('line', { x1: xx, x2: xx, y1: y - 1.5, y2: y + 1.5, stroke: '#222', 'stroke-width': 0.2 })); }
        const v = +(a + i * step).toFixed(6);
        const show = corr || o.etiquettes === 'toutes' || (o.etiquettes === 'extrémités' && (i === 0 || i === n)) || (o.etiquettes === 'une sur deux' && i % 2 === 0);
        if (show) svg.append(S('text', { x, y: y + 9, 'font-size': 4.2, 'text-anchor': 'middle', fill: corr && !(o.etiquettes === 'toutes' || ((o.etiquettes === 'extrémités') && (i === 0 || i === n)) || (o.etiquettes === 'une sur deux' && i % 2 === 0)) ? '#c0392b' : '#222' }, String(v).replace('.', ',')));
      }
    }
    return svg;
  },
  numeration(o, corr) {
    const svg = page(state.title || 'Tableau de numération');
    const classes = o.classes.split(',').map(x => x.trim()).filter(Boolean).reverse();
    const cols = classes.flatMap(c => ['c', 'd', 'u'].map(k => ({ c, k })));
    const x0 = 15, w = (PAGE.w - 30) / cols.length, y0 = 30, rh = 12;
    classes.forEach((c, i) => {
      svg.append(S('rect', { x: x0 + i * 3 * w, y: y0, width: 3 * w, height: 9, fill: i % 2 ? '#eef3f1' : '#f6efe2', stroke: '#333', 'stroke-width': 0.3 }));
      svg.append(S('text', { x: x0 + i * 3 * w + 1.5 * w, y: y0 + 6.3, 'font-size': 4.5, 'text-anchor': 'middle', 'font-weight': 700 }, `classe des ${c}`));
    });
    cols.forEach((col, i) => { svg.append(S('rect', { x: x0 + i * w, y: y0 + 9, width: w, height: 8, fill: '#fff', stroke: '#333', 'stroke-width': 0.3 })); svg.append(S('text', { x: x0 + i * w + w / 2, y: y0 + 14.5, 'font-size': 4.5, 'text-anchor': 'middle' }, col.k)); });
    const nums = o.nombres.split(/[,;\s]+/).filter(Boolean);
    const rows = Math.max(Number(o.lignes) || 0, nums.length);
    for (let r = 0; r < rows; r++) {
      const y = y0 + 17 + r * rh;
      cols.forEach((col, i) => svg.append(S('rect', { x: x0 + i * w, y, width: w, height: rh, fill: 'none', stroke: '#333', 'stroke-width': i % 3 === 2 ? 0.5 : 0.25 })));
      const nstr = (nums[r] || '').replace(/\D/g, '');
      if (nstr && corr) [...nstr].reverse().forEach((d, k) => { const i = cols.length - 1 - k; if (i >= 0) svg.append(S('text', { x: x0 + i * w + w / 2, y: y + rh * 0.7, 'font-size': 6, 'text-anchor': 'middle', fill: '#c0392b', 'font-weight': 700 }, d)); });
      if (nums[r]) svg.append(S('text', { x: x0, y: y + rh + 5.5, 'font-size': 3.6, fill: '#555' }, `${r + 1}. ${Number(nstr).toLocaleString('fr-FR')}`));
    }
    return svg;
  },
  fractions(o, corr) {
    const svg = page(state.title || 'Colorie la fraction demandée.');
    const list = o.liste.split(',').map(x => x.trim()).filter(x => /^\d+\/\d+$/.test(x)).slice(0, 12);
    list.forEach((f, i) => {
      const [num, den] = f.split('/').map(Number);
      const col = i % 2, row = Math.floor(i / 2);
      const x = 15 + col * 95, y = 30 + row * 42;
      svg.append(S('text', { x, y: y + 4, 'font-size': 6, 'font-weight': 700 }, f));
      const fill = (k) => (corr && k < num ? '#f2c14e' : '#fff');
      if (o.forme === 'disque') {
        const cx = x + 50, cy = y + 16, r = 15;
        for (let k = 0; k < den; k++) {
          const a0 = (k / den) * 2 * Math.PI - Math.PI / 2, a1 = ((k + 1) / den) * 2 * Math.PI - Math.PI / 2;
          const d = den === 1 ? null : `M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z`;
          svg.append(d ? S('path', { d, fill: fill(k), stroke: '#333', 'stroke-width': 0.35 }) : S('circle', { cx, cy, r, fill: fill(k), stroke: '#333', 'stroke-width': 0.35 }));
        }
      } else {
        const bw = 72, bh = 12, bx = x + 14, by = y + 10;
        for (let k = 0; k < den; k++) svg.append(S('rect', { x: bx + (k * bw) / den, y: by, width: bw / den, height: bh, fill: fill(k), stroke: '#333', 'stroke-width': 0.35 }));
      }
    });
    return svg;
  },
  horloges(o, corr) {
    const svg = page(state.title || (o.aiguilles ? 'Écris l’heure.' : 'Dessine les aiguilles.'));
    const times = o.heures.split(',').map(x => x.trim()).filter(x => /^\d{1,2}[:h]\d{2}$/.test(x)).slice(0, 12);
    times.forEach((t, i) => {
      const [hh, mm] = t.split(/[:h]/).map(Number);
      const col = i % 3, row = Math.floor(i / 3);
      const cx = 40 + col * 65, cy = 55 + row * 62, r = 24;
      svg.append(S('circle', { cx, cy, r, fill: '#fff', stroke: '#222', 'stroke-width': 0.6 }));
      for (let k = 0; k < 60; k++) { const a = (k / 60) * 2 * Math.PI; const r1 = k % 5 ? r - 1.5 : r - 3; svg.append(S('line', { x1: cx + r1 * Math.sin(a), y1: cy - r1 * Math.cos(a), x2: cx + r * Math.sin(a), y2: cy - r * Math.cos(a), stroke: '#222', 'stroke-width': k % 5 ? 0.15 : 0.45 })); }
      if (o.numeros) for (let n = 1; n <= 12; n++) { const a = (n / 12) * 2 * Math.PI; svg.append(S('text', { x: cx + (r - 7) * Math.sin(a), y: cy - (r - 7) * Math.cos(a) + 1.6, 'font-size': 4.2, 'text-anchor': 'middle' }, String(n))); }
      const hands = o.aiguilles || corr;
      if (hands) {
        const am = (mm / 60) * 2 * Math.PI, ah = (((hh % 12) + mm / 60) / 12) * 2 * Math.PI;
        const c = corr && !o.aiguilles ? '#c0392b' : '#222';
        svg.append(S('line', { x1: cx, y1: cy, x2: cx + (r - 6) * Math.sin(am), y2: cy - (r - 6) * Math.cos(am), stroke: c, 'stroke-width': 0.9, 'stroke-linecap': 'round' }));
        svg.append(S('line', { x1: cx, y1: cy, x2: cx + (r - 12) * Math.sin(ah), y2: cy - (r - 12) * Math.cos(ah), stroke: c, 'stroke-width': 1.5, 'stroke-linecap': 'round' }));
      }
      svg.append(S('circle', { cx, cy, r: 0.9, fill: '#222' }));
      const label = (!o.aiguilles || corr) ? `${hh} h ${String(mm).padStart(2, '0')}` : '';
      svg.append(S('text', { x: cx, y: cy + r + 7, 'font-size': 4.5, 'text-anchor': 'middle', fill: corr && o.aiguilles ? '#c0392b' : '#222' }, o.aiguilles && !corr ? '…… h ……' : label));
    });
    return svg;
  },
};

const PARAMS = {
  ecriture: [['texte', 'Texte à écrire (Entrée = nouvelle ligne)', 'textarea'], ['police', 'Police', 'font'], ['hauteur', 'Hauteur des minuscules', [['1', '1 interligne (cahier)'], ['2', '2 interlignes (grand)']]], ['ajuste', 'Ajustement de la taille (%)', 'number'], ['sauter', 'Sauter une ligne entre deux lignes écrites', 'checkbox'], ['interligne', 'Interligne (mm)', 'number'], ['marge', 'Marge (mm)', 'number'], ['encre', 'Couleur de l’écriture', 'color'], ['couleur', 'Couleur des lignes', 'color']],
  seyes: [['interligne', 'Interligne (mm)', 'number'], ['lignes', 'Nombre de lignes', 'number'], ['marge', 'Marge (mm)', 'number'], ['couleur', 'Couleur des lignes', 'color'], ['marge_couleur', 'Couleur de la marge', 'color'], ['modele', 'Modèle d’écriture (1re ligne)', 'text']],
  reglure: [['ecart', 'Écart entre les lignes (mm)', 'number'], ['lignes', 'Nombre de lignes', 'number'], ['couleur', 'Couleur', 'color']],
  texte: [['source', 'Texte (mettez les mots à trouver entre [crochets])', 'textarea'], ['taille', 'Taille du texte (mm)', 'number'], ['banque', 'Banque de mots', 'checkbox']],
  droite: [['debut', 'Début', 'number'], ['fin', 'Fin', 'number'], ['pas', 'Pas', 'number'], ['sous', 'Subdivisions entre deux graduations', 'number'], ['etiquettes', 'Nombres affichés', ['extrémités', 'une sur deux', 'toutes', 'aucun']], ['nb', 'Droites par page', 'number']],
  numeration: [['classes', 'Classes (séparées par des virgules)', 'text'], ['nombres', 'Nombres à placer (facultatif)', 'text'], ['lignes', 'Lignes vides', 'number']],
  fractions: [['liste', 'Fractions (ex. 1/2, 3/4)', 'text'], ['forme', 'Forme', ['barre', 'disque']]],
  horloges: [['heures', 'Heures (ex. 08:15, 14:30)', 'text'], ['aiguilles', 'Aiguilles dessinées (sinon l’élève les dessine)', 'checkbox'], ['numeros', 'Chiffres sur le cadran', 'checkbox']],
};

export function render({ rerender }) {
  const o = state[state.tool];
  const preview = h('div', { class: 'atelier-preview', 'data-testid': 'atelier-preview' });
  const redraw = () => preview.replaceChildren(DRAW[state.tool](o, state.correction));
  const params = h('div', { class: 'form' },
    field('Titre (facultatif)', h('input', { value: state.title, oninput: (e) => { state.title = e.target.value; redraw(); } })),
    PARAMS[state.tool].map(([k, label, type]) => {
      if (Array.isArray(type)) return field(label, h('select', { 'data-testid': `p-${k}`, onchange: (e) => { o[k] = e.target.value; redraw(); } }, type.map(v => { const [val, lab] = Array.isArray(v) ? v : [v, v]; return h('option', { value: val, selected: String(o[k]) === val }, lab); })));
      if (type === 'font') return fontField(o, rerender);
      if (type === 'checkbox') return h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: !!o[k], onchange: (e) => { o[k] = e.target.checked; redraw(); } }), label);
      if (type === 'textarea') return field(label, h('textarea', { rows: 5, 'data-testid': `p-${k}`, oninput: (e) => { o[k] = e.target.value; redraw(); } }, o[k]));
      return field(label, h('input', { type, value: o[k], step: type === 'number' ? 'any' : null, 'data-testid': `p-${k}`, oninput: (e) => { o[k] = type === 'number' ? Number(e.target.value) : e.target.value; redraw(); } }));
    }),
    ['texte', 'droite', 'numeration', 'fractions', 'horloges'].includes(state.tool) ? h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: state.correction, 'data-testid': 'correction', onchange: (e) => { state.correction = e.target.checked; redraw(); } }), 'Version corrigée') : null);
  redraw();
  return h('div', { class: 'page' },
    pageHeader('Atelier pédagogique', { favKey: 'preparer/atelier', subtitle: 'Supports imprimables à taille réelle, avec correction séparée', actions: [
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'atelier-print', onclick: () => printSvg(DRAW[state.tool](o, state.correction)) }, icon('print', 16), 'Imprimer (A4)'),
      h('button', { class: 'btn', type: 'button', 'data-testid': 'atelier-save', onclick: () => saveSupport(o) }, icon('download', 16), 'Enregistrer comme support'),
      h('button', { class: 'btn', type: 'button', onclick: () => animate(DRAW[state.tool](o, state.correction)) }, 'Afficher en grand')] }),
    subTabs(),
    h('div', { class: 'seg wrap', role: 'group', 'aria-label': 'Outil' }, TOOLS.map(([k, l]) => h('button', { type: 'button', class: state.tool === k ? 'on' : '', 'data-testid': `tool-${k}`, onclick: () => { state.tool = k; state.correction = false; rerender(); } }, l))),
    h('div', { class: 'atelier' }, h('section', { class: 'card' }, params), h('section', { class: 'card' }, preview)),
    h('p', { class: 'muted small' }, 'Imprimez à 100 % (« taille réelle », sans « ajuster à la page ») pour conserver les dimensions en millimètres. « Afficher en grand » permet d’écrire au doigt ou au stylet par-dessus (TNI, tablette). Géométrie, cartes, jeux et anglais arrivent à l’étape 4.'));
}

function currentFont(o) {
  const names = F.available().map(f => f[0]);
  return names.includes(o.police) ? o.police : names[0];
}

/** Choix de la police + import d'un fichier de police (Marelle, téléchargée gratuitement sur le site du ministère). */
function fontField(o, rerender) {
  const font = currentFont(o);
  const input = h('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2', hidden: true, 'data-testid': 'font-file', onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { o.police = await F.importFont(f); toast(`Police « ${o.police} » installée sur cet appareil`); rerender(); } catch (err) { toast(err.message, { kind: 'error' }); }
  } });
  return h('div', {},
    field('Police', h('select', { 'data-testid': 'p-police', onchange: (e) => { o.police = e.target.value; rerender(); } }, F.available().map(([v, l]) => h('option', { value: v, selected: v === font }, l)))),
    h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'font-import', onclick: () => input.click() }, icon('download', 14), 'Importer une autre police (.ttf, .otf, .woff2)'), input,
    h('p', { class: 'muted small' }, 'Polices Marelle © ministère de l’Éducation nationale, licence libre SIL OFL 1.1 (fichier fonts/OFL.txt).'),
    null);
}

function printSvg(svg) {
  const root = document.getElementById('print-root');
  document.getElementById('page-style')?.remove();
  document.head.append(h('style', { id: 'page-style' }, '@page { size: A4 portrait; margin: 0; }'));
  root.replaceChildren(h('div', { class: 'atelier-print' }, svg));
  document.body.classList.add('printing');
  const cleanup = () => { document.body.classList.remove('printing'); root.replaceChildren(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

async function saveSupport(o) {
  const name = `${TOOLS.find(t => t[0] === state.tool)[1]}${state.title ? ' — ' + state.title : ''}`;
  const blobs = [[name, DRAW[state.tool](o, false)]];
  if (['texte', 'droite', 'numeration', 'fractions', 'horloges'].includes(state.tool)) blobs.push([`${name} (correction)`, DRAW[state.tool](o, true)]);
  const cls = model.currentClass();
  const sessions = cls ? P.ofClass('session', cls.id) : [];
  const sel = sessions.length ? await pickMany({ title: 'Lier à une fiche de séance ? (facultatif : « Valider » sans choix pour seulement enregistrer)', single: true, items: sessions.map(s => ({ id: s.id, label: P.sessionTitle(s), detail: s.subject })), emptyText: '' }) : [];
  if (sel === null) return;
  const items = [];
  const ids = [];
  for (const [n, svg] of blobs) {
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const blobId = await store.putBlob(blob);
    const id = store.uid(); ids.push(id);
    items.push({ create: { type: 'file', data: { id, kind: 'blob', name: `${n}.svg`, folderId: null, tags: ['atelier', state.tool], subject: '', level: '', favorite: false, studentIds: [], yearId: model.currentYear()?.id || null, versions: [{ blobId, name: `${n}.svg`, size: blob.size, mime: 'image/svg+xml', at: new Date().toISOString(), params: structuredClone(o) }] } } });
  }
  if (sel?.length) { const s = store.get(sel[0]); items.push({ id: s.id, patch: { fileIds: [...(s.fileIds || []), ...ids] } }); }
  await store.batch(items, `Support « ${name} » enregistré`);
  toast(`Enregistré dans Fichiers${sel?.length ? ' et lié à la séance' : ''}`, { action: 'Voir', onAction: () => { location.hash = '#/fichiers'; } });
}

/** Affichage en grand, avec annotation au doigt ou à la souris (non enregistrée). */
export function animate(content) {
  const wrap = h('div', { class: 'animate' });
  const board = h('div', { class: 'animate-board' }, content);
  const canvas = h('canvas', { class: 'animate-ink' });
  let color = '#d9534f', drawing = false, ctx;
  const fit = () => { canvas.width = board.clientWidth; canvas.height = board.clientHeight; ctx = canvas.getContext('2d'); ctx.lineCap = 'round'; ctx.lineWidth = 4; };
  canvas.addEventListener('pointerdown', (e) => { drawing = true; ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drawing) return; ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); });
  canvas.addEventListener('pointerup', () => { drawing = false; });
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.append(board, canvas, h('div', { class: 'animate-bar' },
    ['#d9534f', '#2f6f8f', '#222'].map(c => h('button', { type: 'button', class: 'swatch', style: { background: c }, 'aria-label': `Crayon ${c}`, onclick: () => { color = c; } })),
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => ctx.clearRect(0, 0, canvas.width, canvas.height) }, 'Effacer l’annotation'),
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => (document.fullscreenElement ? document.exitFullscreen() : wrap.requestFullscreen?.()) }, 'Plein écran'),
    h('button', { class: 'btn btn-small btn-primary', type: 'button', onclick: close }, 'Fermer')));
  document.body.append(wrap);
  requestAnimationFrame(fit);
  window.addEventListener('resize', fit, { once: true });
  void modal;
}
