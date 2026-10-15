// Road look check: driving views + a top-down of a junction. node tools/road-shots.mjs [prefix]
import puppeteer from 'puppeteer-core';
const out = process.argv[2] ?? '.shots/roads';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 600000 });
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await p.click('#start');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const g = (fn, a) => p.evaluate(fn, a);
await wait(2500);
await g(() => { document.getElementById('hud').style.visibility = 'hidden'; __game.dayNight.hour = 11; });
// in the ambulance at a spot, heading, camera behind
const drive = async (name, x, z, heading, settle = 6000) => {
  await g(([x, z, h]) => { const G = __game, a = G.ambulance; a.driving = true; a.pos.set(x, 0, z); a.heading = h; a.speed = 0; a.syncTransform(); G.player.rig.root.visible = false; document.documentElement.classList.add('driving'); }, [x, z, heading]);
  await wait(settle);
  await p.screenshot({ path: `${out}-${name}.png` });
};
const views = JSON.parse(process.env.VIEWS ?? 'null') ?? [
  ['zoo-road', 40, -38.75, Math.PI / 2],
  ['downtown', -90, -38.75, -Math.PI / 2],
  ['suburbs', 86.25, 10, Math.PI],
  ['harbor', -111.5 + 1.75, 70, 0],
];
for (const v of views) await drive(...v);
// top-down over a downtown junction
await g(() => { const G = __game; G.ambulance.driving = false; document.documentElement.classList.remove('driving'); G.player.pos.set(-111.5, 0, -37); G.input.yaw = 0; G.input.pitch = 1.45; G.input.distance = 30; });
await wait(5000);
await p.screenshot({ path: `${out}-topdown.png` });
console.log('ERRORS:', errors.length ? errors : 'none');
await b.close();
