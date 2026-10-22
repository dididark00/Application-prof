// PES et visites : échéances INSPE / administratives, visites (tuteur, formateur, inspection)
// reliées à la fiche de séance observée, retours, objectifs de formation et actions.
// Les échéances et visites apparaissent dans l'agenda.
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import * as O from '../orga.js';
import { h, icon, toast, modal, field, formData, badge, emptyState, confirmDialog } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { bound, recField, pickMany, iconBtn } from '../forms.js';
import { filesBlock } from '../pedago-ui.js';
import { printDocument } from '../print.js';

const OBJ_STATUS = [['à travailler', 'À travailler'], ['en cours', 'En cours'], ['acquis', 'Acquis']];
const ST_BADGE = { 'à travailler': 'warn', 'en cours': 'info', acquis: 'ok' };

export function render({ params, rerender }) {
  if (params[0]) return visitDetail(params[0], rerender);
  const today = model.todayIso();
  const ech = O.pesItems('echeance');
  const visits = O.pesItems('visite');
  const objs = O.pesItems('objectif');
  const late = ech.filter(e => !e.done && e.date && e.date < today).length;
  return h('div', { class: 'page' },
    pageHeader('PES et visites', { favKey: 'organisation/pes', subtitle: `${ech.filter(e => !e.done).length} échéance(s) à venir${late ? ` dont ${late} dépassée(s)` : ''} · ${visits.length} visite(s) · ${objs.filter(o => o.status !== 'acquis').length} objectif(s) en travail`,
      actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-visit', onclick: () => itemDialog('visite') }, icon('plus', 16), 'Visite'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'new-deadline', onclick: () => itemDialog('echeance') }, icon('plus', 16), 'Échéance'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'new-objective', onclick: () => itemDialog('objectif') }, icon('plus', 16), 'Objectif de formation')] }),
    subTabs(),
    h('div', { class: 'grid-2' },
      h('section', { class: 'card' }, h('h2', {}, 'Échéances'),
        ech.length ? h('ul', { class: 'linked-list' }, ech.map(e => h('li', { class: 'task', 'data-testid': 'pes-deadline' },
          h('input', { type: 'checkbox', checked: !!e.done, 'aria-label': `Fait : ${e.title}`, onchange: (ev) => store.update(e.id, { done: ev.target.checked }, ev.target.checked ? 'Échéance faite' : 'Échéance rouverte') }),
          h('button', { class: 'btn btn-link', type: 'button', onclick: () => itemDialog('echeance', e) }, e.title),
          e.date ? badge(model.frShort(e.date), !e.done && e.date < today ? 'warn' : 'muted') : null, e.organisme ? h('span', { class: 'muted small' }, e.organisme) : null)))
          : h('p', { class: 'muted small' }, 'Mémoire, dossier de titularisation, évaluations, documents à rendre…')),
      h('section', { class: 'card' }, h('h2', {}, 'Objectifs de formation'),
        objs.length ? h('ul', { class: 'linked-list' }, objs.map(o => h('li', { 'data-testid': 'pes-objective' },
          h('button', { class: 'btn btn-link', type: 'button', onclick: () => itemDialog('objectif', o) }, o.title), ' ', badge(o.status || 'à travailler', ST_BADGE[o.status || 'à travailler']),
          (o.sessionIds || []).length ? h('span', { class: 'muted small' }, ` · travaillé dans ${o.sessionIds.length} séance(s)`) : null)))
          : h('p', { class: 'muted small' }, 'Les objectifs fixés après les visites (ex. gestion du temps, consignes, différenciation) et les séances où vous les travaillez.'))),
    h('section', { class: 'card' }, h('h2', {}, 'Visites'),
      visits.length ? h('div', { class: 'stack' }, visits.map(v => {
        const s = v.sessionId ? store.get(v.sessionId) : null;
        return h('a', { class: 'card link-card', href: `#/pes/${v.id}`, 'data-testid': 'pes-visit' },
          h('div', { class: 'card-head' }, h('strong', {}, `${v.date ? model.frDate(v.date, { weekday: 'short', day: 'numeric', month: 'short' }) : 'date à fixer'} — ${v.visitType || 'visite'}`), v.feedback ? badge('retour noté', 'ok') : (v.date && v.date < today ? badge('retour à noter', 'warn') : badge('à venir', 'info'))),
          h('p', { class: 'muted small' }, [v.visitor, s ? `séance : ${P.sessionTitle(s)}` : 'séance à choisir', (v.actions || []).length ? `${v.actions.length} action(s)` : null].filter(Boolean).join(' · ')));
      })) : emptyState('Aucune visite', 'Ajoutez une visite et reliez-la à la fiche de séance observée : la fiche en mode « visite » s’imprime depuis la séance.')));
}

function itemDialog(kind, it = null) {
  const isV = kind === 'visite', isO = kind === 'objectif';
  const sessions = (() => { const cls = model.currentClass(); return cls ? P.ofClass('session', cls.id) : []; })();
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    isV ? null : field(isO ? 'Objectif' : 'Échéance', h('input', { name: 'title', required: true, value: it?.title || '', 'data-testid': 'pes-title' })),
    isO ? field('Statut', h('select', { name: 'status' }, OBJ_STATUS.map(([v, l]) => h('option', { value: v, selected: (it?.status || 'à travailler') === v }, l))))
      : h('div', { class: 'grid-2' }, field('Date', h('input', { name: 'date', type: 'date', value: it?.date || '', 'data-testid': 'pes-date' })),
        isV ? field('Heure', h('input', { name: 'start', type: 'time', value: it?.start || '' })) : field('Organisme', h('input', { name: 'organisme', value: it?.organisme || '', placeholder: 'INSPE, circonscription…' }))),
    isV ? h('div', { class: 'grid-2' }, field('Type de visite', h('select', { name: 'visitType' }, O.VISIT_TYPES.map(t => h('option', { value: t, selected: it?.visitType === t }, t)))), field('Visiteur·se', h('input', { name: 'visitor', value: it?.visitor || '' }))) : null,
    isV ? field('Fiche de séance observée', h('select', { name: 'sessionId', 'data-testid': 'pes-session' }, h('option', { value: '' }, '— à choisir plus tard —'), sessions.map(s => h('option', { value: s.id, selected: it?.sessionId === s.id }, `${s.subject ? s.subject + ' — ' : ''}${P.sessionTitle(s)}`)))) : null,
    field('Notes', h('textarea', { name: 'notes', rows: 2 }, it?.notes || '')));
  const actions = [{ label: 'Annuler' }];
  if (it) actions.unshift({ label: 'Supprimer', danger: true, onClick: async () => { await store.remove(it.id, 'Élément PES mis à la corbeille'); toast('Mis à la corbeille', { action: 'Annuler', onAction: () => store.undo() }); if (location.hash.startsWith('#/pes/')) location.hash = '#/pes'; } });
  if (isO && it) actions.splice(1, 0, { label: 'Séances liées…', onClick: async () => {
    const sel = await pickMany({ title: 'Séances où cet objectif est travaillé', items: sessions.map(s => ({ id: s.id, label: P.sessionTitle(s), detail: s.subject })), selected: it.sessionIds || [] });
    if (sel) await store.update(it.id, { sessionIds: sel }, 'Séances liées à l’objectif');
  } });
  actions.push({ label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form);
    if (!isV && !d.title?.trim()) return false;
    const data = { ...d, kind, title: isV ? `Visite ${d.visitType || ''}`.trim() : d.title.trim() };
    if (it) await store.update(it.id, data, 'PES modifié');
    else { const r = await store.create('pesitem', { ...data, done: false, actions: [], fileIds: [], sessionIds: [] }, `PES : ${data.title}`); if (isV) location.hash = `#/pes/${r.id}`; }
  } });
  modal({ title: { visite: 'Visite', echeance: 'Échéance', objectif: 'Objectif de formation' }[kind], body: form, actions });
}

function visitDetail(id, rerender) {
  const v = store.get(id);
  if (!v || v.deletedAt) return h('div', { class: 'page' }, pageHeader('Visite introuvable'), h('a', { href: '#/pes' }, '← PES et visites'));
  const s = v.sessionId ? store.get(v.sessionId) : null;
  const objs = O.pesItems('objectif');
  const up = (patch, label) => store.update(v.id, patch, label);
  return h('div', { class: 'page' },
    h('p', {}, h('a', { href: '#/pes', class: 'back' }, '← PES et visites')),
    pageHeader(`${v.visitType ? 'Visite ' + v.visitType : 'Visite'}${v.date ? ' — ' + model.frDate(v.date, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}`, { subtitle: [v.visitor, v.start].filter(Boolean).join(' · '),
      actions: [h('button', { class: 'btn', type: 'button', onclick: () => itemDialog('visite', v) }, 'Modifier'),
        h('button', { class: 'btn', type: 'button', onclick: () => printVisit(v) }, icon('print', 16), 'Imprimer le bilan')] }),
    h('section', { class: 'card' }, h('h2', {}, 'Séance observée'),
      s ? h('p', {}, h('a', { href: `#/seance/${s.id}`, 'data-testid': 'pes-session-link' }, P.sessionTitle(s)), h('span', { class: 'muted small' }, ` · ${s.subject || ''} — ouvrez la fiche et passez en mode « visite » pour l’imprimer.`))
        : h('p', { class: 'muted' }, 'Aucune fiche reliée : « Modifier » pour la choisir.')),
    h('section', { class: 'card' }, h('h2', {}, 'Préparation et retours'), h('div', { class: 'fields' },
      recField(v.id, 'focus', { label: 'Points sur lesquels je souhaite un regard' }),
      recField(v.id, 'feedback', { label: 'Retours de la visite (points forts, points à travailler)', testid: 'pes-feedback' }),
      recField(v.id, 'selfReview', { label: 'Mon analyse réflexive' }))),
    h('section', { class: 'card' }, h('h2', {}, 'Actions décidées'),
      (v.actions || []).length ? h('ul', { class: 'linked-list' }, v.actions.map((a, i) => {
        const o = a.objectiveId ? store.get(a.objectiveId) : null;
        return h('li', { class: 'task' }, h('input', { type: 'checkbox', checked: !!a.done, 'aria-label': 'Action faite', onchange: (e) => up({ actions: v.actions.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) }, 'Action PES') }),
          h('span', {}, a.text), o ? badge(o.title, 'muted') : null, iconBtn('trash', 'Retirer', () => up({ actions: v.actions.filter((_, j) => j !== i) }, 'Action retirée')));
      })) : h('p', { class: 'muted small' }, 'Aucune action.'),
      (() => {
        const t = h('input', { placeholder: 'Action (ex. afficher les consignes au tableau)…', 'data-testid': 'pes-action', 'aria-label': 'Action' });
        const o = h('select', { 'aria-label': 'Objectif lié' }, h('option', { value: '' }, 'Objectif lié (facultatif)'), objs.map(x => h('option', { value: x.id }, x.title)), h('option', { value: '__new' }, '+ créer un objectif avec ce texte'));
        return h('div', { class: 'row' }, t, o, h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'pes-action-add', onclick: async () => {
          if (!t.value.trim()) return;
          let objectiveId = o.value || null;
          if (objectiveId === '__new') { const r = await store.create('pesitem', { kind: 'objectif', title: t.value.trim(), status: 'à travailler', sessionIds: [], actions: [], fileIds: [] }, 'Objectif de formation'); objectiveId = r.id; }
          await up({ actions: [...(store.get(v.id).actions || []), { id: store.uid(), text: t.value.trim(), objectiveId, done: false }] }, 'Action ajoutée');
        } }, 'Ajouter'));
      })()),
    h('section', { class: 'card' }, filesBlock(v.id, { title: 'Documents (grille, rapport…)' })));
}

function printVisit(v) {
  const s = v.sessionId ? store.get(v.sessionId) : null;
  printDocument(h('div', {}, h('div', { class: 'print-head' }, h('h1', {}, `Bilan de visite${v.date ? ' — ' + model.frDate(v.date, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}`), h('p', {}, [v.visitType, v.visitor, s ? `Séance : ${P.sessionTitle(s)}` : ''].filter(Boolean).join(' · '))),
    v.focus ? [h('h2', {}, 'Regard souhaité'), h('p', { class: 'pre' }, v.focus)] : null,
    v.feedback ? [h('h2', {}, 'Retours'), h('p', { class: 'pre' }, v.feedback)] : null,
    v.selfReview ? [h('h2', {}, 'Analyse réflexive'), h('p', { class: 'pre' }, v.selfReview)] : null,
    (v.actions || []).length ? [h('h2', {}, 'Actions'), h('ul', {}, v.actions.map(a => h('li', {}, `${a.done ? '☑' : '☐'} ${a.text}`)))] : null));
}
