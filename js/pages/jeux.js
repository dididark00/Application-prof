// Préparer › Jeux et anglais : memory, associations, classement, remise en ordre, quiz,
// bingo, cartes à questions, flashcards et dialogues d'anglais. Chaque jeu est modifiable,
// imprimable et jouable en grand (TNI, tablette), et peut être relié à une fiche de séance.
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import * as J from '../jeux.js';
import { h, icon, toast, modal, field, formData, badge, emptyState, confirmDialog, pickFiles } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { bound } from '../forms.js';
import { printDocument } from '../print.js';

const urls = new Map(); // blobId → URL d'objet (images, sons)
async function blobUrl(id) {
  if (!id) return null;
  if (!urls.has(id)) { const b = await store.getBlob(id); if (!b) return null; urls.set(id, URL.createObjectURL(b)); }
  return urls.get(id);
}
function img(id, cls = 'game-img') {
  const el = h('img', { class: cls, alt: '' });
  blobUrl(id).then(u => { if (u) el.src = u; });
  return el;
}

export function render({ params, rerender }) {
  if (params[0]) return detail(params[0], rerender);
  const list = J.games();
  return h('div', { class: 'page' },
    pageHeader('Jeux et anglais', { favKey: 'preparer/jeux', subtitle: 'Jeux à imprimer ou à jouer en grand, reliés à vos séances',
      actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-game', onclick: () => newGame() }, icon('plus', 16), 'Nouveau jeu')] }),
    subTabs(),
    list.length ? h('div', { class: 'grid-2' }, list.map(g => h('a', { class: 'card link-card', href: `#/jeux/${g.id}`, 'data-testid': 'game-card' },
      h('div', { class: 'card-head' }, h('h2', {}, g.title), badge(J.kindOf(g.kind).label, 'muted')),
      h('p', { class: 'muted small' }, [`${J.rows(g).length} ligne(s)`, g.subject, g.level, g.sessionId ? `séance : ${P.sessionTitle(store.get(g.sessionId) || {})}` : null].filter(Boolean).join(' · ')))))
      : emptyState('Aucun jeu', 'Créez un memory, un quiz, un bingo ou des flashcards d’anglais à partir de vos séances.'));
}

function newGame(pre = {}) {
  const cls = model.currentClass();
  const sessions = cls ? P.ofClass('session', cls.id) : [];
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Titre', h('input', { name: 'title', required: true, value: pre.title || '', 'data-testid': 'game-title' })),
    field('Type de jeu', h('select', { name: 'kind', 'data-testid': 'game-kind' }, J.KINDS.map(k => h('option', { value: k.id, selected: pre.kind === k.id }, k.label)))),
    h('div', { class: 'grid-2' }, field('Discipline', h('select', { name: 'subject' }, h('option', { value: '' }, '—'), model.subjects().map(s => h('option', { value: s, selected: pre.subject === s }, s)))),
      field('Niveau', h('input', { name: 'level', value: pre.level || (cls?.levels || []).join(', ') }))),
    sessions.length ? field('Relier à une fiche de séance (facultatif)', h('select', { name: 'sessionId' }, h('option', { value: '' }, '—'), sessions.map(s => h('option', { value: s.id, selected: pre.sessionId === s.id }, P.sessionTitle(s))))) : null);
  const err = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: 'Nouveau jeu', body: h('div', {}, form, err), actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, testid: 'game-create', onClick: async () => {
    const d = formData(form);
    if (!d.title.trim()) { err.textContent = 'Titre obligatoire.'; return false; }
    const g = await store.create('game', { title: d.title.trim(), kind: d.kind, subject: d.subject || '', level: d.level || '', sessionId: d.sessionId || null, consigne: '', items: [], options: { bingoCards: 6, bingoSize: 4 } }, `Jeu « ${d.title} »`);
    location.hash = `#/jeux/${g.id}`;
  } }] });
}

// ───────── Fiche du jeu : contenu, options, impression, lancement
function detail(id, rerender) {
  const g = store.get(id);
  if (!g || g.deletedAt) return h('div', { class: 'page' }, pageHeader('Jeu introuvable'), h('a', { href: '#/jeux' }, '← Jeux'));
  const k = J.kindOf(g.kind);
  const items = g.items || [];
  const save = (next, label = 'Jeu modifié', quiet = true) => store.update(g.id, { items: next }, label, { quiet });
  const withImg = ['memory', 'flashcards', 'classement', 'associations'].includes(g.kind);
  const withAudio = g.kind === 'flashcards';
  const cell = (it, i, key, ph) => h('input', { value: it[key] || '', placeholder: ph, 'aria-label': ph, 'data-testid': `item-${key}`, onchange: (e) => save(store.get(g.id).items.map((x, j) => (j === i ? { ...x, [key]: e.target.value } : x))) });
  const keys = ['a', 'b', 'c'].slice(0, k.cols.length);
  const enough = J.rows(g).length >= (g.kind === 'bingo' ? (g.options?.bingoSize || 4) ** 2 : g.kind === 'ordre' ? 2 : 1);
  return h('div', { class: 'page' },
    h('p', {}, h('a', { href: '#/jeux', class: 'back' }, '← Jeux et anglais')),
    pageHeader(g.title, { subtitle: `${k.label}${g.subject ? ' · ' + g.subject : ''}${g.level ? ' · ' + g.level : ''}`,
      actions: [
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'game-play', disabled: !enough, onclick: () => play(store.get(g.id)) }, icon('play', 16), 'Jouer en grand'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'game-print', disabled: !enough, onclick: () => printGame(store.get(g.id), false) }, icon('print', 16), 'Imprimer'),
        ['quiz', 'ordre', 'classement', 'associations'].includes(g.kind) ? h('button', { class: 'btn', type: 'button', disabled: !enough, onclick: () => printGame(store.get(g.id), true) }, 'Correction') : null,
        h('button', { class: 'btn btn-ghost-danger', type: 'button', 'aria-label': 'Mettre à la corbeille', onclick: async () => { if (await confirmDialog('Mettre ce jeu à la corbeille ?', 'Il reste récupérable dans Réglages › Corbeille.', { confirmLabel: 'Corbeille' })) { await store.remove(g.id, 'Jeu mis à la corbeille'); location.hash = '#/jeux'; } } }, icon('trash', 16))] }),
    h('div', { class: 'grid-2' },
      bound({ label: 'Titre', type: 'text', value: g.title, onSave: (v) => store.update(g.id, { title: v }, 'Titre du jeu', { quiet: true }) }),
      bound({ label: 'Consigne (affichée et imprimée)', value: g.consigne, onSave: (v) => store.update(g.id, { consigne: v }, 'Consigne du jeu', { quiet: true }) })),
    sessionLink(g),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Contenu'), h('span', { class: 'muted small' }, k.help)),
      items.length ? h('div', { class: 'game-items', style: { '--cols': keys.length } },
        h('div', { class: 'game-row head' }, h('span', {}, '#'), k.cols.map(c => h('span', {}, c)), withImg ? h('span', {}, 'Image') : null, withAudio ? h('span', {}, 'Son') : null, h('span', {})),
        items.map((it, i) => h('div', { class: 'game-row', 'data-testid': 'game-row' },
          h('span', { class: 'muted' }, String(i + 1)),
          keys.map((key, n) => cell(it, i, key, k.cols[n])),
          withImg ? imageCell(g, it, i) : null,
          withAudio ? audioCell(g, it, i) : null,
          h('span', { class: 'row' },
            g.kind === 'ordre' && i > 0 ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Monter', onclick: () => { const a = items.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; save(a, 'Ordre modifié', false); } }, icon('up', 14)) : null,
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retirer', onclick: () => save(items.filter((_, j) => j !== i), 'Ligne retirée', false) }, icon('x', 14)))))) : h('p', { class: 'muted' }, 'Aucune ligne.'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'game-add', onclick: () => save([...items, { id: store.uid(), a: '', b: '', c: '' }], 'Ligne ajoutée', false) }, '+ ligne'),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'game-paste', onclick: () => pasteDialog(g) }, 'Coller plusieurs lignes'))),
    optionsCard(g),
    g.kind === 'flashcards' || g.kind === 'dialogue' ? audioNote() : null);
  void rerender;
}

function sessionLink(g) {
  const cls = model.currentClass();
  const sessions = cls ? P.ofClass('session', cls.id) : [];
  if (!sessions.length && !g.sessionId) return null;
  return h('div', { class: 'row wrap' }, h('strong', {}, 'Séance : '),
    h('select', { 'aria-label': 'Séance liée', onchange: (e) => store.update(g.id, { sessionId: e.target.value || null }, 'Jeu relié à une séance') }, h('option', { value: '' }, '— aucune —'),
      sessions.map(s => h('option', { value: s.id, selected: g.sessionId === s.id }, P.sessionTitle(s)))),
    g.sessionId ? h('a', { class: 'btn btn-small', href: `#/seance/${g.sessionId}` }, 'Ouvrir la fiche') : null);
}

function imageCell(g, it, i) {
  return h('span', { class: 'row' }, it.img ? img(it.img, 'game-thumb') : null,
    h('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
      const f = await pickFiles({ accept: 'image/*', multiple: false });
      if (!f?.length) return;
      const blobId = await store.putBlob(f[0]);
      await store.update(g.id, { items: store.get(g.id).items.map((x, j) => (j === i ? { ...x, img: blobId } : x)) }, 'Image ajoutée');
    } }, it.img ? 'Changer' : 'Image'));
}

let recorder = null;
function audioCell(g, it, i) {
  const play = it.audio ? h('button', { class: 'btn btn-small', type: 'button', 'aria-label': 'Écouter l’enregistrement', onclick: async () => { const u = await blobUrl(it.audio); if (u) new Audio(u).play(); } }, '▶') : null;
  const tts = J.canSpeak() ? h('button', { class: 'btn btn-small', type: 'button', 'aria-label': 'Voix de synthèse', title: 'Voix de synthèse de l’appareil', onclick: () => J.speak(it.a) }, '🔊') : null;
  const rec = 'MediaRecorder' in window ? h('button', { class: 'btn btn-small', type: 'button', onclick: async (e) => {
    const btn = e.currentTarget;
    if (recorder) { recorder.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = []; recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => chunks.push(ev.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop()); recorder = null;
        const blobId = await store.putBlob(new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' }));
        await store.update(g.id, { items: store.get(g.id).items.map((x, j) => (j === i ? { ...x, audio: blobId } : x)) }, 'Enregistrement ajouté');
      };
      recorder.start(); btn.textContent = '■ Arrêter';
    } catch { toast('Micro indisponible ou refusé.', { kind: 'error' }); }
  } }, '● Enregistrer') : null;
  return h('span', { class: 'row' }, tts, play, rec);
}

function audioNote() {
  const n = J.englishVoices().length;
  return h('p', { class: 'muted small', 'data-testid': 'audio-note' },
    '🔊 = voix de synthèse anglaise de l’appareil (aucun envoi sur internet), ',
    J.canSpeak() ? (n ? `${n} voix anglaise(s) disponible(s) ici. ` : 'aucune voix anglaise détectée sur cet appareil pour l’instant. ') : 'non disponible dans ce navigateur. ',
    '● = enregistrement de votre propre voix, gardé sur l’appareil et dans la sauvegarde.');
}

function pasteDialog(g) {
  const k = J.kindOf(g.kind);
  const ta = h('textarea', { rows: 10, 'data-testid': 'paste-area', placeholder: k.cols.join(' | ') });
  modal({ title: 'Coller plusieurs lignes', body: h('div', {}, h('p', { class: 'muted small' }, `${k.help} Séparez les colonnes par « | » ou une tabulation.`), ta),
    actions: [{ label: 'Annuler' }, { label: 'Ajouter', primary: true, testid: 'paste-add', onClick: async () => {
      const lines = ta.value.split('\n').map(l => l.trim()).filter(Boolean);
      const add = lines.map(l => { const [a, b = '', c = ''] = l.split(/\t|\s*\|\s*/); return { id: store.uid(), a, b, c }; });
      await store.update(g.id, { items: [...(store.get(g.id).items || []), ...add] }, `${add.length} ligne(s) ajoutée(s)`);
    } }] });
}

function optionsCard(g) {
  const o = g.options || {};
  const set = (patch) => store.update(g.id, { options: { ...o, ...patch } }, 'Options du jeu', { quiet: true });
  if (g.kind === 'bingo') return h('section', { class: 'card form' }, h('h2', {}, 'Cartons'),
    h('div', { class: 'grid-3' },
      field('Nombre de cartons', h('input', { type: 'number', min: 1, max: 40, value: o.bingoCards || 6, 'data-testid': 'bingo-n', onchange: (e) => set({ bingoCards: Number(e.target.value) || 6 }) })),
      field('Taille', h('select', { 'data-testid': 'bingo-size', onchange: (e) => set({ bingoSize: Number(e.target.value) }) }, [3, 4, 5].map(n => h('option', { value: n, selected: (o.bingoSize || 4) === n }, `${n} × ${n}`)))),
      field('Numéro de tirage', h('input', { type: 'number', value: o.seed || 1, onchange: (e) => set({ seed: Number(e.target.value) || 1 }) }), 'Même numéro = mêmes cartons.')));
  return null;
}

// ───────── Impression
function printGame(g, corr) {
  const k = J.kindOf(g.kind);
  const R = J.rows(g);
  const head = h('header', { class: 'print-head' }, h('h1', {}, g.title + (corr ? ' — correction' : '')), g.consigne ? h('p', {}, g.consigne) : null);
  const card = (content, cls = '') => h('div', { class: `pcard ${cls}` }, content);
  let body;
  if (g.kind === 'memory') body = h('div', { class: 'pcards' }, J.shuffle(R.flatMap(i => [i.a, i.b].map((t, n) => ({ t, img: n === 0 ? i.img : null })))).map(x => card([x.img ? img(x.img) : null, h('span', {}, x.t)])));
  else if (g.kind === 'flashcards') body = h('div', { class: 'pcards big' }, R.map(i => card([i.img ? img(i.img) : null, h('strong', {}, i.a), h('span', { class: 'small' }, i.b)])));
  else if (g.kind === 'cartes') body = h('div', { class: 'pcards fold' }, R.map(i => h('div', { class: 'pfold' }, card(h('span', {}, i.a)), card(h('span', { class: 'small' }, i.b), 'back'))));
  else if (g.kind === 'bingo') {
    const o = g.options || {}; const size = o.bingoSize || 4;
    const cards = J.bingoCards(g, o.bingoCards || 6, size, o.seed || 1);
    body = h('div', { class: 'bingo-sheet' }, cards.map((c, n) => h('div', { class: 'bingo-card', style: { '--n': size } }, h('div', { class: 'bingo-title' }, `${g.title} — carton ${n + 1}`), c.map(t => h('div', { class: 'bingo-cell' }, t)))),
      h('div', { class: 'bingo-call' }, h('h2', {}, 'Liste de tirage (enseignant)'), h('ol', {}, J.shuffle(R.map(i => i.a), o.seed || 1).map(t => h('li', {}, t)))));
  } else if (g.kind === 'quiz') body = h('ol', { class: 'pquiz' }, R.map((i, n) => h('li', {}, h('strong', {}, i.a), h('ul', {}, J.quizChoices(i, n + 1).map(c => h('li', { class: corr && c === i.b ? 'good' : '' }, `☐ ${c}${corr && c === i.b ? '  ✔' : ''}`))))));
  else if (g.kind === 'ordre') body = corr ? h('ol', {}, R.map(i => h('li', {}, i.a))) : h('div', { class: 'pcards' }, J.shuffle(R).map(i => card([h('span', { class: 'pbox' }, ''), h('span', {}, i.a)])));
  else if (g.kind === 'associations') { const right = J.shuffle(R.map(i => i.b)); body = h('table', { class: 'print-table assoc' }, h('tbody', {}, R.map((i, n) => h('tr', {}, h('td', {}, i.img ? img(i.img) : null, i.a), h('td', { class: 'dot' }, '•'), h('td', { class: 'dot' }, '•'), h('td', {}, corr ? i.b : right[n]))))); }
  else if (g.kind === 'classement') { const cats = [...new Set(R.map(i => i.b).filter(Boolean))]; body = h('div', {}, h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, cats.map(c => h('th', {}, c)))), h('tbody', {}, h('tr', {}, cats.map(c => h('td', { class: 'tall' }, corr ? R.filter(i => i.b === c).map(i => h('div', {}, i.a)) : ''))))), corr ? null : h('div', { class: 'pcards' }, J.shuffle(R).map(i => card([i.img ? img(i.img) : null, h('span', {}, i.a)])))); }
  else if (g.kind === 'dialogue') body = h('div', { class: 'pdialogue' }, R.map(i => h('p', {}, h('strong', {}, `${i.a} : `), i.b)));
  printDocument(h('div', { class: 'print-doc game-print' }, head, body, h('p', { class: 'print-foot' }, `${k.label}${g.subject ? ' · ' + g.subject : ''}`)));
}

// ───────── Jouer en grand (plein écran, tactile)
export function play(g) {
  const R = J.rows(g);
  const wrap = h('div', { class: 'game-play', 'data-testid': 'game-stage' });
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); window.speechSynthesis?.cancel(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  const stage = h('div', { class: 'game-stage' });
  const bar = h('div', { class: 'game-bar' }, h('strong', {}, g.title), g.consigne ? h('span', { class: 'muted' }, g.consigne) : null, h('span', { class: 'spacer' }),
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => (document.fullscreenElement ? document.exitFullscreen() : wrap.requestFullscreen?.()) }, 'Plein écran'),
    h('button', { class: 'btn btn-small btn-primary', type: 'button', 'data-testid': 'game-close', onclick: close }, 'Fermer'));
  wrap.append(bar, stage);
  document.body.append(wrap);
  (PLAY[g.kind] || PLAY.cartes)(g, R, stage);
}

const PLAY = {
  memory(g, R, stage) {
    const cards = J.shuffle(R.flatMap((i, p) => [{ p, t: i.a, img: i.img }, { p, t: i.b }]));
    let open = [], found = 0, tries = 0;
    const info = h('p', { class: 'game-info', 'data-testid': 'memory-info' }, 'Retourne deux cartes.');
    const grid = h('div', { class: 'memory-grid', style: { '--n': Math.ceil(Math.sqrt(cards.length)) } }, cards.map((c, n) => {
      const el = h('button', { class: 'memory-card', type: 'button', 'data-testid': 'memory-card', 'data-pair': c.p, onclick: () => {
        if (el.classList.contains('up') || open.length === 2) return;
        el.classList.add('up'); open.push([el, c]);
        if (open.length === 2) {
          tries++;
          const [[e1, c1], [e2, c2]] = open;
          if (c1.p === c2.p) { e1.classList.add('found'); e2.classList.add('found'); found++; open = []; info.textContent = found === R.length ? `Bravo ! Toutes les paires en ${tries} essais.` : `Paire trouvée (${found}/${R.length}).`; }
          else setTimeout(() => { e1.classList.remove('up'); e2.classList.remove('up'); open = []; }, 1100);
        }
      } }, h('span', { class: 'face' }, c.img ? img(c.img) : null, c.t), h('span', { class: 'back' }, String(n + 1)));
      return el;
    }));
    stage.append(info, grid);
  },
  associations(g, R, stage) {
    const left = J.shuffle(R.map((i, p) => ({ p, t: i.a, img: i.img }))), right = J.shuffle(R.map((i, p) => ({ p, t: i.b })));
    let sel = null, ok = 0;
    const info = h('p', { class: 'game-info' }, 'Choisis à gauche, puis à droite.');
    const btn = (x, side) => { const el = h('button', { class: 'assoc-item', type: 'button', 'data-testid': `assoc-${side}`, 'data-pair': x.p, onclick: () => {
      if (el.classList.contains('done')) return;
      if (side === 'l') { stage.querySelectorAll('.assoc-item.sel').forEach(e => e.classList.remove('sel')); el.classList.add('sel'); sel = { el, x }; return; }
      if (!sel) return;
      if (sel.x.p === x.p) { sel.el.classList.add('done'); el.classList.add('done'); ok++; info.textContent = ok === R.length ? 'Bravo, tout est associé !' : `${ok}/${R.length}`; }
      else { el.classList.add('wrong'); setTimeout(() => el.classList.remove('wrong'), 700); }
      sel.el.classList.remove('sel'); sel = null;
    } }, x.img ? img(x.img) : null, x.t); return el; };
    stage.append(info, h('div', { class: 'assoc' }, h('div', {}, left.map(x => btn(x, 'l'))), h('div', {}, right.map(x => btn(x, 'r')))));
  },
  classement(g, R, stage) {
    const cats = [...new Set(R.map(i => i.b).filter(Boolean))];
    let sel = null, left = R.length;
    const info = h('p', { class: 'game-info' }, 'Choisis un élément, puis sa catégorie.');
    const pool = h('div', { class: 'class-pool' }, J.shuffle(R).map(i => { const el = h('button', { class: 'assoc-item', type: 'button', 'data-testid': 'class-item', onclick: () => { stage.querySelectorAll('.assoc-item.sel').forEach(e => e.classList.remove('sel')); el.classList.add('sel'); sel = { el, i }; } }, i.img ? img(i.img) : null, i.a); return el; }));
    const bins = h('div', { class: 'class-bins' }, cats.map(c => { const box = h('div', { class: 'class-bin', 'data-testid': 'class-bin', onclick: () => {
      if (!sel) return;
      if (sel.i.b === c) { box.append(sel.el); sel.el.classList.remove('sel'); sel.el.classList.add('done'); left--; info.textContent = left ? `Encore ${left}.` : 'Bravo, tout est classé !'; }
      else { sel.el.classList.add('wrong'); const e = sel.el; setTimeout(() => e.classList.remove('wrong'), 700); }
      sel = null;
    } }, h('h3', {}, c)); return box; }));
    stage.append(info, pool, bins);
  },
  ordre(g, R, stage) {
    let order = J.shuffle(R.map((i, n) => ({ n, t: i.a })));
    const info = h('p', { class: 'game-info' }, 'Remets dans l’ordre avec les flèches, puis vérifie.');
    const list = h('ol', { class: 'order-list', 'data-testid': 'order-list' });
    const draw = () => list.replaceChildren(...order.map((x, k) => h('li', { 'data-n': x.n }, h('span', {}, x.t), h('span', { class: 'row' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Monter', disabled: k === 0, onclick: () => { [order[k - 1], order[k]] = [order[k], order[k - 1]]; draw(); } }, icon('up', 18)),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Descendre', disabled: k === order.length - 1, onclick: () => { [order[k + 1], order[k]] = [order[k], order[k + 1]]; draw(); } }, icon('down', 18))))));
    draw();
    stage.append(info, list, h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'order-check', onclick: () => {
      const good = order.filter((x, k) => x.n === k).length;
      [...list.children].forEach((li, k) => li.classList.toggle('done', order[k].n === k));
      info.textContent = good === order.length ? 'Bravo, tout est dans l’ordre !' : `${good}/${order.length} à la bonne place.`;
    } }, 'Vérifier'));
  },
  quiz(g, R, stage) {
    let n = 0, score = 0;
    const box = h('div', { class: 'quiz-box' });
    const show = () => {
      if (n >= R.length) { box.replaceChildren(h('h2', { 'data-testid': 'quiz-end' }, `Terminé : ${score}/${R.length}`)); return; }
      const it = R[n]; let answered = false;
      box.replaceChildren(h('p', { class: 'muted' }, `Question ${n + 1}/${R.length}`), h('h2', {}, it.a),
        h('div', { class: 'quiz-choices' }, J.quizChoices(it, n + 1).map(c => { const b = h('button', { class: 'assoc-item', type: 'button', 'data-testid': 'quiz-choice', onclick: () => {
          if (answered) return; answered = true;
          if (c === it.b) { b.classList.add('done'); score++; } else { b.classList.add('wrong'); box.querySelectorAll('.assoc-item').forEach(x => { if (x.textContent === it.b) x.classList.add('done'); }); }
        } }, c); return b; })),
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'quiz-next', onclick: () => { n++; show(); } }, n + 1 < R.length ? 'Question suivante' : 'Résultat'));
    };
    show(); stage.append(box);
  },
  bingo(g, R, stage) {
    const order = J.shuffle(R.map(i => i.a)); let n = 0;
    const big = h('div', { class: 'bingo-big', 'data-testid': 'bingo-current' }, 'Prêt ?');
    const hist = h('div', { class: 'bingo-hist' });
    stage.append(big, h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'bingo-draw', onclick: () => {
      if (n >= order.length) { big.textContent = 'Tout est tiré !'; return; }
      big.textContent = order[n]; hist.prepend(h('span', { class: 'chip' }, order[n])); n++;
    } }, 'Tirer'), hist);
  },
  cartes(g, R, stage) {
    const order = J.shuffle(R); let n = 0, back = false;
    const card = h('button', { class: 'flash', type: 'button', 'data-testid': 'flash-card', onclick: () => { back = !back; draw(); } });
    const draw = () => { const it = order[n]; card.replaceChildren(back ? h('span', { class: 'flash-b' }, it.b) : h('span', {}, it.a)); };
    const nav = h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => { n = (n - 1 + order.length) % order.length; back = false; draw(); } }, '← Précédente'),
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'flash-next', onclick: () => { n = (n + 1) % order.length; back = false; draw(); } }, 'Suivante →'));
    draw(); stage.append(h('p', { class: 'game-info' }, 'Touche la carte pour la retourner.'), card, nav);
  },
  flashcards(g, R, stage) {
    let n = 0, back = false;
    const card = h('button', { class: 'flash', type: 'button', 'data-testid': 'flash-card', onclick: () => { back = !back; draw(); } });
    const say = async () => { const it = R[n]; if (it.audio) { const u = await blobUrl(it.audio); if (u) { new Audio(u).play(); return; } } J.speak(it.a); };
    const draw = () => { const it = R[n]; card.replaceChildren(...[it.img ? img(it.img, 'flash-img') : null, back ? h('span', { class: 'flash-b' }, it.b) : h('span', {}, it.a)].filter(Boolean)); };
    draw();
    stage.append(h('p', { class: 'game-info' }, `${R.length} mot(s) · touche la carte pour voir la traduction`), card,
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => { n = (n - 1 + R.length) % R.length; back = false; draw(); } }, '←'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'flash-say', title: 'Enregistrement de l’enseignante s’il existe, sinon voix de synthèse de l’appareil', onclick: say }, '🔊 Écouter'),
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'flash-next', onclick: () => { n = (n + 1) % R.length; back = false; draw(); } }, '→')));
  },
  dialogue(g, R, stage) {
    const speakers = [...new Set(R.map(i => i.a))];
    let n = 0;
    const lines = h('div', { class: 'dialogue' });
    const step = () => { if (n >= R.length) return; const it = R[n]; lines.append(h('p', { class: `bubble s${speakers.indexOf(it.a) % 2}` }, h('strong', {}, `${it.a} : `), it.b)); J.speak(it.b, { voiceIndex: speakers.indexOf(it.a) }); n++; };
    stage.append(lines, h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'dialogue-next', onclick: step }, 'Réplique suivante'));
  },
};
