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
await ctx.addInitScript(() => { try { if (!localStorage.getItem('classeur.cahier.layout')) localStorage.setItem('classeur.cahier.layout', 'liste'); } catch { /* */ } }); // cahier en liste complète (les deux panneaux sont testés à part)
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
  await page.getByTestId('gen-go').click(); await page.waitForTimeout(200);
  const printed = await page.locator('#print-root').innerText();
  assert(!printed.includes('OBS-PRIVEE') && !printed.includes('SECRET'), 'bilan famille contient des données privées');
  await page.evaluate(() => { document.body.classList.remove('printing'); document.getElementById('print-root').replaceChildren(); });
  // Fiche élève : zone confidentielle masquée par défaut.
  await go(`#/eleve/${ids.lou}?t=besoins`);
  assert(!(await page.locator('main').innerText()).includes('SECRET-SANTE'), 'confidentiel visible sans déverrouillage');
  await page.getByTestId('unlock').click(); await modalBtn('Afficher').click(); await page.waitForTimeout(200);
  assert((await page.locator('main').innerText()).includes('SECRET-SANTE'), 'déverrouillage inopérant');
});

await test('Vie de classe projetée : tirage sans répétition (absents exclus), pictogramme, feu, rituels', async () => {
  const r0 = await S(`const R = await import('./js/rituels.js'); const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    let d = []; const seen = []; for (let i = 0; i < 3; i++) { const r = R.draw(pool, { drawn: d }); d = r.drawn; seen.push(...r.picked); }
    const r4 = R.draw(pool, { drawn: d }); const two = R.draw(pool, { count: 2, drawn: ['a', 'b'] });
    return { seen: seen.sort().join(''), round: r4.newRound, two: two.picked.length, twoHasC: two.picked.includes('c'), dec: R.decompose(54), dec2: R.decompose(107) };`);
  eq(r0.seen, 'abc', 'chacun une fois'); assert(r0.round, 'nouveau tour'); eq(r0.two, 2, 'deux tirés'); assert(r0.twoHasC, 'le restant est tiré d’abord');
  eq(r0.dec, '5 dizaines, 4 unités', 'décomposition'); eq(r0.dec2, '1 centaine, 7 unités', 'décomposition centaine');
  await page.evaluate(() => localStorage.removeItem('classeur-projection'));
  await go('#/projection?d=2026-11-02'); await page.waitForTimeout(200);
  const info = await S(`const cls = store.get(a.cls); const R = await import('./js/rituels.js'); return { abs: [...G.absentsOn(cls, '2026-11-02')], n: R.drawPool(cls, '2026-11-02').length, day: R.schoolDayNumber(cls, '2026-11-02') };`, ids);
  assert(info.n > 2, 'élèves à tirer'); assert(info.day > 20, 'numéro du jour d’école : ' + info.day);
  const drawn = [];
  for (let i = 0; i < info.n; i++) { await page.getByTestId('draw').click(); await page.waitForTimeout(60); drawn.push(...(await page.evaluate(() => JSON.parse(localStorage.getItem('classeur-projection')).tirage.ids))); }
  eq(new Set(drawn).size, info.n, 'chacun son tour, sans répétition');
  for (const id of info.abs) assert(!drawn.includes(id), 'élève absent tiré');
  await page.getByTestId('picto-chuchoter').click(); await page.getByTestId('feu-orange').click();
  await page.getByTestId('meteo-pluie').click(); await page.waitForTimeout(150);
  const payload = await page.evaluate(() => localStorage.getItem('classeur-projection-payload'));
  const last = await S(`return store.all('student').map(s => s.lastName).filter(Boolean)`);
  for (const ln of last) assert(!payload.includes(`"${ln}"`) && !payload.includes(` ${ln}`), 'nom de famille projeté : ' + ln);
  const screen = await ctx.newPage(); await screen.goto(`${BASE}#/ecran`); await screen.waitForTimeout(1500);
  const st = await screen.locator('body').innerText();
  assert(st.includes('On chuchote'), 'pictogramme absent'); assert(st.includes('Aujourd’hui, nous sommes lundi 2 novembre 2026'), 'rituel de la date absent');
  assert(st.includes('Il pleut') && st.includes('jour d’école'), 'météo ou jour d’école absent');
  eq(await screen.locator('[data-feu=orange] .lamp-orange.on').count(), 1, 'feu orange');
  const name = await screen.locator('.tirage-names').innerText(); assert(name.length > 1, 'prénom tiré affiché');
  await screen.screenshot({ path: `${OUT}vie-de-classe-ecran.png` }); await screen.close();
  await page.getByTestId('draw-hide').click(); await page.getByTestId('picto-chuchoter').click(); await page.getByTestId('feu-orange').click(); await page.getByTestId('panel-rituels').uncheck();
});

await test('Écran à widgets : disposition enregistrée, glisser-déposer, horloge à lire, chronomètre', async () => {
  const u = await S(`const W = await import('./js/screen-widgets.js');
    const a1 = W.handAngles({ h: 3, m: 45, s: 0 }); const c = W.chronoToggle(W.CHRONO0, 1000); const c2 = W.chronoToggle(c, 66000);
    return { h: a1.h, m: a1.m, fmt: W.fmtChrono(W.chronoMs(c2)), run: W.chronoMs(c, 4000), cl: W.clampItem({ x: 98, y: -5, w: 40, h: 3 }), spot: W.freeSpot([{ x: 0, y: 0, w: 50, h: 100 }]) };`);
  eq(u.h, 112.5, 'aiguille des heures à 3 h 45'); eq(u.m, 270, 'aiguille des minutes'); eq(u.fmt, '01:05', 'chrono'); eq(u.run, 3000, 'chrono en marche');
  eq(JSON.stringify(u.cl), JSON.stringify({ x: 60, y: 0, w: 40, h: 6 }), 'widget gardé dans l’écran'); assert(u.spot.x >= 50, 'place libre');
  await page.evaluate(() => localStorage.removeItem('classeur-projection')); await S(`await store.setSettings({ screenLayouts: [] })`);
  await go('#/projection?d=2026-11-02'); await page.waitForTimeout(200);
  await page.getByTestId('layout-new').click(); await page.getByTestId('layout-name').fill('Calcul mental'); await page.getByTestId('layout-template').selectOption('classe');
  await page.getByTestId('layout-create-go').click(); await page.waitForTimeout(250);
  await page.getByTestId('layout-add').selectOption('horloge'); await page.waitForTimeout(200);
  await page.getByTestId('layout-add').selectOption('chrono'); await page.waitForTimeout(200);
  let L = await S(`return store.getSettings().screenLayouts[0]`);
  eq(L.name, 'Calcul mental', 'nom'); assert(L.items.some(i => i.key === 'horloge') && L.items.some(i => i.key === 'chrono'), 'widgets ajoutés');
  // Glisser le widget « Consigne » vers la droite.
  await page.getByTestId('layout-canvas').scrollIntoViewIfNeeded();
  const box = page.locator('[data-testid=lw][data-key=consigne]'); const bb = await box.boundingBox(); const cv = await page.getByTestId('layout-canvas').boundingBox();
  const x0 = L.items.find(i => i.key === 'consigne').x;
  const px = bb.x + bb.width * .5, py = bb.y + bb.height * .85; await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + cv.width * .1, py, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250);
  L = await S(`return store.getSettings().screenLayouts[0]`);
  const x1 = L.items.find(i => i.key === 'consigne').x; assert(Math.abs(x1 - x0 - 10) <= 1.5, `déplacement ${x0} → ${x1}`);
  // Clavier : Maj + flèche droite agrandit.
  const w0 = L.items.find(i => i.key === 'consigne').w;
  await page.locator('[data-testid=lw][data-key=consigne]').focus(); await page.keyboard.press('Shift+ArrowLeft'); await page.waitForTimeout(200);
  L = await S(`return store.getSettings().screenLayouts[0]`); eq(L.items.find(i => i.key === 'consigne').w, w0 - 2, 'taille au clavier');
  await page.getByTestId('lw-bigger').click(); await page.waitForTimeout(150);
  // Horloge à lire et chronomètre.
  await page.getByTestId('clock-fixed').click(); await page.getByTestId('clock-time').fill('03:45'); await page.getByTestId('clock-time').dispatchEvent('change'); await page.waitForTimeout(150);
  await page.getByTestId('clock-digital').uncheck(); await page.getByTestId('chrono-toggle').click(); await page.waitForTimeout(150);
  const screen = await ctx.newPage(); await screen.goto(`${BASE}#/ecran`); await screen.waitForTimeout(2300);
  eq(await screen.locator('.screen.free .widget').count(), L.items.length, 'widgets projetés');
  eq(await screen.locator('[data-hand=h]').getAttribute('data-angle'), '112.5', 'horloge réglée sur 3 h 45');
  eq(await screen.locator('[data-clock-digital]').count(), 0, 'heure en chiffres masquée');
  const ch = await screen.locator('[data-chrono]').innerText(); assert(/^00:0[1-4]$/.test(ch), 'chronomètre en marche : ' + ch);
  const st = await screen.locator('.widget[data-widget=consigne]').getAttribute('style'); assert(st.includes(`left: ${x1}%`), 'position projetée');
  await screen.screenshot({ path: `${OUT}ecran-widgets.png` });
  await page.getByTestId('layout-select').selectOption(''); await page.waitForTimeout(400);
  eq(await screen.locator('.screen.free').count(), 0, 'retour à la disposition classique');
  await screen.close();
  await page.getByTestId('chrono-reset').click(); await page.getByTestId('layout-select').selectOption(L.id); await page.getByTestId('layout-delete').click(); await modalBtn('Supprimer').click(); await page.waitForTimeout(200);
  eq(await S(`return store.getSettings().screenLayouts.length`), 0, 'disposition supprimée');
});

await test('Petits outils projetés (QR, dés, vote, tableau blanc) et rotation des ateliers à la fin du timer', async () => {
  const u = await S(`const W = await import('./js/screen-widgets.js');
    const svg = W.qrSvg('https://exemple.fr/élève'); const d = W.rollDice(3, 6); const v = W.voteOptions('Oui\\n Non \\n\\nPeut-être', [{ label: 'Non', count: 4 }]);
    return { svg: svg.startsWith('<svg') && svg.includes('<path'), d: d.length === 3 && d.every(x => x >= 1 && x <= 6), v: v.map(o => o.label + o.count).join(',') };`);
  assert(u.svg, 'QR code SVG'); assert(u.d, 'dés'); eq(u.v, 'Oui0,Non4,Peut-être0', 'options de vote (compteurs gardés)');
  await page.evaluate(() => { localStorage.removeItem('classeur-projection'); localStorage.removeItem('classeur-timer'); localStorage.removeItem('classeur-timer-alerted'); });
  const gs = await S(`const st = store.all('student').filter(s => !s.deletedAt).slice(0, 6).map(s => s.id);
    const r = await store.create('groupset', { classId: a, name: 'Ateliers maths', kind: 'ateliers', permanent: false, groups: [
      { id: store.uid(), name: 'Bleus', color: '#2f6f8f', memberIds: st.slice(0, 2), roles: {}, activity: 'Atelier A', order: 1 },
      { id: store.uid(), name: 'Rouges', color: '#d9534f', memberIds: st.slice(2, 4), roles: {}, activity: 'Atelier B', order: 2 },
      { id: store.uid(), name: 'Verts', color: '#3f8f3f', memberIds: st.slice(4, 6), roles: {}, activity: 'Atelier C', order: 3 }] }); return r.id;`, ids.cls);
  await go('#/projection?d=2026-11-02'); await page.waitForTimeout(200);
  await page.getByTestId('qr-text').fill('https://exemple.fr/'); await page.getByTestId('qr-go').click();
  await page.getByTestId('dice-count').selectOption('3'); await page.getByTestId('dice-roll').click();
  await page.getByTestId('vote-options').fill('Oui\nNon'); await page.getByTestId('vote-apply').click();
  await page.getByTestId('vote-plus-1').click(); await page.getByTestId('vote-plus-1').click(); await page.getByTestId('panel-tableau').check();
  await page.getByTestId('proj-groupset').selectOption(gs); await page.getByTestId('rotation-on').check(); await page.getByTestId('rotation-next').click(); await page.waitForTimeout(150);
  eq(await page.getByTestId('rotation-index').innerText(), 'Rotation 2/3', 'rotation manuelle');
  const screen = await ctx.newPage(); await screen.goto(`${BASE}#/ecran`); await screen.waitForTimeout(1800);
  assert(await screen.locator('[data-testid=screen-qr] svg').count() === 1, 'QR code projeté');
  eq(await screen.locator('.die').count(), 3, 'trois dés'); assert((await screen.locator('[data-sum]').innerText()).startsWith('Total'), 'total des dés');
  assert((await screen.locator('[data-testid=screen-vote]').innerText()).includes('2 votes'), 'vote projeté');
  const groupsTxt = await screen.locator('.screen-groups').innerText();
  assert(/Bleus\s*Atelier B/.test(groupsTxt) && /Verts\s*Atelier A/.test(groupsTxt), 'ateliers tournés : ' + groupsTxt.replace(/\s+/g, ' '));
  // Tableau blanc : un trait dessiné reste après une mise à jour de l'écran.
  await screen.locator('[data-testid=board-canvas]').scrollIntoViewIfNeeded(); const cv = await screen.locator('[data-testid=board-canvas]').boundingBox();
  await screen.mouse.move(cv.x + 20, cv.y + 20); await screen.mouse.down(); await screen.mouse.move(cv.x + 120, cv.y + 60, { steps: 5 }); await screen.mouse.up();
  const ink = () => screen.evaluate(() => { const c = document.querySelector('[data-testid=board-canvas]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  assert(await ink() > 50, 'trait dessiné');
  await page.getByTestId('dice-roll').click(); await screen.waitForTimeout(1500); assert(await ink() > 50, 'trait conservé après mise à jour');
  // Fin du timer : passage automatique à l'atelier suivant et relance.
  await page.getByTestId('rotation-auto').check(); await page.waitForTimeout(100);
  await page.evaluate(async () => { const T = await import('./js/timer.js'); T.setDuration(5); T.start(); });
  await page.waitForTimeout(7500);
  const c = await page.evaluate(() => JSON.parse(localStorage.getItem('classeur-projection')));
  eq(c.rotation.step, 2, 'atelier suivant à la fin du timer');
  assert(await page.evaluate(async () => (await import('./js/timer.js')).getState().running), 'timer relancé');
  assert(/Bleus\s*Atelier C/.test(await screen.locator('.screen-groups').innerText()), 'écran à jour');
  await page.evaluate(async () => { const T = await import('./js/timer.js'); T.reset(); });
  await screen.close();
  await page.getByTestId('rotation-on').uncheck(); await page.getByTestId('panel-tableau').uncheck(); await page.getByTestId('panel-qr').uncheck(); await page.getByTestId('panel-des').uncheck(); await page.getByTestId('panel-vote').uncheck();
  await S(`await store.remove(a)`, gs);
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
  assert(foot.includes('NA 1') && foot.includes('vides'), `répartition : ${foot}`);
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
  eq(await page.evaluate(() => document.documentElement.dataset.theme), 'lavande', 'thème par défaut Lavande');
  eq(await page.evaluate(() => document.documentElement.dataset.mode), 'clair', 'clair à 9 h (mode automatique le soir)');
  const dark = await page.evaluate(async () => { const t = await import('./js/theme.js'); return [t.isDark('soir', new Date('2026-11-02T20:30:00')), t.isDark('soir', new Date('2026-11-02T06:30:00')), t.isDark('soir', new Date('2026-11-02T12:00:00'))]; });
  eq(dark.join(), 'true,true,false', 'sombre de 19 h à 7 h');
  await go('#/reglages/general');
  await page.getByTestId('theme-mode').selectOption('sombre'); await page.waitForTimeout(150);
  eq(await page.evaluate(() => document.documentElement.dataset.mode), 'sombre', 'mode sombre appliqué');
  await go('#/aujourdhui'); await page.screenshot({ path: `${OUT}theme-pastel-sombre.png` });
  await go('#/reglages/general'); await page.getByTestId('theme-bleu').dispatchEvent('click'); await page.waitForTimeout(150);
  eq(await page.evaluate(() => document.documentElement.dataset.theme), 'bleu', 'thème bleu appliqué');
  eq(await page.evaluate(async () => (await import('./js/store.js')).getSettings().theme.name), 'bleu', 'thème enregistré dans les réglages');
  await page.getByTestId('theme-perso').dispatchEvent('click'); await page.waitForTimeout(150);
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
  await page.getByTestId('theme-pastel').dispatchEvent('click'); await page.getByTestId('theme-mode').selectOption('clair'); await page.waitForTimeout(150);
  eq(await page.evaluate(() => document.documentElement.getAttribute('style')), null, 'variables personnalisées retirées');
  await go('#/aujourdhui'); await page.screenshot({ path: `${OUT}theme-pastel-clair.png` });
  await page.getByTestId('theme-mode').count();
});

await test('Programmes officiels en vigueur : bons textes par niveau, référentiel prérempli', async () => {
  await go('#/referentiels');
  const rows = await page.getByTestId('official-row').allInnerTexts();
  assert(rows.some(r => r.includes('Français') && r.includes('BO n° 41 du 31 octobre 2024')), 'français CE2 = BO 41 de 2024');
  assert(rows.some(r => r.includes('Questionner le monde') && r.includes('BO n° 31 du 30 juillet 2020')), 'questionner le monde CE2 = 2020');
  assert(rows.some(r => r.includes('Enseignement moral et civique') && r.includes('nouveau en CE2')), 'EMC nouveau en CE2');
  assert(!rows.some(r => r.includes('BO n° 16 du 17 avril 2025')), 'pas de texte du cycle 3 pour une classe de CE2');
  await page.getByTestId('official-all').check(); await page.waitForTimeout(150);
  const all = await page.getByTestId('official-row').allInnerTexts();
  assert(all.some(r => r.includes('Français') && r.includes('CM1, CM2') && r.includes('BO n° 16 du 17 avril 2025')), 'français cycle 3 = BO 16 de 2025');
  assert(all.some(r => r.includes('Langage oral et écrit') && r.includes('BO n° 19 du 7 mai 2026')), 'maternelle = BO 19 de 2026');
  assert(all.some(r => r.includes('Sciences et technologie') && r.includes('CM2') && r.includes('BO n° 25 du 22 juin 2023')), 'sciences CM2 = 2023');
  await page.getByTestId('official-all').uncheck(); await page.waitForTimeout(150);
  await page.getByTestId('official-row').filter({ has: page.locator('strong', { hasText: /^Mathématiques$/ }) }).getByTestId('official-import').click();
  await page.waitForFunction(() => /#\/referentiels\/.+/.test(location.hash)); await page.waitForTimeout(250);
  const ref = await page.evaluate(async () => { const s = await import('./js/store.js'); const r = s.all('referential').find(x => x.name.startsWith('Mathématiques')); return { n: r.items.length, lv: [...new Set(r.items.flatMap(i => i.levels))], st: r.status, date: r.publishedAt, src: r.source, labels: r.items.map(i => i.label), pages: r.items.every(i => i.page > 0) }; });
  assert(ref.n > 25, `compétences de maths CE2 importées (${ref.n})`); eq(ref.lv.join(), 'CE2', 'uniquement les niveaux de la classe');
  eq(ref.st, 'à vérifier', 'référentiel à vérifier avant validation'); eq(ref.date, '2024-10-31', 'date du texte'); assert(ref.src.includes('BO n° 41'), 'source BO');
  assert(ref.labels.includes('Dénombrer des collections.'), 'intitulé officiel présent tel quel');
  assert(ref.labels.includes('Compléter, sur une feuille quadrillée ou pointée, une figure simple pour la rendre symétrique par rapport à un axe donné.'), 'intitulé de géométrie présent');
  assert(ref.pages, 'page du PDF indiquée pour chaque intitulé');
  assert((await page.getByTestId('ref-item').count()) === ref.n, 'tableau des compétences affiché');
  await go('#/referentiels');
  eq(await page.getByTestId('official-row').filter({ has: page.locator('strong', { hasText: /^Mathématiques$/ }) }).getByText('Ouvrir le référentiel').count(), 1, 'lien vers le référentiel importé (pas de doublon)');
  // Tous les paquets annoncés existent et se chargent.
  const packs = await page.evaluate(async () => { const P = await import('./js/programmes.js'); const ids = [...new Set(Object.values(P.APPLY).flat().map(r => r.pack).filter(Boolean))]; const out = {}; for (const id of ids) out[id] = (await P.loadPack(id)).items.length; return out; });
  for (const [id, n] of Object.entries(packs)) assert(n > 0, `paquet ${id} vide`);
  assert(Object.keys(packs).length >= 20, `paquets reliés : ${Object.keys(packs).length}`);
});

await test('Aucune erreur JavaScript', async () => { eq(errors.length, 0, errors.join(' | ')); });

await browser.close();
const summary = `\n${passed} réussi(s), ${failed} échoué(s)`;
console.log(summary);
writeFileSync(`${OUT}resultats-etape3.txt`, results.join('\n') + summary + '\n');
process.exit(failed ? 1 : 0);
