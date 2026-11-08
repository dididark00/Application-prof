// Attestations suivies à l'école (savoir rouler à vélo, aisance aquatique / savoir nager, APER, premiers secours…) :
// un tableau de suivi par attestation (élèves × étapes), « obtenue » quand toutes les étapes sont acquises,
// impression du tableau et des attestations individuelles. Les étapes proposées sont modifiables :
// vérifiez-les sur la grille de votre circonscription.
import * as store from '../store.js';
import * as model from '../model.js';
import { h, icon, toast, modal, field, badge, emptyState, confirmDialog } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { printDocument } from '../print.js';

export const TEMPLATES = [
  { key: 'srav', title: 'Savoir rouler à vélo (SRAV)', items: ['Bloc 1 — Savoir pédaler (maîtriser son vélo, hors circulation)', 'Bloc 2 — Savoir circuler (en milieu sécurisé, règles et panneaux)', 'Bloc 3 — Savoir rouler à vélo (en circulation réelle, accompagné)'] },
  { key: 'aisance', title: 'Aisance aquatique', items: ['Entrer dans l’eau en sautant', 'Flotter sur le dos quelques secondes', 'Se déplacer sur quelques mètres', 'S’immerger et ouvrir les yeux sous l’eau', 'Sortir de l’eau seul'] },
  { key: 'asns', title: 'Attestation du savoir nager en sécurité (ASNS)', items: ['Entrer dans l’eau en chute arrière', 'Se déplacer sous l’eau', 'Flotter (sustentation) quelques secondes', 'Nager en continu sur la distance prévue', 'Connaître les règles de sécurité au bord de l’eau'] },
  { key: 'aper', title: 'Attestation de première éducation à la route (APER)', items: ['Piéton : se déplacer et traverser en sécurité', 'Passager : bon usage de la ceinture et du siège, monter et descendre d’un véhicule', 'Rouleur (vélo, trottinette, rollers) : s’équiper et se déplacer en sécurité'] },
  { key: 'aps', title: 'Apprendre à porter secours (APS)', items: ['Protéger : repérer un danger et se protéger', 'Alerter : appeler le 15, 18 ou 112 et donner les informations utiles', 'Secourir : gestes adaptés à son âge (position d’attente, compresser une plaie…)'] },
];
const STATES = [['', 'à faire'], ['en cours', 'en cours'], ['acquis', 'acquis']];
const next = (v) => STATES[(STATES.findIndex(s => s[0] === (v || '')) + 1) % STATES.length][0];

export const attestationsOf = (classId) => store.all('attestation').filter(a => !a.deletedAt && a.classId === classId).sort((a, b) => (a.title || '').localeCompare(b.title || '', 'fr'));
/** Attestation obtenue par l'élève : toutes les étapes acquises (date de la dernière). */
export function obtained(a, sid) {
  const r = a.results?.[sid] || {};
  if (!a.items.length || !a.items.every(it => r[it.id]?.state === 'acquis')) return null;
  return a.items.map(it => r[it.id]?.date || '').sort().at(-1) || model.todayIso();
}

function addDialog(cls) {
  const used = new Set(attestationsOf(cls.id).map(a => a.key));
  const sel = h('select', { 'data-testid': 'att-template' }, TEMPLATES.filter(t => !used.has(t.key)).map(t => h('option', { value: t.key }, t.title)), h('option', { value: 'perso' }, 'Autre (personnalisée)…'));
  const title = h('input', { placeholder: 'ex. Ceinture de calcul mental', 'data-testid': 'att-title' });
  const items = h('textarea', { rows: 5, 'data-testid': 'att-items' });
  const sync = () => { const t = TEMPLATES.find(x => x.key === sel.value); title.value = t ? t.title : ''; items.value = t ? t.items.join('\n') : ''; };
  sel.addEventListener('change', sync); sync();
  modal({ title: 'Ajouter une attestation', wide: true, body: h('div', { class: 'form' }, field('Attestation', sel), field('Titre', title),
    field('Étapes (une par ligne)', items, 'Proposition modifiable : vérifiez les étapes sur la grille de votre circonscription.')),
  actions: [{ label: 'Annuler' }, { label: 'Ajouter', primary: true, testid: 'att-add-go', onClick: async () => {
    const list = items.value.split('\n').map(x => x.trim()).filter(Boolean);
    if (!title.value.trim() || !list.length) { toast('Donnez un titre et au moins une étape.'); return false; }
    await store.create('attestation', { classId: cls.id, key: sel.value === 'perso' ? `perso-${store.uid()}` : sel.value, title: title.value.trim(), items: list.map(label => ({ id: store.uid(), label })), results: {} }, `Attestation « ${title.value.trim()} »`);
  } }] });
}

function editDialog(a) {
  const title = h('input', { value: a.title });
  const items = h('textarea', { rows: 6 }, a.items.map(i => i.label).join('\n'));
  modal({ title: 'Modifier l’attestation', wide: true, body: h('div', { class: 'form' }, field('Titre', title), field('Étapes (une par ligne)', items, 'Les résultats des étapes conservées (même intitulé) sont gardés.')),
    actions: [{ label: 'Supprimer', danger: true, onClick: async () => { if (!await confirmDialog('Supprimer cette attestation ?', 'Le tableau de suivi part à la corbeille (restaurable).', { confirmLabel: 'Supprimer', danger: true })) return false; await store.remove(a.id, 'Attestation supprimée'); } },
      { label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
        const labels = items.value.split('\n').map(x => x.trim()).filter(Boolean);
        const kept = labels.map(label => a.items.find(i => i.label === label) || { id: store.uid(), label });
        await store.update(a.id, { title: title.value.trim() || a.title, items: kept }, 'Attestation modifiée');
      } }] });
}

function printAttestations(cls, a, students, which) {
  const year = store.get(cls.yearId);
  const table = h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, `Tableau de suivi — ${a.title}`), h('p', {}, `${cls.school || ''} · ${cls.name} · ${year?.label || ''}`)),
    h('table', { class: 'print-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Élève'), a.items.map(it => h('th', { class: 'small' }, it.label)), h('th', {}, 'Obtenue'))),
      h('tbody', {}, students.map(({ student: s }) => h('tr', {}, h('td', {}, `${s.firstName} ${s.lastName}`),
        a.items.map(it => { const v = a.results?.[s.id]?.[it.id]; return h('td', { class: 'center' }, v?.state === 'acquis' ? `✔ ${v.date ? model.frShort(v.date) : ''}` : v?.state === 'en cours' ? 'en cours' : ''); }),
        h('td', {}, obtained(a, s.id) ? model.frShort(obtained(a, s.id)) : ''))))));
  const certs = students.filter(({ student: s }) => obtained(a, s.id)).map(({ student: s }) => h('div', { class: 'page-break' }, h('div', { class: 'print-doc attest-cert' },
    h('p', { class: 'attest-school' }, `${cls.school || ''} — ${year?.label || ''}`),
    h('h1', {}, a.title),
    h('p', { class: 'attest-who' }, 'est délivrée à', h('br'), h('strong', {}, `${s.firstName} ${s.lastName}`), h('br'), `élève de ${cls.name}`),
    h('ul', {}, a.items.map(it => h('li', {}, `✔ ${it.label}`))),
    h('p', {}, `Fait le ${model.frDate(obtained(a, s.id))}.`),
    h('table', { class: 'print-table livret-sign' }, h('tbody', {}, h('tr', {}, ['L’enseignante', 'La direction'].map(t => h('td', {}, h('div', { class: 'livret-sign-label' }, t), h('div', { class: 'livret-sign-box' })))))))));
  if (which === 'certs' && !certs.length) return toast('Aucun élève n’a encore obtenu cette attestation.');
  printDocument(h('div', {}, which === 'certs' ? certs : table));
}

export function render({ rerender }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return h('div', { class: 'page' }, pageHeader('Attestations'), subTabs(), miss);
  const list = attestationsOf(cls.id);
  const students = model.studentsOfClass(cls.id);
  const setState = async (a, sid, itemId) => {
    const cur = structuredClone(store.get(a.id).results || {});
    const r = cur[sid] || {}; const v = next(r[itemId]?.state);
    r[itemId] = v ? { state: v, date: v === 'acquis' ? model.todayIso() : (r[itemId]?.date || '') } : { state: '' };
    cur[sid] = r;
    await store.update(a.id, { results: cur }, `${a.title} : ${store.get(sid)?.firstName || ''}`);
  };
  return h('div', { class: 'page' },
    pageHeader('Attestations', { favKey: 'classe/attestations', subtitle: cls.name, actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'att-add', onclick: () => addDialog(cls) }, icon('plus', 16), 'Ajouter une attestation')] }),
    subTabs(),
    h('p', { class: 'muted small' }, 'Un clic par case : à faire → en cours → acquis (daté). L’attestation est obtenue quand toutes les étapes sont acquises ; elle figure alors dans le livret (option « Attestations obtenues »).'),
    list.length ? list.map(a => {
      const n = students.filter(({ student: s }) => obtained(a, s.id)).length;
      return h('section', { class: 'card', 'data-testid': 'att-card' },
        h('div', { class: 'card-head' }, h('h2', {}, a.title, ' ', badge(`${n}/${students.length} obtenue(s)`, n === students.length && n ? 'ok' : 'muted')),
          h('span', { class: 'row' },
            h('button', { class: 'btn btn-small', type: 'button', onclick: () => printAttestations(cls, a, students, 'table') }, icon('print', 14), 'Tableau de suivi'),
            h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'att-certs', onclick: () => printAttestations(cls, a, students, 'certs') }, 'Attestations individuelles'),
            h('button', { class: 'btn btn-small', type: 'button', onclick: () => editDialog(a) }, 'Modifier'))),
        h('div', { class: 'table-wrap' }, h('table', { class: 'table att-grid no-cards' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Élève'), a.items.map(it => h('th', { class: 'att-item' }, it.label)), h('th', {}, 'Obtenue'))),
          h('tbody', {}, students.map(({ student: s }) => h('tr', {}, h('td', {}, s.firstName),
            a.items.map(it => { const v = a.results?.[s.id]?.[it.id] || {}; return h('td', { class: 'center' }, h('button', { type: 'button', class: `att-cell st-${(v.state || 'vide').replace(' ', '-')}`, 'data-testid': 'att-cell', 'aria-label': `${s.firstName} — ${it.label} : ${v.state || 'à faire'}`, title: v.date ? model.frShort(v.date) : '', onclick: () => setState(a, s.id, it.id) }, v.state === 'acquis' ? '✔' : v.state === 'en cours' ? '…' : '')); }),
            h('td', {}, obtained(a, s.id) ? badge(model.frShort(obtained(a, s.id)), 'ok') : null)))))));
    }) : emptyState('Aucune attestation suivie', 'Ajoutez « Savoir rouler à vélo », « Aisance aquatique », « APER », « Apprendre à porter secours »… ou une attestation personnalisée.'));
  void rerender;
}
