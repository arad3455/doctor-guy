// Zone 5 — Maple Heights: the suburb south of Zoo Road (between the park and the zoo). Maple Lane runs south
// from Zoo Road to Sunset Pier; Oak Street and Birch Street cross it, with a loop on the east side. Houses with
// front lawns and driveways, back gardens with trampolines, paddling pools and a treehouse, and Maple Heights
// Elementary with its schoolyard.
import * as THREE from 'three';
import { part, toon, instanced, canvasTexture, signTexture, FONT } from './toon.js';
import { addBox, addCircle } from './world.js';
import { scatter, kit, KIT_SIZES, WALL_TINTS, ROOF_TINTS } from './kit.js';
import { buildStreets, street, gx, gz, TILE } from './streets.js';
import { seeded, slab, streetLamps, buildings, addCameraBlocker, parkedCars, trees, signBoard, bakeStatic } from './cityprops.js';

const HALF = TILE / 2;
const MAPLE = 15; // Maple Lane: grid column (x = 84.5)
const OAK = 5, BIRCH = 10; // grid rows (z = -2, 33)
const WEST = 12, EAST = 20; // the cross streets run from x = 63.5 to the east loop at x = 119.5
export const MH = {
  min: { x: 60, z: -33.6 }, max: { x: 136.5, z: 62 },
  mapleX: gx(MAPLE), oakZ: gz(OAK), birchZ: gz(BIRCH), loopX: gx(EAST), westX: gx(WEST),
  southJ: 14, // Maple Lane's last tile (z = 61), at the funfair gate
};
// The three strips of lots between the streets: [x0, x1] ranges (west of Maple Lane, middle, east of the loop)
const XR = [[MH.min.x + 1, MH.mapleX - HALF - 0.5], [MH.mapleX + HALF + 0.5, MH.loopX - HALF - 0.5], [MH.loopX + HALF + 0.5, MH.max.x - 0.5]];
export const SCHOOL = { x0: MH.mapleX + HALF + 1.6, x1: MH.max.x - 1, z0: -25, z1: MH.oakZ - HALF - 1.6 };
/** Landmarks other modules use (missions, map). */
export const MH_SPOTS = {};
export const MH_MAP = { streets: [], houses: [], yards: [], trees: [], fences: [], school: SCHOOL, pools: [], tramps: [], cars: [] };

export function buildSuburbs(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const animated = [];
  const rand = seeded(777);
  const blockers = [];
  const lamps = [];

  // ---- streets: Maple Lane (from Zoo Road down to the pier), Oak + Birch, the east loop
  const cells = new Set();
  street(cells, MAPLE, 0, MAPLE, MH.southJ);
  street(cells, WEST, OAK, EAST, OAK);
  street(cells, WEST, BIRCH, EAST, BIRCH);
  street(cells, EAST, OAK, EAST, BIRCH);
  const extra = new Set([`${MAPLE - 1},0`, `${MAPLE + 1},0`, `${MAPLE},${MH.southJ + 1}`]); // Zoo Road + the funfair gate
  const { group: sg, tiles } = buildStreets(cells, { extra });
  group.add(sg);
  MH_MAP.streets = tiles;
  // pavements along the streets (a strip of concrete each side)
  const walk = [];
  const pave = (x0, z0, x1, z1) => walk.push(new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, 0.025, (z0 + z1) / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), new THREE.Vector3(x1 - x0, z1 - z0, 1)));
  for (const z of [MH.oakZ, MH.birchZ]) { pave(MH.westX - HALF, z - HALF - 1.6, MH.loopX + HALF, z - HALF); pave(MH.westX - HALF, z + HALF, MH.loopX + HALF, z + HALF + 1.6); }
  for (const x of [MH.mapleX]) { pave(x - HALF - 1.6, -33.5, x - HALF, gz(MH.southJ) + HALF); pave(x + HALF, -33.5, x + HALF + 1.6, gz(MH.southJ) + HALF); }
  pave(MH.loopX + HALF, MH.oakZ - HALF, MH.loopX + HALF + 1.6, MH.birchZ + HALF);
  const paveMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), toon(0xd4d8dc), walk.length);
  walk.forEach((m, i) => paveMesh.setMatrixAt(i, m));
  paveMesh.receiveShadow = true;
  group.add(paveMesh);

  // ---- houses: a row facing each cross street (front lawn, driveway, path), back gardens behind
  const houseNames = Object.keys(KIT_SIZES).filter((n) => n.startsWith('building-type-'));
  const houses = [];
  const fences = []; // [x0, z0, x1, z1] low picket fences
  const yards = []; // back gardens: { x0, x1, z0, z1 }
  const SCALE = 7.6;
  for (const [streetZ, gardenTo] of [[MH.oakZ, MH.birchZ - HALF - 1.8], [MH.birchZ, MH.max.z - 4]]) {
    const front = streetZ + HALF + 1.6 + 3.2; // pavement + front lawn
    for (const [x0, x1] of XR) {
      let x = x0 + 0.8;
      while (x < x1 - 9) {
        const fit = pickHouse(rand, houseNames, x1 - x, SCALE);
        if (!fit) break;
        const { name, w, d, lot } = fit;
        const cx = x + lot / 2;
        houses.push({ name, x: cx, z: front + d / 2, rot: Math.PI, scale: SCALE, wall: rand() < 0.55 ? rand.pick(WALL_TINTS) : null, roof: rand.pick(ROOF_TINTS) });
        // driveway on one side (with a car sometimes), a path to the door
        const side = rand() < 0.5 ? -1 : 1;
        const dx = cx + side * (w / 2 + 1.6);
        if (Math.abs(dx - cx) < lot / 2 - 1) {
          slab(group, dx - 1.5, streetZ + HALF + 1.6, dx + 1.5, front + d, 0xb9bfc6, { y: 0.028 });
          if (rand() < 0.55) MH_MAP.cars.push({ x: dx, z: front + 2.6, rot: Math.PI, name: rand.pick(['sedan', 'suv', 'hatchback-sports', 'van']) });
        }
        slab(group, cx - 0.7, streetZ + HALF + 1.6, cx + 0.7, front, 0xe6dcc8, { y: 0.029 });
        // side fences between the back gardens, a back fence along the far edge
        const backZ = front + d;
        fences.push([x, backZ, x, gardenTo], [x + lot, backZ, x + lot, gardenTo]);
        yards.push({ x0: x + 0.6, x1: x + lot - 0.6, z0: backZ + 0.8, z1: gardenTo - 0.6, house: houses.length - 1 });
        // a tree or two on the front lawn
        if (rand() < 0.7) MH_MAP.trees.push([cx - side * (w / 2 - 1), streetZ + HALF + 3.4, 1.8]);
        x += lot;
      }
    }
  }
  // the two houses north of Oak Street, west of Maple Lane (facing Oak Street, gardens towards Zoo Road)
  {
    const [x0, x1] = XR[0];
    const front = MH.oakZ - HALF - 1.6 - 3.2;
    let x = x0 + 0.8;
    while (x < x1 - 9) {
      const fit = pickHouse(rand, houseNames, x1 - x, SCALE);
      if (!fit) break;
      const { name, w, d, lot } = fit;
      const cx = x + lot / 2;
      houses.push({ name, x: cx, z: front - d / 2, rot: 0, scale: SCALE, wall: rand.pick(WALL_TINTS), roof: rand.pick(ROOF_TINTS) });
      slab(group, cx - 0.7, front, cx + 0.7, MH.oakZ - HALF - 1.6, 0xe6dcc8, { y: 0.029 });
      fences.push([x, front - d, x, -24], [x + lot, front - d, x + lot, -24]);
      yards.push({ x0: x + 0.6, x1: x + lot - 0.6, z0: -23.4, z1: front - d - 0.8, house: houses.length - 1, north: true });
      x += lot;
    }
  }
  buildings(group, houses, { blockers, outline: 0 });
  MH_MAP.houses = houses.map((h) => ({ x: h.x, z: h.z, w: h.w, d: h.d, roof: h.roof }));
  MH_MAP.yards = yards;
  buildFences(group, fences);
  MH_MAP.fences = fences;
  parkedCars(group, MH_MAP.cars);

  // the treehouse goes in the biggest southern garden
  const big = yards.filter((y) => !y.north && y.z0 > MH.birchZ).sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0];
  if (big) {
    const tx = big.x1 - 3.2, tz = (big.z0 + big.z1) / 2;
    MH_SPOTS.treehouse = treehouse(group, tx, tz);
    big.kind = 'treehouse';
  }
  // ---- back-garden toys: trampolines, paddling pools, swing sets, a sandpit, the treehouse
  const kinds = ['tramp', 'pool', 'swing', 'tramp', 'pool', 'bbq', 'sand', 'tramp'];
  yards.forEach((y, i) => {
    if (y.kind || y.z1 - y.z0 < 5.5 || y.x1 - y.x0 < 6) return;
    const cx = (y.x0 + y.x1) / 2, cz = (y.z0 + y.z1) / 2;
    const kind = y.north ? 'swing' : kinds[i % kinds.length];
    y.kind = kind;
    if (kind === 'tramp') { trampoline(group, animated, cx, cz); MH_MAP.tramps.push([cx, cz]); }
    else if (kind === 'pool') { paddlingPool(group, cx, cz); MH_MAP.pools.push([cx, cz]); }
    else if (kind === 'swing') swingSet(group, cx, cz);
    else if (kind === 'bbq') bbq(group, cx, cz);
    else sandpit(group, cx, cz);
  });
  // garden trees (behind the toys) and front-lawn trees
  const tl = [];
  for (const [x, z] of MH_MAP.trees) tl.push({ x, z, kind: rand.pick(['tree_default', 'tree_oak', 'tree_fat']), scale: 2.3 + rand() * 0.6 });
  trees(group, tl);

  buildSchool(group, animated, blockers);

  // ---- a lemonade stand on a front lawn of Birch Street, a mailbox at every house, street lamps
  const lemon = houses.find((h) => h.z > MH.birchZ && h.x > XR[1][0] && h.x < XR[1][1]);
  if (lemon) MH_SPOTS.lemonade = lemonadeStand(group, lemon.x + 3.5, MH.birchZ + HALF + 3);
  const boxes = houses.filter((h) => h !== lemon).map((h) => ({ x: h.x + (h.rot === 0 ? 2.2 : -2.2), z: h.rot === 0 ? MH.oakZ - HALF - 2 : (h.z < MH.birchZ ? MH.oakZ : MH.birchZ) + HALF + 2, rot: h.rot }));
  mailboxes(group, boxes);
  for (let j = 1; j <= MH.southJ; j += 3) lamps.push({ x: MH.mapleX - HALF - 0.8, z: gz(j), rot: Math.PI / 2 }, { x: MH.mapleX + HALF + 0.8, z: gz(j) + 7, rot: -Math.PI / 2 });
  for (let i = WEST + 1; i <= EAST; i += 3) for (const z of [MH.oakZ, MH.birchZ]) if (Math.abs(gx(i) - MH.mapleX) > 6) lamps.push({ x: gx(i), z: z + HALF + 0.8, rot: Math.PI });
  const clear = lamps.filter((l) => Math.abs(l.z - MH.oakZ) > 5.5 && Math.abs(l.z - MH.birchZ) > 5.5 && l.z < gz(MH.southJ) - 2);
  const bulbs = streetLamps(group, clear, { height: 4.6 });

  // street signs at the corners
  for (const [x, z, a, b] of [[MH.mapleX - HALF - 1, MH.oakZ - HALF - 1, 'MAPLE LN', 'OAK ST'], [MH.mapleX - HALF - 1, MH.birchZ - HALF - 1, 'MAPLE LN', 'BIRCH ST']]) streetSign(group, x, z, a, b);
  // a sign at the top of Maple Lane, by Zoo Road
  const welcome = signBoard(new THREE.PlaneGeometry(4.2, 2.1), signTexture(['Maple Heights', '🏡 drive slowly 🐢'], { w: 512, h: 256, size: 56, bg: '#2f8a35', fg: '#ffffff' }));
  welcome.position.set(MH.mapleX + HALF + 3, 2.6, -28.5);
  group.add(welcome);
  for (const dx of [-1.8, 1.8]) {
    const post = part(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), 0x7a4a26, { outline: 0.01 });
    post.position.set(MH.mapleX + HALF + 3 + dx, 1.3, -28.55);
    group.add(post);
  }
  addBox(MH.mapleX + HALF + 3, -28.5, 4.4, 0.4);
  addCameraBlocker(group, blockers);
  bakeStatic(group);
  return { group, animated, bulbs };
}

/** A house that fits in the space left (lots are at least 14 wide, or whatever is left). */
function pickHouse(rand, names, space, scale) {
  for (let k = 0; k < 12; k++) {
    const name = rand.pick(names);
    const w = KIT_SIZES[name].x * scale, d = KIT_SIZES[name].z * scale;
    const lot = Math.min(space, Math.max(w + 3.4, 11.5));
    if (lot >= w + 2) return { name, w, d, lot: space - lot < 9 ? space : lot };
  }
  return null;
}

/** Low white picket fences: [x0, z0, x1, z1] lines (axis-aligned), instanced pickets + rails, box colliders. */
function buildFences(group, lines) {
  const pickets = [], rails = [];
  for (const [x0, z0, x1, z1] of lines) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.5) continue;
    for (let d = 0; d <= len; d += 0.75) pickets.push(new THREE.Matrix4().compose(new THREE.Vector3(x0 + ((x1 - x0) * d) / len, 0.55, z0 + ((z1 - z0) * d) / len), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    rails.push(new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, 0.8, (z0 + z1) / 2), new THREE.Quaternion(), new THREE.Vector3(along ? len : 0.07, 0.09, along ? 0.07 : len)));
    addBox((x0 + x1) / 2, (z0 + z1) / 2, Math.max(0.25, Math.abs(x1 - x0)), Math.max(0.25, Math.abs(z1 - z0)));
  }
  group.add(instanced(new THREE.BoxGeometry(0.12, 1.1, 0.12), 0xffffff, pickets, { outline: 0.02 }));
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), 0xffffff, rails, { outline: 0 }));
}

function trampoline(group, animated, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const frame = part(new THREE.TorusGeometry(2, 0.12, 8, 32), 0x2f7fc1, { outline: 0.015 });
  frame.rotation.x = Math.PI / 2;
  frame.position.y = 0.85;
  g.add(frame);
  const mat = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), toon(0x1b1b1b));
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = 0.82;
  g.add(mat);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leg = part(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 6), 0x9aa3ad, { outline: 0 });
    leg.position.set(Math.cos(a) * 1.9, 0.42, Math.sin(a) * 1.9);
    g.add(leg);
    const pole = part(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), 0x2f7fc1, { outline: 0 });
    pole.position.set(Math.cos(a) * 2.05, 1.75, Math.sin(a) * 2.05);
    g.add(pole);
  }
  const net = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 1.7, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x1b1b1b, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
  net.position.y = 1.75;
  g.add(net);
  mat.userData.dynamic = true; // bounces
  group.add(g);
  addCircle(x, z, 2.2);
  animated.push({ update: (t) => { mat.position.y = 0.82 - Math.max(0, Math.sin(t * 4 + x)) * 0.06; } });
}

function paddlingPool(group, x, z) {
  const rim = part(new THREE.CylinderGeometry(2.2, 2.2, 0.55, 28, 1, true), 0xff8ac0, { outline: 0.02 });
  rim.position.set(x, 0.28, z);
  rim.material.side = THREE.DoubleSide;
  group.add(rim);
  const tube = part(new THREE.TorusGeometry(2.2, 0.18, 8, 28), 0xffd23f, { outline: 0.015 });
  tube.rotation.x = Math.PI / 2;
  tube.position.set(x, 0.55, z);
  group.add(tube);
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.15, 28), toon(0x4fc0f0, { transparent: true, opacity: 0.9 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, 0.42, z);
  group.add(water);
  const duck = part(new THREE.SphereGeometry(0.22, 10, 8), 0xffd23f, { outline: 0.01 });
  duck.position.set(x + 0.8, 0.52, z - 0.4);
  group.add(duck);
  addCircle(x, z, 2.4);
}

function swingSet(group, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const beam = part(new THREE.CylinderGeometry(0.08, 0.08, 4, 8), 0xe0453a, { outline: 0.015 });
  beam.rotation.z = Math.PI / 2;
  beam.position.y = 2.4;
  g.add(beam);
  for (const sx of [-2, 2]) for (const sz of [-0.8, 0.8]) {
    const leg = part(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), 0xe0453a, { outline: 0.01 });
    leg.position.set(sx, 1.2, sz / 2);
    leg.rotation.x = sz > 0 ? -0.33 : 0.33;
    g.add(leg);
  }
  for (const sx of [-0.8, 0.8]) {
    for (const dz of [-0.2, 0.2]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.7, 4), toon(0x2b2f38));
      rope.position.set(sx + dz, 1.55, 0);
      g.add(rope);
    }
    const seat = part(new THREE.BoxGeometry(0.6, 0.06, 0.3), 0xffd23f, { outline: 0.01 });
    seat.position.set(sx, 0.7, 0);
    g.add(seat);
  }
  group.add(g);
  addBox(x, z, 4.2, 1.6);
}

function bbq(group, x, z) {
  const grill = part(new THREE.SphereGeometry(0.45, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0x2b2f38, { outline: 0.015 });
  grill.rotation.x = Math.PI;
  grill.position.set(x, 1, z);
  group.add(grill);
  const lid = part(new THREE.SphereGeometry(0.45, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0x2b2f38, { outline: 0.015 });
  lid.position.set(x, 1.05, z);
  lid.rotation.x = -0.6;
  group.add(lid);
  for (let i = 0; i < 3; i++) {
    const leg = part(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), 0x2b2f38, { outline: 0 });
    leg.position.set(x + Math.cos(i * 2.1) * 0.3, 0.45, z + Math.sin(i * 2.1) * 0.3);
    group.add(leg);
  }
  const table = part(new THREE.BoxGeometry(2.4, 0.1, 1.2), 0x9a6234, { outline: 0.015 });
  table.position.set(x + 2.2, 0.85, z);
  group.add(table);
  addCircle(x, z, 0.6);
  addBox(x + 2.2, z, 2.4, 1.2);
}

function sandpit(group, x, z) {
  const box = part(new THREE.BoxGeometry(3, 0.3, 3), 0xb07a45, { outline: 0.015 });
  box.position.set(x, 0.15, z);
  group.add(box);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), toon(0xf2d38a));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(x, 0.31, z);
  group.add(sand);
  const bucket = part(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 10), 0xe0453a, { outline: 0.01 });
  bucket.position.set(x + 0.6, 0.46, z - 0.3);
  group.add(bucket);
}

/** A treehouse in a big oak: platform 3.4 up, a little hut, a rope ladder. Returns the spot under the door. */
function treehouse(group, x, z) {
  const trunk = part(new THREE.CylinderGeometry(0.5, 0.7, 6, 10), 0x7a4a26, { outline: 0.02 });
  trunk.position.set(x + 1.2, 3, z);
  group.add(trunk);
  addCircle(x + 1.2, z, 0.8);
  const crown = part(new THREE.IcosahedronGeometry(3.2, 1), 0x46a83c, { outline: 0.04 });
  crown.position.set(x + 1.2, 7.4, z);
  group.add(crown);
  const deck = part(new THREE.BoxGeometry(3.4, 0.2, 3.2), 0xb07a45, { outline: 0.02 });
  deck.position.set(x, 3.4, z);
  group.add(deck);
  const hut = part(new THREE.BoxGeometry(2.2, 1.7, 2.2), 0xe0a060, { outline: 0.02 });
  hut.position.set(x + 0.4, 4.35, z);
  group.add(hut);
  const roof = part(new THREE.ConeGeometry(1.9, 1.1, 4), 0xe0453a, { outline: 0.02 });
  roof.rotation.y = Math.PI / 4;
  roof.position.set(x + 0.4, 5.75, z);
  group.add(roof);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), toon(0x5a3418));
  door.rotation.y = -Math.PI / 2;
  door.position.set(x - 0.72, 4.05, z);
  group.add(door);
  for (const dz of [-0.35, 0.35]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.4, 5), toon(0xc9a46a));
    rope.position.set(x - 1.65, 1.7, z + dz);
    group.add(rope);
  }
  for (let i = 0; i < 7; i++) {
    const rung = part(new THREE.BoxGeometry(0.08, 0.06, 0.8), 0x9a6234, { outline: 0 });
    rung.position.set(x - 1.65, 0.4 + i * 0.45, z);
    group.add(rung);
  }
  for (const [px, pz] of [[-1.6, -1.5], [1.6, -1.5], [-1.6, 1.5], [1.6, 1.5]]) {
    const post = part(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 6), 0x7a4a26, { outline: 0.01 });
    post.position.set(x + px, 1.7, z + pz);
    group.add(post);
    addCircle(x + px, z + pz, 0.2);
  }
  // little railing
  const rail = part(new THREE.BoxGeometry(0.06, 0.6, 3.2), 0xb07a45, { outline: 0 });
  rail.position.set(x - 1.65, 3.8, z + 0.95);
  rail.scale.z = 0.4;
  group.add(rail);
  MH_MAP.trees.push([x + 1.2, z, 3.2]);
  return { x: x - 1.2, z, y: 3.5, below: { x: x - 2.6, z } };
}

function lemonadeStand(group, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI; // the sign faces the street (north)
  const table = part(new THREE.BoxGeometry(2.2, 1, 0.8), 0xffe066, { outline: 0.02 });
  table.position.y = 0.5;
  g.add(table);
  const sign = signBoard(new THREE.PlaneGeometry(2.2, 0.8), signTexture(['LEMONADE 🍋'], { w: 512, h: 160, size: 70, bg: '#fff8e6', fg: '#e08a00' }));
  sign.position.set(0, 1.9, 0);
  g.add(sign);
  for (const sx of [-1, 1]) {
    const post = part(new THREE.BoxGeometry(0.08, 1.4, 0.08), 0x9a6234, { outline: 0 });
    post.position.set(sx, 1.4, 0);
    g.add(post);
  }
  const jug = part(new THREE.CylinderGeometry(0.18, 0.2, 0.45, 12), 0xfff27a, { outline: 0.01 });
  jug.position.set(-0.5, 1.22, 0);
  g.add(jug);
  for (const dx of [0.1, 0.4, 0.7]) {
    const cup = part(new THREE.CylinderGeometry(0.07, 0.06, 0.16, 8), 0xffffff, { outline: 0 });
    cup.position.set(dx, 1.08, 0.1);
    g.add(cup);
  }
  group.add(g);
  addBox(x, z, 2.2, 0.8);
  return { x, z: z - 1.4 };
}

function mailboxes(group, list) {
  const posts = [], boxes = [];
  for (const m of list) {
    posts.push(new THREE.Matrix4().compose(new THREE.Vector3(m.x, 0.5, m.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
    boxes.push(new THREE.Matrix4().compose(new THREE.Vector3(m.x, 1.05, m.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), m.rot), new THREE.Vector3(1, 1, 1)));
    addCircle(m.x, m.z, 0.25);
  }
  group.add(instanced(new THREE.BoxGeometry(0.1, 1, 0.1), 0x7a4a26, posts, { outline: 0 }));
  group.add(instanced(new THREE.BoxGeometry(0.32, 0.3, 0.55), 0x2f7fc1, boxes, { outline: 0.012 }));
}

function streetSign(group, x, z, a, b) {
  const post = part(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), 0x9aa3ad, { outline: 0.01 });
  post.position.set(x, 1.5, z);
  group.add(post);
  addCircle(x, z, 0.2);
  for (const [text, y, rot] of [[a, 2.9, Math.PI / 2], [b, 2.6, 0]]) {
    const s = signBoard(new THREE.PlaneGeometry(1.8, 0.4), signTexture([text], { w: 256, h: 64, size: 40, bg: '#2f8a35', fg: '#ffffff' }));
    s.position.set(x, y, z);
    s.rotation.y = rot;
    group.add(s);
  }
}

/** Maple Heights Elementary: a painted school building, flagpole, schoolyard with hopscotch, a climbing frame. */
function buildSchool(group, animated, blockers) {
  const { x0, x1, z0, z1 } = SCHOOL;
  // schoolyard surface + fence
  slab(group, x0, z0, x1, z1, 0xc9b38f, { y: 0.026 });
  const name = 'building-k', sc = 9.5;
  const w = KIT_SIZES[name].x * sc, d = KIT_SIZES[name].z * sc;
  const bx = x0 + w / 2 + 1, bz = z1 - 2.5 - d / 2;
  buildings(group, [{ name, x: bx, z: bz, rot: 0, scale: sc, wall: 0xfff0a8 }], { blockers, outline: 0 });
  SCHOOL.building = { x: bx, z: bz, w, d };
  // big sign over the entrance
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6), new THREE.MeshBasicMaterial({ map: signTexture(['MAPLE HEIGHTS ELEMENTARY'], { w: 1024, h: 180, size: 80, bg: '#e0453a', fg: '#ffffff' }) }));
  sign.position.set(bx, 5.2, bz + d / 2 + 0.12);
  group.add(sign);
  // flagpole
  const pole = part(new THREE.CylinderGeometry(0.07, 0.09, 8, 8), 0xdfe6ee, { outline: 0.015 });
  pole.position.set(bx + w / 2 + 2, 4, z1 - 1.5);
  group.add(pole);
  addCircle(bx + w / 2 + 2, z1 - 1.5, 0.25);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1, 8, 1), new THREE.MeshBasicMaterial({ map: signTexture(['🍁'], { w: 128, h: 80, size: 60, bg: '#2f8a35', fg: '#ffffff' }), side: THREE.DoubleSide }));
  flag.position.set(bx + w / 2 + 2.85, 7.4, z1 - 1.5);
  flag.userData.dynamic = true; // waves
  group.add(flag);
  const base = flag.geometry.attributes.position.array.slice();
  animated.push({ update: (t) => {
    const p = flag.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(t * 5 + base[i * 3] * 3) * 0.12 * (base[i * 3] + 0.8));
    p.needsUpdate = true;
  } });
  // schoolyard: hopscotch, a climbing dome, benches
  const yx = (bx + w / 2 + x1) / 2 + 1, yz = (z0 + z1) / 2;
  const hop = canvasTexture(128, 512, (ctx, cw, ch) => {
    ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0, 0, cw, ch);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.font = `700 40px ${FONT}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cells = [[1, 0], [2, 0], [3, 0], [4, -1], [5, 1], [6, 0], [7, -1], [8, 1]];
    cells.forEach(([n, off], i) => {
      const y = ch - (i + 1) * 58, x = off === 0 ? cw / 2 - 29 : off < 0 ? cw / 2 - 58 : cw / 2;
      ctx.strokeRect(x, y, 58, 58); ctx.fillText(String(n), x + 29, y + 31);
    });
  });
  const hopMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 7), new THREE.MeshBasicMaterial({ map: hop, transparent: true }));
  hopMesh.rotation.x = -Math.PI / 2;
  hopMesh.position.set(yx - 4, 0.035, yz);
  group.add(hopMesh);
  MH_SPOTS.hopscotch = { x: yx - 4, z: yz };
  const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), new THREE.MeshBasicMaterial({ color: 0xe0453a, wireframe: true }));
  dome.position.set(yx + 3, 0.2, yz - 2);
  dome.scale.y = 0.8;
  group.add(dome);
  const domeBase = part(new THREE.TorusGeometry(2.35, 0.08, 6, 24), 0xe0453a, { outline: 0 });
  domeBase.rotation.x = Math.PI / 2;
  domeBase.position.set(yx + 3, 0.2, yz - 2);
  group.add(domeBase);
  addCircle(yx + 3, yz - 2, 2.4);
  MH_SPOTS.dome = { x: yx + 3, z: yz - 2 };
  MH_SPOTS.schoolyard = { x: yx, z: yz };
  // fence round the schoolyard (open towards Maple Lane and Oak Street gates)
  buildFences(group, [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, yx + 2, z1]]);
}
