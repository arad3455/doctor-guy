// Draw calls / triangles at a few spots (with each zone group toggled): node tools/perf.mjs
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 960, height: 540 }, protocolTimeout: 240000 });
const p = await b.newPage();
await p.goto((process.env.BASE ?? 'http://localhost:8765/'), { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await p.click('#start');
const spots = JSON.parse(process.argv[2] ?? '[[0,0,0],[0,-20,3.14],[-100,-37,-1.57],[-132,-16,0],[100,-37,1.57],[0,100,0]]');
for (const [x, z, yaw] of spots) {
  await p.evaluate(([x, z, yaw]) => { __game.player.pos.set(x, 0, z); __game.input.yaw = yaw; }, [x, z, yaw]);
  // wait for a few real frames (software rendering is slow)
  await p.evaluate(() => new Promise((res) => { let n = 0; const f = () => (++n >= 4 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
  const r = await p.evaluate(() => {
    const i = __game.renderer.info.render;
    return { calls: i.calls, tris: i.triangles };
  });
  const vis = await p.evaluate(() => ['downtown', 'suburbs', 'pier', 'camp', 'harbor', 'zoo'].filter((k) => __game[k]?.group?.visible).join(','));
  console.log(`(${x},${z}) yaw ${yaw}`, JSON.stringify(r), 'visible:', vis);
}
await b.close();
