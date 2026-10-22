// Trombinoscope : photo ou silhouette, vues classe / niveau, impression A4.
import * as store from '../store.js';
import * as model from '../model.js';
import { h, icon, badge } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { printDocument } from '../print.js';

const opts = { level: '', group: '', perRow: 5, showLast: true };

function photo(student, size) {
  const box = h('div', { class: 'trombi-photo', style: { width: `${size}px`, height: `${Math.round(size * 1.2)}px` } });
  box.innerHTML = '<svg viewBox="0 0 60 72" width="70%" height="70%" aria-hidden="true"><circle cx="30" cy="24" r="13" fill="#b9cbc4"/><path d="M6 70c2-16 12-24 24-24s22 8 24 24z" fill="#b9cbc4"/></svg>';
  if (student.photoBlobId) store.getBlob(student.photoBlobId).then(b => {
    if (!b) return;
    // Conversion en data URL : l'image reste affichable à l'impression.
    const r = new FileReader(); r.onload = () => box.replaceChildren(h('img', { src: r.result, alt: '' })); r.readAsDataURL(b);
  });
  return box;
}

export function render({ rerender }) {
  const cls = model.currentClass();
  const missing = needClass();
  if (missing) return h('div', { class: 'page' }, pageHeader('Trombinoscope'), subTabs(), missing);
  const groups = store.all('group').filter(g => g.classId === cls.id && g.permanent !== false);
  const grp = groups.find(g => g.id === opts.group);
  const list = model.studentsOfClass(cls.id).filter(x => !x.student.archived && (!opts.level || x.enrollment.level === opts.level) && (!grp || (grp.memberIds || []).includes(x.student.id)));
  const grid = (size, linkable) => h('div', { class: 'trombi', style: { gridTemplateColumns: `repeat(${opts.perRow}, 1fr)` }, 'data-testid': 'trombi' }, list.map(({ student: s, enrollment: e }) =>
    h(linkable ? 'a' : 'div', { class: 'trombi-card', href: linkable ? `#/eleve/${s.id}` : null }, photo(s, size), h('strong', {}, s.firstName), opts.showLast ? h('span', {}, s.lastName) : null, (cls.levels || []).length > 1 ? h('span', { class: 'small muted' }, e.level) : null)));
  const doc = () => h('div', { class: 'print-doc' }, h('header', { class: 'print-head' }, h('h1', {}, `Trombinoscope — ${cls.name}${opts.level ? ' ' + opts.level : ''}${grp ? ' · ' + grp.name : ''}`), h('p', {}, `${list.length} élève(s)`)), grid(110, false));
  return h('div', { class: 'page' },
    pageHeader('Trombinoscope', { favKey: 'classe/trombi', subtitle: `${cls.name} · ${list.length} élève(s)`,
      actions: [h('button', { class: 'btn', type: 'button', 'data-testid': 'print-trombi', onclick: () => printDocument(doc()) }, icon('print', 16), 'Imprimer')] }),
    subTabs(),
    h('div', { class: 'filters' },
      (cls.levels || []).length > 1 ? h('select', { 'aria-label': 'Niveau', onchange: (e) => { opts.level = e.target.value; rerender(); } }, h('option', { value: '' }, 'Tous les niveaux'), cls.levels.map(l => h('option', { value: l, selected: opts.level === l }, l))) : null,
      groups.length ? h('select', { 'aria-label': 'Groupe', onchange: (e) => { opts.group = e.target.value; rerender(); } }, h('option', { value: '' }, 'Tous les groupes'), groups.map(g => h('option', { value: g.id, selected: opts.group === g.id }, g.name))) : null,
      h('label', { class: 'inline' }, 'Par ligne', h('select', { onchange: (e) => { opts.perRow = Number(e.target.value); rerender(); } }, [3, 4, 5, 6, 8].map(n => h('option', { value: n, selected: opts.perRow === n }, n)))),
      h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: opts.showLast, onchange: (e) => { opts.showLast = e.target.checked; rerender(); } }), 'Noms de famille')),
    h('p', { class: 'muted small' }, 'Sans photo, une silhouette s’affiche. Ajouter une photo : fiche élève › Photo. Vérifiez le droit à l’image avant tout usage hors de la classe.'),
    grid(120, true));
  void badge;
}
