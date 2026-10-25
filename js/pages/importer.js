// Préparer › Importer un tableau : CSV (Excel, LibreOffice, Google Sheets) → programmation, progression,
// séquences et séances, cahier journal, reliés à ce qui existe déjà. Aperçu ligne par ligne avant tout import.
import * as model from '../model.js';
import * as IC from '../importcsv.js';
import { h, icon, toast, pickFiles, download, badge } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';

const st = { kind: 'progression', text: '' };

export function render({ query, rerender }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return h('div', { class: 'page' }, pageHeader('Importer un tableau'), subTabs(), miss);
  if (IC.KINDS[query.k]) st.kind = query.k;
  const preview = h('div', { 'data-testid': 'import-preview' });
  let res = { rows: [] };
  const ta = h('textarea', { rows: 8, 'data-testid': 'import-text', placeholder: `${IC.KINDS[st.kind].cols.join(';')}\n…`, oninput: (e) => { st.text = e.target.value; draw(); } }, st.text);
  const go = h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'import-go', disabled: true, onclick: async () => {
    go.disabled = true;
    try { const r = await IC.importRows(st.kind, res.rows, cls); toast(`Import terminé : ${r.created} ligne(s) ajoutée(s)${r.linked ? `, ${r.linked} lien(s) vers l’existant` : ''}${r.skipped ? `, ${r.skipped} créneau(x) déjà rempli(s) laissé(s) tel(s) quel(s)` : ''}${r.unassigned ? '. Toutes les périodes ont déjà un EDT : associez le nouvel EDT aux périodes voulues dans Planifier › Emploi du temps' : r.periods ? `, EDT posé sur ${r.periods} période(s)` : ''}${r.versions ? `, ${r.versions} changement(s) d’EDT daté(s)` : ''}${r.moved ? ` (ces périodes ont été retirées de ${r.moved} ancien(s) EDT, conservé(s))` : ''}. Annulable.`, { action: 'Annuler', onAction: () => import('../store.js').then(s => s.undo()), timeout: 12000 }); st.text = ''; rerender(); }
    catch (e) { toast(e.message, { kind: 'error' }); go.disabled = false; }
  } }, 'Importer les lignes valides');
  function draw() {
    res = st.text.trim() ? IC.analyse(st.kind, st.text, cls) : { rows: [] };
    const okN = res.rows.filter(r => r.ok).length, bad = res.rows.filter(r => !r.ok);
    go.disabled = !okN; go.textContent = okN ? `Importer ${okN} ligne(s) valide(s)` : 'Importer les lignes valides';
    preview.replaceChildren(!res.rows.length ? h('p', { class: 'muted' }, 'Collez un tableau ou choisissez un fichier : l’aperçu apparaît ici.') : h('div', { class: 'stack' },
      h('p', {}, badge(`${okN} ligne(s) valide(s)`, 'ok'), ' ', bad.length ? badge(`${bad.length} ligne(s) à corriger`, 'warn') : null),
      bad.length ? h('ul', { class: 'small', 'data-testid': 'import-errors' }, bad.slice(0, 30).map(r => h('li', {}, `Ligne ${r.line} : ${r.msg.join(', ')}`))) : null,
      h('div', { class: 'table-wrap' }, h('table', { class: 'table small' }, h('tbody', {}, res.rows.slice(0, 200).map(r => h('tr', { class: r.ok ? '' : 'row-warn' }, h('td', {}, String(r.line)), Object.values(r.data).filter(v => typeof v !== 'object').slice(0, 7).map(v => h('td', {}, v == null ? '' : String(v))))))))));
  }
  draw();
  const k = IC.KINDS[st.kind];
  return h('div', { class: 'page' },
    pageHeader('Importer un tableau', { favKey: 'preparer/importer', subtitle: cls.name }),
    subTabs(),
    h('p', { class: 'muted' }, 'Préparez vos documents dans un tableur (Excel, LibreOffice, Google Sheets), enregistrez-les en CSV, puis importez-les ici. Tout est relié : les séquences et séances sont retrouvées par leur titre (ou créées), les séances datées se posent dans les créneaux de l’emploi du temps, les compétences sont retrouvées dans vos référentiels par leur code ou leur intitulé exact.'),
    h('div', { class: 'seg wrap', role: 'group', 'aria-label': 'Type' }, Object.entries(IC.KINDS).map(([key, v]) => h('a', { class: key === st.kind ? 'on seg-link' : 'seg-link', href: `#/importer?k=${key}`, 'data-testid': `import-kind-${key}`, onclick: () => { st.text = ''; } }, v.label))),
    h('section', { class: 'card stack' },
      h('h2', {}, k.label),
      h('p', { class: 'small' }, 'Colonnes, dans cet ordre (la première ligne peut porter ces titres) : ', h('strong', {}, k.cols.join(' ; '))),
      st.kind === 'cahier' ? h('p', { class: 'muted small' }, 'Une séance tombant sur un créneau de l’EDT (même date, même heure de début) remplit ce créneau ; sinon elle s’ajoute comme activité. Un créneau déjà rempli n’est jamais écrasé. Statut : prévue, faite, partielle ou annulée.') : null,
      st.kind === 'edt' ? h('p', { class: 'muted small' }, 'Une ligne par créneau de la semaine type. Jour : lundi, mardi… ; heures : 08:30 ou 8h30 ; Niveaux : vide pour toute la classe, sinon CE1, CE2… ; Mode (facultatif) : dirigé, autonomie, atelier dirigé, atelier autonome, rituel, intervention. Période (facultatif) : P1, P2, P3-P4… ; un nouvel emploi du temps est créé pour ces périodes (les anciens EDT sont conservés mais ne s’appliquent plus à ces périodes). Sans période : il est posé sur les périodes qui n’en ont pas encore. « À partir du » (facultatif, JJ/MM/AAAA) : changement d’EDT en cours de période (piscine, intervenant…), les journées d’avant ne changent pas.') : null,
      st.kind === 'programmation' ? h('p', { class: 'muted small' }, 'Les notions s’ajoutent à la programmation de la même discipline et du même niveau (créée si besoin). Importez ensuite la progression : ses lignes se relient aux notions, et l’état de chaque notion (prévue, commencée, terminée) se déduit de ce qui est fait dans le cahier journal.') : null,
      st.kind === 'progression' ? h('p', { class: 'muted small' }, 'Semaine = numéro de la semaine dans la période (1, 2, 3…). Les lignes s’ajoutent à la progression existante de la même discipline, niveau, période et sous-domaine, ou en créent une. Sous-domaine (facultatif) : un mot de l’intitulé des créneaux de l’EDT (ex. « Géométrie », « Picot », « Poésie ») ; le pré-remplissage du cahier journal place alors ces séances dans les créneaux dont l’intitulé contient ce mot. Notions (facultatif) : intitulés des notions de la programmation, séparés par « ; » (sinon une séquence qui porte le même titre qu’une notion y est reliée) : l’avancement de la programmation se calcule alors tout seul.') : null,
      st.kind === 'sequences' ? h('p', { class: 'muted small' }, 'Déroulé (facultatif) : les phases séparées par « | », chacune sous la forme « 10 min Recherche : consigne… ». Les mots Mise en route, Recherche, Mise en commun, Entraînement, Bilan donnent le type de phase. Une séance déjà existante (même titre dans la même séquence) n’est pas modifiée.') : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', 'data-testid': 'import-model', onclick: () => download(`modele-${st.kind}.csv`, IC.modelCsv(st.kind), 'text/csv;charset=utf-8') }, icon('download', 16), 'Télécharger le modèle'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'import-file', onclick: async () => { const [f] = await pickFiles({ accept: '.csv,.txt,text/csv', multiple: false }); if (f) { st.text = await f.text(); ta.value = st.text; draw(); } } }, icon('upload', 16), 'Choisir un fichier CSV')),
      ta, preview, h('div', { class: 'row' }, go)));
}
