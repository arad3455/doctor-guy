// Golden Bandages + weather: grab one bandage (counter, lollipops, saved), make it rain, then the rainbow.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 300000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await page.click('#start');
const g = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const r = {};
r.total = await g(() => __game.bandages.items.length);
const pops0 = await g(() => __game.missions.lollipops);
await g(() => { const it = __game.bandages.items[2]; __game.player.pos.set(it.g.position.x + 1, 0, it.g.position.z); });
await page.waitForFunction(() => __game.bandages.count >= 1, { timeout: 30000 }).catch(() => {});
r.found = await g(() => __game.bandages.count);
r.popsGained = (await g(() => __game.missions.lollipops)) - pops0;
r.toast = await g(() => document.querySelector('#toast')?.innerText ?? '');
await wait(1500);
r.saved = await g(() => { __game.progress.save(true); return Object.keys(JSON.parse(localStorage.getItem('doctorguy.save.v1')).bandages ?? {}).length; });
// rain
await g(() => { __game.player.pos.set(0, 0, 10); __game.input.yaw = Math.PI; __game.input.distance = 10; __game.weather.startShower(60); __game.weather.shower.t = 10; });
await g(() => new Promise((res) => { let n = 0; const f = () => (++n >= 4 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
r.rain = await g(() => +__game.weather.rain.toFixed(2));
await page.screenshot({ path: '.shots/weather-1-rain.png' });
// clear up → rainbow
await g(() => { const w = __game.weather; w.shower.length = w.shower.t + 0.5; });
await page.waitForFunction(() => __game.weather.rainbow.visible, { timeout: 30000 }).catch(() => {});
await wait(5000);
r.rainbow = await g(() => __game.weather.rainbow.visible);
await g(() => {
  __game.follow.update = () => {
    const c = __game.follow.camera, rb = __game.weather.rainbow.position, p = __game.player.pos;
    c.position.set(p.x, 3, p.z); c.lookAt(rb.x, 60, rb.z);
  };
});
await g(() => new Promise((res) => { let n = 0; const f = () => (++n >= 4 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
await page.screenshot({ path: '.shots/weather-2-rainbow.png' });
console.log(JSON.stringify(r, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
