// Meshes per top-level group (each is a draw call, ×2 with outlines, + shadow pass): node tools/mesh-count.mjs
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 640, height: 360 }, protocolTimeout: 300000 });
const p = await b.newPage();
await p.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 300000 });
await p.waitForFunction(() => window.__game?.harbor && !document.getElementById('start').disabled, { timeout: 300000, polling: 2000 });
console.log(await p.evaluate(() => {
  const g = __game, known = new Map([[g.downtown?.group, 'downtown'], [g.suburbs?.group, 'suburbs'], [g.pier?.group, 'pier'], [g.camp?.group, 'camp'], [g.harbor?.group, 'harbor'], [g.zoo?.group, 'zoo'], [g.missions?.group, 'missions'], [g.ambulance?.root, 'ambulance']]);
  const rows = [];
  for (const c of g.scene.children) {
    let meshes = 0, inst = 0, shadow = 0, outline = 0;
    c.traverse((o) => { if (!o.isMesh) return; if (o.isInstancedMesh) inst++; else meshes++; if (o.castShadow) shadow++; if (o.material?.type === 'ShaderMaterial') outline++; });
    if (meshes + inst > 10) rows.push(`${known.get(c) ?? c.name ?? c.type}: meshes ${meshes}, instanced ${inst}, cast ${shadow}, outlines ${outline}`);
  }
  return rows.join('\n');
}));
await b.close();
