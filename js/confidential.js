// Informations confidentielles (santé, besoins particuliers, PPRE/PAP/PPS/PAI/AESH).
// Masquées par défaut, affichées après déverrouillage (code facultatif), jamais indexées
// dans la recherche, jamais projetées, exclues des exports par défaut.
// Limite assumée : sur cet appareil, c'est un masquage d'affichage, pas un chiffrement ;
// le contrôle d'accès par compte arrive avec l'étape 5.
import * as store from './store.js';
import { h, modal, field, toast } from './ui.js';

let unlockedUntil = 0;
const DURATION = 10 * 60 * 1000;

export const SENSITIVE_TYPES = ['need', 'plan', 'infoconf', 'incident', 'soin', 'aeshsheet'];
export function isUnlocked() { return Date.now() < unlockedUntil; }
export function lock() { unlockedUntil = 0; }

async function hash(pin, salt) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function hasPin() { return !!store.getSettings().sensitivePin?.hash; }
export async function setPin(pin) {
  if (!pin) { await store.setSettings({ sensitivePin: null }); return; }
  const salt = crypto.getRandomValues(new Uint32Array(2)).join('-');
  await store.setSettings({ sensitivePin: { salt, hash: await hash(pin, salt) } });
}

/** Demande le déverrouillage ; résout true si accordé. */
export function unlock() {
  return new Promise((resolve) => {
    let ok = false;
    if (!hasPin()) {
      modal({ title: 'Informations confidentielles', body: h('div', {}, h('p', {}, 'Ces informations (besoins particuliers, plans d’accompagnement, santé) sont réservées à l’enseignante. Assurez-vous que l’écran n’est pas visible par d’autres personnes.'),
        h('p', { class: 'muted small' }, 'Vous pouvez définir un code dans Réglages › Documents et confidentialité. Masquage automatique après 10 minutes.')),
      onClose: () => resolve(ok), actions: [{ label: 'Annuler' }, { label: 'Afficher', primary: true, onClick: () => { unlockedUntil = Date.now() + DURATION; ok = true; } }] });
      return;
    }
    const input = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', 'aria-label': 'Code', 'data-testid': 'pin' });
    const err = h('p', { class: 'form-errors' });
    modal({ title: 'Code confidentiel', body: h('div', { class: 'form' }, field('Code', input), err), onClose: () => resolve(ok),
      actions: [{ label: 'Annuler' }, { label: 'Déverrouiller', primary: true, onClick: async () => {
        const p = store.getSettings().sensitivePin;
        if (await hash(input.value, p.salt) !== p.hash) { err.textContent = 'Code incorrect.'; return false; }
        unlockedUntil = Date.now() + DURATION; ok = true;
      } }] });
  });
}

/** Bloc masqué tant que la zone n'est pas déverrouillée. */
export function gate(render, rerender) {
  if (isUnlocked()) return h('div', {}, h('div', { class: 'row' }, h('span', { class: 'badge badge-warn' }, 'Confidentiel'),
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => { lock(); rerender(); toast('Informations confidentielles masquées'); } }, 'Masquer')), render());
  return h('div', { class: 'locked-zone' }, h('p', {}, '🔒 Informations confidentielles masquées.'),
    h('button', { class: 'btn', type: 'button', 'data-testid': 'unlock', onclick: async () => { if (await unlock()) rerender(); } }, 'Afficher'));
}
