// Étape 4 bis : informations élèves (tableau de l'agenda), outils de classe, lecture de texte (OCR),
// mots aux familles, appréciations, AESH, incident, registre de soins. Scénarios dans un vrai navigateur.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let passed = 0, failed = 0; const results = [];
let page;
async function test(name, fn) {
  try { await fn(); passed++; results.push(`✔ ${name}`); console.log(`✔ ${name}`); }
  catch (e) { failed++; results.push(`✘ ${name}\n    ${e.message.split('\n')[0]}`); console.log(`✘ ${name}\n   `, e.message); try { await page.screenshot({ path: `${OUT}echec4b-${failed}.png`, fullPage: true }); } catch { /* */ } }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 }, bypassCSP: true });
page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const ready = () => page.waitForFunction(() => window.__classeurReady === true);
const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(250); };
const S = (fn, arg) => page.evaluate(async ([src, a]) => {
  const m = { store: await import('./js/store.js'), model: await import('./js/model.js'), E: await import('./js/eleve.js'), V: await import('./js/vie.js'), I: await import('./js/infos.js'), FI: await import('./js/finance.js') };
  return (new Function(...Object.keys(m), 'a', `return (async () => { ${src} })()`))(...Object.values(m), a);
}, [fn, arg]);
const modalBtn = (name) => page.locator('.modal-foot button', { hasText: name });
const unlock = async () => { const b = page.getByTestId('unlock').first(); if (await b.count()) { await b.click(); await modalBtn('Afficher').click(); await page.waitForTimeout(250); } };

await page.goto(BASE); await ready();
await page.evaluate(async () => (await import('./js/demo.js')).loadDemo());
await page.waitForTimeout(400);
const ids = await S(`const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentClassId: cls.id, userName: 'Julia' });
  const st = (n) => store.all('student').find(s => s.firstName === n).id;
  return { cls: cls.id, lou: st('Lou'), nino: st('Nino'), year: cls.yearId };`);

await test('Nouvelles pages sans erreur ni « à venir »', async () => {
  for (const r of ['#/infos', '#/outils', '#/outils?o=lire', '#/outils?o=sono', '#/outils?o=pot', '#/outils?o=abaque', '#/outils?o=cent', '#/outils?o=numeration', '#/outils?o=reglettes', '#/outils?o=pourcent', '#/redaction', '#/redaction?t=appreciations', '#/redaction?t=aesh', '#/redaction?t=incident', '#/redaction?t=soins']) {
    await go(r);
    assert(!(await page.locator('.page').innerText()).includes('à venir'), `${r} affiche « à venir »`);
  }
  eq(errors.length, 0, errors.join(' | '));
});

await test('Informations élèves : une ligne par élève, colonnes de l’agenda', async () => {
  await go('#/infos');
  const n = await S(`return model.studentsOfClass(a, { includeFuture: true }).length;`, ids.cls);
  eq(await page.getByTestId('info-row').count(), n, 'une ligne par élève');
  const head = await page.getByTestId('info-table').locator('thead').textContent();
  for (const c of ['Fiche rens.', 'Coop.', 'Assur.', 'Image', 'Cantine', 'Bus', 'Lunettes', 'Gaucher']) assert(head.includes(c), `colonne ${c}`);
  assert(!head.includes('PAI') && !head.includes('Sit. fam.'), 'colonnes confidentielles masquées par défaut');
});

await test('Informations élèves : la case « assurance » écrit dans la fiche élève (sans double saisie)', async () => {
  const row = page.getByTestId('info-row').filter({ hasText: 'Lou' });
  const before = await S(`const t = E.docTemplates().find(x => x.id === 'assurance'); return E.docState(E.docOf(a.lou, a.year, 'assurance'), t).status;`, ids);
  await row.getByTestId('info-assurance').click(); await page.waitForTimeout(200);
  const after = await S(`const t = E.docTemplates().find(x => x.id === 'assurance'); return E.docState(E.docOf(a.lou, a.year, 'assurance'), t).status;`, ids);
  assert(before !== after, `statut changé (${before} → ${after})`);
  await go(`#/eleve/${ids.lou}?t=documents`);
  eq(await page.getByTestId('doc-assurance').getByTestId('doc-status').inputValue(), after, 'la fiche élève montre le même statut');
});

await test('Informations élèves : lunettes (durable), coopérative (année), bus et cantine reliés', async () => {
  await go('#/infos');
  const row = () => page.getByTestId('info-row').filter({ hasText: 'Nino' });
  await row().getByTestId('info-lunettes').click(); await page.waitForTimeout(150);
  await row().getByTestId('info-coop').click(); await page.waitForTimeout(150);
  await row().getByTestId('info-bus').click(); await page.waitForTimeout(150);
  const r = await S(`const s = store.get(a.nino); return { lunettes: s.infos?.lunettes, coop: I.yearOf(a.nino, a.year)?.values?.coop, bus: s.departure?.mode };`, ids);
  eq(r.lunettes, true, 'lunettes sur la fiche'); eq(r.coop, true, 'coopérative de l’année'); eq(r.bus, 'transport', 'sortie habituelle = transport');
  await row().getByTestId('info-cantine').click();
  const boxes = page.locator('.modal .chip input'); for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).uncheck();
  await boxes.first().check(); await boxes.nth(1).check();
  await modalBtn('Enregistrer').click(); await page.waitForTimeout(200);
  const days = await S(`return V.planOf(a.cls).plans[a.nino].Cantine;`, ids);
  eq(days.length, 2, 'semaine type de cantine mise à jour');
  assert((await row().locator('[data-col=cantine]').innerText()).includes('L'), 'jours affichés');
  // Filtre « seulement : lunettes »
  await page.getByTestId('info-only').selectOption('lunettes'); await page.waitForTimeout(100);
  eq(await page.getByTestId('info-row').count(), 1, 'filtre sur une colonne');
  await page.getByTestId('info-only').selectOption('');
});

await test('Informations élèves : colonnes confidentielles après déverrouillage, stockées à part', async () => {
  await go('#/infos'); await unlock();
  const head = await page.getByTestId('info-table').locator('thead').textContent();
  assert(head.includes('PAI') && head.includes('Sit. fam.'), 'colonnes confidentielles visibles');
  const row = page.getByTestId('info-row').filter({ hasText: 'Lou' });
  await row.getByTestId('info-famille').fill('garde alternée (exemple fictif)'); await row.getByTestId('info-famille').blur(); await page.waitForTimeout(200);
  const r = await S(`return { conf: I.confOf(a.lou)?.values?.famille, sens: I.confOf(a.lou)?.sensitive, onStudent: JSON.stringify(store.get(a.lou)).includes('alternée') };`, ids);
  eq(r.conf, 'garde alternée (exemple fictif)', 'valeur confidentielle'); eq(r.sens, true, 'marquée confidentielle'); eq(r.onStudent, false, 'pas sur la fiche ordinaire');
  // Recherche : jamais indexé
  await page.evaluate(async () => (await import('./js/confidential.js')).lock());
  await go('#/recherche?q=alternée');
  assert(!(await page.locator('.page').innerText()).includes('Lou'), 'non trouvé par la recherche');
});

await test('Informations élèves : colonne ajoutée, impression (remplie et vierge)', async () => {
  await go('#/infos');
  await page.getByTestId('info-columns').click();
  await page.getByTestId('new-col-label').fill('Natation');
  await page.getByTestId('add-col').click();
  await modalBtn('Enregistrer').click(); await page.waitForTimeout(250);
  assert((await page.getByTestId('info-table').locator('thead').textContent()).includes('Natation'), 'nouvelle colonne');
  await page.evaluate(() => { window.print = () => { window.__printed = document.getElementById('print-root').innerText; }; });
  await page.getByTestId('info-print').click(); await modalBtn('Imprimer').click(); await page.waitForTimeout(150);
  let txt = await page.evaluate(() => window.__printed);
  assert(txt.includes('Informations élèves') && txt.includes('Lou') && txt.includes('✓'), 'impression remplie');
  assert(!txt.includes('alternée'), 'aucune donnée confidentielle imprimée par défaut');
  await page.getByTestId('info-print').click(); await page.getByTestId('print-blank').check(); await modalBtn('Imprimer').click(); await page.waitForTimeout(150);
  txt = await page.evaluate(() => window.__printed);
  assert(txt.includes('Lou') && !txt.includes('✓'), 'grille vierge avec noms');
  await page.screenshot({ path: `${OUT}etape4b-infos.png` });
});

await test('OCR : texte lu dans une image, sur l’appareil, puis envoyé au tableau Seyès', async () => {
  await go('#/outils?o=tapuscrit');
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 260; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 1200, 260); x.fillStyle = '#111'; x.font = '44px serif';
    x.fillText('Le loup marche dans la forêt.', 40, 100); x.fillText('Il cherche sa maison.', 40, 180);
    return c.toDataURL('image/png').split(',')[1];
  });
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('ocr-pick').click()]);
  await chooser.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForFunction(() => /Terminé|impossible|Aucun/.test(document.querySelector('[data-testid=ocr-status]')?.textContent || ''), null, { timeout: 60000 });
  const text = await page.getByTestId('ocr-text').inputValue();
  assert(/loup marche dans la forêt/.test(text) && /cherche sa maison/.test(text), `texte lu : ${text}`);
  await page.screenshot({ path: `${OUT}etape4b-ocr.png` });
  await page.getByTestId('ocr-to-seyes').click(); await page.waitForTimeout(400);
  assert((await page.getByTestId('p-texte').inputValue()).includes('loup'), 'texte repris dans le tableau d’écriture');
});

await test('OCR : texte d’une image des Fichiers enregistré et retrouvé par la recherche', async () => {
  const fid = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 900; c.height = 160; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 900, 160); x.fillStyle = '#111'; x.font = '46px sans-serif'; x.fillText('Photosynthèse des plantes', 30, 100);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const F = await import('./js/pages/files.js');
    const [f] = await F.addFiles([new File([blob], 'affiche.png', { type: 'image/png' })]);
    return f.id;
  });
  await go('#/fichiers');
  await page.locator('tr, .card, li').filter({ hasText: 'affiche.png' }).getByRole('button', { name: 'Aperçu' }).first().click();
  await page.getByTestId('file-ocr').click();
  await page.waitForFunction(() => (document.querySelector('[data-testid=file-ocr-text]')?.value || '').length > 5, null, { timeout: 60000 });
  await page.keyboard.press('Escape');
  const saved = await S(`return store.get(a).ocrText;`, fid);
  assert(/Photosynth/.test(saved), `texte enregistré : ${saved}`);
  await go('#/recherche?q=photosynthèse');
  assert((await page.locator('.page').innerText()).includes('affiche.png'), 'retrouvé par la recherche');
});

await test('Outils : pot de récompense enregistré, abaque et échange, tableau des nombres, pourcentages', async () => {
  await go('#/outils?o=pot');
  await page.getByTestId('pot-add').click(); await page.waitForTimeout(150);
  await page.getByTestId('pot-add').click(); await page.waitForTimeout(150);
  eq(await page.getByTestId('pot-count').innerText(), '2 / 10', 'deux billes');
  eq(await S(`return store.all('rewardjar').find(j => j.classId === a).count;`, ids.cls), 2, 'pot enregistré pour la classe');
  await go('#/outils?o=abaque');
  for (let i = 0; i < 12; i++) await page.getByTestId('ab-add-U').click();
  assert((await page.getByTestId('ab-value').innerText()).includes('échangez'), '12 unités : échange proposé');
  await page.getByTestId('ab-exchange').click();
  eq(await page.getByTestId('ab-value').innerText(), '12', 'après échange : 1 dizaine 2 unités');
  await go('#/outils?o=cent');
  await page.getByTestId('cent-hide-all').click();
  eq(await page.locator('.cent-cell.hid').count(), 100, 'tous cachés');
  await page.locator('.cent-cell').nth(37).click();
  eq(await page.locator('.cent-cell').nth(37).innerText(), '37', 'case montrée');
  await page.getByTestId('cent-mode-voisins').click(); await page.locator('.cent-cell').nth(45).click();
  eq(await page.locator('.cent-cell.near').count(), 4, '+1 −1 +10 −10');
  await go('#/outils?o=pourcent');
  await page.getByTestId('pct-words').fill('40'); await page.getByTestId('pct-errors').fill('6');
  assert((await page.getByTestId('pct-dictee').innerText()).startsWith('85 %'), 'dictée : 85 %');
  await go('#/outils?o=reglettes');
  await page.getByTestId('rod-3').click(); await page.getByTestId('rod-7').click();
  eq(await page.locator('.rod-piece').count(), 2, 'deux réglettes posées');
  await go('#/outils?o=numeration');
  await page.getByTestId('num-preset').selectOption('longueurs');
  assert((await page.getByTestId('num-table').innerText()).includes('dam'), 'tableau de conversion des longueurs');
  const z = await page.evaluate(async () => { const O = await import('./js/pages/outils.js'); return [O.zoneOf(O.levelFromRms(0.001), 45, 70), O.zoneOf(O.levelFromRms(0.5), 45, 70)]; });
  eq(z.join(','), 'calme,fort', 'sonomètre : zones');
});

await test('Mots : autorisation de sortie depuis un projet, un exemplaire par élève', async () => {
  const pid = await S(`const p = await store.create('project', { title: 'Sortie au musée (démo)', kind: 'sortie', date: '2026-12-03', perStudent: 500, yearId: a.year, classId: a.cls, participants: [], overrides: {}, budget: [], steps: [], subjects: [], contactIds: [], fileIds: [] }, 'p'); return p.id;`, ids);
  await go(`#/argent/projet/${pid}`);
  await page.getByTestId('project-auth').click(); await page.waitForTimeout(300);
  const text = await page.getByTestId('mot-text').inputValue();
  assert(text.includes('3 décembre 2026') && text.includes('Sortie au musée'), 'mot prérempli depuis le projet');
  assert(text.includes('5,00'), 'coût repris');
  await page.getByTestId('mot-lieu').fill('Musée des Beaux-Arts');
  assert((await page.getByTestId('mot-text').inputValue()).includes('Musée des Beaux-Arts'), 'texte mis à jour');
  await page.evaluate(() => { window.print = () => { window.__printed = document.getElementById('print-root').innerText; window.__slips = document.querySelectorAll('#print-root .mot-slip').length; }; });
  await page.getByTestId('mot-print').click(); await page.waitForTimeout(150);
  const n = await S(`return model.studentsOfClass(a).length;`, ids.cls);
  eq(await page.evaluate(() => window.__slips), n, 'un exemplaire par élève');
  assert((await page.evaluate(() => window.__printed)).includes('l’élève Lou'), 'nom de l’élève dans le coupon');
  await page.getByTestId('mot-save').click(); await page.waitForTimeout(200);
  eq(await S(`return store.all('familynote').length;`), 1, 'enregistré dans l’historique');
});

await test('Appréciations : phrases accordées, enregistrées dans le bilan', async () => {
  const r = await page.evaluate(async () => { const A = await import('./js/appreciations.js'); return [A.compose({ firstName: 'Lou', gender: 'f', points: ['bon', 'concentration'], advice: ['oral'], seed: 1 }), A.compose({ firstName: 'Nino', gender: 'm', points: ['bon'], seed: 1 })]; });
  assert(r[0].startsWith('Lou') && /sérieuse|investie|résultats|qualité/.test(r[0]) && r[0].includes('concentrée'), `accord féminin : ${r[0]}`);
  assert(!/\[|\{P\}/.test(r[0] + r[1]), 'aucun marqueur restant');
  await go('#/livrets');
  await page.getByTestId('report-card').filter({ hasText: 'Lou' }).getByTestId('report-help').click();
  await page.getByTestId('appr-gender').selectOption('f');
  await page.getByTestId('appr-points-progres').check(); await page.getByTestId('appr-advice-continuer').check();
  const prop = await page.getByTestId('appr-out').inputValue();
  assert(prop.length > 20, 'proposition générée');
  await page.getByTestId('appr-use').click(); await page.waitForTimeout(300);
  eq(await page.getByTestId('report-card').filter({ hasText: 'Lou' }).getByTestId('report-general').inputValue(), prop, 'texte placé dans l’appréciation générale');
  eq(await S(`return store.get(a).gender;`, ids.lou), 'f', 'accord mémorisé sur la fiche');
});

await test('AESH, incident (mots de jugement, initiales), registre de soins : confidentiels', async () => {
  await go('#/redaction?t=incident');
  assert(await page.getByTestId('unlock').count() === 1, 'masqué tant que non déverrouillé');
  await unlock();
  await page.getByTestId('incident-new').click(); await page.waitForTimeout(300);
  await page.getByTestId('incident-facts').fill('Nino a poussé Lou, il est toujours méchant.');
  assert((await page.getByTestId('incident-warn').innerText()).includes('méchant'), 'mot de jugement signalé');
  await page.getByTestId('incident-facts').blur(); await page.waitForTimeout(200);
  await page.getByTestId('incident-anon').click(); await page.waitForTimeout(300);
  const facts = await S(`return store.all('incident')[0].facts;`);
  assert(facts.startsWith('N.') && facts.includes('L.') && !facts.includes('Nino'), `initiales : ${facts}`);
  await go('#/redaction?t=aesh');
  await page.getByTestId('aesh-new').click(); await page.waitForTimeout(300);
  await page.getByTestId('aesh-name').fill('Mme AESH (exemple)'); await page.getByTestId('aesh-name').blur();
  await page.locator('.chip input').first().check(); await page.waitForTimeout(200);
  const sh = await S(`return store.all('aeshsheet')[0];`);
  eq(sh.missions.length, 1, 'mission cochée'); eq(sh.sensitive, true, 'fiche confidentielle');
  await go('#/redaction?t=soins');
  await page.getByTestId('soin-care').fill('nettoyage, pansement');
  await page.getByTestId('soin-add').click(); await page.waitForTimeout(300);
  eq(await page.getByTestId('soin-table').locator('tbody tr').count(), 1, 'soin noté');
  await page.screenshot({ path: `${OUT}etape4b-soins.png` });
});

await test('Aucune erreur dans la console', async () => { eq(errors.length, 0, errors.join(' | ')); });

await browser.close();
writeFileSync(`${OUT}resultats-etape4b.txt`, results.join('\n'));
console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
