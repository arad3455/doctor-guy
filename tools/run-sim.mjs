// Simulates holding "run" for 10s at 60fps and counts animation flips (run-glitch regression test)
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 600, height: 400 } });
const page = await browser.newPage();
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'networkidle0', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 60000 });
const r = await page.evaluate(() => {
  const p = __game.player;
  p.reset();
  const input = { yaw: Math.PI, stick: { x: 0, y: 0 }, down: (...c) => c.some((k) => ['KeyW', 'ShiftLeft'].includes(k)), hit: () => false };
  const flips = []; let last = null, t = 0;
  for (let i = 0; i < 600; i++) {
    t += 1 / 60;
    p.update(1 / 60, t, input);
    if (p.anim !== last) { flips.push([+t.toFixed(2), p.anim, +p.stamina.toFixed(2)]); last = p.anim; }
  }
  return flips;
});
console.log(`animation flips in 10s of holding run: ${r.length}`);
console.log(r.slice(0, 12).map(([t, a, s]) => `${t}s → ${a} (stamina ${s})`).join('\n'));
await browser.close();
