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

await test('Radar : 3 signaux de 2 sources = à regarder ; détail et lien', async () => {
  const sid = await S(`const cls = store.get(store.getSettings().currentClassId); const st = model.studentsOfClass(cls.id).map(x => x.student); const s = st.find(x => x.firstName === 'Sacha') || st[0];
    const today = model.todayIso();
    for (const c of ['comportement', 'oubli']) await store.create('carnet', { classId: cls.id, studentId: s.id, date: model.addDays(today, -2), category: c, text: '', written: false, signed: false }, 'x');
    await store.create('attendance', { classId: cls.id, date: model.addDays(today, -3), half: 'matin', marks: { [s.id]: { status: 'absent' } }, validated: true }, 'x');
    return s.id;`);
  await go('#/radar');
  const t = await page.getByTestId('radar-flagged').innerText();
  const name = await S(`return store.get(a).firstName;`, sid);
  assert(t.includes(name) && t.includes('1 absence') && t.includes('2 carnet'), t);
  await go('#/aujourdhui');
  assert((await page.getByTestId('today-radar').innerText()).includes(name), 'rappel sur Aujourd’hui');
});

await test('Mode en classe : noter au carnet en 2 touches, appel, timer', async () => {
  await go('#/enclasse');
  const n0 = await S(`return store.all('carnet').length;`);
  await page.getByTestId('ec-student').first().click(); await page.waitForTimeout(150);
  await page.getByTestId('ec-cat-felicitations').click(); await page.waitForTimeout(300);
  eq(await S(`return store.all('carnet').length;`), n0 + 1, 'noté');
  assert(await page.getByTestId('ec-appel').count() === 1 && await page.getByTestId('ec-timer').count() === 1, 'appel et timer');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
  eq(await page.evaluate(() => document.documentElement.scrollWidth <= 392), true, 'téléphone sans débordement');
  await page.screenshot({ path: `${OUT}mode-en-classe.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
});

await test('Recherche : actions rapides qui ouvrent directement le bon formulaire', async () => {
  await go('#/recherche?q=noter');
  const link = page.getByTestId('search-results').getByRole('link', { name: /Noter un comportement/ });
  assert(await link.count() === 1, 'action proposée');
  await link.click(); await page.waitForTimeout(500);
  assert(await page.getByTestId('carnet-save').count() === 1, 'formulaire du carnet ouvert');
  assert(!(await page.evaluate(() => location.hash)).includes('new=1'), 'paramètre retiré de l’adresse');
  await page.keyboard.press('Escape');
  await go('#/recherche?q=natation');
  assert((await page.getByTestId('search-results').innerText()).includes('Nouvelle sortie'), 'action sortie');
});

await test('Aujourd’hui : « Maintenant » pendant la classe, « Pour demain » après', async () => {
  const p2 = await ctx.newPage(); const errs2 = []; p2.on('pageerror', e => errs2.push(e.message));
  await p2.clock.setFixedTime(new Date('2026-11-03T10:00:00'));
  await p2.goto(BASE); await p2.waitForFunction(() => window.__classeurReady === true); await p2.waitForTimeout(300);
  await p2.evaluate(() => { location.hash = '#/aujourdhui'; }); await p2.waitForTimeout(400);
  assert(await p2.getByTestId('today-now').count() === 1, '« Maintenant » à 10 h');
  await p2.close();
  const p3 = await ctx.newPage();
  await p3.clock.setFixedTime(new Date('2026-11-03T18:00:00'));
  await p3.goto(BASE); await p3.waitForFunction(() => window.__classeurReady === true); await p3.waitForTimeout(300);
  await p3.evaluate(() => { location.hash = '#/aujourdhui'; }); await p3.waitForTimeout(400);
  assert(await p3.getByTestId('today-tomorrow').count() === 1, '« Pour demain » à 18 h');
  await p3.close();
  eq(errs2.length, 0, errs2.join(' | '));
});

await test('Cahier journal détaillé : programme, séquence, compétences en toutes lettres, déroulé avec consignes', async () => {
  const sid = await S(`const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentYearId: cls.yearId, currentClassId: cls.id });
    const seq = store.all('sequence').find(s => s.classId === cls.id && s.title.includes('10 000'));
    const ses = store.all('session').find(s => s.sequenceId === seq.id);
    const r = await store.create('referential', { name: 'Réf. détail (exemple)', version: '1', levels: ['CE2'], status: 'validé', items: [{ id: 'kd1', code: 'N3', label: 'Lire et écrire les nombres (exemple)' }] }, 'r');
    await store.update(ses.id, { competencyIds: ['kd1'], objective: 'Décomposer (exemple)', phases: [{ id: 'p1', kind: 'rappel', title: 'Rappel', duration: 5, consigne: 'Ardoise : écrire 1 254 (exemple)' }, { id: 'p2', kind: 'recherche', title: 'Recherche', duration: 20, consigne: 'Par deux, décomposer (exemple)' }] }, 'x');
    await store.create('occurrence', { classId: cls.id, date: '2026-11-05', start: '09:00', end: '09:45', subject: 'Mathématiques', sessionId: ses.id, status: 'prévue', mode: 'dirigé', levels: [] }, 'x');
    return ses.id;`);
  await go('#/cahier?d=2026-11-05'); await page.getByTestId('journal-detail').click(); await page.waitForTimeout(200);
  const card = page.getByTestId('entry').filter({ hasText: 'Décomposer (exemple)' });
  const t = await card.innerText();
  for (const x of ['Programme', 'Mathématiques', 'Séquence', 'N3 — Lire et écrire les nombres (exemple)', 'Ardoise : écrire 1 254', '20 min', 'Par deux, décomposer']) assert(t.includes(x), `détail : ${x}`);
  await page.getByTestId('journal-compact').click(); await page.waitForTimeout(200);
  assert(!(await page.getByTestId('entry').filter({ hasText: 'Décomposer (exemple)' }).innerText()).includes('Par deux, décomposer'), 'vue compacte');
  await page.getByTestId('journal-detail').click();
});

await test('Vider une semaine du cahier journal (faites gardées), annulable', async () => {
  const cnt = () => S(`return store.all('occurrence').filter(o => !o.deletedAt && o.classId === store.getSettings().currentClassId && o.date >= '2026-11-02' && o.date <= '2026-11-08');`);
  await S(`const cls = store.get(store.getSettings().currentClassId); await store.create('occurrence', { classId: cls.id, date: '2026-11-03', start: '14:00', end: '14:30', subject: 'EPS', title: 'Faite (exemple)', status: 'faite', mode: 'dirigé', levels: [] }, 'x');`);
  const before = await cnt(); assert(before.length >= 2, 'des séances cette semaine');
  await go('#/cahier?d=2026-11-03&v=semaine');
  await page.getByTestId('clear-journal').click();
  assert((await page.getByTestId('clear-info').innerText()).includes('élément(s)'), 'aperçu du nombre');
  await page.getByTestId('clear-go').click(); await page.waitForTimeout(400);
  const after = await cnt();
  eq(after.length, before.filter(o => ['faite', 'partielle'].includes(o.status)).length, 'seules les séances faites restent');
  await S(`await store.undo();`); await page.waitForTimeout(200);
  eq((await cnt()).length, before.length, 'annulation');
});

await test('Aucune erreur dans la console', async () => { eq(errors.length, 0, errors.join(' | ')); });
await browser.close();
writeFileSync(`${OUT}resultats-sorties.txt`, results.join('\n'));
console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
