// Timer de couleur persistant : disque qui décroît, ancré sur une heure de fin
// (pas de dérive en arrière-plan), qui reste actif quand on change de page.
// Fermer ou réduire le widget n'arrête jamais le compte. Une seule alerte par fin,
// même si plusieurs vues (projection, fenêtre flottante) sont ouvertes.
import { h } from './ui.js';

const KEY = 'classeur-timer';
const ALERT_KEY = 'classeur-timer-alerted';
export const COLORS = ['#d9534f', '#2f6f8f', '#3f8f3f', '#e0a020', '#7a4a9a', '#1f2a27'];
const DEF = { duration: 300, endAt: null, remaining: 300, running: false, color: 'auto', sound: true, open: false, min: false, big: false, x: null, y: null, size: 180, label: '' };

let state = load();
let el = null;
let pipWin = null;
let tick = null;
let lastKey = '';
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('classeur-timer') : null;
const listeners = new Set();

function load() {
  try { return { ...DEF, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch { return { ...DEF }; }
}
function save(broadcast = true) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* stockage indisponible : le timer marche quand même pendant la session */ }
  if (broadcast && channel) channel.postMessage({ type: 'state', state });
  for (const fn of listeners) fn(state);
}
if (channel) channel.onmessage = (e) => { if (e.data?.type === 'state') { state = { ...state, ...e.data.state, open: state.open, min: state.min, big: state.big, x: state.x, y: state.y, size: state.size }; draw(); for (const fn of listeners) fn(state); } };
window.addEventListener('storage', (e) => { if (e.key === KEY) { const s = load(); state = { ...s, open: state.open, min: state.min, big: state.big, x: state.x, y: state.y, size: state.size }; draw(); } });

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getState() { return { ...state }; }

/** Secondes restantes, recalculées depuis l'heure de fin. */
export function remaining(s = state) {
  if (s.running && s.endAt) return Math.max(0, (s.endAt - Date.now()) / 1000);
  return Math.max(0, s.remaining ?? s.duration);
}
export function fmt(sec) {
  const t = Math.ceil(sec); const m = Math.floor(t / 60), s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function setDuration(sec) { sec = Math.max(5, Math.min(sec, 6 * 3600)); state = { ...state, duration: sec, remaining: sec, endAt: null, running: false }; save(); draw(); }
export function start() { if (state.running) return; const r = remaining(); if (r <= 0) { state.remaining = state.duration; } state = { ...state, endAt: Date.now() + remaining() * 1000, running: true }; save(); draw(); ensureTick(); }
export function pause() { if (!state.running) return; state = { ...state, remaining: remaining(), running: false, endAt: null }; save(); draw(); }
export function reset() { state = { ...state, remaining: state.duration, running: false, endAt: null }; save(); draw(); }
export function addMinutes(n) {
  if (state.running) state = { ...state, endAt: Math.max(Date.now() + 1000, state.endAt + n * 60000), duration: Math.max(5, state.duration + n * 60) };
  else { const r = Math.max(5, remaining() + n * 60); state = { ...state, remaining: r, duration: Math.max(r, state.duration + n * 60, 5) }; }
  save(); draw();
}
export function set(patch) { state = { ...state, ...patch }; save(); draw(); }
export function open() { state.open = true; state.min = false; save(false); mount(); draw(); }
export function toggle() { state.open ? set({ open: false }) : open(); }

// ───── Alerte de fin, une seule fois par heure de fin
function maybeAlert() {
  if (!state.running || remaining() > 0) return;
  const endAt = state.endAt;
  state = { ...state, running: false, remaining: 0, endAt: null, finishedAt: Date.now() };
  save();
  let already = null;
  try { already = localStorage.getItem(ALERT_KEY); localStorage.setItem(ALERT_KEY, String(endAt)); } catch { /* */ }
  if (already === String(endAt)) return;
  if (state.sound && !isProjectionView()) beep();
  if (el) { el.classList.add('done'); setTimeout(() => el && el.classList.remove('done'), 4000); }
}
function isProjectionView() { return document.body.classList.contains('projection-screen'); }
let audioCtx = null;
export function beep() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t0 + i * 0.35); g.gain.exponentialRampToValueAtTime(0.3, t0 + i * 0.35 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.35 + 0.3);
      o.start(t0 + i * 0.35); o.stop(t0 + i * 0.35 + 0.32);
    }
  } catch { /* son indisponible */ }
}

function ensureTick() {
  if (tick) return;
  tick = setInterval(() => { maybeAlert(); draw(); if (!state.running) { clearInterval(tick); tick = null; draw(); } }, 200);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { maybeAlert(); draw(); if (state.running) ensureTick(); } });

// ───── Couleur « feu tricolore » : vert tant qu'il reste plus de la moitié du temps,
// orange à partir de la moitié, rouge quand il reste moins d'un cinquième.
export const TRAFFIC = { green: '#3f9b4f', orange: '#f08c1e', red: '#d64545' };
export function colorOf(s = state) {
  if (s.color !== 'auto') return s.color;
  const frac = s.duration ? remaining(s) / s.duration : 0;
  return frac > 0.5 ? TRAFFIC.green : frac > 0.2 ? TRAFFIC.orange : TRAFFIC.red;
}

// ───── Dessin du disque
export function disk(size, s = state) {
  const r = remaining(s); const frac = s.duration ? Math.min(1, r / s.duration) : 0;
  const c = size / 2, rad = c - 4;
  const a = frac * 2 * Math.PI;
  const x = c + rad * Math.sin(a), y = c - rad * Math.cos(a);
  const large = a > Math.PI ? 1 : 0;
  const path = frac >= 0.9999 ? `<circle cx="${c}" cy="${c}" r="${rad}" fill="${colorOf(s)}"/>` : frac <= 0 ? '' : `<path d="M${c},${c} L${c},${c - rad} A${rad},${rad} 0 ${large} 1 ${x},${y} Z" fill="${colorOf(s)}"/>`;
  return `<svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" role="img" aria-label="Temps restant ${fmt(r)}"><circle cx="${c}" cy="${c}" r="${rad}" fill="#fff" stroke="#c9c2b4" stroke-width="2"/>${path}</svg>`;
}

// ───── Widget flottant
function mount() {
  if (el) return;
  el = h('div', { class: 'timer-widget', role: 'region', 'aria-label': 'Timer', 'data-testid': 'timer' });
  document.body.append(el);
  dragify();
  window.addEventListener('resize', () => { clamp(); place(); });
}

function clamp() {
  const w = el?.offsetWidth || 220, hh = el?.offsetHeight || 260;
  const maxX = Math.max(0, window.innerWidth - w - 4), maxY = Math.max(0, window.innerHeight - hh - 4);
  if (state.x == null || state.y == null) { state.x = maxX - 12; state.y = Math.max(70, maxY - 80); }
  state.x = Math.min(Math.max(4, state.x), maxX); state.y = Math.min(Math.max(4, state.y), maxY);
}
function place() { if (!el) return; el.style.left = `${state.x}px`; el.style.top = `${state.y}px`; }

function dragify() {
  let start = null;
  el.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.timer-drag') || (e.target.closest('button, input, select') && !e.target.closest('.timer-pill'))) return;
    start = { px: e.clientX, py: e.clientY, x: state.x, y: state.y };
    el.setPointerCapture(e.pointerId); e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => { if (!start) return; state.x = start.x + e.clientX - start.px; state.y = start.y + e.clientY - start.py; clamp(); place(); });
  const end = () => { if (start) { if (Math.abs(state.x - start.x) + Math.abs(state.y - start.y) < 4 && state.min) { start = null; set({ min: false }); return; } start = null; save(false); } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}

function controls(compact) {
  const r = remaining();
  return h('div', { class: 'timer-controls' },
    h('div', { class: 'row' },
      state.running ? h('button', { class: 'btn btn-primary btn-small', type: 'button', 'data-testid': 'timer-pause', onclick: pause }, 'Pause')
        : h('button', { class: 'btn btn-primary btn-small', type: 'button', 'data-testid': 'timer-start', onclick: start }, r < state.duration && r > 0 ? 'Reprendre' : 'Démarrer'),
      h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'timer-reset', onclick: reset }, 'Réinitialiser'),
      h('button', { class: 'tbtn', type: 'button', 'aria-label': 'Moins 1 minute', title: 'Moins 1 minute', onclick: () => addMinutes(-1) }, '−1'),
      h('button', { class: 'tbtn', type: 'button', 'aria-label': 'Plus 1 minute', title: 'Plus 1 minute', 'data-testid': 'timer-plus', onclick: () => addMinutes(1) }, '+1')),
    compact ? null : h('div', { class: 'row' }, [1, 2, 3, 5, 10, 15, 20].map(m => h('button', { class: 'btn btn-small', type: 'button', 'data-testid': `timer-${m}`, onclick: () => setDuration(m * 60) }, `${m} min`))),
    compact ? null : h('div', { class: 'row' },
      h('label', { class: 'inline small' }, 'Durée', h('input', { type: 'number', min: 1, max: 360, value: Math.round(state.duration / 60), 'aria-label': 'Durée en minutes', style: { width: '64px' }, onchange: (e) => setDuration((Number(e.target.value) || 1) * 60) }), 'min'),
      h('div', { class: 'swatches', role: 'group', 'aria-label': 'Couleur' }, h('button', { type: 'button', class: `swatch swatch-auto ${state.color === 'auto' ? 'on' : ''}`, 'aria-label': 'Feu tricolore : vert, puis orange à mi-temps, rouge à la fin', title: 'Vert, puis orange à mi-temps, rouge quand il reste peu de temps', 'data-testid': 'timer-auto', onclick: () => set({ color: 'auto' }) }), COLORS.map(c => h('button', { type: 'button', class: `swatch ${state.color === c ? 'on' : ''}`, style: { background: c }, 'aria-label': `Couleur ${c}`, onclick: () => set({ color: c }) }))),
      h('label', { class: 'inline small' }, h('input', { type: 'checkbox', checked: state.sound, onchange: (e) => set({ sound: e.target.checked }) }), 'Son')));
}

export function draw() {
  if (pipWin) drawPip();
  // Sur l'écran de projection, le timer est dessiné par l'écran lui-même.
  if (document.body.classList.contains('projection-screen')) { if (el) el.hidden = true; return; }
  if (!el) { if (state.open) mount(); else return; }
  el.hidden = !state.open;
  if (!state.open) return;
  // Mise à jour légère (disque + temps) tant que la disposition ne change pas :
  // on ne reconstruit pas les champs pendant qu'on les utilise.
  const key = JSON.stringify([state.big, state.min, state.size, state.running, state.color, state.sound, state.duration, state.label, (state.remaining ?? 0) < state.duration]);
  if (key === lastKey && el.firstChild) {
    const r0 = remaining();
    const d = el.querySelector('.timer-disk, .timer-big-disk, .pill-disk');
    if (d) d.innerHTML = disk(state.big ? 400 : state.min ? 28 : state.size);
    const t = el.querySelector('[data-testid=timer-time]'); if (t) t.textContent = fmt(r0);
    return;
  }
  lastKey = key;
  el.classList.toggle('big', !!state.big);
  el.classList.toggle('min', !!state.min);
  el.classList.toggle('running', !!state.running);
  const r = remaining();
  if (state.big) {
    el.replaceChildren(
      h('div', { class: 'timer-big-head' }, h('strong', {}, state.label || 'Timer'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => set({ big: false }) }, 'Réduire')),
      h('div', { class: 'timer-big-disk' }),
      h('div', { class: 'timer-big-time', 'data-testid': 'timer-time' }, fmt(r)),
      controls(false));
    el.querySelector('.timer-big-disk').innerHTML = disk(400);
    return;
  }
  if (state.min) {
    el.replaceChildren(h('button', { class: 'timer-pill timer-drag', type: 'button', title: 'Agrandir le timer', 'data-testid': 'timer-pill', onclick: () => set({ min: false }) },
      h('span', { class: 'pill-disk' }), h('span', { 'data-testid': 'timer-time' }, fmt(r))));
    el.querySelector('.pill-disk').innerHTML = disk(28);
    clamp(); place(); return;
  }
  const sz = state.size;
  el.replaceChildren(
    h('div', { class: 'timer-head timer-drag', title: 'Déplacer' }, h('span', {}, '⠿ Timer'),
      h('span', { class: 'row' },
        h('button', { class: 'tbtn', type: 'button', 'aria-label': 'Plus petit', onclick: () => set({ size: Math.max(100, state.size - 30) }) }, '−'),
        h('button', { class: 'tbtn', type: 'button', 'aria-label': 'Plus grand', onclick: () => set({ size: Math.min(360, state.size + 30) }) }, '+'),
        h('button', { class: 'tbtn', type: 'button', 'aria-label': 'Plein écran', title: 'Grand format', onclick: () => set({ big: true }) }, '⛶'),
        'documentPictureInPicture' in window ? h('button', { class: 'tbtn', type: 'button', 'aria-label': 'Fenêtre flottante au-dessus des autres applications', title: 'Fenêtre flottante (au-dessus des autres fenêtres)', onclick: openPip }, '⧉') : null,
        h('button', { class: 'tbtn', type: 'button', 'aria-label': 'Réduire (le compte continue)', title: 'Réduire (le compte continue)', 'data-testid': 'timer-min', onclick: () => set({ min: true }) }, '▁'),
        h('button', { class: 'tbtn', type: 'button', 'aria-label': 'Masquer (le compte continue)', title: 'Masquer (le compte continue)', 'data-testid': 'timer-hide', onclick: () => set({ open: false }) }, '×'))),
    h('div', { class: 'timer-disk', style: { width: `${sz}px`, height: `${sz}px` } }),
    h('div', { class: 'timer-time', 'data-testid': 'timer-time' }, fmt(r)),
    controls(sz < 150));
  el.querySelector('.timer-disk').innerHTML = disk(sz);
  clamp(); place();
}

/** Remet le widget à un endroit visible (s'il a été poussé hors de l'écran). */
export function recenter() { state.x = null; state.y = null; open(); }

// ───── Fenêtre flottante (Document Picture-in-Picture, si le navigateur le permet)
async function openPip() {
  try {
    pipWin = await window.documentPictureInPicture.requestWindow({ width: 260, height: 300 });
    pipWin.document.body.style.cssText = 'margin:0;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f6f3ee';
    pipWin.addEventListener('pagehide', () => { pipWin = null; });
    drawPip(); ensureTick();
  } catch { pipWin = null; }
}
function drawPip() {
  if (!pipWin) return;
  const d = pipWin.document;
  d.body.innerHTML = `<div style="width:200px;height:200px">${disk(200)}</div><div style="font-size:40px;font-weight:800;font-variant-numeric:tabular-nums">${fmt(remaining())}</div>`;
}

// Reprise après rechargement de la page.
export function init() {
  if (state.running) { maybeAlert(); ensureTick(); }
  if (state.open) { mount(); draw(); }
}
