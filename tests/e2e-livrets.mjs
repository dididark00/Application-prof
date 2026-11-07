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
await ctx.addInitScript(() => { try { if (!localStorage.getItem('classeur.cahier.layout')) localStorage.setItem('classeur.cahier.layout', 'liste'); } catch { /* */ } }); // cahier en liste complète (les deux panneaux sont testés à part)
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
  await page.getByTestId('livrets-generate').click(); await page.waitForTimeout(200); await page.getByTestId('gen-go').click(); await page.waitForTimeout(300);
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
  await page.getByTestId('livrets-generate').click(); await page.waitForTimeout(200); await page.getByTestId('gen-go').click(); await page.waitForTimeout(300);
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
  await page.getByTestId('assoc-kind').selectOption('seance');
  if (sid) await page.getByTestId('assoc-session').selectOption(sid);
  await page.getByTestId('diapo-new-save').click(); await page.waitForTimeout(400);
  const ss = await S(`return store.all('slideshow').find(x => x.slides.some(s => s.url === 'https://www.canva.com/design/EXEMPLE/view'));`);
  assert(ss, 'diaporama avec le lien'); if (sid) eq(ss.sessionId, sid, 'relié à la séance');
  assert(page.url().includes(`#/diaporamas/${ss.id}`), 'éditeur ouvert');
  await go('#/diaporamas'); await page.getByTestId('diapo-new').click(); await page.waitForTimeout(150);
  await page.getByTestId('diapo-new-title').fill('Rituels test'); await page.getByTestId('diapo-new-save').click(); await page.waitForTimeout(300);
  const rit = await S(`return store.all('slideshow').find(x => x.title === 'Rituels test');`);
  assert(rit && rit.range && rit.range.kind === 'semaine', 'diaporama rattaché à la semaine par défaut');
  await go('#/diaporamas'); await page.getByTestId('diapo-tab-semaine').click(); await page.waitForTimeout(200);
  // Semaine affichée = semaine actuelle ; le diaporama de la semaine apparaît en tête des jours concernés.
  if (await S(`return model.mondayOf(model.todayIso()) === a;`, rit.range.from)) assert(await page.getByTestId('diapo-range').count() >= 1, 'affiché sur les jours de la semaine');
  // Mois et séquence entière
  await page.getByTestId('diapo-add-link').click(); await page.getByTestId('diapo-new-url').fill('https://docs.google.com/presentation/d/EXEMPLE/edit');
  await page.getByTestId('diapo-new-title').fill('Mois test'); await page.getByTestId('assoc-kind').selectOption('mois'); await page.getByTestId('assoc-month').fill('2026-12');
  await page.getByTestId('diapo-new-save').click(); await page.waitForTimeout(300);
  const mo = await S(`return store.all('slideshow').find(x => x.title === 'Mois test')?.range;`);
  eq(`${mo.from} ${mo.to}`, '2026-12-01 2026-12-31', 'mois entier');
  const qid = await S(`return store.all('sequence').find(q => !q.deletedAt && q.classId === store.getSettings().currentClassId)?.id;`);
  if (qid) {
    await go('#/diaporamas'); await page.getByTestId('diapo-add-link').click(); await page.getByTestId('diapo-new-url').fill('https://www.canva.com/design/SEQ/view');
    await page.getByTestId('diapo-new-title').fill('Séquence test'); await page.getByTestId('assoc-kind').selectOption('sequence'); await page.getByTestId('assoc-sequence').selectOption(qid);
    await page.getByTestId('diapo-new-save').click(); await page.waitForTimeout(300);
    eq(await S(`return store.all('slideshow').find(x => x.title === 'Séquence test')?.sequenceId;`), qid, 'rattaché à la séquence');
    await go('#/diaporamas'); await page.getByTestId('diapo-tab-tous').click(); await page.waitForTimeout(200);
    assert((await page.getByTestId('diapo-all').innerText()).includes('Séquence :'), 'rattachement lisible dans « Tous »');
  }
  await go('#/diaporamas'); await page.getByTestId('diapo-add-link').click(); await page.getByTestId('diapo-new-url').fill('pas une adresse');
  await page.getByTestId('diapo-new-save').click(); await page.waitForTimeout(150);
  assert((await page.locator('.modal .form-errors').innerText()).includes('Adresse invalide'), 'adresse refusée');
  await page.locator('.modal').getByRole('button', { name: 'Annuler' }).click();
});

await test('Cahier journal : dupliquer une activité à côté pour les CE2 A, sans conflit, et masquer les CE2 A à l’impression', async () => {
  const d = await S(`const cls = store.get(store.getSettings().currentClassId); const PL = await import('./js/planning.js');
    for (let k = 0; k < 30; k++) { const x = model.addDays('2026-11-02', k); const p = PL.dayPlan(cls, x); if (p.school.ok && p.entries.some(e => e.kind !== 'event')) return x; } return null;`);
  await go(`#/cahier?d=${d}`);
  const n0 = await page.getByTestId('entry').count();
  await page.getByTestId('entry-more').first().click(); await page.getByTestId('duplicate-activity').first().click(); await page.waitForTimeout(150);
  await page.getByTestId('dup-group').fill('CE2 A'); await page.getByTestId('dup-save').click(); await page.waitForTimeout(400);
  eq(await page.getByTestId('entry').count(), n0 + 1, 'copie ajoutée');
  assert(await page.getByTestId('side-row').count() >= 1, 'affichées côte à côte');
  eq(await page.getByTestId('conflicts').count(), 0, 'pas de conflit entre deux groupes');
  const title = await S(`return store.all('occurrence').find(o => o.group === 'CE2 A')?.title ?? '';`);
  await page.getByTestId('print-day').click(); await page.waitForTimeout(150);
  await page.getByTestId('print-hide-group').check(); await page.getByTestId('print-day-go').click(); await page.waitForTimeout(200);
  let t = await page.evaluate(() => window.__p || '');
  assert(!t.includes('CE2 A'), 'CE2 A masqués');
  await page.getByTestId('print-day').click(); await page.waitForTimeout(150); await page.getByTestId('print-day-go').click(); await page.waitForTimeout(200);
  t = await page.evaluate(() => window.__p || '');
  assert(t.includes('CE2 A'), 'CE2 A affichés si non masqués');
  // Dupliquer à une autre date
  await page.getByTestId('entry-more').first().click(); await page.getByTestId('duplicate-activity').first().click(); await page.waitForTimeout(150);
  const other = await S(`return model.addDays(a, 7);`, d);
  await page.getByTestId('dup-date').fill(other); await page.getByTestId('dup-save').click(); await page.waitForTimeout(300);
  assert(await S(`return store.all('occurrence').some(o => o.date === a && !o.group && !o.slotId);`, other), 'copie à une autre date');
  void title;
});

await test('Cahier journal en deux panneaux : la journée à gauche, le détail à droite, ♡ pour cocher, progression', async () => {
  const d = await S(`const cls = store.get(store.getSettings().currentClassId); const PL = await import('./js/planning.js');
    for (let k = 0; k < 30; k++) { const x = model.addDays('2026-11-09', k); const p = PL.dayPlan(cls, x); if (p.school.ok && p.entries.filter(e => e.kind !== 'event' && e.status === 'prévue').length >= 2) return x; } return null;`);
  assert(d, 'jour avec au moins deux activités');
  await go(`#/cahier?d=${d}`);
  await page.getByTestId('layout-panneaux').click(); await page.waitForTimeout(250);
  assert(await page.getByTestId('day-split').count() === 1, 'deux panneaux');
  const n = await page.getByTestId('tl-card').count();
  assert(n >= 2, 'cartes de la journée');
  eq(await page.getByTestId('entry').count(), 1, 'une seule activité détaillée à droite');
  const second = page.getByTestId('tl-card').nth(1);
  const title2 = (await second.locator('.cj-title').innerText()).trim();
  await second.locator('.cj-pick').click(); await page.waitForTimeout(200);
  assert((await page.getByTestId('entry').innerText()).includes(title2), 'le détail suit la sélection');
  const before = await page.getByTestId('day-progress').innerText();
  await page.getByTestId('tl-card').nth(1).getByTestId('tl-check').click(); await page.waitForTimeout(400);
  const after = await page.getByTestId('day-progress').innerText();
  assert(before !== after && /^\d+ faites? sur \d+/.test(after), `progression mise à jour (${before} → ${after})`);
  assert((await page.getByTestId('entry').innerText()).includes(title2), 'la sélection reste après avoir coché');
  eq(await page.getByTestId('tl-card').nth(1).getByTestId('tl-check').getAttribute('aria-pressed'), 'true', 'cochée');
  await page.getByTestId('journal-more').click();
  assert(await page.getByTestId('export-journal').isVisible(), 'Exporter dans « Plus »');
  await page.keyboard.press('Escape');
  await page.getByTestId('layout-liste').click(); await page.waitForTimeout(250);
  eq(await page.getByTestId('day-split').count(), 0, 'retour à la liste complète');
});

await test('Fiche de séance par étapes : sommaire avec état, barre des durées, prête pour une visite', async () => {
  const id = await S(`return store.all('session').find(s => !s.deletedAt && (s.phases || []).some(p => Number(p.duration) > 0))?.id;`);
  await go(`#/seance/${id}`);
  assert(await page.getByTestId('session-steps').isVisible(), 'sommaire des étapes');
  assert(await page.getByTestId('phase-bar').isVisible(), 'barre des durées');
  assert(/0\/10/.test(await page.getByTestId('visit-ready').innerText()), 'checklist de visite à 0/10');
  await page.getByTestId('step-phases').click(); await page.waitForTimeout(500);
  assert(await page.locator('#etape-phases').isVisible(), 'aller au déroulement');
  await page.getByTestId('visit-open').click(); await page.waitForTimeout(400);
  eq(await S(`return store.get(a).mode;`, id), 'visite', 'mode Visite ouvert');
  await page.locator('#etape-visite input[type=checkbox]').first().check(); await page.waitForTimeout(600);
  await go('#/'); await go(`#/seance/${id}`);
  assert(/1\/10/.test(await page.getByTestId('visit-ready').innerText()), 'compte mis à jour');
  await page.getByTestId('mode-quotidien').click(); await page.waitForTimeout(300);
});

await test('Cantine et services : « tous » coche la ligne de l’élève, la colonne du jour et toute la classe, et redevient « aucun »', async () => {
  await go('#/services?t=semaine'); await page.waitForTimeout(200);
  const card = page.locator('section.card').filter({ has: page.getByTestId('svc-all-class') }).first();
  const boxes = card.getByTestId('svc-check');
  const nDays = await card.getByTestId('svc-all-day').count();
  if ((await card.getByTestId('svc-all-student').first().innerText()).trim() === 'aucun') { await card.getByTestId('svc-all-student').first().click(); await page.waitForTimeout(400); }
  eq((await card.getByTestId('svc-all-student').first().innerText()).trim(), 'tous', 'bouton « tous »');
  await card.getByTestId('svc-all-student').first().click(); await page.waitForTimeout(400);
  for (let i = 0; i < nDays; i++) assert(await boxes.nth(i).isChecked(), `élève coché jour ${i + 1}`);
  eq((await card.getByTestId('svc-all-student').first().innerText()).trim(), 'aucun', 'devient « aucun »');
  await card.getByTestId('svc-all-student').first().click(); await page.waitForTimeout(400);
  assert(!(await boxes.first().isChecked()), 'ligne décochée');
  if ((await card.getByTestId('svc-all-day').first().innerText()).trim() === 'aucun') { await card.getByTestId('svc-all-day').first().click(); await page.waitForTimeout(400); }
  await card.getByTestId('svc-all-day').first().click(); await page.waitForTimeout(400);
  const n = await boxes.count();
  for (let i = 0; i < n; i += nDays) assert(await boxes.nth(i).isChecked(), 'colonne du premier jour cochée');
  if ((await card.getByTestId('svc-all-class').innerText()).includes('décocher')) { await card.getByTestId('svc-all-class').click(); await page.waitForTimeout(400); }
  await card.getByTestId('svc-all-class').click(); await page.waitForTimeout(400);
  for (let i = 0; i < n; i++) assert(await boxes.nth(i).isChecked(), 'toute la classe cochée');
  await card.getByTestId('svc-all-class').click(); await page.waitForTimeout(400);
  for (let i = 0; i < n; i++) assert(!(await boxes.nth(i).isChecked()), 'tout décoché');
  const before = await page.getByTestId('svc-all-class').count();
  await page.getByTestId('svc-edit-list').click();
  const ta = page.getByTestId('svc-list'); await ta.fill((await ta.inputValue()) + '\nAtelier du soir (test)');
  await page.getByTestId('svc-list-save').click(); await page.waitForTimeout(400);
  eq(await page.getByTestId('svc-all-class').count(), before + 1, 'service ajouté depuis la page');
  assert(await page.getByRole('heading', { name: 'Atelier du soir (test)' }).isVisible(), 'nouveau service affiché');
});

await test('Dates tapées au clavier : l’année se tape en entier (pas de saut après 2 chiffres)', async () => {
  await go('#/cahier?d=2026-11-05');
  const inp = page.getByTestId('day-date');
  await inp.focus(); await page.keyboard.press('Control+a').catch(() => {});
  for (const k of '10112026') { await page.keyboard.press(k); await page.waitForTimeout(60); }
  const typed = await inp.inputValue();
  assert(/^2026-(10-11|11-10)$/.test(typed), `année tapée en entier sans perdre le champ (${typed})`);
  await inp.press('Enter'); await page.waitForTimeout(400);
  const hash = await page.evaluate(() => location.hash);
  assert(hash.includes(`d=${typed}`), `jour atteint en tapant la date complète (${hash})`);
  assert(!/d=0/.test(hash), 'jamais d’année partielle');
});

await test('Menu regroupé : Préparer en 4 groupes (menu, onglets, « Plus »), toutes les pages toujours accessibles', async () => {
  await go('#/sequences');
  const groups = page.getByTestId('subtabs-groups').locator('a');
  eq(JSON.stringify(await groups.allInnerTexts()), JSON.stringify(['Mon année', 'Séquences et séances', 'Mes ressources', 'Créer']), 'groupes de Préparer');
  const pages = await page.locator('.subtabs-wrap > nav.subtabs:not(.subtabs-groups) a').allInnerTexts();
  eq(JSON.stringify(pages), JSON.stringify(['Séquences', 'Fiches de séance', 'Leçons']), 'pages du groupe affiché');
  await groups.filter({ hasText: 'Créer' }).click(); await page.waitForTimeout(300);
  assert((await page.evaluate(() => location.hash)).startsWith('#/atelier'), 'le groupe ouvre sa première page');
  const side = page.locator('#sidebar');
  assert(await side.getByRole('link', { name: 'Générateur EPS' }).isVisible(), 'groupe courant ouvert dans le menu');
  assert(!(await side.getByRole('link', { name: 'Manuels' }).count()), 'les autres groupes sont repliés');
  await side.getByRole('button', { name: /Mes ressources/ }).click(); await page.waitForTimeout(200);
  await side.getByRole('link', { name: 'Manuels' }).click(); await page.waitForTimeout(300);
  assert((await page.evaluate(() => location.hash)).startsWith('#/manuels'), 'page atteinte depuis un groupe déplié');
  await go('#/plus');
  assert((await page.locator('.more-grp').allInnerTexts()).map(x => x.toLowerCase()).includes('mon année'), 'groupes dans « Plus »');
  const n = await S(`const R = await import('./js/router.js'); return R.visibleRubriques().flatMap(r => r.sous).length;`);
  eq(await page.locator('[data-testid=more-sections] .more-list a').count(), n, 'aucune page perdue');
});

await test('Tableaux sur téléphone : une carte par ligne avec le nom des colonnes (élèves, cantine), cases toujours cliquables', async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
  const p2 = await m.newPage();
  await p2.goto(BASE); await p2.waitForTimeout(600);
  await p2.evaluate(async () => (await import('./js/demo.js')).loadDemo()); await p2.waitForTimeout(600);
  await p2.evaluate(() => { location.hash = '#/eleves'; }); await p2.waitForTimeout(800);
  const t = p2.locator('#main table.table').first();
  eq(await t.getAttribute('data-cards'), '1', 'tableau des élèves en cartes');
  assert((await t.locator('td[data-label="Prénom"]').count()) > 0, 'étiquette de colonne');
  eq(await p2.evaluate(() => document.documentElement.scrollWidth), 390, 'pas de défilement horizontal');
  await p2.evaluate(() => { location.hash = '#/services?t=semaine'; }); await p2.waitForTimeout(800);
  const box = p2.getByTestId('svc-check').first(); const was = await box.isChecked();
  await box.click(); await p2.waitForTimeout(300);
  eq(await box.isChecked(), !was, 'case cochée sur téléphone');
  await box.click(); await p2.waitForTimeout(300);
  assert(await p2.getByTestId('svc-all-day').first().isVisible(), '« tous » par jour visible sur téléphone');
  await m.close();
});

await test('Cahier journal : glisser une activité (échanger, déplacer sur une heure) et masquer / revoir les annulées et reportées', async () => {
  const d = await S(`const cls = store.get(store.getSettings().currentClassId); const PL = await import('./js/planning.js');
    for (let k = 0; k < 40; k++) { const x = model.addDays('2026-11-16', k); const p = PL.dayPlan(cls, x); if (p.school.ok && p.entries.filter(e => e.kind !== 'event' && !e.allDay && e.status === 'prévue').length >= 3) return x; } return null;`);
  assert(d, 'jour avec 3 activités');
  await go(`#/cahier?d=${d}`);
  await page.getByTestId('layout-panneaux').click(); await page.waitForTimeout(300);
  const info = async () => page.evaluate(() => [...document.querySelectorAll('[data-testid=tl-card]')].map(c => ({ t: c.querySelector('.cj-title').textContent, time: c.closest('.cj-row').dataset.start })));
  const before = await info();
  const drag = async (from, to) => {
    const a = await from.boundingBox(), b = await to.boundingBox();
    await page.mouse.move(a.x + 20, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + 40, a.y + a.height / 2 + 10, { steps: 4 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
    await page.mouse.up(); await page.waitForTimeout(600);
  };
  // échanger la 1re et la 3e
  await drag(page.getByTestId('tl-card').nth(0), page.getByTestId('tl-card').nth(2));
  const after = await info();
  const t0 = after.find(x => x.t === before[0].t), t2 = after.find(x => x.t === before[2].t);
  eq(t0.time, before[2].time, 'la 1re a pris l’horaire de la 3e');
  eq(t2.time, before[0].time, 'la 3e a pris l’horaire de la 1re');
  // déplacer la 2e sur l'heure de la (nouvelle) première ligne : côte à côte
  const second = page.getByTestId('tl-card').filter({ hasText: before[1].t }).first();
  const firstTime = page.locator('.cj-row .cj-time').first();
  const target = await firstTime.innerText();
  await drag(second, firstTime);
  const moved = (await info()).find(x => x.t === before[1].t);
  eq(moved.time, target, 'déplacée à l’heure choisie');
  // un clic simple sélectionne toujours
  await page.getByTestId('tl-card').nth(1).locator('.cj-pick').click(); await page.waitForTimeout(200);
  assert(await page.getByTestId('entry').count() === 1, 'détail toujours affiché');
  // annuler une activité puis la masquer / revoir
  await page.getByTestId('entry').getByTestId('entry-more').click().catch(() => {});
  await S(`const cls = store.get(store.getSettings().currentClassId); const PL = await import('./js/planning.js'); const e = PL.dayPlan(cls, a).entries.find(x => x.kind !== 'event' && x.status === 'prévue'); await PL.setStatus(e, cls, 'annulée'); return true;`, d);
  await go('#/'); await go(`#/cahier?d=${d}`);
  const n1 = await page.getByTestId('tl-card').count();
  const btn = page.getByTestId('toggle-off');
  assert((await btn.innerText()).includes('Voir'), 'masquées par défaut');
  await btn.click(); await page.waitForTimeout(300);
  eq(await page.getByTestId('tl-card').count(), n1 + 1, 'annulée réaffichée');
  await page.getByTestId('toggle-off').click(); await page.waitForTimeout(300);
  eq(await page.getByTestId('tl-card').count(), n1, 'annulée de nouveau masquée');
  await page.getByTestId('view-semaine').click(); await page.waitForTimeout(400);
  assert(await page.getByTestId('subject-legend').isVisible(), 'légende des matières en vue semaine');
  const colors = await page.$$eval('[data-testid=week-entry]', els => [...new Set(els.map(e => e.style.getPropertyValue('--c')))]);
  assert(colors.length >= 2, `couleurs par matière en vue semaine (${colors.join(', ')})`);
  await page.getByTestId('view-jour').click(); await page.waitForTimeout(300);
  await page.getByTestId('layout-liste').click();
});

await test('Séance pas cochée : proposition « Décaler la séquence » (S1 prend la place de S2, S2 celle de S3, S3 au prochain créneau libre)', async () => {
  const r = await S(`const cls = store.get(store.getSettings().currentClassId); const PL = await import('./js/planning.js');
    const today = model.todayIso(); const school = (from, dir) => { let d = from; for (let k = 0; k < 30; k++) { d = model.addDays(d, dir); if (PL.isSchoolDay(cls, d).ok) return d; } };
    const d0 = school(today, -1), d1 = school(today, 1), d2 = school(d1, 1);
    const seq = await store.create('sequence', { classId: cls.id, title: 'Séquence décalage (test)', subject: 'Mathématiques', levels: cls.levels });
    const ss = []; for (let i = 1; i <= 3; i++) ss.push(await store.create('session', { classId: cls.id, sequenceId: seq.id, order: i, title: 'Décalage S' + i, subject: 'Mathématiques', levels: cls.levels, phases: [] }));
    const mk = (d, s, st) => store.create('occurrence', { classId: cls.id, date: d, start: '15:00', end: '15:45', subject: 'Mathématiques', levels: cls.levels, mode: 'dirigé', status: 'prévue', sessionId: s.id });
    const o0 = await mk(d0, ss[0]), o1 = await mk(d1, ss[1]), o2 = await mk(d2, ss[2]);
    return { d0, d1, d2, s: ss.map(x => x.id), o: [o0.id, o1.id, o2.id] };`);
  await go(`#/cahier?d=${r.d0}`);
  const row = page.getByTestId('unchecked-row').filter({ hasText: 'Décalage S1' });
  assert(await row.isVisible(), 'séance passée non cochée proposée');
  await row.getByTestId('unchecked-shift').click(); await page.waitForTimeout(300);
  const pv = await page.getByTestId('shift-preview').innerText();
  assert(pv.includes('Décalage S1') && pv.includes('Décalage S2') && pv.includes('Décalage S3'), 'aperçu des 3 séances');
  await page.getByTestId('shift-go').click(); await page.waitForTimeout(500);
  const after = await S(`return a.o.map(id => { const o = store.get(id); return [o.status, o.sessionId]; });`, r);
  eq(after[0][0], 'reportée', 'S1 d’origine marquée reportée');
  eq(after[1][1], r.s[0], 'S1 prend la place de S2');
  eq(after[2][1], r.s[1], 'S2 prend la place de S3');
  const s3 = await S(`return store.all('occurrence').filter(o => !o.deletedAt && o.sessionId === a.s[2] && o.status === 'prévue').map(o => o.date);`, r);
  assert(s3.length === 1 && s3[0] > r.d2, `S3 au prochain créneau libre (${s3.join(', ')})`);
  assert(!(await page.getByTestId('unchecked-row').filter({ hasText: 'Décalage S1' }).count()), 'plus proposée une fois décalée');
  // Annuler défait tout d'un coup
  await S(`await store.undo(); return true;`); await page.waitForTimeout(300);
  const back = await S(`return a.o.map(id => { const o = store.get(id); return [o.status, o.sessionId]; });`, r);
  eq(JSON.stringify(back), JSON.stringify([['prévue', r.s[0]], ['prévue', r.s[1]], ['prévue', r.s[2]]]), 'Annuler défait tout le décalage d’un coup');
});

await test('Programmes : tout importer pour la classe, relier les compétences aux séquences, compétences et phases dans le cahier journal imprimé', async () => {
  await go('#/referentiels');
  await page.getByTestId('import-all').click(); await page.waitForTimeout(150);
  await page.getByTestId('import-all-go').click(); await page.waitForTimeout(2500);
  const nref = await S(`return store.all('referential').filter(r => r.status === 'validé').length;`);
  assert(nref >= 5, `référentiels validés : ${nref}`);
  await page.getByTestId('go-link').click(); await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelectorAll('.link-comps details').forEach(d => { d.open = true; }));
  assert(await page.getByTestId('link-comp').count() > 0, 'compétences suggérées');
  await page.getByTestId('link-comp').first().check(); await page.getByTestId('link-save').click(); await page.waitForTimeout(400);
  const seq = await S(`return store.all('sequence').find(s => (s.competencyIds || []).length);`);
  assert(seq, 'séquence reliée');
  const d = await S(`const P = await import('./js/pedago.js'); const ses = P.sessionsOfSequence(a); for (const x of ses) { const o = P.occurrencesOfSession(x.id)[0]; if (o) return o.date; } return null;`, seq.id);
  if (!d) return;
  await go(`#/cahier?d=${d}`); await page.getByTestId('print-day').click(); await page.waitForTimeout(200);
  if (await page.getByTestId('print-day-go').count()) { await page.getByTestId('print-day-go').click(); await page.waitForTimeout(200); }
  const t = await page.evaluate(() => window.__p || '');
  assert(/Compétences/i.test(t) && /MA\.CE2|FR\.CE2|CE2\./.test(t), 'compétences imprimées');
  assert(/Déroulement/i.test(t), 'déroulement imprimé');
});

await test('Atelier : agrandir l’affichage au tableau, et plusieurs supports pour une même séance', async () => {
  await go('#/atelier');
  await page.getByRole('button', { name: 'Afficher en grand' }).click(); await page.waitForTimeout(300);
  await page.getByTestId('zoom-in').click(); await page.getByTestId('zoom-in').click(); await page.waitForTimeout(100);
  eq(await page.getByTestId('zoom-label').innerText(), '200 %', 'zoom 200 %');
  const w = await page.evaluate(() => document.querySelector('.animate-board svg').getBoundingClientRect().width);
  assert(w > 1280, `page agrandie (${w}px)`);
  await page.getByTestId('zoom-out').click(); await page.getByTestId('zoom-out').click(); await page.waitForTimeout(100);
  eq(await page.getByTestId('zoom-label').innerText(), 'Page entière', 'retour page entière');
  await page.locator('.animate-bar').getByRole('button', { name: 'Fermer' }).click();
  const sid = await S(`return store.all('session').find(x => !x.deletedAt && x.classId === store.getSettings().currentClassId)?.id;`);
  if (!sid) return;
  const n0 = await S(`return (store.get(a).fileIds || []).length;`, sid);
  for (const nm of ['Support A', 'Support B']) {
    await page.getByTestId('atelier-save').click(); await page.waitForTimeout(150);
    await page.getByTestId('support-name').fill(nm); await page.getByTestId('support-name-ok').click(); await page.waitForTimeout(200);
    await page.locator('.modal').last().locator('.pick-item', { has: page.locator(`input`) }).filter({ hasText: await S(`const P = await import('./js/pedago.js'); return P.sessionTitle(store.get(a));`, sid) }).first().locator('input').check();
    await page.locator('.modal').last().getByRole('button', { name: 'Valider' }).click(); await page.waitForTimeout(300);
  }
  const names = await S(`return (store.get(a).fileIds || []).map(id => store.get(id)?.name);`, sid);
  assert(names.length >= n0 + 2 && names.some(x => x.startsWith('Support A')) && names.some(x => x.startsWith('Support B')), `deux supports liés : ${names}`);
});

await test('Bibliothèque de compétences : import d’un fichier Excel (niveau de la classe), réimport sans doublon, proposée dans le choix des compétences', async () => {
  await go('#/referentiels');
  const file = new URL('./fixtures/competences-exemple.xlsx', import.meta.url).pathname;
  for (let k = 0; k < 2; k++) {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('import-library').click()]);
    await fc.setFiles(file); await page.waitForTimeout(600);
    assert((await page.locator('.modal').innerText()).includes('5 compétence(s)'), 'fichier lu');
    await page.getByTestId('lib-go').click(); await page.waitForTimeout(400);
  }
  const refs = await S(`return store.all('referential').filter(r => r.libraryKey).map(r => ({ name: r.name, n: r.items.length, status: r.status, nature: r.nature }));`);
  eq(refs.length, 3, `3 disciplines CE2, sans doublon (${refs.map(r => r.name)})`);
  assert(refs.every(r => r.status === 'validé' && /Reformulations/.test(r.nature)), 'validées et marquées reformulations');
  eq(refs.find(r => r.name.startsWith('Mathématiques')).n, 2, '2 compétences de maths CE2');
  assert(!(await S(`return JSON.stringify(store.all('referential'));`)).includes('Lire un texte long'), 'CM1 non importé');
});

await test('Livret : notes et niveaux repris des évaluations, modifiables, livret prêt pour les parents', async () => {
  await S(`const cls = store.get(store.getSettings().currentClassId); const year = store.get(cls.yearId); const per = model.periodOfDate(year, model.todayIso()) || model.periodsOf(year)[0];
    const st = model.studentsOfClass(cls.id)[0].student;
    await store.create('evaluation', { classId: cls.id, title: 'Éval notée test', subject: 'Français', date: per.start, items: [{ id: 'q1', label: 'Dictée notée', maxPoints: '10' }], results: { [st.id]: { items: { q1: { level: 'A', points: 8 } } } } });`);
  await go('#/livrets');
  await page.getByTestId('livrets-fill-marks').click(); await page.waitForTimeout(500);
  const m = await S(`const cls = store.get(store.getSettings().currentClassId); const st = model.studentsOfClass(cls.id)[0].student; return store.all('report').find(r => r.studentId === st.id && r.marks?.['Français'])?.marks['Français'];`);
  eq(m?.note, '16', 'note sur 20 calculée (8/10)');
  eq(m?.level, 'A', 'niveau proposé');
  const first = page.getByTestId('report-card').first();
  const note = first.getByTestId('mark-note').first(); await note.fill('15,5'); await note.dispatchEvent('change'); await page.waitForTimeout(300);
  await first.getByRole('button', { name: /Imprimer le bilan/ }).click(); await page.waitForTimeout(150);
  await page.getByTestId('gen-go').click(); await page.waitForTimeout(300);
  const t = await page.evaluate(() => window.__p || '');
  for (const x of ['Livret scolaire', '/ 20', 'Dictée notée', 'Les responsables légaux', 'Niveaux :']) assert(t.includes(x), `livret : ${x}`);
  await page.getByTestId('livrets-generate').click(); await page.waitForTimeout(150);
  await page.getByTestId('gen-notes').uncheck(); await page.getByTestId('gen-go').click(); await page.waitForTimeout(300);
  assert(!(await page.evaluate(() => window.__p || '')).includes('/ 20'), 'notes masquées sur demande');
  await S(`const c = store.get(store.getSettings().currentClassId); await store.update(c.id, { livretOptions: { ...(c.livretOptions || {}), notes: true } });`);
});

await test('Générateur EPS : proposition selon matériel et espace, modifiable, brouillon conservé, enregistrement (séquence, fiches, schémas, progression)', async () => {
  await go('#/eps-generateur');
  await page.getByTestId('gen-fam').selectOption('collectifs'); await page.getByTestId('gen-sub').selectOption('traditionnels');
  await page.getByTestId('gen-sessions').fill('3'); await page.getByTestId('gen-sessions').dispatchEvent('input');
  await page.getByTestId('gen-propose').click(); await page.waitForTimeout(400);
  eq(await page.getByTestId('gen-session').count(), 3, '3 séances proposées');
  const t = page.getByTestId('gen-title').first(); await t.fill('Séance modifiée (test)'); await page.waitForTimeout(400);
  await page.reload(); await page.waitForFunction(() => window.__classeurReady === true); await page.waitForTimeout(400);
  await page.evaluate(() => { window.print = () => { window.__p = document.getElementById('print-root').textContent; }; });
  eq(await page.getByTestId('gen-title').first().inputValue(), 'Séance modifiée (test)', 'brouillon retrouvé après rechargement');
  await page.getByTestId('gen-swap').first().selectOption({ index: 1 }); await page.waitForTimeout(200);
  // Sans plots ni chasubles en salle : le béret et la balle au capitaine ne sont plus proposés
  const pid = await S(`const c = store.get(store.getSettings().currentClassId); return model.periodsOf(store.get(c.yearId))[1]?.id || model.periodsOf(store.get(c.yearId))[0].id;`);
  await page.getByTestId('gen-period').selectOption(pid);
  await page.getByTestId('gen-save').click(); await page.waitForTimeout(1200);
  const r = await S(`const seq = store.all('sequence').find(s => s.generatedBy === 'eps-gen'); const P = await import('./js/pedago.js'); const ses = P.sessionsOfSequence(seq.id);
    return { title: ses[0].title, n: ses.length, phases: ses[0].phases.length, diag: store.all('epsdiagram').filter(d => ses.some(x => x.id === d.sessionId)).length,
      prog: store.all('progression').find(p => p.subject === 'EPS' && p.periodId === a)?.rows.filter(rw => rw.sequenceId === seq.id).length };`, pid);
  eq(r.title, 'Séance modifiée (test)', 'modification enregistrée'); eq(r.n, 3, '3 fiches'); assert(r.phases >= 3, 'phases détaillées'); eq(r.diag, 3, 'un schéma par séance'); eq(r.prog, 3, '3 semaines de progression');
  assert(page.url().includes('#/sequence/'), 'séquence ouverte');
  const none = await page.evaluate(async () => { const G = await import('./js/eps-gen.js'); return G.generate({ fam: 'collectifs', sub: 'traditionnels', cycle: 2, space: 'cour', have: {}, effectif: 24, sessions: 2 }).error || ''; });
  assert(none.includes('Aucune situation'), 'sans matériel : message clair');
});

await test('Aucune erreur dans la console', async () => { eq(errors.length, 0, errors.join(' | ')); });
await browser.close();
writeFileSync(`${OUT}resultats-livrets.txt`, results.join('\n'));
console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
