// Emploi du temps de référence par période, versionné : une modification s'applique
// à partir d'une date choisie et ne réécrit jamais les journées passées.
import * as store from '../store.js';
import * as model from '../model.js';
import * as PL from '../planning.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { bound, iconBtn } from '../forms.js';
import { levelChips } from '../pedago-ui.js';
import { printDocument } from '../print.js';
import { printTimetable } from '../printdocs.js';

let selTt = null;      // EDT choisi (sinon celui de la période choisie)
let selPer = null;     // période affichée
let selFrom = null;    // version affichée (clé « from », '' = version de départ)
let effective = null;  // date d'effet d'une modification sur une version déjà en usage
let rerender = () => {};

const sortedVersions = (tt) => (tt.versions || []).slice().sort((a, b) => (a.from || '').localeCompare(b.from || ''));
/** Plages de dates de chaque version : [{ v, start, end }]. */
function versionRanges(tt, year) {
  const first = PL.firstDayOf(tt) || year?.start || '';
  const ps = model.periodsOf(year).filter(p => (tt.periodIds || []).includes(p.id));
  const last = ps.length ? ps.at(-1).end : (year?.end || '9999-12-31');
  const vs = sortedVersions(tt);
  return vs.map((v, i) => ({ v, start: v.from && v.from > first ? v.from : first, end: vs[i + 1]?.from ? model.addDays(vs[i + 1].from, -1) : last }));
}
const slotKey = (x) => `${x.day}|${x.start}|${x.end}|${x.subject || ''}|${x.label || ''}|${x.mode || ''}|${(x.levels || []).join(',')}`;
const short = (d) => model.frDate(d, { day: 'numeric', month: 'short' });

export function render({ rerender: rr }) {
  rerender = rr;
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Emploi du temps'), subTabs(), missing);
  const year = store.get(cls.yearId);
  const periods = model.periodsOf(year);
  const tts = PL.timetablesOf(cls.id);
  const today = model.todayIso();
  const covered = new Set(tts.flatMap(t => t.periodIds || []));
  const per = periods.find(p => p.id === selPer) || model.periodOfDate(year, today) || periods.find(p => p.start > today) || periods.at(-1) || null;
  const orphan = tts.filter(t => !(t.periodIds || []).length);
  const tt = tts.find(t => t.id === selTt) || (per ? tts.find(t => (t.periodIds || []).includes(per.id)) : null) || (per ? null : tts[0]) || null;

  const head = pageHeader('Emploi du temps', { favKey: 'planifier/edt', subtitle: `${cls.name} · ${model.classDays(cls).map(d => model.JOURS[d]).join(', ')}`,
    actions: [
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-edt', onclick: () => newTimetable(cls, periods, covered) }, icon('plus', 16), 'Nouvel EDT'),
      tt ? h('button', { class: 'btn', type: 'button', 'data-testid': 'print-edt', onclick: () => printDocument(printTimetable(tt, shownVersion(tt), cls), { orientation: 'landscape' }) }, icon('print', 16), 'Imprimer') : null] });

  // Choix de la période, puis des emplois du temps successifs de cette période.
  const perTabs = periods.length ? h('div', { class: 'seg wrap', role: 'group', 'aria-label': 'Période', 'data-testid': 'edt-periods' },
    periods.map((p, i) => { const t = tts.find(x => (x.periodIds || []).includes(p.id)); const n = t ? versionRanges(t, year).filter(r => r.start <= p.end && r.end >= p.start).length : 0;
      return h('button', { type: 'button', class: p.id === per?.id && (!selTt || tt?.periodIds?.includes(p.id)) ? 'on' : '', title: t ? (t.name || 'EDT') : 'Pas d’EDT', 'data-testid': `edt-period-${i + 1}`,
        onclick: () => { selPer = p.id; selTt = null; selFrom = null; effective = null; rerender(); } }, `P${i + 1}`, n > 1 ? h('span', { class: 'seg-count' }, ` · ${n} EDT`) : !t ? h('span', { class: 'seg-count' }, ' · aucun') : null); }),
    orphan.map(t => h('button', { type: 'button', class: t.id === tt?.id ? 'on' : '', onclick: () => { selTt = t.id; selFrom = null; effective = null; rerender(); } }, `${t.name || 'EDT'} (sans période)`))) : null;

  if (!tt) return h('div', { class: 'page' }, head, subTabs(), perTabs,
    emptyState(per ? `Pas d’emploi du temps pour ${per.name || 'cette période'}` : 'Aucun emploi du temps', 'Créez l’EDT (bouton « Nouvel EDT »), dupliquez celui d’une autre période, ou importez-le : Préparer › Importer un tableau › Emploi du temps.'));

  const ranges = versionRanges(tt, year);
  const inPer = per && tt.periodIds?.includes(per.id) ? ranges.filter(r => r.start <= per.end && r.end >= per.start) : ranges;
  const nowR = ranges.find(r => today >= r.start && today <= r.end);
  const chosen = inPer.find(r => (r.v.from || '') === selFrom) || (nowR && inPer.includes(nowR) ? nowR : inPer[0]) || ranges[0];
  selFrom = chosen ? (chosen.v.from || '') : null;
  const version = chosen?.v || null;
  const idx = sortedVersions(tt).indexOf(version);
  const prev = idx > 0 ? sortedVersions(tt)[idx - 1] : null;
  const prevKeys = new Set((prev?.slots || []).map(slotKey));
  const inUse = chosen && chosen.start <= today;
  const days = model.classDays(cls);
  const slots = version?.slots || [];
  const clip = (r) => [per && r.start < per.start && tt.periodIds?.includes(per.id) ? per.start : r.start, per && r.end > per.end && tt.periodIds?.includes(per.id) ? per.end : r.end];
  const rangeLabel = (r) => { const [a, b] = clip(r); return `Du ${short(a)} au ${short(b)}`; };

  return h('div', { class: 'page' }, head, subTabs(), perTabs,
    inPer.length > 1 ? h('section', { class: 'card stack', 'data-testid': 'edt-versions' },
      h('h2', {}, `${inPer.length} emplois du temps successifs${per && tt.periodIds?.includes(per.id) ? ` en ${per.name || 'cette période'}` : ''}`),
      h('div', { class: 'edt-vtabs' }, inPer.map((r, i) => h('button', { type: 'button', class: `edt-vtab ${r === chosen ? 'on' : ''}`, 'data-testid': 'edt-version', onclick: () => { selFrom = r.v.from || ''; effective = null; rerender(); } },
        h('strong', {}, r.v.name || (i === 0 ? 'EDT de départ' : `Changement n° ${i}`)), h('span', {}, rangeLabel(r)),
        today >= r.start && today <= r.end ? badge('en cours', 'ok') : r.start > today ? badge('à venir', 'muted') : badge('passé', 'muted')))),
      h('p', { class: 'muted small' }, 'Le cahier journal utilise automatiquement le bon emploi du temps selon la date. Les créneaux marqués « changé » diffèrent de l’emploi du temps précédent.')) : null,
    h('section', { class: 'card' },
      h('div', { class: 'grid-3' },
        bound({ label: 'Nom de l’EDT', type: 'text', value: tt.name, onSave: (v) => store.update(tt.id, { name: v }, 'Nom de l’EDT', { quiet: true }) }),
        h('div', { class: 'field' }, h('label', {}, 'Périodes concernées'), h('div', { class: 'chips' }, periods.map((p, i) => {
          const mine = (tt.periodIds || []).includes(p.id); const other = !mine && covered.has(p.id);
          return h('label', { class: 'chip', title: other ? 'Déjà couverte par un autre EDT' : '' }, h('input', { type: 'checkbox', checked: mine, disabled: other, onchange: async (e) => {
            const next = e.target.checked ? [...(tt.periodIds || []), p.id] : tt.periodIds.filter(x => x !== p.id);
            await store.update(tt.id, { periodIds: next }, 'Périodes de l’EDT');
          } }), `P${i + 1}`);
        }))),
        h('div', { class: 'field' }, h('label', {}, ' '), h('div', { class: 'row' },
          h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'dup-edt', onclick: () => duplicateDialog(tt, cls, periods, covered) }, icon('copy', 14), 'Dupliquer vers d’autres périodes'),
          h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'edt-add-change', onclick: () => changeDialog(tt, per) }, '+ Changement à partir d’une date'),
          iconBtn('trash', 'Mettre l’EDT à la corbeille', async () => {
            if (!await confirmDialog('Mettre l’EDT à la corbeille ?', 'Les séances datées déjà saisies au cahier journal sont conservées ; les créneaux non préparés disparaîtront des journées concernées.', { confirmLabel: 'Mettre à la corbeille', danger: true })) return;
            await store.remove(tt.id, 'EDT mis à la corbeille'); selTt = null; selFrom = null;
          })))),
      chosen ? h('div', { class: 'row wrap edt-current' }, h('span', {}, h('strong', {}, chosen.v.name || (idx <= 0 ? 'EDT de départ' : 'Changement')), ` — ${idx <= 0 && !chosen.v.from ? `à partir du ${short(chosen.start)}` : rangeLabel(chosen)}`),
        bound({ type: 'text', compact: true, value: version.name || '', placeholder: 'nommer (ex. natation)', onSave: (v) => store.update(tt.id, { versions: (store.get(tt.id).versions || []).map(x => (x.from || '') === (version.from || '') ? { ...x, name: v } : x) }, 'Nom de la version', { quiet: true }) }),
        idx > 0 ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'edt-remove-change', onclick: async () => {
          if (!await confirmDialog('Supprimer ce changement ?', `L’emploi du temps précédent s’appliquera aussi à partir du ${short(chosen.start)}. Les séances déjà notées au cahier journal sont conservées.`, { confirmLabel: 'Supprimer', danger: true })) return;
          await store.update(tt.id, { versions: (store.get(tt.id).versions || []).filter(x => (x.from || '') !== (version.from || '')) }, 'Changement d’EDT supprimé'); selFrom = null;
        } }, 'Supprimer ce changement') : null) : null,
      inUse ? h('div', { class: 'effective', 'data-testid': 'effective' },
        h('label', { class: 'inline' }, h('strong', {}, 'Les modifications s’appliquent à partir du '),
          h('input', { type: 'date', value: effective || (today > chosen.start ? today : chosen.start), min: chosen.start, 'data-testid': 'effective-date', onchange: (e) => { effective = e.target.value || null; rerender(); } })),
        h('span', { class: 'muted small' }, ' Les journées antérieures gardent l’emploi du temps qui était en vigueur.')) : null),
    h('div', { class: 'edt-grid', style: { gridTemplateColumns: `repeat(${days.length}, minmax(150px, 1fr))` }, 'data-testid': 'edt-grid' }, days.map(d => h('div', { class: 'edt-day' },
      h('h3', {}, model.JOURS[d]),
      slots.filter(s => s.day === d).sort((a, b) => a.start.localeCompare(b.start)).map(s => { const changed = prev && !prevKeys.has(slotKey(s));
        return h('button', { class: `edt-slot ${changed ? 'edt-changed' : ''}`, type: 'button', style: { borderLeftColor: model.subjectColor(s.subject) }, 'data-testid': 'edt-slot', onclick: () => slotDialog(tt, cls, s) },
          h('span', { class: 'edt-time' }, `${s.start}–${s.end}`, changed ? badge('changé', 'warn') : null), h('strong', {}, s.subject || '—'), s.label ? h('span', {}, s.label) : null,
          h('span', { class: 'muted small' }, [(s.levels || []).join(', '), s.mode !== 'dirigé' ? s.mode : ''].filter(Boolean).join(' · '))); }),
      h('button', { class: 'btn btn-small btn-dashed', type: 'button', 'data-testid': `add-slot-${d}`, onclick: () => slotDialog(tt, cls, null, d) }, '+ créneau')))),
    timeTable(cls, slots));
}

function shownVersion(tt) {
  const vs = tt.versions || [];
  const v = selFrom != null ? vs.find(x => (x.from || '') === selFrom) : null;
  if (v) return v;
  const first = PL.firstDayOf(tt); const today = model.todayIso();
  return PL.versionAt(tt, first && first > today ? first : today);
}

/** Nouveau changement d'EDT à partir d'une date (copie de l'EDT en vigueur ce jour-là, à modifier ensuite). */
function changeDialog(tt, per) {
  const date = h('input', { type: 'date', value: per && per.start > model.todayIso() ? per.start : model.todayIso(), 'data-testid': 'edt-change-date' });
  const name = h('input', { placeholder: 'ex. natation, intervenant', 'data-testid': 'edt-change-name' });
  modal({ title: 'Changement d’emploi du temps', body: h('div', { class: 'form' }, field('À partir du', date), field('Nom (facultatif)', name),
    h('p', { class: 'muted small' }, 'Copie l’emploi du temps en vigueur à cette date ; modifiez ensuite les créneaux qui changent. Les journées d’avant ne bougent pas.')),
  actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, testid: 'edt-change-create', onClick: async () => {
    const d = date.value; if (!d) return false;
    const cur = store.get(tt.id); if ((cur.versions || []).some(v => v.from === d)) { toast('Un changement existe déjà à cette date.', { kind: 'error' }); return false; }
    const base = PL.versionAt(cur, d);
    await store.update(tt.id, { versions: [...(cur.versions || []), { from: d, name: name.value.trim(), slots: structuredClone(base?.slots || []).map(x => ({ ...x, id: store.uid() })) }] }, `Changement d’EDT à partir du ${model.frShort(d)}`);
    selFrom = d; effective = null;
  } }] });
}

/** Modifie les créneaux dans la bonne version (création d'une version datée si l'EDT est déjà en usage). */
async function editSlots(tt, fn, label) {
  tt = store.get(tt.id);
  const year = store.get(store.get(tt.classId)?.yearId);
  const today = model.todayIso();
  const shown = shownVersion(tt);
  const r = versionRanges(tt, year).find(x => x.v === shown || (x.v.from || '') === (shown?.from || ''));
  const start = r?.start || '';
  // Version pas encore en usage : modifiée telle quelle. Déjà en usage : nouvelle version datée (le passé ne change pas).
  let from = shown?.from || '';
  if (start && start <= today) { const eff = effective || today; if (eff > start) from = eff; }
  const versions = structuredClone(tt.versions?.length ? tt.versions : [{ from: '', slots: [] }]);
  let v = versions.find(x => (x.from || '') === from);
  if (!v) { const base = PL.versionAt(tt, from); v = { from, slots: structuredClone(base?.slots || []) }; versions.push(v); }
  v.slots = fn(v.slots);
  const later = versions.filter(x => (x.from || '') > from).length;
  await store.update(tt.id, { versions }, from ? `${label} (à partir du ${model.frShort(from)})` : label);
  if (from !== (shown?.from || '')) { selFrom = from; }
  if (later) toast(`Attention : ${later} changement(s) plus récent(s) existent et ne sont pas modifiés.`, { kind: 'error' });
}

function slotDialog(tt, cls, slot, day) {
  let levels = slot?.levels || [];
  const multi = (cls.levels || []).length > 1;
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-3' },
      field('Jour', h('select', { name: 'day' }, model.classDays(cls).map(d => h('option', { value: d, selected: d === (slot?.day ?? day) }, model.JOURS[d])))),
      field('Début', h('input', { name: 'start', type: 'time', value: slot?.start || '08:30', required: true })),
      field('Fin', h('input', { name: 'end', type: 'time', value: slot?.end || '09:15', required: true }))),
    h('div', { class: 'grid-2' },
      field('Discipline', h('select', { name: 'subject' }, h('option', { value: '' }, '—'), model.subjects().map(s => h('option', { value: s, selected: slot?.subject === s }, s)))),
      field('Intitulé (facultatif)', h('input', { name: 'label', value: slot?.label || '', placeholder: 'ex. Rituels, Maths 1, Calcul mental' }))),
    field('Encadrement', h('select', { name: 'mode' }, PL.MODES.map(([v, l]) => h('option', { value: v, selected: (slot?.mode || 'dirigé') === v }, l)))),
    multi ? h('div', { class: 'field' }, h('label', {}, 'Niveaux concernés (aucun = toute la classe)'), levelChips(levels, cls.levels, (v) => { levels = v; })) : null,
    h('p', { class: 'muted small' }, 'Créneau hebdomadaire. Pour un changement ponctuel (sortie, report…), utilisez le cahier journal ou l’agenda.'));
  const errors = h('div', { class: 'form-errors', role: 'alert' });
  const actions = [{ label: 'Annuler' }];
  if (slot) {
    actions.unshift({ label: 'Supprimer', danger: true, onClick: async () => { await editSlots(tt, ss => ss.filter(x => x.id !== slot.id), 'Créneau supprimé'); } });
    actions.splice(1, 0, { label: 'Dupliquer', onClick: async () => { await editSlots(tt, ss => [...ss, { ...slot, id: store.uid() }], 'Créneau dupliqué'); } });
  }
  actions.push({ label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form);
    if (!d.start || !d.end || d.end <= d.start) { errors.textContent = 'L’heure de fin doit suivre l’heure de début.'; return false; }
    const rec = { id: slot?.id || store.uid(), day: Number(d.day), start: d.start, end: d.end, subject: d.subject, label: d.label, mode: d.mode, levels };
    await editSlots(tt, ss => slot ? ss.map(x => x.id === slot.id ? rec : x) : [...ss, rec], slot ? 'Créneau modifié' : 'Créneau ajouté');
  } });
  modal({ title: slot ? 'Modifier le créneau' : 'Nouveau créneau', body: h('div', {}, form, errors), actions });
}

function newTimetable(cls, periods, covered) {
  const free = periods.filter(p => !covered.has(p.id));
  if (!free.length) { toast('Toutes les périodes ont déjà un EDT. Décochez une période d’un EDT existant ou dupliquez-le.', { kind: 'error' }); return; }
  const chosen = new Set(free.map(p => p.id));
  const name = h('input', { value: covered.size ? `EDT ${free.map(p => `P${periods.indexOf(p) + 1}`).join('-')}` : 'EDT de référence' });
  modal({ title: 'Nouvel emploi du temps', body: h('div', { class: 'form' }, field('Nom', name),
    h('fieldset', {}, h('legend', {}, 'Périodes'), h('div', { class: 'chips' }, free.map(p => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { e.target.checked ? chosen.add(p.id) : chosen.delete(p.id); } }), `P${periods.indexOf(p) + 1}`))))),
  actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, onClick: async () => {
    if (!chosen.size) return false;
    const t = await store.create('timetable', { classId: cls.id, name: name.value.trim() || 'EDT', periodIds: [...chosen], versions: [{ from: '', slots: [] }] }, 'Nouvel EDT');
    selTt = t.id; selFrom = null;
  } }] });
}

function duplicateDialog(tt, cls, periods, covered) {
  const free = periods.filter(p => !covered.has(p.id));
  const chosen = new Set();
  const body = h('div', { class: 'form' },
    free.length ? h('div', { class: 'chips' }, free.map(p => h('label', { class: 'chip' }, h('input', { type: 'checkbox', onchange: (e) => { e.target.checked ? chosen.add(p.id) : chosen.delete(p.id); } }), `P${periods.indexOf(p) + 1}`)))
      : h('p', { class: 'muted' }, 'Toutes les périodes ont déjà un EDT. Retirez d’abord une période de son EDT actuel.'),
    h('p', { class: 'muted small' }, 'Crée un nouvel EDT, copie indépendante de la version affichée : vous pourrez l’ajuster sans toucher à celui-ci.'));
  modal({ title: 'Dupliquer vers d’autres périodes', body, actions: [{ label: 'Annuler' }, { label: 'Dupliquer', primary: true, onClick: async () => {
    if (!chosen.size) return false;
    const v = shownVersion(tt);
    const t = await store.create('timetable', { classId: cls.id, name: `${tt.name || 'EDT'} (copie)`, periodIds: [...chosen], copiedFrom: tt.id, versions: [{ from: '', slots: (v?.slots || []).map(s => ({ ...s, id: store.uid() })) }] }, 'EDT dupliqué');
    selTt = t.id; selFrom = null; effective = null;
  } }] });
}

// ───── Temps par matière, comparé à une référence saisie par l'enseignant
function parseHours(s) {
  if (s == null || String(s).trim() === '') return null;
  const t = String(s).trim().toLowerCase().replace(',', '.');
  let m = t.match(/^(\d+)\s*h\s*(\d{1,2})?$/); if (m) return Number(m[1]) * 60 + Number(m[2] || 0);
  m = t.match(/^(\d+):(\d{2})$/); if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(t); return Number.isFinite(n) ? Math.round(n * 60) : null;
}
function timeTable(cls, slots) {
  const levels = cls.levels || [];
  const wm = PL.weeklyMinutes(slots, levels);
  const ref = store.getSettings().timeRef || {};
  const subjects = [...new Set([...model.subjects().filter(s => wm[s] || levels.some(l => ref[l]?.[s])), ...Object.keys(wm)])];
  const total = Object.values(wm).reduce((t, x) => t + x.total, 0);
  return h('section', { class: 'card' }, h('h2', {}, 'Temps hebdomadaire par discipline'),
    h('p', { class: 'muted small' }, 'Calculé depuis les créneaux affichés. La référence horaire est à saisir vous-même depuis le texte officiel en vigueur (ex. « 10h », « 1h30 ») : l’application n’en préremplit aucune.'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table', 'data-testid': 'time-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Discipline'), levels.map(l => [h('th', {}, `${l} prévu`), h('th', {}, `${l} référence`), h('th', {}, 'Écart')]))),
      h('tbody', {}, subjects.map(sub => h('tr', {}, h('td', {}, h('span', { class: 'dot', style: { background: model.subjectColor(sub) } }), sub),
        levels.map(l => {
          const planned = wm[sub]?.byLevel[l] || 0; const r = ref[l]?.[sub];
          const gap = r != null ? planned - r : null;
          return [h('td', {}, model.durationLabel(planned) || '—'),
            h('td', {}, bound({ type: 'text', compact: true, value: r != null ? model.durationLabel(r) : '', placeholder: '—', onSave: async (v) => {
              const mins = parseHours(v); const cur = store.getSettings().timeRef || {};
              await store.setSettings({ timeRef: { ...cur, [l]: { ...(cur[l] || {}), [sub]: mins } } });
            } })),
            h('td', {}, gap == null ? '' : gap === 0 ? badge('ok', 'ok') : badge(`${gap > 0 ? '+' : '−'}${model.durationLabel(Math.abs(gap))}`, 'warn'))];
        })))),
      h('tfoot', {}, h('tr', {}, h('th', {}, 'Total créneaux'), h('td', { colspan: levels.length * 3 }, model.durationLabel(total) || '—'))))));
}
