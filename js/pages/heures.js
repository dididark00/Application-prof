// 108 h et APC. Les totaux sont calculés à partir des sources (activités saisies ici,
// réunions marquées « compte dans les 108 h », séances d'APC réalisées) : comptage unique.
import * as store from '../store.js';
import * as model from '../model.js';
import * as O from '../orga.js';
import { h, icon, toast, modal, field, formData, badge, emptyState, download } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { bound, pickMany, iconBtn } from '../forms.js';
import { printDocument, printTable } from '../print.js';
import { toCsv } from '../csv.js';

const hm = (min) => (min ? model.durationLabel(Math.round(min)) : '0');
const catLabel = (k) => O.H108_CATS.find(c => c[0] === k)?.[1] || k;

export function render({ query, rerender }) {
  const y = model.currentYear();
  if (!y) return h('div', { class: 'page' }, pageHeader('108 h et APC'), subTabs(), emptyState('Aucune année', 'Créez d’abord une année scolaire dans Réglages.'));
  const tab = query.t === 'apc' ? 'apc' : 'heures';
  return h('div', { class: 'page' },
    pageHeader('108 h et APC', { favKey: 'organisation/heures', subtitle: y.label }),
    subTabs(),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' }, [['heures', '108 heures'], ['apc', 'APC']].map(([k, l]) => h('button', { type: 'button', class: tab === k ? 'on' : '', 'data-testid': `h-tab-${k}`, onclick: () => { location.hash = `#/heures?t=${k}`; } }, l))),
    tab === 'apc' ? apcView(y, query.g, rerender) : hoursView(y));
}

// ───── 108 h
function hoursView(y) {
  const lines = O.h108Lines(y.id);
  const totals = O.h108Totals(lines);
  const targets = O.h108Targets(y);
  const sum = (k) => Object.values(totals).reduce((s, t) => s + t[k], 0);
  const target = Object.values(targets).reduce((s, v) => s + (Number(v) || 0), 0);
  return h('div', { class: 'stack' },
    h('div', { class: 'kpis', 'data-testid': 'h108-kpis' },
      h('div', { class: 'kpi' }, h('strong', { 'data-testid': 'h108-done' }, hm(sum('done'))), h('span', {}, `réalisées sur ${target} h prévues au service`), progress(sum('done') / 60, target)),
      h('div', { class: 'kpi' }, h('strong', {}, hm(sum('planned'))), h('span', {}, 'programmées au total (prévu)'))),
    h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Par catégorie'), h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'h108-settings', onclick: () => settingsDialog(y) }, 'Régler mon service')),
      h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Catégorie'), h('th', { class: 'num' }, 'Objectif'), h('th', { class: 'num' }, 'Prévu'), h('th', { class: 'num' }, 'Réalisé'), h('th', {}, ''))),
        h('tbody', {}, O.H108_CATS.map(([k, l]) => h('tr', { 'data-testid': `h108-cat-${k}` }, h('td', {}, l), h('td', { class: 'num' }, `${targets[k] ?? 0} h`), h('td', { class: 'num' }, hm(totals[k]?.planned)), h('td', { class: 'num' }, hm(totals[k]?.done)), h('td', { style: { width: '140px' } }, progress((totals[k]?.done || 0) / 60, Number(targets[k]) || 0)))))),
      h('p', { class: 'muted small' }, y.h108?.note || O.H108_SOURCE)),
    h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Détail'),
      h('span', { class: 'row' }, h('button', { class: 'btn btn-small btn-primary', type: 'button', 'data-testid': 'h108-add', onclick: () => activityDialog(y) }, icon('plus', 14), 'Activité'),
        h('a', { class: 'btn btn-small', href: '#/reunions' }, 'Réunions'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => exportCsv(y, lines) }, icon('download', 14), 'CSV'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => printHours(y, lines, totals, targets) }, icon('print', 14), 'Imprimer'))),
      lines.length ? h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Activité'), h('th', {}, 'Catégorie'), h('th', {}, 'Source'), h('th', { class: 'num' }, 'Prévu'), h('th', { class: 'num' }, 'Réalisé'), h('th', {}, ''))),
        h('tbody', {}, lines.map(l => h('tr', { 'data-testid': 'h108-line' },
          h('td', { class: 'nowrap' }, l.date ? model.frShort(l.date) : '—'), h('td', {}, l.href ? h('a', { href: l.href }, l.title) : l.title, l.status === 'annulé' ? badge('annulé', 'warn') : null),
          h('td', { class: 'small' }, catLabel(l.cat)), h('td', {}, badge(l.kind, 'muted')), h('td', { class: 'num' }, hm(l.planned)), h('td', { class: 'num' }, l.done ? hm(l.done) : badge(l.status, l.status === 'réalisé' ? 'ok' : 'muted')),
          h('td', {}, l.kind === 'activité' ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => activityDialog(y, l.rec) }, 'Modifier') : null)))))
        : h('p', { class: 'muted' }, 'Rien pour l’instant. Les réunions marquées « compte dans les 108 h » et les séances d’APC réalisées s’ajoutent ici automatiquement, sans double saisie.')));
}

function progress(doneH, targetH) {
  const pct = targetH ? Math.min(100, (doneH / targetH) * 100) : 0;
  return h('div', { class: 'bar', title: `${Math.round(pct)} %` }, h('i', { class: doneH > targetH && targetH ? 'over' : '', style: { width: `${pct}%` } }));
}

function settingsDialog(y) {
  const cur = O.h108Targets(y);
  const q = h('select', { name: 'quotite' }, [100, 80, 75, 50].map(v => h('option', { value: v, selected: Number(y.h108?.quotite || 100) === v }, `${v} %`)));
  const inputs = Object.fromEntries(O.H108_CATS.map(([k]) => [k, h('input', { type: 'number', step: '0.5', min: 0, value: cur[k] ?? 0, 'data-testid': `target-${k}` })]));
  q.addEventListener('change', () => { for (const [k, v] of Object.entries(O.H108_FULL)) inputs[k].value = Math.round(v * Number(q.value) / 100 * 2) / 2; });
  const note = h('textarea', { rows: 2 }, y.h108?.note || '');
  modal({ title: 'Mon service (108 h)', body: h('div', { class: 'form' },
    field('Quotité', q, 'Recalcule les objectifs au prorata ; vous pouvez ensuite les ajuster.'),
    O.H108_CATS.map(([k, l]) => field(`${l} (heures)`, inputs[k])),
    field('Source / consignes de la circonscription', note, 'Notez d’où viennent vos objectifs (ex. note de service, mail de la circonscription).'),
    h('p', { class: 'muted small' }, O.H108_SOURCE)),
  actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    const targets = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, Number(i.value) || 0]));
    await store.update(y.id, { h108: { quotite: Number(q.value), targets, note: note.value } }, 'Objectifs 108 h');
  } }] });
}

function activityDialog(y, a = null) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Activité', h('input', { name: 'title', required: true, value: a?.title || '', 'data-testid': 'act-title' })),
    h('div', { class: 'grid-3' }, field('Date', h('input', { name: 'date', type: 'date', value: a?.date || model.todayIso() })),
      field('Catégorie', h('select', { name: 'cat', 'data-testid': 'act-cat' }, O.H108_CATS.map(([k, l]) => h('option', { value: k, selected: a?.cat === k }, l)))),
      field('Durée prévue (minutes)', h('input', { name: 'planned', type: 'number', min: 0, value: a?.planned || 60, 'data-testid': 'act-planned' }))),
    h('div', { class: 'grid-2' }, h('label', { class: 'inline' }, h('input', { type: 'checkbox', name: 'done', checked: !!a?.done, 'data-testid': 'act-done' }), 'Réalisée'),
      field('Durée réelle si différente (minutes)', h('input', { name: 'realMinutes', type: 'number', min: 0, value: a?.realMinutes || '' }))),
    field('Notes / justificatif', h('textarea', { name: 'notes', rows: 2 }, a?.notes || '')));
  const actions = [{ label: 'Annuler' }];
  if (a) actions.unshift({ label: 'Supprimer', danger: true, onClick: async () => { await store.remove(a.id, 'Activité 108 h mise à la corbeille'); toast('Activité mise à la corbeille', { action: 'Annuler', onAction: () => store.undo() }); } });
  actions.push({ label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form); if (!d.title.trim()) return false;
    const data = { ...d, done: !!d.done, planned: Number(d.planned) || 0, realMinutes: d.realMinutes ? Number(d.realMinutes) : null, yearId: y.id };
    if (a) await store.update(a.id, data, '108 h : activité modifiée'); else await store.create('hours', data, `108 h : ${d.title}`);
  } });
  modal({ title: a ? 'Activité (108 h)' : 'Nouvelle activité (108 h)', body: form, actions });
}

function exportCsv(y, lines) {
  download(`108h-${y.label}.csv`, toCsv([['Date', 'Activité', 'Catégorie', 'Source', 'Prévu (min)', 'Réalisé (min)', 'Statut'], ...lines.map(l => [l.date || '', l.title, catLabel(l.cat), l.kind, l.planned, l.done, l.status])]), 'text/csv;charset=utf-8');
}
function printHours(y, lines, totals, targets) {
  printDocument(h('div', {},
    printTable({ title: `108 heures — ${y.label}`, subtitle: store.getSettings().userName || '', columns: ['Catégorie', 'Objectif', 'Prévu', 'Réalisé'].map(label => ({ label })), rows: O.H108_CATS.map(([k, l]) => [l, `${targets[k] ?? 0} h`, hm(totals[k]?.planned), hm(totals[k]?.done)]) }),
    printTable({ title: 'Détail', columns: ['Date', 'Activité', 'Catégorie', 'Prévu', 'Réalisé'].map(label => ({ label })), rows: lines.map(l => [l.date ? model.frShort(l.date) : '', l.title, catLabel(l.cat), hm(l.planned), l.done ? hm(l.done) : l.status]) })));
}

// ───── APC
function apcView(y, openId, rerender) {
  const groups = store.all('apc').filter(g => g.yearId === y.id).sort((a, b) => (a.title || '').localeCompare(b.title || '', 'fr'));
  const cls = model.currentClass();
  return h('div', { class: 'stack' },
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-apc', onclick: () => apcDialog(y) }, icon('plus', 16), 'Nouveau groupe d’APC')),
    groups.length ? groups.map(g => {
      const open = openId === g.id || groups.length === 1;
      const doneMin = (g.sessions || []).filter(s => s.done).reduce((s, x) => s + (Number(x.minutes) || 0), 0);
      const students = (g.studentIds || []).map(id => store.get(id)).filter(Boolean);
      return h('section', { class: 'card', 'data-testid': 'apc-card' },
        h('div', { class: 'card-head' }, h('h2', {}, g.title, ' ', badge(`${hm(doneMin)} réalisées`, 'ok'), g.subject ? badge(g.subject, 'muted') : null),
          h('span', { class: 'row' }, h('a', { class: 'btn btn-small', href: open ? '#/heures?t=apc' : `#/heures?t=apc&g=${g.id}` }, open ? 'Replier' : 'Ouvrir'), h('button', { class: 'btn btn-small', type: 'button', onclick: () => apcDialog(y, g) }, 'Modifier'))),
        h('p', { class: 'muted' }, `${students.length} élève(s) : ${students.map(s => s.firstName).join(', ') || '—'}`),
        open ? h('div', { class: 'stack' },
          g.objectives ? h('p', {}, h('strong', {}, 'Objectifs : '), g.objectives) : null,
          h('div', { class: 'linked-head' }, h('strong', {}, 'Élèves'), h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'apc-students', onclick: async () => {
            const items = cls ? model.studentsOfClass(cls.id).map(({ student: s }) => ({ id: s.id, label: model.fullName(s, 'prenom') })) : [];
            const sel = await pickMany({ title: 'Élèves du groupe d’APC', items, selected: g.studentIds || [] });
            if (sel) await store.update(g.id, { studentIds: sel, consent: Object.fromEntries(sel.map(id => [id, g.consent?.[id] || false])) }, 'Élèves d’APC');
          } }, 'Choisir…')),
          students.length ? h('div', { class: 'chips' }, students.map(s => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: !!g.consent?.[s.id], onchange: (e) => store.update(g.id, { consent: { ...(g.consent || {}), [s.id]: e.target.checked } }, 'Accord de la famille (APC)', { quiet: true }) }), `${s.firstName} : accord famille`))) : null,
          h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Durée'), h('th', {}, 'Contenu'), h('th', {}, 'Présents'), h('th', {}, 'Faite'), h('th', {}, ''))),
            h('tbody', {}, (g.sessions || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(s => {
              const set = (patch, label) => store.update(g.id, { sessions: store.get(g.id).sessions.map(x => (x.id === s.id ? { ...x, ...patch } : x)) }, label, { quiet: true });
              return h('tr', { 'data-testid': 'apc-session' },
                h('td', {}, bound({ type: 'date', value: s.date, onSave: (v) => set({ date: v }, 'Séance d’APC') })),
                h('td', {}, bound({ type: 'number', value: s.minutes, onSave: (v) => set({ minutes: v }, 'Durée d’APC') })),
                h('td', {}, bound({ type: 'textarea', compact: true, value: s.content, onSave: (v) => set({ content: v }, 'Contenu d’APC') })),
                h('td', {}, h('div', { class: 'chips' }, students.map(st => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: (s.present || g.studentIds || []).includes(st.id), onchange: (e) => { const cur = new Set(s.present || g.studentIds || []); e.target.checked ? cur.add(st.id) : cur.delete(st.id); set({ present: [...cur] }, 'Présences APC'); } }), st.firstName)))),
                h('td', {}, h('input', { type: 'checkbox', checked: !!s.done, 'data-testid': 'apc-done', 'aria-label': 'Séance faite', onchange: (e) => store.update(g.id, { sessions: store.get(g.id).sessions.map(x => (x.id === s.id ? { ...x, done: e.target.checked } : x)) }, e.target.checked ? 'Séance d’APC faite' : 'Séance d’APC non faite') })),
                h('td', {}, iconBtn('trash', 'Retirer la séance', () => store.update(g.id, { sessions: store.get(g.id).sessions.filter(x => x.id !== s.id) }, 'Séance d’APC retirée'))));
            }))),
          h('div', { class: 'row' },
            h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'apc-add-session', onclick: () => store.update(g.id, { sessions: [...(g.sessions || []), { id: store.uid(), date: nextDate(g), minutes: Number(g.defaultMinutes) || 30, content: '', done: false }] }, 'Séance d’APC ajoutée') }, '+ séance'),
            h('button', { class: 'btn btn-small', type: 'button', onclick: () => seriesDialog(g) }, 'Plusieurs séances…')),
          h('div', { class: 'fields' }, bound({ label: 'Bilan', value: g.bilan, onSave: (v) => store.update(g.id, { bilan: v }, 'Bilan d’APC', { quiet: true }) })),
          h('p', { class: 'muted small' }, 'Seules les séances cochées « faite » comptent dans les 108 h (catégorie APC), une seule fois.')) : null);
    }) : emptyState('Aucun groupe d’APC', 'Créez un groupe : objectifs, élèves, séances et présences. Les heures réalisées s’ajoutent aux 108 h.'));
}
function nextDate(g) { const ds = (g.sessions || []).map(s => s.date).filter(Boolean).sort(); return ds.length ? model.addDays(ds[ds.length - 1], 7) : model.todayIso(); }

function apcDialog(y, g = null) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' }, field('Nom du groupe', h('input', { name: 'title', required: true, value: g?.title || '', 'data-testid': 'apc-title' })), field('Discipline', h('input', { name: 'subject', value: g?.subject || '', list: 'apc-subjects' }))),
    h('datalist', { id: 'apc-subjects' }, model.subjects().map(s => h('option', { value: s }))),
    field('Objectifs', h('textarea', { name: 'objectives', rows: 2 }, g?.objectives || '')),
    h('div', { class: 'grid-2' }, field('Horaire habituel', h('input', { name: 'slot', value: g?.slot || '', placeholder: 'ex. mardi 16 h 30 – 17 h' })), field('Durée d’une séance (minutes)', h('input', { name: 'defaultMinutes', type: 'number', min: 0, value: g?.defaultMinutes || 30 }))));
  const actions = [{ label: 'Annuler' }];
  if (g) actions.unshift({ label: 'Supprimer', danger: true, onClick: async () => { await store.remove(g.id, 'Groupe d’APC mis à la corbeille'); toast('Groupe mis à la corbeille', { action: 'Annuler', onAction: () => store.undo() }); } });
  actions.push({ label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form); if (!d.title.trim()) return false;
    if (g) await store.update(g.id, d, 'Groupe d’APC modifié');
    else { const r = await store.create('apc', { ...d, yearId: y.id, studentIds: [], consent: {}, sessions: [], bilan: '' }, `APC : ${d.title}`); location.hash = `#/heures?t=apc&g=${r.id}`; }
  } });
  modal({ title: g ? 'Groupe d’APC' : 'Nouveau groupe d’APC', body: form, actions });
}

function seriesDialog(g) {
  const start = h('input', { type: 'date', value: nextDate(g) });
  const n = h('input', { type: 'number', min: 1, max: 36, value: 6 });
  modal({ title: 'Ajouter une série hebdomadaire', body: h('div', { class: 'form' }, field('Première date', start), field('Nombre de séances (une par semaine)', n),
    h('p', { class: 'muted small' }, 'Les dates tombant pendant les vacances de l’année courante sont sautées.')),
  actions: [{ label: 'Annuler' }, { label: 'Ajouter', primary: true, onClick: async () => {
    const y = model.currentYear(); const out = []; let d = start.value; let guard = 0;
    while (out.length < Number(n.value) && guard++ < 80) { if (!y || (model.periodOfDate(y, d) && !(y.noSchoolDays || []).some(x => x.date === d))) out.push({ id: store.uid(), date: d, minutes: Number(g.defaultMinutes) || 30, content: '', done: false }); d = model.addDays(d, 7); }
    await store.update(g.id, { sessions: [...(g.sessions || []), ...out] }, `${out.length} séance(s) d’APC ajoutée(s)`);
  } }] });
}
