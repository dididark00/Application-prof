// Où j'en suis (avancement dans les programmes) et cahier journal prérempli jusqu'aux vacances.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let passed = 0, failed = 0; const results = [];
let page;
async function test(name, fn) {
  try { await fn(); passed++; results.push(`✔ ${name}`); console.log(`✔ ${name}`); }
  catch (e) { failed++; results.push(`✘ ${name}\n    ${e.message.split('\n')[0]}`); console.log(`✘ ${name}\n   `, e.message); try { await page.screenshot({ path: `${OUT}echec-avancement-${failed}.png`, fullPage: true }); } catch { /* */ } }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 }, bypassCSP: true });
page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const modalBtn = (name) => page.locator('.modal').getByRole('button', { name, exact: true });
const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(350); };
const S = (fn, arg) => page.evaluate(async ([src, a]) => {
  const m = { store: await import('./js/store.js'), model: await import('./js/model.js'), P: await import('./js/pedago.js'), A: await import('./js/avancement.js'), CP: await import('./js/cahier-plus.js') };
  return (new Function(...Object.keys(m), 'a', `return (async () => { ${src} })()`))(...Object.values(m), a);
}, [fn, arg]);

await page.goto(BASE); await page.waitForFunction(() => window.__classeurReady === true);
await page.evaluate(async () => (await import('./js/demo.js')).loadDemo());
await page.waitForTimeout(400);
const ids = await S(`const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentClassId: cls.id });
  const ps = model.periodsOf(store.get(cls.yearId));
  const seq = P.ofClass('sequence', cls.id).find(s => s.periodId === ps[1].id);
  return { cls: cls.id, p1: ps[0].id, p2: ps[1].id, seq: seq.id, sessions: P.sessionsOfSequence(seq.id).map(s => s.id) };`);

await test('Page « Où j’en suis » : calendrier, disciplines, compétences, suggestions', async () => {
  await go(`#/avancement?p=${ids.p2}`);
  assert(await page.getByTestId('av-calendar').isVisible(), 'calendrier de la période');
  const maths = page.getByTestId('av-subject').filter({ hasText: 'Mathématiques' });
  assert(await maths.count() === 1, 'carte Mathématiques');
  eq(await maths.getByTestId('av-score').innerText(), '0 %', 'rien de fait au départ');
  assert(await page.getByTestId('av-suggestions').isVisible(), 'suggestions');
  assert((await page.getByTestId('av-sugg').allInnerTexts()).some(t => t.includes('pas encore placée')), 'séances de la séquence pas encore placées');
  assert(await page.locator('nav, .sidebar, #nav').first().innerText().then(t => t.includes('Où j’en suis')).catch(() => true), 'lien dans la navigation');
});

await test('Séances marquées « faite » au cahier journal : le pourcentage avance', async () => {
  const n = ids.sessions.length;
  await S(`for (const [i, sid] of a.sessions.slice(0, 1).entries()) await store.create('occurrence', { classId: a.cls, date: '2026-11-03', start: '09:00', end: '10:00', subject: 'Mathématiques', levels: [], mode: 'dirigé', status: 'faite', sessionId: sid }, 'x');`, ids);
  await go(`#/avancement?p=${ids.p2}`);
  const g = await S(`return A.bySubject(store.get(a.cls), model.periodsOf(store.get(store.get(a.cls).yearId))[1], '2026-11-20').find(x => x.subject === 'Mathématiques');`, ids);
  eq(g.sessions.done, 1, '1 séance faite'); eq(g.basis, 'séances faites', 'base du calcul');
  assert(Math.abs(g.score - 1 / n) < 0.01, `score = 1/${n}`);
  eq(g.minutes, 60, '1 h faite dans la période');
  assert(g.pace && g.pace.label, 'rythme indiqué');
});

await test('Notions des périodes passées non terminées signalées', async () => {
  const s = await S(`return A.suggestions(store.get(a.cls), model.periodsOf(store.get(store.get(a.cls).yearId))[1], '2026-11-20').map(x => x.text);`, ids);
  assert(s.some(t => t.includes('périodes précédentes non terminée')), s.join(' | '));
});

await test('Compétences : travaillée seulement quand une séance reliée est faite', async () => {
  await S(`const r = await store.create('referential', { name: 'Référentiel test (exemple)', version: '1', levels: ['CE2'], status: 'validé', items: [{ id: 'cA', code: 'A1', label: 'Compétence A (exemple)' }, { id: 'cB', code: 'B1', label: 'Compétence B (exemple)' }] }, 'r');
    await store.update(a.sessions[0], { competencyIds: ['cA'] }, 'x'); await store.update(a.sessions[1] || a.sessions[0], { competencyIds: ['cA', 'cB'] }, 'x');
    await store.update(a.sessions[0], { competencyIds: ['cA'] }, 'x'); return r.id;`, ids);
  const c = await S(`return A.competencies(store.get(a.cls)).find(x => x.ref.name.startsWith('Référentiel test'));`, ids);
  eq(c.total, 2, '2 compétences'); eq(c.worked, 1, 'A travaillée (séance faite)'); eq(c.never.length, 1, 'B pas encore travaillée');
  eq(c.never[0].linked, ids.sessions.length > 1, 'B reliée à une séance non faite');
  await go(`#/avancement?p=${ids.p2}`);
  assert((await page.getByTestId('av-comps').innerText()).includes('1 / 2'), 'affiché 1 / 2');
});

await test('Cahier journal : bandeau « semaine pas encore préparée » puis préparation jusqu’aux vacances sans doublon', async () => {
  const before = await S(`return store.all('occurrence').filter(x => x.classId === a.cls && x.sessionId && !['annulée', 'reportée'].includes(x.status)).map(x => x.id + '|' + x.sessionId);`, ids);
  await go('#/cahier?d=2026-11-02');
  const banner = page.getByTestId('prepare-banner');
  assert(await banner.count() === 1, 'bandeau présent');
  await page.getByTestId('prepare-banner-go').click();
  await page.getByTestId('prefill-span').selectOption('vacances'); await page.waitForTimeout(200);
  assert(await page.getByTestId('prefill-list').locator('tr').count() >= 1, 'propositions');
  await page.getByTestId('prefill-apply').click(); await page.waitForTimeout(400);
  const r = await S(`const old = new Set(a.before.map(x => x.split('|')[0])), oldS = new Set(a.before.map(x => x.split('|')[1]));
    const fresh = store.all('occurrence').filter(x => x.classId === a.cls && x.sessionId && !old.has(x.id));
    const hab = new Set(Object.values(store.get(a.cls).habitual || {}));
    const prog = fresh.filter(x => !hab.has(x.sessionId)).map(x => x.sessionId);
    return { n: fresh.length, dup: prog.length - new Set(prog).size, reused: prog.filter(id => oldS.has(id)).length, weeks: Object.keys(store.get(a.cls).weekMode || {}).length };`, { ...ids, before });
  assert(r.n >= 1, 'séances posées'); eq(r.dup, 0, 'aucune séance de progression proposée deux fois'); eq(r.reused, 0, 'aucune séance déjà placée reproposée');
  assert(r.weeks >= 1, 'semaines marquées préparées');
  await go('#/cahier?d=2026-11-02');
  eq(await page.getByTestId('prepare-banner').count(), 0, 'plus de bandeau une fois préparée');
});

await test('Import d’un emploi du temps CSV : nouvel EDT, jours et heures lus, erreurs signalées, rien d’écrasé', async () => {
  const before = await S(`return store.all('timetable').filter(t => t.classId === a.cls).map(t => t.id);`, ids);
  await go('#/importer?k=edt');
  await page.getByTestId('import-text').fill('Jour;Début;Fin;Discipline;Intitulé;Niveaux;Mode\nLundi;8h30;9h00;Français;Rituels;;rituel\nmardi;09:00;10:00;Maths;Calcul;CE2;dirigé\nDimanche;09:00;10:00;EPS;;;\nJeudi;10:00;09:00;EPS;;;');
  await page.waitForTimeout(200);
  assert((await page.getByTestId('import-errors').innerText()).includes('jour illisible'), 'jour illisible signalé');
  await page.getByTestId('import-go').click(); await page.waitForTimeout(400);
  const t = await S(`const tts = store.all('timetable').filter(t => t.classId === a.cls); const n = tts.find(t => !a.before.includes(t.id)); return { count: tts.length, old: a.before.every(id => store.get(id) && !store.get(id).deletedAt), slots: n.versions[0].slots, periods: n.periodIds.length };`, { ...ids, before });
  eq(t.count, before.length + 1, 'un EDT de plus'); assert(t.old, 'EDT existant intact');
  eq(t.slots.length, 2, '2 créneaux valides');
  eq(JSON.stringify(t.slots.map(s => [s.day, s.start, s.end, s.subject, s.mode, s.levels.join()])), JSON.stringify([[1, '08:30', '09:00', 'Français', 'rituel', ''], [2, '09:00', '10:00', 'Mathématiques', 'dirigé', 'CE2']]), 'créneaux lus');
  eq(t.periods, 0, 'toutes les périodes avaient déjà un EDT : à associer');
});

await test('Ergonomie : premiers pas, « Pour la suite », menu Plus filtrable et repliable', async () => {
  await go('#/aujourdhui');
  assert(await page.getByTestId('first-steps').count() === 1, 'premiers pas affichés');
  assert((await page.getByTestId('first-steps').innerText()).includes('Année scolaire'), 'étapes');
  await page.getByTestId('first-steps-hide').click(); await page.waitForTimeout(300);
  eq(await page.getByTestId('first-steps').count(), 0, 'masqués');
  await go('#/plus');
  const all = await page.getByTestId('more-group').count();
  await page.getByTestId('more-filter').fill('registre'); await page.waitForTimeout(150);
  eq(await page.getByTestId('more-group').count(), 2, 'deux rubriques contiennent « registre »'); assert(await page.getByTestId('more-sections').locator('li').count() === 2, 'deux pages');
  assert((await page.getByTestId('more-sections').innerText()).includes('Registre d’appel'), 'lien Registre');
  await page.getByTestId('more-filter').fill(''); await page.waitForTimeout(150);
  eq(await page.getByTestId('more-group').count(), all, 'toutes les rubriques reviennent');
  assert(await page.getByTestId('more-top').count() === 1, 'pages les plus utilisées');
});

await test('Import EDT par période avec changement daté, progression par sous-domaine, déroulé des séances', async () => {
  const r = await S(`const IC = await import('./js/importcsv.js'); const PL = await import('./js/planning.js');
    const y = await store.create('year', { label: 'Test', start: '2026-09-01', end: '2027-07-02', periods: [{ id: 'q1', name: 'P1', start: '2026-09-01', end: '2026-10-16' }, { id: 'q2', name: 'P2', start: '2026-11-02', end: '2026-12-18' }], noSchoolDays: [] }, 'y');
    const cls = await store.create('class', { yearId: y.id, name: 'Test import (exemple)', levels: ['CE2'], classDays: [1, 2, 4, 5] }, 'c');
    const edt = 'Jour;Début;Fin;Discipline;Intitulé;Niveaux;Mode;Période;À partir du\\nLundi;09:00;10:00;Maths;Géométrie;;;P1-P2;\\nLundi;10:00;11:00;Maths;Calcul;;;P1-P2;\\nJeudi;13:30;15:00;EPS;Natation;;;P2;08/12/2026\\nLundi;09:00;10:00;Maths;Géométrie;;;P2;08/12/2026';
    const e = await IC.importRows('edt', IC.analyse('edt', edt, cls).rows, cls);
    const tts = PL.timetablesOf(cls.id);
    const prog = 'Discipline;Niveau;Période;Semaine;Séquence;Séance;Objectif;Support;Sous-domaine\\nMaths;CE2;P2;1;Calcul P2;Calcul 1;o;;Calcul\\nMaths;CE2;P2;1;Géométrie P2;Géo 1;o;;Géométrie';
    await IC.importRows('progression', IC.analyse('progression', prog, cls).rows, store.get(cls.id));
    const CP = await import('./js/cahier-plus.js');
    const props = CP.weekProposals(store.get(cls.id), '2026-11-02').map(x => x.entry.slot.label + '>' + store.get(x.sessionId).title);
    const seqs = 'Discipline;Niveau;Période;Séquence;N° séance;Séance;Objectif;Durée (min);Compétences;Déroulé;Matériel\\nQLM;CE2;P2;L’eau (exemple);1;Fondre (exemple);o;45;;5 min Mise en route : rappel | 20 min Recherche : observer des glaçons | 10 min Mise en commun : trace | 10 min Bilan : qu’avons-nous appris ?;glaçons';
    await IC.importRows('sequences', IC.analyse('sequences', seqs, cls).rows, store.get(cls.id));
    const ses = store.all('session').find(x => x.title === 'Fondre (exemple)');
    return { tts: tts.length, versions: tts[0].versions.map(v => v.from + ':' + v.slots.length), per: tts[0].periodIds.length, e, props,
      phases: ses.phases.map(p => p.kind + ':' + p.duration), consigne: ses.phases[1].consigne, materiel: ses.materiel,
      dec10: PL.dayPlan(store.get(cls.id), '2026-12-10').entries.map(x => x.title).join(), dec3: PL.dayPlan(store.get(cls.id), '2026-12-03').entries.length };`);
  eq(r.tts, 1, 'un seul EDT pour P1-P2'); eq(r.per, 2, 'posé sur 2 périodes'); eq(JSON.stringify(r.versions), JSON.stringify([':2', '2026-12-08:2']), 'version datée du 8 décembre');
  eq(r.dec10, 'Natation', 'à partir du 8 décembre : natation le jeudi'); eq(r.dec3, 0, 'avant : pas de créneau le jeudi');
  eq(JSON.stringify(r.props.sort()), JSON.stringify(['Calcul>Calcul 1', 'Géométrie>Géo 1']), 'chaque séance va dans le créneau de son sous-domaine');
  eq(JSON.stringify(r.phases), JSON.stringify(['rappel:5', 'recherche:20', 'institution:10', 'bilan:10']), 'phases du déroulé');
  eq(r.consigne, 'observer des glaçons', 'consigne de la phase'); eq(r.materiel, 'glaçons', 'matériel');
});

await test('Programmation puis progression importées séparément : notions reliées, état déduit du cahier journal', async () => {
  const r = await S(`const IC = await import('./js/importcsv.js');
    const cls = store.all('class').find(c => c.name === 'Test import (exemple)');
    const pg = 'Discipline;Niveau;Période;Sous-domaine;Notion;Compétences;Ressources\\nMaths;CE2;P2;Calcul;Addition posée (ex);;\\nMaths;CE2;P2;Nombres;Fractions (ex);;';
    await IC.importRows('programmation', IC.analyse('programmation', pg, cls).rows, cls);
    const pr = 'Discipline;Niveau;Période;Semaine;Séquence;Séance;Objectif;Support;Sous-domaine;Notions\\nMaths;CE2;P2;2;Addition posée (ex);Add 1 (ex);o;;Calcul;\\nMaths;CE2;P2;3;Partages (ex);Frac 1 (ex);o;;Nombres;Fractions (ex)';
    const rep = await IC.importRows('progression', IC.analyse('progression', pr, store.get(cls.id)).rows, store.get(cls.id));
    const prog = P.ofClass('programmation', cls.id).find(p => p.subject === 'Mathématiques');
    const ns = P.notionsOf(prog.id);
    const before = ns.map(n => P.notionStatus(n));
    const row = P.ofClass('progression', cls.id).flatMap(p => p.rows).find(x => store.get(x.sessionId)?.title === 'Add 1 (ex)');
    await store.update(P.ofClass('progression', cls.id).find(p => p.rows.some(x => x.id === row.id)).id, { rows: P.ofClass('progression', cls.id).find(p => p.rows.some(x => x.id === row.id)).rows.map(x => x.id === row.id ? { ...x, status: 'Réalisé' } : x) }, 'x');
    return { linked: rep.linked, n: ns.length, before, after: P.notionsOf(prog.id).map(n => n.title + ':' + P.notionStatus(n)), progLinked: !!P.ofClass('progression', cls.id).find(p => p.subdomain === 'Calcul').programmationId };`);
  eq(r.n, 2, '2 notions'); eq(r.linked, 2, 'deux lignes reliées à leur notion (par titre de séquence et par colonne Notions)');
  eq(JSON.stringify(r.before), JSON.stringify(['prévue', 'prévue']), 'au départ : prévues');
  assert(r.after.includes('Addition posée (ex):terminée'), r.after.join()); assert(r.progLinked, 'progression reliée à la programmation');
});

await test('Liens Drive, Docs, Slides, Canva : aperçu intégré ; messagerie académique', async () => {
  const e = await page.evaluate(async () => { const E = await import('./js/embeds.js'); return [
    'https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view?usp=sharing', 'https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/edit#slide=id.p',
    'https://www.canva.com/design/DAFabc123/AbCdEf123/view?utm_content=x', 'https://www.canva.com/design/DAFabc123/edit', 'https://exemple.fr/page'].map(u => E.embedOf(u)?.src || null); });
  eq(JSON.stringify(e), JSON.stringify(['https://drive.google.com/file/d/1AbCdEfGhIjKlMn/preview', 'https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/preview',
    'https://www.canva.com/design/DAFabc123/AbCdEf123/view?embed', 'https://www.canva.com/design/DAFabc123/view?embed', null]), 'liens d’aperçu');
  const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]').content);
  assert(csp.includes('https://www.canva.com') && csp.includes('https://drive.google.com'), 'cadres autorisés');
  await S(`await store.create('file', { kind: 'link', name: 'Diapo Canva (exemple)', url: 'https://www.canva.com/design/DAFabc123/AbCdEf123/view', tags: [] }, 'x');`);
  await go('#/fichiers');
  await page.getByTestId('link-preview').first().click(); await page.waitForTimeout(200);
  eq(await page.locator('.modal iframe.embed-frame').getAttribute('src'), 'https://www.canva.com/design/DAFabc123/AbCdEf123/view?embed', 'aperçu affiché');
  await page.keyboard.press('Escape');
  await go('#/reglages/general');
  await page.getByTestId('webmail-versailles').click(); await page.getByTestId('academic-mail').fill('prenom.nom@ac-versailles.fr');
  await page.locator('form.card.form button[type=submit]').click(); await page.waitForTimeout(300);
  eq(await S(`return store.getSettings().webmailUrl;`), 'https://messagerie.ac-versailles.fr/', 'messagerie enregistrée');
});

await test('EDT : plusieurs emplois du temps dans une période, lisibles et modifiables chacun', async () => {
  await S(`const cls = store.all('class').find(c => c.name === 'Test import (exemple)'); await store.setSettings({ currentYearId: cls.yearId, currentClassId: cls.id });`);
  await go('#/edt'); await page.getByTestId('edt-period-2').click(); await page.waitForTimeout(250);
  assert((await page.getByTestId('edt-period-2').innerText()).includes('2 EDT'), 'P2 annonce 2 EDT');
  const tabs = page.getByTestId('edt-version');
  eq(await tabs.count(), 2, 'deux onglets en P2');
  assert((await tabs.nth(0).innerText()).includes('Du 2 nov. au 7 déc.'), await tabs.nth(0).innerText());
  assert((await tabs.nth(1).innerText()).includes('Du 8 déc. au 18 déc.'), await tabs.nth(1).innerText());
  await tabs.nth(1).click(); await page.waitForTimeout(200);
  const jeudi = page.locator('[data-testid=edt-grid] .edt-day').nth(2);
  assert((await jeudi.innerText()).includes('Natation') && (await jeudi.locator('.edt-changed').count()) === 1, 'natation visible et marquée « changé »');
  await jeudi.getByTestId('edt-slot').first().click();
  await page.locator('.modal input[name=label]').fill('Natation (bassin)'); await modalBtn('Enregistrer').click(); await page.waitForTimeout(250);
  const r = await S(`const t = (await import('./js/planning.js')).timetablesOf(store.getSettings().currentClassId)[0]; return t.versions.map(v => (v.from || '') + ':' + v.slots.map(x => x.label).join('/'));`);
  eq(JSON.stringify(r), JSON.stringify([':Géométrie/Calcul', '2026-12-08:Natation (bassin)/Géométrie']), 'seule la version du 8 décembre est modifiée');
  await page.getByTestId('edt-add-change').click(); await page.getByTestId('edt-change-date').fill('2026-12-14'); await page.getByTestId('edt-change-name').fill('Sortie (exemple)');
  await page.getByTestId('edt-change-create').click(); await page.waitForTimeout(250);
  eq(await page.getByTestId('edt-version').count(), 3, 'trois EDT en P2 après le changement');
  assert((await page.getByTestId('edt-version').nth(2).innerText()).includes('Sortie (exemple)'), 'nom du changement');
});

await test('Téléphone : rien ne dépasse', async () => {
  await S(`const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentYearId: cls.yearId, currentClassId: cls.id });`);
  await page.setViewportSize({ width: 390, height: 844 });
  await go(`#/avancement?p=${ids.p2}`); await page.screenshot({ path: `${OUT}avancement-telephone.png`, fullPage: true });
  eq(await page.evaluate(() => document.documentElement.scrollWidth <= 392), true, 'largeur');
  await page.setViewportSize({ width: 1280, height: 900 });
  await go(`#/avancement?p=${ids.p2}`); await page.screenshot({ path: `${OUT}avancement.png`, fullPage: true });
});

await test('Aucune erreur dans la console', async () => { eq(errors.length, 0, errors.join(' | ')); });
await browser.close();
writeFileSync(`${OUT}resultats-avancement.txt`, results.join('\n'));
console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
