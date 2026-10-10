// node tools/shoot.mjs out-prefix "query1" "query2" ...   → .shots/<prefix>-<n>.png
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
const [, , prefix, ...queries] = process.argv;
const OUT = new URL('../.shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  defaultViewport: { width: 700, height: 700 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
for (const [i, q] of queries.entries()) {
  await page.goto(`http://localhost:8765/tools/viewer.html?${q}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: `${OUT}${prefix}-${i}.png` });
}
await browser.close();
console.log('ok');
