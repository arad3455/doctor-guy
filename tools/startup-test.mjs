// Phone start-up check on a throttled connection: which controls show first, and is the title ever bare?
import puppeteer, { KnownDevices } from 'puppeteer-core';
const OUT = new URL('../.shots/', import.meta.url).pathname;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.emulate(KnownDevices['iPhone 13']);
const cdp = await page.createCDPSession();
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (4 * 1024 * 1024) / 8, uploadThroughput: (1024 * 1024) / 8 }); // ~4G
const t0 = Date.now();
page.goto(process.env.BASE ?? 'http://localhost:8765/');
const state = () => page.evaluate(() => ({
  touchHints: [...document.querySelectorAll('.touch-hint')].some((e) => e.offsetParent),
  keyHints: [...document.querySelectorAll('.key-hint')].some((e) => e.offsetParent),
  loading: document.documentElement.classList.contains('loading'),
  backdrop: getComputedStyle(document.getElementById('title'), '::before').opacity,
  button: document.getElementById('start')?.textContent,
})).catch(() => null);
let i = 0, ready = false;
while (Date.now() - t0 < 60000) {
  await new Promise((r) => setTimeout(r, i === 0 ? 250 : 700));
  const s = await state();
  if (!s) continue;
  await page.screenshot({ path: `${OUT}startup-${i}.png` }).catch(() => {});
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s  touchHints:${s.touchHints} keyHints:${s.keyHints} loading:${s.loading} backdrop:${s.backdrop} button:"${s.button}"`);
  i++;
  if (s.button === 'Start shift') { if (ready) break; ready = true; }
}
await browser.close();
