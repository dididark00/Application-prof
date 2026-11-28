// Projection : un pupitre (vue enseignante, avec notes non projetées) et un écran séparé.
// L'écran ne reçoit qu'un contenu filtré : programme, consigne, devoirs collectifs, timer, support choisi.
// Aucune donnée personnelle (bilans, notes, coordonnées, besoins particuliers) n'y est jamais envoyée.
import * as store from '../store.js';
import * as FL from '../file-links.js';
import { embedOf, embedFrame } from '../embeds.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import * as PL from '../planning.js';
import * as T from '../timer.js';
import * as G from '../groups.js';
import * as R from '../rituels.js';
import * as W from '../screen-widgets.js';
import { levelFromRms, zoneOf } from './outils.js';
import { h, icon, toast, badge, emptyState, modal, confirmDialog } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';

const KEY = 'classeur-projection';
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('classeur-projection') : null;
const DEF = { panels: { programme: true, consigne: true, devoirs: false, timer: true, support: false, groupes: false, diapo: false, rituels: false, chrono: false, horloge: false, qr: false, des: false, vote: false, tableau: false }, qr: { text: '', label: '' }, dice: null, diceCount: 2, diceFaces: 6, vote: { question: '', options: [] }, rotation: { on: false, step: 0, auto: false }, pubDate: null, layoutId: null, chrono: null, clock: { mode: 'reelle', time: '09:00', digital: true, seconds: false }, picto: null, feu: null, tirage: null, drawn: [], drawCount: 1, noRepeat: true, meteo: null, birthdays: false, groupSetId: null, slideshowId: null, slideIndex: 0, entryKey: null, phaseId: null, message: '', supportFileId: null, blank: false };

function loadCtrl() { try { return { ...DEF, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch { return { ...DEF }; } }
let ctrl = loadCtrl();

/** Contenu projetable, construit à partir de données explicitement autorisées. */
export function buildPayload(cls, date, c = ctrl) {
  const plan = PL.dayPlan(cls, date);
  const programme = plan.entries.filter(e => e.kind !== 'event' && !['annulée', 'reportée'].includes(e.status))
    .map(e => ({ start: e.start, end: e.end, subject: e.subject || '', title: e.session ? (e.session.title || e.subject) : (e.slot?.label || e.subject || ''), current: e.key === c.entryKey }));
  const entry = plan.entries.find(e => e.key === c.entryKey);
  const ses = entry?.session;
  const phase = ses?.phases?.find(p => p.id === c.phaseId) || null;
  const consigne = phase ? { title: ses.title || '', phase: phase.title || P.PHASE_KINDS[phase.kind]?.label || '', text: phase.consigne || phase.question || phase.exercices || '', trace: phase.kind === 'institution' ? (phase.trace || '') : '' } : null;
  // Devoirs : uniquement ceux de toute la classe ou d'un niveau (jamais ceux visant des élèves nommés).
  const devoirs = store.all('homework').filter(x => x.classId === cls.id && x.givenDate === date && (!x.targets || x.targets.kind !== 'élèves'))
    .map(x => ({ title: x.title, dueDate: x.dueDate, levels: x.targets?.kind === 'niveau' ? x.targets.values : [] }));
  const support = c.supportFileId ? (() => { const f = store.get(c.supportFileId); if (!f || f.deletedAt) return null; const v = (f.versions || []).at(-1);
    return f.kind === 'link' ? { kind: 'link', name: f.name, url: f.url || '' } : { kind: 'blob', blobId: v?.blobId, mime: v?.mime, name: f.name }; })() : null;
  // Groupes : nom, couleur, prénoms, rôles, activité. Jamais de niveau ni de besoin individuel.
  const occGroups = entry?.occ?.groups;
  const set = c.groupSetId ? store.get(c.groupSetId) : null;
  const gsrc = occGroups || (set && !set.deletedAt ? G.snapshotSet(set) : null);
  const groupes = gsrc ? { name: gsrc.name, groups: gsrc.groups.map(g => ({ name: g.name, color: g.color, activity: g.activity || '', members: g.memberIds.map(id => { const st = store.get(id); return st ? `${st.firstName}${g.roles?.[id] ? ' (' + g.roles[id] + ')' : ''}` : null; }).filter(Boolean) })) } : null;
  // Rotation des ateliers : chaque groupe passe à l'atelier suivant (activités des groupes, dans l'ordre).
  if (groupes && c.rotation?.on && groupes.groups.length > 1) {
    const n = groupes.groups.length, s = (((c.rotation.step || 0) % n) + n) % n; const acts = groupes.groups.map(g => g.activity);
    groupes.groups = groupes.groups.map((g, i) => ({ ...g, activity: acts[(i + s) % n] || '' })); groupes.rotation = { index: s + 1, total: n };
  }
  const ssh = c.slideshowId ? store.get(c.slideshowId) : null;
  const sl = ssh && !ssh.deletedAt ? ssh.slides[Math.min(c.slideIndex || 0, ssh.slides.length - 1)] : null;
  const diapo = sl ? (() => { const f = sl.fileId ? store.get(sl.fileId) : null; const v = f?.versions?.at(-1);
    return { kind: sl.kind, kicker: sl.kicker || '', title: sl.title || '', text: sl.text || '', minutes: sl.minutes || null, blobId: v?.blobId || null, mime: v?.mime || '', url: sl.kind === 'lien' ? (sl.url || '') : '', index: c.slideIndex || 0, count: ssh.slides.length }; })() : null;
  // Vie de classe : uniquement des prénoms (tirage) ; anniversaires seulement si l'enseignante l'a coché.
  const name = (id) => store.get(id)?.firstName || null;
  const tirage = c.tirage ? { names: c.tirage.ids.map(name).filter(Boolean), pool: R.drawPool(cls, date).map(s => s.firstName), seq: c.tirage.seq } : null;
  const layout = c.layoutId ? W.layoutOf(c.layoutId) : null;
  const has = (k) => !!layout?.items.some(x => x.key === k);
  const rituel = c.panels.rituels || has('rituel') ? R.ritual(cls, date, { meteo: c.meteo, birthdays: c.birthdays }) : null;
  const qr = (c.panels.qr || has('qr')) && c.qr?.text ? { text: c.qr.text, label: c.qr.label || '' } : null;
  const vote = (c.panels.vote || has('vote')) && c.vote?.options?.length ? { question: c.vote.question || '', options: c.vote.options } : null;
  const des = (c.panels.des || has('des')) && c.dice ? c.dice : null;
  return { qr, vote, des, tableau: !!(c.panels.tableau || has('tableau')), layout: layout ? { name: layout.name, items: layout.items } : null, chrono: c.chrono || W.CHRONO0, clock: { ...DEF.clock, ...(c.clock || {}) }, picto: R.pictoOf(c.picto), feu: c.feu || null, tirage, rituel, diapo, groupes, date, dateLabel: model.frDate(date, { weekday: 'long', day: 'numeric', month: 'long' }), panels: c.panels, programme, consigne, devoirs, message: c.message || '', support, blank: !!c.blank };
}

/** Envoie une diapositive à l'écran de projection (sans les notes présentateur). */
export function projectSlide(cls, slideshowId, index) {
  ctrl = { ...ctrl, slideshowId, slideIndex: index, panels: { ...ctrl.panels, diapo: true } };
  publish(cls, model.todayIso());
}

function publish(cls, date) {
  ctrl.pubDate = date;
  try { localStorage.setItem(KEY, JSON.stringify(ctrl)); localStorage.setItem(`${KEY}-payload`, JSON.stringify(buildPayload(cls, date))); } catch { /* */ }
  if (channel) channel.postMessage({ type: 'payload', payload: buildPayload(cls, date) });
}

// ───────── Pupitre
export function render({ query, rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Projection'), subTabs(), missing);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.d || '') ? query.d : model.todayIso();
  const plan = PL.dayPlan(cls, date);
  const entries = plan.entries.filter(e => e.kind !== 'event');
  const entry = entries.find(e => e.key === ctrl.entryKey) || null;
  const set = (patch) => { ctrl = { ...ctrl, ...patch }; publish(cls, date); rerender(); };
  rerenderPupitre = rerender;
  const setPanel = (k, v) => set({ panels: { ...ctrl.panels, [k]: v } });
  publish(cls, date);
  const payload = buildPayload(cls, date);
  const files = entry ? FL.entryFiles(entry).sort((a, b) => (b.role === 'projeter') - (a.role === 'projeter')).map(x => x.file) : [];

  return h('div', { class: 'page' },
    pageHeader('Projection', { favKey: 'aujourdhui/projection', subtitle: `${cls.name} · ${model.frDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}`,
      actions: [
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'open-screen', onclick: () => { const w = window.open(`${location.pathname}#/ecran`, 'classeur-ecran', 'popup,width=1280,height=760'); if (!w) toast('Le navigateur a bloqué la fenêtre : autorisez les fenêtres pour ce site, ou utilisez « Projeter ici ».', { kind: 'error' }); } }, icon('link', 16), 'Ouvrir l’écran de projection'),
        h('a', { class: 'btn', href: '#/ecran' }, 'Projeter ici (plein écran)')] }),
    subTabs(),
    h('div', { class: 'card notice' }, h('p', {}, 'L’écran de projection n’affiche que ce qui est coché ci-dessous : jamais de bilans, notes, coordonnées ni informations personnelles. Glissez la fenêtre « écran » sur le vidéoprojecteur ou le TNI et mettez-la en plein écran (F11).')),
    h('div', { class: 'grid-2' },
      h('section', { class: 'card' }, h('h2', {}, 'Ce qui est projeté'),
        h('div', { class: 'chips' }, [['programme', 'Programme du jour'], ['consigne', 'Consigne'], ['devoirs', 'Devoirs'], ['timer', 'Timer'], ['support', 'Support'], ['groupes', 'Groupes'], ['horloge', 'Horloge'], ['chrono', 'Chronomètre']].map(([k, l]) =>
          h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: !!ctrl.panels[k], 'data-testid': `panel-${k}`, onchange: (e) => setPanel(k, e.target.checked) }), l))),
        ctrl.layoutId && W.layoutOf(ctrl.layoutId) ? h('p', { class: 'muted small', 'data-testid': 'free-note' }, `Disposition « ${W.layoutOf(ctrl.layoutId).name} » : l’écran affiche les widgets placés, ces cases ne servent qu’à la disposition classique.`) : null,
        G.setsOf(cls.id).length ? h('label', { class: 'inline' }, 'Groupes projetés', h('select', { 'data-testid': 'proj-groupset', onchange: (e) => set({ groupSetId: e.target.value || null, panels: { ...ctrl.panels, groupes: !!e.target.value } }) },
          h('option', { value: '' }, entry?.occ?.groups ? 'ceux de la séance' : '—'), G.setsOf(cls.id).map(gs => h('option', { value: gs.id, selected: ctrl.groupSetId === gs.id }, gs.name)))) : null,
        payload.groupes ? rotationBlock(payload, set) : null,
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: ctrl.blank, onchange: (e) => set({ blank: e.target.checked }) }), 'Écran noir (masquer tout)'),
        h('div', { class: 'field' }, h('label', {}, 'Message affiché'), h('input', { value: ctrl.message, placeholder: 'ex. Sortez votre cahier du jour', 'data-testid': 'proj-message', onchange: (e) => set({ message: e.target.value }) })),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-small', type: 'button', onclick: () => T.open() }, 'Régler le timer'), h('span', { class: 'muted small' }, 'Le timer projeté suit celui de l’application.'))),
      h('section', { class: 'card' }, h('h2', {}, 'Aperçu de l’écran'), h('div', { class: 'screen-preview' }, screenView(payload, true)))),
    ctrl.slideshowId && store.get(ctrl.slideshowId) ? (() => { const ss = store.get(ctrl.slideshowId); const i = Math.min(ctrl.slideIndex || 0, ss.slides.length - 1); const sl = ss.slides[i];
      return h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, `Diaporama : ${ss.title}`),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-small', type: 'button', onclick: () => set({ slideIndex: Math.max(0, i - 1) }) }, '‹ Précédente'), h('span', {}, `${i + 1} / ${ss.slides.length}`),
          h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'slide-next', onclick: () => set({ slideIndex: Math.min(ss.slides.length - 1, i + 1) }) }, 'Suivante ›'),
          h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: !!ctrl.panels.diapo, onchange: (e) => setPanel('diapo', e.target.checked) }), 'Projeter le diaporama'),
          h('button', { class: 'btn btn-small', type: 'button', onclick: () => set({ slideshowId: null, panels: { ...ctrl.panels, diapo: false } }) }, 'Arrêter'))),
        h('p', {}, h('strong', {}, sl?.title || '')),
        sl?.notes ? h('div', { class: 'presenter' }, h('h3', {}, 'Notes présentateur (non projetées)'), h('p', { class: 'pre' }, sl.notes)) : null,
        sl?.minutes ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => { T.setDuration(sl.minutes * 60); T.open(); T.start(); } }, `Timer ${sl.minutes} min`) : null);
    })() : null,
    classLifeCard(cls, date, set),
    clockCard(set),
    toolsCard(set),
    layoutCard(set),
    h('section', { class: 'card' }, h('h2', {}, 'Séance projetée'),
      entries.length ? h('div', { class: 'quick-list' }, entries.map(e => h('button', { class: `quick-item ${e.key === ctrl.entryKey ? 'on' : ''}`, type: 'button', 'data-testid': 'proj-entry', onclick: () => set({ entryKey: e.key, phaseId: e.session?.phases?.[0]?.id || null, supportFileId: null }) },
        h('strong', {}, `${e.start}–${e.end} · ${e.subject || ''}`), h('span', { class: 'muted' }, e.title)))) : emptyState('Aucune séance ce jour'),
      entry?.session ? h('div', {}, h('h3', {}, 'Phase'),
        h('div', { class: 'seg wrap', role: 'group', 'aria-label': 'Phase' }, (entry.session.phases || []).map((ph, i) => h('button', { type: 'button', class: ph.id === ctrl.phaseId ? 'on' : '', 'data-testid': 'proj-phase', onclick: () => set({ phaseId: ph.id }) }, `${i + 1}. ${ph.title || P.PHASE_KINDS[ph.kind]?.label || 'Phase'}`))),
        (() => { const ph = entry.session.phases?.find(p => p.id === ctrl.phaseId); if (!ph) return null;
          const notes = ['enseignant', 'reponses', 'difficultes', 'differenciation', 'relances', 'correction'].filter(k => ph[k]);
          return h('div', { class: 'presenter' }, h('h3', {}, 'Notes de l’enseignante (non projetées)'),
            ph.duration ? h('p', {}, `Durée : ${ph.duration} min `, h('button', { class: 'btn btn-small', type: 'button', onclick: () => { T.setDuration(ph.duration * 60); T.open(); } }, 'Timer sur cette durée')) : null,
            notes.length ? h('dl', { class: 'dl' }, notes.map(k => [h('dt', {}, (P.PHASE_KINDS[ph.kind]?.fields.find(f => f.key === k) || { label: k }).label), h('dd', { class: 'pre' }, ph[k])])) : h('p', { class: 'muted' }, 'Aucune note pour cette phase.'));
        })(),
        files.length ? h('div', {}, h('h3', {}, 'Supports de la séance'), h('div', { class: 'row' }, files.map(f => h('button', { class: `btn btn-small ${ctrl.supportFileId === f.id ? 'btn-primary' : ''}`, type: 'button', onclick: () => set({ supportFileId: ctrl.supportFileId === f.id ? null : f.id, panels: { ...ctrl.panels, support: true } }) }, f.name)))) : null)
        : entry ? h('p', { class: 'muted' }, 'Aucune fiche de séance liée à ce créneau : seul le programme est projeté.') : null));
}

// ───────── Rotation des ateliers
let rerenderPupitre = null;
// Une autre fenêtre (l'écran) a fait avancer la rotation : le pupitre se met à jour.
window.addEventListener('storage', (e) => { if (e.key === KEY) { ctrl = loadCtrl(); if (document.querySelector('[data-testid=class-life]')) rerenderPupitre?.(); } });
// Fin du timer : passer automatiquement à l'atelier suivant et relancer le timer (une seule fenêtre le fait).
T.onFinish(() => {
  const c = loadCtrl(); if (!c.rotation?.on || !c.rotation.auto) return;
  const cls = model.currentClass(); if (!cls) return;
  const date = c.pubDate || model.todayIso(); const n = buildPayload(cls, date, c).groupes?.rotation?.total || 0;
  if (!n) return;
  if ((c.rotation.step || 0) + 1 >= n) { ctrl = { ...c, rotation: { ...c.rotation, auto: false } }; publish(cls, date); toast('Rotation terminée : chaque groupe est passé à tous les ateliers.'); rerenderPupitre?.(); return; }
  ctrl = { ...c, rotation: { ...c.rotation, step: (c.rotation.step || 0) + 1 } }; publish(cls, date);
  setTimeout(() => T.start(), 400);
  toast(`Rotation ${ctrl.rotation.step + 1}/${n} : changement d’atelier.`);
  if (document.querySelector('[data-testid=class-life]')) rerenderPupitre?.();
});
function rotationBlock(payload, set) {
  const r = ctrl.rotation || DEF.rotation; const g = payload.groupes; const n = g.groups.length;
  const withActs = g.groups.filter(x => x.activity).length;
  const rot = (patch) => set({ rotation: { ...r, ...patch } });
  return h('div', { class: 'rotation-block', 'data-testid': 'rotation-block' },
    h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: r.on, 'data-testid': 'rotation-on', onchange: (e) => rot({ on: e.target.checked, step: 0 }) }), 'Rotation des ateliers'),
    r.on ? [
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'rotation-prev', disabled: !(r.step > 0), onclick: () => rot({ step: Math.max(0, r.step - 1) }) }, '◀ Précédente'),
        h('strong', { 'data-testid': 'rotation-index' }, `Rotation ${g.rotation?.index || 1}/${n}`),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'rotation-next', disabled: r.step + 1 >= n, onclick: () => rot({ step: Math.min(n - 1, r.step + 1) }) }, 'Suivante ▶')),
      h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: r.auto, 'data-testid': 'rotation-auto', onchange: (e) => rot({ auto: e.target.checked }) }), 'À la fin du timer, passer à l’atelier suivant et relancer le timer'),
      h('p', { class: 'muted small' }, withActs < n ? 'Indiquez l’activité de chaque groupe (Ma classe › Groupes) : ce sont les ateliers qui tournent.' : 'Chaque groupe passe à l’atelier du groupe suivant. L’écran projeté doit rester ouvert pour le passage automatique.')] : null);
}

// ───────── Petits outils (pupitre)
function toolsCard(set) {
  const q = ctrl.qr || DEF.qr; const v = ctrl.vote || DEF.vote;
  const panel = (k, label) => h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: !!ctrl.panels[k], 'data-testid': `panel-${k}`, onchange: (e) => set({ panels: { ...ctrl.panels, [k]: e.target.checked } }) }), label);
  const qrIn = h('input', { value: q.text, placeholder: 'https://… ou un texte', 'data-testid': 'qr-text', 'aria-label': 'Lien ou texte du QR code' });
  const qrLbl = h('input', { value: q.label, placeholder: 'Légende (facultative)', 'aria-label': 'Légende du QR code' });
  const prev = h('div', { class: 'qr-mini' }); if (q.text) prev.innerHTML = W.qrSvg(q.text);
  const optsIn = h('textarea', { rows: 4, 'data-testid': 'vote-options', placeholder: 'Une réponse par ligne (6 au plus)\nOui\nNon', 'aria-label': 'Réponses du vote' }, v.options.map(o => o.label).join('\n'));
  const qIn = h('input', { value: v.question, placeholder: 'Question (facultative)', 'data-testid': 'vote-question', 'aria-label': 'Question du vote' });
  const setVote = (patch) => set({ vote: { ...v, ...patch } });
  const count = (i, d) => setVote({ options: v.options.map((o, j) => j === i ? { ...o, count: Math.max(0, (o.count || 0) + d) } : o) });
  return h('section', { class: 'card', 'data-testid': 'tools-card' }, h('h2', {}, 'Petits outils'),
    h('div', { class: 'grid-2' },
      h('div', { class: 'life-block' }, h('h3', {}, 'QR code'), panel('qr', 'Projeter le QR code'), qrIn, qrLbl,
        h('div', { class: 'row' }, h('button', { class: 'btn btn-primary btn-small', type: 'button', 'data-testid': 'qr-go', onclick: () => set({ qr: { text: qrIn.value.trim(), label: qrLbl.value.trim() }, panels: { ...ctrl.panels, qr: !!qrIn.value.trim() } }) }, 'Créer et projeter'), prev),
        h('p', { class: 'muted small' }, 'Le QR code est fabriqué sur cet appareil, sans service en ligne : les élèves le flashent avec une tablette pour ouvrir un lien.')),
      h('div', { class: 'life-block' }, h('h3', {}, 'Dés'), panel('des', 'Projeter les dés'),
        h('div', { class: 'row' },
          h('label', { class: 'inline' }, 'Nombre', h('select', { 'data-testid': 'dice-count', onchange: (e) => set({ diceCount: Number(e.target.value) }) }, [1, 2, 3, 4, 5, 6].map(n => h('option', { value: n, selected: ctrl.diceCount === n }, n)))),
          h('label', { class: 'inline' }, 'Faces', h('select', { 'data-testid': 'dice-faces', onchange: (e) => set({ diceFaces: Number(e.target.value) }) }, W.DICE_FACES.map(n => h('option', { value: n, selected: ctrl.diceFaces === n }, n === 6 ? '6 (points)' : n)))),
          h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'dice-roll', onclick: () => set({ dice: { values: W.rollDice(ctrl.diceCount, ctrl.diceFaces), faces: ctrl.diceFaces, seq: (ctrl.dice?.seq || 0) + 1 }, panels: { ...ctrl.panels, des: true } }) }, 'Lancer')),
        ctrl.dice ? h('p', { class: 'life-result', 'data-testid': 'dice-result' }, ctrl.dice.values.join(' · '), ctrl.dice.values.length > 1 ? ` (total ${ctrl.dice.values.reduce((a, b) => a + b, 0)})` : '') : null),
      h('div', { class: 'life-block' }, h('h3', {}, 'Vote à main levée'), panel('vote', 'Projeter le vote'), qIn, optsIn,
        h('div', { class: 'row' }, h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'vote-apply', onclick: () => set({ vote: { question: qIn.value.trim(), options: W.voteOptions(optsIn.value, v.options) }, panels: { ...ctrl.panels, vote: true } }) }, 'Mettre à jour les réponses'),
          v.options.length ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'vote-reset', onclick: () => setVote({ options: v.options.map(o => ({ ...o, count: 0 })) }) }, 'Remettre à zéro') : null),
        v.options.length ? h('div', { class: 'vote-ctl' }, v.options.map((o, i) => h('div', { class: 'row' }, h('span', { class: 'vote-ctl-label' }, o.label),
          h('button', { class: 'btn btn-small', type: 'button', 'aria-label': `Retirer un vote : ${o.label}`, onclick: () => count(i, -1) }, '−'), h('strong', { 'data-testid': `vote-count-${i}` }, String(o.count || 0)),
          h('button', { class: 'btn btn-small', type: 'button', 'aria-label': `Ajouter un vote : ${o.label}`, 'data-testid': `vote-plus-${i}`, onclick: () => count(i, 1) }, '+')))) : null,
        h('p', { class: 'muted small' }, 'Comptez les mains levées et cliquez « + » : le graphique se met à jour sur l’écran. Le vote est anonyme.')),
      h('div', { class: 'life-block' }, h('h3', {}, 'Tableau blanc'), panel('tableau', 'Projeter le tableau blanc'),
        h('p', { class: 'muted small' }, 'On dessine directement sur l’écran projeté (TNI, tablette ou souris) : feutres de couleur, gomme, tout effacer. Les dessins restent sur l’écran, ils ne sont pas enregistrés.'))));
}

// ───────── Horloge et chronomètre (pupitre)
function clockCard(set) {
  const c = ctrl.chrono || W.CHRONO0; const k = { ...DEF.clock, ...(ctrl.clock || {}) };
  const setClock = (patch) => set({ clock: { ...k, ...patch }, panels: { ...ctrl.panels, horloge: true } });
  const live = h('strong', { class: 'chrono-live', 'data-testid': 'chrono-live' }, W.fmtChrono(W.chronoMs(c)));
  if (c.running) { const iv = setInterval(() => { if (!live.isConnected) { clearInterval(iv); return; } live.textContent = W.fmtChrono(W.chronoMs(ctrl.chrono)); }, 250); }
  return h('section', { class: 'card', 'data-testid': 'clock-card' }, h('h2', {}, 'Horloge et chronomètre'),
    h('div', { class: 'grid-2' },
      h('div', { class: 'life-block' }, h('h3', {}, 'Horloge à aiguilles'),
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: !!ctrl.panels.horloge, 'data-testid': 'panel-horloge2', onchange: (e) => set({ panels: { ...ctrl.panels, horloge: e.target.checked } }) }), 'Projeter l’horloge'),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Heure affichée' },
          h('button', { type: 'button', class: k.mode !== 'fixe' ? 'on' : '', 'data-testid': 'clock-real', onclick: () => setClock({ mode: 'reelle' }) }, 'Heure réelle'),
          h('button', { type: 'button', class: k.mode === 'fixe' ? 'on' : '', 'data-testid': 'clock-fixed', onclick: () => setClock({ mode: 'fixe' }) }, 'Heure à lire')),
        k.mode === 'fixe' ? h('label', { class: 'inline' }, 'Heure', h('input', { type: 'time', value: k.time, 'data-testid': 'clock-time', onchange: (e) => setClock({ time: e.target.value || '09:00' }) })) : null,
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: k.digital, 'data-testid': 'clock-digital', onchange: (e) => setClock({ digital: e.target.checked }) }), 'Afficher aussi l’heure en chiffres'),
        k.mode !== 'fixe' ? h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: k.seconds, onchange: (e) => setClock({ seconds: e.target.checked }) }), 'Trotteuse (secondes)') : null,
        h('p', { class: 'muted small' }, 'Heure à lire : pour la lecture de l’heure, réglez l’horloge et décochez l’heure en chiffres le temps que la classe cherche.')),
      h('div', { class: 'life-block' }, h('h3', {}, 'Chronomètre'),
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: !!ctrl.panels.chrono, 'data-testid': 'panel-chrono2', onchange: (e) => set({ panels: { ...ctrl.panels, chrono: e.target.checked } }) }), 'Projeter le chronomètre'),
        h('div', { class: 'row' }, live,
          h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'chrono-toggle', onclick: () => set({ chrono: W.chronoToggle(c), panels: { ...ctrl.panels, chrono: true } }) }, c.running ? 'Pause' : (W.chronoMs(c) ? 'Reprendre' : 'Démarrer')),
          h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'chrono-reset', onclick: () => set({ chrono: { ...W.CHRONO0 } }) }, 'Remettre à zéro')),
        h('p', { class: 'muted small' }, 'Il compte le temps qui passe (défi, calcul mental, rangement) ; le timer, lui, décompte.'))));
}

// ───────── Disposition libre de l'écran (pupitre)
let editSel = null, refocus = false;
function layoutCard(set) {
  const list = W.layouts(); const cur = ctrl.layoutId ? W.layoutOf(ctrl.layoutId) : null;
  const save = async (items) => { await W.upsertLayout({ ...cur, items: items.map(W.clampItem) }); set({}); };
  const create = (from = null) => {
    const name = h('input', { value: from ? `${from.name} (copie)` : '', placeholder: 'ex. Rituels, Ateliers, Calcul mental', 'data-testid': 'layout-name' });
    const tpl = h('select', { 'data-testid': 'layout-template' }, W.TEMPLATES.map(([k, l]) => h('option', { value: k, selected: k === 'rituels' }, l)));
    modal({ title: from ? 'Dupliquer la disposition' : 'Nouvelle disposition', body: h('div', { class: 'stack' }, h('div', { class: 'field' }, h('label', {}, 'Nom'), name),
      from ? null : h('div', { class: 'field' }, h('label', {}, 'Point de départ'), tpl), h('p', { class: 'muted small' }, 'Vous placerez ensuite les widgets en les faisant glisser, et les agrandirez par le coin.')),
    actions: [{ label: 'Annuler', onClick: () => {} }, { label: 'Créer', primary: true, testid: 'layout-create-go', onClick: async () => {
      const l = from ? { ...from, id: store.uid(), name: name.value.trim() || `${from.name} (copie)`, items: from.items.map(x => ({ ...x })) } : W.newLayout(name.value.trim(), tpl.value);
      await W.upsertLayout(l); editSel = null; set({ layoutId: l.id });
    } }] });
  };
  const rename = () => { const name = h('input', { value: cur.name, 'data-testid': 'layout-rename-input' });
    modal({ title: 'Renommer la disposition', body: h('div', { class: 'field' }, h('label', {}, 'Nom'), name), actions: [{ label: 'Annuler', onClick: () => {} }, { label: 'Renommer', primary: true, onClick: async () => { await W.upsertLayout({ ...cur, name: name.value.trim() || cur.name }); set({}); } }] }); };
  const del = async () => { if (!(await confirmDialog('Supprimer la disposition', `Supprimer « ${cur.name} » ? L’écran reviendra à la disposition classique.`, { confirmLabel: 'Supprimer', danger: true }))) return;
    await W.saveLayouts(list.filter(l => l.id !== cur.id)); editSel = null; set({ layoutId: null }); };

  const head = h('div', { class: 'row' },
    h('label', { class: 'inline' }, 'Disposition', h('select', { 'data-testid': 'layout-select', onchange: (e) => { editSel = null; set({ layoutId: e.target.value || null }); } },
      h('option', { value: '' }, 'Classique (automatique)'), list.map(l => h('option', { value: l.id, selected: l.id === ctrl.layoutId }, l.name)))),
    h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'layout-new', onclick: () => create() }, icon('plus', 14), 'Nouvelle disposition'),
    cur ? h('button', { class: 'btn btn-small', type: 'button', onclick: rename }, 'Renommer') : null,
    cur ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => create(cur) }, 'Dupliquer') : null,
    cur ? h('button', { class: 'btn btn-small btn-danger', type: 'button', 'data-testid': 'layout-delete', onclick: del }, 'Supprimer') : null);
  if (!cur) return h('section', { class: 'card', 'data-testid': 'layout-card' }, h('h2', {}, 'Disposition de l’écran'), head,
    h('p', { class: 'muted small' }, 'Classique : l’écran s’organise tout seul selon ce qui est coché. Créez une disposition pour placer vous-même les widgets (horloge, timer, tirage, pictogramme…) et la retrouver d’un clic, par exemple « Rituels » ou « Ateliers ».'));

  const items = cur.items.map(x => ({ ...x }));
  if (editSel != null && editSel >= items.length) editSel = null;
  const canvas = h('div', { class: 'layout-canvas', 'data-testid': 'layout-canvas' });
  const place = (el, i) => Object.assign(el.style, { left: `${i.x}%`, top: `${i.y}%`, width: `${i.w}%`, height: `${i.h}%` });
  items.forEach((it, idx) => {
    const grip = h('span', { class: 'lw-resize', 'aria-hidden': 'true', 'data-testid': 'lw-resize' });
    const box = h('div', { class: `lw ${editSel === idx ? 'sel' : ''}`, tabindex: '0', role: 'button', 'data-testid': 'lw', 'data-key': it.key, 'aria-label': `${W.widgetLabel(it.key)} : flèches pour déplacer, Maj + flèches pour redimensionner`,
      onkeydown: (e) => { const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d) { if (e.key === 'Delete') { items.splice(idx, 1); editSel = null; save(items); } return; }
        e.preventDefault(); editSel = idx; refocus = true; const n = e.shiftKey ? { ...it, w: it.w + d[0] * 2, h: it.h + d[1] * 2 } : { ...it, x: it.x + d[0] * 2, y: it.y + d[1] * 2 }; items[idx] = W.clampItem(n); save(items); } },
      h('span', { class: 'lw-label' }, W.widgetLabel(it.key)), grip);
    place(box, it);
    box.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return; ev.preventDefault(); box.setPointerCapture?.(ev.pointerId);
      const r = canvas.getBoundingClientRect(); const sx = ev.clientX, sy = ev.clientY; const resize = ev.target === grip; let moved = false; let n = it;
      const move = (e) => { const dx = (e.clientX - sx) / r.width * 100, dy = (e.clientY - sy) / r.height * 100; if (Math.abs(dx) + Math.abs(dy) > .5) moved = true;
        n = W.clampItem(resize ? { ...it, w: it.w + dx, h: it.h + dy } : { ...it, x: it.x + dx, y: it.y + dy }); place(box, n); };
      const up = () => { box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', up); box.removeEventListener('pointercancel', up);
        editSel = idx; if (moved) { items[idx] = n; save(items); } else set({}); };
      box.addEventListener('pointermove', move); box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    });
    canvas.append(box);
  });
  if (refocus) { refocus = false; setTimeout(() => canvas.querySelectorAll('.lw')[editSel]?.focus(), 0); }
  if (!items.length) canvas.append(h('p', { class: 'layout-empty muted' }, 'Ajoutez des widgets avec la liste ci-dessous.'));
  const sel = editSel != null ? items[editSel] : null;
  const scale = (d) => { items[editSel] = { ...sel, scale: Math.max(.5, Math.min(3, Math.round(((sel.scale || 1) + d) * 10) / 10)) }; save(items); };
  return h('section', { class: 'card', 'data-testid': 'layout-card' }, h('h2', {}, 'Disposition de l’écran'), head,
    h('p', { class: 'muted small' }, 'Faites glisser un widget pour le déplacer, tirez le coin pour l’agrandir. Clavier : sélectionnez-le puis flèches (Maj + flèches pour la taille). Le résultat s’affiche aussitôt sur l’écran projeté.'),
    canvas,
    h('div', { class: 'row', style: { marginTop: '8px' } },
      h('label', { class: 'inline' }, 'Ajouter', h('select', { 'data-testid': 'layout-add', onchange: (e) => { if (!e.target.value) return; items.push(W.clampItem({ key: e.target.value, ...W.freeSpot(items), scale: 1 })); editSel = items.length - 1; save(items); } },
        h('option', { value: '' }, 'un widget…'), W.WIDGETS.map(([k, l]) => h('option', { value: k }, `${l}${items.some(x => x.key === k) ? ' (déjà placé)' : ''}`)))),
      sel ? [h('span', { class: 'muted' }, `Sélection : ${W.widgetLabel(sel.key)}`),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'lw-smaller', 'aria-label': 'Texte plus petit', onclick: () => scale(-.1) }, 'A−'),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'lw-bigger', 'aria-label': 'Texte plus grand', onclick: () => scale(.1) }, 'A+'),
        h('button', { class: 'btn btn-small btn-danger', type: 'button', 'data-testid': 'lw-remove', onclick: () => { items.splice(editSel, 1); editSel = null; save(items); } }, 'Retirer')] : null));
}

// ───────── Vie de classe (pupitre)
// Feu automatique : le micro est analysé sur l'appareil de l'enseignante, rien n'est enregistré ni envoyé.
const mic = { stream: null, ctx: null, raf: 0, zone: null, since: 0, calm: 45, loud: 70 };
export function stopMic() { cancelAnimationFrame(mic.raf); mic.stream?.getTracks().forEach(t => t.stop()); mic.ctx?.close().catch(() => {}); mic.stream = null; mic.ctx = null; mic.zone = null; }
async function startMic(onFeu, marker) {
  try { mic.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
  catch { toast('Micro refusé ou absent : autorisez le micro pour ce site.', { kind: 'error' }); return false; }
  mic.ctx = new AudioContext(); const an = mic.ctx.createAnalyser(); an.fftSize = 2048;
  mic.ctx.createMediaStreamSource(mic.stream).connect(an);
  const buf = new Float32Array(an.fftSize);
  const loop = () => {
    if (!marker.isConnected && !document.querySelector('[data-mic-marker]')) { stopMic(); return; }
    an.getFloatTimeDomainData(buf); let s = 0; for (const x of buf) s += x * x;
    const z = zoneOf(levelFromRms(Math.sqrt(s / buf.length)), mic.calm, mic.loud);
    // Le feu ne change qu'après 1,5 s dans la même zone, pour éviter le clignotement.
    if (z !== mic.zone) { mic.zone = z; mic.since = performance.now(); }
    else if (mic.since && performance.now() - mic.since > 1500) { mic.since = 0; onFeu(R.feuOfZone(z)); }
    mic.raf = requestAnimationFrame(loop);
  };
  loop(); return true;
}

function classLifeCard(cls, date, set) {
  const pool = R.drawPool(cls, date);
  const done = (ctrl.drawn || []).filter(id => pool.some(s => s.id === id));
  const doDraw = () => {
    if (!pool.length) { toast('Aucun élève présent à tirer.', { kind: 'error' }); return; }
    const r = R.draw(pool, { count: ctrl.drawCount || 1, drawn: ctrl.drawn || [], noRepeat: ctrl.noRepeat });
    if (r.newRound) toast('Tout le monde est passé : nouveau tour.');
    set({ tirage: { ids: r.picked, seq: (ctrl.tirage?.seq || 0) + 1 }, drawn: r.drawn });
  };
  const marker = h('span', { 'data-mic-marker': '1', hidden: true });
  const tirageNames = (ctrl.tirage?.ids || []).map(id => store.get(id)?.firstName).filter(Boolean);
  return h('section', { class: 'card', 'data-testid': 'class-life' }, h('h2', {}, 'Vie de classe'),
    h('p', { class: 'muted small' }, 'Tirage au sort, consignes de travail et rituels du matin, affichés en grand sur l’écran projeté. Seuls les prénoms apparaissent.'),
    h('div', { class: 'grid-3 life-grid' },
      h('div', { class: 'life-block' }, h('h3', {}, 'Tirer au sort'),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'draw', onclick: doDraw }, `Tirer ${ctrl.drawCount > 1 ? ctrl.drawCount + ' élèves' : 'un élève'}`),
          h('label', { class: 'inline' }, 'Nombre', h('select', { 'data-testid': 'draw-count', onchange: (e) => set({ drawCount: Number(e.target.value) }) }, [1, 2, 3, 4].map(n => h('option', { value: n, selected: (ctrl.drawCount || 1) === n }, n))))),
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: ctrl.noRepeat, 'data-testid': 'draw-norepeat', onchange: (e) => set({ noRepeat: e.target.checked, drawn: [] }) }), 'Chacun son tour (sans répéter)'),
        tirageNames.length ? h('p', { class: 'life-result', 'data-testid': 'draw-result' }, tirageNames.join(' · ')) : null,
        h('p', { class: 'muted small' }, `${pool.length} élève(s) présent(s)${ctrl.noRepeat ? ` · déjà passés : ${done.length}/${pool.length}` : ''}. Les absents de l’appel sont exclus.`),
        h('div', { class: 'row' },
          ctrl.noRepeat && done.length ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'draw-reset', onclick: () => set({ drawn: [] }) }, 'Nouveau tour') : null,
          ctrl.tirage ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'draw-hide', onclick: () => set({ tirage: null }) }, 'Retirer de l’écran') : null)),
      h('div', { class: 'life-block' }, h('h3', {}, 'Consigne de travail'),
        h('div', { class: 'picto-grid' }, R.PICTOS.map(([k, e, l]) => h('button', { type: 'button', class: `picto-btn ${ctrl.picto === k ? 'on' : ''}`, 'aria-pressed': String(ctrl.picto === k), 'data-testid': `picto-${k}`, title: l, onclick: () => set({ picto: ctrl.picto === k ? null : k }) }, h('span', { class: 'picto-emoji', 'aria-hidden': 'true' }, e), h('span', { class: 'picto-label' }, l)))),
        h('h3', {}, 'Feu du bruit'),
        h('div', { class: 'row' }, R.FEUX.map(([k, l]) => h('button', { type: 'button', class: `feu-btn feu-${k} ${ctrl.feu === k ? 'on' : ''}`, title: l, 'aria-label': l, 'aria-pressed': String(ctrl.feu === k), 'data-testid': `feu-${k}`, onclick: () => { if (mic.stream) stopMic(); set({ feu: ctrl.feu === k ? null : k }); } })),
          h('button', { class: `btn btn-small ${mic.stream ? 'btn-primary' : ''}`, type: 'button', 'data-testid': 'feu-auto', onclick: async () => {
            if (mic.stream) { stopMic(); set({}); return; }
            if (await startMic((f) => { if (ctrl.feu !== f) set({ feu: f }); }, marker)) set({});
          } }, mic.stream ? 'Arrêter le micro' : 'Automatique (micro)'), marker),
        h('p', { class: 'muted small' }, 'Automatique : le feu suit le niveau sonore de la classe (seuils du sonomètre). Le son est analysé sur cet appareil, jamais enregistré ni envoyé.')),
      h('div', { class: 'life-block' }, h('h3', {}, 'Rituels du matin'),
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: !!ctrl.panels.rituels, 'data-testid': 'panel-rituels', onchange: (e) => set({ panels: { ...ctrl.panels, rituels: e.target.checked } }) }), 'Projeter la date et le jour d’école'),
        h('p', { class: 'small' }, R.ritual(cls, date).dayNumberText || 'Pas de classe ce jour : le numéro du jour d’école n’est pas affiché.'),
        h('p', { class: 'small' }, 'Météo du jour (choisie avec la classe)'),
        h('div', { class: 'picto-grid meteo' }, R.METEO.map(([k, e, l]) => h('button', { type: 'button', class: `picto-btn ${ctrl.meteo === k ? 'on' : ''}`, 'aria-pressed': String(ctrl.meteo === k), title: l, 'data-testid': `meteo-${k}`, onclick: () => set({ meteo: ctrl.meteo === k ? null : k, panels: { ...ctrl.panels, rituels: true } }) }, h('span', { class: 'picto-emoji', 'aria-hidden': 'true' }, e), h('span', { class: 'picto-label' }, l)))),
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: !!ctrl.birthdays, 'data-testid': 'rituel-birthdays', onchange: (e) => set({ birthdays: e.target.checked }) }), 'Souhaiter les anniversaires (prénom seul)'))));
}

// ───────── Écran
/** Vue projetée : n'utilise que le contenu filtré (payload). */
export function screenView(p, preview = false) {
  if (!p) return h('div', { class: 'screen' }, h('p', {}, 'En attente du pupitre…'));
  if (p.blank) return h('div', { class: 'screen blank' });
  const free = !!p.layout;
  const on = (k) => free || !!p.panels[k];
  const tstate = T.getState();
  const timerEl = () => h('section', { class: 'screen-timer' }, diskEl(), h('div', { class: 'screen-time' }, T.fmt(T.remaining())));
  const showTimer = free || (p.panels.timer && (tstate.running || T.remaining() < tstate.duration));
  const supportEl = h('div', { class: 'screen-support' });
  if (on('support') && p.support?.kind === 'blob' && p.support.blobId && !preview) {
    store.getBlob(p.support.blobId).then(b => {
      if (!b) return; const url = URL.createObjectURL(b);
      supportEl.replaceChildren((p.support.mime || '').startsWith('image/') ? h('img', { src: url, alt: p.support.name }) : (p.support.mime === 'application/pdf' ? h('iframe', { src: url, title: p.support.name }) : h('p', {}, p.support.name)));
    });
  } else if (on('support') && p.support?.kind === 'link' && embedOf(p.support.url || '') && !preview) supportEl.append(embedFrame(p.support.url, p.support.name, { note: false }));
  else if (on('support') && p.support) supportEl.append(h('p', { class: 'muted' }, `Support : ${p.support.name}${p.support.kind === 'link' ? ' (lien externe : ouvrez-le dans un autre onglet)' : ''}`));
  if (p.panels.diapo && p.diapo) {
    const d = p.diapo; const media = h('div', { class: 'slide-media' });
    if (d.blobId && !preview) store.getBlob(d.blobId).then(b => { if (!b) return; const url = URL.createObjectURL(b); media.replaceChildren(d.mime.startsWith('image/') ? h('img', { src: url, alt: d.title }) : h('iframe', { src: url, title: d.title })); });
    return h('div', { class: `screen ${preview ? 'preview' : ''}`, 'data-testid': preview ? 'screen-preview' : 'screen' },
      h('div', { class: `slide slide-${d.kind} big` }, d.kicker ? h('div', { class: 'slide-kicker' }, d.kicker) : null, h('div', { class: 'slide-title' }, d.title),
        d.kind === 'image' ? media : d.kind === 'lien' ? (embedOf(d.url) && !preview ? embedFrame(d.url, d.title, { note: false }) : h('div', { class: 'slide-text' }, embedOf(d.url) ? `Présentation ${embedOf(d.url).service} (affichée sur l’écran projeté)` : 'Présentation externe : ouverte sur l’ordinateur de l’enseignante')) : d.text ? h('div', { class: 'slide-text pre' }, d.text) : null),
      signalsEl(p, 'corner-left'),
      showTimer && p.panels.timer ? h('section', { class: 'screen-timer corner' }, diskEl(), h('div', { class: 'screen-time' }, T.fmt(T.remaining()))) : null);
  }
  const date = p.dateLabel.replace(/^./, c => c.toUpperCase());
  const parts = {
    date: () => h('header', { class: 'screen-head' }, h('span', {}, date)),
    message: () => p.message ? h('div', { class: 'screen-message' }, p.message) : null,
    programme: () => on('programme') ? h('section', { class: 'screen-prog' }, h('h2', {}, 'Programme'), h('ol', {}, p.programme.map(x => h('li', { class: x.current ? 'current' : '' }, h('span', { class: 'st' }, x.start), ` ${x.subject}${x.title && x.title !== x.subject ? ' — ' + x.title : ''}`)))) : null,
    tirage: () => p.tirage?.names?.length ? h('section', { class: 'screen-tirage', 'data-seq': String(p.tirage.seq), 'data-testid': 'screen-tirage' }, h('h2', {}, p.tirage.names.length > 1 ? 'Au tableau' : 'C’est à toi'),
      h('div', { class: 'tirage-names', 'data-final': p.tirage.names.join(' · ') }, p.tirage.names.join(' · '))) : null,
    rituel: () => p.rituel ? h('section', { class: 'screen-rituel', 'data-testid': 'screen-rituel' },
      h('p', { class: 'rituel-today' }, p.rituel.today),
      h('p', { class: 'rituel-around' }, p.rituel.yesterday, ' ', p.rituel.tomorrow),
      p.rituel.dayNumberText ? h('p', { class: 'rituel-num' }, p.rituel.dayNumberText) : null,
      p.rituel.meteo ? h('p', { class: 'rituel-meteo' }, h('span', { class: 'rituel-meteo-emoji', 'aria-hidden': 'true' }, p.rituel.meteo.emoji), ` ${p.rituel.meteo.label}.`) : null,
      p.rituel.birthdays?.length ? h('p', { class: 'rituel-anniv' }, `🎂 Joyeux anniversaire ${p.rituel.birthdays.join(' et ')} !`) : null) : null,
    consigne: () => on('consigne') && p.consigne ? h('section', { class: 'screen-consigne' }, h('h2', {}, p.consigne.phase), h('p', { class: 'pre' }, p.consigne.text || ''), p.consigne.trace ? h('p', { class: 'trace pre' }, p.consigne.trace) : null) : null,
    support: () => on('support') && p.support ? supportEl : null,
    groupes: () => on('groupes') && p.groupes ? h('section', { class: 'screen-groups' }, h('h2', {}, p.groupes.name, p.groupes.rotation ? h('span', { class: 'rotation-badge', 'data-testid': 'screen-rotation' }, ` · rotation ${p.groupes.rotation.index}/${p.groupes.rotation.total}`) : null), h('div', { class: 'screen-groups-grid' }, p.groupes.groups.map(g => h('div', { class: 'screen-group', style: { borderColor: g.color } }, h('strong', { style: { color: g.color } }, g.name), g.activity ? h('div', { class: 'small' }, g.activity) : null, h('div', {}, g.members.join(', ')))))) : null,
    devoirs: () => on('devoirs') && p.devoirs.length ? h('section', { class: 'screen-devoirs' }, h('h2', {}, 'Devoirs'), h('ul', {}, p.devoirs.map(d => h('li', {}, `${d.title} — pour le ${model.frDate(d.dueDate, { weekday: 'long', day: 'numeric', month: 'long' })}${d.levels.length ? ' (' + d.levels.join(', ') + ')' : ''}`)))) : null,
    picto: () => p.picto ? signalsEl({ picto: p.picto }) : null,
    feu: () => p.feu ? signalsEl({ feu: p.feu }) : null,
    timer: () => showTimer ? timerEl() : null,
    chrono: () => on('chrono') ? h('section', { class: 'screen-chrono', 'data-testid': 'screen-chrono' }, h('h2', {}, 'Chronomètre'), h('div', { class: 'chrono-time', 'data-chrono': '1' }, W.fmtChrono(W.chronoMs(p.chrono)))) : null,
    horloge: () => on('horloge') ? clockEl(p.clock) : null,
    qr: () => p.qr ? qrEl(p.qr) : null,
    des: () => p.des ? h('section', { class: 'screen-dice', 'data-testid': 'screen-dice' }, h('div', { class: 'dice', 'data-seq': String(p.des.seq) }, p.des.values.map(v => { const d = h('div', { class: 'die', 'data-final': String(v), 'data-faces': String(p.des.faces) }); d.innerHTML = W.dieSvg(v, p.des.faces); return d; })),
      p.des.values.length > 1 ? h('div', { class: 'dice-sum', 'data-sum': '1' }, `Total : ${p.des.values.reduce((a, b) => a + b, 0)}`) : null) : null,
    vote: () => p.vote ? voteEl(p.vote) : null,
    tableau: () => p.tableau ? boardEl(preview) : null,
  };
  if (free) {
    return h('div', { class: `screen free ${preview ? 'preview' : ''}`, 'data-testid': preview ? 'screen-preview' : 'screen' },
      p.layout.items.map(i => { const el = parts[i.key]?.();
        return h('div', { class: `widget widget-${i.key}${el ? '' : ' empty'}`, 'data-widget': i.key, style: { left: `${i.x}%`, top: `${i.y}%`, width: `${i.w}%`, height: `${i.h}%`, '--ws': String(i.scale || 1) } },
          h('div', { class: 'widget-in' }, el || (preview ? h('span', { class: 'widget-ph' }, W.widgetLabel(i.key)) : null))); }));
  }
  const sig = signalsEl(p);
  return h('div', { class: `screen ${preview ? 'preview' : ''}`, 'data-testid': preview ? 'screen-preview' : 'screen' },
    parts.date(), parts.message(),
    h('div', { class: 'screen-grid' },
      parts.programme(),
      h('div', { class: 'screen-main' }, parts.tirage(), parts.rituel(), parts.consigne(), parts.support(), parts.groupes(), parts.devoirs(), parts.des(), parts.vote(), parts.qr(), parts.tableau()),
      h('div', { class: 'screen-side' }, sig, parts.timer(), parts.chrono(), parts.horloge())));
}

function qrEl(q) {
  const box = h('div', { class: 'qr-box' }); box.innerHTML = W.qrSvg(q.text);
  return h('section', { class: 'screen-qr', 'data-testid': 'screen-qr' }, box, h('div', { class: 'qr-label' }, q.label || q.text.replace(/^https?:\/\//, '').slice(0, 60)));
}
function voteEl(v) {
  const total = v.options.reduce((a, o) => a + (o.count || 0), 0); const max = Math.max(1, ...v.options.map(o => o.count || 0));
  return h('section', { class: 'screen-vote', 'data-testid': 'screen-vote' }, v.question ? h('h2', {}, v.question) : null,
    h('div', { class: 'vote-bars' }, v.options.map((o, i) => h('div', { class: 'vote-row' }, h('span', { class: 'vote-label' }, o.label),
      h('span', { class: 'vote-track' }, h('span', { class: `vote-bar c${i % 6}`, style: { width: `${Math.round((o.count || 0) * 100 / max)}%` } })), h('strong', { class: 'vote-count' }, String(o.count || 0))))),
    h('div', { class: 'vote-total' }, `${total} vote${total > 1 ? 's' : ''}`));
}

// Tableau blanc : on dessine directement sur l'écran projeté (TNI, tablette). Les traits restent sur cet écran
// (ils survivent aux mises à jour de l'affichage) et ne sont ni enregistrés ni envoyés.
const board = { strokes: [], color: '#1f2a27', size: 4, erase: false };
const BOARD_COLORS = ['#1f2a27', '#d9534f', '#2f6f8f', '#3f8f3f', '#e0a020'];
function boardEl(preview) {
  if (preview) return h('section', { class: 'screen-board' }, h('p', { class: 'widget-ph' }, 'Tableau blanc : dessinez sur l’écran projeté'));
  const cv = h('canvas', { class: 'board-canvas', 'data-testid': 'board-canvas' });
  const paint = () => { const r = cv.getBoundingClientRect(); if (!r.width) return; const k = devicePixelRatio || 1; cv.width = r.width * k; cv.height = r.height * k;
    const g = cv.getContext('2d'); g.scale(k, k); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const s of board.strokes) { g.strokeStyle = s.erase ? '#ffffff' : s.color; g.lineWidth = s.erase ? s.size * 6 : s.size; g.beginPath(); s.pts.forEach(([x, y], i) => i ? g.lineTo(x * r.width, y * r.height) : g.moveTo(x * r.width, y * r.height)); if (s.pts.length === 1) g.lineTo(s.pts[0][0] * r.width + .1, s.pts[0][1] * r.height); g.stroke(); } };
  let cur = null;
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture?.(e.pointerId); cur = { color: board.color, size: board.size, erase: board.erase, pts: [pt(e)] }; board.strokes.push(cur); paint(); });
  cv.addEventListener('pointermove', (e) => { if (!cur) return; cur.pts.push(pt(e)); paint(); });
  const end = () => { cur = null; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  if ('ResizeObserver' in window) new ResizeObserver(() => paint()).observe(cv); else setTimeout(paint, 50);
  const tool = (label, on, onclick, extra = {}, txt = null) => h('button', { type: 'button', class: `board-tool ${on ? 'on' : ''}`, 'aria-pressed': String(!!on), 'aria-label': label, title: label, onclick, ...extra }, txt);
  const bar = h('div', { class: 'board-bar' },
    BOARD_COLORS.map((c, i) => tool(`Feutre ${['noir', 'rouge', 'bleu', 'vert', 'jaune'][i]}`, !board.erase && board.color === c, () => { board.color = c; board.erase = false; refresh(); }, { style: { background: c } })),
    tool('Gomme', board.erase, () => { board.erase = true; refresh(); }, {}, '⌫'),
    tool('Tout effacer', false, () => { board.strokes = []; paint(); }, { 'data-testid': 'board-clear' }, '✕'));
  const refresh = () => bar.querySelectorAll('.board-tool').forEach((b, i) => b.classList.toggle('on', i < BOARD_COLORS.length ? (!board.erase && board.color === BOARD_COLORS[i]) : i === BOARD_COLORS.length && board.erase));
  return h('section', { class: 'screen-board' }, bar, cv);
}

/** Horloge à aiguilles, réelle ou réglée sur une heure à lire. */
function clockEl(clock) {
  const t = W.clockTime(clock);
  const face = h('div', { class: 'clock-face', 'data-clock': '1' }); face.innerHTML = W.clockSvg(t, { seconds: clock.mode !== 'fixe' && clock.seconds });
  return h('section', { class: 'screen-clock', 'data-testid': 'screen-clock' }, face, clock.digital ? h('div', { class: 'clock-digital', 'data-clock-digital': '1' }, W.clockDigital(t)) : null);
}

/** Pictogramme de travail et feu du bruit. */
function signalsEl(p, extra = '') {
  if (!p.picto && !p.feu) return null;
  return h('section', { class: `screen-signals ${extra}` },
    p.picto ? h('div', { class: 'screen-picto', 'data-testid': 'screen-picto' }, h('div', { class: 'screen-picto-emoji', 'aria-hidden': 'true' }, p.picto.emoji), h('div', { class: 'screen-picto-label' }, p.picto.label)) : null,
    p.feu ? h('div', { class: 'screen-feu', 'data-feu': p.feu, 'data-testid': 'screen-feu', role: 'img', 'aria-label': `Feu ${p.feu}` }, ['rouge', 'orange', 'vert'].map(k => h('span', { class: `lamp lamp-${k} ${p.feu === k ? 'on' : ''}` }))) : null);
}

function diskEl() { const d = h('div', { class: 'screen-disk', 'data-disk': '1' }); d.innerHTML = T.disk(360); return d; }

export function renderScreen() {
  document.body.classList.add('projection-screen');
  let payload = null;
  try { payload = JSON.parse(localStorage.getItem(`${KEY}-payload`)); } catch { /* */ }
  const host = h('div', { class: 'screen-host' });
  let lastSeq = payload?.tirage?.seq ?? null;
  let lastDice = payload?.des?.seq ?? null;
  const draw = () => { host.replaceChildren(screenView(payload)); drawDisk(); spin(); roll(); };
  const roll = () => {
    const el = host.querySelector('.dice'); const seq = payload?.des?.seq ?? null;
    if (!el || seq === lastDice) return; lastDice = seq;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const dies = [...el.querySelectorAll('.die')]; const sum = host.querySelector('[data-sum]'); if (sum) sum.style.visibility = 'hidden';
    let i = 0; el.classList.add('rolling');
    const tick = () => { if (!el.isConnected) return;
      if (i++ < 10) { dies.forEach(d => { d.innerHTML = W.dieSvg(1 + Math.floor(Math.random() * Number(d.dataset.faces)), Number(d.dataset.faces)); }); setTimeout(tick, 60 + i * 10); }
      else { dies.forEach(d => { d.innerHTML = W.dieSvg(Number(d.dataset.final), Number(d.dataset.faces)); }); el.classList.remove('rolling'); if (sum) sum.style.visibility = ''; } };
    tick();
  };
  // Tirage : quelques prénoms défilent avant le résultat (seulement pour un nouveau tirage).
  const spin = () => {
    const el = host.querySelector('.tirage-names'); const seq = payload?.tirage?.seq ?? null;
    if (!el || seq === lastSeq) return; lastSeq = seq;
    const pool = payload.tirage.pool?.length ? payload.tirage.pool : [el.dataset.final]; const final = el.dataset.final;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0; el.classList.add('spinning');
    const tick = () => { if (!el.isConnected) return; if (i++ < 14) { el.textContent = pool[Math.floor(Math.random() * pool.length)]; setTimeout(tick, 50 + i * 12); } else { el.textContent = final; el.classList.remove('spinning'); el.classList.add('landed'); } };
    tick();
  };
  const drawDisk = () => {
    const d = host.querySelector('[data-disk]'); if (d) { d.innerHTML = T.disk(360); const t = host.querySelector('.screen-time'); if (t) t.textContent = T.fmt(T.remaining()); }
    const c = host.querySelector('[data-chrono]'); if (c && payload) c.textContent = W.fmtChrono(W.chronoMs(payload.chrono));
    const k = host.querySelector('[data-clock]');
    if (k && payload?.clock && payload.clock.mode !== 'fixe') { const t = W.clockTime(payload.clock); const sig = `${t.h}:${t.m}:${payload.clock.seconds ? t.s : ''}`;
      if (k.dataset.sig !== sig) { k.dataset.sig = sig; k.innerHTML = W.clockSvg(t, { seconds: payload.clock.seconds }); const dg = host.querySelector('[data-clock-digital]'); if (dg) dg.textContent = W.clockDigital(t); } }
  };
  if (channel) channel.onmessage = (e) => { if (e.data?.type === 'payload') { payload = e.data.payload; draw(); } };
  window.addEventListener('storage', (e) => { if (e.key === `${KEY}-payload`) { try { payload = JSON.parse(e.newValue); } catch { /* */ } draw(); } });
  T.subscribe(() => draw());
  const iv = setInterval(() => { if (!document.body.contains(host)) { clearInterval(iv); document.body.classList.remove('projection-screen'); return; } drawDisk(); }, 250);
  draw();
  return h('div', {}, host, h('button', { class: 'screen-exit', type: 'button', onclick: () => { document.body.classList.remove('projection-screen'); if (window.name === 'classeur-ecran') window.close(); else location.hash = '#/projection'; } }, 'Quitter'));
}
