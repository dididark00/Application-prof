// Dossiers à imprimer en un clic : pour la personne qui me remplace, et pour une visite (tuteur, inspection).
// Les informations sensibles (PAI, PAP, aménagements) ne figurent que si on les coche, pour cette impression.
import * as store from '../store.js';
import * as model from '../model.js';
import * as PL from '../planning.js';
import * as P from '../pedago.js';
import * as E from '../eleve.js';
import * as O from '../orga.js';
import { h, toast } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { bound } from '../forms.js';
import { printDocument } from '../print.js';
import { printSession, printSequence, printTimetable, printDay } from '../printdocs.js';

const head = (title, sub) => h('header', { class: 'print-head' }, h('h1', {}, title), sub ? h('p', {}, sub) : null);
const page = (node) => h('div', { class: 'page-break' }, node);
const sub = (cls) => store.get(cls.id)?.substitute || {};
const saveSub = (cls, patch) => store.update(cls.id, { substitute: { ...sub(cls), ...patch } }, 'Dossier remplaçant', { quiet: true });

/** Jours de classe entre deux dates. */
function schoolDays(cls, from, to) { const out = []; for (let d = from; d <= to && out.length < 15; d = model.addDays(d, 1)) if (PL.isSchoolDay(cls, d).ok) out.push(d); return out; }

export function substituteDossier(cls, { from, to, vigilance = false, fiches = true }) {
  const s = sub(cls);
  const year = store.get(cls.yearId);
  const students = model.studentsOfClass(cls.id, { date: from });
  const tt = PL.timetableForDate(cls, from);
  const days = schoolDays(cls, from, to);
  const teacher = [store.getSettings().userName, model.hasBinome(cls) ? cls.binome?.name : ''].filter(Boolean).join(' et ');
  const contacts = O.contacts().filter(c => c.phone || c.email).filter(c => !/famille|parent/i.test(c.role || ''));
  const kv = (l, v) => v ? h('tr', {}, h('th', {}, l), h('td', { class: 'pre' }, v)) : null;
  const accueil = h('div', { class: 'print-doc' }, head('Dossier pour la personne qui me remplace', `${cls.school || ''} · ${cls.name} · ${year?.label || ''}`),
    h('p', {}, `Merci de votre venue ! Ce dossier couvre ${days.length > 1 ? `du ${model.frDate(days[0])} au ${model.frDate(days.at(-1))}` : days[0] ? `le ${model.frDate(days[0])}` : 'les jours indiqués'}.`),
    h('table', { class: 'print-table kv' }, h('tbody', {},
      kv('Classe', `${cls.name} — ${(cls.levels || []).join(', ')} — ${students.length} élève(s)`),
      kv('Enseignante(s)', teacher),
      kv('Horaires', s.horaires),
      kv('Routines et rituels', s.routines),
      kv('Fonctionnement de la classe', s.consignes),
      kv('Sécurité (PPMS, évacuation, lieu de confinement)', s.securite),
      kv('Où trouver…', s.ouTrouver))),
    contacts.length ? [h('h2', { class: 'print-h2' }, 'Contacts utiles'), h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, ['Nom', 'Rôle', 'Téléphone', 'Email'].map(t => h('th', {}, t)))),
      h('tbody', {}, contacts.map(c => h('tr', {}, h('td', {}, c.name), h('td', {}, [c.role, c.classe].filter(Boolean).join(' · ')), h('td', {}, c.phone || ''), h('td', {}, c.email || '')))))] : null);
  const vig = vigilance ? students.map(({ student: st }) => ({ st, plans: E.of('plan', st.id).filter(p => p.status !== 'terminé'), needs: E.of('need', st.id) })).filter(x => x.plans.length || x.needs.length) : [];
  const liste = h('div', { class: 'print-doc' }, head('Liste de la classe', cls.name),
    h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, ['Nom', 'Prénom', 'Niveau', 'Remarques'].map(t => h('th', {}, t)))),
      h('tbody', {}, students.map(({ student: st, enrollment: en }) => h('tr', {}, h('td', {}, (st.lastName || '').toUpperCase()), h('td', {}, st.firstName), h('td', {}, en?.level || st.level || ''), h('td', {}, ''))))),
    vig.length ? [h('h2', { class: 'print-h2' }, 'Élèves à besoins particuliers (confidentiel)'),
      h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, ['Élève', 'Dispositif', 'À savoir'].map(t => h('th', {}, t)))),
        h('tbody', {}, vig.map(x => h('tr', {}, h('td', {}, `${x.st.firstName} ${x.st.lastName}`), h('td', {}, x.plans.map(p => p.kind).join(', ')),
          h('td', { class: 'pre' }, [...x.plans.map(p => [p.adaptations, p.schedule].filter(Boolean).join(' — ')), ...x.needs.map(n => n.category)].filter(Boolean).join('\n')))))),
      h('p', { class: 'small' }, 'Document confidentiel : à rendre à l’enseignante ou à la direction.')] : null);
  const parts = [accueil, liste];
  if (tt.timetable && tt.version) parts.push(printTimetable(tt.timetable, tt.version, cls));
  for (const d of days) parts.push(printDay(cls, d));
  if (fiches) {
    const ids = [...new Set(days.flatMap(d => PL.dayPlan(cls, d).entries.map(e => e.sessionId)).filter(id => id && store.get(id) && !store.get(id).deletedAt))];
    for (const id of ids) parts.push(printSession(id));
  }
  return h('div', { class: 'dossier', 'data-testid': 'dossier-remplacant' }, parts.map((p, i) => (i ? page(p) : p)));
}

export function visitDossier(cls, date, sessionId) {
  const s = store.get(sessionId);
  const parts = [printSession(sessionId)];
  if (s?.sequenceId && store.get(s.sequenceId)) parts.push(printSequence(s.sequenceId));
  const prog = s?.sequenceId ? P.ofClass('progression', cls.id).find(p => (p.rows || []).some(r => r.sequenceId === s.sequenceId)) : null;
  if (prog) {
    const rows = (prog.rows || []);
    const year = store.get(cls.yearId);
    parts.push(h('div', { class: 'print-doc' }, head(`Progression — ${prog.subject || ''}${prog.subdomain ? ` · ${prog.subdomain}` : ''} — ${model.periodLabel(year, prog.periodId)}`, cls.name),
      h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, ['Semaine', 'Séquence / contenu', 'Objectif', 'Statut'].map(t => h('th', {}, t)))),
        h('tbody', {}, rows.map(r => h('tr', { class: r.sequenceId === s.sequenceId ? 'prog-hl' : '' }, h('td', {}, r.week ? `S${r.week}` : ''),
          h('td', {}, r.sequenceId ? (P.sequenceTitle(store.get(r.sequenceId)) || '') : (r.title || '')), h('td', {}, r.objective || ''), h('td', {}, r.status || '')))))));
  }
  parts.push(printDay(cls, date));
  return h('div', { class: 'dossier', 'data-testid': 'dossier-visite' }, parts.map((p, i) => (i ? page(p) : p)));
}

let visitDate = null;
export function render({ query, rerender }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return h('div', { class: 'page' }, pageHeader('Dossiers à imprimer'), subTabs(), miss);
  const s = sub(cls);
  const today = model.todayIso();
  const next = schoolDays(cls, today, model.addDays(today, 30))[0] || today;
  const fromI = h('input', { type: 'date', value: next, 'data-testid': 'sub-from' });
  const toI = h('input', { type: 'date', value: next, 'data-testid': 'sub-to' });
  const vigI = h('input', { type: 'checkbox', 'data-testid': 'sub-vigilance' });
  const ficheI = h('input', { type: 'checkbox', checked: true });
  const field = (l, el) => h('label', { class: 'field' }, h('span', {}, l), el);

  const vd = /^\d{4}-\d{2}-\d{2}$/.test(query.d || '') ? query.d : (visitDate || today);
  const entries = PL.dayPlan(cls, vd).entries.filter(e => e.sessionId && store.get(e.sessionId));
  const sessSel = h('select', { 'data-testid': 'visit-session', 'aria-label': 'Séance observée' }, entries.length ? entries.map(e => h('option', { value: e.sessionId, selected: query.s === e.sessionId }, `${e.start} · ${e.title}`)) : h('option', { value: '' }, 'Aucune séance avec fiche ce jour-là'));
  if (query.s && !entries.some(e => e.sessionId === query.s) && store.get(query.s)) sessSel.prepend(h('option', { value: query.s, selected: true }, P.sessionTitle(store.get(query.s))));

  return h('div', { class: 'page' },
    pageHeader('Dossiers à imprimer', { favKey: 'orga/dossiers', subtitle: cls.name }),
    subTabs(),
    h('section', { class: 'card', 'data-testid': 'card-remplacant' },
      h('h2', {}, 'Dossier pour la personne qui me remplace'),
      h('p', { class: 'muted small' }, 'Fiche d’accueil, contacts utiles, liste de la classe, emploi du temps, cahier journal des jours choisis et fiches de séance. Les textes ci-dessous sont gardés pour la prochaine fois.'),
      h('div', { class: 'grid-2' },
        bound({ label: 'Horaires (entrées, récréations, sorties)', type: 'textarea', value: s.horaires, onSave: (v) => saveSub(cls, { horaires: v }) }),
        bound({ label: 'Routines et rituels', type: 'textarea', value: s.routines, onSave: (v) => saveSub(cls, { routines: v }), testid: 'sub-routines' }),
        bound({ label: 'Fonctionnement de la classe (règles, rangs, cantine, toilettes…)', type: 'textarea', value: s.consignes, onSave: (v) => saveSub(cls, { consignes: v }) }),
        bound({ label: 'Sécurité (PPMS, évacuation, lieu de confinement)', type: 'textarea', value: s.securite, onSave: (v) => saveSub(cls, { securite: v }) }),
        bound({ label: 'Où trouver… (clés, matériel, cahiers)', type: 'textarea', value: s.ouTrouver, onSave: (v) => saveSub(cls, { ouTrouver: v }) })),
      h('div', { class: 'row wrap' }, field('Du', fromI), field('Au', toI)),
      h('label', { class: 'inline' }, ficheI, 'Joindre les fiches de séance de ces jours'),
      h('label', { class: 'inline' }, vigI, 'Ajouter les élèves à besoins particuliers (PAI, PAP, PPS, aménagements) — confidentiel, seulement pour cette impression'),
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'print-remplacant', onclick: () => {
        if (!fromI.value || !toI.value || fromI.value > toI.value) return toast('Vérifiez les dates.');
        printDocument(substituteDossier(store.get(cls.id), { from: fromI.value, to: toI.value, vigilance: vigI.checked, fiches: ficheI.checked }));
      } }, 'Imprimer le dossier remplaçant')),
    h('section', { class: 'card', 'data-testid': 'card-visite' },
      h('h2', {}, 'Dossier de visite (tuteur, inspection)'),
      h('p', { class: 'muted small' }, 'Fiche de la séance observée, fiche de la séquence, progression (la séquence surlignée) et cahier journal du jour, dans le style de vos modèles.'),
      h('div', { class: 'row wrap' },
        field('Jour de la visite', h('input', { type: 'date', value: vd, 'data-testid': 'visit-date', onchange: (e) => { visitDate = e.target.value; location.hash = `#/dossiers?d=${e.target.value}`; } })),
        field('Séance observée', sessSel)),
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'print-visite', onclick: () => {
        if (!sessSel.value) return toast('Choisissez un jour où une séance a une fiche.');
        printDocument(visitDossier(cls, vd, sessSel.value), { orientation: 'landscape' });
      } }, 'Imprimer le dossier de visite')),
    h('p', { class: 'muted small' }, 'Pour un PDF : « Enregistrer au format PDF » dans la fenêtre d’impression.'));
  void rerender;
}
