// Livrets reliés aux évaluations ; répartition et décloisonnement ; suppressions groupées, corbeille ; prêts ; informations élèves.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let passed = 0, failed = 0; const results = [];
let page;
async function test(name, fn) {
  try { await fn(); passed++; results.push(`✔ ${name}`); console.log(`✔ ${name}`); }
  catch (e) { failed++; results.push(`✘ ${name}\n    ${e.message.split('\n')[0]}`); console.log(`✘ ${name}\n   `, e.message); try { await page.screenshot({ path: `${OUT}echec-livrets-${failed}.png`, fullPage: true }); } catch { /* */ } }
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
await page.evaluate(() => { window.print = () => { window.__p = document.getElementById('print-root').textContent; window.__n = document.querySelectorAll('#print-root .livret-page').length; }; });
const N = await S(`return model.studentsOfClass(store.getSettings().currentClassId).length;`);


await test('Informations élèves : un clic sur « Lunettes » ou « Gaucher » affiche la coche', async () => {
  await go('#/infos');
  for (const key of ['lunettes', 'gaucher']) {
    const b = page.getByTestId(`info-${key}`).first();
    if (!await b.count()) continue;
    const before = await b.innerText();
    await b.click(); await page.waitForTimeout(300);
    const after = await page.getByTestId(`info-${key}`).first().innerText();
    assert(before !== after, `${key} : la case change (${JSON.stringify(before)} → ${JSON.stringify(after)})`);
    await page.getByTestId(`info-${key}`).first().click(); await page.waitForTimeout(300);
    eq(await page.getByTestId(`info-${key}`).first().innerText(), before, `${key} : second clic revient`);
  }
});

await test('Supprimer… : choisir des séquences (avec leurs fiches), corbeille, restaurer la sélection', async () => {
  await S(`const c = store.getSettings().currentClassId; for (const t of ['Séq X (exemple)', 'Séq Y (exemple)']) await store.create('sequence', { classId: c, title: t, subject: 'Français', levels: ['CE2'] });`);
  const n0 = await S(`return store.all('sequence').filter(x => !x.deletedAt && x.classId === store.getSettings().currentClassId).length;`);
  assert(n0 >= 2, 'des séquences de démo');
  await go('#/sequences');
  await page.getByTestId('bulk-open').click(); await page.waitForTimeout(200);
  await page.getByTestId('bulk-item').first().check(); await page.getByTestId('bulk-item').nth(1).check();
  if (await page.getByTestId('bulk-children').count()) await page.getByTestId('bulk-children').check();
  await page.getByTestId('bulk-go').click(); await page.waitForTimeout(400);
  eq(await S(`return store.all('sequence').filter(x => !x.deletedAt && x.classId === store.getSettings().currentClassId).length;`), n0 - 2, '2 séquences en moins');
  await go('#/reglages/corbeille');
  const items = page.getByTestId('trash-item'); assert(await items.count() >= 2, 'dans la corbeille');
  await page.getByTestId('trash-all').check(); await page.waitForTimeout(100);
  await page.getByTestId('trash-restore').click(); await page.waitForTimeout(500);
  eq(await S(`return store.all('sequence').filter(x => !x.deletedAt && x.classId === store.getSettings().currentClassId).length;`), n0, 'restaurées');
});

await test('Supprimer… : tout sélectionner sur les progressions', async () => {
  await go('#/progressions');
  if (!await page.getByTestId('bulk-open').count()) return;
  await page.getByTestId('bulk-open').click(); await page.waitForTimeout(200);
  await page.getByTestId('bulk-all').check(); await page.getByTestId('bulk-go').click(); await page.waitForTimeout(400);
  eq(await S(`return store.all('progression').filter(x => !x.deletedAt && x.classId === store.getSettings().currentClassId).length;`), 0, 'toutes en corbeille');
  await page.getByText('Annuler', { exact: true }).last().click().catch(() => {}); await page.waitForTimeout(400);
});

await test('Corbeille : délai de vidage automatique', async () => {
  await S(`const r = await store.create('task', { title: 'Vieille tâche', done: false }); await store.update(r.id, { deletedAt: '2020-01-01T00:00:00Z' });`);
  await page.evaluate(async () => { const st = await import('./js/store.js'); await st.setSettings({ trashDays: 30 }); await (await import('./js/main.js')).autoPurgeTrash(new Date()); });
  eq(await S(`return store.all('task').some(t => t.title === 'Vieille tâche') || !!store.trash?.().some?.(t => t.title === 'Vieille tâche');`), false, 'purgée après 30 jours');
  await go('#/reglages/corbeille');
  await page.getByTestId('trash-days').selectOption('0'); await page.waitForTimeout(200);
  eq(await S(`return store.getSettings().trashDays;`), 0, 'jamais');
});

await test('Bibliothèque : modifier puis supprimer un emprunt', async () => {
  const id = await S(`const cls = store.get(store.getSettings().currentClassId); const st = model.studentsOfClass(cls.id)[0].student;
    const b = await store.create('book', { title: 'Livre test', sequenceIds: [], copies: [{ id: 'cpT', code: 'LT-1' }] });
    const l = await store.create('loan', { classId: cls.id, yearId: cls.yearId, bookId: b.id, copyId: 'cpT', studentId: st.id, start: '2026-10-01', due: '2026-10-15', returnedAt: null }); return l.id;`);
  await go('#/bibliotheque');
  for (const t of await page.locator('.seg button').all()) { if (/prêt/i.test(await t.innerText())) { await t.click(); await page.waitForTimeout(200); break; } }
  await page.getByTestId('edit-loan').first().click(); await page.waitForTimeout(200);
  await page.getByTestId('loan-due').fill('2026-11-20'); await page.getByTestId('loan-save').click(); await page.waitForTimeout(300);
  const l = await S(`return store.get(a);`, id); eq(l?.due, '2026-11-20', 'date modifiée');
  assert(l, 'date de retour prévue modifiée');
  await page.getByTestId('edit-loan').first().click(); await page.waitForTimeout(200);
  await page.getByTestId('loan-delete').click(); await page.waitForTimeout(300);
  const conf = page.locator('.modal').getByRole('button', { name: /Supprimer/ }); if (await conf.count()) { await conf.last().click(); await page.waitForTimeout(300); }
  eq(await S(`const x = store.get(a); return !!x && !x.deletedAt;`, l.id), false, 'emprunt supprimé');
});

await test('Livrets : évaluations reliées à la période, exclusion, ajout, livret généré compétence par compétence', async () => {
  const data = await S(`const cls = store.get(store.getSettings().currentClassId); const year = store.get(cls.yearId); const per = model.periodOfDate(year, model.todayIso()) || model.periodsOf(year)[0];
    const st = model.studentsOfClass(cls.id)[0].student;
    const mk = (title, date, lvl) => store.create('evaluation', { classId: cls.id, title, subject: 'Mathématiques', date, items: [{ id: 'i1', label: title + ' item', maxPoints: '' }], results: { [st.id]: { items: { i1: { level: lvl } } } } });
    const a = await mk('Éval A test', per.start, 'A'); const b = await mk('Éval B test', per.start, 'NA'); const c = await mk('Éval C ancienne', '2020-01-10', 'D');
    return { a: a.id, b: b.id, c: c.id, per: per.id };`);
  await go('#/livrets');
  const panel = page.getByTestId('livret-evals'); await panel.locator('summary').click(); await page.waitForTimeout(150);
  const boxB = panel.locator('li', { hasText: 'Éval B test' }).getByTestId('livret-eval');
  await boxB.uncheck(); await page.waitForTimeout(300);
  await page.getByTestId('livret-evals').locator('summary').click().catch(() => {});
  await page.getByTestId('livret-eval-add').selectOption(data.c); await page.waitForTimeout(300);
  const ids = await page.evaluate(async () => { const st = await import('./js/store.js'); const m = await import('./js/model.js'); const L = await import('./js/pages/livrets.js'); const cls = st.get(st.getSettings().currentClassId); const y = st.get(cls.yearId); const per = m.periodOfDate(y, m.todayIso()) || m.periodsOf(y)[0]; return L.livretEvals(cls, per).map(e => e.title); });
  assert(ids.includes('Éval A test') && !ids.includes('Éval B test') && ids.includes('Éval C ancienne'), `sélection ${ids.join(', ')}`);
  await page.getByTestId('livrets-generate').click(); await page.waitForTimeout(300);
  const txt = await page.evaluate(() => window.__p || '');
  assert(txt.includes('Éval A test item') && !txt.includes('Éval B test item') && txt.includes('Éval C ancienne'), 'livret généré avec les évaluations choisies');
  assert((await page.evaluate(() => window.__n)) >= 2, 'un livret par élève');
});

await test('Maternelle : carnet de suivi des apprentissages avec réussites et portfolio', async () => {
  const ok = await S(`const cls = store.all('class').find(c => (c.levels || []).every(l => ['TPS','PS','MS','GS'].includes(l)) && !c.deletedAt); if (!cls) return false;
    await store.setSettings({ currentYearId: cls.yearId, currentClassId: cls.id }); const st = model.studentsOfClass(cls.id)[0]?.student; if (!st) return false;
    await store.create('observation', { studentId: st.id, date: model.todayIso(), kind: 'réussite', text: 'Écrit son prénom seul' }); return true;`);
  if (!ok) return;
  await go('#/livrets');
  assert((await page.locator('.page h1').innerText()).toLowerCase().includes('carnets de suivi'), 'titre maternelle');
  await page.getByTestId('livrets-generate').click(); await page.waitForTimeout(300);
  const txt = await page.evaluate(() => window.__p || '');
  assert(txt.includes('Carnet de suivi des apprentissages') && txt.includes('Écrit son prénom seul'), 'réussites dans le carnet');
  await S(`const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentYearId: cls.yearId, currentClassId: cls.id });`);
});

await test('Répartition chez les collègues : équitable, places limitées, absent, impression', async () => {
  await go('#/repartition');
  await page.getByTestId('rep-new').click(); await page.waitForTimeout(200);
  const names = page.getByTestId('rep-colleague-name');
  await names.nth(0).fill('Mme A (exemple)'); await names.nth(1).fill('M. B (exemple)');
  await page.getByTestId('rep-add-colleague').click(); await page.getByTestId('rep-colleague-name').nth(2).fill('Mme C (exemple)');
  await page.locator('.modal input[aria-label$="absent"]').first().check(); await page.waitForTimeout(100);
  await page.getByTestId('rep-auto').click(); await page.waitForTimeout(150);
  await page.getByTestId('rep-work').fill('Fichier de calcul p. 12');
  await page.getByTestId('rep-save').click(); await page.waitForTimeout(400);
  const r = await S(`return store.all('repartition')[0];`);
  const counts = Object.values(r.assign).reduce((m, c) => (m[c] = (m[c] || 0) + 1, m), {});
  eq(Object.keys(r.assign).length, N - 1, 'tous sauf l’absent');
  assert(Math.max(...Object.values(counts)) - Math.min(...Object.values(counts)) <= 1, 'équitable');
  eq(await page.getByTestId('rep-col').count(), 3, '3 classes d’accueil');
  await page.getByTestId('rep-print').click(); await page.waitForTimeout(200);
  assert((await page.evaluate(() => window.__p || '')).includes('Fichier de calcul p. 12'), 'travail sur la fiche');
  const D = await page.evaluate(async () => (await import('./js/pages/repartition.js')).distribute(['a', 'b', 'c', 'd', 'e'], [{ id: 'x', max: 1 }, { id: 'y' }]));
  eq(Object.values(D).filter(v => v === 'x').length, 1, 'places limitées respectées');
});

await test('Décloisonnement : activable, créneau du vendredi sur Aujourd’hui, case du cahier journal masquée si désactivé', async () => {
  await go('#/repartition'); await page.getByTestId('rep-tab-declo').click(); await page.waitForTimeout(200);
  await page.getByTestId('declo-enabled').check(); await page.waitForTimeout(300);
  await page.getByTestId('declo-new').click(); await page.waitForTimeout(150);
  const wd = await S(`return model.weekday(model.todayIso());`);
  if (wd <= 5) await page.getByTestId('declo-day').selectOption(String(wd));
  await page.getByTestId('declo-other').fill('CE2 A'); await page.getByTestId('declo-save').click(); await page.waitForTimeout(300);
  eq(await page.getByTestId('declo-card').count(), 1, 'créneau créé');
  if (wd <= 5) { await go('#/aujourdhui'); assert(await page.getByTestId('today-declo').count(), 'affiché sur Aujourd’hui'); }
  await go('#/repartition'); await page.getByTestId('declo-enabled').uncheck(); await page.waitForTimeout(300);
  eq(await S(`return store.all('declo').length;`), 1, 'créneau gardé');
  if (wd <= 5) { await go('#/aujourdhui'); eq(await page.getByTestId('today-declo').count(), 0, 'plus affiché'); }
});


await test('Fiches imprimées : phases, institutionnalisation, problématique, séance « si nécessaire », transmission seulement avec une binôme', async () => {
  const ids = await S(`const s = store.all('session').find(x => (x.phases || []).length && !x.deletedAt);
    await store.update(s.id, { problematique: 'PB-TEST', trace: 'TRACE-TEST', prolongement: 'PROLONG-TEST' });
    const P = await import('./js/pedago.js'); const last = P.sessionsOfSequence(s.sequenceId).at(-1); await store.update(last.id, { optional: true });
    return { s: s.id, q: s.sequenceId, cls: s.classId };`);
  await go(`#/seance/${ids.s}`); await page.getByTestId('print-session').click(); await page.waitForTimeout(200);
  let t = await page.evaluate(() => window.__p || '');
  for (const x of ['Fiche de préparation', 'Déroulement de la séance', 'Rôle de l’enseignante', 'Institutionnalisation, correction et évaluation', 'PB-TEST', 'TRACE-TEST', 'PROLONG-TEST', 'Bilan après la séance']) assert(t.includes(x), `séance : ${x}`);
  await S(`await store.update(a, { binome: { name: 'Binôme-test', active: true } });`, ids.cls);
  await go(`#/sequence/${ids.q}`); await page.getByTestId('print-sequence').click(); await page.waitForTimeout(200);
  t = await page.evaluate(() => window.__p || '');
  for (const x of ['Fiche de séquence', 'Institutionnalisation, évaluation et prolongement', 'si nécessaire', 'Transmission à Binôme-test']) assert(t.includes(x), `séquence : ${x}`);
  await S(`const c = store.get(a); await store.update(a, { binome: { ...c.binome, active: false } });`, ids.cls);
  await go(`#/sequence/${ids.q}`); await page.getByTestId('print-sequence').click(); await page.waitForTimeout(200);
  assert(!(await page.evaluate(() => window.__p || '')).includes('Transmission'), 'pas de transmission sans binôme');
});

await test('Coopérative : modifier le montant d’un mouvement puis le supprimer', async () => {
  const mv = await S(`const FI = await import('./js/finance.js'); const y = model.currentYear(); let acc = FI.accounts(y.id)[0];
    if (!acc) acc = await FI.createAccount({ name: 'Coop test', yearId: y.id });
    const r = await FI.addMovement({ kind: 'recette', abs: 1000, date: model.todayIso(), accountId: acc.id, mode: 'espèces', label: 'Vente test' }); return r.id;`);
  await go('#/argent?t=journal');
  const row = page.getByTestId('journal-row').filter({ hasText: 'Vente test' });
  await row.getByTestId('mv-edit').click(); await page.waitForTimeout(150);
  await page.getByTestId('mv-amount').fill('12,50'); await page.getByTestId('mv-save').click(); await page.waitForTimeout(300);
  eq(await S(`return store.get(a).amount;`, mv), 1250, 'montant modifié');
  await page.getByTestId('journal-row').filter({ hasText: 'Vente test' }).getByTestId('mv-delete').click(); await page.waitForTimeout(150);
  await page.getByTestId('mv-delete-confirm').click(); await page.waitForTimeout(300);
  eq(await S(`return !!store.get(a)?.deletedAt;`, mv), true, 'mouvement à la corbeille');
});

await test('Collègues : saisis une fois dans Contacts, choisis dans la surveillance, la répartition et le décloisonnement', async () => {
  await go('#/contacts');
  for (const [n, c] of [['Mme Alpha (exemple)', 'CM1'], ['M. Beta (exemple)', 'CE2 A']]) {
    await page.getByTestId('new-colleague').click(); await page.waitForTimeout(150);
    await page.locator('.modal input[name=name]').fill(n); await page.getByTestId('contact-classe').fill(c);
    await page.locator('.modal').getByRole('button', { name: 'Enregistrer' }).click(); await page.waitForTimeout(250);
  }
  await go('#/recreation');
  await page.getByTestId('recre-pick').click(); await page.waitForTimeout(150);
  for (const cb of await page.locator('.modal .pick-item input').all()) await cb.check();
  await page.locator('.modal').getByRole('button', { name: 'Valider' }).click(); await page.waitForTimeout(300);
  const t = await page.getByTestId('recre-people').innerText();
  assert(t.includes('Mme Alpha (exemple) (CM1)') && t.includes('M. Beta (exemple) (CE2 A)'), 'collègues ajoutés à la surveillance');
  await go('#/repartition'); await page.getByTestId('rep-tab-repartition').click(); await page.getByTestId('rep-new').click(); await page.waitForTimeout(150);
  await page.getByTestId('rep-pick-colleagues').click(); await page.waitForTimeout(150);
  for (const cb of await page.locator('.modal .pick-item input').all()) await cb.check();
  await page.locator('.modal').last().getByRole('button', { name: 'Valider' }).click(); await page.waitForTimeout(200);
  const names = await page.getByTestId('rep-colleague-name').evaluateAll(els => els.map(e => e.value));
  assert(names.includes('Mme Alpha (exemple)') && names.includes('M. Beta (exemple)'), `collègues dans la répartition : ${names}`);
  await page.getByTestId('rep-auto').click(); await page.getByTestId('rep-save').click(); await page.waitForTimeout(300);
  const r = await S(`return store.all('repartition').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];`);
  assert(r.colleagues.some(c => c.room === 'CM1'), 'classe reprise du contact');
  await page.getByTestId('rep-tab-declo').click(); await page.waitForTimeout(150);
  if (!(await page.getByTestId('declo-enabled').isChecked())) { await page.getByTestId('declo-enabled').check(); await page.waitForTimeout(250); }
  await page.getByTestId('declo-new').click(); await page.waitForTimeout(150);
  const opt = await page.getByTestId('declo-colleague').locator('option', { hasText: 'Beta' }).getAttribute('value');
  await page.getByTestId('declo-colleague').selectOption(opt);
  eq(await page.getByTestId('declo-other').inputValue(), 'CE2 A', 'classe remplie depuis le contact');
  await page.locator('.modal').getByRole('button', { name: 'Annuler' }).click();
});

await test('Diaporamas : ajouter un lien Canva relié à une séance, puis un diaporama libre', async () => {
  const sid = await S(`return store.all('session').find(x => !x.deletedAt && x.classId === store.getSettings().currentClassId)?.id;`);
  await go('#/diaporamas');
  await page.getByTestId('diapo-add-link').click(); await page.waitForTimeout(150);
  await page.getByTestId('diapo-new-url').fill('https://www.canva.com/design/EXEMPLE/view');
  await page.getByTestId('diapo-new-title').fill('Canva test');
  if (sid) await page.getByTestId('diapo-new-session').selectOption(sid);
  await page.getByTestId('diapo-new-save').click(); await page.waitForTimeout(400);
  const ss = await S(`return store.all('slideshow').find(x => x.slides.some(s => s.url === 'https://www.canva.com/design/EXEMPLE/view'));`);
  assert(ss, 'diaporama avec le lien'); if (sid) eq(ss.sessionId, sid, 'relié à la séance');
  assert(page.url().includes(`#/diaporamas/${ss.id}`), 'éditeur ouvert');
  await go('#/diaporamas'); await page.getByTestId('diapo-new').click(); await page.waitForTimeout(150);
  await page.getByTestId('diapo-new-title').fill('Rituels test'); await page.getByTestId('diapo-new-save').click(); await page.waitForTimeout(300);
  assert(await S(`return store.all('slideshow').some(x => x.title === 'Rituels test');`), 'diaporama libre créé');
  await go('#/diaporamas'); await page.getByTestId('diapo-add-link').click(); await page.getByTestId('diapo-new-url').fill('pas une adresse');
  await page.getByTestId('diapo-new-save').click(); await page.waitForTimeout(150);
  assert((await page.locator('.modal .form-errors').innerText()).includes('Adresse invalide'), 'adresse refusée');
  await page.locator('.modal').getByRole('button', { name: 'Annuler' }).click();
});

await test('Aucune erreur dans la console', async () => { eq(errors.length, 0, errors.join(' | ')); });
await browser.close();
writeFileSync(`${OUT}resultats-livrets.txt`, results.join('\n'));
console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
