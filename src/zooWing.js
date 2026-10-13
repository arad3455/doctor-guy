// Lakash's wing of the zoo, east of the old ring (x 232–296): Capybara Lagoon (his favourites, with ducks on the
// pond), a flamingo pond, a giant-tortoise garden, a meerkat colony, a promenade with benches and lanterns, a
// welcome arch, the feed shed and Lakash's own cottage with a cat garden. The animals are hand-built (zooAnimals.js)
// and live their own little lives: capybaras swim and graze, flamingos rest on one leg, meerkats stand sentry,
// tortoises plod. When Lakash comes round with the feed bucket, they gather at the fence (gather()).
import * as THREE from 'three';
import { part, toon, instanced, canvasTexture, signTexture, FONT } from './toon.js';
import { addCircle, addBox } from './world.js';
import { scatter, kit } from './kit.js';
import { makeCapybara, makeFlamingo, makeTortoise, makeMeerkat, makeDuck, makeParrot } from './zooAnimals.js';

export const WING = {
  x0: 232.5, x1: 296,
  promenade: { z: 3, x0: 206, x1: 292, w: 4 },
  capybara: { x: 262, z: -19, r: 14, pond: { x: 263.5, z: -21, r: 8 }, island: { x: 265, z: -22.5, r: 2.2 }, label: 'CAPYBARA LAGOON' },
  tortoise: { x: 250, z: 24, r: 9, label: 'GIANT TORTOISES' },
  flamingo: { x: 278, z: 25, r: 9, pond: { x: 278.5, z: 26, r: 5.8 }, label: 'FLAMINGOS' },
  meerkat: { x: 286.5, z: -13.5, r: 5.5, label: 'MEERKATS', mound: { r: 2.2, h: 0.99 } },
  aviary: { x: 247, z: -38.5, r: 6 },
  cottage: { x: 285, z: -37, w: 8, d: 6 },
  shed: { x: 266, z: -40, w: 6.5, d: 4.4 },
  northPath: { x: 278.2, z0: -34, z1: 2 },
};
const ENCLOSURES = ['capybara', 'tortoise', 'flamingo', 'meerkat'];

const rand = (() => { let s = 4242; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

/** Is (x, z) taken by something in the wing (for the zoo's flower and tree scatter)? */
export function wingBusy(x, z, pad = 1) {
  const W = WING;
  if (ENCLOSURES.some((k) => Math.hypot(W[k].x - x, W[k].z - z) < W[k].r + pad + 1.2)) return true;
  if (Math.abs(z - W.promenade.z) < W.promenade.w / 2 + pad && x > W.promenade.x0 - pad && x < W.promenade.x1 + pad) return true;
  if (Math.abs(x - W.northPath.x) < 1.6 + pad && z > W.northPath.z0 - pad && z < W.northPath.z1 + pad) return true;
  for (const b of [W.cottage, W.shed]) if (Math.abs(x - b.x) < b.w / 2 + 3 + pad && z > b.z - b.d / 2 - 3 - pad && z < b.z + b.d / 2 + (b === W.cottage ? 9 : 3) + pad) return true; // (the cottage keeps its front garden clear)
  if (Math.abs(z + 36) < 1.4 + pad && x > W.aviary.x && x < W.northPath.x) return true; // path to the shed and the aviary
  if (Math.hypot(x - W.aviary.x, z - W.aviary.z) < W.aviary.r + 1 + pad) return true;
  return false;
}

export function buildWing(group, animated) {
  const W = WING;
  const pathMat = toon(0xe8cf98);
  const flat = (w, d, x, z, mat, y = 0.022) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  // ---- paths: the promenade from the ring, the north path to the cottage, a spur to the shed
  const P = W.promenade;
  flat(P.x1 - P.x0, P.w, (P.x0 + P.x1) / 2, P.z, pathMat);
  flat(2.4, W.northPath.z1 - W.northPath.z0, W.northPath.x, (W.northPath.z0 + W.northPath.z1) / 2, pathMat, 0.021);
  flat(W.northPath.x - W.aviary.x - W.aviary.r, 2.2, (W.northPath.x + W.aviary.x + W.aviary.r) / 2, -36, pathMat, 0.021);

  // ---- the welcome arch over the promenade
  buildArch(group, 238, P.z);

  // ---- enclosures
  const capy = W.capybara, tort = W.tortoise, flam = W.flamingo, meer = W.meerkat;
  // ground inside each one
  const disc = (x, z, r, color, y = 0.024) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), toon(color)); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; group.add(m); return m; };
  disc(capy.x, capy.z, capy.r, 0x8fd060);
  disc(tort.x, tort.z, tort.r, 0xd9c48a);
  disc(flam.x, flam.z, flam.r, 0x9fd46a);
  disc(meer.x, meer.z, meer.r, 0xe0c27e);
  // ponds: sandy beach rim, water that shimmers, lilies and reeds
  const pondAt = (p, beach = 0xe8d49a) => {
    disc(p.x, p.z, p.r + 1.1, beach, 0.03);
    const w = disc(p.x, p.z, p.r, 0x4fb8f0, 0.045);
    w.material = toon(0x4fb8f0, { transparent: true, opacity: 0.92 });
    const deep = disc(p.x + 0.6, p.z - 0.4, p.r * 0.55, 0x3a9ee0, 0.047);
    deep.material = toon(0x3a9ee0, { transparent: true, opacity: 0.85 });
    animated.push({ update: (t) => { w.material.opacity = 0.88 + Math.sin(t * 1.3) * 0.05; } });
    return w;
  };
  pondAt(capy.pond);
  pondAt(flam.pond, 0xf0dcae);
  // the capybaras' island, with a bent palm and a mud bank
  disc(capy.island.x, capy.island.z, capy.island.r, 0xb59a62, 0.05);
  disc(capy.island.x - 0.3, capy.island.z + 0.2, capy.island.r * 0.75, 0x8fd060, 0.055);
  group.add(scatter('tree_palmBend', [{ x: capy.island.x + 0.4, z: capy.island.z - 0.3, rot: 2.2, scale: 3.6 }], { outline: 0.02 }));
  group.add(scatter('lily_large', [[-4, 2], [3, 4.5], [-2.5, -5], [5.5, -1]].map(([dx, dz]) => ({ x: capy.pond.x + dx, z: capy.pond.z + dz, y: 0.06, rot: rand() * 6, scale: 2.6 })), {}));
  group.add(scatter('lily_small', [[-5, -1], [1, 6], [4.5, 2.5]].map(([dx, dz]) => ({ x: capy.pond.x + dx, z: capy.pond.z + dz, y: 0.06, rot: rand() * 6, scale: 2.4 })), {}));
  const reeds = [];
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, r = capy.pond.r + 0.4 + rand() * 0.8;
    if (Math.abs(a - Math.PI / 2) < 0.6) continue; // keep the view from the deck open
    reeds.push({ x: capy.pond.x + Math.cos(a) * r, z: capy.pond.z + Math.sin(a) * r, rot: rand() * 6, scale: 2.4 + rand() });
  }
  group.add(scatter('grass_leafsLarge', reeds, { cast: false }));
  // capybara land: a shade tree, logs, a hay rack, a warm mud wallow
  group.add(scatter('tree_oak', [{ x: capy.x - 9, z: capy.z - 6, rot: 1, scale: 5 }, { x: capy.x + 10, z: capy.z + 6.5, rot: 2.5, scale: 4.4 }], { outline: 0.02 }));
  group.add(scatter('log_large', [{ x: capy.x - 8, z: capy.z + 5, rot: 0.3, scale: 3 }], { outline: 0.015 }));
  group.add(scatter('stump_round', [{ x: capy.x - 10.5, z: capy.z + 1, scale: 3 }, { x: capy.x + 8, z: capy.z - 9, scale: 2.6 }], { outline: 0.015 }));
  hayRack(group, capy.x - 4, capy.z - 11.5, 0.2);
  const mud = disc(capy.x - 7, capy.z + 7.5, 1.3, 0x8a6338, 0.032);
  mud.scale.set(1.4, 1, 0.8);

  // tortoise garden: sand, rocks, a shallow water dish, a shelter hut, lettuce patches
  group.add(scatter('rock_largeE', [{ x: tort.x + 5, z: tort.z + 3, rot: 1, scale: 3 }, { x: tort.x - 6, z: tort.z - 2, rot: 2, scale: 2.6 }], { outline: 0.02 }));
  group.add(scatter('rock_smallFlatA', [[2, -5], [-3, 5], [6, -3]].map(([dx, dz]) => ({ x: tort.x + dx, z: tort.z + dz, rot: rand() * 6, scale: 3 })), { cast: false }));
  group.add(scatter('plant_flatTall', [[-5, 5], [5, -6], [-2, -6.5]].map(([dx, dz]) => ({ x: tort.x + dx, z: tort.z + dz, rot: rand() * 6, scale: 3.4 })), { outline: 0.012 }));
  disc(tort.x - 1.5, tort.z + 2.5, 1.3, 0x5cc8f2, 0.04);
  shelterHut(group, tort.x + 3.5, tort.z + 6, Math.PI);
  for (const [dx, dz] of [[-3, -2], [1, -3]]) for (let k = 0; k < 4; k++) {
    const leaf = part(new THREE.SphereGeometry(0.16, 8, 6), 0x7ccf3a, { outline: 0.006 });
    leaf.scale.set(1, 0.45, 1);
    leaf.position.set(tort.x + dx + (k % 2) * 0.3, 0.06, tort.z + dz + (k >> 1) * 0.3);
    group.add(leaf);
  }

  // flamingo pond: tall reeds, a mud-nest island, palms
  const freeds = [];
  for (let i = 0; i < 22; i++) { const a = rand() * Math.PI * 2; freeds.push({ x: flam.pond.x + Math.cos(a) * (flam.pond.r + 0.7), z: flam.pond.z + Math.sin(a) * (flam.pond.r + 0.7), rot: rand() * 6, scale: 2.8 }); }
  group.add(scatter('grass_leafsLarge', freeds, { cast: false }));
  for (const [dx, dz] of [[1.8, -1.2], [-1.6, 1.4]]) {
    const nest = part(new THREE.CylinderGeometry(0.5, 0.7, 0.35, 12), 0x9a7a52, { outline: 0.01 });
    nest.position.set(flam.pond.x + dx, 0.17, flam.pond.z + dz);
    group.add(nest);
  }
  group.add(scatter('tree_palmDetailedTall', [{ x: flam.x - 6.5, z: flam.z + 4.5, rot: 1, scale: 4 }, { x: flam.x + 6.8, z: flam.z - 4, rot: 3, scale: 3.6 }], { outline: 0.02 }));

  // meerkat colony: a sandy mound with burrows, a lookout log and rocks
  const mound = part(new THREE.SphereGeometry(2.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xd4b06a, { outline: 0.02 });
  mound.scale.set(1, 0.45, 1);
  mound.position.set(meer.x, 0, meer.z);
  group.add(mound);
  for (const [dx, dz] of [[0.6, 1.2], [-1.1, -0.5], [1.3, -0.9]]) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), toon(0x3a2a18));
    hole.position.set(meer.x + dx, 0.62 - Math.hypot(dx, dz) * 0.18, meer.z + dz);
    hole.lookAt(meer.x + dx * 3, 3, meer.z + dz * 3);
    group.add(hole);
  }
  group.add(scatter('log', [{ x: meer.x - 3, z: meer.z + 2.5, rot: 0.6, scale: 2.4 }], { outline: 0.012 }));
  group.add(scatter('rock_tallE', [{ x: meer.x + 3, z: meer.z + 2.2, rot: 2, scale: 2.4 }], { outline: 0.015 }));

  // ---- fences, signs, colliders: a low rail fence so everyone can see in
  for (const k of ENCLOSURES) {
    const e = W[k];
    railFence(group, e.x, e.z, e.r, k === 'capybara' ? Math.PI / 2 : null);
    addCircle(e.x, e.z, e.r + 0.3);
    // a sign by the nearest path, facing it
    const toPath = new THREE.Vector3(0, 0, P.z - e.z).normalize();
    const at = new THREE.Vector3(e.x + (k === 'meerkat' ? -e.r - 1.2 : 0), 0, e.z + (k === 'meerkat' ? 0 : toPath.z * (e.r + 1.3)));
    const yaw = k === 'meerkat' ? -Math.PI / 2 : toPath.z > 0 ? 0 : Math.PI;
    sign(group, at.x, at.z, yaw, e.label, k === 'capybara' ? 'Lakash’s favourites ♥' : null);
  }
  // the capybara viewing deck on the promenade side, with benches and a telescope
  const deck = part(new THREE.BoxGeometry(8, 0.25, 2.6), 0xb07e4a, { outline: 0.015, receive: true });
  deck.position.set(capy.x, 0.12, capy.z + capy.r + 1.35);
  group.add(deck);
  group.add(scatter('stall-bench', [{ x: capy.x - 2.4, z: capy.z + capy.r + 1.9, rot: 0, scale: 3 }, { x: capy.x + 2.4, z: capy.z + capy.r + 1.9, rot: 0, scale: 3 }], { outline: 0.012 }));
  const scope = part(new THREE.CylinderGeometry(0.09, 0.14, 0.7, 8), 0x2f7fc1, { outline: 0.01 });
  scope.rotation.x = Math.PI / 2 - 0.3;
  scope.position.set(capy.x, 1.2, capy.z + capy.r + 1);
  group.add(scope);
  const stand = part(new THREE.CylinderGeometry(0.05, 0.08, 1, 6), 0x5a6068, { outline: 0 });
  stand.position.set(capy.x, 0.6, capy.z + capy.r + 1.2);
  group.add(stand);
  // the Capy Café kiosk by the deck
  const cafe = capyCafe();
  cafe.position.set(capy.x + 9.5, 0, P.z - 3.6);
  group.add(cafe);
  addCircle(capy.x + 9.5, P.z - 3.6, 1.7);

  // ---- along the promenade: lanterns and benches, flower beds
  const lamps = [], benches = [];
  for (let x = 214; x < P.x1; x += 9) {
    if (Math.abs(x - 238) < 3) continue;
    lamps.push({ x, z: P.z - P.w / 2 - 0.6, scale: 2.1 }, { x: x + 4.5, z: P.z + P.w / 2 + 0.6, scale: 2.1 });
    addCircle(x, P.z - P.w / 2 - 0.6, 0.3); addCircle(x + 4.5, P.z + P.w / 2 + 0.6, 0.3);
    if (x > 242 && Math.abs(x - 262) > 6) { benches.push({ x: x + 2, z: P.z + P.w / 2 + 1.1, rot: Math.PI, scale: 3 }); addCircle(x + 2, P.z + P.w / 2 + 1.1, 0.9); }
  }
  group.add(scatter('lantern', lamps, { outline: 0.01 }));
  group.add(scatter('stall-bench', benches, { outline: 0.012 }));

  // ---- the feed shed and Lakash's cottage
  const shed = feedShed();
  shed.position.set(W.shed.x, 0, W.shed.z);
  group.add(shed);
  addBox(W.shed.x, W.shed.z, W.shed.w, W.shed.d);
  const home = cottage();
  home.group.position.set(W.cottage.x, 0, W.cottage.z);
  group.add(home.group);
  addBox(W.cottage.x, W.cottage.z - 0.4, W.cottage.w, W.cottage.d - 0.6);
  const toWorld = (v) => v.clone().add(home.group.position);

  // ---- greenery and details: tree clusters, bushes, flower beds along the promenade, picnic tables, bins, the board
  const treeKinds = ['tree_oak', 'tree_default', 'tree_detailed', 'tree_fat', 'tree_palmTall', 'tree_tall'];
  const trees = Object.fromEntries(treeKinds.map((k) => [k, []])), bushes = [];
  for (let i = 0, n = 0; i < 600 && n < 34; i++) {
    const x = W.x0 + 3 + rand() * (W.x1 - W.x0 - 9), z = -41 + rand() * 82;
    if (wingBusy(x, z, 2.2)) continue;
    const k = treeKinds[n % treeKinds.length], scale = 3.8 + rand() * 1.6;
    trees[k].push({ x, z, rot: rand() * 6, scale });
    addCircle(x, z, 0.55);
    for (let b = 0; b < 2; b++) bushes.push({ x: x + (rand() - 0.5) * 3.5, z: z + (rand() - 0.5) * 3.5, rot: rand() * 6, scale: 2.6 + rand() });
    n++;
  }
  for (const [k, list] of Object.entries(trees)) group.add(scatter(k, list, { outline: 0.02 }));
  group.add(scatter('plant_bushLarge', bushes.filter((b) => !wingBusy(b.x, b.z, 0.3)), { outline: 0.012 }));
  const beds = { flower_redA: [], flower_yellowA: [], flower_purpleA: [], flower_yellowB: [] };
  const bedKinds = Object.keys(beds);
  for (let x = 240; x < P.x1 - 2; x += 1.1) for (const side of [-1, 1]) {
    const z = P.z + side * (P.w / 2 + 0.55);
    if (Math.abs(x - 262) < 5 && side < 0) continue; // the deck
    if (Math.abs(x - W.northPath.x) < 2 && side < 0) continue;
    if (Math.floor(x / 9) % 2) continue; // beds with gaps between
    beds[bedKinds[Math.floor(x * 3) % 4]].push({ x, z, rot: rand() * 6, scale: 2.6 });
  }
  for (const [k, list] of Object.entries(beds)) group.add(scatter(k, list, { cast: false }));
  for (const [x, z] of [[283.5, P.z - 5.6], [287.6, P.z - 5.6]]) picnicTable(group, x, z);
  for (const [x, z] of [[245, P.z + 3.2], [270, P.z + 3.2], [291, P.z - 3.4]]) bin(group, x, z);
  feedingBoard(group, 242, P.z - 3.6);

  // ---- the animals
  const animals = [];
  const add = (a, home, radius, opts) => {
    const w = new Wanderer(a, home, radius, opts);
    w.root.userData.dynamic = true;
    group.add(w.root);
    animals.push(w);
    return w;
  };
  const capyHome = new THREE.Vector3(capy.x, 0, capy.z);
  for (let i = 0; i < 9; i++) add(makeCapybara({ mandarin: i === 2, baby: i === 5 || i === 7, tone: (rand() - 0.5) * 0.06 }), capyHome, capy.r - 1.6, { speed: 0.7, pond: capy.pond, island: capy.island });
  for (let i = 0; i < 5; i++) add(makeDuck(i % 2 ? 0xffffff : 0x8a6a4a), new THREE.Vector3(capy.pond.x, 0, capy.pond.z), capy.pond.r - 1, { speed: 0.5, swimmer: true, pond: capy.pond });
  for (let i = 0; i < 4; i++) add(makeTortoise(), new THREE.Vector3(tort.x, 0, tort.z), tort.r - 2, { speed: 0.18 });
  for (let i = 0; i < 9; i++) add(makeFlamingo(), new THREE.Vector3(flam.pond.x, 0, flam.pond.z), flam.pond.r + 1.5, { speed: 0.5, pond: flam.pond, wader: true });
  for (let i = 0; i < 7; i++) {
    const m = makeMeerkat();
    m.root.scale.setScalar(1.3);
    add(m, new THREE.Vector3(meer.x, 0, meer.z), meer.r - 1, { speed: 1.6, mound: { x: meer.x, z: meer.z, ...meer.mound }, sentry: i < 2 ? { x: meer.x + (i ? -0.5 : 0.4), z: meer.z + (i ? 0.3 : -0.2) } : null });
  }
  // the aviary: macaws on the perches, now and then a loop round the dome
  const av = W.aviary;
  const perches = buildAviary(group, av.x, av.z, av.r);
  for (let i = 0; i < 6; i++) add(makeParrot(i), new THREE.Vector3(av.x, 0, av.z), av.r - 1.5, { speed: 2.2, perch: perches[i % perches.length] });
  const wingGroup = group;
  animated.push({ update: (t, dt) => { if (wingGroup.visible) for (const a of animals) a.update(t, dt); } });

  return {
    animals,
    /** Lakash's stops on his rounds: where he stands, what he faces, which animals come over. */
    stops: [
      { name: 'capybaras', kind: 'capybara', x: capy.x - 4, z: capy.z + capy.r + 1.2, face: Math.PI, at: new THREE.Vector3(capy.x - 4, 0, capy.z + capy.r - 1.5) },
      { name: 'tortoises', kind: 'tortoise', x: tort.x + 2, z: tort.z - tort.r - 1.2, face: 0, at: new THREE.Vector3(tort.x + 2, 0, tort.z - tort.r + 1.6) },
      { name: 'flamingos', kind: 'flamingo', x: flam.x - 2, z: flam.z - flam.r - 1.2, face: 0, at: new THREE.Vector3(flam.x - 2, 0, flam.z - flam.r + 2) },
      { name: 'meerkats', kind: 'meerkat', x: meer.x - meer.r - 1.2, z: meer.z + 1, face: Math.PI / 2, at: new THREE.Vector3(meer.x - meer.r + 1.2, 0, meer.z + 1) },
      { name: 'the feed shed', kind: null, x: W.shed.x + 1, z: W.shed.z + W.shed.d / 2 + 1.2, face: Math.PI, chore: 'shed' },
    ],
    porch: { ...toWorld(home.porch), face: 0, seat: { cx: home.group.position.x + 1.8, cz: home.group.position.z + 3.1, y: 0.68 } },
    bed: toWorld(home.door),
    catSpots: home.catSpots.map(toWorld),
    /** Send the animals of `kind` to `at` (the feeding spot) for `secs`, then let them wander again. */
    gather(kind, at, secs = 14) {
      let i = 0;
      for (const a of animals) if (a.kind === kind) a.callTo(at, secs, i++);
    },
  };
}

/** One animal living in its enclosure. */
export class Wanderer {
  constructor(a, home, radius, { speed = 1, pond = null, island = null, swimmer = false, wader = false, sentry = null, mound = null, perch = null } = {}) {
    Object.assign(this, { a, home, radius, speed, pond, island, swimmer, wader, sentry, mound, perch });
    this.kind = a.kind;
    this.root = a.root;
    this.root.position.copy(this.spot());
    if (sentry) this.root.position.set(sentry.x, 0, sentry.z);
    if (perch) { this.root.position.copy(perch); this.fly = null; this.perchT = 4 + rand() * 10; }
    this.root.rotation.y = rand() * 6.28;
    this.target = null;
    this.wait = rand() * 5;
    this.phase = rand() * 10;
    this.call = null;
  }
  spot() {
    for (let k = 0; k < 20; k++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * this.radius;
      const p = new THREE.Vector3(this.home.x + Math.cos(a) * d, 0, this.home.z + Math.sin(a) * d);
      if (this.island && Math.hypot(p.x - this.island.x, p.z - this.island.z) < this.island.r + 0.4) continue;
      return p;
    }
    return this.home.clone();
  }
  inWater(p = this.root.position) { return this.pond && Math.hypot(p.x - this.pond.x, p.z - this.pond.z) < this.pond.r - 0.3; }
  callTo(at, secs, i) {
    if (this.sentry) return; // somebody has to keep watch
    const a = i * 2.39996, r = 0.7 + Math.sqrt(i) * 0.75;
    this.call = { until: secs, at: new THREE.Vector3(at.x + Math.cos(a) * r, 0, at.z + Math.sin(a) * r * 0.5) };
    this.target = this.call.at;
  }
  /** Height of the meerkat mound under (x, z). */
  groundY(p) {
    const m = this.mound;
    if (!m) return 0;
    const d = Math.hypot(p.x - m.x, p.z - m.z) / m.r;
    return d < 1 ? m.h * Math.sqrt(1 - d * d) : 0;
  }
  update(t, dt) {
    const p = this.root.position, P = this.a.parts, k = this.kind;
    if (k === 'parrot') { this.updateParrot(t, dt); return; }
    if (this.call && (this.call.until -= dt) <= 0) { this.call = null; this.target = null; this.wait = 1 + rand() * 3; }
    let moving = false;
    if (this.target) {
      const to = this.target.clone().sub(p).setY(0), d = to.length();
      if (d < 0.25) { if (!this.call) { this.target = null; this.wait = 3 + rand() * 7; } }
      else {
        to.normalize();
        const want = Math.atan2(to.x, to.z), diff = Math.atan2(Math.sin(want - this.root.rotation.y), Math.cos(want - this.root.rotation.y));
        this.root.rotation.y += diff * Math.min(1, dt * 3);
        const hurry = this.call ? 1.8 : 1; // feeding time: they trot over
        if (Math.abs(diff) < 0.7) { p.addScaledVector(to, Math.min(d, this.speed * hurry * (this.inWater() && k === 'capybara' ? 0.8 : 1) * dt)); moving = true; }
      }
    } else if (!this.sentry && (this.wait -= dt) <= 0) {
      this.target = this.swimmer ? this.pondSpot() : this.spot();
    }
    const s = t * (k === 'meerkat' ? 18 : k === 'tortoise' ? 3 : 7) + this.phase;
    const eating = this.call && !moving;
    // species poses
    if (k === 'capybara') {
      const swim = this.inWater();
      this.a.body.position.y += ((swim ? -0.34 : 0) - this.a.body.position.y) * Math.min(1, dt * 3);
      P.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(s + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * (swim ? 0.7 : 0.45) : 0; });
      P.head.rotation.x = 0.12 + (eating ? 0.25 + Math.sin(t * 6 + this.phase) * 0.12 : moving ? 0 : Math.max(0, Math.sin(t * 0.4 + this.phase)) * 0.35); // grazing
      P.head.rotation.y = !moving && !eating ? Math.sin(t * 0.25 + this.phase) * 0.25 : 0;
    } else if (k === 'duck') {
      this.a.body.position.y = 0.02 + Math.sin(t * 2 + this.phase) * 0.015;
      P.head.rotation.x = Math.sin(t * 0.7 + this.phase) > 0.9 ? 0.9 : 0; // a dip now and then
    } else if (k === 'tortoise') {
      P.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(s + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.3 : 0; });
      P.head.position.z = 0.74 + (moving || eating ? 0.06 : -0.05) + (eating ? Math.sin(t * 4) * 0.03 : 0);
      this.a.body.position.y = moving ? Math.abs(Math.sin(s)) * 0.02 : 0;
    } else if (k === 'flamingo') {
      const rest = !moving && !this.call && Math.sin(t * 0.08 + this.phase) > -0.2; // most of the time: on one leg
      P.legs.forEach(({ leg, knee }, i) => {
        if (moving) { leg.rotation.x = Math.sin(s + i * Math.PI) * 0.35; knee.rotation.x = Math.max(0, -Math.sin(s + i * Math.PI)) * 0.8; }
        else { leg.rotation.x = rest && i === 1 ? -0.6 : 0; knee.rotation.x = rest && i === 1 ? 2.4 : 0; }
      });
      P.head.rotation.x = eating ? 0.6 + Math.sin(t * 5) * 0.2 : Math.sin(t * 0.5 + this.phase) * 0.15;
      this.a.body.rotation.z = rest ? 0.03 : 0;
    } else if (k === 'zebra') {
      P.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(s * 0.8 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.4 : 0; });
      P.head.rotation.x = moving ? 0 : Math.max(0, Math.sin(t * 0.3 + this.phase)) * 0.9; // head down to graze
      P.tail.rotation.z = Math.sin(t * 3 + this.phase) * 0.4;
    } else if (k === 'hippo') {
      const wet = this.inWater();
      this.a.body.position.y += ((wet ? -0.78 : 0) - this.a.body.position.y) * Math.min(1, dt * 2); // up to the eyes in water
      P.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(s * 0.6 + (i % 2 ? Math.PI : 0)) * 0.25 : 0; });
      const yawn = Math.max(0, Math.sin(t * 0.15 + this.phase) - 0.92) * 9; // a big yawn now and then
      P.head.rotation.x = -yawn * 0.5;
    } else if (k === 'meerkat') {
      p.y = this.groundY(p);
      if (this.sentry) {
        // on watch up on the mound: standing tall, looking round in little jerks
        this.a.body.rotation.x = 0;
        P.head.rotation.y = Math.round(Math.sin(t * 0.6 + this.phase) * 2) * 0.5;
      } else {
        this.a.body.rotation.x += ((moving ? 1.15 : Math.sin(t * 0.3 + this.phase) > 0.6 ? 0 : 0.9) - this.a.body.rotation.x) * Math.min(1, dt * 8); // scurry on all fours, sit up to look
        this.a.body.position.y = moving ? Math.abs(Math.sin(s)) * 0.04 : 0;
      }
    }
  }
  /** Macaws: sit on a perch, then fly a few loops round the dome and land again. */
  updateParrot(t, dt) {
    const p = this.root.position, P = this.a.parts;
    if (!this.fly) {
      p.lerp(this.perch, Math.min(1, dt * 3));
      P.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * 0.05; });
      P.head.rotation.y = Math.sin(t * 0.8 + this.phase) * 0.6;
      if ((this.perchT -= dt) <= 0) this.fly = { a: Math.atan2(p.z - this.home.z, p.x - this.home.x), left: 6 + rand() * 6, h: 2.6 + rand() * 1.2, dir: rand() < 0.5 ? 1 : -1 };
      return;
    }
    const f = this.fly;
    f.a += f.dir * dt * 0.9;
    const r = this.radius;
    const want = f.left > 0 ? new THREE.Vector3(this.home.x + Math.cos(f.a) * r, f.h + Math.sin(t * 2 + this.phase) * 0.3, this.home.z + Math.sin(f.a) * r) : this.perch;
    p.lerp(want, Math.min(1, dt * 2.5));
    this.root.rotation.y = Math.atan2(-Math.sin(f.a) * f.dir, Math.cos(f.a) * f.dir);
    P.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (0.2 + Math.sin(t * 22 + this.phase) * 0.9); });
    if ((f.left -= dt) <= 0 && p.distanceTo(this.perch) < 0.1) { this.fly = null; this.perchT = 6 + rand() * 12; }
  }
  pondSpot() {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * (this.pond.r - 1);
    const p = new THREE.Vector3(this.pond.x + Math.cos(a) * d, 0, this.pond.z + Math.sin(a) * d);
    return p;
  }
}

/** A low wooden rail fence round an enclosure (an opening at `gapAt` radians, if given, is closed by a gate). */
function railFence(group, x, z, r, gapAt = null) {
  const posts = [], rails = [];
  const n = Math.round((2 * Math.PI * r) / 2.2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    posts.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * r, 0.6, z + Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
    const b = ((i + 0.5) / n) * Math.PI * 2, len = 2 * r * Math.sin(Math.PI / n);
    for (const y of [0.55, 1.05]) rails.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(b) * r, y, z + Math.sin(b) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -b, 0)), new THREE.Vector3(1, 1, len)));
  }
  group.add(instanced(new THREE.BoxGeometry(0.16, 1.2, 0.16), 0x7a5230, posts, { outline: 0.015 }));
  group.add(instanced(new THREE.BoxGeometry(0.08, 0.1, 1), 0xa8743f, rails, { outline: 0 }));
}

function sign(group, x, z, yaw, title, sub = null) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  for (const sx of [-0.9, 0.9]) {
    const post = part(new THREE.BoxGeometry(0.14, 1.9, 0.14), 0x7a4a26, { outline: 0.01 });
    post.position.set(sx, 0.95, 0);
    g.add(post);
  }
  const lines = sub ? [title, sub] : [title];
  const size = title.length > 13 ? 50 : title.length > 9 ? 62 : 74;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.3, sub ? 1 : 0.7), new THREE.MeshBasicMaterial({ map: signTexture(lines, { w: 512, h: sub ? 224 : 156, size: sub ? Math.min(size, 56) : size, bg: '#7a4a26', fg: '#ffe9b3' }), side: THREE.DoubleSide }));
  board.position.set(0, 1.55, 0.08);
  g.add(board);
  group.add(g);
  addCircle(x, z, 0.5);
}

function hayRack(group, x, z, rot) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  for (const sx of [-0.9, 0.9]) for (const sz of [-0.35, 0.35]) {
    const leg = part(new THREE.BoxGeometry(0.12, 1.2, 0.12), 0x7a5230, { outline: 0.01 });
    leg.position.set(sx, 0.6, sz);
    g.add(leg);
  }
  const hay = part(new THREE.BoxGeometry(1.8, 0.5, 0.7), 0xe6c55a, { outline: 0.012 });
  hay.position.y = 1.15;
  g.add(hay);
  const roof = part(new THREE.BoxGeometry(2.2, 0.08, 1.2), 0xa8743f, { outline: 0.01 });
  roof.position.y = 1.8;
  roof.rotation.z = 0.1;
  g.add(roof);
  group.add(g);
}

function shelterHut(group, x, z, rot) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const back = part(new THREE.BoxGeometry(2.6, 1.1, 0.15), 0xa8743f, { outline: 0.012 });
  back.position.set(0, 0.55, -0.9);
  g.add(back);
  for (const sx of [-1.25, 1.25]) { const side = part(new THREE.BoxGeometry(0.15, 1.1, 1.9), 0xa8743f, { outline: 0.012 }); side.position.set(sx, 0.55, 0); g.add(side); }
  const roof = part(new THREE.BoxGeometry(2.9, 0.12, 2.2), 0x6b8a3a, { outline: 0.012 });
  roof.position.set(0, 1.2, 0);
  roof.rotation.x = 0.12;
  g.add(roof);
  group.add(g);
  addBox(x, z, 2.8, 2);
}

/** The welcome arch into Lakash's wing: log posts, a carved beam, capybara silhouettes. */
function buildArch(group, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI / 2;
  for (const sx of [-2.6, 2.6]) {
    const post = part(new THREE.CylinderGeometry(0.28, 0.32, 4.6, 10), 0x8a5a32, { outline: 0.02 });
    post.position.set(sx, 2.3, 0);
    g.add(post);
    addCircle(x, z + sx, 0.4);
  }
  const beam = part(new THREE.BoxGeometry(6.4, 1.1, 0.35), 0xa8743f, { outline: 0.02 });
  beam.position.y = 4.6;
  g.add(beam);
  const tex = canvasTexture(1024, 176, (c, w, h) => {
    c.fillStyle = '#a8743f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffe9b3'; c.font = `700 64px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('CAPYBARA LAGOON', w / 2, h * 0.38);
    c.font = `600 38px ${FONT}`; c.fillText('& friends · zookeeper Lakash', w / 2, h * 0.78);
  });
  for (const side of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.05), new THREE.MeshBasicMaterial({ map: tex }));
    face.position.set(0, 4.6, side * 0.18);
    if (side < 0) face.rotation.y = Math.PI;
    g.add(face);
  }
  // a little capybara statue sitting on top of the beam
  const statue = makeCapybara({ mandarin: true });
  statue.root.scale.setScalar(1.4);
  statue.root.position.set(0, 5.15, 0);
  statue.root.rotation.y = Math.PI / 2;
  g.add(statue.root);
  group.add(g);
}

/** Capy Café: a little kiosk selling "capy-cinos". */
function capyCafe() {
  const g = new THREE.Group();
  const box = part(new THREE.BoxGeometry(2.6, 2.1, 2.2), 0x8fd060, { outline: 0.025 });
  box.position.y = 1.05;
  g.add(box);
  const roof = part(new THREE.ConeGeometry(2.2, 1.1, 4), 0xa36c42, { outline: 0.025 });
  roof.position.y = 2.65;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.6), new THREE.MeshBasicMaterial({ map: signTexture(['CAPY CAFÉ'], { w: 512, h: 128, size: 76, bg: '#fff3d6', fg: '#7a4f2e' }) }));
  label.position.set(0, 1.75, 1.11);
  g.add(label);
  const cup = part(new THREE.CylinderGeometry(0.32, 0.24, 0.6, 12), 0xffffff, { outline: 0.02 });
  cup.position.y = 3.5;
  g.add(cup);
  const foam = part(new THREE.SphereGeometry(0.3, 12, 8), 0xe8c39a, { outline: 0.01 });
  foam.scale.y = 0.4;
  foam.position.y = 3.82;
  g.add(foam);
  return g;
}

/** The feed shed: a small barn, open at the front, full of hay and buckets. */
function feedShed() {
  const g = new THREE.Group();
  const red = 0xb0402e;
  const back = part(new THREE.BoxGeometry(6.5, 2.8, 0.2), red, { outline: 0.02 });
  back.position.set(0, 1.4, -2.1);
  g.add(back);
  for (const sx of [-3.15, 3.15]) { const side = part(new THREE.BoxGeometry(0.2, 2.8, 4.4), red, { outline: 0.02 }); side.position.set(sx, 1.4, 0); g.add(side); }
  for (const s of [-1, 1]) {
    const roof = part(new THREE.BoxGeometry(7, 0.15, 2.7), 0x5a3a28, { outline: 0.02 });
    roof.position.set(0, 3.2, s * 1.15);
    roof.rotation.x = s * 0.45;
    g.add(roof);
  }
  const tex = canvasTexture(512, 128, (c, w, h) => { c.fillStyle = '#fff3d6'; c.fillRect(0, 0, w, h); c.fillStyle = '#7a2a1a'; c.font = `700 60px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('FEED STORE', w / 2, h / 2 + 4); });
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: tex }));
  lbl.position.set(0, 3, 2.25);
  g.add(lbl);
  // hay bales, sacks, buckets and a wheelbarrow
  for (const [x, y, z] of [[-2.2, 0.35, -1.2], [-1.0, 0.35, -1.2], [-1.6, 1.05, -1.2], [2.2, 0.35, -1.3]]) {
    const bale = part(new THREE.BoxGeometry(1.1, 0.7, 0.8), 0xe6c55a, { outline: 0.012 });
    bale.position.set(x, y, z);
    g.add(bale);
  }
  for (const [x, z] of [[0.6, -1.4], [1.1, -1.0]]) {
    const sack = part(new THREE.CapsuleGeometry(0.28, 0.4, 4, 8), 0xd9c9a0, { outline: 0.01 });
    sack.position.set(x, 0.5, z);
    g.add(sack);
  }
  for (const [x, z, col] of [[2.4, 1.2, 0x2f7fc1], [2.0, 1.6, 0xe0323a], [-2.5, 1.4, 0x4cc35a]]) {
    const b = part(new THREE.CylinderGeometry(0.22, 0.17, 0.35, 10), col, { outline: 0.01 });
    b.position.set(x, 0.17, z);
    g.add(b);
  }
  const barrow = new THREE.Group();
  const tray = part(new THREE.BoxGeometry(0.8, 0.35, 1.1), 0x4cc35a, { outline: 0.01 });
  tray.position.y = 0.55;
  barrow.add(tray);
  const wheel = part(new THREE.TorusGeometry(0.2, 0.06, 6, 12), 0x1b1b1b, { outline: 0 });
  wheel.rotation.y = Math.PI / 2;
  wheel.position.set(0, 0.25, 0.6);
  barrow.add(wheel);
  for (const sx of [-0.3, 0.3]) { const h = part(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), 0x7a5230, { outline: 0 }); h.rotation.x = Math.PI / 2 - 0.25; h.position.set(sx, 0.6, -0.6); barrow.add(h); }
  barrow.position.set(-0.4, 0, 2.6);
  barrow.rotation.y = 0.5;
  g.add(barrow);
  return g;
}

/** Lakash's log cottage at the back of the zoo: a porch with a bench, a chimney, a cat garden. */
function cottage() {
  const g = new THREE.Group();
  const W = 8, D = 6;
  const logTex = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#a8743f'; c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) { c.fillStyle = '#8a5a32'; c.fillRect(0, y + 26, 256, 6); c.fillStyle = '#b8844f'; c.fillRect(0, y + 4, 256, 4); }
  });
  logTex.wrapS = logTex.wrapT = THREE.RepeatWrapping;
  logTex.repeat.set(2, 1);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(W, 3, D), toon(0xffffff, { map: logTex }));
  walls.position.set(0, 1.5, -0.4);
  walls.castShadow = true; walls.receiveShadow = true;
  g.add(walls);
  for (const s of [-1, 1]) {
    const roof = part(new THREE.BoxGeometry(W + 0.8, 0.2, D / 2 + 1.1), 0x4a7a3a, { outline: 0.02 });
    roof.position.set(0, 3.75, -0.4 + s * (D / 4 + 0.15));
    roof.rotation.x = s * 0.55;
    g.add(roof);
  }
  // triangular gable ends under the roof
  const tri = new THREE.Shape();
  tri.moveTo(-D / 2 - 0.05, 0); tri.lineTo(D / 2 + 0.05, 0); tri.lineTo(0, 1.6); tri.closePath();
  for (const sx of [-1, 1]) {
    const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.2, bevelEnabled: false }), toon(0xffffff, { map: logTex }));
    gable.rotation.y = Math.PI / 2;
    gable.position.set(sx * (W / 2 - 0.1) - 0.1, 3, -0.4);
    gable.castShadow = true;
    g.add(gable);
  }
  const chimney = part(new THREE.BoxGeometry(0.8, 1.8, 0.8), 0x8a8a90, { outline: 0.015 });
  chimney.position.set(2.4, 4.3, -1.4);
  g.add(chimney);
  const door = part(new THREE.BoxGeometry(1.2, 2.1, 0.1), 0x6b3f22, { outline: 0.012 });
  door.position.set(-1.2, 1.05, D / 2 - 0.35);
  g.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), toon(0xffd23f));
  knob.position.set(-0.75, 1.05, D / 2 - 0.28);
  g.add(knob);
  for (const x of [1.4, 3]) {
    const win = part(new THREE.BoxGeometry(1.1, 0.9, 0.1), 0xbfe6ff, { outline: 0.012 });
    win.position.set(x, 1.7, D / 2 - 0.35);
    g.add(win);
    const box = part(new THREE.BoxGeometry(1.2, 0.25, 0.3), 0x7a4a26, { outline: 0.01 });
    box.position.set(x, 1.15, D / 2 - 0.2);
    g.add(box);
    for (let k = 0; k < 3; k++) { const f = part(new THREE.SphereGeometry(0.1, 6, 5), [0xff6f91, 0xffd23f, 0xff8a3d][k], { outline: 0 }); f.position.set(x - 0.35 + k * 0.35, 1.32, D / 2 - 0.2); g.add(f); }
  }
  // the porch: deck, a bench, a little sign
  const deck = part(new THREE.BoxGeometry(W, 0.2, 2), 0xb07e4a, { outline: 0.012, receive: true });
  deck.position.set(0, 0.1, D / 2 + 0.5);
  g.add(deck);
  const bench = part(new THREE.BoxGeometry(1.8, 0.12, 0.6), 0x7a4a26, { outline: 0.01 });
  bench.position.set(1.8, 0.62, D / 2 + 0.1);
  g.add(bench);
  for (const sx of [-0.8, 0.8]) { const l = part(new THREE.BoxGeometry(0.1, 0.5, 0.5), 0x5a3a20, { outline: 0 }); l.position.set(1.8 + sx, 0.37, D / 2 + 0.1); g.add(l); }
  const nameTex = canvasTexture(512, 128, (c, w, h) => { c.fillStyle = '#7a4a26'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffe9b3'; c.font = `700 56px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('LAKASH · ZOOKEEPER', w / 2, h / 2 + 3); });
  const nameplate = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: nameTex }));
  nameplate.position.set(-1.2, 2.55, D / 2 - 0.33);
  g.add(nameplate);
  // the cat garden: cat beds, food bowls, a scratching post
  const catSpots = [];
  for (const [x, z, col] of [[-3.2, 4.6, 0xe0323a], [-2.2, 5.1, 0x2f7fc1], [3.4, 4.8, 0x9a3fb0]]) {
    const bed = part(new THREE.TorusGeometry(0.32, 0.12, 6, 14), col, { outline: 0.01 });
    bed.rotation.x = Math.PI / 2;
    bed.position.set(x, 0.12, z);
    g.add(bed);
    catSpots.push(new THREE.Vector3(x, 0, z));
  }
  for (const [x, z] of [[-0.6, 4.8], [-0.2, 4.9], [0.2, 4.8]]) {
    const bowl = part(new THREE.CylinderGeometry(0.16, 0.12, 0.1, 10), 0xffffff, { outline: 0.006 });
    bowl.position.set(x, 0.05, z);
    g.add(bowl);
  }
  const post = part(new THREE.CylinderGeometry(0.14, 0.14, 1.3, 8), 0xd9c9a0, { outline: 0.01 });
  post.position.set(3.9, 0.65, 3.9);
  g.add(post);
  const perch = part(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 12), 0x8a5a32, { outline: 0.01 });
  perch.position.set(3.9, 1.35, 3.9);
  g.add(perch);
  catSpots.push(new THREE.Vector3(-1.5, 0, 5.4), new THREE.Vector3(2.4, 0, 5.4), new THREE.Vector3(0.6, 0, 5.6));
  return { group: g, porch: new THREE.Vector3(1.8, 0, D / 2 + 0.75), door: new THREE.Vector3(-1.2, 0, D / 2 + 0.6), catSpots };
}

/** The aviary: a netted dome on a low wall, perches on posts, a little tree and a bird bath. Returns the perch points. */
function buildAviary(group, x, z, r) {
  const base = part(new THREE.CylinderGeometry(r, r, 0.5, 40, 1, true), 0xb9a07a, { outline: 0.015 });
  base.material.side = THREE.DoubleSide;
  base.position.set(x, 0.25, z);
  group.add(base);
  const net = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2e5a26, wireframe: true, transparent: true, opacity: 0.55 }));
  net.position.set(x, 0.5, z);
  net.scale.y = 0.8;
  group.add(net);
  const top = part(new THREE.SphereGeometry(0.35, 10, 8), 0x2e5a26, { outline: 0.01 });
  top.position.set(x, 0.5 + r * 0.8, z);
  group.add(top);
  group.add(scatter('tree_detailed', [{ x: x - 1.5, z: z - 1.2, rot: 1, scale: 3.4 }], { outline: 0.02 }));
  const bath = part(new THREE.CylinderGeometry(0.6, 0.3, 0.8, 14), 0xc9d3dd, { outline: 0.012 });
  bath.position.set(x + 2, 0.4, z + 1.8);
  group.add(bath);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14), toon(0x5cc8f2));
  water.rotation.x = -Math.PI / 2;
  water.position.set(x + 2, 0.81, z + 1.8);
  group.add(water);
  const perches = [];
  for (const [dx, dz, h] of [[2.2, -2, 2.2], [-2.6, 1.6, 2.6], [0.6, 2.8, 1.8]]) {
    const post = part(new THREE.CylinderGeometry(0.07, 0.08, h, 6), 0x7a5230, { outline: 0.01 });
    post.position.set(x + dx, h / 2, z + dz);
    group.add(post);
    const bar = part(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), 0x9a6a3c, { outline: 0.008 });
    bar.rotation.z = Math.PI / 2;
    bar.position.set(x + dx, h, z + dz);
    group.add(bar);
    perches.push(new THREE.Vector3(x + dx - 0.35, h + 0.03, z + dz), new THREE.Vector3(x + dx + 0.35, h + 0.03, z + dz));
  }
  sign(group, x + r + 1.3, z + 1.8, Math.PI / 2, 'AVIARY');
  addCircle(x, z, r + 0.3);
  return perches;
}

function picnicTable(group, x, z) {
  const top = part(new THREE.BoxGeometry(2.2, 0.1, 1), 0xa8743f, { outline: 0.012 });
  top.position.set(x, 0.85, z);
  group.add(top);
  for (const s of [-1, 1]) {
    const seat = part(new THREE.BoxGeometry(2.2, 0.08, 0.35), 0xa8743f, { outline: 0.01 });
    seat.position.set(x, 0.48, z + s * 0.75);
    group.add(seat);
  }
  const leg = part(new THREE.BoxGeometry(0.15, 0.85, 1.6), 0x7a4a26, { outline: 0 });
  leg.position.set(x, 0.42, z);
  group.add(leg);
  const umb = part(new THREE.ConeGeometry(1.4, 0.55, 10, 1, true), toon(0x8fd060, { side: THREE.DoubleSide }), { outline: 0.015 });
  umb.position.set(x, 2.3, z);
  group.add(umb);
  const pole = part(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 5), 0xdddddd, { outline: 0 });
  pole.position.set(x, 1.6, z);
  group.add(pole);
  addBox(x, z, 2.4, 1.8);
}

function bin(group, x, z) {
  const b = part(new THREE.CylinderGeometry(0.3, 0.26, 0.85, 12), 0x2e7d4f, { outline: 0.012 });
  b.position.set(x, 0.42, z);
  group.add(b);
  const lid = part(new THREE.CylinderGeometry(0.33, 0.33, 0.08, 12), 0x1f5a37, { outline: 0 });
  lid.position.set(x, 0.88, z);
  group.add(lid);
  addCircle(x, z, 0.35);
}

/** Lakash's feeding-times board, chalk on a blackboard. */
function feedingBoard(group, x, z) {
  const tex = canvasTexture(512, 384, (c, w, h) => {
    c.fillStyle = '#7a4a26'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#26382c'; c.fillRect(14, 14, w - 28, h - 28);
    c.fillStyle = '#ffffff'; c.textAlign = 'center';
    c.font = `700 44px ${FONT}`; c.fillText('FEEDING TIMES', w / 2, 70);
    c.font = `500 32px ${FONT}`; c.textAlign = 'left';
    ['Capybaras · all day ♥', 'Tortoises · when they arrive', 'Flamingos · shrimp o’clock', 'Meerkats · ask the sentry', 'Everyone else · on the rounds'].forEach((l, i) => c.fillText(l, 40, 128 + i * 46));
    c.font = `italic 500 28px ${FONT}`; c.textAlign = 'right'; c.fillText('— Lakash', w - 40, h - 30);
  });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.5), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  board.position.y = 1.6;
  g.add(board);
  for (const sx of [-0.85, 0.85]) { const leg = part(new THREE.BoxGeometry(0.1, 2.4, 0.1), 0x7a4a26, { outline: 0.01 }); leg.position.set(sx, 1.2, -0.05); g.add(leg); }
  group.add(g);
  addCircle(x, z, 0.6);
}
