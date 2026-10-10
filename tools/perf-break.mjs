// Where do the draw calls come from? Hide one group at a time at a spot and measure: node tools/perf-break.mjs x z yaw
import puppeteer from 'puppeteer-core';
const [x, z, yaw] = process.argv.slice(2).map(Number);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 960, height: 540 }, protocolTimeout: 240000 });
const p = await b.newPage();
await p.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
await p.click('#start');
await p.evaluate(([x, z, yaw]) => { __game.player.pos.set(x, 0, z); __game.input.yaw = yaw; }, [x, z, yaw]);
const frames = () => p.evaluate(() => new Promise((res) => { let n = 0; const f = () => (++n >= 3 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
await frames();
const calls = () => p.evaluate(() => __game.renderer.info.render.calls);
const base = await calls();
const out = { base };
const groups = await p.evaluate(() => {
  const g = __game, known = new Map([[g.downtown?.group, 'downtown'], [g.suburbs?.group, 'suburbs'], [g.pier?.group, 'pier'], [g.camp?.group, 'camp'], [g.harbor?.group, 'harbor'], [g.zoo?.group, 'zoo'], [g.missions?.group, 'missions'], [g.ambulance?.root, 'ambulance'], [g.player?.rig?.root, 'doctor']]);
  return g.scene.children.map((c, i) => `${i}:${known.get(c) ?? c.name ?? ''}:${c.type}:${c.children.length}`);
});
for (let i = 0; i < groups.length; i++) {
  await p.evaluate((i) => { const c = __game.scene.children[i]; c.userData.was = c.visible; c.visible = false; c.userData.forceHide = true; }, i);
  // main.js re-shows zone groups each frame: patch onBeforeRender-free hiding via layers instead
  await p.evaluate((i) => { const c = __game.scene.children[i]; c.traverse((o) => o.layers.disable(0)); }, i);
  await frames();
  const c = await calls();
  await p.evaluate((i) => { const c = __game.scene.children[i]; c.traverse((o) => o.layers.enable(0)); c.visible = c.userData.was; }, i);
  if (base - c > 3) out[groups[i]] = base - c;
}
console.log(JSON.stringify(out));
await b.close();
