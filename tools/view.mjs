// Free camera screenshot: node tools/view.mjs "px,pz" "cx,cy,cz" "tx,ty,tz" out.png [hour] [w h]
import puppeteer from 'puppeteer-core';
const [pp, cc, tt, out, hour, w = 1280, h = 720] = process.argv.slice(2);
const [px, pz] = pp.split(',').map(Number), cam = cc.split(',').map(Number), tgt = tt.split(',').map(Number);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: +w, height: +h }, protocolTimeout: 240000 });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto((process.env.BASE ?? 'http://localhost:8765/') + (process.env.Q ?? ''), { waitUntil: 'networkidle0' });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 120000 });
await p.click('#start');
await p.evaluate(([px, pz, cam, tgt, hour, hud]) => {
  __game.player.pos.set(px, 0, pz);
  if (hour) __game.dayNight.hour = +hour;
  __game.follow.update = () => { const c = __game.follow.camera; c.position.set(...cam); c.up.set(0, 1, 0); c.lookAt(...tgt); };
  if (!hud) document.getElementById('hud').style.display = 'none';
}, [px, pz, cam, tgt, hour ? +hour : 0, !!process.env.HUD]);
await new Promise((r) => setTimeout(r, 3000));
await p.screenshot({ path: out });
const info = await p.evaluate(() => ({ calls: __game.renderer.info.render.calls, tris: __game.renderer.info.render.triangles }));
console.log(out, JSON.stringify(info), errs.length ? errs : '');
await b.close();
