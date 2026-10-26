// Sorties et natation ; mode remplaçante ; méthodes par discipline ; radar ; mode en classe.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let passed = 0, failed = 0; const results = [];
let page;
async function test(name, fn) {
  try { await fn(); passed++; results.push(`✔ ${name}`); console.log(`✔ ${name}`); }
  catch (e) { failed++; results.push(`✘ ${name}\n    ${e.message.split('\n')[0]}`); console.log(`✘ ${name}\n   `, e.message); try { await page.screenshot({ path: `${OUT}echec-sorties-${failed}.png`, fullPage: true }); } catch { /* */ } }
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

await page.goto(BASE); await page.waitForFunction(() => window.__classeurReady === true);
await page.evaluate(async () => (await import('./js/demo.js')).loadDemo());
await page.waitForTimeout(400);
await S(`const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentYearId: cls.yearId, currentClassId: cls.id });`);
const N = await S(`return model.studentsOfClass(store.getSettings().currentClassId).length;`);

await test('Cycle de natation : 10 séances hebdomadaires hors vacances, dans l’agenda et le cahier journal', async () => {
  await go('#/sorties');
  await page.getByTestId('outing-new').click();
  await page.getByTestId('outing-kind').selectOption('cycle');
  await page.getByTestId('outing-date').fill('2026-12-10'); await page.getByTestId('outing-count').fill('10');
  await page.getByTestId('outing-create').click(); await page.waitForTimeout(500);
  const o = await S(`return store.all('outing')[0];`);
  eq(o.title, 'Natation', 'intitulé proposé'); eq(o.dates.length, 10, '10 séances');
  assert(!o.dates.some(d => d.date >= '2026-12-19' && d.date <= '2027-01-03'), 'pas de séance pendant les vacances');
  eq(new Set(o.dates.map(d => new Date(d.date).getDay())).size, 1, 'toujours le même jour');
  eq(await S(`return store.all('event').filter(e => e.outingId === a && !e.deletedAt).length;`, o.id), 10, '10 événements dans l’agenda');
  const plan = await page.evaluate(async () => { const PL = await import('./js/planning.js'); const store = await import('./js/store.js'); return PL.dayPlan(store.get(store.getSettings().currentClassId), '2026-12-10').entries.filter(e => e.kind === 'event').map(e => e.title); });
  assert(plan.includes('Natation'), 'dans le cahier journal du 10 décembre');
});

await test('Adultes, taux d’encadrement, groupes avec adulte, répartition', async () => {
  await page.getByTestId('outing-tab-adultes').click(); await page.waitForTimeout(200);
  for (const n of ['Julia (exemple)', 'Parent A (exemple)']) { await page.getByTestId('adult-name').fill(n); await page.getByTestId('adult-add').click(); await page.waitForTimeout(200); }
  await page.getByTestId('outing-ratio').fill('3'); await page.getByTestId('outing-ratio').dispatchEvent('change'); await page.waitForTimeout(200);
  if (N / 2 > 3) assert((await page.locator('.page').innerText()).includes('encadrement insuffisant'), 'alerte de taux');
  await page.getByTestId('groups-add').click(); await page.waitForTimeout(150); await page.getByTestId('groups-add').click(); await page.waitForTimeout(150);
  await page.getByTestId('groups-auto').click(); await page.waitForTimeout(250);
  const o = await S(`return store.all('outing')[0];`);
  eq(o.groups.length, 2, '2 groupes'); eq(o.groups.reduce((n, g) => n + g.memberIds.length, 0), N, 'tous les élèves répartis');
  eq(o.groups[0].adult, 'Julia (exemple)', 'un adulte par groupe');
});

await test('Autorisations propres à la sortie, check-list, appel départ / retour', async () => {
  await page.getByTestId('outing-tab-autorisations').click(); await page.waitForTimeout(200);
  await page.getByTestId('outing-own-auth').check(); await page.waitForTimeout(200);
  const sel = page.getByTestId('auth-status'); const n = await sel.count();
  for (let i = 0; i < n; i++) await page.getByTestId('auth-status').nth(i).selectOption(i === 0 ? 'refusé' : 'autorisé');
  await page.waitForTimeout(250);
  assert((await page.locator('.page').innerText()).includes('refus :'), 'refus signalé');
  await page.getByTestId('outing-tab-checklist').click(); await page.waitForTimeout(150);
  await page.getByTestId('check-item').first().check(); await page.waitForTimeout(150);
  eq(await S(`return store.all('outing')[0].checklist.filter(c => c.done).length;`), 1, 'check-list cochée');
  await page.getByTestId('outing-tab-appel').click(); await page.waitForTimeout(200);
  eq(await page.getByTestId('roll-depart').count(), N - 1, 'élève refusé absent de l’appel');
  await page.getByTestId('roll-depart').nth(0).click(); await page.waitForTimeout(150); await page.getByTestId('roll-depart').nth(1).click(); await page.waitForTimeout(150);
  await page.getByTestId('roll-retour').nth(0).click(); await page.waitForTimeout(250);
  assert((await page.getByTestId('roll-missing').innerText()).includes('Pas encore pointé'), 'élève manquant au retour signalé');
  await page.evaluate(() => { window.print = () => { window.__printed = document.querySelector('#print-root').innerText; }; });
  await page.getByTestId('outing-print').click(); await page.waitForTimeout(200);
  assert((await page.evaluate(() => window.__printed)).includes('Responsable à prévenir'), 'fiche de sortie imprimée');
});

await test('Téléphone : sorties sans débordement', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const t of ['infos', 'adultes', 'autorisations', 'appel']) { await page.getByTestId(`outing-tab-${t}`).click(); await page.waitForTimeout(200); eq(await page.evaluate(() => document.documentElement.scrollWidth <= 392), true, `${t} déborde`); }
  await page.screenshot({ path: `${OUT}sortie-appel-telephone.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
});

await test('Remplacement : classe temporaire avec ses élèves, jours comptés, terminé = retiré du choix de classe', async () => {
  await go('#/missions');
  await page.getByTestId('mission-new').click();
  await page.getByTestId('mission-school').fill('École Exemple'); await page.getByTestId('mission-class').fill('CM1 (exemple)');
  await page.getByTestId('mission-from').fill('2026-11-02'); await page.getByTestId('mission-to').fill('2026-11-13');
  await page.getByTestId('mission-level-CM1').check();
  await page.getByTestId('mission-names').fill('Léa Martin\nDUPONT Hugo\n3. Inès');
  await page.getByTestId('mission-create').click(); await page.waitForTimeout(500);
  const r = await S(`const c = store.get(store.getSettings().currentClassId); const st = model.studentsOfClass(c.id, { date: '2026-11-03' }).map(x => [x.student.firstName, x.student.lastName]); return { name: c.name, mission: c.mission, st };`);
  eq(r.name, 'CM1 (exemple) — École Exemple', 'classe créée et choisie'); eq(r.mission, true, 'classe de remplacement');
  eq(JSON.stringify(r.st.sort()), JSON.stringify([['Hugo', 'DUPONT'], ['Inès', ''], ['Léa', 'Martin']]), 'élèves lus (Prénom Nom, NOM Prénom, numérotés)');
  await go('#/missions');
  assert((await page.getByTestId('mission-totals').innerText()).includes('8 jour(s) de classe'), 'jours de classe hors mercredis');
  await page.getByTestId('mission-end').click(); await page.locator('.modal button.btn-primary').last().click(); await page.waitForTimeout(400);
  const opts = await page.getByTestId('class-select').locator('option').allInnerTexts();
  assert(!opts.some(t => t.includes('École Exemple')), 'retirée du choix de classe');
});

await test('Disciplines et méthodes : manuel par sous-domaine, proposé dans la fiche, repris au dossier de remplacement', async () => {
  await S(`const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentYearId: cls.yearId, currentClassId: cls.id });`);
  await go('#/methodes');
  await page.getByTestId('method-add-Mathématiques').click(); await page.waitForTimeout(250);
  const row = page.getByTestId('method-row').first();
  await row.locator('input').first().fill('Nombres'); await row.locator('input').first().dispatchEvent('change'); await page.waitForTimeout(250);
  await page.getByTestId('method-row').first().getByTestId('method-manual').selectOption('__new'); await page.waitForTimeout(200);
  await page.getByTestId('new-method-title').fill('Accès CE2 (exemple)'); await page.getByTestId('new-method-ok').click(); await page.waitForTimeout(300);
  const m = await S(`return store.get(store.getSettings().currentClassId).methods;`);
  eq(m.length, 1, 'une ligne'); eq(m[0].subdomain, 'Nombres', 'sous-domaine'); eq(m[0].manualIds.length, 1, 'manuel lié');
  const seq = await S(`return store.all('sequence').find(s => s.classId === store.getSettings().currentClassId && s.subject === 'Mathématiques' && s.subdomain === 'Nombres').id;`);
  await go(`#/sequence/${seq}`);
  assert(await page.getByTestId('method-hint').count() >= 1, 'méthode proposée dans la fiche');
  await page.getByTestId('method-hint-add').first().click(); await page.waitForTimeout(300);
  eq(await S(`return store.get(a).manualRefs.length;`, seq), 1, 'référence ajoutée à la séquence');
});

await test('Aucune erreur dans la console', async () => { eq(errors.length, 0, errors.join(' | ')); });
await browser.close();
writeFileSync(`${OUT}resultats-sorties.txt`, results.join('\n'));
console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
