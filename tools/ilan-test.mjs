// Ilan Motors: the showroom (5 Fulmines), talk to Ilan, the register catalogue, buy a car (it waits on the YOUR CAR
// bay), drive it away and get out; the car is still yours after a reload.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 600000 });
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const BASE = process.env.BASE ?? 'http://localhost:8765/';
await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await p.click('#start');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const g = (fn, a) => p.evaluate(fn, a);
await wait(2000);
const r = {};
const spots = await g(() => { const d = __game.ilan.dealer; return { ilan: d.ilan, reg: d.register, bay: d.bay, door: d.door }; });
// the showroom
await g((s) => { const G = __game; G.dayNight.hour = 11; G.player.pos.set(s.door.x + 6, 0, s.door.z); G.input.yaw = Math.PI / 2; G.input.distance = 9; G.input.pitch = 0.22; }, spots);
await p.waitForFunction(() => { let n = 0; __game.ilan.dealer.group.traverse((o) => { if (o.isMesh && o.material?.envMap) n++; }); return n > 5; }, { timeout: 60000 }).catch(() => {});
await wait(4000);
await p.screenshot({ path: '.shots/ilan-1-showroom.png' });
r.ilan = await g(() => ({ generated: !!__game.ilan.rig.generated, displayCars: (() => { let n = 0; __game.ilan.dealer.group.traverse((o) => { if (o.isGroup && o.children.some((c) => c.isObject3D && c.children.length && c.parent?.userData?.dynamic)) n++; }); return n; })() }));
// the register before talking: he wants a word first
await g((s) => { __game.player.pos.set(s.reg.x + 0.4, 0, s.reg.z); }, spots);
await p.waitForFunction(() => /catalogue/i.test(document.getElementById('prompt').textContent), { timeout: 30000 }).catch(() => {});
r.registerFirst = await g(() => document.getElementById('prompt').textContent);
// talk to Ilan
await g((s) => { __game.player.pos.set(s.ilan.x + 1.6, 0, s.ilan.z); }, spots);
await p.waitForFunction(() => /Ilan/.test(document.getElementById('prompt').textContent), { timeout: 30000 }).catch(() => {});
await p.keyboard.press('KeyE');
await wait(1200);
r.talked = await g(() => ({ met: !!__game.progress.data.metIlan, bubble: !!__game.ilan.bubble }));
await g((s) => { const G = __game; G.input.yaw = Math.PI / 2 + 0.6; G.input.distance = 5; G.input.pitch = 0.15; }, spots);
await wait(2500);
await p.screenshot({ path: '.shots/ilan-2-talk.png' });
// the catalogue
await g((s) => { __game.missions.lollipops = 200; __game.player.pos.set(s.reg.x + 0.4, 0, s.reg.z); }, spots);
await p.waitForFunction(() => /Car catalogue$/.test(document.getElementById('prompt').textContent.trim()), { timeout: 30000 }).catch(() => {});
await p.keyboard.press('KeyE');
await p.waitForFunction(() => !document.getElementById('dealer').classList.contains('hidden'), { timeout: 15000 }).catch(() => {});
await wait(600);
await p.screenshot({ path: '.shots/ilan-3-catalogue.png' });
r.catalogue = await g(() => ({ open: !document.getElementById('dealer').classList.contains('hidden'), rows: document.querySelectorAll('.dl-car').length, affordable: [...document.querySelectorAll('.dl-car button:not([disabled])')].length }));
// buy the yellow one
await g(() => document.querySelector('[data-car="giallo"]').click());
await wait(1500);
r.bought = await g(() => ({ pops: __game.missions.lollipops, cars: __game.progress.data.cars, car: __game.progress.data.car, myCar: !!__game.myCar, closed: document.getElementById('dealer').classList.contains('hidden') }));
await p.waitForFunction(() => __game.myCar?.model, { timeout: 60000 }).catch(() => {});
// walk out to it, get in, drive off
await g((s) => { const c = __game.myCar, d = c.doorPoint; __game.player.pos.set(d.x, 0, d.z); __game.input.yaw = Math.PI * 0.75; __game.input.distance = 8; __game.input.pitch = 0.25; }, spots);
await wait(3000);
await p.screenshot({ path: '.shots/ilan-4-your-car.png' });
await p.waitForFunction(() => /Drive your/.test(document.getElementById('prompt').textContent), { timeout: 30000 }).catch(() => {});
r.drivePrompt = await g(() => document.getElementById('prompt').textContent);
await p.keyboard.press('KeyE');
await wait(800);
const p0 = await g(() => __game.myCar.pos.toArray());
await p.keyboard.down('KeyW');
await wait(4000);
await p.keyboard.up('KeyW');
await p.screenshot({ path: '.shots/ilan-5-driving.png' });
r.drove = await g((p0) => ({ driving: __game.myCar.driving, ambulanceDriving: __game.ambulance.driving, moved: +Math.hypot(__game.myCar.pos.x - p0[0], __game.myCar.pos.z - p0[2]).toFixed(1), withHim: Math.hypot(__game.player.pos.x - __game.myCar.pos.x, __game.player.pos.z - __game.myCar.pos.z) < 0.1 }), p0);
await g(() => { __game.myCar.speed = 0; });
await wait(500);
await p.keyboard.press('KeyE');
await wait(800);
r.out = await g(() => ({ driving: __game.myCar.driving, visible: __game.player.rig.root.visible }));
// a reload: the car is still yours (on the bay)
await g(() => __game.progress.save(true));
await p.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
r.afterReload = await g(() => ({ car: __game.progress.data.car, myCar: __game.myCar?.carId ?? null }));
console.log(JSON.stringify(r, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await b.close();
