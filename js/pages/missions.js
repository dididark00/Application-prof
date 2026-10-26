// Organisation › Remplacements (brigade, ZIL, remplaçante) : chaque remplacement est une « mission »
// avec son école, sa classe temporaire (élèves tapés ou lus sur une photo de la liste), ses horaires,
// ses contacts, les documents laissés par la titulaire et un historique (jours, distances notées).
// Une mission terminée disparaît du choix de classe mais reste consultable ici.
import * as store from '../store.js';
import * as model from '../model.js';
import * as PL from '../planning.js';
import { h, icon, toast, modal, field, badge, emptyState, pickFiles, download, confirmDialog } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { bound } from '../forms.js';
import { addFiles } from './files.js';
import { toCsv } from '../csv.js';
import { consumeFlag } from '../router.js';

const missions = () => store.all('mission').sort((a, b) => (b.from || '').localeCompare(a.from || ''));
/** Jours de classe de la mission (vacances et jours fériés exclus). */
export function missionDays(m) {
  const cls = store.get(m.classId); if (!cls || !m.from) return 0;
  const to = m.to || m.from; let n = 0;
  for (let d = m.from; d <= to; d = model.addDays(d, 1)) if (PL.isSchoolDay(cls, d).ok) n++;
  return n;
}
/** « Prénom Nom » par ligne (ou « NOM Prénom » en capitales) → élèves. */
export function parseNames(text) {
  return String(text || '').split('\n').map(l => l.replace(/^[\s\d.)\-•*]+/, '').trim()).filter(l => l.length > 1).map(l => {
    const parts = l.split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    const upper = parts.filter(p => p.length > 1 && p === p.toLocaleUpperCase('fr') && /\p{L}/u.test(p));
    if (upper.length && upper.length < parts.length) return { lastName: upper.join(' '), firstName: parts.filter(p => !upper.includes(p)).join(' ') };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  });
}

export function render({ rerender }) {
  if (consumeFlag('new')) setTimeout(() => newMission(), 0);
  const list = missions(); const today = model.todayIso();
  const cur = list.filter(m => !m.ended), past = list.filter(m => m.ended);
  const totalDays = list.reduce((n, m) => n + missionDays(m), 0);
  const totalKm = list.reduce((n, m) => n + (Number(m.km) || 0) * missionDays(m), 0);
  const card = (m) => {
    const cls = store.get(m.classId); const n = missionDays(m);
    const active = m.from <= today && (!m.to || m.to >= today);
    return h('section', { class: 'card stack', 'data-testid': 'mission-card' },
      h('div', { class: 'card-head' }, h('h2', {}, m.school || 'École'), active ? badge('en cours', 'ok') : m.from > today ? badge('à venir', 'info') : badge(m.ended ? 'terminée' : 'passée', 'muted')),
      h('p', { class: 'small' }, `${cls?.name || m.classLabel || ''} · ${(cls?.levels || []).join(', ')} · du ${model.frShort(m.from)}${m.to ? ' au ' + model.frShort(m.to) : ''} · ${n} jour(s) de classe`),
      h('div', { class: 'grid-2' },
        bound({ label: 'Adresse / ville', type: 'text', value: m.city, onSave: (v) => store.update(m.id, { city: v }, 'Adresse', { quiet: true }) }),
        bound({ label: 'Distance aller (km, notée par vous)', type: 'text', value: m.km || '', onSave: (v) => store.update(m.id, { km: v.replace(',', '.') }, 'Distance', { quiet: true }) }),
        bound({ label: 'Horaires de l’école', type: 'text', value: m.hours, placeholder: '8 h 30 – 11 h 45 / 13 h 30 – 16 h 15', onSave: (v) => store.update(m.id, { hours: v }, 'Horaires', { quiet: true }) }),
        bound({ label: 'Contacts (direction, école, collègue)', type: 'text', value: m.contacts, onSave: (v) => store.update(m.id, { contacts: v }, 'Contacts', { quiet: true }) })),
      bound({ label: 'À savoir (consignes de la titulaire, codes de photocopieuse, élèves à suivre…)', value: m.notes, onSave: (v) => store.update(m.id, { notes: v }, 'À savoir', { quiet: true }) }),
      (m.fileIds || []).length ? h('p', { class: 'small' }, icon('file', 14), ' ', (m.fileIds || []).map(id => store.get(id)).filter(f => f && !f.deletedAt).map(f => h('a', { href: `#/fichiers?open=${f.id}` }, f.name)).reduce((a, x) => [...a, a.length ? ', ' : '', x], [])) : null,
      h('div', { class: 'row wrap' },
        cls && !m.ended ? h('button', { class: 'btn btn-primary btn-small', type: 'button', 'data-testid': 'mission-open', onclick: async () => { await store.setSettings({ currentYearId: cls.yearId, currentClassId: cls.id }); location.hash = '#/aujourdhui'; } }, 'Travailler dans cette classe') : null,
        h('button', { class: 'btn btn-small', type: 'button', onclick: async () => { const fs = await pickFiles({}); if (!fs.length) return; const c = await addFiles(fs, null, { tags: ['remplacement'] }); await store.update(m.id, { fileIds: [...(m.fileIds || []), ...c.map(x => x.id)] }, 'Documents de la titulaire'); } }, icon('plus', 14), 'Documents de la titulaire'),
        cls ? h('a', { class: 'btn btn-small', href: '#/remplacement' }, 'Dossier laissé (s’il est dans l’application)') : null,
        !m.ended ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'mission-end', onclick: async () => {
          if (!await confirmDialog('Terminer ce remplacement ?', 'La classe disparaît du choix de classe (rien n’est supprimé) ; vous la retrouvez ici pour la rouvrir.', { confirmLabel: 'Terminer' })) return;
          await store.batch([{ id: m.id, patch: { ended: true, to: m.to || today } }, ...(cls ? [{ id: cls.id, patch: { missionEnded: true } }] : [])], 'Remplacement terminé');
          if (store.getSettings().currentClassId === m.classId) await store.setSettings({ currentClassId: null });
        } }, 'Terminer') : h('button', { class: 'btn btn-small', type: 'button', onclick: () => store.batch([{ id: m.id, patch: { ended: false } }, ...(cls ? [{ id: cls.id, patch: { missionEnded: false } }] : [])], 'Remplacement rouvert') }, 'Rouvrir')));
  };
  return h('div', { class: 'page' },
    pageHeader('Remplacements', { favKey: 'organisation/missions', subtitle: 'Brigade, ZIL, remplaçante : une classe par remplacement', actions: [
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'mission-new', onclick: () => newMission() }, icon('plus', 16), 'Nouveau remplacement'),
      list.length ? h('button', { class: 'btn', type: 'button', 'data-testid': 'mission-csv', onclick: () => download('remplacements.csv', toCsv([['École', 'Adresse', 'Classe', 'Du', 'Au', 'Jours de classe', 'Distance aller (km)'], ...list.map(m => [m.school, m.city || '', store.get(m.classId)?.name || '', m.from, m.to || '', missionDays(m), m.km || ''])]), 'text/csv;charset=utf-8') }, icon('download', 16), 'Historique (CSV)') : null] }),
    subTabs(),
    h('p', { class: 'muted' }, 'Un remplacement crée une classe à part, avec ses élèves, son cahier journal (sans emploi du temps à préparer : ajoutez vos activités), l’appel et le suivi. Quand il est terminé, la classe sort du choix de classe sans rien perdre.'),
    list.length ? h('p', { class: 'small', 'data-testid': 'mission-totals' }, badge(`${list.length} remplacement(s)`, 'info'), ' ', badge(`${totalDays} jour(s) de classe`, 'muted'), totalKm ? [' ', badge(`${Math.round(totalKm)} km aller notés`, 'muted')] : null) : null,
    cur.length ? cur.map(card) : emptyState('Aucun remplacement en cours', '« Nouveau remplacement » : école, classe, dates, et la liste des élèves (tapée ou lue sur une photo).'),
    past.length ? h('details', { class: 'card' }, h('summary', {}, `Remplacements terminés (${past.length})`), h('div', { class: 'stack' }, past.map(card))) : null);
}

function newMission() {
  const year = model.currentYear();
  if (!year) { toast('Créez d’abord l’année scolaire (Réglages).', { kind: 'error' }); return; }
  const levels = new Set();
  const school = h('input', { placeholder: 'ex. École Jules-Ferry', 'data-testid': 'mission-school' });
  const city = h('input', { placeholder: 'Ville ou adresse' });
  const label = h('input', { placeholder: 'ex. CM1 de Mme Martin', 'data-testid': 'mission-class' });
  const from = h('input', { type: 'date', value: model.todayIso(), 'data-testid': 'mission-from' }), to = h('input', { type: 'date', 'data-testid': 'mission-to' });
  const days = new Set([1, 2, 4, 5]);
  const names = h('textarea', { rows: 8, placeholder: 'Un élève par ligne : Prénom Nom (ou NOM Prénom)', 'data-testid': 'mission-names' });
  const status = h('span', { class: 'muted small' });
  const ocrBtn = h('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
    const [f] = await pickFiles({ accept: 'image/*', multiple: false }); if (!f) return;
    try { const O = await import('../ocr.js'); status.textContent = 'Lecture…'; const t = await O.recognize(f, { onStatus: (x) => { status.textContent = x; } }); names.value = (names.value ? names.value + '\n' : '') + O.cleanText(t); status.textContent = 'Vérifiez la liste lue (corrigez les erreurs).'; }
    catch (e) { status.textContent = `Lecture impossible : ${e.message}`; }
  } }, 'Lire une photo de la liste');
  modal({ title: 'Nouveau remplacement', wide: true, body: h('div', { class: 'form' },
    h('div', { class: 'grid-2' }, field('École', school), field('Adresse / ville', city)),
    h('div', { class: 'grid-3' }, field('Classe', label), field('Du', from), field('Au (si connu)', to)),
    h('div', { class: 'field' }, h('label', {}, 'Niveaux'), h('div', { class: 'chips' }, model.NIVEAUX.map(l => h('label', { class: 'chip' }, h('input', { type: 'checkbox', 'data-testid': `mission-level-${l}`, onchange: (e) => { e.target.checked ? levels.add(l) : levels.delete(l); } }), l)))),
    h('div', { class: 'field' }, h('label', {}, 'Jours de classe'), h('div', { class: 'chips' }, [1, 2, 3, 4, 5, 6].map(d => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: days.has(d), onchange: (e) => { e.target.checked ? days.add(d) : days.delete(d); } }), model.JOURS[d])))),
    field('Élèves (facultatif, ajoutables ensuite)', names), h('div', { class: 'row' }, ocrBtn, status)),
  actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, testid: 'mission-create', onClick: async () => {
    if (!school.value.trim() || !label.value.trim() || !from.value) { toast('École, classe et date de début sont nécessaires.', { kind: 'error' }); return false; }
    if (!levels.size) { toast('Choisissez au moins un niveau.', { kind: 'error' }); return false; }
    const lv = model.sortLevels([...levels]);
    const clsId = store.uid();
    const items = [{ create: { type: 'class', data: { id: clsId, yearId: year.id, name: `${label.value.trim()} — ${school.value.trim()}`, school: school.value.trim(), levels: lv, classDays: [...days].sort(), serviceDays: [], service: { type: 'remplacement', detail: '' }, binome: { active: false }, mission: true, journalMode: 'vierge' } } }];
    for (const p of parseNames(names.value)) {
      const sid = store.uid();
      items.push({ create: { type: 'student', data: { id: sid, firstName: p.firstName, lastName: p.lastName, birthDate: '', contacts: [] } } }, { create: { type: 'enrollment', data: { studentId: sid, classId: clsId, level: lv[0], start: from.value, end: to.value || null } } });
    }
    items.push({ create: { type: 'mission', data: { classId: clsId, school: school.value.trim(), city: city.value.trim(), classLabel: label.value.trim(), from: from.value, to: to.value || '', hours: '', contacts: '', notes: '', km: '', fileIds: [], ended: false } } });
    await store.batch(items, `Remplacement à ${school.value.trim()}`);
    await store.setSettings({ currentYearId: year.id, currentClassId: clsId });
    toast('Remplacement créé : vous travaillez maintenant dans cette classe.');
  } }] });
}
