// Joystick driving: stick right / left / up / back must all move the van (regression for the sideways bug)
import puppeteer, { KnownDevices } from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], protocolTimeout: 240000 });
const page = await browser.newPage();
await page.emulate(KnownDevices['iPhone 13 landscape']);
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'networkidle0', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 120000 });
const tap = async (sel) => { const b = await (await page.$(sel)).boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
await tap('#start');
await new Promise((r) => setTimeout(r, 600));
await page.evaluate(() => { const a = __game.ambulance; a.pos.set(10, 0, 5); a.heading = 0; a.syncTransform(); __game.player.pos.copy(a.doorPoint); });
await new Promise((r) => setTimeout(r, 500));
await tap('#btn-action');
await new Promise((r) => setTimeout(r, 500));
const st = await (await page.$('#stick')).boundingBox();
const cx = st.x + st.width / 2, cy = st.y + st.height / 2;
const results = {};
for (const [name, dx, dy] of [['right', 1, 0], ['left', -1, 0], ['up', 0, -1], ['back', 0, 1]]) {
  await page.evaluate(() => { const a = __game.ambulance; a.pos.set(60, 0, -37); a.heading = Math.PI / 2; a.speed = 0; a.syncTransform(); __game.input.yaw = -Math.PI / 2; });
  await page.touchscreen.touchStart(cx, cy);
  await page.touchscreen.touchMove(cx + dx * st.width * 0.45, cy + dy * st.height * 0.45);
  await new Promise((r) => setTimeout(r, 4000));
  await page.touchscreen.touchEnd();
  results[name] = await page.evaluate(() => { const a = __game.ambulance; return { moved: +Math.hypot(a.pos.x - 60, a.pos.z + 37).toFixed(2), heading: +a.heading.toFixed(2), speed: +a.speed.toFixed(2), x: +a.pos.x.toFixed(1), z: +a.pos.z.toFixed(1) }; });
}
console.log(JSON.stringify(results, null, 1));
await browser.close();
