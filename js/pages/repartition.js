// Organisation › Répartition et décloisonnement.
// 1. Répartir les élèves chez les collègues (absence, sortie d'une partie de la classe…) :
//    répartition équitable, modifiable élève par élève, fiche à imprimer par collègue.
// 2. Décloisonnement (activable par classe) : créneaux réguliers où l'on échange des élèves
//    avec une autre classe ; se désactive d'un clic l'année où l'on n'en fait pas.
import * as store from '../store.js';
import * as model from '../model.js';
import { h, icon, toast, modal, field, badge, emptyState, confirmDialog } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { pickMany } from '../forms.js';
import { printDocument } from '../print.js';
import { consumeFlag } from '../router.js';
import * as O from '../orga.js';

let tab = 'repartition';
const DAYS = [1, 2, 3, 4, 5];
const DIRS = { recois: 'Je reçois des élèves de l’autre classe', envoie: 'Mes élèves vont dans l’autre classe', echange: 'Échange de classes (chacun prend le groupe de l’autre)' };

export const repartitionsOf = (cls) => store.all('repartition').filter(r => r.classId === cls.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
export const declosOf = (cls) => store.all('declo').filter(r => r.classId === cls.id).sort((a, b) => (a.day - b.day) || (a.start || '').localeCompare(b.start || ''));
/** Créneaux de décloisonnement d'un jour (seulement si l'option est active pour la classe). */
export function declosOn(cls, date) {
  if (!cls?.declo?.enabled) return [];
  const wd = model.weekday ? model.weekday(date) : ((new Date(date + 'T12:00').getDay() + 6) % 7) + 1;
  return declosOf(cls).filter(d => Number(d.day) === wd && (!d.from || d.from <= date) && (!d.to || d.to >= date));
}

/** Répartition équitable : élèves (ordre donné) distribués à tour de rôle, en tenant compte des places limitées. */
export function distribute(studentIds, colleagues) {
  const out = {}; const count = Object.fromEntries(colleagues.map(c => [c.id, 0]));
  for (const sid of studentIds) {
    const free = colleagues.filter(c => !c.max || count[c.id] < Number(c.max));
    if (!free.length) break;
    const c = free.reduce((a, b) => (count[b.id] < count[a.id] ? b : a));
    out[sid] = c.id; count[c.id]++;
  }
  return out;
}

const uid = () => Math.random().toString(36).slice(2, 9);
const name = (s) => `${s.firstName} ${s.lastName || ''}`.trim();
const studentsOf = (cls, date) => model.studentsOfClass(cls.id, { date: date || model.todayIso(), includeLeft: false }).map(x => x.student);

export function render({ rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Répartition et décloisonnement'), subTabs(), missing);
  if (consumeFlag('new')) setTimeout(() => repartDialog(cls), 0);
  return h('div', { class: 'page' },
    pageHeader('Répartition et décloisonnement', { favKey: 'organisation/repartition', subtitle: cls.name }),
    subTabs(),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' }, [['repartition', 'Répartir chez les collègues'], ['declo', 'Décloisonnement']].map(([k, l]) =>
      h('button', { type: 'button', class: tab === k ? 'on' : '', 'data-testid': `rep-tab-${k}`, onclick: () => { tab = k; rerender(); } }, l))),
    tab === 'declo' ? decloView(cls) : repartView(cls));
}

// ───── Répartition chez les collègues
function repartView(cls) {
  const list = repartitionsOf(cls);
  const card = (r) => {
    const st = studentsOf(cls, r.date);
    const by = (cid) => st.filter(s => r.assign?.[s.id] === cid);
    const left = st.filter(s => !r.assign?.[s.id] && !(r.absent || []).includes(s.id));
    return h('section', { class: 'card stack', 'data-testid': 'rep-card' },
      h('div', { class: 'card-head' }, h('h2', {}, `${r.title || 'Répartition'} — ${model.frDate(r.date, { weekday: 'long', day: 'numeric', month: 'long' })}`),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'rep-edit', onclick: () => repartDialog(cls, r) }, 'Modifier'),
          h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'rep-print', onclick: () => printDocument(printRepart(cls, r)) }, icon('print', 14), 'Imprimer'),
          h('button', { class: 'btn btn-small', type: 'button', onclick: () => repartDialog(cls, { ...r, id: null, date: model.todayIso() }) }, 'Réutiliser'),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Supprimer la répartition', onclick: async () => { if (await confirmDialog('Supprimer cette répartition ?', 'Elle va dans la corbeille (Réglages).', { danger: true, confirmLabel: 'Supprimer' })) await store.remove(r.id, 'Répartition supprimée'); } }, icon('trash', 16)))),
      h('div', { class: 'rep-grid' }, (r.colleagues || []).map(c => h('div', { class: 'rep-col', 'data-testid': 'rep-col' },
        h('strong', {}, c.name || 'Collègue'), c.room ? h('span', { class: 'muted small' }, ` · ${c.room}`) : null, ` `, badge(String(by(c.id).length), 'info'),
        h('ul', { class: 'plain small' }, by(c.id).map(s => h('li', {}, name(s))))))),
      left.length ? h('p', { class: 'small warn' }, `Non réparti(s) : ${left.map(name).join(', ')}`) : null,
      (r.absent || []).length ? h('p', { class: 'muted small' }, `Absent(s) : ${(r.absent || []).map(id => store.get(id)).filter(Boolean).map(name).join(', ')}`) : null,
      r.work ? h('p', { class: 'small pre' }, h('strong', {}, 'Travail prévu : '), r.work) : null);
  };
  return h('div', { class: 'stack' },
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'rep-new', onclick: () => repartDialog(cls) }, icon('plus', 16), 'Nouvelle répartition')),
    h('p', { class: 'muted small' }, 'Quand vous êtes absente ou qu’une partie de la classe part : choisissez les collègues, l’application répartit les élèves équitablement (vous pouvez déplacer chacun), puis imprimez une liste par classe d’accueil avec le travail prévu.'),
    list.length ? list.map(card) : emptyState('Aucune répartition', '« Nouvelle répartition » : date, collègues, et c’est réparti.'));
}

function repartDialog(cls, r = null) {
  const s0 = store.getSettings();
  let colleagues = (r?.colleagues || (s0.repartColleagues || []).map(c => ({ ...c, id: uid() }))).map(c => ({ ...c }));
  if (!colleagues.length) colleagues = [{ id: uid(), name: '', room: '', max: '' }, { id: uid(), name: '', room: '', max: '' }];
  let assign = { ...(r?.assign || {}) }; let absent = new Set(r?.absent || []);
  const date = h('input', { type: 'date', value: r?.date || model.todayIso(), 'data-testid': 'rep-date' });
  const title = h('input', { value: r?.title || '', placeholder: 'ex. Absence (formation), sortie du groupe 1…', 'data-testid': 'rep-title' });
  const work = h('textarea', { rows: 3, placeholder: 'ex. Fichier de calcul p. 12, lecture silencieuse, coloriage magique (dans la pochette de chaque élève)', 'data-testid': 'rep-work' }, r?.work || '');
  const colBox = h('div', { class: 'stack-sm' }); const stBox = h('div', {});
  const drawCols = () => colBox.replaceChildren(...colleagues.map((c, i) => h('div', { class: 'row wrap', 'data-testid': 'rep-colleague' },
    h('input', { value: c.name, placeholder: 'Collègue (ex. Mme Martin)', 'aria-label': 'Collègue', 'data-testid': 'rep-colleague-name', oninput: (e) => { c.name = e.target.value; } , onchange: drawSt }),
    h('input', { value: c.room || '', placeholder: 'Classe / salle (ex. CM1)', 'aria-label': 'Classe ou salle', style: { width: '9em' }, oninput: (e) => { c.room = e.target.value; } }),
    h('input', { type: 'number', min: 0, value: c.max || '', placeholder: 'places', 'aria-label': 'Nombre de places au maximum', style: { width: '6em' }, oninput: (e) => { c.max = e.target.value; } }),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retirer ce collègue', onclick: () => { colleagues.splice(i, 1); for (const k of Object.keys(assign)) if (assign[k] === c.id) delete assign[k]; drawCols(); drawSt(); } }, icon('x', 14)))));
  const drawSt = () => {
    const st = studentsOf(cls, date.value);
    stBox.replaceChildren(h('table', { class: 'table small' }, h('thead', {}, h('tr', {}, h('th', {}, 'Élève'), h('th', {}, 'Va chez'), h('th', {}, 'Absent'))),
      h('tbody', {}, st.map(s => h('tr', {}, h('td', {}, name(s)),
        h('td', {}, h('select', { 'aria-label': `Classe d’accueil de ${s.firstName}`, 'data-testid': 'rep-assign', disabled: absent.has(s.id), onchange: (e) => { if (e.target.value) assign[s.id] = e.target.value; else delete assign[s.id]; } },
          h('option', { value: '' }, '—'), colleagues.map(c => h('option', { value: c.id, selected: assign[s.id] === c.id }, c.name || 'Collègue')))),
        h('td', {}, h('input', { type: 'checkbox', checked: absent.has(s.id), 'aria-label': `${s.firstName} absent`, onchange: (e) => { if (e.target.checked) { absent.add(s.id); delete assign[s.id]; } else absent.delete(s.id); drawSt(); } })))))));
  };
  date.addEventListener('change', drawSt);
  const auto = (shuffle) => {
    const ids = studentsOf(cls, date.value).filter(s => !absent.has(s.id)).map(s => s.id);
    if (shuffle) for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const ok = colleagues.filter(c => c.name.trim());
    if (!ok.length) { toast('Indiquez au moins un collègue.', { kind: 'error' }); return; }
    assign = distribute(ids, ok);
    if (Object.keys(assign).length < ids.length) toast('Pas assez de places pour tous les élèves.', { kind: 'error' });
    drawSt();
  };
  drawCols(); drawSt();
  modal({ title: r?.id ? 'Modifier la répartition' : 'Nouvelle répartition', wide: true, body: h('div', { class: 'stack' },
    h('div', { class: 'grid-2' }, field('Date', date), field('Motif (facultatif)', title)),
    h('h3', {}, 'Collègues qui accueillent'), colBox,
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'rep-pick-colleagues', onclick: async () => {
        const cols = O.colleagues();
        if (!cols.length) { toast('Ajoutez vos collègues dans Organisation › Contacts (bouton « + Collègue ») : ils seront proposés ici.'); return; }
        const chosen = await pickMany({ title: 'Mes collègues (Contacts)', items: cols.map(c => ({ id: c.id, label: O.colleagueLabel(c) })), selected: colleagues.filter(c => c.contactId).map(c => c.contactId) });
        if (!chosen) return;
        colleagues = colleagues.filter(c => (c.contactId ? chosen.includes(c.contactId) : c.name.trim()));
        for (const id of chosen) if (!colleagues.some(c => c.contactId === id)) { const ct = store.get(id); colleagues.push({ id: uid(), contactId: id, name: ct.name, room: ct.classe || '', max: '' }); }
        for (const k of Object.keys(assign)) if (!colleagues.some(c => c.id === assign[k])) delete assign[k];
        drawCols(); drawSt();
      } }, icon('plus', 14), 'Choisir mes collègues'),
      h('button', { class: 'btn btn-small btn-link', type: 'button', 'data-testid': 'rep-add-colleague', onclick: () => { colleagues.push({ id: uid(), name: '', room: '', max: '' }); drawCols(); } }, 'Autre (taper le nom)')),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn btn-primary btn-small', type: 'button', 'data-testid': 'rep-auto', onclick: () => auto(false) }, 'Répartir équitablement (ordre alphabétique)'),
      h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'rep-shuffle', onclick: () => auto(true) }, 'Répartir au hasard')),
    stBox, field('Travail prévu (repris sur chaque fiche)', work)),
  actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, testid: 'rep-save', onClick: async () => {
    const cols = colleagues.filter(c => c.name.trim());
    if (!cols.length) { toast('Indiquez au moins un collègue.', { kind: 'error' }); return false; }
    const ids = new Set(cols.map(c => c.id)); const a = Object.fromEntries(Object.entries(assign).filter(([, v]) => ids.has(v)));
    const data = { classId: cls.id, date: date.value, title: title.value.trim(), work: work.value.trim(), colleagues: cols, assign: a, absent: [...absent] };
    await store.setSettings({ repartColleagues: cols.map(({ name: n, room, max, contactId }) => ({ name: n, room, max, contactId: contactId || null })) });
    if (r?.id) await store.update(r.id, data, 'Répartition modifiée'); else await store.create('repartition', data, 'Répartition enregistrée');
  } }] });
}

function printRepart(cls, r) {
  const st = studentsOf(cls, r.date);
  return h('div', { class: 'print-doc' },
    h('header', { class: 'print-head' }, h('h1', {}, `Répartition des élèves — ${cls.name}`), h('p', {}, `${model.frDate(r.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${r.title ? ' · ' + r.title : ''}`)),
    h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, ['Classe d’accueil', 'Élèves', 'Nombre'].map(t => h('th', {}, t)))),
      h('tbody', {}, (r.colleagues || []).map(c => { const ss = st.filter(s => r.assign?.[s.id] === c.id); return h('tr', {}, h('td', {}, `${c.name}${c.room ? ' (' + c.room + ')' : ''}`), h('td', {}, ss.map(name).join(', ')), h('td', {}, String(ss.length))); }))),
    (r.colleagues || []).map(c => { const ss = st.filter(s => r.assign?.[s.id] === c.id); return h('div', { class: 'print-slip', style: { breakInside: 'avoid', border: '1px dashed #888', padding: '8px', marginTop: '10px' } },
      h('h2', { class: 'print-h2' }, `Pour ${c.name}${c.room ? ' — ' + c.room : ''} : ${ss.length} élève(s) de ${cls.name}`), h('ul', {}, ss.map(s => h('li', {}, name(s)))), r.work ? h('p', { class: 'pre' }, h('strong', {}, 'Travail : '), r.work) : null, h('p', { class: 'small' }, 'Merci !')); }));
}

// ───── Décloisonnement
function decloView(cls) {
  const on = !!cls.declo?.enabled;
  const toggle = h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: on, 'data-testid': 'declo-enabled', onchange: (e) => store.update(cls.id, { declo: { ...(cls.declo || {}), enabled: e.target.checked } }, e.target.checked ? 'Décloisonnement activé' : 'Décloisonnement désactivé') }),
    h('strong', {}, ' Je fais du décloisonnement avec cette classe'));
  if (!on) return h('div', { class: 'stack' }, h('section', { class: 'card stack' }, toggle,
    h('p', { class: 'muted small' }, 'Désactivé : rien n’apparaît dans « Aujourd’hui » ni dans le cahier journal. Vos créneaux éventuels sont gardés et reviennent si vous réactivez (par exemple l’an prochain, sur la nouvelle classe).')));
  const list = declosOf(cls);
  const row = (d) => {
    const ss = (d.studentIds || []).map(id => store.get(id)).filter(Boolean);
    return h('section', { class: 'card', 'data-testid': 'declo-card' }, h('div', { class: 'card-head' },
      h('h2', {}, `${model.JOURS[d.day]} ${d.start || ''}–${d.end || ''} · ${d.subject || 'Décloisonnement'}`),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'declo-edit', onclick: () => decloDialog(cls, d) }, 'Modifier'),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Supprimer ce créneau', onclick: () => store.remove(d.id, 'Créneau de décloisonnement supprimé') }, icon('trash', 16)))),
      h('p', { class: 'small' }, `${DIRS[d.direction] || ''}${d.otherClass ? ' · avec ' + d.otherClass : ''}${d.teacher ? ' (' + d.teacher + ')' : ''}`),
      h('p', { class: 'small' }, ss.length ? `Élèves concernés : ${ss.map(name).join(', ')}` : 'Toute la classe'),
      d.from || d.to ? h('p', { class: 'muted small' }, `${d.from ? 'du ' + model.frShort(d.from) : ''}${d.to ? ' au ' + model.frShort(d.to) : ''}`) : null,
      d.note ? h('p', { class: 'small pre' }, d.note) : null);
  };
  return h('div', { class: 'stack' },
    h('section', { class: 'card stack' }, toggle, h('p', { class: 'muted small' }, 'Vos créneaux réguliers : ils s’affichent sur « Aujourd’hui » le bon jour, et la case « Décloisonnement » est proposée dans le cahier journal.')),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'declo-new', onclick: () => decloDialog(cls) }, icon('plus', 16), 'Nouveau créneau'),
      list.length ? h('button', { class: 'btn', type: 'button', onclick: () => printDocument(h('div', { class: 'print-doc' }, h('h1', {}, `Décloisonnement — ${cls.name}`), h('table', { class: 'print-table' },
        h('thead', {}, h('tr', {}, ['Jour', 'Horaire', 'Discipline', 'Organisation', 'Avec', 'Élèves'].map(t => h('th', {}, t)))),
        h('tbody', {}, list.map(d => h('tr', {}, h('td', {}, model.JOURS[d.day]), h('td', {}, `${d.start}–${d.end}`), h('td', {}, d.subject || ''), h('td', {}, DIRS[d.direction] || ''), h('td', {}, [d.otherClass, d.teacher].filter(Boolean).join(' — ')), h('td', {}, (d.studentIds || []).length ? d.studentIds.map(id => store.get(id)).filter(Boolean).map(name).join(', ') : 'toute la classe'))))))) }, icon('print', 16), 'Imprimer') : null),
    list.length ? list.map(row) : emptyState('Aucun créneau', 'ex. Sciences le vendredi après-midi avec l’autre CE2.'));
}

function decloDialog(cls, d = null) {
  const day = h('select', { 'data-testid': 'declo-day' }, DAYS.map(k => h('option', { value: k, selected: Number(d?.day || 5) === k }, model.JOURS[k])));
  const start = h('input', { type: 'time', value: d?.start || '13:30', 'data-testid': 'declo-start' });
  const end = h('input', { type: 'time', value: d?.end || '15:00', 'data-testid': 'declo-end' });
  const subject = h('select', { 'data-testid': 'declo-subject' }, model.subjects().map(x => h('option', { value: x, selected: x === (d?.subject || 'Sciences et technologie') }, x)));
  const dir = h('select', { 'data-testid': 'declo-dir' }, Object.entries(DIRS).map(([k, l]) => h('option', { value: k, selected: k === (d?.direction || 'echange') }, l)));
  const other = h('input', { value: d?.otherClass || '', placeholder: 'ex. CE2 A', 'data-testid': 'declo-other' });
  const teacher = h('input', { value: d?.teacher || '', placeholder: 'ex. M. Dupont' });
  const cols = O.colleagues();
  const pickCol = cols.length ? h('select', { 'aria-label': 'Choisir une collègue', 'data-testid': 'declo-colleague', onchange: (e) => { const c = store.get(e.target.value); if (c) { teacher.value = c.name; if (c.classe) other.value = c.classe; } } },
    h('option', { value: '' }, 'Choisir parmi mes collègues…'), cols.map(c => h('option', { value: c.id, selected: d?.teacher === c.name }, O.colleagueLabel(c)))) : null;
  const from = h('input', { type: 'date', value: d?.from || '' }); const to = h('input', { type: 'date', value: d?.to || '' });
  const note = h('textarea', { rows: 2, placeholder: 'ex. j’apporte le matériel de sciences ; elle fait anglais avec ma classe' }, d?.note || '');
  let ids = [...(d?.studentIds || [])];
  const who = h('span', { class: 'small' }); const drawWho = () => { who.textContent = ids.length ? `${ids.length} élève(s)` : 'Toute la classe'; }; drawWho();
  modal({ title: d ? 'Modifier le créneau' : 'Nouveau créneau de décloisonnement', body: h('div', { class: 'stack' },
    h('div', { class: 'grid-3' }, field('Jour', day), field('Début', start), field('Fin', end)),
    field('Discipline', subject), field('Organisation', dir),
    pickCol, h('div', { class: 'grid-2' }, field('Autre classe', other), field('Collègue', teacher)),
    h('div', { class: 'row' }, h('strong', {}, 'Élèves : '), who, h('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
      const r = await pickMany({ title: 'Élèves concernés (aucun = toute la classe)', items: studentsOf(cls).map(s => ({ id: s.id, label: name(s) })), selected: ids });
      if (r) { ids = r; drawWho(); } } }, 'Choisir')),
    h('div', { class: 'grid-2' }, field('À partir du (facultatif)', from), field('Jusqu’au (facultatif)', to)), field('Remarque', note)),
  actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, testid: 'declo-save', onClick: async () => {
    const data = { classId: cls.id, day: Number(day.value), start: start.value, end: end.value, subject: subject.value, direction: dir.value, otherClass: other.value.trim(), teacher: teacher.value.trim(), studentIds: ids, from: from.value, to: to.value, note: note.value.trim() };
    if (d) await store.update(d.id, data, 'Créneau modifié'); else await store.create('declo', data, 'Créneau de décloisonnement ajouté');
  } }] });
}
