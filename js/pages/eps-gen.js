// Préparer › Générateur EPS : choisir activité, cycle, espace, matériel, effectif → séquence ou séance
// proposée, entièrement modifiable avant l'enregistrement (brouillon gardé sur l'appareil, rien ne se perd).
import * as store from '../store.js';
import * as model from '../model.js';
import * as B from '../eps-bank.js';
import * as G from '../eps-gen.js';
import * as E from '../eps.js';
import { h, icon, toast, field } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { competencyIndex, competencyLabel } from './referentiels.js';

const KEY = 'classeur.epsgen.v1';
// Brouillon : gardé en mémoire (immédiat) et sur l'appareil (localStorage), pour ne rien perdre.
let cache = null; let saveTimer = null;
const loadDraft = () => { if (cache) return cache; try { cache = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { cache = null; } return cache; };
const saveDraft = (d) => { cache = d; clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* */ } }, 250); };
const clearDraft = () => { cache = null; clearTimeout(saveTimer); try { localStorage.removeItem(KEY); } catch { /* */ } };

const cycleOfLevels = (levels) => { const c = model.cycles(levels || []); return c[0] || 2; };

export function render({ rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Générateur EPS'), subTabs(), missing);
  const students = model.studentsOfClass(cls.id).map(x => x.student);
  const d = loadDraft() || {};
  const f = { fam: 'collectifs', sub: '', cycle: cycleOfLevels(cls.levels), space: 'cour', effectif: students.length || 24, duree: 45, sessions: 6, teams: 4, ressource: '', have: { plots: 20, cerceaux: 8, ballons: 6, balles: 12, chasubles: 12, cordes: 4, foulards: 24, craies: 1, chrono: 1 }, periodId: '', startWeek: 1, ...(d.form || {}) };
  let plan = d.plan || null;
  const persist = () => saveDraft({ form: f, plan });

  // ───── Formulaire
  const sel = (key, options, testid, onchange) => h('select', { 'data-testid': testid, onchange: (e) => { f[key] = e.target.value; persist(); onchange?.(); } }, options.map(([v, l]) => h('option', { value: v, selected: String(f[key]) === String(v) }, l)));
  const num = (key, testid, attrs = {}) => h('input', { type: 'number', value: f[key], 'data-testid': testid, style: { width: '7em' }, ...attrs, oninput: (e) => { f[key] = Number(e.target.value) || 0; persist(); } });
  const subSel = h('select', { 'data-testid': 'gen-sub', onchange: (e) => { f.sub = e.target.value; persist(); } });
  const drawSubs = () => subSel.replaceChildren(h('option', { value: '' }, 'Toutes'), ...B.subsOf(f.fam).map(([v, l]) => h('option', { value: v, selected: f.sub === v }, l)));
  drawSubs();
  const matGrid = h('div', { class: 'eps-mat' }, B.MATERIEL.map(([k, l]) => h('label', { class: 'eps-mat-item' }, h('span', {}, l),
    h('input', { type: 'number', min: 0, value: f.have[k] || 0, 'aria-label': `Quantité : ${l}`, 'data-testid': `mat-${k}`, oninput: (e) => { f.have[k] = Number(e.target.value) || 0; persist(); } }))));
  const form = h('section', { class: 'card stack' },
    h('div', { class: 'grid-3' },
      field('Famille d’activités', sel('fam', B.FAMILIES.map(x => [x.id, x.label]), 'gen-fam', () => { f.sub = ''; drawSubs(); })),
      field('Activité', subSel),
      field('Cycle', sel('cycle', [[1, 'Cycle 1'], [2, 'Cycle 2'], [3, 'Cycle 3']], 'gen-cycle'))),
    h('div', { class: 'grid-3' },
      field('Espace', sel('space', B.SPACES, 'gen-space')),
      field('Effectif', num('effectif', 'gen-effectif', { min: 2 })),
      field('Durée d’une séance (min)', num('duree', 'gen-duree', { min: 20, step: 5 }))),
    h('div', { class: 'grid-3' },
      field('Nombre de séances', num('sessions', 'gen-sessions', { min: 1, max: 12 }), '1 = séance isolée'),
      field('Équipes / groupes', num('teams', 'gen-teams', { min: 0, max: 6 }), '0 = pas d’équipes'),
      field('Ma ressource (facultatif)', h('input', { value: f.ressource, placeholder: 'ex. Retz — EPS cycle 2, p. …', oninput: (e) => { f.ressource = e.target.value; persist(); } }), 'Référence notée sur les fiches (le contenu des manuels n’est pas recopié).')),
    h('details', { class: 'eps-mat-box', open: true }, h('summary', {}, h('strong', {}, 'Matériel disponible')), matGrid),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'gen-propose', onclick: () => {
        const r = G.generate({ ...f, cycle: Number(f.cycle) });
        if (r.error) { toast(r.error, { kind: 'error' }); plan = null; persist(); rerender(); return; }
        if (Number(f.teams) > 1 && students.length) for (const s of r.sessions) s.teams = G.makeTeams(students, Number(f.teams));
        plan = r; persist(); rerender();
      } }, plan ? 'Proposer à nouveau' : 'Proposer'),
      plan ? h('button', { class: 'btn btn-link', type: 'button', onclick: () => { plan = null; clearDraft(); rerender(); } }, 'Effacer la proposition') : null));

  return h('div', { class: 'page' },
    pageHeader('Générateur EPS', { favKey: 'preparer/eps-generateur', subtitle: `${cls.name} · séquences et séances à partir de votre matériel, de votre espace et de votre effectif` }),
    subTabs(),
    h('p', { class: 'muted small' }, 'Situations concrètes, réalisables avec peu de matériel. Tout est modifiable avant d’enregistrer ; la proposition en cours est gardée sur cet appareil. À l’enregistrement : une séquence EPS, une fiche par séance (phases détaillées), un schéma de terrain modifiable par séance et, si vous le choisissez, les semaines de la progression — le cahier journal les reprend ensuite.'),
    form,
    plan ? preview(cls, f, plan, students, persist, rerender) : null);
}

function preview(cls, f, plan, students, persist, rerender) {
  const idx = competencyIndex();
  const levels = (cls.levels || []).filter(l => (model.cycles([l])[0] || 2) === Number(f.cycle));
  let comps = plan.competencyIds || G.competenciesFor(plan, levels.length ? levels : cls.levels || []);
  plan.competencyIds = comps;
  const txt = (obj, key, label, rows = 2, testid = null) => h('label', { class: 'field' }, h('span', { class: 'small muted' }, label),
    h('textarea', { rows, 'data-testid': testid, oninput: (e) => { obj[key] = e.target.value; persist(); } }, obj[key] || ''));
  const inp = (obj, key, attrs = {}) => h('input', { value: obj[key] ?? '', ...attrs, oninput: (e) => { obj[key] = attrs.type === 'number' ? Number(e.target.value) || 0 : e.target.value; persist(); } });
  const sits = plan.pool.map(id => B.SITUATIONS.find(s => s.id === id)).filter(Boolean);
  const card = (s, i) => {
    const diag = G.diagramFor(s.diagramKind, { space: plan.space, groups: 4 });
    return h('details', { class: 'card eps-session', open: i === 0, 'data-testid': 'gen-session' },
      h('summary', {}, h('strong', {}, `Séance ${i + 1} · `), s.title, h('span', { class: 'muted small' }, ` — ${s.roleLabel} · ${s.phases.reduce((t, p) => t + (Number(p.duration) || 0), 0)} min`)),
      h('div', { class: 'stack' },
        h('label', { class: 'field' }, h('span', { class: 'small muted' }, 'Titre de la séance'), inp(s, 'title', { 'data-testid': 'gen-title' })),
        h('div', { class: 'grid-2' }, txt(s, 'objective', 'Objectif'), txt(s, 'criteres', 'Critères de réussite')),
        h('div', { class: 'grid-2' }, txt(s, 'materiel', 'Matériel et installation'), txt(s, 'securite', 'Sécurité')),
        h('div', { class: 'grid-2' }, txt(s, 'observation', 'Observation / évaluation simple'), txt(s, 'adaptations', 'Élèves à besoins particuliers')),
        h('div', { class: 'grid-2' },
          h('div', {}, txt(s, 'teams', 'Équipes / groupes', 3, 'gen-teams-text'), students.length ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => { s.teams = G.makeTeams(students, Number(f.teams) || 2); persist(); rerender(); } }, 'Tirer au sort les équipes') : null),
          h('div', { class: 'eps-diag' }, E.render({ ...diag, title: s.title }, { legend: false }), h('p', { class: 'muted small' }, 'Schéma modifiable après l’enregistrement (Schémas EPS).'))),
        h('h3', {}, 'Déroulement'),
        s.phases.map((ph, j) => h('div', { class: 'eps-phase' },
          h('div', { class: 'row wrap' }, h('strong', {}, `${j + 1}.`), inp(ph, 'title', { style: { flex: '1 1 260px' }, 'aria-label': 'Titre de la phase' }),
            h('label', { class: 'inline small' }, inp(ph, 'duration', { type: 'number', min: 1, style: { width: '5em' }, 'aria-label': 'Durée (min)' }), ' min'),
            ['recherche', 'entrainement'].includes(ph.kind) && sits.length > 1 ? h('select', { 'aria-label': 'Remplacer par une autre situation', 'data-testid': 'gen-swap', onchange: (e) => { if (!e.target.value) return; s.phases[j] = G.swapSituation(ph, e.target.value); if (j === 1) s.diagramKind = B.SITUATIONS.find(x => x.id === e.target.value)?.diagram || s.diagramKind; persist(); rerender(); } },
              h('option', { value: '' }, 'Autre situation…'), sits.filter(x => x.id !== ph.sitId).map(x => h('option', { value: x.id }, `${x.title} (${B.subLabel(x.fam, x.sub)})`))) : null),
          h('div', { class: 'grid-2' },
            txt(ph, ph.kind === 'bilan' ? 'question' : 'consigne', ph.kind === 'bilan' ? 'Retour au calme et questions' : 'Consigne orale', 3),
            ph.kind === 'bilan' ? txt(ph, 'verification', 'Ce que j’observe') : txt(ph, 'enseignant', 'Installation, règles, sécurité', 3)),
          ['recherche', 'entrainement'].includes(ph.kind) ? h('div', { class: 'grid-2' }, txt(ph, 'modalite', 'Organisation', 1), txt(ph, 'differenciation', 'Variantes et adaptations', 3)) : null)),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-small btn-link', type: 'button', onclick: () => { if (plan.sessions.length <= 1) return; plan.sessions.splice(i, 1); persist(); rerender(); } }, 'Retirer cette séance'))));
  };
  const year = store.get(cls.yearId); const periods = model.periodsOf(year);
  const compList = h('div', { class: 'stack-sm' });
  const drawComps = () => compList.replaceChildren(...(comps.length ? comps.map(id => h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { if (!e.target.checked) { comps = comps.filter(x => x !== id); plan.competencyIds = comps; persist(); drawComps(); } } }), competencyLabel(id, idx)))
    : [h('p', { class: 'muted small' }, 'Aucune compétence EPS trouvée : importez les programmes ou votre bibliothèque (Programmes et référentiels). Vous pourrez aussi les relier après.')]));
  drawComps();
  return h('div', { class: 'stack', 'data-testid': 'gen-plan' },
    h('section', { class: 'card stack' },
      h('label', { class: 'field' }, h('span', { class: 'small muted' }, 'Titre de la séquence'), inp(plan, 'title', { 'data-testid': 'gen-seq-title' })),
      h('p', { class: 'small' }, h('strong', {}, 'Champ d’apprentissage : '), plan.champ),
      h('div', {}, h('strong', { class: 'small' }, 'Compétences reliées (proposées, décochez si besoin)'), compList),
      plan.blocked?.length ? h('details', { class: 'small' }, h('summary', {}, `${plan.blocked.length} situation(s) non proposée(s)`), h('ul', {}, plan.blocked.map(b => h('li', {}, `${b.s.title} — ${b.why.join(', ')}`)))) : null),
    plan.sessions.map(card),
    h('section', { class: 'card stack' }, h('h2', {}, 'Enregistrer'),
      h('div', { class: 'grid-3' },
        field('Ajouter à la progression de la période', h('select', { 'data-testid': 'gen-period', onchange: (e) => { f.periodId = e.target.value; persist(); } }, h('option', { value: '' }, '— non —'), periods.map((p, k) => h('option', { value: p.id, selected: f.periodId === p.id }, `P${k + 1}`)))),
        field('À partir de la semaine', h('input', { type: 'number', min: 1, max: 10, value: f.startWeek, style: { width: '6em' }, oninput: (e) => { f.startWeek = Number(e.target.value) || 1; persist(); } }))),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'gen-save', onclick: async () => {
        const lv = levels.length ? levels : cls.levels || [];
        const { seq } = await G.save(plan, { cls, levels: lv, periodId: f.periodId || null, startWeek: f.startWeek, ressource: f.ressource, competencyIds: comps });
        clearDraft(); toast(`Séquence enregistrée : ${plan.sessions.length} fiche(s) de séance et leurs schémas.`, { timeout: 8000 });
        location.hash = `#/sequence/${seq.id}`;
      } }, icon('download', 16), plan.sessions.length > 1 ? 'Enregistrer la séquence et ses fiches' : 'Enregistrer la séance'))));
}
