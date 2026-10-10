// Start screen on desktop, phone landscape and phone portrait (+ the desktop help overlay)
import puppeteer, { KnownDevices } from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], protocolTimeout: 240000 });
const errors = [];
for (const [name, setup] of [
  ['desktop', (p) => p.setViewport({ width: 1440, height: 810 })],
  ['phone-landscape', (p) => p.emulate(KnownDevices['iPhone 13 landscape'])],
  ['phone-portrait', (p) => p.emulate(KnownDevices['iPhone 13'])],
]) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  await setup(page);
  await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'networkidle0', timeout: 180000 });
  await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: `.shots/title-${name}.png` });
  if (name === 'desktop') {
    await page.click('#help-open');
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: '.shots/title-help.png' });
    console.log('help opens:', await page.evaluate(() => !document.getElementById('help').classList.contains('hidden')));
  } else {
    console.log(name, 'help button visible:', await page.evaluate(() => !!document.getElementById('help-open').offsetParent));
  }
  await page.close();
}
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
