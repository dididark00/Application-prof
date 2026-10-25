// Import de tableaux (CSV depuis Excel, LibreOffice, Google Sheets) : programmation, progression,
// séquences et séances, cahier journal. Chaque ligne est vérifiée et RELIÉE à l'existant :
// séquence et séance retrouvées par leur titre (sinon créées), créneau de l'EDT retrouvé par date et heure,
// compétences retrouvées dans les référentiels par code ou intitulé exact.
import * as store from './store.js';
import * as model from './model.js';
import * as P from './pedago.js';
import * as PL from './planning.js';
import { parseCsv, toCsv, parseDateFr } from './csv.js';

export const KINDS = {
  programmation: { label: 'Programmation (notions par période)', cols: ['Discipline', 'Niveau', 'Période', 'Sous-domaine', 'Notion', 'Compétences', 'Ressources'],
    example: [['Mathématiques', 'CE2', 'P1', 'Nombres', 'Nombres jusqu’à 1 000', 'Comprendre et utiliser les nombres entiers', 'Manuel p. 10']] },
  progression: { label: 'Progression (semaine par semaine)', cols: ['Discipline', 'Niveau', 'Période', 'Semaine', 'Séquence', 'Séance', 'Objectif', 'Support', 'Sous-domaine', 'Notions'],
    example: [['Français', 'CE2', 'P2', '1', 'Le récit', 'Découvrir le texte', 'Identifier les personnages', 'Album', 'Lecture', '']] },
  sequences: { label: 'Séquences et séances', cols: ['Discipline', 'Niveau', 'Période', 'Séquence', 'N° séance', 'Séance', 'Objectif', 'Durée (min)', 'Compétences', 'Déroulé', 'Matériel'],
    example: [['Questionner le monde', 'CE2', 'P2', 'Les états de l’eau', '1', 'Solide, liquide', 'Observer les changements d’état', '45', '', '5 min Mise en route : rappel de la séance précédente | 20 min Recherche : observer des glaçons qui fondent | 10 min Mise en commun : trace écrite | 10 min Bilan : qu’avons-nous appris ?', 'glaçons, coupelles']] },
  edt: { label: 'Emploi du temps (créneaux de la semaine)', cols: ['Jour', 'Début', 'Fin', 'Discipline', 'Intitulé', 'Niveaux', 'Mode', 'Période', 'À partir du', 'Nom de l’EDT'],
    example: [['Lundi', '08:30', '09:00', 'Français', 'Rituels', '', 'rituel', 'P1', '', ''], ['Lundi', '09:00', '10:00', 'Mathématiques', 'Calcul', 'CE2', 'dirigé', 'P1', '', ''], ['Jeudi', '13:30', '15:00', 'EPS', 'Natation', '', 'dirigé', 'P1', '01/10/2026', 'natation']] },
  cahier: { label: 'Cahier journal (séances datées)', cols: ['Date', 'Début', 'Fin', 'Discipline', 'Séance', 'Statut', 'Bilan'],
    example: [['05/01/2027', '08:30', '09:15', 'Français', 'Découvrir le texte', 'prévue', '']] },
};
export const modelCsv = (k) => toCsv([KINDS[k].cols, ...KINDS[k].example]);

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
const colIndex = (header, k) => { const cols = KINDS[k].cols.map(norm); return cols.map(c => header.findIndex(h => norm(h).startsWith(c.split(' (')[0]))); };

/** « P2 », « P1-P3 », « P1, P4 » → périodes. */
export function periodsFrom(year, v) {
  const ps = model.periodsOf(year); const t = String(v || '');
  const out = new Set();
  for (const part of t.split(/[,;+ ]+(?:et\s+)?/i)) {
    const m = part.match(/(\d+)\s*(?:-|à|–)\s*P?(\d+)/i) || part.match(/(\d+)/);
    if (!m) continue;
    const a = Number(m[1]), b = Number(m[2] || m[1]);
    for (let i = a; i <= b; i++) if (ps[i - 1]) out.add(ps[i - 1]);
  }
  return [...out];
}
export function periodFrom(year, v) {
  const ps = model.periodsOf(year); const m = String(v || '').match(/(\d+)/);
  return m ? ps[Number(m[1]) - 1] || null : null;
}
const ALIASES = { maths: 'Mathématiques', math: 'Mathématiques', mathematique: 'Mathématiques', francais: 'Français', qlm: 'Questionner le monde', 'questionner le monde': 'Questionner le monde', lv: 'Langues vivantes', lve: 'Langues vivantes', anglais: 'Langues vivantes', 'arts visuels': 'Arts plastiques', arts: 'Arts plastiques', musique: 'Éducation musicale', chant: 'Éducation musicale', sport: 'EPS' };
const subjectFrom = (v) => { const a = ALIASES[norm(v)]; if (a && model.subjects().includes(a)) return a; const n = norm(v); return model.subjects().find(s => norm(s) === n) || model.subjects().find(s => norm(s).startsWith(n) && n.length > 2) || String(v || '').trim(); };
const levelFrom = (cls, v) => { const l = String(v || '').trim().toUpperCase(); return model.NIVEAUX.includes(l) ? l : (cls.levels?.length === 1 ? cls.levels[0] : ''); };
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const dayFrom = (v) => { const n = norm(v); const i = DAYS.findIndex(d => n && d.startsWith(n.slice(0, 3))); return i >= 0 ? i + 1 : (/^[1-6]$/.test(n) ? Number(n) : 0); };
const timeFrom = (v) => { const m = String(v || '').match(/^(\d{1,2})\s*[h:]\s*(\d{0,2})$/i); return m ? `${m[1].padStart(2, '0')}:${(m[2] || '00').padStart(2, '0')}` : ''; };

/** Compétences retrouvées par code ou intitulé (référentiels validés d'abord). */
export function matchCompetencies(text) {
  const parts = String(text || '').split(/\s*[;\n|]\s*/).map(x => x.trim()).filter(Boolean);
  if (!parts.length) return { ids: [], rest: '' };
  const refs = store.all('referential').sort((a, b) => (b.status === 'validé') - (a.status === 'validé'));
  const ids = [], rest = [];
  for (const p of parts) {
    const n = norm(p); let hit = null;
    for (const r of refs) { hit = (r.items || []).find(i => (i.code && norm(i.code) === n) || norm(i.label) === n); if (hit) break; }
    if (hit) ids.push(hit.id); else rest.push(p);
  }
  return { ids: [...new Set(ids)], rest: rest.join(' ; ') };
}

/** Analyse sans rien écrire : { rows: [{ ok, cells, msg, data }], errors } */
export function analyse(kind, text, cls) {
  const raw = parseCsv(text);
  if (!raw.length) return { rows: [], errors: ['Tableau vide.'] };
  const year = store.get(cls.yearId);
  let header = raw[0]; let body = raw.slice(1);
  let idx = colIndex(header, kind);
  if (idx.filter(i => i >= 0).length < 2) { idx = KINDS[kind].cols.map((_, i) => i); body = raw; header = KINDS[kind].cols; }
  const get = (r, i) => (idx[i] >= 0 ? (r[idx[i]] || '').trim() : '');
  const rows = body.map((r, n) => {
    const line = n + (body === raw ? 1 : 2); const msg = [];
    if (kind === 'edt') {
      const day = dayFrom(get(r, 0)); const start = timeFrom(get(r, 1)); const end = timeFrom(get(r, 2));
      if (!day) msg.push('jour illisible (lundi… samedi)');
      if (!start || !end) msg.push('heures illisibles (08:30 ou 8h30)');
      else if (end <= start) msg.push('la fin est avant le début');
      const levels = get(r, 5).split(/[\s,;/+]+/).map(x => x.toUpperCase()).filter(l => model.NIVEAUX.includes(l));
      const mode = PL.MODES.find(m => norm(m[0]) === norm(get(r, 6)))?.[0] || 'dirigé';
      const pers = periodsFrom(year, get(r, 7));
      if (get(r, 7) && !pers.length) msg.push('période illisible (P1, P2, P1-P3…)');
      const from = get(r, 8) ? parseDateFr(get(r, 8)) : '';
      if (get(r, 8) && !from) msg.push('date « À partir du » illisible (JJ/MM/AAAA)');
      return { line, ok: !msg.length, msg, data: { day, start, end, subject: subjectFrom(get(r, 3)), label: get(r, 4), levels, mode, periodIds: pers.map(p => p.id), from, vname: get(r, 9) } };
    }
    if (kind === 'cahier') {
      const date = parseDateFr(get(r, 0)); const start = timeFrom(get(r, 1)); const end = timeFrom(get(r, 2));
      if (!date) msg.push('date illisible (JJ/MM/AAAA)');
      if (!start) msg.push('heure de début illisible');
      if (date && year && (date < year.start || date > year.end)) msg.push('hors de l’année scolaire');
      return { line, ok: !msg.length, msg, data: { date, start, end: end || (start ? model.hhmm(model.minutes(start) + 45) : ''), subject: subjectFrom(get(r, 3)), title: get(r, 4), status: ['prévue', 'faite', 'partielle', 'annulée'].includes(norm(get(r, 5))) ? norm(get(r, 5)) : 'prévue', note: get(r, 6) } };
    }
    const subject = subjectFrom(get(r, 0)); const level = levelFrom(cls, get(r, 1)); const per = periodFrom(year, get(r, 2));
    if (!subject) msg.push('discipline manquante');
    if (!per) msg.push('période illisible (P1 à P5)');
    if (kind === 'programmation') { if (!get(r, 4)) msg.push('notion manquante'); return { line, ok: !msg.length, msg, data: { subject, level, periodId: per?.id, subdomain: get(r, 3), title: get(r, 4), comp: get(r, 5), resources: get(r, 6) } }; }
    if (kind === 'progression') { const w = Number(get(r, 3)); if (!w) msg.push('semaine manquante (1, 2, 3…)'); if (!get(r, 4) && !get(r, 5)) msg.push('séquence ou séance manquante');
      return { line, ok: !msg.length, msg, data: { subject, level, periodId: per?.id, week: w, seq: get(r, 4), ses: get(r, 5), objective: get(r, 6), support: get(r, 7), subdomain: get(r, 8), notions: get(r, 9) } }; }
    if (!get(r, 3)) msg.push('séquence manquante');
    return { line, ok: !msg.length, msg, data: { subject, level, periodId: per?.id, seq: get(r, 3), num: Number(get(r, 4)) || null, ses: get(r, 5), objective: get(r, 6), duration: Number(get(r, 7)) || null, comp: get(r, 8), deroule: get(r, 9), materiel: get(r, 10) } };
  });
  return { rows, errors: [] };
}

// ───── Écriture
// ───── Déroulé d'une séance écrit dans une cellule : phases séparées par « | » ou par des retours à la ligne,
// chacune « 10 min Recherche : consigne… ». Le type de phase est reconnu par son nom.
const PHASE_WORDS = [['rappel', /^(mise en route|rappel|rituel|accueil|reactivation|installation)/], ['recherche', /^(recherche|decouverte|situation|manipulation|observation|lecture)/],
  ['institution', /^(mise en commun|institutionnalisation|synthese|trace|structuration|lecon)/], ['entrainement', /^(entrainement|application|exercice|reinvestissement|production|ecriture|consolidation)/],
  ['bilan', /^(bilan|retour|conclusion|cloture)/]];
export function parsePhases(text) {
  const parts = String(text || '').split(/\s*(?:\||\n|\r)+\s*/).map(x => x.trim()).filter(Boolean);
  return parts.map(p => {
    let rest = p, duration = null;
    const dm = rest.match(/^(\d+)\s*(?:min(?:utes?)?|’|')\s*[-–—:]?\s*/i) || rest.match(/\((\d+)\s*min\)\s*/i);
    if (dm) { duration = Number(dm[1]); rest = rest.replace(dm[0], '').trim(); }
    let title = '', body = rest;
    const cm = rest.match(/^([^:]{2,60})\s*:\s*(.*)$/s);
    if (cm) { title = cm[1].trim(); body = cm[2].trim(); }
    const kind = (PHASE_WORDS.find(([, re]) => re.test(norm(title || rest))) || ['libre'])[0];
    const field = kind === 'bilan' ? 'question' : kind === 'institution' ? 'but' : 'consigne';
    return { id: store.uid(), kind, title: title || '', duration, [field]: body };
  });
}
function sessionData(cls, seqId, order, d) {
  const cm = matchCompetencies(d.comp);
  const phases = d.deroule ? parsePhases(d.deroule) : P.defaultPhases();
  return { classId: cls.id, sequenceId: seqId, order, title: d.ses || '', subject: d.subject, subdomain: d.subdomain || '', levels: d.level ? [d.level] : [], mode: 'quotidien', teacherMode: 'dirigé', phases,
    objective: d.objective || '', duration: d.duration || null, competencyIds: cm.ids, competencesText: cm.rest, materiel: d.materiel || '', fileIds: [], manualRefs: [], copies: [], variants: [], checklist: {} };
}
/** Trouve (ou prépare la création de) une séquence par son titre. */
function seqFinder(cls, items) {
  const created = new Map();
  return (d) => {
    const key = `${norm(d.subject)}|${norm(d.seq)}`;
    if (created.has(key)) return created.get(key);
    const found = P.ofClass('sequence', cls.id).find(s => norm(s.title) === norm(d.seq) && norm(s.subject) === norm(d.subject));
    if (found) { created.set(key, found.id); return found.id; }
    const id = store.uid();
    items.push({ create: { type: 'sequence', data: { id, classId: cls.id, title: d.seq, number: null, subject: d.subject, subdomain: '', periodId: d.periodId || null, levels: d.level ? [d.level] : [], competencyIds: [], notionIds: [], fileIds: [], manualRefs: [] } } });
    created.set(key, id); return id;
  };
}
function sesFinder(cls, items) {
  const created = new Map();
  return (seqId, d) => {
    if (!d.ses) return null;
    const key = `${seqId}|${norm(d.ses)}`;
    if (created.has(key)) return created.get(key);
    const found = store.all('session').find(s => s.classId === cls.id && (s.sequenceId === seqId || !seqId) && norm(s.title) === norm(d.ses));
    if (found) { created.set(key, found.id); return found.id; }
    const id = store.uid(); const n = [...created.keys()].filter(k => k.startsWith(`${seqId}|`)).length + P.sessionsOfSequence(seqId).length + 1;
    items.push({ create: { type: 'session', data: { id, ...sessionData(cls, seqId, d.num || n, d) } } });
    created.set(key, id); return id;
  };
}

/** Notions de la programmation (même discipline) citées par leur intitulé, séparées par « ; ». Les notions
 * créées dans le même import sont trouvées aussi. Sans colonne Notions : la séquence porte le même titre qu'une notion. */
function notionsFor(d, items) {
  const progs = new Set(store.all('programmation').filter(p => norm(p.subject) === norm(d.subject)).map(p => p.id));
  for (const it of items) if (it.create?.type === 'programmation' && norm(it.create.data.subject) === norm(d.subject)) progs.add(it.create.data.id);
  const pool = [...store.all('notion').filter(n => progs.has(n.programmationId)), ...items.filter(it => it.create?.type === 'notion' && progs.has(it.create.data.programmationId)).map(it => it.create.data)];
  const wanted = d.notions ? d.notions.split(/\s*[;|]\s*/).map(norm).filter(Boolean) : [norm(d.seq)].filter(Boolean);
  return [...new Set(pool.filter(n => n.id && wanted.includes(norm(n.title))).map(n => n.id))];
}

export async function importRows(kind, rows, cls) {
  const ok = rows.filter(r => r.ok).map(r => r.data);
  const items = []; const report = { created: 0, linked: 0, skipped: 0 };
  if (kind === 'programmation') {
    const progs = new Map();
    for (const d of ok) {
      const key = `${d.subject}|${d.level}`;
      let p = progs.get(key) || P.ofClass('programmation', cls.id).find(x => norm(x.subject) === norm(d.subject) && (x.level || '') === d.level);
      if (!p) { p = { id: store.uid(), classId: cls.id, subject: d.subject, level: d.level, subdomains: [], references: '', owner: '' }; items.push({ create: { type: 'programmation', data: p } }); report.created++; }
      progs.set(key, p);
      if (d.subdomain && !p.subdomains.includes(d.subdomain)) p.subdomains = [...(p.subdomains || []), d.subdomain];
      const cm = matchCompetencies(d.comp); report.linked += cm.ids.length;
      items.push({ create: { type: 'notion', data: { id: store.uid(), programmationId: p.id, periodId: d.periodId, subdomain: d.subdomain, title: d.title, competences: cm.rest, competencyIds: cm.ids, resources: d.resources, order: (items.length + 1) * 10 } } }); report.created++;
    }
    for (const p of progs.values()) if (store.get(p.id)) items.push({ id: p.id, patch: { subdomains: p.subdomains } });
  } else if (kind === 'sequences' || kind === 'progression') {
    const findSeq = seqFinder(cls, items); const findSes = sesFinder(cls, items);
    const progs = new Map();
    for (const d of ok) {
      const seqId = d.seq ? findSeq(d) : null;
      const sesId = findSes(seqId, d);
      if (kind === 'progression') {
        const key = `${d.subject}|${d.level}|${d.periodId}|${norm(d.subdomain)}`;
        let pr = progs.get(key);
        if (!pr) {
          const ex = P.ofClass('progression', cls.id).find(x => norm(x.subject) === norm(d.subject) && (x.level || '') === d.level && x.periodId === d.periodId && norm(x.subdomain) === norm(d.subdomain));
          const progId = () => P.ofClass('programmation', cls.id).find(x => norm(x.subject) === norm(d.subject) && (x.level || '') === d.level)?.id || null;
          pr = ex ? { id: ex.id, rows: structuredClone(ex.rows || []), existing: true, programmationId: ex.programmationId || progId() } : { id: store.uid(), rows: [], data: { classId: cls.id, subject: d.subject, level: d.level, subdomain: d.subdomain || '', periodId: d.periodId, programmationId: P.ofClass('programmation', cls.id).find(x => norm(x.subject) === norm(d.subject) && (x.level || '') === d.level)?.id || null, owner: '', extraColumns: [] } };
          progs.set(key, pr);
        }
        pr.rows.push({ id: store.uid(), week: d.week, sequenceId: seqId, sessionId: sesId, title: sesId || seqId ? '' : (d.ses || d.seq), objective: d.objective, support: d.support, status: 'À venir', adjustments: '', extra: {}, notionIds: notionsFor(d, items) });
        report.linked += pr.rows.at(-1).notionIds.length;
        report.created++;
      } else report.created++;
    }
    for (const pr of progs.values()) items.push(pr.existing ? { id: pr.id, patch: { rows: pr.rows, programmationId: pr.programmationId } } : { create: { type: 'progression', data: { id: pr.id, ...pr.data, rows: pr.rows } } });
  } else if (kind === 'edt') {
    // Jamais d'écrasement des créneaux existants. Lignes groupées par (périodes, « à partir du ») :
    // - sans date : un nouvel EDT pour ces périodes (sans période indiquée : celles qui n'ont pas encore d'EDT) ;
    // - avec date : une nouvelle version de l'EDT de cette période, en vigueur à partir de cette date.
    const year = store.get(cls.yearId);
    const all = model.periodsOf(year);
    const tts = PL.timetablesOf(cls.id).map(t => ({ id: t.id, periodIds: [...(t.periodIds || [])], versions: [...(t.versions || [])], existing: true, changed: false }));
    const groups = new Map();
    for (const d of ok) { const k = `${d.periodIds.join(',')}|${d.from}`; if (!groups.has(k)) groups.set(k, { periodIds: d.periodIds, from: d.from, rows: [], name: '' }); const g = groups.get(k); g.rows.push(d); if (d.vname && !g.name) g.name = d.vname; }
    const slotsOf = (rows) => rows.map(d => ({ id: store.uid(), day: d.day, start: d.start, end: d.end, subject: d.subject, label: d.label, mode: d.mode, levels: d.levels }));
    const name = (ids) => { const n = ids.map(id => all.findIndex(p => p.id === id) + 1).filter(Boolean).sort((a, b) => a - b); return n.length ? `EDT ${n.map(x => 'P' + x).join(', ')} (importé)` : `EDT importé le ${model.frShort(model.todayIso())}`; };
    report.moved = 0; report.versions = 0;
    for (const g of [...groups.values()].sort((a, b) => (a.from || '').localeCompare(b.from || ''))) {
      if (g.from) {
        const per = model.periodOfDate(year, g.from);
        const t = tts.find(x => per && x.periodIds.includes(per.id) && !x.existing) || tts.find(x => per && x.periodIds.includes(per.id));
        if (!t) { report.skipped += g.rows.length; continue; }
        t.versions = t.versions.filter(v => v.from !== g.from).concat({ from: g.from, name: g.name, slots: slotsOf(g.rows) }); t.changed = true; report.versions++; report.created += g.rows.length;
        continue;
      }
      let ids = g.periodIds.length ? g.periodIds : all.map(p => p.id).filter(id => !tts.some(t => t.periodIds.includes(id)));
      for (const t of tts) { const before = t.periodIds.length; t.periodIds = t.periodIds.filter(id => !ids.includes(id)); if (t.periodIds.length !== before) { t.changed = true; report.moved++; } }
      tts.push({ id: store.uid(), periodIds: ids, versions: [{ from: '', name: g.name, slots: slotsOf(g.rows) }], existing: false, changed: true, name: name(ids) });
      report.created += g.rows.length; report.periods = (report.periods || 0) + ids.length; if (!ids.length) report.unassigned = true;
    }
    for (const t of tts.filter(x => x.changed)) items.push(t.existing ? { id: t.id, patch: { periodIds: t.periodIds, versions: t.versions } } : { create: { type: 'timetable', data: { id: t.id, classId: cls.id, name: t.name, periodIds: t.periodIds, versions: t.versions } } });
  } else if (kind === 'cahier') {
    const sessions = store.all('session').filter(s => s.classId === cls.id);
    const claimed = new Set();
    for (const d of ok) {
      const key = `${d.date}|${d.start}`;
      if (claimed.has(key)) { report.skipped++; continue; }
      claimed.add(key);
      const ses = d.title ? sessions.find(s => norm(s.title) === norm(d.title) && (!d.subject || norm(s.subject) === norm(d.subject))) || sessions.find(s => norm(s.title) === norm(d.title)) : null;
      const plan = PL.dayPlan(cls, d.date, { ignoreBlank: true });
      const slot = plan.entries.find(e => e.kind === 'slot' && e.start === d.start);
      const occ = plan.entries.find(e => e.kind === 'occ' && e.start === d.start);
      if (occ && (occ.sessionId || occ.occ?.note)) { report.skipped++; continue; }
      const base = slot ? PL.occDataFromEntry(slot, cls) : { classId: cls.id, date: d.date, start: d.start, end: d.end, subject: d.subject, levels: [], mode: 'dirigé', title: ses ? '' : d.title };
      const data = { ...base, sessionId: ses?.id || null, status: d.status, note: d.note, ...(ses ? {} : { title: d.title || base.title || '' }) };
      if (occ) items.push({ id: occ.occ.id, patch: { sessionId: data.sessionId, status: d.status, note: d.note, title: data.title } });
      else items.push({ create: { type: 'occurrence', data } });
      if (ses) report.linked++;
      report.created++;
    }
  }
  if (items.length) await store.batch(items, `Import CSV : ${KINDS[kind].label}`);
  return report;
}
