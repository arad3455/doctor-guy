// Zone 6 — Sunset Pier: the seaside funfair at the bottom of Maple Lane, east of the beach. A big Ferris wheel
// with rim lights, a carousel with bobbing horses, a drop tower, stalls and string lights, and a wooden pier out
// over the sea with a lighthouse at the end.
import * as THREE from 'three';
import { part, toon, instanced, canvasTexture, signTexture, FONT } from './toon.js';
import { addBox, addCircle } from './world.js';
import { scatter, kit } from './kit.js';
import { seeded, slab, streetLamps, parkedCars, signBoard } from './cityprops.js';

export const FAIR = {
  x0: 92, x1: 150, z0: 64.5, z1: 113, // the fairground
  park: { x0: 61, x1: 92, z0: 64.5, z1: 77 }, // car park at the bottom of Maple Lane
  gate: { x: 92, z: 71 }, // entrance arch (west side)
  wheel: { x: 136, z: 96, r: 12.5, hub: 15 },
  carousel: { x: 108, z: 92, r: 5.2 },
  drop: { x: 142, z: 72, h: 26 },
  pier: { x0: 118.5, x1: 127.5, z0: 112, z1: 178 },
  lighthouse: { x: 123, z: 172 },
  stalls: [],
  rink: { x0: 98, x1: 115, z0: 100, z1: 111 },
};
const SAND = 0xf2d38a;
export const PIER_SPOTS = {};

/** On the pier deck (you can walk and drive out over the water here). */
export const onPier = (x, z) => x > FAIR.pier.x0 && x < FAIR.pier.x1 && z > FAIR.pier.z0 && z < FAIR.pier.z1;

export function buildPier(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const animated = [];
  const rand = seeded(9090);
  const lampPts = [];

  // ---- sand east of the beach, the car park and the fairground paving
  slab(group, 85, 62, 154, 118, SAND, { y: 0.014 });
  slab(group, 85, 113.5, 154, 116.5, 0xd9b56b, { y: 0.017 });
  const fx = FAIR;
  const brick = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e8b49a'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c98a72'; ctx.lineWidth = 3;
    for (let r = 0; r < 8; r++) {
      const y = r * 32;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      for (let c = 0; c <= 4; c++) { const x = c * 64 + (r % 2 ? 32 : 0); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 32); ctx.stroke(); }
    }
  });
  slab(group, fx.x0, fx.z0, fx.x1, fx.z1, 0xffffff, { y: 0.03, map: brick, repeat: [(fx.x1 - fx.x0) / 5, (fx.z1 - fx.z0) / 5] });
  const pk = fx.park;
  slab(group, pk.x0, pk.z0, pk.x1, pk.z1, 0x5a6068, { y: 0.03 });
  const bays = [];
  for (let x = pk.x0 + 3; x < pk.x1 - 3; x += 3.2) {
    if (Math.abs(x - 84.5) < 5) continue; // the lane in from Maple Lane
    bays.push(x);
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    l.rotation.x = -Math.PI / 2;
    l.position.set(x - 1.6, 0.04, pk.z1 - 3);
    group.add(l);
  }
  parkedCars(group, bays.filter((_, i) => i % 3 !== 1).map((x) => ({ x, z: pk.z1 - 3, rot: 0, name: rand.pick(['sedan', 'suv', 'taxi', 'van', 'hatchback-sports']) })));

  // ---- fence around the fairground (gaps: entrance on the west, the pier on the south)
  const posts = [], rails = [];
  const fenceLine = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (let d = 0; d <= len; d += 2) posts.push(new THREE.Matrix4().compose(new THREE.Vector3(x0 + ((x1 - x0) * d) / len, 0.7, z0 + ((z1 - z0) * d) / len), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    for (const y of [0.55, 1.1]) rails.push(new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, y, (z0 + z1) / 2), new THREE.Quaternion(), new THREE.Vector3(along ? len : 0.1, 0.12, along ? 0.1 : len)));
    addBox((x0 + x1) / 2, (z0 + z1) / 2, Math.max(0.3, Math.abs(x1 - x0)), Math.max(0.3, Math.abs(z1 - z0)));
  };
  fenceLine(fx.x0, fx.z0, fx.x1, fx.z0);
  fenceLine(fx.x1, fx.z0, fx.x1, fx.z1);
  fenceLine(fx.x0, fx.z1, fx.pier.x0, fx.z1);
  fenceLine(fx.pier.x1, fx.z1, fx.x1, fx.z1);
  fenceLine(fx.x0, fx.z0, fx.x0, fx.gate.z - 4.5);
  fenceLine(fx.x0, fx.gate.z + 4.5, fx.x0, fx.z1);
  group.add(instanced(new THREE.BoxGeometry(0.18, 1.4, 0.18), 0xe0453a, posts, { outline: 0.015 }));
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), 0xffffff, rails, { outline: 0 }));

  buildArch(group, fx.gate.x, fx.gate.z);
  buildFerrisWheel(group, animated, lampPts);
  buildCarousel(group, animated);
  buildDropTower(group, animated);
  buildStalls(group, animated);
  buildStringLights(group, lampPts);
  buildPierDeck(group, animated, lampPts);
  buildBumperCars(group, animated);

  // benches + bins around the paths
  const benches = [[100, 76, Math.PI / 2], [120, 106, 0], [128, 80, 0]];
  group.add(scatter('stall-bench', benches.map(([x, z, rot]) => ({ x, z, rot, scale: 3 })), { outline: 0.012 }));
  for (const [x, z] of benches) addCircle(x, z, 0.9);
  // lamps in the car park
  const lamps = [{ x: 70, z: 66, rot: Math.PI }, { x: 86, z: 66, rot: Math.PI }];
  const bulbs = [...streetLamps(group, lamps, { height: 4.8 }), ...lampPts];
  return { group, animated, bulbs };
}

/** The entrance arch: two striped towers and a curved sign "SUNSET PIER". */
function buildArch(group, x, z) {
  const stripes = canvasTexture(64, 256, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#e0453a'; ctx.fillRect(0, i * 32, w, 32); }
  });
  for (const dz of [-4.2, 4.2]) {
    const tower = part(new THREE.CylinderGeometry(0.6, 0.7, 6, 14), 0xffffff, { outline: 0.02, matOpts: { map: stripes } });
    tower.position.set(x, 3, z + dz);
    group.add(tower);
    const cap = part(new THREE.ConeGeometry(0.9, 1.4, 14), 0xffd23f, { outline: 0.02 });
    cap.position.set(x, 6.7, z + dz);
    group.add(cap);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ color: 0x2f7fc1, side: THREE.DoubleSide }));
    flag.position.set(x, 7.7, z + dz + 0.45);
    flag.rotation.y = Math.PI / 2;
    group.add(flag);
    addCircle(x, z + dz, 0.8);
  }
  const sign = canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2b1450'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffd23f'); g.addColorStop(1, '#ff5f8f');
    ctx.fillStyle = g; ctx.font = `700 150px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 14; ctx.strokeStyle = '#1b1b1b'; ctx.strokeText('SUNSET PIER', w / 2, h / 2 + 8); ctx.fillText('SUNSET PIER', w / 2, h / 2 + 8);
    for (let i = 0; i < 26; i++) { ctx.fillStyle = i % 2 ? '#fff3b0' : '#ffd23f'; ctx.beginPath(); ctx.arc(20 + i * 38.5, 14, 7, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(20 + i * 38.5, h - 14, 7, 0, Math.PI * 2); ctx.fill(); }
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 2.2), new THREE.MeshBasicMaterial({ map: sign }));
  board.rotation.y = -Math.PI / 2; // reads from the car park (west)
  board.position.set(x - 0.05, 5.2, z);
  group.add(board);
  const back = part(new THREE.BoxGeometry(0.2, 2.4, 9.6), 0x2b1450, { outline: 0.02 });
  back.position.set(x + 0.12, 5.2, z);
  group.add(back);
}

/** The Ferris wheel: A-frame legs, a turning wheel with spokes, 12 swinging gondolas and glowing rim lights. */
function buildFerrisWheel(group, animated, lampPts) {
  const { x, z, r, hub } = FAIR.wheel;
  const base = new THREE.Group();
  base.position.set(x, 0, z);
  base.rotation.y = Math.PI / 4; // its face looks north-west: up Maple Lane and along the beach
  group.add(base);
  // platform + legs
  const plat = part(new THREE.BoxGeometry(8, 0.5, 5), 0x2f7fc1, { outline: 0.02 });
  plat.position.y = 0.25;
  base.add(plat);
  for (const side of [-1, 1]) for (const lean of [-1, 1]) {
    const leg = part(new THREE.CylinderGeometry(0.25, 0.32, hub / Math.cos(0.32) + 0.5, 8), 0xdfe6ee, { outline: 0.02 });
    leg.position.set(lean * Math.tan(0.32) * hub / 2, hub / 2, side * 1.6);
    leg.rotation.z = -lean * 0.32;
    base.add(leg);
  }
  const axle = part(new THREE.CylinderGeometry(0.35, 0.35, 3.8, 12), 0x9aa3ad, { outline: 0.02 });
  axle.rotation.x = Math.PI / 2;
  axle.position.y = hub;
  base.add(axle);
  // the wheel
  const wheel = new THREE.Group();
  wheel.position.y = hub;
  base.add(wheel);
  for (const side of [-1.1, 1.1]) {
    const rim = part(new THREE.TorusGeometry(r, 0.16, 8, 64), 0xffffff, { outline: 0.02 });
    rim.position.z = side;
    wheel.add(rim);
    const inner = part(new THREE.TorusGeometry(r * 0.55, 0.1, 6, 48), 0xff5f8f, { outline: 0.015 });
    inner.position.z = side;
    wheel.add(inner);
  }
  const N = 12;
  for (let i = 0; i < N * 2; i++) {
    const a = (i / (N * 2)) * Math.PI * 2;
    const spoke = part(new THREE.CylinderGeometry(0.06, 0.06, r, 5), 0xffffff, { outline: 0 });
    spoke.position.set(Math.cos(a) * r / 2, Math.sin(a) * r / 2, i % 2 ? 1.1 : -1.1);
    spoke.rotation.z = a - Math.PI / 2;
    wheel.add(spoke);
  }
  // rim lights (they share the street-lamp material, so they glow at night)
  const bulbMat = toon(0xfff3b0, { emissive: 0x6a5a20 });
  const lightGeo = new THREE.SphereGeometry(0.16, 6, 4);
  const lights = new THREE.InstancedMesh(lightGeo, bulbMat, 96);
  for (let i = 0; i < 96; i++) {
    const a = (i / 48) * Math.PI * 2, side = i < 48 ? -1.25 : 1.25;
    lights.setMatrixAt(i, new THREE.Matrix4().makeTranslation(Math.cos(a) * r, Math.sin(a) * r, side));
  }
  wheel.add(lights);
  const hubLight = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), bulbMat);
  wheel.add(hubLight);
  lampPts.push({ x, y: hub, z, size: 6, parent: null });
  // gondolas hang from the rim and stay level
  const colors = [0xe0453a, 0xffd23f, 0x2f7fc1, 0x4cc35a, 0xff8ac0, 0xb27bff];
  const gondolas = [];
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group();
    const cab = part(new THREE.CylinderGeometry(0.9, 0.8, 1.3, 10), colors[i % colors.length], { outline: 0.02 });
    cab.position.y = -1.5;
    g.add(cab);
    const roof = part(new THREE.ConeGeometry(1.05, 0.6, 10), 0xffffff, { outline: 0.015 });
    roof.position.y = -0.5;
    g.add(roof);
    const rod = part(new THREE.CylinderGeometry(0.05, 0.05, 1, 5), 0x9aa3ad, { outline: 0 });
    rod.position.y = -0.3;
    g.add(rod);
    wheel.add(g);
    gondolas.push(g);
  }
  addCircle(x, z, 4.2);
  FAIR.wheel.board = { x: x - 4.8, z: z - 4.8 }; // the boarding steps (north-west of the platform)
  animated.push({ update: (t) => {
    const spin = t * 0.09;
    wheel.rotation.z = spin;
    gondolas.forEach((g, i) => {
      const a = (i / N) * Math.PI * 2;
      g.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      g.rotation.z = -spin + Math.sin(t * 1.3 + i) * 0.04; // stay level, with a little sway
    });
  } });
  FAIR.wheel.gondolas = gondolas;
}

/** A carousel: turning platform, striped canopy, horses on poles bobbing up and down. */
function buildCarousel(group, animated) {
  const { x, z, r } = FAIR.carousel;
  const base = part(new THREE.CylinderGeometry(r + 0.4, r + 0.6, 0.5, 32), 0xb27bff, { outline: 0.02 });
  base.position.set(x, 0.25, z);
  group.add(base);
  const spin = new THREE.Group();
  spin.position.set(x, 0.5, z);
  group.add(spin);
  const floor = part(new THREE.CylinderGeometry(r, r, 0.15, 32), 0xffe3ef, { outline: 0.015 });
  floor.position.y = 0.08;
  spin.add(floor);
  const centre = part(new THREE.CylinderGeometry(1.1, 1.1, 3.6, 16), 0xffd23f, { outline: 0.02 });
  centre.position.y = 1.9;
  spin.add(centre);
  const stripes = canvasTexture(512, 64, (ctx, w, h) => { for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#e0453a'; ctx.fillRect(i * 32, 0, 32, h); } });
  const canopy = part(new THREE.ConeGeometry(r + 0.8, 2.4, 32, 1), 0xffffff, { outline: 0.03, matOpts: { map: stripes } });
  canopy.position.y = 4.9;
  spin.add(canopy);
  const valance = part(new THREE.CylinderGeometry(r + 0.8, r + 0.8, 0.6, 32, 1, true), 0xffd23f, { outline: 0.015 });
  valance.position.y = 3.5;
  valance.material.side = THREE.DoubleSide;
  spin.add(valance);
  const flag = part(new THREE.ConeGeometry(0.18, 0.8, 8), 0x2f7fc1, { outline: 0.01 });
  flag.position.y = 6.5;
  spin.add(flag);
  const horses = [];
  const hc = [0xffffff, 0xf2d38a, 0x9a6440, 0xffffff, 0x2b2f38, 0xf2d38a];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pole = part(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 6), 0xffd23f, { outline: 0 });
    pole.position.set(Math.cos(a) * (r - 1.2), 1.8, Math.sin(a) * (r - 1.2));
    spin.add(pole);
    const horse = makeHorse(hc[i]);
    horse.position.set(Math.cos(a) * (r - 1.2), 1.1, Math.sin(a) * (r - 1.2));
    horse.rotation.y = -a; // facing along the turn
    spin.add(horse);
    horses.push(horse);
  }
  addCircle(x, z, r + 0.7);
  FAIR.carousel.horses = horses;
  FAIR.carousel.spin = spin;
  animated.push({ update: (t) => {
    spin.rotation.y = t * 0.45;
    horses.forEach((h, i) => { h.position.y = 1.1 + Math.sin(t * 2.4 + i * 1.1) * 0.35; });
  } });
}

function makeHorse(color) {
  const g = new THREE.Group();
  const body = part(new THREE.CapsuleGeometry(0.32, 0.9, 4, 10), color, { outline: 0.02 });
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const neck = part(new THREE.CylinderGeometry(0.16, 0.22, 0.7, 8), color, { outline: 0.015 });
  neck.position.set(0, 0.35, 0.55);
  neck.rotation.x = 0.6;
  g.add(neck);
  const head = part(new THREE.BoxGeometry(0.26, 0.28, 0.55), color, { outline: 0.015 });
  head.position.set(0, 0.62, 0.82);
  head.rotation.x = 0.3;
  g.add(head);
  const mane = part(new THREE.BoxGeometry(0.08, 0.3, 0.6), 0xe0453a, { outline: 0 });
  mane.position.set(0, 0.55, 0.45);
  mane.rotation.x = 0.6;
  g.add(mane);
  const saddle = part(new THREE.BoxGeometry(0.5, 0.12, 0.45), 0x2f7fc1, { outline: 0.01 });
  saddle.position.y = 0.33;
  g.add(saddle);
  for (const [lx, lz] of [[-0.18, 0.4], [0.18, 0.4], [-0.18, -0.4], [0.18, -0.4]]) {
    const leg = part(new THREE.CylinderGeometry(0.06, 0.05, 0.6, 6), color, { outline: 0.01 });
    leg.position.set(lx, -0.45, lz);
    leg.rotation.x = lz > 0 ? -0.5 : 0.5;
    g.add(leg);
  }
  return g;
}

/** A drop tower: a tall striped mast with a ring of seats that climbs slowly and drops. */
function buildDropTower(group, animated) {
  const { x, z, h } = FAIR.drop;
  const stripes = canvasTexture(64, 512, (ctx, w, hh) => { for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#2f7fc1'; ctx.fillRect(0, i * 32, w, 32); } });
  const mast = part(new THREE.CylinderGeometry(0.8, 1, h, 16), 0xffffff, { outline: 0.03, matOpts: { map: stripes } });
  mast.position.set(x, h / 2, z);
  group.add(mast);
  const top = part(new THREE.CylinderGeometry(1.6, 1.2, 1.2, 16), 0xe0453a, { outline: 0.02 });
  top.position.set(x, h + 0.6, z);
  group.add(top);
  const star = part(new THREE.OctahedronGeometry(0.9), 0xffd23f, { outline: 0.02 });
  star.position.set(x, h + 2, z);
  group.add(star);
  const ring = new THREE.Group();
  ring.position.set(x, 2, z);
  group.add(ring);
  const collar = part(new THREE.TorusGeometry(1.6, 0.3, 8, 24), 0xffd23f, { outline: 0.02 });
  collar.rotation.x = Math.PI / 2;
  ring.add(collar);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const seat = part(new THREE.BoxGeometry(0.7, 0.9, 0.5), [0xe0453a, 0x2f7fc1][i % 2], { outline: 0.015 });
    seat.position.set(Math.cos(a) * 2, -0.2, Math.sin(a) * 2);
    seat.rotation.y = -a + Math.PI / 2;
    ring.add(seat);
  }
  const base = part(new THREE.CylinderGeometry(3, 3.2, 0.5, 24), 0x9aa3ad, { outline: 0.02 });
  base.position.set(x, 0.25, z);
  group.add(base);
  addCircle(x, z, 3.2);
  animated.push({ update: (t) => {
    // 14 s cycle: slow climb, pause at the top, whoosh down, bounce
    const c = t % 14;
    let y;
    if (c < 8) y = 2 + (c / 8) * (h - 4);
    else if (c < 10) y = h - 2;
    else if (c < 10.8) { const k = (c - 10) / 0.8; y = h - 2 - k * k * (h - 4); }
    else y = 2 + Math.abs(Math.sin((c - 10.8) * 5)) * Math.max(0, 1.4 - (c - 10.8) * 0.5);
    ring.position.y = y;
    star.rotation.y = t;
  } });
}

/** Stalls along the north side: cotton candy, popcorn, ring toss, hot dogs; a balloon seller. */
function buildStalls(group, animated) {
  const list = [
    { x: 104, label: 'COTTON CANDY', kind: 'stall-red', bg: '#ff8ac0' },
    { x: 113, label: 'POPCORN', kind: 'stall-green', bg: '#ffd23f' },
    { x: 122, label: 'RING TOSS', kind: 'stall', bg: '#2f7fc1' },
    { x: 131, label: 'HOT DOGS', kind: 'stall-red', bg: '#e0453a' },
  ];
  const z = FAIR.z0 + 3.2;
  for (const s of list) {
    const st = kit(s.kind, { scale: 2.8, outline: 0.015 });
    st.position.set(s.x, 0, z);
    group.add(st);
    addBox(s.x, z, 4.2, 3);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.9), new THREE.MeshBasicMaterial({ map: signTexture([s.label], { w: 512, h: 112, size: 64, bg: s.bg, fg: '#ffffff' }) }));
    sign.position.set(s.x, 4.1, z + 1.6);
    group.add(sign);
    FAIR.stalls.push({ x: s.x, z, label: s.label });
  }
  // cotton candy clouds on sticks in the first stall
  for (let i = 0; i < 4; i++) {
    const c = part(new THREE.IcosahedronGeometry(0.28, 1), [0xff8ac0, 0x9ddcff][i % 2], { outline: 0.01 });
    c.position.set(102.8 + i * 0.8, 1.9, z + 1.2);
    group.add(c);
  }
  // the balloon seller's bunch
  const bx = 116, bz = 80;
  const bunch = new THREE.Group();
  bunch.position.set(bx, 0, bz);
  group.add(bunch);
  const cols = [0xe0453a, 0xffd23f, 0x2f7fc1, 0x4cc35a, 0xff8ac0, 0xb27bff, 0xff7a3a];
  const balloons = [];
  for (let i = 0; i < 7; i++) {
    const b = part(new THREE.SphereGeometry(0.42, 12, 10), cols[i], { outline: 0.015 });
    b.scale.y = 1.2;
    const a = (i / 7) * Math.PI * 2;
    b.position.set(Math.cos(a) * 0.6, 3.6 + (i % 3) * 0.4, Math.sin(a) * 0.6);
    bunch.add(b);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, b.position.y - 1.3, 3), toon(0xffffff));
    str.position.set(b.position.x / 2, (b.position.y + 1.3) / 2, b.position.z / 2);
    bunch.add(str);
    balloons.push(b);
  }
  const cart = part(new THREE.BoxGeometry(1.4, 1, 0.9), 0xffffff, { outline: 0.015 });
  cart.position.y = 0.8;
  bunch.add(cart);
  addCircle(bx, bz, 0.9);
  PIER_SPOTS.balloons = { x: bx, z: bz };
  animated.push({ update: (t) => balloons.forEach((b, i) => { b.position.x = Math.cos((i / 7) * Math.PI * 2) * 0.6 + Math.sin(t * 1.3 + i) * 0.08; }) });
}

/** Strings of coloured bulbs between tall poles across the fairground (the bulbs glow at night). */
function buildStringLights(group, lampPts) {
  const poles = [[96, 68], [96, 110], [118, 68], [118, 110], [148, 110], [148, 84], [100, 89], [128, 108]];
  const pm = poles.map(([x, z]) => new THREE.Matrix4().compose(new THREE.Vector3(x, 3.5, z), new THREE.Quaternion(), new THREE.Vector3(1, 7, 1)));
  group.add(instanced(new THREE.CylinderGeometry(0.1, 0.12, 1, 6), 0x2b2f38, pm, { outline: 0.015 }));
  for (const [x, z] of poles) addCircle(x, z, 0.25);
  const links = [[0, 2], [2, 3], [1, 3], [0, 6], [6, 1], [3, 7], [7, 4], [4, 5], [6, 3], [0, 3]];
  const bulbs = [], cols = [];
  const palette = [0xff5f8f, 0xffd23f, 0x5cc8f2, 0x8ae86a, 0xffffff];
  const lineMat = new THREE.LineBasicMaterial({ color: 0x2b2f38 });
  for (const [a, b] of links) {
    const A = new THREE.Vector3(poles[a][0], 6.9, poles[a][1]), B = new THREE.Vector3(poles[b][0], 6.9, poles[b][1]);
    const mid = A.clone().lerp(B, 0.5); mid.y -= 1.2;
    const curve = new THREE.QuadraticBezierCurve3(A, mid, B);
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(16)), lineMat));
    const n = Math.round(A.distanceTo(B) / 1.6);
    for (let i = 1; i < n; i++) {
      const p = curve.getPoint(i / n);
      bulbs.push(new THREE.Matrix4().makeTranslation(p.x, p.y - 0.15, p.z));
      cols.push(palette[(i + a) % palette.length]);
    }
  }
  // coloured bulbs: emissive so they read as lights by day and glow at night
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 6, 4), mat, bulbs.length);
  bulbs.forEach((m, i) => { inst.setMatrixAt(i, m); inst.setColorAt(i, new THREE.Color(cols[i])); });
  group.add(inst);
  FAIR.lightPoles = poles;
}

/** The pier: planks on pilings out over the sea, railings, lamps, fishing spots and a lighthouse. */
function buildPierDeck(group, animated, lampPts) {
  const { x0, x1, z0, z1 } = FAIR.pier;
  const planks = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b07a45'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#a06c3a' : '#b8834c'; ctx.fillRect(0, i * 32, w, 30); ctx.fillStyle = '#7a4a26'; ctx.fillRect(0, i * 32 + 30, w, 2); }
  });
  slab(group, x0, z0, x1, z1, 0xffffff, { y: 0.12, map: planks, repeat: [1, (z1 - z0) / 4] });
  const edge = part(new THREE.BoxGeometry(x1 - x0 + 0.4, 0.5, z1 - z0), 0x7a4a26, { outline: 0.02 });
  edge.position.set((x0 + x1) / 2, -0.15, (z0 + z1) / 2);
  group.add(edge);
  // pilings
  const piles = [];
  for (let z = z0 + 6; z < z1; z += 6) for (const x of [x0 + 0.3, x1 - 0.3]) piles.push(new THREE.Matrix4().compose(new THREE.Vector3(x, -1, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
  group.add(instanced(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 8), 0x5e381c, piles, { outline: 0.02 }));
  // railings (posts + top rail), gap at the land end
  const posts = [];
  for (let z = z0 + 3; z <= z1; z += 1.5) for (const x of [x0 + 0.15, x1 - 0.15]) posts.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.7, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
  for (let x = x0 + 0.15; x <= x1; x += 1.5) posts.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.7, z1 - 0.15), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
  group.add(instanced(new THREE.BoxGeometry(0.12, 1.2, 0.12), 0xffffff, posts, { outline: 0.015 }));
  for (const x of [x0 + 0.15, x1 - 0.15]) {
    const rail = part(new THREE.BoxGeometry(0.14, 0.12, z1 - z0 - 3), 0xffffff, { outline: 0.015 });
    rail.position.set(x, 1.3, (z0 + 3 + z1) / 2);
    group.add(rail);
  }
  const endRail = part(new THREE.BoxGeometry(x1 - x0, 0.12, 0.14), 0xffffff, { outline: 0.015 });
  endRail.position.set((x0 + x1) / 2, 1.3, z1 - 0.15);
  group.add(endRail);
  // lamps down both sides
  const lamps = [];
  for (let z = z0 + 10; z < z1 - 8; z += 14) lamps.push({ x: x0 + 0.5, z, rot: Math.PI / 2 }, { x: x1 - 0.5, z: z + 7, rot: -Math.PI / 2 });
  lampPts.push(...streetLamps(group, lamps, { height: 4.2 }));
  // lighthouse at the end
  const { x, z } = FAIR.lighthouse;
  const stripes = canvasTexture(64, 256, (ctx, w, h) => { for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#e0453a'; ctx.fillRect(0, i * 43, w, 43); } });
  const tower = part(new THREE.CylinderGeometry(1.5, 2.1, 11, 20), 0xffffff, { outline: 0.03, matOpts: { map: stripes } });
  tower.position.set(x, 5.6, z);
  group.add(tower);
  const deck = part(new THREE.CylinderGeometry(2.1, 2.1, 0.3, 20), 0x2b2f38, { outline: 0.02 });
  deck.position.set(x, 11.2, z);
  group.add(deck);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 12), toon(0xfff3b0, { emissive: 0x6a5a20 }));
  lantern.position.set(x, 12.2, z);
  group.add(lantern);
  const cap = part(new THREE.ConeGeometry(1.5, 1.4, 16), 0xe0453a, { outline: 0.02 });
  cap.position.set(x, 13.7, z);
  group.add(cap);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.8), toon(0x2f7fc1));
  door.position.set(x, 1.05, z - 1.92);
  door.rotation.y = Math.PI;
  door.rotation.x = -0.12;
  group.add(door);
  addCircle(x, z, 2.2);
  lampPts.push({ x, y: 12.2, z, size: 7 });
  // a sweeping beam (visible at dusk and night)
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.5, 26, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }));
  beam.geometry.translate(0, -13, 0);
  beam.rotation.z = Math.PI / 2;
  const pivot = new THREE.Group();
  pivot.position.set(x, 12.2, z);
  pivot.add(beam);
  group.add(pivot);
  FAIR.beam = beam;
  animated.push({ update: (t) => { pivot.rotation.y = t * 0.8; } });
  PIER_SPOTS.fishing = { x: x0 + 1.6, z: z1 - 18 };
  PIER_SPOTS.pierEnd = { x: (x0 + x1) / 2, z: z1 - 10 };
}

/** Bumper cars: a fenced rink with five little cars bouncing off the walls and each other. */
function buildBumperCars(group, animated) {
  const { x0, x1, z0, z1 } = FAIR.rink;
  const floor = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3b4250'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { ctx.fillStyle = ['#ffd23f', '#ff5f8f', '#5cc8f2'][i % 3]; ctx.fillRect((i * 97) % w, (i * 53) % h, 3, 3); }
  });
  slab(group, x0, z0, x1, z1, 0xffffff, { y: 0.05, map: floor, repeat: [3, 2] });
  // padded wall in hazard stripes
  const stripes = canvasTexture(256, 32, (ctx, w, h) => { for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? '#1b1b1b' : '#ffd23f'; ctx.beginPath(); ctx.moveTo(i * 16, 0); ctx.lineTo(i * 16 + 16, 0); ctx.lineTo(i * 16 + 8, h); ctx.lineTo(i * 16 - 8, h); ctx.fill(); } });
  stripes.wrapS = THREE.RepeatWrapping;
  const wallMat = new THREE.MeshToonMaterial({ map: stripes });
  for (const [cx, cz, w, d] of [[(x0 + x1) / 2, z0, x1 - x0, 0.4], [(x0 + x1) / 2, z1, x1 - x0, 0.4], [x0, (z0 + z1) / 2, 0.4, z1 - z0], [x1, (z0 + z1) / 2, 0.4, z1 - z0]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), wallMat.clone());
    m.material.map = stripes.clone(); m.material.map.repeat.set(Math.max(w, d) / 2, 1); m.material.map.needsUpdate = true;
    m.position.set(cx, 0.35, cz);
    m.castShadow = true;
    group.add(m);
  }
  addBox((x0 + x1) / 2, z0, x1 - x0, 0.5); addBox((x0 + x1) / 2, z1, x1 - x0, 0.5);
  addBox(x0, (z0 + z1) / 2, 0.5, z1 - z0); addBox(x1, (z0 + z1) / 2, 0.5, z1 - z0);
  // the electric ceiling on four posts
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    const post = part(new THREE.CylinderGeometry(0.12, 0.12, 4.2, 8), 0xe0453a, { outline: 0.015 });
    post.position.set(px, 2.1, pz);
    group.add(post);
  }
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0, 8, 5), new THREE.MeshBasicMaterial({ color: 0x9aa3ad, wireframe: true }));
  grid.rotation.x = -Math.PI / 2;
  grid.position.set((x0 + x1) / 2, 4.15, (z0 + z1) / 2);
  group.add(grid);
  const sign = signBoard(new THREE.PlaneGeometry(5, 1), signTexture(['BUMPER CARS'], { w: 512, h: 100, size: 66, bg: '#2b1450', fg: '#ffd23f' }));
  sign.position.set((x0 + x1) / 2, 4.8, z0);
  group.add(sign);
  // the cars
  const cols = [0xe0453a, 0x2f7fc1, 0xffd23f, 0x4cc35a, 0xff8ac0];
  const cars = cols.map((c, i) => {
    const g = new THREE.Group();
    const body = part(new THREE.BoxGeometry(1.3, 0.5, 1.9), c, { outline: 0.02 });
    body.position.y = 0.45;
    g.add(body);
    const seatBack = part(new THREE.BoxGeometry(1.1, 0.6, 0.25), c, { outline: 0.015 });
    seatBack.position.set(0, 0.85, -0.6);
    g.add(seatBack);
    const bumper = part(new THREE.TorusGeometry(1.05, 0.14, 6, 20), 0x1b1b1b, { outline: 0 });
    bumper.rotation.x = Math.PI / 2;
    bumper.scale.set(0.75, 1, 1);
    bumper.position.y = 0.32;
    g.add(bumper);
    const wheel = part(new THREE.TorusGeometry(0.22, 0.04, 6, 14), 0x2b2f38, { outline: 0 });
    wheel.position.set(0, 0.95, 0.4);
    wheel.rotation.x = -0.9;
    g.add(wheel);
    const pole = part(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 5), 0x9aa3ad, { outline: 0 });
    pole.position.set(0, 2.2, -0.8);
    g.add(pole);
    const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
    spark.position.set(0, 3.85, -0.8);
    g.add(spark);
    g.position.set(x0 + 2.5 + i * 3, 0, (z0 + z1) / 2 + (i % 2 ? 2 : -2));
    group.add(g);
    return { g, spark, vx: Math.cos(i * 1.7) * 3, vz: Math.sin(i * 1.7) * 3 };
  });
  FAIR.rink.cars = cars;
  animated.push({ update: (t, dt) => {
    for (const c of cars) {
      const p = c.g.position;
      p.x += c.vx * dt; p.z += c.vz * dt;
      if (p.x < x0 + 1.2 || p.x > x1 - 1.2) { c.vx *= -1; p.x = THREE.MathUtils.clamp(p.x, x0 + 1.2, x1 - 1.2); }
      if (p.z < z0 + 1.2 || p.z > z1 - 1.2) { c.vz *= -1; p.z = THREE.MathUtils.clamp(p.z, z0 + 1.2, z1 - 1.2); }
      for (const o of cars) {
        if (o === c) continue;
        const dx = p.x - o.g.position.x, dz = p.z - o.g.position.z, d = Math.hypot(dx, dz);
        if (d < 1.9 && d > 0.01) { // bonk!
          const nx = dx / d, nz = dz / d, rel = (c.vx - o.vx) * nx + (c.vz - o.vz) * nz;
          if (rel < 0) { c.vx -= rel * nx; c.vz -= rel * nz; o.vx += rel * nx; o.vz += rel * nz; }
        }
      }
      const sp = Math.hypot(c.vx, c.vz);
      if (sp < 2.2) { c.vx *= 1.02; c.vz *= 1.02; } // they never stop
      c.g.rotation.y = Math.atan2(c.vx, c.vz);
      c.spark.visible = Math.sin(t * 40 + p.x) > 0.6;
    }
  } });
}
