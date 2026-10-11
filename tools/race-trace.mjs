// Debug: trace the race autopilot once a second for race N (node tools/race-trace.mjs 0)
import puppeteer from 'puppeteer-core';
const k = Number(process.argv[2] ?? 0);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 800, height: 450 }, protocolTimeout: 600000 });
const p = await b.newPage();
await p.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await p.click('#start');
const g = (fn, a) => p.evaluate(fn, a);
await g(() => { const a = __game.ambulance; a.update(1 / 60, 0, {}); __game.player.pos.copy(a.doorPoint); });
await new Promise((r) => setTimeout(r, 800));
await p.keyboard.press('KeyE');
await p.waitForFunction(() => __game.ambulance.driving, { timeout: 30000 });
console.log(await g((k) => {
  const R = __game.races, a = __game.ambulance, r = __game.raceDefs.RACES[k];
  R.start(r);
  const log = [];
  for (let s = 0; s < 60 * 45 && R.active; s++) {
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
    a.update(1 / 60, s / 60, { throttle, steer }); R.update(1 / 60, s / 60);
    if (s % 60 === 0) log.push(`t${(s / 60) | 0} p(${a.pos.x.toFixed(1)},${a.pos.z.toFixed(1)}) h${a.heading.toFixed(2)} v${a.speed.toFixed(1)} cp${R.active?.i} drv${a.driving}`);
  }
  log.push('active after: ' + !!R.active + ' best ' + JSON.stringify(__game.progress.data.races ?? null));
  return log.join('\n');
}, k));
await b.close();
