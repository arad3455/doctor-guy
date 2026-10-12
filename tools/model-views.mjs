// Top / side / front views of a GLB with axes: node tools/model-views.mjs assets/props/gorge.glb out.png
import puppeteer from 'puppeteer-core';
const [file, out] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], defaultViewport: { width: 1200, height: 400 }, protocolTimeout: 600000 });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:8765/tools/tiles.html?names=none', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.done, { timeout: 120000 });
await p.evaluate(async (file) => {
  const THREE = await import('three');
  const { gltfLoader } = await import('/src/skinned.js');
  const g = await gltfLoader.loadAsync('/' + file);
  document.body.innerHTML = '';
  const views = [['top', [0, 6, 0.001]], ['side +x', [6, 0.5, 0]], ['front +z', [0, 0.5, 6]]];
  for (const [name, at] of views) {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xeeeeee);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 3));
    scene.add(g.scene.clone());
    scene.add(new THREE.AxesHelper(1.5)); // x red, y green, z blue
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100); cam.position.set(...at); cam.lookAt(0, 0, 0);
    const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(400, 400); r.render(scene, cam);
    const d = document.createElement('div'); d.style.cssText = 'display:inline-block;position:relative';
    d.appendChild(r.domElement); const l = document.createElement('b'); l.textContent = name; l.style.cssText = 'position:absolute;left:8px;top:6px;font:16px sans-serif'; d.appendChild(l);
    document.body.appendChild(d);
  }
}, file);
await new Promise((r) => setTimeout(r, 1500));
await p.screenshot({ path: out });
await b.close();
