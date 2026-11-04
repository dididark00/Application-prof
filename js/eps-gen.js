// Générateur EPS : à partir de l'activité, du cycle, de l'espace, du matériel et de l'effectif,
// propose une séquence (ou une séance) de situations de la banque, avec phases détaillées,
// schéma de terrain, équipes, observation ; puis l'enregistre comme séquence + fiches de séance
// (+ schémas EPS, + lignes de progression), le tout modifiable ensuite.
import * as store from './store.js';
import * as model from './model.js';
import * as P from './pedago.js';
import * as E from './eps.js';
import * as B from './eps-bank.js';

/** La situation est-elle faisable avec ce matériel (quantités minimales) ? Renvoie le matériel manquant. */
export function missing(sit, have = {}) {
  return Object.entries(sit.mat || {}).filter(([k, n]) => (Number(have[k]) || 0) < Math.min(n, k === 'chrono' || k === 'musique' ? 1 : Math.ceil(n / 2))).map(([k]) => B.MATERIEL.find(m => m[0] === k)?.[1] || k);
}
/** Situations possibles : d'abord la sous-famille choisie, puis le reste de la famille. */
export function candidates({ fam, sub, cycle, space, have, effectif }) {
  const ok = (s) => s.fam === fam && (!cycle || s.cycles.includes(Number(cycle))) && (!space || s.spaces.includes(space)) && (!effectif || s.minEleves <= effectif) && !missing(s, have).length;
  const all = B.SITUATIONS.filter(ok);
  return { main: all.filter(s => !sub || s.sub === sub), other: all.filter(s => sub && s.sub !== sub),
    blocked: B.SITUATIONS.filter(s => s.fam === fam && (!sub || s.sub === sub) && !ok(s)).map(s => ({ s, why: [...missing(s, have).map(m => `manque : ${m}`), space && !s.spaces.includes(space) ? 'espace non adapté' : '', cycle && !s.cycles.includes(Number(cycle)) ? 'autre cycle' : ''].filter(Boolean) })) };
}

const fieldOf = (space) => ({ gymnase: 'gymnase', salle: 'gymnase', terrain: 'terrain', cour: 'cour', parc: 'terrain', piscine: 'libre' }[space] || 'cour');
/** Schéma de terrain modifiable (même format que l'outil « Schémas EPS »). */
export function diagramFor(kind, { space, groups = 4, label = '' } = {}) {
  const I = E.newItem; const C = E.DEFAULT_COLORS;
  const players = (xs, y, color) => xs.map((x, i) => I('joueur', x, y, { color, label: String(i + 1) }));
  const make = {
    equipes: () => [I('ligne', 0, 0, { x1: 500, y1: 40, x2: 500, y2: 560 }), ...players([300, 360], 200, C[0]), ...players([300, 380], 400, C[0]), ...players([640, 700], 200, C[1]), ...players([620, 700], 400, C[1]), I('ballon', 330, 300), I('passe', 0, 0, { x1: 310, y1: 215, x2: 370, y2: 385 }), I('enseignant', 500, 560)],
    capitaine: () => [I('ligne', 0, 0, { x1: 500, y1: 40, x2: 500, y2: 560 }), I('cerceau', 70, 300), I('joueur', 70, 300, { color: C[1], label: 'C' }), I('cerceau', 930, 300), I('joueur', 930, 300, { color: C[0], label: 'C' }), ...players([350, 420], 220, C[0]), ...players([380], 400, C[0]), ...players([580, 650], 220, C[1]), ...players([620], 400, C[1]), I('ballon', 430, 240), I('passe', 0, 0, { x1: 430, y1: 240, x2: 860, y2: 300 })],
    beret: () => [I('ligne', 0, 0, { x1: 120, y1: 80, x2: 120, y2: 520 }), I('ligne', 0, 0, { x1: 880, y1: 80, x2: 880, y2: 520 }), ...[150, 250, 350, 450].map((y, i) => I('joueur', 90, y, { color: C[0], label: String(i + 1) })), ...[150, 250, 350, 450].map((y, i) => I('joueur', 910, y, { color: C[1], label: String(i + 1) })), I('plot', 500, 300, { label: 'béret' }), I('deplacement', 0, 0, { x1: 120, y1: 250, x2: 470, y2: 300 }), I('deplacement', 0, 0, { x1: 880, y1: 250, x2: 530, y2: 300 }), I('enseignant', 500, 560)],
    poursuite: () => [I('zone', 120, 300, { label: 'Maison', w: 160, h: 480 }), I('zone', 880, 300, { label: 'Maison', w: 160, h: 480 }), I('joueur', 480, 250, { color: C[1], label: 'É' }), I('joueur', 540, 360, { color: C[1], label: 'É' }), ...[120, 200, 280, 360, 440].map((y) => I('joueur', 110, y, { color: C[0] })), I('deplacement', 0, 0, { x1: 160, y1: 200, x2: 820, y2: 330 }), I('enseignant', 500, 560)],
    relais: () => [...[130, 250, 370, 490].flatMap((y, i) => [I('plot', 120, y), I('plot', 820, y), I('joueur', 80, y, { color: C[i % C.length], label: 'A' }), I('deplacement', 0, 0, { x1: 150, y1: y - 12, x2: 790, y2: y - 12 }), I('deplacement', 0, 0, { x1: 790, y1: y + 12, x2: 150, y2: y + 12, color: '#777777' })]), I('enseignant', 500, 560)],
    couloirs: () => [...[150, 250, 350, 450].flatMap((y, i) => [I('ligne', 0, 0, { x1: 80, y1: y + 50, x2: 920, y2: y + 50 }), I('joueur', 110, y, { color: C[i % C.length] }), I('deplacement', 0, 0, { x1: 140, y1: y, x2: 760, y2: y })]), I('ligne', 0, 0, { x1: 780, y1: 90, x2: 780, y2: 510, label: 'arrivée' }), I('enseignant', 860, 300)],
    boucle: () => [...[[200, 150], [800, 150], [800, 450], [200, 450]].map(([x, y]) => I('plot', x, y)), I('deplacement', 0, 0, { x1: 220, y1: 150, x2: 780, y2: 150 }), I('deplacement', 0, 0, { x1: 800, y1: 170, x2: 800, y2: 430 }), I('deplacement', 0, 0, { x1: 780, y1: 450, x2: 220, y2: 450 }), I('deplacement', 0, 0, { x1: 200, y1: 430, x2: 200, y2: 170 }), I('joueur', 500, 150, { color: C[0] }), I('joueur', 500, 450, { color: C[1] }), I('enseignant', 500, 300)],
    ateliers: () => { const n = Math.max(2, Math.min(4, groups)); const pos = [[260, 170], [740, 170], [740, 430], [260, 430]].slice(0, n);
      return [...pos.map(([x, y], i) => I('zone', x, y, { label: `Atelier ${i + 1}`, w: 300, h: 190, color: C[i] })), ...pos.map(([x, y], i) => I('deplacement', 0, 0, { x1: x + (i % 2 ? -30 : 30), y1: y + (i < 2 ? 100 : -100), x2: pos[(i + 1) % n][0] + (i % 2 ? -30 : 30), y2: pos[(i + 1) % n][1] + (i < 2 ? -100 : 100) })).slice(0, n), I('enseignant', 500, 300)]; },
    parcours: () => [I('cerceau', 150, 140), I('cerceau', 210, 140), I('cerceau', 270, 140), I('banc', 600, 140), I('tapis', 830, 300), I('plot', 600, 460), I('plot', 520, 460), I('plot', 440, 460), I('plot', 360, 460), I('zone', 150, 430, { label: 'Départ', w: 160, h: 110 }),
      I('deplacement', 0, 0, { x1: 310, y1: 140, x2: 520, y2: 140 }), I('deplacement', 0, 0, { x1: 690, y1: 160, x2: 800, y2: 260 }), I('deplacement', 0, 0, { x1: 800, y1: 350, x2: 640, y2: 450 }), I('deplacement', 0, 0, { x1: 330, y1: 460, x2: 240, y2: 440 }), I('enseignant', 500, 300)],
    opposition: () => [...[[250, 180], [750, 180], [250, 420], [750, 420]].flatMap(([x, y], i) => [I('tapis', x, y, { w: 200, h: 150, label: `Tapis ${i + 1}` }), I('joueur', x - 30, y, { color: C[0] }), I('joueur', x + 30, y, { color: C[1] })]), I('enseignant', 500, 300)],
    ronde: () => [...Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return I('joueur', 500 + Math.cos(a) * 200, 300 + Math.sin(a) * 180, { color: C[i % 2] }); }), I('zone', 500, 300, { label: 'Scène', w: 260, h: 200, color: C[4] }), I('enseignant', 500, 560)],
    lancer: () => [I('ligne', 0, 0, { x1: 150, y1: 80, x2: 150, y2: 520, label: 'lancer' }), ...[300, 450, 600, 750].map((x, i) => I('ligne', 0, 0, { x1: x, y1: 80, x2: x, y2: 520, label: `${(i + 1) * 2} m`, color: '#cccccc' })), ...[160, 260, 360, 460].map((y, i) => I('joueur', 110, y, { color: C[i % C.length] })), I('passe', 0, 0, { x1: 140, y1: 260, x2: 560, y2: 240 }), I('enseignant', 110, 560)],
    piscine: () => [I('zone', 500, 300, { label: 'Petit bain', w: 860, h: 460, color: '#2f6f8f' }), I('ligne', 0, 0, { x1: 80, y1: 230, x2: 920, y2: 230, color: '#e0a020' }), I('ligne', 0, 0, { x1: 80, y1: 370, x2: 920, y2: 370, color: '#e0a020' }), I('joueur', 120, 160, { color: C[0] }), I('joueur', 120, 300, { color: C[1] }), I('joueur', 120, 440, { color: C[2] }), I('deplacement', 0, 0, { x1: 150, y1: 300, x2: 850, y2: 300 }), I('enseignant', 500, 560)],
    orientation: () => [...[[150, 120, 'A'], [850, 120, 'B'], [880, 480, 'C'], [140, 470, 'D'], [500, 110, 'E']].map(([x, y, l]) => I('plot', x, y, { label: `balise ${l}` })), I('zone', 500, 320, { label: 'Départ / arrivée', w: 200, h: 120 }), I('deplacement', 0, 0, { x1: 500, y1: 260, x2: 180, y2: 140 }), I('deplacement', 0, 0, { x1: 560, y1: 270, x2: 830, y2: 140 }), I('enseignant', 500, 340)],
  };
  const items = (make[kind] || make.ateliers)();
  if (label) items.push(I('texte', 500, 30, { label }));
  return { field: kind === 'piscine' ? 'libre' : fieldOf(space), items };
}

/** Équipes équilibrées tirées au sort à partir de la liste des élèves. */
export function makeTeams(students, count) {
  const ids = students.map(s => s.id).sort(() => Math.random() - 0.5);
  const names = ['rouge', 'bleue', 'verte', 'jaune', 'violette', 'turquoise'];
  const n = Math.max(2, Math.min(6, count || 2));
  const out = Array.from({ length: n }, (_, i) => ({ name: `Équipe ${names[i]}`, ids: [] }));
  ids.forEach((id, i) => out[i % n].ids.push(id));
  return out.map(t => `${t.name} : ${t.ids.map(id => store.get(id)?.firstName).filter(Boolean).join(', ')}`).join('\n');
}

const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
const warmupFor = (fam, space, cycle, i) => { const l = B.ECHAUFFEMENTS.filter(w => w.fams.includes(fam) && (!w.spaces || w.spaces.includes(space)) && (!w.cycles || w.cycles.includes(Number(cycle)))); return pick(l.length ? l : B.ECHAUFFEMENTS, i); };
const lines = (...xs) => xs.filter(x => x && String(x).trim()).join('\n');
const phase = (kind, title, duration, f = {}) => ({ id: store.uid(), kind, title, duration, ...f });
function situationPhase(kind, s, duration, { variant = '', evaluation = false } = {}) {
  return phase(kind, s.title, duration, {
    modalite: s.org, but: s.but,
    consigne: lines(`« ${s.consigne} »`, variant ? `Variante du jour : ${variant}` : ''),
    eleves: s.but, enseignant: lines(`Installation : ${s.installation}`, `Règles : ${s.regles}`, `Sécurité : ${s.securite}`, evaluation ? `J’observe : ${s.observation}` : ''),
    differenciation: lines(`Pour simplifier : ${s.simplifier}`, `Pour complexifier : ${s.complexifier}`, s.adaptations ? `Besoins particuliers : ${s.adaptations}` : ''),
    criteres: s.criteres, exercices: '', sitId: s.id });
}

/**
 * Propose un plan modifiable.
 * opts : { fam, sub, cycle, level, space, have, effectif, sessions (1 = séance isolée), duree, students }
 */
export function generate(opts) {
  const { fam, sub, cycle, space, have, effectif, sessions = 6, duree = 45 } = opts;
  const c = candidates({ fam, sub, cycle, space, have, effectif });
  const pool = c.main.length ? c.main : c.other;
  if (!pool.length) return { error: 'Aucune situation de la banque ne convient avec ce matériel, cet espace et ce cycle.', blocked: c.blocked };
  const extra = [...c.main, ...c.other];
  const n = Math.max(1, Math.min(12, Number(sessions) || 1));
  const ech = Math.min(10, Math.max(5, Math.round(duree * 0.15))); const ret = 5;
  const work = Math.max(10, duree - ech - ret);
  const famObj = B.famOf(fam);
  const out = [];
  for (let i = 0; i < n; i++) {
    const role = n === 1 ? 'seance' : i === 0 ? 'decouverte' : i === n - 1 ? 'evaluation' : 'apprentissage';
    const A1 = pick(pool, role === 'evaluation' ? 0 : i);
    const A2 = pool.length > 1 ? pick(pool, i + 1) : (extra.find(s => s.id !== A1.id) || A1);
    const late = i >= Math.floor(n / 2) && role !== 'evaluation';
    const w = warmupFor(fam, space, cycle, i);
    const r = pick(B.RETOURS, i);
    const d1 = Math.round(work * (A2 === A1 ? 1 : 0.55)); const d2 = work - d1;
    const phases = [
      phase('rappel', `Échauffement — ${w.title}`, ech, { modalite: 'collectif', consigne: w.consigne, but: 'Se préparer à l’effort, entrer dans l’activité.' }),
      situationPhase('recherche', A1, d1, { variant: late ? A1.complexifier : (role === 'decouverte' ? A1.simplifier : ''), evaluation: role === 'evaluation' || role === 'decouverte' }),
      ...(A2 !== A1 ? [situationPhase('entrainement', A2, d2, { variant: late ? A2.complexifier : '' })] : []),
      phase('bilan', r.title, ret, { modalite: 'collectif, assis', question: r.consigne, verification: A1.observation, suite: i < n - 1 ? `Prochaine séance : ${pick(pool, i + 1).title}.` : 'Fin de la séquence : bilan des progrès.' }),
    ];
    const roleLabel = { decouverte: 'Découverte et évaluation diagnostique', apprentissage: late ? 'Apprentissage — situations complexifiées' : 'Apprentissage', evaluation: 'Évaluation et rencontre de fin de séquence', seance: 'Séance' }[role];
    out.push({
      key: store.uid(), role, title: `${A1.title}${role === 'evaluation' ? ' — évaluation' : role === 'decouverte' ? ' — découverte' : ''}`, roleLabel,
      objective: A1.but, criteres: lines(A1.criteres, A2 !== A1 ? A2.criteres : ''), prerequis: i === 0 ? 'Connaître le signal d’arrêt et les règles de sécurité de l’espace.' : `Séance ${i} : ${out[i - 1].title}.`,
      materiel: [...new Set([A1, A2].flatMap(s => Object.entries(s.mat || {}).map(([k, q]) => `${B.MATERIEL.find(m => m[0] === k)?.[1] || k} (${q})`)))].join(', '),
      securite: lines(A1.securite, A2 !== A1 ? A2.securite : ''), observation: A1.observation, adaptations: A1.adaptations, vocabulaire: [...new Set([...A1.mots, ...A2.mots])].join(', '),
      diagramKind: A1.diagram, teams: '', phases,
    });
  }
  return { title: `${B.subLabel(fam, sub) || famObj.label} — ${n > 1 ? `séquence de ${n} séances` : 'séance'}`, fam, sub, space, champ: famObj.champ, sessions: out, blocked: c.blocked, pool: extra.map(s => s.id) };
}

/** Remplace une situation dans une phase par une autre de la banque. */
export function swapSituation(ph, sitId) {
  const s = B.SITUATIONS.find(x => x.id === sitId); if (!s) return ph;
  return { ...situationPhase(ph.kind, s, ph.duration), id: ph.id };
}

/** Compétences EPS des référentiels validés les plus proches des situations (mots-clés). */
export function competenciesFor(plan, levels) {
  const words = new Set(plan.sessions.flatMap(s => s.vocabulaire.split(',').map(w => w.trim().toLowerCase())).filter(Boolean));
  const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const scored = [];
  for (const r of store.all('referential').filter(x => x.status === 'validé' && /eps|education physique/i.test(norm(x.name)))) {
    for (const i of r.items || []) {
      if (levels.length && (i.levels || []).length && !i.levels.some(l => levels.includes(l))) continue;
      const txt = norm(`${i.label} ${i.domain || ''} ${i.subdomain || ''}`);
      let score = 0; for (const w of words) if (w.length > 3 && txt.includes(norm(w).replace(/s$/, ''))) score++;
      if (norm(plan.champ || '').split(' ').some(w => w.length > 6 && txt.includes(w))) score++;
      if (score) scored.push({ id: i.id, score });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 4).map(x => x.id);
}

/** Enregistre : séquence EPS, fiches de séance, schémas, et (option) lignes de progression de la période. */
export async function save(plan, { cls, levels, periodId = null, startWeek = 1, ressource = '', competencyIds = [] }) {
  const seq = await store.create('sequence', { classId: cls.id, title: plan.title, subject: 'EPS', subdomain: B.subLabel(plan.fam, plan.sub) || B.famOf(plan.fam)?.label || '', levels, periodId,
    objectifGeneral: plan.sessions[0]?.objective || '', competencyIds, prerequis: plan.sessions[0]?.prerequis || '', materiel: [...new Set(plan.sessions.map(s => s.materiel))].join(' ; '),
    supportsEnseignant: ressource, adaptations: plan.sessions.map(s => s.adaptations).filter(Boolean)[0] || '', evalFinale: plan.sessions.at(-1)?.observation || '', notionIds: [], manualRefs: [], fileIds: [], generatedBy: 'eps-gen' }, `Séquence EPS « ${plan.title} » créée`);
  const ids = [];
  for (const [i, s] of plan.sessions.entries()) {
    const ses = await store.create('session', { classId: cls.id, sequenceId: seq.id, title: s.title, subject: 'EPS', subdomain: seq.subdomain, levels, order: i + 1, mode: 'quotidien', teacherMode: 'dirigé',
      objective: s.objective, criteres: s.criteres, prerequis: s.prerequis, avant: s.materiel, vocabulaire: s.vocabulaire, organisation: s.teams || '', evaluation: s.observation,
      phases: s.phases.map(({ sitId, ...ph }) => ph), competencyIds, fileIds: [], manualRefs: [], copies: [], variants: [], checklist: {}, place: '', duration: s.phases.reduce((t, p) => t + (Number(p.duration) || 0), 0) }, `Fiche EPS « ${s.title} »`);
    ids.push(ses.id);
    const d = diagramFor(s.diagramKind, { space: plan.space, groups: 4 });
    const main = s.phases.find(p => p.kind === 'recherche');
    await store.create('epsdiagram', { title: `${s.title} — installation`, field: d.field, items: d.items, sessionId: ses.id, phaseId: main?.id || null, classId: cls.id, order: 0, dims: { w: '', h: '' }, teams: {},
      notes: { consignes: main?.consigne || '', materiel: s.materiel, rotations: s.teams || '', vigilance: s.securite } }, 'Schéma EPS généré');
  }
  if (periodId) {
    let pr = P.ofClass('progression', cls.id).find(p => p.periodId === periodId && p.subject === 'EPS');
    const rows = ids.map((sid, i) => ({ id: store.uid(), week: Number(startWeek) + i, sequenceId: seq.id, sessionId: sid, title: '', objective: plan.sessions[i].objective, support: ressource, status: 'À venir', adjustments: '', extra: {}, notionIds: [] }));
    if (pr) await store.update(pr.id, { rows: [...(pr.rows || []), ...rows] }, 'Progression EPS complétée');
    else await store.create('progression', { classId: cls.id, subject: 'EPS', level: levels.join(', '), subdomain: '', periodId, programmationId: null, owner: '', extraColumns: [], rows }, 'Progression EPS créée');
  }
  return { seq, ids };
}
void model;
