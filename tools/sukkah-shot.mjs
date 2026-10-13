// Caspi and his dad building the sukkah (day) and having dinner in it (night): node tools/sukkah-shot.mjs [prefix]
import puppeteer from 'puppeteer-core';
const out = process.argv[2] ?? '.shots/sukkah';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 600000 });
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await p.click('#start');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(1500);
const g = (fn, a) => p.evaluate(fn, a);
const view = async (name, px, pz, yaw, dist = 7, pitch = 0.32) => {
  await g(([px, pz, yaw, dist, pitch]) => { const G = __game; G.player.pos.set(px, 0, pz); G.player.rig.root.visible = false; /* the camera anchor, out of shot */ G.input.yaw = yaw; G.input.distance = dist; G.input.pitch = pitch; }, [px, pz, yaw, dist, pitch]);
  await wait(+(process.env.SETTLE ?? 9000)); // headless renders this scene at a few fps: let poses blend in
  await p.screenshot({ path: `${out}-${name}.png` });
};
const S = await g(() => { const s = __game.caspi.sukkah; return { x: s.x, z: s.z, dad: s.dad, caspi: s.caspi }; });
console.log('sukkah', JSON.stringify(S));
await g(() => { __game.dayNight.hour = 11; });
await wait(800);
// (the camera sits at (sin yaw, cos yaw) from its anchor: yaw 0 = south of it, π/2 = east)
await view('day-front', S.x + 0.3, S.z + 2.0, 0.35, 6, 0.22);
await view('day-work', S.x + 2.6, S.z + 0.4, 0.95, 4.2, 0.12);
await view('day-hammer', S.dad.x - 0.3, S.dad.z, 2.3, 3.0, 0.1);
console.log('hammer', JSON.stringify(await g(() => { const d = __game.caspi.dad; const h = d.bone(/^RightHand$/i).getWorldPosition(d.hammer.position.clone()); return { hammer: d.hammer.position.toArray().map((v) => +v.toFixed(2)), hand: h.toArray().map((v) => +v.toFixed(2)), vis: d.hammer.visible, parent: d.hammer.parent?.type }; })));
const state = await g(() => { const c = __game.caspi; return { caspi: c.posing, dad: c.dad.posing, cpos: c.pos.toArray().map((v) => +v.toFixed(2)), dpos: c.dad.root.position.toArray().map((v) => +v.toFixed(2)), hammer: c.dad.hammer.visible }; });
console.log('day', JSON.stringify(state));
// evening: away from home when the clock turns, so they're already at the table when we come back
await g(() => { __game.player.pos.set(0, 0, 0); });
await wait(1500);
await g(() => { __game.dayNight.hour = 21.5; });
await wait(1500);
await view('night', S.x + 0.2, S.z + 1.0, 0.15, 4.4, 0.16);
console.log('night', JSON.stringify(await g(() => { const c = __game.caspi; return { caspi: c.posing, dad: c.dad.posing, cy: +c.pos.y.toFixed(2), dy: +c.dad.root.position.y.toFixed(2) }; })));
console.log('ERRORS:', errors.length ? errors : 'none');
await b.close();
