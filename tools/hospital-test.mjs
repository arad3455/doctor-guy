// Hospital interior: enter through the doors with E, overview + room close-ups, then leave again.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1000, height: 640 } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto((process.env.BASE ?? 'http://localhost:8765/') + (process.env.Q ? `?${process.env.Q}` : ''), { waitUntil: 'networkidle0' });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 90000 });
await page.click('#start');
const g = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: `.shots/hosp-${n}.png` });
// the blue entry gate, seen from the park
await g(() => { __game.player.pos.set(-3, 0, -31); __game.input.yaw = 0.15; __game.input.pitch = 0.3; __game.input.distance = 9; });
await wait(1200);
await shot('0b-gate');
await g(() => { __game.player.pos.set(0, 0, -45); __game.input.yaw = 0; __game.input.pitch = 0.35; __game.input.distance = 8; });
await wait(700);
const prompt = await g(() => document.getElementById('prompt').textContent);
await shot('0-door');
await page.keyboard.press('KeyE');
await wait(1500);
const inside = await g(() => __game.player.pos.z < -300);
console.log('door prompt:', JSON.stringify(prompt), '→ inside:', inside);
await shot('1-lobby');
// spawn every indoor patient
await g(() => { const ms = __game.missions; for (const d of ms.queue.filter((d) => d.zone === 'hospital')) { ms.queue.splice(ms.queue.indexOf(d), 1); ms.spawnMission(d); } });
await wait(800);
// fixed cameras for room views
const cam = (pos, look) => g(([pos, look]) => {
  __game.follow.update = () => { const c = __game.follow.camera; c.position.set(...pos); c.lookAt(...look); };
}, [pos, look]);
const O = -400;
for (const [name, pos, look] of [
  ['2-overview', [0, 34, O + 22], [0, 0, O]],
  ['3-exam', [-6.5, 7, O + 2], [-13, 0.5, O - 8]],
  ['4-lab', [-6.5, 7, O + 13], [-14, 0.5, O + 6]],
  ['5-ward', [7, 7, O + 12], [15, 0.5, O - 3]],
  ['6-reception', [0, 4.5, O + 3], [0, 1.2, O - 7]],
  ['10-xray', [0, 7.5, O - 12.5], [0, 0.8, O - 21.5]],
  ['11-xray-close', [-1, 3.2, O - 16.5], [-0.5, 1.1, O - 21.5]],
  ['7-scale', [-11.5, 2.6, O - 9], [-15.5, 1.2, O - 11]],
  ['8-chair', [-9.5, 2.4, O + 5.5], [-13.5, 0.9, O + 7.5]],
  ['9-bed', [10, 2.6, O - 7], [14.2, 1.3, O - 10.5]],
]) {
  await cam(pos, look);
  await wait(900);
  await shot(name);
}
await g(() => __game.hospital.showFilm('coin'));
await cam([-2.8, 2.2, O - 18.5], [-5.9, 1.9, O - 18.5]);
await wait(700);
await shot('12-lightbox');
console.log('spots:', JSON.stringify(await g(() => Object.fromEntries(Object.entries(__game.hospital.spots).map(([k, s]) => [k, { top: +s.top.toFixed(2), sit: s.sit }])))));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
