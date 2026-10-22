// Interventions extérieures : une intervention « à planifier » n'occupe aucun créneau ;
// confirmée, elle apparaît uniquement entre ses dates de début et de fin.
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { levelChips, filesBlock } from '../pedago-ui.js';

export function render() {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Interventions'), subTabs(), missing);
  const all = P.ofClass('intervention', cls.id);
  const toPlan = all.filter(i => i.status !== 'confirmée' || !i.startDate);
  const confirmed = all.filter(i => i.status === 'confirmée' && i.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate));
  return h('div', { class: 'page' },
    pageHeader('Interventions', { favKey: 'planifier/interventions', subtitle: cls.name,
      actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-intervention', onclick: () => dialog(cls) }, icon('plus', 16), 'Nouvelle intervention')] }),
    subTabs(),
    h('section', { class: 'card' }, h('h2', {}, `À planifier (${toPlan.length})`),
      h('p', { class: 'muted small' }, 'Sans date confirmée, une intervention n’occupe aucun créneau du cahier journal.'),
      toPlan.length ? h('div', { class: 'stack-sm' }, toPlan.map(i => line(cls, i))) : h('p', { class: 'muted' }, 'Aucune.')),
    h('section', { class: 'card' }, h('h2', {}, `Confirmées (${confirmed.length})`),
      confirmed.length ? h('div', { class: 'stack-sm', 'data-testid': 'interventions-confirmed' }, confirmed.map(i => line(cls, i))) : h('p', { class: 'muted' }, 'Aucune.')));
}

function line(cls, i) {
  const seq = i.sequenceId ? store.get(i.sequenceId) : null;
  return h('div', { class: 'iv-line' },
    h('div', {}, h('strong', {}, i.title), ' ', badge(i.status === 'confirmée' && i.startDate ? 'confirmée' : 'à planifier', i.status === 'confirmée' && i.startDate ? 'ok' : 'warn'),
      h('div', { class: 'muted small' }, [i.contact, i.place, i.startDate ? `du ${model.frShort(i.startDate)}${i.endDate ? ` au ${model.frShort(i.endDate)}` : ' (sans date de fin)'}` : 'dates à fixer',
        (i.slots || []).map(s => `${model.JOURS[s.day]} ${s.start}–${s.end}`).join(', '), (i.levels || []).join(', '), seq ? P.sequenceTitle(seq) : '',
        i.travelMin ? `déplacement ${i.travelMin} min` : '', i.prepMin ? `préparation ${i.prepMin} min` : ''].filter(Boolean).join(' · '))),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-small', type: 'button', onclick: () => dialog(cls, i) }, 'Modifier'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mettre à la corbeille', onclick: async () => {
        if (!await confirmDialog('Mettre l’intervention à la corbeille ?', 'Les séances datées déjà saisies pour elle au cahier journal sont conservées.', { confirmLabel: 'Mettre à la corbeille', danger: true })) return;
        await store.remove(i.id, `Intervention ${i.title} mise à la corbeille`);
      } }, icon('trash', 16))));
}

function dialog(cls, i = null) {
  let levels = i?.levels || [];
  let slots = structuredClone(i?.slots || []);
  const slotsBox = h('div', { class: 'stack-sm' });
  const drawSlots = () => slotsBox.replaceChildren(...slots.map((s, k) => h('div', { class: 'copy-row' },
    h('select', { 'aria-label': 'Jour', onchange: (e) => { s.day = Number(e.target.value); } }, model.classDays(cls).map(d => h('option', { value: d, selected: d === s.day }, model.JOURS[d]))),
    h('input', { type: 'time', value: s.start, 'aria-label': 'Début', onchange: (e) => { s.start = e.target.value; } }),
    h('input', { type: 'time', value: s.end, 'aria-label': 'Fin', onchange: (e) => { s.end = e.target.value; } }),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retirer le créneau', onclick: () => { slots.splice(k, 1); drawSlots(); } }, icon('x', 14)))),
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => { slots.push({ id: store.uid(), day: model.classDays(cls)[0], start: '14:00', end: '15:00' }); drawSlots(); } }, '+ créneau hebdomadaire'));
  drawSlots();
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' }, field('Intitulé', h('input', { name: 'title', required: true, value: i?.title || '', placeholder: 'ex. Natation, musique, prévention routière' })),
      field('Statut', h('select', { name: 'status' }, [['à planifier', 'À planifier (dates non confirmées)'], ['confirmée', 'Confirmée']].map(([v, l]) => h('option', { value: v, selected: (i?.status || 'à planifier') === v }, l))))),
    h('div', { class: 'grid-3' }, field('Intervenant / contact', h('input', { name: 'contact', value: i?.contact || '' })), field('Téléphone / email', h('input', { name: 'contactInfo', value: i?.contactInfo || '' })), field('Lieu', h('input', { name: 'place', value: i?.place || '' }))),
    h('div', { class: 'grid-3' }, field('À partir du', h('input', { name: 'startDate', type: 'date', value: i?.startDate || '' })), field('Jusqu’au (facultatif)', h('input', { name: 'endDate', type: 'date', value: i?.endDate || '' })),
      field('Discipline', h('select', { name: 'subject' }, h('option', { value: '' }, '—'), model.subjects().map(s => h('option', { value: s, selected: i?.subject === s }, s))))),
    h('div', { class: 'field' }, h('label', {}, 'Créneaux hebdomadaires'), slotsBox),
    (cls.levels || []).length > 1 ? h('div', { class: 'field' }, h('label', {}, 'Niveaux / groupes (aucun = toute la classe)'), levelChips(levels, cls.levels, (v) => { levels = v; })) : null,
    h('div', { class: 'grid-3' },
      field('Séquence liée', h('select', { name: 'sequenceId' }, h('option', { value: '' }, '—'), P.ofClass('sequence', cls.id).map(s => h('option', { value: s.id, selected: s.id === i?.sequenceId }, P.sequenceTitle(s))))),
      field('Déplacement (min)', h('input', { name: 'travelMin', type: 'number', min: 0, value: i?.travelMin ?? '' })),
      field('Préparation (min)', h('input', { name: 'prepMin', type: 'number', min: 0, value: i?.prepMin ?? '' }))),
    field('Notes', h('textarea', { name: 'notes', rows: 2 }, i?.notes || '')));
  const errors = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: i ? 'Modifier l’intervention' : 'Nouvelle intervention', wide: true, body: h('div', {}, form, errors, i ? filesBlock(i.id, { title: 'Supports' }) : null), actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form);
    if (!d.title) { errors.textContent = 'L’intitulé est obligatoire.'; return false; }
    if (d.status === 'confirmée' && (!d.startDate || !slots.length)) { errors.textContent = 'Une intervention confirmée a besoin d’une date de début et d’au moins un créneau.'; return false; }
    if (d.endDate && d.startDate && d.endDate < d.startDate) { errors.textContent = 'La date de fin précède la date de début.'; return false; }
    if (slots.some(s => !s.start || !s.end || s.end <= s.start)) { errors.textContent = 'Un créneau a un horaire invalide.'; return false; }
    const data = { ...d, travelMin: d.travelMin === '' ? null : Number(d.travelMin), prepMin: d.prepMin === '' ? null : Number(d.prepMin), sequenceId: d.sequenceId || null, slots, levels };
    if (i) await store.update(i.id, data, `Intervention ${d.title}`);
    else await store.create('intervention', { ...data, classId: cls.id, fileIds: [] }, `Intervention ${d.title}`);
    toast('Intervention enregistrée');
  } }] });
}
