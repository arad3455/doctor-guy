// Lakash the zookeeper: generated model, six cats (Mandarin the ginger), his rounds (the animals gather to be fed),
// chat, the cats following him, the porch in the evening and bed at night. Plus the new wing's animals.
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
await page.waitForFunction(() => __game.lakash?.cats.length === 6, { timeout: 60000 }).catch(() => {});
const r = {};
r.lakash = await g(() => { const L = __game.lakash; return { generated: !!L.rig.generated, cats: L.cats.map((c) => c.name), blip: L.blips().length === 1 }; });
// the orange one: Mandarin's fur is mostly orange (sample her texture)
r.mandarinOrange = await g(() => { const c = __game.lakash.cats.find((k) => k.name === 'Mandarin'); let m; c.root.traverse((o) => { if (o.isMesh) m = o.material; }); const cv = document.createElement('canvas'); cv.width = cv.height = 32; const x = cv.getContext('2d'); x.drawImage(m.map.image, 0, 0, 32, 32); const d = x.getImageData(0, 0, 32, 32).data; let rr = 0, bb = 0; for (let i = 0; i < d.length; i += 4) { rr += d[i]; bb += d[i + 2]; } return rr > bb * 1.8; });
r.wing = await g(() => { const n = {}; for (const a of __game.zoo.wing.animals) n[a.kind] = (n[a.kind] ?? 0) + 1; return n; });
// rounds: send him to the capybaras (from far away he just arrives), the herd comes over to be fed
await g(() => { const G = __game, L = G.lakash; G.dayNight.hour = 10; G.player.pos.set(0, 0, 0); });
await wait(1500);
await g(() => { const L = __game.lakash; L.lastPhase = 'rounds'; L.stopIndex = L.stops.findIndex((s) => s.kind === 'capybara') - 1; L.task = null; L.nextStop(true); });
r.atStop = await g(() => { const L = __game.lakash; return { stop: L.stops[L.stopIndex].name, task: !!L.task }; });
await g(() => { const L = __game.lakash; __game.player.pos.set(L.pos.x + 1.6, 0, L.pos.z + 0.6); });
await page.waitForFunction(() => { const L = __game.lakash, s = L.stops[L.stopIndex]; return __game.zoo.wing.animals.filter((a) => a.kind === 'capybara' && Math.hypot(a.root.position.x - s.at.x, a.root.position.z - s.at.z) < 4.5).length >= 4; }, { timeout: 120000, polling: 1000 }).catch(() => {});
r.gathered = await g(() => { const L = __game.lakash, s = L.stops[L.stopIndex]; return __game.zoo.wing.animals.filter((a) => a.kind === 'capybara' && Math.hypot(a.root.position.x - s.at.x, a.root.position.z - s.at.z) < 4.5).length; });
r.feeding = await g(() => __game.lakash.feeding);
// chat
await page.waitForFunction(() => /Lakash/.test(document.getElementById('prompt').textContent), { timeout: 30000 }).catch(() => {});
r.prompt = await g(() => document.getElementById('prompt').textContent);
await page.keyboard.press('KeyE');
await wait(1000);
r.said = await g(() => !!__game.lakash.bubble);
await page.screenshot({ path: '.shots/lakash-test-feeding.png' });
// on to the next stop: the cats follow him
await g(() => { const L = __game.lakash; L.task = null; L.nextStop(false); });
await wait(14000);
r.walked = await g(() => { const L = __game.lakash; const d = L.cats.map((c) => Math.hypot(c.root.position.x - L.pos.x, c.root.position.z - L.pos.z)); return { stop: L.stops[L.stopIndex].name, catsNear: d.filter((x) => x < 5).length, moving: !!L.route }; });
// evening on the porch, night in bed (the cats in their beds)
await g(() => { __game.player.pos.set(0, 0, 0); __game.dayNight.hour = 19; });
await wait(2500);
r.evening = await g(() => { const L = __game.lakash, P = __game.zoo.wing.porch; return { phase: L.lastPhase, onPorch: Math.hypot(L.pos.x - P.x, L.pos.z - P.z) < 1, visible: L.rig.root.visible }; });
await g(() => { __game.dayNight.hour = 23; });
await wait(2500);
r.night = await g(() => { const L = __game.lakash, beds = __game.zoo.wing.catSpots; return { phase: L.lastPhase, visible: L.rig.root.visible, catsInBed: L.cats.filter((c) => beds.some((b) => Math.hypot(b.x - c.root.position.x, b.z - c.root.position.z) < 0.6)).length }; });
console.log(JSON.stringify(r, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
