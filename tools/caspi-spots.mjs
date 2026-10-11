// Caspi's day: jump the clock to each part of his routine and photograph him at that spot.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 960, height: 540 }, protocolTimeout: 600000 });
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await p.click('#start');
const out = [];
for (const [hour, name] of [[8, 'cafe'], [18.5, 'pier'], [22.5, 'camp']]) {
  // move the player far away first so he "teleports" to his next spot, then come and look
  await p.evaluate((hour) => { __game.player.pos.set(0, 0, 120 * (Math.random() > 0.5 ? 1 : -1)); __game.dayNight.hour = hour; }, hour);
  await p.waitForFunction((hour) => { const c = __game.caspi; const s = c.spotFor(hour); return c.spot === s && !c.route && Math.hypot(c.pos.x - s.x, c.pos.z - s.z) < 1; }, { timeout: 120000, polling: 500 }, hour).catch(() => console.log('did not settle at', hour));
  const info = await p.evaluate(() => {
    const c = __game.caspi, cp = c.pos;
    __game.player.pos.set(cp.x + 4, 0, cp.z + 4);
    __game.follow.update = () => { const cam = __game.follow.camera; cam.position.set(cp.x + 5, 2.6, cp.z + 5); cam.lookAt(cp.x, 1, cp.z); };
    document.getElementById('hud').style.display = 'none';
    return { spot: c.spot.name, pos: [+cp.x.toFixed(1), +cp.z.toFixed(1)], where: __game.world.locationName(cp) };
  });
  await new Promise((r) => setTimeout(r, 2500));
  await p.screenshot({ path: `.shots/caspi-day-${name}.png` });
  out.push({ hour, ...info });
}
console.log(JSON.stringify(out, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await b.close();
