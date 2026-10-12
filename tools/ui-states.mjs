// Photographs every UI state into one contact sheet: node tools/ui-states.mjs out.jpg [mobile]
import puppeteer, { KnownDevices } from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
const [out = '.shots/ui-states.jpg', mobile] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 600000 });
const p = await b.newPage();
if (mobile) await p.emulate(KnownDevices['iPhone 13 landscape']);
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(process.env.BASE ?? 'http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 300000, polling: 1000 });
const g = (fn, a) => p.evaluate(fn, a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shots = [];
const snap = async (name) => { const f = `${process.env.TMPDIR ?? '/tmp'}/ui-${name}.png`; await p.screenshot({ path: f }); shots.push([name, f]); };
await snap('title');
await (mobile ? p.tap('#start') : p.click('#start'));
await wait(2500);
await snap('hud + new emergency');
await g(() => { __game.missions.lollipops = 200; const m = __game.missions.missions[0]; const k = m?.kid.root.position; if (k) __game.player.pos.set(k.x, 0, k.z - 1.5); });
await wait(1500);
await snap('prompt');
await g(() => { __game.headline({ kicker: 'CASPI’S CAT', title: 'Gorge is missing!', sub: 'Caspi doesn’t look worried… last seen in City Plaza', tone: 'caspi', icon: 'paw', ms: 8000 }); __game.notify('Golden Bandage 3/33', { icon: 'bandage', tone: 'reward', sub: 'Behind the fountain', reward: '+5 🍭', ms: 8000 }); __game.notify('Check-up · Noga', { icon: 'steth', tone: 'success', sub: 'Healthy as a horse!', reward: '+1 🍭 · +8 XP', ms: 8000 }); });
await wait(600);
await snap('headline + feed');
await g(() => { __game.frenzy.start(); __game.outbreak.start('park'); });
await wait(1500);
await snap('frenzy + outbreak timers');
await g(() => { __game.frenzy.abort(); for (const e of __game.outbreak.active?.kids ?? []) __game.outbreak.remove(e); __game.outbreak.abort(); });
await g(() => { const ms = __game.missions, m = ms.missions[0]; if (m) { m.misses = 0; ms.complete(m); } });
await wait(2600);
await snap('patient saved banner');
await p.waitForFunction(() => !__game.career.showing, { timeout: 60000 }).catch(() => {});
await wait(1200);
await snap('achievement + feed');
await g(() => __game.openShop(true));
await wait(800);
await snap('shop');
await g(() => { document.getElementById('shop-close').click(); __game.progress.data.visited = { park: true, downtown: true, beach: true }; __game.buses.show(__game.busStops[0]); });
await wait(800);
await snap('bus');
await g(() => { __game.buses.close(); __game.bigMap.toggle(true); });
await wait(1200);
await snap('big map');
await g(() => __game.bigMap.toggle(false));
// mini-game
await g(() => { const ms = __game.missions; const m = ms.missions.find((x) => x.state === 'active'); if (m) { const k = m.kid.root.position; __game.player.pos.set(k.x, 0, k.z - 1.5); } });
await wait(1200);
await p.keyboard.press('KeyE');
await p.waitForFunction(() => __game.minigame.active, { timeout: 20000 }).catch(() => {});
await wait(600);
await snap('treatment mini-game');
// montage
const list = shots.map(([n, f]) => `${n}|${f}`).join('\n');
execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw, ImageFont
rows=[l.split('|') for l in sys.argv[2].split('\\n')]
W,H=640,360
cols=3; n=len(rows); r=(n+cols-1)//cols
sheet=Image.new('RGB',(W*cols,(H+34)*r),(18,18,28)); d=ImageDraw.Draw(sheet)
try: f=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',22)
except: f=None
for i,(name,fn) in enumerate(rows):
    im=Image.open(fn).convert('RGB'); im.thumbnail((W,H)); x,y=(i%cols)*W,(i//cols)*(H+34)
    sheet.paste(im,(x,y+34)); d.text((x+10,y+6),name,fill=(255,210,63),font=f)
sheet.save(sys.argv[1],quality=86)
`, out, list]);
console.log('wrote', out, 'ERRORS:', errors.length ? errors : 'none');
await b.close();
