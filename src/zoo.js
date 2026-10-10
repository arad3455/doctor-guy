// Zone 3 — Wolfson City Zoo, east of the park along Zoo Road (drive it in the ambulance in a few seconds).
// Animals are Meshy models (assets/props/<animal>.glb). Meshy can't rig four-legged animals, so they're
// static meshes brought to life here: wandering, breathing, head-turning, the monkey hopping.
import * as THREE from 'three';
import { part, toon, instanced, canvasTexture, signTexture, FONT } from './toon.js';
import { addCircle } from './world.js';
import { scatter, kit } from './kit.js';
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
export const PARKING_LOT = { x: 124, z: -47.5 }; // zoo car park, north of Zoo Road
const ROAD_YAW = Number(new URLSearchParams(location.search).get('roadYaw') ?? Math.PI / 2); // Kenney road tiles run along z
/** Things the map draws that live in this file (trees etc.). */
export const MAP_DECOR = { trees: [], benches: [] };

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

/** Zoo Road: always visible outdoors (it starts in the park). Built from Kenney's City Kit (Roads). */
export function buildRoad(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const { z, x0, x1, width } = ZOO.road;
  const T = width; // one road tile = the road's width
  const tiles = [], crossings = [];
  for (let x = x0 + T / 2; x < x1; x += T) (Math.abs(x) < T / 2 || Math.abs(x - 131) < T / 2 ? crossings : tiles).push({ x, y: 0.005, z, rot: ROAD_YAW, sx: T, sy: 1, sz: T });
  group.add(scatter('road-straight', tiles, { cast: false }));
  group.add(scatter('road-crossing', crossings, { cast: false })); // zebra crossings: hospital path + zoo gate
  group.add(scatter('road-end-round', [{ x: x0 - T / 2 + 0.01, y: 0.004, z, rot: ROAD_YAW + Math.PI, sx: T, sy: 1, sz: T }], { cast: false }));
  // grass verges outside the park
  const verge = new THREE.Mesh(new THREE.PlaneGeometry(x1 - 57, 16), toon(0x74c64e));
  verge.rotation.x = -Math.PI / 2;
  verge.position.set((57 + x1) / 2, 0.002, z);
  verge.receiveShadow = true;
  group.add(verge);

  // curved street lights on alternating sides, power line on the north verge
  const lights = [];
  for (let x = -16, i = 0; x < x1 - 4; x += 13, i++) {
    if (x > -4 && x < 4) continue;
    const side = i % 2 ? 1 : -1;
    lights.push({ x, z: z + side * (width / 2 + 0.6), rot: side > 0 ? Math.PI : 0, scale: 7 });
    addCircle(x, z + side * (width / 2 + 0.6), 0.25);
  }
  group.add(scatter('light-curved', lights, { outline: 0.012 }));
  const poles = [];
  for (let x = 64; x < x1 - 2; x += 16) poles.push({ x, z: z - width / 2 - 4.2, rot: 0, scale: 8 });
  group.add(scatter('electricity-pole', poles, { outline: 0.012 }));
  for (const p of poles) addCircle(p.x, p.z, 0.3);
  const wireMat = new THREE.LineBasicMaterial({ color: 0x2b2f38 });
  for (let i = 0; i < poles.length - 1; i++) for (const dz of [-1.8, 0, 1.8]) {
    const a = new THREE.Vector3(poles[i].x, 4.05, poles[i].z + dz * 0.8), b = new THREE.Vector3(poles[i + 1].x, 4.05, poles[i + 1].z + dz * 0.8);
    const mid = a.clone().lerp(b, 0.5); mid.y -= 0.7; // sagging wire
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(12)), wireMat));
  }
  // traffic lights at the hospital crossing, a little road works zone, roadside trees
  group.add(scatter('traffic-light', [{ x: -4.2, z: z - width / 2 - 0.5, rot: Math.PI / 2, scale: 7 }, { x: 4.2, z: z + width / 2 + 0.5, rot: -Math.PI / 2, scale: 7 }], { outline: 0.012 }));
  addCircle(-4.2, z - width / 2 - 0.5, 0.3);
  addCircle(4.2, z + width / 2 + 0.5, 0.3);
  group.add(scatter('construction-cone', [0, 1, 2, 3, 4].map((i) => ({ x: 96 + i * 2.2, z: z + width / 2 + 1.6, scale: 7 }))));
  group.add(scatter('construction-barrier', [{ x: 94, z: z + width / 2 + 1.7, rot: Math.PI / 2, scale: 7 }, { x: 108, z: z + width / 2 + 1.7, rot: Math.PI / 2, scale: 7 }]));
  const roadside = [], bushes = [];
  for (let x = 62; x < x1 - 6; x += 5.5) {
    for (const side of [-1, 1]) {
      const off = width / 2 + 5.5 + rand() * 3;
      if (side < 0 && Math.abs((x - 64) % 16) < 2.5) continue; // leave the power poles clear
      if (rand() < 0.7) roadside.push({ x: x + rand() * 2, z: z + side * off, rot: rand() * 6, scale: 3.4 + rand() * 1.2, kind: ['tree_oak', 'tree_default', 'tree_detailed', 'tree_fat'][Math.floor(rand() * 4)] });
      else bushes.push({ x: x + rand() * 3, z: z + side * (width / 2 + 3 + rand() * 2), rot: rand() * 6, scale: 4 + rand() * 2 });
    }
  }
  for (const kind of ['tree_oak', 'tree_default', 'tree_detailed', 'tree_fat']) group.add(scatter(kind, roadside.filter((t) => t.kind === kind), { outline: 0.02 }));
  group.add(scatter('plant_bushDetailed', bushes, { outline: 0.015 }));
  for (const t of roadside) MAP_DECOR.trees.push([t.x, t.z, t.scale * 0.32]);

  // custom road signs with text
  const roadSign = (x, sz, lines, color) => {
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.3), new THREE.MeshBasicMaterial({ map: signTexture(lines, { w: 512, h: 208, size: 60, bg: color, fg: '#ffffff' }), side: THREE.DoubleSide }));
    board.position.y = 2.9;
    g.add(board);
    const post = part(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), 0x9aa3ad, { outline: 0.01 });
    post.position.y = 1.2;
    g.add(post);
    g.position.set(x, 0, sz);
    g.rotation.y = -Math.PI / 2;
    group.add(g);
    addCircle(x, sz, 0.2);
  };
  roadSign(20, z - width / 2 - 1.6, ['ZOO →'], '#2e8b3c');
  roadSign(66, z + width / 2 + 1.6, ['ZOO ROAD', 'Wolfson City Zoo'], '#2e8b3c');
  roadSign(118, z + width / 2 + 1.6, ['🦁 ZOO · P'], '#c0541f');

  // zoo car park north of the road, just before the gate (cars from Kenney's Car Kit)
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(18, 11), toon(0x5a6068));
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(PARKING_LOT.x, 0.004, PARKING_LOT.z);
  lot.receiveShadow = true;
  group.add(lot);
  const bays = [];
  for (let i = 0; i < 6; i++) bays.push({ x: PARKING_LOT.x - 7.5 + i * 3, z: PARKING_LOT.z - 1.5 });
  const lines = new THREE.Group();
  for (let i = 0; i <= 6; i++) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    l.rotation.x = -Math.PI / 2;
    l.position.set(PARKING_LOT.x - 9 + i * 3, 0.01, PARKING_LOT.z - 1.5);
    lines.add(l);
  }
  group.add(lines);
  const parked = ['sedan', 'taxi', null, 'suv', 'van', 'hatchback-sports'];
  parked.forEach((name, i) => {
    if (!name) return;
    const car = kit(name, { scale: 2.3, outline: 0.012 });
    car.position.set(bays[i].x, 0, bays[i].z);
    car.rotation.y = Math.PI; // nosed into the bay, facing north
    group.add(car);
    addCircle(bays[i].x, bays[i].z - 1.4, 1.5);
    addCircle(bays[i].x, bays[i].z + 1.4, 1.5);
  });
  const pSign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: signTexture(['P'], { w: 128, h: 128, size: 100, bg: '#2f62b8', fg: '#ffffff' }), side: THREE.DoubleSide }));
  pSign.position.set(PARKING_LOT.x + 9.4, 2.6, PARKING_LOT.z + 4.6);
  pSign.rotation.y = Math.PI / 2;
  group.add(pSign);
  const pPost = part(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), 0x9aa3ad, { outline: 0.01 });
  pPost.position.set(PARKING_LOT.x + 9.4, 1.1, PARKING_LOT.z + 4.6);
  group.add(pPost);
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

  // ---- enclosures: a stone kerb and a wooden plank fence (Kenney), themed ground and props inside
  for (const [name, p] of Object.entries(pens)) {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(p.r, 48), toon(p.color));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(p.x, 0.025, p.z);
    floor.receiveShadow = true;
    group.add(floor);
    const kerb = part(new THREE.TorusGeometry(p.r, 0.22, 5, 64), 0xb9a07a, { outline: 0.015 });
    kerb.rotation.x = Math.PI / 2;
    kerb.position.set(p.x, 0.12, p.z);
    group.add(kerb);
    const FENCE = 3; // one fence piece is 3 units long
    const n = Math.round((2 * Math.PI * p.r) / FENCE);
    const pieces = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pieces.push({ x: p.x + Math.cos(a) * p.r, z: p.z + Math.sin(a) * p.r, rot: -(a + Math.PI / 2), sx: ((2 * Math.PI * p.r) / n) * 1.02, sy: 3.2, sz: 3 });
    }
    group.add(scatter(name === 'penguin' ? 'fence_simple' : 'fence_planks', pieces, { outline: 0.012 }));
    addCircle(p.x, p.z, p.r + 0.3); // visitors (and ambulances) stay outside
    // a wooden info board facing the path
    const toC = new THREE.Vector3(center.x - p.x, 0, center.z - p.z).normalize();
    const sp = new THREE.Vector3(p.x, 0, p.z).addScaledVector(toC, p.r + 1.8);
    const board = kit('sign', { scale: 5, outline: 0.012 });
    board.position.copy(sp);
    board.rotation.y = Math.atan2(toC.x, toC.z) + Math.PI;
    group.add(board);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.6), new THREE.MeshBasicMaterial({ map: signTexture([p.label], { w: 512, h: 224, size: 92, bg: '#7a4a26', fg: '#ffe9b3' }), side: THREE.DoubleSide }));
    label.position.copy(sp).add(new THREE.Vector3(0, 1.45, 0)).addScaledVector(toC, 0.2);
    label.rotation.y = board.rotation.y;
    group.add(label);
    addCircle(sp.x, sp.z, 0.4);
  }
  decoratePens(group, animated);

  // ---- entrance plaza: paving, a fountain, ticket booth, lanterns, benches, flower pots
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(18, 15), toon(0xd9c9a8));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(147, 0.018, -37.5);
  plaza.receiveShadow = true;
  group.add(plaza);
  const fountain = kit('fountain-round-detail', { scale: 3, outline: 0.015 });
  fountain.position.set(148, 0, -41.2);
  group.add(fountain);
  addCircle(148, -41.2, 3.1);
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.5, 28), toon(0x5cc8f2, { transparent: true, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(148, 0.75, -41.2);
  group.add(water);
  const spray = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 12, 1, true), toon(0x9ddcff, { transparent: true, opacity: 0.7 }));
  spray.position.set(148, 1.9, -41.2);
  group.add(spray);
  animated.push({ update: (t) => spray.scale.set(1 + Math.sin(t * 6) * 0.1, 1 + Math.sin(t * 4) * 0.15, 1 + Math.sin(t * 6) * 0.1) });
  const booth = kit('stall-red', { scale: 2.6, outline: 0.015 });
  booth.position.set(141.5, 0, -42.8);
  booth.rotation.y = Math.PI / 2;
  group.add(booth);
  addCircle(141.5, -42.8, 1.6);
  const ticket = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), new THREE.MeshBasicMaterial({ map: signTexture(['TICKETS'], { w: 512, h: 128, size: 80, bg: '#fff3d6', fg: '#c0541f' }) }));
  ticket.position.set(142.9, 2.6, -42.8);
  ticket.rotation.y = Math.PI / 2;
  group.add(ticket);
  const lanterns = [[139.5, -31], [155, -31], [139.5, -43.8], [155, -43.8], [170, -31], [170, -43], [185.5 - 3, -31], [185.5 + 3, -31]];
  group.add(scatter('lantern', lanterns.map(([x, z]) => ({ x, z, scale: 2.1 })), { outline: 0.01 }));
  for (const [x, z] of lanterns) addCircle(x, z, 0.3);
  const plazaBenches = [{ x: 151.5, z: -41.2, rot: 0 }, { x: 144.5, z: -41.2, rot: Math.PI }];
  group.add(scatter('stall-bench', plazaBenches.map((b) => ({ ...b, scale: 3 })), { outline: 0.012 }));
  for (const b of plazaBenches) addCircle(b.x, b.z, 0.9);
  group.add(scatter('pot_large', [[153.5, -44.4], [140.5, -30.6], [155.6, -30.6]].map(([x, z]) => ({ x, z, scale: 2.4 })), { outline: 0.012 }));
  group.add(scatter('flower_redB', [[153.2, -44.2], [153.8, -44.6], [140.3, -30.4], [155.4, -30.4], [155.9, -30.8]].map(([x, z]) => ({ x, z, y: 0.45, scale: 3 }))));

  // ---- food court on the way in: market stalls, a cart, picnic benches
  const court = [[166, -42.5, 'stall-green', 0], [172, -42.5, 'stall-red', 0], [178.5, -42.5, 'stall-green', 0]];
  for (const [x, z, name, rot] of court) {
    const st = kit(name, { scale: 2.8, outline: 0.015 });
    st.position.set(x, 0, z);
    st.rotation.y = rot;
    group.add(st);
    addCircle(x, z, 1.7);
  }
  const foodSigns = [['🍿 POPCORN', 166], ['🌭 HOT DOGS', 172], ['🥤 DRINKS', 178.5]];
  for (const [txt, x] of foodSigns) {
    const fs = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.55), new THREE.MeshBasicMaterial({ map: signTexture([txt], { w: 512, h: 128, size: 66, bg: '#fff3d6', fg: '#6b2a0d' }) }));
    fs.position.set(x, 2.95, -41);
    group.add(fs);
  }
  const cartObj = kit('cart', { scale: 2.6, outline: 0.015 });
  cartObj.position.set(160, 0, -43.2);
  cartObj.rotation.y = 0.4;
  group.add(cartObj);
  addCircle(160, -43.2, 1.6);
  const picnic = [];
  for (const [x, z] of [[168, -32.5], [175, -32.5]]) {
    picnic.push({ x, z: z - 1, rot: Math.PI / 2, scale: 3 }, { x, z: z + 1, rot: Math.PI / 2, scale: 3 });
    addCircle(x, z, 1.6);
  }
  group.add(scatter('stall-bench', picnic, { outline: 0.012 }));
  const tables = [];
  for (const [x, z] of [[168, -32.5], [175, -32.5]]) {
    const top = part(new THREE.BoxGeometry(2.6, 0.12, 1.2), 0xa8743f, { outline: 0.012 });
    top.position.set(x, 0.95, z);
    group.add(top);
    const leg = part(new THREE.BoxGeometry(0.15, 0.9, 0.15), 0x7a4a26, { outline: 0 });
    leg.position.set(x, 0.45, z);
    group.add(leg);
    const umb = part(new THREE.ConeGeometry(1.6, 0.6, 12, 1, true), toon(tables.length ? 0x2f7fc1 : 0xe0323a, { side: THREE.DoubleSide }), { outline: 0.02 });
    umb.position.set(x, 2.5, z);
    group.add(umb);
    tables.push(top);
  }

  // ---- the visitor path: lanterns, benches and hedges along the ring, flowers everywhere
  const ringLights = [], ringBenches = [], hedges = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + 0.08;
    const r = ZOO.ring + 2.8;
    const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    if (Object.values(pens).some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 1.4)) continue;
    if (Math.abs(a - Math.PI / 2 * 3) < 0.15) continue; // the spur to the entrance
    if (i % 2) { ringLights.push({ x, z, scale: 2.1 }); addCircle(x, z, 0.3); }
    else {
      ringBenches.push({ x, z, rot: -a, scale: 3 }); addCircle(x, z, 0.9);
      MAP_DECOR.benches.push([x, z]);
    }
    const ha = a + 0.12;
    hedges.push({ x: center.x + Math.cos(ha) * (r + 0.6), z: center.z + Math.sin(ha) * (r + 0.6), rot: -ha, sx: 2.6, sy: 2.2, sz: 2.4 });
  }
  group.add(scatter('lantern', ringLights, { outline: 0.01 }));
  group.add(scatter('stall-bench', ringBenches, { outline: 0.012 }));
  group.add(scatter('hedge-large', hedges.filter((_, i) => i % 3 === 0), { outline: 0.015 }));
  // inner lawn around Monkey Island: flower beds
  const beds = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    beds.push({ x: center.x + Math.cos(a) * 15, z: center.z + Math.sin(a) * 15, rot: a, scale: 3.2 });
  }
  group.add(scatter('plant_bushDetailed', beds, { outline: 0.012 }));
  // flowers and grass tufts scattered across the lawns
  const flowers = { flower_redA: [], flower_purpleA: [], flower_yellowA: [], grass_large: [], grass: [] };
  const kinds = Object.keys(flowers);
  for (let i = 0; i < 520; i++) {
    const x = min.x + 2 + rand() * (max.x - min.x - 4), z = min.z + 2 + rand() * (max.z - min.z - 4);
    if (Object.values(pens).some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 1)) continue;
    const rr = Math.hypot(x - center.x, z - center.z);
    if (Math.abs(rr - ZOO.ring) < 2.4) continue; // keep the path clear
    if (x < 157 && z < -29) continue; // plaza
    if (z < -29 && x < 186) continue; // food court + entrance path
    flowers[kinds[i % kinds.length]].push({ x, z, rot: rand() * 6, scale: 2.4 + rand() * 1.2 });
  }
  for (const [k, list] of Object.entries(flowers)) group.add(scatter(k, list, { cast: false }));

  // ---- trees: a green belt along the zoo fence (several Kenney tree types)
  const belt = { tree_oak: [], tree_default: [], tree_detailed: [], tree_tall: [], tree_fat: [], tree_cone: [] };
  const beltKinds = Object.keys(belt);
  for (let i = 0; i < 90; i++) {
    const side = Math.floor(rand() * 4);
    const u = rand();
    let x, z;
    if (side === 0) { x = min.x + 2 + u * (max.x - min.x - 4); z = min.z + 1.5 + rand() * 3.5; }
    else if (side === 1) { x = min.x + 2 + u * (max.x - min.x - 4); z = max.z - 1.5 - rand() * 3.5; }
    else if (side === 2) { x = min.x + 1.5 + rand() * 3.5; z = min.z + 2 + u * (max.z - min.z - 4); }
    else { x = max.x - 1.5 - rand() * 3.5; z = min.z + 2 + u * (max.z - min.z - 4); }
    if (Math.abs(z - ZOO.road.z) < 6 && x < 160) continue; // entrance
    if (z < -29 && x > 137 && x < 186) continue; // plaza + food court
    if (Object.values(pens).some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 2.5)) continue;
    const scale = 3.6 + rand() * 1.6;
    belt[beltKinds[i % beltKinds.length]].push({ x, z, rot: rand() * 6, scale });
    addCircle(x, z, 0.55);
    MAP_DECOR.trees.push([x, z, scale * 0.3]);
  }
  for (const [k, list] of Object.entries(belt)) group.add(scatter(k, list, { outline: 0.02 }));

  // ---- the old ice-cream kiosk (kept: it's a landmark for the peanut mission)
  const kiosk = buildKiosk();
  kiosk.position.set(149, 0, -29.5);
  group.add(kiosk);
  addCircle(149, -29.5, 1.8);

  // ---- the animals
  const models = {}, lods = {};
  await Promise.all(Object.keys(ANIMALS).map(async (name) => {
    try {
      const [hi, lo] = await Promise.all([
        gltfLoader.loadAsync(new URL(`../assets/props/${name}.glb`, import.meta.url).href),
        gltfLoader.loadAsync(new URL(`../assets/props/${name}-lod.glb`, import.meta.url).href).catch(() => null),
      ]);
      models[name] = fitAnimal(hi.scene, ANIMALS[name]);
      lods[name] = lo ? fitAnimal(lo.scene, ANIMALS[name], 0) : null;
    } catch {
      models[name] = fallbackAnimal(name);
    }
  }));
  const critters = [];
  for (const [name, cfg] of Object.entries(ANIMALS)) {
    const pen = pens[name];
    for (let i = 0; i < cfg.count; i++) {
      // full detail up close, a simplified copy further away, hidden far away (THREE.LOD)
      const lod = new THREE.LOD();
      lod.addLevel(models[name].clone(), 0);
      if (lods[name]) lod.addLevel(lods[name].clone(), 26);
      lod.addLevel(new THREE.Object3D(), 95);
      const c = new Critter(lod, { home: new THREE.Vector3(pen.x, 0, pen.z), radius: pen.r - (name === 'penguin' ? 1.2 : 2.6), speed: cfg.speed, kind: name });
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

function fitAnimal(model, fit, outline = 0.012) {
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
  toonify(model, outline);
  model.traverse((o) => { if (o.isMesh) { o.castShadow = outline > 0; o.frustumCulled = true; } });
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
  // banners and lanterns on the gate pillars (Kenney Fantasy Town)
  for (const sx of [-1, 1]) {
    for (const side of [-1, 1]) {
      const banner = kit(sx < 0 ? 'banner-red' : 'banner-green', { scale: 3 });
      banner.position.set(sx * 5, 2.2, side * 0.84);
      banner.rotation.y = Math.PI / 2;
      g.add(banner);
    }
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

/** Themed scenery inside each enclosure (Kenney nature models + a few custom pieces). */
function decoratePens(group, animated) {
  const { lion, elephant, giraffe, penguin, monkey } = ZOO.pens;
  const pool = (x, z, r, color) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), toon(color, { transparent: true, opacity: 0.9 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.04, z);
    group.add(m);
    return m;
  };
  const ringOf = (cx, cz, r, n, extra = {}) => Array.from({ length: n }, (_, i) => ({ x: cx + Math.cos((i / n) * 6.283) * r, z: cz + Math.sin((i / n) * 6.283) * r, rot: rand() * 6, ...extra }));
  // lions: savannah — "pride rock", acacia trees, boulders, dry grass, a fallen log
  group.add(scatter('rock_tallA', [{ x: lion.x + 4, z: lion.z + 3, rot: 0.6, scale: 4.2 }], { outline: 0.02 }));
  group.add(scatter('rock_largeC', [{ x: lion.x + 6, z: lion.z, rot: 1, scale: 3.5 }, { x: lion.x - 5, z: lion.z - 4, rot: 2, scale: 3 }], { outline: 0.02 }));
  group.add(scatter('tree_plateau', [{ x: lion.x - 5, z: lion.z + 4, rot: 0.3, scale: 5.2 }, { x: lion.x + 2, z: lion.z - 7, rot: 1.2, scale: 4.6 }], { outline: 0.02 }));
  group.add(scatter('log_large', [{ x: lion.x - 1, z: lion.z + 7, rot: 0.9, scale: 3 }], { outline: 0.015 }));
  group.add(scatter('grass_large', ringOf(lion.x, lion.z, 7.5, 12, { scale: 3 }), { cast: false }));
  // elephants: a big pool with a rocky edge, a fat shade tree, logs and mud
  pool(elephant.x + 5, elephant.z + 4, 3.8, 0x3fa9f5);
  group.add(scatter('rock_smallA', ringOf(elephant.x + 5, elephant.z + 4, 4.1, 14, { scale: 2.2 }), { cast: false }));
  group.add(scatter('lily_large', [{ x: elephant.x + 4, z: elephant.z + 3.4, scale: 3 }, { x: elephant.x + 6.3, z: elephant.z + 5.2, scale: 2.6 }]));
  group.add(scatter('tree_oak', [{ x: elephant.x - 7, z: elephant.z - 4, scale: 5.5 }, { x: elephant.x - 2, z: elephant.z + 9, scale: 4.8 }], { outline: 0.02 }));
  group.add(scatter('log_stack', [{ x: elephant.x - 6, z: elephant.z + 5, rot: 0.4, scale: 3.2 }], { outline: 0.015 }));
  const mud = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), toon(0x8a6338));
  mud.rotation.x = -Math.PI / 2;
  mud.position.set(elephant.x - 1, 0.035, elephant.z - 6);
  group.add(mud);
  // giraffes: tall acacias they can nibble, a high feeder, bushes
  group.add(scatter('tree_plateau', [{ x: giraffe.x - 5, z: giraffe.z - 4, rot: 0.5, scale: 6.4 }, { x: giraffe.x + 4, z: giraffe.z + 5, rot: 2, scale: 7 }, { x: giraffe.x - 6, z: giraffe.z + 6, rot: 1, scale: 5.6 }], { outline: 0.02 }));
  group.add(scatter('plant_bushDetailed', ringOf(giraffe.x, giraffe.z, 9, 8, { scale: 3.4 }), { outline: 0.012 }));
  const feeder = part(new THREE.BoxGeometry(1.4, 0.8, 1.4), 0xa8743f, { outline: 0.02 });
  feeder.position.set(giraffe.x + 1, 5.2, giraffe.z - 6);
  group.add(feeder);
  const fpole = part(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), 0x7a4a26, { outline: 0.01 });
  fpole.position.set(giraffe.x + 1, 2.5, giraffe.z - 6);
  group.add(fpole);
  // penguins: an icy pool with grey stones and snowy patches
  const ice = pool(penguin.x - 1.5, penguin.z + 1.5, 3.8, 0x7fd0ff);
  animated.push({ update: (t) => { ice.material.opacity = 0.82 + Math.sin(t * 1.5) * 0.08; } });
  group.add(scatter('stone_largeB', ringOf(penguin.x, penguin.z, 6.2, 6, { scale: 2.2 }), { outline: 0.015 }));
  group.add(scatter('stone_tallB', [{ x: penguin.x + 4, z: penguin.z - 3, scale: 2.4 }], { outline: 0.015 }));
  for (const [dx, dz, r] of [[3, 4, 1.4], [-4.5, -3, 1.1]]) {
    const snow = new THREE.Mesh(new THREE.CircleGeometry(r, 16), toon(0xffffff));
    snow.rotation.x = -Math.PI / 2;
    snow.position.set(penguin.x + dx, 0.03, penguin.z + dz);
    group.add(snow);
  }
  // monkeys: a climbing frame (like the zoo picture), palms, hanging moss, ropes
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
  for (const dx of [-3.6, 3.6]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 5), toon(0xd8c39a));
    rope.position.set(monkey.x + dx, 2.6, monkey.z + 1);
    group.add(rope);
  }
  group.add(scatter('tree_palmTall', [{ x: monkey.x - 5, z: monkey.z - 3, rot: 1, scale: 4.4 }, { x: monkey.x + 5, z: monkey.z + 3.5, rot: 3, scale: 4 }, { x: monkey.x + 4.5, z: monkey.z - 4.5, rot: 5, scale: 3.6 }], { outline: 0.02 }));
  group.add(scatter('hanging_moss', [[-2, -2.6], [1, -2.6], [2.6, 0.5], [-2.6, 1.5]].map(([dx, dz]) => ({ x: monkey.x + dx, z: monkey.z + dz, y: 1.4, scale: 3.4 }))));
  group.add(scatter('log', [{ x: monkey.x - 3, z: monkey.z + 4.5, rot: 1.2, scale: 3 }], { outline: 0.012 }));
}
