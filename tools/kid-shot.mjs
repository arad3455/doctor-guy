// A kid look in the game, posed: node tools/kid-shot.mjs <look> out.png [state]
import puppeteer from 'puppeteer-core';
const [look, out, state = 'idle'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 900, height: 700 }, protocolTimeout: 240000 });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:8765/', { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 120000 });
await p.click('#start');
const info = await p.evaluate(async ([look, state]) => {
  const { buildKid, animateRig } = await import('/src/characters.js');
  const kids = [];
  ['capKid', look, 'mom'].forEach((l, i) => {
    const k = buildKid(l);
    k.root.position.set(-3 + i * 1.6 - 1.6, 0, -6);
    __game.scene.add(k.root);
    kids.push(k);
  });
  __game.player.pos.set(30, 0, 30);
  __game.follow.update = () => { const c = __game.follow.camera; c.position.set(-1.6, 1.3, -1.2); c.lookAt(-1.6, 0.8, -6); };
  document.getElementById('hud').style.display = 'none';
  let t = 0;
  setInterval(() => { t += 0.05; kids.forEach((k) => animateRig(k, state, t, 0.05)); }, 50);
  return { generated: kids.map((k) => !!k.generated), height: kids[1].height };
}, [look, state]);
await new Promise((r) => setTimeout(r, 3000));
await p.screenshot({ path: out });
console.log(JSON.stringify(info));
await b.close();
