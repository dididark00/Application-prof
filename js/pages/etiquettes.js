// Préparer › Étiquettes et affichages : générateur en série (élèves, matériel, titres,
// cartes d'ateliers), dimensions exactes, nombre par page, impression à taille réelle,
// académies (noms, couleurs, emblèmes, élèves) et séries versionnées.
import * as store from '../store.js';
import * as model from '../model.js';
import * as L from '../labels.js';
import * as F from '../fonts.js';
import * as G from '../groups.js';
import * as FI from '../finance.js';
import { h, icon, toast, modal, field, formData, badge, emptyState, pickFiles } from '../ui.js';
import { pageHeader, subTabs, needClass } from '../components.js';
import { pickMany } from '../forms.js';

const TYPES = [['eleves', 'Élèves (prénoms, porte-manteaux, casiers)'], ['materiel', 'Matériel'], ['titres', 'Titres et affichages'], ['ateliers', 'Cartes d’ateliers']];
const gen = { tab: 'generer', type: 'eleves', formatId: '70x37', custom: { w: 80, h: 50 }, margin: 0, gap: 0, title: '',
  opts: { lastName: false, academy: true, academyName: false },
  style: { font: '', font2: '', border: '', borderWidth: null, fill: false, cutMarks: true, color: '' },
  text: { materiel: '', titres: 'Français\nMathématiques\nQuestionner le monde', ateliers: 'Atelier lecture | Lis l’album puis réponds aux questions.\nAtelier calcul | Utilise le matériel pour résoudre les problèmes.' } };

function fmtOf(o = gen) { const f = L.FORMATS.find(x => x.id === o.formatId) || L.FORMATS[0]; return { ...(f.id === 'custom' ? { ...f, ...o.custom } : f), margin: o.margin, gap: o.gap }; }

export function render({ params, query, rerender }) {
  const cls = model.currentClass();
  if (params[0]) return seriesPage(params[0], rerender);
  if (query?.t) gen.tab = query.t;
  return h('div', { class: 'page' },
    pageHeader('Étiquettes et affichages', { favKey: 'preparer/etiquettes', subtitle: 'Dimensions réelles en millimètres, plusieurs étiquettes par page A4' }),
    subTabs(),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' }, [['generer', 'Générer'], ['series', 'Mes séries'], ['academies', 'Académies']].map(([k, l]) =>
      h('button', { type: 'button', class: gen.tab === k ? 'on' : '', 'data-testid': `lab-tab-${k}`, onclick: () => { gen.tab = k; rerender(); } }, l))),
    gen.tab === 'series' ? seriesList() : gen.tab === 'academies' ? (needClass() || academiesTab(cls, rerender)) : generator(cls, rerender));
}

// ───────── Générateur
function itemsFor(cls) {
  if (gen.type === 'eleves') return cls ? L.studentItems(cls.id, gen.opts) : [];
  const lines = (gen.text[gen.type] || '').split('\n').map(x => x.trim()).filter(Boolean);
  const colors = L.charte().colors;
  if (gen.type === 'ateliers') return lines.map((x, i) => { const [a, b] = x.split('|').map(y => y.trim()); return { line1: a, line2: b || '', color: colors[i % colors.length] }; });
  return lines.map(x => ({ line1: x }));
}

function generator(cls, rerender) {
  const fmt = fmtOf();
  const lay = L.layout(fmt);
  const items = itemsFor(cls);
  const preview = h('div', { class: 'labels-preview', 'data-testid': 'labels-preview' });
  const info = h('p', { class: 'muted small', 'data-testid': 'labels-info' });
  const redraw = async () => {
    const its = itemsFor(cls);
    const urls = await L.imageUrls(its);
    const ps = L.pages(its, fmtOf(), gen.style, urls);
    const l2 = L.layout(fmtOf());
    info.textContent = l2.perPage ? `${its.length} étiquette(s) · ${l2.perPage} par page (${l2.cols} × ${l2.rows}, A4 ${l2.landscape ? 'paysage' : 'portrait'}) · ${ps.length} page(s)` : 'Format trop grand pour une feuille A4.';
    preview.replaceChildren(...ps.slice(0, 1));
    L.fitWhenReady(preview);
  };
  const set = (fn) => (e) => { fn(e); redraw(); };
  const fonts = F.available();
  const textArea = gen.type !== 'eleves' ? field(gen.type === 'ateliers' ? 'Une carte par ligne : titre | consigne' : 'Une étiquette par ligne',
    h('textarea', { rows: 6, 'data-testid': 'labels-text', oninput: set((e) => { gen.text[gen.type] = e.target.value; }) }, gen.text[gen.type])) : null;
  redraw();
  return h('div', { class: 'atelier' },
    h('section', { class: 'card form' },
      field('Type', h('select', { 'data-testid': 'labels-type', onchange: (e) => { gen.type = e.target.value; if (e.target.value === 'titres' && gen.formatId === '70x37') gen.formatId = 'a4l'; if (e.target.value === 'ateliers' && gen.formatId === '70x37') gen.formatId = '148x105'; const f = L.FORMATS.find(x => x.id === gen.formatId); gen.margin = f.margin; gen.gap = f.gap; rerender(); } }, TYPES.map(([k, l]) => h('option', { value: k, selected: gen.type === k }, l)))),
      gen.type === 'eleves' ? h('div', {},
        !cls ? h('p', { class: 'muted' }, 'Choisissez une classe en haut de l’écran.') : null,
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: gen.opts.lastName, onchange: set((e) => { gen.opts.lastName = e.target.checked; }) }), 'Nom de famille'),
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: gen.opts.academy, 'data-testid': 'labels-academy', onchange: set((e) => { gen.opts.academy = e.target.checked; }) }), 'Couleur et emblème de l’académie'),
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: gen.opts.academyName, onchange: set((e) => { gen.opts.academyName = e.target.checked; }) }), 'Nom de l’académie'),
        cls && !L.academySet(cls.id) ? h('p', { class: 'muted small' }, 'Aucune académie pour cette classe : créez-les dans l’onglet « Académies ».') : null) : null,
      gen.type === 'materiel' && FI.materials().length ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => { gen.text.materiel = FI.materials().map(m => m.name).join('\n'); rerender(); } }, 'Reprendre la liste du matériel') : null,
      textArea,
      field('Format', h('select', { 'data-testid': 'labels-format', onchange: (e) => { gen.formatId = e.target.value; const f = L.FORMATS.find(x => x.id === gen.formatId); gen.margin = f.margin; gen.gap = f.gap; rerender(); } }, L.FORMATS.map(f => h('option', { value: f.id, selected: gen.formatId === f.id }, f.label)))),
      gen.formatId === 'custom' ? h('div', { class: 'grid-2' },
        field('Largeur (mm)', h('input', { type: 'number', min: 10, max: 297, value: gen.custom.w, 'data-testid': 'labels-w', oninput: set((e) => { gen.custom.w = Number(e.target.value) || 10; }) })),
        field('Hauteur (mm)', h('input', { type: 'number', min: 10, max: 297, value: gen.custom.h, 'data-testid': 'labels-h', oninput: set((e) => { gen.custom.h = Number(e.target.value) || 10; }) }))) : null,
      lay.w < 200 ? h('div', { class: 'grid-2' },
        field('Marge de la feuille (mm)', h('input', { type: 'number', min: 0, max: 30, value: gen.margin, oninput: set((e) => { gen.margin = Number(e.target.value) || 0; }) })),
        field('Espace entre étiquettes (mm)', h('input', { type: 'number', min: 0, max: 20, value: gen.gap, oninput: set((e) => { gen.gap = Number(e.target.value) || 0; }) }))) : null,
      h('div', { class: 'grid-2' },
        field('Police', h('select', { 'data-testid': 'labels-font', onchange: set((e) => { gen.style.font = e.target.value; }) }, h('option', { value: '' }, `Charte (${L.charte().font})`), fonts.map(([v, l]) => h('option', { value: v, selected: gen.style.font === v }, l)))),
        field('Bordure', h('select', { onchange: set((e) => { gen.style.border = e.target.value; }) }, h('option', { value: '' }, 'Charte'), L.BORDERS.map(([v, l]) => h('option', { value: v, selected: gen.style.border === v }, l))))),
      h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: gen.style.fill, onchange: set((e) => { gen.style.fill = e.target.checked; }) }), 'Fond coloré clair'),
      h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: gen.style.cutMarks, onchange: set((e) => { gen.style.cutMarks = e.target.checked; }) }), 'Contour de découpe'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'labels-print', onclick: async () => { const its = itemsFor(cls); printPages(L.pages(its, fmtOf(), gen.style, await L.imageUrls(its)), fmtOf()); } }, icon('print', 16), 'Imprimer (taille réelle)'),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'labels-save', disabled: !items.length, onclick: () => saveSeries(cls) }, 'Enregistrer la série et retoucher')),
      h('p', { class: 'muted small' }, 'Imprimez à 100 % (« taille réelle »), sans « ajuster à la page ». Sur planche prédécoupée, faites d’abord un essai sur papier ordinaire et ajustez la marge si besoin.')),
    h('section', { class: 'card' }, info, preview));
}

async function saveSeries(cls) {
  const items = itemsFor(cls);
  const title = `${TYPES.find(t => t[0] === gen.type)[1].split(' (')[0]} — ${model.frShort(model.todayIso())}`;
  const r = await store.create('labelset', { classId: gen.type === 'eleves' ? cls?.id || null : null, title, kind: gen.type, format: fmtOf(), style: { ...gen.style }, opts: { ...gen.opts },
    items: items.map(it => ({ ...it, id: store.uid() })), version: 1, previousId: null }, `Série d’étiquettes « ${title} »`);
  location.hash = `#/etiquettes/${r.id}`;
}

function printPages(svgs, fmt) {
  if (!svgs.length) { toast('Rien à imprimer.', { kind: 'error' }); return; }
  const lay = L.layout(fmt);
  const root = document.getElementById('print-root');
  document.getElementById('page-style')?.remove();
  document.head.append(h('style', { id: 'page-style' }, `@page { size: A4 ${lay.landscape ? 'landscape' : 'portrait'}; margin: 0; }`));
  root.replaceChildren(h('div', { class: 'labels-print' }, svgs.map(s => { s.querySelectorAll('.cut').forEach(c => c.setAttribute('stroke', '#bbb')); return s; })));
  document.body.classList.add('printing');
  L.fitTexts(root);
  const cleanup = () => { document.body.classList.remove('printing'); root.replaceChildren(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

// ───────── Séries enregistrées (retouche individuelle, versions)
function seriesList() {
  const all = store.all('labelset').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return all.length ? h('div', { class: 'stack' }, all.map(x => h('a', { class: 'card link-card', href: `#/etiquettes/${x.id}`, 'data-testid': 'labelset-card' },
    h('div', { class: 'card-head' }, h('h2', {}, x.title, ' ', badge(`version ${x.version}`, 'muted')), h('span', { class: 'muted' }, `${x.items.length} étiquette(s)`)),
    h('p', { class: 'muted small' }, `${x.format.w} × ${x.format.h} mm${x.classId ? ` · ${store.get(x.classId)?.name || ''}` : ''}`))))
    : emptyState('Aucune série enregistrée', 'Générez des étiquettes puis « Enregistrer la série » pour les retoucher une à une et les réimprimer plus tard.');
}

/** Élèves dont l'académie a changé depuis la série (nom, couleur, emblème ou rattachement). */
export function academyChanges(set) {
  if (set.kind !== 'eleves' || !set.classId || set.opts?.academy === false) return [];
  return set.items.filter(it => it.studentId).filter(it => {
    const a = L.academyOf(set.classId, it.studentId);
    return (a?.id || null) !== (it.academyId || null) || (a && (a.color !== it.color || JSON.stringify(a.emblem || null) !== JSON.stringify(it.emblem || null) || (set.opts?.academyName && ![it.line2, it.line3].includes(a.name))));
  });
}

function seriesPage(id, rerender) {
  const set = store.get(id);
  if (!set || set.deletedAt) return h('div', { class: 'page' }, pageHeader('Série introuvable'), h('a', { href: '#/etiquettes?t=series' }, '← Séries'));
  const changed = academyChanges(set);
  const versions = store.all('labelset').filter(x => x.id !== set.id && (x.previousId === set.id || set.previousId === x.id));
  const preview = h('div', { class: 'labels-preview stack', 'data-testid': 'labels-preview' });
  (async () => { preview.replaceChildren(...L.pages(set.items, set.format, set.style, await L.imageUrls(set.items))); L.fitWhenReady(preview); })();
  const saveItem = (i, patch) => store.update(set.id, { items: set.items.map((x, j) => (j === i ? { ...x, ...patch, edited: true } : x)) }, 'Étiquette retouchée', { quiet: true });
  const lay = L.layout(set.format);
  return h('div', { class: 'page' },
    h('p', {}, h('a', { href: '#/etiquettes?t=series', class: 'back' }, '← Séries')),
    pageHeader(set.title, { subtitle: `Version ${set.version} · ${set.items.length} étiquette(s) · ${set.format.w} × ${set.format.h} mm · ${lay.perPage} par page`,
      actions: [h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'series-print', onclick: async () => printPages(L.pages(store.get(set.id).items, set.format, set.style, await L.imageUrls(set.items)), set.format) }, icon('print', 16), 'Imprimer (taille réelle)')] }),
    changed.length ? h('div', { class: 'card notice', 'data-testid': 'academy-changed' },
      h('p', {}, `Les académies ont changé depuis cette série pour ${changed.length} élève(s) : ${changed.map(c => c.line1).join(', ')}.`),
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'series-refresh', onclick: () => refreshVersion(set) }, 'Créer une version actualisée'),
      h('p', { class: 'muted small' }, 'Cette version-ci reste enregistrée telle quelle ; vos retouches de texte sont reprises dans la nouvelle.')) : null,
    versions.length ? h('p', { class: 'muted small' }, 'Autres versions : ', versions.map(v => h('a', { href: `#/etiquettes/${v.id}`, style: { marginRight: '8px' } }, `version ${v.version}`))) : null,
    h('div', { class: 'atelier' },
      h('section', { class: 'card' }, h('h2', {}, 'Retouche individuelle'),
        h('div', { class: 'stack' }, set.items.map((it, i) => h('div', { class: 'label-edit', 'data-testid': 'label-edit' },
          h('input', { value: it.line1 || '', 'aria-label': 'Ligne 1', onchange: (e) => saveItem(i, { line1: e.target.value }) }),
          h('input', { value: it.line2 || '', 'aria-label': 'Ligne 2', placeholder: 'ligne 2', onchange: (e) => saveItem(i, { line2: e.target.value }) }),
          h('input', { type: 'color', value: it.color || L.charte().colors[0], 'aria-label': 'Couleur', onchange: (e) => saveItem(i, { color: e.target.value }) }),
          h('button', { class: 'btn btn-small', type: 'button', 'aria-label': 'Retirer cette étiquette', onclick: () => store.update(set.id, { items: set.items.filter((_, j) => j !== i) }, 'Étiquette retirée') }, '×')))),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => store.update(set.id, { items: [...set.items, { id: store.uid(), line1: 'Nouvelle étiquette', line2: '' }] }, 'Étiquette ajoutée') }, '+ étiquette')),
      h('section', { class: 'card' }, preview)));
  void rerender;
}

async function refreshVersion(set) {
  const items = set.items.map(it => {
    if (!it.studentId) return it;
    const a = L.academyOf(set.classId, it.studentId);
    const s = store.get(it.studentId);
    const auto = L.studentItems(set.classId, set.opts).find(x => x.studentId === it.studentId);
    return { ...it, id: store.uid(), color: a?.color || null, emblem: a?.emblem || null, academyId: a?.id || null,
      line1: it.edited ? it.line1 : auto?.line1 || s?.firstName, line2: it.edited ? it.line2 : auto?.line2 || '', line3: it.edited ? it.line3 : auto?.line3 || '' };
  });
  const r = await store.create('labelset', { classId: set.classId, kind: set.kind, format: structuredClone(set.format), style: structuredClone(set.style || {}), opts: structuredClone(set.opts || {}), items, version: (set.version || 1) + 1, previousId: set.id, title: set.title.replace(/ \(v\d+\)$/, '') + ` (v${(set.version || 1) + 1})` }, 'Version actualisée des étiquettes');
  location.hash = `#/etiquettes/${r.id}`;
}

// ───────── Académies (ensemble de groupes « académies » de la classe)
function academiesTab(cls, rerender) {
  const set = L.academySet(cls.id);
  if (!set) {
    return h('div', { class: 'card' }, h('h2', {}, 'Académies de la classe'),
      h('p', { class: 'muted' }, 'Des groupes permanents avec un nom, une couleur et un emblème, utilisés pour les étiquettes, les équipes et le plan de classe.'),
      h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'academies-create', onclick: async () => {
        const names = ['Académie 1', 'Académie 2', 'Académie 3', 'Académie 4'];
        const keys = ['etoile', 'flamme', 'feuille', 'goutte'];
        await store.create('groupset', { classId: cls.id, name: 'Académies', kind: 'académies', permanent: true, groups: names.map((n, i) => ({ ...G.newGroup(i), name: n, emblem: { kind: 'symbol', key: keys[i] } })) }, 'Académies créées');
        rerender();
      } }, 'Créer 4 académies (modifiables)'));
  }
  const save = (groups, label) => store.update(set.id, { groups }, label);
  const assigned = new Set(set.groups.flatMap(g => g.memberIds || []));
  const free = model.studentsOfClass(cls.id).map(x => x.student).filter(s => !assigned.has(s.id));
  return h('div', { class: 'stack' },
    h('div', { class: 'grid-2' }, set.groups.map((g, i) => {
      const preview = h('span', { class: 'emblem-preview' });
      const draw = async () => {
        const svg = L.S('svg', { viewBox: '0 0 100 100', width: 44, height: 44 });
        let url = null; if (g.emblem?.kind === 'image') { const u = await L.imageUrls([{ emblem: g.emblem }]); url = u[g.emblem.blobId]; }
        const n = L.emblemNode(g.emblem, 0, 0, 100, g.color, url); if (n) svg.append(n);
        preview.replaceChildren(svg);
      };
      draw();
      return h('section', { class: 'card', style: { borderTop: `6px solid ${g.color}` }, 'data-testid': 'academy' },
        h('div', { class: 'row' }, preview,
          h('input', { value: g.name, 'aria-label': 'Nom de l’académie', 'data-testid': 'academy-name', onchange: (e) => save(set.groups.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)), 'Nom de l’académie') }),
          h('input', { type: 'color', value: g.color, 'aria-label': 'Couleur', 'data-testid': 'academy-color', onchange: (e) => save(set.groups.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)), 'Couleur de l’académie') })),
        field('Emblème', h('select', { 'data-testid': 'academy-emblem', onchange: async (e) => {
          if (e.target.value === '__image') {
            const files = await pickFiles({ accept: 'image/*', multiple: false });
            if (!files?.length) { rerender(); return; }
            const blobId = await store.putBlob(files[0]);
            await save(set.groups.map((x, j) => (j === i ? { ...x, emblem: { kind: 'image', blobId, name: files[0].name } } : x)), 'Emblème importé');
          } else await save(set.groups.map((x, j) => (j === i ? { ...x, emblem: e.target.value ? { kind: 'symbol', key: e.target.value } : null } : x)), 'Emblème de l’académie');
        } }, h('option', { value: '' }, 'Aucun'), Object.entries(L.EMBLEMS).map(([k, v]) => h('option', { value: k, selected: g.emblem?.kind === 'symbol' && g.emblem.key === k }, v.label)),
          h('option', { value: '__image', selected: g.emblem?.kind === 'image' }, g.emblem?.kind === 'image' ? `Image : ${g.emblem.name || 'importée'}` : 'Importer une image…'))),
        h('p', { class: 'small' }, (g.memberIds || []).map(id => store.get(id)?.firstName).filter(Boolean).join(', ') || h('span', { class: 'muted' }, 'Aucun élève')),
        h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'academy-members', onclick: async () => {
          const items = model.studentsOfClass(cls.id).map(x => ({ id: x.student.id, label: model.fullName(x.student), detail: set.groups.find(o => o.id !== g.id && (o.memberIds || []).includes(x.student.id))?.name || '' }));
          const sel = await pickMany({ title: `Élèves de « ${g.name} »`, items, selected: g.memberIds || [] });
          if (!sel) return;
          // Un élève n'appartient qu'à une académie : il quitte l'autre.
          await save(set.groups.map(x => (x.id === g.id ? { ...x, memberIds: sel } : { ...x, memberIds: (x.memberIds || []).filter(id => !sel.includes(id)) })), `Élèves de « ${g.name} »`);
        } }, 'Choisir les élèves'));
    })),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn', type: 'button', onclick: () => save([...set.groups, { ...G.newGroup(set.groups.length), name: `Académie ${set.groups.length + 1}`, emblem: { kind: 'symbol', key: 'etoile' } }], 'Académie ajoutée') }, '+ académie'),
      free.length ? h('button', { class: 'btn', type: 'button', 'data-testid': 'academies-random', onclick: async () => {
        const counts = set.groups.map(g => (g.memberIds || []).length);
        const groups = set.groups.map(g => ({ ...g, memberIds: [...(g.memberIds || [])] }));
        for (const s of G.randomGroups(free.map(x => x.id), { count: 1 })[0]) { const k = counts.indexOf(Math.min(...counts)); groups[k].memberIds.push(s); counts[k]++; }
        await save(groups, 'Élèves répartis dans les académies');
      } }, `Répartir les ${free.length} élève(s) sans académie`) : null,
      h('a', { class: 'btn', href: '#/plan' }, 'Voir dans Plan de classe et groupes')),
    h('p', { class: 'muted small' }, 'Les emblèmes proposés sont des dessins simples créés pour l’application ; vous pouvez importer vos propres images.'));
}
