// Wolfson Airport: drive north up Airport Road to Departures, names, the jet takes off, screenshots + map.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 600000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await page.click('#start');
const g = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const drive = (throttle, steer, seconds) => g(([throttle, steer, seconds]) => {
  const { ambulance } = __game;
  for (let i = 0; i < seconds * 60; i++) ambulance.update(1 / 60, i / 60, { throttle, steer });
  return { pos: ambulance.pos.toArray().map((v) => +v.toFixed(1)), speed: +ambulance.speed.toFixed(1) };
}, [throttle, steer, seconds]);
const r = {};
await g(() => { const a = __game.ambulance; a.pos.set(-111.5, 0, -50); a.heading = Math.PI; a.update(1 / 60, 0, {}); a.syncTransform(); __game.player.pos.copy(a.doorPoint); });
await wait(800);
await page.keyboard.press('KeyE');
await page.waitForFunction(() => __game.ambulance.driving, { timeout: 30000 }).catch(() => {});
r.driving = await g(() => __game.ambulance.driving);
r.north = await drive(1, 0, 6);
r.name = await g(() => __game.world.locationName(__game.ambulance.pos));
await drive(-1, 0, 1.5); await drive(0, 0, 2);
await page.keyboard.press('KeyE');
await wait(1200);
// jump the jet's clock to its take-off roll and look at it from the apron
const t = await g(() => { const j = __game.airport.animated.at(-1); return 0; });
await g(() => {
  __game.player.pos.set(-60, 0, -170);
  __game.follow.update = () => { const c = __game.follow.camera, j = __game.airport.jet; c.position.set(-40, 6, -170); c.lookAt(j ? j.position : new c.position.constructor(-100, 3, -192)); };
});
// advance the animation to t = 46 s (rotating off the runway)
await g(() => __game.airport.jetAt(47));
await g(() => new Promise((res) => { let n = 0; const f = () => (++n >= 3 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
r.jet = await g(() => { const j = __game.airport.jet; return j ? j.position.toArray().map((v) => +v.toFixed(1)) : null; });
await page.screenshot({ path: '.shots/airport-1-takeoff.png' });
await g(() => { delete __game.follow.update; __game.bigMap.toggle(true); __game.bigMap.zoom = 2; __game.bigMap.center = { x: -108, z: -155 }; __game.bigMap.draw(); });
await wait(800);
await page.screenshot({ path: '.shots/airport-2-map.png' });
console.log(JSON.stringify(r, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
