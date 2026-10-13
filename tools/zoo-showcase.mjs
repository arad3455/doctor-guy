// Showcase shots of the zoo and Lakash: node tools/zoo-showcase.mjs [prefix]
import puppeteer from 'puppeteer-core';
const out = process.argv[2] ?? '.shots/zoo';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 600000 });
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await p.click('#start');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const g = (fn, a) => p.evaluate(fn, a);
await page_ready();
async function page_ready() { await wait(3000); await p.waitForFunction(() => __game.lakash?.cats.length === 6, { timeout: 60000 }).catch(() => {}); }
// hide the HUD for clean shots
await g(() => { document.getElementById('hud').style.visibility = 'hidden'; });
const shot = async (name, anchor, yaw, dist, pitch, settle = 9000) => {
  await g(([a, yaw, dist, pitch]) => { const G = __game; G.player.pos.set(a[0], 0, a[1]); G.player.rig.root.visible = false; G.input.yaw = yaw; G.input.distance = dist; G.input.pitch = pitch; }, [anchor, yaw, dist, pitch]);
  await wait(settle);
  await p.screenshot({ path: `${out}-${name}.png` });
};
const lakashAt = (kind) => g((kind) => { const G = __game, L = G.lakash; G.dayNight.hour = 10.5; L.lastPhase = 'rounds'; L.stopIndex = L.stops.findIndex((s) => s.kind === kind) - 1; L.task = null; L.nextStop(true); L.task.left = 999; const s = L.stops[L.stopIndex]; return [s.x, s.z, s.face]; }, kind);
// 1. feeding the capybaras
let s = await lakashAt('capybara');
await shot('feeding-capybaras', [s[0] - 0.5, s[1] - 1], s[2] + Math.PI + 0.6, 6.5, 0.3, 16000);
// 2. feeding the elephants (and the hippos in the pool)
s = await lakashAt('elephant');
await shot('feeding-elephants', [s[0], s[1] + 2], s[2] + Math.PI - 0.5, 9, 0.3, 16000);
// 3. the cat parade, walking to the next stop
await g(() => { const L = __game.lakash; L.task = null; L.nextStop(false); });
await wait(4000);
const lp = await g(() => { const L = __game.lakash; return [L.pos.x, L.pos.z, L.rig.root.rotation.y]; });
await shot('cat-parade', [lp[0], lp[1]], lp[2] + 2.4, 5.5, 0.28, 3000);
// 4. evening on the porch
await g(() => { __game.player.pos.set(0, 0, 0); __game.dayNight.hour = 19.2; });
await wait(3000);
const po = await g(() => { const P = __game.zoo.wing.porch; return [P.x, P.z]; });
await shot('porch-evening', [po[0] + 0.5, po[1] + 3], -0.3, 6, 0.18, 9000);
// 5. the lagoon from above, 6. savannah, 7. aviary
await g(() => { __game.dayNight.hour = 11; });
await shot('lagoon', [262, -14], 0.4, 20, 0.6);
await shot('savannah', [158, 20], 3.3, 15, 0.35);
await shot('aviary', [241, -35], -1.4, 7, 0.28);
console.log('ERRORS:', errors.length ? errors : 'none');
await b.close();
