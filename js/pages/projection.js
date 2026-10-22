// Projection : un pupitre (vue enseignante, avec notes non projetées) et un écran séparé.
// L'écran ne reçoit qu'un contenu filtré : programme, consigne, devoirs collectifs, timer, support choisi.
// Aucune donnée personnelle (bilans, notes, coordonnées, besoins particuliers) n'y est jamais envoyée.
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import * as PL from '../planning.js';
import * as T from '../timer.js';
import { h, icon, toast, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';

const KEY = 'classeur-projection';
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('classeur-projection') : null;
const DEF = { panels: { programme: true, consigne: true, devoirs: false, timer: true, support: false }, entryKey: null, phaseId: null, message: '', supportFileId: null, blank: false };

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
    return f.kind === 'link' ? { kind: 'link', name: f.name } : { kind: 'blob', blobId: v?.blobId, mime: v?.mime, name: f.name }; })() : null;
  return { date, dateLabel: model.frDate(date, { weekday: 'long', day: 'numeric', month: 'long' }), panels: c.panels, programme, consigne, devoirs, message: c.message || '', support, blank: !!c.blank };
}

function publish(cls, date) {
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
  const setPanel = (k, v) => set({ panels: { ...ctrl.panels, [k]: v } });
  publish(cls, date);
  const payload = buildPayload(cls, date);
  const files = (entry?.session?.fileIds || []).map(id => store.get(id)).filter(f => f && !f.deletedAt);

  return h('div', { class: 'page' },
    pageHeader('Projection', { favKey: 'aujourdhui/projection', subtitle: `${cls.name} · ${model.frDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}`,
      actions: [
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'open-screen', onclick: () => { const w = window.open(`${location.pathname}#/ecran`, 'classeur-ecran', 'popup,width=1280,height=760'); if (!w) toast('Le navigateur a bloqué la fenêtre : autorisez les fenêtres pour ce site, ou utilisez « Projeter ici ».', { kind: 'error' }); } }, icon('link', 16), 'Ouvrir l’écran de projection'),
        h('a', { class: 'btn', href: '#/ecran' }, 'Projeter ici (plein écran)')] }),
    subTabs(),
    h('div', { class: 'card notice' }, h('p', {}, 'L’écran de projection n’affiche que ce qui est coché ci-dessous : jamais de bilans, notes, coordonnées ni informations personnelles. Glissez la fenêtre « écran » sur le vidéoprojecteur ou le TNI et mettez-la en plein écran (F11).')),
    h('div', { class: 'grid-2' },
      h('section', { class: 'card' }, h('h2', {}, 'Ce qui est projeté'),
        h('div', { class: 'chips' }, [['programme', 'Programme du jour'], ['consigne', 'Consigne'], ['devoirs', 'Devoirs'], ['timer', 'Timer'], ['support', 'Support']].map(([k, l]) =>
          h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: !!ctrl.panels[k], 'data-testid': `panel-${k}`, onchange: (e) => setPanel(k, e.target.checked) }), l))),
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: ctrl.blank, onchange: (e) => set({ blank: e.target.checked }) }), 'Écran noir (masquer tout)'),
        h('div', { class: 'field' }, h('label', {}, 'Message affiché'), h('input', { value: ctrl.message, placeholder: 'ex. Sortez votre cahier du jour', 'data-testid': 'proj-message', onchange: (e) => set({ message: e.target.value }) })),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-small', type: 'button', onclick: () => T.open() }, 'Régler le timer'), h('span', { class: 'muted small' }, 'Le timer projeté suit celui de l’application.'))),
      h('section', { class: 'card' }, h('h2', {}, 'Aperçu de l’écran'), h('div', { class: 'screen-preview' }, screenView(payload, true)))),
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

// ───────── Écran
/** Vue projetée : n'utilise que le contenu filtré (payload). */
export function screenView(p, preview = false) {
  if (!p) return h('div', { class: 'screen' }, h('p', {}, 'En attente du pupitre…'));
  if (p.blank) return h('div', { class: 'screen blank' });
  const tstate = T.getState();
  const showTimer = p.panels.timer && (tstate.running || T.remaining() < tstate.duration);
  const supportEl = h('div', { class: 'screen-support' });
  if (p.panels.support && p.support?.kind === 'blob' && p.support.blobId && !preview) {
    store.getBlob(p.support.blobId).then(b => {
      if (!b) return; const url = URL.createObjectURL(b);
      supportEl.replaceChildren((p.support.mime || '').startsWith('image/') ? h('img', { src: url, alt: p.support.name }) : (p.support.mime === 'application/pdf' ? h('iframe', { src: url, title: p.support.name }) : h('p', {}, p.support.name)));
    });
  } else if (p.panels.support && p.support) supportEl.append(h('p', { class: 'muted' }, `Support : ${p.support.name}${p.support.kind === 'link' ? ' (lien externe : ouvrez-le dans un autre onglet)' : ''}`));
  return h('div', { class: `screen ${preview ? 'preview' : ''}`, 'data-testid': preview ? 'screen-preview' : 'screen' },
    h('header', { class: 'screen-head' }, h('span', {}, p.dateLabel.replace(/^./, c => c.toUpperCase()))),
    p.message ? h('div', { class: 'screen-message' }, p.message) : null,
    h('div', { class: 'screen-grid' },
      p.panels.programme ? h('section', { class: 'screen-prog' }, h('h2', {}, 'Programme'), h('ol', {}, p.programme.map(x => h('li', { class: x.current ? 'current' : '' }, h('span', { class: 'st' }, x.start), ` ${x.subject}${x.title && x.title !== x.subject ? ' — ' + x.title : ''}`)))) : null,
      h('div', { class: 'screen-main' },
        p.panels.consigne && p.consigne ? h('section', { class: 'screen-consigne' }, h('h2', {}, p.consigne.phase), h('p', { class: 'pre' }, p.consigne.text || ''), p.consigne.trace ? h('p', { class: 'trace pre' }, p.consigne.trace) : null) : null,
        p.panels.support ? supportEl : null,
        p.panels.devoirs && p.devoirs.length ? h('section', { class: 'screen-devoirs' }, h('h2', {}, 'Devoirs'), h('ul', {}, p.devoirs.map(d => h('li', {}, `${d.title} — pour le ${model.frDate(d.dueDate, { weekday: 'long', day: 'numeric', month: 'long' })}${d.levels.length ? ' (' + d.levels.join(', ') + ')' : ''}`)))) : null),
      showTimer ? h('section', { class: 'screen-timer' }, diskEl(), h('div', { class: 'screen-time' }, T.fmt(T.remaining()))) : null));
}

function diskEl() { const d = h('div', { class: 'screen-disk', 'data-disk': '1' }); d.innerHTML = T.disk(360); return d; }

export function renderScreen() {
  document.body.classList.add('projection-screen');
  let payload = null;
  try { payload = JSON.parse(localStorage.getItem(`${KEY}-payload`)); } catch { /* */ }
  const host = h('div', { class: 'screen-host' });
  const draw = () => { host.replaceChildren(screenView(payload)); drawDisk(); };
  const drawDisk = () => { const d = host.querySelector('[data-disk]'); if (d) { d.innerHTML = T.disk(360); const t = host.querySelector('.screen-time'); if (t) t.textContent = T.fmt(T.remaining()); } };
  if (channel) channel.onmessage = (e) => { if (e.data?.type === 'payload') { payload = e.data.payload; draw(); } };
  window.addEventListener('storage', (e) => { if (e.key === `${KEY}-payload`) { try { payload = JSON.parse(e.newValue); } catch { /* */ } draw(); } });
  T.subscribe(() => draw());
  const iv = setInterval(() => { if (!document.body.contains(host)) { clearInterval(iv); document.body.classList.remove('projection-screen'); return; } drawDisk(); }, 250);
  draw();
  return h('div', {}, host, h('button', { class: 'screen-exit', type: 'button', onclick: () => { document.body.classList.remove('projection-screen'); if (window.name === 'classeur-ecran') window.close(); else location.hash = '#/projection'; } }, 'Quitter'));
}
