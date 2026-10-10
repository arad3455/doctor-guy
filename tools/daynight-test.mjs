// Day/night: the same park view at noon, sunset (poster colours) and night; the ambulance at night.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 960, height: 540 }, protocolTimeout: 240000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 120000 });
await page.click('#start');
const g = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [name, hour, pos, yaw] of [['noon', 12, [0, -10], 0.6], ['sunset', 19, [0, -10], 0.6], ['night', 22.5, [0, -10], 0.6], ['night-ambulance', 22.5, [-12, -28], Math.PI * 0.75]]) {
  await g(([hour, pos, yaw]) => { __game.dayNight.hour = hour; __game.player.pos.set(pos[0], 0, pos[1]); __game.input.yaw = yaw; __game.input.pitch = 0.18; __game.input.distance = 10; }, [hour, pos, yaw]);
  await wait(1800);
  await page.screenshot({ path: `.shots/dn-${name}.png` });
  console.log(name, await g(() => document.getElementById('clock').textContent));
}
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
