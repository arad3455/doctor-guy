// Downtown: drive Main Street west from the park into the city, location names, walls, lollipops, missions, map.
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
// 1. get in the ambulance at the hospital and head west down Main Street
await g(() => { const a = __game.ambulance; a.pos.set(-10, 0, -37); a.heading = -Math.PI / 2; a.update(1 / 60, 0, {}); a.syncTransform(); __game.player.pos.copy(a.doorPoint); });
await wait(800);
r.prompt = await g(() => document.getElementById('prompt').textContent);
await page.keyboard.press('KeyE');
await page.waitForFunction(() => __game.ambulance.driving, { timeout: 8000 }).catch(() => {});
r.driving = await g(() => __game.ambulance.driving);
r.westGate = await drive(1, 0, 4);
r.mainStreet = await drive(1, 0, 6);
await wait(1500);
r.location = await g(() => document.getElementById('location').textContent);
await page.screenshot({ path: '.shots/dt-1-mainstreet.png' });
// 2. turn north at the plaza avenue? just keep to the end of Main Street (should stop at the city edge, not leave)
r.end = await drive(1, 0, 10);
await drive(-1, 0, 1.5); await drive(0, 0, 2);
await page.keyboard.press('KeyE');
await wait(800);
r.out = await g(() => !__game.ambulance.driving);
// 3. walking into a building is blocked; plaza location name
await g(() => { __game.player.pos.set(-132.5, 0, -2); });
await wait(1200);
r.plazaName = await g(() => document.getElementById('location').textContent);
r.zone = await g(() => document.querySelector('#toast')?.textContent ?? '');
await page.screenshot({ path: '.shots/dt-2-plaza.png' });
r.wall = await g(() => {
  const b = __game.downtown.group; // walk into the first tower block from the street
  const p = __game.player;
  p.pos.set(-90.5, 0, -82); // the north cross street, facing the tower block (south)
  const fake = { ...__game.input, enabled: true, down: (...c) => c.includes('KeyW'), hit: () => false, yaw: Math.PI, stick: { x: 0, y: 0 } };
  for (let i = 0; i < 240; i++) p.update(1 / 60, i / 60, fake);
  return p.pos.toArray().map((v) => +v.toFixed(1));
});
// 4. lollipops are not inside anything; mission kids reachable
r.badPops = await g(() => {
  const cs = __game.missions.scene ? [] : [];
  return __game.missions.pops.filter((p) => p.position.x < -20 && document && (() => {
    const { x, z } = p.position;
    return (window.__colliders ?? []).some(() => false);
  })()).length;
});
// 5. big map
await g(() => { __game.bigMap.toggle(true); });
await wait(800);
await page.screenshot({ path: '.shots/dt-3-bigmap.png' });
await g(() => { __game.bigMap.zoom = 3; __game.bigMap.center = { x: -132, z: -16 }; __game.bigMap.draw(); });
await wait(500);
await page.screenshot({ path: '.shots/dt-4-bigmap-zoom.png' });
await g(() => __game.bigMap.toggle(false));
console.log(JSON.stringify(r, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
