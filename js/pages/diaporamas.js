// Diaporamas par séance : éditeur simple (titre, texte, consigne, exercice, image/PDF,
// lien externe, timer), génération depuis la fiche de séance (structure du modèle de diaporama),
// vue de préparation de la semaine et liste de projection du jour (depuis le cahier journal).
// Notes présentateur visibles uniquement sur le pupitre.
import * as store from '../store.js';
import { embedOf, embedFrame } from '../embeds.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import * as PL from '../planning.js';
import * as T from '../timer.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState, pickFiles, safeUrl } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { bound, iconBtn, pickMany } from '../forms.js';
import { addFiles } from './files.js';
import { projectSlide } from './projection.js';

const KINDS = [['titre', 'Titre'], ['texte', 'Texte'], ['consigne', 'Consigne'], ['exercice', 'Exercice'], ['image', 'Image ou PDF'], ['lien', 'Lien (Canva, Google Slides…)'], ['timer', 'Timer']];
let view = 'semaine';
let cur = 0;

export const slideshowsOf = (sessionId) => store.all('slideshow').filter(s => s.sessionId === sessionId);

/** Structure du modèle de diaporama : objectif, rappel, recherche, mise en commun, je retiens, entraînement, bilan. */
export function fromSession(session) {
  const seq = session.sequenceId ? store.get(session.sequenceId) : null;
  const n = P.sessionNumber(session);
  const ph = (kind) => (session.phases || []).find(p => p.kind === kind);
  const notesOf = (p) => [p?.enseignant && `Enseignant : ${p.enseignant}`, p?.reponses && `Réponses attendues : ${p.reponses}`, p?.difficultes && `Difficultés : ${p.difficultes}`, p?.relances && `Relances : ${p.relances}`].filter(Boolean).join('\n');
  const S = (kind, title, text, extra = {}) => ({ id: store.uid(), kind, title, text: text || '', notes: '', ...extra });
  const out = [S('titre', session.title || 'Séance', session.objective ? `Aujourd’hui, nous allons apprendre à… ${session.objective}` : 'Notre objectif', { kicker: [session.subject?.toUpperCase(), seq?.number ? `SÉQUENCE ${seq.number}` : '', n ? `SÉANCE ${n}` : ''].filter(Boolean).join(' · ') })];
  const r = ph('rappel'); if (r) out.push(S('consigne', '1 · Rappel des acquis — Je me souviens…', r.consigne || r.but, { minutes: r.duration || null, notes: notesOf(r) }));
  const c = ph('recherche'); if (c) out.push(S('consigne', '2 · Recherche — Je cherche / je découvre', c.consigne || c.but, { minutes: c.duration || null, notes: notesOf(c) }));
  const i = ph('institution'); if (i) { out.push(S('texte', '3 · Mise en commun — Nous expliquons ensemble', i.tableau || '', { notes: notesOf(i) })); out.push(S('texte', '4 · Je retiens', i.trace || session.trace || '')); }
  const e = ph('entrainement'); if (e) out.push(S('exercice', '5 · Je m’entraîne', [e.exercices, e.consigne].filter(Boolean).join('\n'), { minutes: e.duration || null, notes: [e.criteres && `Critères : ${e.criteres}`, e.correction && `Correction : ${e.correction}`].filter(Boolean).join('\n') }));
  const b = ph('bilan'); if (b) out.push(S('texte', '6 · Qu’avons-nous appris ?', [b.question, 'Je peux maintenant…'].filter(Boolean).join('\n'), { notes: [b.verification, b.suite].filter(Boolean).join('\n') }));
  for (const fid of session.fileIds || []) { const f = store.get(fid); if (f && !f.deletedAt) out.push(f.kind === 'link' ? S('lien', f.name, '', { url: f.url }) : S('image', f.name, '', { fileId: fid })); }
  return out;
}

export async function createFor(session) {
  const ss = await store.create('slideshow', { classId: session.classId, sessionId: session.id, title: session.title || 'Diaporama', slides: fromSession(session), ready: false }, `Diaporama de « ${session.title} »`);
  return ss;
}

// ───── Rattachement d'un diaporama : une séance, une séquence entière, ou des dates (jour, semaine(s), mois, période libre)
const ASSOC = [['seance', 'Une séance précise'], ['sequence', 'Toute une séquence'], ['jour', 'Un jour'], ['semaine', 'Une semaine'], ['semaines', 'Plusieurs semaines'], ['mois', 'Un mois'], ['dates', 'Des dates au choix'], ['libre', 'Rien (je le retrouve dans « Tous »)']];
const lastOfMonth = (iso) => { const [y, m] = iso.split('-').map(Number); return `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`; };
/** Le diaporama concerne-t-il ce jour (dates) ou cette séance (séance ou séquence) ? */
export const showsOnDate = (ss, d) => !!ss.range && ss.range.from <= d && d <= ss.range.to;
export const showsForSession = (ss, session) => !!session && (ss.sessionId === session.id || (ss.sequenceId && ss.sequenceId === session.sequenceId));
/** Phrase claire : « Séance : S2 · … », « Séquence : … », « Semaine du 9 novembre »… */
export function assocLabel(ss) {
  if (ss.sessionId && store.get(ss.sessionId)) { const x = store.get(ss.sessionId); const q = x.sequenceId ? store.get(x.sequenceId) : null; return `Séance : ${P.sessionTitle(x)}${q ? ` (${P.sequenceTitle(q)})` : ''}`; }
  if (ss.sequenceId && store.get(ss.sequenceId)) return `Séquence : ${P.sequenceTitle(store.get(ss.sequenceId))} (toutes ses séances)`;
  if (ss.range) { const r = ss.range; return r.from === r.to ? `Le ${model.frDate(r.from, { weekday: 'long', day: 'numeric', month: 'long' })}` : `Du ${model.frDate(r.from, { day: 'numeric', month: 'long' })} au ${model.frDate(r.to, { day: 'numeric', month: 'long' })}`; }
  return 'Libre (non rattaché)';
}

/** Champs du choix de rattachement ; renvoie { node, value() }. */
function assocPicker(cls, ss = {}) {
  const initKind = ss.sessionId ? 'seance' : ss.sequenceId ? 'sequence' : ss.range ? (ss.range.kind || 'dates') : (ss.kind || 'seance');
  const kind = h('select', { 'data-testid': 'assoc-kind' }, ASSOC.map(([k, l]) => h('option', { value: k, selected: k === initKind }, l)));
  // Séances rangées par séquence (discipline · séquence), avec leur numéro.
  const seqs = P.ofClass('sequence', cls.id).sort((a, b) => (a.subject || '').localeCompare(b.subject || '') || (Number(a.number) || 0) - (Number(b.number) || 0));
  const loose = P.ofClass('session', cls.id).filter(x => !x.sequenceId || !store.get(x.sequenceId));
  const sesSel = h('select', { 'data-testid': 'assoc-session' }, h('option', { value: '' }, '— choisir la séance —'),
    seqs.map(q => { const ses = P.sessionsOfSequence(q.id); return ses.length ? h('optgroup', { label: `${q.subject ? q.subject + ' · ' : ''}${P.sequenceTitle(q)}` }, ses.map(x => h('option', { value: x.id, selected: ss.sessionId === x.id }, P.sessionTitle(x)))) : null; }),
    loose.length ? h('optgroup', { label: 'Séances hors séquence' }, loose.map(x => h('option', { value: x.id, selected: ss.sessionId === x.id }, `${x.subject ? x.subject + ' · ' : ''}${P.sessionTitle(x)}`))) : null);
  const bySubj = new Map(); for (const q of seqs) { const k = q.subject || 'Autre'; if (!bySubj.has(k)) bySubj.set(k, []); bySubj.get(k).push(q); }
  const seqSel = h('select', { 'data-testid': 'assoc-sequence' }, h('option', { value: '' }, '— choisir la séquence —'),
    [...bySubj].map(([k, list]) => h('optgroup', { label: k }, list.map(q => h('option', { value: q.id, selected: ss.sequenceId === q.id }, `${P.sequenceTitle(q)} (${P.sessionsOfSequence(q.id).length} séance(s))`)))));
  const today = model.todayIso();
  const mkDay = () => h('input', { type: 'date', value: ss.range?.from || today, 'data-testid': 'assoc-day' });
  const day = mkDay();
  const nWeeks = h('input', { type: 'number', min: 2, max: 12, value: ss.range?.weeks || 2, style: { width: '5em' }, 'data-testid': 'assoc-weeks' });
  const month = h('input', { type: 'month', value: (ss.range?.from || today).slice(0, 7), 'data-testid': 'assoc-month' });
  const from = h('input', { type: 'date', value: ss.range?.from || today, 'data-testid': 'assoc-from' });
  const to = h('input', { type: 'date', value: ss.range?.to || model.addDays(today, 6), 'data-testid': 'assoc-to' });
  const info = h('p', { class: 'muted small', 'data-testid': 'assoc-info' });
  const rows = { seance: field('Séance (rangées par séquence)', sesSel), sequence: field('Séquence (le diaporama s’affiche à chacune de ses séances)', seqSel),
    jour: field('Jour', day), semaine: field('Un jour de la semaine voulue', mkDay()), semaines: h('div', { class: 'grid-2' }, field('À partir de la semaine du', mkDay()), field('Nombre de semaines', nWeeks)),
    mois: field('Mois', month), dates: h('div', { class: 'grid-2' }, field('Du', from), field('Au', to)), libre: null };
  // Un seul champ « jour » réel : on synchronise les copies.
  const dayInputs = [day, rows.semaine.querySelector('input'), rows.semaines.querySelector('input')];
  dayInputs.forEach(i => { i.dataset.testid = 'assoc-day'; i.addEventListener('change', () => { dayInputs.forEach(j => { j.value = i.value; }); upd(); }); });
  const holder = h('div', {});
  const range = () => {
    const d = day.value || today;
    switch (kind.value) {
      case 'jour': return { kind: 'jour', from: d, to: d };
      case 'semaine': { const m = model.mondayOf(d); return { kind: 'semaine', from: m, to: model.addDays(m, 6) }; }
      case 'semaines': { const m = model.mondayOf(d); const n = Math.max(2, Math.min(12, Number(nWeeks.value) || 2)); return { kind: 'semaines', weeks: n, from: m, to: model.addDays(m, 7 * n - 1) }; }
      case 'mois': { const f = `${month.value || today.slice(0, 7)}-01`; return { kind: 'mois', from: f, to: lastOfMonth(f) }; }
      case 'dates': return { kind: 'dates', from: from.value, to: to.value };
      default: return null;
    }
  };
  const upd = () => {
    holder.replaceChildren(...[rows[kind.value]].filter(Boolean));
    const r = range();
    info.textContent = r ? `Affiché dans « Préparation de la semaine » et « Projection du jour » ${r.from === r.to ? `le ${model.frDate(r.from)}` : `du ${model.frDate(r.from)} au ${model.frDate(r.to)}`}.`
      : kind.value === 'seance' ? 'Affiché à côté de cette séance, chaque jour où elle est au cahier journal.' : kind.value === 'sequence' ? 'Affiché à côté de chaque séance de la séquence.' : 'Retrouvé dans l’onglet « Tous ».';
  };
  [kind, nWeeks, month, from, to].forEach(x => x.addEventListener('change', upd)); upd();
  return {
    node: h('div', { class: 'stack-sm' }, field('Rattacher à', kind), holder, info),
    value() {
      const k = kind.value;
      if (k === 'seance' && !sesSel.value) throw new Error('Choisissez la séance.');
      if (k === 'sequence' && !seqSel.value) throw new Error('Choisissez la séquence.');
      const r = range(); if (r && (!r.from || !r.to || r.to < r.from)) throw new Error('Dates invalides.');
      return { sessionId: k === 'seance' ? sesSel.value : null, sequenceId: k === 'sequence' ? seqSel.value : null, range: r };
    },
  };
}

/** Nouveau diaporama, ou lien à projeter (Canva, Google Slides, Drive…), rattaché à une séance, une séquence ou des dates. */
export function newDialog({ session = null, link = false } = {}) {
  const cls = model.currentClass(); if (!cls) return;
  const title = h('input', { name: 'title', value: session ? (session.title || '') : '', placeholder: link ? 'ex. Diaporama Canva — les fractions' : 'ex. Rituels de la semaine', 'data-testid': 'diapo-new-title' });
  const url = link ? h('input', { name: 'url', type: 'url', placeholder: 'https://www.canva.com/… ou https://docs.google.com/presentation/…', 'data-testid': 'diapo-new-url' }) : null;
  const assoc = assocPicker(cls, session ? { sessionId: session.id } : { kind: 'semaine' });
  const err = h('p', { class: 'form-errors', role: 'alert' });
  modal({ title: link ? 'Ajouter un lien à projeter' : 'Nouveau diaporama', body: h('div', { class: 'form' },
    url ? field('Adresse du lien', url, 'Partagez le document « à toute personne disposant du lien » pour qu’il s’affiche dans l’appli ; sinon un bouton l’ouvre dans un onglet.') : null,
    field('Titre', title), assoc.node, err),
  actions: [{ label: 'Annuler' }, { label: link ? 'Ajouter' : 'Créer', primary: true, testid: 'diapo-new-save', onClick: async () => {
    const u = url ? url.value.trim() : '';
    if (url && !safeUrl(u)) { err.textContent = 'Adresse invalide : elle doit commencer par https://'; return false; }
    let a; try { a = assoc.value(); } catch (e) { err.textContent = e.message; return false; }
    const t = title.value.trim() || (a.sessionId ? P.sessionTitle(store.get(a.sessionId)) : a.sequenceId ? P.sequenceTitle(store.get(a.sequenceId)) : 'Diaporama');
    const slide = link ? { id: store.uid(), kind: 'lien', title: t, text: '', notes: '', url: u } : { id: store.uid(), kind: 'titre', title: t, text: '', notes: '' };
    const existing = link && a.sessionId ? slideshowsOf(a.sessionId)[0] : null;
    if (existing) { await store.update(existing.id, { slides: [...existing.slides, slide] }, 'Lien ajouté au diaporama'); location.hash = `#/diaporamas/${existing.id}`; return; }
    const ss = await store.create('slideshow', { classId: cls.id, ...a, title: t, slides: [slide], ready: link }, link ? 'Lien à projeter ajouté' : 'Diaporama créé');
    location.hash = `#/diaporamas/${ss.id}`;
  } }] });
}

/** Changer le rattachement d'un diaporama existant. */
function assocDialog(ss) {
  const cls = store.get(ss.classId) || model.currentClass();
  const assoc = assocPicker(cls, ss); const err = h('p', { class: 'form-errors', role: 'alert' });
  modal({ title: 'Rattacher le diaporama', body: h('div', { class: 'form' }, assoc.node, err),
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, testid: 'assoc-save', onClick: async () => {
      let a; try { a = assoc.value(); } catch (e) { err.textContent = e.message; return false; }
      await store.update(ss.id, a, 'Rattachement du diaporama');
    } }] });
}

export function render({ params, rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Diaporamas'), subTabs(), missing);
  if (params[0]) return editor(params[0], rerender);
  const tabs = h('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' }, [['semaine', 'Préparation de la semaine'], ['jour', 'Projection du jour'], ['tous', 'Tous']].map(([k, l]) => h('button', { type: 'button', class: view === k ? 'on' : '', 'data-testid': `diapo-tab-${k}`, onclick: () => { view = k; rerender(); } }, l)));
  const today = model.todayIso();
  const entryRow = (d, e) => {
    const sss = e.session ? store.all('slideshow').filter(x => x.classId === cls.id && showsForSession(x, e.session)) : [];
    const files = (e.session?.fileIds || []).map(id => store.get(id)).filter(f => f && !f.deletedAt);
    return h('li', { class: 'diapo-row' },
      h('span', { class: 'entry-time' }, `${d === today && view === 'jour' ? '' : model.frDate(d, { weekday: 'short', day: 'numeric' }) + ' · '}${e.start}`),
      h('span', {}, h('strong', {}, e.subject || ''), ' ', e.session ? h('a', { href: `#/seance/${e.session.id}` }, e.title) : e.title),
      sss.map(ss => h('span', { class: 'row' }, h('a', { class: 'btn btn-small', href: `#/diaporamas/${ss.id}` }, ss.title), ss.ready ? badge('prêt', 'ok') : badge('à finir', 'warn'), view === 'jour' ? h('button', { class: 'btn btn-small btn-primary', type: 'button', onclick: () => present(ss) }, 'Présenter') : null)),
      e.session && !sss.length ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'gen-diapo', onclick: async () => { const ss = await createFor(e.session); location.hash = `#/diaporamas/${ss.id}`; } }, 'Créer depuis la fiche') : null,
      e.session ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'diapo-row-link', title: 'Ajouter un lien Canva, Google Slides… pour cette séance', onclick: () => newDialog({ session: e.session, link: true }) }, icon('link', 12), '+ lien') : null,
      files.filter(f => f.kind === 'link').map(f => h('a', { class: 'btn btn-small', href: safeUrl(f.url) || '#', target: '_blank', rel: 'noopener noreferrer' }, icon('link', 12), f.name)),
      !e.session ? h('span', { class: 'muted small' }, 'pas de fiche') : null);
  };
  let body;
  if (view === 'tous') {
    const all = store.all('slideshow').filter(s => s.classId === cls.id);
    body = all.length ? h('ul', { class: 'plain', 'data-testid': 'diapo-all' }, all.map(s => h('li', {}, h('a', { href: `#/diaporamas/${s.id}` }, s.title), ` · ${s.slides.length} diapositive(s) · `, h('span', { class: 'muted' }, assocLabel(s))))) : emptyState('Aucun diaporama', '« Ajouter un lien » pour un Canva ou un Google Slides, « Nouveau diaporama » pour en créer un ici.');
  } else {
    const days = view === 'jour' ? [today] : model.classDays(cls).map(d => model.addDays(model.mondayOf(today), d - 1));
    const ranged = store.all('slideshow').filter(x => x.classId === cls.id && x.range);
    const dayRow = (d) => { const list = ranged.filter(x => showsOnDate(x, d)); return list.length ? h('li', { class: 'diapo-row diapo-range', 'data-testid': 'diapo-range' },
      h('span', { class: 'entry-time' }, model.frDate(d, { weekday: 'short', day: 'numeric' })), h('span', { class: 'muted small' }, 'Pour cette période :'),
      list.map(ss => h('span', { class: 'row' }, h('a', { class: 'btn btn-small', href: `#/diaporamas/${ss.id}`, title: assocLabel(ss) }, ss.title), view === 'jour' ? h('button', { class: 'btn btn-small btn-primary', type: 'button', onclick: () => present(ss) }, 'Présenter') : null))) : null; };
    const rows = days.flatMap(d => [dayRow(d), ...PL.dayPlan(cls, d).entries.filter(e => e.kind !== 'event' && !['annulée', 'reportée'].includes(e.status)).map(e => entryRow(d, e))]).filter(Boolean);
    body = rows.length ? h('ul', { class: 'plain diapo-list', 'data-testid': 'diapo-list' }, rows) : emptyState(view === 'jour' ? 'Rien au cahier journal aujourd’hui' : 'Rien cette semaine');
  }
  return h('div', { class: 'page' },
    pageHeader('Diaporamas', { favKey: 'preparer/diaporamas', subtitle: cls.name, actions: [
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'diapo-add-link', onclick: () => newDialog({ link: true }) }, icon('link', 16), 'Ajouter un lien (Canva, Slides…)'),
      h('button', { class: 'btn', type: 'button', 'data-testid': 'diapo-new', onclick: () => newDialog() }, icon('plus', 16), 'Nouveau diaporama')] }), subTabs(), tabs,
    h('section', { class: 'card' }, body),
    h('section', { class: 'card later-card' }, h('h2', {}, 'Formats'),
      h('ul', {}, h('li', {}, 'Affichés directement : images (JPG, PNG, SVG…) et PDF.'),
        h('li', {}, 'PowerPoint (.pptx) : non affichable dans le navigateur. Exportez-le en PDF (PowerPoint, LibreOffice ou Google Slides : Fichier › Exporter / Télécharger en PDF), puis ajoutez le PDF comme diapositive.'),
        h('li', {}, 'Canva, Google Slides, Drive : ajoutez le lien ; si le document est partagé par lien, il s’affiche dans la diapositive (et à l’écran de projection). Pour modifier, « Ouvrir » l’ouvre dans un nouvel onglet.'))));
}

function editor(id, rerender) {
  const ss = store.get(id);
  if (!ss || ss.deletedAt) return h('div', { class: 'page' }, pageHeader('Diaporama introuvable'), h('a', { href: '#/diaporamas' }, '← Diaporamas'));
  if (cur >= ss.slides.length) cur = Math.max(0, ss.slides.length - 1);
  const slide = ss.slides[cur];
  const session = ss.sessionId ? store.get(ss.sessionId) : null;
  const saveSlides = (slides, label, quiet = false) => store.update(ss.id, { slides }, label, { quiet });
  const upd = (k) => (v) => saveSlides(store.get(ss.id).slides.map((x, i) => i === cur ? { ...x, [k]: v } : x), `Diapositive : ${k}`, true);
  const move = (dir) => { const arr = ss.slides.slice(); const j = cur + dir; if (j < 0 || j >= arr.length) return; [arr[cur], arr[j]] = [arr[j], arr[cur]]; cur = j; saveSlides(arr, 'Diapositive déplacée'); };
  const add = async (kind) => {
    let extra = {};
    if (kind === 'image') { const fs = await pickFiles({ accept: 'image/*,application/pdf' }); if (!fs.length) return; const c = await addFiles(fs, null, { tags: ['diaporama'] }); extra = { fileId: c[0].id, title: fs[0].name }; }
    const s = { id: store.uid(), kind, title: KINDS.find(k => k[0] === kind)[1], text: '', notes: '', minutes: kind === 'timer' ? 5 : null, ...extra };
    const arr = ss.slides.slice(); arr.splice(cur + 1, 0, s); cur = Math.min(cur + 1, arr.length - 1);
    await saveSlides(arr, 'Diapositive ajoutée');
  };
  return h('div', { class: 'page' },
    h('p', {}, h('a', { href: '#/diaporamas', class: 'back' }, '← Diaporamas')),
    pageHeader(ss.title, { subtitle: assocLabel(ss), actions: [
      h('button', { class: 'btn', type: 'button', 'data-testid': 'diapo-assoc', onclick: () => assocDialog(ss) }, 'Rattacher à…'),
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'present', onclick: () => present(ss, cur) }, 'Présenter ici'),
      h('button', { class: 'btn', type: 'button', 'data-testid': 'project-diapo', onclick: () => { projectSlide(model.currentClass(), ss.id, cur); toast('Diapositive envoyée à l’écran de projection (Aujourd’hui › Projection).'); } }, 'Projeter sur l’écran séparé'),
      h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: !!ss.ready, onchange: (e) => store.update(ss.id, { ready: e.target.checked }, e.target.checked ? 'Diaporama prêt' : 'Diaporama à finir') }), 'Prêt'),
      session ? h('button', { class: 'btn', type: 'button', onclick: async () => { if (!await confirmDialog('Régénérer depuis la fiche ?', 'Les diapositives actuelles sont remplacées par celles tirées de la fiche (annulable).', { confirmLabel: 'Régénérer' })) return; cur = 0; await saveSlides(fromSession(session), 'Diaporama régénéré'); } }, 'Régénérer depuis la fiche') : null,
      h('button', { class: 'btn btn-ghost-danger', type: 'button', 'aria-label': 'Mettre à la corbeille', onclick: async () => { await store.remove(ss.id, 'Diaporama mis à la corbeille'); location.hash = '#/diaporamas'; } }, icon('trash', 16))] }),
    h('div', { class: 'diapo-editor' },
      h('ol', { class: 'slide-list', 'data-testid': 'slide-list' }, ss.slides.map((s, i) => h('li', { class: i === cur ? 'on' : '' }, h('button', { type: 'button', onclick: () => { cur = i; rerender(); } }, h('span', { class: 'muted small' }, KINDS.find(k => k[0] === s.kind)?.[1] || s.kind), h('br'), s.title || '(sans titre)')))),
      h('div', {},
        slide ? h('section', { class: 'card' },
          h('div', { class: 'row' }, h('strong', {}, `Diapositive ${cur + 1}/${ss.slides.length}`), iconBtn('up', 'Avant', () => move(-1)), iconBtn('down', 'Après', () => move(1)),
            iconBtn('copy', 'Dupliquer', () => { const arr = ss.slides.slice(); arr.splice(cur + 1, 0, { ...slide, id: store.uid() }); cur++; saveSlides(arr, 'Diapositive dupliquée'); }),
            iconBtn('trash', 'Supprimer', () => { const arr = ss.slides.filter((_, i) => i !== cur); saveSlides(arr, 'Diapositive supprimée'); })),
          h('div', { class: 'slide-frame' }, slideView(slide)),
          h('div', { class: 'fields' },
            bound({ label: 'Titre', type: 'text', value: slide.title, onSave: upd('title') }),
            ['titre', 'texte', 'consigne', 'exercice'].includes(slide.kind) ? bound({ label: slide.kind === 'titre' ? 'Sous-titre' : 'Texte', value: slide.text, onSave: upd('text') }) : null,
            slide.kind === 'lien' ? bound({ label: 'Adresse', type: 'url', value: slide.url, onSave: (v) => { if (v && !safeUrl(v)) { toast('Adresse invalide', { kind: 'error' }); return; } return upd('url')(v); } }) : null,
            ['consigne', 'exercice', 'timer'].includes(slide.kind) ? bound({ label: 'Timer (minutes)', type: 'number', value: slide.minutes, onSave: upd('minutes') }) : null,
            bound({ label: 'Notes présentateur (jamais projetées)', value: slide.notes, onSave: upd('notes') }))) : emptyState('Aucune diapositive'),
        h('div', { class: 'row' }, h('span', { class: 'muted small' }, 'Ajouter :'), KINDS.map(([k, l]) => h('button', { class: 'btn btn-small', type: 'button', 'data-testid': `add-slide-${k}`, onclick: () => add(k) }, l))))));
}

/** Rendu d'une diapositive (sans les notes). */
export function slideView(s, { big = false } = {}) {
  const box = h('div', { class: `slide slide-${s.kind} ${big ? 'big' : ''}` });
  if (s.kicker) box.append(h('div', { class: 'slide-kicker' }, s.kicker));
  box.append(h('div', { class: 'slide-title' }, s.title || ''));
  if (s.kind === 'image' && s.fileId) {
    const f = store.get(s.fileId); const v = f?.versions?.at(-1);
    const holder = h('div', { class: 'slide-media' }, h('span', { class: 'muted' }, f ? f.name : 'fichier introuvable'));
    if (v) store.getBlob(v.blobId).then(b => { if (!b) return; const url = URL.createObjectURL(b); holder.replaceChildren((v.mime || '').startsWith('image/') ? h('img', { src: url, alt: s.title || '' }) : h('iframe', { src: url, title: s.title || 'PDF' })); });
    box.append(holder);
  } else if (s.kind === 'lien') {
    const u = safeUrl(s.url || '');
    box.append(u && embedOf(u) ? embedFrame(u, s.title, { note: !big }) : h('div', { class: 'slide-text' }, u ? h('a', { class: 'btn btn-primary', href: u, target: '_blank', rel: 'noopener noreferrer' }, 'Ouvrir la présentation dans un nouvel onglet') : 'Adresse à renseigner'));
  } else if (s.kind === 'timer') {
    box.append(h('div', { class: 'slide-text' }, `${s.minutes || 5} minutes`));
  } else if (s.text) box.append(h('div', { class: 'slide-text pre' }, s.text));
  if (s.minutes && big) box.append(h('button', { class: 'btn slide-timer', type: 'button', onclick: () => { T.setDuration(s.minutes * 60); T.set({ open: true, min: true }); T.start(); } }, `Lancer le timer (${s.minutes} min)`));
  return box;
}

/** Présentation plein écran dans cet onglet (sans notes). Flèches, glisser, Échap. */
export function present(ss, start = 0) {
  let i = start;
  const wrap = h('div', { class: 'presenter-full', tabindex: '-1', 'data-testid': 'presentation' });
  const draw = () => wrap.replaceChildren(slideView(ss.slides[i], { big: true }), h('div', { class: 'present-bar' },
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => go(-1) }, '‹'), h('span', {}, `${i + 1} / ${ss.slides.length}`), h('button', { class: 'btn btn-small', type: 'button', onclick: () => go(1) }, '›'),
    h('button', { class: 'btn btn-small', type: 'button', onclick: close }, 'Quitter')));
  const go = (d) => { i = Math.min(ss.slides.length - 1, Math.max(0, i + d)); draw(); };
  const onKey = (e) => { if (['ArrowRight', 'PageDown', ' '].includes(e.key)) go(1); else if (['ArrowLeft', 'PageUp'].includes(e.key)) go(-1); else if (e.key === 'Escape') close(); };
  let x0 = null;
  wrap.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  wrap.addEventListener('pointerup', (e) => { if (x0 != null && Math.abs(e.clientX - x0) > 60) go(e.clientX < x0 ? 1 : -1); x0 = null; });
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); if (document.fullscreenElement) document.exitFullscreen(); };
  document.addEventListener('keydown', onKey);
  document.body.append(wrap); draw(); wrap.focus();
  wrap.requestFullscreen?.().catch(() => {});
  void modal; void field; void formData; void pickMany;
}
