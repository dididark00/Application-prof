// Appel du matin et de l'après-midi. Les présences ne sont « vérifiées » qu'après validation.
import * as store from '../store.js';
import * as model from '../model.js';
import * as V from '../vie.js';
import * as PL from '../planning.js';
import { h, icon, toast, confirmDialog, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass, avatar } from '../components.js';
import { orderedStudents, prefsOf } from './registre.js';

export function render({ query }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Appel'), subTabs(), missing);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.d || '') ? query.d : model.todayIso();
  const half = query.h === 'après-midi' ? 'après-midi' : (query.h === 'matin' ? 'matin' : (new Date().getHours() >= 12 && date === model.todayIso() ? 'après-midi' : 'matin'));
  const go = (d, hh = half) => { location.hash = `#/appel?d=${d}&h=${encodeURIComponent(hh)}`; };
  const rec = V.attendanceOf(cls.id, date, half);
  const marks = rec?.marks || {};
  const locked = !!rec?.validated;
  const pr = prefsOf(cls);
  const students = orderedStudents(cls, date).filter(x => !pr.excluded.includes(x.student.id));
  const school = PL.isSchoolDay(cls, date);
  const counts = {}; for (const { student: s } of students) { const st = marks[s.id]?.status || 'non pointé'; counts[st] = (counts[st] || 0) + 1; }
  const t = V.halfTimes(cls, half);

  const setMark = async (sid, patch) => {
    const cur = V.attendanceOf(cls.id, date, half);
    const next = { ...(cur?.marks || {}), [sid]: { ...(cur?.marks?.[sid] || {}), ...patch } };
    if (cur) await store.update(cur.id, { marks: next }, `Appel ${model.frShort(date)} ${half}`, { quiet: true });
    else await store.create('attendance', { classId: cls.id, date, half, marks: next, validated: false }, `Appel ${model.frShort(date)} ${half}`);
    refresh();
  };
  const list = h('div', { class: 'appel-list', 'data-testid': 'appel-list' });
  const summary = h('div', { class: 'appel-summary' });
  const refresh = () => {
    const r = V.attendanceOf(cls.id, date, half); const mk = r?.marks || {};
    const c = {}; for (const { student: s } of students) { const st = mk[s.id]?.status || 'non pointé'; c[st] = (c[st] || 0) + 1; }
    summary.replaceChildren(...Object.entries(c).map(([k, v]) => badge(`${k} : ${v}`, k === 'présent' ? 'ok' : k === 'non pointé' ? 'muted' : 'warn')));
    list.replaceChildren(...students.map(({ student: s }) => row(s, mk[s.id] || {})));
  };
  const row = (s, m) => h('div', { class: `appel-row st-${m.status || 'none'}`, 'data-testid': 'appel-row' },
    avatar(s, 40), h('div', { class: 'appel-name' }, h('a', { href: `#/eleve/${s.id}` }, pr.sort === 'nom' ? `${(s.lastName || '').toUpperCase()} ${s.firstName}` : `${s.firstName} ${s.lastName}`), pr.meal.includes(s.id) ? badge('repas spécial', 'info') : null),
    h('div', { class: 'appel-btns', role: 'group', 'aria-label': `Présence de ${s.firstName}` }, V.MARKS.map(([k, l, short]) =>
      h('button', { type: 'button', class: `mark mark-${k} ${m.status === k ? 'on' : ''}`, title: l, 'aria-label': `${l} : ${s.firstName}`, 'aria-pressed': m.status === k ? 'true' : 'false', disabled: locked, 'data-testid': `mark-${k}`,
        onclick: () => setMark(s.id, { status: m.status === k ? null : k, ...(k === 'retard' && !m.time ? { time: model.hhmm(model.minutes(t.start) + 10) } : {}), ...(k === 'départ' && !m.time ? { time: model.hhmm(model.minutes(t.end) - 30) } : {}), ...(k === 'partiel' && !m.from ? { from: t.start, to: model.hhmm(model.minutes(t.start) + 60) } : {}) }) }, short))),
    (m.status === 'retard' || m.status === 'départ') ? h('label', { class: 'inline small' }, m.status === 'retard' ? 'arrivé à' : 'parti à',
      h('input', { type: 'time', value: m.time || '', disabled: locked, 'aria-label': 'Heure', onchange: (e) => setMark(s.id, { time: e.target.value }) })) : null,
    m.status === 'partiel' ? h('span', { class: 'inline small' }, 'de', h('input', { type: 'time', value: m.from || '', disabled: locked, 'aria-label': 'Début', onchange: (e) => setMark(s.id, { from: e.target.value }) }),
      'à', h('input', { type: 'time', value: m.to || '', disabled: locked, 'aria-label': 'Fin', onchange: (e) => setMark(s.id, { to: e.target.value }) })) : null,
    h('input', { class: 'appel-comment', placeholder: 'commentaire', value: m.comment || '', disabled: locked, 'aria-label': `Commentaire pour ${s.firstName}`, onchange: (e) => setMark(s.id, { comment: e.target.value }) }));
  queueMicrotask(refresh);

  return h('div', { class: 'page' },
    pageHeader('Appel', { favKey: 'aujourdhui/appel', subtitle: `${cls.name} · ${model.frDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${half} (${t.start}–${t.end})`, actions: [h('a', { class: 'btn', href: `#/registre?m=${date.slice(0, 7)}`, 'data-testid': 'to-registre' }, 'Registre du mois')] }),
    subTabs(),
    h('div', { class: 'daynav' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Jour précédent', onclick: () => go(model.addDays(date, -1)) }, icon('chevleft')),
      h('input', { type: 'date', value: date, 'aria-label': 'Date', onchange: (e) => e.target.value && go(e.target.value) }),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Jour suivant', onclick: () => go(model.addDays(date, 1)) }, icon('chevright')),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Demi-journée' }, V.HALVES.map(([k, l]) => h('button', { type: 'button', class: half === k ? 'on' : '', 'data-testid': `half-${k}`, onclick: () => go(date, k) }, l)))),
    !school.ok ? h('p', { class: 'banner' }, `${school.reason} : vous pouvez tout de même faire l’appel si besoin.`) : null,
    students.length ? h('section', { class: 'card' },
      h('div', { class: 'card-head' }, summary,
        locked ? h('div', { class: 'row' }, badge(`Appel validé le ${model.frDateTime(rec.validatedAt)}`, 'ok'),
          h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'appel-reopen', onclick: async () => { await store.update(rec.id, { validated: false }, `Appel rouvert (${model.frShort(date)} ${half})`); } }, 'Modifier'))
          : h('div', { class: 'row' },
            h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'all-present', onclick: async () => {
              const cur = V.attendanceOf(cls.id, date, half); const mk = { ...(cur?.marks || {}) };
              for (const { student: s } of students) if (!mk[s.id]?.status) mk[s.id] = { ...(mk[s.id] || {}), status: 'présent' };
              if (cur) await store.update(cur.id, { marks: mk }, 'Non pointés marqués présents', { quiet: true }); else await store.create('attendance', { classId: cls.id, date, half, marks: mk, validated: false }, 'Appel');
              refresh();
            } }, 'Les non pointés sont présents'),
            h('button', { class: 'btn btn-primary btn-small', type: 'button', 'data-testid': 'appel-validate', onclick: async () => {
              const cur = V.attendanceOf(cls.id, date, half);
              const missingN = students.filter(({ student: s }) => !cur?.marks?.[s.id]?.status).length;
              if (missingN) { toast(`${missingN} élève(s) non pointé(s) : pointez-les avant de valider.`, { kind: 'error' }); return; }
              const bad = students.filter(({ student: s }) => { const m = cur.marks[s.id]; return (['retard', 'départ'].includes(m.status) && !m.time) || (m.status === 'partiel' && (!m.from || !m.to || m.to <= m.from)); });
              if (bad.length) { toast(`Heures manquantes ou incohérentes pour : ${bad.map(x => x.student.firstName).join(', ')}.`, { kind: 'error' }); return; }
              await store.update(cur.id, { validated: true, validatedAt: new Date().toISOString() }, `Appel validé (${model.frShort(date)} ${half})`);
              toast('Appel validé');
            } }, icon('check', 14), 'Valider l’appel'))),
      locked ? null : h('p', { class: 'muted small' }, 'P présent · A absent · R retard · D départ anticipé · ½ absence partielle. Tant que l’appel n’est pas validé, les présences sont considérées comme non vérifiées.'),
      list) : emptyState('Aucun élève inscrit à cette date'));
}
