// Plan de classe visuel (mobilier, tableau, porte, zones ; déplacement et rotation à la souris
// ou au doigt) et groupes. Plusieurs dispositions nommées par classe, associables à une
// période ou une séance, sans écraser les précédentes.
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import * as PL from '../planning.js';
import * as G from '../groups.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { bound, pickMany, iconBtn } from '../forms.js';
import { printDocument } from '../print.js';

let tab = 'plan';
let selLayout = null;
let selItem = null;
let selSet = null;
const W = 1000, H = 700; // salle par défaut : 10 m × 7 m (1 unité = 1 cm)
const roomOf = (lay) => ({ w: lay?.room?.w || W, h: lay?.room?.h || H });

const ITEM = {
  table: { label: 'Table', w: 120, h: 60, seats: 2, fill: '#f3e7cf', group: 'Mobilier' },
  bureau: { label: 'Bureau', w: 140, h: 70, seats: 0, fill: '#d9cbb0', group: 'Mobilier' },
  tableau: { label: 'Tableau', w: 300, h: 20, seats: 0, fill: '#2f5d50', group: 'Mobilier' },
  tni: { label: 'TNI / écran', w: 200, h: 16, seats: 0, fill: '#3b4a5a', group: 'Mobilier' },
  porte: { label: 'Porte', w: 90, h: 14, seats: 0, fill: '#9a8a70', group: 'Mobilier' },
  fenetre: { label: 'Fenêtre', w: 150, h: 12, seats: 0, fill: '#bcd9ea', group: 'Mobilier' },
  etagere: { label: 'Étagère', w: 120, h: 40, seats: 0, fill: '#c9b48f', group: 'Rangements' },
  armoire: { label: 'Armoire', w: 100, h: 60, seats: 0, fill: '#b39a74', group: 'Rangements' },
  bacs: { label: 'Meuble à bacs', w: 80, h: 45, seats: 0, fill: '#e2c9a0', group: 'Rangements' },
  casiers: { label: 'Casiers', w: 160, h: 40, seats: 0, fill: '#d8c3a5', group: 'Rangements' },
  portemanteaux: { label: 'Porte-manteaux', w: 200, h: 15, seats: 0, fill: '#a58f6c', group: 'Rangements' },
  biblio: { label: 'Bibliothèque', w: 160, h: 40, seats: 0, fill: '#c2a679', group: 'Rangements' },
  evier: { label: 'Évier', w: 80, h: 50, seats: 0, fill: '#d6e4ea', group: 'Rangements' },
  ordinateur: { label: 'Poste informatique', w: 80, h: 60, seats: 1, fill: '#e3e3e8', group: 'Rangements' },
  zone: { label: 'Zone', w: 220, h: 160, seats: 0, fill: 'rgba(47,111,143,.08)', group: 'Espaces' },
  regroupement: { label: 'Coin regroupement', w: 250, h: 200, seats: 0, fill: 'rgba(214,138,60,.10)', group: 'Espaces' },
  coinlecture: { label: 'Coin lecture', w: 200, h: 160, seats: 0, fill: 'rgba(98,160,90,.10)', group: 'Espaces' },
};
const AREA = new Set(['zone', 'regroupement', 'coinlecture']);
const mk = (kind, x, y, extra = {}) => ({ id: store.uid(), kind, x, y, w: ITEM[kind].w, h: ITEM[kind].h, rot: 0, seats: ITEM[kind].seats, label: '', ...extra });

export const TEMPLATES = {
  'rangées': () => { const it = [mk('tableau', 350, 20), mk('bureau', 80, 40), mk('porte', 900, 680)]; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) it.push(mk('table', 160 + c * 260, 150 + r * 130)); return it; },
  'binômes': () => { const it = [mk('tableau', 350, 20), mk('bureau', 80, 40), mk('porte', 900, 680)]; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) it.push(mk('table', 70 + c * 230, 170 + r * 160)); return it; },
  'îlots': () => { const it = [mk('tableau', 350, 20), mk('bureau', 80, 40), mk('porte', 900, 680)]; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) it.push(mk('table', 120 + c * 300, 180 + r * 250, { w: 160, h: 110, seats: 4, label: `Îlot ${r * 3 + c + 1}` })); return it; },
  'U': () => { const it = [mk('tableau', 350, 20), mk('bureau', 440, 300), mk('porte', 900, 680)];
    for (let i = 0; i < 4; i++) it.push(mk('table', 80, 140 + i * 120, { rot: 90 }), mk('table', 800, 140 + i * 120, { rot: 90 }));
    for (let i = 0; i < 4; i++) it.push(mk('table', 200 + i * 150, 600)); return it; },
  'ateliers': () => { const it = [mk('tableau', 350, 20), mk('porte', 900, 680)];
    [[60, 100], [540, 100], [60, 400], [540, 400]].forEach(([x, y], i) => it.push(mk('zone', x, y, { w: 400, h: 260, label: `Atelier ${i + 1}` }), mk('table', x + 110, y + 90, { w: 180, h: 90, seats: 6 }))); return it; },
  'libre': () => [mk('tableau', 350, 20), mk('porte', 900, 680)],
};

export function render({ rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Plan de classe et groupes'), subTabs(), missing);
  const tabs = h('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' }, [['plan', 'Plan de classe'], ['groupes', 'Groupes']].map(([k, l]) => h('button', { type: 'button', class: tab === k ? 'on' : '', 'data-testid': `plan-tab-${k}`, onclick: () => { tab = k; rerender(); } }, l)));
  return h('div', { class: 'page' }, pageHeader('Plan de classe et groupes', { favKey: 'classe/plan', subtitle: cls.name }), subTabs(), tabs,
    tab === 'groupes' ? groupsView(cls, rerender) : planView(cls, rerender));
}

// ───────── Plan de classe
function planView(cls, rerender) {
  const layouts = store.all('layout').filter(l => l.classId === cls.id).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const lay = layouts.find(l => l.id === selLayout) || layouts.at(-1) || null;
  const year = store.get(cls.yearId); const periods = model.periodsOf(year);
  const students = model.studentsOfClass(cls.id).map(x => x.student);
  const head = h('div', { class: 'row' },
    layouts.length ? h('select', { 'aria-label': 'Disposition', 'data-testid': 'layout-select', onchange: (e) => { selLayout = e.target.value; selItem = null; rerender(); } }, layouts.map(l => h('option', { value: l.id, selected: lay && l.id === lay.id }, `${l.name}${l.periodId ? ' · ' + model.periodLabel(year, l.periodId) : ''}`))) : null,
    h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-layout', onclick: () => newLayout(cls, lay) }, icon('plus', 16), 'Nouvelle disposition'));
  if (!lay) return h('div', { class: 'stack' }, head, emptyState('Aucune disposition', 'Choisissez un modèle (rangées, binômes, îlots, U, ateliers, libre) puis ajustez au doigt ou à la souris.'));

  const placed = new Set(Object.values(lay.seats || {}).flat().filter(Boolean));
  const unplaced = students.filter(s => !placed.has(s.id));
  const host = h('div', { class: 'plan-host' });
  const sel = (lay.items || []).find(i => i.id === selItem);
  const saveItems = (items, label, quiet = true) => store.update(lay.id, { items }, label, { quiet });
  const room = roomOf(lay);
  const groups = [...new Set(Object.values(ITEM).map(d => d.group))];
  const addSel = h('select', { 'aria-label': 'Ajouter un élément', 'data-testid': 'add-item', onchange: (e) => { const k = e.target.value; if (k) addItem(k); } },
    h('option', { value: '' }, '+ Ajouter…'), groups.map(g => h('optgroup', { label: g }, Object.entries(ITEM).filter(([, d]) => d.group === g).map(([k, d]) => h('option', { value: k }, d.label)))));
  // Nouvel élément : au centre, décalé s'il y en a déjà un au même endroit ; sélectionné tout de suite.
  const addItem = async (k) => { const n = (lay.items || []).length % 8; const it = mk(k, Math.round(room.w / 2 / 10) * 10 - 60 + n * 30, Math.round(room.h / 2 / 10) * 10 - 30 + n * 20); selItem = it.id; await saveItems([...(lay.items || []), it], `${ITEM[k].label} ajouté(e)`, false); };
  const num = (label, value, onSave, testid) => h('label', { class: 'inline small' }, label, h('input', { type: 'number', min: 10, step: 10, value, style: { width: '5.5em' }, 'data-testid': testid, onchange: (e) => { const v = Math.max(10, Math.round(Number(e.target.value) / 10) * 10 || 10); onSave(v); } }));
  const toolbar = h('div', { class: 'row plan-tools' },
    addSel,
    ['table', 'etagere', 'armoire', 'zone'].map(k => h('button', { class: 'btn btn-small', type: 'button', 'data-testid': `add-${k}`, onclick: () => addItem(k) }, ITEM[k].label)),
    sel ? h('span', { class: 'row sel-tools' }, h('strong', {}, ITEM[sel.kind]?.label || 'Élément'),
      num('L (cm)', sel.w, (v) => saveItems(lay.items.map(i => i.id === sel.id ? { ...i, w: v } : i), 'Taille', false), 'item-w'),
      num('P (cm)', sel.h, (v) => saveItems(lay.items.map(i => i.id === sel.id ? { ...i, h: v } : i), 'Taille', false), 'item-h'),
      h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'rotate', onclick: () => saveItems(lay.items.map(i => i.id === sel.id ? { ...i, rot: ((i.rot || 0) + 90) % 360 } : i), 'Rotation', false) }, '↻ 90°'),
      sel.kind === 'table' ? [h('button', { class: 'btn btn-small', type: 'button', onclick: () => saveItems(lay.items.map(i => i.id === sel.id ? { ...i, seats: Math.max(1, i.seats - 1) } : i), 'Places', false) }, '− place'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => saveItems(lay.items.map(i => i.id === sel.id ? { ...i, seats: Math.min(8, i.seats + 1), w: Math.max(i.w, (i.seats + 1) * 60) } : i), 'Places', false) }, '+ place')] : null,
      h('input', { value: sel.label || '', placeholder: 'étiquette', 'aria-label': 'Étiquette', style: { width: '120px' }, onchange: (e) => saveItems(lay.items.map(i => i.id === sel.id ? { ...i, label: e.target.value } : i), 'Étiquette', false) }),
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => { const c = { ...sel, id: store.uid(), x: sel.x + 30, y: sel.y + 30 }; selItem = c.id; saveItems([...lay.items, c], 'Élément dupliqué', false); } }, 'Dupliquer'),
      h('button', { class: 'btn btn-small btn-ghost-danger', type: 'button', onclick: async () => { const seats = { ...(lay.seats || {}) }; delete seats[sel.id]; selItem = null; await store.update(lay.id, { items: lay.items.filter(i => i.id !== sel.id), seats }, 'Élément supprimé (élèves remis à placer)'); } }, 'Supprimer')) : h('span', { class: 'muted small' }, 'Cliquez sur un élément pour le modifier ; glissez pour le déplacer ; tirez le coin orange pour l’agrandir ; cliquez sur une place pour y mettre un élève.'));
  const roomRow = h('div', { class: 'row small plan-room' }, h('strong', {}, 'Salle :'),
    num('largeur (cm)', room.w, (v) => store.update(lay.id, { room: { ...roomOf(store.get(lay.id)), w: Math.min(3000, v) } }, 'Taille de la salle'), 'room-w'),
    num('profondeur (cm)', room.h, (v) => store.update(lay.id, { room: { ...roomOf(store.get(lay.id)), h: Math.min(3000, v) } }, 'Taille de la salle'), 'room-h'),
    h('span', { class: 'muted' }, `${(room.w / 100).toLocaleString('fr')} m × ${(room.h / 100).toLocaleString('fr')} m · 1 carreau = 1 m`));

  const draw = () => host.replaceChildren(svgPlan(store.get(lay.id), cls, { editable: true, selected: selItem, onSelect: (id) => { selItem = id; rerender(); },
    onMove: (id, x, y) => saveItems(store.get(lay.id).items.map(i => i.id === id ? { ...i, x, y } : i), 'Déplacement'),
    onResize: (id, w, hh) => saveItems(store.get(lay.id).items.map(i => i.id === id ? { ...i, w, h: hh } : i), 'Taille', false),
    onSeat: (itemId, idx) => seatDialog(store.get(lay.id), itemId, idx, students) }));
  draw();

  return h('div', { class: 'stack' }, head,
    h('section', { class: 'card' },
      h('div', { class: 'grid-3' },
        bound({ label: 'Nom de la disposition', type: 'text', value: lay.name, onSave: (v) => store.update(lay.id, { name: v || 'Disposition' }, 'Nom de la disposition') }),
        bound({ label: 'Période associée', type: 'select', value: lay.periodId || '', options: [['', '—'], ...periods.map((p, i) => [p.id, `P${i + 1}`])], onSave: (v) => store.update(lay.id, { periodId: v || null }, 'Période de la disposition') }),
        bound({ label: 'Séance associée (facultatif)', type: 'select', value: lay.sessionId || '', options: [['', '—'], ...P.ofClass('session', cls.id).map(s => [s.id, P.sessionTitle(s)])], onSave: (v) => store.update(lay.id, { sessionId: v || null }, 'Séance de la disposition') })),
      toolbar, roomRow, host,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'auto-place', onclick: () => autoPlace(lay, students, false) }, 'Placer les élèves non placés (ordre alphabétique)'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => autoPlace(lay, students, true) }, 'Placement aléatoire (tout)'),
        layouts.length > 1 ? h('select', { 'aria-label': 'Reprendre les places d’une autre disposition', onchange: async (e) => { const src = store.get(e.target.value); if (src) await copySeats(src, lay); e.target.value = ''; } },
          h('option', { value: '' }, 'Reprendre les places de…'), layouts.filter(l => l.id !== lay.id).map(l => h('option', { value: l.id }, l.name))) : null,
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'print-plan', onclick: () => printDocument(h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, `Plan de classe — ${lay.name}`), h('p', {}, cls.name)), svgPlan(store.get(lay.id), cls, {})), { orientation: 'landscape' }) }, icon('print', 14), 'Imprimer'),
        h('button', { class: 'btn btn-small btn-ghost-danger', type: 'button', onclick: async () => { if (!await confirmDialog('Mettre la disposition à la corbeille ?', 'Les autres dispositions ne changent pas.', { confirmLabel: 'Mettre à la corbeille', danger: true })) return; await store.remove(lay.id, 'Disposition mise à la corbeille'); selLayout = null; } }, 'Supprimer la disposition')),
      unplaced.length ? h('p', { class: 'small' }, h('strong', {}, `À placer (${unplaced.length}) : `), unplaced.map(s => s.firstName).join(', ')) : h('p', { class: 'small muted' }, 'Tous les élèves sont placés.')));
}

/** Dessin SVG d'une disposition. Les élèves sont identifiés par leur prénom uniquement. */
export function svgPlan(lay, cls, { editable = false, selected = null, onSelect, onMove, onSeat, onResize } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  const { w: RW, h: RH } = roomOf(lay);
  const svg = el('svg', { viewBox: `0 0 ${RW} ${RH}`, class: `plan-svg ${editable ? 'editable' : ''}`, role: 'img', 'aria-label': `Plan de classe ${lay.name}`, 'data-testid': 'plan-svg', style: `aspect-ratio: ${RW} / ${RH}` });
  svg.append(el('rect', { x: 0, y: 0, width: RW, height: RH, fill: '#fff', stroke: '#c9c2b4' }));
  if (editable) { const grid = el('g', { stroke: '#eee6da', 'stroke-width': 1 }); for (let x = 100; x < RW; x += 100) grid.append(el('line', { x1: x, x2: x, y1: 0, y2: RH })); for (let y = 100; y < RH; y += 100) grid.append(el('line', { x1: 0, x2: RW, y1: y, y2: y })); svg.append(grid); }
  const ordered = [...(lay.items || [])].sort((a, b) => (AREA.has(a.kind) ? -1 : 0) - (AREA.has(b.kind) ? -1 : 0));
  for (const it of ordered) {
    const def = ITEM[it.kind] || ITEM.zone;
    const g = el('g', { transform: `translate(${it.x} ${it.y}) rotate(${it.rot || 0} ${it.w / 2} ${it.h / 2})`, class: `plan-item ${selected === it.id ? 'sel' : ''}`, 'data-id': it.id, 'data-testid': `plan-item-${it.kind}` });
    g.append(el('rect', { width: it.w, height: it.h, rx: 6, fill: def.fill, stroke: selected === it.id ? '#e0a020' : '#8a7a60', 'stroke-width': selected === it.id ? 4 : 1.5, 'stroke-dasharray': AREA.has(it.kind) ? '8 6' : null }));
    const fs = Math.max(9, Math.min(15, it.h - 4, (it.w - 6) / Math.max(4, (it.label || def.label).length * 0.55)));
    if (it.label || it.kind !== 'table') g.append(el('text', { x: it.w / 2, y: AREA.has(it.kind) ? 22 : it.seats ? 17 : it.h / 2 + fs / 3, 'text-anchor': 'middle', 'font-size': fs, fill: ['tableau', 'tni'].includes(it.kind) ? '#fff' : '#555' }, it.label || def.label));
    const seats = it.seats || 0;
    for (let k = 0; k < seats; k++) {
      const sw = it.w / seats;
      const sid = lay.seats?.[it.id]?.[k];
      const s = sid ? store.get(sid) : null;
      const seat = el('g', { class: 'plan-seat', 'data-seat': `${it.id}:${k}`, 'data-testid': 'plan-seat' });
      seat.append(el('rect', { x: k * sw + 4, y: it.label ? 24 : 4, width: sw - 8, height: it.label ? it.h - 28 : it.h - 8, rx: 4, fill: s ? '#ffffff' : 'rgba(255,255,255,.55)', stroke: '#b9a98a' }));
      seat.append(el('text', { x: k * sw + sw / 2, y: (it.label ? 24 + (it.h - 28) / 2 : it.h / 2) + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': s ? 700 : 400, fill: s ? '#1f2a27' : '#a99' }, s ? s.firstName : '+'));
      g.append(seat);
    }
    if (editable && selected === it.id) g.append(el('rect', { class: 'plan-resize', x: it.w - 9, y: it.h - 9, width: 18, height: 18, rx: 3, fill: '#e0a020', stroke: '#fff', 'stroke-width': 2, 'data-testid': 'plan-resize' }));
    svg.append(g);
  }
  if (!editable) return svg;
  let drag = null;
  const pt = (e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  svg.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('.plan-item'); if (!g) { onSelect && onSelect(null); return; }
    const it = lay.items.find(i => i.id === g.dataset.id); const p = pt(e);
    drag = { it, g, dx: p.x - it.x, dy: p.y - it.y, moved: false, seat: e.target.closest('.plan-seat')?.dataset.seat, resize: e.target.classList.contains('plan-resize') };
    svg.setPointerCapture(e.pointerId); e.preventDefault();
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return; const p = pt(e);
    if (drag.resize) {
      const sp = svg.createSVGPoint(); sp.x = e.clientX; sp.y = e.clientY; const loc = sp.matrixTransform(drag.g.getScreenCTM().inverse());
      drag.nw = Math.max(20, Math.round(loc.x / 10) * 10); drag.nh = Math.max(10, Math.round(loc.y / 10) * 10); drag.moved = true;
      const r = drag.g.querySelector('rect'); r.setAttribute('width', drag.nw); r.setAttribute('height', drag.nh);
      const hd = drag.g.querySelector('.plan-resize'); hd.setAttribute('x', drag.nw - 9); hd.setAttribute('y', drag.nh - 9);
      return;
    }
    const x = Math.round((p.x - drag.dx) / 10) * 10, y = Math.round((p.y - drag.dy) / 10) * 10;
    if (Math.abs(x - drag.it.x) + Math.abs(y - drag.it.y) > 4) drag.moved = true;
    if (!drag.moved) return;
    drag.nx = Math.min(Math.max(-20, x), RW - 40); drag.ny = Math.min(Math.max(-20, y), RH - 20);
    drag.g.setAttribute('transform', `translate(${drag.nx} ${drag.ny}) rotate(${drag.it.rot || 0} ${drag.it.w / 2} ${drag.it.h / 2})`);
  });
  const end = () => {
    if (!drag) return; const d = drag; drag = null;
    if (d.resize) { if (d.moved && onResize) onResize(d.it.id, d.nw, d.nh); return; }
    if (d.moved) { onMove && onMove(d.it.id, d.nx, d.ny); d.it.x = d.nx; d.it.y = d.ny; }
    else if (d.seat && onSeat) { const [iid, k] = d.seat.split(':'); onSeat(iid, Number(k)); }
    else onSelect && onSelect(d.it.id);
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', () => { drag = null; });
  return svg;
}

function seatDialog(lay, itemId, idx, students) {
  const cur = lay.seats?.[itemId]?.[idx] || null;
  const placed = new Set(Object.values(lay.seats || {}).flat().filter(Boolean));
  let m;
  const pick = async (sid) => {
    const seats = structuredClone(lay.seats || {});
    for (const k of Object.keys(seats)) seats[k] = seats[k].map(x => (x === sid ? null : x)); // un élève n'a qu'une place
    const arr = seats[itemId] || []; arr[idx] = sid; seats[itemId] = arr;
    await store.update(lay.id, { seats }, sid ? `${store.get(sid).firstName} placé(e)` : 'Place libérée');
    m.close();
  };
  m = modal({ title: 'Qui s’assoit ici ?', body: h('div', { class: 'quick-list' },
    cur ? h('button', { class: 'quick-item', type: 'button', onclick: () => pick(null) }, h('strong', {}, 'Libérer la place'), h('span', { class: 'muted' }, store.get(cur)?.firstName)) : null,
    students.sort((a, b) => placed.has(a.id) - placed.has(b.id)).map(s => h('button', { class: 'quick-item', type: 'button', 'data-testid': 'seat-student', onclick: () => pick(s.id) }, h('strong', {}, `${s.firstName} ${s.lastName}`), h('span', { class: 'muted' }, placed.has(s.id) ? 'déjà placé(e) : sera déplacé(e)' : 'à placer')))) });
}

async function autoPlace(lay, students, shuffle) {
  const seats = shuffle ? {} : structuredClone(lay.seats || {});
  const placed = new Set(Object.values(seats).flat().filter(Boolean));
  let todo = students.filter(s => !placed.has(s.id)).map(s => s.id);
  if (shuffle) for (let i = todo.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [todo[i], todo[j]] = [todo[j], todo[i]]; }
  for (const it of (lay.items || []).filter(i => i.seats)) {
    const arr = seats[it.id] || [];
    for (let k = 0; k < it.seats && todo.length; k++) if (!arr[k]) arr[k] = todo.shift();
    seats[it.id] = arr;
  }
  await store.update(lay.id, { seats }, shuffle ? 'Placement aléatoire' : 'Placement des élèves');
  if (todo.length) toast(`${todo.length} élève(s) sans place : ajoutez des tables ou des places.`, { kind: 'error' });
}

/** Reprend les élèves d'une autre disposition, dans l'ordre des places : aucun élève n'est perdu. */
async function copySeats(src, dst) {
  const order = (src.items || []).filter(i => i.seats).flatMap(i => (src.seats?.[i.id] || []).slice(0, i.seats)).filter(Boolean);
  const seats = {}; const todo = order.slice();
  for (const it of (dst.items || []).filter(i => i.seats)) { seats[it.id] = []; for (let k = 0; k < it.seats && todo.length; k++) seats[it.id][k] = todo.shift(); }
  await store.update(dst.id, { seats }, `Places reprises de « ${src.name} »`);
  toast(todo.length ? `${todo.length} élève(s) n’ont pas de place dans cette disposition : ils restent « à placer ».` : 'Places reprises');
}

function newLayout(cls, current) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Nom', h('input', { name: 'name', value: `Disposition ${store.all('layout').filter(l => l.classId === cls.id).length + 1}` })),
    field('Modèle', h('select', { name: 'tpl' }, Object.keys(TEMPLATES).map(k => h('option', { value: k }, k)))),
    current ? h('label', { class: 'inline' }, h('input', { type: 'checkbox', name: 'keep', checked: true }), `Reprendre les élèves de « ${current.name} »`) : null);
  modal({ title: 'Nouvelle disposition', body: form, actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, onClick: async () => {
    const d = formData(form);
    const lay = await store.create('layout', { classId: cls.id, name: d.name || 'Disposition', template: d.tpl, items: TEMPLATES[d.tpl](), seats: {} }, `Disposition « ${d.name} »`);
    selLayout = lay.id; selItem = null;
    if (d.keep && current) await copySeats(current, store.get(lay.id));
  } }] });
}

// ───────── Groupes
function groupsView(cls, rerender) {
  const sets = G.setsOf(cls.id);
  const set = sets.find(s => s.id === selSet) || sets[0] || null;
  const students = model.studentsOfClass(cls.id).map(x => x.student);
  return h('div', { class: 'stack' },
    h('div', { class: 'row' },
      sets.length ? h('select', { 'aria-label': 'Ensemble de groupes', onchange: (e) => { selSet = e.target.value; rerender(); } }, sets.map(s => h('option', { value: s.id, selected: set && s.id === set.id }, `${s.name} (${s.permanent ? 'permanent' : 'pour une séance'})`))) : null,
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-groupset', onclick: () => newSet(cls) }, icon('plus', 16), 'Nouveaux groupes')),
    set ? setEditor(set, cls, students, rerender) : emptyState('Aucun groupe', 'Binômes, équipes, académies, ateliers ou groupes de besoin : composition à la main ou proposition aléatoire, que vous ajustez.'));
}

function newSet(cls) {
  const today = model.todayIso();
  const abs = G.absentsOn(cls, today);
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' }, field('Nom', h('input', { name: 'name', placeholder: 'ex. Équipes de sport, Ateliers lecture' })), field('Type', h('select', { name: 'kind' }, G.KINDS.map(k => h('option', { value: k }, k))))),
    field('Durée de vie', h('select', { name: 'permanent' }, h('option', { value: '1' }, 'Groupes permanents (classe)'), h('option', { value: '0' }, 'Groupes pour une séance'))),
    field('Composition', h('select', { name: 'mode' }, h('option', { value: 'aleatoire' }, 'Proposition aléatoire, à ajuster ensuite'), h('option', { value: 'manuel' }, 'À la main'))),
    h('div', { class: 'grid-2' }, field('Élèves par groupe', h('input', { name: 'size', type: 'number', min: 1, value: 4 })), field('ou nombre de groupes', h('input', { name: 'count', type: 'number', min: 1, placeholder: '—' }))),
    abs.size ? h('label', { class: 'inline' }, h('input', { type: 'checkbox', name: 'skipAbs', checked: true }), `Laisser de côté les ${abs.size} absent(s) du jour`) : null);
  modal({ title: 'Nouveaux groupes', body: form, actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, onClick: async () => {
    const d = formData(form);
    const ids = model.studentsOfClass(cls.id).map(x => x.student.id).filter(id => !(d.skipAbs && abs.has(id)));
    const parts = d.mode === 'aleatoire' ? G.randomGroups(ids, { size: Number(d.size) || 4, count: Number(d.count) || null }) : Array.from({ length: Number(d.count) || Math.max(1, Math.round(ids.length / (Number(d.size) || 4))) }, () => []);
    const set = await store.create('groupset', { classId: cls.id, name: d.name || d.kind, kind: d.kind, permanent: d.permanent === '1', groups: parts.map((m, i) => G.newGroup(i, m)) }, `Groupes « ${d.name || d.kind} »`);
    selSet = set.id;
  } }] });
}

function setEditor(set, cls, students, rerender) {
  const assigned = new Map(); for (const g of set.groups || []) for (const id of g.memberIds || []) assigned.set(id, g.id);
  const unassigned = students.filter(s => !assigned.has(s.id));
  const saveGroups = (groups, label, quiet = false) => store.update(set.id, { groups }, label, { quiet });
  const move = (sid, toId) => saveGroups(store.get(set.id).groups.map(g => ({ ...g, memberIds: g.id === toId ? [...new Set([...(g.memberIds || []), sid])] : (g.memberIds || []).filter(x => x !== sid) })), 'Élève déplacé');
  const chip = (s, g) => h('span', { class: 'member' }, s.firstName,
    h('select', { 'aria-label': `Groupe de ${s.firstName}`, 'data-testid': 'member-move', onchange: (e) => move(s.id, e.target.value) }, h('option', { value: '' }, '↔'), set.groups.filter(x => x.id !== g?.id).map(x => h('option', { value: x.id }, x.name)), g ? h('option', { value: '__none' }, 'retirer') : null),
    g ? h('input', { class: 'role', value: g.roles?.[s.id] || '', placeholder: 'rôle', 'aria-label': `Rôle de ${s.firstName}`, onchange: (e) => saveGroups(store.get(set.id).groups.map(x => x.id === g.id ? { ...x, roles: { ...(x.roles || {}), [s.id]: e.target.value } } : x), 'Rôle', true) }) : null);
  const printDoc = (teacher) => h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, set.name), h('p', {}, `${cls.name}${teacher ? ' · version enseignante' : ''}`)),
    h('div', { class: 'group-print' }, set.groups.map(g => h('div', { class: 'group-sheet keep', style: { borderColor: g.color } },
      h('h2', { style: { color: g.color } }, g.name), h('ul', {}, (g.memberIds || []).map(id => h('li', {}, `${store.get(id)?.firstName || ''}${g.roles?.[id] ? ' — ' + g.roles[id] : ''}`))),
      g.activity ? h('p', {}, h('strong', {}, 'Activité : '), g.activity) : null, g.material ? h('p', {}, h('strong', {}, 'Matériel : '), g.material) : null,
      g.order ? h('p', { class: 'small' }, `Ordre de passage : ${g.order}`) : null, teacher && g.notes ? h('p', { class: 'small' }, h('strong', {}, 'Notes : '), g.notes) : null))));
  return h('div', { class: 'stack' },
    h('section', { class: 'card' },
      h('div', { class: 'grid-3' },
        bound({ label: 'Nom', type: 'text', value: set.name, onSave: (v) => store.update(set.id, { name: v }, 'Nom des groupes', { quiet: true }) }),
        bound({ label: 'Type', type: 'select', value: set.kind, options: G.KINDS, onSave: (v) => store.update(set.id, { kind: v }, 'Type de groupes', { quiet: true }) }),
        bound({ label: 'Durée de vie', type: 'select', value: set.permanent ? '1' : '0', options: [['1', 'Permanents'], ['0', 'Pour une séance']], onSave: (v) => store.update(set.id, { permanent: v === '1' }, 'Durée de vie des groupes') })),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => saveGroups([...set.groups, G.newGroup(set.groups.length)], 'Groupe ajouté') }, '+ groupe'),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'reshuffle', onclick: async () => {
          if (!await confirmDialog('Nouvelle répartition aléatoire ?', 'Les groupes actuels sont remplacés (annulable). Les séances passées qui les ont utilisés gardent leur composition.', { confirmLabel: 'Mélanger' })) return;
          const ids = students.map(s => s.id).filter(id => !G.absentsOn(cls, model.todayIso()).has(id));
          const parts = G.randomGroups(ids, { count: set.groups.length || 2 });
          await saveGroups(set.groups.map((g, i) => ({ ...g, memberIds: parts[i] || [], roles: {} })), 'Nouvelle répartition');
        } }, 'Mélanger à nouveau'),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'use-for-session', onclick: () => useForSession(set, cls) }, 'Utiliser pour une séance datée'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => printDocument(printDoc(false)) }, icon('print', 14), 'Fiches de groupe'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => printDocument(printDoc(true)) }, 'Version enseignante'),
        h('button', { class: 'btn btn-small btn-ghost-danger', type: 'button', onclick: async () => { await store.remove(set.id, 'Groupes mis à la corbeille'); selSet = null; } }, 'Supprimer'))),
    unassigned.length ? h('div', { class: 'card notice' }, h('strong', {}, `Non affectés (${unassigned.length}) : `), unassigned.map(s => chip(s, null))) : null,
    h('div', { class: 'groups-grid' }, set.groups.map(g => h('section', { class: 'card group-card', style: { borderTopColor: g.color }, 'data-testid': 'group-card' },
      h('div', { class: 'row' }, h('input', { type: 'color', value: g.color, 'aria-label': 'Couleur', onchange: (e) => saveGroups(set.groups.map(x => x.id === g.id ? { ...x, color: e.target.value } : x), 'Couleur') }),
        h('input', { value: g.name, 'aria-label': 'Nom du groupe', onchange: (e) => saveGroups(set.groups.map(x => x.id === g.id ? { ...x, name: e.target.value } : x), 'Nom du groupe') }),
        iconBtn('trash', 'Supprimer le groupe (ses membres redeviennent non affectés)', () => saveGroups(set.groups.filter(x => x.id !== g.id), 'Groupe supprimé'))),
      h('div', { class: 'members' }, (g.memberIds || []).map(id => store.get(id)).filter(Boolean).map(s => chip(s, g))),
      h('div', { class: 'fields' },
        bound({ label: 'Activité / atelier', type: 'text', value: g.activity, compact: true, onSave: (v) => saveGroups(store.get(set.id).groups.map(x => x.id === g.id ? { ...x, activity: v } : x), 'Activité', true) }),
        bound({ label: 'Matériel', type: 'text', value: g.material, compact: true, onSave: (v) => saveGroups(store.get(set.id).groups.map(x => x.id === g.id ? { ...x, material: v } : x), 'Matériel', true) }),
        bound({ label: 'Ordre de rotation', type: 'number', value: g.order, onSave: (v) => saveGroups(store.get(set.id).groups.map(x => x.id === g.id ? { ...x, order: v } : x), 'Ordre', true) }),
        bound({ label: 'Notes (version enseignante)', type: 'text', value: g.notes, compact: true, onSave: (v) => saveGroups(store.get(set.id).groups.map(x => x.id === g.id ? { ...x, notes: v } : x), 'Notes', true) }))))),
    h('p', { class: 'muted small' }, 'Projection : seuls les noms de groupes, couleurs, prénoms, rôles et activités sont projetés, jamais de niveau ni de besoin individuel.'));
  void rerender;
}

/** Fige la composition actuelle dans une séance datée du cahier journal. */
function useForSession(set, cls) {
  let date = model.todayIso();
  const body = h('div', { class: 'form' });
  let m;
  const draw = () => {
    const plan = PL.dayPlan(cls, date);
    body.replaceChildren(field('Date', h('input', { type: 'date', value: date, onchange: (e) => { date = e.target.value; draw(); } })),
      h('div', { class: 'quick-list' }, plan.entries.filter(e => e.kind !== 'event').map(e => h('button', { class: 'quick-item', type: 'button', 'data-testid': 'groups-entry', onclick: async () => {
        await PL.patchEntry(e, cls, { groups: G.snapshotSet(store.get(set.id)) }, `Groupes « ${set.name} » utilisés le ${model.frShort(date)}`);
        m.close(); toast('Composition enregistrée pour cette séance : elle ne changera plus.');
      } }, h('strong', {}, `${e.start} ${e.subject || ''}`), h('span', { class: 'muted' }, e.title)))));
  };
  draw();
  m = modal({ title: `Utiliser « ${set.name} » pour une séance`, wide: true, body, actions: [{ label: 'Fermer' }] });
  void pickMany; void badge;
}
