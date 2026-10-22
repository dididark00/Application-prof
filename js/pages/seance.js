// Fiche de séance (modèle « Fiche séance » de l’enseignante) : modèle réutilisable, distinct
// des séances datées du cahier journal qui y renvoient par lien.
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import * as PL from '../planning.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { bound, iconBtn, pickMany } from '../forms.js';
import { sectionFields, competencyBlock, filesBlock, manualRefsBlock, levelChips } from '../pedago-ui.js';
import { printDocument } from '../print.js';
import { printSession } from '../printdocs.js';

let rerender = () => {};
const ui = { showAll: false };

export function render({ params, rerender: rr }) {
  rerender = rr;
  if (params[0]) return detail(params[0]);
  return list();
}

// ───────── Liste des fiches de séance
const filt = { subject: '', q: '' };
function list() {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Préparations'), subTabs(), missing);
  const all = P.ofClass('session', cls.id).filter(s => (!filt.subject || s.subject === filt.subject) && (!filt.q || `${s.title} ${s.objective || ''}`.toLowerCase().includes(filt.q.toLowerCase())));
  const groups = new Map();
  for (const s of all) { const k = s.sequenceId || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
  const keys = [...groups.keys()].sort((a, b) => (a ? P.sequenceTitle(store.get(a)) : '~').localeCompare(b ? P.sequenceTitle(store.get(b)) : '~', 'fr', { numeric: true }));
  return h('div', { class: 'page' },
    pageHeader('Fiches de séance', { favKey: 'preparer/preparations', subtitle: `${cls.name} · modèles réutilisables ; chaque date du cahier journal y renvoie par lien`,
      actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-session', onclick: () => newSession(cls) }, icon('plus', 16), 'Nouvelle fiche')] }),
    subTabs(),
    h('div', { class: 'filters' },
      h('input', { type: 'search', placeholder: 'Filtrer…', value: filt.q, 'aria-label': 'Filtrer', onchange: (e) => { filt.q = e.target.value; rerender(); } }),
      h('select', { 'aria-label': 'Discipline', onchange: (e) => { filt.subject = e.target.value; rerender(); } }, h('option', { value: '' }, 'Toutes disciplines'), model.subjects().map(s => h('option', { value: s, selected: filt.subject === s }, s)))),
    all.length ? keys.map(k => h('section', { class: 'card' },
      h('h2', {}, k ? h('a', { href: `#/sequence/${k}` }, P.sequenceTitle(store.get(k))) : 'Séances hors séquence'),
      h('ul', { class: 'session-list' }, groups.get(k).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(s => sessionLine(s)))))
      : emptyState('Aucune fiche de séance', 'Créez une fiche isolée ici, ou depuis une séquence pour qu’elle y soit numérotée.'));
}

export function sessionLine(s) {
  const occ = P.occurrencesOfSession(s.id);
  const done = occ.filter(o => o.status === 'faite').length;
  return h('li', {}, h('a', { href: `#/seance/${s.id}` }, P.sessionTitle(s)),
    h('span', { class: 'muted small' }, ` · ${s.subject || ''}${P.sessionDuration(s) ? ' · ' + model.durationLabel(P.sessionDuration(s)) : ''}`),
    s.mode === 'visite' ? badge('visite', 'info') : null,
    occ.length ? badge(`${done}/${occ.length} faite(s)`, done ? 'ok' : 'muted') : null);
}

export async function newSession(cls, { sequenceId = null, subject = '' } = {}) {
  const seq = sequenceId ? store.get(sequenceId) : null;
  const s = await store.create('session', {
    classId: cls.id, sequenceId, title: '', subject: subject || seq?.subject || '', subdomain: seq?.subdomain || '', levels: seq?.levels || [],
    order: sequenceId ? (P.sessionsOfSequence(sequenceId).at(-1)?.order ?? 0) + 1 : 0, mode: 'quotidien', teacherMode: 'dirigé',
    phases: P.defaultPhases(), competencyIds: [], fileIds: [], manualRefs: [], copies: [], variants: [], checklist: {},
  }, seq ? `Nouvelle séance dans ${seq.title}` : 'Nouvelle fiche de séance');
  location.hash = `#/seance/${s.id}`;
  return s;
}

// ───────── Fiche
function detail(id) {
  const s = store.get(id);
  if (!s || s.deletedAt) return h('div', { class: 'page' }, pageHeader('Fiche introuvable'), h('a', { href: '#/preparations' }, '← Fiches de séance'));
  const cls = store.get(s.classId);
  const seq = s.sequenceId ? store.get(s.sequenceId) : null;
  const visit = s.mode === 'visite';
  const full = visit || ui.showAll;
  const occ = P.occurrencesOfSession(s.id);
  const n = P.sessionNumber(s);
  const multi = (cls.levels || []).length > 1;
  const save = (patch, label, quiet = true) => store.update(s.id, patch, label, { quiet });

  const ident = h('section', { class: 'card' }, h('h2', {}, 'Identification'),
    h('div', { class: 'grid-3' },
      bound({ label: 'Séquence', type: 'select', value: s.sequenceId || '', testid: 'f-sequence', options: [['', '— hors séquence —'], ...P.ofClass('sequence', cls.id).map(x => [x.id, P.sequenceTitle(x)])],
        onSave: async (v) => { await save({ sequenceId: v || null, order: v ? (P.sessionsOfSequence(v).at(-1)?.order ?? 0) + 1 : 0 }, 'Séquence de la séance', false); } }),
      h('div', { class: 'field' }, h('label', {}, 'Séance n°'), h('p', { class: 'static' }, n ? String(n) : '—')),
      bound({ label: 'Titre de la séance', type: 'text', value: s.title, testid: 'f-title', onSave: (v) => save({ title: v }, 'Titre') })),
    h('div', { class: 'grid-3' },
      bound({ label: 'Discipline / domaine', type: 'select', value: s.subject || '', options: ['', ...model.subjects()], testid: 'f-subject', onSave: (v) => save({ subject: v }, 'Discipline') }),
      bound({ label: 'Sous-domaine', type: 'text', value: s.subdomain, onSave: (v) => save({ subdomain: v }, 'Sous-domaine') }),
      bound({ label: 'Durée prévue (min)', type: 'number', value: s.duration, placeholder: String(P.sessionDuration({ phases: s.phases }) || ''), hint: 'Vide : somme des phases', onSave: (v) => save({ duration: v }, 'Durée') })),
    h('div', { class: 'grid-3' },
      bound({ label: 'Organisation', type: 'text', value: s.organisation, placeholder: 'collectif / individuel / binômes / groupes', onSave: (v) => save({ organisation: v }, 'Organisation') }),
      bound({ label: 'Encadrement (cahier journal)', type: 'select', value: s.teacherMode || 'dirigé', options: PL.MODES.slice(0, 5).map(m => [m[0], m[1]]), onSave: (v) => save({ teacherMode: v }, 'Encadrement') }),
      h('div', { class: 'field' }, h('label', {}, 'Niveau(x)'), levelChips(s.levels || [], cls.levels || [], (v) => save({ levels: v }, 'Niveaux')))),
    h('div', { class: 'field' }, h('label', {}, 'Dates (cahier journal)'),
      occ.length ? h('ul', { class: 'plain', 'data-testid': 'session-dates' }, occ.map(o => h('li', {}, h('a', { href: `#/cahier?d=${o.date}` }, `${model.frDate(o.date, { weekday: 'short', day: 'numeric', month: 'short' })} ${o.start || ''}`), ' ', badge(o.status, PL.OCC_STATUS[o.status]))))
        : h('p', { class: 'muted small' }, 'Pas encore programmée.')));

  const objectifs = h('section', { class: 'card' }, h('h2', {}, 'Objectifs et compétences'), sectionFields(s.id, P.SESSION_SECTIONS[0].fields), competencyBlock(s.id, { levels: s.levels?.length ? s.levels : cls.levels }));
  const materiel = h('section', { class: 'card' }, h('h2', {}, 'Préparation matérielle'), sectionFields(s.id, P.SESSION_SECTIONS[1].fields), copiesBlock(s, cls), filesBlock(s.id, { title: 'Supports liés (fichiers, diaporamas, liens)' }), manualRefsBlock(s.id));

  const variants = multi ? h('section', { class: 'card' }, h('h2', {}, 'Multiniveau : objectifs, consignes et supports par niveau'),
    h('p', { class: 'muted small' }, 'Pour une séance commune à plusieurs niveaux, précisez ce qui diffère.'),
    h('div', { class: 'grid-2' }, (s.levels?.length ? s.levels : cls.levels).map(l => {
      const v = (s.variants || []).find(x => x.level === l) || { level: l };
      const setV = (k) => (val) => { const cur = store.get(s.id).variants || []; const next = cur.some(x => x.level === l) ? cur.map(x => x.level === l ? { ...x, [k]: val } : x) : [...cur, { level: l, [k]: val }]; return save({ variants: next }, `Variante ${l}`); };
      return h('div', { class: 'variant' }, h('h3', {}, l),
        bound({ label: 'Objectif', value: v.objective, onSave: setV('objective') }),
        bound({ label: 'Consigne', value: v.consigne, onSave: setV('consigne') }),
        bound({ label: 'Support', value: v.support, onSave: setV('support') }));
    }))) : null;

  const phases = h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, `Déroulement — ${model.durationLabel(P.sessionDuration({ phases: s.phases })) || 'durées à compléter'}`),
      visit ? null : h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: ui.showAll, onchange: (e) => { ui.showAll = e.target.checked; rerender(); } }), 'Toutes les rubriques')),
    (s.phases || []).map((ph, i) => phaseCard(s, ph, i, full)),
    h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Ajouter une phase :'), Object.entries(P.PHASE_KINDS).map(([k, d]) =>
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => save({ phases: [...(store.get(s.id).phases || []), { id: store.uid(), kind: k, title: '', duration: null }] }, 'Phase ajoutée', false) }, d.label))));

  const reuse = occ.filter(o => o.after && Object.values(o.after).some(Boolean));
  const after = h('section', { class: 'card' }, h('h2', {}, 'Après la séance'),
    h('p', { class: 'muted small' }, 'Le bilan se saisit pour chaque date dans le cahier journal : il ne modifie pas cette fiche, qui reste réutilisable.'),
    reuse.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Date'), P.AFTER_FIELDS.map(f => h('th', {}, f.label)))),
      h('tbody', {}, reuse.map(o => h('tr', {}, h('td', {}, h('a', { href: `#/cahier?d=${o.date}` }, model.frShort(o.date))), P.AFTER_FIELDS.map(f => h('td', {}, o.after[f.key] || ''))))))) : h('p', { class: 'muted' }, 'Aucun bilan saisi pour l’instant.'),
    bound({ label: 'Notes pour la prochaine utilisation de la fiche', value: s.reuseNotes, onSave: (v) => save({ reuseNotes: v }, 'Notes de réutilisation') }));

  const checklist = visit ? h('section', { class: 'card' }, h('h2', {}, 'Checklist avant visite / INSPE'),
    h('div', { class: 'checklist' }, P.VISIT_CHECKLIST.map(([k, l]) => bound({ type: 'checkbox', label: l, value: s.checklist?.[k], onSave: (v) => save({ checklist: { ...(store.get(s.id).checklist || {}), [k]: v } }, `Checklist : ${l}`) })))) : null;

  const links = linksSection(s);

  return h('div', { class: 'page' },
    h('p', {}, seq ? h('a', { href: `#/sequence/${seq.id}`, class: 'back' }, `← ${P.sequenceTitle(seq)}`) : h('a', { href: '#/preparations', class: 'back' }, '← Fiches de séance')),
    pageHeader(P.sessionTitle(s), { subtitle: [cls.name, s.subject, (s.levels?.length ? s.levels : cls.levels).join(', '), s.copiedFrom ? 'copie indépendante' : null].filter(Boolean).join(' · '),
      actions: [
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Niveau de détail' }, [['quotidien', 'Quotidien'], ['visite', 'Visite']].map(([m, l]) =>
          h('button', { type: 'button', class: (s.mode || 'quotidien') === m ? 'on' : '', 'data-testid': `mode-${m}`, onclick: () => save({ mode: m }, `Mode ${l}`, false) }, l))),
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'schedule', onclick: () => scheduleDialog(s, cls) }, icon('calendar', 16), 'Programmer'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'duplicate-session', title: 'Crée une copie indépendante : la modifier ne change pas cette fiche', onclick: async () => { const c = await P.duplicateSession(s.id); toast('Copie indépendante créée'); location.hash = `#/seance/${c.id}`; } }, icon('copy', 16), 'Dupliquer'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'print-session', onclick: () => printDocument(printSession(s.id)) }, icon('print', 16), 'Imprimer'),
        h('button', { class: 'btn', type: 'button', onclick: () => printDocument(printSession(s.id, { blank: true })) }, 'Version vierge'),
        h('button', { class: 'btn btn-ghost-danger', type: 'button', 'aria-label': 'Mettre à la corbeille', onclick: async () => {
          const planned = occ.filter(o => o.status === 'prévue').length;
          if (!await confirmDialog('Mettre la fiche à la corbeille ?', `${occ.length ? `Elle est utilisée à ${occ.length} date(s) du cahier journal${planned ? `, dont ${planned} à venir` : ''}. Ces dates gardent le lien et retrouveront la fiche si vous la restaurez. ` : ''}Vous pourrez la restaurer depuis la corbeille.`, { confirmLabel: 'Mettre à la corbeille', danger: true })) return;
          await store.remove(s.id, `Fiche « ${s.title} » mise à la corbeille`); location.hash = seq ? `#/sequence/${seq.id}` : '#/preparations';
        } }, icon('trash', 16))] }),
    s.copiedFrom && store.get(s.copiedFrom) ? h('p', { class: 'muted small' }, 'Copie de ', h('a', { href: `#/seance/${s.copiedFrom}` }, P.sessionTitle(store.get(s.copiedFrom))), ' : les deux fiches évoluent séparément.') : null,
    visit ? h('p', { class: 'muted small' }, 'Mode visite : toutes les rubriques sont affichées et imprimées. Ce modèle reprend votre fiche personnelle ; il n’est pas un format imposé par l’inspection.') : null,
    ident, objectifs, materiel, variants, phases, after, checklist, links);
}

function phaseCard(s, ph, i, full) {
  const def = P.PHASE_KINDS[ph.kind] || P.PHASE_KINDS.libre;
  const update = (patch, label, quiet = true) => store.update(s.id, { phases: store.get(s.id).phases.map(x => x.id === ph.id ? { ...x, ...patch } : x) }, label, { quiet });
  const essential = ['duration', 'but', 'consigne', 'exercices', 'question', 'trace', 'tableau', 'verification', 'suite'];
  const fields = def.fields.filter(f => full || essential.includes(f.key) || ph[f.key]);
  const hidden = def.fields.length - fields.length;
  const move = (dir) => { const arr = store.get(s.id).phases.slice(); const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; return store.update(s.id, { phases: arr }, 'Phase déplacée'); };
  return h('div', { class: 'phase', 'data-testid': 'phase' },
    h('div', { class: 'phase-head' },
      h('strong', {}, `Phase ${i + 1} — `),
      bound({ type: 'select', value: ph.kind, options: Object.entries(P.PHASE_KINDS).map(([k, d]) => [k, d.label]), onSave: (v) => update({ kind: v }, 'Type de phase', false) }),
      bound({ type: 'text', value: ph.title, placeholder: 'titre (facultatif)', compact: true, onSave: (v) => update({ title: v }, 'Titre de phase') }),
      h('span', { class: 'row-actions' }, iconBtn('up', 'Monter', () => move(-1)), iconBtn('down', 'Descendre', () => move(1)),
        iconBtn('trash', 'Supprimer la phase', async () => { await store.update(s.id, { phases: store.get(s.id).phases.filter(x => x.id !== ph.id) }, 'Phase supprimée'); toast('Phase supprimée', { action: 'Annuler', onAction: () => store.undo() }); }))),
    h('div', { class: 'phase-grid' }, fields.map(f => bound({ ...f, value: ph[f.key], testid: `ph-${f.key}`, onSave: (v) => update({ [f.key]: v }, `${def.label} : ${f.label}`) }))),
    hidden ? h('p', { class: 'muted small' }, `${hidden} rubrique(s) vide(s) masquée(s) — cochez « Toutes les rubriques » ou passez en mode Visite.`) : null);
}

function copiesBlock(s, cls) {
  const copies = s.copies || [];
  const save = (next, label, quiet = true) => store.update(s.id, { copies: next }, label, { quiet });
  const n = model.studentsOfClass(cls.id).filter(x => !(s.levels?.length) || s.levels.includes(x.enrollment.level)).length;
  return h('div', { class: 'linked' },
    h('div', { class: 'linked-head' }, h('strong', {}, 'Photocopies'), h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'add-copy', onclick: () => save([...copies, { id: store.uid(), label: '', perStudent: 1, extra: 2 }], 'Photocopie ajoutée', false) }, 'Ajouter')),
    copies.length ? h('div', { class: 'stack-sm' }, copies.map(c => h('div', { class: 'copy-row' },
      bound({ type: 'text', value: c.label, placeholder: 'document (ex. fiche exercices p. 12)', compact: true, onSave: (v) => save(store.get(s.id).copies.map(x => x.id === c.id ? { ...x, label: v } : x), 'Photocopie') }),
      h('label', { class: 'inline small' }, 'par élève', bound({ type: 'number', value: c.perStudent, onSave: (v) => save(store.get(s.id).copies.map(x => x.id === c.id ? { ...x, perStudent: v } : x), 'Photocopie', false) })),
      h('label', { class: 'inline small' }, '+ en plus', bound({ type: 'number', value: c.extra, onSave: (v) => save(store.get(s.id).copies.map(x => x.id === c.id ? { ...x, extra: v } : x), 'Photocopie', false) })),
      h('span', { class: 'muted small' }, `= ${n * (Number(c.perStudent) || 0) + (Number(c.extra) || 0)} ex. (${n} élèves)`),
      iconBtn('x', 'Retirer', () => save(copies.filter(x => x.id !== c.id), 'Photocopie retirée', false))))) : h('p', { class: 'muted small' }, 'Le nombre d’exemplaires est calculé à partir des élèves inscrits, et regroupé chaque semaine dans le cahier journal.'));
}

function linksSection(s) {
  const progRows = store.all('progression').flatMap(p => (p.rows || []).filter(r => r.sessionId === s.id || (!r.sessionId && r.sequenceId && r.sequenceId === s.sequenceId)).map(r => ({ p, r })));
  const lessons = store.all('lesson').filter(l => (l.sessionIds || []).includes(s.id));
  const hw = store.all('homework').filter(x => x.sessionId === s.id);
  return h('section', { class: 'card' }, h('h2', {}, 'Liens'),
    h('ul', { class: 'plain' },
      h('li', {}, h('strong', {}, 'Progression : '), progRows.length ? progRows.map(({ p, r }) => h('a', { href: `#/progression/${p.id}` }, `${p.subject} S${r.week} (${r.status})`)).reduce((a, x) => [...a, a.length ? ', ' : '', x], []) : h('span', { class: 'muted' }, 'non reliée')),
      h('li', {}, h('strong', {}, 'Leçons : '), lessons.length ? lessons.map(l => h('a', { href: `#/lecons?open=${l.id}` }, `n° ${l.number} ${l.title}`)).reduce((a, x) => [...a, a.length ? ', ' : '', x], []) : h('span', { class: 'muted' }, 'aucune'),
        ' ', h('button', { class: 'btn btn-link small', type: 'button', onclick: async () => {
          const items = store.all('lesson').filter(l => l.classId === s.classId).map(l => ({ id: l.id, label: `n° ${l.number} — ${l.title}`, detail: l.subject }));
          const sel = await pickMany({ title: 'Leçons liées à cette séance', items, selected: lessons.map(l => l.id), emptyText: 'Aucune leçon : créez-en dans Préparer › Leçons.' });
          if (!sel) return;
          await store.batch(store.all('lesson').filter(l => l.classId === s.classId).map(l => {
            const has = (l.sessionIds || []).includes(s.id), want = sel.includes(l.id);
            return has === want ? null : { id: l.id, patch: { sessionIds: want ? [...(l.sessionIds || []), s.id] : l.sessionIds.filter(x => x !== s.id) } };
          }).filter(Boolean), 'Leçons liées');
        } }, 'modifier')),
      h('li', {}, h('strong', {}, 'Devoirs : '), hw.length ? hw.map(x => `${x.title} (pour le ${model.frShort(x.dueDate)})`).join(', ') : h('span', { class: 'muted' }, 'aucun'), ' ', h('a', { class: 'btn btn-link small', href: `#/devoirs?session=${s.id}` }, 'ajouter'))));
}

/** Programmer la fiche à une date : crée une séance datée liée (pas une copie). */
export function scheduleDialog(s, cls) {
  let date = nextSchoolDay(cls, model.todayIso());
  const body = h('div', { class: 'form' });
  const draw = () => {
    const plan = PL.dayPlan(cls, date);
    const slots = plan.entries.filter(e => e.kind === 'slot' || (e.kind === 'occ' && e.status === 'prévue'));
    const dateInput = h('input', { type: 'date', value: date, 'data-testid': 'schedule-date', onchange: (e) => { date = e.target.value; draw(); } });
    body.replaceChildren(field('Date', dateInput),
      plan.school.ok ? null : h('p', { class: 'warn' }, plan.school.reason),
      slots.length ? h('div', {}, h('p', {}, 'Choisir un créneau de l’emploi du temps :'), h('div', { class: 'quick-list' }, slots.map(e => h('button', { class: 'quick-item', type: 'button', 'data-testid': 'slot-choice', onclick: async () => {
        if (e.sessionId && e.sessionId !== s.id && !await confirmDialog('Créneau déjà préparé', `« ${e.title} » est déjà prévue sur ce créneau. La remplacer par cette fiche ? L’autre fiche n’est pas supprimée.`, { confirmLabel: 'Remplacer' })) return;
        await PL.patchEntry(e, cls, { sessionId: s.id, subject: s.subject || e.subject, levels: e.levels?.length ? e.levels : (s.levels || []), mode: e.mode || s.teacherMode }, `« ${s.title} » programmée le ${model.frShort(date)}`);
        m.close(); toast(`Programmée le ${model.frDate(date)} à ${e.start}`, { action: 'Voir', onAction: () => { location.hash = `#/cahier?d=${date}`; } });
      } }, h('strong', {}, `${e.start}–${e.end} · ${e.subject || ''}`), h('span', { class: 'muted' }, e.sessionId ? `déjà prévu : ${e.title}` : (e.title || 'créneau libre')))))) : h('p', { class: 'muted' }, 'Aucun créneau dans l’emploi du temps ce jour-là.'),
      h('h3', {}, 'Ou à un horaire précis'),
      h('div', { class: 'grid-3' }, field('Début', h('input', { type: 'time', id: 'sch-start', value: '09:00' })), field('Fin', h('input', { type: 'time', id: 'sch-end', value: model.hhmm(model.minutes('09:00') + (P.sessionDuration(s) || 45)) })),
        h('div', { class: 'field' }, h('label', {}, ' '), h('button', { class: 'btn', type: 'button', onclick: async () => {
          const st = body.querySelector('#sch-start').value, en = body.querySelector('#sch-end').value;
          if (!st || !en || en <= st) { toast('Horaire invalide', { kind: 'error' }); return; }
          await store.create('occurrence', { classId: cls.id, date, start: st, end: en, subject: s.subject, levels: s.levels || [], mode: s.teacherMode || 'dirigé', status: 'prévue', sessionId: s.id }, `« ${s.title} » programmée le ${model.frShort(date)}`);
          m.close(); toast(`Programmée le ${model.frDate(date)} à ${st}`);
        } }, 'Programmer à cet horaire'))));
  };
  draw();
  const m = modal({ title: `Programmer « ${s.title || 'séance'} »`, wide: true, body, actions: [{ label: 'Fermer' }] });
}

export function nextSchoolDay(cls, from) {
  for (let k = 0; k < 40; k++) { const d = model.addDays(from, k); if (PL.isSchoolDay(cls, d).ok) return d; }
  return from;
}
