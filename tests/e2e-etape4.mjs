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
  for (const r of ['#/reunions', '#/heures', '#/heures?t=apc', '#/transmissions', '#/contacts', '#/remplacement', '#/pes', '#/argent', '#/argent?t=journal', '#/argent?t=comptes', '#/materiel', '#/etiquettes', '#/etiquettes?t=series', '#/etiquettes?t=academies', '#/reglages/charte', '#/jeux']) {
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

await test('Académies : noms, couleurs, emblèmes, un élève dans une seule académie', async () => {
  await go('#/etiquettes?t=academies');
  await page.getByTestId('academies-create').click(); await page.waitForTimeout(250);
  eq(await page.getByTestId('academy').count(), 4, '4 académies créées');
  await page.getByTestId('academy-name').first().fill('Les Phénix'); await page.getByTestId('academy-name').first().press('Tab'); await page.waitForTimeout(200);
  await page.getByTestId('academy-color').first().evaluate(el => { el.value = '#d9534f'; el.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(200);
  await page.getByTestId('academies-random').click(); await page.waitForTimeout(250);
  const r = await S(`const set = store.all('groupset').find(s => s.classId === a && s.kind === 'académies'); const all = set.groups.flatMap(g => g.memberIds);
    return { dup: all.length - new Set(all).size, n: all.length, total: model.studentsOfClass(a).length, first: set.groups[0].name, color: set.groups[0].color, emblem: set.groups[0].emblem.key }`, ids.cls);
  eq(r.dup, 0, 'aucun élève dans deux académies'); eq(r.n, r.total, 'tous les élèves répartis');
  eq(r.first, 'Les Phénix', 'nom modifié'); eq(r.color, '#d9534f', 'couleur modifiée'); eq(r.emblem, 'etoile', 'emblème par défaut');
});

await test('§17 Étiquettes : taille réelle, colonnes et pagination', async () => {
  await go('#/etiquettes?t=generer');
  await page.getByTestId('labels-type').selectOption('eleves'); await page.waitForTimeout(150);
  await page.getByTestId('labels-format').selectOption('70x37'); await page.waitForTimeout(250);
  const info = await page.getByTestId('labels-info').innerText();
  const L = await page.evaluate(async () => (await import('./js/labels.js')).layout({ w: 70, h: 37, margin: 0, gap: 0 }));
  const n = await S(`return model.studentsOfClass(a).length`, ids.cls);
  assert(info.includes(`${n} étiquette(s)`) && info.includes(`${L.perPage} par page`), `info : ${info}`);
  eq(L.cols * L.rows, 24, 'planche 70 × 37 : 3 × 8 = 24 étiquettes');
  const L8 = await page.evaluate(async () => (await import('./js/labels.js')).layout({ w: 70, h: 37, margin: 8, gap: 4 }));
  eq(L8.cols + '×' + L8.rows, '2×6', 'avec 8 mm de marge et 4 mm d’espace : 2 × 6');
  for (const [id, n] of [['63x38', 21], ['99x38', 14], ['105x74', 8], ['148x105', 4]]) eq(await page.evaluate(async (i) => { const LB = await import('./js/labels.js'); return LB.layout(LB.FORMATS.find(f => f.id === i)).perPage; }, id), n, `${id} : ${n} par page`);
  const svg = page.getByTestId('labels-preview').locator('svg').first();
  eq(await svg.getAttribute('width'), '210mm', 'page A4 à taille réelle (largeur)'); eq(await svg.getAttribute('height'), '297mm', 'page A4 à taille réelle (hauteur)');
  eq(await svg.locator('[data-testid=label]').count(), Math.min(n, L.perPage), 'étiquettes sur la 1re page');
  const box = await svg.locator('[data-testid=label]').first().evaluate(g => { const r = g.querySelector('rect.cut'); return [r.getAttribute('width'), r.getAttribute('height')]; });
  eq(box.join('×'), '70×37', 'chaque étiquette mesure 70 × 37 mm');
  const fam = await svg.locator('text').first().getAttribute('font-family');
  assert(fam.includes('Marelle'), 'police de la charte (Marelle) par défaut');
  // Pagination : 40 titres en 70 × 37 → 3 pages.
  await page.getByTestId('labels-type').selectOption('titres'); await page.waitForTimeout(150);
  await page.getByTestId('labels-format').selectOption('70x37'); await page.waitForTimeout(150);
  await page.getByTestId('labels-text').fill(Array.from({ length: 40 }, (_, i) => `Titre ${i + 1}`).join('\n')); await page.waitForTimeout(250);
  assert((await page.getByTestId('labels-info').innerText()).includes(`${Math.ceil(40 / L.perPage)} page(s)`), 'pagination correcte');
  // Format personnalisé trop grand.
  await page.getByTestId('labels-format').selectOption('a4l'); await page.waitForTimeout(250);
  assert((await page.getByTestId('labels-info').innerText()).includes('1 par page'), 'A4 paysage : 1 par page');
  eq(await page.getByTestId('labels-preview').locator('svg').first().getAttribute('width'), '297mm', 'page paysage');
});

await test('Série enregistrée, retouche, puis version actualisée après changement d’académie', async () => {
  await go('#/etiquettes?t=generer');
  await page.getByTestId('labels-type').selectOption('eleves'); await page.waitForTimeout(150);
  await page.getByTestId('labels-format').selectOption('105x74'); await page.waitForTimeout(150);
  await page.getByTestId('labels-save').click(); await page.waitForTimeout(300);
  assert(/#\/etiquettes\/.+/.test(await page.evaluate(() => location.hash)), 'série ouverte');
  eq(await page.getByTestId('academy-changed').count(), 0, 'pas de changement au départ');
  // Retouche : le prénom de Lou devient « Lou-Anne ».
  const idx = await page.getByTestId('label-edit').evaluateAll(els => els.findIndex(e => e.querySelector('input').value === 'Lou'));
  assert(idx >= 0, 'étiquette de Lou trouvée');
  const edit = page.getByTestId('label-edit').nth(idx);
  await edit.locator('input').first().fill('Lou-Anne'); await edit.locator('input').first().press('Tab'); await page.waitForTimeout(200);
  // Lou change d'académie.
  const setId = await page.evaluate(() => location.hash.split('/')[2]);
  await S(`const set = store.all('groupset').find(s => s.classId === a.cls && s.kind === 'académies');
    const from = set.groups.findIndex(g => g.memberIds.includes(a.lou)); const to = (from + 1) % set.groups.length;
    await store.update(set.id, { groups: set.groups.map((g, i) => i === from ? { ...g, memberIds: g.memberIds.filter(x => x !== a.lou) } : i === to ? { ...g, memberIds: [...g.memberIds, a.lou] } : g) }, 'test');`, ids);
  await go(`#/etiquettes/${setId}`);
  assert((await page.getByTestId('academy-changed').innerText()).includes('Lou-Anne'), 'changement signalé pour Lou');
  await page.getByTestId('series-refresh').click(); await page.waitForTimeout(300);
  const r = await S(`const all = store.all('labelset'); const v1 = store.get(a.old); const v2 = all.find(x => x.previousId === a.old);
    const acad = (await import('./js/labels.js')).academyOf(a.cls, a.lou);
    return { v1Color: v1.items.find(i => i.studentId === a.lou).color, v2Color: v2.items.find(i => i.studentId === a.lou).color, v2Name: v2.items.find(i => i.studentId === a.lou).line1, version: v2.version, now: acad.color }`, { ...ids, old: setId });
  eq(r.version, 2, 'version 2 créée'); eq(r.v2Color, r.now, 'nouvelle version : couleur de la nouvelle académie');
  assert(r.v1Color !== r.v2Color, 'la version 1 garde l’ancienne couleur'); eq(r.v2Name, 'Lou-Anne', 'retouche conservée');
  eq(await page.getByTestId('academy-changed').count(), 0, 'version actualisée à jour');
});

await test('Charte visuelle enregistrée et utilisée par défaut', async () => {
  await go('#/reglages/charte');
  await page.getByTestId('charte-font').selectOption('Marelle Baton'); await page.waitForTimeout(200);
  eq(await S(`return store.getSettings().charte.font`), 'Marelle Baton', 'police de la charte enregistrée');
  await go('#/etiquettes?t=generer'); await page.waitForTimeout(250);
  assert((await page.getByTestId('labels-preview').locator('text').first().getAttribute('font-family')).includes('Marelle Baton'), 'étiquettes en Marelle Bâton');
  await S(`await store.setSettings({ charte: { ...store.getSettings().charte, font: 'Marelle' } })`);
});

await test('Atelier géométrie : symétrie exacte, figures aux dimensions réelles, angles corrigés', async () => {
  await go('#/atelier'); await page.getByTestId('tool-symetrie').click(); await page.waitForTimeout(150);
  await page.getByTestId('p-graine').fill('1234'); await page.waitForTimeout(100);
  await page.getByTestId('correction').check(); await page.waitForTimeout(150);
  const sym = await page.evaluate(() => [...document.querySelectorAll('[data-testid=atelier-preview] [data-testid=exercise]')].map(g => ({ fig: JSON.parse(g.getAttribute('data-figure')), cor: JSON.parse(g.querySelector('[data-role=correction]').getAttribute('data-points')) })));
  eq(sym.length, 4, '4 exercices');
  for (const e of sym) assert(e.fig.every(([c, l], i) => e.cor[i][0] === 16 - c && e.cor[i][1] === l), 'correction = symétrique exact par rapport à l’axe vertical');
  const first = JSON.stringify(sym[0].fig);
  await page.getByTestId('p-graine').fill('1234'); await page.waitForTimeout(150);
  eq(await page.evaluate(() => document.querySelector('[data-testid=exercise]').getAttribute('data-figure')), first, 'même numéro → même fiche');
  await page.getByTestId('tool-figures').click(); await page.waitForTimeout(150);
  const dims = await page.evaluate(() => [...document.querySelectorAll('[data-testid=figure] [data-mm]')].map(e => e.getAttribute('data-mm')));
  eq(dims.join(' | '), '70 | 60x30 | 40x40 | 50x30 | 25', 'segment 7 cm, rectangle 6 × 3, carré 4, triangle 5 × 3, cercle r = 2,5 cm');
  await page.getByTestId('tool-angles').click(); await page.getByTestId('correction').check(); await page.waitForTimeout(150);
  const ang = await page.evaluate(() => [...document.querySelectorAll('[data-testid=angle]')].map(g => [Number(g.getAttribute('data-deg')), g.textContent]));
  assert(ang.length === 9 && ang.every(([d, t]) => t.includes(d < 90 ? 'aigu' : d === 90 ? 'droit' : 'obtus')), 'type d’angle corrigé correctement');
});

await test('Atelier cartes : planisphère et France sourcés, version vierge numérotée et corrigée', async () => {
  await go('#/atelier'); await page.getByTestId('tool-carte').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=map] path[data-continent]').length > 100);
  const w = await page.evaluate(() => { const svg = document.querySelector('[data-testid=atelier-preview] svg'); return { w: svg.getAttribute('width'), countries: svg.querySelectorAll('path[data-continent]').length, nums: svg.querySelectorAll('[data-testid=map-number]').length, legend: svg.querySelectorAll('[data-testid=legend-line]').length, src: svg.textContent.includes('Natural Earth') }; });
  eq(w.w, '297mm', 'planisphère en A4 paysage'); assert(w.countries >= 170, 'pays issus des données Natural Earth');
  assert(w.nums >= 7 && w.nums === w.legend, 'numéros sur la carte = lignes de légende à compléter'); assert(w.src, 'source affichée sur la carte');
  await page.getByTestId('p-carte').selectOption('France : régions');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=map] path[data-code]').length >= 13);
  await page.getByTestId('p-fleuves').check(); await page.getByTestId('correction').check(); await page.waitForTimeout(200);
  const fr = await page.evaluate(() => { const svg = document.querySelector('[data-testid=atelier-preview] svg'); return { regions: svg.querySelectorAll('path[data-code]').length, names: [...svg.querySelectorAll('[data-name]')].map(t => t.getAttribute('data-name')), w: svg.getAttribute('width'), src: svg.textContent.includes('IGN') }; });
  eq(fr.regions, 13, '13 régions métropolitaines'); eq(fr.w, '210mm', 'France en A4 portrait');
  for (const n of ['Bretagne', 'Occitanie', 'Loire', 'Seine', 'Alpes', 'Pyrénées']) assert(fr.names.includes(n), `nom présent dans la correction : ${n}`);
  assert(fr.src, 'source IGN affichée');
  await page.screenshot({ path: `${OUT}etape4-carte.png` });
});

await test('Jeux : memory joué jusqu’au bout, quiz, bingo, flashcards d’anglais, lien avec la séance', async () => {
  const newGame = async (title, kind, lines) => {
    await go('#/jeux'); await page.getByTestId('new-game').click();
    await page.getByTestId('game-title').fill(title); await page.getByTestId('game-kind').selectOption(kind);
    await page.getByTestId('game-create').click(); await page.waitForTimeout(250);
    await page.getByTestId('game-paste').click(); await page.getByTestId('paste-area').fill(lines.join('\n'));
    await page.getByTestId('paste-add').click(); await page.waitForTimeout(250);
    return page.evaluate(() => location.hash.split('/')[2]);
  };
  await newGame('Tables de 3', 'memory', ['3 × 2 | 6', '3 × 4 | 12', '3 × 5 | 15', '3 × 7 | 21']);
  eq(await page.getByTestId('game-row').count(), 4, '4 paires saisies');
  await page.getByTestId('game-play').click(); await page.waitForTimeout(200);
  eq(await page.getByTestId('memory-card').count(), 8, '8 cartes');
  for (let p = 0; p < 4; p++) { const cards = page.locator(`[data-testid=memory-card][data-pair="${p}"]`); await cards.nth(0).click(); await cards.nth(1).click(); await page.waitForTimeout(80); }
  assert((await page.getByTestId('memory-info').innerText()).includes('Toutes les paires'), 'partie terminée');
  await page.getByTestId('game-close').click();

  await newGame('Capitales', 'quiz', ['Capitale de la France ? | Paris | Lyon ; Marseille', 'Capitale de l’Italie ? | Rome | Milan ; Naples']);
  await page.getByTestId('game-play').click(); await page.waitForTimeout(150);
  await page.getByTestId('quiz-choice').filter({ hasText: /^Paris$/ }).click(); await page.getByTestId('quiz-next').click();
  await page.getByTestId('quiz-choice').filter({ hasText: /^Milan$/ }).click(); await page.getByTestId('quiz-next').click();
  eq(await page.getByTestId('quiz-end').innerText(), 'Terminé : 1/2', 'score du quiz');
  await page.getByTestId('game-close').click();

  const bingo = await newGame('Loto des nombres', 'bingo', Array.from({ length: 30 }, (_, i) => String((i + 1) * 7)));
  const cards = await page.evaluate(async (id) => { const J = await import('./js/jeux.js'); const s = await import('./js/store.js'); return J.bingoCards(s.get(id), 6, 4, 1); }, bingo);
  eq(cards.length, 6, '6 cartons'); assert(cards.every(c => c.length === 16 && new Set(c).size === 16), 'cartons de 16 cases distinctes');
  eq(new Set(cards.map(c => [...c].sort().join())).size, 6, 'cartons tous différents');
  await page.getByTestId('game-play').click(); await page.getByTestId('bingo-draw').click();
  assert((await page.getByTestId('bingo-current').innerText()).match(/^\d+$/), 'tirage affiché');
  await page.getByTestId('game-close').click();

  await newGame('Animals', 'flashcards', ['cat | chat', 'dog | chien', 'bird | oiseau']);
  assert((await page.getByTestId('audio-note').innerText()).includes('voix de synthèse'), 'origine de l’audio indiquée');
  await page.getByTestId('game-play').click(); await page.waitForTimeout(150);
  const first = await page.getByTestId('flash-card').innerText();
  await page.getByTestId('flash-card').click();
  eq(first.trim(), 'cat', 'face anglaise'); eq((await page.getByTestId('flash-card').innerText()).trim(), 'chat', 'carte retournée : traduction');
  await page.getByTestId('game-close').click();
  // Lien avec une séance : visible depuis la fiche de séance.
  const sid = await S(`const s = store.all('session').find(x => x.classId === a); return s.id`, ids.cls);
  const gid = await page.evaluate(() => location.hash.split('/')[2]);
  await S(`await store.update(a.g, { sessionId: a.s }, 'test')`, { g: gid, s: sid });
  await go(`#/seance/${sid}`);
  assert((await page.locator('.page').innerText()).includes('Animals'), 'jeu listé dans la fiche de séance');
});

await test('Captures', async () => {
  for (const [r, n] of [[`#/reunions/${meetingId}`, 'reunion'], ['#/heures', 'heures'], ['#/heures?t=apc', 'apc'], ['#/transmissions', 'transmissions'], ['#/pes', 'pes'], ['#/remplacement', 'remplacement'], ['#/argent', 'argent'], ['#/argent?t=journal', 'journal'], ['#/materiel', 'materiel'], ['#/etiquettes?t=generer', 'etiquettes'], ['#/etiquettes?t=academies', 'academies']]) { await go(r); await page.screenshot({ path: `${OUT}etape4-${n}.png`, fullPage: true }); }
});

await test('Aucune erreur JavaScript', async () => { eq(errors.length, 0, errors.join(' | ')); });

await browser.close();
const summary = `\n${passed} réussi(s), ${failed} échoué(s)`;
console.log(summary);
writeFileSync(`${OUT}resultats-etape4.txt`, results.join('\n') + summary + '\n');
process.exit(failed ? 1 : 0);
