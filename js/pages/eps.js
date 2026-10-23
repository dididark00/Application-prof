// Préparer › Schémas EPS : éditeur (déplacer, redimensionner, orienter, dupliquer, annuler),
// modèles, couleurs d'équipes liées aux groupes, consignes/matériel/rotations/vigilance,
// impression, image, projection. Chaque schéma est relié à une séance et à une phase.
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import * as E from '../eps.js';
import * as G from '../groups.js';
import { h, icon, toast, modal, field, formData, badge, emptyState, confirmDialog, download } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { bound, pickMany } from '../forms.js';
import { printDocument } from '../print.js';
import { animate } from './atelier.js';

const ed = { id: null, selected: null, tool: null, history: [] };

export function render({ params, query, rerender }) {
  if (params[0]) return editor(params[0], rerender);
  const all = store.all('epsdiagram').sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return h('div', { class: 'page' },
    pageHeader('Schémas EPS', { favKey: 'preparer/eps', subtitle: 'Mise en place, évolutions, parcours et jeux collectifs, reliés aux séances',
      actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-diagram', onclick: () => newDiagram({ sessionId: query?.session || null, phaseId: query?.phase || null }) }, icon('plus', 16), 'Nouveau schéma')] }),
    subTabs(),
    all.length ? h('div', { class: 'grid-3' }, all.map(d => { const s = d.sessionId ? store.get(d.sessionId) : null; return h('a', { class: 'card link-card eps-card', href: `#/eps/${d.id}`, 'data-testid': 'diagram-card' },
      h('div', { class: 'eps-thumb' }, E.render(d, { legend: false })), h('strong', {}, d.title), h('span', { class: 'muted small' }, s ? P.sessionTitle(s) : 'non relié à une séance')); }))
      : emptyState('Aucun schéma', 'Dessinez la mise en place d’une séance d’EPS : terrain, plots, cerceaux, équipes, déplacements.'));
}

export function newDiagram(pre = {}) {
  const cls = model.currentClass();
  const sessions = cls ? P.ofClass('session', cls.id) : [];
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Titre', h('input', { name: 'title', required: true, value: pre.title || '', placeholder: 'ex. Mise en place — relais', 'data-testid': 'diagram-title' })),
    h('div', { class: 'grid-2' },
      field('Point de départ', h('select', { name: 'template', 'data-testid': 'diagram-template' }, h('option', { value: '' }, 'Vide'), Object.entries(E.TEMPLATES).map(([k, t]) => h('option', { value: k }, t.label)))),
      field('Lieu', h('select', { name: 'field' }, E.FIELDS.map(([k, l]) => h('option', { value: k }, l))))),
    sessions.length ? field('Séance', h('select', { name: 'sessionId', 'data-testid': 'diagram-session' }, h('option', { value: '' }, '—'), sessions.map(s => h('option', { value: s.id, selected: pre.sessionId === s.id }, P.sessionTitle(s))))) : null);
  const err = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: 'Nouveau schéma EPS', body: h('div', {}, form, err), actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, testid: 'diagram-create', onClick: async () => {
    const d = formData(form);
    if (!d.title.trim()) { err.textContent = 'Titre obligatoire.'; return false; }
    const t = E.TEMPLATES[d.template];
    const sessionId = d.sessionId || pre.sessionId || null;
    const s = sessionId ? store.get(sessionId) : null;
    const r = await store.create('epsdiagram', { title: d.title.trim(), field: t ? t.field : d.field, items: t ? t.make() : [], sessionId, phaseId: pre.phaseId || null,
      classId: s?.classId || cls?.id || null, order: E.diagramsOfSession(sessionId).length, dims: { w: '', h: '' }, teams: {}, notes: { consignes: '', materiel: '', rotations: '', vigilance: '' } }, `Schéma EPS « ${d.title} »`);
    location.hash = `#/eps/${r.id}`;
  } }] });
}

function editor(id, rerender) {
  const d = store.get(id);
  if (!d || d.deletedAt) return h('div', { class: 'page' }, pageHeader('Schéma introuvable'), h('a', { href: '#/eps' }, '← Schémas EPS'));
  if (ed.id !== id) { ed.id = id; ed.selected = null; ed.tool = null; ed.history = []; }
  const s = d.sessionId ? store.get(d.sessionId) : null;
  const cls = d.classId ? store.get(d.classId) : model.currentClass();
  // Couleurs d'équipes : groupes permanents de la classe (équipes, académies…), sinon couleurs par défaut.
  const teamSets = cls ? G.setsOf(cls.id).filter(x => x.permanent) : [];
  const teamColors = teamSets.flatMap(set => set.groups.map(g => ({ color: g.color, name: `${set.name} — ${g.name}` })));
  const colors = [...teamColors.map(t => t.color), ...E.DEFAULT_COLORS].filter((c, i, a) => a.indexOf(c) === i);

  const host = h('div', { class: 'eps-host', 'data-testid': 'eps-host' });
  let items = structuredClone(d.items || []);
  const commit = async (label) => { ed.history.push(structuredClone(store.get(id).items || [])); if (ed.history.length > 50) ed.history.shift(); await store.update(id, { items, teams: teamMap() }, label, { quiet: true }); draw(); refreshTools(); };
  const teamMap = () => Object.fromEntries(teamColors.map(t => [t.color, t.name]));
  const sel = () => items.find(i => i.id === ed.selected);

  const draw = () => {
    const svg = E.render({ ...d, items, teams: teamMap() }, { legend: false, selected: ed.selected });
    if (ed.selected) {
      const it = sel();
      if (it && E.ITEMS[it.kind]?.line) {
        for (const [k, x, y] of [['p1', it.x1, it.y1], ['p2', it.x2, it.y2]]) svg.append(E.S('circle', { cx: x, cy: y, r: 9, class: 'eps-handle', 'data-handle': k }));
      } else if (it) {
        const g = E.S('g', { transform: `translate(${it.x} ${it.y}) rotate(${it.rot || 0} ${it.w / 2} ${it.h / 2})` });
        g.append(E.S('rect', { x: -4, y: -4, width: it.w + 8, height: it.h + 8, fill: 'none', stroke: '#e0a020', 'stroke-width': 2, 'stroke-dasharray': '6 4' }));
        g.append(E.S('rect', { x: it.w - 6, y: it.h - 6, width: 14, height: 14, class: 'eps-handle', 'data-handle': 'size' }));
        g.append(E.S('circle', { cx: it.w / 2, cy: -26, r: 9, class: 'eps-handle', 'data-handle': 'rot' }));
        svg.append(g);
      }
    }
    host.replaceChildren(svg);
    bind(svg);
  };

  const pt = (svg, e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const m = svg.getScreenCTM(); return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 }; };
  const bind = (svg) => {
    let drag = null;
    svg.addEventListener('pointerdown', (e) => {
      const p = pt(svg, e);
      const handle = e.target.closest('[data-handle]')?.getAttribute('data-handle');
      if (ed.tool) { // tracé d'une flèche ou d'une ligne
        const it = E.newItem(ed.tool, p.x, p.y, { x1: p.x, y1: p.y, x2: p.x + 1, y2: p.y });
        items.push(it); ed.selected = it.id; drag = { mode: 'p2', it }; svg.setPointerCapture(e.pointerId); return;
      }
      if (handle && sel()) { drag = { mode: handle, it: sel(), start: p, orig: structuredClone(sel()) }; svg.setPointerCapture(e.pointerId); return; }
      const g = e.target.closest('.eps-item');
      if (!g) { ed.selected = null; draw(); refreshTools(); return; }
      ed.selected = g.getAttribute('data-id');
      const it = sel();
      drag = { mode: 'move', it, start: p, orig: structuredClone(it) };
      draw(); refreshTools();
      host.querySelector('svg').setPointerCapture?.(e.pointerId);
      bindMove(host.querySelector('svg'), drag);
    });
    svg.addEventListener('pointermove', (e) => { if (drag) move(drag, pt(svg, e)); });
    svg.addEventListener('pointerup', () => { if (drag) { const label = drag.mode === 'move' ? 'Élément déplacé' : drag.mode === 'rot' ? 'Élément orienté' : drag.mode === 'size' ? 'Élément redimensionné' : 'Tracé'; drag = null; if (ed.tool) { ed.tool = null; } commit(label); } });
  };
  // Après un redessin pendant la sélection, le nouveau SVG reprend le glisser en cours.
  const bindMove = (svg, drag) => {
    const mv = (e) => move(drag, pt(svg, e));
    const up = () => { svg.removeEventListener('pointermove', mv); svg.removeEventListener('pointerup', up); commit('Élément déplacé'); };
    svg.addEventListener('pointermove', mv); svg.addEventListener('pointerup', up);
  };
  const move = (drag, p) => {
    const it = drag.it;
    if (drag.mode === 'move') {
      const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      if (E.ITEMS[it.kind].line) Object.assign(it, { x1: drag.orig.x1 + dx, y1: drag.orig.y1 + dy, x2: drag.orig.x2 + dx, y2: drag.orig.y2 + dy });
      else Object.assign(it, { x: clamp(drag.orig.x + dx, -it.w / 2, E.W - it.w / 2), y: clamp(drag.orig.y + dy, -it.h / 2, E.H - it.h / 2) });
    } else if (drag.mode === 'p1') Object.assign(it, { x1: p.x, y1: p.y });
    else if (drag.mode === 'p2') Object.assign(it, { x2: p.x, y2: p.y });
    else if (drag.mode === 'size') { it.w = Math.max(12, drag.orig.w + (p.x - drag.start.x)); it.h = Math.max(12, drag.orig.h + (p.y - drag.start.y)); }
    else if (drag.mode === 'rot') { const cx = it.x + it.w / 2, cy = it.y + it.h / 2; it.rot = Math.round((Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI + 90) / 15) * 15; }
    const svg = host.querySelector('svg');
    const node = svg.querySelector(`[data-id="${it.id}"]`);
    if (node) node.replaceWith(Object.assign(E.render({ ...d, items: [it] }, { legend: false }).querySelector(`[data-id="${it.id}"]`), {}));
  };

  const palette = h('div', { class: 'eps-palette', role: 'toolbar', 'aria-label': 'Ajouter' },
    Object.entries(E.ITEMS).map(([k, def]) => h('button', { class: 'btn btn-small', type: 'button', 'data-testid': `add-${k}`, onclick: () => {
      if (def.line) { ed.tool = k; toast('Tracez sur le schéma : appuyez, glissez, relâchez.'); return; }
      const it = E.newItem(k, E.W / 2 + (Math.random() - 0.5) * 120, E.H / 2 + (Math.random() - 0.5) * 80);
      items.push(it); ed.selected = it.id; commit(`${def.label} ajouté`);
    } }, def.label)));
  const tools = h('div', { class: 'eps-tools', 'data-testid': 'eps-tools' });
  const refreshTools = () => {
    const it = sel();
    if (!it) { tools.replaceChildren(h('span', { class: 'muted small' }, 'Touchez un élément pour le modifier ; faites-le glisser pour le déplacer. Poignées : coin = taille, rond = orientation.')); return; }
    tools.replaceChildren(...[
      h('strong', {}, E.ITEMS[it.kind].label),
      h('input', { value: it.label || '', placeholder: 'étiquette (n°, nom…)', 'aria-label': 'Étiquette', 'data-testid': 'item-label', onchange: (e) => { it.label = e.target.value; commit('Étiquette'); } }),
      h('span', { class: 'row' }, colors.map(c => h('button', { type: 'button', class: `swatch${it.color === c ? ' on' : ''}`, style: { background: c }, title: teamColors.find(t => t.color === c)?.name || c, 'aria-label': `Couleur ${teamColors.find(t => t.color === c)?.name || c}`, 'data-testid': 'item-color', onclick: () => { it.color = c; commit('Couleur'); } }))),
      E.ITEMS[it.kind].line ? null : h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'item-rotate', onclick: () => { it.rot = ((it.rot || 0) + 45) % 360; commit('Élément orienté'); } }, '↻ 45°'),
      h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'item-dup', onclick: () => { const c = { ...structuredClone(it), id: store.uid() }; if (E.ITEMS[c.kind].line) { c.x1 += 30; c.x2 += 30; c.y1 += 30; c.y2 += 30; } else { c.x += 30; c.y += 30; } items.push(c); ed.selected = c.id; commit('Élément dupliqué'); } }, 'Dupliquer'),
      h('button', { class: 'btn btn-small btn-ghost-danger', type: 'button', 'data-testid': 'item-del', onclick: () => { items = items.filter(x => x.id !== it.id); ed.selected = null; commit('Élément supprimé'); } }, 'Supprimer')].filter(Boolean));
  };
  const undo = async () => {
    const prev = ed.history.pop();
    if (!prev) { toast('Rien à annuler.'); return; }
    items = prev; ed.selected = null;
    await store.update(id, { items }, 'Annulation dans le schéma', { quiet: true }); draw(); refreshTools();
  };
  draw(); refreshTools();
  const phases = s?.phases || [];
  return h('div', { class: 'page' },
    h('p', {}, h('a', { href: s ? `#/seance/${s.id}` : '#/eps', class: 'back' }, s ? '← Fiche de séance' : '← Schémas EPS')),
    pageHeader(d.title, { subtitle: s ? `Séance : ${P.sessionTitle(s)}${d.phaseId ? ` · phase ${phases.findIndex(p => p.id === d.phaseId) + 1}` : ''}` : 'Schéma non relié à une séance',
      actions: [
        h('button', { class: 'btn', type: 'button', 'data-testid': 'eps-undo', onclick: undo }, '↶ Annuler'),
        h('button', { class: 'btn', type: 'button', onclick: () => animate(E.render(store.get(id))) }, 'Projeter'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'eps-print', onclick: () => printDiagram(store.get(id)) }, icon('print', 16), 'Imprimer'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'eps-png', onclick: () => exportPng(store.get(id)) }, icon('download', 16), 'Image'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'eps-copy', onclick: () => duplicateFor(store.get(id)) }, 'Réutiliser pour une autre séance'),
        h('button', { class: 'btn btn-ghost-danger', type: 'button', 'aria-label': 'Mettre à la corbeille', onclick: async () => { if (await confirmDialog('Mettre ce schéma à la corbeille ?', 'Il reste récupérable dans la corbeille.', { confirmLabel: 'Corbeille' })) { await store.remove(id, 'Schéma mis à la corbeille'); location.hash = s ? `#/seance/${s.id}` : '#/eps'; } } }, icon('trash', 16))] }),
    h('div', { class: 'row wrap' },
      field('Lieu', h('select', { 'data-testid': 'eps-field', onchange: (e) => store.update(id, { field: e.target.value }, 'Lieu du schéma') }, E.FIELDS.map(([k, l]) => h('option', { value: k, selected: d.field === k }, l)))),
      field('Dimensions réelles (facultatif, en m)', h('span', { class: 'row' },
        h('input', { type: 'number', min: 0, value: d.dims?.w || '', placeholder: 'longueur', style: { width: '7em' }, onchange: (e) => store.update(id, { dims: { ...(d.dims || {}), w: e.target.value } }, 'Dimensions') }), '×',
        h('input', { type: 'number', min: 0, value: d.dims?.h || '', placeholder: 'largeur', style: { width: '7em' }, onchange: (e) => store.update(id, { dims: { ...(d.dims || {}), h: e.target.value } }, 'Dimensions') }))),
      s && phases.length ? field('Phase de la séance', h('select', { 'data-testid': 'eps-phase', onchange: (e) => store.update(id, { phaseId: e.target.value || null }, 'Phase du schéma') }, h('option', { value: '' }, '— séance entière —'),
        phases.map((p, i) => h('option', { value: p.id, selected: d.phaseId === p.id }, `Phase ${i + 1} — ${P.PHASE_KINDS[p.kind]?.label || p.kind}${p.title ? ' : ' + p.title : ''}`)))) : null),
    palette, tools, host,
    teamColors.length ? h('p', { class: 'muted small' }, 'Couleurs d’équipes reprises des groupes de la classe : ', teamColors.map(t => h('span', { class: 'chip', style: { borderColor: t.color } }, t.name))) : null,
    h('section', { class: 'card' }, h('h2', {}, 'Consignes et organisation'),
      h('div', { class: 'grid-2' }, [['consignes', 'Consignes'], ['materiel', 'Matériel'], ['rotations', 'Rotations'], ['vigilance', 'Points de vigilance']].map(([k, l]) =>
        bound({ label: l, value: d.notes?.[k], testid: `eps-${k}`, onSave: (v) => store.update(id, { notes: { ...(store.get(id).notes || {}), [k]: v } }, l, { quiet: true }) })))));
  void rerender;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function printDiagram(d) {
  const s = d.sessionId ? store.get(d.sessionId) : null;
  const notes = [['Consignes', 'consignes'], ['Matériel', 'materiel'], ['Rotations', 'rotations'], ['Points de vigilance', 'vigilance']].filter(([, k]) => d.notes?.[k]);
  printDocument(h('div', { class: 'print-doc eps-print' }, h('header', { class: 'print-head' }, h('h1', {}, d.title), s ? h('p', {}, P.sessionTitle(s)) : null),
    E.render(d), notes.length ? h('div', { class: 'eps-notes' }, notes.map(([l, k]) => h('div', {}, h('strong', {}, l), h('p', { class: 'pre' }, d.notes[k])))) : null), { orientation: 'landscape' });
}

async function exportPng(d) {
  const svg = E.render(d);
  svg.setAttribute('width', E.W * 2); svg.setAttribute('height', (E.H + 60) * 2);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  const im = new Image();
  im.onload = () => {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    c.getContext('2d').drawImage(im, 0, 0);
    c.toBlob((b) => { download(`${d.title.replace(/[^\w-]+/g, '_')}.png`, b, 'image/png'); URL.revokeObjectURL(url); });
  };
  im.src = url;
}

async function duplicateFor(d) {
  const cls = model.currentClass();
  const sessions = cls ? P.ofClass('session', cls.id).filter(s => s.id !== d.sessionId) : [];
  const sel = await pickMany({ title: 'Copier ce schéma vers la séance…', single: true, items: sessions.map(s => ({ id: s.id, label: P.sessionTitle(s), detail: s.subject })), emptyText: 'Aucune autre fiche de séance.' });
  if (!sel?.length) return;
  const { id, createdAt, updatedAt, type, ...rest } = structuredClone(d);
  const r = await store.create('epsdiagram', { ...rest, title: `${d.title} (copie)`, sessionId: sel[0], phaseId: null, copiedFrom: id, items: rest.items.map(i => ({ ...i, id: store.uid() })) }, 'Schéma réutilisé pour une autre séance');
  toast('Copie créée : l’original n’est pas modifié.', { action: 'Ouvrir', onAction: () => { location.hash = `#/eps/${r.id}`; } });
}

/** Bloc « Schémas EPS » dans une phase de fiche de séance (version actuelle, liée). */
export function phaseDiagrams(s, ph) {
  const list = E.diagramsOfPhase(s.id, ph.id);
  return h('div', { class: 'eps-inline', 'data-testid': 'phase-diagrams' },
    list.map(d => h('a', { class: 'eps-mini', href: `#/eps/${d.id}`, title: d.title }, E.render(d, { legend: false }), h('span', { class: 'small' }, d.title))),
    h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'phase-add-diagram', onclick: () => newDiagram({ sessionId: s.id, phaseId: ph.id, title: `${P.sessionTitle(s)} — phase` }) }, '+ schéma EPS'));
}
