// Cahier journal : construit depuis l'EDT en vigueur et les fiches de séance liées.
// Chaque date garde son propre bilan ; ce qui est fait est figé (instantané) ;
// les reports conservent la séance d'origine et ses supports.
import * as store from '../store.js';
import { diagramsOfSession } from '../eps.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import * as PL from '../planning.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState, pickFiles, safeUrl } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { bound, pickMany } from '../forms.js';
import { levelChips } from '../pedago-ui.js';
import { scheduleDialog, newSession } from './seance.js';
import { homeworkDialog } from './devoirs.js';
import { addFiles } from './files.js';
import { printDocument } from '../print.js';
import { printDay, printWeek, printMaterials, printWeekDossier } from '../printdocs.js';
import * as CP from '../cahier-plus.js';
import { consumeFlag } from '../router.js';
import { activityDialog, activityDetails, durLabel } from './cahier-activite.js';
import { competencyIndex, competencyLabel } from './referentiels.js';
import { download } from '../ui.js';
import * as JD from '../journal-detail.js';

let rerender = () => {};

export function render({ query, rerender: rr }) {
  rerender = rr;
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Cahier journal'), subTabs(), missing);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.d || '') ? query.d : model.todayIso();
  const view = query.v === 'semaine' ? 'semaine' : 'jour';
  const go = (d, v = view) => { location.hash = `#/cahier?d=${d}&v=${v}`; };
  const step = (dir) => {
    if (view === 'semaine') return go(model.addDays(model.mondayOf(date), 7 * dir));
    for (let k = 1; k < 60; k++) { const d = model.addDays(date, k * dir); if (PL.isSchoolDay(cls, d).ok) return go(d); }
    return go(model.addDays(date, dir));
  };
  const nav = h('div', { class: 'daynav' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': view === 'jour' ? 'Jour de classe précédent' : 'Semaine précédente', 'data-testid': 'prev', onclick: () => step(-1) }, icon('chevleft')),
    h('input', { type: 'date', value: date, 'aria-label': 'Date', 'data-testid': 'day-date', onchange: (e) => e.target.value && go(e.target.value) }),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': view === 'jour' ? 'Jour de classe suivant' : 'Semaine suivante', 'data-testid': 'next', onclick: () => step(1) }, icon('chevright')),
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => go(model.todayIso()) }, 'Aujourd’hui'),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' }, [['jour', 'Jour'], ['semaine', 'Semaine']].map(([v, l]) => h('button', { type: 'button', class: view === v ? 'on' : '', 'data-testid': `view-${v}`, onclick: () => go(date, v) }, l))));
  if (consumeFlag('new')) setTimeout(() => activityDialog(cls, null, date), 0);
  if (consumeFlag('prep')) setTimeout(() => prefillDialog(cls, date), 0);
  return view === 'semaine' ? weekView(cls, date, nav) : dayView(cls, date, nav);
}

// ───────── Jour
function dayView(cls, date, nav) {
  const plan = PL.dayPlan(cls, date);
  const year = store.get(cls.yearId);
  const per = model.periodOfDate(year, date);
  const wk = per ? model.weeksOfPeriod(per).find(w => date >= w.monday && date <= model.addDays(w.monday, 6)) : null;
  const multi = (cls.levels || []).length > 1;
  const inConflict = new Set(plan.warnings.flatMap(w => [w.a.key, w.b.key]));
  const hwGiven = store.all('homework').filter(x => x.classId === cls.id && x.givenDate === date);
  const hwDue = store.all('homework').filter(x => x.classId === cls.id && x.dueDate === date);
  const lessons = store.all('lesson').filter(l => l.classId === cls.id && (l.distributions || []).some(d => d.date === date));

  return h('div', { class: 'page' },
    pageHeader('Cahier journal', { favKey: 'planifier/cahier', subtitle: `${cls.name} · ${model.frDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${per ? ` · P${model.periodsOf(year).indexOf(per) + 1}${wk ? ` S${wk.n}` : ''}` : ''}`,
      actions: [
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'add-activity', onclick: () => activityDialog(cls, null, date) }, icon('plus', 16), 'Activité'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'print-day', onclick: () => printDocument(printDay(cls, date)) }, icon('print', 16), 'Imprimer'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'prefill-week', onclick: () => prefillDialog(cls, date) }, 'Préparer la semaine'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'export-journal', onclick: () => exportDialog(cls, date) }, icon('download', 16), 'Exporter…'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'clear-journal', onclick: () => clearDialog(cls, date) }, 'Vider…')] }),
    subTabs(), nav, detailToggle(),
    prepareBanner(cls, date),
    !plan.school.ok ? h('p', { class: 'banner' }, plan.school.reason) : null,
    plan.school.ok && !plan.myDay ? h('p', { class: 'banner info' }, `Jour de classe de ${cls.binome?.name || 'la binôme'}.`) : null,
    plan.warnings.length ? h('div', { class: 'card warn-card', 'data-testid': 'conflicts' }, h('h2', {}, icon('alert', 18), ` ${plan.warnings.length} conflit(s)`),
      h('ul', {}, plan.warnings.map(w => h('li', {}, w.message, ' ',
        [w.a, w.b].filter(x => x.kind !== 'event' && x.status === 'prévue').map(x => h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'propose-postpone', onclick: () => postponeDialog(cls, x) }, `Reporter « ${x.title} »`))))),
      h('p', { class: 'muted small' }, 'Rien n’est déplacé automatiquement : choisissez ce que vous reportez.')) : null,
    plan.entries.length ? (multi ? parallel(cls, plan, inConflict) : h('div', { class: 'stack', 'data-testid': 'day-entries' }, plan.entries.map(e => entryCard(cls, e, inConflict))))
      : emptyState(plan.school.ok ? 'Aucun créneau ce jour' : 'Pas de classe', plan.school.ok ? 'Créez l’emploi du temps (Planifier › Emploi du temps) ou ajoutez une activité ponctuelle.' : ''),
    (hwGiven.length || hwDue.length || lessons.length) ? h('section', { class: 'card' }, h('h2', {}, 'Devoirs et leçons du jour'),
      hwDue.length ? h('p', {}, h('strong', {}, 'À faire pour aujourd’hui : '), hwDue.map(x => x.title).join(' ; ')) : null,
      hwGiven.length ? h('p', {}, h('strong', {}, 'Donnés aujourd’hui : '), hwGiven.map(x => `${x.title} (pour le ${model.frShort(x.dueDate)})`).join(' ; ')) : null,
      lessons.length ? h('p', {}, h('strong', {}, 'Leçons distribuées : '), lessons.map(l => `${l.subject} n° ${l.number} ${l.title}`).join(' ; ')) : null) : null);
}

/** Multiniveau : colonnes parallèles par niveau ; une activité de toute la classe occupe toute la largeur. */
function parallel(cls, plan, inConflict) {
  const levels = cls.levels;
  const clusters = [];
  for (const e of plan.entries) {
    const c = clusters.at(-1);
    if (c && e.start < c.end) { c.items.push(e); if (e.end > c.end) c.end = e.end; } else clusters.push({ end: e.end, items: [e] });
  }
  return h('div', { class: 'parallel', 'data-testid': 'day-entries' },
    h('div', { class: 'par-head', style: { gridTemplateColumns: `repeat(${levels.length}, 1fr)` } }, levels.map(l => h('div', {}, l))),
    clusters.map(c => h('div', { class: 'par-row', style: { gridTemplateColumns: `repeat(${levels.length}, 1fr)` } }, c.items.map(e => {
      const lv = e.levels?.length ? e.levels : levels;
      const idx = lv.map(l => levels.indexOf(l)).filter(i => i >= 0).sort((a, b) => a - b);
      const from = idx[0] ?? 0, to = (idx.at(-1) ?? levels.length - 1) + 1;
      const card = entryCard(cls, e, inConflict);
      card.style.gridColumn = `${from + 1} / ${to + 1}`;
      return card;
    }))));
}

function entryCard(cls, e, inConflict) {
  const s = e.session;
  const done = e.status === 'faite' || e.status === 'partielle';
  const shown = done && e.occ?.snapshot ? e.occ.snapshot : s;
  const changedSince = done && e.occ?.snapshot && s && s.updatedAt > (e.occ.snapshot.updatedAt || '');
  const mode = e.mode && e.mode !== 'dirigé' ? badge(e.mode, PL.needsTeacher(e.mode) ? 'info' : 'muted') : null;
  const statusBadge = e.status !== 'prévue' ? badge(e.status, PL.OCC_STATUS[e.status]) : null;
  const cardCls = `entry card entry-${e.kind} status-${e.status} ${inConflict.has(e.key) ? 'conflict' : ''}`;

  if (e.kind === 'event') {
    return h('article', { class: cardCls, style: { borderLeftColor: '#7a5c8f' }, 'data-testid': 'entry' },
      h('div', { class: 'entry-head' }, h('span', { class: 'entry-time' }, e.allDay ? 'Journée' : `${e.start}–${e.end}`), h('strong', {}, e.title), badge(e.event.kind || 'événement', 'muted'), e.blocks ? badge('mobilise la classe', 'warn') : null),
      e.event.notes ? h('p', { class: 'small' }, e.event.notes) : null, h('a', { class: 'btn btn-link small', href: `#/agenda?d=${e.date}` }, 'Voir dans l’agenda'));
  }

  const header = h('div', { class: 'entry-head' },
    h('span', { class: 'entry-time' }, `${e.start}–${e.end}`), durLabel(e.start, e.end) ? h('span', { class: 'muted small' }, durLabel(e.start, e.end)) : null,
    h('span', { class: 'dot', style: { background: model.subjectColor(e.subject) } }), e.subject && e.subject !== e.title ? h('span', { class: 'muted' }, e.subject) : null,
    s ? h('a', { class: 'entry-title', href: `#/seance/${s.id}` }, e.title) : h('strong', { class: 'entry-title' }, e.title),
    mode, statusBadge, e.kind === 'intervention' || e.intervention ? badge('intervention', 'info') : null,
    e.occ?.postponedFrom ? badge(`report du ${model.frShort(store.get(e.occ.postponedFrom)?.date)}`, 'info') : null);

  const body = [];
  // Compétences officielles de la fiche (et de sa séquence) : le lien programme → cahier journal reste visible.
  const detailed = JD.isDetailed();
  const comps = [...new Set([...(shown?.competencyIds || []), ...(store.get(shown?.sequenceId)?.competencyIds || []), ...(e.occ?.competencyIds || []), ...(store.get(e.occ?.sequenceId)?.competencyIds || [])])];
  if (detailed && e.status !== 'reportée' && (shown || e.occ)) body.push(...JD.detailBlock(e, shown));
  else if (comps.length) { const idx = competencyIndex(); body.push(h('p', { class: 'small entry-comps', 'data-testid': 'entry-comps', title: comps.map(c => competencyLabel(c, idx)).join('\n') }, '🎯 ', comps.slice(0, 3).map(c => { const x = idx.get(c); return x ? (x.code || x.label.slice(0, 60)) : ''; }).filter(Boolean).join(' · '), comps.length > 3 ? ` (+${comps.length - 3})` : '')); }
  body.push(...activityDetails(e, shown));
  if (e.status === 'reportée') {
    const to = e.occ?.postponedTo && store.get(e.occ.postponedTo);
    body.push(h('p', { class: 'small' }, 'Reportée', to ? [' au ', h('a', { href: `#/cahier?d=${to.date}` }, `${model.frDate(to.date)} ${to.start}`)] : '', '. Les supports restent attachés à la fiche.'));
  } else if (shown) {
    if (changedSince) body.push(h('p', { class: 'small muted' }, 'Version réalisée affichée. La fiche a été modifiée depuis : ', h('a', { href: `#/seance/${s.id}` }, 'voir la version actuelle'), '.'));
    if (shown.objective && !detailed) body.push(h('p', { class: 'small' }, h('strong', {}, 'Objectif : '), shown.objective));
    if ((shown.phases || []).length && !detailed) body.push(h('ol', { class: 'phase-mini' }, shown.phases.map(ph => h('li', {}, `${ph.title || P.PHASE_KINDS[ph.kind]?.label || 'Phase'}${ph.duration ? ` · ${ph.duration} min` : ''}`))));
    const files = (shown.fileIds || []).map(id => store.get(id)).filter(f => f && !f.deletedAt);
    if (files.length) body.push(h('p', { class: 'small' }, icon('file', 14), ' ', files.map(f => f.kind === 'link' && safeUrl(f.url) ? h('a', { href: safeUrl(f.url), target: '_blank', rel: 'noopener noreferrer' }, f.name) : h('a', { href: `#/fichiers?open=${f.id}` }, f.name)).reduce((a, x) => [...a, a.length ? ', ' : '', x], [])));
  } else if (e.kind === 'intervention' || e.intervention) {
    const iv = e.intervention;
    body.push(h('p', { class: 'small' }, [iv?.contact, iv?.place, iv?.travelMin ? `déplacement ${iv.travelMin} min` : '', iv?.prepMin ? `préparation ${iv.prepMin} min` : ''].filter(Boolean).join(' · '), ' ', h('a', { href: '#/interventions' }, 'détails')));
  } else {
    body.push(h('div', { class: 'row' },
      h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'choose-session', onclick: () => chooseSession(cls, e) }, 'Choisir une fiche de séance'),
      h('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
        const created = await newSession(cls, { subject: e.subject });
        await PL.patchEntry(e, cls, { sessionId: created.id }, 'Nouvelle fiche programmée');
      } }, 'Nouvelle fiche')));
  }

  if (e.occ?.groups) body.push(h('div', { class: 'small entry-groups' }, h('strong', {}, `Groupes « ${e.occ.groups.name} » : `),
    e.occ.groups.groups.map(g => h('span', { class: 'gchip', style: { borderColor: g.color } }, `${g.name} (${g.memberIds.map(id => store.get(id)?.firstName).filter(Boolean).join(', ')})`))));
  const active = e.status !== 'reportée';
  const actions = h('div', { class: 'entry-actions' },
    active ? [['faite', 'Faite'], ['partielle', 'Partielle']].map(([st, l]) => h('button', { class: `btn btn-small ${e.status === st ? 'btn-primary' : ''}`, type: 'button', 'data-testid': `status-${st}`, onclick: () => PL.setStatus(e, cls, e.status === st ? 'prévue' : st) }, l)) : null,
    active && e.status !== 'faite' ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'postpone', onclick: () => postponeDialog(cls, e) }, 'Reporter…') : null,
    active ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => PL.setStatus(e, cls, e.status === 'annulée' ? 'prévue' : 'annulée') }, e.status === 'annulée' ? 'Rétablir' : 'Annuler') : null,
    h('details', { class: 'more' }, h('summary', { class: 'btn btn-small', 'data-testid': 'entry-more' }, 'Plus'), h('div', { class: 'more-menu', onclick: (ev) => { if (ev.target.closest('button')) ev.currentTarget.parentElement.open = false; } },
      h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'edit-activity', onclick: () => activityDialog(cls, e) }, 'Modifier l’activité (objectif, déroulement…)'),
      s && (e.slot?.id || e.occ?.slotId) ? (() => { const slotId = e.slot?.id || e.occ.slotId; const isHab = store.get(cls.id).habitual?.[slotId] === s.id;
        return h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'set-habitual', title: 'Cette fiche sera proposée sur ce créneau chaque semaine par « Pré-remplir la semaine »', onclick: () => CP.setHabitual(cls, slotId, isHab ? null : s.id).then(() => toast(isHab ? 'Fiche habituelle retirée' : `★ Fiche habituelle du créneau ${model.JOURS[model.weekday(e.date)].toLowerCase()} ${e.start}`)) }, isHab ? '☆ Ne plus en faire la fiche habituelle' : '★ Fiche habituelle de ce créneau'); })() : null,
      s && active ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'detach', title: 'Crée une copie de la fiche utilisée seulement à cette date', onclick: async () => {
        const c = await P.duplicateSession(s.id);
        await PL.patchEntry(e, cls, { sessionId: c.id }, `Fiche détachée pour le ${model.frShort(e.date)}`);
        toast('Copie créée pour ce jour : la fiche d’origine n’est pas modifiée.', { action: 'Ouvrir', onAction: () => { location.hash = `#/seance/${c.id}`; } });
      } }, 'Détacher (copie pour ce jour)') : null,
      s && active ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => PL.patchEntry(e, cls, { sessionId: null }, 'Fiche retirée du créneau') }, 'Retirer la fiche') : null,
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => homeworkDialog(cls, { givenDate: e.date, sessionId: s?.id || null, subject: e.subject }) }, 'Donner un devoir'),
      s ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => distributeLesson(cls, e) }, 'Leçon distribuée') : null,
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => boardPhoto(cls, e) }, 'Photo du tableau'),
      e.kind === 'occ' && !e.occ.slotId && !e.occ.interventionId ? h('button', { class: 'btn btn-small btn-ghost-danger', type: 'button', onclick: async () => {
        if (!await confirmDialog('Supprimer cette activité ponctuelle ?', 'La fiche de séance liée n’est pas supprimée.', { confirmLabel: 'Supprimer', danger: true })) return;
        await store.remove(e.occ.id, 'Activité ponctuelle supprimée');
      } }, 'Supprimer') : null)));

  const occ = e.occ || {};
  const bilan = active && (s || e.kind === 'occ' || e.date <= model.todayIso()) ? h('div', { class: 'entry-bilan' },
    bound({ label: 'Bilan express', value: occ.note, placeholder: 'ce qui a été fait, ajustements…', testid: 'bilan', compact: true,
      onSave: (v) => PL.patchEntry(e, cls, { note: v }, `Bilan du ${model.frShort(e.date)}`, { quiet: e.kind === 'occ' }) }),
    s ? h('details', { class: 'after' }, h('summary', {}, 'Après la séance'),
      h('div', { class: 'grid-2' }, P.AFTER_FIELDS.map(f => bound({ ...f, value: occ.after?.[f.key], compact: true,
        onSave: (v) => PL.patchEntry(e, cls, { after: { ...(e.kind === 'occ' ? store.get(e.occ.id).after : {}), [f.key]: v } }, `Après la séance : ${f.label}`, { quiet: e.kind === 'occ' }) })))) : null,
    null) : null;

  const diags = s ? diagramsOfSession(s.id) : [];
  const diagLinks = diags.length ? h('p', { class: 'small', 'data-testid': 'entry-diagrams' }, 'Schémas EPS : ', diags.map(x => h('a', { href: `#/eps/${x.id}` }, x.title)).reduce((a, x) => [...a, a.length ? ', ' : '', x], [])) : null;
  return h('article', { class: cardCls, style: { borderLeftColor: model.subjectColor(e.subject) }, 'data-testid': 'entry' }, header, body, diagLinks, bilan, actions);
}

async function chooseSession(cls, e) {
  const all = P.ofClass('session', cls.id);
  const items = all.sort((a, b) => (b.subject === e.subject) - (a.subject === e.subject)).map(s => ({ id: s.id, label: P.sessionTitle(s), detail: s.subject, group: s.sequenceId ? P.sequenceTitle(store.get(s.sequenceId)) : 'Hors séquence' }));
  const sel = await pickMany({ title: `Fiche pour le créneau ${e.start}–${e.end}`, items, single: true, emptyText: 'Aucune fiche : créez-en dans Préparer › Séquences ou Préparations.' });
  if (sel?.length) await PL.patchEntry(e, cls, { sessionId: sel[0] }, 'Fiche programmée');
}

export function postponeDialog(cls, e) {
  const cands = PL.postponeCandidates(cls, e);
  const custom = { date: model.addDays(e.date, 1), start: e.start, end: e.end };
  let m;
  const doIt = async (target) => {
    const id = await PL.postpone(e, cls, target);
    m.close();
    const o = store.get(id);
    toast(`Reportée au ${model.frDate(o.date)} à ${o.start}`, { action: 'Voir', onAction: () => { location.hash = `#/cahier?d=${o.date}`; } });
  };
  m = modal({ title: `Reporter « ${e.title} »`, wide: true, body: h('div', { class: 'form' },
    h('p', { class: 'muted' }, 'La séance d’origine reste dans le cahier journal, marquée « reportée », avec ses supports. La progression n’est pas décalée automatiquement.'),
    cands.length ? h('div', {}, h('p', {}, `Prochains créneaux libres${e.subject ? ` de ${e.subject}` : ''} :`), h('div', { class: 'quick-list', 'data-testid': 'postpone-candidates' }, cands.map(c => h('button', { class: 'quick-item', type: 'button', onclick: () => doIt(c) },
      h('strong', {}, `${model.frDate(c.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${c.entry.start}–${c.entry.end}`), h('span', { class: 'muted' }, c.entry.title))))) : h('p', { class: 'muted' }, 'Aucun créneau libre de cette discipline dans les 4 prochaines semaines.'),
    h('h3', {}, 'Ou à une date et un horaire précis'),
    h('div', { class: 'grid-3' },
      field('Date', h('input', { type: 'date', value: custom.date, onchange: (ev) => { custom.date = ev.target.value; } })),
      field('Début', h('input', { type: 'time', value: custom.start, onchange: (ev) => { custom.start = ev.target.value; } })),
      field('Fin', h('input', { type: 'time', value: custom.end, onchange: (ev) => { custom.end = ev.target.value; } }))),
    h('button', { class: 'btn', type: 'button', onclick: () => { if (!custom.date || !custom.start || custom.end <= custom.start) { toast('Date ou horaire invalide', { kind: 'error' }); return; } doIt({ date: custom.date, start: custom.start, end: custom.end }); } }, 'Reporter à cette date')),
  actions: [{ label: 'Fermer' }] });
}

async function boardPhoto(cls, e) {
  const files = await pickFiles({ accept: 'image/*,application/pdf' });
  if (!files.length) return;
  const created = await addFiles(files, null, { tags: ['tableau'], subject: e.subject || '' });
  const cur = e.kind === 'occ' ? store.get(e.occ.id).fileIds || [] : [];
  await PL.patchEntry(e, cls, { fileIds: [...cur, ...created.map(c => c.id)] }, 'Photo du tableau ajoutée');
}

async function distributeLesson(cls, e) {
  const ls = store.all('lesson').filter(l => (l.sessionIds || []).includes(e.session.id));
  if (!ls.length) { toast('Aucune leçon liée à cette fiche (Préparer › Leçons).', { kind: 'error' }); return; }
  const sel = ls.length === 1 ? [ls[0].id] : await pickMany({ title: 'Leçon(s) distribuée(s)', items: ls.map(l => ({ id: l.id, label: `n° ${l.number} — ${l.title}` })) });
  if (!sel?.length) return;
  await store.batch(sel.map(id => ({ id, patch: { distributions: [...(store.get(id).distributions || []), { id: store.uid(), date: e.date, targets: (e.levels || []).join(', '), note: '' }] } })), `Leçon distribuée le ${model.frShort(e.date)}`);
  toast('Distribution enregistrée');
}

// ───────── Semaine
function weekView(cls, date, nav) {
  const monday = model.mondayOf(date);
  const days = model.classDays(cls).map(d => model.addDays(monday, d - 1));
  const rows = PL.materials(cls, days);
  return h('div', { class: 'page' },
    pageHeader('Cahier journal — semaine', { favKey: 'planifier/cahier', subtitle: `${cls.name} · semaine du ${model.frDate(monday)}`,
      actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'prefill-week', onclick: () => prefillDialog(cls, monday) }, 'Préparer la semaine'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'export-journal', onclick: () => exportDialog(cls, monday) }, icon('download', 16), 'Exporter…'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'print-week', onclick: () => printDocument(printWeek(cls, monday), { orientation: 'landscape' }) }, icon('print', 16), 'Imprimer la semaine'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'print-dossier', onclick: () => printDocument(printWeekDossier(cls, monday)) }, icon('print', 16), 'Dossier de la semaine'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'clear-journal', onclick: () => clearDialog(cls, monday, 'semaine') }, 'Vider…')] }),
    subTabs(), nav,
    prepareBanner(cls, monday),
    h('div', { class: 'week', style: { gridTemplateColumns: `repeat(${days.length}, minmax(160px, 1fr))` }, 'data-testid': 'week' }, days.map(d => {
      const p = PL.dayPlan(cls, d);
      return h('div', { class: 'week-day' }, h('a', { class: 'week-title', href: `#/cahier?d=${d}` }, model.frDate(d, { weekday: 'long', day: 'numeric' })),
        !p.myDay && p.school.ok ? h('p', { class: 'muted small' }, `jour de ${cls.binome?.name || 'la binôme'}`) : null,
        p.warnings.length ? badge(`${p.warnings.length} conflit(s)`, 'warn') : null,
        p.school.ok || p.entries.length ? p.entries.map(e => h('a', { class: `week-entry status-${e.status}`, href: `#/cahier?d=${d}`, style: { borderLeftColor: model.subjectColor(e.subject) } },
          h('span', { class: 'small muted' }, `${e.start} ${e.subject || ''}`), h('span', {}, e.title), e.status !== 'prévue' ? badge(e.status, PL.OCC_STATUS[e.status]) : null)) : h('p', { class: 'muted small' }, p.school.reason));
    })),
    h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Matériel et photocopies de la semaine'),
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => printDocument(printMaterials(cls, days, `Matériel et photocopies — semaine du ${model.frDate(monday)}`)) }, icon('print', 14), 'Imprimer')),
      rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table', 'data-testid': 'materials' }, h('thead', {}, h('tr', {}, ['Jour', 'Séance', 'À préparer', 'Exemplaires', 'Statut'].map(t => h('th', {}, t)))),
        h('tbody', {}, rows.map(r => h('tr', {}, h('td', {}, model.frDate(r.date, { weekday: 'short', day: 'numeric' })), h('td', {}, `${r.entry.start} ${r.entry.title}`), h('td', {}, r.label), h('td', {}, r.kind === 'copie' ? String(r.count) : ''),
          h('td', {}, r.kind === 'copie' ? bound({ type: 'select', value: r.status, options: ['à faire', 'imprimé', 'prêt'], onSave: (v) => PL.patchEntry(r.entry, cls, { copyStatus: { ...(r.entry.occ ? store.get(r.entry.occ.id).copyStatus : {}), [r.id]: v } }, `Photocopie : ${v}`) }) : ''))))))
        : h('p', { class: 'muted' }, 'Rien à préparer : les rubriques « À préparer », « À imprimer », « À projeter » et les photocopies des fiches programmées cette semaine apparaissent ici.')));
}

// ───────── Préparer la semaine : depuis l'EDT (fiches habituelles + progressions) ou semaine vierge
function prefillDialog(cls, date) {
  const monday = model.mondayOf(date);
  let mode = PL.isBlankWeek(cls, monday) ? 'vierge' : 'edt';
  const lastMonday = CP.lastMondayOfPeriod(cls, monday);
  let span = 'semaine', props = [], chosen = new Set();
  const asDefault = h('input', { type: 'checkbox', 'data-testid': 'week-mode-default' });
  const spanSel = h('select', { 'data-testid': 'prefill-span', 'aria-label': 'Jusqu’à', onchange: (e) => { span = e.target.value; compute(); draw(); } },
    h('option', { value: 'semaine' }, 'Cette semaine seulement'),
    lastMonday > monday ? h('option', { value: 'vacances' }, `Jusqu’aux vacances (${Math.round((Date.parse(lastMonday) - Date.parse(monday)) / 6048e5) + 1} semaines)`) : null);
  const compute = () => { props = span === 'vacances' ? CP.rangeProposals(cls, monday, lastMonday) : CP.weekProposals(cls, monday); chosen = new Set(props.map((_, i) => i)); };
  const listOf = () => props.length ? h('div', { class: 'stack' },
    h('p', { class: 'muted small' }, 'Créneaux de l’emploi du temps encore vides : la fiche habituelle du créneau (★), sinon la séance suivante de votre progression. Décochez ce que vous ne voulez pas. Ce qui est déjà rempli, fait, reporté ou annulé n’est pas touché. Tout reste modifiable ensuite.'),
    h('p', { class: 'small' }, badge(`${props.length} créneau(x) à pré-remplir`, 'info')),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table', 'data-testid': 'prefill-list' }, h('tbody', {}, props.map((p, i) => h('tr', {},
      h('td', {}, h('input', { type: 'checkbox', checked: true, 'aria-label': 'Garder', onchange: (ev) => { ev.target.checked ? chosen.add(i) : chosen.delete(i); } })),
      h('td', { class: 'nowrap' }, model.frDate(p.entry.date, { weekday: 'short', day: 'numeric', month: span === 'vacances' ? 'short' : undefined }), ' ', p.entry.start),
      h('td', {}, p.entry.subject || ''),
      h('td', {}, P.sessionTitle(store.get(p.sessionId))),
      h('td', {}, badge(p.source === 'habituelle' ? '★ habituelle' : 'progression', p.source === 'habituelle' ? 'info' : 'muted'))))))))
    : h('div', { class: 'small' }, h('p', {}, 'Aucune fiche à proposer : les créneaux de l’EDT sont posés vides (matière et horaire), à compléter à la main.'), h('ul', {},
      h('li', {}, 'Fiches habituelles : dans un créneau qui a une fiche, menu « Plus » › « ★ Fiche habituelle de ce créneau » (rituels, lecture quotidienne…).'),
      h('li', {}, 'Progressions : Préparer › Progressions, lignes de la semaine reliées à une séquence ou une séance.')));
  const vierge = h('p', { class: 'small' }, 'La semaine part de zéro : l’emploi du temps n’est pas posé. Ajoutez vos activités avec « + Activité » dans la vue Jour. Les séances déjà notées cette semaine restent.');
  const zone = h('div');
  const draw = () => zone.replaceChildren(mode === 'edt' ? h('div', { class: 'stack' }, h('label', { class: 'inline small' }, 'Pré-remplir : ', spanSel), listOf()) : vierge);
  const radio = (v, label) => h('label', { class: 'inline' }, h('input', { type: 'radio', name: 'weekmode', value: v, checked: mode === v, 'data-testid': `week-mode-${v}`, onchange: () => { mode = v; draw(); } }), label);
  compute(); draw();
  modal({ title: `Préparer la semaine du ${model.frDate(monday)}`, wide: true, body: h('div', { class: 'stack' },
    h('div', { class: 'stack' }, radio('edt', 'Construire la semaine avec l’emploi du temps (et pré-remplir les fiches)'), radio('vierge', 'Partir d’une semaine vierge')),
    h('label', { class: 'inline small' }, asDefault, 'Faire de ce choix le réglage par défaut pour les semaines suivantes'),
    zone),
  actions: [{ label: 'Annuler' }, { label: 'Valider', primary: true, testid: 'prefill-apply', onClick: async () => {
    const weeks = mode === 'edt' && span === 'vacances' ? [...new Set(props.map(p => model.mondayOf(p.entry.date)).concat(monday))] : [monday];
    for (const m of weeks) await PL.setWeekMode(cls, m, mode);
    if (asDefault.checked) await store.update(cls.id, { journalMode: mode }, 'Mode par défaut du cahier journal');
    if (mode === 'edt') {
      const n = await CP.applyProposals(cls, props.filter((_, i) => chosen.has(i)));
      toast(n ? `${n} créneau(x) rempli(s). Modifiables à tout moment ; annulable.` : 'Semaine construite depuis l’emploi du temps.', { action: n ? 'Annuler' : null, onAction: () => store.undo() });
    } else toast('Semaine vierge : ajoutez vos activités avec « + Activité ».');
  } }] });
}

/** Bandeau : semaine pas encore préparée alors que des fiches peuvent être proposées. */
function prepareBanner(cls, date) {
  const monday = model.mondayOf(date);
  if (store.get(cls.id)?.weekMode?.[monday] || PL.isBlankWeek(cls, monday)) return null;
  const n = CP.weekProposals(cls, monday).length;
  if (!n) return null;
  return h('div', { class: 'banner info row wrap', 'data-testid': 'prepare-banner' },
    h('span', {}, `Semaine pas encore préparée : ${n} créneau(x) de l’emploi du temps peuvent être pré-remplis avec vos fiches habituelles et vos progressions. Vous n’aurez plus qu’à modifier.`),
    h('button', { class: 'btn btn-small btn-primary', type: 'button', 'data-testid': 'prepare-banner-go', onclick: () => prefillDialog(cls, monday) }, 'Préparer maintenant'));
}

function detailToggle() {
  const on = JD.isDetailed();
  return h('div', { class: 'seg seg-inline', role: 'group', 'aria-label': 'Affichage' }, [[true, 'Détaillé'], [false, 'Compact']].map(([v, l]) =>
    h('button', { type: 'button', class: on === v ? 'on' : '', 'data-testid': `journal-${v ? 'detail' : 'compact'}`, onclick: () => { JD.setDetailed(v); rerender(); } }, l)));
}

// ───────── Vider : un jour, une semaine, un mois, une période ou des dates choisies (annulable)
export function journalToClear(cls, a, b, { planned = true, adhoc = true, done = false } = {}) {
  return store.all('occurrence').filter(o => o.classId === cls.id && o.date >= a && o.date <= b && (
    (['faite', 'partielle'].includes(o.status) ? done : (o.slotId || o.interventionId ? planned : adhoc))));
}
function clearDialog(cls, date, initial = 'jour') {
  const kind = h('select', { 'data-testid': 'clear-kind' }, [['jour', 'Le jour affiché'], ['semaine', 'La semaine'], ['mois', 'Le mois'], ['periode', 'La période'], ['dates', 'Des dates choisies']].map(([v, l]) => h('option', { value: v, selected: v === initial }, l)));
  const from = h('input', { type: 'date', value: date, 'aria-label': 'Du', 'data-testid': 'clear-from' }), to = h('input', { type: 'date', value: model.addDays(date, 6), 'aria-label': 'Au', 'data-testid': 'clear-to' });
  const datesRow = h('div', { class: 'row', hidden: true }, 'Du', from, 'au', to);
  const box = (label, checked, testid) => { const i = h('input', { type: 'checkbox', checked, 'data-testid': testid }); return [i, h('label', { class: 'inline' }, i, label)]; };
  const [planned, plannedL] = box('Les fiches placées dans les créneaux de l’emploi du temps (les créneaux redeviennent vides)', true, 'clear-planned');
  const [adhoc, adhocL] = box('Les activités ajoutées à la main', true, 'clear-adhoc');
  const [done, doneL] = box('Aussi les séances déjà marquées faites ou partielles (leur trace sera perdue)', false, 'clear-done');
  const [blank, blankL] = box('Ne plus poser l’emploi du temps sur ces semaines (semaines vierges)', false, 'clear-blank');
  const info = h('p', { class: 'small', 'data-testid': 'clear-info' });
  const range = () => CP.rangeOf(kind.value, date, cls, from.value, to.value);
  const upd = () => { datesRow.hidden = kind.value !== 'dates'; const [a, b] = range(); const n = journalToClear(cls, a, b, { planned: planned.checked, adhoc: adhoc.checked, done: done.checked }).length;
    info.textContent = `Du ${model.frShort(a)} au ${model.frShort(b)} : ${n} élément(s) retiré(s) du cahier journal. Les fiches de séance elles-mêmes ne sont pas supprimées. Annulable.`; };
  [kind, from, to, planned, adhoc, done].forEach(x => x.addEventListener('change', upd)); upd();
  modal({ title: 'Vider le cahier journal', body: h('div', { class: 'form' }, field('Période', kind), datesRow, plannedL, adhocL, doneL, blankL, info),
    actions: [{ label: 'Annuler' }, { label: 'Vider', danger: true, testid: 'clear-go', onClick: async () => {
      const [a, b] = range();
      const list = journalToClear(cls, a, b, { planned: planned.checked, adhoc: adhoc.checked, done: done.checked });
      const at = new Date().toISOString();
      const items = list.map(o => ({ id: o.id, patch: { deletedAt: at } }));
      if (blank.checked) { const wm = { ...(store.get(cls.id).weekMode || {}) }; for (let m = model.mondayOf(a); m <= b; m = model.addDays(m, 7)) wm[m] = 'vierge'; items.push({ id: cls.id, patch: { weekMode: wm } }); }
      if (!items.length) { toast('Rien à vider sur cette période.'); return; }
      await store.batch(items, `Cahier journal vidé du ${model.frShort(a)} au ${model.frShort(b)}`);
      toast(`${list.length} élément(s) retiré(s).`, { action: 'Annuler', onAction: () => store.undo(), timeout: 12000 });
    } }] });
}

// ───────── Exporter : jour, semaine, mois, période, année ou dates choisies
function exportDialog(cls, date) {
  const kind = h('select', { 'data-testid': 'export-kind' }, [['jour', 'Le jour affiché'], ['semaine', 'La semaine'], ['mois', 'Le mois'], ['periode', 'La période (entre deux vacances)'], ['annee', 'Toute l’année'], ['dates', 'Des dates choisies']].map(([v, l]) => h('option', { value: v, selected: v === 'semaine' }, l)));
  const from = h('input', { type: 'date', value: date, 'aria-label': 'Du' }), to = h('input', { type: 'date', value: model.addDays(date, 6), 'aria-label': 'Au' });
  const datesRow = h('div', { class: 'row', hidden: true }, 'Du', from, 'au', to);
  const format = h('select', { 'data-testid': 'export-format' }, [['detail', 'Détaillé : une page par jour (PDF / impression)'], ['semaines', 'Compact : une page par semaine (PDF / impression)'], ['csv', 'Tableau (CSV, pour Excel ou LibreOffice)']].map(([v, l]) => h('option', { value: v }, l)));
  const info = h('p', { class: 'muted small', 'data-testid': 'export-info' });
  const upd = () => { datesRow.hidden = kind.value !== 'dates'; const [a, b] = CP.rangeOf(kind.value, date, cls, from.value, to.value); const n = CP.schoolDaysBetween(cls, a, b).length; info.textContent = `Du ${model.frShort(a)} au ${model.frShort(b)} : ${n} jour(s) de classe.${n > 40 && format.value === 'detail' ? ' Document long : préférez « Compact » ou « Tableau ».' : ''}`; };
  [kind, from, to, format].forEach(x => x.addEventListener('change', upd)); upd();
  modal({ title: 'Exporter le cahier journal', body: h('div', { class: 'form' }, field('Période', kind), datesRow, field('Format', format), info,
    h('p', { class: 'muted small' }, 'Pour un PDF : choisissez « Enregistrer au format PDF » dans la fenêtre d’impression.')),
  actions: [{ label: 'Annuler' }, { label: 'Exporter', primary: true, testid: 'export-go', onClick: () => {
    const [a, b] = CP.rangeOf(kind.value, date, cls, from.value, to.value);
    if (b < a) { toast('La date de fin précède la date de début.', { kind: 'error' }); return false; }
    const days = CP.schoolDaysBetween(cls, a, b);
    if (!days.length) { toast('Aucun jour de classe sur ces dates.', { kind: 'error' }); return false; }
    if (format.value === 'csv') { download(`cahier-journal-${a}-${b}.csv`, CP.csvOf(cls, days), 'text/csv;charset=utf-8'); return; }
    if (format.value === 'detail') { printDocument(h('div', {}, days.map((d, i) => h('div', { class: i ? 'page-break' : '' }, printDay(cls, d))))); return; }
    const mondays = [...new Set(days.map(d => model.mondayOf(d)))];
    printDocument(h('div', {}, mondays.map((m, i) => h('div', { class: i ? 'page-break' : '' }, printWeek(cls, m)))), { orientation: 'landscape' });
  } }] });
}
