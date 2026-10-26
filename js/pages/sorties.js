// Planifier › Sorties et natation : une sortie (musée, cinéma…) ou un cycle (natation, judo…) avec
// ses dates, ses adultes, ses groupes, les autorisations, la check-list et l'appel au départ et au retour.
// Les dates vont dans l'agenda et le cahier journal (la classe est mobilisée). Rien n'est envoyé.
import * as store from '../store.js';
import * as model from '../model.js';
import * as E from '../eleve.js';
import * as G from '../groups.js';
import { h, icon, toast, modal, field, badge, emptyState, confirmDialog } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { bound } from '../forms.js';
import { printDocument } from '../print.js';

const KINDS = [['sortie', 'Sortie'], ['cycle', 'Cycle (natation, judo…)'], ['classe', 'Classe découverte / nuitée']];
const ROLES = ['enseignant(e)', 'binôme', 'ATSEM', 'AESH', 'parent accompagnateur', 'parent agréé (natation)', 'intervenant(e)', 'maître-nageur', 'autre'];
const CHECK = {
  sortie: ['Liste des élèves et téléphones des familles', 'Autorisations signées', 'Trousse de secours', 'PAI et médicaments', 'Téléphone chargé', 'Gilets / brassards', 'Eau et goûter', 'Titres de transport / bon de commande'],
  cycle: ['Liste des élèves et des groupes', 'Autorisations signées', 'Trousse de secours', 'PAI et médicaments', 'Téléphone chargé', 'Maillots, bonnets, serviettes', 'Agréments des parents accompagnateurs'],
  classe: ['Liste des élèves et téléphones des familles', 'Autorisations signées', 'Fiches sanitaires', 'Trousse de secours', 'PAI et médicaments', 'Téléphone chargé', 'Programme et adresses', 'Liste des affaires remise aux familles'],
};
let tab = 'infos';
let rollDate = null;

const outings = (cls) => store.all('outing').filter(o => o.classId === cls.id).sort((a, b) => (a.dates?.[0]?.date || '').localeCompare(b.dates?.[0]?.date || ''));
const studentsOf = (cls) => model.studentsOfClass(cls.id).map(x => x.student);
const first = (o) => o.dates?.[0]?.date || '';
const last = (o) => o.dates?.at(-1)?.date || '';

/** Statut d'autorisation : propre à la sortie si demandé, sinon l'autorisation annuelle de la fiche élève. */
export function authOf(o, s, cls) {
  if (o.ownAuth) return o.auth?.[s.id] || 'à renseigner';
  const t = E.docTemplates().find(x => x.id === 'sorties');
  if (!t) return 'à renseigner';
  return E.docState(E.docOf(s.id, cls.yearId, t.id), t).status;
}

/** Synchronise les événements d'agenda (classe mobilisée) avec les dates de la sortie. */
async function syncEvents(o, cls) {
  const items = [];
  const old = new Map((o.eventIds || []).map(id => [store.get(id)?.date, id]).filter(([d]) => d));
  const keep = [];
  for (const d of o.dates || []) {
    const data = { title: `${o.kind === 'cycle' ? '' : 'Sortie : '}${o.title}`, kind: 'sortie', date: d.date, start: d.start || '', end: d.end || '', classId: cls.id, blocksClass: true, notes: o.place || '', outingId: o.id, levels: [] };
    const id = old.get(d.date);
    if (id) { items.push({ id, patch: data }); keep.push(id); old.delete(d.date); }
    else { const nid = store.uid(); items.push({ create: { type: 'event', data: { id: nid, ...data } } }); keep.push(nid); }
  }
  for (const id of old.values()) items.push({ id, patch: { deletedAt: new Date().toISOString() } });
  items.push({ id: o.id, patch: { eventIds: keep } });
  await store.batch(items, 'Dates de la sortie dans l’agenda');
}

export function render({ params, rerender }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return h('div', { class: 'page' }, pageHeader('Sorties et natation'), subTabs(), miss);
  if (params[0]) return detail(cls, params[0], rerender);
  const list = outings(cls); const today = model.todayIso();
  const up = list.filter(o => !last(o) || last(o) >= today), past = list.filter(o => last(o) && last(o) < today);
  const card = (o) => { const n = (o.dates || []).length; const ok = studentsOf(cls).filter(s => authOf(o, s, cls) === 'autorisé').length;
    return h('a', { class: 'card outing-card', href: `#/sortie/${o.id}`, 'data-testid': 'outing-card' }, h('div', { class: 'card-head' }, h('h3', {}, o.title || 'Sans titre'), badge(KINDS.find(k => k[0] === o.kind)?.[1] || o.kind, 'info')),
      h('p', { class: 'small' }, n ? (n > 1 ? `${n} dates, du ${model.frShort(first(o))} au ${model.frShort(last(o))}` : model.frDate(first(o), { weekday: 'long', day: 'numeric', month: 'long' })) : 'Dates à fixer', o.place ? ` · ${o.place}` : ''),
      h('p', { class: 'small muted' }, `${(o.adults || []).length} adulte(s) · ${(o.groups || []).length} groupe(s) · autorisations ${ok}/${studentsOf(cls).length}`)); };
  return h('div', { class: 'page' },
    pageHeader('Sorties et natation', { favKey: 'planifier/sorties', subtitle: cls.name, actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'outing-new', onclick: () => newOuting(cls) }, icon('plus', 16), 'Nouvelle sortie ou cycle')] }),
    subTabs(),
    h('p', { class: 'muted' }, 'Pour chaque sortie ou cycle (natation, judo…) : dates et horaires (ajoutés à l’agenda et au cahier journal), adultes et groupes, autorisations, check-list, appel au départ et au retour, fiche à imprimer pour la direction et pour le sac de sortie.'),
    up.length ? h('div', { class: 'grid-2' }, up.map(card)) : emptyState('Aucune sortie prévue', 'Créez une sortie ou un cycle de natation : tout le reste se prépare à partir des fiches élèves.'),
    past.length ? h('details', { class: 'card' }, h('summary', {}, `Sorties passées (${past.length})`), h('div', { class: 'grid-2' }, past.map(card))) : null);
}

function newOuting(cls) {
  const title = h('input', { placeholder: 'ex. Natation, Musée du Louvre, Ferme pédagogique', 'data-testid': 'outing-title' });
  const kind = h('select', { 'data-testid': 'outing-kind' }, KINDS.map(([v, l]) => h('option', { value: v }, l)));
  const date = h('input', { type: 'date', value: model.todayIso(), 'data-testid': 'outing-date' });
  const start = h('input', { type: 'time', value: '13:30' }), end = h('input', { type: 'time', value: '15:00' });
  const count = h('input', { type: 'number', min: 1, max: 40, value: 10, style: { width: '6em' }, 'data-testid': 'outing-count' });
  const countF = field('Nombre de séances (une par semaine, même jour)', count); countF.hidden = true;
  kind.addEventListener('change', () => { countF.hidden = kind.value !== 'cycle'; if (kind.value === 'cycle' && !title.value) title.value = 'Natation'; });
  modal({ title: 'Nouvelle sortie ou cycle', body: h('div', { class: 'form' }, h('div', { class: 'grid-2' }, field('Type', kind), field('Intitulé', title)),
    h('div', { class: 'grid-3' }, field(kind.value === 'cycle' ? 'Première séance' : 'Date', date), field('Départ', start), field('Retour', end)), countF,
    h('p', { class: 'muted small' }, 'Les jours sans classe (vacances, jours fériés) sont sautés pour un cycle. Tout reste modifiable.')),
  actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, testid: 'outing-create', onClick: async () => {
    if (!title.value.trim() || !date.value) { toast('Intitulé et date obligatoires.', { kind: 'error' }); return false; }
    const dates = [];
    if (kind.value === 'cycle') {
      const PL = await import('../planning.js');
      for (let d = date.value, guard = 0; dates.length < (Number(count.value) || 1) && guard < 80; d = model.addDays(d, 7), guard++) if (PL.isSchoolDay(cls, d).ok) dates.push({ date: d, start: start.value, end: end.value });
    } else dates.push({ date: date.value, start: start.value, end: end.value });
    const o = await store.create('outing', { classId: cls.id, kind: kind.value, title: title.value.trim(), place: '', transport: '', notes: '', dates, adults: [], groups: [],
      checklist: (CHECK[kind.value] || CHECK.sortie).map(label => ({ label, done: false })), ownAuth: kind.value !== 'cycle', auth: {}, rolls: {}, ratio: '' }, `Sortie « ${title.value.trim()} »`);
    await syncEvents(o, cls);
    tab = 'infos'; location.hash = `#/sortie/${o.id}`;
  } }] });
}

function detail(cls, id, rerender) {
  const o = store.get(id);
  if (!o || o.deletedAt) return h('div', { class: 'page' }, pageHeader('Sortie introuvable'), h('a', { href: '#/sorties' }, '← Sorties'));
  const st = studentsOf(cls);
  const save = (patch, label, quiet = true) => store.update(o.id, patch, label, { quiet });
  const tabs = [['infos', 'Dates et infos'], ['adultes', 'Adultes et groupes'], ['autorisations', 'Autorisations'], ['checklist', 'Check-list'], ['appel', 'Appel départ / retour']];
  const view = { infos, adultes, autorisations, checklist, appel }[tab] || infos;
  return h('div', { class: 'page' },
    pageHeader(o.title || 'Sortie', { subtitle: `${KINDS.find(k => k[0] === o.kind)?.[1] || ''}${first(o) ? ' · ' + model.frShort(first(o)) + (last(o) !== first(o) ? ' → ' + model.frShort(last(o)) : '') : ''}`,
      actions: [h('button', { class: 'btn', type: 'button', 'data-testid': 'outing-print', onclick: () => printDocument(sheet(cls, o)) }, icon('print', 16), 'Fiche de sortie'),
        h('button', { class: 'btn', type: 'button', onclick: () => printDocument(familyNote(cls, o)) }, icon('print', 16), 'Mot aux familles'),
        h('a', { class: 'btn', href: '#/sorties' }, '← Toutes les sorties')] }),
    subTabs(),
    h('div', { class: 'seg wrap', role: 'group' }, tabs.map(([k, l]) => h('button', { type: 'button', class: tab === k ? 'on' : '', 'data-testid': `outing-tab-${k}`, onclick: () => { tab = k; rerender(); } }, l))),
    view());

  function infos() {
    return h('div', { class: 'stack' },
      h('section', { class: 'card' }, h('div', { class: 'grid-2' },
        bound({ label: 'Intitulé', type: 'text', value: o.title, onSave: (v) => save({ title: v }, 'Intitulé').then(() => syncEvents(store.get(o.id), cls)) }),
        bound({ label: 'Lieu et adresse', type: 'text', value: o.place, onSave: (v) => save({ place: v }, 'Lieu').then(() => syncEvents(store.get(o.id), cls)) }),
        bound({ label: 'Transport', type: 'text', value: o.transport, placeholder: 'à pied, car, transports en commun…', onSave: (v) => save({ transport: v }, 'Transport') }),
        bound({ label: 'Coût par élève (facultatif)', type: 'text', value: o.cost || '', onSave: (v) => save({ cost: v }, 'Coût') })),
        bound({ label: 'Notes (programme, consignes…)', value: o.notes, onSave: (v) => save({ notes: v }, 'Notes') })),
      h('section', { class: 'card stack' }, h('h2', {}, `Dates (${(o.dates || []).length})`),
        h('table', { class: 'table', 'data-testid': 'outing-dates' }, h('tbody', {}, (o.dates || []).map((d, i) => h('tr', {},
          h('td', {}, h('input', { type: 'date', value: d.date, onchange: async (e) => { const ds = o.dates.map((x, j) => j === i ? { ...x, date: e.target.value } : x).sort((a, b) => a.date.localeCompare(b.date)); await save({ dates: ds }, 'Date modifiée', false); await syncEvents(store.get(o.id), cls); } })),
          h('td', {}, h('input', { type: 'time', value: d.start, onchange: async (e) => { await save({ dates: o.dates.map((x, j) => j === i ? { ...x, start: e.target.value } : x) }, 'Horaire', false); await syncEvents(store.get(o.id), cls); } })),
          h('td', {}, h('input', { type: 'time', value: d.end, onchange: async (e) => { await save({ dates: o.dates.map((x, j) => j === i ? { ...x, end: e.target.value } : x) }, 'Horaire', false); await syncEvents(store.get(o.id), cls); } })),
          h('td', {}, h('a', { href: `#/cahier?d=${d.date}` }, 'cahier journal')),
          h('td', {}, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retirer cette date', onclick: async () => { await save({ dates: o.dates.filter((_, j) => j !== i) }, 'Date retirée', false); await syncEvents(store.get(o.id), cls); } }, icon('trash', 14))))))),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'outing-add-date', onclick: async () => { const l = o.dates?.at(-1); await save({ dates: [...(o.dates || []), { date: l ? model.addDays(l.date, 7) : model.todayIso(), start: l?.start || '', end: l?.end || '' }] }, 'Date ajoutée', false); await syncEvents(store.get(o.id), cls); } }, '+ Ajouter une date'),
        h('p', { class: 'muted small' }, 'Chaque date apparaît dans l’agenda et dans le cahier journal (la classe est mobilisée : les séances en même temps sont signalées).')),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-ghost-danger', type: 'button', onclick: async () => {
        if (!await confirmDialog('Supprimer cette sortie ?', 'Ses dates sont retirées de l’agenda. Annulable.', { confirmLabel: 'Supprimer', danger: true })) return;
        await store.batch([...(o.eventIds || []), o.id].map(id => ({ id, patch: { deletedAt: new Date().toISOString() } })), 'Sortie supprimée'); location.hash = '#/sorties';
      } }, 'Supprimer la sortie')));
  }

  function adultes() {
    const adults = o.adults || [];
    const nA = adults.length, nE = st.length;
    const name = h('input', { placeholder: 'Nom', 'data-testid': 'adult-name' });
    const role = h('select', {}, ROLES.map(r => h('option', { value: r }, r)));
    const phone = h('input', { type: 'tel', placeholder: 'Téléphone (facultatif)' });
    const groups = o.groups || [];
    const memberOf = (sid) => groups.find(g => (g.memberIds || []).includes(sid));
    const setMember = async (sid, gid) => save({ groups: groups.map(g => ({ ...g, memberIds: (g.memberIds || []).filter(x => x !== sid).concat(g.id === gid ? [sid] : []) })) }, 'Groupe', false);
    const sets = G.setsOf(cls.id);
    return h('div', { class: 'stack' },
      h('section', { class: 'card stack' }, h('h2', {}, `Adultes (${nA})`),
        h('p', { class: 'small' }, `${nE} élève(s) pour ${nA} adulte(s)${nA ? ` : 1 adulte pour ${Math.ceil(nE / nA)} élèves` : ''}. `,
          h('label', { class: 'inline' }, 'Taux exigé : 1 adulte pour', h('input', { type: 'number', min: 1, value: o.ratio || '', style: { width: '5em' }, 'data-testid': 'outing-ratio', onchange: (e) => save({ ratio: e.target.value }, 'Taux d’encadrement', false) }), 'élèves'),
          o.ratio && nA && Math.ceil(nE / nA) > Number(o.ratio) ? badge('encadrement insuffisant', 'warn') : o.ratio && nA ? badge('encadrement suffisant', 'ok') : null),
        h('p', { class: 'muted small' }, 'Le taux d’encadrement dépend du type de sortie et du niveau : vérifiez-le dans la circulaire en vigueur de votre département et saisissez-le ici.'),
        adults.length ? h('ul', { class: 'plain', 'data-testid': 'outing-adults' }, adults.map((a, i) => h('li', { class: 'row' }, h('strong', {}, a.name), h('span', { class: 'muted small' }, a.role), a.phone ? h('a', { href: `tel:${a.phone.replace(/[^\d+]/g, '')}` }, a.phone) : null,
          h('button', { class: 'btn btn-link small', type: 'button', onclick: () => save({ adults: adults.filter((_, j) => j !== i), groups: groups.map(g => (g.adult === a.name ? { ...g, adult: '' } : g)) }, 'Adulte retiré', false) }, 'retirer')))) : null,
        h('div', { class: 'row wrap' }, name, role, phone, h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'adult-add', onclick: async () => { if (!name.value.trim()) return; await save({ adults: [...adults, { name: name.value.trim(), role: role.value, phone: phone.value.trim() }] }, 'Adulte ajouté', false); } }, '+ Ajouter'))),
      h('section', { class: 'card stack' }, h('div', { class: 'card-head' }, h('h2', {}, `Groupes (${groups.length})`),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'groups-add', onclick: () => save({ groups: [...groups, { id: store.uid(), name: o.kind === 'cycle' ? `Groupe ${groups.length + 1}` : `Groupe ${groups.length + 1}`, color: G.COLORS[groups.length % G.COLORS.length], adult: '', memberIds: [] }] }, 'Groupe ajouté', false) }, '+ Groupe'),
          h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'groups-auto', onclick: async () => {
            const n = Math.max(1, groups.length || nA || 3); const ids = st.map(s => s.id).sort(() => Math.random() - 0.5);
            const gs = Array.from({ length: n }, (_, i) => ({ id: groups[i]?.id || store.uid(), name: groups[i]?.name || `Groupe ${i + 1}`, color: groups[i]?.color || G.COLORS[i % G.COLORS.length], adult: groups[i]?.adult || adults[i]?.name || '', memberIds: [] }));
            ids.forEach((sid, k) => gs[k % n].memberIds.push(sid)); await save({ groups: gs }, 'Groupes répartis au hasard', false);
          } }, 'Répartir au hasard'),
          sets.length ? h('select', { 'aria-label': 'Reprendre des groupes', onchange: async (e) => { const set = sets.find(x => x.id === e.target.value); if (!set) return; await save({ groups: set.groups.map((g, i) => ({ id: store.uid(), name: g.name, color: g.color, adult: adults[i]?.name || '', memberIds: [...(g.memberIds || [])] })) }, `Groupes repris de « ${set.name} »`, false); } },
            h('option', { value: '' }, 'Reprendre des groupes de la classe…'), sets.map(x => h('option', { value: x.id }, x.name))) : null)),
        o.kind === 'cycle' ? h('p', { class: 'muted small' }, 'Natation : nommez les groupes par niveau (ex. « Débutants », « Nageurs ») après le test, et attribuez un adulte à chaque groupe.') : null,
        groups.length ? h('div', { class: 'grid-2' }, groups.map((g, i) => h('div', { class: 'card outing-group', style: { borderLeftColor: g.color } },
          h('div', { class: 'row' }, h('input', { value: g.name, 'aria-label': 'Nom du groupe', onchange: (e) => save({ groups: groups.map(x => (x.id === g.id ? { ...x, name: e.target.value } : x)) }, 'Nom du groupe', false) }),
            h('select', { 'aria-label': 'Adulte du groupe', onchange: (e) => save({ groups: groups.map(x => (x.id === g.id ? { ...x, adult: e.target.value } : x)) }, 'Adulte du groupe', false) }, h('option', { value: '' }, 'adulte…'), adults.map(a => h('option', { value: a.name, selected: g.adult === a.name }, a.name))),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Supprimer le groupe', onclick: () => save({ groups: groups.filter(x => x.id !== g.id) }, 'Groupe supprimé', false) }, icon('trash', 14))),
          h('p', { class: 'small' }, `${(g.memberIds || []).length} élève(s) : `, (g.memberIds || []).map(sid => store.get(sid)?.firstName).filter(Boolean).join(', ') || '—')))) : null,
        groups.length ? h('details', { open: st.some(s => !memberOf(s.id)) }, h('summary', {}, `Répartir les élèves (${st.filter(s => !memberOf(s.id)).length} sans groupe)`),
          h('div', { class: 'table-wrap' }, h('table', { class: 'table', 'data-testid': 'outing-members' }, h('tbody', {}, st.map(s => h('tr', {}, h('td', {}, `${s.firstName} ${s.lastName || ''}`),
            h('td', {}, h('select', { 'data-testid': 'member-group', 'aria-label': `Groupe de ${s.firstName}`, onchange: (e) => setMember(s.id, e.target.value) }, h('option', { value: '' }, '—'), groups.map(g => h('option', { value: g.id, selected: memberOf(s.id)?.id === g.id }, g.name)))))))))) : null));
  }

  function autorisations() {
    const rows = st.map(s => ({ s, a: authOf(o, s, cls) }));
    const ok = rows.filter(r => r.a === 'autorisé').length, ko = rows.filter(r => r.a === 'refusé');
    return h('section', { class: 'card stack' },
      h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: !!o.ownAuth, 'data-testid': 'outing-own-auth', onchange: (e) => save({ ownAuth: e.target.checked }, 'Type d’autorisation', false) }),
        'Autorisation propre à cette sortie (sinon : l’autorisation annuelle « sorties scolaires » des fiches élèves)'),
      h('p', {}, badge(`${ok} autorisé(s) sur ${st.length}`, ok === st.length ? 'ok' : 'warn'), ko.length ? [' ', badge(`refus : ${ko.map(r => r.s.firstName).join(', ')}`, 'warn')] : null),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table', 'data-testid': 'outing-auth' }, h('tbody', {}, rows.map(({ s, a }) => h('tr', {}, h('td', {}, `${s.firstName} ${s.lastName || ''}`),
        h('td', {}, o.ownAuth ? h('select', { 'data-testid': 'auth-status', 'aria-label': `Autorisation de ${s.firstName}`, onchange: (e) => save({ auth: { ...(store.get(o.id).auth || {}), [s.id]: e.target.value } }, 'Autorisation', false) }, E.AUTH_STATUS.map(x => h('option', { value: x, selected: a === x }, x)))
          : h('a', { href: `#/eleve/${s.id}?t=documents` }, badge(a, E.STATUS_KIND[a] || 'muted')))))))),
      h('p', { class: 'muted small' }, 'Le « Mot aux familles » (en haut) imprime l’information et un coupon d’autorisation à découper.'));
  }

  function checklist() {
    const items = o.checklist || [];
    const add = h('input', { placeholder: 'Ajouter un élément…', 'data-testid': 'check-new' });
    return h('section', { class: 'card stack' }, h('h2', {}, `Check-list (${items.filter(x => x.done).length}/${items.length})`),
      h('ul', { class: 'plain', 'data-testid': 'outing-checklist' }, items.map((c, i) => h('li', { class: 'row' }, h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: c.done, 'data-testid': 'check-item', onchange: (e) => save({ checklist: items.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) }, 'Check-list', false) }), c.label),
        h('button', { class: 'btn btn-link small', type: 'button', onclick: () => save({ checklist: items.filter((_, j) => j !== i) }, 'Check-list', false) }, 'retirer')))),
      h('div', { class: 'row' }, add, h('button', { class: 'btn btn-small', type: 'button', onclick: () => { if (add.value.trim()) save({ checklist: [...items, { label: add.value.trim(), done: false }] }, 'Check-list', false); } }, '+')),
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => save({ checklist: items.map(x => ({ ...x, done: false })) }, 'Check-list remise à zéro', false) }, 'Tout décocher (prochaine séance)'));
  }

  function appel() {
    const today = model.todayIso();
    const dates = (o.dates || []).map(d => d.date);
    const d = dates.includes(rollDate) ? rollDate : (dates.find(x => x >= today) || dates.at(-1) || today);
    const roll = o.rolls?.[d] || {};
    const present = st.filter(s => authOf(o, s, cls) !== 'refusé');
    const count = (k) => present.filter(s => roll[k]?.[s.id]).length;
    const toggle = async (k, sid) => { const r = structuredClone(store.get(o.id).rolls || {}); r[d] ||= {}; r[d][k] ||= {}; r[d][k][sid] = !r[d][k][sid]; await save({ rolls: r }, k === 'depart' ? 'Appel au départ' : 'Appel au retour', false); };
    const missing = present.filter(s => roll.depart?.[s.id] && !roll.retour?.[s.id]);
    const grp = (sid) => (o.groups || []).find(g => (g.memberIds || []).includes(sid));
    return h('section', { class: 'card stack' },
      h('div', { class: 'row wrap' }, h('label', { class: 'inline' }, 'Date', h('select', { onchange: (e) => { rollDate = e.target.value; rerender(); } }, dates.map(x => h('option', { value: x, selected: x === d }, model.frShort(x))))),
        badge(`départ ${count('depart')}/${present.length}`, count('depart') ? 'info' : 'muted'), badge(`retour ${count('retour')}/${count('depart')}`, count('depart') && count('retour') === count('depart') ? 'ok' : 'warn')),
      missing.length && count('retour') ? h('p', { class: 'banner', 'data-testid': 'roll-missing' }, `Pas encore pointé(s) au retour : ${missing.map(s => s.firstName).join(', ')}`) : null,
      h('p', { class: 'muted small' }, 'Touchez un prénom au départ, puis au retour. Les élèves sans autorisation n’apparaissent pas.'),
      h('div', { class: 'roll-grid', 'data-testid': 'roll' }, present.map(s => h('div', { class: 'roll-row', style: { borderLeftColor: grp(s.id)?.color || 'var(--line)' } },
        h('span', {}, s.firstName, grp(s.id) ? h('span', { class: 'muted small' }, ` · ${grp(s.id).name}`) : null),
        h('button', { type: 'button', class: `btn btn-small ${roll.depart?.[s.id] ? 'btn-primary' : ''}`, 'data-testid': 'roll-depart', onclick: () => toggle('depart', s.id) }, 'départ'),
        h('button', { type: 'button', class: `btn btn-small ${roll.retour?.[s.id] ? 'btn-primary' : ''}`, 'data-testid': 'roll-retour', onclick: () => toggle('retour', s.id) }, 'retour')))));
  }
}

/** Fiche de sortie : informations, adultes, groupes, liste des élèves (avec téléphones des responsables si voulu). */
function sheet(cls, o) {
  const st = studentsOf(cls);
  const grp = (sid) => (o.groups || []).find(g => (g.memberIds || []).includes(sid));
  return h('div', { class: 'print-doc' },
    h('header', { class: 'print-head' }, h('h1', {}, o.title), h('p', {}, `${cls.name} · ${(o.dates || []).map(d => `${model.frShort(d.date)} ${d.start || ''}${d.end ? '–' + d.end : ''}`).join(' ; ')}`)),
    h('p', {}, [o.place && `Lieu : ${o.place}`, o.transport && `Transport : ${o.transport}`, `${st.length} élèves, ${(o.adults || []).length} adultes`].filter(Boolean).join(' · ')),
    (o.adults || []).length ? h('p', {}, h('strong', {}, 'Adultes : '), o.adults.map(a => `${a.name} (${a.role}${a.phone ? ', ' + a.phone : ''})`).join(' ; ')) : null,
    (o.groups || []).map(g => h('p', {}, h('strong', {}, `${g.name}${g.adult ? ' — ' + g.adult : ''} : `), (g.memberIds || []).map(id => store.get(id)?.firstName).filter(Boolean).join(', '))),
    h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, ['Élève', 'Groupe', 'Autorisation', 'Responsable à prévenir', 'Départ', 'Retour'].map(t => h('th', {}, t)))),
      h('tbody', {}, st.map(s => { const c = (s.contacts || []).find(x => x.phone) || {}; return h('tr', {}, h('td', {}, `${s.lastName || ''} ${s.firstName}`), h('td', {}, grp(s.id)?.name || ''), h('td', {}, authOf(o, s, cls)), h('td', {}, c.phone ? `${c.name || ''} ${c.phone}` : ''), h('td', {}, '☐'), h('td', {}, '☐')); }))),
    o.notes ? h('p', { class: 'pre' }, o.notes) : null,
    h('p', { class: 'small' }, 'Document confidentiel : à garder sur soi pendant la sortie, puis à détruire ou à classer.'));
}
function familyNote(cls, o) {
  const when = (o.dates || []).map(d => `${model.frDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}${d.start ? ` de ${d.start.replace(':', ' h ')} à ${(d.end || '').replace(':', ' h ')}` : ''}`).join(', ');
  const slip = () => h('div', { class: 'mot-slip' },
    h('p', {}, h('strong', {}, o.title)), h('p', {}, `La classe ${cls.name} se rendra ${o.place ? `à ${o.place} ` : ''}le ${when}.${o.transport ? ` Transport : ${o.transport}.` : ''}${o.cost ? ` Coût : ${o.cost}.` : ''}`),
    o.notes ? h('p', { class: 'pre' }, o.notes) : null, h('p', { class: 'mot-sig' }, store.getSettings().userName || ''),
    h('p', { class: 'cut' }, '✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -'),
    h('p', {}, `Je soussigné(e) …………………………… responsable de l’enfant …………………………… l’autorise / ne l’autorise pas* à participer à la sortie « ${o.title} ».`),
    h('p', {}, 'Date et signature :'), h('p', { class: 'small' }, '* rayer la mention inutile'));
  return h('div', { class: 'print-doc mot-sheet' }, slip(), slip());
}
