// GTA touches: mission start card, PATIENT SAVED banner (slow-mo + pay-out ticker), rank-up, shift report.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 240000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await page.click('#start');
const g = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: `.shots/career-${n}.png` });
// 1. a new emergency → mission start card
await wait(3500); // first emergency spawns ~2 s in
await shot('1-mission-card');
console.log('card:', await g(() => document.getElementById('mission-card').innerText.replace(/\n/g, ' | ')));
// 2. rescue Ido → PATIENT SAVED
const before = await g(() => __game.missions.lollipops);
await g(() => {
  const ms = __game.missions;
  const m = ms.missions[0];
  m.misses = 0;
  ms.complete(m);
});
await wait(700);
await shot('2-saved-slam');
await wait(1800);
await shot('3-saved-payout');
console.log('slow-mo active during banner:', await g(() => __game.career.showing));
await page.waitForFunction(() => !__game.career.showing, { timeout: 30000 });
console.log('lollipops ticked in:', before, '→', await g(() => __game.missions.lollipops), '| rank:', await g(() => document.getElementById('rank').innerText.replace(/\n/g, ' ')));
// 3. push XP over the Intern threshold → PROMOTED banner
await g(() => { const ms = __game.missions; const def = ms.queue.find((d) => d.zone === 'park'); ms.queue.splice(ms.queue.indexOf(def), 1); const m = ms.spawnMission(def); m.misses = 0; __game.career.xp = 95; ms.complete(m); });
await page.waitForFunction(() => !document.getElementById('rank-banner').classList.contains('hidden'), { timeout: 30000 });
await wait(600);
await shot('4-promoted');
await page.waitForFunction(() => !__game.career.showing && !__game.career.queue.length, { timeout: 30000 });
// 4. end-of-shift report
await g(() => { __game.player.pos.set(20, 0, 30); __game.career.travel(800, false); __game.career.travel(1500, true); });
await g(() => __game.ui.onFinished());
await wait(1500);
await shot('5-report');
console.log('report:', await g(() => document.getElementById('end-stats').innerText.replace(/\n/g, ' ')));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
