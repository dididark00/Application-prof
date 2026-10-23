// Cahier journal : préparer la semaine (EDT ou vierge), fiche habituelle, export sur période ;
// import CSV relié ; couverture des compétences ; polices des débutants ; menu « Plus » sur téléphone.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let passed = 0, failed = 0; const results = [];
let page;
async function test(name, fn) {
  try { await fn(); passed++; results.push(`✔ ${name}`); console.log(`✔ ${name}`); }
  catch (e) { failed++; results.push(`✘ ${name}\n    ${e.message.split('\n')[0]}`); console.log(`✘ ${name}\n   `, e.message); try { await page.screenshot({ path: `${OUT}echec-semaine-${failed}.png`, fullPage: true }); } catch { /* */ } }
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
const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(300); };
const S = (fn, arg) => page.evaluate(async ([src, a]) => {
  const m = { store: await import('./js/store.js'), model: await import('./js/model.js'), PL: await import('./js/planning.js'), CP: await import('./js/cahier-plus.js'), IC: await import('./js/importcsv.js') };
  return (new Function(...Object.keys(m), 'a', `return (async () => { ${src} })()`))(...Object.values(m), a);
}, [fn, arg]);
const modalBtn = (name) => page.locator('.modal-foot button', { hasText: name });

await page.goto(BASE); await ready();
await page.evaluate(async () => (await import('./js/demo.js')).loadDemo());
await page.waitForTimeout(400);
const ids = await S(`const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentClassId: cls.id });
  const plan = PL.dayPlan(cls, '2026-11-09'); const slots = plan.entries.filter(e => e.kind === 'slot');
  const rit = slots.find(e => /rituel/i.test(e.title + e.subject)) || slots[0];
  const fiche = await store.create('session', { classId: cls.id, sequenceId: null, title: 'Rituels du matin (essai)', subject: rit.subject, phases: [], competencyIds: [], fileIds: [] }, 's');
  return { cls: cls.id, ritSlot: rit.slot.id, ritStart: rit.start, fiche: fiche.id, myDays: cls.serviceDays || [] };`);

await test('Préparer la semaine : fiche habituelle ★ et séances de la progression proposées, puis posées', async () => {
  await S(`await CP.setHabitual(store.get(a.cls), a.ritSlot, a.fiche);`, ids);
  await go('#/cahier?d=2026-11-02&v=semaine');
  await page.getByTestId('prefill-week').click();
  const t = await page.getByTestId('prefill-list').innerText();
  assert(t.includes('Rituels du matin (essai)') && t.includes('habituelle'), 'fiche habituelle proposée');
  assert(t.includes('Le zéro intermédiaire'), 'séance suivante de la progression (P2 S1), non encore programmée, proposée');
  assert(!t.includes('Découvrir le millier'), 'séance déjà programmée non reproposée');
  await page.getByTestId('prefill-apply').click(); await page.waitForTimeout(400);
  const r = await S(`const cls = store.get(a.cls); const days = CP.weekDays(cls, '2026-11-02'); return days.flatMap(d => PL.dayPlan(cls, d).entries).filter(e => e.sessionId).map(e => store.get(e.sessionId).title);`, ids);
  assert(r.includes('Rituels du matin (essai)') && r.includes('Le zéro intermédiaire (exemple)'), `fiches posées : ${r.join(' | ')}`);
  eq(r.filter(x => x === 'Le zéro intermédiaire (exemple)').length, 1, 'une séance de progression posée une seule fois');
  eq(await S(`return CP.weekProposals(store.get(a.cls), '2026-11-02').length;`, ids), 0, 'plus rien à proposer : rien n’est posé deux fois');
});

await test('Semaine vierge : l’EDT n’est pas posé cette semaine-là seulement', async () => {
  await go('#/cahier?d=2026-11-16&v=semaine');
  await page.getByTestId('prefill-week').click();
  await page.getByTestId('week-mode-vierge').check();
  await page.getByTestId('prefill-apply').click(); await page.waitForTimeout(400);
  const r = await S(`const cls = store.get(a.cls); return { vierge: PL.dayPlan(cls, '2026-11-16').entries.filter(e => e.kind === 'slot').length, autre: PL.dayPlan(cls, '2026-11-23').entries.filter(e => e.kind === 'slot').length };`, ids);
  eq(r.vierge, 0, 'semaine vierge sans créneaux');
  assert(r.autre > 0, 'les autres semaines gardent l’EDT');
  await page.getByTestId('prefill-week').click();
  await page.getByTestId('week-mode-edt').check();
  await page.getByTestId('prefill-apply').click(); await page.waitForTimeout(300);
  assert(await S(`return PL.dayPlan(store.get(a.cls), '2026-11-16').entries.filter(e => e.kind === 'slot').length;`, ids) > 0, 'retour à l’EDT possible');
});

await test('Exporter : mois en CSV, semaine détaillée (une page par jour)', async () => {
  await go('#/cahier?d=2026-11-02');
  await page.getByTestId('export-journal').click();
  await page.getByTestId('export-kind').selectOption('mois'); await page.getByTestId('export-format').selectOption('csv');
  assert((await page.getByTestId('export-info').innerText()).includes('01/11/2026 au 30/11/2026'), 'bornes du mois');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-go').click()]);
  const csv = readFileSync(await dl.path(), 'utf8');
  assert(csv.includes('Date;Début;Fin;Discipline;Séance;Statut;Bilan') && csv.includes('Rituels du matin (essai)') && csv.includes('2026-11-02') && !csv.includes('2026-12-'), 'CSV du mois');
  await page.evaluate(() => { window.print = () => { window.__days = document.querySelectorAll('#print-root .print-doc').length; }; });
  await page.getByTestId('export-journal').click();
  await page.getByTestId('export-kind').selectOption('semaine'); await page.getByTestId('export-format').selectOption('detail');
  await page.getByTestId('export-go').click(); await page.waitForTimeout(200);
  const n = await S(`return CP.schoolDaysBetween(store.get(a.cls), '2026-11-02', '2026-11-08').length;`, ids);
  eq(await page.evaluate(() => window.__days), n, 'une page par jour de classe');
});

await test('Menu « Plus » : fiche habituelle depuis le créneau ; sur téléphone, le menu reste dans l’écran', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await go('#/cahier?d=2026-11-09');
  await page.getByTestId('entry-more').first().click();
  const box = await page.locator('details.more[open] .more-menu').boundingBox();
  assert(box.x >= 0 && box.x + box.width <= 390, `menu dans l’écran (${box.x}, ${box.width})`);
  await page.setViewportSize({ width: 1280, height: 900 });
});

await test('Import CSV d’une progression : séquence existante reliée, nouvelle séquence et séances créées', async () => {
  await go('#/importer?k=progression');
  await page.getByTestId('import-text').fill('Discipline;Niveau;Période;Semaine;Séquence;Séance;Objectif;Support\nMathématiques;CE2;P2;2;Les nombres jusqu’à 10 000 (exemple);Le zéro intermédiaire (exemple);Zéros;Manuel\nFrançais;CE2;P2;2;Le récit (essai);Découvrir le texte;Personnages;Album\nFrançais;CE2;P9;2;Le récit (essai);Lire la suite;;');
  assert((await page.getByTestId('import-errors').innerText()).includes('Ligne 4'), 'ligne en erreur signalée (période P9)');
  await page.getByTestId('import-go').click(); await page.waitForTimeout(400);
  const r = await S(`const cls = store.get(a.cls); const seqs = store.all('sequence').filter(s => s.classId === a.cls);
    const math = store.all('progression').find(p => p.classId === a.cls && p.subject === 'Mathématiques' && p.rows.some(r => r.week === 2));
    const fr = store.all('progression').find(p => p.classId === a.cls && p.subject === 'Français');
    const exist = seqs.filter(s => s.title === 'Les nombres jusqu’à 10 000 (exemple)').length;
    const recit = seqs.find(s => s.title === 'Le récit (essai)');
    return { exist, recit: !!recit, mathRow: math?.rows.find(r => r.week === 2), frRow: fr?.rows[0], ses: recit ? store.all('session').filter(s => s.sequenceId === recit.id).map(s => s.title) : [] };`, ids);
  eq(r.exist, 1, 'séquence existante non dupliquée');
  assert(r.mathRow?.sessionId && r.mathRow.sequenceId, 'ligne reliée à la séquence et à la séance existantes');
  assert(r.recit && r.ses.includes('Découvrir le texte'), 'nouvelle séquence et séance créées');
  assert(r.frRow?.sessionId, 'progression de français reliée à la séance créée');
});

await test('Import CSV du cahier journal : séance posée dans le créneau de l’EDT, jamais d’écrasement', async () => {
  const slot = await S(`const p = PL.dayPlan(store.get(a.cls), '2026-11-23'); const e = p.entries.find(x => x.kind === 'slot' && x.subject === 'Mathématiques') || p.entries.find(x => x.kind === 'slot'); return { start: e.start, subject: e.subject };`, ids);
  const r = await S(`const cls = store.get(a.cls);
    const csv = 'Date;Début;Fin;Discipline;Séance;Statut;Bilan\\n23/11/2026;' + a.start + ';;' + a.subject + ';Lire et écrire les nombres jusqu’à 10 000 (exemple);faite;Bien compris\\n23/11/2026;' + a.start + ';;' + a.subject + ';Autre;prévue;';
    const an = IC.analyse('cahier', csv, cls); const rep = await IC.importRows('cahier', an.rows, cls);
    const e = PL.dayPlan(cls, '2026-11-23').entries.find(x => x.start === a.start && x.kind === 'occ');
    return { rep, slotId: e?.occ?.slotId, title: e?.session?.title, note: e?.occ?.note, status: e?.status };`, { ...ids, ...slot });
  assert(r.slotId, 'posée dans le créneau de l’EDT');
  eq(r.title, 'Lire et écrire les nombres jusqu’à 10 000 (exemple)', 'reliée à la fiche existante');
  eq(r.note, 'Bien compris', 'bilan repris'); eq(r.status, 'faite', 'statut repris');
  eq(r.rep.skipped, 1, 'la seconde ligne au même créneau n’écrase pas');
});

await test('Couverture des compétences : la compétence travaillée apparaît (fiche, jour fait) et au cahier journal', async () => {
  const c = await S(`const ref = await store.create('referential', { name: 'Référentiel d’essai', version: '1', source: 'essai', levels: ['CE2'], status: 'validé', items: [{ id: 'comp-essai', code: 'M1', label: 'Lire et écrire les nombres', levels: ['CE2'] }] }, 'r');
    const s = store.all('session').find(x => x.title === 'Lire et écrire les nombres jusqu’à 10 000 (exemple)'); await store.update(s.id, { competencyIds: ['comp-essai'] }, 'c'); return ref.id;`);
  await go(`#/referentiels/${c}`);
  const t = await page.getByTestId('ref-coverage').first().innerText();
  assert(t.includes('1 fiche') && t.includes('1 jour fait'), `couverture : ${t}`);
  await go('#/cahier?d=2026-11-23');
  assert((await page.getByTestId('entry-comps').first().innerText()).includes('M1'), 'compétence visible au cahier journal');
  await go('#/referentiels');
  assert(await page.getByTestId('ref-how').count() === 1, 'explication « à quoi ça sert »');
});

await test('Polices des débutants (Andika) et capitales d’imprimerie dans le tableau d’écriture', async () => {
  const names = await page.evaluate(async () => (await import('./js/fonts.js')).available().map(x => x[0]));
  assert(names.includes('Andika') && names.includes('Marelle Baton'), 'Andika et Marelle Bâton proposées');
  await go('#/atelier');
  await page.getByTestId('p-casse').selectOption('capitales'); await page.waitForTimeout(200);
  const txt = await page.getByTestId('atelier-preview').locator('text').allTextContents();
  assert(txt.some(t => t.includes('LE CHAT DORT')), `texte en capitales : ${txt.slice(0, 3).join(' / ')}`);
});

await test('Binôme désactivable : plus de « jour de la binôme », transmissions masquées, réactivable', async () => {
  await go('#/reglages/classes');
  await page.locator('[data-testid=class-card]').filter({ has: page.locator('h2', { hasText: /^CE2 \(démo\)/ }) }).first().getByRole('button', { name: /Modifier/ }).first().click();
  const box = page.getByTestId('binome-active');
  assert(await box.isChecked(), 'binôme actif au départ (classe de démo à mi-temps)');
  await box.uncheck(); await page.locator('.modal-foot button', { hasText: 'Enregistrer' }).click(); await page.waitForTimeout(300);
  const r = await S(`const cls = store.get(a.cls); return { jeudi: PL.isMyDay(cls, '2026-11-12'), owners: model.owners(cls).map(o => o[0]) };`, ids);
  eq(r.jeudi, true, 'le jeudi est un jour à moi'); assert(!r.owners.includes('binome'), 'plus de choix « binôme » pour les documents');
  await go('#/cahier?d=2026-11-12');
  assert(!(await page.locator('.page').innerText()).includes('Jour de classe de'), 'plus de bandeau « jour de la binôme »');
  assert(!(await page.locator('nav').first().innerText()).includes('Transmissions'), 'transmissions masquées dans le menu');
  await go('#/reglages/classes');
  await page.locator('[data-testid=class-card]').filter({ has: page.locator('h2', { hasText: /^CE2 \(démo\)/ }) }).first().getByRole('button', { name: /Modifier/ }).first().click();
  await page.getByTestId('binome-active').check(); await page.locator('.modal-foot button', { hasText: 'Enregistrer' }).click(); await page.waitForTimeout(300);
  eq(await S(`return PL.isMyDay(store.get(a.cls), '2026-11-12');`, ids), false, 'réactivée : le jeudi redevient le jour de la binôme');
});

await test('Timer feu tricolore : vert, orange à mi-temps, rouge à la fin', async () => {
  const c = await page.evaluate(async () => { const T = await import('./js/timer.js'); const st = (rem) => ({ color: 'auto', duration: 600, remaining: rem, running: false, endAt: null }); return [T.colorOf(st(500)), T.colorOf(st(300)), T.colorOf(st(200)), T.colorOf(st(60)), T.colorOf({ ...st(60), color: '#2f6f8f' })]; });
  eq(c.join(','), '#3f9b4f,#f08c1e,#f08c1e,#d64545,#2f6f8f', 'couleurs selon le temps restant');
});

await test('Aucune erreur dans la console', async () => { eq(errors.length, 0, errors.join(' | ')); });
await browser.close();
writeFileSync(`${OUT}resultats-semaine.txt`, results.join('\n'));
console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
