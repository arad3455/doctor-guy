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
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 60000 });
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

// Spawn everything now, then rescue each kid in turn
// a wide look at the beach from the end of the boardwalk, and back at the park gate
await g(() => { __game.player.pos.set(0, 0, 82); __game.input.yaw = 0; __game.input.pitch = 0.3; __game.input.distance = 13; });
await wait(1500);
await shot('25-beach-wide');
await g(() => { __game.player.pos.set(0, 0, 62); __game.input.yaw = Math.PI; __game.input.pitch = 0.25; __game.input.distance = 10; });
await wait(1000);
await shot('26-boardwalk');
await g(() => { const ms = __game.missions; while (ms.queue.length) ms.spawnMission(ms.queue.shift()); });
await wait(300);
const ids = await g(() => __game.missions.missions.map((m) => m.def.id));
const SHOTS = { knee: '06-minigame', float: '20-beach-float', sunburn: '21-beach-sunburn', crab: '22-beach-crab' };
for (const id of ids) {
  // stand next to the kid (on the shore side for kids in the water; below the slide tower for Maya)
  await g((id) => {
    const m = __game.missions.missions.find((x) => x.def.id === id);
    const k = m.kid.root.position;
    if (id === 'tower') __game.player.pos.set(-13.2, 0, 7.5);
    else if (m.def.water || id === 'pond') __game.player.pos.set(k.x, 0, k.z - 1.6);
    else __game.player.pos.set(k.x, 0, k.z - 1.5);
    __game.player.vel.set(0, 0, 0);
    if (!m.found) { m.found = true; m.bubble.visible = m.icon.visible = m.beacon.visible = true; }
  }, id);
  await wait(500);
  if (SHOTS[id]) {
    await g(() => { __game.input.yaw = Math.PI * 0.85; __game.input.distance = 6; __game.input.pitch = 0.3; });
    await wait(500);
    await shot(SHOTS[id].replace('06-minigame', '05-knee-kid'));
  }
  const opened = await treat(id === 'knee' ? '06-minigame' : null);
  if (id === 'knee') await shot('06b-cheer');
  // hand carried kids over at their drop-off
  const carried = await g((id) => __game.missions.missions.find((x) => x.def.id === id).state === 'carried', id);
  if (carried) {
    if (id === 'float') { await g(() => { __game.input.yaw = 0.6; __game.input.distance = 6; }); await wait(400); await shot('23-beach-carry'); }
    await g((id) => {
      const ms = __game.missions, m = ms.missions.find((x) => x.def.id === id);
      const t = ms.dropPos(m.def);
      __game.player.pos.set(t.x + 1.2, 0, t.z + 0.6);
    }, id);
    await wait(300);
    await page.keyboard.press('KeyE');
    await wait(900);
    if (id === 'heat') await shot('24-beach-firstaid');
  }
  const state = await g((id) => __game.missions.missions.find((x) => x.def.id === id).state, id);
  console.log(`${id.padEnd(8)} minigame:${opened} → ${state}`);
  await g(() => { __game.input.yaw = Math.PI; __game.input.distance = 8; __game.input.pitch = 0.35; });
}
console.log('state:', await g(() => ({ rescued: __game.missions.rescued, total: __game.missions.total, pops: __game.missions.lollipops })));
await wait(3500);
await shot('13-end');
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
