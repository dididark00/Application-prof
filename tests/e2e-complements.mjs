// Compléments : syllabes en couleur, générateurs d'exercices, surveillances de récréation, liens utiles,
// parler et transcrire (accord), IA intégrée à l'appareil (affichée seulement si disponible).
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let passed = 0, failed = 0; const results = [];
let page;
async function test(name, fn) {
  try { await fn(); passed++; results.push(`✔ ${name}`); console.log(`✔ ${name}`); }
  catch (e) { failed++; results.push(`✘ ${name}\n    ${e.message.split('\n')[0]}`); console.log(`✘ ${name}\n   `, e.message); try { await page.screenshot({ path: `${OUT}echec-compl-${failed}.png`, fullPage: true }); } catch { /* */ } }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 }, bypassCSP: true });
page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const ready = () => page.waitForFunction(() => window.__classeurReady === true);
const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(250); };
const modalBtn = (name) => page.locator('.modal-foot button', { hasText: name });

await page.goto(BASE); await ready();
await page.evaluate(async () => (await import('./js/demo.js')).loadDemo());
await page.waitForTimeout(400);
await page.evaluate(async () => { const store = await import('./js/store.js'); const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentClassId: cls.id, userName: 'Julia' }); });

await test('Syllabes : découpage de 60 mots courants conforme à l’usage scolaire', async () => {
  const r = await page.evaluate(async () => {
    const S = await import('./js/syllabes.js');
    const exp = { chocolat: 'cho-co-lat', maison: 'mai-son', table: 'ta-ble', pomme: 'pom-me', arbre: 'ar-bre', ordinateur: 'or-di-na-teur', crayon: 'cra-yon', oiseau: 'oi-seau', bonne: 'bon-ne', 'éléphant': 'é-lé-phant', 'garçon': 'gar-çon', montagne: 'mon-ta-gne', poisson: 'pois-son', chapeau: 'cha-peau', voiture: 'voi-tu-re', enfant: 'en-fant', bateau: 'ba-teau', 'école': 'é-co-le', lapin: 'la-pin', fleur: 'fleur', princesse: 'prin-ces-se', quatre: 'qua-tre', guitare: 'gui-ta-re', 'fenêtre': 'fe-nê-tre', ananas: 'a-na-nas', inutile: 'i-nu-ti-le', immense: 'im-men-se', piano: 'pia-no', nuage: 'nua-ge', pluie: 'pluie', papillon: 'pa-pil-lon', escargot: 'es-car-got', histoire: 'his-toi-re', poule: 'pou-le', cheval: 'che-val', grenouille: 'gre-nouil-le', 'maîtresse': 'maî-tres-se', soleil: 'so-leil', chanter: 'chan-ter', bague: 'ba-gue', sapin: 'sa-pin', tigre: 'ti-gre', parapluie: 'pa-ra-pluie', Marie: 'Ma-rie', jardin: 'jar-din', 'li|on': 'li-on', feuille: 'feuil-le', abeille: 'a-beil-le', train: 'train', 'sorcière': 'sor-ciè-re', magicien: 'ma-gi-cien', camion: 'ca-mion', loup: 'loup', kangourou: 'kan-gou-rou', ennemi: 'en-ne-mi', automne: 'au-tom-ne', monsieur: 'mon-sieur', 'récréation': 'ré-cré-a-tion', cuisine: 'cui-si-ne', anniversaire: 'an-ni-ver-sai-re' };
    return Object.entries(exp).filter(([w, e]) => S.hyphenate(w) !== e).map(([w]) => `${w}→${S.hyphenate(w)}`);
  });
  eq(r.length, 0, `mal coupés : ${r.join(', ')}`);
});

await test('Syllabes en couleur : affichage, couleurs alternées, lettre muette grisée, impression', async () => {
  await go('#/outils?o=syllabes');
  await page.getByTestId('syl-text').fill('Les chats');
  eq(await page.getByTestId('syl-view').locator('.syl').count(), 2, '« Les » + « chats » : 2 syllabes');
  const colors = await page.getByTestId('syl-view').locator('.syl').evaluateAll(els => els.map(e => e.style.color));
  assert(colors[0] !== colors[1], 'couleurs alternées');
  eq(await page.getByTestId('syl-view').locator('.syl-muette').count(), 3, 's de « Les », t et s de « chats » en gris');
  await page.evaluate(() => { window.print = () => { window.__p = document.querySelectorAll('#print-root .syl').length; }; });
  await page.getByTestId('syl-print').click();
  eq(await page.evaluate(() => window.__p), 2, 'imprimé');
});

await test('Calculs : nombre, sans retenue, même graine = même fiche, corrigé juste', async () => {
  await go('#/exercices?t=calculs');
  await page.getByTestId('ex-seed').fill('1234');
  const first = await page.getByTestId('ex-preview').innerText();
  eq(await page.getByTestId('ex-preview').getByTestId('ex-item').count(), 20, '20 calculs');
  await go('#/exercices?t=problemes'); await go('#/exercices?t=calculs');
  eq(await page.getByTestId('ex-preview').innerText(), first, 'même graine, même fiche');
  await page.getByTestId('ex-corr').check();
  const items = await page.getByTestId('ex-preview').locator('.ex-calc').nth(1).locator('li').allInnerTexts();
  for (const t of items) { const m = t.replace(/ /g, '').match(/(\d+) ([+−×÷]) (\d+) = (\d+)/); const [a, op, b, r] = [Number(m[1]), m[2], Number(m[3]), Number(m[4])]; eq(op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b, r, `corrigé de ${t}`); }
  const nc = await page.evaluate(async () => { const X = await import('./js/exercices.js'); return X.calculs({ ops: ['+', '-'], min: 10, max: 99, count: 30, seed: 9, sansRetenue: true }).every(c => { let a = c.a, b = c.b; while (a || b) { if (c.op === '+' ? (a % 10) + (b % 10) > 9 : (a % 10) < (b % 10)) return false; a = Math.floor(a / 10); b = Math.floor(b / 10); } return true; }); });
  assert(nc, 'aucune retenue');
  for (const w of [390, 1280]) {
    await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(150);
    const bad = await page.evaluate(() => { const lis = [...document.querySelectorAll('.ex-calc li')]; let n = 0; for (let i = 0; i < lis.length; i++) for (let j = i + 1; j < lis.length; j++) { const a = lis[i].getBoundingClientRect(), c = lis[j].getBoundingClientRect(); if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) n++; } return n; });
    eq(bad, 0, `aucun calcul ne se chevauche (largeur ${w})`);
  }
  await page.getByTestId('ex-pose').check();
  assert(await page.locator('.pose').count() >= 20, 'opérations posées');
});

await test('Problèmes, dictée de mots, fluence', async () => {
  await go('#/exercices?t=problemes');
  if (await page.getByTestId('ex-corr').isChecked()) await page.getByTestId('ex-corr').uncheck();
  eq(await page.getByTestId('ex-preview').getByTestId('ex-item').count(), 6, '6 problèmes');
  await page.getByTestId('ex-corr').check();
  assert((await page.getByTestId('ex-preview').innerText()).includes('Réponse :'), 'corrigé avec réponse');
  await page.getByTestId('ex-corr').uncheck();
  await go('#/exercices?t=dictee');
  eq(await page.getByTestId('ex-preview').getByTestId('ex-item').count(), 10, '10 lignes de dictée');
  assert(!(await page.getByTestId('ex-preview').innerText()).match(/loup|bonbon|maison/), 'les mots ne sont pas sur la fiche élève');
  await go('#/exercices?t=fluence');
  await page.getByTestId('flu-text').fill('Le chat dort.\nIl fait très beau aujourd’hui.');
  const rows = await page.getByTestId('ex-preview').getByTestId('ex-item').allInnerTexts();
  assert(rows[0].endsWith('3') && rows[1].endsWith('8'), `cumul des mots : ${rows.join(' / ')}`);
  eq(await page.evaluate(async () => (await import('./js/exercices.js')).mcm(80, 4, 60)), 76, 'mots correctement lus par minute');
});

await test('Récréations : répartition équitable selon les jours de présence', async () => {
  await go('#/recreation');
  for (const [n, days] of [['Julia', ['Lun', 'Mar']], ['Mme Durand', []], ['M. Petit', []]]) {
    await page.getByTestId('recre-name').fill(n);
    for (const d of days) await page.locator('.page .chip', { hasText: d }).first().locator('input').check();
    await page.getByTestId('recre-add').click(); await page.waitForTimeout(250);
  }
  await page.getByTestId('recre-distribute').click(); await page.waitForTimeout(300);
  const r = await page.evaluate(async () => { const R = await import('./js/pages/recreation.js'); const p = R.planOf(); const c = R.counts(p);
    const julia = Object.entries(p.grid).filter(([, v]) => v.includes('Julia')).map(([k]) => Number(k.split('|')[0]));
    return { c, julia, empty: Object.values(p.grid).filter(v => !v.length).length }; });
  eq(r.empty, 0, 'aucune case vide');
  assert(r.julia.every(d => d === 1 || d === 2), 'Julia seulement lundi et mardi');
  const vals = Object.values(r.c); assert(Math.max(...vals) - Math.min(...vals) <= 2, `répartition équilibrée ${JSON.stringify(r.c)}`);
});

await test('Liens utiles : liens officiels, ajout d’un lien, refus d’une adresse invalide', async () => {
  await go('#/liens');
  assert((await page.locator('.page').innerText()).includes('Éduscol'), 'liens officiels');
  await page.getByTestId('link-title').fill('Site de ma circonscription'); await page.getByTestId('link-url').fill('javascript:alert(1)');
  await page.getByTestId('link-add').click(); await page.waitForTimeout(150);
  assert(!(await page.locator('.page').innerText()).includes('Site de ma circonscription'), 'adresse dangereuse refusée');
  await page.getByTestId('link-url').fill('https://exemple.fr/circo'); await page.getByTestId('link-add').click(); await page.waitForTimeout(250);
  assert((await page.locator('.page').innerText()).includes('Site de ma circonscription'), 'lien ajouté');
});

await test('Parler et transcrire : rien n’est envoyé sans accord ; ponctuation dictée', async () => {
  await go('#/outils?o=parler'); await page.waitForTimeout(300);
  const status = await page.getByTestId('parler-status').innerText();
  if (status.includes('service en ligne')) {
    assert(await page.getByTestId('parler-start').isDisabled(), 'bouton inactif sans accord');
    await page.getByTestId('parler-consent').check(); await page.waitForTimeout(150);
    assert(!(await page.getByTestId('parler-start').isDisabled()), 'actif après accord');
  } else assert(/sur l’appareil|non disponible/.test(status), `état affiché : ${status}`);
  const t = await page.evaluate(async () => (await import('./js/ia.js')).punctuate('le chat dort point il fait beau virgule nous jouons point d\'interrogation'));
  eq(t, 'Le chat dort. Il fait beau, nous jouons ?', 'ponctuation');
});

await test('IA de l’appareil : cachée si absente, utilisée si le navigateur la propose', async () => {
  await go('#/outils?o=tapuscrit'); await page.waitForTimeout(300);
  eq(await page.getByTestId('ia-simplifier').isHidden(), true, 'bouton caché sans IA intégrée');
  // Simulation d'un navigateur qui propose l'API Rewriter (aucun réseau).
  await page.evaluate(() => { self.Rewriter = { availability: async () => 'available', create: async () => ({ rewrite: async (t) => `[simplifié] ${t}`, destroy() {} }) }; });
  await go('#/outils?o=lire'); await go('#/outils?o=tapuscrit'); await page.waitForTimeout(300);
  await page.getByTestId('ocr-text').fill('Un texte assez compliqué.');
  await page.getByTestId('ia-simplifier').click(); await page.waitForTimeout(300);
  eq(await page.getByTestId('ocr-text').inputValue(), '[simplifié] Un texte assez compliqué.', 'texte réécrit');
});

await test('Toutes les fonctions de la feuille de route ont un statut (aucune « à développer »)', async () => {
  const n = await page.evaluate(async () => (await import('./js/roadmap.js')).ROADMAP.filter(r => r.statut === 'afaire').length);
  eq(n, 0, 'fonctions à développer');
});

await test('Aucune erreur dans la console', async () => { eq(errors.length, 0, errors.join(' | ')); });

await browser.close();
writeFileSync(`${OUT}resultats-complements.txt`, results.join('\n'));
console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
