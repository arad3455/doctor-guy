// Check-up Frenzy: start at the 🩺 token, chain quick check-ups for a combo, timer runs out → FRENZY COMPLETE
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 240000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await page.click('#start');
const g = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await g(() => { __game.player.pos.set(9, 0, -10.8); __game.input.yaw = 0; __game.input.distance = 9; __game.input.pitch = 0.3; });
await wait(1200);
await page.screenshot({ path: '.shots/frenzy-1-token.png' });
const prompt = await g(() => document.getElementById('prompt').textContent);
await page.keyboard.press('KeyE');
await wait(600);
console.log("PROMPT", prompt);
const started = await g(() => ({ active: __game.frenzy.active, kids: __game.frenzy.kids?.length, hud: document.getElementById('frenzy-hud').innerText.replace(/\n/g, ' ') }));
// check 4 kids back to back
const checks = [];
for (let i = 0; i < 4; i++) {
  await g(() => {
    const e = __game.frenzy.kids.find((k) => !k.checking);
    const k = e.kid.root.position;
    __game.player.pos.set(k.x - 1.5, 0, k.z);
  });
  await wait(500);
  const label = await g(() => document.getElementById('prompt').textContent);
  const t0 = await g(() => __game.missions.time);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => __game.missions.busy, { timeout: 5000 });
  await page.waitForFunction(() => !__game.missions.busy, { timeout: 20000 });
  checks.push({ label, gameSec: +(await g(() => __game.missions.time) - t0).toFixed(2), combo: await g(() => __game.frenzy.combo), score: await g(() => __game.frenzy.score) });
  if (i === 2) await page.screenshot({ path: '.shots/frenzy-2-combo.png' });
}
await wait(1600);
const kidsAfter = await g(() => __game.frenzy.kids.length);
const pops = await g(() => __game.missions.lollipops);
// fast-forward the clock
await g(() => { __game.frenzy.left = 0.5; });
await page.waitForFunction(() => !__game.frenzy.active, { timeout: 10000 });
await wait(3500);
await page.screenshot({ path: '.shots/frenzy-3-complete.png' });
const banner = await g(() => document.getElementById('saved-banner').innerText.replace(/\n/g, ' | '));
await page.waitForFunction(() => !__game.career.showing, { timeout: 30000 });
const end = await g(() => ({ pops: __game.missions.lollipops, best: __game.progress.data.frenzyBest, ambientFrenzy: __game.missions.ambient.filter((a) => a.frenzy).length, token: __game.frenzy.token.visible, hudHidden: document.getElementById('frenzy-hud').classList.contains('hidden') }));
console.log(JSON.stringify({ prompt, started, checks, kidsAfter, popsDuring: pops, banner, end }, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
