// Retours du 25/10 : plan de classe (taille, rangements), carnet de liaison, angles sans chevauchement,
// figures dessinées par l'enseignante, repères pour mesurer en projection, dictée « mes mots », étiquettes.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let passed = 0, failed = 0; const results = [];
let page;
async function test(name, fn) {
  try { await fn(); passed++; results.push(`✔ ${name}`); console.log(`✔ ${name}`); }
  catch (e) { failed++; results.push(`✘ ${name}\n    ${e.message.split('\n')[0]}`); console.log(`✘ ${name}\n   `, e.message); try { await page.screenshot({ path: `${OUT}echec-retours-${failed}.png`, fullPage: true }); } catch { /* */ } }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 }, bypassCSP: true });
page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(350); };
const S = (fn, arg) => page.evaluate(async ([src, a]) => {
  const m = { store: await import('./js/store.js'), model: await import('./js/model.js') };
  return (new Function(...Object.keys(m), 'a', `return (async () => { ${src} })()`))(...Object.values(m), a);
}, [fn, arg]);
const modalBtn = (name) => page.locator('.modal').getByRole('button', { name, exact: true });

await page.goto(BASE); await page.waitForFunction(() => window.__classeurReady === true);
await page.evaluate(async () => (await import('./js/demo.js')).loadDemo());
await page.waitForTimeout(400);
await S(`const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentYearId: cls.yearId, currentClassId: cls.id });`);

await test('Plan de classe : taille de la salle, rangements, taille d’un élément', async () => {
  await go('#/plan');
  if (!(await page.getByTestId('plan-svg').count())) { await page.getByTestId('new-layout').click(); await page.locator('.modal button.btn-primary').last().click(); await page.waitForTimeout(300); }
  await page.getByTestId('room-w').fill('800'); await page.getByTestId('room-w').dispatchEvent('change'); await page.waitForTimeout(250);
  eq(await page.getByTestId('plan-svg').getAttribute('viewBox'), '0 0 800 700', 'salle de 8 m');
  await page.getByTestId('add-item').selectOption('casiers'); await page.waitForTimeout(250);
  assert(await page.getByTestId('plan-item-casiers').count() === 1, 'casiers ajoutés');
  await page.getByTestId('add-armoire').click(); await page.waitForTimeout(250);
  await page.getByTestId('item-w').fill('150'); await page.getByTestId('item-w').dispatchEvent('change'); await page.waitForTimeout(250);
  const it = await S(`return store.all('layout').flatMap(l => l.items || []).find(i => i.kind === 'armoire');`);
  eq(it.w, 150, 'largeur de l’armoire');
  // poignée d'agrandissement
  const hdl = page.getByTestId('plan-resize'); await hdl.scrollIntoViewIfNeeded(); const b = await hdl.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x + 60, b.y + 40, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(300);
  const it2 = await S(`return store.all('layout').flatMap(l => l.items || []).find(i => i.kind === 'armoire');`);
  assert(it2.w > 150 && it2.h > 60, `agrandie à la poignée (${it2.w} × ${it2.h})`);
});

await test('Carnet de liaison : noter pour plusieurs élèves, mot à faire signer, bilan, signé', async () => {
  await go('#/messages');
  await page.getByTestId('carnet-new').click();
  await page.locator('[data-testid=carnet-pick][data-name=Nino]').check(); await page.locator('[data-testid=carnet-pick][data-name=Lou]').check();
  await page.getByTestId('carnet-cat-oubli').click(); await page.getByTestId('carnet-text').fill('cahier du jour'); await page.getByTestId('carnet-written').check();
  await page.getByTestId('carnet-save').click(); await page.waitForTimeout(300);
  eq(await S(`return store.all('carnet').length;`), 2, '2 notes');
  assert((await page.getByTestId('carnet-unsigned').innerText()).includes('Nino'), 'mot de Nino à faire signer');
  assert((await page.getByTestId('carnet-recap').innerText()).toLowerCase().includes('oubli de matériel'), 'bilan par motif');
  await page.getByTestId('carnet-unsigned').getByTestId('carnet-sign').first().click(); await page.waitForTimeout(300);
  eq(await S(`return store.all('carnet').filter(x => x.signed).length;`), 1, 'un mot signé');
  assert(await page.getByTestId('msg-new').count() === 1, 'rédaction d’un mot toujours possible');
});

await test('Angles : étiquette jamais sur la figure', async () => {
  await go('#/atelier'); await page.getByTestId('tool-angles').click(); await page.waitForTimeout(200);
  for (const seed of [1, 7, 42, 99, 1234, 5555]) {
    await page.getByTestId('p-graine').fill(String(seed)); await page.waitForTimeout(120);
    const bad = await page.evaluate(() => [...document.querySelectorAll('[data-testid=atelier-preview] [data-testid=angle]')].filter(g => {
      const path = g.querySelector('path').getBBox(); const t = g.querySelector('[data-role=label]').getBBox();
      return t.y < path.y + path.height + 1; }).length);
    eq(bad, 0, `fiche ${seed} : chevauchement`);
  }
});

await test('Symétrie : figures dessinées par l’enseignante, correction symétrique', async () => {
  await page.getByTestId('tool-symetrie').click(); await page.waitForTimeout(150);
  await page.getByTestId('p-source').selectOption('mes figures'); await page.waitForTimeout(200);
  await page.getByTestId('draw-figures').click();
  for (const n of ['2,2', '6,2', '6,6', '2,8']) await page.locator(`[data-testid=draw-svg] [data-node="${n}"]`).click();
  eq(await page.locator('[data-testid=draw-svg] [data-node="12,2"].draw-node').count(), 0, 'côté droit de l’axe non disponible');
  await page.getByTestId('draw-ok').click(); await page.waitForTimeout(200);
  await page.getByTestId('correction').check(); await page.waitForTimeout(150);
  const fig = await page.locator('[data-testid=atelier-preview] [data-testid=exercise]').first().getAttribute('data-figure');
  eq(fig, JSON.stringify([[2, 2], [6, 2], [6, 6], [2, 8]]), 'figure dessinée utilisée');
  eq(await page.locator('[data-testid=atelier-preview] [data-role=correction]').first().getAttribute('data-points'), JSON.stringify([[14, 2], [10, 2], [10, 6], [14, 8]]), 'symétrique exact');
  await page.getByTestId('correction').uncheck();
});

await test('Reproduction : figure ouverte dessinée', async () => {
  await page.getByTestId('tool-reproduction').click(); await page.waitForTimeout(150);
  await page.getByTestId('p-source').selectOption('mes figures'); await page.waitForTimeout(200);
  await page.getByTestId('draw-figures').click();
  for (const n of ['1,1', '5,1', '5,4']) await page.locator(`[data-testid=draw-svg] [data-node="${n}"]`).click();
  await page.getByTestId('draw-closed').uncheck();
  await page.getByTestId('draw-ok').click(); await page.waitForTimeout(200);
  assert(await page.locator('[data-testid=atelier-preview] polyline[data-role=figure]').count() === 1, 'ligne ouverte');
});

await test('Figures à mesurer : quadrillage en cm et règle, sans les réponses', async () => {
  await page.getByTestId('tool-figures').click(); await page.waitForTimeout(150);
  await page.getByTestId('p-reperes').selectOption('les deux'); await page.waitForTimeout(150);
  assert(await page.locator('[data-testid=atelier-preview] [data-testid=reperes-grid]').count() === 1, 'quadrillage');
  assert(await page.locator('[data-testid=atelier-preview] [data-testid=reperes-ruler] text').count() >= 16, 'règle de 0 à 15');
  const txt = await page.locator('[data-testid=atelier-preview]').innerText();
  assert(!/\d cm/.test(txt.replace('cm', '')), 'aucune mesure donnée');
  const overlap = await page.evaluate(() => { const r = document.querySelector('[data-testid=reperes-ruler]').getBBox(); return [...document.querySelectorAll('[data-testid=atelier-preview] [data-testid=figure]')].some(f => { const b = f.getBBox(); return b.y + b.height > r.y; }); });
  eq(overlap, false, 'figures au-dessus de la règle');
});

await test('Dictée : mes mots, mélangés, sur le corrigé', async () => {
  await go('#/exercices?t=dictee'); await page.waitForTimeout(200);
  const tab = page.getByRole('button', { name: 'Dictée de mots' }); if (await tab.count()) await tab.first().click();
  await page.getByTestId('dict-mode-miens').click(); await page.waitForTimeout(150);
  await page.getByTestId('dict-words').fill('château, girafe\nrenard; hibou'); await page.waitForTimeout(150);
  await page.getByTestId('dict-shuffle').check(); await page.waitForTimeout(150);
  const items = await page.locator('[data-testid=ex-item]').count();
  eq(items, 4, '4 lignes');
  const X = await page.evaluate(async () => (await import('./js/exercices.js')).dictee({ mode: 'mes mots', mots: 'château, girafe\nrenard; hibou', melanger: true, seed: 3 }).map(x => x.w).sort());
  eq(JSON.stringify(X), JSON.stringify(['château', 'girafe', 'hibou', 'renard']), 'tous les mots');
});

await test('Étiquettes : aucun prénom ne dépasse, tous formats et polices', async () => {
  await S(`const st = model.studentsOfClass(store.getSettings().currentClassId).map(x => x.student); if (st[0]) await store.update(st[0].id, { firstName: 'Marie-Antoinette-Gwendoline' }, 'x');`);
  const res = await page.evaluate(async () => {
    const L = await import('./js/labels.js'); const F = await import('./js/fonts.js');
    const out = [];
    for (const font of F.available().map(f => f[0])) for (const fmt of L.FORMATS) for (const border of ['simple', 'double', 'arrondi']) {
      const host = document.createElement('div'); document.body.append(host);
      const svgs = L.pages([{ line1: 'Marie-Antoinette-Gwendoline', line2: 'CE2 B (exemple)' }, { line1: 'Lou' }], fmt, { font, border, borderWidth: 2 }, {});
      host.append(...svgs); await document.fonts.ready; L.fitTexts(host);
      for (const t of host.querySelectorAll('text[data-maxw]')) if (t.getComputedTextLength() > Number(t.getAttribute('data-maxw')) + 0.2) out.push(`${font} ${fmt.id} ${border}`);
      host.remove();
    }
    return out;
  });
  eq(res.length, 0, res.slice(0, 5).join(' | '));
  await go('#/etiquettes'); await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}etiquettes.png` });
});

await test('Cahier journal : fiche d’activité complète (durée, organisation, domaine, déroulement, lieu, compétences…)', async () => {
  await S(`await store.create('referential', { name: 'Réf. test (exemple)', version: '1', levels: ['CE2'], status: 'validé', items: [{ id: 'k1', code: 'NC1', label: 'Calculer mentalement (exemple)' }] }, 'r');`);
  await go('#/cahier?d=2026-11-03');
  await page.getByTestId('add-activity').click();
  await page.getByTestId('act-start').fill('13:30'); await page.getByTestId('act-duration').fill('45'); await page.getByTestId('act-duration').dispatchEvent('change');
  eq(await page.getByTestId('act-end').inputValue(), '14:15', 'fin calculée depuis la durée');
  await page.getByTestId('act-org-groupes').check(); await page.getByTestId('act-declo').check(); await page.getByTestId('act-hors').check();
  await page.getByTestId('act-domain').fill('Nombres, calcul et résolution de problèmes'); await page.getByTestId('act-subject').selectOption('Mathématiques');
  await page.getByTestId('act-title').fill('Calcul mental (exemple)'); await page.getByTestId('act-objective').fill('Ajouter 9 (exemple)');
  await page.getByTestId('act-deroule').fill('5 min Rappel\n20 min Jeu du furet'); await page.getByTestId('act-materiel').fill('ardoises'); await page.getByTestId('act-lieu').fill('BCD / bibliothèque');
  await page.getByTestId('act-notes').fill('Prévoir la BCD libre'); await page.getByTestId('act-comp-search').fill('NC1'); await page.getByTestId('act-comp-item').first().click();
  await page.getByTestId('act-save').click(); await page.waitForTimeout(350);
  const o = await S(`return store.all('occurrence').find(x => x.title === 'Calcul mental (exemple)');`);
  eq(JSON.stringify([o.start, o.end, o.org, o.decloisonnement, o.horsHoraires, o.domain, o.lieu, o.competencyIds]), JSON.stringify(['13:30', '14:15', 'groupes', true, true, 'Nombres, calcul et résolution de problèmes', 'BCD / bibliothèque', ['k1']]), 'champs enregistrés');
  const card = page.getByTestId('entry').filter({ hasText: 'Calcul mental (exemple)' });
  const t = await card.innerText();
  for (const x of ['45 min', 'décloisonnement', 'hors horaires', 'BCD', 'Ajouter 9', 'ardoises', 'Prévoir la BCD', 'NC1']) assert(t.includes(x), `carte : ${x}`);
  // Modifier : la fiche reprend les valeurs
  await card.getByTestId('entry-more').click(); await card.getByTestId('edit-activity').click();
  eq(await page.getByTestId('act-lieu').inputValue(), 'BCD / bibliothèque', 'valeurs reprises');
  await page.getByTestId('act-lieu').fill('Cour'); await page.getByTestId('act-save').click(); await page.waitForTimeout(300);
  eq(await S(`return store.all('occurrence').find(x => x.title === 'Calcul mental (exemple)').lieu;`), 'Cour', 'modification enregistrée');
});

await test('Surveillances : accueils du matin et de 13 h 20, répartition en minutes, « je surveille » sur Aujourd’hui', async () => {
  await go('#/recreation');
  for (const [n, days] of [['Julia (exemple)', ['Lun', 'Mar']], ['Mme Durand (exemple)', []]]) {
    await page.getByTestId('recre-name').fill(n);
    for (const d of days) await page.locator('.page .chip', { hasText: d }).first().locator('input').check();
    await page.getByTestId('recre-add').click(); await page.waitForTimeout(250);
  }
  await page.getByTestId('recre-add-slot-1').click(); await page.waitForTimeout(250);
  await page.getByTestId('recre-add-slot-2').click(); await page.waitForTimeout(250);
  const t = await page.getByTestId('recre-table').evaluate(e => e.textContent);
  assert(t.includes('Accueil du matin (8 h 20 – 8 h 30)') && t.includes('Accueil de l’après-midi (13 h 20 – 13 h 30)'), 'accueils dans le planning : ' + t.slice(0, 300));
  const rows = await page.getByTestId('recre-table').locator('tbody th').allTextContents();
  assert(rows[0].startsWith('Accueil du matin'), `ordre de la journée : ${rows.join(' / ')}`);
  await page.getByTestId('recre-distribute').click(); await page.waitForTimeout(300);
  const r = await page.evaluate(async () => { const R = await import('./js/pages/recreation.js'); const p = R.planOf(); return { empty: Object.entries(p.grid).filter(([, v]) => !v.length).length, cells: Object.keys(p.grid).length }; });
  eq(r.empty, 0, 'aucune case vide'); eq(r.cells, 16, '4 surveillances × 4 jours');
  await page.locator('input[name=recre-me]').first().check(); await page.waitForTimeout(200);
  const me = await S(`return store.getSettings().recreMe;`);
  const d = await page.evaluate(async (me) => (await import('./js/pages/recreation.js')).dutiesOn(me, '2026-11-02').length, me);
  assert(d >= 1, 'au moins une surveillance le lundi pour la personne choisie');
});

await test('Téléphone : plan, carnet, atelier sans débordement', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const r of ['#/plan', '#/messages', '#/atelier']) { await go(r); eq(await page.evaluate(() => document.documentElement.scrollWidth <= 392), true, `${r} déborde`); }
  await go('#/messages'); await page.screenshot({ path: `${OUT}carnet-telephone.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await go('#/plan'); await page.screenshot({ path: `${OUT}plan.png` });
  await go('#/messages'); await page.screenshot({ path: `${OUT}carnet.png`, fullPage: true });
});

await test('Aucune erreur dans la console', async () => { eq(errors.length, 0, errors.join(' | ')); });
await browser.close();
writeFileSync(`${OUT}resultats-retours.txt`, results.join('\n'));
console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
