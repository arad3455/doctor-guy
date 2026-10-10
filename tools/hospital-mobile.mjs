// Phone: ✋ at the hospital doors, then a blood test with a real touch-and-hold, and the tap-fast cuff.
import puppeteer, { KnownDevices } from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], protocolTimeout: 240000 });
const page = await browser.newPage();
await page.emulate(KnownDevices['iPhone 13 landscape']);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 90000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const g = (fn, a) => page.evaluate(fn, a);
const tap = async (sel) => { const b = await (await page.$(sel)).boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
await tap('#start');
await wait(800);
await g(() => __game.player.pos.set(0, 0, -45.4));
await wait(600);
await tap('#btn-action');
await wait(1600);
const inside = await g(() => __game.player.pos.z < -300);
// blood test: stand by the chair and tap ✋
await g(() => {
  const ms = __game.missions;
  for (const id of ['blood', 'pressure']) { const d = ms.queue.find((x) => x.id === id); if (d) { ms.queue.splice(ms.queue.indexOf(d), 1); ms.spawnMission(d); } }
  const k = ms.missions.find((m) => m.def.id === 'blood').kid.root.position;
  __game.player.pos.set(k.x + 1.6, 0, k.z);
});
await wait(600);
console.log('before blood:', inside, await g(() => JSON.stringify({ prompt: document.getElementById('prompt').textContent, busy: __game.missions.busy, p: __game.player.pos.toArray().map((v) => +v.toFixed(2)), kid: __game.missions.missions.find((m) => m.def.id === 'blood')?.kid.root.position.toArray().map((v) => +v.toFixed(2)) })));
await tap('#btn-action');
await wait(1500);
console.log('after tap:', await g(() => JSON.stringify({ active: __game.minigame.active, busy: __game.missions.busy, state: __game.missions.missions.find((m) => m.def.id === 'blood').state, hidden: document.getElementById('minigame').className, pressed: [...__game.input.pressed], keys: [...__game.input.keys] })));
await page.waitForFunction(() => __game.minigame.active, { timeout: 8000 });
await g(() => {
  const m = __game.minigame; window.__mglog = [];
  for (const fn of ['down', 'up', 'judge', 'miss', 'hit']) { const o = m[fn].bind(m); m[fn] = (...a) => { __mglog.push(`${fn}(${m.mode} pos ${m.pos.toFixed(2)} holding ${m.holding})`); return o(...a); }; }
});
const steps = [];
const vw = 844, vh = 390;
for (let i = 0; i < 8 && (await g(() => __game.minigame.active)); i++) {
  const mode = await g(() => __game.minigame.mode);
  steps.push(mode);
  if (mode === 'hold') {
    await page.touchscreen.touchStart(vw / 2, vh * 0.3);
    // the gauge must fill while the finger is down…
    await page.waitForFunction(() => __game.minigame.holding && __game.minigame.pos > 0.15, { timeout: 20000 });
    // …then (headless runs at a few fps, so place it in the zone) lift the finger in the green
    await page.screenshot({ path: '.shots/hosp-hold.png' });
    await g(() => { const m = __game.minigame; m.pos = m.zoneX + m.zoneW / 2; m.t.speed = 0.0001; }); // freeze the gauge in the green
    await page.touchscreen.touchEnd();
    await g(() => { __game.minigame.t.speed = 1; });
  } else {
    await g(() => { const m = __game.minigame; m.pos = m.zoneX + m.zoneW / 2; m.dir = 0; });
    await page.touchscreen.tap(vw / 2, vh * 0.3);
  }
  await wait(400);
  console.log('step', i, mode, await g(() => JSON.stringify({ step: __game.minigame.step, misses: __game.minigame.misses, pos: +__game.minigame.pos.toFixed(2), zone: [+__game.minigame.zoneX.toFixed(2), +__game.minigame.zoneW.toFixed(2)], holding: __game.minigame.holding })));
}
const blood = await g(() => __game.missions.missions.find((m) => m.def.id === 'blood').state);
// blood pressure: mash
await page.waitForFunction(() => !__game.missions.busy, { timeout: 8000 });
await g(() => { const k = __game.missions.missions.find((m) => m.def.id === 'pressure').kid.root.position; __game.player.pos.set(k.x - 1.6, 0, k.z); });
await wait(600);
console.log('before pressure:', await g(() => JSON.stringify({ prompt: document.getElementById('prompt').textContent, busy: __game.missions.busy, p: __game.player.pos.toArray().map((v) => +v.toFixed(2)), kid: __game.missions.missions.find((m) => m.def.id === 'pressure').kid.root.position.toArray().map((v) => +v.toFixed(2)), state: __game.missions.missions.find((m) => m.def.id === 'pressure').state, blood: __game.missions.missions.find((m) => m.def.id === 'blood').state })));
await tap('#btn-action');
await page.waitForFunction(() => __game.minigame.active, { timeout: 8000 });
for (let i = 0; i < 200 && (await g(() => __game.minigame.active)); i++) {
  const mode = await g(() => __game.minigame.mode);
  if (mode === 'mash') {
    await page.touchscreen.tap(vw / 2, vh * 0.3);
    if (i % 10 === 0) console.log('mash', i, await g(() => JSON.stringify({ pos: +__game.minigame.pos.toFixed(2), t: +__game.minigame.mashTime.toFixed(2), misses: __game.minigame.misses })));
    if (i === 6) await page.screenshot({ path: '.shots/hosp-mash.png' });
  }
  else { await g(() => { const m = __game.minigame; m.pos = m.zoneX + m.zoneW / 2; m.dir = 0; }); await page.touchscreen.tap(vw / 2, vh * 0.3); await wait(300); }
}
await page.waitForFunction(() => !__game.missions.busy, { timeout: 20000 }).catch(() => {});
await wait(600);
const pressure = await g(() => __game.missions.missions.find((m) => m.def.id === 'pressure').state);
console.log('mash state:', await g(() => JSON.stringify({ active: __game.minigame.active, step: __game.minigame.step, mode: __game.minigame.mode, misses: __game.minigame.misses, pos: +__game.minigame.pos.toFixed(2), t: +__game.minigame.mashTime.toFixed(2) })));
console.log(JSON.stringify({ inside, steps, blood, pressure }));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
