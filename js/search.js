// Recherche globale. Règle : seuls les modules visibles sont interrogés, et
// les données sensibles (coordonnées des familles) ne sont pas indexées.
import * as store from './store.js';
import * as model from './model.js';
import { allPages, isHidden } from './router.js';
import * as P from './pedago.js';

export const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function search(q) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const match = (...fields) => { const t = norm(fields.join(' ')); return terms.every(x => t.includes(x)); };
  const out = [];
  for (const p of allPages()) if (match(p.title, p.rubrique)) out.push({ group: 'Pages', title: p.title, detail: p.ready ? p.rubrique : `${p.rubrique} · prévu à l’étape ${p.etape}`, href: p.href });
  if (!isHidden('classe', 'eleves')) {
    for (const s of store.all('student')) if (match(s.firstName, s.lastName)) {
      const enr = model.enrollmentsOfStudent(s.id).at(-1);
      const c = enr && store.get(enr.classId);
      out.push({ group: 'Élèves', title: `${s.firstName} ${s.lastName}`, detail: [c?.name, enr?.level, s.archived ? 'archivé' : null, s.demo ? 'démo' : null].filter(Boolean).join(' · '), href: `#/eleve/${s.id}` });
    }
  }
  for (const c of store.all('class')) if (match(c.name, c.school, (c.levels || []).join(' '))) out.push({ group: 'Classes', title: c.name, detail: store.get(c.yearId)?.label || '', href: '#/reglages/classes' });
  for (const y of store.all('year')) if (match(y.label)) out.push({ group: 'Années', title: y.label, detail: `${model.frShort(y.start)} → ${model.frShort(y.end)}`, href: '#/reglages/annees' });
  if (!isHidden('preparer', 'fichiers')) {
    for (const f of store.all('file')) if (match(f.name, (f.tags || []).join(' '), f.description, f.subject, f.level, f.project, f.ocrText)) out.push({ group: 'Fichiers', title: f.name, detail: [f.kind === 'link' ? 'lien' : 'fichier', f.subject, f.level].filter(Boolean).join(' · '), href: `#/fichiers?open=${f.id}` });
    for (const d of store.all('folder')) if (match(d.name)) out.push({ group: 'Fichiers', title: d.name, detail: 'dossier', href: `#/fichiers?folder=${d.id}` });
  }
  if (!isHidden('preparer', 'jeux')) {
    for (const g of store.all('game')) if (match(g.title, g.subject, (g.items || []).map(i => `${i.a} ${i.b}`).join(' '))) out.push({ group: 'Jeux', title: g.title, detail: g.subject || '', href: `#/jeux/${g.id}` });
  }
  if (!isHidden('organisation', 'argent')) {
    for (const p of store.all('project')) if (match(p.title, p.kind, p.description)) out.push({ group: 'Projets', title: p.title, detail: p.kind, href: `#/argent/projet/${p.id}` });
  }
  if (!isHidden('organisation', 'materiel')) {
    for (const m of store.all('material')) if (match(m.name, m.category, m.location)) out.push({ group: 'Matériel', title: m.name, detail: [m.category, m.location].filter(Boolean).join(' · '), href: '#/materiel' });
  }
  if (!isHidden('organisation', 'reception')) {
    for (const i of store.all('inbox')) if (match(i.title, i.text, i.name)) out.push({ group: 'Boîte de réception', title: i.title || i.name || (i.text || '').slice(0, 60), detail: i.status, href: '#/reception' });
  }
  const prep = [
    ['programmes', 'referential', 'Référentiels', r => [r.name, r.source, (r.items || []).map(i => `${i.code} ${i.label}`).join(' ')], r => r.name, r => `v${r.version} · ${r.status}`, r => `#/referentiels/${r.id}`],
    ['programmations', 'programmation', 'Programmations', r => [r.subject, r.level, (r.subdomains || []).join(' '), r.references], r => `Programmation ${r.subject} ${r.level}`, r => store.get(r.classId)?.name || '', r => `#/programmation/${r.id}`],
    ['programmations', 'notion', 'Notions', r => [r.title, r.subdomain, r.competences, r.resources], r => r.title, r => { const p = store.get(r.programmationId); return p ? `${p.subject} ${p.level}` : ''; }, r => `#/programmation/${r.programmationId}`],
    ['progressions', 'progression', 'Progressions', r => [r.subject, r.subdomain, (r.rows || []).map(x => `${x.title} ${x.objective} ${x.support}`).join(' ')], r => `Progression ${r.subject}`, r => r.level || '', r => `#/progression/${r.id}`],
    ['sequences', 'sequence', 'Séquences', r => [r.title, r.subject, r.subdomain, r.objectifGeneral, r.notionsVocab], r => P.sequenceTitle(r), r => r.subject || '', r => `#/sequence/${r.id}`],
    ['preparations', 'session', 'Fiches de séance', r => [r.title, r.subject, r.subdomain, r.objective, r.vocabulaire, r.trace, (r.phases || []).map(p => `${p.consigne || ''} ${p.exercices || ''}`).join(' ')], r => P.sessionTitle(r), r => r.subject || '', r => `#/seance/${r.id}`],
    ['manuels', 'manual', 'Manuels', r => [r.title, r.author, r.publisher, (r.pages || []).map(p => `${p.page} ${p.note}`).join(' ')], r => r.title, r => r.publisher || '', r => `#/manuels?open=${r.id}`],
    ['lecons', 'lesson', 'Leçons', r => [r.title, r.subject, r.content, `n° ${r.number}`], r => `${r.subject} n° ${r.number} — ${r.title}`, () => '', r => `#/lecons?open=${r.id}`],
  ];
  for (const [sub, type, group, fields, title, detail, href] of prep) {
    if (isHidden('preparer', sub)) continue;
    for (const r of store.all(type)) if (match(...fields(r))) out.push({ group, title: title(r), detail: detail(r), href: href(r) });
  }
  if (!isHidden('planifier', 'devoirs')) for (const r of store.all('homework')) if (match(r.title, r.details, r.subject)) out.push({ group: 'Devoirs', title: r.title, detail: `pour le ${model.frShort(r.dueDate)}`, href: '#/devoirs' });
  if (!isHidden('planifier', 'interventions')) for (const r of store.all('intervention')) if (match(r.title, r.place, r.notes)) out.push({ group: 'Interventions', title: r.title, detail: r.status, href: '#/interventions' });
  if (!isHidden('planifier', 'agenda')) for (const r of store.all('event')) if (match(r.title, r.notes, r.kind)) out.push({ group: 'Agenda', title: r.title, detail: model.frShort(r.date), href: `#/agenda?d=${r.date}` });
  if (!isHidden('aujourdhui', 'taches')) for (const r of store.all('task')) if (match(r.title, r.notes)) out.push({ group: 'Tâches', title: r.title, detail: r.done ? 'faite' : (r.due ? `pour le ${model.frShort(r.due)}` : ''), href: '#/taches' });
  if (!isHidden('planifier', 'cahier')) for (const r of store.all('occurrence')) if (match(r.note, r.title, ...Object.values(r.after || {}))) out.push({ group: 'Cahier journal', title: `${r.subject || 'Séance'} — ${r.title || (r.sessionId ? P.sessionTitle(store.get(r.sessionId)) : '')}`, detail: model.frShort(r.date), href: `#/cahier?d=${r.date}` });
  return out;
}
