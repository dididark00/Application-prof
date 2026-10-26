// Ma classe › Radar : repère tôt un élève qui cumule plusieurs signaux sur les 3 dernières semaines
// (absences non justifiées, retards, carnet : comportement / travail non fait / oublis, évaluations
// « non acquis », observations « difficulté »). C'est une aide au regard, jamais un jugement :
// rien n'est montré ailleurs (ni projection, ni familles), et chaque signal renvoie à sa source.
import * as store from '../store.js';
import * as model from '../model.js';
import { h, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';

let span = 21;
const NEG = ['comportement', 'travail', 'oubli', 'retard'];

/** Signaux d'un élève sur [from, to]. */
export function signals(cls, sid, from, to) {
  const out = { absences: 0, retards: 0, carnet: 0, evals: 0, obs: 0, felicitations: 0, detail: [] };
  for (const a of store.all('attendance').filter(x => x.classId === cls.id && x.date >= from && x.date <= to)) {
    const m = a.marks?.[sid]; if (!m) continue;
    if (m.status === 'absent' && !['motif légitime', 'autre motif'].includes(m.justif)) { out.absences++; out.detail.push([a.date, `absence non justifiée (${a.half})`, `#/registre?m=${a.date.slice(0, 7)}&t=absences`]); }
    if (m.status === 'retard') { out.retards++; out.detail.push([a.date, `retard${m.time ? ' ' + m.time : ''}`, `#/registre?m=${a.date.slice(0, 7)}&t=absences`]); }
  }
  for (const c of store.all('carnet').filter(x => x.studentId === sid && x.date >= from && x.date <= to)) {
    if (NEG.includes(c.category)) { out.carnet++; out.detail.push([c.date, `carnet : ${c.category}${c.text ? ' — ' + c.text : ''}`, `#/messages?e=${sid}`]); }
    if (c.category === 'felicitations') out.felicitations++;
  }
  for (const ev of store.all('evaluation').filter(x => x.classId === cls.id && x.date >= from && x.date <= to)) {
    const r = ev.results?.[sid]; if (!r || r.absent) continue;
    const na = Object.values(r.items || {}).filter(i => i.level === 'NA').length;
    if (na) { out.evals += na; out.detail.push([ev.date, `${na} item(s) non acquis — ${ev.title}`, `#/evaluations/${ev.id}`]); }
  }
  for (const o of store.all('observation').filter(x => x.studentId === sid && (x.date || x.createdAt || '').slice(0, 10) >= from && (x.date || x.createdAt || '').slice(0, 10) <= to)) {
    if (o.kind === 'difficulté' || o.kind === 'comportement') { out.obs++; out.detail.push([(o.date || o.createdAt).slice(0, 10), `observation : ${o.kind}${o.text ? ' — ' + o.text.slice(0, 60) : ''}`, `#/eleve/${sid}?t=suivi`]); }
  }
  out.detail.sort((a, b) => b[0].localeCompare(a[0]));
  const cats = ['absences', 'retards', 'carnet', 'evals', 'obs'].filter(k => out[k] > 0);
  out.total = out.absences + out.retards + out.carnet + out.evals + out.obs;
  out.cats = cats.length;
  // À regarder : au moins 3 signaux venant d'au moins 2 sources différentes (ou 5 d'une seule).
  out.flag = (out.total >= 3 && cats.length >= 2) || out.total >= 5;
  return out;
}
export function radar(cls, days = 21, today = model.todayIso()) {
  const from = model.addDays(today, -days + 1);
  return model.studentsOfClass(cls.id, { date: today }).map(({ student: s }) => ({ s, ...signals(cls, s.id, from, today) }));
}

export function render({ rerender }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return h('div', { class: 'page' }, pageHeader('Radar'), subTabs(), miss);
  const rows = radar(cls, span).sort((a, b) => b.flag - a.flag || b.total - a.total);
  const flagged = rows.filter(r => r.flag);
  const cell = (n, kind = 'warn') => h('td', {}, n ? badge(String(n), kind) : '');
  return h('div', { class: 'page' },
    pageHeader('Radar élèves', { favKey: 'classe/radar', subtitle: `${cls.name} · ${span} derniers jours` }),
    subTabs(),
    h('p', { class: 'muted' }, 'Croise ce qui est déjà noté (registre d’appel, carnet de liaison, évaluations, observations) pour repérer tôt un élève qui cumule les difficultés. Un élève est « à regarder » à partir de 3 signaux de 2 sources différentes (ou 5 d’une seule). C’est une aide au regard : rien n’est montré aux élèves ni aux familles.'),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Durée' }, [[14, '2 semaines'], [21, '3 semaines'], [42, '6 semaines']].map(([d, l]) => h('button', { type: 'button', class: span === d ? 'on' : '', onclick: () => { span = d; rerender(); } }, l))),
    flagged.length ? h('section', { class: 'card stack', 'data-testid': 'radar-flagged' }, h('h2', {}, `À regarder (${flagged.length})`),
      flagged.map(r => h('details', { class: 'radar-item' }, h('summary', {}, h('strong', {}, `${r.s.firstName} ${r.s.lastName || ''}`), ' ',
        [['absences', 'absence(s)'], ['retards', 'retard(s)'], ['carnet', 'carnet'], ['evals', 'non acquis'], ['obs', 'observation(s)']].filter(([k]) => r[k]).map(([k, l]) => badge(`${r[k]} ${l}`, 'warn')), r.felicitations ? badge(`${r.felicitations} félicitation(s)`, 'ok') : null),
        h('ul', { class: 'small' }, r.detail.slice(0, 12).map(([d, t, href]) => h('li', {}, `${model.frShort(d)} : `, h('a', { href }, t)))),
        h('p', { class: 'small muted' }, 'Pistes : en parler avec l’élève, rencontrer la famille (Familles › Rendez-vous), en discuter en conseil de cycle ou avec le RASED, envisager une aide (Ma classe › Différenciation, Rattrapage).'),
        h('a', { class: 'btn btn-small', href: `#/eleve/${r.s.id}` }, 'Fiche de l’élève'))))
      : emptyState('Aucun élève à regarder', 'Personne ne cumule plusieurs signaux sur cette durée.'),
    h('section', { class: 'card' }, h('h2', {}, 'Tous les élèves'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table', 'data-testid': 'radar-table' },
        h('thead', {}, h('tr', {}, ['Élève', 'Absences non justifiées', 'Retards', 'Carnet', 'Non acquis', 'Observations', 'Félicitations'].map(t => h('th', {}, t)))),
        h('tbody', {}, rows.map(r => h('tr', { class: r.flag ? 'row-warn' : '' }, h('td', {}, h('a', { href: `#/eleve/${r.s.id}` }, `${r.s.firstName} ${r.s.lastName || ''}`)),
          cell(r.absences), cell(r.retards), cell(r.carnet), cell(r.evals), cell(r.obs), cell(r.felicitations, 'ok'))))))));
}
