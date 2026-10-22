// Étape 3 : usage en classe — scénarios de validation (§17, §19, §20, §23) dans un vrai navigateur.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let passed = 0, failed = 0; const results = [];
let page;
async function test(name, fn) {
  try { await fn(); passed++; results.push(`✔ ${name}`); console.log(`✔ ${name}`); }
  catch (e) { failed++; results.push(`✘ ${name}\n    ${e.message.split('\n')[0]}`); console.log(`✘ ${name}\n   `, e.message); try { await page.screenshot({ path: `${OUT}echec3-${failed}.png`, fullPage: true }); } catch { /* */ } }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 }, bypassCSP: true }); // bypassCSP : uniquement pour les scripts de test
page = await ctx.newPage();
await page.clock.install({ time: new Date('2026-11-04T09:00:00') });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const ready = () => page.waitForFunction(() => window.__classeurReady === true);
const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(220); };
const S = (fn, arg) => page.evaluate(async ([src, a]) => {
  const m = { store: await import('./js/store.js'), model: await import('./js/model.js'), PL: await import('./js/planning.js'), P: await import('./js/pedago.js'), V: await import('./js/vie.js'), E: await import('./js/eleve.js'), G: await import('./js/groups.js'), T: await import('./js/timer.js') };
  return (new Function(...Object.keys(m), 'a', `return (async () => { ${src} })()`))(...Object.values(m), a);
}, [fn, arg]);
const modalBtn = (name) => page.locator('.modal-foot button', { hasText: name });

await page.goto(BASE); await ready();
await page.evaluate(async () => (await import('./js/demo.js')).loadDemo());
await page.waitForTimeout(400);
const ids = await S(`const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentClassId: cls.id });
  const st = (n) => store.all('student').find(s => s.firstName === n).id;
  return { cls: cls.id, lou: st('Lou'), nino: st('Nino'), jade: st('Jade'), malo: st('Malo') };`);

await test('Pages de l’étape 3 sans erreur', async () => {
  for (const r of ['#/appel', '#/services', '#/services?t=semaine', '#/services?t=sorties', '#/projection', '#/trombi', '#/listes', '#/evaluations', '#/livrets', '#/rattrapage', '#/differenciation', '#/plan', '#/responsabilites', '#/bibliotheque', '#/atelier', '#/diaporamas', `#/eleve/${ids.lou}?t=documents`, `#/eleve/${ids.lou}?t=suivi`, `#/eleve/${ids.lou}?t=besoins`, `#/eleve/${ids.lou}?t=vie`, `#/eleve/${ids.lou}?t=echanges`, '#/reglages/documents']) {
    await go(r);
    assert(!(await page.locator('main').innerText()).includes('Une erreur est survenue'), `erreur sur ${r}`);
  }
  eq(errors.length, 0, errors.join(' | '));
});

await test('Appel : validation impossible tant que tout le monde n’est pas pointé, puis verrouillé', async () => {
  await go('#/appel?d=2026-11-03&h=matin');
  await page.getByTestId('appel-row').nth(0).getByTestId('mark-absent').click(); await page.waitForTimeout(150);
  await page.getByTestId('appel-validate').click(); await page.waitForTimeout(150);
  eq(await S(`return V.attendanceOf(a, '2026-11-03', 'matin').validated`, ids.cls), false, 'validé trop tôt');
  await page.getByTestId('all-present').click(); await page.waitForTimeout(150);
  await page.getByTestId('appel-validate').click(); await page.waitForTimeout(250);
  eq(await S(`return V.attendanceOf(a, '2026-11-03', 'matin').validated`, ids.cls), true, 'non validé');
  assert(await page.getByTestId('mark-présent').first().isDisabled(), 'pointage encore modifiable');
});

await test('§17 Cocher une assurance dans une liste met à jour la fiche élève', async () => {
  const listId = await S(`return store.all('list')[0].id`);
  await go(`#/listes/${listId}`);
  const row = page.locator('[data-testid=list-table] tbody tr', { hasText: 'Jade' });
  await row.getByTestId('cell-link').check(); await page.waitForTimeout(300);
  await go(`#/eleve/${ids.jade}?t=documents`);
  eq(await page.getByTestId('doc-assurance').getByTestId('doc-status').inputValue(), 'reçu', 'fiche élève non mise à jour');
  // Et dans l'autre sens : la fiche modifiée se lit dans la liste.
  await page.getByTestId('doc-assurance').getByTestId('doc-status').selectOption('à compléter'); await page.waitForTimeout(250);
  await go(`#/listes/${listId}`);
  assert((await page.locator('[data-testid=list-table] tbody tr', { hasText: 'Jade' }).innerText()).includes('à compléter'), 'liste non mise à jour');
});

await test('§17 Absence partielle : seulement ce qui a été réellement manqué, adapté ; remis ≠ rattrapé', async () => {
  // Le 2 novembre : français 08:45-09:45 et maths 09:45-10:30 marqués faits. Lou est absente de 09:50 à 10:30.
  await S(`const cls = store.get(a.cls); const att = V.attendanceOf(cls.id, '2026-11-02', 'matin'); await store.update(att.id, { marks: { ...att.marks, [a.lou]: { status: 'partiel', from: '09:50', to: '10:30' } } });
    const plan = PL.dayPlan(cls, '2026-11-02');
    for (const st of ['08:45', '09:45']) await PL.setStatus(plan.entries.find(x => x.start === st), cls, 'faite');
    await PL.patchEntry(PL.dayPlan(cls, '2026-11-02').entries.find(x => x.start === '10:45'), cls, { note: 'prévue seulement' }, 'x');`, ids);
  await go('#/rattrapage');
  await page.getByTestId('catchup-student').selectOption(ids.lou); await page.waitForTimeout(250);
  const t = await page.getByTestId('catchup-proposals').innerText();
  assert(t.includes('Découvrir le millier'), 'séance de maths manquée absente');
  assert(t.includes('Fiche d’entraînement'), 'document distribué absent');
  assert(!t.includes('08:45'), 'séance de français (avant l’absence) proposée à tort');
  assert(!t.includes('10:45'), 'séance non faite proposée à tort');
  await page.getByTestId('create-catchup').click(); await page.waitForTimeout(300);
  const statuses = await page.getByTestId('catchup-sheet').getByTestId('catchup-status').evaluateAll(els => els.map(e => e.value));
  assert(statuses.includes('à remettre') && statuses.includes('à rattraper'), `statuts ${statuses}`);
  // Nino, absent toute la matinée : les deux séances faites sont proposées.
  await page.getByTestId('catchup-student').selectOption(ids.nino); await page.waitForTimeout(250);
  const tn = await page.getByTestId('catchup-proposals').innerText();
  assert(tn.includes('08:45') && tn.includes('Découvrir le millier'), 'absence complète mal traitée');
});

await test('§17 Projection et impressions familles : aucune donnée sensible', async () => {
  await S(`await store.create('need', { studentId: a.lou, category: 'santé', source: 'confirmé par un document', detail: 'SECRET-SANTE', date: '2026-10-01', sensitive: true });
    await store.create('plan', { studentId: a.lou, kind: 'PAI', status: 'en cours', adaptations: 'SECRET-PAI', sensitive: true, fileIds: [] });
    await store.create('observation', { studentId: a.lou, date: '2026-11-02', kind: 'difficulté', text: 'OBS-PRIVEE', domain: 'Mathématiques' });
    const cls = store.get(a.cls); const e = PL.dayPlan(cls, '2026-11-02').entries.find(x => x.start === '09:45'); await PL.patchEntry(e, cls, { note: 'BILAN-PRIVE' }, 'x');
    const s = store.all('session').find(x => x.title.startsWith('Découvrir')); await store.update(s.id, { phases: s.phases.map((p, i) => i === 0 ? { ...p, enseignant: 'NOTE-ENSEIGNANTE' } : p) });`, ids);
  await go('#/projection?d=2026-11-02');
  await page.getByTestId('proj-entry').filter({ hasText: 'Découvrir' }).click(); await page.waitForTimeout(200);
  await page.getByTestId('panel-devoirs').check(); await page.waitForTimeout(150);
  const gs = await S(`return G.setsOf(a)[0].id`, ids.cls);
  await page.getByTestId('proj-groupset').selectOption(gs); await page.waitForTimeout(200);
  const payload = await page.evaluate(() => localStorage.getItem('classeur-projection-payload'));
  for (const bad of ['SECRET', 'OBS-PRIVEE', 'BILAN-PRIVE', 'NOTE-ENSEIGNANTE', '06 00 00', '@exemple', 'CE2 (démo)', 'à consolider', 'PAI']) assert(!payload.includes(bad), `donnée privée projetée : ${bad}`);
  assert(payload.includes('Combien de dizaines') && payload.includes('Les Hiboux'), 'contenu attendu absent');
  const screen = await ctx.newPage(); await screen.clock.install({ time: new Date('2026-11-04T09:00:00') });
  await screen.goto(`${BASE}#/ecran`); await screen.waitForTimeout(800);
  const st = await screen.locator('body').innerText();
  assert(st.includes('Combien de dizaines') && !st.includes('NOTE-ENSEIGNANTE') && !st.includes('BILAN-PRIVE'), 'écran incorrect');
  await screen.screenshot({ path: `${OUT}etape3-ecran.png` }); await screen.close();
  // Recherche : rien de confidentiel.
  await go('#/recherche?q=SECRET'); assert(!(await page.locator('[data-testid=search-results]').count()), 'donnée confidentielle trouvée par la recherche');
  // Bilan imprimé pour la famille.
  await go('#/livrets');
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('[data-testid=report-card]', { hasText: 'Lou' }).getByRole('button', { name: /Imprimer le bilan/ }).click();
  const printed = await page.locator('#print-root').innerText();
  assert(!printed.includes('OBS-PRIVEE') && !printed.includes('SECRET'), 'bilan famille contient des données privées');
  await page.evaluate(() => { document.body.classList.remove('printing'); document.getElementById('print-root').replaceChildren(); });
  // Fiche élève : zone confidentielle masquée par défaut.
  await go(`#/eleve/${ids.lou}?t=besoins`);
  assert(!(await page.locator('main').innerText()).includes('SECRET-SANTE'), 'confidentiel visible sans déverrouillage');
  await page.getByTestId('unlock').click(); await modalBtn('Afficher').click(); await page.waitForTimeout(200);
  assert((await page.locator('main').innerText()).includes('SECRET-SANTE'), 'déverrouillage inopérant');
});

await test('Inscription au service ≠ présence prévue (absent à l’appel)', async () => {
  const r = await S(`const cls = store.get(a.cls); const rows = V.serviceDay(cls, '2026-11-02', 'Cantine'); return { reg: rows.length, exp: rows.filter(x => x.expected).length, nino: rows.find(x => x.student.id === a.nino) };`, ids);
  assert(r.nino && r.nino.registered && !r.nino.expected, 'absent compté présent à la cantine');
  eq(r.exp, r.reg - 1, 'présences prévues');
});

await test('§19 Timer : continue en changeant de page, ancré sur l’heure de fin, une seule alerte', async () => {
  await go('#/aujourdhui');
  await page.getByTestId('timer-toggle').click(); await page.getByTestId('timer-2').click(); await page.getByTestId('timer-start').click();
  await page.getByTestId('timer-min').click();
  for (const r of ['#/eleves', '#/cahier', '#/plan']) await go(r);
  assert(await page.getByTestId('timer-pill').isVisible(), 'widget perdu en changeant de page');
  await page.clock.fastForward(30000); await page.waitForTimeout(300);
  const t1 = await page.getByTestId('timer-time').innerText();
  assert(/^1:(29|30|31)$/.test(t1), `temps restant après 30 s : ${t1}`);
  await page.reload(); await ready(); await page.waitForTimeout(300);
  const t2 = await S(`return Math.round(T.remaining())`);
  assert(t2 >= 85 && t2 <= 91, `après rechargement : ${t2}`);
  await page.clock.fastForward(100000); await page.waitForTimeout(400);
  const st = await S(`return { running: T.getState().running, alerted: localStorage.getItem('classeur-timer-alerted') }`);
  eq(st.running, false, 'timer encore en marche'); assert(st.alerted, 'alerte non enregistrée');
  const again = await S(`const before = localStorage.getItem('classeur-timer-alerted'); return before;`);
  eq(again, st.alerted, 'double alerte');
});

await test('§20 Changer de disposition sans perdre d’élève', async () => {
  await go('#/plan');
  await page.getByTestId('plan-tab-plan').click().catch(() => {});
  await page.getByTestId('new-layout').click(); await page.locator('.modal select[name=tpl]').selectOption('rangées'); await modalBtn('Créer').click(); await page.waitForTimeout(400);
  await page.getByTestId('auto-place').click(); await page.waitForTimeout(300);
  const n = await S(`const cls = store.get(a); return model.studentsOfClass(cls.id).length;`, ids.cls);
  const placed1 = await S(`const l = store.all('layout').at(-1); return Object.values(l.seats).flat().filter(Boolean).length;`);
  eq(placed1, n, 'élèves placés');
  await page.getByTestId('new-layout').click(); await page.locator('.modal select[name=tpl]').selectOption('îlots'); await modalBtn('Créer').click(); await page.waitForTimeout(500);
  const r = await S(`const ls = store.all('layout'); const a2 = ls.at(-1), a1 = ls.at(-2); const set = (l) => new Set(Object.values(l.seats).flat().filter(Boolean)); return { first: set(a1).size, second: set(a2).size };`);
  eq(r.first, n, 'ancienne disposition modifiée'); eq(r.second, n, 'élèves perdus dans la nouvelle disposition');
  await page.screenshot({ path: `${OUT}etape3-plan.png`, fullPage: true });
});

await test('§20 Ajuster une équipe ne modifie pas une séance passée', async () => {
  await go('#/plan'); await page.getByTestId('plan-tab-groupes').click(); await page.waitForTimeout(200);
  await page.getByTestId('use-for-session').click(); await page.locator('.modal input[type=date]').fill('2026-11-02'); await page.locator('.modal input[type=date]').dispatchEvent('change'); await page.waitForTimeout(200);
  await page.getByTestId('groups-entry').filter({ hasText: '09:45' }).click(); await page.waitForTimeout(300);
  await page.getByTestId('group-card').first().getByTestId('member-move').first().selectOption({ index: 1 }); await page.waitForTimeout(300);
  const r = await S(`const occ = store.all('occurrence').find(o => o.date === '2026-11-02' && o.start === '09:45'); const set = G.setsOf(a)[0]; return { snap: occ.groups.groups[0].memberIds.length, now: set.groups[0].memberIds.length };`, ids.cls);
  eq(r.snap, 3, 'composition de la séance passée modifiée'); eq(r.now, 2, 'ajustement non appliqué');
  await go('#/cahier?d=2026-11-02');
  assert((await page.getByTestId('day-entries').innerText()).includes('Les Hiboux'), 'groupes absents du cahier journal');
});

await test('§23 Bibliothèque : un exemplaire ne peut pas avoir deux prêts ; retour ; historique annuel', async () => {
  const r = await S(`const { lend } = await import('./js/pages/bibliotheque.js'); const cls = store.get(a.cls); const b = store.all('book')[0];
    await lend(cls, b, b.copies[0], a.lou, '2026-11-10');
    let err = null; try { await lend(cls, b, b.copies[0], a.jade, null); } catch (e) { err = e.message; }
    return { err, active: store.all('loan').filter(l => !l.returnedAt).length };`, ids);
  assert(r.err && r.err.includes('déjà prêté'), 'double prêt accepté'); eq(r.active, 1, 'prêts actifs');
  await go('#/bibliotheque'); await page.getByTestId('lib-tab-prets').click(); await page.waitForTimeout(200);
  await page.getByTestId('return-loan').click(); await modalBtn('Enregistrer le retour').click(); await page.waitForTimeout(300);
  eq(await S(`return store.all('loan').filter(l => !l.returnedAt).length`), 0, 'retour non enregistré');
  await page.getByTestId('lib-tab-historique').click(); await page.waitForTimeout(200);
  assert((await page.locator('main').innerText()).includes('Année 2026-2027 — 1 prêt'), 'historique annuel');
});

await test('Évaluations : non évalué ≠ non acquis, aucune conversion des points', async () => {
  const evId = await S(`return store.all('evaluation')[0].id`);
  await go(`#/evaluations/${evId}`);
  const foot = await page.getByTestId('eval-grid').locator('tfoot').innerText();
  assert(foot.includes('NA 1') && foot.includes('non évalués'), `répartition : ${foot}`);
  await S(`await store.update(a, { mode: 'les deux' })`, evId); await go('#/evaluations'); await go(`#/evaluations/${evId}`);
  const pts = page.locator('[data-testid=eval-grid] tbody tr', { hasText: 'Lou' }).locator('input.pts').first();
  await pts.fill('3'); await pts.blur(); await page.waitForTimeout(250);
  const r = await S(`const ev = store.get(a.e); return ev.results[a.lou].items.i1;`, { e: evId, lou: ids.lou });
  eq(r.level, 'A', 'niveau modifié par la saisie de points'); eq(r.points, 3, 'points');
});

await test('Atelier : page A4 à taille réelle, version corrigée distincte', async () => {
  await go('#/atelier'); await page.getByTestId('tool-droite').click(); await page.waitForTimeout(150);
  const svg = page.getByTestId('atelier-preview').locator('svg');
  eq(await svg.getAttribute('width'), '210mm', 'largeur'); eq(await svg.getAttribute('height'), '297mm', 'hauteur');
  const a = await page.getByTestId('atelier-preview').innerText();
  await page.getByTestId('correction').check(); await page.waitForTimeout(150);
  const b = await page.getByTestId('atelier-preview').innerText();
  assert(b.length > a.length, 'la correction n’ajoute rien');
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByTestId('atelier-print').click();
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ preferCSSPageSize: true });
  writeFileSync(`${OUT}etape3-droite-graduee.pdf`, pdf);
  const doc = await PDFDocument.load(pdf); const { width, height } = doc.getPage(0).getSize();
  assert(Math.abs(width - 595.3) < 2 && Math.abs(height - 841.9) < 2, `format ${width}×${height}`);
  eq(doc.getPageCount(), 1, 'une seule page');
  await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => { document.body.classList.remove('printing'); document.getElementById('print-root').replaceChildren(); });
});

await test('Diaporama généré depuis la fiche ; notes présentateur jamais projetées', async () => {
  const sid = await S(`return store.all('session').find(x => x.title.startsWith('Découvrir')).id`);
  await go(`#/seance/${sid}`); await page.getByTestId('session-diapo').click(); await page.waitForTimeout(400);
  const n = await page.getByTestId('slide-list').locator('li').count();
  assert(n >= 6, `diapositives : ${n}`);
  await S(`const ss = store.all('slideshow')[0]; await store.update(ss.id, { slides: ss.slides.map((s, i) => i === 1 ? { ...s, notes: 'NOTE-DIAPO' } : s) });`);
  await page.getByTestId('slide-list').locator('li').nth(1).locator('button').click(); await page.waitForTimeout(150);
  await page.getByTestId('project-diapo').click(); await page.waitForTimeout(200);
  const payload = await page.evaluate(() => localStorage.getItem('classeur-projection-payload'));
  assert(payload.includes('Je me souviens') && !payload.includes('NOTE-DIAPO'), 'notes projetées ou diapositive absente');
});

await test('Sauvegarde → restauration : données de l’étape 3 conservées', async () => {
  const types = ['attendance', 'serviceplan', 'studentdoc', 'observation', 'need', 'plan', 'list', 'evaluation', 'catchup', 'layout', 'groupset', 'jobs', 'book', 'loan', 'slideshow', 'report'];
  const count = () => S(`return a.map(t => store.all(t).length).join(',')`, types);
  const before = await count();
  const backup = await page.evaluate(async () => { const b = await import('./js/backup.js'); return JSON.stringify(await b.buildBackup()); });
  await page.evaluate(async () => (await import('./js/backup.js')).wipeAll());
  await page.evaluate(async (txt) => { const b = await import('./js/backup.js'); await b.restoreBackup(await b.readBackup(new File([txt], 's.json'))); }, backup);
  eq(await count(), before, 'comptes après restauration');
});

await test('Téléphone : pages de l’étape 3 sans débordement horizontal', async () => {
  const m = await browser.newContext({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
  const mp = await m.newPage(); await mp.clock.install({ time: new Date('2026-11-02T09:00:00') });
  await mp.goto(BASE); await mp.waitForFunction(() => window.__classeurReady);
  await mp.evaluate(async () => (await import('./js/demo.js')).loadDemo()); await mp.waitForTimeout(300);
  const lou = await mp.evaluate(async () => (await import('./js/store.js')).all('student').find(s => s.firstName === 'Lou').id);
  for (const r of ['#/aujourdhui', '#/appel', '#/services', '#/listes', '#/evaluations', '#/livrets', '#/rattrapage', '#/plan', '#/responsabilites', '#/bibliotheque', '#/atelier', '#/diaporamas', '#/projection', '#/trombi', `#/eleve/${lou}?t=documents`]) {
    await mp.evaluate(h => { location.hash = h; }, r); await mp.waitForTimeout(220);
    const over = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert(over <= 1, `${r} déborde de ${over}px`);
  }
  await mp.evaluate(h => { location.hash = h; }, '#/appel?d=2026-11-02&h=matin'); await mp.waitForTimeout(250);
  await mp.screenshot({ path: `${OUT}etape3-mobile-appel.png` });
  await m.close();
});

await test('Tableau d’écriture Seyès : Marelle intégrée, lignes de base sur les lignes épaisses, import d’une autre police', async () => {
  await go('#/atelier'); await page.getByTestId('tool-ecriture').click();
  await page.waitForFunction(() => document.fonts.check('20px "Marelle"'));
  eq(await page.getByTestId('p-police').inputValue(), 'Marelle', 'Marelle proposée par défaut');
  await page.getByTestId('p-texte').fill('Bonjour les élèves\nOn écrit en attaché');
  await page.waitForTimeout(150);
  const t = await page.evaluate(() => [...document.querySelectorAll('[data-testid=atelier-preview] text[data-line]')].map(e => ({ y: +e.getAttribute('y'), fam: e.getAttribute('font-family'), fs: +e.getAttribute('font-size') })));
  eq(t.length, 2, 'deux lignes écrites');
  assert(t[0].fam.includes('Marelle'), 'police Marelle appliquée');
  eq(t[0].y, 32, '1re ligne de base sur la 2e ligne épaisse'); eq(t[1].y, 48, 'une ligne sautée (interligne 8 mm)');
  const ratio = await page.evaluate(async () => (await import('./js/fonts.js')).xHeightRatio('Marelle'));
  assert(ratio > 0.15 && ratio < 0.9 && ratio !== 0.42, `hauteur x mesurée sur la vraie police (${ratio})`);
  assert(Math.abs(t[0].fs * ratio - 2) < 0.05, `hauteur des minuscules ≈ 2 mm (obtenu ${(t[0].fs * ratio).toFixed(2)})`);
  await page.screenshot({ path: `${OUT}etape3-ecriture.png` });
  await page.getByTestId('font-file').setInputFiles({ name: 'Police-Essai.ttf', mimeType: 'font/ttf', buffer: readFileSync(new URL('./police-essai.ttf', import.meta.url)) });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid=p-police] option')].some(o => o.value === 'Police Essai'));
  const b = await page.evaluate(async () => { const m = await import('./js/backup.js'); const s = await import('./js/store.js'); const bk = await m.buildBackup(); const f = s.getSettings().fonts[0]; return { name: f.name, inBackup: JSON.parse(bk.dataJson).blobs.some(x => x.id === f.blobId) }; });
  eq(b.name, 'Police Essai', 'police importée mémorisée'); assert(b.inBackup, 'police importée incluse dans la sauvegarde');
});

await test('Apparence : thèmes et version sombre du soir', async () => {
  eq(await page.evaluate(() => document.documentElement.dataset.theme), 'pastel', 'thème par défaut pastel');
  eq(await page.evaluate(() => document.documentElement.dataset.mode), 'clair', 'clair à 9 h (mode automatique le soir)');
  const dark = await page.evaluate(async () => { const t = await import('./js/theme.js'); return [t.isDark('soir', new Date('2026-11-02T20:30:00')), t.isDark('soir', new Date('2026-11-02T06:30:00')), t.isDark('soir', new Date('2026-11-02T12:00:00'))]; });
  eq(dark.join(), 'true,true,false', 'sombre de 19 h à 7 h');
  await go('#/reglages/general');
  await page.getByTestId('theme-mode').selectOption('sombre'); await page.waitForTimeout(150);
  eq(await page.evaluate(() => document.documentElement.dataset.mode), 'sombre', 'mode sombre appliqué');
  await go('#/aujourdhui'); await page.screenshot({ path: `${OUT}theme-pastel-sombre.png` });
  await go('#/reglages/general'); await page.getByTestId('theme-bleu').click(); await page.waitForTimeout(150);
  eq(await page.evaluate(() => document.documentElement.dataset.theme), 'bleu', 'thème bleu appliqué');
  eq(await page.evaluate(async () => (await import('./js/store.js')).getSettings().theme.name), 'bleu', 'thème enregistré dans les réglages');
  await page.getByTestId('theme-perso').click(); await page.waitForTimeout(150);
  await page.getByTestId('custom-accent').evaluate((el) => { el.value = '#ffd700'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(200);
  const perso = await page.evaluate(async () => { const t = await import('./js/theme.js'); const a = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(); const cs = getComputedStyle(document.documentElement); return { a, c: t.contrast(a, cs.getPropertyValue('--surface').trim()), ci: t.contrast(a, cs.getPropertyValue('--accent-ink').trim()), saved: (await import('./js/store.js')).getSettings().theme.custom.accent, mode: document.documentElement.dataset.mode }; });
  eq(perso.saved, '#ffd700', 'couleur personnalisée enregistrée');
  assert(perso.c >= 4.5, `couleur principale lisible sur les cartes (contraste ${perso.c.toFixed(2)}, ${perso.a})`);
  assert(perso.ci >= 4.5, `texte des boutons lisible (contraste ${perso.ci.toFixed(2)})`);
  const light = await page.evaluate(async () => { const t = await import('./js/theme.js'); const v = t.customVars({ accent: '#ffd700' }, false); return t.contrast(v['--accent'], '#ffffff'); });
  assert(light >= 4.5, `en clair, jaune assombri pour rester lisible (${light.toFixed(2)})`);
  await go('#/aujourdhui'); await page.screenshot({ path: `${OUT}theme-perso-sombre.png` });
  await go('#/reglages/general');
  await page.getByTestId('theme-pastel').click(); await page.getByTestId('theme-mode').selectOption('clair'); await page.waitForTimeout(150);
  eq(await page.evaluate(() => document.documentElement.getAttribute('style')), null, 'variables personnalisées retirées');
  await go('#/aujourdhui'); await page.screenshot({ path: `${OUT}theme-pastel-clair.png` });
  await page.getByTestId('theme-mode').count();
});

await test('Aucune erreur JavaScript', async () => { eq(errors.length, 0, errors.join(' | ')); });

await browser.close();
const summary = `\n${passed} réussi(s), ${failed} échoué(s)`;
console.log(summary);
writeFileSync(`${OUT}resultats-etape3.txt`, results.join('\n') + summary + '\n');
process.exit(failed ? 1 : 0);
