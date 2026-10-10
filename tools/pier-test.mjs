// Maple Heights + Sunset Pier: drive Zoo Road → Maple Lane → the pier car park; walk the pier (dry, not wading);
// the sea beside the pier is still off-limits; zone names; screenshots + the big map.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 240000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 120000 });
await page.click('#start');
const g = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const drive = (throttle, steer, seconds) => g(([throttle, steer, seconds]) => {
  const { ambulance } = __game;
  for (let i = 0; i < seconds * 60; i++) ambulance.update(1 / 60, i / 60, { throttle, steer });
  return { pos: ambulance.pos.toArray().map((v) => +v.toFixed(1)), heading: +ambulance.heading.toFixed(2), speed: +ambulance.speed.toFixed(1) };
}, [throttle, steer, seconds]);
const r = {};
// 1. in the ambulance at the top of Maple Lane, pointing south
await g(() => { const a = __game.ambulance; a.pos.set(84.5, 0, -37); a.heading = 0; a.update(1 / 60, 0, {}); a.syncTransform(); __game.player.pos.copy(a.doorPoint); });
await wait(800);
await page.keyboard.press('KeyE');
await page.waitForFunction(() => __game.ambulance.driving, { timeout: 8000 }).catch(() => {});
r.driving = await g(() => __game.ambulance.driving);
r.mapleLane = await drive(1, 0, 4);
await wait(1200);
r.name1 = await g(() => document.getElementById('location').textContent);
await page.screenshot({ path: '.shots/pier-1-maple.png' });
r.toCarPark = await drive(1, 0, 4);
await drive(-1, 0, 1.2); await drive(0, 0, 1.5);
await wait(1200);
r.name2 = await g(() => document.getElementById('location').textContent);
// 2. drive the pier: line up at its land end, pointing south, and go
await g(() => { const a = __game.ambulance; a.pos.set(123, 0, 104); a.heading = 0; a.speed = 0; a.update(1 / 60, 0, {}); a.syncTransform(); });
r.pierDrive = await drive(1, 0, 7);
await wait(1200);
r.name3 = await g(() => document.getElementById('location').textContent);
await page.screenshot({ path: '.shots/pier-2-ondeck.png' });
// 3. steer off the side of the pier → stays on the deck
r.offSide = await drive(1, 1, 2);
await drive(-1, 0, 1.2); await drive(0, 0, 2);
await page.keyboard.press('KeyE');
await wait(1500);
r.out = await g(() => !__game.ambulance.driving);
// 4. walking on the pier: not wading
r.dry = await g(() => { const p = __game.player; p.pos.set(123, 0, 150); return !__game.world.inWater(123, 150); });
r.seaBeside = await g(() => __game.world.inWater(110, 150));
await g(() => { __game.player.pos.set(123, 0, 160); __game.input.yaw = Math.PI; });
await wait(1500);
await page.screenshot({ path: '.shots/pier-3-walk.png' });
// 5. the funfair, and the big map
await g(() => { __game.player.pos.set(118, 0, 86); __game.input.yaw = -2.4; __game.input.distance = 12; __game.input.pitch = 0.3; });
await wait(2000);
r.name4 = await g(() => document.getElementById('location').textContent);
await page.screenshot({ path: '.shots/pier-4-fair.png' });
await g(() => { __game.bigMap.toggle(true); });
await wait(800);
await page.screenshot({ path: '.shots/pier-5-bigmap.png' });
await g(() => { __game.bigMap.zoom = 2.6; __game.bigMap.center = { x: 110, z: 60 }; __game.bigMap.draw(); });
await wait(500);
await page.screenshot({ path: '.shots/pier-6-bigmap-zoom.png' });
await g(() => __game.bigMap.toggle(false));
console.log(JSON.stringify(r, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
