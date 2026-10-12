// Caspi + Gorge: he's at his spot for the hour; E → "Later Later…" and he strolls off; his calm slows the
// treatment bar; Gorge goes missing, Doctor Guy finds him, brings him back → Caspi smiles (+10, achievement).
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
const r = {};
r.generated = await g(() => !!__game.caspi.rig.generated);
r.spot = await g(() => ({ hour: +__game.dayNight.hour.toFixed(1), at: __game.caspi.spot.name, pos: __game.caspi.pos.toArray().map((v) => +v.toFixed(1)) }));
// walk up to him and say hi
await g(() => { const c = __game.caspi.pos; __game.player.pos.set(c.x + 1.6, 0, c.z + 1); __game.input.yaw = Math.atan2(1.6, 1) ; __game.input.distance = 6; __game.input.pitch = 0.2; });
await page.waitForFunction(() => /Caspi/.test(document.getElementById('prompt').textContent), { timeout: 30000 }).catch(() => {});
r.prompt = await g(() => document.getElementById('prompt').textContent);
await page.screenshot({ path: '.shots/caspi-2-hey.png' });
const before = await g(() => __game.caspi.pos.toArray());
await page.keyboard.press('KeyE');
await wait(2500);
r.said = await g(() => !!__game.caspi.bubble);
await page.screenshot({ path: '.shots/caspi-3-later.png' });
await wait(3000);
r.walkedAway = await g((b) => +Math.hypot(__game.caspi.pos.x - b[0], __game.caspi.pos.z - b[2]).toFixed(1), before);
// chill aura: stand next to him (once he has stopped walking)
await g(() => { __game.caspi.route = null; const c = __game.caspi.pos; __game.player.pos.set(c.x + 3, 0, c.z); });
await wait(800);
r.auraSlow = await g(() => __game.minigame.slow);
await g(() => { __game.player.pos.set(__game.caspi.pos.x + 40, 0, __game.caspi.pos.z); });
await wait(800);
r.auraFar = await g(() => __game.minigame.slow);
// Gorge goes missing → find him → bring him back
await g(() => __game.caspi.loseGorge());
await wait(800);
r.lost = await g(() => ({ state: __game.caspi.gorgeState, toast: (__game.notices ?? []).slice(-3).join(' | '), blips: __game.caspi.blips().map((b) => b.icon).join('') }));
await g(() => { const gp = __game.caspi.gorge.root.position; __game.player.pos.set(gp.x + 1, 0, gp.z); });
await wait(1500);
r.found = await g(() => __game.caspi.gorgeState);
const pops0 = await g(() => __game.missions.lollipops);
await g(() => { const c = __game.caspi.pos; __game.player.pos.set(c.x + 2, 0, c.z); const gp = __game.caspi.gorge.root.position; gp.set(c.x + 2.5, 0, c.z + 1); });
await wait(2000);
r.home = await g(() => ({ state: __game.caspi.gorgeState, smiled: __game.progress.data.caspiSmiled }));
r.popsGained = (await g(() => __game.missions.lollipops)) - pops0;
r.achievement = await page.waitForFunction(() => __game.progress.has('caspi-smile'), { timeout: 30000 }).then(() => true).catch(() => false);
await page.screenshot({ path: '.shots/caspi-4-smile.png' });
console.log(JSON.stringify(r, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
