// Zone 3 — Wolfson City Zoo, east of the park along Zoo Road (drive it in the ambulance in a few seconds).
// Animals are Meshy models (assets/props/<animal>.glb). Meshy can't rig four-legged animals, so they're
// static meshes brought to life here: wandering, breathing, head-turning, the monkey hopping.
import * as THREE from 'three';
import { part, toon, instanced, canvasTexture, signTexture, FONT } from './toon.js';
import { addCircle } from './world.js';
import { gltfLoader, toonify } from './skinned.js';

export const ZOO = {
  road: { z: -37, x0: -24, x1: 140, width: 7 }, // Zoo Road, from the hospital plaza to the zoo gate
  gate: new THREE.Vector3(138, 0, -37),
  min: new THREE.Vector3(137.5, 0, -45.5),
  max: new THREE.Vector3(232.5, 0, 45.5),
  center: new THREE.Vector3(185, 0, 0),
  ring: 24, // visitor path around the middle
  pens: {
    lion: { x: 212, z: -24, r: 11, label: 'LIONS', color: 0xd9b56b },
    elephant: { x: 212, z: 24, r: 13, label: 'ELEPHANTS', color: 0xc9a46a },
    giraffe: { x: 158, z: 26, r: 12, label: 'GIRAFFES', color: 0xd8c27a },
    penguin: { x: 160, z: -21, r: 8.5, label: 'PENGUINS', color: 0xe6f2fa },
    monkey: { x: 185, z: 2, r: 7.5, label: 'MONKEYS', color: 0x9ccf6a },
  },
};
export const inZoo = (p) => p.x > ZOO.min.x - 1;

// How each animal model is sized (game units) and which way its nose points once loaded
const ANIMALS = {
  lion: { length: 3.6, yaw: 0, speed: 1.6, count: 2 },
  elephant: { height: 3.9, yaw: 0, speed: 1.0, count: 2 },
  giraffe: { height: 6.4, yaw: 0, speed: 1.2, count: 2 },
  penguin: { height: 1.05, yaw: 0, speed: 0.9, count: 5 },
  monkey: { height: 1.05, yaw: 0, speed: 2.2, count: 2 },
};
const q = new URLSearchParams(location.search);
for (const k of Object.keys(ANIMALS)) if (q.has(`${k}Yaw`)) ANIMALS[k].yaw = Number(q.get(`${k}Yaw`)); // tuning helper

const rand = (() => { let s = 777; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

/** Zoo Road: always visible outdoors (it starts in the park). */
export function buildRoad(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const { z, x0, x1, width } = ZOO.road;
  const len = x1 - x0;
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(len, width), toon(0x4a5058));
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set((x0 + x1) / 2, 0.03, z);
  asphalt.receiveShadow = true;
  group.add(asphalt);
  for (const side of [-1, 1]) { // kerbs
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.3), toon(0xd8dde3));
    kerb.position.set((x0 + x1) / 2, 0.06, z + side * (width / 2 + 0.15));
    group.add(kerb);
  }
  const dashes = [];
  for (let x = x0 + 2; x < x1 - 2; x += 4) dashes.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.04, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
  group.add(instanced(new THREE.BoxGeometry(2, 0.01, 0.22), 0xffd23f, dashes, { outline: 0, cast: false }));
  // street lamps on both sides once outside the park, and road signs
  const lamps = [];
  for (let x = 62; x < x1; x += 14) for (const side of [-1, 1]) lamps.push([x + (side > 0 ? 7 : 0), z + side * (width / 2 + 1.2)]);
  for (const [x, lz] of lamps) {
    const pole = part(new THREE.CylinderGeometry(0.08, 0.1, 4.6, 8), 0x2b2f38, { outline: 0.015 });
    pole.position.set(x, 2.3, lz);
    group.add(pole);
    const arm = part(new THREE.BoxGeometry(0.1, 0.1, 1.2), 0x2b2f38, { outline: 0 });
    arm.position.set(x, 4.55, lz + (lz < z ? 0.5 : -0.5));
    group.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), toon(0xfff3b0, { emissive: 0x6a5a20 }));
    bulb.position.set(x, 4.4, lz + (lz < z ? 1.0 : -1.0));
    group.add(bulb);
    addCircle(x, lz, 0.25);
  }
  const roadSign = (x, sz, lines, color) => {
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.3), new THREE.MeshBasicMaterial({ map: signTexture(lines, { w: 512, h: 208, size: 60, bg: color, fg: '#ffffff' }), side: THREE.DoubleSide }));
    board.position.y = 2.9;
    g.add(board);
    const post = part(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), 0x9aa3ad, { outline: 0.01 });
    post.position.y = 1.2;
    g.add(post);
    g.position.set(x, 0, sz);
    g.rotation.y = -Math.PI / 2; // readable when driving east
    group.add(g);
    addCircle(x, sz, 0.2);
  };
  roadSign(20, z - width / 2 - 1.6, ['ZOO →'], '#2e8b3c');
  roadSign(64, z - width / 2 - 1.6, ['ZOO ROAD', 'Wolfson City Zoo 1 km'], '#2e8b3c');
  roadSign(110, z + width / 2 + 1.6, ['🦁 ZOO AHEAD'], '#c0541f');
  return { group };
}

export async function buildZoo(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const animated = [];
  const { min, max, center, pens } = ZOO;

  // ---- ground: zoo grass, the visitor ring path, the path in from the gate
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(max.x - min.x, max.z - min.z), toon(0x7ccf55));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set((min.x + max.x) / 2, 0.012, (min.z + max.z) / 2);
  grass.receiveShadow = true;
  group.add(grass);
  const pathMat = toon(0xe8cf98);
  const ring = new THREE.Mesh(new THREE.RingGeometry(ZOO.ring - 2, ZOO.ring + 2, 80), pathMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(center.x, 0.02, center.z);
  ring.receiveShadow = true;
  group.add(ring);
  const entry = new THREE.Mesh(new THREE.PlaneGeometry(center.x - min.x, 4.5), pathMat);
  entry.rotation.x = -Math.PI / 2;
  entry.position.set((min.x + center.x) / 2, 0.021, ZOO.road.z);
  entry.receiveShadow = true;
  group.add(entry);
  const spur = new THREE.Mesh(new THREE.PlaneGeometry(4, 15), pathMat);
  spur.rotation.x = -Math.PI / 2;
  spur.position.set(center.x, 0.021, ZOO.road.z + 7);
  group.add(spur);

  // ---- fence around the zoo with the entrance on the road
  const pickets = [];
  for (let x = min.x; x <= max.x; x += 0.9) for (const z of [min.z, max.z]) pickets.push([x, z]);
  for (let z = min.z; z <= max.z; z += 0.9) for (const x of [min.x, max.x]) if (!(x === min.x && Math.abs(z - ZOO.road.z) < 4.2)) pickets.push([x, z]);
  group.add(instanced(new THREE.BoxGeometry(0.16, 1.6, 0.16), 0x3a7a3a, pickets.map(([x, z]) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0.8, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))), { outline: 0.02 }));

  // ---- the entrance arch
  buildGate(group);

  // ---- enclosures: a low wall with railings, themed ground and props inside
  for (const [name, p] of Object.entries(pens)) {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(p.r, 48), toon(p.color));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(p.x, 0.025, p.z);
    floor.receiveShadow = true;
    group.add(floor);
    const wall = part(new THREE.TorusGeometry(p.r, 0.25, 6, 64), 0xb9a07a, { outline: 0.02 });
    wall.rotation.x = Math.PI / 2;
    wall.position.set(p.x, 0.5, p.z);
    wall.scale.z = 2.2;
    group.add(wall);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(p.r, 0.05, 5, 64), toon(0x2b2f38));
    rail.rotation.x = Math.PI / 2;
    rail.position.set(p.x, 1.25, p.z);
    group.add(rail);
    addCircle(p.x, p.z, p.r + 0.3); // visitors (and ambulances) stay outside
    // sign facing the zoo centre path
    const toC = new THREE.Vector3(center.x - p.x, 0, center.z - p.z).normalize();
    const sp = new THREE.Vector3(p.x, 0, p.z).addScaledVector(toC, p.r + 1.6);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshBasicMaterial({ map: signTexture([p.label], { w: 512, h: 176, size: 84, bg: '#6b4423', fg: '#ffe9b3' }), side: THREE.DoubleSide }));
    sign.position.set(sp.x, 1.9, sp.z);
    sign.rotation.y = Math.atan2(toC.x, toC.z) + Math.PI;
    group.add(sign);
    const post = part(new THREE.BoxGeometry(0.15, 1.5, 0.15), 0x6b4423, { outline: 0.01 });
    post.position.set(sp.x, 0.75, sp.z);
    group.add(post);
  }
  decoratePens(group, animated);

  // ---- benches, lamps, an ice-cream kiosk, trees around the edges
  const kiosk = buildKiosk();
  kiosk.position.set(149, 0, -29.5);
  group.add(kiosk);
  addCircle(149, -29.5, 1.8);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const x = center.x + Math.cos(a) * (ZOO.ring + 3.2), z = center.z + Math.sin(a) * (ZOO.ring + 3.2);
    if (Object.values(pens).some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 1.5)) continue;
    const pole = part(new THREE.CylinderGeometry(0.07, 0.1, 3.6, 8), 0x2b2f38, { outline: 0.015 });
    pole.position.set(x, 1.8, z);
    group.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), toon(0xfff3b0, { emissive: 0x6a5a20 }));
    bulb.position.set(x, 3.7, z);
    group.add(bulb);
    addCircle(x, z, 0.3);
  }
  const trunks = [], crowns = [];
  for (let i = 0; i < 40; i++) {
    const edge = rand() < 0.5;
    const x = edge ? min.x + 2 + rand() * (max.x - min.x - 4) : (rand() < 0.5 ? min.x + 2 + rand() * 4 : max.x - 2 - rand() * 4);
    const z = edge ? (rand() < 0.5 ? min.z + 2 + rand() * 4 : max.z - 2 - rand() * 4) : min.z + 2 + rand() * (max.z - min.z - 4);
    if (Math.abs(z - ZOO.road.z) < 5 && x < 150) continue;
    if (Object.values(pens).some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 2)) continue;
    const h = 2.2 + rand() * 1.5;
    trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)));
    crowns.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h + 1, z), new THREE.Quaternion(), new THREE.Vector3(1.6, 1.4, 1.6)));
    addCircle(x, z, 0.5);
  }
  group.add(instanced(new THREE.CylinderGeometry(0.22, 0.32, 1, 8), 0x7a4a26, trunks, { outline: 0.04 }));
  group.add(instanced(new THREE.IcosahedronGeometry(1, 2), 0x3d9c3a, crowns, { outline: 0.05 }));

  // ---- the animals
  const models = {};
  await Promise.all(Object.keys(ANIMALS).map(async (name) => {
    try {
      const g = await gltfLoader.loadAsync(new URL(`../assets/props/${name}.glb`, import.meta.url).href);
      models[name] = fitAnimal(g.scene, ANIMALS[name]);
    } catch {
      models[name] = fallbackAnimal(name);
    }
  }));
  const critters = [];
  for (const [name, cfg] of Object.entries(ANIMALS)) {
    const pen = pens[name];
    for (let i = 0; i < cfg.count; i++) {
      const c = new Critter(models[name].clone(), { home: new THREE.Vector3(pen.x, 0, pen.z), radius: pen.r - (name === 'penguin' ? 1.2 : 2.6), speed: cfg.speed, kind: name });
      group.add(c.root);
      critters.push(c);
    }
  }
  animated.push({ update: (t, dt) => { if (group.visible) for (const c of critters) c.update(t, dt); } });

  return {
    group,
    animated,
    /** A loose monkey for the chase mission, shaped like a kid rig so missions.js can drive it. */
    makeMonkey() {
      const root = new THREE.Group();
      const body = new THREE.Group();
      root.add(body);
      body.add(models.monkey.clone());
      return {
        root, body, height: ANIMALS.monkey.height, tears: new THREE.Group(), cast: new THREE.Group(), generated: true, isAnimal: true,
        animate(state, dt) {
          this.t = (this.t ?? 0) + dt;
          const moving = state === 'run' || state === 'walk' || state === 'flail';
          body.position.y = moving ? Math.abs(Math.sin(this.t * 11)) * 0.35 : Math.abs(Math.sin(this.t * 3)) * 0.06;
          body.rotation.z = moving ? Math.sin(this.t * 11) * 0.12 : 0;
        },
      };
    },
  };
}

/** A static animal model that wanders around its enclosure, breathing and looking around. */
class Critter {
  constructor(model, { home, radius, speed, kind }) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.body.add(model);
    this.home = home;
    this.radius = Math.max(1, radius);
    this.speed = speed;
    this.kind = kind;
    this.root.position.copy(this.randomSpot());
    this.root.rotation.y = rand() * Math.PI * 2;
    this.target = null;
    this.wait = rand() * 4;
    this.phase = rand() * 10;
  }
  randomSpot() {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * this.radius;
    return new THREE.Vector3(this.home.x + Math.cos(a) * d, 0, this.home.z + Math.sin(a) * d);
  }
  update(t, dt) {
    const p = this.root.position;
    let moving = false;
    if (this.target) {
      const to = this.target.clone().sub(p).setY(0);
      const d = to.length();
      if (d < 0.3) { this.target = null; this.wait = 2 + rand() * 5; }
      else {
        to.normalize();
        const want = Math.atan2(to.x, to.z);
        const diff = Math.atan2(Math.sin(want - this.root.rotation.y), Math.cos(want - this.root.rotation.y));
        this.root.rotation.y += diff * Math.min(1, dt * 2.5);
        if (Math.abs(diff) < 0.6) { p.addScaledVector(to, Math.min(d, this.speed * dt)); moving = true; }
      }
    } else if ((this.wait -= dt) <= 0) this.target = this.randomSpot();
    const s = t * (this.kind === 'penguin' ? 9 : this.kind === 'monkey' ? 10 : 5) + this.phase;
    if (moving) {
      // a walking gait: bob and sway (penguins waddle, monkeys hop)
      this.body.position.y = this.kind === 'monkey' ? Math.abs(Math.sin(s)) * 0.3 : Math.abs(Math.sin(s)) * (this.kind === 'penguin' ? 0.05 : 0.06);
      this.body.rotation.z = Math.sin(s) * (this.kind === 'penguin' ? 0.14 : 0.025);
      this.body.rotation.x = 0;
    } else {
      // idle: breathe, and now and then look around
      this.body.position.y = 0;
      this.body.scale.set(1, 1 + Math.sin(t * 1.6 + this.phase) * 0.012, 1);
      this.body.rotation.z = 0;
      this.body.rotation.y = Math.sin(t * 0.35 + this.phase) * 0.35 * (Math.sin(t * 0.13 + this.phase) > 0.2 ? 1 : 0);
    }
  }
}

/** For tools/viewer.html: one fitted animal model. */
export async function loadAnimalModel(name) {
  const g = await gltfLoader.loadAsync(new URL(`../assets/props/${name}.glb`, import.meta.url).href);
  return fitAnimal(g.scene, ANIMALS[name]);
}

function fitAnimal(model, fit) {
  model.rotation.y = fit.yaw;
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const s = fit.height ? fit.height / size.y : fit.length / Math.max(size.x, size.z);
  model.scale.setScalar(s);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x, -box.min.y, -c.z);
  toonify(model, 0.012);
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = true; } });
  const holder = new THREE.Group();
  holder.add(model);
  return holder;
}

function fallbackAnimal(name) {
  const g = new THREE.Group();
  const colors = { lion: 0xd99a3a, elephant: 0x8f949b, giraffe: 0xe0a64a, penguin: 0x1b1b1b, monkey: 0x7a4a26 };
  const h = ANIMALS[name].height ?? 1.5;
  const b = part(new THREE.SphereGeometry(h * 0.4, 14, 10), colors[name], { outline: 0.03 });
  b.position.y = h * 0.5;
  b.scale.set(1, 0.8, 1.4);
  g.add(b);
  return g;
}

function buildGate(group) {
  const { gate } = ZOO;
  const g = new THREE.Group();
  g.position.copy(gate);
  g.rotation.y = Math.PI / 2; // the arch spans the road (north–south)
  group.add(g);
  for (const sx of [-1, 1]) {
    const pillar = part(new THREE.BoxGeometry(1.6, 7, 1.6), 0xc0541f, { outline: 0.04 });
    pillar.position.set(sx * 5, 3.5, 0);
    g.add(pillar);
    const cap = part(new THREE.ConeGeometry(1.3, 1.6, 4), 0x2e8b3c, { outline: 0.03 });
    cap.position.set(sx * 5, 7.8, 0);
    cap.rotation.y = Math.PI / 4;
    g.add(cap);
  }
  const beam = part(new THREE.BoxGeometry(11.6, 1.8, 0.8), 0xffd23f, { outline: 0.04 });
  beam.position.y = 6.2;
  g.add(beam);
  const tex = canvasTexture(1024, 160, (ctx, w, h) => {
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#6b2a0d'; ctx.font = `700 70px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🦁 WOLFSON CITY ZOO 🐘', w / 2, h / 2 + 6);
  });
  for (const side of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(11.4, 1.7), new THREE.MeshBasicMaterial({ map: tex }));
    face.position.set(0, 6.2, side * 0.42);
    if (side < 0) face.rotation.y = Math.PI;
    g.add(face);
  }
  addCircle(gate.x, gate.z - 5, 1.0);
  addCircle(gate.x, gate.z + 5, 1.0);
}

function buildKiosk() {
  const g = new THREE.Group();
  const box = part(new THREE.BoxGeometry(2.6, 2.2, 2.2), 0xff8ac0, { outline: 0.03 });
  box.position.y = 1.1;
  g.add(box);
  const roof = part(new THREE.ConeGeometry(2.3, 1.2, 4), 0xffffff, { outline: 0.03 });
  roof.position.y = 2.8;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  const cone = part(new THREE.ConeGeometry(0.35, 0.9, 10), 0xd9a45a, { outline: 0.02 });
  cone.position.y = 3.9;
  cone.rotation.x = Math.PI;
  g.add(cone);
  const scoop = part(new THREE.SphereGeometry(0.42, 12, 10), 0xffc0d8, { outline: 0.02 });
  scoop.position.y = 4.45;
  g.add(scoop);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: signTexture(['ICE CREAM'], { w: 512, h: 128, size: 72, bg: '#ffffff', fg: '#e0327a' }) }));
  label.position.set(0, 1.75, 1.11);
  g.add(label);
  return g;
}

/** Themed scenery inside each enclosure: rocks for the lions, a pool for elephants and penguins, etc. */
function decoratePens(group, animated) {
  const { lion, elephant, giraffe, penguin, monkey } = ZOO.pens;
  const rocks = [];
  const rock = (x, z, s, y = 0.3) => rocks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(), rand() * 3, 0)), new THREE.Vector3(s, s * 0.7, s)));
  // lions: a big "pride rock" and boulders
  rock(lion.x + 4, lion.z + 3, 3.2, 1.2); rock(lion.x + 5.5, lion.z + 1, 2, 0.6); rock(lion.x - 5, lion.z - 4, 1.2);
  // penguins: icy rocks around their pool
  for (let i = 0; i < 6; i++) rock(penguin.x + Math.cos(i) * 6.5, penguin.z + Math.sin(i) * 6.5, 0.9, 0.35);
  group.add(instanced(new THREE.DodecahedronGeometry(1, 0), 0x9aa3ad, rocks, { outline: 0.03 }));
  const pool = (x, z, r, color) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), toon(color, { transparent: true, opacity: 0.9 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.04, z);
    group.add(m);
    return m;
  };
  pool(elephant.x + 5, elephant.z + 4, 3.5, 0x3fa9f5);
  const ice = pool(penguin.x - 1.5, penguin.z + 1.5, 3.8, 0x7fd0ff);
  animated.push({ update: (t) => { ice.material.opacity = 0.82 + Math.sin(t * 1.5) * 0.08; } });
  // giraffes: tall acacia trees and a high feeder
  for (const [dx, dz] of [[-5, -4], [4, 5]]) {
    const trunk = part(new THREE.CylinderGeometry(0.3, 0.45, 5.5, 8), 0x7a4a26, { outline: 0.03 });
    trunk.position.set(giraffe.x + dx, 2.75, giraffe.z + dz);
    group.add(trunk);
    const top = part(new THREE.CylinderGeometry(3, 2.2, 1, 12), 0x5aa83f, { outline: 0.04 });
    top.position.set(giraffe.x + dx, 6, giraffe.z + dz);
    group.add(top);
  }
  const feeder = part(new THREE.BoxGeometry(1.4, 0.8, 1.4), 0xa8743f, { outline: 0.02 });
  feeder.position.set(giraffe.x + 1, 5.2, giraffe.z - 6);
  group.add(feeder);
  const fpole = part(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), 0x7a4a26, { outline: 0.01 });
  fpole.position.set(giraffe.x + 1, 2.5, giraffe.z - 6);
  group.add(fpole);
  // monkeys: a climbing frame like the one in the zoo picture, with ropes
  const wood = 0xa8743f;
  for (const [dx, dz] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) {
    const post = part(new THREE.CylinderGeometry(0.18, 0.18, 4.4, 8), wood, { outline: 0.02 });
    post.position.set(monkey.x + dx, 2.2, monkey.z + dz);
    group.add(post);
  }
  const deck = part(new THREE.BoxGeometry(5.4, 0.2, 5.4), wood, { outline: 0.02 });
  deck.position.set(monkey.x, 3, monkey.z);
  group.add(deck);
  for (let i = 0; i < 5; i++) {
    const bar = part(new THREE.CylinderGeometry(0.07, 0.07, 5.2, 6), 0xd8b98a, { outline: 0.01 });
    bar.rotation.z = Math.PI / 2;
    bar.position.set(monkey.x, 4.3, monkey.z - 2 + i);
    group.add(bar);
  }
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 5), toon(0xd8c39a));
  rope.position.set(monkey.x + 4, 2.6, monkey.z);
  group.add(rope);
}
