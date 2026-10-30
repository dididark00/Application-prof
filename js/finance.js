// Argent et projets. Principe : un paiement = un seul mouvement financier (journal unique).
// Projets, fiches élèves, listes et comptes LISENT les mouvements, sans les recopier : pas de double compte.
// Un mouvement validé ne se supprime pas : on le corrige par un mouvement d'annulation tracé.
// Montants en centimes (entiers) pour éviter les erreurs d'arrondi.
import * as store from './store.js';
import * as model from './model.js';

export const MODES = ['espèces', 'chèque', 'virement', 'carte', 'autre'];
export const PROJECT_KINDS = ['sortie', 'classe de découverte', 'kermesse / fête', 'collecte', 'coopérative', 'projet pédagogique', 'autre'];
/** Nature d'un mouvement : versement d'une famille, remboursement à une famille, autre recette, dépense. */
export const KINDS = [['versement', 'Versement d’une famille'], ['remboursement', 'Remboursement à une famille'], ['recette', 'Autre recette (subvention, vente, stand…)'], ['dépense', 'Dépense']];
const SIGN = { versement: 1, recette: 1, remboursement: -1, 'dépense': -1 };

export function parseEuros(v) {
  if (v == null || v === '') return null;
  const s = String(v).replace(/[\s ]/g, '').replace('€', '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}
export function euros(c, { sign = false } = {}) {
  const n = (Number(c) || 0) / 100;
  const t = n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  return sign && n > 0 ? `+${t}` : t;
}

// ───── Comptes (un par année : coopérative, caisse de classe…)
export const accounts = (yearId) => store.all('account').filter(a => !yearId || a.yearId === yearId).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
export const movements = (f = {}) => store.all('movement').filter(m => (!f.accountId || m.accountId === f.accountId) && (!f.projectId || m.projectId === f.projectId)
  && (!f.studentId || m.studentId === f.studentId) && (!f.yearId || m.yearId === f.yearId))
  .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || ''));

export function balance(acc, upTo = null) {
  const mv = movements({ accountId: acc.id }).filter(m => !upTo || m.date <= upTo);
  const income = mv.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const expense = mv.filter(m => m.amount < 0).reduce((s, m) => s + m.amount, 0);
  const opening = Number(acc.opening?.amount) || 0;
  return { opening, income, expense, closing: opening + income + expense, count: mv.length };
}

/** Solde initial ou report : enregistré explicitement, avec sa provenance. */
export async function createAccount({ name, yearId, opening = 0, openingNote = '', fromAccountId = null }) {
  return store.create('account', { name, yearId, opening: { amount: opening, note: openingNote, fromAccountId } }, `Compte « ${name} »`);
}
/** Report : nouveau compte sur l'année suivante, solde initial = solde final de l'ancien (l'ancien reste intact). */
export async function carryOver(acc, toYearId) {
  const b = balance(acc);
  const fromYear = store.get(acc.yearId);
  return createAccount({ name: acc.name, yearId: toYearId, opening: b.closing, openingNote: `Report du compte « ${acc.name} » ${fromYear?.label || ''} (solde au ${model.frShort(model.todayIso())})`, fromAccountId: acc.id });
}

/** Enregistre un mouvement : crée UN enregistrement, lu ensuite par toutes les pages. */
export async function addMovement(data, label) {
  const abs = Number(data.abs);
  if (!Number.isInteger(abs) || abs <= 0) throw new Error('Montant invalide.');
  if (!SIGN[data.kind]) throw new Error('Nature du mouvement inconnue.');
  if (!data.accountId) throw new Error('Choisissez un compte.');
  if (!data.date) throw new Error('Date obligatoire.');
  if ((data.kind === 'versement' || data.kind === 'remboursement') && !data.studentId) throw new Error('Indiquez l’élève concerné.');
  const acc = store.get(data.accountId);
  if (!acc) throw new Error('Compte introuvable.');
  const { abs: _a, ...rest } = data;
  return store.create('movement', { mode: 'espèces', label: '', projectId: null, studentId: null, stand: '', payer: '', fileIds: [], ...rest,
    amount: SIGN[data.kind] * abs, yearId: acc.yearId, status: 'validé', correctsId: null, reversedById: null },
    label || `${KINDS.find(k => k[0] === data.kind)[1]} ${euros(abs)}`);
}

/** Modifie un mouvement saisi (montant, date, nature…) ; l'historique garde l'ancienne version. */
export async function updateMovement(mv, data) {
  const abs = Number(data.abs);
  if (!Number.isInteger(abs) || abs <= 0) throw new Error('Montant invalide.');
  if (!SIGN[data.kind]) throw new Error('Nature du mouvement inconnue.');
  if (!data.accountId || !store.get(data.accountId)) throw new Error('Choisissez un compte.');
  if (!data.date) throw new Error('Date obligatoire.');
  if ((data.kind === 'versement' || data.kind === 'remboursement') && !data.studentId) throw new Error('Indiquez l’élève concerné.');
  const { abs: _a, ...rest } = data;
  return store.update(mv.id, { ...rest, amount: SIGN[data.kind] * abs, yearId: store.get(data.accountId).yearId }, `Mouvement modifié : ${euros(abs)}`);
}
/** Supprime un mouvement (corbeille) ; une annulation liée part avec lui. */
export async function deleteMovement(mv) {
  const at = new Date().toISOString(); const ops = [{ id: mv.id, patch: { deletedAt: at } }];
  if (mv.reversedById && store.get(mv.reversedById)) ops.push({ id: mv.reversedById, patch: { deletedAt: at } });
  if (mv.correctsId && store.get(mv.correctsId)) ops.push({ id: mv.correctsId, patch: { reversedById: null } });
  return store.batch(ops, 'Mouvement supprimé');
}

/** Correction tracée : annule le mouvement par un mouvement inverse ; l'original reste visible. */
export async function reverse(mv, reason) {
  if (mv.reversedById) throw new Error('Ce mouvement est déjà annulé.');
  if (mv.correctsId) throw new Error('On n’annule pas une annulation : saisissez un nouveau mouvement.');
  const id = store.uid();
  await store.batch([
    { create: { type: 'movement', data: { id, accountId: mv.accountId, yearId: mv.yearId, date: model.todayIso(), amount: -mv.amount, kind: mv.kind, mode: mv.mode,
      label: `Annulation : ${mv.label || ''}${reason ? ` — ${reason}` : ''}`, projectId: mv.projectId, studentId: mv.studentId, stand: mv.stand, payer: mv.payer, fileIds: [],
      status: 'validé', correctsId: mv.id, reversedById: null } } },
    { id: mv.id, patch: { reversedById: id } },
  ], 'Mouvement annulé (correction tracée)');
  return id;
}

// ───── Projets (sortie, coopérative, kermesse, collecte, projet transdisciplinaire…)
export const projects = (yearId) => store.all('project').filter(p => !yearId || p.yearId === yearId).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
export function expectedFor(p, sid) {
  const o = p.overrides?.[sid];
  return o != null && o !== '' ? Number(o) : (Number(p.perStudent) || 0);
}
const sum = (list) => list.reduce((s, m) => s + m.amount, 0);

/** Situation d'un projet, calculée uniquement à partir des mouvements. */
export function projectStatus(p) {
  const mv = movements({ projectId: p.id });
  const fam = mv.filter(m => m.kind === 'versement' || m.kind === 'remboursement');
  const rows = (p.participants || []).map(sid => {
    const own = fam.filter(m => m.studentId === sid);
    const paid = sum(own);
    const expected = expectedFor(p, sid);
    return { sid, student: store.get(sid), expected, paid, rest: expected - paid, movements: own };
  });
  const expected = rows.reduce((s, r) => s + r.expected, 0);
  const received = sum(fam);
  const otherIncome = sum(mv.filter(m => m.kind === 'recette'));
  const expenses = sum(mv.filter(m => m.kind === 'dépense'));
  const stands = {};
  for (const m of mv.filter(x => x.kind === 'recette' && x.stand)) stands[m.stand] = (stands[m.stand] || 0) + m.amount;
  const budget = (p.budget || []).reduce((s, l) => s + (Number(l.amount) || 0), 0);
  return { rows, expected, received, rest: rows.reduce((s, r) => s + Math.max(0, r.rest), 0), overpaid: rows.reduce((s, r) => s + Math.max(0, -r.rest), 0),
    otherIncome, expenses, balance: received + otherIncome + expenses, stands, budget, movements: mv };
}
export const paymentsOfStudent = (sid) => movements({ studentId: sid });

/** Situation d'un élève pour un projet (utilisée par les listes et la fiche élève). */
export function studentInProject(p, sid) {
  const own = movements({ projectId: p.id, studentId: sid }).filter(m => m.kind === 'versement' || m.kind === 'remboursement');
  const paid = sum(own); const expected = expectedFor(p, sid);
  return { participant: (p.participants || []).includes(sid), expected, paid, rest: expected - paid };
}

// ───── Matériel : stocks, achats, prêts et retours
export const materials = () => store.all('material').sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
export const matMoves = (mid) => store.all('matmove').filter(m => m.materialId === mid).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || ''));
/** Stock = quantité initiale + entrées − sorties ; prêts en cours = prêtés non rendus. */
export function stockOf(mat) {
  const mv = matMoves(mat.id);
  const qty = (Number(mat.initial) || 0) + mv.reduce((s, m) => s + (m.kind === 'achat' || m.kind === 'entrée' ? +m.qty : m.kind === 'sortie' || m.kind === 'perte' ? -m.qty : 0), 0);
  const loans = mv.filter(m => m.kind === 'prêt' && !m.returnedAt);
  const lent = loans.reduce((s, m) => s + (+m.qty || 0), 0);
  return { qty, lent, available: qty - lent, loans, low: mat.threshold != null && mat.threshold !== '' && qty - lent <= Number(mat.threshold) };
}
