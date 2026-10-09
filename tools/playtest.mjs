// Automated smoke play-through: node tools/playtest.mjs  (needs the dev server on :8765)
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const OUT = new URL('../.shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1280,800'],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` });
const g = (fn, ...a) => page.evaluate(fn, ...a);

await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'networkidle0' });
await wait(1500);
await shot('01-title');
// KIDLOOK=<look> makes every emergency kid use that look (handy for checking a newly generated kid)
if (process.env.KIDLOOK) await g((look) => { for (const d of __game.missions.queue) d.look = look; }, process.env.KIDLOOK);
await page.click('#start');
await wait(1200);
await shot('02-start');

// Face close-up
await g(() => { __game.input.yaw = 0.3; __game.input.pitch = 0.15; __game.input.distance = 4; });
await wait(800);
await shot('03-face');
await g(() => { __game.input.yaw = Math.PI; __game.input.pitch = 0.35; __game.input.distance = 8; });

// Walk forward a bit with real keys
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
await wait(1200);
await shot('04-running');
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');

async function treat(name) {
  await page.keyboard.press('KeyE');
  await wait(300);
  await page.waitForFunction(() => __game.minigame.active, { timeout: 5000 }).catch(() => {}); // kneel first
  await wait(150);
  const open = await g(() => __game.minigame.active);
  if (name) await shot(name);
  for (let i = 0; i < 4 && (await g(() => __game.minigame.active)); i++) {
    await g(() => { const m = __game.minigame; m.pos = m.zoneX + m.zoneW / 2; m.dir = 0; });
    await page.keyboard.press('Space');
    await wait(150);
  }
  await page.waitForFunction(() => !__game.missions.busy, { timeout: 10000 }); // stand up + pick-up animations
  await wait(200);
  return open;
}
const tp = (x, z) => g(([x, z]) => { __game.player.pos.set(x, 0, z); __game.player.vel.set(0, 0, 0); }, [x, z]);

// Spawn everything now
await g(() => { const ms = __game.missions; while (ms.queue.length) ms.spawnMission(ms.queue.shift()); });
await wait(300);

// Knee
await tp(15, 11.5); await wait(400);
await shot('05-knee-kid');
await g(() => { __game.input.yaw = Math.PI * 0.6; __game.input.distance = 5; __game.input.pitch = 0.25; });
console.log('knee minigame opened:', await treat('06-minigame'));
await shot('06b-cheer');
await g(() => { __game.input.yaw = Math.PI; __game.input.distance = 8; __game.input.pitch = 0.35; });
// Tower
await tp(-13.2, 7.5); await wait(400);
await shot('07-tower');
console.log('tower opened:', await treat());
await wait(1200);
// Pond
await tp(17.0, -12.6); await wait(400);
await shot('08-pond');
console.log('pond opened:', await treat());
await wait(300);
await g(() => { __game.input.yaw = 0.6; __game.input.distance = 5; });
await wait(500);
await shot('09-carrying');
await tp(0, -40.5); await wait(300);
await page.keyboard.press('KeyE'); await wait(800);
await shot('10-dropoff');
await wait(1500);
// Bee
await tp(-28.8, 21); await wait(300);
console.log('bee opened:', await treat());
// Arm
await tp(36.8, -6); await wait(300);
console.log('arm opened:', await treat());
await tp(0, -40.5); await wait(300);
await page.keyboard.press('KeyE'); await wait(300);
// Lost toddler
await tp(-38, 38); await wait(500);
await tp(-44, 42); await wait(300);
await shot('11-lost');
console.log('lost opened:', await treat());
await g(() => { const m = __game.missions.mom.root.position; __game.player.pos.set(m.x + 1.5, 0, m.z + 1); });
await wait(300);
await page.keyboard.press('KeyE'); await wait(600);
await shot('12-mom');
console.log('state:', await g(() => ({ rescued: __game.missions.rescued, total: __game.missions.total, pops: __game.missions.lollipops, states: __game.missions.missions.map((m) => `${m.def.id}:${m.state}`) })));
await wait(3500);
await shot('13-end');
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
