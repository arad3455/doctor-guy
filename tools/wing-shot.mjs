// Lakash's wing of the zoo: node tools/wing-shot.mjs [prefix]  (views of the lagoon, tortoises, flamingos, meerkats, cottage)
import puppeteer from 'puppeteer-core';
const out = process.argv[2] ?? '.shots/wing';
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
await g(() => { __game.dayNight.hour = 11; });
// (the camera sits at (sin yaw, cos yaw) from its anchor: yaw 0 = south of it, π/2 = east)
const view = async (name, x, z, yaw, dist, pitch) => {
  await g(([x, z, yaw, dist, pitch]) => { const G = __game; G.player.pos.set(x, 0, z); G.player.rig.root.visible = false; G.input.yaw = yaw; G.input.distance = dist; G.input.pitch = pitch; }, [x, z, yaw, dist, pitch]);
  await wait(+(process.env.SETTLE ?? 7000));
  await p.screenshot({ path: `${out}-${name}.png` });
};
const views = JSON.parse(process.env.VIEWS ?? 'null') ?? [
  ['arch', 230, 3, -1.57, 9, 0.18],
  ['lagoon', 262, -2, 0.25, 12, 0.42],
  ['capys', 258, -14, 0.5, 5.5, 0.3],
  ['tortoise', 250, 14, Math.PI + 0.2, 8, 0.35],
  ['flamingo', 278, 15, Math.PI - 0.2, 9, 0.3],
  ['meerkat', 280, -12, -1.2, 6, 0.3],
  ['cottage', 282, -28, 0.3, 11, 0.3],
];
for (const v of views) await view(...v);
console.log('ERRORS:', errors.length ? errors : 'none');
await b.close();
