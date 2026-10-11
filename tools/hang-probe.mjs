// Boots the game; if the page stops answering, pause it in the debugger and print the JS stack.
import puppeteer from 'puppeteer-core';
const runs = Number(process.argv[2] ?? 3);
for (let r = 0; r < runs; r++) {
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 900000 });
  const p = await b.newPage();
  const cdp = await p.target().createCDPSession();
  await cdp.send('Debugger.enable');
  cdp.on('Debugger.paused', (e) => {
    console.log(`run ${r}: PAUSED — stack:`);
    for (const f of e.callFrames.slice(0, 12)) console.log('  ', f.functionName || '(anon)', f.url.split('/').slice(-1)[0] + ':' + (f.location.lineNumber + 1));
    cdp.send('Debugger.resume').catch(() => {});
  });
  const t0 = Date.now();
  await p.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 600000 }).catch((e) => console.log('goto', e.message));
  let ready = false;
  const watchdog = setInterval(async () => {
    if (ready) return;
    const alive = await Promise.race([p.evaluate(() => 1).then(() => true), new Promise((res) => setTimeout(() => res(false), 15000))]);
    if (!alive) { console.log(`run ${r}: page not answering after ${((Date.now() - t0) / 1000).toFixed(0)}s → pausing`); cdp.send('Debugger.pause').catch(() => {}); }
  }, 20000);
  ready = await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 400000, polling: 2000 }).then(() => true).catch(() => false);
  clearInterval(watchdog);
  console.log(`run ${r}: ready=${ready} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (ready) {
    // the progress test clears the save and reloads
    await p.evaluate(() => localStorage.clear());
    const t1 = Date.now();
    await p.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 600000 }).catch((e) => console.log('goto2', e.message));
    const ready2 = await p.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 400000, polling: 2000 }).then(() => true).catch(() => false);
    console.log(`run ${r}: reload ready=${ready2} in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
  }
  await b.close();
}
