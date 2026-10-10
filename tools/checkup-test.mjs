// Stethoscope check-ups on kids out playing (E / ✋ near a non-emergency kid)
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 240000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 120000 });
await page.click('#start');
const g = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// stand next to the kid waving by the fountain
await g(() => {
  const a = __game.missions.ambient.find((x) => x.mode === 'wave');
  const k = a.kid.root.position;
  __game.player.pos.set(k.x - 1.7, 0, k.z - 0.4);
  __game.input.yaw = -2.2; __game.input.distance = 6; __game.input.pitch = 0.25;
});
await wait(800);
const prompt = await g(() => document.getElementById('prompt').textContent);
const pops = await g(() => __game.missions.lollipops);
await page.keyboard.press('KeyE');
await wait(1600);
await page.screenshot({ path: '.shots/checkup-1-listen.png' });
await page.waitForFunction(() => !__game.missions.busy, { timeout: 20000 });
await wait(400);
await page.screenshot({ path: '.shots/checkup-2-result.png' });
const after = await g(() => ({ pops: __game.missions.lollipops, feed: document.getElementById('feed').innerText.replace(/\n/g, ' | '), checkups: __game.career.stats.checkups }));
// again right away → "already checked", no reward
await wait(1500);
const prompt2 = await g(() => document.getElementById('prompt').textContent);
await page.keyboard.press('KeyE');
await page.waitForFunction(() => !__game.missions.busy, { timeout: 20000 });
const after2 = await g(() => __game.missions.lollipops);
// a kid on a swing works too
await g(() => { const a = __game.missions.ambient.find((x) => x.mode === 'swing'); const w = a.kid.root.getWorldPosition(new a.kid.root.position.constructor()); __game.player.pos.set(w.x, 0, w.z - 1.6); });
await wait(800);
const prompt3 = await g(() => document.getElementById('prompt').textContent);
console.log(JSON.stringify({ prompt, pops, after, prompt2, again: after2, prompt3 }, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
