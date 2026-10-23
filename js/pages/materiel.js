// Organisation › Matériel : stocks, achats, prêts et retours.
// Le stock est calculé à partir des mouvements de matériel (jamais saisi deux fois).
// Un achat peut créer la dépense correspondante dans Argent et projets (un seul mouvement financier).
import * as store from '../store.js';
import * as model from '../model.js';
import * as FI from '../finance.js';
import { h, icon, toast, modal, field, formData, badge, emptyState, download } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { printDocument, printTable } from '../print.js';
import { toCsv } from '../csv.js';

const st = { q: '', cat: '', open: null };
const KINDS = [['achat', 'Achat'], ['entrée', 'Entrée (don, récupération)'], ['sortie', 'Sortie (consommé, distribué)'], ['perte', 'Perte / casse'], ['prêt', 'Prêt']];

export function render({ rerender }) {
  const mats = FI.materials();
  const cats = [...new Set(mats.map(m => m.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const list = mats.filter(m => (!st.cat || m.category === st.cat) && (!st.q || `${m.name} ${m.category || ''} ${m.location || ''}`.toLowerCase().includes(st.q.toLowerCase())));
  const loans = mats.flatMap(m => FI.stockOf(m).loans.map(l => ({ m, l })));
  const low = mats.filter(m => FI.stockOf(m).low);
  return h('div', { class: 'page' },
    pageHeader('Matériel', { favKey: 'organisation/materiel', subtitle: `${mats.length} article(s) · ${loans.length} prêt(s) en cours${low.length ? ` · ${low.length} à racheter` : ''}`,
      actions: [
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-material', onclick: () => materialDialog() }, icon('plus', 16), 'Nouvel article'),
        h('button', { class: 'btn', type: 'button', onclick: () => download('inventaire-materiel.csv', toCsv([['Article', 'Catégorie', 'Emplacement', 'Stock', 'Prêté', 'Disponible', 'Seuil'], ...mats.map(m => { const s = FI.stockOf(m); return [m.name, m.category || '', m.location || '', s.qty, s.lent, s.available, m.threshold ?? '']; })]), 'text/csv;charset=utf-8') }, icon('download', 16), 'Inventaire (CSV)'),
        h('button', { class: 'btn', type: 'button', onclick: () => printDocument(printTable({ title: 'Inventaire du matériel', subtitle: `Édité le ${model.frShort(model.todayIso())}`, columns: ['Article', 'Catégorie', 'Emplacement', 'Stock', 'Prêté', 'Disponible'].map(label => ({ label })), rows: mats.map(m => { const s = FI.stockOf(m); return [m.name, m.category || '', m.location || '', `${s.qty} ${m.unit || ''}`, s.lent || '', s.available]; }) })) }, icon('print', 16), 'Imprimer')] }),
    subTabs(),
    low.length ? h('div', { class: 'card notice', 'data-testid': 'low-stock' }, h('strong', {}, 'À racheter : '), low.map(m => m.name).join(', ')) : null,
    loans.length ? h('section', { class: 'card' }, h('h2', {}, 'Prêts en cours'),
      h('ul', { class: 'plain' }, loans.map(({ m, l }) => h('li', { class: 'row wrap', 'data-testid': 'loan' },
        h('span', {}, `${m.name} × ${l.qty} → ${borrower(l)} depuis le ${model.frShort(l.date)}`), l.due ? badge(`retour prévu ${model.frShort(l.due)}`, l.due < model.todayIso() ? 'warn' : 'muted') : null,
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'loan-return', onclick: async () => { await store.update(l.id, { returnedAt: model.todayIso() }, `Retour : ${m.name}`); toast('Retour enregistré'); } }, 'Rendu'))))) : null,
    h('div', { class: 'filters' },
      h('input', { type: 'search', placeholder: 'Rechercher…', value: st.q, 'aria-label': 'Rechercher', onchange: (e) => { st.q = e.target.value; rerender(); } }),
      h('select', { 'aria-label': 'Catégorie', onchange: (e) => { st.cat = e.target.value; rerender(); } }, h('option', { value: '' }, 'Toutes les catégories'), cats.map(c => h('option', { value: c, selected: st.cat === c }, c)))),
    list.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table', 'data-testid': 'materials' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Article'), h('th', {}, 'Catégorie'), h('th', {}, 'Emplacement'), h('th', { class: 'num' }, 'Stock'), h('th', { class: 'num' }, 'Disponible'), h('th', {}))),
      h('tbody', {}, list.map(m => {
        const s = FI.stockOf(m);
        return h('tr', { 'data-testid': 'material-row' },
          h('td', {}, h('button', { class: 'btn-link', type: 'button', onclick: () => historyDialog(m) }, m.name), s.low ? ' ' : null, s.low ? badge('à racheter', 'warn') : null),
          h('td', {}, m.category || ''), h('td', {}, m.location || ''),
          h('td', { class: 'num', 'data-testid': 'material-qty' }, `${s.qty} ${m.unit || ''}`),
          h('td', { class: 'num', 'data-testid': 'material-available' }, s.available),
          h('td', { class: 'nowrap' }, h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'material-move', onclick: () => moveDialog(m) }, 'Mouvement'), ' ',
            h('button', { class: 'btn btn-small', type: 'button', onclick: () => materialDialog(m) }, 'Modifier')));
      })))) : emptyState('Aucun article', 'Fichiers, manuels, matériel de sport, fournitures, jeux : notez le stock, les achats et les prêts.'));
}

function borrower(l) {
  if (l.studentId) { const s = store.get(l.studentId); return s ? model.fullName(s) : 'élève'; }
  return l.to || 'emprunteur non précisé';
}

function materialDialog(m = null) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' }, field('Article', h('input', { name: 'name', required: true, value: m?.name || '', 'data-testid': 'material-name' })),
      field('Catégorie', h('input', { name: 'category', value: m?.category || '', placeholder: 'ex. sport, fournitures, jeux' }))),
    h('div', { class: 'grid-3' },
      field(m ? 'Quantité de départ' : 'Quantité actuelle', h('input', { name: 'initial', type: 'number', min: 0, value: m?.initial ?? 0, 'data-testid': 'material-initial' })),
      field('Unité', h('input', { name: 'unit', value: m?.unit || '', placeholder: 'ex. boîtes' })),
      field('Seuil « à racheter »', h('input', { name: 'threshold', type: 'number', min: 0, value: m?.threshold ?? '' }))),
    field('Emplacement', h('input', { name: 'location', value: m?.location || '', placeholder: 'ex. armoire du fond' })),
    field('Notes', h('textarea', { name: 'notes', rows: 2 }, m?.notes || '')));
  const err = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: m ? 'Modifier l’article' : 'Nouvel article', body: h('div', {}, form, err, m ? h('p', { class: 'muted small' }, 'Pour un achat, une sortie ou un prêt, utilisez « Mouvement » : le stock est recalculé et l’historique conservé.') : null),
    actions: [{ label: 'Annuler' }, { label: m ? 'Enregistrer' : 'Créer', primary: true, testid: 'material-save', onClick: async () => {
      const d = formData(form);
      if (!d.name.trim()) { err.textContent = 'Nom obligatoire.'; return false; }
      const data = { ...d, name: d.name.trim(), initial: Number(d.initial) || 0, threshold: d.threshold === '' ? null : Number(d.threshold) };
      if (m) await store.update(m.id, data, `Article « ${data.name} » modifié`); else await store.create('material', data, `Article « ${data.name} »`);
    } }] });
}

function moveDialog(m) {
  const cls = model.currentClass();
  const students = cls ? model.studentsOfClass(cls.id).map(x => x.student) : [];
  const year = model.currentYear();
  const accs = FI.accounts(year?.id);
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-3' },
      field('Type', h('select', { name: 'kind', 'data-testid': 'mm-kind', onchange: () => sync() }, KINDS.map(([k, l]) => h('option', { value: k }, l)))),
      field('Quantité', h('input', { name: 'qty', type: 'number', min: 1, value: 1, 'data-testid': 'mm-qty' })),
      field('Date', h('input', { name: 'date', type: 'date', value: model.todayIso() }))),
    h('div', { class: 'mm-loan grid-3' },
      field('Élève', h('select', { name: 'studentId', 'data-testid': 'mm-student' }, h('option', { value: '' }, '—'), students.map(s => h('option', { value: s.id }, model.fullName(s))))),
      field('ou autre emprunteur', h('input', { name: 'to', placeholder: 'ex. classe de CM1' })),
      field('Retour prévu', h('input', { name: 'due', type: 'date' }))),
    h('div', { class: 'mm-buy' },
      h('div', { class: 'grid-3' }, field('Coût total (€)', h('input', { name: 'cost', inputmode: 'decimal', 'data-testid': 'mm-cost' })),
        field('Fournisseur', h('input', { name: 'supplier' })),
        accs.length ? field('Compte', h('select', { name: 'accountId' }, accs.map(a => h('option', { value: a.id }, a.name)))) : h('p', { class: 'muted small' }, 'Aucun compte : la dépense ne sera pas enregistrée dans Argent et projets.')),
      accs.length ? h('label', { class: 'inline' }, h('input', { type: 'checkbox', name: 'withExpense', checked: true, 'data-testid': 'mm-expense' }), 'Enregistrer aussi la dépense dans le journal financier') : null),
    field('Commentaire', h('input', { name: 'comment' })));
  const sync = () => { const k = form.elements.kind.value; form.querySelector('.mm-loan').hidden = k !== 'prêt'; form.querySelector('.mm-buy').hidden = k !== 'achat'; };
  sync();
  const err = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: `Mouvement — ${m.name}`, body: h('div', {}, form, err), actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, testid: 'mm-save', onClick: async () => {
    const d = formData(form);
    const qty = Number(d.qty);
    if (!Number.isInteger(qty) || qty <= 0) { err.textContent = 'Quantité invalide.'; return false; }
    const s = FI.stockOf(m);
    if ((d.kind === 'sortie' || d.kind === 'perte' || d.kind === 'prêt') && qty > s.available) { err.textContent = `Seulement ${s.available} disponible(s).`; return false; }
    let movementId = null;
    if (d.kind === 'achat' && d.withExpense && d.cost) {
      const abs = FI.parseEuros(d.cost);
      if (!abs || Number.isNaN(abs)) { err.textContent = 'Coût invalide.'; return false; }
      const mv = await FI.addMovement({ kind: 'dépense', abs, accountId: d.accountId, date: d.date, mode: 'autre', label: `Achat : ${m.name} × ${qty}`, payer: d.supplier || '' });
      movementId = mv.id;
    }
    await store.create('matmove', { materialId: m.id, kind: d.kind, qty, date: d.date, comment: d.comment, studentId: d.kind === 'prêt' ? d.studentId || null : null, to: d.kind === 'prêt' ? d.to : '', due: d.kind === 'prêt' ? d.due : '',
      returnedAt: null, cost: d.kind === 'achat' ? FI.parseEuros(d.cost) || null : null, supplier: d.supplier || '', movementId }, `${KINDS.find(k => k[0] === d.kind)[1]} : ${m.name} × ${qty}`);
    toast(movementId ? 'Achat enregistré, dépense ajoutée au journal' : 'Mouvement enregistré');
  } }] });
}

function historyDialog(m) {
  const mv = FI.matMoves(m.id);
  const s = FI.stockOf(m);
  modal({ title: m.name, wide: true, body: h('div', {},
    h('p', {}, `Stock : ${s.qty} ${m.unit || ''} · prêtés : ${s.lent} · disponibles : ${s.available}${m.location ? ` · ${m.location}` : ''}`),
    m.notes ? h('p', { class: 'muted' }, m.notes) : null,
    mv.length ? h('table', { class: 'table compact' }, h('tbody', {}, h('tr', {}, h('td', {}, '—'), h('td', {}, 'Quantité de départ'), h('td', { class: 'num' }, m.initial || 0), h('td', {})),
      mv.map(x => h('tr', {}, h('td', {}, model.frShort(x.date)), h('td', {}, `${KINDS.find(k => k[0] === x.kind)?.[1] || x.kind}${x.kind === 'prêt' ? ` → ${borrower(x)}${x.returnedAt ? ` (rendu le ${model.frShort(x.returnedAt)})` : ''}` : ''}${x.comment ? ` — ${x.comment}` : ''}`),
        h('td', { class: 'num' }, x.kind === 'achat' || x.kind === 'entrée' ? `+${x.qty}` : `−${x.qty}`), h('td', {}, x.movementId ? h('a', { href: '#/argent?t=journal' }, FI.euros(x.cost)) : x.cost ? FI.euros(x.cost) : ''))))) : h('p', { class: 'muted' }, 'Aucun mouvement.')),
  actions: [{ label: 'Fermer' }] });
}
