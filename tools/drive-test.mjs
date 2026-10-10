// Ambulance smoke test: get in, drive, steer, siren, crash into the hospital, stop, get out.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1000, height: 640 } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'networkidle0', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 60000 });
await page.click('#start');
const g = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: `.shots/drive-${n}.png` });
// Drive in simulated 60fps steps so the result doesn't depend on the headless frame rate
const drive = (keys, seconds) => g(([keys, seconds]) => {
  const { ambulance, input } = __game;
  const down = new Set(keys);
  const fake = { ...input, enabled: true, stick: { x: 0, y: 0 }, down: (...c) => c.some((k) => down.has(k)), hit: () => false };
  for (let i = 0; i < seconds * 60; i++) {
    const k = (...c) => (fake.down(...c) ? 1 : 0);
    ambulance.update(1 / 60, i / 60, { throttle: k('KeyW') - k('KeyS'), steer: k('KeyD') - k('KeyA') });
  }
  return { pos: ambulance.pos.toArray().map((v) => +v.toFixed(2)), heading: +ambulance.heading.toFixed(2), speed: +ambulance.speed.toFixed(2) };
}, [keys, seconds]);

await g(() => { const a = __game.ambulance; __game.player.pos.copy(a.doorPoint); __game.input.yaw = a.heading + Math.PI * 0.75; __game.input.distance = 10; });
await wait(800);
await shot('0-walk-up');
const prompt = await g(() => document.getElementById('prompt').textContent);
await page.keyboard.press('KeyE');
await wait(400);
const driving = await g(() => __game.ambulance.driving);
console.log('prompt:', JSON.stringify(prompt), '→ driving:', driving);
const start = await drive([], 0);
const fwd = await drive(['KeyW'], 2.5);
console.log('accelerate 2.5s:', start.pos, '→', fwd.pos, 'speed', fwd.speed);
const turn = await drive(['KeyW', 'KeyD'], 1.2);
console.log('steer right 1.2s: heading', fwd.heading, '→', turn.heading);
await page.keyboard.press('Space');
await wait(600);
console.log('siren:', await g(() => __game.ambulance.siren));
await shot('1-driving');
// head straight for the hospital wall
await g(() => { const a = __game.ambulance; a.pos.set(12, 0, -25); a.heading = Math.PI; a.speed = 0; a.syncTransform(); });
const crash = await drive(['KeyW'], 4);
// the van is 7 long, so its centre should stop ~3.5 in front of the wall face (z = -47)
console.log('drive into the hospital: centre z =', crash.pos[2], '→ nose at', +(crash.pos[2] - 3.5).toFixed(2), '(wall face at -47) speed', crash.speed);
await drive([], 3);
await wait(500);
await shot('2-at-hospital');
await page.keyboard.press('KeyE');
await wait(500);
console.log('got out:', await g(() => ({ driving: __game.ambulance.driving, visible: __game.player.rig.root.visible, dist: +__game.player.pos.distanceTo(__game.ambulance.pos).toFixed(2) })));
await shot('3-got-out');
// drive down the boardwalk to the beach
await g(() => { const a = __game.ambulance; __game.player.pos.copy(a.doorPoint); });
await wait(400);
await page.keyboard.press('KeyE');
await wait(400);
console.log('back in:', await g(() => __game.ambulance.driving));
await g(() => { const a = __game.ambulance; a.pos.set(0, 0, 50); a.heading = 0; a.speed = 0; a.syncTransform(); });
const beach = await drive(['KeyW'], 5);
console.log('boardwalk run: z', beach.pos[2], '(beach starts at 80; sea at 116)');
await wait(800);
await shot('4-beach');
// ---- Emergency run: Yoni from the pond → ambulance → hospital
await g(() => { const a = __game.ambulance; if (a.driving) { a.speed = 0; } });
await page.keyboard.press('KeyE'); // get out (if still in)
await wait(400);
const run = await g(async () => {
  const { missions: ms, ambulance: a, player: p } = __game;
  const def = ms.queue.find((d) => d.id === 'pond') ?? ms.missions.find((m) => m.def.id === 'pond')?.def;
  if (ms.queue.includes(def)) ms.queue.splice(ms.queue.indexOf(def), 1);
  const m = ms.spawnMission(def);
  p.pos.set(-8, 0, -30);
  m.kid.root.position.set(-8, 0, -29);
  await ms.pickUp(m);
  // park the van next to him
  a.pos.set(-4, 0, -30); a.heading = 0; a.speed = 0; a.syncTransform();
  p.pos.copy(a.doorPoint);
  return m.state;
});
await wait(400);
await page.keyboard.press('KeyE'); // get in with Yoni
await wait(600);
const inVan = await g(() => ({ driving: __game.ambulance.driving, siren: __game.ambulance.siren, step: document.querySelector('.mission.active .m-step')?.textContent }));
// drive up to the hospital drop-off and stop
await g(() => { const a = __game.ambulance; a.pos.set(3, 0, -38); a.heading = Math.PI; a.speed = 0; a.syncTransform(); });
await wait(600);
const prompt2 = await g(() => document.getElementById('prompt').textContent);
await shot('5-patient-dropoff');
await page.keyboard.press('KeyE');
await wait(800);
const done = await g(() => ({ state: __game.missions.missions.find((m) => m.def.id === 'pond').state, driving: __game.ambulance.driving, toast: document.getElementById('toast').textContent }));
console.log('patient run:', run, '→ in van', JSON.stringify(inVan), '→ prompt', JSON.stringify(prompt2), '→', JSON.stringify(done));
await shot('6-patient-done');
// ---- Siren near the hospital: nurses come out to meet the van, then walk the patient in
await g(async () => {
  const { missions: ms, ambulance: a, player: p } = __game;
  const def = ms.queue.find((d) => d.deliver === 'hospital');
  ms.queue.splice(ms.queue.indexOf(def), 1);
  const m = ms.spawnMission(def);
  p.pos.set(-8, 0, -20);
  m.kid.root.position.set(-8, 0, -19);
  await ms.pickUp(m);
  a.pos.set(-4, 0, -20); a.heading = Math.PI; a.speed = 0; a.syncTransform();
  p.pos.copy(a.doorPoint);
  window.__nurseKid = def.id;
  __game.nurses.cooldown = 0; // the previous step's hand-over put them on a short break
});
await wait(400);
await page.keyboard.press('KeyE'); // in, siren comes on automatically
await wait(500);
await g(() => { const a = __game.ambulance; a.pos.set(4, 0, -36); a.heading = Math.PI; a.speed = 0; a.syncTransform(); });
await page.waitForFunction(() => __game.nurses.nurses.every((n) => n.state === 'meeting'), { timeout: 20000 });
await wait(4000); // let them reach the van
const nurseInfo = await g(() => __game.nurses.nurses.map((n) => ({ state: n.state, dist: +n.rig.root.position.distanceTo(__game.ambulance.pos).toFixed(1) })));
await g(() => { __game.input.yaw = Math.PI * 0.8; __game.input.distance = 13; });
await wait(800);
await shot('7-nurses');
await page.keyboard.press('KeyE'); // hand over from the van
await wait(1500);
const after = await g(() => ({ state: __game.missions.missions.find((m) => m.def.id === window.__nurseKid).state, nurses: __game.nurses.nurses.map((n) => n.state) }));
await shot('8-nurses-escort');
console.log('nurses:', JSON.stringify(nurseInfo), '→ after hand-over', JSON.stringify(after));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
