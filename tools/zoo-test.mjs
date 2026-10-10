// Zoo tour: drive Zoo Road (timed), zoo gate + enclosures, monkey chase, rotating radar, big map + waypoint.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1000, height: 640 }, protocolTimeout: 240000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'networkidle0', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 120000 });
await page.click('#start');
const g = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: `.shots/zoo-${n}.png` });

// 1. drive from the parking spot to the zoo gate holding W (simulated 60 fps)
await g(() => { const a = __game.ambulance; __game.player.pos.copy(a.doorPoint); });
await wait(500);
await page.keyboard.press('KeyE');
await page.waitForFunction(() => __game.ambulance.driving, { timeout: 15000 }).catch(() => console.log('could not get in!'));
const drive = await g(() => {
  const a = __game.ambulance;
  const start = a.pos.clone();
  let t = 0;
  a.siren = true;
  while (a.pos.x < 136 && t < 30) { a.update(1 / 60, t, { throttle: 1, steer: 0 }); t += 1 / 60; }
  a.siren = false;
  return { from: start.toArray().map((v) => +v.toFixed(1)), to: a.pos.toArray().map((v) => +v.toFixed(1)), seconds: +t.toFixed(1), heading: +a.heading.toFixed(2) };
});
console.log('Zoo Road drive:', JSON.stringify(drive));
await g(() => { const a = __game.ambulance; a.pos.set(118, 0, -37); a.syncTransform(); __game.input.yaw = -Math.PI / 2; });
await wait(1500);
await shot('1-road-gate');
await page.keyboard.press('KeyE'); // stop & get out (speed was set by sim)
await g(() => { __game.ambulance.speed = 0; });
await page.keyboard.press('KeyE');
await wait(400);

// 2. fixed cameras around the zoo
const cam = (pos, look) => g(([pos, look]) => { __game.follow.update = () => { const c = __game.follow.camera; c.position.set(...pos); c.lookAt(...look); }; }, [pos, look]);
await g(() => { __game.player.pos.set(150, 0, -37); });
await wait(600);
for (const [name, pos, look] of [
  ['2-overview', [185, 75, 75], [185, 0, -2]],
  ['3-lions', [198, 7, -16], [212, 1.2, -24]],
  ['4-elephants', [196, 8, 14], [212, 1.5, 24]],
  ['5-giraffes', [172, 7, 16], [158, 3, 26]],
  ['6-penguins', [170, 5, -14], [160, 0.5, -21]],
  ['7-monkeys', [173, 6, -6], [185, 2, 2]],
  ['13-plaza', [158, 7, -28], [146, 0.5, -39]],
  ['14-foodcourt', [172, 6, -26], [172, 1, -40]],
  ['15-parking', [112, 9, -32], [124, 0.5, -46]],
  ['16-road-park', [-6, 9, -26], [10, 0.5, -38]],
]) {
  await cam(pos, look);
  await wait(1500);
  await shot(name);
}
// 3. monkey chase: spawn it, chase with the player, catch
await g(() => {
  const ms = __game.missions; const d = ms.queue.find((x) => x.id === 'monkey');
  if (d) { ms.queue.splice(ms.queue.indexOf(d), 1); ms.spawnMission(d); } // (it may already be loose)
  __game.follow.update = null; delete __game.follow.update;
});
await g(() => { const k = __game.missions.missions.find((m) => m.def.id === 'monkey').kid.root.position; __game.player.pos.set(k.x - 3, 0, k.z - 3); __game.input.yaw = 0.8; __game.input.distance = 9; });
await wait(1500);
await shot('8-monkey');
const monkeyMoved = await g(async () => {
  const k = __game.missions.missions.find((m) => m.def.id === 'monkey').kid.root.position.clone();
  await new Promise((r) => setTimeout(r, 1500));
  return +k.distanceTo(__game.missions.missions.find((m) => m.def.id === 'monkey').kid.root.position).toFixed(2);
});
console.log('monkey ran', monkeyMoved, 'units in 1.5s');

// 4. radar at two headings (north up vs east up) + big map with a waypoint
const radarShot = async (name, yaw) => {
  await g((yaw) => { __game.player.pos.set(20, 0, -20); __game.input.yaw = yaw; }, yaw);
  await wait(900);
  await page.screenshot({ path: `.shots/zoo-${name}.png`, clip: { x: 790, y: 0, width: 210, height: 260 } });
};
await radarShot('9-radar-north', 0);
await radarShot('10-radar-east', -Math.PI / 2);
await page.keyboard.press('KeyM');
await wait(800);
const open = await g(() => __game.bigMap.open);
// click on the zoo's elephant pen to set a waypoint
const pt = await g(() => { const r = document.getElementById('bigmap-canvas').getBoundingClientRect(); const [x, y] = __game.bigMap.toScreen(212, 24); return [r.left + x, r.top + y]; });
await page.mouse.click(pt[0], pt[1]);
await wait(500);
await shot('11-bigmap');
// zoom into the zoo on the big map
await g(() => { const m = __game.bigMap; const [x, y] = m.toScreen(185, 0); m.zoomAt(x, y, 2.6); });
await wait(500);
await shot('11b-bigmap-zoom');
const wp = await g(() => __game.hud.radar.waypoint);
await page.keyboard.press('KeyM');
await wait(800);
await shot('12-waypoint');
const info = await g(() => document.getElementById('waypoint-info').textContent);
console.log('map open:', open, '→ waypoint', JSON.stringify(wp), '→', info);
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
