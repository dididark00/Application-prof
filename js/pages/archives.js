// Archivage des années terminées (Réglages › Années) et consultation d'une archive en lecture seule (#/archive).
import * as store from '../store.js';
import * as model from '../model.js';
import * as AR from '../archive.js';
import { h, icon, toast, modal, field, confirmDialog, badge, emptyState, pickFiles, download, formatSize } from '../ui.js';
import { pageHeader } from '../components.js';
import { printDocument, printTable } from '../print.js';

const TYPE_LABEL = { student: 'élèves', class: 'classes', enrollment: 'inscriptions', attendance: 'appels', occurrence: 'séances du cahier journal', evaluation: 'évaluations', report: 'bilans de période', observation: 'observations', studentdoc: 'documents et autorisations', homework: 'devoirs', movement: 'mouvements financiers', project: 'projets', publication: 'publications', exchange: 'échanges avec les familles', file: 'fichiers d’élèves', session: 'fiches de séance', sequence: 'séquences', programmation: 'programmations', progression: 'progressions' };

/** Assistant : créer l'archive, la vérifier, puis retirer l'année de l'appareil. */
export async function archiveDialog(y) {
  const s = store.getSettings();
  const body = h('div', { class: 'form stack', 'data-testid': 'archive-dialog' }, h('p', { class: 'muted' }, 'Calcul en cours…'));
  const m = modal({ title: `Archiver ${y.label} dans un fichier`, wide: true, body, actions: [{ label: 'Fermer' }] });
  const p = await AR.preview(y.id);
  const top = Object.entries(p.byType).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t, n]) => `${n} ${TYPE_LABEL[t] || t}`);
  const pw = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'facultatif, mais conseillé', 'data-testid': 'archive-password' });
  const step2 = h('div', { class: 'stack', hidden: true });
  let made = null;
  const makeBtn = h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'archive-make', onclick: async () => {
    makeBtn.disabled = true;
    try {
      made = await AR.build(y.id, pw.value);
      if (navigator.canShare?.({ files: [made.file] })) { try { await navigator.share({ files: [made.file], title: made.file.name }); } catch (e) { if (e.name !== 'AbortError') download(made.file.name, made.file); } }
      else download(made.file.name, made.file);
      step2.hidden = false; toast('Archive créée : rangez-la dans Nuage ou sur une clé, puis vérifiez-la ci-dessous.', { timeout: 9000 });
    } catch (e) { toast(e.message, { kind: 'error' }); } finally { makeBtn.disabled = false; }
  } }, icon('download', 16), 'Créer l’archive');
  const verifyPw = h('input', { type: 'password', autocomplete: 'off', placeholder: 'mot de passe de l’archive', 'aria-label': 'Mot de passe de l’archive' });
  const result = h('div', { 'data-testid': 'archive-verify-result' });
  step2.append(h('h3', {}, '2. Vérifier l’archive enregistrée'), h('p', { class: 'small' }, 'Choisissez le fichier là où vous l’avez rangé : l’application le relit entièrement avant d’autoriser le retrait.'),
    h('div', { class: 'row' }, verifyPw, h('button', { class: 'btn', type: 'button', 'data-testid': 'archive-verify', onclick: async () => {
      const [f] = await pickFiles({ accept: '.json,application/json', multiple: false }); if (!f) return;
      try {
        const v = await AR.read(f, verifyPw.value || pw.value);
        if (v.head.yearId !== y.id) throw new Error('Cette archive concerne une autre année.');
        result.replaceChildren(h('p', {}, badge('archive complète et lisible', 'ok'), ` ${v.head.counts.records} éléments, ${v.head.counts.blobs} fichier(s).`),
          h('button', { class: 'btn btn-danger', type: 'button', 'data-testid': 'archive-remove', onclick: async () => {
            if (!await confirmDialog(`Retirer ${y.label} de l’appareil ?`, 'L’année ne sera plus dans l’application : vous la consulterez en ouvrant l’archive (Réglages › Années › « Consulter une archive »). Si la synchronisation Nuage est active, elle sera aussi retirée de vos autres appareils. Gardez précieusement le fichier.', { confirmLabel: 'Retirer de l’appareil', danger: true })) return;
            try { const n = await AR.removeYear(y.id, v); toast(`${y.label} retirée : ${n} élément(s), place libérée.`, { kind: 'success' }); m.close(); }
            catch (e) { toast(e.message, { kind: 'error', timeout: 10000 }); }
          } }, 'Retirer l’année de l’appareil'));
      } catch (e) { result.replaceChildren(h('p', { class: 'warn-text' }, e.message)); }
    } }, 'Choisir le fichier à vérifier')), result);
  body.replaceChildren(
    h('p', {}, `Taille estimée : `, h('strong', { 'data-testid': 'archive-size' }, formatSize(p.bytes)), ` — ${p.records.length} éléments, ${p.blobIds.length} fichier(s) joint(s).`),
    h('p', { class: 'small' }, top.join(' · ')),
    p.kept.length ? h('ul', { class: 'small' }, p.kept.map(k => h('li', {}, k))) : null,
    h('p', { class: 'muted small' }, 'Restent dans l’application : référentiels, manuels, bibliothèque, contacts, fichiers et dossiers communs, jeux, étiquettes, réglages. Ce que vous avez repris pour la nouvelle année (programmations, séquences…) est déjà une copie indépendante.'),
    s.currentYearId === y.id ? h('p', { class: 'warn-text' }, 'C’est l’année affichée : choisissez d’abord l’année en cours dans le sélecteur.') : null,
    h('h3', {}, '1. Créer l’archive'),
    field('Mot de passe de l’archive', pw, 'Données d’élèves : protégez le fichier. Sans le mot de passe, l’archive sera illisible, même pour vous : notez-le.'),
    s.currentYearId === y.id ? null : makeBtn,
    step2);
}

// ───────── Consultation d'une archive (lecture seule, en mémoire)
let opened = null;
export function openArchiveDialog() {
  const pw = h('input', { type: 'password', autocomplete: 'off', 'aria-label': 'Mot de passe', placeholder: 'si l’archive est protégée' });
  modal({ title: 'Consulter une archive', body: h('div', { class: 'form' }, h('p', { class: 'muted small' }, 'L’archive est ouverte en lecture seule : rien n’est réimporté dans l’application.'), field('Mot de passe', pw)),
    actions: [{ label: 'Annuler' }, { label: 'Choisir le fichier…', primary: true, testid: 'archive-open', onClick: async () => {
      const [f] = await pickFiles({ accept: '.json,application/json', multiple: false }); if (!f) return false;
      try { opened = await AR.read(f, pw.value); location.hash = '#/archive'; } catch (e) { toast(e.message, { kind: 'error' }); return false; }
    } }] });
}
export function render({ query }) {
  if (!opened) return h('div', { class: 'page' }, pageHeader('Archive'), emptyState('Aucune archive ouverte', 'Réglages › Années › « Consulter une archive ».', h('a', { class: 'btn', href: '#/reglages/annees' }, 'Réglages › Années')));
  const { head, data } = opened;
  const R = data.records;
  const by = (t) => R.filter(r => r.type === t && !r.deletedAt);
  const get = (id) => R.find(r => r.id === id);
  const name = (sid) => { const s = get(sid); return s ? `${(s.lastName || '').toUpperCase()} ${s.firstName}` : '?'; };
  const students = by('student').sort((a, b) => name(a.id).localeCompare(name(b.id), 'fr'));
  const year = get(head.yearId);
  const tab = query.t || 'eleves';
  const tabs = [['eleves', 'Élèves'], ['bilans', 'Bilans'], ['evaluations', 'Évaluations'], ['cahier', 'Cahier journal']];
  let body;
  if (tab === 'eleves') {
    body = h('table', { class: 'table', 'data-testid': 'archive-students' }, h('thead', {}, h('tr', {}, h('th', {}, 'Élève'), h('th', {}, 'Classe'), h('th', {}, 'Naissance'))),
      h('tbody', {}, students.map(s => { const e = by('enrollment').find(x => x.studentId === s.id); return h('tr', {}, h('td', {}, name(s.id)), h('td', {}, `${get(e?.classId)?.name || ''} ${e?.level || ''}`), h('td', {}, s.birthDate ? model.frShort(s.birthDate) : '')); })));
  } else if (tab === 'bilans') {
    const reps = by('report');
    body = reps.length ? h('div', { class: 'stack' }, students.map(s => { const rs = reps.filter(r => r.studentId === s.id); if (!rs.length) return null;
      return h('section', { class: 'card' }, h('h2', {}, name(s.id)), rs.map(r => h('div', {}, h('strong', {}, (year?.periods || []).find(p => p.id === r.periodId)?.name || 'Période'), ' ', badge(r.status || '', 'muted'),
        Object.entries(r.subjects || {}).filter(([, t]) => t).map(([k, t]) => h('p', { class: 'small' }, `${k} : ${t}`)), r.general ? h('p', {}, r.general) : null))); })) : h('p', { class: 'muted' }, 'Aucun bilan dans cette archive.');
  } else if (tab === 'evaluations') {
    const evs = by('evaluation').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    body = evs.length ? h('ul', { class: 'plain' }, evs.map(e => h('li', {}, `${model.frShort(e.date)} · ${e.subject || ''} — ${e.title || ''}`))) : h('p', { class: 'muted' }, 'Aucune évaluation.');
  } else {
    const occ = by('occurrence').sort((a, b) => `${a.date}${a.start || ''}`.localeCompare(`${b.date}${b.start || ''}`));
    body = occ.length ? h('table', { class: 'table' }, h('tbody', {}, occ.map(o => h('tr', {}, h('td', { class: 'nowrap' }, model.frShort(o.date)), h('td', {}, o.subject || ''), h('td', {}, o.title || get(o.sessionId)?.title || ''), h('td', {}, o.status || ''))))) : h('p', { class: 'muted' }, 'Aucune séance.');
  }
  return h('div', { class: 'page' },
    pageHeader(`Archive ${head.yearLabel}`, { subtitle: `Lecture seule · archivée le ${model.frDateTime(head.at)}`, actions: [
      h('button', { class: 'btn', type: 'button', onclick: () => printDocument(printTable({ title: `Élèves — ${head.yearLabel}`, columns: [{ label: 'Élève' }, { label: 'Classe' }], rows: students.map(s => { const e = by('enrollment').find(x => x.studentId === s.id); return [name(s.id), `${get(e?.classId)?.name || ''} ${e?.level || ''}`]; }) })) }, icon('print', 16), 'Imprimer la liste'),
      h('button', { class: 'btn', type: 'button', onclick: () => { opened = null; location.hash = '#/reglages/annees'; } }, 'Fermer l’archive')] }),
    h('p', { class: 'card notice small' }, 'Archive ouverte en mémoire, en lecture seule : rien n’est modifié ni réimporté. Elle se referme en quittant l’application.'),
    h('nav', { class: 'subtabs' }, tabs.map(([k, l]) => h('a', { href: `#/archive?t=${k}`, class: k === tab ? 'active' : '' }, l))),
    body);
}
void TYPE_LABEL;
