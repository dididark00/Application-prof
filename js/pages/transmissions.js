// Transmissions avec la binôme : fait / à terminer / information, accusé de lecture.
// Préremplissage depuis le cahier journal du jour (séances faites, partielles ou non faites,
// devoirs donnés, absences) : rien n'est ressaisi. Répartition des préparations (qui prépare quoi).
// Sans comptes partagés (choix sans serveur), la transmission se lit sur l'appareil, s'imprime ou se copie
// pour l'envoyer par le moyen habituel ; l'accusé de lecture est noté par la personne qui lit.
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import * as PL from '../planning.js';
import * as V from '../vie.js';
import * as O from '../orga.js';
import { h, icon, toast, modal, field, badge, emptyState, confirmDialog } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { bound, pickMany, iconBtn } from '../forms.js';
import { printDocument } from '../print.js';

let tab = 'transmissions';
const KIND_BADGE = { fait: 'ok', 'à terminer': 'warn', information: 'info' };

export function render({ rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Transmissions binôme'), subTabs(), missing);
  const list = O.handovers(cls.id);
  const unread = list.filter(x => !x.readAt).length;
  return h('div', { class: 'page' },
    pageHeader('Transmissions binôme', { favKey: 'organisation/transmissions', subtitle: `${cls.name} · avec ${cls.binome?.name || 'la binôme (à renseigner dans Réglages › Classes)'}${unread ? ` · ${unread} non lue(s)` : ''}`,
      actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-handover', onclick: () => newHandover(cls) }, icon('plus', 16), 'Nouvelle transmission')] }),
    subTabs(),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' }, [['transmissions', 'Transmissions'], ['repartition', 'Qui prépare quoi']].map(([k, l]) => h('button', { type: 'button', class: tab === k ? 'on' : '', 'data-testid': `ho-tab-${k}`, onclick: () => { tab = k; rerender(); } }, l))),
    tab === 'repartition' ? repartition(cls) : h('div', { class: 'stack' },
      list.length ? list.map(x => card(cls, x)) : emptyState('Aucune transmission', 'Créez une transmission à la fin de votre journée : elle peut être préremplie depuis le cahier journal.'),
      h('p', { class: 'muted small' }, 'Pour l’envoyer : imprimez-la (ou enregistrez-la en PDF dans un dossier Nuage partagé avec votre binôme), ou copiez-la dans la messagerie. La personne qui la lit sur cet appareil note « Lu ».')));
}

function author(cls, from) { return from === 'binome' ? (cls.binome?.name || 'Binôme') : (store.getSettings().userName || 'Moi'); }

function card(cls, x) {
  const up = (patch, label, quiet = true) => store.update(x.id, patch, label, { quiet });
  const setItem = (i, patch) => up({ items: store.get(x.id).items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }, 'Transmission');
  return h('section', { class: 'card', 'data-testid': 'handover' },
    h('div', { class: 'card-head' },
      h('h2', {}, `${model.frDate(x.date, { weekday: 'long', day: 'numeric', month: 'long' })} — de ${author(cls, x.from)}`, ' ',
        x.readAt ? badge(`lu par ${x.readBy || '?'} le ${model.frShort(x.readAt.slice(0, 10))}`, 'ok') : badge('non lu', 'warn')),
      h('span', { class: 'row' },
        x.readAt ? null : h('button', { class: 'btn btn-small btn-primary', type: 'button', 'data-testid': 'ho-read', onclick: () => markRead(cls, x) }, icon('check', 14), 'Lu'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => copyText(cls, x) }, icon('copy', 14), 'Copier'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => printOne(cls, x) }, icon('print', 14), 'Imprimer'),
        iconBtn('trash', 'Mettre à la corbeille', async () => { if (await confirmDialog('Mettre la transmission à la corbeille ?', '')) store.remove(x.id, 'Transmission mise à la corbeille'); }))),
    h('table', { class: 'table' }, h('tbody', {}, (x.items || []).map((it, i) => h('tr', { 'data-testid': 'ho-item' },
      h('td', { style: { width: '150px' } }, bound({ type: 'select', value: it.kind, options: O.HANDOVER_KINDS, onSave: (v) => setItem(i, { kind: v }) })),
      h('td', {}, bound({ type: 'textarea', compact: true, value: it.text, onSave: (v) => setItem(i, { text: v }) }),
        it.subject ? h('span', { class: 'muted small' }, it.subject) : null, it.done ? badge('repris', 'ok') : null),
      h('td', { class: 'nowrap' }, it.kind === 'à terminer' ? h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: !!it.done, onchange: (e) => setItem(i, { done: e.target.checked }) }), 'repris') : null,
        iconBtn('trash', 'Retirer la ligne', () => up({ items: store.get(x.id).items.filter((_, j) => j !== i) }, 'Ligne retirée', false))))))),
    addItem(x),
    x.reply || x.readAt ? h('div', { class: 'fields' }, bound({ label: 'Réponse / remarques', value: x.reply, onSave: (v) => up({ reply: v }, 'Réponse à la transmission') })) : null);
}

function addItem(x) {
  const kind = h('select', { 'aria-label': 'Type' }, O.HANDOVER_KINDS.map(([v, l]) => h('option', { value: v }, l)));
  const text = h('input', { placeholder: 'Ajouter une ligne…', 'aria-label': 'Ligne', 'data-testid': 'ho-add-text' });
  const go = async () => { if (!text.value.trim()) return; await store.update(x.id, { items: [...(store.get(x.id).items || []), { kind: kind.value, text: text.value.trim() }] }, 'Ligne ajoutée'); };
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  return h('div', { class: 'row' }, kind, text, h('button', { class: 'btn btn-small', type: 'button', onclick: go }, 'Ajouter'));
}

/** Lignes proposées à partir du cahier journal, de l'appel et des devoirs du jour. */
export function suggestions(cls, date) {
  const out = [];
  const plan = PL.dayPlan(cls, date);
  for (const e of plan.entries) {
    if (e.kind !== 'occ' && e.kind !== 'slot') continue;
    if (e.kind === 'slot' && !e.title) continue;
    const label = `${e.subject ? e.subject + ' — ' : ''}${e.title}`;
    const note = [e.occ?.note, e.occ?.after?.aReprendre ? `à reprendre : ${e.occ.after.aReprendre}` : ''].filter(Boolean).join(' ; ');
    if (e.status === 'faite') out.push({ kind: 'fait', text: note ? `${label} — ${note}` : label, subject: e.subject });
    else if (e.status === 'partielle') out.push({ kind: 'à terminer', text: `${label} (commencée)${note ? ' : ' + note : ''}`, subject: e.subject });
    else if (e.status === 'reportée' || e.status === 'annulée') out.push({ kind: 'information', text: `${label} (${e.status})`, subject: e.subject });
  }
  for (const hw of P.ofClass('homework', cls.id).filter(x => x.givenDate === date)) out.push({ kind: 'information', text: `Devoir donné pour le ${model.frShort(hw.dueDate)} : ${hw.title}`, subject: hw.subject || '' });
  const absent = [];
  for (const [half, label] of V.HALVES) {
    const a = V.attendanceOf(cls.id, date, half);
    for (const [sid, m] of Object.entries(a?.marks || {})) if (m.status && m.status !== 'présent') { const s = store.get(sid); if (s) absent.push(`${s.firstName} (${m.status}, ${label.toLowerCase()})`); }
  }
  if (absent.length) out.push({ kind: 'information', text: `Absences / retards : ${absent.join(', ')}` });
  return out;
}

function newHandover(cls) {
  const date = h('input', { type: 'date', value: model.todayIso(), 'data-testid': 'ho-date' });
  const from = h('select', { 'data-testid': 'ho-from' }, [['moi', author(cls, 'moi')], ['binome', author(cls, 'binome')]].map(([v, l]) => h('option', { value: v }, l)));
  const prefill = h('input', { type: 'checkbox', checked: true, 'data-testid': 'ho-prefill' });
  modal({ title: 'Nouvelle transmission', body: h('div', { class: 'form' }, h('div', { class: 'grid-2' }, field('Journée', date), field('De la part de', from)),
    h('label', { class: 'inline' }, prefill, 'Préremplir avec le cahier journal, les devoirs donnés et l’appel de ce jour'),
    h('p', { class: 'muted small' }, 'Vous pourrez modifier, retirer ou ajouter des lignes ensuite.')),
  actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, onClick: async () => {
    const items = prefill.checked ? suggestions(cls, date.value) : [];
    await store.create('handover', { classId: cls.id, date: date.value, from: from.value, items, readAt: null, readBy: '', reply: '' }, 'Transmission créée');
    toast(items.length ? `${items.length} ligne(s) préremplie(s)` : 'Transmission créée : ajoutez vos lignes');
  } }] });
}

function markRead(cls, x) {
  const other = x.from === 'binome' ? author(cls, 'moi') : author(cls, 'binome');
  const who = h('input', { value: other, 'aria-label': 'Lu par' });
  modal({ title: 'Accusé de lecture', body: h('div', { class: 'form' }, field('Lu par', who)), actions: [{ label: 'Annuler' },
    { label: 'Confirmer la lecture', primary: true, onClick: () => store.update(x.id, { readAt: new Date().toISOString(), readBy: who.value.trim() || other }, 'Transmission lue') }] });
}

function asText(cls, x) {
  const lines = [`Transmission du ${model.frDate(x.date, { weekday: 'long', day: 'numeric', month: 'long' })} — ${cls.name} — de ${author(cls, x.from)}`];
  for (const [k, l] of O.HANDOVER_KINDS) { const its = (x.items || []).filter(i => i.kind === k); if (its.length) { lines.push('', `${l} :`); for (const i of its) lines.push(`- ${i.text}`); } }
  return lines.join('\n');
}
async function copyText(cls, x) {
  try { await navigator.clipboard.writeText(asText(cls, x)); toast('Texte copié : collez-le dans un mail ou un message'); }
  catch { modal({ title: 'Texte à copier', body: h('textarea', { rows: 12, readonly: true, style: { width: '100%' } }, asText(cls, x)), actions: [{ label: 'Fermer' }] }); }
}
function printOne(cls, x) {
  printDocument(h('div', {}, h('div', { class: 'print-head' }, h('h1', {}, `Transmission — ${model.frDate(x.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`), h('p', {}, `${cls.name} · de ${author(cls, x.from)}`)),
    O.HANDOVER_KINDS.map(([k, l]) => { const its = (x.items || []).filter(i => i.kind === k); return its.length ? [h('h2', {}, l), h('ul', {}, its.map(i => h('li', {}, i.text)))] : null; }),
    x.reply ? [h('h2', {}, 'Réponse'), h('p', { class: 'pre' }, x.reply)] : null));
}

// ───── Qui prépare quoi (répartition par séquence, selon le responsable indiqué sur chaque séquence)
function repartition(cls) {
  const year = model.currentYear();
  const seqs = P.ofClass('sequence', cls.id);
  const owners = model.owners(cls);
  const per = model.periodOfDate(year, model.todayIso());
  const rows = seqs.filter(s => !per || !s.periodId || s.periodId === per.id);
  return h('div', { class: 'stack' },
    h('p', { class: 'muted' }, `${per ? `Période en cours (${model.periodLabel(year, per.id)})` : 'Toutes périodes'}. Le responsable se choisit sur chaque séquence (Préparer › Séquences).`),
    h('div', { class: 'grid-3' }, owners.map(([k, l]) => {
      const mine = rows.filter(s => (s.owner || 'commun') === k);
      return h('section', { class: 'card', 'data-testid': `owner-${k}` }, h('h2', {}, l, ' ', badge(String(mine.length), 'muted')),
        mine.length ? h('ul', { class: 'linked-list' }, mine.map(s => h('li', {}, h('a', { href: `#/sequence/${s.id}` }, P.sequenceTitle(s)), h('span', { class: 'muted small' }, ` · ${s.subject || ''}`)))) : h('p', { class: 'muted small' }, 'Aucune séquence.'));
    })));
}
