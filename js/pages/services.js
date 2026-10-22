// Cantine, étude, garderie et sorties : semaine type, exceptions datées, effectifs, listes imprimables.
// « Inscrit » (semaine type et exceptions) et « présence prévue » (moins les absents à l'appel) sont distingués.
import * as store from '../store.js';
import * as model from '../model.js';
import * as V from '../vie.js';
import { h, icon, toast, modal, field, formData, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { printDocument, printTable } from '../print.js';

let tab = 'jour';

export function render({ query, rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Cantine et services'), subTabs(), missing);
  if (query.t) tab = query.t;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.d || '') ? query.d : model.todayIso();
  const tabs = h('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' }, [['jour', 'Jour'], ['semaine', 'Semaine type'], ['sorties', 'Sorties']].map(([k, l]) =>
    h('button', { type: 'button', class: tab === k ? 'on' : '', 'data-testid': `svc-tab-${k}`, onclick: () => { tab = k; rerender(); } }, l)));
  const body = tab === 'semaine' ? weekPlan(cls) : tab === 'sorties' ? departures(cls, date) : day(cls, date);
  return h('div', { class: 'page' },
    pageHeader('Cantine et services', { favKey: 'aujourdhui/services', subtitle: cls.name }),
    subTabs(), tabs, body);
}

function dateNav(date, t) {
  return h('div', { class: 'daynav' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Jour précédent', onclick: () => { location.hash = `#/services?t=${t}&d=${model.addDays(date, -1)}`; } }, icon('chevleft')),
    h('input', { type: 'date', value: date, 'aria-label': 'Date', 'data-testid': 'svc-date', onchange: (e) => { if (e.target.value) location.hash = `#/services?t=${t}&d=${e.target.value}`; } }),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Jour suivant', onclick: () => { location.hash = `#/services?t=${t}&d=${model.addDays(date, 1)}`; } }, icon('chevright')),
    h('span', { class: 'muted' }, model.frDate(date, { weekday: 'long', day: 'numeric', month: 'long' })));
}

function day(cls, date) {
  return h('div', { class: 'stack' }, dateNav(date, 'jour'),
    h('div', { class: 'dash' }, V.services().map(svc => {
      const rows = V.serviceDay(cls, date, svc);
      const expected = rows.filter(r => r.expected).length;
      const doc = () => printTable({ title: `${svc} — ${model.frDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}`, subtitle: `${cls.name} · ${rows.length} inscrit(s), ${expected} présence(s) prévue(s)`,
        columns: [{ label: 'Élève' }, { label: 'Remarque' }, { label: 'Pointage', width: '18%' }],
        rows: rows.map(r => [`${(r.student.lastName || '').toUpperCase()} ${r.student.firstName}`, [r.absentAll ? 'absent (appel)' : r.absentSome ? 'absence partielle' : '', r.exception ? `exception : ${r.exception.note || (r.exception.present ? 'ajouté' : '')}` : ''].filter(Boolean).join(' · '), '']) });
      return h('section', { class: 'card', 'data-testid': 'svc-card' },
        h('div', { class: 'card-head' }, h('h2', {}, svc),
          h('div', { class: 'row' }, badge(`${rows.length} inscrit(s)`, 'info'), badge(`${expected} présence(s) prévue(s)`, 'ok'),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Imprimer la liste ${svc}`, onclick: () => printDocument(doc()) }, icon('print', 16)))),
        rows.length ? h('ul', { class: 'plain' }, rows.map(r => h('li', { class: r.expected ? '' : 'muted' }, `${r.student.firstName} ${r.student.lastName}`,
          r.absentAll ? badge('absent', 'warn') : r.absentSome ? badge('absence partielle', 'warn') : null,
          r.exception ? badge(r.exception.note || 'exception du jour', 'info') : null))) : h('p', { class: 'muted' }, 'Personne.'),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'svc-exception', onclick: () => exceptionDialog(cls, date, svc) }, 'Exception pour ce jour…'));
    })),
    h('p', { class: 'muted small' }, 'Inscrits = semaine type, corrigée par les exceptions du jour. Présences prévues = inscrits moins les élèves absents toute la journée à l’appel.'));
}

function exceptionDialog(cls, date, svc) {
  const students = model.studentsOfClass(cls.id, { date });
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Élève', h('select', { name: 'studentId' }, students.map(({ student: s }) => h('option', { value: s.id }, `${s.firstName} ${s.lastName}`)))),
    field('Ce jour-là', h('select', { name: 'present' }, h('option', { value: '0' }, `ne va pas à : ${svc}`), h('option', { value: '1' }, `va à : ${svc}`))),
    field('Remarque', h('input', { name: 'note', placeholder: 'ex. sortie, rendez-vous médical, mot des parents' })));
  modal({ title: `${svc} — exception du ${model.frShort(date)}`, body: form, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form);
    const prev = V.exceptionsOn(cls.id, date).find(e => e.studentId === d.studentId && e.service === svc);
    if (prev) await store.update(prev.id, { present: d.present === '1', note: d.note }, `Exception ${svc}`);
    else await store.create('serviceexc', { classId: cls.id, date, studentId: d.studentId, service: svc, present: d.present === '1', note: d.note }, `Exception ${svc}`);
    toast('Exception enregistrée pour ce jour uniquement');
  } }] });
}

function weekPlan(cls) {
  const plan = V.planOf(cls.id);
  const days = model.classDays(cls);
  const students = model.studentsOfClass(cls.id, { includeFuture: true });
  const toggle = async (sid, svc, d, on) => {
    const p = await V.ensurePlan(cls.id);
    const cur = structuredClone(store.get(p.id).plans || {});
    const set = new Set(cur[sid]?.[svc] || []); on ? set.add(d) : set.delete(d);
    cur[sid] = { ...(cur[sid] || {}), [svc]: [...set].sort() };
    await store.update(p.id, { plans: cur }, `Semaine type : ${svc}`, { quiet: true });
  };
  return h('div', { class: 'stack' },
    h('p', { class: 'muted' }, 'Cochez les jours habituels. Les changements ponctuels se notent dans la vue « Jour », sans modifier la semaine type.'),
    V.services().map(svc => h('section', { class: 'card' }, h('h2', {}, svc),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table svc-grid' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Élève'), days.map(d => h('th', {}, model.JOURS[d].slice(0, 3))), h('th', {}, ''))),
        h('tbody', {}, students.map(({ student: s }) => {
          const has = plan?.plans?.[s.id]?.[svc] || [];
          return h('tr', {}, h('td', {}, `${s.firstName} ${s.lastName}`),
            days.map(d => h('td', {}, h('input', { type: 'checkbox', checked: has.includes(d), 'aria-label': `${s.firstName} ${svc} ${model.JOURS[d]}`, 'data-testid': 'svc-check', onchange: (e) => toggle(s.id, svc, d, e.target.checked) }))),
            h('td', {}, h('button', { class: 'btn btn-link small', type: 'button', onclick: async () => { for (const d of days) await toggle(s.id, svc, d, true); toast(`${s.firstName} : ${svc} tous les jours`); } }, 'tous')));
        })))))));
}

function departures(cls, date) {
  const students = model.studentsOfClass(cls.id, { date });
  const rows = students.map(({ student: s }) => ({ s, ...V.departureOn(cls, s, date) }));
  const doc = () => printTable({ title: `Sorties — ${model.frDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}`, subtitle: cls.name,
    columns: [{ label: 'Élève' }, { label: 'Habituellement' }, { label: 'Ce jour' }, { label: 'Personnes autorisées' }],
    rows: rows.map(r => [`${(r.s.lastName || '').toUpperCase()} ${r.s.firstName}`, [r.usual, r.usualNote].filter(Boolean).join(' — '), r.exception?.note || '', (r.s.contacts || []).filter(c => c.pickup).map(c => `${c.name}${c.relation ? ' (' + c.relation + ')' : ''}`).join(', ')]) });
  return h('div', { class: 'stack' }, dateNav(date, 'sorties'),
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => printDocument(doc(), { orientation: 'landscape' }) }, icon('print', 16), 'Imprimer la liste de sortie')),
    h('p', { class: 'muted small' }, 'Les personnes autorisées viennent de la fiche élève (contacts « autorisé à venir chercher »). La liste imprimée contient ces noms : à ne remettre qu’aux adultes concernés.'),
    h('section', { class: 'card' }, h('div', { class: 'table-wrap' }, h('table', { class: 'table', 'data-testid': 'departures' },
      h('thead', {}, h('tr', {}, ['Élève', 'Habituellement', 'Ce jour', ''].map(t => h('th', {}, t)))),
      h('tbody', {}, rows.map(r => h('tr', {},
        h('td', {}, h('a', { href: `#/eleve/${r.s.id}` }, `${r.s.firstName} ${r.s.lastName}`)),
        h('td', {}, h('select', { 'aria-label': `Sortie habituelle de ${r.s.firstName}`, onchange: async (e) => { await store.update(r.s.id, { departure: { ...(r.s.departure || {}), mode: e.target.value } }, 'Sortie habituelle', { quiet: true }); } },
          h('option', { value: '' }, 'à renseigner'), V.DEPARTURES.map(m => h('option', { value: m, selected: r.usual === m }, m)))),
        h('td', {}, r.exception ? badge(r.exception.note, 'info') : h('span', { class: 'muted' }, '—')),
        h('td', {}, h('button', { class: 'btn btn-small', type: 'button', onclick: () => departureException(cls, date, r) }, r.exception ? 'Modifier' : 'Exception…')))))))));
}

function departureException(cls, date, r) {
  const note = h('input', { value: r.exception?.note || '', placeholder: 'ex. récupéré par sa grand-mère à 15 h' });
  const actions = [{ label: 'Annuler' }];
  if (r.exception) actions.unshift({ label: 'Retirer', danger: true, onClick: () => store.remove(r.exception.id, 'Exception de sortie retirée') });
  actions.push({ label: 'Enregistrer', primary: true, onClick: async () => {
    if (!note.value.trim()) return false;
    if (r.exception) await store.update(r.exception.id, { note: note.value.trim() }, 'Exception de sortie');
    else await store.create('serviceexc', { classId: cls.id, date, studentId: r.s.id, service: '__départ', present: true, note: note.value.trim() }, 'Exception de sortie');
  } });
  modal({ title: `Sortie de ${r.s.firstName} le ${model.frShort(date)}`, body: h('div', { class: 'form' }, field('Consigne pour ce jour', note)), actions });
}
