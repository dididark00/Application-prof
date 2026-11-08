// Assistant de rentrée : les étapes dans l'ordre, cochées d'après les données réelles de l'année choisie.
// Chaque étape mène à la page où l'on agit ; rien n'est créé ni modifié depuis cet écran.
import * as store from '../store.js';
import * as model from '../model.js';
import * as O from '../orga.js';
import * as E from '../eleve.js';
import { h } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { safetyStatus } from './securite.js';

const real = (t, f) => store.all(t).some(x => !x.deletedAt && !x.demo && f(x));

export function rentreeSteps(y, cls) {
  const ps = y ? model.periodsOf(y) : [];
  const students = cls ? model.studentsOfClass(cls.id, { includeFuture: true }) : [];
  const sids = new Set(students.map(x => x.student.id));
  const t = E.docTemplates().find(x => x.id === 'renseignements');
  const infos = cls && t ? students.filter(({ student: s }) => ['reçu', 'autorisé'].includes(E.docState(E.docOf(s.id, cls.yearId, t.id), t, model.todayIso()).status)).length : 0;
  const prev = cls ? store.all('class').filter(c => c.id !== cls.id && !c.deletedAt && store.get(c.yearId)?.start < (y?.start || '')).length : 0;
  const fire = y ? safetyStatus(y).find(d => d.kind === 'incendie') : null;
  return [
    ['annee', 'Année scolaire, périodes et vacances', !!y && ps.length > 0, '#/reglages/annees', 'Dates de rentrée et de vacances (zone), jours fériés.'],
    ['service', 'Mon service (108 h) pour cette année', !!y?.h108?.profile, '#/heures', 'PES à 50 %, titulaire ou personnalisé : les compteurs repartent à zéro, l’historique reste.'],
    ['classe', 'Ma classe : niveaux, jours, binôme ou non', !!cls && !cls.demo, '#/reglages/classes', 'Titulaire seule : désactivez la binôme dans la classe.'],
    ['eleves', 'La liste des élèves', !!cls && !cls.demo && students.length > 0, '#/eleves', 'À la main ou par import d’un tableau.'],
    ['reprise', 'Reprendre mes modèles de l’an dernier', !prev || (!!cls && (real('progression', x => x.classId === cls.id) || real('sequence', x => x.classId === cls.id))), '#/reglages/reprise', 'Programmations, séquences, leçons : copies indépendantes, sans élèves ni résultats.'],
    ['edt', 'L’emploi du temps', !!cls && real('timetable', t => t.classId === cls.id), '#/edt', 'Sert à préparer les semaines du cahier journal.'],
    ['progressions', 'Programmations et progressions', !!cls && (real('programmation', x => x.classId === cls.id) || real('progression', x => x.classId === cls.id)), '#/progressions', 'Au moins la première période.'],
    ['infos', 'Fiches de renseignements, assurances, autorisations', !!cls && students.length > 0 && infos >= students.length, '#/infos', `${infos}/${students.length} fiche(s) de renseignements notée(s).`],
    ['etiquettes', 'Étiquettes : porte-manteaux, cahiers, casiers', false, '#/etiquettes', 'À imprimer une fois la liste complète.'],
    ['securite', 'Premier exercice incendie (dans le mois de la rentrée)', !!fire && (fire.done.length > 0 || fire.planned.length > 0), '#/securite', 'À prévoir dès maintenant dans l’agenda.'],
    ['semaine', 'Préparer la première semaine du cahier journal', !!cls && !cls.demo && Object.keys(cls.weekMode || {}).some(m => m >= (ps[0]?.start ? model.mondayOf(ps[0].start) : '')), `#/cahier?d=${ps[0]?.start || model.todayIso()}&v=semaine`, 'Emploi du temps et progressions pré-remplissent la semaine.'],
    ['sauvegarde', 'Sauvegarde et synchronisation', !!store.getSettings().lastBackupAt && new Date(store.getSettings().lastBackupAt) >= new Date(y?.start || 0), '#/reglages/sauvegarde', 'Une première sauvegarde de la nouvelle année.'],
  ].map(([id, title, ok, href, hint]) => ({ id, title, ok, href, hint, sids }));
}

let done = {}; // étapes cochées à la main (étiquettes…), mémorisées dans l'année
export function render() {
  const y = model.currentYear(); const cls = model.currentClass();
  done = y?.rentreeDone || {};
  const steps = rentreeSteps(y, cls).map(s => ({ ...s, ok: s.ok || !!done[s.id] }));
  const n = steps.filter(s => s.ok).length;
  const toggle = (id) => store.update(y.id, { rentreeDone: { ...(y.rentreeDone || {}), [id]: !done[id] } }, 'Assistant de rentrée');
  return h('div', { class: 'page' },
    pageHeader('Assistant de rentrée', { favKey: 'aujourdhui/rentree', subtitle: y ? `${y.label}${cls ? ` · ${cls.name}` : ''}` : 'aucune année' }),
    subTabs(),
    h('p', { class: 'muted' }, 'Les étapes de la rentrée dans l’ordre. Elles se cochent d’après ce que vous avez fait ; celles qui ne se vérifient pas (étiquettes…) se cochent à la main. Nouvelle année : créez-la d’abord, puis choisissez-la en haut de l’écran.'),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, n === steps.length ? '♡ Rentrée prête' : `${n}/${steps.length} étapes faites`),
        h('span', { class: 'cj-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': steps.length, 'aria-valuenow': n, 'aria-label': 'Étapes faites' }, h('span', { style: { width: `${Math.round(n / steps.length * 100)}%` } }))),
      h('ol', { class: 'bl-steps', 'data-testid': 'rentree-steps' }, steps.map((s, i) => h('li', { class: `bl-step ${s.ok ? 'ok' : 'todo'}`, 'data-testid': 'rentree-step', 'data-state': s.ok ? 'ok' : 'todo' },
        h('span', { class: 'bl-mark', 'aria-hidden': 'true' }, s.ok ? '♡' : String(i + 1)),
        h('div', { class: 'bl-body' }, h('strong', {}, s.title), h('div', { class: 'small muted' }, s.hint)),
        h('span', { class: 'row' }, h('a', { class: 'btn btn-small', href: s.href }, s.ok ? 'Voir' : 'Faire'),
          ['etiquettes', 'reprise', 'infos'].includes(s.id) && y ? h('label', { class: 'inline small' }, h('input', { type: 'checkbox', checked: !!done[s.id], 'data-testid': `rentree-manual-${s.id}`, onchange: () => toggle(s.id) }), 'fait') : null))))),
    h('p', { class: 'muted small' }, `Profil 108 h de l’année : ${y ? O.H108_PROFILES[O.h108Profile(y)].label : '—'}.`));
}
