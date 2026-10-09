// Close-ups of the swing kids (swings held still, camera beside each seat): node tools/swing-shot.mjs <prefix>
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 700, height: 500 } });
const page = await browser.newPage();
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 60000 });
await page.click('#start');
const prefix = process.argv[2] ?? 'swing';
// swing set at (15, 9); seats at x = 13 and 17, seat height ≈ 0.7
const views = [[13, [11.2, 1.0, 9.0]], [13, [13, 1.1, 6.8]], [17, [18.8, 1.0, 9.0]], [17, [17, 1.1, 6.8]]];
for (const [i, [sx, cam]] of views.entries()) {
  await page.evaluate(([sx, cam]) => {
    __game.missions.ambient.filter((a) => a.mode === 'swing').forEach(() => {});
    for (const s of __game.ui?.swingSeats ?? []) s.amp = 0;
    __game.follow.update = () => {
      const c = __game.follow.camera;
      c.position.set(...cam);
      c.lookAt(sx, 0.75, 9);
    };
  }, [sx, cam]);
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `.shots/${prefix}-${i}.png` });
}
await browser.close();
