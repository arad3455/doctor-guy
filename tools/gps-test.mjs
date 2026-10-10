// GPS: routes from the park to Downtown, the camp and the pier: every point walkable, mostly on roads; screenshots.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 240000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'networkidle0', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 120000 });
await page.click('#start');
const g = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const r = await g(() => {
  const gps = __game.gps, W = __game.world;
  const t0 = performance.now();
  gps.build();
  const buildMs = Math.round(performance.now() - t0);
  const trips = { downtown: [[0, 0], [-132, -2]], camp: [[0, 0], [40, -146]], pier: [[-132, -2], [123, 150]], harbor: [[100, 30], [-140, 108]] };
  const out = { buildMs };
  for (const [name, [a, b]] of Object.entries(trips)) {
    const t1 = performance.now();
    const route = gps.route({ x: a[0], z: a[1] }, { x: b[0], z: b[1] });
    const ms = Math.round(performance.now() - t1);
    if (!route) { out[name] = 'NO ROUTE'; continue; }
    let len = 0, onRoad = 0, bad = 0;
    for (let i = 1; i < route.length; i++) {
      const p = route[i - 1], q = route[i], d = Math.hypot(q.x - p.x, q.z - p.z);
      len += d;
      for (let k = 0; k < d; k += 1.5) {
        const x = p.x + (q.x - p.x) * k / d, z = p.z + (q.z - p.z) * k / d;
        if (gps.roads.some((rr) => x >= rr.x0 && x <= rr.x1 && z >= rr.z0 && z <= rr.z1)) onRoad += 1.5;
        const c = { x, z }; W.clampWalkable(c); if (Math.hypot(c.x - x, c.z - z) > 2) bad++;
      }
    }
    out[name] = { points: route.length, length: Math.round(len), straight: Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])), roadShare: +(onRoad / len).toFixed(2), offWalkable: bad, ms };
  }
  return out;
});
// radar + big map with a waypoint at City Plaza, standing in the park
await g(() => { __game.player.pos.set(10, 0, -10); __game.hud.radar.waypoint = { x: -132, z: -2, label: 'Waypoint' }; });
await wait(2000);
await page.screenshot({ path: '.shots/gps-1-radar.png', clip: { x: 1060, y: 0, width: 220, height: 230 } });
await g(() => __game.bigMap.toggle(true));
await wait(1000);
await page.screenshot({ path: '.shots/gps-2-map.png' });
console.log(JSON.stringify(r, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
