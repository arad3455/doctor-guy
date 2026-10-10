// node tools/tiles-shot.mjs "<names>" out.png [side]
import puppeteer from 'puppeteer-core';
const [names, out, side] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1400, height: side ? 500 : 300 } });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`http://localhost:8765/tools/tiles.html?names=${names}${side ? '&side=1' : ''}${side === 'back' ? '&back=1' : ''}`);
await p.waitForFunction(() => window.done, { timeout: 60000 });
await p.screenshot({ path: out });
await b.close();
