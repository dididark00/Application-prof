// Progression de période (modèle « Progression période » de l’enseignante) : suivi semaine par semaine
// de l'avancement réel, distinct de la programmation validée, avec bilan de période.
import { bulkDelete } from '../bulk.js';
import * as store from '../store.js';
import * as model from '../model.js';
import * as P from '../pedago.js';
import { h, icon, toast, modal, field, formData, confirmDialog, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { bound, iconBtn } from '../forms.js';
import { sectionFields, ownerBadge, ownerSelect } from '../pedago-ui.js';
import { printDocument } from '../print.js';

let selPeriod = null;
let rerender = () => {};

export function render({ params, rerender: rr }) {
  rerender = rr;
  if (params[0]) return detail(params[0]);
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Progressions'), subTabs(), missing);
  const year = store.get(cls.yearId);
  const periods = model.periodsOf(year);
  const cur = model.periodOfDate(year, model.todayIso()) || periods.find(p => p.start > model.todayIso()) || periods[0];
  const per = periods.find(p => p.id === selPeriod) || cur;
  const list = per ? P.ofClass('progression', cls.id).filter(x => x.periodId === per.id) : [];
  return h('div', { class: 'page' },
    pageHeader('Progressions de période', { favKey: 'preparer/progressions', subtitle: `${cls.name} · suivi de l’avancement réel, semaine par semaine`,
      actions: per ? [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'new-progression', onclick: () => newDialog(cls, per) }, icon('plus', 16), 'Nouvelle progression'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'bulk-open', onclick: () => { const all = P.ofClass('progression', cls.id); const yp = model.periodsOf(store.get(cls.yearId)); bulkDelete({ title: 'Supprimer des progressions (toutes périodes)', items: all.sort((a, b) => yp.findIndex(x => x.id === a.periodId) - yp.findIndex(x => x.id === b.periodId)).map(pr => ({ id: pr.id, label: `${pr.subject}${pr.subdomain ? ' — ' + pr.subdomain : ''}`, detail: `P${yp.findIndex(x => x.id === pr.periodId) + 1} · ${(pr.rows || []).length} ligne(s)` })) }); } }, icon('trash', 16), 'Supprimer…')] : [] }),
    subTabs(),
    periods.length ? h('div', { class: 'seg', role: 'group', 'aria-label': 'Période' }, periods.map((p, i) => h('button', { type: 'button', class: per && p.id === per.id ? 'on' : '', onclick: () => { selPeriod = p.id; rerender(); } }, `P${i + 1}`))) : null,
    per ? h('p', { class: 'muted' }, `Du ${model.frDate(per.start)} au ${model.frDate(per.end)} · ${model.weeksOfPeriod(per).length} semaine(s)`) : emptyState('Aucune période', 'Définissez les périodes de l’année dans Réglages.'),
    list.length ? h('div', { class: 'dash' }, list.map(pr => {
      const counts = {}; for (const r of pr.rows || []) counts[r.status || 'À venir'] = (counts[r.status || 'À venir'] || 0) + 1;
      return h('a', { class: 'card card-link', href: `#/progression/${pr.id}` },
        h('h2', {}, pr.subject, pr.subdomain ? ` — ${pr.subdomain}` : '', ' ', badge(pr.level || '', 'muted'), ownerBadge(pr.owner, cls)),
        h('p', {}, `${(pr.rows || []).length} ligne(s)`), h('div', { class: 'tags' }, Object.entries(counts).map(([k, v]) => badge(`${k} : ${v}`, P.PROG_STATUS_KIND[k]))));
    })) : per ? emptyState('Aucune progression pour cette période') : null);
}

function newDialog(cls, per) {
  const progs = P.ofClass('programmation', cls.id);
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' },
      field('Discipline', h('select', { name: 'subject' }, model.subjects().map(s => h('option', { value: s }, s)))),
      field('Niveau', h('select', { name: 'level' }, (cls.levels || []).map(l => h('option', { value: l }, l))))),
    field('Sous-domaine (facultatif)', h('input', { name: 'subdomain' })),
    field('Colonnes « fil rouge » supplémentaires (séparées par des virgules)', h('input', { name: 'extra', placeholder: 'ex. Calcul mental, Résolution de problèmes' })),
    field('Répartition', h('select', { name: 'owner' }, h('option', { value: '' }, '—'), model.owners(cls).map(([v, l]) => h('option', { value: v }, l)))),
    h('label', { class: 'inline' }, h('input', { type: 'checkbox', name: 'prefill', checked: true }), 'Préremplir avec les séquences prévues sur cette période'));
  modal({ title: 'Nouvelle progression', body: form, actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, onClick: async () => {
    const d = formData(form);
    const prog = progs.find(x => x.subject === d.subject && x.level === d.level);
    const seqs = d.prefill ? P.ofClass('sequence', cls.id).filter(s => s.periodId === per.id && s.subject === d.subject && (!s.levels?.length || s.levels.includes(d.level)))
      .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0)) : [];
    const rows = seqs.map((s, i) => ({ id: store.uid(), week: Math.min(i + 1, model.weeksOfPeriod(per).length), sequenceId: s.id, title: '', objective: s.objectifGeneral || '', support: '', status: 'À venir', adjustments: '', extra: {}, notionIds: [] }));
    const pr = await store.create('progression', { classId: cls.id, subject: d.subject, level: d.level, subdomain: d.subdomain, periodId: per.id, programmationId: prog?.id || null, owner: d.owner || prog?.owner || '',
      extraColumns: d.extra.split(',').map(x => x.trim()).filter(Boolean), rows }, `Progression ${d.subject} créée`);
    location.hash = `#/progression/${pr.id}`;
  } }] });
}

function rowsUpdate(prId, fn, label, quiet = true) {
  const pr = store.get(prId);
  return store.update(prId, { rows: fn(structuredClone(pr.rows || [])) }, label, { quiet });
}

function detail(id) {
  const pr = store.get(id);
  if (!pr || pr.deletedAt) return h('div', { class: 'page' }, pageHeader('Progression introuvable'), h('a', { href: '#/progressions' }, '← Progressions'));
  const cls = store.get(pr.classId); const year = store.get(cls.yearId);
  const periods = model.periodsOf(year);
  const pi = periods.findIndex(p => p.id === pr.periodId); const per = periods[pi];
  const weeks = model.weeksOfPeriod(per);
  const prog = pr.programmationId ? store.get(pr.programmationId) : null;
  const extras = pr.extraColumns || [];
  const rows = pr.rows || [];

  const rowEl = (r) => {
    const sug = P.suggestedStatus(r);
    const link = r.sessionId ? store.get(r.sessionId) : null;
    const seq = r.sequenceId ? store.get(r.sequenceId) : null;
    return h('tr', { 'data-testid': 'prog-row' },
      h('td', {}, h('button', { class: 'linklike', type: 'button', onclick: () => rowDialog(pr, r, weeks) },
        seq ? P.sequenceTitle(seq) : null, link ? h('div', {}, P.sessionTitle(link)) : null, r.title ? h('div', {}, r.title) : null, !seq && !link && !r.title ? h('span', { class: 'muted' }, '[n° et titre]') : null)),
      h('td', {}, bound({ type: 'textarea', compact: true, value: r.objective, placeholder: 'objectif précis', onSave: (v) => rowsUpdate(pr.id, rs => rs.map(x => x.id === r.id ? { ...x, objective: v } : x), 'Objectif') })),
      h('td', {}, bound({ type: 'textarea', compact: true, value: r.support, placeholder: 'manuel et pages vérifiées', onSave: (v) => rowsUpdate(pr.id, rs => rs.map(x => x.id === r.id ? { ...x, support: v } : x), 'Support') })),
      extras.map(c => h('td', {}, bound({ type: 'textarea', compact: true, value: r.extra?.[c], onSave: (v) => rowsUpdate(pr.id, rs => rs.map(x => x.id === r.id ? { ...x, extra: { ...(x.extra || {}), [c]: v } } : x), c) }))),
      h('td', {}, bound({ type: 'select', value: r.status || 'À venir', options: P.PROG_STATUSES, testid: 'row-status', onSave: (v) => rowsUpdate(pr.id, rs => rs.map(x => x.id === r.id ? { ...x, status: v } : x), `Statut : ${v}`, false) }),
        sug ? h('div', { class: 'muted small' }, `Journal : ${sug.done}/${sug.total} faite(s)`, (sug.done || sug.partial) && sug.status !== (r.status || 'À venir')
          ? h('button', { class: 'btn btn-link small', type: 'button', 'data-testid': 'apply-status', onclick: () => rowsUpdate(pr.id, rs => rs.map(x => x.id === r.id ? { ...x, status: sug.status } : x), `Statut : ${sug.status}`, false) }, `→ ${sug.status}`) : null) : null),
      h('td', {}, bound({ type: 'textarea', compact: true, value: r.adjustments, onSave: (v) => rowsUpdate(pr.id, rs => rs.map(x => x.id === r.id ? { ...x, adjustments: v } : x), 'Ajustements') })),
      h('td', { class: 'row-actions' }, iconBtn('edit', 'Liens et semaine', () => rowDialog(pr, r, weeks)),
        iconBtn('trash', 'Supprimer la ligne', async () => { await rowsUpdate(pr.id, rs => rs.filter(x => x.id !== r.id), 'Ligne supprimée', false); toast('Ligne supprimée', { action: 'Annuler', onAction: () => store.undo() }); })));
  };

  const notions = prog ? P.notionsOf(prog.id).filter(n => n.periodId === pr.periodId) : [];
  const ns = notions.map(n => ({ n, st: P.notionStatus(n) }));
  const reported = store.all('occurrence').filter(o => o.status === 'reportée' && o.date >= per.start && o.date <= per.end && store.get(o.sessionId)?.subject === pr.subject && o.classId === pr.classId);

  return h('div', { class: 'page' },
    h('p', {}, h('a', { href: '#/progressions', class: 'back' }, '← Progressions')),
    pageHeader(`Progression P${pi + 1} — ${pr.subject}`, { subtitle: `${cls.name} · ${pr.level} · du ${model.frDate(per.start)} au ${model.frDate(per.end)}`,
      actions: [
        h('button', { class: 'btn', type: 'button', 'data-testid': 'print-progression', onclick: () => printDocument(printProgression(pr), { orientation: 'landscape' }) }, icon('print', 16), 'Imprimer'),
        h('button', { class: 'btn btn-ghost-danger', type: 'button', 'aria-label': 'Mettre à la corbeille', onclick: async () => {
          if (!await confirmDialog('Mettre la progression à la corbeille ?', 'Vous pourrez la restaurer depuis Réglages › Corbeille.', { confirmLabel: 'Mettre à la corbeille', danger: true })) return;
          await store.remove(pr.id, 'Progression mise à la corbeille'); location.hash = '#/progressions';
        } }, icon('trash', 16))] }),
    h('section', { class: 'card' }, h('div', { class: 'grid-3' },
      bound({ label: 'Sous-domaine', type: 'text', value: pr.subdomain, onSave: (v) => store.update(pr.id, { subdomain: v }, 'Sous-domaine', { quiet: true }) }),
      ownerSelect(pr.id, cls),
      bound({ label: 'Colonnes fil rouge (virgules)', type: 'text', value: extras.join(', '), onSave: (v) => store.update(pr.id, { extraColumns: v.split(',').map(x => x.trim()).filter(Boolean) }, 'Colonnes') })),
      h('p', {}, h('strong', {}, 'Programmation de référence : '), prog ? h('a', { href: `#/programmation/${prog.id}` }, `${prog.subject} ${prog.level}`) : h('span', { class: 'muted' }, 'aucune'),
        prog?.validated?.ref ? ` · version validée : ${prog.validated.ref}${prog.validated.date ? ` (${model.frShort(prog.validated.date)})` : ''}` : '',
        !prog ? h('button', { class: 'btn btn-link', type: 'button', onclick: async () => {
          const match = P.ofClass('programmation', pr.classId).find(x => x.subject === pr.subject && x.level === pr.level);
          if (match) await store.update(pr.id, { programmationId: match.id }, 'Programmation reliée'); else toast('Aucune programmation de cette discipline et de ce niveau.', { kind: 'error' });
        } }, 'relier') : null)),
    h('section', { class: 'card' }, h('h2', {}, 'Progression semaine par semaine'),
      h('p', { class: 'muted small' }, 'Le statut se met à jour à la main après chaque séance. Le cahier journal propose un statut, que vous appliquez ou non : la programmation validée n’est jamais modifiée.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table prog-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Séquence / séance'), h('th', {}, 'Objectif précis'), h('th', {}, 'Support / exercices'), extras.map(c => h('th', {}, c)), h('th', {}, 'Statut'), h('th', {}, 'Ajustements'), h('th', {}, ''))),
        weeks.map(w => h('tbody', {},
          h('tr', { class: 'week-row' }, h('th', { colspan: 6 + extras.length },
            h('span', {}, `S${w.n}`), h('span', { class: 'muted small' }, ` · du ${model.frShort(w.monday)} au ${model.frShort(w.friday)}`),
            h('button', { class: 'btn btn-small', type: 'button', 'data-testid': `add-row-${w.n}`, onclick: () => rowsUpdate(pr.id, rs => [...rs, { id: store.uid(), week: w.n, title: '', objective: '', support: '', status: 'À venir', adjustments: '', extra: {}, notionIds: [] }], `Ligne ajoutée en S${w.n}`, false) }, '+ ligne'))),
          rows.filter(r => r.week === w.n).map(rowEl))),
        rows.some(r => !weeks.some(w => w.n === r.week)) ? h('tbody', {}, h('tr', { class: 'week-row' }, h('th', { colspan: 6 + extras.length }, 'Hors période')), rows.filter(r => !weeks.some(w => w.n === r.week)).map(rowEl)) : null)),
      h('p', { class: 'muted small' }, 'Légende : Réalisé · En cours · À venir · À reprendre · Reporté.')),
    h('section', { class: 'card' }, h('h2', {}, 'Bilan de période'),
      h('div', { class: 'grid-2' },
        h('div', {}, h('h3', {}, `Notions de la programmation (${ns.filter(x => x.st === 'terminée').length}/${ns.length} terminées)`),
          ns.length ? h('ul', { class: 'plain', 'data-testid': 'period-notions' }, ns.map(({ n, st }) => h('li', {}, badge(st, P.NOTION_KIND[st]), ' ', n.title))) : h('p', { class: 'muted' }, prog ? 'Aucune notion en programmation pour cette période.' : 'Reliez une programmation pour suivre les notions réalisées et restantes.')),
        h('div', {}, h('h3', {}, 'Séances reportées (cahier journal)'),
          reported.length ? h('ul', { class: 'plain' }, reported.map(o => h('li', {}, `${model.frShort(o.date)} — ${P.sessionTitle(store.get(o.sessionId))}`))) : h('p', { class: 'muted' }, 'Aucune.'))),
      sectionFields(pr.id, P.PROGRESSION_BILAN, { prefix: 'Bilan : ' })));
}

function rowDialog(pr, r, weeks) {
  const cls = store.get(pr.classId);
  const seqs = P.ofClass('sequence', pr.classId).filter(s => s.subject === pr.subject);
  const seqSel = h('select', { name: 'sequenceId' }, h('option', { value: '' }, '—'), seqs.map(s => h('option', { value: s.id, selected: s.id === r.sequenceId }, P.sequenceTitle(s))));
  const sesSel = h('select', { name: 'sessionId' });
  const fillSessions = () => sesSel.replaceChildren(h('option', { value: '' }, 'Toute la séquence'), ...(seqSel.value ? P.sessionsOfSequence(seqSel.value) : []).map(s => h('option', { value: s.id, selected: s.id === r.sessionId }, P.sessionTitle(s))));
  seqSel.addEventListener('change', fillSessions); fillSessions();
  const prog = pr.programmationId ? store.get(pr.programmationId) : null;
  const notions = prog ? P.notionsOf(prog.id).filter(n => n.periodId === pr.periodId || (r.notionIds || []).includes(n.id)) : [];
  const chosen = new Set(r.notionIds || []);
  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Semaine', h('select', { name: 'week' }, weeks.map(w => h('option', { value: w.n, selected: w.n === r.week }, `S${w.n} — ${model.frShort(w.monday)}`)))),
    h('div', { class: 'grid-2' }, field('Séquence', seqSel), field('Séance', sesSel)),
    field('Ou intitulé libre', h('input', { name: 'title', value: r.title || '', placeholder: 'ex. Consolidation / bilan P1' })),
    notions.length ? h('fieldset', {}, h('legend', {}, 'Notions de la programmation concernées'), h('div', { class: 'chips' }, notions.map(n => h('label', { class: 'chip' },
      h('input', { type: 'checkbox', checked: chosen.has(n.id), onchange: (e) => { e.target.checked ? chosen.add(n.id) : chosen.delete(n.id); } }), n.title)))) : null,
    seqs.length ? null : h('p', { class: 'muted small' }, `Aucune séquence de ${pr.subject} : créez-en dans Préparer › Séquences.`));
  modal({ title: 'Ligne de progression', body: form, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    const d = formData(form);
    await rowsUpdate(pr.id, rs => rs.map(x => x.id === r.id ? { ...x, week: Number(d.week), sequenceId: d.sequenceId || null, sessionId: d.sessionId || null, title: d.title, notionIds: [...chosen] } : x), 'Ligne de progression', false);
  } }] });
  void cls;
}

export function printProgression(pr) {
  const cls = store.get(pr.classId); const year = store.get(cls.yearId);
  const periods = model.periodsOf(year); const pi = periods.findIndex(p => p.id === pr.periodId); const per = periods[pi];
  const extras = pr.extraColumns || [];
  const rows = (pr.rows || []).slice().sort((a, b) => a.week - b.week);
  const label = (r) => [r.sequenceId ? P.sequenceTitle(store.get(r.sequenceId)) : '', r.sessionId ? P.sessionTitle(store.get(r.sessionId)) : '', r.title].filter(Boolean).join(' · ');
  return h('div', { class: 'print-doc' },
    h('header', { class: 'print-head' }, h('h1', {}, `Progression P${pi + 1} — ${pr.subject}${pr.subdomain ? ' / ' + pr.subdomain : ''}`),
      h('p', {}, [cls.name, pr.level, per ? `du ${model.frShort(per.start)} au ${model.frShort(per.end)}` : '', pr.owner ? `Enseignante : ${model.ownerLabel(pr.owner, cls)}` : ''].filter(Boolean).join(' · '))),
    h('table', { class: 'print-table' },
      h('thead', {}, h('tr', {}, h('th', { style: { width: '5%' } }, 'Sem.'), h('th', {}, 'Séquence / séance'), h('th', {}, 'Objectif précis'), h('th', {}, 'Support / exercices'), extras.map(c => h('th', {}, c)), h('th', { style: { width: '9%' } }, 'Statut'), h('th', {}, 'Ajustements'))),
      h('tbody', {}, rows.map(r => h('tr', {}, h('td', {}, `S${r.week}`), h('td', {}, label(r)), h('td', {}, r.objective), h('td', {}, r.support), extras.map(c => h('td', {}, r.extra?.[c] || '')), h('td', {}, r.status), h('td', {}, r.adjustments))))),
    h('h2', { class: 'print-h2' }, 'Bilan de période'),
    h('table', { class: 'print-table' }, h('tbody', {}, P.PROGRESSION_BILAN.map(f => h('tr', {}, h('th', { style: { width: '28%' } }, f.label), h('td', {}, pr[f.key] || ''))))));
}
