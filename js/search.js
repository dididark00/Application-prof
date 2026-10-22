// Recherche globale. Règle : seuls les modules visibles sont interrogés, et
// les données sensibles (coordonnées des familles) ne sont pas indexées.
import * as store from './store.js';
import * as model from './model.js';
import { allPages, isHidden } from './router.js';

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
    for (const f of store.all('file')) if (match(f.name, (f.tags || []).join(' '), f.description, f.subject, f.level, f.project)) out.push({ group: 'Fichiers', title: f.name, detail: [f.kind === 'link' ? 'lien' : 'fichier', f.subject, f.level].filter(Boolean).join(' · '), href: `#/fichiers?open=${f.id}` });
    for (const d of store.all('folder')) if (match(d.name)) out.push({ group: 'Fichiers', title: d.name, detail: 'dossier', href: `#/fichiers?folder=${d.id}` });
  }
  if (!isHidden('organisation', 'reception')) {
    for (const i of store.all('inbox')) if (match(i.title, i.text, i.name)) out.push({ group: 'Boîte de réception', title: i.title || i.name || (i.text || '').slice(0, 60), detail: i.status, href: '#/reception' });
  }
  return out;
}
