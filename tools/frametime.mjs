// Average frame time at a spot, with features toggled: node tools/frametime.mjs x z
import puppeteer from 'puppeteer-core';
const [x = 0, z = 0] = process.argv.slice(2).map(Number);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 960, height: 540 }, protocolTimeout: 300000 });
const p = await b.newPage();
await p.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await p.click('#start');
await p.evaluate(([x, z]) => { __game.player.pos.set(x, 0, z); }, [x, z]);
const measure = () => p.evaluate(() => new Promise((res) => {
  const ts = []; let last = performance.now();
  const f = (now) => { ts.push(now - last); last = now; if (ts.length < 12) requestAnimationFrame(f); else res(Math.round(ts.slice(2).reduce((a, b2) => a + b2, 0) / (ts.length - 2))); };
  requestAnimationFrame(f);
}));
const out = {};
await measure();
out.base = await measure();
await p.evaluate(() => { __game.weather.startShower(999); __game.weather.shower.t = 10; });
out.raining = await measure();
await p.evaluate(() => { __game.weather.shower = null; __game.weather.rain = 0; });
await p.evaluate(() => { __game.bandages.group.visible = false; __game.bandages.update = () => {}; });
out.noBandages = await measure();
await p.evaluate(() => { __game.hud.radar.waypoint = { x: 120, z: 150, label: 'w' }; });
out.gpsRoute = await measure();
await p.evaluate(() => { __game.hud.radar.waypoint = null; __game.hud.radar.gps = null; });
out.noGps = await measure();
console.log(JSON.stringify(out));
await b.close();
