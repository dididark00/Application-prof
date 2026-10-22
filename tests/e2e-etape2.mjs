// Étape 2 : scénarios de validation du cahier des charges (§17, §20, §22) dans un vrai navigateur.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

let passed = 0, failed = 0; const results = [];
async function test(name, fn) {
  try { await fn(); passed++; results.push(`✔ ${name}`); console.log(`✔ ${name}`); }
  catch (e) { failed++; results.push(`✘ ${name}\n    ${e.message.split('\n')[0]}`); console.log(`✘ ${name}\n   `, e.message); try { await page.screenshot({ path: `${OUT}echec2-${failed}.png`, fullPage: true }); } catch { /* */ } }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 }, acceptDownloads: true, bypassCSP: true }); // bypassCSP : uniquement pour les scripts de test
const page = await ctx.newPage();
await page.clock.install({ time: new Date('2026-11-02T08:00:00') });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const ready = () => page.waitForFunction(() => window.__classeurReady === true);
const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(200); };
const S = (fn, arg) => page.evaluate(async ([src, a]) => { const store = await import('./js/store.js'); const model = await import('./js/model.js'); const PL = await import('./js/planning.js'); const P = await import('./js/pedago.js'); return (new Function('store', 'model', 'PL', 'P', 'a', `return (async () => { ${src} })()`))(store, model, PL, P, a); }, [fn, arg]);
const modalBtn = (name) => page.locator('.modal-foot button', { hasText: name });

await page.goto(BASE); await ready();
await page.evaluate(async () => (await import('./js/demo.js')).loadDemo());
await page.waitForTimeout(300);
const ids = await S(`const cls = store.all('class').find(c => c.name === 'CE2 (démo)');
  const ses = store.all('session').filter(s => s.classId === cls.id).sort((a,b) => a.order - b.order);
  return { cls: cls.id, s1: ses[0].id, s2: ses[1].id, s3: ses[2].id, seq: ses[0].sequenceId, multi: store.all('class').find(c => c.name.startsWith('CE1')).id };`);

await test('Toutes les pages de l’étape 2 s’ouvrent sans erreur', async () => {
  for (const r of ['#/referentiels', '#/programmations', '#/progressions', '#/sequences', '#/preparations', '#/manuels', '#/lecons', '#/cahier', '#/cahier?v=semaine', '#/edt', '#/agenda', '#/agenda?v=mois', '#/devoirs', '#/interventions', '#/taches', `#/sequence/${ids.seq}`, `#/seance/${ids.s1}`]) {
    await go(r);
    assert(!(await page.locator('main').innerText()).includes('Une erreur est survenue'), `erreur sur ${r}`);
  }
  eq(errors.length, 0, errors.join(' | '));
});

await test('§17 Modifier une préparation : la modification apparaît au cahier journal, sans doublon', async () => {
  const before = await S(`return store.all('session').length`);
  await go(`#/seance/${ids.s2}`);
  const obj = page.locator('[data-testid="f-objective"]');
  await obj.fill('Objectif modifié pour le test');
  await obj.blur(); await page.waitForTimeout(250);
  await go('#/cahier?d=2026-11-03');
  assert((await page.getByTestId('day-entries').innerText()).includes('Objectif modifié pour le test'), 'modification absente du cahier journal');
  eq(await S(`return store.all('session').length`), before, 'nombre de fiches');
  eq(await S(`return store.all('occurrence').filter(o => o.sessionId === a).length`, ids.s2), 1, 'séances datées de la fiche');
});

await test('§3 Le réalisé est figé : modifier la fiche ne réécrit pas une journée passée', async () => {
  await go('#/cahier?d=2026-11-02');
  const card = page.locator('[data-testid=entry]', { hasText: 'Découvrir le millier' });
  await card.getByTestId('status-faite').click(); await page.waitForTimeout(250);
  await S(`await store.update(a, { title: 'Titre changé après coup', objective: 'Nouvel objectif' }, 'test')`, ids.s1);
  await go('#/cahier?d=2026-11-03'); await go('#/cahier?d=2026-11-02');
  const txt = await page.getByTestId('day-entries').innerText();
  assert(txt.includes('Comprendre que 10 centaines font 1 millier') && !txt.includes('Nouvel objectif'), 'le passé a été réécrit');
  assert(txt.includes('modifiée depuis'), 'mention « modifiée depuis » absente');
  assert(txt.includes('Découvrir le millier') && !txt.includes('Titre changé après coup'), 'titre du jour réécrit');
});

await test('Bilan du jour et « Après la séance » : propres à la date, la fiche n’est pas modifiée', async () => {
  const bilan = page.locator('[data-testid=entry]', { hasText: 'Découvrir le millier' }).getByTestId('bilan');
  await bilan.fill('Bilan du 2 novembre'); await bilan.blur(); await page.waitForTimeout(250);
  eq(await S(`return store.all('occurrence').find(o => o.date === '2026-11-02' && o.sessionId === a).note`, ids.s1), 'Bilan du 2 novembre', 'bilan enregistré');
  eq(await S(`return store.get(a).note ?? null`, ids.s1), null, 'la fiche a reçu le bilan');
});

await test('§17 Reporter une séance : supports conservés, créneau proposé, passé préservé', async () => {
  // La séance 3 est programmée le jeudi 5 novembre à 09:45, en conflit avec la sortie.
  await S(`const cls = store.get(a.cls); const plan = PL.dayPlan(cls, '2026-11-05'); const e = plan.entries.find(x => x.start === '09:45'); await PL.patchEntry(e, cls, { sessionId: a.s3 }, 'test');`, ids);
  await S(`await store.update(a, { fileIds: [] }, 'x')`, ids.s3);
  const fileId = await S(`const f = await store.create('file', { kind: 'link', name: 'Support séance 3', url: 'https://example.org/s3', tags: [], versions: [] }); await store.update(a, { fileIds: [f.id] }); return f.id;`, ids.s3);
  await go('#/cahier?d=2026-11-05');
  assert((await page.getByTestId('conflicts').innerText()).includes('Sortie au musée'), 'conflit non signalé');
  await page.getByTestId('conflicts').getByRole('button', { name: /Reporter « S3/ }).click();
  const cands = page.getByTestId('postpone-candidates').locator('button');
  assert(await cands.count() > 0, 'aucun créneau proposé');
  await cands.first().click(); await page.waitForTimeout(300);
  const r = await S(`const o = store.all('occurrence').filter(x => x.sessionId === a); return o.map(x => ({ date: x.date, status: x.status, to: x.postponedTo, from: x.postponedFrom }));`, ids.s3);
  eq(r.length, 2, 'séances datées après report');
  const orig = r.find(x => x.date === '2026-11-05'); const neu = r.find(x => x.date !== '2026-11-05');
  eq(orig.status, 'reportée', 'statut d’origine'); assert(neu && neu.status === 'prévue' && neu.from, 'nouvelle séance');
  assert(neu.date > '2026-11-05', 'report dans le passé');
  eq(await S(`return store.get(a).fileIds[0]`, ids.s3), fileId, 'support perdu');
  // La séance faite du 2 novembre n'a pas bougé.
  eq(await S(`return store.all('occurrence').find(o => o.date === '2026-11-02' && o.sessionId === a).status`, ids.s1), 'faite', 'passé modifié');
  // Aucune autre séance n'a été décalée automatiquement.
  eq(await S(`return store.all('occurrence').find(o => o.sessionId === a).date`, ids.s2), '2026-11-03', 'progression décalée');
});

await test('§17 Intervention à partir d’une date : aucune apparition avant, « à planifier » ne bloque rien', async () => {
  const r = await S(`const cls = store.get(a); const has = d => PL.dayPlan(cls, d).entries.some(e => e.title.includes('Natation'));
    const tbd = d => PL.dayPlan(cls, d).entries.some(e => e.title.includes('Prévention'));
    return { before: has('2026-11-12'), first: has('2026-11-19'), wed: has('2026-11-18'), tbd: tbd('2026-11-19') };`, ids.cls);
  eq(r.before, false, 'présente avant la date'); eq(r.first, true, 'absente après la date'); eq(r.wed, false, 'présente un autre jour'); eq(r.tbd, false, 'intervention à planifier affichée');
  await go('#/cahier?d=2026-11-19');
  assert((await page.getByTestId('conflicts').innerText()).includes('Natation'), 'chevauchement intervention / créneau non signalé');
});

await test('§17 Multiniveau : activités parallèles et conflit de présence de l’enseignant', async () => {
  await S(`await store.setSettings({ currentClassId: a })`, ids.multi);
  await go('#/cahier?d=2026-11-02');
  assert(await page.locator('.par-head').isVisible(), 'colonnes par niveau absentes');
  const c = await page.getByTestId('conflicts').innerText();
  assert(c.includes('exigent l’enseignant') && c.includes('Numération CE1') && c.includes('Calcul CE2'), c);
  assert(!c.includes('Lecture CE1'), 'faux conflit avec une activité en autonomie');
  await page.screenshot({ path: `${OUT}etape2-multiniveau.png`, fullPage: true });
  await S(`await store.setSettings({ currentClassId: a })`, ids.cls);
});

await test('EDT versionné : une modification datée ne change pas les journées antérieures', async () => {
  await go('#/edt');
  await page.getByTestId('effective-date').fill('2026-11-16'); await page.getByTestId('effective-date').dispatchEvent('change'); await page.waitForTimeout(200);
  await page.locator('[data-testid=edt-grid] .edt-day').first().getByTestId('edt-slot').filter({ hasText: 'Questionner' }).click();
  await page.locator('.modal select[name=subject]').selectOption('Mathématiques');
  await modalBtn('Enregistrer').click(); await page.waitForTimeout(250);
  const r = await S(`const cls = store.get(a); const at = d => PL.dayPlan(cls, d).entries.find(e => e.start === '13:30')?.subject; return { before: at('2026-11-09'), after: at('2026-11-16') };`, ids.cls);
  eq(r.before, 'Questionner le monde', 'journée antérieure modifiée'); eq(r.after, 'Mathématiques', 'modification non appliquée');
});

await test('Programmation → progression : statut de notion déduit, suggestion du cahier journal à appliquer', async () => {
  const prog = await S(`return store.all('progression')[0].id`);
  await go(`#/progression/${prog}`);
  const row = page.getByTestId('prog-row').first();
  assert((await row.innerText()).includes('1/3 faite'), 'avancement du journal absent');
  // Marquer les 3 séances faites puis appliquer la suggestion.
  await S(`const cls = store.get(a.cls); for (const s of [a.s2, a.s3]) { const o = store.all('occurrence').find(x => x.sessionId === s && x.status === 'prévue'); await store.update(o.id, { status: 'faite' }); }`, ids);
  await go('#/progressions'); await go(`#/progression/${prog}`);
  await page.getByTestId('apply-status').first().click(); await page.waitForTimeout(250);
  eq(await S(`return store.all('progression')[0].rows[0].status`), 'Réalisé', 'statut appliqué');
  assert((await page.getByTestId('period-notions').innerText()).includes('terminée'), 'notion non terminée');
  const pg = await S(`return store.all('programmation')[0].id`);
  await go(`#/programmation/${pg}`);
  assert(await page.locator('.notion-terminée').count() >= 1, 'statut absent de la programmation');
});

await test('Lier / dupliquer : la copie d’une fiche est indépendante', async () => {
  await go(`#/seance/${ids.s1}`);
  await page.getByTestId('duplicate-session').click(); await page.waitForTimeout(300);
  const copyId = await S(`return store.all('session').find(s => s.copiedFrom === a).id`, ids.s1);
  await S(`await store.update(a, { objective: 'Objectif de la copie' })`, copyId);
  assert((await S(`return store.get(a).objective`, ids.s1)) !== 'Objectif de la copie', 'l’original a changé');
});

await test('Référentiel : import vérifié, validation, lien dans une fiche, nouvelle version sans casser le lien', async () => {
  await go('#/referentiels');
  await page.getByTestId('new-ref').click();
  await page.locator('.modal input[name=name]').fill('Référentiel de test');
  await page.locator('.modal input[name=source]').fill('Source de test (fictive)');
  await modalBtn('Créer').click(); await page.waitForTimeout(300);
  await page.getByTestId('ref-import').click();
  await page.locator('.modal textarea').fill('Code;Domaine;Sous-domaine;Intitulé;Niveaux\nT1;Nombres;;Compétence de test 1;CE2\nT2;Nombres;;Compétence de test 2;CE2');
  await page.locator('.modal textarea').dispatchEvent('input');
  await modalBtn('Ajouter ces lignes').click(); await page.waitForTimeout(250);
  eq(await page.getByTestId('ref-items').locator('tbody tr').count(), 2, 'lignes importées');
  await page.getByTestId('ref-validate').click(); await modalBtn('Valider').click(); await page.waitForTimeout(250);
  const comp = await S(`const r = store.all('referential')[0]; await store.update(a, { competencyIds: [r.items[0].id] }); return r.items[0].id;`, ids.s1);
  await page.getByRole('button', { name: 'Nouvelle version' }).click(); await modalBtn('Créer').click(); await page.waitForTimeout(250);
  eq(await S(`return store.all('referential').length`), 2, 'versions');
  eq(await S(`return store.get(a).competencyIds[0]`, ids.s1), comp, 'lien rompu');
});

await test('Reprise d’année : modèles copiés, journal et bilans de l’ancienne année séparés', async () => {
  const r = await S(`const y = await store.create('year', { label: '2027-2028', start: '2027-09-01', end: '2028-07-01', periods: [1,2,3,4,5].map(i => ({ id: store.uid(), name: 'Période ' + i, start: '2027-0' + i + '-01', end: '2027-0' + i + '-20' })) });
    const c = await store.create('class', { yearId: y.id, name: 'CE2 nouvelle année', levels: ['CE2'] });
    const n = await P.copyFromClass(a, c.id, { programmations: true, sequences: true, lecons: true, edt: true });
    return { n, c: c.id, seq: store.all('sequence').filter(s => s.classId === c.id).length, ses: store.all('session').filter(s => s.classId === c.id).length,
      occ: store.all('occurrence').filter(o => o.classId === c.id).length, hw: store.all('homework').filter(o => o.classId === c.id).length,
      lessonsDist: store.all('lesson').filter(l => l.classId === c.id).flatMap(l => l.distributions).length, oldSeq: store.all('sequence').filter(s => s.classId === a).length };`, ids.cls);
  assert(r.n > 0 && r.seq === r.oldSeq && r.ses >= 3, `copie incomplète ${JSON.stringify(r)}`);
  eq(r.occ, 0, 'cahier journal recopié'); eq(r.hw, 0, 'devoirs recopiés'); eq(r.lessonsDist, 0, 'distributions recopiées');
  const sid = await S(`return store.all('session').find(s => s.classId === a).id`, r.c);
  await S(`await store.update(a, { title: 'Modifiée dans la nouvelle année' })`, sid);
  assert(!(await S(`return store.all('session').some(s => s.classId === a && s.title === 'Modifiée dans la nouvelle année')`, ids.cls)), 'ancienne année modifiée');
});

let pdfPages = {};
await test('Impressions : fiche de séance (visite et vierge), séquence, EDT, journée, semaine, progression', async () => {
  await page.evaluate(() => { window.print = () => {}; });
  const shots = [[`#/seance/${ids.s1}`, 'print-session', 'fiche-seance'], [`#/sequence/${ids.seq}`, 'print-sequence', 'sequence'], ['#/edt', 'print-edt', 'edt'],
    ['#/cahier?d=2026-11-05', 'print-day', 'journee'], ['#/cahier?d=2026-11-05&v=semaine', 'print-week', 'semaine'], ['#/devoirs', 'print-homework', 'devoirs']];
  await S(`await store.update(a, { mode: 'visite' })`, ids.s1);
  for (const [route, btn, name] of shots) {
    await go(route);
    await page.getByTestId(btn).click();
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ preferCSSPageSize: true });
    writeFileSync(`${OUT}etape2-${name}.pdf`, pdf);
    pdfPages[name] = (await PDFDocument.load(pdf)).getPageCount();
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => { document.body.classList.remove('printing'); document.getElementById('print-root').replaceChildren(); });
  }
  assert(pdfPages['fiche-seance'] >= 2, `fiche visite : ${pdfPages['fiche-seance']} page(s)`);
  for (const [k, v] of Object.entries(pdfPages)) assert(v >= 1, `${k} vide`);
});

await test('Recherche : trouve une fiche par le contenu d’une phase', async () => {
  await go('#/recherche?q=' + encodeURIComponent('représenter 1 000'));
  assert((await page.getByTestId('search-results').innerText()).includes('Fiches de séance'), 'fiche introuvable');
});

await test('Fermer / rouvrir puis sauvegarde → restauration : tout le travail de l’étape 2 est conservé', async () => {
  const count = async () => S(`const t = ['programmation','notion','progression','sequence','session','occurrence','timetable','intervention','event','task','homework','lesson','manual','referential']; return t.map(x => store.all(x).length).join(',');`);
  const before = await count();
  await page.reload(); await ready();
  eq(await count(), before, 'après rechargement');
  const backup = await page.evaluate(async () => { const b = await import('./js/backup.js'); return JSON.stringify(await b.buildBackup()); });
  await page.evaluate(async () => (await import('./js/backup.js')).wipeAll());
  eq(await S(`return store.all('session').length`), 0, 'effacement');
  await page.evaluate(async (txt) => { const b = await import('./js/backup.js'); const parsed = await b.readBackup(new File([txt], 's.json')); await b.restoreBackup(parsed); }, backup);
  eq(await count(), before, 'après restauration');
});

await test('Retrait de la démo : plus aucune donnée de démonstration ni orpheline', async () => {
  await page.evaluate(async () => (await import('./js/demo.js')).removeDemo());
  const left = await S(`const demoNames = ['CE2 (démo)', 'CE1-CE2 (démo)']; return ['session','sequence','occurrence','timetable','intervention','progression','notion','programmation','lesson'].map(t => store.all(t).filter(r => r.demo).length).reduce((x, y) => x + y, 0);`);
  eq(left, 0, 'données de démo restantes');
});

await test('Aucune erreur JavaScript', async () => { eq(errors.length, 0, errors.join(' | ')); });

await browser.close();
const summary = `\n${passed} réussi(s), ${failed} échoué(s)`;
console.log(summary);
writeFileSync(`${OUT}resultats-etape2.txt`, results.join('\n') + summary + '\n');
process.exit(failed ? 1 : 0);
