// Filmstrip of a Doctor Guy clip: node tools/clip-strip.mjs <clip> [yaw]
import puppeteer from 'puppeteer-core';
const [, , clip, yaw = '70'] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 520, height: 520 } });
const page = await browser.newPage();
await page.goto(`http://localhost:8765/tools/viewer.html?char=generated&view=${process.env.VIEW ?? 'full'}&yaw=${yaw}&clip=${clip}&speed=0.5`, { waitUntil: 'domcontentloaded', timeout: 180000 });
const t0 = Date.now();
for (let i = 0; i < 8; i++) {
  await page.screenshot({ path: `.shots/strip-${i}.png` });
  await new Promise((r) => setTimeout(r, 1200));
}
console.log('captured over', ((Date.now() - t0) / 1000).toFixed(1), 's');
await browser.close();
