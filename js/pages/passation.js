// Transmissions de fin d'année : un dossier par élève pour le ou la collègue de l'an prochain.
// Repris automatiquement : maîtrise par discipline sur l'année, points forts et fragilités (compétences),
// attestations obtenues. À compléter : ce qui marche, vigilance, conseils. Dispositifs (PPRE, PAP, PAI…)
// seulement si on le coche, pour cette impression.
import * as store from '../store.js';
import * as model from '../model.js';
import * as E from '../eleve.js';
import { h, icon, toast, badge } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { printDocument } from '../print.js';
import { scale } from './evaluations.js';
import { compSynth, livretResults, reportOf, saveReport, mastery } from './livrets.js';
import { attestationsOf, obtained } from './attestations.js';

const FIELDS = [['marche', 'Ce qui marche avec cet élève'], ['vigilance', 'Points de vigilance'], ['conseils', 'Conseils pour l’an prochain']];
const NEXT = { PS: 'MS', MS: 'GS', GS: 'CP', CP: 'CE1', CE1: 'CE2', CE2: 'CM1', CM1: 'CM2', CM2: '6e' };

export function studentFile(cls, s, { per, sc }) {
  const syn = compSynth(livretResults(cls, per, s.id), sc, null);
  const subjects = Object.entries(syn).map(([sub, rows]) => ({ sub, v: mastery(rows, sc), n: rows.length })).filter(x => x.v != null);
  const all = Object.entries(syn).flatMap(([sub, rows]) => rows.map(r => ({ ...r, sub })));
  const keys = sc.map(([k]) => k);
  const strong = all.filter(r => keys.indexOf(r.level) >= keys.length - 1).slice(0, 6);
  const fragile = all.filter(r => keys.indexOf(r.level) >= 0 && keys.indexOf(r.level) <= Math.max(0, keys.length - 3)).slice(0, 8);
  const att = attestationsOf(cls.id).map(a => [a, obtained(a, s.id)]).filter(([, d]) => d);
  return { subjects, strong, fragile, att };
}

export function render({ rerender }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return h('div', { class: 'page' }, pageHeader('Transmissions de fin d’année'), subTabs(), miss);
  const year = store.get(cls.yearId); const ps = model.periodsOf(year);
  const per = { id: `passation:${year.id}`, start: ps[0]?.start || model.todayIso(), end: ps.at(-1)?.end || model.todayIso() };
  const yearPer = { id: `dates:${per.start}:${per.end}`, start: per.start, end: per.end };
  const sc = scale();
  const students = model.studentsOfClass(cls.id, { includeLeft: false });
  const next = [...new Set((cls.levels || []).map(l => NEXT[l]).filter(Boolean))].join(', ');
  const toIn = h('input', { placeholder: `ex. Mme X, ${next || 'classe suivante'}`, value: store.get(cls.id)?.passationTo || '', 'data-testid': 'pass-to', onchange: (e) => store.update(cls.id, { passationTo: e.target.value }, 'Destinataire des transmissions', { quiet: true }) });
  const plansIn = h('input', { type: 'checkbox', 'data-testid': 'pass-plans' });

  const print = (only = null) => {
    const list = only ? students.filter(x => x.student.id === only) : students;
    printDocument(h('div', {}, list.map(({ student: s, enrollment: en }) => {
      const f = studentFile(cls, s, { per: yearPer, sc }); const rep = reportOf(cls.id, per.id, s.id) || {};
      const plans = plansIn.checked ? E.of('plan', s.id).filter(p => p.status !== 'terminé') : [];
      return h('div', { class: 'livret-page' }, h('div', { class: 'print-doc livret passation' },
        h('header', { class: 'livret-head' }, h('div', { class: 'livret-school' }, h('strong', {}, cls.school || 'École'), h('div', {}, year?.label || '')),
          h('div', { class: 'livret-title' }, h('h1', {}, 'Transmission de fin d’année'), h('div', { class: 'print-sub' }, toIn.value ? `Pour : ${toIn.value}` : (next ? `Vers le ${next}` : ''))),
          h('div', { class: 'livret-student' }, h('strong', { class: 'livret-name' }, `${s.firstName} ${s.lastName}`), h('div', {}, `${cls.name}${en?.level ? ` · ${en.level}` : ''}`))),
        f.subjects.length ? h('section', { class: 'livret-profile' }, h('div', { class: 'lp-gauges' }, h('div', { class: 'lp-title' }, 'Maîtrise sur l’année'),
          f.subjects.map(x => h('div', { class: 'lp-gauge' }, h('span', { class: 'lp-name' }, x.sub), h('span', { class: 'lp-bar' }, h('span', { style: { width: `${Math.round(x.v * 100)}%` } })), h('span', { class: 'lp-pct' }, `${Math.round(x.v * 100)} %`))))) : null,
        h('div', { class: 'grid-2 pass-cols' },
          h('section', { class: 'livret-sub' }, h('div', { class: 'livret-sub-head' }, h('span', { class: 'livret-sub-name' }, 'Points forts')), h('ul', {}, f.strong.length ? f.strong.map(r => h('li', {}, `${r.label} (${r.sub})`)) : h('li', { class: 'muted' }, '—'))),
          h('section', { class: 'livret-sub' }, h('div', { class: 'livret-sub-head' }, h('span', { class: 'livret-sub-name' }, 'À consolider')), h('ul', {}, f.fragile.length ? f.fragile.map(r => h('li', {}, `${r.label} (${r.sub}) : ${r.level}`)) : h('li', { class: 'muted' }, '—')))),
        f.att.length ? h('p', { class: 'small' }, h('strong', {}, 'Attestations obtenues : '), f.att.map(([a, d]) => `${a.title} (${model.frShort(d)})`).join(' · ')) : null,
        plans.length ? h('section', { class: 'livret-sub' }, h('div', { class: 'livret-sub-head' }, h('span', { class: 'livret-sub-name' }, 'Dispositifs et aménagements (confidentiel)')),
          h('ul', {}, plans.map(p => h('li', {}, [p.kind, p.adaptations].filter(Boolean).join(' — '))))) : null,
        FIELDS.map(([k, l]) => rep[k] ? h('section', { class: 'livret-sub' }, h('div', { class: 'livret-sub-head' }, h('span', { class: 'livret-sub-name' }, l)), h('p', { class: 'livret-app pre' }, rep[k])) : null),
        h('p', { class: 'small muted' }, `Document de liaison entre enseignants${plans.length ? ' — contient des informations confidentielles : à ne pas diffuser aux familles ni à des tiers' : ''}.`)));
    })));
  };

  return h('div', { class: 'page' },
    pageHeader('Transmissions de fin d’année', { favKey: 'classe/passation', subtitle: `${cls.name} · ${year?.label || ''}`, actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'pass-print', onclick: () => print() }, icon('print', 16), 'Imprimer les dossiers')] }),
    subTabs(),
    h('section', { class: 'card stack' },
      h('p', { class: 'muted small' }, 'Un dossier par élève pour le ou la collègue de l’an prochain. Repris de l’année : maîtrise par discipline, points forts, compétences à consolider, attestations. Complétez ce qui marche, la vigilance et vos conseils.'),
      h('div', { class: 'grid-2' }, h('label', { class: 'field' }, h('span', {}, 'Pour (collègue, classe)'), toIn),
        h('label', { class: 'inline', style: { alignSelf: 'end' } }, plansIn, 'Ajouter les dispositifs (PPRE, PAP, PAI…) — confidentiel, seulement pour cette impression'))),
    h('div', { class: 'stack' }, students.map(({ student: s }) => {
      const f = studentFile(cls, s, { per: yearPer, sc }); const rep = reportOf(cls.id, per.id, s.id) || {};
      const filled = FIELDS.filter(([k]) => (rep[k] || '').trim()).length;
      return h('details', { class: 'card pass-card', 'data-testid': 'pass-card' },
        h('summary', {}, h('strong', {}, `${s.firstName} ${s.lastName}`), ' ', badge(`${filled}/${FIELDS.length} rubriques`, filled === FIELDS.length ? 'ok' : 'muted'),
          f.fragile.length ? h('span', { class: 'muted small' }, ` · ${f.fragile.length} compétence(s) à consolider`) : null),
        h('div', { class: 'grid-3' }, FIELDS.map(([k, l]) => h('label', { class: 'field' }, h('span', {}, l),
          h('textarea', { rows: 3, 'data-testid': `pass-${k}`, onchange: async (e) => { await saveReport(cls, per, s, { [k]: e.target.value }, `Transmission : ${s.firstName}`); } }, rep[k] || '')))),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-small', type: 'button', onclick: () => print(s.id) }, icon('print', 14), 'Imprimer ce dossier')));
    })));
  void rerender; void toast;
}
