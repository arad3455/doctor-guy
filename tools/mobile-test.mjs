// Phone smoke test with real touch events: node tools/mobile-test.mjs (dev server on :8765)
import puppeteer, { KnownDevices } from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const OUT = new URL('../.shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const results = {};

for (const [label, device] of [['landscape', KnownDevices['iPhone 13 landscape']], ['portrait', KnownDevices['iPhone 13']]]) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(`${label}: ${e}`));
  page.on('console', (m) => m.type() === 'error' && !/favicon/.test(m.text()) && errors.push(`${label}: ${m.text()}`));
  await page.emulate(device);
  await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 60000 });
  const shot = (n) => page.screenshot({ path: `${OUT}mobile-${label}-${n}.png` });
  await shot('1-title');
  results[label] = { touchClass: await page.evaluate(() => document.documentElement.classList.contains('touch')) };

  // tap Start
  const start = await page.$('#start');
  const sb = await start.boundingBox();
  await page.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await wait(1200);
  await shot('2-hud');

  // push the joystick up (forward) for 1.5s
  const before = await page.evaluate(() => __game.player.pos.toArray());
  const st = await (await page.$('#stick')).boundingBox();
  const cx = st.x + st.width / 2, cy = st.y + st.height / 2;
  await page.touchscreen.touchStart(cx, cy);
  await page.touchscreen.touchMove(cx, cy - st.height * 0.48);
  await wait(1500);
  await shot('3-moving');
  await page.touchscreen.touchEnd();
  const after = await page.evaluate(() => __game.player.pos.toArray());
  results[label].moved = +Math.hypot(after[0] - before[0], after[2] - before[2]).toFixed(2);

  // drag on the right side of the screen to look around
  const yaw0 = await page.evaluate(() => __game.input.yaw);
  const vw = device.viewport.width, vh = device.viewport.height;
  await page.touchscreen.touchStart(vw * 0.7, vh * 0.4);
  await page.touchscreen.touchMove(vw * 0.55, vh * 0.4);
  await page.touchscreen.touchEnd();
  results[label].looked = +(await page.evaluate(() => __game.input.yaw) - yaw0).toFixed(2);

  // walk up to Ido (scraped knee) and tap the ✋ button
  await page.evaluate(() => { const ms = __game.missions; while (ms.queue.length && !ms.missions.length) ms.spawnMission(ms.queue.shift()); __game.player.pos.set(15, 0, 11.5); });
  await wait(500);
  results[label].actionReady = await page.evaluate(() => document.getElementById('btn-action').classList.contains('ready'));
  const ab = await (await page.$('#btn-action')).boundingBox();
  await page.touchscreen.tap(ab.x + ab.width / 2, ab.y + ab.height / 2);
  await page.waitForFunction(() => __game.minigame.active, { timeout: 6000 }).catch(() => {});
  await wait(200);
  await shot('4-minigame');
  results[label].minigame = await page.evaluate(() => __game.minigame.active);
  for (let i = 0; i < 4 && (await page.evaluate(() => __game.minigame.active)); i++) {
    await page.evaluate(() => { const m = __game.minigame; m.pos = m.zoneX + m.zoneW / 2; m.dir = 0; });
    await page.touchscreen.tap(vw / 2, vh * 0.3);
    await wait(200);
  }
  await page.waitForFunction(() => !__game.missions.busy, { timeout: 8000 }).catch(() => {});
  await wait(400);
  await shot('5-rescued');
  results[label].rescued = await page.evaluate(() => __game.missions.rescued);
  results[label].fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 1000 ? requestAnimationFrame(f) : r(n); }; requestAnimationFrame(f); }));
  await page.close();
}
console.log(JSON.stringify(results, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
