// Top-down screenshot of the live world: node tools/topdown.mjs x z height out.png [w h]
import puppeteer from 'puppeteer-core';
const [x, z, hgt, out, w = 1000, h = 700] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: +w, height: +h }, protocolTimeout: 240000 });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto((process.env.BASE ?? 'http://localhost:8765/') + (process.env.Q ?? ''), { waitUntil: 'networkidle0', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 120000 });
await p.click('#start');
await p.evaluate(([x, z, hgt, process_nofog]) => {
  __game.player.pos.set(+x, 0, +z);
  __game.follow.update = () => { const c = __game.follow.camera; c.position.set(+x, +hgt, +z + 0.01); c.up.set(0, 0, -1); c.lookAt(+x, 0, +z); };
  document.getElementById('hud').style.display = 'none';
  if (process_nofog) __game.scene.fog = null;
}, [x, z, hgt, !!process.env.NOFOG]);
await new Promise((r) => setTimeout(r, 2500));
await p.screenshot({ path: out });
await b.close();
