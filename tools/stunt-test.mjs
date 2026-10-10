// Stunt jumps: drive at each ramp with W held → airborne (slow-mo, cinematic cam) → land → STUNT banner.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1100, height: 620 }, protocolTimeout: 300000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await page.click('#start');
const g = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// get in the ambulance
await g(() => { const a = __game.ambulance; __game.player.pos.copy(a.doorPoint); });
await wait(500);
await page.keyboard.press('KeyE');
await page.waitForFunction(() => __game.ambulance.driving, { timeout: 15000 }).catch(() => console.log('could not get in!'));
const results = [];
for (const [i, r] of (await g(() => __game.ramps)).entries()) {
  // line up 26 m before the ramp, pointing at it, already rolling
  await g((r) => {
    const a = __game.ambulance;
    a.heading = r.heading; a.speed = 12; a.air = null; a.y = 0;
    a.pos.set(r.x - Math.sin(r.heading) * 26, 0, r.z - Math.cos(r.heading) * 26);
    a.syncTransform();
    __game.input.yaw = r.heading + Math.PI;
  }, r);
  await page.keyboard.down('KeyW');
  const launched = await page.waitForFunction(() => !!__game.ambulance.air, { timeout: 90000, polling: 50 }).then(() => true).catch(() => false);
  if (launched) { await wait(250); await page.screenshot({ path: `.shots/stunt-${i}-air.png` }); }
  const peak = await g(() => __game.ambulance.y);
  await page.waitForFunction(() => !__game.ambulance.air, { timeout: 90000 }).catch(() => {});
  await page.keyboard.up('KeyW');
  await g(() => { __game.ambulance.speed = 0; });
  await page.waitForFunction(() => __game.career.showing, { timeout: 15000 }).catch(() => {});
  await wait(2200);
  await page.screenshot({ path: `.shots/stunt-${i}-banner.png` });
  results.push({ ramp: r.name, launched, peakAboveRamp: +peak.toFixed(2), banner: await g(() => document.querySelector('#saved-banner .sb-title').textContent) });
  await page.waitForFunction(() => !__game.career.showing && !__game.career.queue.length, { timeout: 60000 }).catch(() => {});
}
console.log(JSON.stringify({ results, stunts: await g(() => __game.progress.data.stunts && Object.keys(__game.progress.data.stunts)), ach: await g(() => ['daredevil', 'stunt-master'].map((id) => __game.progress.has(id))) }, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
