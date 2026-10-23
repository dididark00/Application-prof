// Dossiers imprimables personnalisables : remplacement et visite.
// Chaque rubrique vient des données existantes (EDT, cahier journal, élèves, plan, responsabilités,
// devoirs, contacts) ou d'un texte libre propre au dossier. Rien n'est ressaisi.
// Les informations confidentielles (besoins particuliers, notes) ne sont jamais ajoutées
// automatiquement : la rubrique « à savoir » est rédigée par l'enseignante.
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import * as O from '../orga.js';
import * as V from '../vie.js';
import { h, icon, field, badge } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { bound } from '../forms.js';
import { printDocument } from '../print.js';
import { printDay, printSession, printSequence } from '../printdocs.js';
import { svgPlan } from './plan.js';
import { currentAssignment } from './responsabilites.js';

const KINDS = { remplacement: 'Dossier de remplacement', visite: 'Dossier de visite' };
// [id, libellé, source, inclus par défaut]
const SECTIONS = {
  remplacement: [
    ['classe', 'Classe, horaires et équipe', 'auto', true],
    ['routines', 'Rituels et fonctionnement de la classe', 'texte', true],
    ['jours', 'Cahier journal des jours choisis', 'auto', true],
    ['eleves', 'Liste des élèves et départs du soir', 'auto', true],
    ['autorises', 'Personnes autorisées à venir chercher les élèves', 'auto', false],
    ['asavoir', 'À savoir sur certains élèves (rédigé par vous)', 'texte', true],
    ['plan', 'Plan de classe', 'auto', true],
    ['responsabilites', 'Responsabilités des élèves', 'auto', true],
    ['devoirs', 'Devoirs à venir', 'auto', true],
    ['materiel', 'Où trouver le matériel', 'texte', true],
    ['securite', 'Sécurité (PPMS, exercices, infirmerie, PAI : emplacement des trousses)', 'texte', true],
    ['contacts', 'Contacts utiles de l’école', 'auto', true],
    ['libre', 'Autres consignes', 'texte', false],
  ],
  visite: [
    ['classe', 'Classe, horaires et équipe', 'auto', true],
    ['effectif', 'Effectif et niveaux (sans nom)', 'auto', true],
    ['jours', 'Cahier journal du jour de la visite', 'auto', true],
    ['seance', 'Fiche de séance observée', 'auto', true],
    ['sequence', 'Fiche de la séquence', 'auto', true],
    ['plan', 'Plan de classe', 'auto', false],
    ['contexte', 'Contexte de la classe et choix pédagogiques', 'texte', true],
    ['libre', 'Autres éléments', 'texte', false],
  ],
};

let kind = 'remplacement';

function recOf(cls, k) { return store.all('dossier').find(d => d.classId === cls.id && d.kind === k) || null; }
async function ensure(cls, k) {
  return recOf(cls, k) || store.create('dossier', { classId: cls.id, kind: k, sections: SECTIONS[k].filter(s => s[3]).map(s => s[0]), texts: {}, from: '', to: '', sessionId: '' }, `${KINDS[k]} créé`);
}

export function render({ rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Dossiers remplacement et visite'), subTabs(), missing);
  const rec = recOf(cls, kind);
  if (!rec) { ensure(cls, kind); return h('div', { class: 'page' }, pageHeader(KINDS[kind])); }
  const up = (patch, label, quiet = true) => store.update(rec.id, patch, label, { quiet });
  const on = new Set(rec.sections || []);
  const sessions = P.ofClass('session', cls.id);
  const nextDay = nextClassDay(cls);
  return h('div', { class: 'page' },
    pageHeader('Dossiers remplacement et visite', { favKey: 'organisation/remplacement', subtitle: cls.name,
      actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'dossier-print', onclick: () => printDocument(build(cls, store.get(rec.id))) }, icon('print', 16), 'Imprimer le dossier')] }),
    subTabs(),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Dossier' }, Object.entries(KINDS).map(([k, l]) => h('button', { type: 'button', class: kind === k ? 'on' : '', 'data-testid': `dossier-${k}`, onclick: () => { kind = k; rerender(); } }, l))),
    h('section', { class: 'card form' }, h('h2', {}, 'Jours concernés'),
      h('div', { class: 'grid-3' },
        bound({ label: kind === 'visite' ? 'Jour de la visite' : 'Du', type: 'date', value: rec.from || nextDay, testid: 'dossier-from', onSave: (v) => up({ from: v }, 'Dates du dossier') }),
        kind === 'remplacement' ? bound({ label: 'Au', type: 'date', value: rec.to || rec.from || nextDay, onSave: (v) => up({ to: v }, 'Dates du dossier') }) : null,
        kind === 'visite' ? bound({ label: 'Séance observée', type: 'select', value: rec.sessionId, options: [['', '—'], ...sessions.map(s => [s.id, `${s.subject ? s.subject + ' — ' : ''}${P.sessionTitle(s)}`])], onSave: (v) => up({ sessionId: v }, 'Séance du dossier de visite', false) }) : null)),
    h('section', { class: 'card' }, h('h2', {}, 'Rubriques'),
      h('p', { class: 'muted small' }, 'Cochez ce qui doit figurer dans le dossier. Les rubriques « auto » reprennent les données de l’application à la date d’impression ; les autres se rédigent ici et sont gardées pour la prochaine fois.'),
      h('div', { class: 'stack' }, SECTIONS[kind].map(([id, label, src]) => h('div', { 'data-testid': `sec-${id}` },
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: on.has(id), onchange: (e) => { const s = new Set(store.get(rec.id).sections || []); e.target.checked ? s.add(id) : s.delete(id); up({ sections: SECTIONS[kind].map(x => x[0]).filter(x => s.has(x)) }, 'Rubriques du dossier'); } }), label, ' ', badge(src === 'auto' ? 'auto' : 'texte', src === 'auto' ? 'info' : 'muted')),
        src === 'texte' ? bound({ value: rec.texts?.[id], testid: `txt-${id}`, onSave: (v) => up({ texts: { ...(store.get(rec.id).texts || {}), [id]: v } }, `Dossier : ${label}`) }) : null)))),
    h('p', { class: 'muted small' }, 'Aucune information des zones confidentielles (besoins particuliers, PAP/PPS, notes privées) n’est ajoutée automatiquement.'));
}

function nextClassDay(cls) { let d = model.todayIso(); for (let i = 0; i < 10; i++) { d = model.addDays(d, 1); if (model.classDays(cls).includes(model.weekday(d))) return d; } return d; }
function datesBetween(cls, a, b) { const out = []; let d = a; let g = 0; while (d <= (b || a) && g++ < 40) { if (model.classDays(cls).includes(model.weekday(d))) out.push(d); d = model.addDays(d, 1); } return out; }
const H2 = (t) => h('h2', { class: 'dossier-h' }, t);

/** Construit le document imprimable à partir des rubriques cochées. */
export function build(cls, rec) {
  const from = rec.from || nextClassDay(cls);
  const days = rec.kind === 'visite' ? [from] : datesBetween(cls, from, rec.to || from);
  const students = model.studentsOfClass(cls.id, { date: from });
  const txt = (id) => rec.texts?.[id] ? h('p', { class: 'pre' }, rec.texts[id]) : h('p', { class: 'muted' }, '—');
  const parts = [];
  for (const id of rec.sections || []) {
    const label = SECTIONS[rec.kind].find(s => s[0] === id)?.[1] || id;
    if (id === 'classe') {
      const hd = (half) => { const t = V.halfTimes(cls, half); return `${t.start}–${t.end}`; };
      parts.push(H2(label), h('ul', {},
        h('li', {}, `${cls.name}${cls.school ? ' — ' + cls.school : ''} · ${model.sortLevels(cls.levels || []).join(', ')}`),
        h('li', {}, `Jours de classe : ${model.classDays(cls).map(d => model.JOURS[d]).join(', ')} · matin ${hd('matin')}, après-midi ${hd('après-midi')}`),
        h('li', {}, `Enseignante : ${store.getSettings().userName || '—'}${model.hasBinome(cls) && cls.binome?.name ? ` · binôme : ${cls.binome.name}${cls.binome.detail ? ' (' + cls.binome.detail + ')' : ''}` : ''}`),
        h('li', {}, `${students.length} élève(s)`)));
    } else if (id === 'effectif') {
      const by = {}; for (const x of students) by[x.enrollment?.level || '?'] = (by[x.enrollment?.level || '?'] || 0) + 1;
      parts.push(H2(label), h('p', {}, `${students.length} élèves : ${Object.entries(by).map(([l, n]) => `${n} en ${l}`).join(', ')}`));
    } else if (id === 'jours') {
      parts.push(H2(label), ...days.map(d => printDay(cls, d)));
    } else if (id === 'eleves' || id === 'autorises') {
      const rows = students.map(({ student: s, enrollment: e }) => {
        const dep = V.departureOn(cls, s, from);
        return h('tr', {}, h('td', {}, `${(s.lastName || '').toUpperCase()} ${s.firstName}`), (cls.levels || []).length > 1 ? h('td', {}, e?.level || '') : null,
          id === 'eleves' ? h('td', {}, [dep.exception?.mode || dep.usual, dep.exception?.note || dep.usualNote].filter(Boolean).join(' — ')) : h('td', {}, (s.contacts || []).filter(c => c.pickup).map(c => `${c.name}${c.relation ? ' (' + c.relation + ')' : ''}`).join(', ')));
      });
      parts.push(H2(label), h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Élève'), (cls.levels || []).length > 1 ? h('th', {}, 'Niveau') : null, h('th', {}, id === 'eleves' ? 'Départ du soir' : 'Personnes autorisées'))), h('tbody', {}, rows)));
    } else if (id === 'plan') {
      const lay = store.all('layout').filter(l => l.classId === cls.id).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')).at(-1);
      parts.push(H2(label), lay ? h('div', { class: 'dossier-plan' }, svgPlan(lay, cls)) : h('p', { class: 'muted' }, 'Aucun plan de classe enregistré.'));
    } else if (id === 'responsabilites') {
      const rec2 = store.all('jobs').find(j => j.classId === cls.id);
      const cur = currentAssignment(rec2, from);
      parts.push(H2(label), rec2 && cur ? h('ul', {}, rec2.jobs.map(j => h('li', {}, `${j.label} : ${(cur.map?.[j.id] || []).map(id2 => store.get(id2)?.firstName).filter(Boolean).join(', ') || '—'}`))) : h('p', { class: 'muted' }, '—'));
    } else if (id === 'devoirs') {
      const hw = P.ofClass('homework', cls.id).filter(x => x.dueDate >= from).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 15);
      parts.push(H2(label), hw.length ? h('ul', {}, hw.map(x => h('li', {}, `Pour le ${model.frShort(x.dueDate)} : ${x.title}${x.subject ? ' (' + x.subject + ')' : ''}`))) : h('p', { class: 'muted' }, 'Aucun devoir prévu.'));
    } else if (id === 'contacts') {
      const cs = O.contacts().filter(c => ['direction', 'collègue', 'ATSEM', 'AESH', 'infirmière / médecin scolaire', 'RASED', 'mairie / périscolaire'].includes(c.role));
      parts.push(H2(label), cs.length ? h('table', { class: 'print-table' }, h('tbody', {}, cs.map(c => h('tr', {}, h('td', {}, c.name), h('td', {}, c.role), h('td', {}, [c.phone, c.availability].filter(Boolean).join(' · ')))))) : h('p', { class: 'muted' }, 'Aucun contact (Organisation › Contacts).'));
    } else if (id === 'seance') {
      parts.push(rec.sessionId && store.get(rec.sessionId) ? printSession(rec.sessionId) : [H2(label), h('p', { class: 'muted' }, 'Aucune séance choisie.')]);
    } else if (id === 'sequence') {
      const s = rec.sessionId && store.get(rec.sessionId);
      parts.push(s?.sequenceId && store.get(s.sequenceId) ? printSequence(s.sequenceId) : [H2(label), h('p', { class: 'muted' }, 'La séance n’est pas rattachée à une séquence.')]);
    } else parts.push(H2(label), txt(id));
  }
  return h('div', { class: 'print-doc', 'data-testid': 'dossier-doc' },
    h('div', { class: 'print-head' }, h('h1', {}, `${KINDS[rec.kind]} — ${cls.name}`),
      h('p', {}, rec.kind === 'visite' ? model.frDate(from, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : `Du ${model.frDate(from)} au ${model.frDate(rec.to || from)}`)),
    parts);
}
