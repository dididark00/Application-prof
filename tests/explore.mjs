// Exploration « comme une utilisatrice » avec les données fictives de démonstration :
// toutes les pages et leurs onglets, sur ordinateur et téléphone ; sur chaque page, chaque bouton
// non destructif est cliqué (puis la fenêtre ouverte est refermée). On relève : erreurs JavaScript,
// pages en erreur, débordement horizontal sur téléphone, éléments hors de l'écran, boutons sans effet visible.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const DANGER = /supprim|effac|retir|vider|tout effacer|corbeille|réinitial|remplacer|oublier|déconnect|archiver dans|retirer|purge|désinscri|charger la démonstration|retirer la démonstration|restaurer|annuler l’import|imprimer|exporter|télécharger|copier|partager|envoyer|enregistrer au format|ouvrir l’écran|plein écran|afficher en grand|démarrer|parler|lire$|choisir un fichier|choisir ou prendre|importer une autre police|photo|joindre|depuis mes fichiers|autoriser|synchroniser|choisir le dossier|récupérer|vers mon agenda|nouvelle version/i;

const issues = [];
const note = (where, what) => { issues.push(`${where} : ${what}`); };

const browser = await chromium.launch();
async function run(width, height, tag) {
  const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width, height }, bypassCSP: true });
  const page = await ctx.newPage();
  let current = '';
  page.on('pageerror', e => note(`${tag} ${current}`, `erreur JS : ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) note(`${tag} ${current}`, `console : ${m.text().slice(0, 200)}`); });
  page.on('dialog', d => d.dismiss());
  await page.goto(BASE); await page.waitForFunction(() => window.__classeurReady === true);
  await page.evaluate(async () => (await import('./js/demo.js')).loadDemo());
  await page.waitForTimeout(500);
  await page.evaluate(async () => { const store = await import('./js/store.js'); const cls = store.all('class').find(c => c.name === 'CE2 (démo)'); await store.setSettings({ currentClassId: cls.id, userName: 'Julia' }); window.print = () => {}; });
  // Toutes les pages : rubriques, sous-onglets internes, réglages, fiches.
  const routes = await page.evaluate(async () => {
    const R = await import('./js/roadmap.js'); const store = await import('./js/store.js');
    const out = R.RUBRIQUES.flatMap(r => r.sous.filter(s => s.route).map(s => `#/${s.route}`));
    const st = store.all('student')[0]; const seq = store.all('sequence')[0]; const ses = store.all('session')[0]; const prog = store.all('programmation')[0]; const pr = store.all('progression')[0]; const proj = store.all('project')[0]; const ref = store.all('referential')[0];
    out.push('#/reglages/general', '#/reglages/annees', '#/reglages/classes', '#/reglages/modules', '#/reglages/charte', '#/reglages/sauvegarde', '#/reglages/synchro', '#/reglages/rappels', '#/reglages/connexions', '#/reglages/historique', '#/reglages/corbeille', '#/reglages/documents', '#/reglages/reprise', '#/reglages/demo', '#/reglages/feuille', '#/plus', '#/recherche?q=lou');
    if (st) for (const t of ['identite', 'documents', 'suivi', 'besoins', 'vie', 'echanges']) out.push(`#/eleve/${st.id}?t=${t}`);
    if (seq) out.push(`#/sequence/${seq.id}`); if (ses) out.push(`#/seance/${ses.id}`); if (prog) out.push(`#/programmation/${prog.id}`); if (pr) out.push(`#/progression/${pr.id}`); if (proj) out.push(`#/argent/projet/${proj.id}`); if (ref) out.push(`#/referentiels/${ref.id}`);
    for (const o of ['tapuscrit', 'syllabes', 'parler', 'lire', 'sono', 'pot', 'abaque', 'cent', 'numeration', 'reglettes', 'pourcent']) out.push(`#/outils?o=${o}`);
    for (const t of ['appreciations', 'mot', 'aesh', 'incident', 'soins']) out.push(`#/redaction?t=${t}`);
    for (const t of ['calculs', 'problemes', 'dictee', 'fluence']) out.push(`#/exercices?t=${t}`);
    for (const k of ['programmation', 'progression', 'sequences', 'cahier']) out.push(`#/importer?k=${k}`);
    out.push('#/cahier?d=2026-11-09', '#/cahier?d=2026-11-09&v=semaine', '#/services?t=semaine', '#/services?t=sorties', '#/argent?t=journal', '#/argent?t=comptes', '#/etiquettes?t=series', '#/etiquettes?t=academies', '#/heures?t=apc', '#/apercu');
    return [...new Set(out)];
  });
  let clicked = 0;
  for (const r of routes) {
    current = r;
    await page.evaluate(h => { location.hash = h; }, r); await page.waitForTimeout(350);
    const state = await page.evaluate((w) => {
      const main = document.getElementById('main');
      const err = main.querySelector('.card.error')?.innerText || '';
      const placeholder = !!main.querySelector('[data-testid=placeholder]');
      const overflow = document.documentElement.scrollWidth > w + 2;
      const offenders = overflow ? [...main.querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(); if (b.right <= w + 2 || !b.width) return false; for (let x = e.parentElement; x; x = x.parentElement) { const o = getComputedStyle(x).overflowX; if (o === 'auto' || o === 'hidden' || o === 'scroll') return false; } return true; }).slice(0, 3).map(e => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} « ${(e.innerText || '').slice(0, 30)} »`) : [];
      const empty = (main.innerText || '').trim().length < 20;
      return { err, placeholder, overflow, offenders, empty };
    }, width);
    if (state.err) note(`${tag} ${r}`, `page en erreur : ${state.err.slice(0, 150)}`);
    if (state.placeholder) note(`${tag} ${r}`, 'page « pas encore disponible »');
    if (state.empty) note(`${tag} ${r}`, 'page vide');
    if (state.overflow && state.offenders.length) note(`${tag} ${r}`, `déborde de l’écran : ${state.offenders.join(' ; ')}`);
    // Boutons non destructifs de la page.
    const labels = await page.evaluate((src) => { const re = new RegExp(src, 'i'); return [...document.querySelectorAll('#main button:not([disabled]), #main summary')].filter(b => b.offsetParent && !re.test(b.innerText || b.getAttribute('aria-label') || '') && !b.closest('.modal')).map((b, i) => ({ i, t: (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 40) })).slice(0, 25); }, DANGER.source);
    for (const { i, t } of labels) {
      const before = page.url();
      try {
        const handle = (await page.$$('#main button:not([disabled]), #main summary'))[i];
        if (!handle) continue;
        const txt = ((await handle.innerText().catch(() => '')) || '').trim().slice(0, 40);
        if (txt !== t && t) continue; // la page a changé
        await handle.click({ timeout: 2500 });
        clicked++;
        await page.waitForTimeout(150);
        if (await page.locator('.modal-backdrop').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(80); while (await page.locator('.modal-backdrop').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(80); if (await page.locator('.modal-backdrop').count()) { await page.locator('.modal-head .icon-btn').last().click().catch(() => {}); } } }
        if (page.url() !== before || !(await page.evaluate(h => location.hash === h, r))) { await page.evaluate(h => { location.hash = h; }, r); await page.waitForTimeout(250); }
      } catch (e) { if (!/Timeout|detached|not attached|intercepts/.test(e.message)) note(`${tag} ${r}`, `clic « ${t} » : ${e.message.split('\n')[0]}`); }
    }
  }
  await ctx.close();
  return { routes: routes.length, clicked };
}
const d = await run(1280, 900, 'ordinateur');
const m = await run(390, 844, 'téléphone');
await browser.close();
const uniq = [...new Set(issues)];
const report = [`Pages visitées : ${d.routes} (ordinateur) + ${m.routes} (téléphone) ; boutons cliqués : ${d.clicked + m.clicked}`, `Problèmes : ${uniq.length}`, ...uniq];
writeFileSync(`${OUT}exploration.txt`, report.join('\n'));
console.log(report.join('\n'));
