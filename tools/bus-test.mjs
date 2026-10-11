// Buses: every stop is clear + walkable; E at the park stop opens the menu; only visited areas are offered;
// riding to City Plaza costs 2 lollipops and drops you at the Downtown stop.
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
const r = {};
r.stops = await g(async () => {
  const { STOPS } = await import('/src/bus.js');
  const W = __game.world;
  return STOPS.map((s) => { const p = { x: s.board.x, z: s.board.z }; W.clampWalkable(p); return `${s.zone}:${s.x.toFixed(1)},${s.z.toFixed(1)}${Math.hypot(p.x - s.board.x, p.z - s.board.z) > 0.01 ? ' ARRIVAL-NOT-WALKABLE' : ''}`; });
});
await g(() => { __game.missions.lollipops = 10; __game.progress.data.visited = { park: true, downtown: true }; });
await g(async () => { const { STOPS } = await import('/src/bus.js'); const s = STOPS[0]; __game.player.pos.set(s.x - 1, 0, s.z + 1); });
await wait(1200);
r.prompt = await g(() => document.getElementById('prompt').textContent);
await page.keyboard.press('KeyE');
await page.waitForFunction(() => __game.buses.open, { timeout: 30000 }).catch(() => {});
r.menu = await g(() => [...document.querySelectorAll('#bus-list button')].map((b) => `${b.disabled ? '-' : '+'}${b.innerText.replace(/\s+/g, ' ')}`));
await page.screenshot({ path: '.shots/bus-1-menu.png' });
await page.click('#bus-list button:not([disabled])');
await wait(2500);
r.after = await g(() => ({ pos: __game.player.pos.toArray().map((v) => +v.toFixed(1)), pops: __game.missions.lollipops, where: __game.world.locationName(__game.player.pos), open: __game.buses.open }));
await page.screenshot({ path: '.shots/bus-2-arrived.png' });
// at every stop, E offers the bus (nothing else steals the action)
r.promptAt = {};
for (const zone of ['park', 'beach', 'zoo', 'downtown', 'suburbs', 'pier', 'camp', 'harbor', 'airport']) {
  await g(async (zone) => { const { STOPS } = await import('/src/bus.js'); const s = STOPS.find((x) => x.zone === zone); __game.player.pos.set(s.board.x, 0, s.board.z); }, zone);
  await wait(900);
  r.promptAt[zone] = await g(() => document.getElementById('prompt').textContent);
}
console.log(JSON.stringify(r, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
