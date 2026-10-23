// Étape 4 : organisation — réunions, 108 h / APC, transmissions, PES, dossiers, finances,
// matériel, étiquettes, atelier. Scénarios dans un vrai navigateur.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let passed = 0, failed = 0; const results = [];
let page;
async function test(name, fn) {
  try { await fn(); passed++; results.push(`✔ ${name}`); console.log(`✔ ${name}`); }
  catch (e) { failed++; results.push(`✘ ${name}\n    ${e.message.split('\n')[0]}`); console.log(`✘ ${name}\n   `, e.message); try { await page.screenshot({ path: `${OUT}echec4-${failed}.png`, fullPage: true }); } catch { /* */ } }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 }, bypassCSP: true }); // bypassCSP : uniquement pour les scripts de test
page = await ctx.newPage();
await page.clock.install({ time: new Date('2026-11-05T17:00:00') });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const ready = () => page.waitForFunction(() => window.__classeurReady === true);
const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(220); };
const S = (fn, arg) => page.evaluate(async ([src, a]) => {
  const m = { store: await import('./js/store.js'), model: await import('./js/model.js'), PL: await import('./js/planning.js'), P: await import('./js/pedago.js'), O: await import('./js/orga.js'), FI: await import('./js/finance.js') };
  return (new Function(...Object.keys(m), 'a', `return (async () => { ${src} })()`))(...Object.values(m), a);
}, [fn, arg]);
const modalBtn = (name) => page.locator('.modal-foot button', { hasText: name });

await page.goto(BASE); await ready();
await page.evaluate(async () => (await import('./js/demo.js')).loadDemo());
await page.waitForTimeout(400);
const ids = await S(`const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentClassId: cls.id, userName: 'Julia' });
  const st = (n) => store.all('student').find(s => s.firstName === n).id;
  return { cls: cls.id, lou: st('Lou'), nino: st('Nino'), year: cls.yearId };`);

await test('Pages de l’organisation sans erreur ni faux bouton', async () => {
  for (const r of ['#/reunions', '#/heures', '#/heures?t=apc', '#/transmissions', '#/contacts', '#/remplacement', '#/pes', '#/argent', '#/argent?t=journal', '#/argent?t=comptes', '#/materiel']) {
    await go(r);
    assert(!(await page.locator('.page').innerText()).includes('à venir à l’étape'), `${r} affiche encore « à venir »`);
  }
  eq(errors.length, 0, errors.join(' | '));
});

await test('Contacts : ajout, puis participant d’une réunion', async () => {
  await go('#/contacts');
  await page.getByTestId('new-contact').click();
  await page.locator('.modal input[name=name]').fill('Mme Directrice (exemple)');
  await page.locator('.modal select[name=role]').selectOption('direction');
  await page.locator('.modal input[name=phone]').fill('01 23 45 67 89');
  await modalBtn('Enregistrer').click(); await page.waitForTimeout(200);
  eq(await page.getByTestId('contact-card').count(), 1, 'contact créé');
});

let meetingId;
await test('Réunion : 108 h, décision, tâche avec responsable, élève, agenda', async () => {
  await go('#/reunions');
  await page.getByTestId('new-meeting').click();
  await page.getByTestId('meeting-title').fill('Conseil de cycle 2 (exemple)');
  await page.getByTestId('meeting-kind').selectOption('conseil de cycle');
  await page.getByTestId('meeting-date').fill('2026-11-03');
  await page.getByTestId('meeting-start').fill('16:45'); await page.getByTestId('meeting-end').fill('18:15');
  await modalBtn('Créer').click(); await page.waitForTimeout(300);
  meetingId = (await page.evaluate(() => location.hash)).split('/')[2];
  assert(meetingId, 'page de la réunion ouverte');
  await page.getByTestId('m-decision').fill('Décloisonnement en lecture le jeudi'); await page.getByTestId('m-decision').press('Enter'); await page.waitForTimeout(150);
  await page.getByTestId('m-task-title').fill('Préparer les groupes de lecture');
  await page.getByTestId('m-task-owner').fill('Julia'); await page.getByTestId('m-task-due').fill('2026-11-10');
  await page.getByTestId('m-task-add').click(); await page.waitForTimeout(200);
  await page.getByTestId('m-minutes').fill('Compte rendu : organisation des groupes.'); await page.getByTestId('m-minutes').blur(); await page.waitForTimeout(150);
  await S(`await store.update(a.m, { studentIds: [a.lou] }, 'test');`, { m: meetingId, lou: ids.lou });
  const r = await S(`const m = store.get(a); const t = O.tasksOfMeeting(a); return { dec: m.decisions.length, tasks: t.length, owner: t[0].owner, due: t[0].due, minutes: m.minutes, cat: m.cat108, min: O.meetingMinutes(m) };`, meetingId);
  eq(r.dec, 1, 'décision enregistrée'); eq(r.tasks, 1, 'tâche créée'); eq(r.owner, 'Julia', 'responsable'); eq(r.due, '2026-11-10', 'échéance');
  eq(r.cat, 'conseils', 'catégorie 108 h proposée selon le type'); eq(r.min, 90, 'durée calculée');
  assert(r.minutes.includes('organisation'), 'compte rendu enregistré');
  await go('#/agenda?d=2026-11-03');
  eq(await page.getByTestId('agenda-meeting').count(), 1, 'réunion visible dans l’agenda');
  await go(`#/eleve/${ids.lou}?t=echanges`);
  eq(await page.getByTestId('student-meetings').count(), 1, 'réunion visible sur la fiche de l’élève');
  await go('#/taches');
  assert((await page.locator('.page').innerText()).includes('Préparer les groupes de lecture'), 'tâche visible dans Tâches');
});

await test('108 h : comptage unique (réunion + APC + activité), objectifs au prorata', async () => {
  await go('#/heures');
  await page.getByTestId('h108-settings').click();
  await page.locator('.modal select').first().selectOption('50'); await page.waitForTimeout(50);
  eq(await page.getByTestId('target-apc').inputValue(), '18', 'APC à mi-temps = 18 h');
  await modalBtn('Enregistrer').click(); await page.waitForTimeout(200);
  await page.getByTestId('h108-add').click();
  await page.getByTestId('act-title').fill('Animation pédagogique maths (exemple)');
  await page.getByTestId('act-cat').selectOption('animations');
  await page.getByTestId('act-planned').fill('180'); await page.getByTestId('act-done').check();
  await modalBtn('Enregistrer').click(); await page.waitForTimeout(200);
  // APC : un groupe, deux séances dont une faite
  await go('#/heures?t=apc');
  await page.getByTestId('new-apc').click(); await page.getByTestId('apc-title').fill('Fluence (exemple)');
  await modalBtn('Enregistrer').click(); await page.waitForTimeout(300);
  await page.getByTestId('apc-add-session').click(); await page.waitForTimeout(150);
  await page.getByTestId('apc-add-session').click(); await page.waitForTimeout(150);
  await page.getByTestId('apc-done').first().check(); await page.waitForTimeout(200);
  const t = await S(`const l = O.h108Lines(a); const tot = O.h108Totals(l); return { n: l.length, apc: tot.apc.done, conseils: tot.conseils.done, anim: tot.animations.done, apcPlanned: tot.apc.planned };`, ids.year);
  eq(t.n, 4, 'quatre lignes : réunion, activité, deux séances d’APC');
  eq(t.apc, 30, 'APC réalisée : 30 min (une seule séance faite)'); eq(t.apcPlanned, 60, 'APC prévue : 60 min');
  eq(t.conseils, 90, 'réunion comptée une fois (90 min)'); eq(t.anim, 180, 'activité comptée');
  // Modifier la réunion ne crée pas de doublon
  await S(`await store.update(a, { end: '18:45' }, 'test');`, meetingId);
  const t2 = await S(`const tot = O.h108Totals(O.h108Lines(a)); return tot.conseils.done;`, ids.year);
  eq(t2, 120, 'durée de réunion mise à jour, toujours comptée une fois');
  await go('#/heures');
  eq(await page.getByTestId('h108-done').innerText(), '5 h 30', 'total réalisé affiché');
});

await test('Transmission binôme préremplie depuis le cahier journal, accusé de lecture', async () => {
  const day = await S(`const cls = store.get(a); const d = '2026-11-02'; const plan = PL.dayPlan(cls, d);
    const e = plan.entries.find(x => x.kind === 'occ' || x.kind === 'slot');
    await PL.setStatus(e, cls, 'faite'); return plan.entries.length;`, ids.cls);
  assert(day > 0, 'journée de démonstration avec des créneaux');
  await go('#/transmissions');
  await page.getByTestId('new-handover').click();
  await page.getByTestId('ho-date').fill('2026-11-02');
  await modalBtn('Créer').click(); await page.waitForTimeout(300);
  const items = await page.getByTestId('ho-item').count();
  assert(items >= 2, `lignes préremplies (${items})`);
  const txt = await S(`const x = O.handovers(a)[0]; return x.items.map(i => i.kind + ':' + i.text).join('|');`, ids.cls);
  assert(/fait:/.test(txt), 'une séance faite');
  assert(/Absences/.test(txt) && /Nino/.test(txt), 'absence de l’appel reprise');
  await page.getByTestId('ho-read').click(); await modalBtn('Confirmer').click(); await page.waitForTimeout(200);
  const rd = await S(`const x = O.handovers(a)[0]; return [!!x.readAt, x.readBy];`, ids.cls);
  assert(rd[0], 'accusé de lecture daté'); eq(rd[1], 'Collègue fictive', 'lu par la binôme');
});

await test('PES : visite reliée à la fiche de séance, action → objectif, agenda', async () => {
  const sid = await S(`return store.all('session').find(s => s.classId === a)?.id;`, ids.cls);
  await go('#/pes');
  await page.getByTestId('new-visit').click();
  await page.getByTestId('pes-date').fill('2026-11-12');
  await page.getByTestId('pes-session').selectOption(sid);
  await modalBtn('Enregistrer').click(); await page.waitForTimeout(300);
  eq(await page.getByTestId('pes-session-link').count(), 1, 'fiche de séance reliée');
  await page.getByTestId('pes-feedback').fill('Consignes claires, gestion du temps à travailler.'); await page.getByTestId('pes-feedback').blur();
  await page.getByTestId('pes-action').fill('Afficher un minuteur pour chaque phase');
  await page.locator('select[aria-label="Objectif lié"]').selectOption('__new');
  await page.getByTestId('pes-action-add').click(); await page.waitForTimeout(250);
  const o = await S(`return O.pesItems('objectif').map(x => x.title);`);
  eq(o.length, 1, 'objectif de formation créé depuis l’action');
  await go('#/agenda?d=2026-11-12');
  assert((await page.locator('.agenda').innerText()).includes('Visite'), 'visite visible dans l’agenda');
});

await test('Dossier de remplacement : rubriques auto + texte, aucune donnée confidentielle', async () => {
  await go('#/remplacement'); await page.waitForTimeout(250);
  await page.getByTestId('txt-routines').fill('Accueil échelonné, calendrier, météo.'); await page.getByTestId('txt-routines').blur(); await page.waitForTimeout(150);
  await page.getByTestId('dossier-from').fill('2026-11-02'); await page.getByTestId('dossier-from').blur(); await page.waitForTimeout(200);
  const html = await page.evaluate(async () => { const m = await import('./js/pages/remplacement.js'); const store = await import('./js/store.js'); const model = await import('./js/model.js'); const cls = model.currentClass(); const rec = store.all('dossier').find(d => d.classId === cls.id && d.kind === 'remplacement'); return m.build(cls, rec).innerText; });
  assert(html.includes('Accueil échelonné'), 'texte libre inclus');
  assert(html.includes('Cahier journal'), 'cahier journal inclus');
  assert(html.includes('Mme Directrice'), 'contacts de l’école inclus');
  const secrets = await S(`return store.all('need').concat(store.all('plan')).map(x => x.text || x.details || x.title || '').filter(Boolean);`);
  for (const s of secrets) assert(!html.includes(s), 'aucune donnée confidentielle');
  await page.getByTestId('dossier-print').click(); await page.waitForTimeout(300);
});

await test('§17 Deux versements : total correct dans le projet et le journal, sans double compte', async () => {
  const p = await S(`return store.all('project').find(x => x.title === 'Sortie au musée (exemple)').id`);
  await go(`#/argent/projet/${p}`);
  eq(await page.getByTestId('project-received').innerText(), '13,00 €', 'démo : 8 € + 5 € reçus');
  // Deux nouveaux versements pour Jade : 3 € puis 5 € (paiement partiel puis solde).
  const jadeRow = page.getByTestId('project-row').filter({ hasText: 'Jade' });
  for (const amount of ['3', '5']) {
    await jadeRow.getByTestId('pay').click();
    await page.getByTestId('mv-amount').fill(amount);
    await page.getByTestId('mv-save').click(); await page.waitForTimeout(200);
  }
  eq(await page.getByTestId('project-received').innerText(), '21,00 €', 'reçu = 13 + 3 + 5');
  assert((await page.getByTestId('project-row').filter({ hasText: 'Jade' }).innerText()).includes('réglé'), 'Jade a réglé ses 8 €');
  const db = await S(`const all = FI.movements({ projectId: a }); return { n: all.length, fam: all.filter(m => m.kind === 'versement').reduce((s, m) => s + m.amount, 0), jade: all.filter(m => store.get(m.studentId)?.firstName === 'Jade').length }`, p);
  eq(db.jade, 2, 'exactement deux mouvements pour Jade'); eq(db.fam, 2100, 'somme des versements au journal');
  await go('#/argent?t=journal');
  const rows = await page.getByTestId('journal-row').count();
  eq(rows, db.n, 'le journal montre chaque mouvement une seule fois');
  // Fiche élève : lue depuis le même mouvement.
  const jade = await S(`return store.all('student').find(s => s.firstName === 'Jade').id`);
  await go(`#/eleve/${jade}?t=vie`);
  assert((await page.getByTestId('student-payments').innerText()).includes('versé 8,00'), 'fiche élève : 8 € versés');
});

await test('Correction tracée : un mouvement validé ne se supprime pas, il s’annule', async () => {
  await go('#/argent?t=journal');
  const before = await page.getByTestId('journal-row').count();
  const row = page.getByTestId('journal-row').filter({ hasText: 'Acompte (exemple)' });
  await row.getByTestId('reverse').click();
  await page.getByTestId('reverse-reason').fill('erreur de saisie');
  await page.getByTestId('reverse-confirm').click(); await page.waitForTimeout(200);
  eq(await page.getByTestId('journal-row').count(), before + 1, 'une ligne d’annulation ajoutée, l’original reste');
  assert((await page.getByTestId('journal-row').filter({ hasText: 'Acompte (exemple)' }).first().innerText()).includes('annulé'), 'original marqué annulé');
  eq(await page.getByTestId('journal-row').filter({ hasText: 'Acompte (exemple)' }).first().getByTestId('reverse').count(), 0, 'plus de bouton Annuler sur l’original');
  const p = await S(`const p = store.all('project').find(x => x.title === 'Sortie au musée (exemple)'); return FI.projectStatus(p).rows.find(r => r.student.firstName === 'Nino').paid`);
  eq(p, 0, 'Nino : versement annulé → 0 € reçu');
});

await test('Liste avec colonne « Paiement d’un projet » : lit et alimente le journal', async () => {
  const lst = await S(`const p = store.all('project').find(x => x.title === 'Sortie au musée (exemple)');
    const l = await store.create('list', { classId: a, title: 'Sortie musée', columns: [{ id: 'cp', label: 'Paiement sortie', type: 'paiement', options: [], link: null, projectId: p.id }], values: {} }); return l.id;`, ids.cls);
  await go(`#/listes/${lst}`);
  const nino = page.locator('tr').filter({ hasText: 'Nino' });
  assert((await nino.innerText()).includes('à payer 8,00'), 'Nino : à payer 8 €');
  await nino.getByTestId('cell-pay').click();
  eq(await page.getByTestId('mv-amount').inputValue(), '8', 'montant restant proposé');
  await page.getByTestId('mv-save').click(); await page.waitForTimeout(250);
  assert((await page.locator('tr').filter({ hasText: 'Nino' }).innerText()).includes('réglé'), 'liste à jour');
  const n = await S(`return FI.movements({}).filter(m => store.get(m.studentId)?.firstName === 'Nino' && !m.correctsId && !m.reversedById).length`);
  eq(n, 1, 'un seul mouvement valide pour Nino');
});

await test('Comptes : solde initial explicite, report sur une nouvelle année sans mélange', async () => {
  await go('#/argent?t=comptes');
  const bal = await page.getByTestId('account-balance').first().innerText();
  const expected = await S(`const acc = FI.accounts(a)[0]; return FI.euros(FI.balance(acc).closing)`, ids.year);
  eq(bal, expected, 'solde affiché = solde calculé');
  const r = await S(`const y = await store.create('year', { label: '2027-2028', start: '2027-09-01', end: '2028-07-07', periods: [] });
    const old = FI.accounts(a)[0]; const n = await FI.carryOver(old, y.id);
    return { opening: n.opening.amount, closing: FI.balance(old).closing, newCount: FI.movements({ yearId: y.id }).length, oldCount: FI.movements({ yearId: a }).length, note: n.opening.note }`, ids.year);
  eq(r.opening, r.closing, 'solde initial du nouveau compte = solde final de l’ancien');
  eq(r.newCount, 0, 'aucun mouvement recopié dans la nouvelle année'); assert(r.oldCount > 0, 'l’ancienne année garde ses mouvements');
  assert(r.note.includes('Report'), 'origine du report notée');
});

await test('Matériel : achat → une seule dépense au journal, stock, prêt et retour', async () => {
  await go('#/materiel');
  const row = page.getByTestId('material-row').filter({ hasText: 'Ballons' });
  eq(await row.getByTestId('material-qty').innerText(), '8', 'stock initial');
  const nBefore = await S(`return store.all('movement').length`);
  await row.getByTestId('material-move').click();
  await page.getByTestId('mm-kind').selectOption('achat'); await page.getByTestId('mm-qty').fill('4'); await page.getByTestId('mm-cost').fill('24,90');
  await page.getByTestId('mm-save').click(); await page.waitForTimeout(250);
  eq(await page.getByTestId('material-row').filter({ hasText: 'Ballons' }).getByTestId('material-qty').innerText(), '12', 'stock après achat');
  const mv = await S(`const all = store.all('movement'); return { n: all.length, last: all.find(m => m.label.startsWith('Achat : Ballons')) }`);
  eq(mv.n, nBefore + 1, 'une seule dépense créée'); eq(mv.last.amount, -2490, 'dépense de 24,90 €');
  await page.getByTestId('material-row').filter({ hasText: 'Ballons' }).getByTestId('material-move').click();
  await page.getByTestId('mm-kind').selectOption('prêt'); await page.getByTestId('mm-qty').fill('2'); await page.getByTestId('mm-student').selectOption({ label: await S(`const s = store.get(a); return model.fullName(s)`, ids.lou) });
  await page.getByTestId('mm-save').click(); await page.waitForTimeout(250);
  eq(await page.getByTestId('material-row').filter({ hasText: 'Ballons' }).getByTestId('material-available').innerText(), '10', 'disponible = 12 − 2 prêtés');
  await page.getByTestId('loan-return').click(); await page.waitForTimeout(200);
  eq(await page.getByTestId('material-row').filter({ hasText: 'Ballons' }).getByTestId('material-available').innerText(), '12', 'retour enregistré');
  await page.getByTestId('material-row').filter({ hasText: 'Ballons' }).getByTestId('material-move').click();
  await page.getByTestId('mm-kind').selectOption('sortie'); await page.getByTestId('mm-qty').fill('50');
  await page.getByTestId('mm-save').click();
  assert((await page.locator('.form-errors').innerText()).includes('disponible'), 'sortie impossible au-delà du stock');
  await page.keyboard.press('Escape');
});

await test('Captures', async () => {
  for (const [r, n] of [[`#/reunions/${meetingId}`, 'reunion'], ['#/heures', 'heures'], ['#/heures?t=apc', 'apc'], ['#/transmissions', 'transmissions'], ['#/pes', 'pes'], ['#/remplacement', 'remplacement'], ['#/argent', 'argent'], ['#/argent?t=journal', 'journal'], ['#/materiel', 'materiel']]) { await go(r); await page.screenshot({ path: `${OUT}etape4-${n}.png`, fullPage: true }); }
});

await test('Aucune erreur JavaScript', async () => { eq(errors.length, 0, errors.join(' | ')); });

await browser.close();
const summary = `\n${passed} réussi(s), ${failed} échoué(s)`;
console.log(summary);
writeFileSync(`${OUT}resultats-etape4.txt`, results.join('\n') + summary + '\n');
process.exit(failed ? 1 : 0);
