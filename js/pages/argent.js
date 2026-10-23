// Organisation › Argent et projets.
// Comptes par année (solde initial / report explicites), journal unique des mouvements,
// projets (sorties, coopérative, kermesse, collectes, projets transdisciplinaires) : attendu, reçu, reste.
// Toutes les vues lisent les mêmes mouvements : aucun double compte, aucune suppression silencieuse.
import * as store from '../store.js';
import * as model from '../model.js';
import * as FI from '../finance.js';
import * as O from '../orga.js';
import { h, icon, toast, modal, field, formData, badge, emptyState, download } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { bound, pickMany } from '../forms.js';
import { filesBlock } from '../pedago-ui.js';
import { printDocument, printTable } from '../print.js';
import { toCsv } from '../csv.js';

const st = { tab: 'projets', account: '', project: '' };
const TABS = [['projets', 'Projets'], ['journal', 'Journal des mouvements'], ['comptes', 'Comptes']];

export function render({ params, query, rerender }) {
  if (params[0] === 'projet' && params[1]) return projectPage(params[1], rerender);
  if (query?.t && TABS.some(t => t[0] === query.t)) st.tab = query.t;
  const year = model.currentYear();
  if (!year) return h('div', { class: 'page' }, pageHeader('Argent et projets'), emptyState('Aucune année scolaire', 'Créez d’abord une année dans Réglages.'));
  const accs = FI.accounts(year.id);
  return h('div', { class: 'page' },
    pageHeader('Argent et projets', { favKey: 'organisation/argent', subtitle: `Année ${year.label || ''} · un paiement = un seul mouvement, visible partout`,
      actions: [
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-movement', onclick: () => movementDialog({}) }, icon('plus', 16), 'Nouveau mouvement'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'new-project', onclick: () => projectDialog() }, icon('plus', 16), 'Nouveau projet')] }),
    subTabs(),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' }, TABS.map(([k, l]) => h('button', { type: 'button', class: st.tab === k ? 'on' : '', 'data-testid': `money-tab-${k}`, onclick: () => { st.tab = k; rerender(); } }, l))),
    !accs.length ? h('div', { class: 'card notice' }, h('p', {}, 'Commencez par créer un compte (coopérative, caisse de la classe…) avec son solde initial.'),
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-account-hint', onclick: () => accountDialog(year) }, 'Créer un compte')) : null,
    st.tab === 'projets' ? projectsTab(year) : st.tab === 'journal' ? journalTab(year, rerender) : accountsTab(year),
    h('p', { class: 'muted small' }, 'Aucun paiement en ligne : l’application enregistre ce que vous avez reçu ou dépensé. Les fichiers justificatifs restent sur cet appareil et dans la sauvegarde.'));
}

// ───────── Comptes
function accountsTab(year) {
  const accs = FI.accounts(year.id);
  const prevYears = model.years().filter(y => y.id !== year.id && (y.start || '') < (year.start || ''));
  const prevAccs = prevYears.flatMap(y => FI.accounts(y.id).map(a => ({ a, y }))).filter(({ a }) => !accs.some(x => x.opening?.fromAccountId === a.id));
  return h('div', { class: 'stack' },
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', 'data-testid': 'new-account', onclick: () => accountDialog(year) }, icon('plus', 16), 'Nouveau compte')),
    accs.length ? h('div', { class: 'grid-2' }, accs.map(a => {
      const b = FI.balance(a);
      return h('div', { class: 'card', 'data-testid': 'account-card' },
        h('div', { class: 'card-head' }, h('h2', {}, a.name), h('strong', { class: 'money', 'data-testid': 'account-balance' }, FI.euros(b.closing))),
        h('table', { class: 'table compact' }, h('tbody', {},
          h('tr', {}, h('td', {}, 'Solde initial'), h('td', { class: 'num' }, FI.euros(b.opening))),
          h('tr', {}, h('td', {}, 'Entrées'), h('td', { class: 'num' }, FI.euros(b.income))),
          h('tr', {}, h('td', {}, 'Sorties'), h('td', { class: 'num' }, FI.euros(b.expense))),
          h('tr', {}, h('th', {}, 'Solde'), h('th', { class: 'num' }, FI.euros(b.closing))))),
        h('p', { class: 'muted small' }, a.opening?.note || (b.opening ? 'Solde initial saisi à la création.' : 'Solde initial : 0 €.')),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => { st.tab = 'journal'; st.account = a.id; location.hash = '#/argent?t=journal'; } }, 'Voir le journal'));
    })) : null,
    prevAccs.length ? h('div', { class: 'card' }, h('h2', {}, 'Reporter un compte de l’année précédente'),
      h('p', { class: 'muted small' }, 'Crée un nouveau compte pour cette année avec, comme solde initial, le solde final de l’ancien. Les mouvements de l’ancienne année restent séparés et inchangés.'),
      h('ul', { class: 'plain' }, prevAccs.map(({ a, y }) => h('li', {}, `${a.name} (${y.label || ''}) — solde ${FI.euros(FI.balance(a).closing)} `,
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'carry-over', onclick: async () => { await FI.carryOver(a, year.id); toast('Compte reporté sur l’année en cours'); } }, 'Reporter'))))) : null);
}

function accountDialog(year) {
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Nom du compte', h('input', { name: 'name', required: true, placeholder: 'ex. Coopérative de classe', 'data-testid': 'account-name' })),
    h('div', { class: 'grid-2' },
      field('Solde initial (€)', h('input', { name: 'opening', inputmode: 'decimal', value: '0', 'data-testid': 'account-opening' })),
      field('Origine du solde initial', h('input', { name: 'note', placeholder: 'ex. solde au 1er septembre d’après le relevé OCCE' }))));
  const err = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: `Nouveau compte — ${year.label || ''}`, body: h('div', {}, form, err), actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, onClick: async () => {
    const d = formData(form);
    const opening = FI.parseEuros(d.opening || '0');
    if (!d.name.trim()) { err.textContent = 'Nom obligatoire.'; return false; }
    if (Number.isNaN(opening)) { err.textContent = 'Solde initial invalide (ex. 125,50).'; return false; }
    await FI.createAccount({ name: d.name.trim(), yearId: year.id, opening: opening || 0, openingNote: d.note });
  } }] });
}

// ───────── Mouvement (versement, remboursement, recette, dépense)
export function movementDialog(pre = {}) {
  const year = model.currentYear();
  const accs = FI.accounts(year?.id);
  if (!accs.length) { toast('Créez d’abord un compte (onglet Comptes).', { kind: 'error' }); return; }
  const cls = model.currentClass();
  const projs = FI.projects(year.id);
  const students = cls ? model.studentsOfClass(cls.id, { includeLeft: true }).map(x => x.student) : [];
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' },
      field('Nature', h('select', { name: 'kind', 'data-testid': 'mv-kind', onchange: () => sync() }, FI.KINDS.map(([k, l]) => h('option', { value: k, selected: (pre.kind || 'versement') === k }, l)))),
      field('Montant (€)', h('input', { name: 'abs', inputmode: 'decimal', required: true, value: pre.abs ? String(pre.abs / 100).replace('.', ',') : '', 'data-testid': 'mv-amount' }))),
    h('div', { class: 'grid-3' },
      field('Date', h('input', { name: 'date', type: 'date', value: pre.date || model.todayIso(), 'data-testid': 'mv-date' })),
      field('Moyen', h('select', { name: 'mode', 'data-testid': 'mv-mode' }, FI.MODES.map(m => h('option', { value: m, selected: pre.mode === m }, m)))),
      field('Compte', h('select', { name: 'accountId', 'data-testid': 'mv-account' }, accs.map(a => h('option', { value: a.id, selected: (pre.accountId || st.account) === a.id }, a.name))))),
    h('div', { class: 'grid-2' },
      field('Projet', h('select', { name: 'projectId', 'data-testid': 'mv-project' }, h('option', { value: '' }, '— aucun —'), projs.map(p => h('option', { value: p.id, selected: pre.projectId === p.id }, p.title)))),
      h('div', { class: 'mv-student' }, field('Élève', h('select', { name: 'studentId', 'data-testid': 'mv-student' }, h('option', { value: '' }, '—'), students.map(s => h('option', { value: s.id, selected: pre.studentId === s.id }, model.fullName(s))))))),
    h('div', { class: 'grid-2' },
      field('Libellé', h('input', { name: 'label', value: pre.label || '', placeholder: 'ex. Chèque n° 1234, achat de livres…', 'data-testid': 'mv-label' })),
      h('div', { class: 'mv-stand' }, field('Stand / origine (facultatif)', h('input', { name: 'stand', value: pre.stand || '', placeholder: 'ex. stand gâteaux' })))),
    field('Payé par / fournisseur (facultatif)', h('input', { name: 'payer', value: pre.payer || '' })));
  const sync = () => {
    const k = form.elements.kind.value;
    form.querySelector('.mv-student').hidden = !(k === 'versement' || k === 'remboursement');
    form.querySelector('.mv-stand').hidden = k !== 'recette';
  };
  sync();
  const err = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: 'Nouveau mouvement', body: h('div', {}, form, err, h('p', { class: 'muted small' }, 'Un mouvement validé ne peut plus être supprimé : en cas d’erreur, on l’annule (correction tracée) puis on saisit le bon.')),
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, testid: 'mv-save', onClick: async () => {
      const d = formData(form);
      const abs = FI.parseEuros(d.abs);
      if (!abs || Number.isNaN(abs)) { err.textContent = 'Montant invalide (ex. 12,50).'; return false; }
      if (!(d.kind === 'versement' || d.kind === 'remboursement')) d.studentId = '';
      try {
        await FI.addMovement({ ...d, abs, projectId: d.projectId || null, studentId: d.studentId || null });
        toast('Mouvement enregistré');
      } catch (e) { err.textContent = e.message; return false; }
    } }] });
}

function reverseDialog(mv) {
  const input = h('input', { name: 'reason', placeholder: 'ex. erreur de montant', 'data-testid': 'reverse-reason' });
  modal({ title: 'Annuler ce mouvement', body: h('div', {}, h('p', {}, `${model.frShort(mv.date)} — ${mv.label || ''} : ${FI.euros(mv.amount, { sign: true })}`),
    h('p', { class: 'muted' }, 'Un mouvement inverse est ajouté au journal ; le mouvement d’origine reste visible et marqué « annulé ».'), field('Motif', input)),
  actions: [{ label: 'Retour' }, { label: 'Annuler le mouvement', primary: true, testid: 'reverse-confirm', onClick: async () => { await FI.reverse(mv, input.value.trim()); toast('Correction enregistrée'); } }] });
}

// ───────── Journal
function journalTab(year, rerender) {
  const accs = FI.accounts(year.id);
  const projs = FI.projects(year.id);
  const list = FI.movements({ yearId: year.id, accountId: st.account || null, projectId: st.project || null });
  const total = list.reduce((s, m) => s + m.amount, 0);
  const rowsOf = () => list.map(m => [model.frShort(m.date), store.get(m.accountId)?.name || '', kindLabel(m), m.label || '', m.studentId ? model.fullName(store.get(m.studentId) || {}) : '', m.projectId ? store.get(m.projectId)?.title || '' : '', m.mode || '', FI.euros(m.amount, { sign: true }), statusLabel(m)]);
  const cols = ['Date', 'Compte', 'Nature', 'Libellé', 'Élève', 'Projet', 'Moyen', 'Montant', 'État'];
  return h('div', { class: 'stack' },
    h('div', { class: 'filters' },
      h('select', { 'aria-label': 'Compte', onchange: (e) => { st.account = e.target.value; rerender(); } }, h('option', { value: '' }, 'Tous les comptes'), accs.map(a => h('option', { value: a.id, selected: st.account === a.id }, a.name))),
      h('select', { 'aria-label': 'Projet', onchange: (e) => { st.project = e.target.value; rerender(); } }, h('option', { value: '' }, 'Tous les projets'), projs.map(p => h('option', { value: p.id, selected: st.project === p.id }, p.title))),
      h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'journal-csv', onclick: () => download(`journal-financier-${year.label || ''}.csv`, toCsv([cols, ...list.map(m => [m.date, store.get(m.accountId)?.name || '', kindLabel(m), m.label || '', m.studentId ? model.fullName(store.get(m.studentId) || {}) : '', m.projectId ? store.get(m.projectId)?.title || '' : '', m.mode || '', (m.amount / 100).toFixed(2).replace('.', ','), statusLabel(m)])]), 'text/csv;charset=utf-8') }, icon('download', 14), 'Exporter (CSV)'),
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => printDocument(printTable({ title: 'Journal financier', subtitle: `${year.label || ''}${st.account ? ' · ' + store.get(st.account)?.name : ''}${st.project ? ' · ' + store.get(st.project)?.title : ''}`, columns: cols.map(label => ({ label })), rows: rowsOf(), footer: `Total des mouvements : ${FI.euros(total)} — édité le ${model.frShort(model.todayIso())}` }), { orientation: 'landscape' }) }, icon('print', 14), 'Imprimer')),
    list.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table', 'data-testid': 'journal' },
      h('thead', {}, h('tr', {}, cols.map(c => h('th', { class: c === 'Montant' ? 'num' : '' }, c)), h('th', {}))),
      h('tbody', {}, list.map(m => h('tr', { class: m.reversedById ? 'reversed' : '', 'data-testid': 'journal-row' },
        h('td', { class: 'nowrap' }, model.frShort(m.date)), h('td', {}, store.get(m.accountId)?.name || ''), h('td', {}, kindLabel(m)), h('td', {}, m.label || ''),
        h('td', {}, m.studentId ? h('a', { href: `#/eleve/${m.studentId}?t=vie` }, model.fullName(store.get(m.studentId) || {})) : ''),
        h('td', {}, m.projectId ? h('a', { href: `#/argent/projet/${m.projectId}` }, store.get(m.projectId)?.title || '') : ''),
        h('td', {}, m.mode || ''), h('td', { class: 'num nowrap' }, FI.euros(m.amount, { sign: true })), h('td', {}, statusBadge(m)),
        h('td', {}, !m.reversedById && !m.correctsId ? h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'reverse', onclick: () => reverseDialog(m) }, 'Annuler') : null)))),
      h('tfoot', {}, h('tr', {}, h('th', { colspan: 7 }, 'Total'), h('th', { class: 'num', 'data-testid': 'journal-total' }, FI.euros(total)), h('th', { colspan: 2 }))))) : emptyState('Aucun mouvement', 'Les versements, dépenses et recettes apparaîtront ici.'));
}
const kindLabel = (m) => ({ versement: 'versement', remboursement: 'remboursement', recette: 'recette', 'dépense': 'dépense' })[m.kind] || '';
const statusLabel = (m) => (m.reversedById ? 'annulé' : m.correctsId ? 'annulation' : 'validé');
const statusBadge = (m) => (m.reversedById ? badge('annulé', 'warn') : m.correctsId ? badge('annulation', 'muted') : badge('validé', 'ok'));

// ───────── Projets
function projectsTab(year) {
  const ps = FI.projects(year.id);
  return ps.length ? h('div', { class: 'stack' }, ps.map(p => {
    const s = FI.projectStatus(p);
    return h('a', { class: 'card link-card', href: `#/argent/projet/${p.id}`, 'data-testid': 'project-card' },
      h('div', { class: 'card-head' }, h('h2', {}, p.title, ' ', badge(p.kind, 'muted')), h('span', { class: 'muted' }, p.date ? model.frDate(p.date) : 'date à fixer')),
      h('div', { class: 'tags' },
        s.rows.length ? badge(`attendu ${FI.euros(s.expected)}`, 'muted') : null,
        badge(`reçu ${FI.euros(s.received)}`, 'ok'),
        s.rest ? badge(`reste ${FI.euros(s.rest)}`, 'warn') : null,
        s.expenses ? badge(`dépenses ${FI.euros(-s.expenses)}`, 'muted') : null,
        badge(`solde ${FI.euros(s.balance)}`, 'info')));
  })) : emptyState('Aucun projet', 'Sortie, classe de découverte, kermesse, collecte, coopérative ou projet pédagogique : créez un projet pour suivre participants, paiements et dépenses.');
}

function projectDialog(p = null) {
  const year = model.currentYear();
  const cls = model.currentClass();
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' }, field('Intitulé', h('input', { name: 'title', required: true, value: p?.title || '', 'data-testid': 'project-title' })),
      field('Type', h('select', { name: 'kind' }, FI.PROJECT_KINDS.map(k => h('option', { value: k, selected: p?.kind === k }, k))))),
    h('div', { class: 'grid-2' }, field('Date (ou début)', h('input', { name: 'date', type: 'date', value: p?.date || '' })),
      field('Participation par élève (€)', h('input', { name: 'per', inputmode: 'decimal', value: p ? String((p.perStudent || 0) / 100).replace('.', ',') : '', placeholder: '0 si aucune', 'data-testid': 'project-per' }))),
    !p && cls ? h('label', { class: 'inline' }, h('input', { type: 'checkbox', name: 'all', checked: true }), `Tous les élèves de ${cls.name} participent`) : null);
  const err = h('div', { class: 'form-errors', role: 'alert' });
  modal({ title: p ? 'Modifier le projet' : 'Nouveau projet', body: h('div', {}, form, err), actions: [{ label: 'Annuler' }, { label: p ? 'Enregistrer' : 'Créer', primary: true, testid: 'project-save', onClick: async () => {
    const d = formData(form);
    const per = FI.parseEuros(d.per || '0');
    if (!d.title.trim()) { err.textContent = 'Intitulé obligatoire.'; return false; }
    if (Number.isNaN(per)) { err.textContent = 'Montant invalide.'; return false; }
    if (p) { await store.update(p.id, { title: d.title.trim(), kind: d.kind, date: d.date, perStudent: per || 0 }, 'Projet modifié'); return; }
    const participants = d.all && cls ? model.studentsOfClass(cls.id).map(x => x.student.id) : [];
    const r = await store.create('project', { title: d.title.trim(), kind: d.kind, date: d.date, perStudent: per || 0, yearId: year.id, classId: cls?.id || null, participants, overrides: {},
      budget: [], steps: [], subjects: [], contactIds: [], companions: '', productions: '', description: '', groups: '', authTemplateId: '', fileIds: [] }, `Projet « ${d.title} »`);
    location.hash = `#/argent/projet/${r.id}`;
  } }] });
}

function projectPage(id, rerender) {
  const p = store.get(id);
  if (!p || p.deletedAt) return h('div', { class: 'page' }, pageHeader('Projet introuvable'), h('a', { href: '#/argent' }, '← Argent et projets'));
  const s = FI.projectStatus(p);
  return h('div', { class: 'page' },
    h('p', {}, h('a', { href: '#/argent', class: 'back' }, '← Argent et projets')),
    pageHeader(p.title, { subtitle: `${p.kind}${p.date ? ' · ' + model.frDate(p.date) : ''} · participation ${FI.euros(p.perStudent)} par élève`,
      actions: [
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'project-add-mv', onclick: () => movementDialog({ projectId: p.id, kind: 'dépense' }) }, icon('plus', 16), 'Dépense ou recette'),
        h('button', { class: 'btn', type: 'button', onclick: () => projectDialog(p) }, 'Modifier'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'project-print', onclick: () => printPayments(p) }, icon('print', 16), 'État des paiements')] }),
    h('div', { class: 'grid-4 stats' },
      stat('Attendu', FI.euros(s.expected)), stat('Reçu des familles', FI.euros(s.received), 'project-received'), stat('Reste à percevoir', FI.euros(s.rest), 'project-rest'),
      stat('Solde du projet', FI.euros(s.balance), 'project-balance')),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, `Participants (${s.rows.length})`),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'project-participants', onclick: () => editParticipants(p) }, 'Choisir les participants')),
      s.rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table', 'data-testid': 'project-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Élève'), h('th', { class: 'num' }, 'Attendu'), h('th', { class: 'num' }, 'Reçu'), h('th', { class: 'num' }, 'Reste'), h('th', {}, 'Versements'), h('th', {}))),
        h('tbody', {}, s.rows.map(r => h('tr', { 'data-testid': 'project-row' },
          h('td', {}, r.student ? h('a', { href: `#/eleve/${r.sid}?t=vie` }, model.fullName(r.student)) : '?'),
          h('td', { class: 'num' }, h('input', { class: 'money-input', inputmode: 'decimal', 'aria-label': `Montant attendu pour ${r.student?.firstName || ''}`, value: String(r.expected / 100).replace('.', ','),
            onchange: async (e) => { const v = FI.parseEuros(e.target.value); if (v == null || Number.isNaN(v)) { toast('Montant invalide', { kind: 'error' }); return; } await store.update(p.id, { overrides: { ...(p.overrides || {}), [r.sid]: v === p.perStudent ? null : v } }, 'Montant attendu ajusté'); } })),
          h('td', { class: 'num' }, FI.euros(r.paid)),
          h('td', { class: 'num' }, r.rest > 0 ? badge(FI.euros(r.rest), 'warn') : r.rest < 0 ? badge(`trop-perçu ${FI.euros(-r.rest)}`, 'info') : badge('réglé', 'ok')),
          h('td', { class: 'small' }, r.movements.map(m => h('div', { class: m.reversedById ? 'reversed' : '' }, `${model.frShort(m.date)} ${FI.euros(m.amount, { sign: true })} (${m.mode})`))),
          h('td', {}, h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'pay', onclick: () => movementDialog({ projectId: p.id, studentId: r.sid, kind: 'versement', abs: Math.max(0, r.rest) || '' }) }, '+ versement'))))))) : h('p', { class: 'muted' }, 'Aucun participant.')),
    h('div', { class: 'grid-2' },
      h('section', { class: 'card' }, h('h2', {}, 'Budget prévisionnel'), budgetEditor(p, s),
        h('p', { class: 'muted small' }, `Réalisé : recettes hors familles ${FI.euros(s.otherIncome)}, dépenses ${FI.euros(-s.expenses)}.`),
        Object.keys(s.stands).length ? h('div', {}, h('h3', {}, 'Recettes par stand'), h('ul', { class: 'plain' }, Object.entries(s.stands).map(([k, v]) => h('li', {}, `${k} : ${FI.euros(v)}`)))) : null),
      h('section', { class: 'card' }, h('h2', {}, 'Mouvements du projet'),
        s.movements.length ? h('ul', { class: 'plain small' }, s.movements.map(m => h('li', { class: m.reversedById ? 'reversed' : '' }, `${model.frShort(m.date)} · ${kindLabel(m)} · ${m.label || ''}${m.studentId ? ` (${store.get(m.studentId)?.firstName || ''})` : ''} : `, h('strong', {}, FI.euros(m.amount, { sign: true })), ' ', statusBadge(m)))) : h('p', { class: 'muted' }, 'Aucun mouvement.'),
        h('a', { class: 'btn btn-small', href: '#/argent?t=journal', onclick: () => { st.project = p.id; } }, 'Voir dans le journal'))),
    projectDetails(p),
    h('section', { class: 'card' }, filesBlock(p.id, { title: 'Justificatifs et documents' })));
  void rerender;
}
function stat(label, value, testid) { return h('div', { class: 'card stat' }, h('div', { class: 'muted small' }, label), h('div', { class: 'stat-value', 'data-testid': testid || null }, value)); }

function budgetEditor(p, s) {
  const lines = p.budget || [];
  const save = (next) => store.update(p.id, { budget: next }, 'Budget modifié', { quiet: true });
  return h('div', {},
    lines.length ? h('table', { class: 'table compact' }, h('tbody', {}, lines.map((l, i) => h('tr', {},
      h('td', {}, h('input', { value: l.label || '', 'aria-label': 'Poste', onchange: (e) => save(lines.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))) })),
      h('td', { class: 'num' }, h('input', { class: 'money-input', inputmode: 'decimal', value: String((l.amount || 0) / 100).replace('.', ','), 'aria-label': 'Montant prévu (négatif pour une dépense)',
        onchange: (e) => { const neg = e.target.value.trim().startsWith('-'); const v = FI.parseEuros(e.target.value.replace('-', '')); if (v == null || Number.isNaN(v)) return; save(lines.map((x, j) => (j === i ? { ...x, amount: neg ? -v : v } : x))); } })),
      h('td', {}, h('button', { class: 'btn btn-small', type: 'button', 'aria-label': 'Retirer', onclick: () => store.update(p.id, { budget: lines.filter((_, j) => j !== i) }, 'Poste retiré') }, '×'))))),
      h('tfoot', {}, h('tr', {}, h('th', {}, 'Solde prévu (avec participations attendues)'), h('th', { class: 'num' }, FI.euros(s.budget + s.expected)), h('th', {})))) : h('p', { class: 'muted small' }, 'Aucun poste. Saisissez les dépenses en négatif (ex. -350 pour le car) et les recettes en positif.'),
    h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'budget-add', onclick: () => store.update(p.id, { budget: [...lines, { label: '', amount: 0 }] }, 'Poste ajouté') }, '+ poste'));
}

async function editParticipants(p) {
  const cls = p.classId ? store.get(p.classId) : model.currentClass();
  const items = cls ? model.studentsOfClass(cls.id, { includeLeft: true }).map(x => ({ id: x.student.id, label: model.fullName(x.student) })) : [];
  const sel = await pickMany({ title: 'Participants', items, selected: p.participants || [] });
  if (!sel) return;
  const removedWithMoney = (p.participants || []).filter(id => !sel.includes(id) && FI.studentInProject(p, id).paid);
  await store.update(p.id, { participants: sel }, 'Participants modifiés');
  if (removedWithMoney.length) toast(`${removedWithMoney.length} élève(s) retiré(s) ont déjà versé : leurs versements restent au journal (à rembourser si besoin).`, { timeout: 9000 });
}

function projectDetails(p) {
  const steps = p.steps || [];
  const saveSteps = (next) => store.update(p.id, { steps: next }, 'Étapes du projet');
  return h('section', { class: 'card' }, h('h2', {}, 'Projet : organisation'),
    h('div', { class: 'grid-2' },
      bound({ label: 'Description et objectifs', value: p.description, onSave: (v) => store.update(p.id, { description: v }, 'Description du projet', { quiet: true }) }),
      bound({ label: 'Productions attendues', value: p.productions, onSave: (v) => store.update(p.id, { productions: v }, 'Productions du projet', { quiet: true }) }),
      bound({ label: 'Accompagnateurs', value: p.companions, type: 'text', onSave: (v) => store.update(p.id, { companions: v }, 'Accompagnateurs', { quiet: true }) }),
      bound({ label: 'Groupes', value: p.groups, type: 'text', onSave: (v) => store.update(p.id, { groups: v }, 'Groupes du projet', { quiet: true }) })),
    h('div', { class: 'row wrap' }, h('strong', {}, 'Disciplines : '), (p.subjects || []).map(x => badge(x, 'muted')),
      h('button', { class: 'btn btn-small', type: 'button', onclick: async () => { const sel = await pickMany({ title: 'Disciplines', items: model.subjects().map(x => ({ id: x, label: x })), selected: p.subjects || [] }); if (sel) store.update(p.id, { subjects: sel }, 'Disciplines du projet'); } }, 'Choisir')),
    h('div', { class: 'row wrap' }, h('strong', {}, 'Intervenants : '), (p.contactIds || []).map(cid => badge(O.contactName(cid), 'muted')),
      h('button', { class: 'btn btn-small', type: 'button', onclick: async () => { const sel = await pickMany({ title: 'Intervenants (Contacts)', items: O.contacts().map(c => ({ id: c.id, label: c.name, detail: c.role })), selected: p.contactIds || [], emptyText: 'Aucun contact : ajoutez-les dans Organisation › Contacts.' }); if (sel) store.update(p.id, { contactIds: sel }, 'Intervenants du projet'); } }, 'Choisir')),
    h('h3', {}, 'Calendrier et étapes'),
    steps.length ? h('ul', { class: 'plain' }, steps.map((x, i) => h('li', { class: 'row' },
      h('input', { type: 'checkbox', checked: !!x.done, 'aria-label': 'Étape faite', onchange: (e) => saveSteps(steps.map((y, j) => (j === i ? { ...y, done: e.target.checked } : y))) }),
      h('input', { type: 'date', value: x.date || '', 'aria-label': 'Date', onchange: (e) => saveSteps(steps.map((y, j) => (j === i ? { ...y, date: e.target.value } : y))) }),
      h('input', { value: x.label || '', 'aria-label': 'Étape', onchange: (e) => saveSteps(steps.map((y, j) => (j === i ? { ...y, label: e.target.value } : y))) }),
      h('button', { class: 'btn btn-small', type: 'button', 'aria-label': 'Retirer', onclick: () => saveSteps(steps.filter((_, j) => j !== i)) }, '×')))) : h('p', { class: 'muted small' }, 'Aucune étape.'),
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => saveSteps([...steps, { date: '', label: '', done: false }]) }, '+ étape'),
    h('p', { class: 'muted small' }, 'Les autorisations de sortie se suivent dans Ma classe › Listes ou Informations élèves (colonne liée à la fiche élève) ; les paiements, dans le tableau des participants ci-dessus.'),
    h('a', { class: 'btn btn-small', href: `#/redaction?t=mot&modele=sortie&projet=${p.id}`, 'data-testid': 'project-auth' }, 'Rédiger le mot d’autorisation de sortie'));
}

function printPayments(p) {
  const s = FI.projectStatus(p);
  printDocument(printTable({ title: `État des paiements — ${p.title}`, subtitle: `${p.kind}${p.date ? ' · ' + model.frDate(p.date) : ''} · édité le ${model.frShort(model.todayIso())}`,
    columns: [{ label: 'Élève' }, { label: 'Attendu' }, { label: 'Reçu' }, { label: 'Reste' }, { label: 'Versements' }],
    rows: s.rows.map(r => [r.student ? model.fullName(r.student) : '?', FI.euros(r.expected), FI.euros(r.paid), r.rest > 0 ? FI.euros(r.rest) : r.rest < 0 ? `trop-perçu ${FI.euros(-r.rest)}` : 'réglé', r.movements.map(m => `${model.frShort(m.date)} ${FI.euros(m.amount)} ${m.mode}`).join(' ; ')]),
    footer: `Attendu ${FI.euros(s.expected)} · reçu ${FI.euros(s.received)} · reste ${FI.euros(s.rest)} · dépenses ${FI.euros(-s.expenses)} · solde ${FI.euros(s.balance)}` }));
}
