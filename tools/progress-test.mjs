// Save + Doctor Shop + achievements: earn, shop at the stand, wear items, unlock, reload → still there.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 240000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const BASE = process.env.BASE ?? 'http://localhost:8765/';
const g = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const boot = async () => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
};
await boot();
await g(() => localStorage.clear());
await boot();
await page.click('#start');
// earn: rescue the first kid + give the wallet a boost
await g(() => { const ms = __game.missions; ms.spawnMission(ms.queue.shift()); ms.missions[0].misses = 0; ms.complete(ms.missions[0]); });
await page.waitForFunction(() => !__game.career.showing, { timeout: 60000 });
await page.waitForFunction(() => document.getElementById('achievement').classList.contains('show'), { timeout: 10000 }).catch(() => {});
await page.screenshot({ path: '.shots/progress-1-achievement.png' });
await g(() => { __game.missions.lollipops += 150; });
// walk to the lollipop stand → E opens the shop
await g(() => { __game.player.pos.set(-4.4, 0, -24); });
await wait(800);
const prompt = await g(() => document.getElementById('prompt').textContent);
await page.keyboard.press('KeyE');
await wait(600);
await page.screenshot({ path: '.shots/progress-2-shop.png' });
// buy a crown and a gold paint job
await page.click('[data-buy="hat-crown"]');
await page.click('[data-tab="paint"]');
await page.click('[data-buy="paint-gold"]');
await page.click('[data-tab="cape"]');
await page.click('[data-buy="cape-hero"]');
await wait(500);
await page.screenshot({ path: '.shots/progress-3-bought.png' });
await page.click('#shop-close');
await wait(1500); // achievements check + autosave
await g(() => { __game.input.yaw = Math.PI * 0.2; __game.input.distance = 5; __game.input.pitch = 0.2; });
await wait(1500);
await page.screenshot({ path: '.shots/progress-4-wearing.png' });
const before = await g(() => ({ wallet: __game.missions.lollipops, xp: __game.career.xp, owned: __game.progress.owned, equipped: __game.progress.equipped, achievements: Object.keys(__game.progress.data.achievements) }));
await wait(3500); // autosave
// reload: everything should come back
await boot();
const after = await g(() => ({ wallet: __game.progress.wallet, xp: __game.career.xp, owned: __game.progress.owned, rank: document.getElementById('rank').innerText.replace(/\n/g, ' ') }));
await page.click('#trophies-open');
await wait(500);
await page.screenshot({ path: '.shots/progress-5-trophies.png' });
await page.click('#trophies-close');
await page.click('#start');
await wait(1500);
const afterStart = await g(() => ({ wallet: __game.missions.lollipops, hat: !!__game.player.rig.setHat }));
console.log(JSON.stringify({ prompt, before, after, afterStart }, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
