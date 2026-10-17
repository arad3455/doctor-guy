// Ilan Motors, inside: the portal in the glass front, the hall with every car on a turntable, Ilan coming in with
// you and following, buying a car right at its plaque (it waits outside on the YOUR CAR bay), leaving by the exit.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 600000 });
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await p.click('#start');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const g = (fn, a) => p.evaluate(fn, a);
await wait(2000);
const r = {};
// the portal
await g(() => { const d = __game.ilan.dealer.door; __game.player.pos.set(d.x + 1.3, 0, d.z); __game.missions.lollipops = 300; });
await p.waitForFunction(() => /Enter Ilan Motors/.test(document.getElementById('prompt').textContent), { timeout: 30000 }).catch(() => {});
r.portalPrompt = await g(() => document.getElementById('prompt').textContent);
await p.keyboard.press('KeyE');
await p.waitForFunction(() => __game.player.pos.z > 500, { timeout: 30000 }).catch(() => {});
await p.waitForFunction(() => __game.showroom.tables.filter((t) => t.car).length >= 13, { timeout: 120000 }).catch(() => {});
r.inside = await g(() => ({ z: +__game.player.pos.z.toFixed(1), hosting: __game.ilan.hosting, cars: __game.showroom.tables.filter((t) => t.car).length, hero: __game.showroom.tables[0].car?.id, visible: __game.showroom.group.visible }));
await wait(3000);
await p.screenshot({ path: '.shots/showroom-1-hall.png' });
// walk to a car: Ilan follows and pitches it
const t = await g(() => { const t = __game.showroom.tables.find((x) => x.car?.id === 'kaido'); __game.player.pos.copy(t.stand); return t.car.id; });
await p.waitForFunction(() => { const G = __game; return Math.hypot(G.ilan.pos.x - G.player.pos.x, G.ilan.pos.z - G.player.pos.z) < 4.5; }, { timeout: 120000, polling: 500 }).catch(() => {});
await wait(2500);
r.atCar = await g(() => ({ prompt: document.getElementById('prompt').textContent, ilanNear: Math.hypot(__game.ilan.pos.x - __game.player.pos.x, __game.ilan.pos.z - __game.player.pos.z) < 4.5, pitched: __game.ilan.pitched }));
await p.screenshot({ path: '.shots/showroom-2-pitch.png' });
// buy it right there
await p.keyboard.press('KeyE');
await wait(1500);
r.bought = await g(() => ({ pops: __game.missions.lollipops, cars: __game.progress.data.cars, car: __game.progress.data.car, myCar: __game.myCar?.carId, prompt: document.getElementById('prompt').textContent }));
// leave by the exit: the car waits outside
await g(() => { const e = __game.showroom; __game.player.pos.set(0, 0, 700 + 23); });
await p.waitForFunction(() => /Leave Ilan Motors/.test(document.getElementById('prompt').textContent), { timeout: 30000 }).catch(() => {});
await p.keyboard.press('KeyE');
await p.waitForFunction(() => __game.player.pos.z < 500, { timeout: 30000 }).catch(() => {});
await p.waitForFunction(() => __game.myCar?.model, { timeout: 60000 }).catch(() => {});
await wait(3000);
r.outside = await g(() => { const c = __game.myCar, P = __game.player.pos; return { z: +P.z.toFixed(1), hosting: __game.ilan.hosting, carFromHere: +Math.hypot(c.pos.x - P.x, c.pos.z - P.z).toFixed(1) }; });
await p.screenshot({ path: '.shots/showroom-3-outside.png' });
console.log(JSON.stringify(r, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await b.close();
