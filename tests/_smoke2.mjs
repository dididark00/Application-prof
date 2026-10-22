import { chromium } from 'playwright';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
await p.clock.install({ time: new Date('2026-11-05T08:00:00') });
const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message + '\n' + e.stack)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await p.goto('http://localhost:8080/'); await p.waitForFunction(() => window.__classeurReady);
await p.evaluate(async () => (await import('./js/demo.js')).loadDemo()); await p.waitForTimeout(400);
const routes = ['#/aujourdhui','#/referentiels','#/programmations','#/progressions','#/sequences','#/preparations','#/manuels','#/lecons','#/cahier','#/cahier?v=semaine','#/edt','#/agenda','#/agenda?v=mois','#/devoirs','#/interventions','#/taches','#/recherche?q=millier','#/reglages/reprise','#/reglages/feuille'];
for (const r of routes) { await p.evaluate(h => { location.hash = h; }, r); await p.waitForTimeout(250); const t = await p.locator('main').innerText(); if (/Une erreur est survenue/.test(t)) errs.push(r + ' => ' + t.slice(0,300)); await p.screenshot({ path: `tests/out/s2${r.replace(/[^\w]+/g,'_')}.png`, fullPage: true }); }
// detail pages
const ids = await p.evaluate(async () => { const s = await import('./js/store.js'); return { prog: s.all('programmation')[0].id, progression: s.all('progression')[0].id, seq: s.all('sequence')[0].id, ses: s.all('session').find(x=>x.copies?.length).id }; });
for (const r of [`#/programmation/${ids.prog}`, `#/progression/${ids.progression}`, `#/sequence/${ids.seq}`, `#/seance/${ids.ses}`]) { await p.evaluate(h => { location.hash = h; }, r); await p.waitForTimeout(300); const t = await p.locator('main').innerText(); if (/Une erreur est survenue/.test(t)) errs.push(r + ' => ' + t.slice(0,300)); await p.screenshot({ path: `tests/out/s2${r.split('/')[1]}_detail.png`, fullPage: true }); }
console.log(errs.join('\n') || 'no errors');
await b.close();
