import { chromium } from 'playwright';
const b = await chromium.launch();
const errs = [];
for (const [w,hgt,name] of [[1280,900,'desk'],[390,820,'mob']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: hgt }, isMobile: w<500, hasTouch: w<500 }); const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-11-02T08:00:00') });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8080/'); await p.waitForFunction(() => window.__classeurReady);
  await p.evaluate(async () => (await import('./js/demo.js')).loadDemo()); await p.waitForTimeout(300);
  await p.evaluate(async () => { const s = await import('./js/store.js'); const c = s.all('class').find(x => x.name.startsWith('CE1')); await s.setSettings({ currentClassId: c.id }); });
  await p.evaluate(() => { location.hash = '#/cahier?d=2026-11-02'; }); await p.waitForTimeout(400);
  await p.screenshot({ path: `tests/out/multi-${name}.png`, fullPage: true });
  const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (over > 1) errs.push(`${name} overflow ${over}`);
  if (name==='mob') { for (const r of ['#/aujourdhui','#/edt','#/agenda','#/programmations','#/sequences','#/preparations','#/devoirs','#/taches','#/interventions','#/lecons','#/manuels','#/referentiels','#/progressions']) { await p.evaluate(h => { location.hash = h; }, r); await p.waitForTimeout(250); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (o > 1) errs.push(`${r} overflow ${o}`);} 
    const sid = await p.evaluate(async () => (await import('./js/store.js')).all('session')[0].id); await p.evaluate(h => { location.hash = h; }, `#/seance/${sid}`); await p.waitForTimeout(300); await p.screenshot({ path: 'tests/out/mob-seance.png', fullPage: false });
    const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (o > 1) errs.push(`seance overflow ${o}`); }
  await ctx.close();
}
console.log(errs.join('\n') || 'no errors'); await b.close();
