// Standing poses side by side, seen from the side and the front: node tools/idle-shot.mjs out.png
import puppeteer from 'puppeteer-core';
const out = process.argv[2] ?? '.shots/idle.png';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1100, height: 460 }, protocolTimeout: 600000 });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await p.click('#start');
const info = await p.evaluate(async () => {
  const THREE = await import('three');
  const { buildKid, animateRig } = await import('/src/characters.js');
  const kids = ['caspi', 'mom', 'capKid'].map((l, i) => { const k = buildKid(l); k.root.position.set(30 + i * 1.6, 0, -37); k.root.rotation.y = Math.PI / 2; __game.scene.add(k.root); return k; });
  __game.caspi.rig.root.visible = false; __game.caspi.gorge.root.visible = false;
  const doc = __game.player;
  doc.pos.set(30 + 3 * 1.6 + 0.4, 0, -37); doc.facing = Math.PI / 2;
  let t = 0; setInterval(() => { t += 0.05; kids.forEach((k) => animateRig(k, 'idle', t, 0.05)); }, 50);
  window.__side = true;
  __game.follow.update = () => { const c = __game.follow.camera; if (window.__side) { c.position.set(32.5, 1.0, -31.5); c.lookAt(32.5, 0.8, -37); } else { c.position.set(41, 1.0, -37); c.lookAt(30, 0.8, -37); } };
  document.getElementById('hud').style.display = 'none';
  await new Promise((r) => setTimeout(r, 2500));
  return kids.map((k) => { let ys = []; k.root.updateMatrixWorld(true); k.root.traverse((o) => { if (o.isBone && /^(left|right).?foot$/i.test(o.name)) ys.push(+o.getWorldPosition(new THREE.Vector3()).y.toFixed(3)); }); return ys; });
});
console.log('foot heights (left, right):', JSON.stringify(info));
await p.screenshot({ path: out.replace('.png', '-side.png') });
await p.evaluate(() => { window.__side = false; });
await new Promise((r) => setTimeout(r, 1500));
await p.screenshot({ path: out.replace('.png', '-front.png') });
await b.close();
