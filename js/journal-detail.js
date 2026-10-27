// Cahier journal détaillé : pour chaque séance, le lien avec les programmes (discipline, domaine,
// séquence, notions de la programmation), l'objectif, les compétences en toutes lettres, le déroulé
// (durée, phase, consigne) et le matériel. Tout vient de la fiche de séance et de sa séquence.
import * as store from './store.js';
import * as P from './pedago.js';
import { h } from './ui.js';
import { competencyIndex, competencyLabel } from './pages/referentiels.js';
import { manualRefsText } from './pedago-ui.js';

export const isDetailed = () => { try { return localStorage.getItem('classeur.journalDetail') !== '0'; } catch { return true; } };
export const setDetailed = (v) => { try { localStorage.setItem('classeur.journalDetail', v ? '1' : '0'); } catch { /* */ } };

const PH_TEXT = (ph) => ph.consigne || ph.but || ph.question || ph.exercices || ph.enseignant || '';

/** Lignes « programme » d'une séance : discipline, domaine, séquence, notions. */
export function programmeLink(e, s) {
  const o = e.occ || {};
  const seq = store.get(o.sequenceId) || store.get(s?.sequenceId);
  const notionIds = [...new Set([...(s?.notionIds || []), ...(seq?.notionIds || [])])];
  const notions = notionIds.map(id => store.get(id)).filter(n => n && !n.deletedAt);
  const domain = o.domain || s?.subdomain || seq?.subdomain || '';
  const parts = [e.subject, domain].filter(Boolean);
  return h('div', { class: 'jd-prog small', 'data-testid': 'jd-prog' },
    parts.length ? h('span', {}, h('strong', {}, 'Programme : '), parts.join(' › ')) : null,
    seq ? h('span', {}, h('strong', {}, ' · Séquence : '), h('a', { href: `#/sequence/${seq.id}` }, P.sequenceTitle(seq))) : null,
    notions.length ? h('span', {}, h('strong', {}, ' · Notion(s) : '), notions.map((n, i) => [i ? ', ' : '', h('a', { href: `#/programmation/${n.programmationId}` }, n.title)])) : null);
}

/** Bloc détaillé d'une entrée (séance prévue ou version réalisée). */
export function detailBlock(e, shown) {
  const o = e.occ || {};
  const s = shown;
  const out = [programmeLink(e, s)];
  const objective = o.objective || s?.objective;
  if (objective) out.push(h('p', { class: 'small' }, h('strong', {}, 'Objectif : '), objective));
  if (s?.criteres) out.push(h('p', { class: 'small' }, h('strong', {}, 'Critères de réussite : '), s.criteres));
  const seq = store.get(o.sequenceId) || store.get(s?.sequenceId);
  const comps = [...new Set([...(s?.competencyIds || []), ...(seq?.competencyIds || []), ...(o.competencyIds || [])])];
  if (comps.length || s?.competencesText) {
    const idx = competencyIndex();
    out.push(h('div', { class: 'small', 'data-testid': 'jd-comps' }, h('strong', {}, 'Compétences : '),
      h('ul', { class: 'jd-list' }, comps.map(c => h('li', {}, competencyLabel(c, idx))), s?.competencesText ? h('li', {}, s.competencesText) : null)));
  }
  const phases = (s?.phases || []).filter(ph => ph.title || ph.duration || PH_TEXT(ph));
  if (o.deroule) out.push(h('div', { class: 'small' }, h('strong', {}, 'Déroulement : '), h('p', { class: 'pre' }, o.deroule)));
  else if (phases.length) out.push(h('div', { class: 'small', 'data-testid': 'jd-deroule' }, h('strong', {}, 'Déroulement'),
    h('table', { class: 'jd-phases' }, h('tbody', {}, phases.map(ph => h('tr', {},
      h('td', { class: 'nowrap' }, ph.duration ? `${ph.duration} min` : ''),
      h('td', {}, h('strong', {}, ph.title || P.PHASE_KINDS[ph.kind]?.label || 'Phase'), ph.modalite ? h('span', { class: 'muted' }, ` (${ph.modalite})`) : null),
      h('td', { class: 'pre' }, PH_TEXT(ph))))))));
  const mat = [o.materiel, s?.materiel, s?.avant && `À préparer : ${s.avant}`, s?.imprimer && `À imprimer : ${s.imprimer}`, s?.projeter && `À projeter : ${s.projeter}`, s?.distribuer && `À distribuer : ${s.distribuer}`].filter(Boolean);
  if (mat.length) out.push(h('p', { class: 'small' }, h('strong', {}, 'Matériel : '), mat.join(' · ')));
  const refs = manualRefsText(s?.manualRefs || []);
  if (refs) out.push(h('p', { class: 'small' }, h('strong', {}, 'Manuels : '), refs));
  if (s?.trace) out.push(h('p', { class: 'small' }, h('strong', {}, 'Trace écrite : '), s.trace));
  return out;
}
