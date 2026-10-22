// Bibliothèque de classe : catalogue (commun à toutes les années), exemplaires distincts,
// prêts. Un exemplaire ne peut pas avoir deux prêts en cours. Aucun retour automatique.
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { pickMany } from '../forms.js';
import { printDocument, printTable } from '../print.js';

const STATES = ['disponible', 'à vérifier', 'perdu ou abîmé'];
let tab = 'catalogue';
const filt = { q: '', category: '', studentId: '', selected: new Set(), openBook: null };

export const activeLoans = () => store.all('loan').filter(l => !l.returnedAt);
export function loanOfCopy(copyId) { return activeLoans().find(l => l.copyId === copyId) || null; }
export function openLoansOfStudent(studentId) { return activeLoans().filter(l => l.studentId === studentId); }
const late = (l, today = model.todayIso()) => !l.returnedAt && l.due && l.due < today;
function copyLabel(l) { const b = store.get(l.bookId); const c = b?.copies?.find(x => x.id === l.copyId); return `${b?.title || 'Livre supprimé'}${c ? ` (${c.code})` : ''}`; }

export async function lend(cls, book, copy, studentId, due) {
  if (loanOfCopy(copy.id)) throw new Error('Cet exemplaire est déjà prêté : enregistrez d’abord son retour.');
  if (copy.state === 'perdu ou abîmé') throw new Error('Exemplaire signalé perdu ou abîmé.');
  return store.create('loan', { bookId: book.id, copyId: copy.id, studentId, classId: cls.id, yearId: cls.yearId, start: model.todayIso(), due: due || null, returnedAt: null, returnState: '', note: '' }, `Prêt de « ${book.title} » à ${store.get(studentId)?.firstName}`);
}

export function render({ rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Bibliothèque'), subTabs(), missing);
  const loans = activeLoans().filter(l => l.classId === cls.id);
  const lateN = loans.filter(l => late(l)).length;
  const tabs = h('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' }, [['catalogue', 'Catalogue'], ['prets', `Prêts en cours (${loans.length})`], ['eleves', 'Par élève'], ['historique', 'Historique']].map(([k, l]) =>
    h('button', { type: 'button', class: tab === k ? 'on' : '', 'data-testid': `lib-tab-${k}`, onclick: () => { tab = k; rerender(); } }, l)));
  const body = tab === 'prets' ? loansView(cls, loans, rerender) : tab === 'eleves' ? studentView(cls, rerender) : tab === 'historique' ? historyView(cls) : catalogue(cls, rerender);
  return h('div', { class: 'page' },
    pageHeader('Bibliothèque de classe', { favKey: 'classe/bibliotheque', subtitle: `${store.all('book').length} livre(s) · ${loans.length} prêt(s) en cours${lateN ? ` · ${lateN} en retard` : ''}`,
      actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-book', onclick: () => bookDialog() }, icon('plus', 16), 'Ajouter un livre'),
        h('button', { class: 'btn', type: 'button', onclick: () => printDocument(printTable({ title: 'Prêts de livres', subtitle: `${cls.name} · grille vierge`, columns: ['Date', 'Élève', 'Livre', 'Exemplaire', 'Retour prévu', 'Rendu le', 'État'].map(label => ({ label })), rows: Array.from({ length: 25 }, () => Array(7).fill('')) }), { orientation: 'landscape' }) }, icon('print', 16), 'Grille vierge')] }),
    subTabs(), tabs, body);
}

function catalogue(cls, rerender) {
  const books = store.all('book').filter(b => (!filt.q || `${b.title} ${b.author || ''} ${(b.copies || []).map(c => c.code).join(' ')}`.toLowerCase().includes(filt.q.toLowerCase())) && (!filt.category || b.category === filt.category))
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  const cats = [...new Set(store.all('book').map(b => b.category).filter(Boolean))];
  return h('div', { class: 'stack' },
    h('div', { class: 'filters' }, h('input', { type: 'search', placeholder: 'Titre, auteur, code…', value: filt.q, 'aria-label': 'Rechercher un livre', onchange: (e) => { filt.q = e.target.value; rerender(); } }),
      cats.length ? h('select', { 'aria-label': 'Catégorie', onchange: (e) => { filt.category = e.target.value; rerender(); } }, h('option', { value: '' }, 'Toutes catégories'), cats.map(c => h('option', { value: c, selected: filt.category === c }, c))) : null),
    books.length ? books.map(b => {
      const avail = (b.copies || []).filter(c => c.state === 'disponible' && !loanOfCopy(c.id)).length;
      const open = filt.openBook === b.id;
      return h('section', { class: 'card', 'data-testid': 'book-card' },
        h('div', { class: 'card-head' }, h('h2', {}, b.title, ' ', b.level ? badge(b.level, 'muted') : null, b.category ? badge(b.category) : null),
          h('div', { class: 'row' }, badge(`${avail}/${(b.copies || []).length} disponible(s)`, avail ? 'ok' : 'warn'),
            h('button', { class: 'btn btn-small', type: 'button', onclick: () => { filt.openBook = open ? null : b.id; rerender(); } }, open ? 'Replier' : 'Exemplaires'),
            h('button', { class: 'btn btn-small', type: 'button', onclick: () => bookDialog(b) }, 'Modifier'))),
        h('p', { class: 'muted' }, [b.author, b.ref, (b.sequenceIds || []).map(id => store.get(id)).filter(Boolean).map(s => P.sequenceTitle(s)).join(', ')].filter(Boolean).join(' · ')),
        open ? h('div', {}, h('table', { class: 'table' }, h('tbody', {}, (b.copies || []).map(c => {
          const ln = loanOfCopy(c.id);
          return h('tr', { 'data-testid': 'copy-row' }, h('td', {}, h('strong', {}, c.code)),
            h('td', {}, h('select', { 'aria-label': `État de ${c.code}`, onchange: (e) => store.update(b.id, { copies: store.get(b.id).copies.map(x => x.id === c.id ? { ...x, state: e.target.value } : x) }, `Exemplaire ${c.code} : ${e.target.value}`) }, STATES.map(s => h('option', { value: s, selected: c.state === s }, s)))),
            h('td', {}, ln ? [badge(`prêté à ${store.get(ln.studentId)?.firstName || '?'} depuis le ${model.frShort(ln.start)}`, late(ln) ? 'warn' : 'info'), late(ln) ? badge('en retard', 'warn') : null] : ''),
            h('td', {}, ln ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'return-copy', onclick: () => returnDialog([ln]) }, 'Retour') : h('button', { class: 'btn btn-small btn-primary', type: 'button', disabled: c.state === 'perdu ou abîmé', 'data-testid': 'lend-copy', onclick: () => lendDialog(cls, b, c) }, 'Prêter')));
        }))),
          h('div', { class: 'row' }, h('button', { class: 'btn btn-small', type: 'button', onclick: () => { const n = (b.copies || []).length + 1; store.update(b.id, { copies: [...(b.copies || []), { id: store.uid(), code: `${b.ref || b.title.slice(0, 3).toUpperCase()}-${n}`, state: 'disponible' }] }, 'Exemplaire ajouté'); } }, '+ exemplaire'),
            h('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
              const sel = await pickMany({ title: 'Séquences qui utilisent ce livre', items: P.ofClass('sequence', cls.id).map(s => ({ id: s.id, label: P.sequenceTitle(s), detail: s.subject })), selected: b.sequenceIds || [] });
              if (sel) await store.update(b.id, { sequenceIds: sel }, 'Livre relié aux séquences');
            } }, 'Relier à des séquences'))) : null);
    }) : emptyState('Catalogue vide', 'Ajoutez les livres de la classe, avec un exemplaire par livre physique.'),
    h('p', { class: 'muted small' }, 'La lecture de codes-barres ou QR pour les exemplaires est prévue plus tard, en option.'));
}

function bookDialog(b = null) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' }, field('Titre', h('input', { name: 'title', required: true, value: b?.title || '' })), field('Auteur', h('input', { name: 'author', value: b?.author || '' }))),
    h('div', { class: 'grid-3' }, field('Catégorie', h('input', { name: 'category', value: b?.category || '', placeholder: 'album, roman, documentaire, BD…', list: 'book-cats' })),
      field('Niveau indicatif', h('select', { name: 'level' }, h('option', { value: '' }, '—'), model.NIVEAUX.map(l => h('option', { value: l, selected: b?.level === l }, l)))),
      field('Identifiant / cote', h('input', { name: 'ref', value: b?.ref || '' }))),
    h('datalist', { id: 'book-cats' }, ['album', 'roman', 'documentaire', 'bande dessinée', 'poésie', 'série de lecture'].map(v => h('option', { value: v }))),
    b ? null : field('Nombre d’exemplaires', h('input', { name: 'n', type: 'number', min: 1, max: 40, value: 1 })));
  const actions = [{ label: 'Annuler' }];
  if (b) actions.unshift({ label: 'Supprimer', danger: true, onClick: async () => {
    if ((b.copies || []).some(c => loanOfCopy(c.id))) { toast('Des exemplaires sont prêtés : enregistrez leur retour d’abord.', { kind: 'error' }); return false; }
    await store.remove(b.id, `Livre « ${b.title} » mis à la corbeille`);
  } });
  actions.push({ label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form); if (!d.title) return false;
    if (b) await store.update(b.id, { title: d.title, author: d.author, category: d.category, level: d.level, ref: d.ref }, `Livre « ${d.title} »`);
    else { const code = d.ref || d.title.slice(0, 3).toUpperCase(); await store.create('book', { title: d.title, author: d.author, category: d.category, level: d.level, ref: d.ref, sequenceIds: [], copies: Array.from({ length: Math.max(1, Math.min(40, Number(d.n) || 1)) }, (_, i) => ({ id: store.uid(), code: `${code}-${i + 1}`, state: 'disponible' })) }, `Livre « ${d.title} » ajouté`); }
  } });
  modal({ title: b ? 'Modifier le livre' : 'Ajouter un livre', wide: true, body: form, actions });
}

function lendDialog(cls, b, c) {
  const students = model.studentsOfClass(cls.id).map(x => x.student);
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Élève', h('select', { name: 'studentId', 'data-testid': 'lend-student' }, students.map(s => h('option', { value: s.id }, `${s.firstName} ${s.lastName}${openLoansOfStudent(s.id).length ? ` (${openLoansOfStudent(s.id).length} prêt(s) en cours)` : ''}`)))),
    field('Retour prévu (facultatif)', h('input', { name: 'due', type: 'date', value: model.addDays(model.todayIso(), 14) })));
  modal({ title: `Prêter « ${b.title} » (${c.code})`, body: form, actions: [{ label: 'Annuler' }, { label: 'Prêter', primary: true, onClick: async () => {
    const d = formData(form);
    try { await lend(cls, b, c, d.studentId, d.due); toast('Prêt enregistré'); } catch (e) { toast(e.message, { kind: 'error' }); return false; }
  } }] });
}

function returnDialog(loans) {
  const state = h('select', { name: 'state' }, ['bon état', 'à vérifier', 'abîmé', 'perdu'].map(s => h('option', { value: s }, s)));
  const note = h('input', { name: 'note', placeholder: 'commentaire' });
  const date = h('input', { type: 'date', value: model.todayIso() });
  modal({ title: loans.length > 1 ? `Retour de ${loans.length} livres` : `Retour de ${copyLabel(loans[0])}`, body: h('div', { class: 'form' }, field('Rendu le', date), field('État', state), field('Commentaire', note)),
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer le retour', primary: true, onClick: async () => {
      const items = [];
      for (const l of loans) {
        items.push({ id: l.id, patch: { returnedAt: date.value || model.todayIso(), returnState: state.value, note: note.value } });
        if (state.value !== 'bon état') { const b = store.get(l.bookId); if (b) items.push({ id: b.id, patch: { copies: b.copies.map(c => c.id === l.copyId ? { ...c, state: state.value === 'à vérifier' ? 'à vérifier' : 'perdu ou abîmé' } : c) } }); }
      }
      await store.batch(items, loans.length > 1 ? `Retour de ${loans.length} livres` : `Retour de ${copyLabel(loans[0])}`);
      filt.selected.clear(); toast('Retour enregistré', { action: 'Annuler', onAction: () => store.undo() });
    } }] });
}

function loansView(cls, loans, rerender) {
  const today = model.todayIso();
  const sorted = loans.slice().sort((a, b) => (late(b) - late(a)) || (a.due || '9').localeCompare(b.due || '9'));
  return h('section', { class: 'card' },
    h('div', { class: 'row' }, h('button', { class: 'btn btn-small', type: 'button', disabled: !filt.selected.size, 'data-testid': 'bulk-return', onclick: async () => {
      const ls = loans.filter(l => filt.selected.has(l.id));
      if (await confirmDialog('Retour groupé', `Enregistrer le retour de ${ls.length} livre(s) ?`, { confirmLabel: 'Continuer' })) returnDialog(ls);
    } }, `Retour groupé (${filt.selected.size})`),
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => printDocument(printTable({ title: 'Prêts en cours', subtitle: `${cls.name} · ${model.frDate(today)}`, columns: ['Élève', 'Livre', 'Depuis le', 'Retour prévu', 'Rendu'].map(label => ({ label })),
        rows: sorted.map(l => [`${store.get(l.studentId)?.firstName || ''} ${store.get(l.studentId)?.lastName || ''}`, copyLabel(l), model.frShort(l.start), l.due ? model.frShort(l.due) + (late(l) ? ' (retard)' : '') : '', '☐']) })) }, icon('print', 14), 'Imprimer')),
    sorted.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table', 'data-testid': 'loans-table' }, h('thead', {}, h('tr', {}, ['', 'Élève', 'Livre', 'Depuis', 'Retour prévu', ''].map(t => h('th', {}, t)))),
      h('tbody', {}, sorted.map(l => h('tr', {}, h('td', {}, h('input', { type: 'checkbox', checked: filt.selected.has(l.id), 'aria-label': 'Sélectionner', onchange: (e) => { e.target.checked ? filt.selected.add(l.id) : filt.selected.delete(l.id); rerender(); } })),
        h('td', {}, h('a', { href: `#/eleve/${l.studentId}?t=vie` }, `${store.get(l.studentId)?.firstName || '?'} ${store.get(l.studentId)?.lastName || ''}`)), h('td', {}, copyLabel(l)), h('td', {}, model.frShort(l.start)),
        h('td', {}, l.due ? model.frShort(l.due) : '—', late(l) ? badge('en retard', 'warn') : null),
        h('td', {}, h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'return-loan', onclick: () => returnDialog([l]) }, 'Retour en un clic'))))))) : emptyState('Aucun prêt en cours'));
}

function studentView(cls, rerender) {
  const students = model.studentsOfClass(cls.id, { includeLeft: true }).map(x => x.student);
  const s = filt.studentId ? store.get(filt.studentId) : null;
  const all = s ? store.all('loan').filter(l => l.studentId === s.id).sort((a, b) => b.start.localeCompare(a.start)) : [];
  return h('section', { class: 'card' }, h('select', { 'aria-label': 'Élève', onchange: (e) => { filt.studentId = e.target.value; rerender(); } }, h('option', { value: '' }, 'Choisir un élève'),
    students.map(x => h('option', { value: x.id, selected: x.id === filt.studentId }, `${x.firstName} ${x.lastName}${openLoansOfStudent(x.id).length ? ` — ${openLoansOfStudent(x.id).length} en cours` : ''}`))),
    s ? (all.length ? h('ul', { class: 'plain' }, all.map(l => h('li', {}, `${copyLabel(l)} : du ${model.frShort(l.start)}`, l.returnedAt ? ` au ${model.frShort(l.returnedAt)} (${l.returnState || 'rendu'})` : ' — en cours', late(l) ? badge('en retard', 'warn') : null,
      !l.returnedAt ? h('button', { class: 'btn btn-link small', type: 'button', onclick: () => returnDialog([l]) }, 'retour') : null))) : h('p', { class: 'muted' }, 'Aucun prêt.')) : null);
}

function historyView(cls) {
  const years = model.years();
  return h('div', { class: 'stack' }, years.map(y => {
    const ls = store.all('loan').filter(l => l.yearId === y.id).sort((a, b) => b.start.localeCompare(a.start));
    return ls.length ? h('section', { class: 'card' }, h('h2', {}, `Année ${y.label} — ${ls.length} prêt(s)`), h('ul', { class: 'plain small' }, ls.map(l => h('li', {}, `${model.frShort(l.start)} · ${store.get(l.studentId)?.firstName || '?'} · ${copyLabel(l)} · ${l.returnedAt ? `rendu le ${model.frShort(l.returnedAt)}` : 'en cours'}`)))) : null;
  }), h('p', { class: 'muted small' }, 'Le catalogue est commun à toutes les années ; l’historique des prêts est séparé par année.'));
  void cls;
}
