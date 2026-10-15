// Lane keeping: on Zoo Road, start off-centre and crooked, hold the gas with no steering → the van settles into
// the middle of the right-hand lane. Also checks the wider asphalt counts as road (top speed) out to the kerb.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 600000 });
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await p.click('#start');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const g = (fn, a) => p.evaluate(fn, a);
await wait(2000);
const r = {};
r.onRoadEdge = await g(async () => { const S = await import('/src/streets.js'); return [S.onRoad(30, -37 + 3.7), S.onRoad(30, -37 - 3.7), S.onRoad(30, -37 + 4.6)]; });
// lane centre heading east on Zoo Road (z = -37): z = -35
await g(() => { const G = __game, a = G.ambulance; a.driving = true; document.documentElement.classList.add('driving'); a.pos.set(-8, 0, -36.5); a.heading = Math.PI / 2 + 0.12; a.speed = 8; a.syncTransform(); });
r.start = await g(() => ({ z: +__game.ambulance.pos.z.toFixed(2), h: +__game.ambulance.heading.toFixed(3) }));
await p.keyboard.down('KeyW');
await p.waitForFunction(() => __game.ambulance.pos.x > 45, { timeout: 120000, polling: 200 }).catch(() => {});
await p.keyboard.up('KeyW');
r.end = await g(() => ({ x: +__game.ambulance.pos.x.toFixed(1), z: +__game.ambulance.pos.z.toFixed(2), h: +__game.ambulance.heading.toFixed(3), assist: +(__game.ambulance.assist ?? 0).toFixed(3) }));
r.inLane = Math.abs(r.end.z - (-35)) < 0.6 && Math.abs(r.end.h - Math.PI / 2) < 0.06;
await p.screenshot({ path: '.shots/lane-test.png' });
console.log(JSON.stringify(r, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await b.close();
