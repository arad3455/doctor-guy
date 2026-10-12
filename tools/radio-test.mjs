// Radio: hidden on foot; in the ambulance R steps through the stations (notes get scheduled), and back off.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 600000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await page.click('#start');
const g = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const r = {};
r.btnOnFoot = await g(() => document.getElementById('radio-btn').style.display);
await g(() => { const a = __game.ambulance; a.update(1 / 60, 0, {}); __game.player.pos.copy(a.doorPoint); });
await wait(800);
await page.keyboard.press('KeyE');
await page.waitForFunction(() => __game.ambulance.driving, { timeout: 30000 }).catch(() => {});
await wait(800);
r.btnDriving = await g(() => document.getElementById('radio-btn').style.display);
r.stations = [];
for (let i = 0; i < 4; i++) {
  await page.keyboard.press('KeyR');
  await wait(1500);
  r.stations.push(await g(() => ({ name: __game.radio.name, steps: __game.radio.step, toast: (__game.notices ?? []).slice(-3).join(' | ') })));
}
await page.keyboard.press('KeyR'); // Pop FM on again, then get out → it stops
await wait(800);
await page.keyboard.press('KeyE');
await wait(1500);
const s0 = await g(() => __game.radio.step);
await wait(1500);
r.silentOnFoot = (await g(() => __game.radio.step)) === s0;
r.btnAfter = await g(() => document.getElementById('radio-btn').style.display);
console.log(JSON.stringify(r, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
