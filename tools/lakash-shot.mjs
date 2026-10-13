// Lakash the zookeeper on his rounds with his six cats: node tools/lakash-shot.mjs [prefix]
import puppeteer from 'puppeteer-core';
const out = process.argv[2] ?? '.shots/lakash';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 600000 });
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' || /lakash/i.test(m.text())) errors.push(m.text()); });
await p.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await p.click('#start');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(1500);
const g = (fn, a) => p.evaluate(fn, a);
await g(() => { __game.dayNight.hour = 10; });
// at his first stop (the capybaras): stand by him
await wait(4000);
const info = () => g(() => { const L = __game.lakash; return { pos: L.pos.toArray().map((v) => +v.toFixed(1)), stop: L.stops[L.stopIndex].name, task: !!L.task, route: !!L.route, cats: L.cats.length, catNames: L.cats.map((c) => c.name).join(','), generated: !!L.rig.generated }; });
console.log('state', JSON.stringify(await info()));
const shot = async (name, yaw, dist, pitch) => {
  await g(([yaw, dist, pitch]) => { const G = __game, L = G.lakash; G.player.pos.set(L.pos.x, 0, L.pos.z); G.player.rig.root.visible = false; G.input.yaw = yaw; G.input.distance = dist; G.input.pitch = pitch; }, [yaw, dist, pitch]);
  await wait(+(process.env.SETTLE ?? 6000));
  await p.screenshot({ path: `${out}-${name}.png` });
};
await shot('front', (await g(() => __game.lakash.rig.root.rotation.y)) , 4.5, 0.18);
await shot('wide', (await g(() => __game.lakash.rig.root.rotation.y)) + 0.8, 8, 0.3);
console.log('state', JSON.stringify(await info()));
// walking between stops
await g(() => { const L = __game.lakash; L.task = null; L.nextStop(false); });
await wait(5000);
await shot('walk', (await g(() => __game.lakash.rig.root.rotation.y)) + 2.6, 7, 0.25);
console.log('state', JSON.stringify(await info()));
console.log('ERRORS:', errors.length ? errors : 'none');
await b.close();
