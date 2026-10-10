// Draw calls / triangles at a few spots (with each zone group toggled): node tools/perf.mjs
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 960, height: 540 }, protocolTimeout: 240000 });
const p = await b.newPage();
await p.goto((process.env.BASE ?? 'http://localhost:8765/'), { waitUntil: 'networkidle0', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 120000 });
await p.click('#start');
const spots = JSON.parse(process.argv[2] ?? '[[0,0,0],[0,-20,3.14],[-100,-37,-1.57],[-132,-16,0],[100,-37,1.57],[0,100,0]]');
for (const [x, z, yaw] of spots) {
  await p.evaluate(([x, z, yaw]) => { __game.player.pos.set(x, 0, z); __game.input.yaw = yaw; }, [x, z, yaw]);
  await new Promise((r) => setTimeout(r, 1500));
  const r = await p.evaluate(() => {
    const i = __game.renderer.info.render;
    return { calls: i.calls, tris: i.triangles };
  });
  await p.evaluate(() => { window.__hide = { downtown: true }; });
  await new Promise((r) => setTimeout(r, 600));
  const r2 = await p.evaluate(() => { const i = __game.renderer.info.render; return { calls: i.calls, tris: i.triangles }; });
  await p.evaluate(() => { window.__hide = {}; });
  console.log(`(${x},${z}) yaw ${yaw}`, JSON.stringify(r), 'without downtown', JSON.stringify(r2));
}
await b.close();
