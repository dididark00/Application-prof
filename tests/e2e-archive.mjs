// Archivage d'une année dans un fichier : aperçu, création, vérification, retrait, consultation en lecture seule.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let passed = 0, failed = 0; const results = [];
let page;
async function test(name, fn) {
  try { await fn(); passed++; results.push(`✔ ${name}`); console.log(`✔ ${name}`); }
  catch (e) { failed++; results.push(`✘ ${name}\n    ${e.message.split('\n')[0]}`); console.log(`✘ ${name}\n   `, e.message); try { await page.screenshot({ path: `${OUT}echec-archive-${failed}.png`, fullPage: true }); } catch { /* */ } }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 }, bypassCSP: true, acceptDownloads: true });
page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const ready = () => page.waitForFunction(() => window.__classeurReady === true);
const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(250); };
const S = (fn, arg) => page.evaluate(async ([src, a]) => {
  const m = { store: await import('./js/store.js'), model: await import('./js/model.js'), AR: await import('./js/archive.js') };
  return (new Function(...Object.keys(m), 'a', `return (async () => { ${src} })()`))(...Object.values(m), a);
}, [fn, arg]);

await page.goto(BASE); await ready();
await page.evaluate(async () => (await import('./js/demo.js')).loadDemo());
await page.waitForTimeout(400);
// Année suivante : une classe, un élève de l'ancienne année réinscrit (Lou), un référentiel commun, une photo d'élève.
const ids = await S(`
  const old = store.all('class').find(c => c.name === 'CE2 (démo)'); const oldYear = store.get(old.yearId);
  const ny = await store.create('year', { label: '2027-2028 (essai)', start: '2027-09-01', end: '2028-07-04', periods: [{ id: 'p1', name: 'Période 1', start: '2027-09-01', end: '2027-10-15' }] }, 'y');
  const nc = await store.create('class', { name: 'CM1 (essai)', yearId: ny.id, levels: ['CM1'] }, 'c');
  const lou = store.all('student').find(s => s.firstName === 'Lou'); const nino = store.all('student').find(s => s.firstName === 'Nino');
  await store.create('enrollment', { studentId: lou.id, classId: nc.id, level: 'CM1', from: '2027-09-01' }, 'e');
  const blob = new Blob([new Uint8Array(5000).fill(7)], { type: 'image/png' });
  const bid = await store.putBlob(blob); await store.update(nino.id, { photoBlobId: bid }, 'photo');
  await store.create('observation', { studentId: lou.id, date: '2027-09-10', kind: 'remarque', text: 'Observation de la nouvelle année' }, 'o');
  await store.create('observation', { studentId: lou.id, date: '2026-10-01', kind: 'remarque', text: 'Observation ancienne' }, 'o');
  await store.update(oldYear.id, { archived: true }, 'archivée');
  await store.setSettings({ currentYearId: ny.id, currentClassId: nc.id });
  return { oldYear: oldYear.id, oldClass: old.id, newYear: ny.id, lou: lou.id, nino: nino.id, bid, refs: store.all('referential').length, manuals: store.all('manual').length, records: store.rawRecords().length };`);

await test('Aperçu : élèves de l’année seulement, élève réinscrit conservé, communs exclus', async () => {
  const p = await S(`const p = await AR.preview(a.oldYear); return { students: p.students, byType: p.byType, kept: p.kept, ids: p.records.map(r => r.id), blobs: p.blobIds };`, ids);
  assert(!p.ids.includes(ids.lou), 'Lou (réinscrite) reste');
  assert(p.ids.includes(ids.nino), 'Nino part avec l’année');
  assert(p.blobs.includes(ids.bid), 'photo de Nino dans l’archive');
  assert(!p.byType.referential && !p.byType.manual, 'référentiels et manuels communs exclus');
  assert(p.kept.some(k => k.includes('inscrit')), 'élève partagé signalé');
});

let saved;
await test('Créer, vérifier, puis retirer l’année (place libérée, nouvelle année intacte)', async () => {
  await go('#/reglages/annees');
  await page.getByTestId('year-card').filter({ hasText: '2026-2027' }).getByTestId('archive-file').click();
  await page.getByTestId('archive-size').waitFor();
  await page.getByTestId('archive-password').fill('motdepasse-essai');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('archive-make').click()]);
  saved = `${OUT}archive-essai.json`; await dl.saveAs(saved);
  const txt = (await import('node:fs')).readFileSync(saved, 'utf8');
  assert(!txt.includes('Nino'), 'archive chiffrée : aucun prénom lisible');
  const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('archive-verify').click()]);
  await ch.setFiles(saved);
  await page.getByTestId('archive-remove').waitFor();
  await page.getByTestId('archive-remove').click();
  await page.locator('.modal-foot button', { hasText: 'Retirer de l’appareil' }).click(); await page.waitForTimeout(600);
  const r = await S(`return { year: !!store.get(a.oldYear), cls: !!store.get(a.oldClass), nino: !!store.get(a.nino), lou: !!store.get(a.lou), refs: store.all('referential').length, manuals: store.all('manual').length,
    newYear: !!store.get(a.newYear), louObs: store.all('observation').filter(o => o.studentId === a.lou).map(o => o.text), blob: !!(await store.getBlob(a.bid)), tomb: Object.keys(store.getTombstones()).includes(a.nino), records: store.rawRecords().length };`, ids);
  eq(r.year || r.cls || r.nino, false, 'année, classe et élève retirés');
  eq(r.lou && r.newYear, true, 'Lou et la nouvelle année gardées');
  eq(r.refs, ids.refs, 'référentiels intacts'); eq(r.manuals, ids.manuals, 'manuels intacts');
  assert(r.louObs.includes('Observation de la nouvelle année') && !r.louObs.includes('Observation ancienne'), 'observations de Lou : seule l’ancienne part');
  eq(r.blob, false, 'photo supprimée (place libérée)');
  eq(r.tomb, true, 'retrait propagé aux autres appareils');
  assert(r.records < ids.records / 2, `éléments restants : ${r.records} sur ${ids.records}`);
});

await test('Archive modifiée → retrait refusé ; mauvais mot de passe → refus', async () => {
  const r = await page.evaluate(async (txt) => { const AR = await import('./js/archive.js'); try { await AR.read(new File([txt], 'a.json'), 'faux'); return 'lu'; } catch (e) { return e.message; } }, (await import('node:fs')).readFileSync(saved, 'utf8'));
  assert(r.includes('Mot de passe incorrect'), r);
  const r2 = await S(`const b = await AR.build(a.newYear, ''); const v = await AR.read(b.file);
    const c = store.all('class').find(x => x.yearId === a.newYear); await store.update(c.id, { name: 'CM1 modifié après archive' }, 'm');
    try { await AR.removeYear(a.newYear, v); return 'retiré'; } catch (e) { return e.message; }`, ids);
  assert(r2.includes('ont changé'), `retrait refusé si l’année a changé : ${r2}`);
  eq(await S(`return !!store.get(a.newYear);`, ids), true, 'nouvelle année toujours là');
});

await test('Consulter l’archive en lecture seule : élèves et bilans', async () => {
  await go('#/reglages/annees');
  await page.getByTestId('archive-consult').click();
  await page.locator('.modal input[type=password]').fill('motdepasse-essai');
  const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('archive-open').click()]);
  await ch.setFiles(saved); await page.waitForTimeout(500);
  const t = await page.getByTestId('archive-students').innerText();
  assert(t.includes('Nino') && t.includes('CE2'), 'Nino visible dans l’archive');
  const still = await S(`return !!store.get(a.nino);`, ids);
  eq(still, false, 'rien n’est réimporté');
});

await test('Aucune erreur dans la console', async () => { eq(errors.length, 0, errors.join(' | ')); });
await browser.close();
writeFileSync(`${OUT}resultats-archive.txt`, results.join('\n'));
console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
