// Close-ups of a kid riding on Doctor Guy's shoulders (side, front, back): node tools/carry-shot.mjs <prefix> [look]
import puppeteer from 'puppeteer-core';
const [, , prefix = 'carry', look = 'capKid'] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 600, height: 600 } });
const page = await browser.newPage();
await page.goto((process.env.BASE ?? 'http://localhost:8765/') + (process.env.Q ? `?${process.env.Q}` : ''), { waitUntil: 'networkidle0', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 60000 });
await page.click('#start');
await page.evaluate(async (look) => {
  const ms = __game.missions;
  const def = ms.queue.find((d) => d.deliver === 'hospital');
  def.look = look;
  ms.queue.splice(ms.queue.indexOf(def), 1);
  const m = ms.spawnMission(def);
  __game.player.pos.set(5, 0, 20);
  m.kid.root.position.set(5, 0, 21);
  await ms.pickUp(m);
}, look);
const views = process.env.SIDE ? [[Math.PI / 2, 0.1]] : [[Math.PI / 2, 0.15], [0, 0.15], [Math.PI, 0.2]];
for (const [i, [yaw, pitch]] of views.entries()) {
  await page.evaluate(([yaw, pitch]) => {
    const p = __game.player;
    p.facing = 0;
    p.frozen = true;
    __game.follow.update = () => {
      const c = __game.follow.camera;
      const t = p.pos.clone().setY(2.5);
      const a = p.facing + yaw; // relative to where he faces: 0 = in front, π/2 = his left side, π = behind
      c.position.set(t.x + Math.sin(a) * 3, t.y + Math.sin(pitch) * 3, t.z + Math.cos(a) * 3);
      c.lookAt(t);
    };
  }, [yaw, pitch]);
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `.shots/${prefix}-${i}.png` });
}
await browser.close();
