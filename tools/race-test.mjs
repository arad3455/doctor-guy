// Time trials: an autopilot drives every race (simulated 60 fps) — routes must be drivable and gold reachable.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 600000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await page.click('#start');
const g = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// get in the ambulance
await g(() => { const a = __game.ambulance; a.update(1 / 60, 0, {}); __game.player.pos.copy(a.doorPoint); });
await wait(800);
await page.keyboard.press('KeyE');
await page.waitForFunction(() => __game.ambulance.driving, { timeout: 30000 });
const out = [];
for (let k = 0; k < 3; k++) {
  // drive to the start flag, check the prompt, press E
  const label = await g(async (k) => {
    const { RACES } = __game.raceDefs;
    const r = RACES[k], a = __game.ambulance;
    a.pos.set(r.start.x, 0, r.start.z); a.heading = r.start.heading; a.speed = 0; a.syncTransform();
    return r.name;
  }, k);
  await page.waitForFunction((name) => document.getElementById('prompt').textContent.includes(name), { timeout: 30000 }, label).catch(() => {});
  const prompt = await g(() => document.getElementById('prompt').textContent);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => __game.races.active, { timeout: 30000 }).catch(() => {});
  // run the race in simulation: countdown, then the autopilot steers at each checkpoint
  const res = await g(() => {
    const R = __game.races, a = __game.ambulance;
    let steps = 0, stuck = 0, last = a.pos.clone();
    while (R.active && steps < 60 * 400) {
      const tg = R.target; let throttle = 0, steer = 0;
    if (R.active.t >= 0 && tg) {
      const ap = (R.ap ??= { back: 0, slow: 0 });
      const want = Math.atan2(tg.x - a.pos.x, tg.z - a.pos.z);
      let d = want - a.heading; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      steer = Math.max(-1, Math.min(1, -d * 2.5)); /* positive steer turns clockwise */
      // brake for the turn after this checkpoint
      const nx = R.active.r.cps[R.active.i + 1], dist = Math.hypot(tg.x - a.pos.x, tg.z - a.pos.z);
      let turn = 0;
      if (nx) { const w2 = Math.atan2(nx[0] - tg.x, nx[1] - tg.z); turn = Math.abs(Math.atan2(Math.sin(w2 - want), Math.cos(w2 - want))); }
      const limit = dist < 16 && turn > 0.7 ? 7 : Math.abs(d) > 0.6 ? 6 : 99;
      throttle = a.speed > limit ? -0.6 : 1;
      // stuck on a pole or a kerb: back off a moment
      if (ap.back > 0) { ap.back -= 1 / 60; throttle = -1; steer = -steer; }
      else if (Math.abs(a.speed) < 1.2) { if ((ap.slow += 1 / 60) > 1) { ap.back = 0.9; ap.slow = 0; } } else ap.slow = 0;
    }
    a.update(1 / 60, steps / 60, { throttle, steer });
      R.update(1 / 60, steps / 60);
      steps++;
      if (steps % 120 === 0) { if (a.pos.distanceTo(last) < 1 && R.active?.t > 0) stuck++; last = a.pos.clone(); }
    }
    const best = __game.progress.data.races;
    return { done: !R.active, steps, stuck, best };
  });
  out.push({ race: label, prompt, ...res });
  await wait(1200);
}
await page.screenshot({ path: '.shots/race-1.png' });
r: {
  const medals = await g(() => __game.raceDefs.RACES.map((r) => `${r.id}: gold ${r.medals.gold}s silver ${r.medals.silver}s bronze ${r.medals.bronze}s (len ${Math.round(r.length)})`));
  console.log(medals.join('\n'));
}
console.log(JSON.stringify(out, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
