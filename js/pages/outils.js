// Aujourd'hui › Outils de classe : supports interactifs à utiliser en direct avec les élèves,
// tous affichables en grand (TNI, vidéoprojecteur, tablette). Fonctionnent hors ligne, sans compte.
//  - Lire pour moi : voix de synthèse de l'appareil (aucun envoi du texte).
//  - Sonomètre : micro analysé sur l'appareil, rien n'est enregistré ni envoyé ; niveau relatif, non étalonné.
//  - Pot de récompense (par classe, enregistré), abaque, tableau des nombres, tableau de numération
//    et de conversion, réglettes, calculs de pourcentage.
import * as store from '../store.js';
import * as model from '../model.js';
import { h, icon, toast, badge, pickFiles, modal, download, confirmDialog } from '../ui.js';
import { printDocument } from '../print.js';
import { addFiles } from './files.js';
import { openWithText } from './atelier.js';
import * as Fo from '../fonts.js';
import * as SY from '../syllabes.js';
import * as IA from '../ia.js';
import { pageHeader, subTabs } from '../components.js';
import { beep } from '../timer.js';

export const TOOLS = [
  ['tapuscrit', 'Texte d’une photo'], ['syllabes', 'Syllabes en couleur'], ['parler', 'Parler et transcrire'], ['lire', 'Lire pour moi'], ['sono', 'Sonomètre'], ['pot', 'Pot de récompense'], ['abaque', 'Abaque'],
  ['cent', 'Tableau des nombres'], ['numeration', 'Numération et conversion'], ['reglettes', 'Réglettes'], ['pourcent', 'Pourcentages'],
];
let tool = 'tapuscrit';
let cleanup = null;

export function render({ query, rerender }) {
  if (cleanup) { try { cleanup(); } catch { /* */ } cleanup = null; }
  if (TOOLS.some(t => t[0] === query.o)) tool = query.o;
  const stage = h('div', { class: 'tool-stage', 'data-testid': `tool-${tool}` });
  const builders = { tapuscrit, syllabes, parler, lire, sono, pot, abaque, cent, numeration, reglettes, pourcent };
  const res = builders[tool](stage, rerender);
  if (typeof res === 'function') cleanup = res;
  const big = h('button', { class: 'btn', type: 'button', 'data-testid': 'tool-big', onclick: () => (document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen?.().catch(() => toast('Plein écran refusé par le navigateur.', { kind: 'error' }))) }, 'Afficher en grand');
  return h('div', { class: 'page' },
    pageHeader('Outils de classe', { favKey: 'aujourdhui/outils', subtitle: 'à projeter ou à utiliser sur tablette', actions: [big] }),
    subTabs(),
    h('div', { class: 'seg wrap', role: 'group', 'aria-label': 'Outil' }, TOOLS.map(([k, l]) => h('a', { class: k === tool ? 'on seg-link' : 'seg-link', href: `#/outils?o=${k}`, 'data-testid': `tool-tab-${k}` }, l))),
    stage);
}

// ───────── Texte d'une photo (tapuscrit) : OCR sur l'appareil
const tap = { text: '', size: 18, spacing: 1.8, font: '', caps: false, imgUrl: null };
function tapuscrit(stage, rerender) {
  const status = h('span', { class: 'muted', 'aria-live': 'polite', 'data-testid': 'ocr-status' });
  const img = h('img', { class: 'tap-img', alt: 'Image lue', hidden: !tap.imgUrl, src: tap.imgUrl || null });
  const ta = h('textarea', { rows: 10, class: 'tap-text', 'data-testid': 'ocr-text', placeholder: 'Le texte lu apparaît ici. Corrigez-le si besoin : la lecture automatique peut se tromper.', oninput: (e) => { tap.text = e.target.value; } }, tap.text);
  const read = async (blob) => {
    if (!blob || !/^image\//.test(blob.type)) { toast('Choisissez une image (photo, capture d’écran, scan en JPG ou PNG).', { kind: 'error' }); return; }
    if (tap.imgUrl) URL.revokeObjectURL(tap.imgUrl);
    tap.imgUrl = URL.createObjectURL(blob); img.src = tap.imgUrl; img.hidden = false;
    try {
      const O = await import('../ocr.js');
      const text = await O.recognize(blob, { onStatus: (t) => { status.textContent = t; }, onProgress: (p) => { status.textContent = `Lecture du texte… ${p} %`; } });
      tap.text = text; ta.value = text;
      status.textContent = text ? 'Terminé. Relisez le texte : la lecture automatique peut contenir des erreurs.' : 'Aucun texte reconnu : essayez une photo plus nette, bien droite et bien éclairée.';
    } catch (e) { status.textContent = `Lecture impossible : ${e.message}`; }
  };
  const onPaste = (e) => { const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/')); if (it) { e.preventDefault(); read(it.getAsFile()); } };
  document.addEventListener('paste', onPaste);
  const fromFiles = () => {
    const imgs = store.all('file').filter(f => f.kind === 'blob' && /^image\//.test(f.versions?.at(-1)?.mime || ''));
    if (!imgs.length) { toast('Aucune image dans vos fichiers.'); return; }
    let m = null;
    m = modal({ title: 'Choisir une image de vos fichiers', body: h('ul', { class: 'plain' }, imgs.map(f => h('li', {}, h('button', { class: 'btn btn-link', type: 'button', onclick: async () => { const b = await store.getBlob(f.versions.at(-1).blobId); m?.close(); read(b instanceof Blob && b.type ? b : new Blob([b], { type: f.versions.at(-1).mime })); } }, f.name)))), actions: [{ label: 'Fermer' }] });
  };
  const sheet = () => {
    const fam = tap.font ? `"${tap.font}", cursive` : 'Arial, Helvetica, sans-serif';
    return h('div', { class: 'print-doc tap-sheet', style: { fontFamily: fam, fontSize: `${tap.size}pt`, lineHeight: String(tap.spacing) } },
      tap.text.split(/\n{2,}/).map(par => h('p', {}, tap.caps ? par.toUpperCase() : par)));
  };
  const fonts = Fo.available().filter(([n]) => n);
  stage.append(h('div', { class: 'grid-2' },
    h('section', { class: 'card stack' },
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'ocr-pick', onclick: async () => { const [f] = await pickFiles({ accept: 'image/*', multiple: false }); if (f) read(f); } }, icon('upload', 16), 'Choisir ou prendre une photo'),
        h('button', { class: 'btn', type: 'button', onclick: fromFiles }, 'Depuis mes fichiers')),
      h('p', { class: 'muted small' }, 'Vous pouvez aussi coller une capture d’écran (Ctrl + V). Conseils : page bien à plat, photo nette, lumière sans reflet. La lecture se fait sur l’appareil, l’image n’est envoyée nulle part ; la première fois, le moteur (4,7 Mo) se télécharge puis reste disponible hors connexion.'),
      status, img),
    h('section', { class: 'card stack' }, h('h2', {}, 'Texte'), ta,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-small', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(tap.text); toast('Texte copié'); } catch { ta.select(); toast('Sélectionné : copiez avec Ctrl + C'); } } }, icon('copy', 14), 'Copier'),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'ocr-to-lire', onclick: () => { lireState.text = tap.text; location.hash = '#/outils?o=lire'; } }, 'Lire pour moi'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => { syl.text = tap.text; location.hash = '#/outils?o=syllabes'; } }, 'Syllabes en couleur'),
        iaButton(() => tap.text, (t) => { tap.text = t; ta.value = t; }, 'simplifier', 'Simplifier (IA de l’appareil)'),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'ocr-to-seyes', onclick: () => openWithText(tap.text, 'ecriture') }, 'Tableau Seyès'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => openWithText(tap.text, 'texte') }, 'Texte à compléter'),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'ocr-save', onclick: async () => { if (!tap.text.trim()) return; const name = `${(tap.text.split('\n')[0] || 'texte').slice(0, 40).replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'texte'}.txt`; await addFiles([new File([tap.text], name, { type: 'text/plain' })], null, { tags: ['tapuscrit'] }); } }, 'Enregistrer dans mes fichiers')),
      h('h3', {}, 'Tapuscrit à imprimer'),
      h('div', { class: 'row' },
        h('label', { class: 'inline' }, 'Taille', h('input', { type: 'number', min: 10, max: 40, value: tap.size, style: { width: '4.5em' }, onchange: (e) => { tap.size = Number(e.target.value) || 18; } }), 'pt'),
        h('label', { class: 'inline' }, 'Interligne', h('select', { onchange: (e) => { tap.spacing = Number(e.target.value); } }, [1.4, 1.8, 2.2, 2.8].map(v => h('option', { value: v, selected: tap.spacing === v }, String(v).replace('.', ','))))),
        h('label', { class: 'inline' }, 'Police', h('select', { onchange: (e) => { tap.font = e.target.value; } }, h('option', { value: '' }, 'Script (sans empattement)'), fonts.map(([n, l]) => h('option', { value: n, selected: tap.font === n }, l)))),
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: tap.caps, onchange: (e) => { tap.caps = e.target.checked; } }), 'capitales'),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'ocr-print', onclick: () => { if (tap.text.trim()) printDocument(sheet()); } }, icon('print', 14), 'Imprimer')))));
  return () => document.removeEventListener('paste', onPaste);
}

// ───────── IA intégrée à l'appareil (affichée seulement si le navigateur la propose)
export function iaButton(get, set, mode, label) {
  const b = h('button', { class: 'btn btn-small', type: 'button', hidden: true, 'data-testid': `ia-${mode}`, title: 'IA intégrée au navigateur : le texte ne quitte pas l’appareil. Relisez toujours le résultat.' }, label);
  let status = 'unavailable';
  IA.rewriterStatus().then(st => { status = st; if (st !== 'unavailable') b.hidden = false; });
  b.onclick = async () => {
    const text = get(); if (!text?.trim()) return;
    if (status === 'downloadable' && !await confirmDialog('Télécharger l’IA du navigateur ?', 'La première fois, le navigateur télécharge son modèle d’IA (fourni par Chrome, plusieurs gigaoctets, gratuit). Ensuite tout se fait sur l’appareil, sans connexion. Mieux vaut être en Wi-Fi.', { confirmLabel: 'Télécharger' })) return;
    b.disabled = true; const old = b.textContent; b.textContent = 'IA en cours…';
    try { set(await IA.rewrite(text, mode, { onProgress: (p) => { b.textContent = `Téléchargement du modèle… ${p} %`; } })); toast('Texte réécrit sur l’appareil : relisez-le.'); }
    catch (e) { toast(`IA indisponible : ${e.message}`, { kind: 'error' }); }
    finally { b.disabled = false; b.textContent = old; }
  };
  return b;
}

// ───────── Parler et transcrire
const parl = { text: '' };
function parler(stage, rerender) {
  const ta = h('textarea', { rows: 10, class: 'tap-text', 'data-testid': 'parler-text', oninput: (e) => { parl.text = e.target.value; } }, parl.text);
  const interim = h('p', { class: 'muted', 'aria-live': 'polite' });
  const status = h('p', { class: 'small', 'data-testid': 'parler-status' });
  let stop = null;
  const btn = h('button', { class: 'btn btn-primary btn-big', type: 'button', 'data-testid': 'parler-start', disabled: true }, '🎙 Parler');
  const box = h('div', { class: 'card stack' }, status, h('div', { class: 'row' }, btn,
    h('button', { class: 'btn btn-small', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(parl.text); toast('Texte copié'); } catch { ta.select(); } } }, icon('copy', 14), 'Copier'),
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => { tap.text = parl.text; location.hash = '#/outils?o=tapuscrit'; } }, 'Tapuscrit'),
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => openWithText(parl.text, 'ecriture') }, 'Tableau Seyès'),
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => { parl.text = ''; ta.value = ''; } }, 'Effacer')),
    interim, ta,
    h('p', { class: 'muted small' }, 'Dites « virgule », « point », « point d’interrogation », « à la ligne » pour la ponctuation. Relisez : la reconnaissance peut se tromper.'));
  stage.append(box);
  IA.speechMode().then(mode => {
    const consent = IA.onlineSpeechAllowed();
    if (mode === 'none') { status.replaceChildren(badge('non disponible', 'muted'), ' Ce navigateur ne sait pas reconnaître la voix. Essayez Chrome, Edge ou Safari.'); return; }
    if (mode === 'local') status.replaceChildren(badge('sur l’appareil', 'ok'), ' La reconnaissance se fait sur l’appareil : votre voix n’est envoyée nulle part.');
    else status.replaceChildren(badge('service en ligne du navigateur', 'warn'), ' Sur ce navigateur, la voix est envoyée à son service de reconnaissance (Google pour Chrome et Edge, Apple pour Safari). Ne dictez pas de données personnelles d’élèves. ',
      h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: consent, 'data-testid': 'parler-consent', onchange: async (e) => { await store.setSettings({ speechOnline: e.target.checked }, { quiet: true }); btn.disabled = !e.target.checked; } }), 'J’accepte ce fonctionnement'));
    btn.disabled = mode === 'online' && !consent;
    btn.onclick = () => {
      if (stop) { stop(); return; }
      btn.textContent = '■ Arrêter';
      stop = IA.listen({ local: mode === 'local',
        onText: (t) => { parl.text = (parl.text ? parl.text.replace(/\s*$/, ' ') : '') + IA.punctuate(t); ta.value = parl.text; },
        onInterim: (t) => { interim.textContent = t; },
        onError: (m) => toast(m, { kind: 'error' }),
        onEnd: () => { stop = null; btn.textContent = '🎙 Parler'; interim.textContent = ''; } });
    };
  });
  return () => { if (stop) stop(); };
  void rerender;
}

// ───────── Syllabes en couleur (aide au décodage)
export const SYL_PALETTES = { 'rouge / bleu': ['#d62828', '#1d4ed8'], 'rouge / vert / bleu': ['#d62828', '#15803d', '#1d4ed8'], 'violet / orange': ['#7e22ce', '#ea580c'] };
const syl = { text: 'Le petit chat noir mange une souris dans la cuisine.', palette: 'rouge / bleu', arcs: true, colors: true, muettes: true, size: 40, font: '', spacing: 2 };
/** Texte coloré syllabe par syllabe (éléments HTML). */
export function sylNodes(text, o = syl) {
  const cols = SYL_PALETTES[o.palette] || SYL_PALETTES['rouge / bleu'];
  let n = 0;
  return SY.analyse(text).map(tok => {
    if (!tok.word) return h('span', { class: 'syl-sep' }, tok.text);
    return h('span', { class: 'syl-word' }, tok.syl.map(([a, b]) => {
      const c = cols[n++ % cols.length];
      const letters = [];
      for (let i = a; i < b; i++) letters.push(o.muettes && tok.silent.has(i) ? h('span', { class: 'syl-muette' }, tok.text[i]) : tok.text[i]);
      return h('span', { class: `syl${o.arcs ? ' syl-arc' : ''}`, style: { color: o.colors ? c : null, borderColor: o.arcs ? c : null } }, letters);
    }));
  });
}
function syllabes(stage) {
  const view = h('div', { class: 'syl-view', 'data-testid': 'syl-view' });
  const draw = () => { view.style.fontSize = `${syl.size}px`; view.style.lineHeight = String(syl.spacing); view.style.fontFamily = syl.font ? `"${syl.font}", cursive` : ''; view.replaceChildren(...syl.text.split('\n').map(l => h('p', {}, sylNodes(l)))); };
  const chk = (k, label) => h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: syl[k], 'data-testid': `syl-${k}`, onchange: (e) => { syl[k] = e.target.checked; draw(); } }), label);
  const fonts = Fo.available().filter(([n]) => n);
  stage.append(h('div', { class: 'card stack' },
    h('textarea', { rows: 4, 'data-testid': 'syl-text', oninput: (e) => { syl.text = e.target.value; draw(); } }, syl.text),
    h('div', { class: 'row' },
      h('select', { 'aria-label': 'Couleurs', onchange: (e) => { syl.palette = e.target.value; draw(); } }, Object.keys(SYL_PALETTES).map(k => h('option', { value: k, selected: syl.palette === k }, k))),
      chk('colors', 'couleurs'), chk('arcs', 'arcs sous les syllabes'), chk('muettes', 'lettres muettes en gris'),
      h('label', { class: 'inline' }, 'Police', h('select', { onchange: (e) => { syl.font = e.target.value; draw(); } }, h('option', { value: '' }, 'Script'), fonts.map(([n, l]) => h('option', { value: n, selected: syl.font === n }, l)))),
      h('label', { class: 'inline' }, 'Taille', h('input', { type: 'range', min: 20, max: 90, value: syl.size, oninput: (e) => { syl.size = Number(e.target.value); draw(); } })),
      h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'syl-print', onclick: () => printDocument(h('div', { class: 'print-doc syl-print', style: { fontSize: `${Math.round(syl.size * 0.55)}pt`, lineHeight: String(syl.spacing), fontFamily: syl.font ? `"${syl.font}", cursive` : '' } }, syl.text.split('\n').map(l => h('p', {}, sylNodes(l))))) }, icon('print', 14), 'Imprimer')),
    h('p', { class: 'muted small' }, 'Découpage automatique de l’écrit, à relire : quelques mots peuvent être mal coupés. Pour corriger un mot, écrivez-le avec des barres : « li|on ». Lettres muettes : seulement les plus fréquentes (s, t, d, x en fin de mot, h au début).')),
  view);
  draw();
}

// ───────── Lire pour moi
export function frenchVoices() { try { return (window.speechSynthesis?.getVoices() || []).filter(v => /^fr/i.test(v.lang)); } catch { return []; } }
const lireState = { text: '', rate: 0.9, size: 32, voice: 0 };
function lire(stage) {
  if (!('speechSynthesis' in window)) { stage.append(h('p', { class: 'card notice' }, 'Ce navigateur ne propose pas de voix de synthèse. Essayez Chrome, Edge ou Safari.')); return; }
  const ta = h('textarea', { rows: 5, placeholder: 'Écrivez ou collez le texte à faire lire…', 'data-testid': 'lire-text', oninput: (e) => { lireState.text = e.target.value; show(); } }, lireState.text);
  const view = h('div', { class: 'lire-view', style: { fontSize: `${lireState.size}px` } });
  const voiceSel = h('select', { 'aria-label': 'Voix', onchange: (e) => { lireState.voice = Number(e.target.value); } });
  const fillVoices = () => { const vs = frenchVoices(); voiceSel.replaceChildren(...(vs.length ? vs.map((v, i) => h('option', { value: i, selected: i === lireState.voice }, `${v.name} (${v.lang})`)) : [h('option', { value: 0 }, 'Voix française par défaut de l’appareil')])); };
  fillVoices(); window.speechSynthesis.onvoiceschanged = fillVoices;
  let words = [];
  const show = () => {
    words = [];
    const parts = lireState.text.split(/(\s+)/);
    let pos = 0;
    view.replaceChildren(...parts.map(p => { const sp = h('span', {}, p); if (p.trim()) words.push({ start: pos, end: pos + p.length, el: sp }); pos += p.length; return sp; }));
  };
  show();
  const speak = (from = 0) => {
    const synth = window.speechSynthesis; synth.cancel();
    const text = lireState.text.slice(from); if (!text.trim()) return;
    const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; u.rate = lireState.rate;
    const vs = frenchVoices(); if (vs[lireState.voice]) u.voice = vs[lireState.voice];
    u.onboundary = (e) => { const at = from + e.charIndex; words.forEach(w => w.el.classList.toggle('reading', at >= w.start && at < w.end)); };
    u.onend = () => words.forEach(w => w.el.classList.remove('reading'));
    synth.speak(u);
  };
  view.addEventListener('click', (e) => { const w = words.find(x => x.el === e.target); if (w) speak(w.start); });
  stage.append(h('div', { class: 'card stack' },
    ta,
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'lire-play', onclick: () => speak(0) }, icon('play', 16), 'Lire'),
      h('button', { class: 'btn', type: 'button', onclick: () => { const s = window.speechSynthesis; s.paused ? s.resume() : s.pause(); } }, 'Pause / reprendre'),
      h('button', { class: 'btn', type: 'button', onclick: () => window.speechSynthesis.cancel() }, 'Arrêter'),
      voiceSel,
      h('label', { class: 'inline' }, 'Vitesse', h('input', { type: 'range', min: 0.5, max: 1.4, step: 0.05, value: lireState.rate, oninput: (e) => { lireState.rate = Number(e.target.value); } })),
      h('label', { class: 'inline' }, 'Taille', h('input', { type: 'range', min: 18, max: 72, step: 2, value: lireState.size, oninput: (e) => { lireState.size = Number(e.target.value); view.style.fontSize = `${lireState.size}px`; } }))),
    h('p', { class: 'muted small' }, 'Cliquez sur un mot pour reprendre la lecture à cet endroit. La voix est celle de l’appareil : le texte n’est envoyé nulle part.')),
  view);
  return () => { try { window.speechSynthesis.cancel(); window.speechSynthesis.onvoiceschanged = null; } catch { /* */ } };
}

// ───────── Sonomètre
const sonoState = { calm: 45, loud: 70, delay: 3, sound: false };
/** Niveau relatif (0-100) à partir de la moyenne quadratique du signal. */
export function levelFromRms(rms) { if (rms <= 0) return 0; const db = 20 * Math.log10(rms); return Math.max(0, Math.min(100, Math.round((db + 60) / 60 * 100))); }
export function zoneOf(level, calm, loud) { return level >= loud ? 'fort' : level >= calm ? 'moyen' : 'calme'; }
function sono(stage) {
  let ctx = null, stream = null, raf = 0, overSince = 0, alerts = 0;
  const bar = h('div', { class: 'sono-bar' }, h('div', { class: 'sono-fill' }));
  const face = h('div', { class: 'sono-face', 'data-testid': 'sono-zone' }, '—');
  const info = h('p', { class: 'muted small' });
  const stop = () => { cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); ctx?.close().catch(() => {}); stream = null; ctx = null; startBtn.textContent = 'Démarrer'; };
  const startBtn = h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'sono-start', onclick: async () => {
    if (stream) { stop(); return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
    catch { toast('Micro refusé ou absent : autorisez le micro pour ce site.', { kind: 'error' }); return; }
    ctx = new AudioContext(); const an = ctx.createAnalyser(); an.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    startBtn.textContent = 'Arrêter';
    const loop = () => {
      an.getFloatTimeDomainData(buf);
      let s = 0; for (const x of buf) s += x * x;
      const lv = levelFromRms(Math.sqrt(s / buf.length));
      const z = zoneOf(lv, sonoState.calm, sonoState.loud);
      bar.firstChild.style.width = `${lv}%`; bar.dataset.zone = z; face.dataset.zone = z;
      face.textContent = { calme: 'Calme', moyen: 'Attention', fort: 'Trop fort !' }[z];
      if (z === 'fort') { overSince ||= performance.now(); if (performance.now() - overSince > sonoState.delay * 1000) { alerts++; overSince = performance.now() + 4000; stage.classList.add('sono-alert'); setTimeout(() => stage.classList.remove('sono-alert'), 1500); if (sonoState.sound) beep(); info.textContent = `${alerts} alerte(s) depuis le démarrage.`; } }
      else overSince = 0;
      raf = requestAnimationFrame(loop);
    };
    loop();
  } }, 'Démarrer');
  const num = (label, key, min, max) => h('label', { class: 'inline' }, label, h('input', { type: 'number', min, max, value: sonoState[key], style: { width: '5em' }, onchange: (e) => { sonoState[key] = Number(e.target.value); } }));
  stage.append(h('div', { class: 'card stack' },
    h('div', { class: 'row' }, startBtn, num('Seuil « attention »', 'calm', 5, 95), num('Seuil « trop fort »', 'loud', 10, 100), num('Alerte après (s)', 'delay', 1, 30),
      h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: sonoState.sound, onchange: (e) => { sonoState.sound = e.target.checked; } }), 'son d’alerte')),
    h('p', { class: 'muted small' }, 'Le son est analysé sur l’appareil, jamais enregistré ni envoyé. Niveau relatif de 0 à 100, non étalonné en décibels : réglez les seuils avec votre classe.')),
  h('div', { class: 'sono' }, face, bar, info));
  return stop;
}

// ───────── Pot de récompense (enregistré pour la classe)
function jarOf(cls) { return store.all('rewardjar').find(j => j.classId === cls.id) || null; }
function pot(stage, rerender) {
  const cls = model.currentClass();
  if (!cls) { stage.append(h('p', { class: 'muted' }, 'Choisissez d’abord une classe.')); return; }
  const j = jarOf(cls) || { count: 0, goal: 10, reward: '', log: [] };
  const save = async (patch, label) => {
    const cur = jarOf(cls);
    if (cur) await store.update(cur.id, patch, label, { quiet: true }); else await store.create('rewardjar', { classId: cls.id, count: 0, goal: 10, reward: '', log: [], ...patch }, label);
    rerender();
  };
  const move = (d) => {
    const count = Math.max(0, Math.min(j.goal, j.count + d));
    if (count === j.count) return;
    const log = [{ at: new Date().toISOString(), d }, ...(j.log || [])].slice(0, 5);
    save({ count, log }, d > 0 ? 'Bille ajoutée' : 'Bille retirée');
    if (count === j.goal && d > 0) toast(`Pot rempli ! ${j.reward ? 'Récompense : ' + j.reward : ''}`, { kind: 'ok' });
  };
  const svg = jarSvg(j.count, j.goal);
  stage.append(h('div', { class: 'pot' },
    h('div', { class: 'pot-jar' }, svg, h('p', { class: 'pot-count', 'data-testid': 'pot-count' }, `${j.count} / ${j.goal}`), j.reward ? h('p', { class: 'pot-reward' }, `🎁 ${j.reward}`) : null,
      j.count >= j.goal ? h('p', { class: 'pot-full' }, 'Bravo, le pot est plein !') : null),
    h('div', { class: 'card stack' },
      h('div', { class: 'row' }, h('button', { class: 'btn btn-primary btn-big', type: 'button', 'data-testid': 'pot-add', onclick: () => move(1) }, '+ 1 bille'), h('button', { class: 'btn btn-big', type: 'button', 'data-testid': 'pot-remove', onclick: () => move(-1) }, '− 1 bille')),
      h('label', { class: 'inline' }, 'Objectif', h('input', { type: 'number', min: 1, max: 20, value: j.goal, 'data-testid': 'pot-goal', onchange: (e) => { const g = Math.max(1, Math.min(20, Number(e.target.value) || 10)); save({ goal: g, count: Math.min(j.count, g) }, 'Objectif du pot'); } }), 'billes (1 à 20)'),
      h('label', { class: 'inline' }, 'Récompense', h('input', { value: j.reward, placeholder: 'ex. jeu collectif, lecture offerte', onchange: (e) => save({ reward: e.target.value }, 'Récompense du pot') })),
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => save({ count: 0, log: [] }, 'Pot vidé') }, 'Vider le pot'),
      h('h3', {}, 'Cinq dernières actions'),
      (j.log || []).length ? h('ul', { class: 'plain small' }, j.log.map(l => h('li', {}, `${model.frDateTime(l.at)} : ${l.d > 0 ? '+1' : '−1'}`))) : h('p', { class: 'muted small' }, 'Aucune.'))));
}
const MARBLES = ['#e05a6d', '#4a8fd6', '#f2b632', '#4fb37a', '#9a6ad6', '#f07c3c'];
function jarSvg(count, goal) {
  const NS = 'http://www.w3.org/2000/svg'; const S = (t, a) => { const e = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
  const svg = S('svg', { viewBox: '0 0 200 240', class: 'jar-svg', role: 'img', 'aria-label': `${count} billes sur ${goal}` });
  svg.append(S('rect', { x: 55, y: 8, width: 90, height: 18, rx: 4, fill: '#c9a27a' }));
  svg.append(S('path', { d: 'M60 26 h80 v14 q30 12 30 40 v130 q0 22 -22 22 h-96 q-22 0 -22 -22 v-130 q0 -28 30 -40z', fill: 'rgba(200,230,245,.45)', stroke: '#7aa6bd', 'stroke-width': 3 }));
  const perRow = 5, r = 13;
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow), col = i % perRow;
    svg.append(S('circle', { cx: 48 + col * 26 + (row % 2) * 6, cy: 214 - row * 24, r, fill: MARBLES[i % MARBLES.length], stroke: 'rgba(0,0,0,.2)' }));
  }
  return svg;
}

// ───────── Abaque
const COLS = [['M', 'mille'], ['C', 'centaines'], ['D', 'dizaines'], ['U', 'unités']];
const ab = { n: 4, beads: [0, 0, 0, 0], showNumber: true };
export function abaqueValue(beads) { return beads.reduce((acc, b) => acc * 10 + b, 0); }
function abaque(stage) {
  const wrap = h('div', { class: 'abaque' });
  const draw = () => {
    const cols = COLS.slice(4 - ab.n);
    const beads = ab.beads.slice(4 - ab.n);
    const overflow = beads.some(b => b >= 10);
    wrap.replaceChildren(
      h('div', { class: 'abaque-rods' }, cols.map(([k, l], i) => {
        const gi = 4 - ab.n + i;
        return h('div', { class: 'rod', 'data-col': k },
          h('button', { class: 'btn btn-small', type: 'button', 'aria-label': `Ajouter une bille aux ${l}`, 'data-testid': `ab-add-${k}`, onclick: () => { ab.beads[gi] = Math.min(15, ab.beads[gi] + 1); draw(); } }, '+'),
          h('div', { class: 'rod-stick' }, Array.from({ length: ab.beads[gi] }, () => h('span', { class: `bead bead-${k}` }))),
          h('button', { class: 'btn btn-small', type: 'button', 'aria-label': `Retirer une bille aux ${l}`, onclick: () => { ab.beads[gi] = Math.max(0, ab.beads[gi] - 1); draw(); } }, '−'),
          h('strong', {}, k), h('span', { class: 'muted small' }, `${ab.beads[gi]}`));
      })),
      h('div', { class: 'row' },
        ab.showNumber ? h('span', { class: 'abaque-num', 'data-testid': 'ab-value' }, overflow ? `${abaqueValue(beads)} (10 billes ou plus sur une tige : échangez !)` : String(abaqueValue(beads))) : null,
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'ab-exchange', disabled: !overflow, onclick: () => { for (let i = 3; i > 0; i--) while (ab.beads[i] >= 10) { ab.beads[i] -= 10; ab.beads[i - 1]++; } draw(); } }, 'Échanger 10 contre 1'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => { ab.beads = [0, 0, 0, 0]; draw(); } }, 'Tout effacer'),
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: ab.showNumber, onchange: (e) => { ab.showNumber = e.target.checked; draw(); } }), 'afficher le nombre'),
        h('select', { 'aria-label': 'Nombre de tiges', onchange: (e) => { ab.n = Number(e.target.value); draw(); } }, [2, 3, 4].map(n => h('option', { value: n, selected: ab.n === n }, `${n} tiges`)))));
  };
  draw();
  stage.append(wrap);
}

// ───────── Tableau des nombres
const cst = { start: 0, hidden: new Set(), marked: new Set(), sel: null, mode: 'cacher' };
function cent(stage) {
  const grid = h('div', { class: 'cent-grid', 'data-testid': 'cent-grid' });
  const draw = () => {
    grid.replaceChildren(...Array.from({ length: 100 }, (_, i) => {
      const n = cst.start + i;
      const near = cst.sel != null && [cst.sel + 1, cst.sel - 1, cst.sel + 10, cst.sel - 10].includes(n);
      return h('button', { type: 'button', class: `cent-cell${cst.hidden.has(n) ? ' hid' : ''}${cst.marked.has(n) ? ' mark' : ''}${cst.sel === n ? ' sel' : ''}${near ? ' near' : ''}`, 'data-n': n, 'aria-label': cst.hidden.has(n) ? 'nombre caché' : String(n),
        onclick: () => { if (cst.mode === 'cacher') { cst.hidden.has(n) ? cst.hidden.delete(n) : cst.hidden.add(n); } else if (cst.mode === 'colorier') { cst.marked.has(n) ? cst.marked.delete(n) : cst.marked.add(n); } else { cst.sel = cst.sel === n ? null : n; } draw(); } },
        cst.hidden.has(n) ? '?' : String(n));
    }));
  };
  draw();
  const mode = h('div', { class: 'seg', role: 'group', 'aria-label': 'Action au clic' }, [['cacher', 'Cacher / montrer'], ['colorier', 'Colorier'], ['voisins', '+1 −1 +10 −10']].map(([k, l]) => h('button', { type: 'button', class: cst.mode === k ? 'on' : '', 'data-testid': `cent-mode-${k}`, onclick: (e) => { cst.mode = k; [...mode.children].forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, l)));
  stage.append(h('div', { class: 'card stack' }, h('div', { class: 'row' }, mode,
    h('select', { 'aria-label': 'Plage', onchange: (e) => { cst.start = Number(e.target.value); cst.hidden.clear(); cst.marked.clear(); cst.sel = null; draw(); } }, [[0, '0 à 99'], [1, '1 à 100'], [100, '100 à 199']].map(([v, l]) => h('option', { value: v, selected: cst.start === v }, l))),
    h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'cent-hide-all', onclick: () => { for (let i = 0; i < 100; i++) cst.hidden.add(cst.start + i); draw(); } }, 'Tout cacher'),
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => { const all = Array.from({ length: 100 }, (_, i) => cst.start + i); for (let k = 0; k < 15; k++) cst.hidden.add(all[Math.floor(Math.random() * 100)]); draw(); } }, 'Cacher 15 au hasard'),
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => { cst.hidden.clear(); cst.marked.clear(); cst.sel = null; draw(); } }, 'Tout remettre'))), grid);
}

// ───────── Numération et conversion
export const PRESETS_NUM = {
  entiers: { label: 'Nombres entiers', cols: ['CM', 'DM', 'UM', 'C', 'D', 'U'], groups: [['Classe des mille', 3], ['Classe des unités', 3]] },
  millions: { label: 'Jusqu’aux millions', cols: ['CMi', 'DMi', 'UMi', 'CM', 'DM', 'UM', 'C', 'D', 'U'], groups: [['Millions', 3], ['Mille', 3], ['Unités', 3]] },
  decimaux: { label: 'Nombres décimaux', cols: ['C', 'D', 'U', ',', 'dixièmes', 'centièmes', 'millièmes'], groups: [['Partie entière', 3], ['', 1], ['Partie décimale', 3]] },
  longueurs: { label: 'Longueurs', cols: ['km', 'hm', 'dam', 'm', 'dm', 'cm', 'mm'] },
  masses: { label: 'Masses', cols: ['kg', 'hg', 'dag', 'g', 'dg', 'cg', 'mg'] },
  contenances: { label: 'Contenances', cols: ['kL', 'hL', 'daL', 'L', 'dL', 'cL', 'mL'] },
};
const num = { preset: 'entiers', values: {} };
function numeration(stage) {
  const wrap = h('div');
  const draw = () => {
    const p = PRESETS_NUM[num.preset];
    const vals = num.values[num.preset] ||= {};
    wrap.replaceChildren(h('div', { class: 'table-wrap' }, h('table', { class: 'num-table', 'data-testid': 'num-table' },
      p.groups ? h('thead', {}, h('tr', {}, p.groups.map(([l, n]) => h('th', { colspan: n, class: 'grp' }, l))), h('tr', {}, p.cols.map(c => h('th', {}, c))))
        : h('thead', {}, h('tr', {}, p.cols.map(c => h('th', {}, c)))),
      h('tbody', {}, [0, 1, 2].map(r => h('tr', {}, p.cols.map((c, i) => c === ',' ? h('td', { class: 'comma' }, r === 0 ? ',' : '')
        : h('td', {}, h('input', { class: 'num-cell', inputmode: 'numeric', maxlength: 2, value: vals[`${r}-${i}`] || '', 'aria-label': `Ligne ${r + 1}, ${c}`, oninput: (e) => { vals[`${r}-${i}`] = e.target.value.replace(/[^0-9]/g, '').slice(0, 2); e.target.value = vals[`${r}-${i}`]; } })))))))));
  };
  draw();
  stage.append(h('div', { class: 'card stack' }, h('div', { class: 'row' },
    h('select', { 'aria-label': 'Tableau', 'data-testid': 'num-preset', onchange: (e) => { num.preset = e.target.value; draw(); } }, Object.entries(PRESETS_NUM).map(([k, v]) => h('option', { value: k, selected: num.preset === k }, v.label))),
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => { num.values[num.preset] = {}; draw(); } }, 'Effacer')),
  h('p', { class: 'muted small' }, 'Tapez un chiffre par case ; trois lignes pour comparer ou convertir.'), wrap));
}

// ───────── Réglettes (longueurs 1 à 10, couleurs traditionnelles)
export const RODS = [[1, '#f4f4f0', 'blanche'], [2, '#d9342b', 'rouge'], [3, '#7cc242', 'vert clair'], [4, '#c25bb6', 'rose'], [5, '#f7d72a', 'jaune'], [6, '#1d7a3c', 'vert foncé'], [7, '#222222', 'noire'], [8, '#8a5a2b', 'marron'], [9, '#2d6bd1', 'bleue'], [10, '#f08a1c', 'orange']];
const rg = { items: [], unit: 34 };
function reglettes(stage) {
  const board = h('div', { class: 'rg-board', 'data-testid': 'rg-board', style: { '--u': `${rg.unit}px` } });
  const total = h('span', { class: 'muted' });
  const draw = () => {
    board.replaceChildren(...rg.items.map((it, idx) => {
      const [n, color] = RODS[it.n - 1];
      const el = h('div', { class: 'rod-piece', style: { left: `${it.x}px`, top: `${it.y}px`, width: `${(it.v ? 1 : n) * rg.unit}px`, height: `${(it.v ? n : 1) * rg.unit}px`, background: color, color: n === 7 || n === 6 || n === 9 ? '#fff' : '#222' }, title: `Réglette ${n} (${RODS[n - 1][2]}) — double-clic pour tourner`, 'data-n': n }, rg.showNum ? String(n) : '');
      let sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
      el.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; ox = it.x; oy = it.y; moved = false; el.setPointerCapture(e.pointerId); });
      el.addEventListener('pointermove', (e) => { if (!el.hasPointerCapture(e.pointerId)) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        it.x = Math.round((ox + dx) / (rg.unit / 2)) * (rg.unit / 2); it.y = Math.round((oy + dy) / (rg.unit / 2)) * (rg.unit / 2); el.style.left = `${it.x}px`; el.style.top = `${it.y}px`; });
      el.addEventListener('dblclick', () => { it.v = !it.v; draw(); });
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); rg.items.splice(idx, 1); draw(); });
      return el;
    }));
    total.textContent = rg.items.length ? `${rg.items.length} réglette(s), longueur totale ${rg.items.reduce((a, it) => a + it.n, 0)}` : '';
  };
  draw();
  const palette = h('div', { class: 'row' }, RODS.map(([n, color, name]) => h('button', { type: 'button', class: 'rod-btn', style: { width: `${n * 14 + 10}px`, background: color, color: n === 7 || n === 6 || n === 9 ? '#fff' : '#222' }, 'aria-label': `Ajouter la réglette ${n} (${name})`, 'data-testid': `rod-${n}`,
    onclick: () => { const y = (rg.items.length % 10) * rg.unit * 1.25 + 8; rg.items.push({ n, x: 8, y, v: false }); draw(); } }, String(n))));
  stage.append(h('div', { class: 'card stack' }, palette,
    h('div', { class: 'row' }, h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: !!rg.showNum, onchange: (e) => { rg.showNum = e.target.checked; draw(); } }), 'afficher les longueurs'),
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => { rg.items = []; draw(); } }, 'Tout enlever'), total),
    h('p', { class: 'muted small' }, 'Glissez pour déplacer (aimanté à la demi-unité), double-cliquez pour tourner, clic droit (ou appui long sur tablette) pour enlever.')), board);
}

// ───────── Pourcentages
export function pct(part, total) { return total > 0 ? Math.round(part / total * 1000) / 10 : 0; }
function pourcent(stage) {
  const out1 = h('p', { class: 'big-number', 'data-testid': 'pct-dictee' }, '—');
  const words = h('input', { type: 'number', min: 1, value: 40, 'aria-label': 'Nombre de mots', 'data-testid': 'pct-words' });
  const errs = h('input', { type: 'number', min: 0, value: 0, 'aria-label': 'Nombre d’erreurs', 'data-testid': 'pct-errors' });
  const calc1 = () => { const w = Number(words.value) || 0, e = Math.min(w, Number(errs.value) || 0); const p = pct(w - e, w); out1.replaceChildren(`${String(p).replace('.', ',')} %`, h('span', {}, ` de mots justes (${w - e} sur ${w})`)); };
  words.oninput = calc1; errs.oninput = calc1; calc1();
  const out2 = h('div', { 'data-testid': 'pct-appel' });
  const f = { pres: h('input', { type: 'number', min: 0, value: 0, 'aria-label': 'Demi-journées de présence' }), abs: h('input', { type: 'number', min: 0, value: 0, 'aria-label': 'Demi-journées d’absence' }), ret: h('input', { type: 'number', min: 0, value: 0, 'aria-label': 'Retards' }) };
  const calc2 = () => { const p = Number(f.pres.value) || 0, a = Number(f.abs.value) || 0, r = Number(f.ret.value) || 0; const t = p + a;
    out2.replaceChildren(t ? h('ul', { class: 'plain' }, h('li', {}, `Présence : ${String(pct(p, t)).replace('.', ',')} %`), h('li', {}, `Absence : ${String(pct(a, t)).replace('.', ',')} %`), h('li', {}, `Retards : ${String(pct(r, p)).replace('.', ',')} % des présences`)) : h('p', { class: 'muted' }, 'Saisissez les nombres.')); };
  Object.values(f).forEach(i => { i.oninput = calc2; }); calc2();
  stage.append(h('div', { class: 'grid-2' },
    h('section', { class: 'card stack' }, h('h2', {}, 'Réussite d’une dictée'), h('div', { class: 'row' }, h('label', { class: 'inline' }, 'Mots', words), h('label', { class: 'inline' }, 'Erreurs', errs)), out1,
      h('p', { class: 'muted small' }, 'Chaque mot faux compte une erreur. À adapter à votre barème.')),
    h('section', { class: 'card stack' }, h('h2', {}, 'Registre d’appel'), h('div', { class: 'row' }, h('label', { class: 'inline' }, 'Présences', f.pres), h('label', { class: 'inline' }, 'Absences', f.abs), h('label', { class: 'inline' }, 'Retards', f.ret)), out2,
      h('p', { class: 'muted small' }, 'En demi-journées. Les taux de chaque élève sont aussi calculés dans Aujourd’hui › Appel.'))));
}
