// Every outdoor mission spot, lollipop and ambient kid: inside the walkable area and not inside a collider.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 800, height: 450 }, protocolTimeout: 240000 });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'networkidle0', timeout: 180000 });
await page.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 120000 });
await page.click('#start');
await new Promise((r) => setTimeout(r, 1500));
const res = await page.evaluate(() => {
  const W = __game.world, cols = W.getColliders();
  const inside = (x, z, pad = 0.3) => cols.filter((c) => c.owner !== 'car' && (c.type === 'circle' ? Math.hypot(c.x - x, c.z - z) < c.r + pad : x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad));
  const walkable = (x, z) => { const p = { x, z }; W.clampWalkable(p); return Math.hypot(p.x - x, p.z - z) < 0.01; };
  const out = { missions: [], pops: [], ambient: [] };
  const defs = [...__game.missions.queue, ...__game.missions.missions.map((m) => m.def)];
  for (const d of defs) {
    if (d.spot || d.zone === 'hospital') continue;
    const [x, z] = d.at;
    const hit = d.special === 'catch' ? [] : inside(x, z);
    const ok = walkable(x, z) || d.water || d.id === 'pond';
    if (hit.length || !ok) out.missions.push({ id: d.id, at: [+x.toFixed(1), +z.toFixed(1)], walkable: ok, hits: hit.map((c) => c.type === 'circle' ? `circle ${c.x.toFixed(1)},${c.z.toFixed(1)} r${c.r}` : `box ${c.minX.toFixed(1)}..${c.maxX.toFixed(1)} × ${c.minZ.toFixed(1)}..${c.maxZ.toFixed(1)}`) });
  }
  for (const p of __game.missions.pops) {
    const { x, z } = p.position;
    const hit = inside(x, z, 0);
    if (hit.length || !walkable(x, z)) out.pops.push([+x.toFixed(1), +z.toFixed(1), hit.length, walkable(x, z)]);
  }
  out.total = defs.filter((d) => !d.spot && d.zone !== 'hospital').length;
  out.popCount = __game.missions.pops.length;
  out.zones = [[-132, -16], [-90, -37], [84.5, 10], [100, -15], [100, 40]].map(([x, z]) => `${W.zoneAt(z, x)} · ${W.locationName({ x, z })}`);
  return out;
});
console.log(JSON.stringify(res, null, 1));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
