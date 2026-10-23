// Tests de bout en bout dans un vrai navigateur (Chromium via Playwright).
// Lancement : serveur sur http://localhost:8080 puis « node tests/e2e.mjs ».
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const NOW = new Date('2026-10-19T10:00:00');

let passed = 0, failed = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); passed++; results.push(`✔ ${name}`); console.log(`✔ ${name}`); }
  catch (e) { failed++; try { await page.screenshot({ path: `${OUT}echec-${failed}.png` }); } catch {} results.push(`✘ ${name}\n    ${e.message.split('\n')[0]}`); console.log(`✘ ${name}\n   `, e.message); }
}
function assert(c, msg) { if (!c) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true, locale: 'fr-FR', viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
await page.clock.install({ time: NOW });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

const ready = () => page.waitForFunction(() => window.__classeurReady === true);
const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(150); };
const modalBtn = (name) => page.locator('.modal-foot button', { hasText: name });
const count = (type) => page.evaluate(async (t) => (await import('./js/store.js')).all(t).length, type);
const toastText = () => page.locator('.toast').last().innerText();

await page.goto(BASE);
await ready();

await test('Premier lancement sans erreur, invitation à créer une année', async () => {
  assert(await page.getByText('Commencez par créer une année scolaire').isVisible(), 'invitation absente');
  eq(errors.length, 0, `erreurs console : ${errors.join(' | ')}`);
});

await test('Créer l’année 2026-2027 avec le préréglage zone C (5 périodes)', async () => {
  await go('#/reglages/annees');
  await page.getByRole('button', { name: 'Nouvelle année scolaire' }).click();
  await modalBtn('Enregistrer').click();
  await page.waitForSelector('[data-testid=year-card]');
  const rows = await page.locator('[data-testid=year-card] tbody tr').count();
  eq(rows, 5, 'nombre de périodes');
  assert((await page.locator('[data-testid=year-card]').innerText()).includes('service-public.gouv.fr'), 'source du calendrier non affichée');
});

await test('Validation : périodes qui se chevauchent refusées', async () => {
  const { validateYear } = await page.evaluate(() => ({}));
  const errs = await page.evaluate(async () => (await import('./js/pages/settings.js')).validateYear('X', '2026-09-01', '2027-07-02', [
    { name: 'A', start: '2026-09-01', end: '2026-10-20' }, { name: 'B', start: '2026-10-10', end: '2026-12-01' }]));
  assert(errs.some(e => e.includes('chevauchent')), 'chevauchement non détecté');
});

await test('Aujourd’hui situe la date (vacances de la Toussaint)', async () => {
  await go('#/aujourdhui');
  const t = await page.locator('.page-head').innerText();
  assert(/Vacances — reprise le 2 novembre 2026/.test(t), `situation : ${t}`);
});

await test('Créer une classe CE2 à mi-temps avec binôme', async () => {
  await go('#/reglages/classes');
  await page.getByRole('button', { name: 'Nouvelle classe' }).click();
  await page.locator('.modal input[name=name]').fill('CE2 Essai');
  await page.locator('.modal input[name=binomeName]').fill('Binôme fictive');
  await modalBtn('Enregistrer').click();
  await page.waitForSelector('[data-testid=class-card]');
  const t = await page.locator('[data-testid=class-card]').innerText();
  assert(t.includes('cycle 2') && t.includes('mi-temps') && t.includes('Binôme fictive'), t);
  eq(await page.locator('[data-testid=class-select] option:checked').innerText(), 'CE2 Essai', 'classe sélectionnée');
});

await test('Ajouter un élève, puis détecter un doublon', async () => {
  await go('#/eleves');
  for (const [fn, ln] of [['Zoé', 'Testeuse'], ['Zoé', 'Testeuse']]) {
    await page.getByTestId('add-student').click();
    await page.locator('.modal input[name=firstName]').fill(fn);
    await page.locator('.modal input[name=lastName]').fill(ln);
    await page.locator('.modal input[name=birthDate]').fill('2018-05-04');
    await modalBtn('Enregistrer').click();
  }
  assert(await page.locator('.modal .form-errors').innerText().then(t => t.includes('existe déjà')), 'doublon non signalé');
  await modalBtn('Annuler').click();
  eq(await count('student'), 1, 'nombre d’élèves');
});

await test('Import CSV : lignes valides importées, erreurs et doublons écartés', async () => {
  await page.getByRole('button', { name: 'Importer' }).click();
  await page.locator('.modal textarea').fill('Prénom;Nom;Date de naissance;Niveau\nÉlio;Fictif;03/02/2018;CE2\nMia;Erreur;31/02/2018;CE2\nZoé;Testeuse;04/05/2018;CE2\nAdam;Inventé;2018-07-09;ce2');
  await page.locator('.modal textarea').dispatchEvent('input');
  const p = await page.locator('.import-preview').innerText();
  assert(p.includes('2 ligne(s) prête(s)'), p);
  assert(p.includes('non reconnue') && p.includes('doublon'), 'erreurs non affichées');
  await modalBtn('Importer').click();
  await page.waitForTimeout(200);
  eq(await count('student'), 3, 'élèves après import');
});

await test('Annuler (bouton du haut) retire l’import entier', async () => {
  await page.getByTestId('undo').click();
  await page.waitForTimeout(200);
  eq(await count('student'), 1, 'après annulation');
  eq(await count('enrollment'), 1, 'inscriptions après annulation');
  // On refait l'import pour la suite.
  await page.getByRole('button', { name: 'Importer' }).click();
  await page.locator('.modal textarea').fill('Élio;Fictif;03/02/2018;CE2\nAdam;Inventé;09/07/2018;CE2');
  await page.locator('.modal textarea').dispatchEvent('input');
  await modalBtn('Importer').click();
  await page.waitForTimeout(200);
  eq(await count('student'), 3, 'après second import');
});

await test('Fiche élève : contacts, un seul contact prioritaire', async () => {
  await page.locator('[data-testid=students-table] a', { hasText: 'TESTEUSE' }).click();
  for (const name of ['Parent Un', 'Parent Deux']) {
    await page.getByTestId('add-contact').click();
    await page.locator('.modal input[name=name]').fill(name);
    await page.locator('.modal input[name=phone]').fill('06 00 00 00 01');
    await page.locator('.modal input[name=priority]').check();
    await modalBtn('Enregistrer').click();
    await page.waitForTimeout(150);
  }
  const pri = await page.evaluate(async () => (await import('./js/store.js')).all('student').find(s => s.lastName === 'Testeuse').contacts.filter(c => c.priority).map(c => c.name));
  eq(JSON.stringify(pri), JSON.stringify(['Parent Deux']), 'contact prioritaire unique');
});

await test('Départ daté : listes passées intactes, liste future à jour', async () => {
  await page.getByTestId('record-departure').click();
  await page.locator('.modal input[name=end]').fill('2026-11-13');
  await modalBtn('Enregistrer le départ').click();
  await page.waitForTimeout(150);
  await go('#/eleves');
  const rowsAt = async (d) => { await page.getByTestId('list-date').fill(d); await page.getByTestId('list-date').dispatchEvent('change'); await page.waitForTimeout(150); return page.locator('[data-testid=students-table] tbody tr').count(); };
  eq(await rowsAt('2026-10-01'), 3, 'élèves au 1er octobre');
  eq(await rowsAt('2026-11-20'), 2, 'élèves au 20 novembre');
});

await test('Corbeille : supprimer puis restaurer une fiche', async () => {
  await page.getByTestId('list-date').fill('2026-10-19'); await page.getByTestId('list-date').dispatchEvent('change');
  await page.locator('[data-testid=students-table] a', { hasText: 'FICTIF' }).click();
  await page.getByRole('button', { name: 'Mettre à la corbeille' }).click();
  await modalBtn('Mettre à la corbeille').click();
  await page.waitForTimeout(200);
  eq(await count('student'), 2, 'élèves hors corbeille');
  await go('#/reglages/corbeille');
  await page.getByRole('button', { name: 'Restaurer' }).first().click();
  await page.waitForTimeout(150);
  eq(await count('student'), 3, 'élèves après restauration');
});

await test('Fichiers : dépôt, aperçu, nouvelle version, lien validé', async () => {
  await go('#/fichiers');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('upload-files').click()]);
  await chooser.setFiles([{ name: 'poesie-automne.txt', mimeType: 'text/plain', buffer: Buffer.from('Les feuilles tombent.\n') },
    { name: 'tableau.png', mimeType: 'image/png', buffer: readFileSync(new URL('../icons/icon-192.png', import.meta.url)) }]);
  await page.waitForTimeout(300);
  eq(await page.locator('[data-testid=file-list] .file-item').count(), 2, 'fichiers listés');
  await page.locator('.file-name', { hasText: 'poesie-automne.txt' }).click();
  assert((await page.locator('.preview-text').innerText()).includes('Les feuilles tombent'), 'aperçu texte');
  const [ch2] = await Promise.all([page.waitForEvent('filechooser'), modalBtn('Nouvelle version').click()]);
  await ch2.setFiles([{ name: 'poesie-automne.txt', mimeType: 'text/plain', buffer: Buffer.from('Version 2 corrigée.\n') }]);
  await page.waitForTimeout(300);
  const f = await page.evaluate(async () => (await import('./js/store.js')).all('file').find(x => x.name === 'poesie-automne.txt'));
  eq(f.versions.length, 2, 'versions conservées');
  await page.getByTestId('add-link').click();
  await page.locator('.modal input[name=url]').fill('javascript:alert(1)');
  await modalBtn('Enregistrer').click();
  assert((await page.locator('.modal .form-errors').innerText()).includes('invalide'), 'lien dangereux accepté');
  await page.locator('.modal input[name=url]').fill('https://www.canva.com/design/exemple');
  await page.locator('.modal input[name=name]').fill('Affiche automne');
  await page.locator('.modal input[name=tags]').fill('automne, affichage');
  await modalBtn('Enregistrer').click();
  await page.waitForTimeout(200);
  assert((await page.locator('[data-testid=file-list]').innerText()).includes('Canva'), 'lien Canva non reconnu');
});

await test('Boîte de réception : note classée dans Fichiers sans doublon', async () => {
  await go('#/reception');
  await page.getByTestId('inbox-note').click();
  await page.locator('.modal textarea').fill('Penser aux photocopies de la poésie');
  await modalBtn('Déposer').click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Classer dans Fichiers' }).click();
  await modalBtn('Classer').click();
  await page.waitForTimeout(200);
  const inbox = await page.evaluate(async () => (await import('./js/store.js')).all('inbox'));
  eq(inbox[0].status, 'classé', 'statut');
  eq(await count('file'), 4, 'fichiers (2 + lien + note)');
});

await test('Recherche globale : accents ignorés, coordonnées non indexées', async () => {
  await go('#/recherche?q=zoe');
  assert((await page.getByTestId('search-results').innerText()).includes('Zoé Testeuse'), 'élève introuvable');
  await go('#/recherche?q=automne');
  const t = await page.getByTestId('search-results').innerText();
  assert(t.includes('poesie-automne.txt') && t.includes('Affiche automne'), t);
  await go('#/recherche?q=Parent%20Deux');
  assert(!(await page.locator('[data-testid=search-results]').count()), 'un contact apparaît dans la recherche');
});

await test('Module masqué : absent de la navigation et de la recherche, données conservées', async () => {
  await go('#/reglages/modules');
  await page.getByTestId('mod-preparer').uncheck();
  await page.waitForTimeout(150);
  assert(!(await page.locator('#sidebar').innerText()).includes('Préparer'), 'rubrique encore visible');
  await go('#/recherche?q=automne');
  assert(!(await page.locator('[data-testid=search-results]').count()), 'fichiers encore trouvés');
  eq(await count('file'), 4, 'fichiers conservés');
  await go('#/reglages/modules');
  await page.getByTestId('mod-preparer').check();
  await page.waitForTimeout(150);
});

await test('Favoris : ajout depuis une page, visible dans la barre latérale', async () => {
  await go('#/fichiers');
  await page.getByRole('button', { name: 'Ajouter aux favoris' }).click();
  await page.waitForTimeout(150);
  assert((await page.locator('#sidebar').innerText()).toLowerCase().includes('favoris'), 'favori absent');
});

await test('Plus aucune page « à venir » : chaque rubrique ouvre une vraie page', async () => {
  const missing = await page.evaluate(async () => (await import('./js/roadmap.js')).RUBRIQUES.flatMap(r => r.sous.filter(s => !s.route).map(s => `${r.id}/${s.id}`)));
  eq(missing.length, 0, `sous-pages sans page réelle : ${missing.join(', ')}`);
  await go('#/avenir/familles/messages'); await page.waitForTimeout(300);
  eq(await page.getByTestId('placeholder').count(), 0, 'l’ancienne adresse mène à la vraie page');
  assert(await page.evaluate(() => location.hash.startsWith('#/messages')), 'redirigé vers Messages');
});

await test('Export CSV de la liste d’élèves', async () => {
  await go('#/eleves');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-csv').click()]);
  const txt = readFileSync(await dl.path(), 'utf8');
  assert(txt.startsWith('﻿Nom;Prénom;Niveau'), 'en-tête CSV');
  assert(txt.includes('Testeuse;Zoé;CE2;04/05/2018'), txt);
});

await test('Impression : aperçu A4 et PDF long paginé avec en-têtes répétés', async () => {
  // 45 élèves fictifs supplémentaires pour un document de plusieurs pages.
  await page.evaluate(async () => {
    const store = await import('./js/store.js'); const model = await import('./js/model.js');
    const cls = model.currentClass(); const items = [];
    for (let i = 0; i < 45; i++) { const id = store.uid(); items.push({ create: { type: 'student', data: { id, firstName: `Prénom${i}`, lastName: `Long${String(i).padStart(2, '0')}`, contacts: [] } } }, { create: { type: 'enrollment', data: { studentId: id, classId: cls.id, level: 'CE2', start: '2026-09-01', end: null } } }); }
    await store.batch(items, 'test pagination');
  });
  await go('#/eleves');
  await page.getByTestId('print-list').click();
  eq(await page.locator('.a4-preview tbody tr').count(), 48, 'lignes de l’aperçu');
  await page.locator('.modal input[placeholder^="ex. Cahier"]').fill('Cahier rendu, Mot signé');
  await page.evaluate(() => { window.print = () => {}; });
  await modalBtn('Imprimer / PDF').click();
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ preferCSSPageSize: true });
  writeFileSync(`${OUT}liste-longue.pdf`, pdf);
  const doc = await PDFDocument.load(pdf);
  const n = doc.getPageCount();
  const { width, height } = doc.getPage(0).getSize();
  assert(n >= 2, `pages : ${n}`);
  assert(Math.abs(width - 595.3) < 2 && Math.abs(height - 841.9) < 2, `format ${width}×${height} ≠ A4`);
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => { document.body.classList.remove('printing'); document.getElementById('print-root').replaceChildren(); });
  await modalBtn('Fermer').click();
  await page.evaluate(async () => (await import('./js/store.js')).undo());
  await page.waitForTimeout(150);
  eq(await count('student'), 3, 'élèves de test retirés');
});

await test('Fermer/rouvrir : données conservées', async () => {
  await page.reload(); await ready();
  eq(await count('student'), 3, 'élèves après rechargement');
  eq(await count('file'), 4, 'fichiers après rechargement');
  eq(await page.locator('[data-testid=class-select] option:checked').innerText(), 'CE2 Essai', 'classe sélectionnée conservée');
});

let backupPath;
await test('Sauvegarde exportée, tout effacé, puis restaurée et vérifiée', async () => {
  await go('#/reglages/sauvegarde');
  const before = await page.evaluate(async () => { const s = await import('./js/store.js'); const f = s.all('file').find(x => x.name === 'tableau.png'); const b = await s.getBlob(f.versions[0].blobId); return { n: s.count(), size: b.size }; });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-backup').click()]);
  backupPath = `${OUT}sauvegarde.json`;
  await dl.saveAs(backupPath);
  await page.getByRole('button', { name: 'Tout effacer…' }).click();
  await modalBtn('Continuer').click();
  await modalBtn('Tout effacer définitivement').click();
  await page.waitForTimeout(300);
  eq(await count('student'), 0, 'données effacées');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('restore-backup').click()]);
  await chooser.setFiles(backupPath);
  await modalBtn('Remplacer et restaurer').click();
  await page.waitForTimeout(500);
  assert((await toastText()).includes('Restauration vérifiée'), await toastText());
  const after = await page.evaluate(async () => { const s = await import('./js/store.js'); const f = s.all('file').find(x => x.name === 'tableau.png'); const b = await s.getBlob(f.versions[0].blobId); return { n: s.count(), size: b.size }; });
  eq(after.n, before.n, 'nombre d’éléments');
  eq(after.size, before.size, 'taille du fichier image restauré');
  eq(await count('student'), 3, 'élèves restaurés');
});

await test('Sauvegarde altérée : restauration refusée', async () => {
  const obj = JSON.parse(readFileSync(backupPath, 'utf8'));
  obj.dataJson = obj.dataJson.replace('Testeuse', 'Pirate');
  const bad = `${OUT}sauvegarde-alteree.json`;
  writeFileSync(bad, JSON.stringify(obj));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('restore-backup').click()]);
  await chooser.setFiles(bad);
  assert((await page.locator('.modal').innerText()).includes('altérée'), 'altération non détectée');
  await modalBtn('Fermer').click();
});

await test('Historique : modifications datées avec auteur', async () => {
  await go('#/reglages/historique');
  const t = await page.getByTestId('audit-table').innerText();
  assert(t.includes('Utilisatrice') && t.includes('Départ de Zoé Testeuse'), 'historique incomplet');
});

await test('Données de démonstration : chargées puis retirées sans toucher aux vraies', async () => {
  await go('#/reglages/demo');
  await page.getByTestId('load-demo').click();
  await page.waitForTimeout(300);
  eq(await count('student'), 21, 'élèves avec démo (3 + 12 + 6)');
  assert((await page.locator('#sidebar').innerText()).includes('Données fictives'), 'avertissement démo absent');
  await go('#/eleves');
  assert((await page.locator('[data-testid=students-table]').innerText()).includes('Démo'), 'badge démo absent');
  await go('#/reglages/demo');
  await page.getByTestId('remove-demo').click();
  await modalBtn('Retirer').click();
  await page.waitForTimeout(300);
  eq(await count('student'), 3, 'vraies données conservées');
  eq(await count('year'), 1, 'année conservée');
});

await test('Hors connexion : l’application se recharge sans réseau', async () => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await ready();
  await ctx.setOffline(true);
  await page.reload(); await ready();
  eq(await count('student'), 3, 'données hors connexion');
  await ctx.setOffline(false);
});

await test('Téléphone : barre du bas, pas de défilement horizontal', async () => {
  const m = await browser.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
  const mp = await m.newPage();
  await mp.goto(BASE); await mp.waitForFunction(() => window.__classeurReady);
  // Ce contexte a son propre stockage : on charge la démo pour avoir du contenu.
  await mp.evaluate(async () => (await import('./js/demo.js')).loadDemo());
  for (const hsh of ['#/aujourdhui', '#/eleves', '#/fichiers', '#/reception', '#/plus', '#/reglages/sauvegarde', '#/reglages/annees', '#/avenir/organisation/reunions']) {
    await mp.evaluate(h => { location.hash = h; }, hsh); await mp.waitForTimeout(200);
    const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(over <= 1, `${hsh} déborde de ${over}px`);
  }
  assert(await mp.locator('#bottomnav').isVisible(), 'barre du bas invisible');
  assert(!(await mp.locator('#sidebar').isVisible()), 'barre latérale visible sur téléphone');
  await mp.evaluate(h => { location.hash = h; }, '#/eleves'); await mp.waitForTimeout(200);
  await mp.screenshot({ path: `${OUT}mobile-eleves.png` });
  await mp.evaluate(h => { location.hash = h; }, '#/aujourdhui'); await mp.waitForTimeout(200);
  await mp.screenshot({ path: `${OUT}mobile-aujourdhui.png` });
  await m.close();
});

await test('Aucune erreur JavaScript pendant les tests', async () => {
  eq(errors.length, 0, errors.join(' | '));
});

await go('#/eleves'); await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}ordinateur-eleves.png` });
await go('#/fichiers'); await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}ordinateur-fichiers.png` });

await browser.close();
const summary = `\n${passed} réussi(s), ${failed} échoué(s)`;
console.log(summary);
writeFileSync(`${OUT}resultats.txt`, results.join('\n') + summary + '\n');
process.exit(failed ? 1 : 0);
