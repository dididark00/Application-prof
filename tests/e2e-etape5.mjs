// Étape 5 : synchronisation entre appareils par Nuage (fichier chiffré par appareil, fusion élément par élément).
// Chaque « appareil » est un contexte de navigateur séparé (stockage séparé).
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let passed = 0, failed = 0; const results = [];
let shotPage = null;
async function test(name, fn) {
  try { await fn(); passed++; results.push(`✔ ${name}`); console.log(`✔ ${name}`); }
  catch (e) { failed++; results.push(`✘ ${name}\n    ${e.message.split('\n')[0]}`); console.log(`✘ ${name}\n   `, e.message); try { await shotPage?.screenshot({ path: `${OUT}echec5-${failed}.png`, fullPage: true }); } catch { /* */ } }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`); };

const browser = await chromium.launch();
const errors = [];
async function device(name) {
  const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 }, bypassCSP: true, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  await page.goto(BASE); await page.waitForFunction(() => window.__classeurReady === true);
  await page.evaluate(async (n) => { const D = await import('./js/device.js'); await D.rename(n); }, name);
  return page;
}
const S = (page, fn, arg) => page.evaluate(async ([src, a]) => {
  const m = { store: await import('./js/store.js'), model: await import('./js/model.js'), SY: await import('./js/sync.js'), D: await import('./js/device.js') };
  return (new Function(...Object.keys(m), 'a', `return (async () => { ${src} })()`))(...Object.values(m), a);
}, [fn, arg]);
const PW = 'mot-de-passe-essai';
/** Fichier de synchronisation de l'appareil, renvoyé sous forme de texte. */
const fileOf = (page) => S(page, `const f = await SY.buildFile(a); return { name: f.name, text: await f.text() };`, PW);
async function receive(page, file, { choice } = {}) {
  await page.evaluate(() => { location.hash = '#/reglages/synchro'; }); await page.waitForTimeout(300);
  await page.getByTestId('sync-password').fill(PW);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('sync-receive').click()]);
  await chooser.setFiles({ name: file.name, mimeType: 'application/json', buffer: Buffer.from(file.text) });
  if (choice) { await page.getByTestId(`sync-${choice}`).click(); }
  await page.getByTestId('sync-report').waitFor({ timeout: 20000 });
  const txt = await page.getByTestId('sync-report').innerText();
  await page.locator('.modal-foot button', { hasText: 'Fermer' }).click();
  return txt;
}

const A = await device('Ordinateur école'); shotPage = A;
await A.evaluate(async () => (await import('./js/demo.js')).loadDemo()); await A.waitForTimeout(400);
await S(A, `const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentClassId: cls.id, userName: 'Julia', services: ['Cantine', 'Garderie'] });`);
const B = await device('Tablette');
const nA = await S(A, `return { records: store.rawRecords().length, students: store.all('student').length };`);

let fileA;
await test('Le fichier de synchronisation est chiffré (aucun nom d’élève lisible) et refuse un mauvais mot de passe', async () => {
  fileA = await fileOf(A);
  assert(fileA.name.startsWith('classeur-ordinateur-ecole-') && fileA.name.endsWith('.classeur'), `nom : ${fileA.name}`);
  const head = JSON.parse(fileA.text);
  eq(head.format, 'classeur-synchro', 'format'); eq(head.counts.records, nA.records, 'nombre d’éléments');
  for (const n of ['Lou', 'Nino', 'CE2 (démo)']) assert(!fileA.text.includes(n), `« ${n} » ne doit pas apparaître en clair`);
  const err = await S(B, `try { await SY.readFile(new File([a], 'x.classeur'), 'mauvais-mot-de-passe'); return 'lu'; } catch (e) { return e.message; }`, fileA.text);
  assert(err.includes('Mot de passe de synchronisation incorrect'), err);
});

await test('Nouvel appareil vide : récupère tout depuis Nuage (élèves, fichiers, réglages partagés)', async () => {
  const rep = await receive(B, fileA);
  assert(rep.includes('Ordinateur école'), rep);
  const nB = await S(B, `return { records: store.rawRecords().length, students: store.all('student').length, services: store.getSettings().services, user: store.getSettings().userName };`);
  eq(nB.records, nA.records, 'mêmes éléments'); eq(nB.students, nA.students, 'mêmes élèves');
  eq(JSON.stringify(nB.services), '["Cantine","Garderie"]', 'réglage partagé repris'); eq(nB.user, 'Julia', 'nom repris');
  eq(await S(B, `return (await D.get('syncPassword'));`), PW, 'mot de passe mémorisé sur l’appareil');
});

await test('Modifications sur les deux appareils : fusion élément par élément, conflit tracé dans l’historique', async () => {
  // A modifie Lou (prénom d'usage) et Nino ; B modifie Lou plus tard et ajoute une note à Inès.
  await S(A, `const s = store.all('student'); await store.update(s.find(x => x.firstName === 'Nino').id, { notes: 'modifié sur A' }, 'A'); await store.update(s.find(x => x.firstName === 'Lou').id, { notes: 'Lou sur A' }, 'A');`);
  await new Promise(r => setTimeout(r, 30));
  await S(B, `const s = store.all('student'); await store.update(s.find(x => x.firstName === 'Lou').id, { notes: 'Lou sur la tablette' }, 'B'); await store.update(s.find(x => x.firstName === 'Inès').id, { notes: 'ajouté sur la tablette' }, 'B');
    await store.create('task', { title: 'Tâche créée sur la tablette', done: false }, 'B');`);
  const fileB = await fileOf(B);
  const rep = await receive(A, fileB);
  assert(rep.includes('Tablette') && rep.includes('mis à jour') && rep.includes('ajouté'), rep);
  assert(rep.includes('des deux côtés'), `conflit signalé : ${rep}`);
  const r = await S(A, `const s = store.all('student'); const g = (n) => s.find(x => x.firstName === n).notes;
    return { lou: g('Lou'), nino: g('Nino'), ines: g('Inès'), task: store.all('task').some(t => t.title === 'Tâche créée sur la tablette'), audit: (await store.auditLog(50)).filter(x => x.action === 'version écartée (synchronisation)').map(x => x.before?.notes) };`);
  eq(r.lou, 'Lou sur la tablette', 'le plus récent gagne'); eq(r.nino, 'modifié sur A', 'modification locale gardée');
  eq(r.ines, 'ajouté sur la tablette', 'modification distante reçue'); eq(r.task, true, 'création distante reçue');
  assert(r.audit.includes('Lou sur A'), `version écartée conservée dans l’historique : ${JSON.stringify(r.audit)}`);
  // Retour vers B : B reçoit Nino de A.
  await receive(B, await fileOf(A));
  eq(await S(B, `return store.all('student').find(x => x.firstName === 'Nino').notes;`), 'modifié sur A', 'B à jour');
});

await test('Suppression définitive propagée ; corbeille et réglages d’affichage propres à chaque appareil', async () => {
  const id = await S(A, `const t = store.all('task').find(t => t.title === 'Tâche créée sur la tablette'); await store.remove(t.id, 'corbeille'); await store.purge(t.id); return t.id;`);
  const clsB = await S(B, `const c = store.all('class')[0]; await store.setSettings({ currentClassId: c.id }); return c.id;`);
  const clsA = await S(A, `return store.getSettings().currentClassId;`);
  await receive(B, await fileOf(A));
  eq(await S(B, `return !!store.get(a);`, id), false, 'supprimée sur B aussi');
  eq(await S(B, `return store.getSettings().currentClassId;`), clsB, 'classe affichée de B inchangée');
  // B renvoie son fichier (ancien contenu sans la tâche) : la tâche ne revient pas sur A.
  await receive(A, await fileOf(B));
  eq(await S(A, `return !!store.get(a);`, id), false, 'ne revient pas');
  eq(await S(A, `return store.getSettings().currentClassId;`), clsA, 'classe affichée de A inchangée');
});

await test('Appareil qui a déjà ses propres données : choix « Remplacer » sans doublon', async () => {
  const C = await device('Ordinateur maison');
  await C.evaluate(async () => (await import('./js/demo.js')).loadDemo()); await C.waitForTimeout(400);
  await receive(C, await fileOf(A), { choice: 'replace' });
  const r = await S(C, `return { n: store.rawRecords().length, students: store.all('student').length };`);
  const a = await S(A, `return { n: store.rawRecords().length, students: store.all('student').length };`);
  eq(r.students, a.students, 'pas de doublon d’élèves'); eq(r.n, a.n, 'mêmes éléments');
  await C.context().close();
});

await test('Dossier synchronisé (ordinateur) : lit les fichiers des autres et écrit le sien', async () => {
  // Dossier simulé avec le système de fichiers privé du navigateur (même interface que le dossier Nuage choisi).
  const prep = `const root = await navigator.storage.getDirectory(); const dir = await root.getDirectoryHandle('nuage', { create: true }); await D.set('folder', dir); await D.set('folderSeen', {}); return true;`;
  await S(A, prep); await S(B, prep);
  await S(B, `const s = store.all('student').find(x => x.firstName === 'Malo'); await store.update(s.id, { notes: 'depuis le dossier' }, 'B');`);
  const rb = await S(B, `const r = await SY.syncFolder(a); const dir = await D.get('folder'); const f = await (await dir.getFileHandle(r.file)).getFile(); return { file: r.file, text: await f.text() };`, PW);
  // Le fichier de B est « déposé par Nuage » dans le dossier de A.
  const ra = await S(A, `const dir = await D.get('folder'); const fh = await dir.getFileHandle(a.file, { create: true }); const w = await fh.createWritable(); await w.write(a.text); await w.close();
    const r = await SY.syncFolder(a.pw); const names = []; for await (const [n] of dir.entries()) names.push(n);
    return { reports: r.reports, names, malo: store.all('student').find(x => x.firstName === 'Malo').notes };`, { ...rb, pw: PW });
  eq(ra.malo, 'depuis le dossier', 'changement de B reçu par le dossier');
  eq(ra.reports.length, 1, 'un fichier d’un autre appareil lu');
  eq(ra.names.filter(n => n.endsWith('.classeur')).length, 2, 'le fichier de A est écrit à côté de celui de B');
  const again = await S(A, `const r = await SY.syncFolder(a); return r.reports.length;`, PW);
  eq(again, 0, 'un fichier déjà lu n’est pas relu');
});

await test('Page Réglages › Synchronisation : explications, état, aucun service payant', async () => {
  await A.evaluate(() => { location.hash = '#/reglages/synchro'; }); await A.waitForTimeout(300);
  const t = await A.getByTestId('synchro').innerText();
  assert(t.includes('Nuage') && t.includes('chiffré') && t.includes('Fusionné avec « Tablette »'), 'contenu');
  assert(await A.getByTestId('sync-folder').count() === 1, 'choix du dossier proposé (Chrome)');
  await A.screenshot({ path: `${OUT}etape5-synchro.png`, fullPage: true });
});

await test('Aucune erreur dans la console', async () => { eq(errors.length, 0, errors.join(' | ')); });

await browser.close();
writeFileSync(`${OUT}resultats-etape5.txt`, results.join('\n'));
console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
