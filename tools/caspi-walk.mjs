// Film Caspi + Gorge walking from the side (feet on the ground, cat legs moving): a strip of frames.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 900, height: 520 }, protocolTimeout: 600000 });
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await p.click('#start');
await p.waitForFunction(() => __game.caspi.gorge.rig, { timeout: 60000 }).catch(() => errors.push('no cat rig'));
await p.evaluate((process_cat) => {
  const c = __game.caspi;
  c.pos.set(-20, 0, 30); c.gorge.root.position.set(-21.5, 0, 29);
  __game.player.pos.set(-20, 0, 40);
  c.route = [{ x: 20, z: 30 }];
  c.wanderBack = null;
  document.getElementById('hud').style.display = 'none';
  __game.follow.update = () => { const cam = __game.follow.camera, cp = c.pos; const gp = c.gorge.root.position; cam.position.set(gp.x + (process_cat ? 0 : 0), process_cat ? 0.35 : 1.1, gp.z + (process_cat ? 1.15 : 4.2)); cam.lookAt(gp.x, process_cat ? 0.25 : 0.7, gp.z); };
}, !!process.env.CAT);
const frames = [];
for (let i = 0; i < 6; i++) {
  await new Promise((r) => setTimeout(r, 450));
  frames.push(await p.screenshot({ encoding: 'base64' }));
  if (process.env.CAT && i < 4) await p.screenshot({ path: `.shots/gorge-frame${i}.png` });
}
await p.evaluate((fr) => {
  document.body.innerHTML = '';
  const c = document.createElement('div'); c.style.cssText = 'display:grid;grid-template-columns:repeat(3,300px);gap:2px;background:#000';
  for (const f of fr) { const im = new Image(); im.src = 'data:image/png;base64,' + f; im.style.width = '300px'; c.appendChild(im); }
  document.body.appendChild(c);
}, frames);
await new Promise((r) => setTimeout(r, 800));
await p.screenshot({ path: process.env.CAT ? '.shots/gorge-walk.png' : '.shots/caspi-walk.png', clip: { x: 0, y: 0, width: 904, height: 350 } });
console.log('ERRORS:', errors.length ? errors : 'none');
await b.close();
