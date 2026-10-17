// Ilan Motors — Ilan's luxury car dealership in Downtown (the south-east block, facing the park avenue): a glass
// showroom with a polished floor, cars turning slowly on lit platforms, spotlights, a register with the catalogue,
// two more cars out on the forecourt and the YOUR CAR bay where a car you buy waits for you.
//
// The cars are one Meshy model (assets/props/carSuper.glb — the "Fulmine") in five editions; each gets its own
// paint by repainting the model's texture (and the stray badge Meshy drew on its side is painted out).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { part, toon, canvasTexture, FONT } from './toon.js';
import { addBox, addCircle } from './world.js';
import { gltfLoader } from './skinned.js';
import { dressSupra, dressMoto } from './communityCars.js';

/** The catalogue (prices in lollipops). paint: the body colour; null keeps the model's own red. */
export const CARS = [
  { id: 'rosso', name: 'Fulmine Rosso', paint: null, price: 60, top: '320 km/h', zero: '2.9 s', blurb: 'The classic. Everyone wants the red one.' },
  { id: 'nero', name: 'Fulmine Nero', paint: '#16171c', price: 90, top: '325 km/h', zero: '2.8 s', blurb: 'Black on black. Serious car for a serious man.' },
  { id: 'giallo', name: 'Fulmine Giallo', paint: '#ffc61a', price: 120, top: '330 km/h', zero: '2.7 s', blurb: 'Loud. Very loud. You will be seen.' },
  { id: 'blu', name: 'Fulmine Blu', paint: '#1f5fe0', price: 160, top: '335 km/h', zero: '2.6 s', blurb: 'Track edition. Lighter, meaner, bluer.' },
  { id: 'bianco', name: 'Fulmine Bianco', paint: '#f2f3f5', price: 220, top: '340 km/h', zero: '2.5 s', blurb: 'Pearl white. The one Ilan keeps for himself.' },
  // community models from Meshy (CC0), coloured in communityCars.js
  { id: 'kaze', name: 'Kaze Mk4', model: 'supra', paint: '#f08a1a', length: 5.0, price: 140, top: '285 km/h', zero: '4.6 s', blurb: 'A 90s legend with a wing you can see from space.' },
  { id: 'atlas', name: 'Atlas Adventure', model: 'moto', paint: '#f2f3f5', length: 3.2, bike: true, price: 100, top: '220 km/h', zero: '3.4 s', blurb: 'Panniers, a top case and nowhere it can’t go.' },
];
export const CAR_LENGTH = 5.4;
export const CAR_YAW = Math.PI / 2; // the model's nose points -x, like the ambulance's

let env = null;
/** A soft studio reflection map: what makes the paint look like paint. */
export function studioEnv(renderer) {
  if (env || !renderer) return env;
  const pm = new THREE.PMREMGenerator(renderer);
  env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  return env;
}

const baseModels = {};
/** Loads a showroom model once ('carSuper' = the Fulmine, 'supra', 'moto'). */
export async function loadCarModel(name = 'carSuper') {
  baseModels[name] ??= gltfLoader.loadAsync(new URL(`../assets/props/${name}.glb`, import.meta.url).href).then((g) => g.scene);
  return baseModels[name];
}
/** Dress a freshly loaded / cloned model as catalogue entry `car` (paint, materials, wheels for the coupe). */
export function dressCar(model, car, renderer) {
  if (car.model === 'supra') return dressSupra(model, car.paint, studioEnv(renderer));
  if (car.model === 'moto') return dressMoto(model, car.paint, studioEnv(renderer));
  return paintCar(model, car.paint, renderer);
}

const paintCache = new Map();
/** The model's texture repainted: the red body → `paint`, the yellow badge → body colour. */
function paintedTexture(map, paint) {
  const key = paint ?? 'rosso';
  if (paintCache.has(key)) return paintCache.get(key);
  const img = map.image, w = img.width, h = img.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h), px = data.data;
  // (all in plain sRGB bytes ↔ HSL: what you see in the texture is what you paint)
  const t = paint ? rgb2hsl(...[1, 3, 5].map((o) => parseInt(paint.slice(o, o + 2), 16))) : null;
  const bodyRed = [0.995, 0.85, 0.42];
  const kind = new Uint8Array(w * h); // 1 = body red, 2 = badge yellow
  const hsl = new Float32Array(w * h * 3);
  for (let i = 0, q = 0; i < px.length; i += 4, q++) {
    const [hh, ss, ll] = rgb2hsl(px[i], px[i + 1], px[i + 2]);
    hsl[q * 3] = hh; hsl[q * 3 + 1] = ss; hsl[q * 3 + 2] = ll;
    const hue = hh * 360;
    if ((hue < 22 || hue > 335) && ss > 0.4 && ll > 0.12) kind[q] = 1;
    else if (hue > 25 && hue < 70 && ss > 0.35 && ll > 0.25) kind[q] = 2;
  }
  // the badge Meshy drew (despite "no logos"): a small yellow shield with a dark emblem inside, sitting on the red
  // body. Any 16-px tile that's mostly body + badge and holds a few badge pixels is painted all body colour.
  const T = 16;
  for (let ty = 0; ty < h; ty += T) for (let tx = 0; tx < w; tx += T) {
    let red = 0, badge = 0, n = 0;
    for (let y = ty; y < Math.min(h, ty + T); y++) for (let x = tx; x < Math.min(w, tx + T); x++) { const k = kind[y * w + x]; n++; if (k === 1) red++; else if (k === 2) badge++; }
    if (badge >= 4 && red + badge > n * 0.45) for (let y = ty; y < Math.min(h, ty + T); y++) for (let x = tx; x < Math.min(w, tx + T); x++) { const q = y * w + x; if (kind[q] !== 1) { kind[q] = 3; hsl[q * 3 + 2] = 0.42; } }
  }
  for (let q = 0, i = 0; q < w * h; q++, i += 4) {
    const k = kind[q];
    if (!k) continue;
    let out;
    if (!t) out = k === 1 ? null : bodyRed; // the original red: only paint the badge out
    else {
      // keep the body's own shading (its lightness around a mid red), on the new colour
      const shade = k === 1 ? hsl[q * 3 + 2] : 0.42;
      const kk = t[2] > 0.85 ? 0.35 : t[2] < 0.15 ? 0.6 : 0.9;
      out = [t[0], t[1] * 0.95, Math.min(0.98, Math.max(0.03, t[2] + (shade - 0.42) * kk))];
    }
    if (!out) continue;
    const [r, g, bb] = hsl2rgb(...out);
    px[i] = r; px[i + 1] = g; px[i + 2] = bb;
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = map.flipY;
  tex.colorSpace = map.colorSpace;
  paintCache.set(key, tex);
  return tex;
}

/** Turns a loaded Fulmine into an edition: glossy painted materials with studio reflections. */
export function paintCar(model, paint, renderer) {
  const envMap = studioEnv(renderer);
  model.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.userData.srcMat ??= o.material;
    o.material = new THREE.MeshStandardMaterial({
      map: src.map ? paintedTexture(src.map, paint) : null,
      color: 0xffffff, metalness: 0.45, roughness: 0.28, envMap, envMapIntensity: 1.1,
    });
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return model;
}

/** A display copy of a catalogue car, sized and centred (nose along +z when yaw = 0). */
async function displayCar(car, renderer) {
  const m = (await loadCarModel(car.model ?? 'carSuper')).clone(true);
  m.traverse((o) => { if (o.isMesh) o.geometry = o.geometry.clone(); }); // (own colour attribute per copy)
  dressCar(m, car, renderer);
  m.rotation.y = CAR_YAW;
  m.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(m);
  const size = box.getSize(new THREE.Vector3());
  m.scale.setScalar((car.length ?? CAR_LENGTH) / Math.max(size.x, size.z));
  m.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(m);
  const c = box.getCenter(new THREE.Vector3());
  m.position.set(-c.x, -box.min.y, -c.z);
  const holder = new THREE.Group();
  holder.add(m);
  return holder;
}

/**
 * Builds the dealership on block `b` (from downtown.js block()). Returns the spots the game needs:
 * Ilan's spot, the register, the YOUR CAR bay, and addCars(renderer) (once the model has loaded).
 */
export function buildDealership(group, b, animated) {
  const g = new THREE.Group();
  group.add(g);
  // the building: x from bx0 (back) to bx1 (the glass front, facing east), z from bz0 to bz1
  const bx0 = b.x0 + 3.5, bx1 = b.x0 + 19.5, bz0 = b.z0 + 4.5, bz1 = b.z1 - 4.5, H = 6.4;
  const mid = (bz0 + bz1) / 2, door = 3.4;
  const W = bz1 - bz0, D = bx1 - bx0;
  // polished floor (inside), forecourt paving (outside)
  const floorTex = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#eef0f3'; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#d6dae0'; c.lineWidth = 3;
    for (let k = 0; k <= 256; k += 64) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, 256); c.moveTo(0, k); c.lineTo(256, k); c.stroke(); }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(D / 4, W / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(D, W), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.18, metalness: 0.1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((bx0 + bx1) / 2, 0.045, mid);
  floor.receiveShadow = true;
  g.add(floor);
  const forecourt = new THREE.Mesh(new THREE.PlaneGeometry(b.x1 - bx1, W + 6), toon(0x3a3f48));
  forecourt.rotation.x = -Math.PI / 2;
  forecourt.position.set((bx1 + b.x1) / 2, 0.04, mid);
  forecourt.receiveShadow = true;
  g.add(forecourt);
  // the walls: solid back and sides (dark grey cladding), a full-height glass front with a door gap
  const clad = 0x2b2f38;
  const back = part(new THREE.BoxGeometry(0.4, H, W), clad, { outline: 0.02 });
  back.position.set(bx0, H / 2, mid);
  g.add(back);
  for (const z of [bz0, bz1]) {
    const side = part(new THREE.BoxGeometry(D, H, 0.4), clad, { outline: 0.02 });
    side.position.set((bx0 + bx1) / 2, H / 2, z);
    g.add(side);
  }
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xa8d8ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide });
  for (const [z0, z1] of [[bz0, mid - door / 2], [mid + door / 2, bz1]]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, H - 0.4), glassMat);
    pane.rotation.y = Math.PI / 2;
    pane.position.set(bx1, (H - 0.4) / 2 + 0.2, (z0 + z1) / 2);
    g.add(pane);
    addBox(bx1, (z0 + z1) / 2, 0.4, z1 - z0);
    for (let z = z0; z <= z1 + 0.01; z += (z1 - z0) / Math.max(1, Math.round((z1 - z0) / 3))) { // slim white mullions
      const m = part(new THREE.BoxGeometry(0.14, H, 0.14), 0xf4f5f7, { outline: 0 });
      m.position.set(bx1, H / 2, z);
      g.add(m);
    }
  }
  // the roof: a white slab with a deep overhang over the front, a light strip underneath
  const roof = part(new THREE.BoxGeometry(D + 5, 0.5, W + 1.2), 0xf4f5f7, { outline: 0.02 });
  roof.position.set((bx0 + bx1) / 2 + 2.3, H + 0.25, mid);
  roof.castShadow = false; // (the showroom stays bright)
  g.add(roof);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, W), new THREE.MeshBasicMaterial({ color: 0xfff6dc }));
  strip.position.set(bx1 + 4.3, H - 0.05, mid);
  g.add(strip);
  for (const z of [bz0 + 1, bz1 - 1]) { // the overhang's two columns
    const col = part(new THREE.CylinderGeometry(0.2, 0.2, H, 12), 0xf4f5f7, { outline: 0.01 });
    col.position.set(bx1 + 4.4, H / 2, z);
    g.add(col);
    addCircle(bx1 + 4.4, z, 0.3);
  }
  // the name on the fascia, gold on black
  const fascia = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.62, 1.15), new THREE.MeshBasicMaterial({ map: nameTexture('ILAN MOTORS') }));
  fascia.rotation.y = Math.PI / 2;
  fascia.position.set(bx1 + 4.81, H + 0.2, mid);
  g.add(fascia);
  const backing = part(new THREE.BoxGeometry(0.15, 1.3, W * 0.66), 0x111216, { outline: 0 });
  backing.position.set(bx1 + 4.72, H + 0.2, mid);
  g.add(backing);
  // the tall pylon sign on the forecourt corner
  const pylon = new THREE.Group();
  pylon.position.set(b.x1 - 2, 0, b.z0 + 2);
  // (the pole stops under the panel, and the panel is thicker than the pole: nothing covers the name)
  const pole = part(new THREE.BoxGeometry(0.7, 7.4, 0.7), 0x111216, { outline: 0.02 });
  pole.position.y = 3.7;
  pylon.add(pole);
  const panel = part(new THREE.BoxGeometry(1.0, 2.6, 4.6), 0x111216, { outline: 0.02 });
  panel.position.y = 8.7;
  pylon.add(panel);
  for (const s of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.3), new THREE.MeshBasicMaterial({ map: nameTexture('ILAN\nMOTORS', true) }));
    face.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    face.position.set(s * 0.52, 8.7, 0);
    pylon.add(face);
  }
  g.add(pylon);
  addBox(b.x1 - 2, b.z0 + 2, 1, 1);
  addBox(bx0, mid, 0.6, W);
  addBox((bx0 + bx1) / 2, bz0, D, 0.6);
  addBox((bx0 + bx1) / 2, bz1, D, 0.6);

  // ---- inside: turntables, spotlights, the register
  const tables = [
    { x: bx0 + 5, z: bz0 + 5.2 }, { x: bx0 + 5, z: bz1 - 5.2 }, { x: bx0 + 10, z: mid + 0.2 },
    { x: bx1 + 7.5, z: bz0 + 3.5, outside: true }, { x: bx1 + 7.5, z: bz1 - 3.5, outside: true },
  ];
  const turners = [];
  for (const t of tables) {
    const plat = part(new THREE.CylinderGeometry(3.3, 3.4, 0.22, 40), t.outside ? 0x2b2f38 : 0xd8dce2, { outline: 0.012 });
    plat.position.set(t.x, 0.11, t.z);
    plat.receiveShadow = true;
    g.add(plat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.32, 0.05, 6, 48), new THREE.MeshBasicMaterial({ color: 0x9fe3ff }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(t.x, 0.2, t.z);
    g.add(ring);
    addCircle(t.x, t.z, 2.9);
    if (!t.outside) { // a spotlight cone from the ceiling
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, H - 0.6, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3d0, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.set(t.x, (H - 0.6) / 2 + 0.2, t.z);
      g.add(cone);
      const lamp = part(new THREE.CylinderGeometry(0.3, 0.4, 0.3, 12), 0x2b2f38, { outline: 0 });
      lamp.position.set(t.x, H - 0.2, t.z);
      g.add(lamp);
    }
    const turner = new THREE.Group();
    turner.position.set(t.x, 0.22, t.z);
    turner.userData.dynamic = true;
    g.add(turner);
    turners.push(turner);
  }
  animated.push({ update: (time) => { if (g.parent?.visible !== false) turners.forEach((tt, i) => { tt.rotation.y = time * 0.25 + i * 1.3; }); } });
  // the register: a sleek white counter with a screen showing the catalogue
  const reg = { x: bx0 + 2.2, z: mid };
  const counter = part(new THREE.BoxGeometry(1.2, 1.1, 4.2), 0xf4f5f7, { outline: 0.015 });
  counter.position.set(reg.x, 0.55, reg.z);
  g.add(counter);
  const top = part(new THREE.BoxGeometry(1.4, 0.08, 4.4), 0x111216, { outline: 0 });
  top.position.set(reg.x, 1.14, reg.z);
  g.add(top);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2), new THREE.MeshBasicMaterial({ map: screenTexture() }));
  screen.rotation.y = Math.PI / 2;
  screen.position.set(bx0 + 0.25, 3.2, mid);
  g.add(screen);
  addBox(reg.x, reg.z, 1.3, 4.3);
  // a couple of leather chairs and a plant by the door
  for (const z of [mid - 5.5, mid + 5.5]) {
    const chair = part(new THREE.BoxGeometry(1, 0.6, 1), 0x7a3e22, { outline: 0.01 });
    chair.position.set(bx1 - 1.0, 0.3, z);
    g.add(chair);
    const backrest = part(new THREE.BoxGeometry(0.25, 0.8, 1), 0x7a3e22, { outline: 0.01 });
    backrest.position.set(bx1 - 0.55, 0.75, z);
    g.add(backrest);
    addBox(bx1 - 0.9, z, 1.1, 1.1);
  }
  // the YOUR CAR bay on the forecourt, by the road
  const bay = { x: b.x1 - 4.5, z: mid, heading: 0 };
  const bayTex = canvasTexture(512, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = '#ffd23f'; c.lineWidth = 14; c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#ffd23f'; c.font = `700 70px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('YOUR CAR', w / 2, h / 2 + 4);
  });
  const bayMark = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 3.3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: bayTex, transparent: true, depthWrite: false }));
  bayMark.position.set(bay.x, 0.05, bay.z);
  bayMark.rotation.y = -Math.PI / 2; // (reads from the road)
  g.add(bayMark);

  return {
    group: g,
    ilan: { x: bx0 + 8.2, z: mid - 3.6, rot: Math.PI / 2 },
    // Ilan's stroll round the floor (clear of the platforms): stop = seconds he lingers, look = what he looks at
    tour: [
      { x: bx0 + 8.2, z: bz0 + 9.4, stop: 6, look: [bx0 + 10, mid] },
      { x: bx0 + 8.8, z: bz0 + 2.6, stop: 5, look: [bx0 + 5, bz0 + 5.2] },
      { x: bx0 + 13.9, z: bz0 + 3.2, stop: 5, look: [bx1 + 10, bz0 + 3.2] },
      { x: bx0 + 13.9, z: bz1 - 3.2, stop: 5, look: [bx1 + 10, bz1 - 3.2] },
      { x: bx0 + 8.8, z: bz1 - 2.6, stop: 5, look: [bx0 + 5, bz1 - 5.2] },
      { x: bx0 + 8.6, z: bz0 + 17, stop: 0 },
      { x: bx0 + 5.2, z: mid, stop: 6, look: [bx0 + 10, mid] },
    ],
    register: { x: reg.x + 1.4, z: reg.z, face: -Math.PI / 2 },
    bay,
    door: { x: bx1, z: mid },
    /** Put a car on every platform (once the model has loaded). */
    async addCars(renderer) {
      // inside: the Fulmine, the Kaze in the middle; out front: the bike and the white Fulmine
      const order = ['giallo', 'rosso', 'kaze', 'atlas', 'bianco'];
      await Promise.all(turners.map(async (tt, i) => {
        try { tt.add(await displayCar(CARS.find((c) => c.id === order[i]), renderer)); } catch (e) { console.warn('[dealer] car model failed', order[i], e); }
      }));
    },
  };
}

function nameTexture(text, stacked = false) {
  return canvasTexture(1024, stacked ? 540 : 200, (c, w, h) => {
    c.fillStyle = '#111216'; c.fillRect(0, 0, w, h);
    const grad = c.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ffe7a3'); grad.addColorStop(0.5, '#e0b44a'); grad.addColorStop(1, '#b8862a');
    c.fillStyle = grad; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `400 ${stacked ? 200 : 150}px Anton, Impact, sans-serif`;
    const lines = text.split('\n');
    lines.forEach((l, i) => c.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 220 + 6));
  });
}

function screenTexture() {
  return canvasTexture(720, 400, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#16171c'); g.addColorStop(1, '#2b2f38');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e0b44a'; c.font = `400 64px Anton, Impact, sans-serif`; c.textAlign = 'center'; c.fillText('THE FULMINE COLLECTION', w / 2, 110);
    c.fillStyle = '#ffffff'; c.font = `600 34px ${FONT}`;
    c.fillText('5 editions · 0–100 in 2.5 s', w / 2, 190);
    const cols = ['#e0323a', '#16171c', '#ffc61a', '#1f5fe0', '#f2f3f5'];
    cols.forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(w / 2 + (i - 2) * 80, 280, 26, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.stroke(); });
    c.fillStyle = '#9aa3ad'; c.font = `500 26px ${FONT}`; c.fillText('Ask at the register', w / 2, 360);
  });
}

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hsl2rgb(h, s, l) {
  if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255));
}
