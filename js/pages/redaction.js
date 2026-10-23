// Organisation › Mots, autorisations et registres : petits générateurs de documents, sans IA ni connexion.
//  - Appréciations (phrases-types accordées, enregistrées dans les bilans de période)
//  - Mots aux familles et autorisations de sortie (avec coupon-réponse, un exemplaire par élève)
//  - Fiche de missions AESH, rapport d'incident, registre de soins : confidentiels.
import * as store from '../store.js';
import * as model from '../model.js';
import * as C from '../confidential.js';
import * as A from '../appreciations.js';
import * as FI from '../finance.js';
import { h, icon, toast, modal, field, confirmDialog, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs } from '../components.js';
import { printDocument, printTable } from '../print.js';

const TABS = [['appreciations', 'Appréciations'], ['mot', 'Mots et autorisations'], ['aesh', 'Missions AESH'], ['incident', 'Rapport d’incident'], ['soins', 'Registre de soins']];
let tab = 'mot';

export function render({ query, rerender }) {
  if (TABS.some(t => t[0] === query.t)) tab = query.t;
  const body = { appreciations: appreciationsTab, mot: motTab, aesh: aeshTab, incident: incidentTab, soins: soinsTab }[tab](query, rerender);
  return h('div', { class: 'page' },
    pageHeader('Mots, autorisations et registres', { favKey: 'organisation/redaction' }),
    subTabs(),
    h('div', { class: 'seg wrap', role: 'group', 'aria-label': 'Document' }, TABS.map(([k, l]) => h('a', { class: k === tab ? 'on seg-link' : 'seg-link', href: `#/redaction?t=${k}`, 'data-testid': `redac-tab-${k}` }, l))),
    body);
}

const fullName = (s) => `${s.firstName} ${s.lastName || ''}`.trim();
const classStudents = () => { const cls = model.currentClass(); return cls ? model.studentsOfClass(cls.id).map(x => x.student) : []; };
const frLong = (iso) => (iso ? model.frDate(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '……');

// ───────── Appréciations
export function appreciationDialog(s, { initial = '', onUse } = {}) {
  const st = { gender: s.gender || '', points: new Set(), advice: new Set(), aids: new Set(), free: { points: '', advice: '', aids: '' }, seed: 1, tone: 'complet' };
  const out = h('textarea', { rows: 5, 'data-testid': 'appr-out' }, initial);
  const gen = () => { out.value = A.compose({ firstName: s.firstName, gender: st.gender || 'm', points: [...st.points], advice: [...st.advice], aids: [...st.aids], free: st.free, seed: st.seed, tone: st.tone }); };
  const chips = (bank, set, cls) => h('div', { class: 'chips' }, bank.map(([id, label]) => h('label', { class: `chip ${cls}` }, h('input', { type: 'checkbox', 'data-testid': `appr-${cls}-${id}`, onchange: (e) => { e.target.checked ? set.add(id) : set.delete(id); gen(); } }), label)));
  const freeIn = (k, ph) => h('input', { placeholder: ph, oninput: (e) => { st.free[k] = e.target.value; gen(); } });
  const gender = h('select', { 'aria-label': 'Accord', 'data-testid': 'appr-gender', onchange: async (e) => { st.gender = e.target.value; gen(); await store.update(s.id, { gender: e.target.value }, `Accord pour ${s.firstName}`, { quiet: true }); } },
    h('option', { value: '' }, 'accord : à choisir'), h('option', { value: 'f', selected: st.gender === 'f' }, 'au féminin (elle)'), h('option', { value: 'm', selected: st.gender === 'm' }, 'au masculin (il)'));
  const body = h('div', { class: 'form appr' },
    h('div', { class: 'row' }, gender, h('select', { 'aria-label': 'Longueur', onchange: (e) => { st.tone = e.target.value; gen(); } }, h('option', { value: 'complet' }, 'complète'), h('option', { value: 'court' }, 'courte'))),
    h('h3', { class: 'appr-h appr-points' }, 'Éléments importants'), chips(A.POINTS, st.points, 'points'), freeIn('points', 'autre élément, en quelques mots'),
    h('h3', { class: 'appr-h appr-advice' }, 'Conseils (facultatif)'), chips(A.ADVICE, st.advice, 'advice'), freeIn('advice', 'autre conseil'),
    h('h3', { class: 'appr-h appr-aids' }, 'Aides (facultatif)'), chips(A.AIDS, st.aids, 'aids'), freeIn('aids', 'autre aide'),
    h('h3', {}, 'Proposition (modifiable)'), out,
    h('div', { class: 'row' }, h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'appr-other', onclick: () => { st.seed++; gen(); } }, 'Autre formulation'),
      h('span', { class: 'muted small' }, 'Phrases-types assemblées sur l’appareil : relisez et personnalisez, vous restez l’autrice.')));
  modal({ title: `Appréciation — ${s.firstName}`, wide: true, body, actions: [{ label: 'Annuler' },
    { label: 'Copier', onClick: async () => { try { await navigator.clipboard.writeText(out.value); toast('Copié'); } catch { out.select(); } return false; } },
    onUse ? { label: 'Utiliser ce texte', primary: true, testid: 'appr-use', onClick: () => onUse(out.value) } : null].filter(Boolean) });
}

function appreciationsTab() {
  const cls = model.currentClass();
  const students = classStudents();
  if (!cls) return emptyState('Choisissez une classe');
  const year = store.get(cls.yearId); const per = model.periodOfDate(year, model.todayIso()) || model.periodsOf(year)[0];
  return h('div', { class: 'stack' },
    h('p', { class: 'muted' }, 'Cochez quelques éléments, choisissez l’accord, et l’application propose une appréciation que vous modifiez. Le texte retenu va dans l’appréciation générale du bilan de la période (Ma classe › Livrets et bilans).'),
    per ? null : h('p', { class: 'card notice' }, 'Aucune période définie pour l’année : le texte pourra seulement être copié.'),
    students.length ? h('div', { class: 'dash' }, students.map(s => {
      const rep = per && store.all('report').find(r => r.classId === cls.id && r.periodId === per.id && r.studentId === s.id);
      return h('section', { class: 'card' }, h('h2', {}, fullName(s)), rep?.general ? h('p', { class: 'small' }, rep.general) : h('p', { class: 'muted small' }, 'Pas encore d’appréciation générale.'),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'appr-open', onclick: () => appreciationDialog(s, { initial: rep?.general || '', onUse: per ? async (text) => {
          const cur = store.all('report').find(r => r.classId === cls.id && r.periodId === per.id && r.studentId === s.id);
          if (cur) await store.update(cur.id, { general: text }, `Appréciation de ${s.firstName}`);
          else await store.create('report', { classId: cls.id, periodId: per.id, studentId: s.id, subjects: {}, general: text, status: 'brouillon' }, `Appréciation de ${s.firstName}`);
          toast('Appréciation enregistrée dans le bilan de la période');
        } : null }) }, 'Rédiger'));
    })) : emptyState('Aucun élève'));
}

// ───────── Mots aux familles et autorisations
export const MODELES = {
  sortie: { label: 'Autorisation de sortie scolaire', fields: ['date', 'heure', 'retour', 'lieu', 'objet', 'transport', 'encadrement', 'prevoir', 'cout', 'limite'],
    text: (f) => `Madame, Monsieur,\n\nDans le cadre de nos apprentissages, la classe se rendra ${f.lieu ? 'à ' + f.lieu : '……'} le ${frLong(f.date)}${f.objet ? ' pour ' + f.objet : ''}.\nDépart : ${f.heure || '……'} — retour prévu : ${f.retour || '……'}.${f.transport ? `\nTransport : ${f.transport}.` : ''}${f.encadrement ? `\nEncadrement : ${f.encadrement}.` : ''}${f.prevoir ? `\nÀ prévoir : ${f.prevoir}.` : ''}${f.cout ? `\nParticipation demandée : ${f.cout}.` : ''}\n\nMerci de compléter et de rapporter le coupon ci-dessous ${f.limite ? 'avant le ' + frLong(f.limite) : 'au plus vite'}.`,
    coupon: (f) => `Je soussigné(e) ……………………………………, responsable légal(e) de l’élève {ELEVE},\n☐ autorise  ☐ n’autorise pas mon enfant à participer à la sortie du ${frLong(f.date)}${f.lieu ? ' à ' + f.lieu : ''}.\nTéléphone joignable ce jour-là : ……………………\nDate et signature :` },
  reunion: { label: 'Invitation à une réunion', fields: ['date', 'heure', 'lieu', 'objet', 'limite'],
    text: (f) => `Madame, Monsieur,\n\nVous êtes invités à une réunion ${f.objet ? 'au sujet de : ' + f.objet : 'd’information'}, le ${frLong(f.date)} à ${f.heure || '……'}${f.lieu ? ', ' + f.lieu : ''}.\nVotre présence est importante pour bien accompagner votre enfant.`,
    coupon: (f) => `Famille de {ELEVE} :  ☐ sera présente  ☐ ne pourra pas être présente à la réunion du ${frLong(f.date)}.\nSignature :` },
  rappel: { label: 'Rappel', fields: ['objet', 'limite'],
    text: (f) => `Madame, Monsieur,\n\nNous vous rappelons : ${f.objet || '……'}${f.limite ? ` (avant le ${frLong(f.limite)})` : ''}.\nMerci de votre attention.` },
  materiel: { label: 'Matériel à prévoir', fields: ['date', 'prevoir', 'objet'],
    text: (f) => `Madame, Monsieur,\n\n${f.date ? `Pour le ${frLong(f.date)}` : 'Prochainement'}${f.objet ? ` (${f.objet})` : ''}, votre enfant aura besoin de : ${f.prevoir || '……'}.\nMerci !` },
  info: { label: 'Information', fields: ['objet', 'date'],
    text: (f) => `Madame, Monsieur,\n\n${f.objet || 'Information : ……'}${f.date ? `\nDate : ${frLong(f.date)}.` : ''}` },
  rdv: { label: 'Demande de rendez-vous', fields: ['objet', 'limite'],
    text: (f) => `Madame, Monsieur,\n\nJe souhaiterais vous rencontrer${f.objet ? ' au sujet de ' + f.objet : ''}. Pouvez-vous m’indiquer vos disponibilités${f.limite ? ' avant le ' + frLong(f.limite) : ''} ?`,
    coupon: () => 'Famille de {ELEVE} — disponibilités proposées :\n……………………………………………………………………\nSignature :' },
};
const FIELD_LABELS = { date: ['Date', 'date'], heure: ['Heure (départ)', 'time'], retour: ['Heure de retour', 'time'], lieu: ['Lieu', 'text'], objet: ['Objet / activité', 'text'], transport: ['Transport', 'text'], encadrement: ['Encadrement', 'text'], prevoir: ['À prévoir', 'text'], cout: ['Coût', 'text'], limite: ['Réponse avant le', 'date'] };
const mot = { modele: 'sortie', f: {}, text: '', coupon: '', signature: '', perPage: 2, perStudent: true, projectId: '' };

export function motPages(m, students) {
  const sig = m.signature || store.getSettings().userName || '';
  const copies = m.perStudent && students.length ? students.map(s => s.firstName + ' ' + (s.lastName || '')) : Array.from({ length: m.perPage }, () => '……………………');
  const slip = (name) => h('div', { class: 'mot-slip' },
    h('div', { class: 'mot-text' }, m.text.split('\n').map(l => h('p', {}, l || ' '))),
    sig ? h('p', { class: 'mot-sig' }, sig) : null,
    m.coupon ? h('div', { class: 'mot-coupon' }, h('p', { class: 'cut' }, '✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -'), m.coupon.replace(/\{ELEVE\}/g, name).split('\n').map(l => h('p', {}, l))) : null);
  const pages = [];
  for (let i = 0; i < copies.length; i += m.perPage) pages.push(h('div', { class: `mot-page per-${m.perPage}` }, copies.slice(i, i + m.perPage).map(slip)));
  return h('div', { class: 'print-doc' }, pages);
}

function motTab(query, rerender) {
  if (query.modele && MODELES[query.modele] && query.projet !== mot._fromProject) {
    mot.modele = query.modele; mot._fromProject = query.projet || null;
    const p = query.projet && store.get(query.projet);
    if (p) { mot.projectId = p.id; mot.f = { ...mot.f, date: p.date || '', objet: p.title, cout: p.perStudent ? FI.euros(p.perStudent) : '' }; }
    mot.text = ''; mot.coupon = '';
  }
  const M = MODELES[mot.modele];
  const ta = h('textarea', { rows: 10, 'data-testid': 'mot-text', oninput: (e) => { mot.text = e.target.value; mot.edited = true; } });
  const co = h('textarea', { rows: 4, 'data-testid': 'mot-coupon', oninput: (e) => { mot.coupon = e.target.value; mot.edited = true; } });
  const regen = () => { mot.text = M.text(mot.f); mot.coupon = M.coupon ? M.coupon(mot.f) : ''; ta.value = mot.text; co.value = mot.coupon; mot.edited = false; };
  if (!mot.text) regen(); else { ta.value = mot.text; co.value = mot.coupon; }
  const fieldsBox = h('div', { class: 'grid-2' }, M.fields.map(k => { const [label, type] = FIELD_LABELS[k];
    return field(label, h('input', { type, value: mot.f[k] || '', 'data-testid': `mot-${k}`, oninput: (e) => { mot.f[k] = e.target.value; if (!mot.edited) regen(); } })); }));
  const students = classStudents();
  const cls = model.currentClass();
  const projs = cls ? FI.projects(cls.yearId) : [];
  const save = async () => {
    await store.create('familynote', { classId: cls?.id || null, modele: mot.modele, title: `${M.label}${mot.f.objet ? ' — ' + mot.f.objet : ''}`, fields: { ...mot.f }, text: mot.text, coupon: mot.coupon, projectId: mot.projectId || null, date: model.todayIso() }, `Mot « ${M.label} » enregistré`);
    toast('Mot enregistré dans l’historique');
  };
  const history = store.all('familynote').filter(n => !cls || n.classId === cls.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return h('div', { class: 'grid-2 mot' },
    h('section', { class: 'card stack' },
      field('Modèle', h('select', { 'data-testid': 'mot-modele', onchange: (e) => { mot.modele = e.target.value; mot.text = ''; mot.edited = false; rerender(); } }, Object.entries(MODELES).map(([k, v]) => h('option', { value: k, selected: k === mot.modele }, v.label)))),
      projs.length ? field('Remplir depuis un projet (facultatif)', h('select', { onchange: (e) => { const p = store.get(e.target.value); mot.projectId = e.target.value; if (p) { mot.f = { ...mot.f, date: p.date || mot.f.date, objet: p.title, cout: p.perStudent ? FI.euros(p.perStudent) : mot.f.cout }; mot.text = ''; rerender(); } } },
        h('option', { value: '' }, '—'), projs.map(p => h('option', { value: p.id, selected: mot.projectId === p.id }, p.title)))) : null,
      fieldsBox,
      field('Signature', h('input', { value: mot.signature || store.getSettings().userName || '', placeholder: 'ex. Mme Martin, enseignante de CE2', oninput: (e) => { mot.signature = e.target.value; } })),
      h('h3', {}, 'Texte (modifiable)'), ta,
      M.coupon ? [h('h3', {}, 'Coupon-réponse ({ELEVE} = nom de l’élève)'), co] : null,
      h('button', { class: 'btn btn-small', type: 'button', onclick: regen }, 'Régénérer à partir des champs')),
    h('section', { class: 'card stack' }, h('h2', {}, 'Impression'),
      h('label', { class: 'inline' }, 'Par page', h('select', { onchange: (e) => { mot.perPage = Number(e.target.value); } }, [1, 2, 3].map(n => h('option', { value: n, selected: mot.perPage === n }, String(n))))),
      h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: mot.perStudent, 'data-testid': 'mot-per-student', onchange: (e) => { mot.perStudent = e.target.checked; } }), `Un exemplaire par élève, nom prérempli (${students.length})`),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'mot-print', onclick: () => printDocument(motPages(mot, students)) }, icon('print', 16), 'Imprimer'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'mot-save', onclick: save }, 'Enregistrer dans l’historique')),
      mot.modele === 'sortie' ? h('p', { class: 'muted small' }, 'Le suivi des coupons rendus se fait dans Ma classe › Listes (colonne liée « Autorisation pour les sorties scolaires ») ou dans Informations élèves.') : null,
      h('h3', {}, 'Historique'),
      history.length ? h('ul', { class: 'plain' }, history.slice(0, 15).map(n => h('li', {}, `${model.frShort(n.date)} · ${n.title} `,
        h('button', { class: 'btn btn-link small', type: 'button', onclick: () => { Object.assign(mot, { modele: n.modele, f: { ...n.fields }, text: n.text, coupon: n.coupon, edited: true }); rerender(); } }, 'reprendre')))) : h('p', { class: 'muted small' }, 'Aucun mot enregistré.')));
}

// ───────── Fiche de missions AESH (confidentielle)
export const AESH_MISSIONS = {
  'Apprentissages': ['reformuler et expliciter les consignes', 'aider à la prise de notes / écrire sous la dictée', 'aider à organiser le travail et le matériel', 'soutenir l’attention et la concentration', 'utiliser les outils et supports adaptés'],
  'Autonomie et vie de classe': ['aider aux déplacements', 'accompagner aux toilettes / hygiène', 'aider à l’habillage', 'accompagner la prise des repas', 'faciliter les relations avec les camarades'],
  'Communication': ['faire le lien avec l’enseignante sur les observations', 'participer aux réunions d’équipe de suivi (ESS)'],
};
function aeshTab(query, rerender) {
  return C.gate(() => {
    const sheets = store.all('aeshsheet').sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const cur = sheets.find(s => s.id === query.id) || null;
    if (!cur) return h('div', { class: 'stack' },
      h('p', { class: 'muted' }, 'Une fiche claire pour l’AESH : élève(s) accompagné(s), horaires, missions par moment de la journée, ce qui est attendu et ce qui ne l’est pas.'),
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'aesh-new', onclick: async () => { const r = await store.create('aeshsheet', { name: '', students: '', schedule: '', missions: [], autres: '', eviter: '', contacts: '', sensitive: true }, 'Fiche AESH'); location.hash = `#/redaction?t=aesh&id=${r.id}`; } }, '+ Nouvelle fiche'),
      sheets.length ? h('ul', { class: 'plain' }, sheets.map(s => h('li', {}, h('a', { href: `#/redaction?t=aesh&id=${s.id}` }, `${s.name || 'AESH'} — ${s.students || 'élève(s) à préciser'}`)))) : null);
    const up = (patch) => store.update(cur.id, patch, 'Fiche AESH', { quiet: true });
    const inp = (k, label, rows = 0) => field(label, rows ? h('textarea', { rows, onchange: (e) => up({ [k]: e.target.value }) }, cur[k] || '') : h('input', { value: cur[k] || '', 'data-testid': `aesh-${k}`, onchange: (e) => up({ [k]: e.target.value }) }));
    const set = new Set(cur.missions || []);
    const print = () => printDocument(h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, 'Fiche de missions AESH'), h('p', {}, `${store.get(cur.id).name || ''} · ${model.currentClass()?.name || ''}`)),
      ...[['Élève(s) accompagné(s)', 'students'], ['Horaires et temps d’accompagnement', 'schedule']].map(([l, k]) => [h('h2', {}, l), h('p', { class: 'pre' }, store.get(cur.id)[k] || '—')]),
      h('h2', {}, 'Missions'), Object.entries(AESH_MISSIONS).map(([g, ms]) => { const on = ms.filter(m => (store.get(cur.id).missions || []).includes(m)); return on.length ? [h('h3', {}, g), h('ul', {}, on.map(m => h('li', {}, m)))] : null; }),
      ...[['Autres missions / précisions', 'autres'], ['Ce qui n’est pas attendu', 'eviter'], ['Contacts utiles', 'contacts']].map(([l, k]) => store.get(cur.id)[k] ? [h('h2', {}, l), h('p', { class: 'pre' }, store.get(cur.id)[k])] : null)));
    return h('div', { class: 'stack' }, h('a', { href: '#/redaction?t=aesh' }, '‹ Toutes les fiches'),
      h('section', { class: 'card form' }, inp('name', 'AESH (nom ou prénom)'), inp('students', 'Élève(s) accompagné(s) (prénom ou initiales)'), inp('schedule', 'Horaires et temps d’accompagnement', 3),
        h('h3', {}, 'Missions'), Object.entries(AESH_MISSIONS).map(([g, ms]) => h('div', {}, h('strong', {}, g), h('div', { class: 'chips' }, ms.map(m => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: set.has(m), onchange: (e) => { e.target.checked ? set.add(m) : set.delete(m); up({ missions: [...set] }); } }), m))))),
        inp('autres', 'Autres missions / précisions', 3), inp('eviter', 'Ce qui n’est pas attendu (ex. faire à la place de l’élève)', 2), inp('contacts', 'Contacts utiles (enseignant référent, coordinatrice PIAL…)', 2)),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'aesh-print', onclick: print }, icon('print', 16), 'Imprimer'),
        h('button', { class: 'btn btn-danger', type: 'button', onclick: async () => { if (await confirmDialog('Supprimer la fiche ?', 'Elle ira dans la corbeille.', { danger: true, confirmLabel: 'Supprimer' })) { await store.remove(cur.id, 'Fiche AESH supprimée'); location.hash = '#/redaction?t=aesh'; } } }, 'Supprimer')));
  }, rerender);
}

// ───────── Rapport d'incident (confidentiel)
export const SUBJECTIVE = ['méchant', 'méchante', 'insupportable', 'toujours', 'jamais', 'agressif', 'agressive', 'violent', 'violente', 'menteur', 'menteuse', 'pénible', 'terrible', 'horrible', 'nul', 'nulle', 'exprès', 'provoque', 'insolent', 'insolente', 'caractériel', 'fou', 'folle', 'je pense que', 'il paraît'];
/** Mots qui relèvent du jugement plutôt que des faits. */
export function subjectiveWords(text) { const t = ` ${String(text || '').toLowerCase()} `; return SUBJECTIVE.filter(w => new RegExp(`[^\\p{L}]${w}[^\\p{L}]`, 'u').test(t)); }
/** Remplace les prénoms et noms des élèves de la classe par leurs initiales. */
export function anonymize(text, students) {
  let t = String(text || '');
  for (const s of students) {
    const ini = `${(s.firstName || '?')[0]}.${s.lastName ? (s.lastName[0] + '.') : ''}`;
    for (const n of [fullName(s), `${s.lastName || ''} ${s.firstName}`.trim(), s.firstName].filter(x => x && x.length > 1)) t = t.replace(new RegExp(`(^|[^\\p{L}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^\\p{L}]|$)`, 'gu'), `$1${ini}`);
  }
  return t;
}
function incidentTab(query, rerender) {
  return C.gate(() => {
    const list = store.all('incident').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const cur = list.find(x => x.id === query.id);
    if (!cur) return h('div', { class: 'stack' },
      h('p', { class: 'muted' }, 'Un rapport factuel : date, lieu, personnes (initiales), faits observés, mesures prises, personnes informées. L’application signale les mots de jugement et remplace les noms des élèves par leurs initiales.'),
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'incident-new', onclick: async () => { const r = await store.create('incident', { date: model.todayIso(), time: '', place: '', people: '', facts: '', measures: '', informed: '', sensitive: true }, 'Rapport d’incident'); location.hash = `#/redaction?t=incident&id=${r.id}`; } }, '+ Nouveau rapport'),
      list.length ? h('ul', { class: 'plain' }, list.map(x => h('li', {}, h('a', { href: `#/redaction?t=incident&id=${x.id}` }, `${model.frShort(x.date)} — ${x.place || 'lieu à préciser'}`)))) : null);
    const students = classStudents();
    const warn = h('div', { 'data-testid': 'incident-warn' });
    const check = (text) => { const w = subjectiveWords(text); warn.replaceChildren(w.length ? h('p', { class: 'card notice small' }, `Mots qui expriment un jugement plutôt qu’un fait : ${w.join(', ')}. Décrivez plutôt ce qui a été vu et entendu (gestes, paroles exactes entre guillemets, heure).`) : null); };
    const up = (patch) => store.update(cur.id, patch, 'Rapport d’incident', { quiet: true });
    const ta = (k, label, rows) => { const el = h('textarea', { rows, 'data-testid': `incident-${k}`, oninput: (e) => { if (k === 'facts') check(e.target.value); }, onchange: (e) => up({ [k]: e.target.value }) }, cur[k] || ''); return field(label, el); };
    check(cur.facts);
    const doc = () => { const r = store.get(cur.id); return h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, 'Rapport d’incident'), h('p', {}, `${model.currentClass()?.name || ''} — rédigé le ${model.frShort(model.todayIso())}`)),
      h('table', { class: 'print-table' }, h('tbody', {}, [['Date et heure', `${model.frDate(r.date)} ${r.time || ''}`], ['Lieu', r.place], ['Personnes concernées', r.people], ['Faits observés', r.facts], ['Mesures prises', r.measures], ['Personnes informées', r.informed]].map(([l, v]) => h('tr', {}, h('th', { style: { width: '28%' } }, l), h('td', { class: 'pre' }, v || '')))))
      , h('p', { class: 'print-foot' }, 'Signature :')); };
    return h('div', { class: 'stack' }, h('a', { href: '#/redaction?t=incident' }, '‹ Tous les rapports'),
      h('section', { class: 'card form' },
        h('div', { class: 'grid-2' }, field('Date', h('input', { type: 'date', value: cur.date, onchange: (e) => up({ date: e.target.value }) })), field('Heure', h('input', { type: 'time', value: cur.time || '', onchange: (e) => up({ time: e.target.value }) }))),
        field('Lieu', h('input', { value: cur.place || '', placeholder: 'cour, classe, couloir, cantine…', onchange: (e) => up({ place: e.target.value }) })),
        ta('people', 'Personnes concernées et témoins (initiales)', 2), ta('facts', 'Faits observés (ce qui a été vu et entendu, dans l’ordre)', 6), warn,
        ta('measures', 'Mesures prises (soins, mise à l’écart, échange avec les élèves…)', 3), ta('informed', 'Personnes informées (direction, familles…) et quand', 2)),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', 'data-testid': 'incident-anon', onclick: async () => { const r = store.get(cur.id); const patch = {}; for (const k of ['people', 'facts', 'measures', 'informed']) patch[k] = anonymize(r[k], students); await store.update(cur.id, patch, 'Noms remplacés par les initiales'); toast('Noms des élèves remplacés par leurs initiales'); rerender(); } }, 'Remplacer les noms par les initiales'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => printDocument(doc()) }, icon('print', 16), 'Imprimer'),
        h('button', { class: 'btn btn-danger', type: 'button', onclick: async () => { if (await confirmDialog('Supprimer le rapport ?', 'Il ira dans la corbeille.', { danger: true, confirmLabel: 'Supprimer' })) { await store.remove(cur.id, 'Rapport supprimé'); location.hash = '#/redaction?t=incident'; } } }, 'Supprimer')));
  }, rerender);
}

// ───────── Registre de soins (confidentiel : données de santé)
export const SOIN_KINDS = ['écorchure', 'chute / choc', 'saignement de nez', 'mal de tête', 'mal de ventre', 'piqûre d’insecte', 'autre'];
function soinsTab(query, rerender) {
  return C.gate(() => {
    const cls = model.currentClass();
    const students = classStudents();
    const list = store.all('soin').filter(x => !cls || x.classId === cls.id).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
    const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
      h('div', { class: 'grid-2' },
        field('Date', h('input', { type: 'date', name: 'date', value: model.todayIso() })),
        field('Heure', h('input', { type: 'time', name: 'time', value: new Date().toTimeString().slice(0, 5) })),
        field('Élève', h('select', { name: 'studentId', 'data-testid': 'soin-student' }, students.map(s => h('option', { value: s.id }, fullName(s))))),
        field('Nature', h('select', { name: 'kind' }, SOIN_KINDS.map(k => h('option', { value: k }, k))))),
      field('Soin apporté', h('input', { name: 'care', 'data-testid': 'soin-care', placeholder: 'ex. nettoyage à l’eau et au savon, pansement' })),
      h('div', { class: 'grid-2' }, field('Par', h('input', { name: 'by', value: store.getSettings().userName || '' })), field('Famille prévenue', h('select', { name: 'family' }, ['non', 'mot dans le cahier', 'téléphone', 'à la sortie'].map(x => h('option', { value: x }, x))))),
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'soin-add', onclick: async () => {
        const d = Object.fromEntries(new FormData(form)); if (!d.studentId) return;
        await store.create('soin', { ...d, classId: cls?.id || null, sensitive: true }, 'Soin noté au registre');
        toast('Soin noté'); rerender();
      } }, '+ Noter le soin'));
    const rows = list.map(x => [`${model.frShort(x.date)} ${x.time || ''}`, fullName(store.get(x.studentId) || { firstName: '?' }), x.kind, x.care, x.by, x.family]);
    const cols = [{ label: 'Date et heure', width: '15%' }, { label: 'Élève', width: '18%' }, { label: 'Nature', width: '14%' }, { label: 'Soin apporté' }, { label: 'Par', width: '12%' }, { label: 'Famille prévenue', width: '13%' }];
    return h('div', { class: 'stack' },
      h('p', { class: 'muted' }, 'Registre des soins et incidents mineurs. Données de santé : masquées par défaut, jamais projetées ni indexées dans la recherche. En cas de doute sur un soin, suivez le protocole de l’école et prévenez la famille.'),
      h('section', { class: 'card' }, h('h2', {}, 'Nouveau soin'), form),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => printDocument(printTable({ title: 'Registre de soins', subtitle: cls?.name || '', columns: cols, rows }), { orientation: 'landscape' }) }, icon('print', 16), 'Imprimer le registre'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'soin-blank', onclick: () => printDocument(printTable({ title: 'Registre de soins', subtitle: `${cls?.name || ''} — à remplir`, columns: cols, rows: Array.from({ length: 22 }, () => ['', '', '', '', '', '']) }), { orientation: 'landscape' }) }, 'Imprimer un registre vierge')),
      h('section', { class: 'card' }, list.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table', 'data-testid': 'soin-table' },
        h('thead', {}, h('tr', {}, cols.map(c => h('th', {}, c.label)), h('th', {}, ''))),
        h('tbody', {}, list.map((x, i) => h('tr', {}, rows[i].map(v => h('td', {}, v || '')), h('td', {}, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Supprimer', onclick: async () => { await store.remove(x.id, 'Soin retiré du registre'); rerender(); } }, icon('trash', 14)))))))) : h('p', { class: 'muted' }, 'Aucun soin noté.')));
  }, rerender);
}
