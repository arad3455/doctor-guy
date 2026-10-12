// Flu outbreak: start one in the park, every sick kid stands somewhere reachable, treat them all → bonus + achievement.
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
// every area: an outbreak can place all 5 kids (then cancel it)
r.perZone = await g(() => {
  const o = __game.outbreak, out = {};
  for (const z of ['park', 'beach', 'zoo', 'downtown', 'suburbs', 'pier', 'camp', 'harbor', 'airport']) {
    o.start(z); out[z] = o.active.kids.length;
    for (const e of o.active.kids) o.remove(e);
    o.abort();
  }
  return out;
});
await g(() => __game.outbreak.start('park'));
await wait(1000);
r.hud = await g(() => document.getElementById('outbreak-hud').innerText.replace(/\n/g, ' '));
r.blips = await g(() => __game.outbreak.blips().length);
await g(() => { __game.player.pos.set(__game.outbreak.active.kids[0].kid.root.position.x + 1.6, 0, __game.outbreak.active.kids[0].kid.root.position.z + 1); });
await page.waitForFunction(() => /Treat the flu/.test(document.getElementById('prompt').textContent), { timeout: 30000 }).catch(() => {});
r.prompt = await g(() => document.getElementById('prompt').textContent);
await page.screenshot({ path: '.shots/outbreak-1.png' });
const pops0 = await g(() => __game.missions.lollipops);
for (let k = 0; k < 5; k++) {
  const ok = await g((k) => { const A = __game.outbreak.active; if (!A) return false; const e = A.kids[k]; if (e.cured) return true; const p = e.kid.root.position; __game.player.pos.set(p.x + 1.6, 0, p.z + 1); return true; }, k);
  if (!ok) break;
  await page.waitForFunction(() => /Treat the flu/.test(document.getElementById('prompt').textContent), { timeout: 30000 }).catch(() => {});
  await page.keyboard.press('KeyE');
  await page.waitForFunction((k) => !__game.outbreak.active || __game.outbreak.active.kids[k].cured, { timeout: 60000 }, k).catch(() => {});
  await page.waitForFunction(() => !__game.missions.busy, { timeout: 60000 }).catch(() => {});
}
r.done = await g(() => ({ active: !!__game.outbreak.active, outbreaks: __game.progress.data.outbreaks }));
r.popsGained = (await g(() => __game.missions.lollipops)) - pops0;
r.achievement = await page.waitForFunction(() => __game.progress.has('outbreak-buster'), { timeout: 30000 }).then(() => true).catch(() => false);
console.log(JSON.stringify(r, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
