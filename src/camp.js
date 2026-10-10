// Zone 7 — Pinewood Camp: a pine forest north of Zoo Road, up Pine Road. Pinewood Lake (with a dock, canoes and a
// waterfall tumbling off the rocks), a campsite with tents round a crackling campfire, the ranger station, a dirt
// trail round the lake and deer grazing in a clearing.
import * as THREE from 'three';
import { part, toon, instanced, canvasTexture, signTexture } from './toon.js';
import { addBox, addCircle } from './world.js';
import { scatter } from './kit.js';
import { buildStreets, street, gx, gz } from './streets.js';
import { seeded, slab, streetLamps, signBoard } from './cityprops.js';

const PINE_I = 12; // Pine Road's grid column (x = 63.5)
export const CAMP = {
  x0: 8, x1: 152, z0: -218, z1: -98,
  roadX: gx(PINE_I), roadTopJ: -9, // Pine Road runs from Zoo Road (j = 0) up to z = -100
  lake: { x: 104, z: -160, r: 19 },
  site: { x: 40, z: -152 }, // campfire
  ranger: { x: 50, z: -113 }, // ranger station (door faces east, onto the road's end)
  falls: { x: 104, z: -183 },
  clearing: { x: 132, z: -118 },
  trees: [], tents: [],
};
CAMP.dropAt = new THREE.Vector3(CAMP.ranger.x + 5.5, 0, CAMP.ranger.z);
export const CAMP_SPOTS = {};
/** Inside Pinewood Lake (wading; the ambulance can't go in). */
export const inLake = (x, z) => Math.hypot(x - CAMP.lake.x, z - CAMP.lake.z) < CAMP.lake.r - 0.6;

export function buildCamp(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const animated = [];
  const rand = seeded(5150);
  const lampPts = [];
  const C = CAMP;

  // ---- Pine Road: from Zoo Road north to the forest, then a gravel turning circle by the ranger station
  const cells = street(new Set(), PINE_I, -1, PINE_I, C.roadTopJ);
  const { group: sg, tiles } = buildStreets(cells, { extra: new Set([`${PINE_I - 1},0`, `${PINE_I + 1},0`, `${PINE_I},${C.roadTopJ - 1}`]) });
  group.add(sg);
  C.streets = tiles;
  // forest floor (darker grass), the gravel car park, the dirt trail round the lake and to the campsite
  slab(group, C.x0, C.z0, C.x1, C.z1, 0x4f9e3c, { y: 0.008 });
  slab(group, C.roadX - 9, -112, C.roadX + 9, -102.5, 0xb9a98a, { y: 0.02 });
  const dirt = toon(0xc9a46a);
  const trail = new THREE.Mesh(new THREE.RingGeometry(C.lake.r + 4, C.lake.r + 6.5, 64), dirt);
  trail.rotation.x = -Math.PI / 2;
  trail.position.set(C.lake.x, 0.032, C.lake.z);
  trail.receiveShadow = true;
  group.add(trail);
  const pathTo = (ax, az, bx, bz, w = 2.6) => {
    const len = Math.hypot(bx - ax, bz - az);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), dirt);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.atan2(bx - ax, bz - az);
    m.position.set((ax + bx) / 2, 0.031, (az + bz) / 2);
    m.receiveShadow = true;
    group.add(m);
  };
  pathTo(C.roadX, -112, C.site.x + 6, C.site.z + 4);
  pathTo(C.site.x + 6, C.site.z, C.lake.x - C.lake.r - 5, C.lake.z, 2.6);
  pathTo(C.roadX, -112, C.lake.x - 10, C.lake.z + C.lake.r + 4);
  C.paths = [[C.roadX, -112, C.site.x + 6, C.site.z + 4], [C.site.x + 6, C.site.z, C.lake.x - C.lake.r - 5, C.lake.z], [C.roadX, -112, C.lake.x - 10, C.lake.z + C.lake.r + 4]];

  buildLake(group, animated);
  buildFalls(group, animated);
  buildCampsite(group, animated, lampPts);
  buildRangerStation(group, lampPts);
  buildDeer(group, animated);

  // ---- the forest: pines everywhere except the clearings, paths and the lake shore
  const keepOut = [
    [C.lake.x, C.lake.z, C.lake.r + 8], [C.site.x, C.site.z, 15], [C.ranger.x + 4, C.ranger.z, 12], [C.roadX, -105, 10],
    [C.falls.x, C.falls.z - 4, 14], [C.clearing.x, C.clearing.z, 10],
  ];
  const nearPath = (x, z) => C.paths.some(([ax, az, bx, bz]) => {
    const dx = bx - ax, dz = bz - az, t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < 3.5;
  });
  const kinds = ['tree_cone', 'tree_tall', 'tree_cone', 'tree_plateau_dark', 'tree_default', 'tree_cone'];
  const forest = {};
  for (let i = 0; i < 900; i++) {
    const x = C.x0 + 2 + rand() * (C.x1 - C.x0 - 4), z = C.z0 + 2 + rand() * (C.z1 - C.z0 - 6);
    if (keepOut.some(([kx, kz, r]) => Math.hypot(x - kx, z - kz) < r) || nearPath(x, z)) continue;
    if (Math.abs(x - C.roadX) < 6 && z > -112) continue;
    const kind = rand.pick(kinds), scale = 3.6 + rand() * 2.2;
    (forest[kind] ??= []).push({ x, z, rot: rand() * 6, scale });
    addCircle(x, z, 0.5);
    C.trees.push([x, z, scale * 0.42]);
  }
  for (const [kind, ts] of Object.entries(forest)) group.add(scatter(kind, ts, { outline: 0.02 }));
  // undergrowth: bushes, mushrooms, logs, rocks
  const bushes = [], shrooms = [], rocks = [];
  for (let i = 0; i < 160; i++) {
    const x = C.x0 + 2 + rand() * (C.x1 - C.x0 - 4), z = C.z0 + 2 + rand() * (C.z1 - C.z0 - 6);
    if (keepOut.some(([kx, kz, r]) => Math.hypot(x - kx, z - kz) < r - 3) || nearPath(x, z) || Math.abs(x - C.roadX) < 6) continue;
    const k = rand();
    if (k < 0.6) bushes.push({ x, z, rot: rand() * 6, scale: 3 + rand() * 2 });
    else if (k < 0.8) shrooms.push({ x, z, rot: rand() * 6, scale: 3 });
    else { rocks.push({ x, z, rot: rand() * 6, scale: 2.5 + rand() * 2 }); addCircle(x, z, 0.9); }
  }
  group.add(scatter('plant_bushLarge', bushes, { outline: 0.015 }));
  group.add(scatter('mushroom_redGroup', shrooms));
  group.add(scatter('rock_largeA', rocks, { outline: 0.015 }));
  // a wooden trail sign at the turning circle
  const sign = signBoard(new THREE.PlaneGeometry(3.6, 1.8), signTexture(['🌲 PINEWOOD CAMP', '⛺ Camp · 🏞️ Lake · 💦 Falls'], { w: 512, h: 256, size: 44, bg: '#7a4a26', fg: '#fff3d6' }));
  sign.position.set(C.roadX + 7, 2.4, -104);
  sign.rotation.y = -Math.PI / 2;
  group.add(sign);
  for (const dz of [-1.5, 1.5]) {
    const post = part(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 6), 0x5e381c, { outline: 0.01 });
    post.position.set(C.roadX + 7, 1.2, -104 + dz);
    group.add(post);
  }
  addBox(C.roadX + 7, -104, 0.4, 3.6);
  // the edge of the camp: a split-rail fence (gap where Pine Road comes in)
  const rails = [];
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), rot = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
    for (let d = 1.5; d < len; d += 3) rails.push({ x: x0 + ((x1 - x0) * d) / len, z: z0 + ((z1 - z0) * d) / len, rot, scale: 2.4 });
  };
  fence(C.x0, C.z1, C.roadX - 5, C.z1); fence(C.roadX + 5, C.z1, C.x1, C.z1);
  group.add(scatter('fence_simple', rails, { outline: 0.012 }));
  // lamps along Pine Road
  const lamps = [];
  for (let j = -2; j >= C.roadTopJ + 1; j -= 2) if (Math.abs(gz(j) + 66) > 6) lamps.push({ x: C.roadX + 4.3, z: gz(j), rot: -Math.PI / 2 });
  lampPts.push(...streetLamps(group, lamps, { height: 4.8 }));
  return { group, animated, bulbs: lampPts };
}

/** Pinewood Lake: water with lily pads, a sandy shore, a dock with canoes tied up. */
function buildLake(group, animated) {
  const { x, z, r } = CAMP.lake;
  const shore = new THREE.Mesh(new THREE.CircleGeometry(r + 2.2, 48), toon(0xe2c98f));
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(x, 0.024, z);
  group.add(shore);
  const water = new THREE.Mesh(new THREE.CircleGeometry(r, 48), toon(0x3aa6d8, { transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, 0.05, z);
  group.add(water);
  const deep = new THREE.Mesh(new THREE.CircleGeometry(r * 0.6, 40), toon(0x2a86c0, { transparent: true, opacity: 0.6 }));
  deep.rotation.x = -Math.PI / 2;
  deep.position.set(x, 0.055, z);
  group.add(deep);
  const rand = seeded(31);
  const lilies = [];
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2, d = r * (0.55 + rand() * 0.35);
    lilies.push({ x: x + Math.cos(a) * d, y: 0.07, z: z + Math.sin(a) * d, rot: rand() * 6, scale: 2.4 });
  }
  group.add(scatter('lily_large', lilies));
  // dock on the west shore
  const dx0 = x - r - 3, dx1 = x - r + 9;
  const deck = part(new THREE.BoxGeometry(dx1 - dx0, 0.18, 2.6), 0xb07a45, { outline: 0.02 });
  deck.position.set((dx0 + dx1) / 2, 0.28, z);
  group.add(deck);
  for (let px = dx0 + 1; px <= dx1; px += 2.5) for (const dz of [-1.2, 1.2]) {
    const pile = part(new THREE.CylinderGeometry(0.12, 0.12, 1, 6), 0x5e381c, { outline: 0 });
    pile.position.set(px, 0.2, z + dz);
    group.add(pile);
  }
  CAMP.dock = { x0: dx0, x1: dx1, z };
  // two canoes tied up, a third out on the water
  const canoes = [{ x: dx1 - 2, z: z + 2.4, rot: Math.PI / 2 }, { x: dx1 - 5.5, z: z - 2.4, rot: Math.PI / 2 }];
  group.add(scatter('canoe', canoes.map((c) => ({ ...c, y: 0.05, scale: 2.4 })), { outline: 0.015 }));
  CAMP.canoeLoop = { x: x + 4, z: z - 2, r: r * 0.55 };
}

/** The waterfall: a rocky ridge on the north shore, falling water, mist and ripples where it lands. */
function buildFalls(group, animated) {
  const { x, z } = CAMP.falls;
  const rocks = [];
  for (let i = -5; i <= 5; i++) {
    rocks.push({ x: x + i * 3.2, z: z - 3 - Math.abs(i) * 0.6, rot: i * 0.7, scale: 5 + (5 - Math.abs(i)) * 0.9, kind: i % 2 ? 'rock_tallA' : 'rock_tallE' });
    addCircle(x + i * 3.2, z - 3 - Math.abs(i) * 0.6, 2.2);
  }
  for (const kind of ['rock_tallA', 'rock_tallE']) group.add(scatter(kind, rocks.filter((r) => r.kind === kind), { outline: 0.03 }));
  const cliff = part(new THREE.BoxGeometry(9, 10, 3), 0x8f98a2, { outline: 0.03 });
  cliff.position.set(x, 5, z - 3.4);
  group.add(cliff);
  // scrolling water sheet
  const tex = canvasTexture(64, 256, (ctx, w, h) => {
    ctx.fillStyle = '#9ddcff'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + (i % 3) * 0.2})`; ctx.fillRect((i * 13) % w, (i * 37) % h, 3, 24 + (i % 4) * 10); }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(5, 9.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9 }));
  sheet.position.set(x, 4.9, z - 1.85);
  group.add(sheet);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.4, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(x, 0.07, z + 0.6);
  group.add(pool);
  const mist = [];
  for (let i = 0; i < 5; i++) {
    const m = part(new THREE.SphereGeometry(0.9, 10, 8), 0xffffff, { outline: 0, cast: false });
    m.material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    m.position.set(x - 2 + i, 0.6, z + 0.4);
    group.add(m);
    mist.push(m);
  }
  animated.push({ update: (t) => {
    tex.offset.y = -t * 1.6;
    mist.forEach((m, i) => { const k = (t * 0.6 + i * 0.2) % 1; m.position.y = 0.5 + k * 2.2; m.scale.setScalar(0.7 + k * 1.1); m.material.opacity = 0.55 * (1 - k); });
    pool.scale.setScalar(1 + Math.sin(t * 5) * 0.05);
  } });
}

/** The campsite: tents round a campfire with log benches, a flickering fire that glows at night, a picnic table. */
function buildCampsite(group, animated, lampPts) {
  const { x, z } = CAMP.site;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(12, 40), toon(0xb99a6a));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(x, 0.023, z);
  group.add(ground);
  // fire ring + logs + flames
  const stones = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; stones.push({ x: x + Math.cos(a) * 1.1, z: z + Math.sin(a) * 1.1, rot: a, scale: 1.6 }); }
  group.add(scatter('stone_smallFlatA', stones, { outline: 0.01 }));
  group.add(scatter('campfire_logs', [{ x, z, scale: 2.4 }], { outline: 0.015 }));
  addCircle(x, z, 1.3);
  const flames = [];
  for (const [c, s, dx] of [[0xff7a1a, 1, 0], [0xffb000, 0.7, 0.18], [0xfff27a, 0.45, -0.12]]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.35 * s, 1.3 * s, 8), new THREE.MeshBasicMaterial({ color: c }));
    f.position.set(x + dx, 0.6 + 0.3 * s, z);
    group.add(f);
    flames.push(f);
  }
  lampPts.push({ x, y: 1.1, z, size: 5 });
  animated.push({ update: (t) => flames.forEach((f, i) => { f.scale.set(1 + Math.sin(t * 13 + i) * 0.12, 1 + Math.sin(t * 9 + i * 2) * 0.22, 1); f.rotation.y = t * (2 + i); }) });
  // log benches all round
  const logs = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    logs.push({ x: x + Math.cos(a) * 3.4, z: z + Math.sin(a) * 3.4, rot: -a, scale: 2.6 });
    addCircle(x + Math.cos(a) * 3.4, z + Math.sin(a) * 3.4, 0.7);
  }
  group.add(scatter('log_large', logs, { outline: 0.015 }));
  CAMP.logs = logs;
  // tents in a ring, all facing the fire
  const tents = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const tx = x + Math.cos(a) * 8.5, tz = z + Math.sin(a) * 8.5;
    tents.push({ x: tx, z: tz, rot: Math.atan2(x - tx, z - tz), scale: 3 });
    addCircle(tx, tz, 1.7);
    CAMP.tents.push([tx, tz]);
  }
  group.add(scatter('tent_detailedOpen', tents, { outline: 0.015 }));
  // a stack of firewood, a picnic table
  group.add(scatter('log_stack', [{ x: x + 11, z: z - 4, rot: 0.4, scale: 2.6 }], { outline: 0.015 }));
  addCircle(x + 11, z - 4, 1.2);
  const table = part(new THREE.BoxGeometry(2.6, 0.12, 1.2), 0x9a6234, { outline: 0.015 });
  table.position.set(x - 10, 0.9, z + 5);
  group.add(table);
  for (const dz of [-0.95, 0.95]) {
    const bench = part(new THREE.BoxGeometry(2.6, 0.1, 0.4), 0x9a6234, { outline: 0.012 });
    bench.position.set(x - 10, 0.5, z + 5 + dz);
    group.add(bench);
  }
  addBox(x - 10, z + 5, 2.8, 2.4);
  CAMP_SPOTS.fire = { x, z };
}

/** The ranger station: a log cabin with a porch, a green roof, a flagpole and a first-aid sign. */
function buildRangerStation(group, lampPts) {
  const { x, z } = CAMP.ranger;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI / 2; // the porch faces east (towards Pine Road)
  group.add(g);
  const logs = canvasTexture(256, 256, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#8a5a32' : '#9a6a3a'; ctx.fillRect(0, i * 32, w, 32); ctx.fillStyle = '#5e381c'; ctx.fillRect(0, i * 32 + 29, w, 3); }
  });
  const walls = part(new THREE.BoxGeometry(9, 4, 6.5), 0xffffff, { outline: 0.03, matOpts: { map: logs } });
  walls.position.y = 2;
  g.add(walls);
  const roof = part(new THREE.CylinderGeometry(0.01, 6.2, 2.6, 4, 1), 0x2f6b3a, { outline: 0.03 });
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.15, 1, 0.85);
  roof.position.y = 5.3;
  g.add(roof);
  const porch = part(new THREE.BoxGeometry(9, 0.3, 2.6), 0xb07a45, { outline: 0.02 });
  porch.position.set(0, 0.15, 4.5);
  g.add(porch);
  for (const px of [-4.2, 4.2]) {
    const post = part(new THREE.CylinderGeometry(0.15, 0.15, 3.4, 8), 0x7a4a26, { outline: 0.015 });
    post.position.set(px, 1.85, 5.6);
    g.add(post);
  }
  const awning = part(new THREE.BoxGeometry(9.6, 0.2, 3), 0x2f6b3a, { outline: 0.02 });
  awning.position.set(0, 3.6, 4.7);
  awning.rotation.x = 0.18;
  g.add(awning);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.4), toon(0x5a3418));
  door.position.set(0, 1.35, 3.26);
  g.add(door);
  for (const wx of [-2.8, 2.8]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), toon(0xfff3b0, { emissive: 0x6a5a20 }));
    win.position.set(wx, 2.3, 3.26);
    g.add(win);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.9), new THREE.MeshBasicMaterial({ map: signTexture(['RANGER STATION ⛑️'], { w: 512, h: 104, size: 56, bg: '#2f6b3a', fg: '#fff3d6' }) }));
  sign.position.set(0, 3.15, 3.27);
  g.add(sign);
  addBox(x, z, 6.5 + 0.4, 9 + 0.4);
  // flagpole
  const pole = part(new THREE.CylinderGeometry(0.07, 0.09, 7, 8), 0xdfe6ee, { outline: 0.012 });
  pole.position.set(x + 4.5, 3.5, z - 6);
  group.add(pole);
  addCircle(x + 4.5, z - 6, 0.25);
  const flag = signBoard(new THREE.PlaneGeometry(1.5, 0.95), signTexture(['🌲'], { w: 128, h: 80, size: 56, bg: '#2f6b3a', fg: '#fff' }));
  flag.position.set(x + 5.3, 6.4, z - 6);
  group.add(flag);
  lampPts.push({ x: x + 3.5, y: 2.3, z, size: 3 });
  CAMP_SPOTS.ranger = { x: CAMP.dropAt.x, z: CAMP.dropAt.z };
}

/** A small herd of deer grazing in the clearing (heads bob down to eat, ears flick). */
function buildDeer(group, animated) {
  const { x, z } = CAMP.clearing;
  const deer = [];
  for (let i = 0; i < 3; i++) {
    const d = new THREE.Group();
    const col = 0xb07a45, s = i === 0 ? 1.2 : 0.9;
    const body = part(new THREE.CapsuleGeometry(0.42, 1.1, 4, 10), col, { outline: 0.02 });
    body.rotation.x = Math.PI / 2;
    body.position.y = 1.35;
    d.add(body);
    const neck = new THREE.Group();
    neck.position.set(0, 1.6, 0.65);
    d.add(neck);
    const n = part(new THREE.CylinderGeometry(0.15, 0.22, 0.9, 8), col, { outline: 0.015 });
    n.position.set(0, 0.35, 0.15);
    n.rotation.x = 0.5;
    neck.add(n);
    const head = part(new THREE.BoxGeometry(0.32, 0.32, 0.6), col, { outline: 0.015 });
    head.position.set(0, 0.8, 0.45);
    neck.add(head);
    const nose = part(new THREE.SphereGeometry(0.08, 6, 4), 0x2b1a0e, { outline: 0 });
    nose.position.set(0, 0.76, 0.76);
    neck.add(nose);
    if (i === 0) for (const sx of [-1, 1]) {
      const antler = part(new THREE.CylinderGeometry(0.03, 0.04, 0.6, 5), 0xe8d8b8, { outline: 0.01 });
      antler.position.set(sx * 0.14, 1.15, 0.35);
      antler.rotation.z = sx * -0.5;
      neck.add(antler);
    }
    for (const [lx, lz] of [[-0.22, 0.5], [0.22, 0.5], [-0.22, -0.5], [0.22, -0.5]]) {
      const leg = part(new THREE.CylinderGeometry(0.07, 0.05, 1.1, 6), col, { outline: 0.01 });
      leg.position.set(lx, 0.55, lz);
      d.add(leg);
    }
    const tail = part(new THREE.SphereGeometry(0.12, 6, 4), 0xffffff, { outline: 0 });
    tail.position.set(0, 1.55, -0.95);
    d.add(tail);
    d.scale.setScalar(s);
    d.position.set(x + Math.cos(i * 2.2) * 4, 0, z + Math.sin(i * 2.2) * 4);
    d.rotation.y = i * 2.1;
    group.add(d);
    addCircle(d.position.x, d.position.z, 1.1);
    deer.push({ d, neck, phase: i * 1.9 });
  }
  animated.push({ update: (t) => deer.forEach((e) => {
    const graze = Math.sin(t * 0.5 + e.phase) > -0.2;
    e.neck.rotation.x += ((graze ? 1.1 : -0.1) - e.neck.rotation.x) * 0.05;
  }) });
  CAMP_SPOTS.deer = { x, z };
}
