// Vue d'ensemble de la différenciation : niveaux par domaine, aides en cours,
// adaptations prévues dans les prochaines séances. Les dispositifs (PPRE, PAP…) restent confidentiels.
import * as store from '../store.js';
import * as model from '../model.js';
import * as E from '../eleve.js';
import * as PL from '../planning.js';
import * as C from '../confidential.js';
import { h, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';

export function render({ rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Différenciation'), subTabs(), missing);
  const today = model.todayIso();
  const students = model.studentsOfClass(cls.id);
  const upcoming = [];
  for (let k = 0; k < 14; k++) { const d = model.addDays(today, k); for (const e of PL.dayPlan(cls, d).entries) if (e.session?.adaptations?.length && e.status === 'prévue') upcoming.push({ d, e }); }
  return h('div', { class: 'page' },
    pageHeader('Différenciation', { favKey: 'classe/differenciation', subtitle: cls.name }),
    subTabs(),
    h('section', { class: 'card' }, h('h2', {}, 'Adaptations prévues (14 prochains jours)'),
      upcoming.length ? h('ul', { class: 'plain' }, upcoming.map(({ d, e }) => h('li', {}, h('a', { href: `#/seance/${e.session.id}` }, `${model.frShort(d)} ${e.start} — ${e.title}`), ' : ',
        e.session.adaptations.map(a => (a.studentIds || []).map(id => store.get(id)?.firstName).filter(Boolean).join(', ')).join(' / ')))) : h('p', { class: 'muted' }, 'Aucune adaptation dans les séances programmées. Elles se saisissent dans chaque fiche de séance.')),
    h('section', { class: 'card' }, h('h2', {}, 'Repères par élève'),
      students.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['Élève', 'Niveaux par domaine (derniers repères)', 'Aides en cours'].map(t => h('th', {}, t)))),
        h('tbody', {}, students.map(({ student: s }) => {
          const lv = Object.values(E.latestLevels(s.id)); const aids = E.of('aid', s.id).filter(a => a.active !== false);
          return h('tr', {}, h('td', {}, h('a', { href: `#/eleve/${s.id}?t=suivi` }, `${s.firstName} ${s.lastName}`)),
            h('td', {}, lv.length ? lv.map(l => badge(`${l.domain} : ${l.level}`, E.LEVEL_KIND[l.level])) : h('span', { class: 'muted' }, '—')),
            h('td', {}, aids.length ? aids.map(a => badge(`${a.label}${a.effects?.at(-1) ? ' · ' + a.effects.at(-1).effect : ''}`, 'info')) : h('span', { class: 'muted' }, '—')));
        })))) : emptyState('Aucun élève')),
    h('section', { class: 'card' }, h('h2', {}, 'Dispositifs et créneaux d’accompagnement'),
      C.gate(() => {
        const plans = students.flatMap(({ student: s }) => E.of('plan', s.id).filter(p => p.status !== 'terminé').map(p => ({ s, p })));
        return plans.length ? h('ul', { class: 'plain' }, plans.map(({ s, p }) => h('li', {}, h('a', { href: `#/eleve/${s.id}?t=besoins` }, `${s.firstName} ${s.lastName}`), ` : ${p.kind} (${p.status})${p.schedule ? ` — ${p.schedule}` : ''}`))) : h('p', { class: 'muted' }, 'Aucun dispositif en cours.');
      }, rerender)));
}
