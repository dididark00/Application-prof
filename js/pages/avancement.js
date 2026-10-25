// Préparer › Où j'en suis : avancement dans les programmes et suggestions pour la suite.
import * as store from '../store.js';
import * as model from '../model.js';
import * as A from '../avancement.js';
import { h, badge, emptyState } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { printDocument } from '../print.js';

const pct = (x) => `${Math.round(x * 100)} %`;
const css = (x) => `${Math.round(Math.max(0, Math.min(1, x)) * 1000) / 10}%`;
const bar = (x, mark) => h('div', { class: 'bar av-bar', role: 'img', 'aria-label': `${pct(x)}${mark != null ? `, temps écoulé ${pct(mark)}` : ''}` },
  h('i', { style: { width: css(x) } }), mark != null ? h('b', { class: 'av-mark', style: { left: css(mark) }, title: `Temps écoulé : ${pct(mark)}` }) : null);
const hours = (m) => { const hh = Math.floor(m / 60), mm = Math.round(m % 60); return hh ? `${hh} h${mm ? String(mm).padStart(2, '0') : ''}` : `${mm} min`; };

export function render({ query }) {
  const cls = model.currentClass(); const miss = needClass();
  if (miss) return h('div', { class: 'page' }, pageHeader('Où j’en suis'), subTabs(), miss);
  const year = store.get(cls.yearId);
  const ps = model.periodsOf(year);
  const today = model.todayIso();
  const per = ps.find(p => p.id === query.p) || A.currentPeriod(cls, today);
  const cal = A.calendar(cls, per, today);
  const subjects = A.bySubject(cls, per, today);
  const comps = A.competencies(cls);
  const sugg = A.suggestions(cls, per, today);
  const idx = ps.indexOf(per);

  const subjCard = (g) => h('div', { class: 'card av-subj', 'data-testid': 'av-subject', style: { borderLeftColor: model.subjectColor(g.subject) } },
    h('div', { class: 'card-head' }, h('h3', {}, g.subject), g.pace ? badge(g.pace.label, g.pace.kind) : badge('rien de prévu', 'muted')),
    g.total ? h('div', {}, h('div', { class: 'row small' }, h('strong', { 'data-testid': 'av-score' }, pct(g.score)), h('span', { class: 'muted' }, `d’après les ${g.basis}`)), bar(g.score, cal.period.frac)) : null,
    h('ul', { class: 'small av-facts' },
      g.notions.length ? h('li', {}, `Notions : ${['terminée', 'commencée', 'à reprendre', 'prévue'].map(s => [s, g.notions.filter(n => n.status === s).length]).filter(([, n]) => n).map(([s, n]) => `${n} ${s}${n > 1 ? 's' : ''}`).join(', ')}`) : null,
      g.sessions.total ? h('li', {}, `Séances : ${g.sessions.done} faite(s)${g.sessions.partial ? `, ${g.sessions.partial} partielle(s)` : ''} sur ${g.sessions.total} (${g.sequences.length} séquence(s))`) : null,
      g.rows.total ? h('li', {}, `Progression : ${g.rows.done} ligne(s) réalisée(s) sur ${g.rows.total}`) : null,
      g.minutesWeek ? h('li', {}, `Temps : ${hours(g.minutes)} faites cette période · ${hours(g.minutesWeek)} par semaine à l’emploi du temps`) : null),
    g.notions.length ? h('details', {}, h('summary', { class: 'small' }, 'Détail des notions'),
      h('ul', { class: 'small' }, g.notions.map(n => h('li', {}, badge(n.status, { prévue: 'muted', commencée: 'info', terminée: 'ok', 'à reprendre': 'warn' }[n.status]), ' ', h('a', { href: `#/programmation/${n.prog.id}` }, n.notion.title))))) : null,
    g.sequences.length ? h('details', {}, h('summary', { class: 'small' }, 'Détail des séquences'),
      h('ul', { class: 'small' }, g.sequences.map(s => h('li', {}, h('a', { href: `#/sequence/${s.seq.id}` }, s.seq.title || 'Sans titre'), ` — ${s.done}/${s.total} séance(s) faite(s)${s.planned ? `, ${s.planned} prévue(s)` : ''}`)))) : null);

  const content = h('div', { class: 'stack', id: 'av-content' },
    h('section', { class: 'card', 'data-testid': 'av-calendar' },
      h('h2', {}, per ? `${per.name || `Période ${idx + 1}`} — du ${model.frShort(per.start)} au ${model.frShort(per.end)}` : 'Aucune période définie'),
      per ? h('div', { class: 'grid-2' },
        h('div', {}, h('p', { class: 'small' }, cal.week ? `Semaine ${cal.week} sur ${cal.weeks}` : (today < per.start ? 'Période à venir' : 'Période terminée'), ` · ${cal.period.done} jour(s) de classe sur ${cal.period.total} (${pct(cal.period.frac)})`), bar(cal.period.frac)),
        h('div', {}, h('p', { class: 'small' }, `Année : ${cal.year.done} jour(s) de classe sur ${cal.year.total} (${pct(cal.year.frac)})`), bar(cal.year.frac))) : h('p', { class: 'muted' }, 'Définissez les périodes de l’année dans Réglages › Année scolaire.'),
      h('p', { class: 'muted small' }, 'Le trait vertical sur chaque barre montre le temps écoulé dans la période : une barre qui le dépasse est en avance, une barre loin derrière est en retard. Tout est calculé à partir de vos programmations, progressions, séquences et du cahier journal (séances marquées « faite »).')),
    h('section', { class: 'card', 'data-testid': 'av-suggestions' },
      h('h2', {}, 'Suggestions pour la suite'),
      sugg.length ? h('ul', { class: 'av-sugg' }, sugg.map(s => h('li', { class: `av-${s.kind}`, 'data-testid': 'av-sugg' }, h('span', {}, s.text), s.href ? h('a', { class: 'btn btn-small', href: s.href }, s.action || 'Ouvrir') : null)))
        : h('p', { class: 'muted' }, 'Rien à signaler : tout ce qui est prévu pour la période est placé ou fait.')),
    h('section', { class: 'stack' }, h('h2', {}, 'Par discipline'),
      subjects.filter(g => g.total).length ? h('div', { class: 'grid-2 av-grid' }, subjects.filter(g => g.total).map(subjCard)) : null,
      subjects.some(g => !g.total) ? h('div', { class: 'card', 'data-testid': 'av-others' }, h('h3', {}, 'Autres disciplines de l’emploi du temps'),
        h('p', { class: 'muted small' }, 'Pas de notion, progression ni séquence pour cette période : seul le temps est suivi.'),
        h('ul', { class: 'small av-facts' }, subjects.filter(g => !g.total).map(g => h('li', {}, h('strong', {}, g.subject), ` : ${hours(g.minutes)} faites · ${hours(g.minutesWeek)} par semaine à l’EDT`)))) : null,
      subjects.length ? null
        : emptyState('Rien à mesurer pour cette période', 'L’avancement apparaît dès qu’une programmation (notions par période), une progression ou une séquence existe pour cette période, et que des séances sont marquées « faite » dans le cahier journal. Vous pouvez importer vos documents : Préparer › Importer un tableau.',
          h('a', { class: 'btn', href: '#/importer' }, 'Importer un tableau'), h('a', { class: 'btn', href: '#/programmations' }, 'Programmations'))),
    h('section', { class: 'card', 'data-testid': 'av-comps' },
      h('h2', {}, 'Compétences des programmes (toute l’année)'),
      comps.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, ['Référentiel', 'Travaillées', 'Reliées', 'Évaluées', ''].map(t => h('th', {}, t)))),
        h('tbody', {}, comps.map(c => h('tr', {},
          h('td', {}, h('a', { href: `#/referentiels/${c.ref.id}` }, c.ref.name)),
          h('td', { 'data-testid': 'av-comp-worked' }, `${c.worked} / ${c.total}`, bar(c.worked / c.total)),
          h('td', {}, `${c.linked} / ${c.total}`),
          h('td', {}, `${c.evaluated} / ${c.total}`),
          h('td', {}, c.never.length ? h('details', {}, h('summary', { class: 'small' }, `${c.never.length} pas encore travaillée(s)`),
            h('ul', { class: 'small' }, c.never.slice(0, 40).map(n => h('li', {}, `${n.item.code ? n.item.code + ' — ' : ''}${n.item.label}`, n.linked ? h('span', { class: 'muted' }, ' (reliée, pas encore faite)') : null)))) : badge('toutes travaillées', 'ok')))))))
        : h('p', { class: 'muted' }, 'Aucun référentiel pour les niveaux de la classe. Ajoutez les programmes dans Préparer › Programmes et référentiels, puis reliez les compétences à vos séquences et séances.'),
      h('p', { class: 'muted small' }, '« Travaillée » : au moins une séance reliée marquée faite (ou partielle) dans le cahier journal. « Reliée » : citée dans une notion, une séquence ou une fiche.')));

  return h('div', { class: 'page' },
    pageHeader('Où j’en suis', { favKey: 'preparer/avancement', subtitle: `${cls.name} · avancement dans les programmes`,
      actions: [h('button', { class: 'btn', type: 'button', 'data-testid': 'av-print', onclick: () => printDocument(h('div', {}, h('h1', {}, `Avancement — ${cls.name}`), content.cloneNode(true))) }, 'Imprimer')] }),
    subTabs(),
    ps.length > 1 ? h('div', { class: 'seg wrap', role: 'group', 'aria-label': 'Période' }, ps.map((p, i) => h('a', { class: p.id === per?.id ? 'on seg-link' : 'seg-link', href: `#/avancement?p=${p.id}`, 'data-testid': `av-period-${i + 1}` }, `P${i + 1}`))) : null,
    content);
}
