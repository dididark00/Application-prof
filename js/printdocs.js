// Documents imprimables (A4) : fiche de séance, séquence, EDT, cahier journal, matériel, devoirs.
import * as store from './store.js';
import * as model from './model.js';
import * as P from './pedago.js';
import * as PL from './planning.js';
import { h } from './ui.js';
import { manualRefsText } from './pedago-ui.js';
import { competencyIndex, competencyLabel, competencySource } from './pages/referentiels.js';

const kv = (rows, { blank = false, skipEmpty = false } = {}) => {
  const shown = rows.filter(([, v]) => blank || !skipEmpty || (v != null && String(v).trim() !== ''));
  if (!shown.length) return null;
  return h('table', { class: 'print-table kv' }, h('tbody', {}, shown.map(([k, v]) => h('tr', {}, h('th', { style: { width: '32%' } }, k), h('td', {}, blank ? '' : (v ?? ''))))));
};
const head = (title, sub) => h('header', { class: 'print-head' }, h('h1', {}, title), sub ? h('p', {}, sub) : null);
const h2 = (t) => h('h2', { class: 'print-h2' }, t);

export function printSession(id, { blank = false } = {}) {
  const s = store.get(id); const cls = store.get(s.classId);
  const seq = s.sequenceId ? store.get(s.sequenceId) : null;
  const full = blank || s.mode === 'visite';
  const o = { blank, skipEmpty: !full };
  const idx = competencyIndex();
  const comps = [s.competencesText, ...(s.competencyIds || []).map(c => `${competencyLabel(c, idx)} (${competencySource(c, idx)})`)].filter(Boolean).join('\n');
  const dates = P.occurrencesOfSession(s.id).filter(x => x.status !== 'reportée').map(x => model.frShort(x.date)).join(', ');
  const levels = (s.levels?.length ? s.levels : cls.levels).join(', ');
  const sections = [
    head(blank ? 'Fiche séance' : P.sessionTitle(s), `${cls.name} · Fiche séance${s.mode === 'visite' ? ' · version détaillée (visite)' : ''}`),
    h2('Identification'),
    kv([['Séquence', seq ? P.sequenceTitle(seq) : ''], ['Séance n°', P.sessionNumber(s) || ''], ['Titre de la séance', s.title], ['Discipline / domaine', s.subject], ['Sous-domaine', s.subdomain],
      ['Date', dates], ['Durée prévue', model.durationLabel(P.sessionDuration(s))], ['Niveau', levels], ['Organisation', s.organisation]], { blank, skipEmpty: false }),
    h2('Objectifs et compétences'),
    kv(P.SESSION_SECTIONS[0].fields.map(f => [f.label, f.key === 'competencesText' ? comps : s[f.key]]), o),
    h2('Préparation matérielle'),
    kv([...P.SESSION_SECTIONS[1].fields.map(f => [f.label, s[f.key]]),
      ['Manuels (pages vérifiées)', manualRefsText(s.manualRefs)],
      ['Supports liés', (s.fileIds || []).map(f => store.get(f)?.name).filter(Boolean).join(', ')],
      ['Photocopies', (s.copies || []).map(c => `${c.label} (${c.perStudent}/élève + ${c.extra})`).join(' ; ')]], o),
  ];
  if (!blank && (s.variants || []).some(v => v.objective || v.consigne || v.support)) {
    sections.push(h2('Multiniveau'), h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, ['Niveau', 'Objectif', 'Consigne', 'Support'].map(t => h('th', {}, t)))),
      h('tbody', {}, s.variants.map(v => h('tr', {}, h('td', {}, v.level), h('td', {}, v.objective || ''), h('td', {}, v.consigne || ''), h('td', {}, v.support || ''))))));
  }
  (s.phases || []).forEach((ph, i) => {
    const def = P.PHASE_KINDS[ph.kind] || P.PHASE_KINDS.libre;
    const rows = def.fields.map(f => [f.key === 'duration' ? 'Durée' : f.label, f.key === 'duration' ? (ph.duration ? `${ph.duration} min` : '') : ph[f.key]]);
    sections.push(h('div', { class: 'keep' }, h2(`Phase ${i + 1} — ${ph.title || def.label}`), kv(rows, o)));
  });
  sections.push(h('div', { class: 'keep' }, h2('Après la séance'), kv(P.AFTER_FIELDS.map(f => [f.label, '']), { blank: true })));
  if (blank || s.mode === 'visite') {
    sections.push(h('div', { class: 'keep' }, h2('Checklist avant visite / INSPE'), h('ul', { class: 'print-check' }, P.VISIT_CHECKLIST.map(([k, l]) => h('li', {}, `${!blank && s.checklist?.[k] ? '☑' : '☐'} ${l}`)))));
  }
  return h('div', { class: 'print-doc' }, sections);
}

export function printSequence(id, { blank = false } = {}) {
  const s = store.get(id); const cls = store.get(s.classId); const year = store.get(cls.yearId);
  const sessions = P.sessionsOfSequence(id);
  const idx = competencyIndex();
  const o = { blank };
  const val = (k) => (k === 'competencesText' ? [s.competencesText, ...(s.competencyIds || []).map(c => competencyLabel(c, idx))].filter(Boolean).join('\n') : s[k]);
  const out = [head(blank ? 'Fiche de séquence' : P.sequenceTitle(s), `${cls.name} · Document d’ensemble relié aux fiches de séance`),
    h2('Informations générales'),
    kv([['Titre de la séquence', s.title], ['Discipline / domaine', s.subject], ['Sous-domaine', s.subdomain], ['Niveau', (s.levels?.length ? s.levels : cls.levels).join(', ')],
      ['Période', model.periodLabel(year, s.periodId)], ['Nombre de séances', sessions.length || ''], ['Durée totale estimée', model.durationLabel(sessions.reduce((t, x) => t + P.sessionDuration(x), 0))],
      ['Prérequis', s.prerequis], ['Notions de la programmation', (s.notionIds || []).map(n => store.get(n)?.title).filter(Boolean).join(' ; ')]], o)];
  for (const sec of P.SEQUENCE_SECTIONS.slice(1)) {
    const rows = sec.fields.map(f => [f.label, val(f.key)]);
    if (sec.title === 'Matériel et supports') rows.push(['Manuels (pages vérifiées)', manualRefsText(s.manualRefs)]);
    out.push(h('div', { class: 'keep' }, h2(sec.title), kv(rows, o)));
  }
  const lines = blank ? Array.from({ length: 6 }, () => null) : sessions;
  out.push(h2('Déroulé de la séquence'), h('table', { class: 'print-table' },
    h('thead', {}, h('tr', {}, ['Séance', 'Titre', 'Objectif spécifique', 'Durée', 'Trace / production attendue'].map(t => h('th', {}, t)))),
    h('tbody', {}, lines.map((x, i) => h('tr', {}, h('td', {}, `Séance ${i + 1}`), h('td', {}, x?.title || ''), h('td', {}, x?.objective || ''), h('td', {}, x ? model.durationLabel(P.sessionDuration(x)) : ''), h('td', {}, x?.trace || ''))))));
  out.push(h('div', { class: 'keep' }, h2('Bilan de séquence'), kv(P.SEQUENCE_BILAN.map(f => [f.label, s[f.key]]), o)));
  return h('div', { class: 'print-doc' }, out);
}

export function printTimetable(tt, version, cls) {
  const days = model.classDays(cls);
  const slots = version?.slots || [];
  const times = [...new Set(slots.map(s => s.start))].sort();
  const year = store.get(cls.yearId);
  return h('div', { class: 'print-doc' }, head(`Emploi du temps — ${cls.name}`, `${tt.name || ''} · ${(tt.periodIds || []).map(p => model.periodLabel(year, p)).join(', ')}${version?.from ? ` · en vigueur à partir du ${model.frDate(version.from)}` : ''}`),
    h('table', { class: 'print-table edt-print' },
      h('thead', {}, h('tr', {}, h('th', { style: { width: '9%' } }, 'Heure'), days.map(d => h('th', {}, model.JOURS[d])))),
      h('tbody', {}, times.map(t => h('tr', {}, h('th', {}, t), days.map(d => h('td', {}, slots.filter(s => s.day === d && s.start === t).map(s =>
        h('div', { class: 'edt-cell', style: { borderLeftColor: model.subjectColor(s.subject) } }, h('strong', {}, s.subject || ''), s.label ? ` — ${s.label}` : '', h('div', { class: 'small' }, `${s.start}–${s.end}${s.levels?.length ? ' · ' + s.levels.join(', ') : ''}${s.mode && s.mode !== 'dirigé' ? ' · ' + s.mode : ''}`))))))))));
}

function entryRow(e, cls, multi) {
  const s = e.status === 'faite' || e.status === 'partielle' ? (e.occ?.snapshot || e.session) : e.session;
  const details = s ? [s.objective && `Objectif : ${s.objective}`, (s.phases || []).map(ph => `${P.PHASE_KINDS[ph.kind]?.label || 'Phase'}${ph.duration ? ` (${ph.duration} min)` : ''}${ph.consigne ? ` : ${ph.consigne}` : ''}`).join(' · ')].filter(Boolean).join('\n') : '';
  return h('tr', {}, h('td', { class: 'nowrap' }, `${e.start}–${e.end}`), h('td', {}, e.subject || ''), multi ? h('td', {}, (e.levels?.length ? e.levels : cls.levels).join(', ')) : null,
    h('td', {}, h('strong', {}, e.title), e.mode && e.mode !== 'dirigé' ? ` (${e.mode})` : '', details ? h('div', { class: 'small pre' }, details) : null),
    h('td', {}, e.status !== 'prévue' ? e.status : '', e.occ?.note ? h('div', { class: 'small' }, e.occ.note) : null));
}

export function printDay(cls, date) {
  const plan = PL.dayPlan(cls, date);
  const multi = (cls.levels || []).length > 1;
  return h('div', { class: 'print-doc' }, head(`Cahier journal — ${model.frDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`, `${cls.name}${plan.school.ok ? '' : ' · ' + plan.school.reason}`),
    plan.warnings.length ? h('p', { class: 'print-warn' }, plan.warnings.map(w => w.message).join(' ')) : null,
    h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, h('th', { style: { width: '11%' } }, 'Horaire'), h('th', { style: { width: '13%' } }, 'Discipline'), multi ? h('th', { style: { width: '8%' } }, 'Niveaux') : null, h('th', {}, 'Séance'), h('th', { style: { width: '18%' } }, 'Réalisé / bilan'))),
      h('tbody', {}, plan.entries.map(e => entryRow(e, cls, multi)))));
}

export function printWeek(cls, monday) {
  const days = model.classDays(cls).map(d => model.addDays(monday, d - 1));
  return h('div', { class: 'print-doc' }, head(`Cahier journal — semaine du ${model.frDate(monday)}`, cls.name),
    h('table', { class: 'print-table week-print' }, h('thead', {}, h('tr', {}, days.map(d => h('th', {}, model.frDate(d, { weekday: 'long', day: 'numeric', month: 'short' }))))),
      h('tbody', {}, h('tr', {}, days.map(d => { const p = PL.dayPlan(cls, d); return h('td', {}, p.school.ok ? p.entries.map(e => h('div', { class: 'week-item' }, h('strong', {}, `${e.start} ${e.subject || ''}`), h('div', {}, e.title), e.status !== 'prévue' ? h('div', { class: 'small' }, e.status) : null)) : h('em', {}, p.school.reason)); })))));
}

export function printMaterials(cls, dates, title) {
  const rows = PL.materials(cls, dates);
  return h('div', { class: 'print-doc' }, head(title, cls.name),
    h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, ['Jour', 'Séance', 'À préparer', 'Exemplaires', 'Statut'].map(t => h('th', {}, t)))),
      h('tbody', {}, rows.map(r => h('tr', {}, h('td', {}, model.frDate(r.date, { weekday: 'short', day: 'numeric', month: 'short' })), h('td', {}, `${r.entry.start} ${r.entry.title}`), h('td', {}, r.label), h('td', {}, r.kind === 'copie' ? String(r.count) : ''), h('td', {}, r.status ? `☐ ${r.status}` : '☐'))))));
}

export function printHomework(cls, list) {
  const target = (x) => x.targets?.kind === 'classe' || !x.targets ? 'Classe' : `${x.targets.kind} : ${(x.targets.values || []).map(v => store.get(v) ? `${store.get(v).firstName} ${store.get(v).lastName}` : v).join(', ')}`;
  return h('div', { class: 'print-doc' }, head('Devoirs', cls.name),
    h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, ['Pour le', 'Donné le', 'Discipline', 'Travail', 'Pour qui'].map(t => h('th', {}, t)))),
      h('tbody', {}, list.map(x => h('tr', {}, h('td', {}, model.frDate(x.dueDate, { weekday: 'short', day: 'numeric', month: 'short' })), h('td', {}, model.frShort(x.givenDate)), h('td', {}, x.subject || ''), h('td', {}, h('strong', {}, x.title), x.details ? h('div', { class: 'small pre' }, x.details) : null), h('td', {}, target(x)))))));
}
