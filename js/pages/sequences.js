// Séquences (modèle « Fiche de séquence » de l’enseignante), reliées aux notions de la programmation
// et aux fiches de séance, dont le déroulé est tiré automatiquement.
import { bulkDelete } from '../bulk.js';
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { bound, iconBtn, pickMany } from '../forms.js';
import { sectionFields, competencyBlock, filesBlock, manualRefsBlock, ownerBadge, ownerSelect, levelChips } from '../pedago-ui.js';
import { newSession } from './seance.js';
import { printDocument } from '../print.js';
import { printSequence } from '../printdocs.js';
import { linkDialog } from '../link-comps.js';
import { consumeFlag } from '../router.js';

let rerender = () => {};
const filt = { subject: '', period: '' };

export function render({ params, rerender: rr }) {
  rerender = rr;
  return params[0] ? detail(params[0]) : list();
}

function list() {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Séquences'), subTabs(), missing);
  if (consumeFlag('link')) setTimeout(() => linkDialog(cls), 0);
  const year = store.get(cls.yearId); const periods = model.periodsOf(year);
  const seqs = P.ofClass('sequence', cls.id).filter(s => (!filt.subject || s.subject === filt.subject) && (!filt.period || s.periodId === filt.period))
    .sort((a, b) => (periods.findIndex(p => p.id === a.periodId) - periods.findIndex(p => p.id === b.periodId)) || (a.subject || '').localeCompare(b.subject || '') || (Number(a.number) || 0) - (Number(b.number) || 0));
  return h('div', { class: 'page' },
    pageHeader('Séquences', { favKey: 'preparer/sequences', subtitle: cls.name, actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-sequence', onclick: () => newDialog(cls) }, icon('plus', 16), 'Nouvelle séquence'),
      h('button', { class: 'btn', type: 'button', 'data-testid': 'link-comps', onclick: () => linkDialog(cls) }, 'Relier les compétences…'),
      h('button', { class: 'btn', type: 'button', 'data-testid': 'bulk-open', onclick: () => bulkDelete({ title: 'Supprimer des séquences', childOption: 'avec leurs fiches de séance', items: P.ofClass('sequence', cls.id).map(s => ({ id: s.id, group: s.subject || 'Autre', label: P.sequenceTitle(s), detail: `${P.sessionsOfSequence(s.id).length} séance(s)`, children: P.sessionsOfSequence(s.id).map(x => x.id) })) }) }, icon('trash', 16), 'Supprimer…')] }),
    subTabs(),
    h('div', { class: 'filters' },
      h('select', { 'aria-label': 'Discipline', onchange: (e) => { filt.subject = e.target.value; rerender(); } }, h('option', { value: '' }, 'Toutes disciplines'), model.subjects().map(s => h('option', { value: s, selected: filt.subject === s }, s))),
      h('select', { 'aria-label': 'Période', onchange: (e) => { filt.period = e.target.value; rerender(); } }, h('option', { value: '' }, 'Toutes périodes'), periods.map((p, i) => h('option', { value: p.id, selected: filt.period === p.id }, `P${i + 1}`)))),
    seqs.length ? h('div', { class: 'dash' }, seqs.map(s => {
      const ses = P.sessionsOfSequence(s.id);
      const prog = P.journalProgress(ses.map(x => x.id));
      return h('a', { class: 'card card-link', href: `#/sequence/${s.id}` },
        h('h2', {}, P.sequenceTitle(s)),
        h('p', { class: 'muted' }, [s.subject, s.subdomain, model.periodLabel(year, s.periodId), (s.levels || []).join(', ')].filter(Boolean).join(' · '), ' ', ownerBadge(s.owner, cls)),
        h('p', {}, `${ses.length} séance(s)`, ses.length ? ` · ${prog.done} faite(s) au cahier journal` : ''));
    })) : emptyState('Aucune séquence', 'Une séquence regroupe des fiches de séance numérotées, liées aux notions de la programmation.'));
}

function newDialog(cls) {
  const year = store.get(cls.yearId); const periods = model.periodsOf(year);
  const cur = model.periodOfDate(year, model.todayIso());
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-3' }, field('N°', h('input', { name: 'number', type: 'number', min: 1 })), h('div', { style: { gridColumn: 'span 2' } }, field('Titre de la séquence', h('input', { name: 'title', required: true })))),
    h('div', { class: 'grid-3' },
      field('Discipline', h('select', { name: 'subject' }, model.subjects().map(s => h('option', { value: s }, s)))),
      field('Sous-domaine', h('input', { name: 'subdomain' })),
      field('Période', h('select', { name: 'periodId' }, h('option', { value: '' }, '—'), periods.map((p, i) => h('option', { value: p.id, selected: cur?.id === p.id }, `P${i + 1}`))))),
    field('Nombre de séances à créer', h('input', { name: 'count', type: 'number', min: 0, max: 20, value: 0 }), 'Des fiches de séance vides et numérotées sont créées, prêtes à compléter.'));
  modal({ title: 'Nouvelle séquence', body: form, actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, onClick: async () => {
    const d = formData(form);
    if (!d.title) return false;
    const id = store.uid();
    const n = Math.min(20, Math.max(0, Number(d.count) || 0));
    await store.batch([{ create: { type: 'sequence', data: { id, classId: cls.id, title: d.title, number: d.number ? Number(d.number) : null, subject: d.subject, subdomain: d.subdomain, periodId: d.periodId || null, levels: cls.levels.length === 1 ? [...cls.levels] : [], competencyIds: [], notionIds: [], fileIds: [], manualRefs: [] } } },
      ...Array.from({ length: n }, (_, i) => ({ create: { type: 'session', data: { classId: cls.id, sequenceId: id, order: i + 1, title: '', subject: d.subject, subdomain: d.subdomain, levels: cls.levels.length === 1 ? [...cls.levels] : [], mode: 'quotidien', teacherMode: 'dirigé', phases: P.defaultPhases(), competencyIds: [], fileIds: [], manualRefs: [], copies: [], variants: [], checklist: {} } } }))],
      `Séquence « ${d.title} » créée`);
    location.hash = `#/sequence/${id}`;
  } }] });
}

function detail(id) {
  const s = store.get(id);
  if (!s || s.deletedAt) return h('div', { class: 'page' }, pageHeader('Séquence introuvable'), h('a', { href: '#/sequences' }, '← Séquences'));
  const cls = store.get(s.classId); const year = store.get(cls.yearId); const periods = model.periodsOf(year);
  const sessions = P.sessionsOfSequence(s.id);
  const total = sessions.reduce((t, x) => t + P.sessionDuration(x), 0);
  const save = (patch, label, quiet = true) => store.update(s.id, patch, label, { quiet });
  const prog = P.ofClass('programmation', cls.id).filter(p => p.subject === s.subject);
  const notions = prog.flatMap(p => P.notionsOf(p.id));

  const moveSession = async (i, dir) => {
    const j = i + dir; if (j < 0 || j >= sessions.length) return;
    await store.batch(sessions.map((x, k) => ({ id: x.id, patch: { order: k === i ? j : k === j ? i : k } })), 'Séances réordonnées');
  };

  return h('div', { class: 'page' },
    h('p', {}, h('a', { href: '#/sequences', class: 'back' }, '← Séquences')),
    pageHeader(P.sequenceTitle(s), { subtitle: [cls.name, s.subject, s.subdomain, model.periodLabel(year, s.periodId)].filter(Boolean).join(' · '),
      actions: [
        h('button', { class: 'btn', type: 'button', 'data-testid': 'print-sequence', onclick: () => printDocument(printSequence(s.id), { orientation: 'landscape' }) }, icon('print', 16), 'Imprimer'),
        h('button', { class: 'btn', type: 'button', onclick: () => printDocument(printSequence(s.id, { blank: true }), { orientation: 'landscape' }) }, 'Version vierge'),
        h('button', { class: 'btn', type: 'button', onclick: async () => { const nid = await P.duplicateSequence(s.id); toast('Séquence dupliquée avec ses séances (copies indépendantes)'); location.hash = `#/sequence/${nid}`; } }, icon('copy', 16), 'Dupliquer'),
        h('button', { class: 'btn btn-ghost-danger', type: 'button', 'aria-label': 'Mettre à la corbeille', onclick: async () => {
          if (!await confirmDialog('Mettre la séquence à la corbeille ?', `Ses ${sessions.length} fiche(s) de séance sont conservées (elles apparaîtront hors séquence si la séquence n’est pas restaurée).`, { confirmLabel: 'Mettre à la corbeille', danger: true })) return;
          await store.remove(s.id, `Séquence « ${s.title} » mise à la corbeille`); location.hash = '#/sequences';
        } }, icon('trash', 16))] }),
    h('section', { class: 'card' }, h('h2', {}, 'Informations générales'),
      h('div', { class: 'grid-3' },
        bound({ label: 'Titre', type: 'text', value: s.title, testid: 'f-title', onSave: (v) => save({ title: v }, 'Titre') }),
        bound({ label: 'N°', type: 'number', value: s.number, onSave: (v) => save({ number: v }, 'Numéro') }),
        bound({ label: 'Période', type: 'select', value: s.periodId || '', options: [['', '—'], ...periods.map((p, i) => [p.id, `P${i + 1}`])], onSave: (v) => save({ periodId: v || null }, 'Période') })),
      h('div', { class: 'grid-3' },
        bound({ label: 'Discipline / domaine', type: 'select', value: s.subject || '', options: model.subjects(), onSave: (v) => save({ subject: v }, 'Discipline') }),
        bound({ label: 'Sous-domaine', type: 'text', value: s.subdomain, onSave: (v) => save({ subdomain: v }, 'Sous-domaine') }),
        ownerSelect(s.id, cls)),
      h('div', { class: 'grid-3' },
        h('div', { class: 'field' }, h('label', {}, 'Niveau(x)'), levelChips(s.levels || [], cls.levels || [], (v) => save({ levels: v }, 'Niveaux'))),
        h('div', { class: 'field' }, h('label', {}, 'Nombre de séances'), h('p', { class: 'static' }, String(sessions.length))),
        h('div', { class: 'field' }, h('label', {}, 'Durée totale estimée'), h('p', { class: 'static' }, model.durationLabel(total) || '—'))),
      sectionFields(s.id, P.SEQUENCE_SECTIONS[0].fields),
      h('div', { class: 'linked' }, h('div', { class: 'linked-head' }, h('strong', {}, 'Notions de la programmation'),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'link-notions', onclick: async () => {
          const sel = await pickMany({ title: 'Notions traitées par la séquence', selected: s.notionIds || [], emptyText: `Aucune notion : créez la programmation ${s.subject} dans Préparer › Programmations.`,
            items: notions.map(n => ({ id: n.id, label: n.title, detail: [n.subdomain, model.periodLabel(year, n.periodId)].filter(Boolean).join(' · '), group: `${store.get(n.programmationId).subject} ${store.get(n.programmationId).level}` })) });
          if (sel) await save({ notionIds: sel }, 'Notions liées', false);
        } }, 'Choisir…')),
        (s.notionIds || []).length ? h('div', { class: 'tags' }, s.notionIds.map(nid => store.get(nid)).filter(Boolean).map(n => badge(n.title, P.NOTION_KIND[P.notionStatus(n)]))) : h('p', { class: 'muted small' }, 'Aucune notion liée.'))),
    P.SEQUENCE_SECTIONS.slice(1).map((sec, i) => h('section', { class: 'card' }, h('h2', {}, sec.title), sectionFields(s.id, sec.fields),
      i === 0 ? competencyBlock(s.id, { levels: s.levels?.length ? s.levels : cls.levels }) : null,
      i === 1 ? [filesBlock(s.id), manualRefsBlock(s.id)] : null)),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Déroulé de la séquence'),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-primary btn-small', type: 'button', 'data-testid': 'add-session', onclick: () => newSession(cls, { sequenceId: s.id }) }, icon('plus', 14), 'Nouvelle séance'),
          h('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
            const loose = P.ofClass('session', cls.id).filter(x => !x.sequenceId);
            const sel = await pickMany({ title: 'Rattacher des fiches hors séquence', items: loose.map(x => ({ id: x.id, label: x.title || 'Sans titre', detail: x.subject })), emptyText: 'Aucune fiche hors séquence.' });
            if (sel?.length) { let o = sessions.at(-1)?.order ?? 0; await store.batch(sel.map(x => ({ id: x, patch: { sequenceId: s.id, order: ++o } })), 'Fiches rattachées'); }
          } }, 'Rattacher une fiche existante'))),
      h('p', { class: 'muted small' }, 'Tiré automatiquement des fiches de séance : modifiez une fiche, le déroulé suit.'),
      sessions.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table', 'data-testid': 'seq-sessions' },
        h('thead', {}, h('tr', {}, ['Séance', 'Titre', 'Objectif spécifique', 'Durée', 'Trace / production attendue', 'Cahier journal', ''].map(t => h('th', {}, t)))),
        h('tbody', {}, sessions.map((x, i) => {
          const occ = P.occurrencesOfSession(x.id);
          return h('tr', {}, h('td', {}, P.sessionShort(x, i)), h('td', {}, h('a', { href: `#/seance/${x.id}` }, x.title || '[à compléter]')), h('td', {}, x.objective || ''),
            h('td', { class: 'nowrap' }, model.durationLabel(P.sessionDuration(x))), h('td', {}, x.trace || ''),
            h('td', {}, occ.length ? occ.map(o => h('div', { class: 'small' }, h('a', { href: `#/cahier?d=${o.date}` }, model.frShort(o.date)), ' ', o.status)) : h('span', { class: 'muted small' }, '—')),
            h('td', { class: 'row-actions' }, iconBtn('up', 'Monter', () => moveSession(i, -1)), iconBtn('down', 'Descendre', () => moveSession(i, 1)),
              iconBtn('copy', 'Dupliquer (copie indépendante)', async () => { await P.duplicateSession(x.id); toast('Copie créée dans la séquence'); })));
        })))) : emptyState('Aucune séance', 'Ajoutez les fiches de séance de cette séquence.')),
    h('section', { class: 'card' }, h('h2', {}, 'Bilan de séquence'), sectionFields(s.id, P.sequenceBilan(cls), { prefix: 'Bilan : ' })));
}
