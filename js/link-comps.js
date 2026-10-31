// Relier en une fois les compétences officielles aux séquences : pour chaque séquence, les compétences
// de sa discipline sont proposées, les plus proches de son intitulé (mots communs) en premier.
// Rien n'est coché d'office : l'enseignante choisit. Les fiches de séance et le cahier journal en héritent.
import * as store from './store.js';
import * as model from './model.js';
import * as P from './pedago.js';
import { h, toast, modal } from './ui.js';
import { pickCompetencies } from './pages/referentiels.js';

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');
const STOP = new Set(['les', 'des', 'une', 'pour', 'avec', 'dans', 'sur', 'par', 'aux', 'du', 'de', 'la', 'le', 'et', 'en', 'un', 'au', 'son', 'ses', 'leur', 'leurs', 'exemple', 'seance', 'sequence', 'semaine', 'cycle', 'programme', 'partir', 'ainsi', 'entre', 'faire', 'etre', 'avoir']);
const words = (t) => new Set(norm(t).split(/[^a-z0-9]+/).filter(w => w.length > 3 && !STOP.has(w)).map(w => w.replace(/s$/, '')));
const ALIAS = { emc: 'enseignement moral civique', eps: 'education physique sportive eps', qlm: 'questionner monde', lvi: 'langues vivantes' };
const subjWords = (s) => { const n = norm(s).trim(); return words(`${n} ${ALIAS[n] || ''}`); };

/** Une compétence relève-t-elle de la discipline ? (nom du référentiel, ex. « Arts plastiques et éducation musicale — CE1, CE2 ») */
function sameSubject(seqSubject, refName) {
  if (!seqSubject) return true;
  const a = subjWords(seqSubject); const b = subjWords(String(refName).split(' — ')[0]);
  return [...a].some(w => b.has(w));
}

/** Compétences candidates pour une séquence, triées par proximité. */
export function suggestionsFor(seq, cls) {
  const levels = seq.levels?.length ? seq.levels : cls.levels || [];
  const text = [seq.title, seq.subdomain, seq.objectifGeneral, seq.notionsVocab, ...(seq.notionIds || []).map(n => store.get(n)?.title),
    ...P.sessionsOfSequence(seq.id).map(s => `${s.title || ''} ${s.objective || ''}`)].join(' ');
  const w = words(text);
  const out = [];
  for (const r of store.all('referential').filter(x => x.status === 'validé' && sameSubject(seq.subject, x.name))) {
    for (const i of r.items || []) {
      if (levels.length && (i.levels || []).length && !i.levels.some(l => levels.includes(l))) continue;
      const iw = words(`${i.label} ${i.domain || ''} ${i.subdomain || ''}`);
      let score = 0; for (const x of iw) if (w.has(x)) score++;
      out.push({ item: i, ref: r, score });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

export function linkDialog(cls) {
  const refs = store.all('referential').filter(x => x.status === 'validé');
  if (!refs.length) {
    modal({ title: 'Relier les compétences', body: h('div', {}, h('p', {}, 'Aucun programme importé et validé pour l’instant.'),
      h('p', { class: 'muted small' }, 'Dans Préparer › Programmes et référentiels, « Tout importer pour ma classe » ajoute les compétences officielles de toutes les disciplines en un clic.')),
    actions: [{ label: 'Fermer' }, { label: 'Aller aux programmes', primary: true, onClick: () => { location.hash = '#/referentiels'; } }] });
    return;
  }
  const seqs = P.ofClass('sequence', cls.id).sort((a, b) => (a.subject || '').localeCompare(b.subject || '') || (Number(a.number) || 0) - (Number(b.number) || 0) || P.sequenceTitle(a).localeCompare(P.sequenceTitle(b)));
  if (!seqs.length) { toast('Aucune séquence dans cette classe.'); return; }
  const chosen = new Map(seqs.map(s => [s.id, new Set(s.competencyIds || [])]));
  const label = (i) => `${i.code ? i.code + ' — ' : ''}${i.label}`;
  const bySubject = new Map(); for (const s of seqs) { const k = s.subject || 'Sans discipline'; if (!bySubject.has(k)) bySubject.set(k, []); bySubject.get(k).push(s); }
  const idx = new Map(); for (const r of refs) for (const i of r.items || []) idx.set(i.id, i);
  const seqBlock = (s) => {
    const box = h('div', { class: 'link-seq', 'data-testid': 'link-seq' });
    const draw = () => {
      const set = chosen.get(s.id);
      const sugg = suggestionsFor(s, cls);
      const top = sugg.filter(x => x.score > 0).slice(0, 5).map(x => x.item);
      const shown = [...[...set].map(id => idx.get(id)).filter(Boolean), ...top.filter(i => !set.has(i.id))];
      box.replaceChildren(
        h('div', { class: 'link-seq-head' }, h('strong', {}, P.sequenceTitle(s)), h('span', { class: 'muted small' }, ` · ${set.size} compétence(s)`)),
        shown.length ? h('div', { class: 'stack-sm' }, shown.map(i => h('label', { class: 'pick-item' }, h('input', { type: 'checkbox', checked: set.has(i.id), 'data-testid': 'link-comp', onchange: (e) => { e.target.checked ? set.add(i.id) : set.delete(i.id); draw(); } }),
          h('span', {}, label(i), !set.has(i.id) ? h('span', { class: 'muted small' }, ' · suggérée') : null))))
          : h('p', { class: 'muted small' }, sugg.length ? 'Pas de suggestion évidente : « Autres… » pour choisir dans la discipline.' : 'Aucune compétence de cette discipline dans les programmes importés.'),
        h('button', { class: 'btn btn-small btn-link', type: 'button', onclick: async () => { const sel = await pickCompetencies([...set], { levels: s.levels?.length ? s.levels : cls.levels }); if (sel) { chosen.set(s.id, new Set(sel)); draw(); } } }, 'Autres…'));
    };
    draw(); return box;
  };
  const body = h('div', { class: 'stack-sm link-comps' },
    h('p', { class: 'muted small' }, 'Pour chaque séquence, les compétences de sa discipline les plus proches de son intitulé et de ses séances sont proposées. Cochez celles qui conviennent : les fiches de séance, le cahier journal, la couverture des programmes et les impressions en profitent.'),
    [...bySubject].map(([subj, list], k) => h('details', { class: 'card', open: k === 0 }, h('summary', {}, h('strong', {}, subj), h('span', { class: 'muted small' }, ` · ${list.length} séquence(s)`)), h('div', { class: 'stack-sm' }, list.map(seqBlock)))));
  modal({ title: 'Relier les compétences à mes séquences', wide: true, body,
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, testid: 'link-save', onClick: async () => {
      const ops = seqs.filter(s => { const a = new Set(s.competencyIds || []), b = chosen.get(s.id); return a.size !== b.size || [...b].some(x => !a.has(x)); }).map(s => ({ id: s.id, patch: { competencyIds: [...chosen.get(s.id)] } }));
      if (!ops.length) return;
      await store.batch(ops, `Compétences reliées à ${ops.length} séquence(s)`);
      toast(`Compétences reliées à ${ops.length} séquence(s).`);
    } }] });
}
void model;
