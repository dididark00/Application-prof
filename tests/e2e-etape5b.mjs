// Étape 5b : familles par l'ENT (publications, messages, rendez-vous, documents, aperçu parent),
// rappels et export .ics. Scénarios dans un vrai navigateur.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let passed = 0, failed = 0; const results = [];
let page;
async function test(name, fn) {
  try { await fn(); passed++; results.push(`✔ ${name}`); console.log(`✔ ${name}`); }
  catch (e) { failed++; results.push(`✘ ${name}\n    ${e.message.split('\n')[0]}`); console.log(`✘ ${name}\n   `, e.message); try { await page.screenshot({ path: `${OUT}echec5b-${failed}.png`, fullPage: true }); } catch { /* */ } }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 }, bypassCSP: true, permissions: ['clipboard-read', 'clipboard-write'] });
page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const ready = () => page.waitForFunction(() => window.__classeurReady === true);
const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(250); };
const S = (fn, arg) => page.evaluate(async ([src, a]) => {
  const m = { store: await import('./js/store.js'), model: await import('./js/model.js'), E: await import('./js/eleve.js'), F: await import('./js/pages/familles.js'), R: await import('./js/rappels.js') };
  return (new Function(...Object.keys(m), 'a', `return (async () => { ${src} })()`))(...Object.values(m), a);
}, [fn, arg]);
const modalBtn = (name) => page.locator('.modal-foot button', { hasText: name });
const png = () => page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 320; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#9cf'; x.fillRect(0, 0, 320, 200); return c.toDataURL('image/png').split(',')[1]; });

await page.goto(BASE); await ready();
await page.evaluate(async () => (await import('./js/demo.js')).loadDemo());
await page.waitForTimeout(400);
const ids = await S(`const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentClassId: cls.id, userName: 'Julia' });
  const st = (n) => store.all('student').find(s => s.firstName === n).id;
  return { cls: cls.id, lou: st('Lou'), nino: st('Nino'), year: cls.yearId };`);

await test('Pages Familles ouvertes, sans « à venir »', async () => {
  for (const r of ['#/messages', '#/publications', '#/documents', '#/rdv', '#/apercu', '#/reglages/rappels', '#/reglages/connexions']) {
    await go(r);
    assert(await page.getByTestId('placeholder').count() === 0, `${r} : page « à venir »`);
  }
  eq(errors.length, 0, errors.join(' | '));
});

await test('Publication : photo avec un élève sans droit à l’image → publication bloquée', async () => {
  await S(`const usage = F.imageUsage(); const t = { id: 'image:' + usage, label: usage, category: 'image' };
    await E.setDoc(a.lou, a.year, t, { status: 'autorisé' }); await E.setDoc(a.nino, a.year, t, { status: 'refusé' });`, ids);
  await go('#/publications');
  await page.getByTestId('pub-new').click(); await page.waitForTimeout(300);
  await page.getByTestId('pub-title').fill('Notre sortie à la ferme'); await page.getByTestId('pub-title').blur();
  await page.getByTestId('pub-text').fill('Nous avons vu des chèvres et des poules.'); await page.getByTestId('pub-text').blur(); await page.waitForTimeout(150);
  const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('pub-add-photo').click()]);
  await ch.setFiles({ name: 'ferme.png', mimeType: 'image/png', buffer: Buffer.from(await png(), 'base64') }); await page.waitForTimeout(400);
  await page.getByTestId('pub-tag').click();
  await page.locator('[data-testid=tag-student][data-name=Lou]').check(); await page.locator('[data-testid=tag-student][data-name=Nino]').check();
  await modalBtn('Enregistrer').click(); await page.waitForTimeout(300);
  assert((await page.getByTestId('pub-blocked').innerText()).includes('Nino'), 'Nino signalé');
  await page.getByTestId('pub-publish').click(); await page.waitForTimeout(200);
  assert((await page.locator('.modal').innerText()).includes('Publication bloquée'), 'publication refusée');
  await modalBtn('Compris').click();
  eq(await S(`return store.all('publication')[0].status;`), 'brouillon', 'reste un brouillon privé');
});

await test('Publication : sans l’élève non autorisé → publiée, visible dans l’aperçu parent', async () => {
  await page.getByTestId('pub-tag').click();
  await page.locator('[data-testid=tag-student][data-name=Nino]').uncheck();
  await modalBtn('Enregistrer').click(); await page.waitForTimeout(300);
  await page.getByTestId('pub-publish').click(); await page.waitForTimeout(300);
  eq(await S(`return store.all('publication')[0].status;`), 'publié', 'publiée');
  await go(`#/apercu?e=${ids.lou}`);
  assert((await page.getByTestId('family-view').innerText()).includes('Notre sortie à la ferme'), 'visible pour la famille');
});

await test('Aperçu parent : rien de privé (observation, besoin, échange, autre élève)', async () => {
  await S(`await store.create('observation', { studentId: a.lou, date: model.todayIso(), kind: 'remarque', text: 'OBSERVATION-PRIVEE' }, 'o');
    await store.create('need', { studentId: a.lou, category: 'santé', detail: 'BESOIN-PRIVE', sensitive: true }, 'n');
    await store.create('exchange', { studentId: a.lou, date: model.todayIso(), kind: 'téléphone', summary: 'ECHANGE-PRIVE' }, 'e');
    await store.create('homework', { classId: a.cls, title: 'Devoir de Nino seul', givenDate: model.todayIso(), dueDate: model.addDays(model.todayIso(), 3), targets: { kind: 'élèves', values: [a.nino] } }, 'h');
    await store.create('homework', { classId: a.cls, title: 'Poésie pour toute la classe', givenDate: model.todayIso(), dueDate: model.addDays(model.todayIso(), 3), targets: { kind: 'classe', values: [] } }, 'h');`, ids);
  await go(`#/apercu?e=${ids.lou}`);
  const t = await page.getByTestId('family-view').innerText();
  assert(t.includes('Poésie pour toute la classe'), 'devoir de la classe présent');
  for (const x of ['OBSERVATION-PRIVEE', 'BESOIN-PRIVE', 'ECHANGE-PRIVE', 'Devoir de Nino seul']) assert(!t.includes(x), `${x} ne doit pas apparaître`);
});

await test('Rendez-vous : créneaux, réservation, pas de double réservation, compte rendu dans l’historique', async () => {
  await go('#/rdv');
  await page.getByTestId('rdv-new').click();
  await page.getByTestId('rdv-date').fill(await S(`return model.addDays(model.todayIso(), 2);`));
  await page.getByTestId('rdv-from').fill('16:45'); await page.getByTestId('rdv-to').fill('17:45');
  await modalBtn('Créer').click(); await page.waitForTimeout(300);
  eq(await page.getByTestId('rdv-row').count(), 4, '4 créneaux de 15 min');
  await page.getByTestId('rdv-book').first().click();
  await page.getByTestId('rdv-student').selectOption(ids.lou); await modalBtn('Réserver').click(); await page.waitForTimeout(300);
  const slot = await S(`return store.all('rdvslot').find(r => r.studentId === a.lou).id;`, ids);
  const err = await S(`try { await F.book(a.slot, a.nino); return 'ok'; } catch (e) { return e.message; }`, { ...ids, slot });
  assert(err.includes('déjà réservé'), `double réservation refusée (${err})`);
  await page.getByTestId('rdv-done').click();
  await page.getByTestId('rdv-summary').fill('Point sur la lecture.'); await modalBtn('Enregistrer').click(); await page.waitForTimeout(300);
  eq(await S(`return store.all('exchange').filter(x => x.studentId === a.lou && x.kind === 'rendez-vous').length;`, ids), 1, 'compte rendu dans les échanges de l’élève');
  await page.evaluate(() => { window.print = () => { window.__printed = document.getElementById('print-root').innerText; }; });
  await page.getByTestId('rdv-print-free').click();
  assert((await page.evaluate(() => window.__printed)).match(/☐/g).length === 3, 'mot avec les 3 créneaux libres');
});

await test('Messages : modèle, copie pour l’ENT, noté dans l’historique de l’élève', async () => {
  await go('#/messages');
  await page.getByTestId('msg-new').click();
  await page.getByTestId('msg-student').selectOption(ids.nino);
  await page.getByTestId('msg-model').selectOption('bravo');
  assert((await page.getByTestId('msg-text').inputValue()).includes('Nino'), 'prénom dans le modèle');
  await page.getByTestId('msg-copy').click(); await page.waitForTimeout(300);
  eq(await S(`return store.all('exchange').filter(x => x.studentId === a.nino && x.kind === 'message ENT').length;`, ids), 1, 'message noté');
  assert((await page.evaluate(() => navigator.clipboard.readText())).includes('Nino'), 'texte copié');
});

await test('Documents : manquants par famille et relances imprimables', async () => {
  await go('#/documents');
  const t = await page.getByTestId('doc-missing').innerText();
  assert(t.includes('Lou') && t.includes('assurance'), 'documents manquants listés');
  await page.evaluate(() => { window.print = () => { window.__slips = document.querySelectorAll('#print-root .relance').length; }; });
  await page.getByTestId('doc-relances').click();
  assert(await page.evaluate(() => window.__slips) >= 1, 'une relance par famille');
});

await test('Agenda .ics : événement, rendez-vous et tâche avec alerte ; aucun nom de famille', async () => {
  const ics = await S(`const d = model.addDays(model.todayIso(), 5);
    await store.create('event', { title: 'Conseil d’école', date: d, start: '18:00', end: '19:30' }, 'e');
    await store.create('task', { title: 'Rendre les livrets', due: d, done: false }, 't');
    const free = store.all('rdvslot').find(r => !r.studentId); await F.book(free.id, a.nino);
    return R.buildIcs(R.items());`, ids);
  assert(ics.startsWith('BEGIN:VCALENDAR') && ics.includes('END:VCALENDAR'), 'fichier calendrier');
  assert(ics.includes('SUMMARY:Conseil d’école') && ics.includes('DTSTART;TZID=Europe/Paris:'), 'événement horaire');
  assert(ics.includes('SUMMARY:À faire : Rendre les livrets') && ics.includes('VALUE=DATE'), 'tâche sur la journée');
  assert(ics.includes('Rendez-vous famille') && ics.includes('TRIGGER:-PT30M'), 'rendez-vous avec alerte 30 min');
  assert(!ics.includes('Exemple'), 'aucun nom de famille des élèves');
  assert(ics.split('\r\n').every(l => l.length <= 75), 'lignes pliées selon la norme');
  await go('#/agenda');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-ics').click()]);
  eq(dl.suggestedFilename(), 'classeur-agenda.ics', 'fichier téléchargé');
});

await test('Rappels : tâche du jour signalée une seule fois', async () => {
  await S(`await store.create('task', { title: 'Photocopies du jour', due: model.todayIso(), done: false }, 't');`);
  const first = await S(`return (await R.check()).map(x => x.text);`);
  assert(first.some(t => t.includes('Photocopies du jour')), 'rappel affiché');
  const again = await S(`return (await R.check()).length;`);
  eq(again, 0, 'pas de second rappel');
  await go('#/reglages/rappels');
  await page.getByTestId('rem-tasks').uncheck(); await page.waitForTimeout(150);
  eq(await S(`return R.prefs().tasks;`), false, 'réglage enregistré');
  await page.screenshot({ path: `${OUT}etape5-rappels.png` });
});

await test('Ateliers et rotations : chaque groupe passe une fois par chaque atelier', async () => {
  const r = await page.evaluate(async () => (await import('./js/pages/ateliers.js')).rotation(4, 4));
  for (let g = 0; g < 4; g++) eq(new Set(r.map(row => row[g])).size, 4, `groupe ${g + 1} : 4 ateliers différents`);
  for (const row of r) eq(new Set(row).size, 4, 'un groupe par atelier à chaque séance');
  await S(`const G = await import('./js/groups.js'); const st = model.studentsOfClass(a.cls).map(x => x.student.id);
    await store.create('groupset', { classId: a.cls, name: 'Ateliers maths', kind: 'ateliers', permanent: false, groups: [0, 1, 2].map(i => ({ ...G.newGroup(i, st.slice(i * 3, i * 3 + 3)), activity: ['Jeu de calcul', 'Fichier', 'Avec la maîtresse'][i], order: i + 1 })) }, 'g');`, ids);
  await go('#/ateliers');
  await page.getByTestId('rot-set').selectOption({ label: 'Ateliers maths' }); await page.waitForTimeout(200);
  const t = await page.getByTestId('rot-table').textContent();
  assert(t.includes('Jeu de calcul') && t.includes('Avec la maîtresse') && t.includes('Séance 3'), 'tableau de rotation');
});

await test('Aucune erreur dans la console', async () => { eq(errors.length, 0, errors.join(' | ')); });

await browser.close();
writeFileSync(`${OUT}resultats-etape5b.txt`, results.join('\n'));
console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
