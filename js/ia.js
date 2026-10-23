// Aides facultatives qui dépendent du navigateur, jamais d'un service choisi par l'application :
//  - IA intégrée à l'appareil (Chrome : API Rewriter / LanguageModel) : le texte ne quitte pas l'appareil.
//    Proposée seulement si le navigateur l'offre en français ; sinon, rien n'est affiché comme disponible.
//  - Reconnaissance vocale : service du navigateur (souvent en ligne : Google pour Chrome, Apple pour Safari),
//    utilisée seulement après accord explicite.
import * as store from './store.js';

const LANG = { expectedInputLanguages: ['fr'], expectedContextLanguages: ['fr'], outputLanguage: 'fr' };

/** 'available' | 'downloadable' | 'downloading' | 'unavailable' */
export async function rewriterStatus() {
  try {
    if ('Rewriter' in self) return await self.Rewriter.availability(LANG);
    if ('LanguageModel' in self) return await self.LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: ['fr'] }], expectedOutputs: [{ type: 'text', languages: ['fr'] }] });
  } catch { /* */ }
  return 'unavailable';
}
const INSTR = {
  simplifier: 'Réécris ce texte en français simple pour un enfant de 8 ans : phrases courtes, mots courants, même sens. Ne rajoute rien.',
  reformuler: 'Reformule ce texte en français, dans un registre bienveillant et professionnel adressé à une famille, sans rien ajouter ni retirer.',
  raccourcir: 'Raccourcis ce texte en français en gardant l’essentiel.',
};
/** Réécrit un texte avec l'IA de l'appareil. mode : simplifier | reformuler | raccourcir */
export async function rewrite(text, mode = 'simplifier', { onProgress } = {}) {
  const monitor = (m) => m.addEventListener('downloadprogress', (e) => onProgress?.(Math.round((e.loaded || 0) * 100)));
  if ('Rewriter' in self) {
    const rw = await self.Rewriter.create({ ...LANG, sharedContext: INSTR[mode], tone: mode === 'reformuler' ? 'more-formal' : 'as-is', length: mode === 'reformuler' ? 'as-is' : 'shorter', monitor });
    try { return (await rw.rewrite(text, { context: INSTR[mode] })).trim(); } finally { rw.destroy?.(); }
  }
  if ('LanguageModel' in self) {
    const lm = await self.LanguageModel.create({ initialPrompts: [{ role: 'system', content: INSTR[mode] }], expectedInputs: [{ type: 'text', languages: ['fr'] }], expectedOutputs: [{ type: 'text', languages: ['fr'] }], monitor });
    try { return (await lm.prompt(text)).trim(); } finally { lm.destroy?.(); }
  }
  throw new Error('Pas d’IA intégrée à ce navigateur.');
}

// ───── Reconnaissance vocale
export const Recognition = () => self.SpeechRecognition || self.webkitSpeechRecognition || null;
/** 'local' (sur l'appareil) | 'online' (service du navigateur) | 'none' */
export async function speechMode() {
  // La détection « sur l'appareil » (SpeechRecognition.available) fait planter certains navigateurs :
  // on ne s'y fie pas et on considère que la voix part au service du navigateur (accord demandé).
  return Recognition() ? 'online' : 'none';
}
export const onlineSpeechAllowed = () => store.getSettings().speechOnline === true;
export function listen({ local, onText, onInterim, onEnd, onError }) {
  const R = Recognition(); const rec = new R();
  rec.lang = 'fr-FR'; rec.continuous = true; rec.interimResults = true;
  if (local) { try { rec.processLocally = true; } catch { /* */ } }
  rec.onresult = (e) => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) onText?.(r[0].transcript.trim()); else interim += r[0].transcript; } onInterim?.(interim); };
  rec.onerror = (e) => onError?.(e.error === 'not-allowed' ? 'Micro refusé : autorisez le micro pour ce site.' : e.error === 'network' ? 'Service de reconnaissance injoignable (connexion).' : `Reconnaissance interrompue (${e.error}).`);
  rec.onend = () => onEnd?.();
  rec.start();
  return () => { try { rec.stop(); } catch { /* */ } };
}
/** Ponctuation dictée : « virgule », « point », « à la ligne »… */
export function punctuate(t) {
  return String(t).replace(/\s*\bvirgule\b/gi, ',').replace(/\s*\bpoint d'interrogation\b/gi, ' ?').replace(/\s*\bpoint d'exclamation\b/gi, ' !').replace(/\s*\bdeux points\b/gi, ' :')
    .replace(/\s*\bpoint\b/gi, '.').replace(/\s*\b(à la ligne|nouvelle ligne)\b\s*/gi, '\n').replace(/(^|[.!?]\s+|\n)(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());
}
