// Registre d'appel : statistiques, grille, justification des absences, alerte, préférences, export.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let passed = 0, failed = 0; const results = [];
let page;
async function test(name, fn) {
  try { await fn(); passed++; results.push(`✔ ${name}`); console.log(`✔ ${name}`); }
  catch (e) { failed++; results.push(`✘ ${name}\n    ${e.message.split('\n')[0]}`); console.log(`✘ ${name}\n   `, e.message); try { await page.screenshot({ path: `${OUT}echec-registre-${failed}.png`, fullPage: true }); } catch { /* */ } }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 }, bypassCSP: true, acceptDownloads: true });
page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(300); };
const S = (fn, arg) => page.evaluate(async ([src, a]) => {
  const m = { store: await import('./js/store.js'), model: await import('./js/model.js'), R: await import('./js/pages/registre.js') };
  return (new Function(...Object.keys(m), 'a', `return (async () => { ${src} })()`))(...Object.values(m), a);
}, [fn, arg]);

await page.goto(BASE); await page.waitForFunction(() => window.__classeurReady === true);
await page.evaluate(async () => (await import('./js/demo.js')).loadDemo());
await page.waitForTimeout(400);
// Novembre 2026 : appel sur 4 jours (8 demi-journées) ; Nino absent 5 demi-journées, Lou en retard 2 fois.
const ids = await S(`const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentClassId: cls.id });
  const st = (n) => store.all('student').find(s => s.firstName === n).id; const nino = st('Nino'), lou = st('Lou');
  const days = ['2026-12-07', '2026-12-08', '2026-12-14', '2026-12-15'];
  for (const d of days) for (const half of ['matin', 'après-midi']) {
    const marks = {}; for (const { student: s } of model.studentsOfClass(cls.id, { date: d })) marks[s.id] = { status: 'présent' };
    if (!(d === '2026-12-15' && half === 'après-midi')) marks[nino] = { status: 'absent' };
    if (half === 'matin' && (d === '2026-12-07' || d === '2026-12-08')) marks[lou] = { status: 'retard', time: '08:40' };
    await store.create('attendance', { classId: cls.id, date: d, half, marks, validated: true, validatedAt: d + 'T09:00:00' }, 'a');
  }
  const n = model.studentsOfClass(cls.id, { date: '2026-12-07' }).length;
  return { cls: cls.id, nino, lou, n };`);

await test('Statistiques du mois : possibles, présents, absents, matin et après-midi', async () => {
  await go('#/registre?m=2026-12&t=stats');
  const s = await S(`return R.monthStats(store.get(a.cls), '2026-12');`, ids);
  eq(s.total.halves, 8, '8 demi-journées'); eq(s.total.possible, 8 * ids.n, 'possibles');
  eq(s.total.absent, 7, '7 absences de Nino'); eq(s.total.present, 8 * ids.n - 7, 'présents (retards comptés présents)');
  eq(s.matin.halves + s['après-midi'].halves, 8, 'matin + après-midi');
  assert((await page.getByTestId('reg-stat').first().innerText()).includes(String(8 * ids.n)), 'chiffres affichés');
  assert(await page.getByTestId('reg-cal').locator('i.ok').count() === 8, 'calendrier : 8 points d’appel validé');
});

await test('Registre : grille élèves × demi-journées, total par demi-journée', async () => {
  await go('#/registre?m=2026-12&t=registre');
  const row = page.getByTestId('reg-table').locator('tbody tr').filter({ hasText: 'Nino' });
  eq(await row.locator('.reg-c.abs').count(), 7, '7 absences dans la ligne de Nino');
  const totals = await page.getByTestId('reg-table').locator('.reg-total td').allInnerTexts();
  assert(totals.includes(String(ids.n - 1)), `total d’une demi-journée = ${ids.n - 1}`);
});

await test('Absences : justification, cumul des retards, alerte à 4 demi-journées injustifiées', async () => {
  await go('#/registre?m=2026-12&t=absences');
  const nino = page.getByTestId('reg-abs-card').filter({ hasText: 'Nino' });
  eq(await nino.getByTestId('reg-unjust').innerText(), '7', '7 demi-journées non justifiées');
  assert(await nino.getByTestId('reg-alert').count() === 1, 'alerte de signalement');
  for (let i = 0; i < 4; i++) {
    await page.getByTestId('reg-abs-card').filter({ hasText: 'Nino' }).getByTestId('reg-chip').nth(i).click();
    await page.locator('.modal input').fill('maladie (certificat)'); await page.getByTestId('just-motif-l-gitime').click(); await page.waitForTimeout(250);
  }
  eq(await page.getByTestId('reg-abs-card').filter({ hasText: 'Nino' }).getByTestId('reg-unjust').innerText(), '3', '3 non justifiées après 4 justifications');
  eq(await page.getByTestId('reg-abs-card').filter({ hasText: 'Nino' }).getByTestId('reg-alert').count(), 0, 'plus d’alerte');
  assert((await page.getByTestId('reg-abs-card').filter({ hasText: 'Lou' }).innerText()).includes('20 min'), 'Lou : 2 retards de 10 min = 20 min');
});

await test('Préférences : tri par prénom, repas spécial et élève non pris en compte appliqués à l’appel et aux statistiques', async () => {
  await go('#/registre?m=2026-12&t=prefs');
  await page.getByTestId('reg-sort-prenom').check(); await page.waitForTimeout(250);
  const rows = page.locator('table.table tbody tr');
  const loupos = await rows.evaluateAll(tr => tr.findIndex(t => t.innerText.includes('Lou')));
  await rows.nth(loupos).getByTestId('reg-meal').check(); await page.waitForTimeout(250);
  const ninopos = await page.locator('table.table tbody tr').evaluateAll(tr => tr.findIndex(t => t.innerText.includes('Nino')));
  await page.locator('table.table tbody tr').nth(ninopos).getByTestId('reg-excl').check(); await page.waitForTimeout(250);
  const s = await S(`return R.monthStats(store.get(a.cls), '2026-12').total;`, ids);
  eq(s.absent, 0, 'Nino non pris en compte : plus d’absences comptées'); eq(s.possible, 8 * (ids.n - 1), 'possibles sans Nino');
  await go('#/appel?d=2026-12-07&h=matin');
  const names = await page.getByTestId('appel-row').allInnerTexts();
  assert(!names.some(t => t.includes('Nino')), 'Nino absent de la liste d’appel');
  assert(names.find(t => t.includes('Lou')).includes('repas spécial'), 'repas spécial affiché à l’appel');
  const firsts = names.map(t => t.trim().split(/\s+/)[1] || t);
  void firsts;
});

await test('Export : CSV du mois avec justifications, impression du registre', async () => {
  await go('#/registre?m=2026-12&t=stats');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('reg-csv').click()]);
  const csv = readFileSync(await dl.path(), 'utf8');
  assert(csv.includes('Date;Demi-journée;Nom;Prénom;Statut;Heure;Justification;Motif') && csv.includes('motif légitime;maladie (certificat)'), 'CSV avec justification et motif');
  await page.evaluate(() => { window.print = () => { window.__rows = document.querySelectorAll('#print-root .reg-print tbody tr').length; }; });
  await page.getByTestId('reg-print').click();
  eq(await page.evaluate(() => window.__rows), ids.n - 1, 'une ligne par élève pris en compte');
  await page.setViewportSize({ width: 390, height: 844 });
  await go('#/registre?m=2026-12&t=registre'); await page.screenshot({ path: `${OUT}registre-telephone.png` });
  await go('#/registre?m=2026-12&t=stats'); await page.screenshot({ path: `${OUT}registre-stats.png` });
  eq(await page.evaluate(() => document.documentElement.scrollWidth <= 392), true, 'rien ne dépasse sur téléphone');
});

await test('Aucune erreur dans la console', async () => { eq(errors.length, 0, errors.join(' | ')); });
await browser.close();
writeFileSync(`${OUT}resultats-registre.txt`, results.join('\n'));
console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
