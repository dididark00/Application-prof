// Familles : tout ce qui est préparé ici est PRIVÉ. Rien n'est envoyé par l'application :
// la diffusion passe par le cahier de liaison, la messagerie ou l'application de l'école (réglable),
// déjà validé par l'institution et où les parents ont leur compte.
// L'application prépare, vérifie (droit à l'image, données privées exclues), garde la trace et imprime.
import * as store from '../store.js';
import * as model from '../model.js';
import * as E from '../eleve.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState, pickFiles, download } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { printDocument, printTable } from '../print.js';

const fullName = (s) => `${s.firstName} ${s.lastName || ''}`.trim();
const students = (cls) => model.studentsOfClass(cls.id).map(x => x.student);
const levelOf = (cls, sid) => model.studentsOfClass(cls.id, { includeFuture: true, includeLeft: true }).find(x => x.student.id === sid)?.enrollment?.level || '';
// Moyen de communication avec les familles : réglable (pas d'ENT dans beaucoup d'écoles primaires).
export const CHANNELS = {
  papier: { label: 'le cahier de liaison (papier)', how: 'imprimez le mot et collez-le dans le cahier de liaison' },
  mail: { label: 'e-mail', how: 'l’application ouvre votre messagerie avec le message prêt' },
  appli: { label: 'un ENT ou une application de l’école (Klassroom, Beneylu, ONE…)', how: 'copiez le texte et collez-le dans l’application de l’école' },
};
export const channel = () => (CHANNELS[store.getSettings().familyChannel] ? store.getSettings().familyChannel : 'papier');
const notice = () => h('div', { class: 'card notice small', 'data-testid': 'family-channel' },
  h('label', { class: 'inline' }, 'Je communique avec les familles par', h('select', { 'data-testid': 'family-channel-select', onchange: (e) => store.setSettings({ familyChannel: e.target.value }) }, Object.entries(CHANNELS).map(([k, v]) => h('option', { value: k, selected: channel() === k }, v.label)))),
  h('p', {}, `Rien n’est envoyé par l’application : ${CHANNELS[channel()].how}. Elle garde la trace et vérifie qu’aucune donnée privée ne part.`));
function page(title, favKey, cls, body, actions = []) {
  return h('div', { class: 'page' }, pageHeader(title, { favKey, subtitle: cls?.name, actions }), subTabs(), body);
}
const copy = async (text) => { try { await navigator.clipboard.writeText(text); toast('Copié : collez-le où vous voulez (application de l’école, SMS, e-mail…)'); } catch { toast('Copie refusée par le navigateur : sélectionnez le texte et copiez-le.', { kind: 'error' }); } };

// ───────── Droit à l'image
export function imageUsage() { return store.getSettings().publicationUsage || E.DEFAULT_IMAGE_USAGES.find(u => (channel() === 'appli' ? /ENT/ : /Cahier de vie/).test(u)) || E.DEFAULT_IMAGE_USAGES[0]; }
/** Élèves d'une photo dont le droit à l'image n'est pas « autorisé » pour l'usage choisi. */
export function imageBlockers(studentIds, yearId, usage = imageUsage()) {
  const t = { id: `image:${usage}`, label: usage, category: 'image' };
  return studentIds.map(id => store.get(id)).filter(Boolean).map(s => ({ s, status: E.docState(E.docOf(s.id, yearId, t.id), t).status })).filter(x => x.status !== 'autorisé');
}

// ═════════ Publications (cahier de vie, actualités de classe)
export function renderPublications({ params, rerender }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return page('Publications', 'familles/publications', null, miss);
  if (params[0]) return pubDetail(params[0], cls, rerender);
  const list = store.all('publication').filter(p => p.classId === cls.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return page('Publications', 'familles/publications', cls, h('div', { class: 'stack' },
    h('p', { class: 'muted' }, 'Cahier de vie, actualités de la classe, retour de sortie : préparez le texte et les photos ici. Tant que ce n’est pas marqué « publié », c’est un brouillon privé.'), notice(),
    list.length ? h('div', { class: 'dash' }, list.map(p => h('a', { class: 'card card-link', href: `#/publications/${p.id}`, 'data-testid': 'pub-card' }, h('h2', {}, p.title || 'Sans titre'),
      h('p', {}, p.status === 'publié' ? badge(`publié le ${model.frShort(p.publishedAt)}`, 'ok') : badge('brouillon privé', 'muted'), ` ${(p.photos || []).length} photo(s)`)))) : emptyState('Aucune publication', 'Commencez par « Nouvelle publication ».')),
  [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'pub-new', onclick: async () => { const p = await store.create('publication', { classId: cls.id, title: '', text: '', date: model.todayIso(), photos: [], status: 'brouillon', audience: 'classe' }, 'Publication'); location.hash = `#/publications/${p.id}`; } }, icon('plus', 16), 'Nouvelle publication')]);
}

function pubDetail(id, cls, rerender) {
  const p = store.get(id);
  if (!p || p.deletedAt) return page('Publication', null, cls, emptyState('Publication introuvable'));
  const up = (patch, label = 'Publication', quiet = true) => store.update(p.id, patch, label, { quiet });
  const usage = imageUsage();
  const all = students(cls);
  const blockers = (p.photos || []).flatMap((ph, i) => imageBlockers(ph.studentIds || [], cls.yearId, usage).map(b => ({ ...b, i })));
  const photoCard = (ph, i) => {
    const img = h('img', { alt: ph.name || 'photo', class: 'pub-img' });
    store.getBlob(ph.blobId).then(b => { if (b) img.src = URL.createObjectURL(b); });
    const bl = imageBlockers(ph.studentIds || [], cls.yearId, usage);
    return h('div', { class: 'pub-photo', 'data-testid': 'pub-photo' }, img,
      h('div', { class: 'small' }, 'Élèves visibles : ', (ph.studentIds || []).length ? (ph.studentIds || []).map(sid => store.get(sid)?.firstName).join(', ') : h('span', { class: 'muted' }, 'aucun indiqué')),
      bl.length ? h('p', { class: 'small warn-text', 'data-testid': 'pub-blocked' }, `⚠ Droit à l’image « ${usage} » non accordé : ${bl.map(b => `${b.s.firstName} (${b.status})`).join(', ')}`) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'pub-tag', onclick: () => tagDialog(p, i, all, rerender) }, 'Qui est sur la photo ?'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: async () => { const b = await store.getBlob(ph.blobId); if (b) download(ph.name || `photo-${i + 1}.jpg`, b); } }, icon('download', 14), 'Télécharger'),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retirer la photo', onclick: async () => { await up({ photos: p.photos.filter((_, j) => j !== i) }, 'Photo retirée', false); } }, icon('trash', 14))));
  };
  const publish = async () => {
    const fresh = store.get(p.id);
    if (!fresh.title?.trim() && !fresh.text?.trim()) { toast('Ajoutez au moins un titre ou un texte.', { kind: 'error' }); return; }
    const bl = (fresh.photos || []).flatMap(ph => imageBlockers(ph.studentIds || [], cls.yearId, usage));
    if (bl.length) { modal({ title: 'Publication bloquée', body: h('div', {}, h('p', {}, `Ces élèves apparaissent sur une photo sans autorisation « ${usage} » :`), h('ul', {}, bl.map(b => h('li', {}, `${fullName(b.s)} : ${b.status}`))), h('p', { class: 'muted small' }, 'Retirez la photo, ou mettez à jour l’autorisation dans la fiche de l’élève si vous l’avez reçue.')), actions: [{ label: 'Compris', primary: true }] }); return; }
    if (!(fresh.photos || []).every(ph => ph.checked || (ph.studentIds || []).length)) {
      if (!await confirmDialog('Photos sans élève indiqué', 'Certaines photos n’ont pas d’élève indiqué. Confirmez qu’aucun élève n’y est reconnaissable.', { confirmLabel: 'Aucun élève reconnaissable' })) return;
      await up({ photos: fresh.photos.map(ph => ({ ...ph, checked: true })) });
    }
    await up({ status: 'publié', publishedAt: model.todayIso() }, 'Publication marquée publiée', false);
    toast(channel() === 'papier' ? 'Marquée « diffusée ». Imprimez-la pour le cahier de liaison ou l’affichage.' : 'Marquée « diffusée ».');
  };
  const textOut = () => { const f = store.get(p.id); return `${f.title || ''}\n\n${f.text || ''}`.trim(); };
  return page(p.title || 'Publication', null, cls, h('div', { class: 'stack' },
    h('a', { href: '#/publications' }, '‹ Toutes les publications'),
    h('section', { class: 'card form' },
      field('Titre', h('input', { value: p.title || '', 'data-testid': 'pub-title', onchange: (e) => up({ title: e.target.value }) })),
      h('div', { class: 'grid-2' }, field('Date', h('input', { type: 'date', value: p.date || '', onchange: (e) => up({ date: e.target.value }) })),
        field('Pour', h('select', { onchange: (e) => up({ audience: e.target.value }) }, [['classe', 'toutes les familles de la classe'], ['niveau', 'un niveau'], ['eleves', 'certaines familles']].map(([v, l]) => h('option', { value: v, selected: (p.audience || 'classe') === v }, l))))),
      p.audience === 'eleves' ? h('div', { class: 'chips' }, all.map(s => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: (p.studentIds || []).includes(s.id), onchange: (e) => { const set = new Set(store.get(p.id).studentIds || []); e.target.checked ? set.add(s.id) : set.delete(s.id); up({ studentIds: [...set] }); } }), s.firstName))) : null,
      p.audience === 'niveau' ? field('Niveau', h('select', { onchange: (e) => up({ level: e.target.value }) }, (cls.levels || []).map(l => h('option', { value: l, selected: p.level === l }, l)))) : null,
      field('Texte', h('textarea', { rows: 8, 'data-testid': 'pub-text', onchange: (e) => up({ text: e.target.value }) }, p.text || ''))),
    h('section', { class: 'card stack' }, h('div', { class: 'card-head' }, h('h2', {}, 'Photos'),
      h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'pub-add-photo', onclick: async () => {
        const fs = await pickFiles({ accept: 'image/*', multiple: true }); if (!fs.length) return;
        const add = []; for (const f of fs) add.push({ blobId: await store.putBlob(f), name: f.name, mime: f.type, studentIds: [] });
        await up({ photos: [...(store.get(p.id).photos || []), ...add] }, 'Photos ajoutées', false);
      } }, '+ Photos')),
      h('p', { class: 'muted small' }, `Pour chaque photo, indiquez les élèves reconnaissables : l’application vérifie leur droit à l’image pour l’usage « ${usage} » (modifiable dans Réglages › Documents et confidentialité).`),
      (p.photos || []).length ? h('div', { class: 'pub-photos' }, p.photos.map(photoCard)) : h('p', { class: 'muted' }, 'Aucune photo.')),
    h('section', { class: 'card stack' }, h('h2', {}, 'Diffuser'),
      p.status === 'publié' ? h('p', {}, badge(`publié le ${model.frShort(p.publishedAt)}`, 'ok'), ' ', h('button', { class: 'btn btn-link small', type: 'button', onclick: () => up({ status: 'brouillon', publishedAt: null }, 'Repassée en brouillon', false) }, 'repasser en brouillon')) : h('p', {}, badge('brouillon privé', 'muted')),
      blockers.length ? h('p', { class: 'warn-text' }, `${blockers.length} élève(s) sans autorisation sur les photos : publication bloquée.`) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => copy(textOut()) }, icon('copy', 14), 'Copier le texte'),
        h('button', { class: 'btn', type: 'button', onclick: async () => printDocument(await pubDoc(store.get(p.id))) }, icon('print', 14), 'Imprimer / PDF'),
        p.status !== 'publié' ? h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'pub-publish', onclick: publish }, 'Marquer « diffusé »') : null),
      notice()),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-danger', type: 'button', onclick: async () => { if (await confirmDialog('Supprimer la publication ?', 'Elle ira dans la corbeille.', { danger: true, confirmLabel: 'Supprimer' })) { await store.remove(p.id, 'Publication supprimée'); location.hash = '#/publications'; } } }, 'Supprimer'))));
}
function tagDialog(p, i, all, rerender) {
  const cur = new Set(store.get(p.id).photos[i].studentIds || []);
  modal({ title: 'Élèves reconnaissables sur la photo', body: h('div', { class: 'chips' }, all.map(s => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: cur.has(s.id), 'data-testid': 'tag-student', 'data-name': s.firstName, onchange: (e) => { e.target.checked ? cur.add(s.id) : cur.delete(s.id); } }), fullName(s)))),
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
      const photos = store.get(p.id).photos.map((ph, j) => (j === i ? { ...ph, studentIds: [...cur], checked: true } : ph));
      await store.update(p.id, { photos }, 'Élèves de la photo'); rerender();
    } }] });
}
async function pubDoc(p) {
  const imgs = [];
  for (const ph of p.photos || []) { const b = await store.getBlob(ph.blobId); if (b) imgs.push(h('img', { src: URL.createObjectURL(b), class: 'pub-print-img', alt: '' })); }
  return h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, p.title || ''), h('p', {}, model.frDate(p.date))), h('div', {}, (p.text || '').split('\n').map(l => h('p', {}, l || ' '))), h('div', { class: 'pub-print-photos' }, imgs));
}

// ═════════ Modèles de mots (rédaction, impression pour le carnet)
export const MSG_MODELES = {
  info: ['Information', (s) => `Bonjour,\n\nJe vous informe que …\n\nBien cordialement,`],
  bravo: ['Félicitations', (s) => `Bonjour,\n\nJe tenais à vous dire que ${s ? s.firstName : 'votre enfant'} a fait de beaux progrès ces derniers temps : … Bravo à ${s && s.gender === 'f' ? 'elle' : s ? 'lui' : 'lui ou elle'} !\n\nBien cordialement,`],
  rencontre: ['Proposer une rencontre', (s) => `Bonjour,\n\nJe souhaiterais vous rencontrer pour faire le point sur la scolarité de ${s ? s.firstName : 'votre enfant'}. Pourriez-vous m’indiquer vos disponibilités ?\n\nBien cordialement,`],
  materiel: ['Matériel oublié', (s) => `Bonjour,\n\n${s ? s.firstName : 'Votre enfant'} n’a pas son … depuis quelques jours. Pourriez-vous vérifier son cartable ?\n\nMerci,`],
  document: ['Document à rapporter', (s) => `Bonjour,\n\nIl manque encore : … Merci de le remettre dans le cartable${s ? ' de ' + s.firstName : ''}.\n\nBien cordialement,`],
};
// ═════════ Carnet de liaison et comportement : suivi, élève par élève, des mots écrits dans le carnet
// (à faire signer) et des comportements ou oublis relevés. Rien n'est envoyé.
export const CARNET_CATS = [['comportement', 'Comportement', 'warn'], ['travail', 'Travail non fait', 'warn'], ['oubli', 'Oubli de matériel', 'warn'], ['retard', 'Retard', 'warn'],
  ['felicitations', 'Félicitations', 'ok'], ['information', 'Information', 'info'], ['autre', 'Autre', 'muted']];
const catOf = (k) => CARNET_CATS.find(c => c[0] === k) || CARNET_CATS.at(-1);
const carnetState = { cat: '', span: 'periode', unsigned: false };
function spanRange(cls, span) {
  const today = model.todayIso(); const year = store.get(cls.yearId);
  if (span === 'semaine') { const m = model.mondayOf(today); return [m, model.addDays(m, 6)]; }
  if (span === 'mois') return [`${today.slice(0, 7)}-01`, `${today.slice(0, 7)}-31`];
  if (span === 'periode') { // période en cours, vacances qui suivent comprises
    const ps = model.periodsOf(year); const i = ps.findLastIndex(x => x.start <= today); const p = ps[Math.max(0, i)];
    return p ? [p.start, ps[i + 1] ? model.addDays(ps[i + 1].start, -1) : (year?.end || p.end)] : ['0000', '9999']; }
  return [year?.start || '0000', year?.end || '9999'];
}
export function renderMessages({ query, rerender }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return page('Carnet de liaison et comportement', 'familles/messages', null, miss);
  const st = students(cls); const ids = new Set(st.map(s => s.id));
  const filter = query.e || '';
  const [from, to] = spanRange(cls, carnetState.span);
  const all = store.all('carnet').filter(x => ids.has(x.studentId));
  const inSpan = all.filter(x => x.date >= from && x.date <= to);
  const list = inSpan.filter(x => (!filter || x.studentId === filter) && (!carnetState.cat || x.category === carnetState.cat) && (!carnetState.unsigned || (x.written && !x.signed))).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const unsigned = all.filter(x => x.written && !x.signed).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const name = (id) => store.get(id)?.firstName || '';
  const sign = (x) => h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'carnet-sign', onclick: () => store.update(x.id, { signed: true, signedAt: model.todayIso() }, `Mot signé (${name(x.studentId)})`) }, 'Signé');
  const counts = (sid) => Object.fromEntries(CARNET_CATS.map(([k]) => [k, inSpan.filter(x => x.studentId === sid && x.category === k).length]));
  const shownCats = CARNET_CATS.filter(([k]) => inSpan.some(x => x.category === k));
  const recapRows = st.map(s => ({ s, c: counts(s.id), u: unsigned.filter(x => x.studentId === s.id).length })).filter(r => Object.values(r.c).some(Boolean) || r.u);
  const exch = store.all('exchange').filter(x => ids.has(x.studentId) && (!filter || x.studentId === filter)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const printStudent = (sid) => { const s = store.get(sid); const rows = all.filter(x => x.studentId === sid).sort((a, b) => a.date.localeCompare(b.date));
    printDocument(printTable({ title: `Carnet de liaison — ${fullName(s)}`, subtitle: cls.name, columns: ['Date', 'Motif', 'Détail', 'Mot dans le carnet', 'Signé'].map(label => ({ label })), rows: rows.map(x => [model.frShort(x.date), catOf(x.category)[1], x.text || '', x.written ? 'oui' : '', x.signed ? (x.signedAt ? model.frShort(x.signedAt) : 'oui') : (x.written ? 'non' : '')]) })); };
  const seg = (key, opts) => h('div', { class: 'seg wrap', role: 'group' }, opts.map(([v, l]) => h('button', { type: 'button', class: carnetState[key] === v ? 'on' : '', 'data-testid': `carnet-${key}-${v || 'tous'}`, onclick: () => { carnetState[key] = v; rerender(); } }, l)));
  return page('Carnet de liaison et comportement', 'familles/messages', cls, h('div', { class: 'stack' },
    h('p', { class: 'muted' }, 'Notez en quelques secondes un comportement, un oubli, un travail non fait ou des félicitations, et si un mot a été écrit dans le carnet : l’application suit les mots à faire signer et fait le bilan par élève.'),
    unsigned.length ? h('section', { class: 'card', 'data-testid': 'carnet-unsigned' }, h('h2', {}, `Mots à faire signer (${unsigned.length})`),
      h('ul', { class: 'plain carnet-list' }, unsigned.map(x => { const d = model.diffDays(x.date, model.todayIso());
        return h('li', {}, h('strong', {}, name(x.studentId)), ` — ${catOf(x.category)[1].toLowerCase()}${x.text ? ' : ' + x.text : ''} `, h('span', { class: 'muted small' }, `(${model.frShort(x.date)}${d >= 3 ? `, il y a ${d} jours` : ''})`), ' ', d >= 3 ? badge('à relancer', 'warn') : null, ' ', sign(x)); }))) : null,
    h('div', { class: 'row wrap' }, seg('span', [['semaine', 'Semaine'], ['mois', 'Mois'], ['periode', 'Période'], ['annee', 'Année']]),
      h('select', { 'aria-label': 'Élève', 'data-testid': 'carnet-student', onchange: (e) => { location.hash = `#/messages${e.target.value ? '?e=' + e.target.value : ''}`; } }, h('option', { value: '' }, 'Tous les élèves'), st.map(s => h('option', { value: s.id, selected: filter === s.id }, fullName(s)))),
      h('select', { 'aria-label': 'Motif', onchange: (e) => { carnetState.cat = e.target.value; rerender(); } }, h('option', { value: '' }, 'Tous les motifs'), CARNET_CATS.map(([k, l]) => h('option', { value: k, selected: carnetState.cat === k }, l))),
      h('label', { class: 'inline small' }, h('input', { type: 'checkbox', checked: carnetState.unsigned, onchange: (e) => { carnetState.unsigned = e.target.checked; rerender(); } }), 'non signés seulement')),
    !filter ? h('section', { class: 'card', 'data-testid': 'carnet-recap' }, h('h2', {}, `Bilan par élève — du ${model.frShort(from)} au ${model.frShort(to)}`),
      recapRows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Élève'), shownCats.map(([, l]) => h('th', {}, l)), h('th', {}, 'Non signés'))),
        h('tbody', {}, recapRows.sort((a, b) => Object.values(b.c).reduce((x, y) => x + y, 0) - Object.values(a.c).reduce((x, y) => x + y, 0)).map(r => h('tr', {},
          h('td', {}, h('a', { href: `#/messages?e=${r.s.id}` }, fullName(r.s))), shownCats.map(([k, , kind]) => h('td', {}, r.c[k] ? badge(String(r.c[k]), r.c[k] >= 3 && kind === 'warn' ? 'warn' : kind === 'ok' ? 'ok' : 'muted') : '')), h('td', {}, r.u ? badge(String(r.u), 'warn') : ''))))))
        : h('p', { class: 'muted' }, 'Rien de noté sur cette durée.')) : null,
    h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, filter ? `Carnet de ${name(filter)}` : 'Tout ce qui a été noté'), filter ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => printStudent(filter) }, icon('print', 14), 'Imprimer le suivi') : null),
      list.length ? h('ul', { class: 'obs-list carnet-list', 'data-testid': 'carnet-list' }, list.map(x => h('li', {},
        h('strong', {}, model.frShort(x.date)), ' ', filter ? null : h('a', { href: `#/messages?e=${x.studentId}` }, name(x.studentId)), ' ', badge(catOf(x.category)[1], catOf(x.category)[2]),
        x.written ? (x.signed ? badge('mot signé', 'ok') : badge('mot à faire signer', 'warn')) : null, x.text ? h('span', {}, ` ${x.text}`) : null, ' ',
        x.written && !x.signed ? sign(x) : null,
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Supprimer', onclick: async () => { await store.remove(x.id, 'Note supprimée'); toast('Note supprimée', { action: 'Annuler', onAction: () => store.undo() }); } }, icon('trash', 14)))))
        : h('p', { class: 'muted' }, 'Rien de noté.')),
    h('details', { class: 'card' }, h('summary', {}, `Autres échanges avec les familles (${exch.length})`),
      h('p', { class: 'muted small' }, 'Rendez-vous, appels, mots rédigés avec les modèles : notés dans les fiches élèves.'),
      exch.length ? h('ul', { class: 'obs-list', 'data-testid': 'msg-list' }, exch.map(x => h('li', {}, h('strong', {}, model.frShort(x.date)), ' ', h('a', { href: `#/eleve/${x.studentId}?t=echanges` }, store.get(x.studentId)?.firstName || ''), ' ', badge(x.kind, 'muted'), x.with ? ` avec ${x.with}` : '', h('p', { class: 'pre small' }, x.summary || '')))) : null)),
  [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'carnet-new', onclick: () => carnetDialog(cls, st, filter) }, icon('plus', 16), 'Noter'),
    h('button', { class: 'btn', type: 'button', 'data-testid': 'msg-new', onclick: () => composeDialog(cls, st, filter) }, 'Rédiger un mot (modèles)')]);
}
function carnetDialog(cls, st, preset = '') {
  const chosen = new Set(preset ? [preset] : []);
  let cat = 'comportement';
  const chips = h('div', { class: 'chips carnet-students' }, st.map(s => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: chosen.has(s.id), 'data-testid': 'carnet-pick', 'data-name': s.firstName, onchange: (e) => { e.target.checked ? chosen.add(s.id) : chosen.delete(s.id); } }), s.firstName)));
  const cats = h('div', { class: 'seg wrap', role: 'group', 'aria-label': 'Motif' });
  const drawCats = () => cats.replaceChildren(...CARNET_CATS.map(([k, l]) => h('button', { type: 'button', class: cat === k ? 'on' : '', 'data-testid': `carnet-cat-${k}`, onclick: () => { cat = k; drawCats(); } }, l)));
  drawCats();
  const date = h('input', { type: 'date', value: model.todayIso() });
  const text = h('input', { placeholder: 'ex. bavardages répétés, cahier du jour oublié… (facultatif)', 'data-testid': 'carnet-text' });
  const written = h('input', { type: 'checkbox', 'data-testid': 'carnet-written' });
  modal({ title: 'Noter dans le suivi', wide: true, body: h('div', { class: 'form' }, field('Élève(s)', chips), field('Motif', cats), h('div', { class: 'grid-2' }, field('Date', date), field('Détail', text)),
    h('label', { class: 'inline' }, written, 'Mot écrit dans le carnet de liaison (à faire signer)'),
    h('p', { class: 'muted small' }, 'Restez factuel : pas d’information de santé ni de situation familiale.')),
  actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, testid: 'carnet-save', onClick: async () => {
    if (!chosen.size) { toast('Choisissez au moins un élève.', { kind: 'error' }); return false; }
    await store.batch([...chosen].map(sid => ({ create: { type: 'carnet', data: { classId: cls.id, studentId: sid, date: date.value || model.todayIso(), category: cat, text: text.value.trim(), written: written.checked, signed: false } } })), `Noté : ${catOf(cat)[1].toLowerCase()} (${chosen.size} élève(s))`);
    toast('Noté. Annulable.', { action: 'Annuler', onAction: () => store.undo() });
  } }] });
}
function composeDialog(cls, st, preset = '') {
  const sel = h('select', { name: 'studentId', 'data-testid': 'msg-student' }, st.map(s => h('option', { value: s.id, selected: s.id === preset }, fullName(s))));
  const mod = h('select', { 'data-testid': 'msg-model' }, Object.entries(MSG_MODELES).map(([k, [l]]) => h('option', { value: k }, l)));
  const ta = h('textarea', { rows: 9, 'data-testid': 'msg-text' });
  const to = h('select', { 'aria-label': 'Destinataire' });
  const fill = () => { const s = store.get(sel.value); ta.value = MSG_MODELES[mod.value][1](s); to.replaceChildren(h('option', { value: '' }, '— pas d’e-mail'), ...(s?.contacts || []).filter(c => c.email).map(c => h('option', { value: c.email }, `${c.name} (${c.email})`))); };
  sel.onchange = fill; mod.onchange = fill; fill();
  const log = async (kind) => { const s = store.get(sel.value); await store.create('exchange', { studentId: s.id, date: model.todayIso(), kind, with: to.selectedOptions[0]?.textContent?.replace(/ \(.*/, '') || '', summary: ta.value.trim(), followUp: '' }, `Message à la famille de ${s.firstName}`); };
  const slip = () => { const s = store.get(sel.value); return h('div', { class: 'print-doc' }, h('div', { class: 'mot-slip' }, h('p', { class: 'small' }, `${model.frDate(model.todayIso())} — famille de ${fullName(s)}`), ta.value.split('\n').map(l => h('p', {}, l || '\u00a0')), h('p', { class: 'mot-sig' }, store.getSettings().userName || ''), h('p', { class: 'cut' }, 'Vu, signature des parents :'))); };
  const ch = channel();
  modal({ title: 'Mot ou message à une famille', wide: true, body: h('div', { class: 'form' }, h('div', { class: 'grid-2' }, field('Élève', sel), field('Modèle', mod)), field('Message (modifiable)', ta), field('Adresse e-mail (fiche élève)', to),
    h('p', { class: 'muted small' }, 'Ne mettez pas d’information de santé ou de situation familiale dans un message : préférez une rencontre.')),
  actions: [{ label: 'Annuler' },
    { label: 'Imprimer pour le cahier de liaison', primary: ch === 'papier', testid: 'msg-print', onClick: async () => { printDocument(slip()); await log('mot dans le cahier'); } },
    { label: 'Copier et noter', primary: ch === 'appli', testid: 'msg-copy', onClick: async () => { await copy(ta.value); await log('message (copié)'); } },
    ...(store.getSettings().webmailUrl ? [{ label: 'Copier et ouvrir ma messagerie académique', testid: 'msg-webmail', onClick: async () => { await copy(`${to.value ? `À : ${to.value}\n` : ''}Objet : Classe de ${cls.name}\n\n${ta.value}`); window.open(store.getSettings().webmailUrl, '_blank', 'noopener'); await log('mail (messagerie académique)'); } }] : []),
    { label: 'Ouvrir ma messagerie et noter', primary: ch === 'mail', onClick: async () => { if (!to.value) { toast('Aucune adresse e-mail choisie : ajoutez-la dans la fiche de l’élève, ou imprimez le mot.', { kind: 'error' }); return false; } location.href = `mailto:${encodeURIComponent(to.value)}?subject=${encodeURIComponent(`Classe de ${cls.name}`)}&body=${encodeURIComponent(ta.value)}`; await log('mail'); } }] });
}

// ═════════ Rendez-vous
export const freeSlots = (cls) => store.all('rdvslot').filter(r => r.classId === cls.id && !r.studentId && r.status !== 'annulé' && r.date >= model.todayIso()).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
/** Réserve un créneau : refuse un créneau déjà pris. */
export async function book(slotId, studentId, withWho = '') {
  const cur = store.get(slotId);
  if (!cur || cur.deletedAt) throw new Error('Créneau introuvable.');
  if (cur.studentId && cur.studentId !== studentId) throw new Error('Ce créneau est déjà réservé.');
  return store.update(slotId, { studentId, with: withWho, status: 'réservé' }, `Rendez-vous de ${store.get(studentId)?.firstName}`);
}
export function renderRdv({ rerender }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return page('Rendez-vous', 'familles/rdv', null, miss);
  const all = store.all('rdvslot').filter(r => r.classId === cls.id).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const upcoming = all.filter(r => r.date >= model.todayIso() && r.status !== 'annulé');
  const past = all.filter(r => r.date < model.todayIso() || r.status === 'annulé');
  const st = students(cls);
  const row = (r) => { const s = r.studentId && store.get(r.studentId);
    return h('tr', { 'data-testid': 'rdv-row' }, h('td', {}, model.frDate(r.date, { weekday: 'short', day: 'numeric', month: 'short' })), h('td', {}, `${r.start}–${r.end}`), h('td', {}, r.place || ''),
      h('td', {}, s ? h('a', { href: `#/eleve/${s.id}?t=echanges` }, fullName(s)) : badge('libre', 'ok'), r.with ? h('span', { class: 'muted small' }, ` (${r.with})`) : null),
      h('td', { class: 'row' },
        !s ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'rdv-book', onclick: () => bookDialog(r, st, rerender) }, 'Réserver') : null,
        s && r.status === 'réservé' ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'rdv-done', onclick: () => doneDialog(r, s) }, 'Fait') : null,
        s && r.status === 'réservé' ? h('button', { class: 'btn btn-link small', type: 'button', onclick: async () => { await store.update(r.id, { studentId: null, with: '', status: 'libre' }, 'Créneau libéré'); } }, 'libérer') : null,
        r.status === 'fait' ? badge('fait', 'ok') : null,
        !s ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Supprimer le créneau', onclick: () => store.remove(r.id, 'Créneau supprimé') }, icon('trash', 14)) : null)); };
  const printFree = () => { const fs = freeSlots(cls); printDocument(h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, 'Rencontres parents – enseignante'), h('p', {}, cls.name)),
    h('p', {}, 'Madame, Monsieur, je vous propose de nous rencontrer. Cochez le créneau qui vous convient (et un second choix) et rapportez ce papier.'),
    h('ul', { class: 'rdv-print' }, fs.map(r => h('li', {}, `☐ ${model.frDate(r.date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${r.start}–${r.end}${r.place ? ' — ' + r.place : ''}`))),
    h('p', {}, 'Élève : ……………………………   Signature :'))); };
  const planning = () => printDocument(printTable({ title: 'Planning des rendez-vous', subtitle: cls.name, columns: [{ label: 'Date' }, { label: 'Heure' }, { label: 'Lieu' }, { label: 'Famille' }], rows: upcoming.map(r => [model.frShort(r.date), `${r.start}–${r.end}`, r.place || '', r.studentId ? `${fullName(store.get(r.studentId))}${r.with ? ' (' + r.with + ')' : ''}` : 'libre']) }));
  const without = st.filter(s => !all.some(r => r.studentId === s.id && r.status !== 'annulé'));
  return page('Rendez-vous', 'familles/rdv', cls, h('div', { class: 'stack' },
    h('p', { class: 'muted' }, 'Ouvrez des créneaux, proposez-les aux familles (mot imprimé, e-mail ou application de l’école), notez les réservations : un créneau ne peut pas être pris deux fois. Une fois le rendez-vous fait, le compte rendu va dans l’historique de l’élève.'), notice(),
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', 'data-testid': 'rdv-print-free', onclick: printFree }, icon('print', 14), 'Mot avec les créneaux libres'), h('button', { class: 'btn', type: 'button', onclick: planning }, icon('print', 14), 'Planning'),
      h('button', { class: 'btn', type: 'button', onclick: () => copy(`Créneaux proposés :\n${freeSlots(cls).map(r => `- ${model.frDate(r.date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${r.start}–${r.end}`).join('\n')}`) }, icon('copy', 14), 'Copier les créneaux')),
    h('section', { class: 'card' }, h('h2', {}, `À venir (${upcoming.length})`), upcoming.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('tbody', {}, upcoming.map(row)))) : h('p', { class: 'muted' }, 'Aucun créneau.')),
    h('section', { class: 'card' }, h('h2', {}, `Familles pas encore rencontrées (${without.length})`), h('p', { class: 'small' }, without.map(s => s.firstName).join(', ') || '—')),
    past.length ? h('details', { class: 'card' }, h('summary', {}, `Passés ou annulés (${past.length})`), h('table', { class: 'table' }, h('tbody', {}, past.map(row)))) : null),
  [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'rdv-new', onclick: () => slotsDialog(cls) }, icon('plus', 16), 'Ouvrir des créneaux')]);
}
function slotsDialog(cls) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' }, field('Date', h('input', { type: 'date', name: 'date', value: model.todayIso(), 'data-testid': 'rdv-date' })), field('Lieu', h('input', { name: 'place', value: 'Salle de classe' }))),
    h('div', { class: 'grid-3' }, field('De', h('input', { type: 'time', name: 'from', value: '16:45', 'data-testid': 'rdv-from' })), field('À', h('input', { type: 'time', name: 'to', value: '18:15', 'data-testid': 'rdv-to' })), field('Durée (min)', h('input', { type: 'number', name: 'dur', value: 15, min: 5, max: 120 }))));
  modal({ title: 'Ouvrir des créneaux', body: form, actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, onClick: async () => {
    const d = formData(form); const a = model.minutes(d.from), b = model.minutes(d.to), step = Number(d.dur) || 15;
    if (!d.date || b <= a) { toast('Vérifiez la date et les heures.', { kind: 'error' }); return false; }
    const items = []; for (let t = a; t + step <= b; t += step) items.push({ create: { type: 'rdvslot', data: { classId: cls.id, date: d.date, start: model.hhmm(t), end: model.hhmm(t + step), place: d.place, studentId: null, status: 'libre' } } });
    await store.batch(items, `${items.length} créneau(x) de rendez-vous`); toast(`${items.length} créneau(x) créé(s)`);
  } }] });
}
function bookDialog(r, st, rerender) {
  const taken = new Set(store.all('rdvslot').filter(x => x.studentId && x.status === 'réservé' && x.date >= model.todayIso()).map(x => x.studentId));
  const sel = h('select', { 'data-testid': 'rdv-student' }, st.map(s => h('option', { value: s.id }, `${fullName(s)}${taken.has(s.id) ? ' (a déjà un rendez-vous)' : ''}`)));
  const who = h('input', { placeholder: 'ex. la mère, les deux parents' });
  modal({ title: `Réserver le ${model.frShort(r.date)} à ${r.start}`, body: h('div', { class: 'form' }, field('Famille de', sel), field('Avec (facultatif)', who)),
    actions: [{ label: 'Annuler' }, { label: 'Réserver', primary: true, onClick: async () => { try { await book(r.id, sel.value, who.value.trim()); } catch (e) { toast(e.message, { kind: 'error' }); } rerender(); } }] });
}
function doneDialog(r, s) {
  const ta = h('textarea', { rows: 4, 'data-testid': 'rdv-summary', placeholder: 'Points abordés, décisions' }); const follow = h('input', { placeholder: 'Suite à donner (facultatif)' });
  modal({ title: `Rendez-vous avec la famille de ${s.firstName}`, body: h('div', { class: 'form' }, field('Compte rendu (privé)', ta), field('Suite à donner', follow)),
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
      await store.batch([{ id: r.id, patch: { status: 'fait' } }, { create: { type: 'exchange', data: { studentId: s.id, date: r.date, kind: 'rendez-vous', with: r.with || '', summary: ta.value.trim(), followUp: follow.value.trim(), rdvId: r.id } } }], `Rendez-vous fait avec la famille de ${s.firstName}`);
    } }] });
}

// ═════════ Documents à rapporter (relances)
export function renderDocuments({ rerender }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return page('Documents', 'familles/documents', null, miss);
  const st = students(cls);
  const tpls = E.docTemplates().filter(t => t.category !== 'image');
  const missing = st.map(s => ({ s, docs: tpls.filter(t => { const x = E.docState(E.docOf(s.id, cls.yearId, t.id), t); return t.category === 'document' ? x.status !== 'reçu' || x.expired : x.status === 'à renseigner'; }) })).filter(x => x.docs.length);
  const notes = store.all('familynote').filter(n => n.classId === cls.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const pubs = store.all('publication').filter(p => p.classId === cls.id && p.status === 'publié');
  const relances = () => printDocument(h('div', { class: 'print-doc' }, missing.map(({ s, docs }) => h('div', { class: 'mot-slip relance' },
    h('p', {}, `Madame, Monsieur, il manque encore pour ${s.firstName} :`), h('ul', {}, docs.map(t => h('li', {}, t.label))), h('p', {}, 'Merci de les remettre dans le cartable rapidement.'), h('p', { class: 'mot-sig' }, store.getSettings().userName || '')))));
  return page('Documents', 'familles/documents', cls, h('div', { class: 'stack' },
    h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, `Documents et autorisations manquants (${missing.length} famille(s))`),
      missing.length ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'doc-relances', onclick: relances }, icon('print', 14), 'Imprimer les relances') : null),
      h('p', { class: 'muted small' }, 'D’après les fiches élèves (année en cours). Une relance par famille, avec seulement ce qui la concerne.'),
      missing.length ? h('ul', { class: 'plain', 'data-testid': 'doc-missing' }, missing.map(({ s, docs }) => h('li', {}, h('a', { href: `#/eleve/${s.id}?t=documents` }, fullName(s)), ` : ${docs.map(t => t.label).join(', ')}`))) : h('p', {}, 'Tout est rentré.')),
    h('section', { class: 'card' }, h('h2', {}, 'Mots et autorisations préparés'), notes.length ? h('ul', { class: 'plain' }, notes.map(n => h('li', {}, `${model.frShort(n.date)} · ${n.title} `, h('a', { href: '#/redaction?t=mot' }, 'ouvrir')))) : h('p', { class: 'muted' }, 'Aucun (Organisation › Mots, autorisations et registres).')),
    h('section', { class: 'card' }, h('h2', {}, 'Publications diffusées'), pubs.length ? h('ul', { class: 'plain' }, pubs.map(p => h('li', {}, h('a', { href: `#/publications/${p.id}` }, p.title || 'Sans titre'), ` — ${model.frShort(p.publishedAt)}`))) : h('p', { class: 'muted' }, 'Aucune.'))));
}

// ═════════ Aperçu « comme ce parent »
/** Tout ce qu'une famille peut voir pour son enfant. Jamais : observations, besoins, plans, notes privées, autres élèves. */
export function familyView(cls, s, today = model.todayIso()) {
  const lvl = levelOf(cls, s.id);
  const pubs = store.all('publication').filter(p => p.classId === cls.id && p.status === 'publié' && ((p.audience || 'classe') === 'classe' || (p.audience === 'niveau' && p.level === lvl) || (p.audience === 'eleves' && (p.studentIds || []).includes(s.id))));
  const hw = store.all('homework').filter(x => x.classId === cls.id && (x.dueDate || '') >= today && (!x.targets || x.targets.kind === 'classe' || (x.targets.kind === 'niveau' && x.targets.values.includes(lvl)) || (x.targets.kind === 'élèves' && x.targets.values.includes(s.id))));
  const year = store.get(cls.yearId);
  const per = model.periodsOf(year).filter(p => p.start <= today);
  const reports = store.all('report').filter(r => r.studentId === s.id && r.classId === cls.id && r.status === 'finalisé').map(r => ({ ...r, label: model.periodLabel(year, r.periodId) }));
  const rdv = store.all('rdvslot').filter(r => r.studentId === s.id && r.status === 'réservé' && r.date >= today);
  const tpls = E.docTemplates().filter(t => t.category === 'document');
  const toReturn = tpls.filter(t => E.docState(E.docOf(s.id, cls.yearId, t.id), t).status !== 'reçu').map(t => t.label);
  void per;
  return { pubs, hw, reports, rdv, toReturn };
}
export function renderApercu({ query, rerender }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return page('Aperçu parent', 'familles/apercu', null, miss);
  const st = students(cls);
  const s = st.find(x => x.id === query.e) || st[0];
  if (!s) return page('Aperçu parent', 'familles/apercu', cls, emptyState('Aucun élève'));
  const v = familyView(cls, s);
  const view = h('div', { class: 'family-view', 'data-testid': 'family-view' },
    h('h2', {}, `Famille de ${fullName(s)}`),
    h('h3', {}, 'Devoirs à venir'), v.hw.length ? h('ul', {}, v.hw.map(x => h('li', {}, `${x.title} — pour le ${model.frShort(x.dueDate)}`))) : h('p', { class: 'muted' }, 'Aucun.'),
    h('h3', {}, 'Publications de la classe'), v.pubs.length ? h('ul', {}, v.pubs.map(p => h('li', {}, `${p.title || 'Sans titre'} (${model.frShort(p.publishedAt)})`))) : h('p', { class: 'muted' }, 'Aucune.'),
    h('h3', {}, 'Rendez-vous'), v.rdv.length ? h('ul', {}, v.rdv.map(r => h('li', {}, `${model.frDate(r.date)} à ${r.start}${r.place ? ', ' + r.place : ''}`))) : h('p', { class: 'muted' }, 'Aucun.'),
    h('h3', {}, 'Documents à rapporter'), v.toReturn.length ? h('ul', {}, v.toReturn.map(t => h('li', {}, t))) : h('p', { class: 'muted' }, 'Rien.'),
    h('h3', {}, 'Bilans finalisés'), v.reports.length ? v.reports.map(r => h('div', {}, h('strong', {}, r.label || 'Période'), Object.entries(r.subjects || {}).filter(([, t]) => t).map(([k, t]) => h('p', { class: 'small' }, `${k} : ${t}`)), r.general ? h('p', {}, r.general) : null)) : h('p', { class: 'muted' }, 'Aucun bilan finalisé.'));
  return page('Aperçu parent', 'familles/apercu', cls, h('div', { class: 'stack' },
    h('p', { class: 'muted' }, 'Ce que cette famille peut recevoir, et rien d’autre. Jamais affichés : observations, besoins particuliers, dispositifs, santé, informations confidentielles, notes privées, échanges, autres élèves. Les brouillons ne sont pas inclus.'),
    h('div', { class: 'row' }, h('select', { 'aria-label': 'Élève', 'data-testid': 'apercu-student', onchange: (e) => { location.hash = `#/apercu?e=${e.target.value}`; } }, st.map(x => h('option', { value: x.id, selected: x.id === s.id }, fullName(x)))),
      h('button', { class: 'btn', type: 'button', onclick: () => printDocument(h('div', { class: 'print-doc' }, view.cloneNode(true))) }, icon('print', 14), 'Imprimer pour cette famille')),
    h('section', { class: 'card' }, view)));
}
