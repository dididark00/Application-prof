import * as store from '../store.js';
import * as model from '../model.js';
import { h, icon, badge } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { allPages } from '../router.js';
import * as PL from '../planning.js';
import { taskDialog } from './agenda.js';

export function render() {
  const s = store.getSettings();
  const today = model.todayIso();
  const y = model.currentYear();
  const cls = model.currentClass();
  const where = model.situate(y, today);
  let situation = 'Aucune année scolaire configurée';
  if (where.kind === 'period') {
    const week = Math.floor((new Date(today) - new Date(where.period.start)) / (7 * 86400000)) + 1;
    situation = `${where.period.name} · semaine ${week}`;
  } else if (where.kind === 'holidays') situation = `Vacances — reprise le ${model.frDate(where.before.start)} (${where.before.name})`;
  else if (where.kind === 'before') situation = `Avant la rentrée du ${model.frDate(where.next.start)}`;
  else if (where.kind === 'after') situation = 'Année scolaire terminée';
  const noSchool = (y?.noSchoolDays || []).find(d => d.date === today);

  const cards = [];
  const missing = needClass();
  if (missing) cards.push(missing);

  if (cls) {
    const actives = model.studentsOfClass(cls.id, { date: today });
    const soon = new Date(); soon.setDate(soon.getDate() + 30);
    const soonIso = model.todayIso(soon);
    const moves = model.enrollmentsOfClass(cls.id).flatMap(e => {
      const st = store.get(e.studentId); if (!st || st.deletedAt) return [];
      const r = [];
      if (e.start > today && e.start <= soonIso) r.push({ date: e.start, text: `Arrivée de ${st.firstName} ${st.lastName}`, id: st.id });
      if (e.end && e.end >= today && e.end <= soonIso) r.push({ date: e.end, text: `Dernier jour de ${st.firstName} ${st.lastName}`, id: st.id });
      return r;
    }).sort((a, b) => a.date.localeCompare(b.date));
    cards.push(h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, cls.name, cls.demo ? badge('Démo', 'demo') : null), h('a', { class: 'btn btn-small', href: '#/eleves' }, 'Élèves')),
      h('p', { class: 'big-number' }, String(actives.length), h('span', {}, ' élève(s) inscrit(s) aujourd’hui')),
      h('p', { class: 'muted' }, [(cls.levels || []).join(', '), model.cycleLabel(cls.levels), cls.service?.type, cls.binome?.name ? `binôme : ${cls.binome.name}` : null].filter(Boolean).join(' · ')),
      moves.length ? h('div', {}, h('h3', {}, 'Dans les 30 prochains jours'), h('ul', {}, moves.map(m => h('li', {}, `${model.frDate(m.date, { day: 'numeric', month: 'long' })} : `, h('a', { href: `#/eleve/${m.id}` }, m.text))))) : null));
  }

  if (cls) {
    const plan = PL.dayPlan(cls, today);
    cards.unshift(h('section', { class: 'card', 'data-testid': 'today-plan' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Ma journée'), h('a', { class: 'btn btn-small', href: `#/cahier?d=${today}` }, 'Cahier journal')),
      !plan.school.ok ? h('p', { class: 'muted' }, plan.school.reason) : !plan.myDay ? h('p', { class: 'muted' }, `Jour de classe de ${cls.binome?.name || 'la binôme'}.`) : null,
      plan.warnings.length ? h('p', { class: 'warn' }, `${plan.warnings.length} conflit(s) à régler dans le cahier journal.`) : null,
      plan.entries.length ? h('ul', { class: 'today-list' }, plan.entries.map(e => h('li', { class: `status-${e.status}` },
        h('span', { class: 'entry-time' }, e.allDay ? 'Journée' : e.start), h('span', { class: 'dot', style: { background: model.subjectColor(e.subject) } }),
        e.session ? h('a', { href: `#/seance/${e.session.id}` }, e.title) : h('span', {}, e.title), e.status !== 'prévue' ? h('span', { class: 'muted small' }, ` · ${e.status}`) : null)))
        : (plan.school.ok ? h('p', { class: 'muted' }, 'Aucun créneau : créez l\u2019emploi du temps dans Planifier.') : null)));
    const tomorrow = model.addDays(today, 1);
    const hw = store.all('homework').filter(x => x.classId === cls.id && (x.dueDate === today || x.dueDate === tomorrow));
    if (hw.length) cards.push(h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Devoirs'), h('a', { class: 'btn btn-small', href: '#/devoirs' }, 'Tous')),
      h('ul', { class: 'plain' }, hw.map(x => h('li', {}, h('strong', {}, x.dueDate === today ? 'Aujourd\u2019hui : ' : 'Demain : '), x.title)))));
    const mats = PL.materials(cls, [today, tomorrow]).filter(r => r.kind !== 'copie' || r.status === 'à faire');
    if (mats.length) cards.push(h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'À préparer (aujourd\u2019hui et demain)'), h('a', { class: 'btn btn-small', href: `#/cahier?d=${today}&v=semaine` }, 'Semaine')),
      h('ul', { class: 'plain' }, mats.slice(0, 8).map(r => h('li', {}, `${r.date === today ? '' : 'Demain · '}${r.label}${r.kind === 'copie' ? ` — ${r.count} ex.` : ''}`)))));
  }
  const openTasks = store.all('task').filter(t => !t.done && t.due && t.due <= today);
  const evs = PL.eventsOn(today);
  if (openTasks.length || evs.length) cards.push(h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Tâches et rendez-vous'), h('a', { class: 'btn btn-small', href: '#/taches' }, 'Tout voir')),
    evs.length ? h('ul', { class: 'plain' }, evs.map(e => h('li', {}, `${e.start || 'Journée'} · ${e.title}`))) : null,
    openTasks.length ? h('ul', { class: 'task-list' }, openTasks.map(t => h('li', { class: 'task' },
      h('input', { type: 'checkbox', 'aria-label': `Tâche faite : ${t.title}`, onchange: () => store.update(t.id, { done: true, doneAt: new Date().toISOString() }, 'Tâche faite') }),
      h('button', { class: 'linklike', type: 'button', onclick: () => taskDialog(t) }, t.title), t.due < today ? h('span', { class: 'badge badge-warn' }, 'en retard') : null))) : null));

  const days = s.lastBackupAt ? Math.floor((Date.now() - new Date(s.lastBackupAt)) / 86400000) : null;
  const hasData = store.count() > 0;
  if (hasData && (days === null || days >= 7)) {
    cards.push(h('section', { class: 'card notice' },
      h('h2', {}, 'Pensez à exporter une sauvegarde'),
      h('p', {}, days === null ? 'Aucune sauvegarde n’a encore été exportée. Vos données ne sont enregistrées que sur cet appareil.' : `Dernière sauvegarde exportée il y a ${days} jours.`),
      h('a', { class: 'btn btn-primary', href: '#/reglages/sauvegarde' }, icon('download', 16), 'Aller à la sauvegarde')));
  }

  const pending = store.all('inbox').filter(i => i.status !== 'classé').length;
  if (pending) cards.push(h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Boîte de réception'), h('a', { class: 'btn btn-small', href: '#/reception' }, 'Classer')),
    h('p', {}, `${pending} élément(s) à classer.`)));

  const pages = allPages();
  const favs = (s.favorites || []).map(k => pages.find(p => p.key === k)).filter(Boolean);
  if (favs.length) cards.push(h('section', { class: 'card' }, h('h2', {}, 'Favoris'), h('div', { class: 'fav-grid' }, favs.map(f => h('a', { class: 'fav-tile', href: f.href }, icon('star', 16), f.title)))));

  cards.push(h('section', { class: 'card later-card' }, h('h2', {}, 'Bientôt sur cette page'),
    h('ul', {},
      h('li', {}, 'Appel rapide matin/après-midi et services (cantine, étude) — étape 3'),
      h('li', {}, 'Projection du programme du jour et timer de couleur — étape 3'))));

  return h('div', { class: 'page' },
    pageHeader(model.frDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase()),
      { favKey: 'aujourdhui/journee', subtitle: `${s.userName ? `Bonjour ${s.userName} · ` : ''}${y ? `${y.label} · ` : ''}${situation}${noSchool ? ` · ${noSchool.label}` : ''}` }),
    subTabs(),
    h('div', { class: 'dash' }, cards));
}
