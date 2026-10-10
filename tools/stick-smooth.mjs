// Joystick driving smoothness: simulate 6 s at 60 fps with the camera auto-following the van (as in the game)
// for several stick positions and report how the van behaves.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], protocolTimeout: 240000 });
const page = await browser.newPage();
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'networkidle0', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 120000 });
const res = await page.evaluate(() => {
  const { ambulance: a, input } = __game;
  const out = {};
  const cases = { 'forward': [0, -1], 'half-right': [0.5, -0.85], 'full right': [1, 0], 'right, little': [0.3, 0], 'light tilt up': [0, -0.25], 'back': [0, 1], 'back-left': [-0.6, 0.8] };
  for (const [name, [sx, sy]] of Object.entries(cases)) {
    a.pos.set(0, 0, 10); a.heading = 0; a.speed = 0; a.steer = 0; a.driving = true; a.syncTransform();
    a.collide = () => false; // open field: measure handling only
    let yaw = a.heading + Math.PI; // camera behind the van
    let flips = 0, lastSteer = 0, turned = 0, maxJerk = 0, prevRate = 0;
    const headings = [];
    for (let i = 0; i < 360; i++) {
      const dt = 1 / 60;
      const stick = { x: sx, y: sy };
      const mag = Math.min(1, Math.hypot(sx, sy));
      const { throttle, steer } = window.__stickDrive(stick, mag);
      if (Math.sign(steer) !== Math.sign(lastSteer) && Math.abs(steer) > 0.2 && Math.abs(lastSteer) > 0.2) flips++;
      lastSteer = steer;
      const h0 = a.heading;
      a.update(dt, i * dt, { throttle, steer });
      const rate = (a.heading - h0) / dt;
      if (i > 5) maxJerk = Math.max(maxJerk, Math.abs(rate - prevRate) / dt);
      prevRate = rate;
      turned += Math.abs(a.heading - h0);
      const want = a.heading + Math.PI; // the game's camera follow
      yaw += Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) * Math.min(1, dt * 2.5);
      if (i % 60 === 59) headings.push(+(a.heading * 57.3).toFixed(0));
    }
    a.driving = false;
    out[name] = { speed: +a.speed.toFixed(1), totalTurnDeg: +(turned * 57.3).toFixed(0), headingEachSecond: headings.join(','), steerFlips: flips, maxTurnJerk: +maxJerk.toFixed(1) };
  }
  // release test: full right for 1.5 s then let go — must straighten out (no endless circling)
  a.pos.set(0, 0, 10); a.heading = 0; a.speed = 0; a.steer = 0; a.driving = true; a.syncTransform();
  const hs = [];
  for (let i = 0; i < 300; i++) {
    const held = i < 90;
    const stick = held ? { x: 1, y: -0.2 } : { x: 0, y: -1 };
    const r = window.__stickDrive(stick, Math.min(1, Math.hypot(stick.x, stick.y)));
    a.update(1 / 60, i / 60, r);
    if (i % 30 === 29) hs.push(+(a.heading * 57.3).toFixed(0));
  }
  a.driving = false;
  out['right 1.5s → release'] = { speed: +a.speed.toFixed(1), totalTurnDeg: '', headingEachSecond: hs.join(','), steerFlips: 0, maxTurnJerk: 0 };
  return out;
});
console.table(res);
await browser.close();
