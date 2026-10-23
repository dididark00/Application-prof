// Jeux pédagogiques et anglais : modèles, mélange, cartons de bingo, voix de synthèse.
import * as store from './store.js';

export const KINDS = [
  { id: 'memory', label: 'Memory (paires)', cols: ['Carte A', 'Carte B (la paire)'], help: 'Chaque ligne = une paire : « chat | cat », « 3 × 4 | 12 »…' },
  { id: 'associations', label: 'Associations (relier)', cols: ['Élément', 'À associer'], help: 'Chaque ligne = un élément et ce qu’il faut lui associer.' },
  { id: 'classement', label: 'Classement (trier)', cols: ['Élément', 'Catégorie'], help: 'Chaque ligne = un élément et sa catégorie : « baleine | mammifère ».' },
  { id: 'ordre', label: 'Remise en ordre', cols: ['Élément (dans le bon ordre)'], help: 'Une ligne par élément, dans le bon ordre : étapes, chronologie, nombres…' },
  { id: 'quiz', label: 'Quiz (QCM)', cols: ['Question', 'Bonne réponse', 'Autres réponses (séparées par ;)'], help: 'Question | bonne réponse | mauvaise 1 ; mauvaise 2…' },
  { id: 'bingo', label: 'Bingo / loto', cols: ['Case'], help: 'Une case par ligne (au moins 9). Chaque carton est tiré au hasard.' },
  { id: 'cartes', label: 'Cartes à questions', cols: ['Question', 'Réponse'], help: 'Question | réponse. À imprimer recto (question) et verso (réponse) côte à côte, à plier.' },
  { id: 'flashcards', label: 'Anglais : flashcards et vocabulaire', cols: ['Mot en anglais', 'Traduction'], help: 'Mot anglais | traduction. Image et enregistrement facultatifs pour chaque mot.' },
  { id: 'dialogue', label: 'Anglais : dialogue', cols: ['Personnage', 'Réplique'], help: 'Personnage | réplique, dans l’ordre du dialogue.' },
];
export const kindOf = (id) => KINDS.find(k => k.id === id) || KINDS[0];
export const games = () => store.all('game').sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
export const gamesOfSession = (sid) => store.all('game').filter(g => g.sessionId === sid);

/** Mélange de Fisher-Yates (aléatoire, ou reproductible avec une graine). */
export function shuffle(list, seed = null) {
  const a = list.slice();
  let s = seed == null ? null : (Number(seed) >>> 0) || 1;
  const rnd = () => { if (s == null) return Math.random(); s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Lignes valides du jeu (au moins la première colonne remplie). */
export const rows = (g) => (g.items || []).filter(i => String(i.a || '').trim());

/** Cartons de bingo : n cartons de taille × taille cases, tous différents si possible. */
export function bingoCards(g, n, size, seed) {
  const pool = rows(g).map(i => i.a);
  const need = size * size;
  if (pool.length < need) return [];
  const out = []; const seen = new Set();
  for (let k = 0; out.length < n && k < n * 20; k++) {
    const card = shuffle(pool, seed + k).slice(0, need);
    const key = [...card].sort().join('|');
    if (seen.has(key) && pool.length > need) continue;
    seen.add(key); out.push(card);
  }
  return out;
}

/** Réponses mélangées d'une question de quiz. */
export function quizChoices(item, seed) {
  const wrong = String(item.c || '').split(';').map(x => x.trim()).filter(Boolean);
  return shuffle([item.b, ...wrong].filter(Boolean), seed);
}

// ───── Voix de synthèse (fournie par l'appareil, aucune connexion requise en général)
export function englishVoices() {
  try { return (window.speechSynthesis?.getVoices() || []).filter(v => /^en(-|_|$)/i.test(v.lang)); } catch { return []; }
}
export function canSpeak() { return 'speechSynthesis' in window; }
export function speak(text, { lang = 'en-GB', rate = 0.85, voiceIndex = 0 } = {}) {
  if (!canSpeak()) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang; u.rate = rate;
  const vs = englishVoices(); if (vs.length) u.voice = vs.find(v => v.lang.replace('_', '-') === lang) || vs[voiceIndex % vs.length];
  window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  return true;
}
