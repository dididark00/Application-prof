// Préparer › Générateurs d'exercices : calculs, problèmes, dictées de mots par son, fiches de fluence.
// Sans IA, sans connexion ; graine pour réimprimer la même fiche ; corrigé sur demande.
import * as X from '../exercices.js';
import * as model from '../model.js';
import { h, icon, toast } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { printDocument } from '../print.js';

const TABS = [['calculs', 'Calculs'], ['problemes', 'Problèmes'], ['dictee', 'Dictée de mots'], ['fluence', 'Fluence']];
let tab = 'calculs';
const newSeed = () => Math.floor(Math.random() * 9000) + 1000;
const st = {
  calculs: { ops: ['+'], min: 10, max: 99, count: 20, sansRetenue: false, tables: [], pose: false, seed: newSeed() },
  problemes: { types: ['ajout', 'retrait', 'groupes'], count: 6, max: 50, seed: newSeed() },
  dictee: { sons: ['[ou]', '[on]'], count: 10, seed: newSeed(), lignes: true },
  fluence: { text: 'Le petit chat noir dort sur le tapis du salon.\nQuand il se réveille, il a très faim.\nIl court vers la cuisine et miaule très fort.', size: 16 },
  titre: '', correction: false,
};

export function render({ query, rerender }) {
  if (TABS.some(t => t[0] === query.t)) tab = query.t;
  const preview = h('div', { class: 'ex-preview', 'data-testid': 'ex-preview' });
  const redraw = () => preview.replaceChildren(sheet(false), st.correction ? sheet(true) : null);
  const params = { calculs: calcParams, problemes: probParams, dictee: dicteeParams, fluence: fluParams }[tab](redraw, rerender);
  redraw();
  const seedRow = tab !== 'fluence' ? h('div', { class: 'row' }, h('label', { class: 'inline' }, 'Graine', h('input', { type: 'number', value: st[tab].seed, style: { width: '7em' }, 'data-testid': 'ex-seed', oninput: (e) => { st[tab].seed = Number(e.target.value) || 1; redraw(); } })),
    h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'ex-new', onclick: () => { st[tab].seed = newSeed(); rerender(); } }, 'Nouvelle fiche'),
    h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: st.correction, 'data-testid': 'ex-corr', onchange: (e) => { st.correction = e.target.checked; redraw(); } }), 'avec le corrigé')) : null;
  return h('div', { class: 'page' },
    pageHeader('Générateurs d’exercices', { favKey: 'preparer/exercices', actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'ex-print', onclick: () => printDocument(h('div', {}, sheet(false), st.correction ? h('div', { class: 'page-break' }, sheet(true)) : null)) }, icon('print', 16), 'Imprimer')] }),
    subTabs(),
    h('div', { class: 'seg wrap', role: 'group', 'aria-label': 'Générateur' }, TABS.map(([k, l]) => h('a', { class: k === tab ? 'on seg-link' : 'seg-link', href: `#/exercices?t=${k}`, 'data-testid': `ex-tab-${k}` }, l))),
    h('div', { class: 'atelier' },
      h('section', { class: 'card form' }, h('label', {}, 'Titre (facultatif)'), h('input', { value: st.titre, oninput: (e) => { st.titre = e.target.value; redraw(); } }), params, seedRow,
        h('p', { class: 'muted small' }, 'Gardez la graine pour réimprimer exactement la même fiche et son corrigé.')),
      h('section', { class: 'card' }, preview)));
}

const head = (title, corr) => h('header', { class: 'ex-head' }, h('h1', {}, `${st.titre || title}${corr ? ' — corrigé' : ''}`), corr ? null : h('p', {}, 'Prénom : ……………………  Date : ……………………'));
function sheet(corr) {
  if (tab === 'calculs') {
    const o = st.calculs; const list = X.calculs(o);
    if (o.pose) return h('div', { class: 'print-doc ex-sheet' }, head('Calculs posés', corr), h('div', { class: 'ex-pose' }, list.map(c => h('div', { class: 'pose', 'data-testid': 'ex-item' },
      h('div', { class: 'pose-row' }, h('span', {}, ''), h('span', {}, String(c.a))),
      h('div', { class: 'pose-row' }, h('span', {}, c.op === '-' ? '−' : c.op), h('span', {}, String(c.b))),
      h('div', { class: 'pose-row pose-line' }, h('span', {}, ''), h('span', {}, corr ? String(c.res) : '\u00a0'))))));
    return h('div', { class: 'print-doc ex-sheet' }, head('Calculs', corr), h('ol', { class: 'ex-calc' }, list.map(c => h('li', { 'data-testid': 'ex-item' }, `${c.text} = `, corr ? h('strong', {}, X.fr(c.res)) : '……'))));
  }
  if (tab === 'problemes') {
    const list = X.problemes(st.problemes);
    return h('div', { class: 'print-doc ex-sheet' }, head('Problèmes', corr), h('ol', { class: 'ex-prob' }, list.map(p => h('li', { 'data-testid': 'ex-item' }, h('p', {}, p.q),
      corr ? h('p', { class: 'ex-corr' }, `${p.c} — Réponse : ${p.rep}`) : h('div', { class: 'ex-space' }, h('p', {}, 'Calcul :'), h('p', {}, 'Réponse : ……………………………………………'))))));
  }
  if (tab === 'dictee') {
    const list = X.dictee(st.dictee);
    if (corr || !st.dictee.lignes) return h('div', { class: 'print-doc ex-sheet' }, head(`Dictée de mots ${st.dictee.sons.join(', ')}`, corr), h('ol', { class: 'ex-dict' }, list.map(x => h('li', { 'data-testid': 'ex-item' }, x.w, h('span', { class: 'muted small' }, ` ${x.s}`)))));
    return h('div', { class: 'print-doc ex-sheet' }, head('Dictée de mots', false), h('ol', { class: 'ex-lines' }, list.map(() => h('li', { 'data-testid': 'ex-item' }, h('span', { class: 'ex-line' })))),
      h('p', { class: 'muted small' }, 'La liste des mots est sur le corrigé (à garder pour vous).'));
  }
  const rows = X.fluence(st.fluence.text);
  return h('div', { class: 'print-doc ex-sheet' }, head('Lecture : fluence', false),
    h('table', { class: 'flu-table', style: { fontSize: `${st.fluence.size}pt` } }, h('tbody', {}, rows.map(r => h('tr', { 'data-testid': 'ex-item' }, h('td', {}, r.line), h('td', { class: 'flu-n' }, String(r.total)))))),
    h('p', { class: 'small' }, `${rows.at(-1)?.total || 0} mots. Mots lus en 1 minute : ……   Erreurs : ……   Mots correctement lus par minute : ……`));
}

const chips = (list, sel, onChange, testid) => h('div', { class: 'chips' }, list.map(([v, l]) => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: sel.includes(v), 'data-testid': `${testid}-${v}`, onchange: (e) => { const s = new Set(sel); e.target.checked ? s.add(v) : s.delete(v); onChange([...s]); } }), l)));
const num = (label, obj, k, redraw, min = 0, max = 100000) => h('label', { class: 'inline' }, label, h('input', { type: 'number', min, max, value: obj[k], style: { width: '6em' }, 'data-testid': `ex-${k}`, oninput: (e) => { obj[k] = Number(e.target.value); redraw(); } }));

function calcParams(redraw, rerender) {
  const o = st.calculs;
  return h('div', { class: 'stack' },
    chips([['+', 'additions'], ['-', 'soustractions'], ['×', 'multiplications'], ['÷', 'divisions exactes']], o.ops, (v) => { o.ops = v; redraw(); }, 'ex-op'),
    h('div', { class: 'row' }, num('De', o, 'min', redraw), num('à', o, 'max', redraw), num('Nombre', o, 'count', redraw, 1, 60)),
    h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: o.sansRetenue, onchange: (e) => { o.sansRetenue = e.target.checked; redraw(); } }), 'sans retenue (additions et soustractions)'),
    h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: o.pose, 'data-testid': 'ex-pose', onchange: (e) => { o.pose = e.target.checked; redraw(); } }), 'opérations posées'),
    h('p', { class: 'small' }, 'Tables (multiplications et divisions) :'), chips([2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => [n, String(n)]), o.tables, (v) => { o.tables = v.map(Number); redraw(); }, 'ex-table'));
  void rerender;
}
function probParams(redraw) {
  const o = st.problemes;
  return h('div', { class: 'stack' }, chips(Object.entries(X.PROBLEM_TYPES).map(([k, v]) => [k, v.label]), o.types, (v) => { o.types = v; redraw(); }, 'ex-type'),
    h('div', { class: 'row' }, num('Nombre de problèmes', o, 'count', redraw, 1, 20), num('Nombres jusqu’à', o, 'max', redraw, 10, 10000)));
}
function dicteeParams(redraw) {
  const o = st.dictee;
  return h('div', { class: 'stack' }, chips(Object.keys(X.SONS).map(k => [k, k]), o.sons, (v) => { o.sons = v; redraw(); }, 'ex-son'),
    num('Nombre de mots', o, 'count', redraw, 1, 30),
    h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: o.lignes, onchange: (e) => { o.lignes = e.target.checked; redraw(); } }), 'fiche élève avec lignes (les mots sont sur le corrigé)'),
    h('p', { class: 'muted small' }, 'Banque de mots courants classés par son, écrite pour l’application (CP–CE2). Pour une dictée de phrases, utilisez vos propres textes.'));
}
function fluParams(redraw) {
  const o = st.fluence;
  return h('div', { class: 'stack' }, h('textarea', { rows: 8, 'data-testid': 'flu-text', oninput: (e) => { o.text = e.target.value; redraw(); } }, o.text),
    num('Taille (pt)', o, 'size', redraw, 10, 30),
    h('p', { class: 'muted small' }, 'Collez votre texte (ou un texte lu dans une photo avec Outils de classe › Texte d’une photo) : chaque ligne reçoit le nombre de mots cumulé, pour compter vite les mots lus en une minute.'),
    mcmBox());
}
function mcmBox() {
  const out = h('strong', { 'data-testid': 'flu-mcm' }, '—');
  const f = { w: h('input', { type: 'number', min: 0, value: 0, 'aria-label': 'Mots lus' }), e: h('input', { type: 'number', min: 0, value: 0, 'aria-label': 'Erreurs' }), s: h('input', { type: 'number', min: 1, value: 60, 'aria-label': 'Secondes' }) };
  const calc = () => { out.textContent = `${X.mcm(Number(f.w.value), Number(f.e.value), Number(f.s.value))} mots correctement lus par minute`; };
  Object.values(f).forEach(i => { i.style.width = '5em'; i.oninput = calc; }); calc();
  return h('div', { class: 'row' }, 'Mots lus', f.w, 'erreurs', f.e, 'en', f.s, 's :', out);
}
void model; void toast;
