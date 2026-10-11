// Zone 10 — Wolfson Airport, north of Downtown (Airport Road carries the avenue on from Downtown's north street).
// A runway with edge lights and markings, the taxiway and apron, a glass terminal with jet bridges and parked jets,
// a control tower, two hangars, a windsock, an airstairs truck — and a jet that takes off and comes back in to land.
import * as THREE from 'three';
import { part, toon, instanced, canvasTexture, signTexture, FONT } from './toon.js';
import { addBox, addCircle } from './world.js';
import { buildStreets, street, gx, gz } from './streets.js';
import { seeded, slab, streetLamps, signBoard, addCameraBlocker, bakeStatic, parkedCars } from './cityprops.js';

const ROAD_I = -13; // Airport Road continues Downtown's avenue at x = -111.5
export const AIRPORT = {
  x0: -199, x1: -16, z0: -224, z1: -92,
  roadX: gx(ROAD_I), roadJ: [-7, -8], // z = -86 … -93
  forecourt: { x0: -160, x1: -66, z0: -108, z1: -96.5 },
  terminal: { x0: -158, x1: -82, z0: -128, z1: -110 },
  apron: { x0: -175, x1: -20, z0: -150, z1: -128 },
  taxiZ: -160, runwayZ: -192, runwayW: 18, runway: { x0: -196, x1: -22 },
  tower: { x: -182, z: -118, h: 26 },
  hangars: [{ x: -58, z: -118 }, { x: -32, z: -118 }],
  gates: [-146, -120, -94],
  stairs: { x: -172, z: -140 },
};
export const AIR_SPOTS = {};
export const AIR_MAP = { streets: [], planes: [] };

export function buildAirport(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const animated = [];
  const blockers = [];
  const lampPts = [];
  const A = AIRPORT;

  // ---- ground: grass airfield, the apron and taxiway concrete, the runway asphalt with markings
  slab(group, A.x0, A.z0, A.x1, A.z1, 0x7ccf55, { y: 0.009 });
  const concrete = 0xc9ced4;
  slab(group, A.forecourt.x0, A.forecourt.z0, A.forecourt.x1, A.forecourt.z1, 0x8f98a2, { y: 0.02 });
  slab(group, A.apron.x0, A.apron.z0, A.apron.x1, A.terminal.z0 + 0.5, concrete, { y: 0.02 });
  slab(group, A.runway.x0 + 4, A.taxiZ - 5, A.runway.x1 - 2, A.taxiZ + 5, 0x6a7078, { y: 0.022 });
  for (const x of [A.runway.x0 + 8, -100, A.runway.x1 - 8]) slab(group, x - 5, A.runwayZ + A.runwayW / 2 - 0.5, x + 5, A.taxiZ - 4.5, 0x6a7078, { y: 0.022 }); // taxiway links
  const rwTex = canvasTexture(2048, 256, (ctx, w, h) => {
    ctx.fillStyle = '#4a5058'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 10, w, 6); ctx.fillRect(0, h - 16, w, 6); // edge lines
    for (let x = 160; x < w - 160; x += 64) ctx.fillRect(x, h / 2 - 4, 36, 8); // centreline dashes
    for (const end of [0, 1]) { // threshold piano keys + runway numbers
      const x0 = end ? w - 120 : 20;
      for (let k = 0; k < 8; k++) ctx.fillRect(x0, 34 + k * 24, 100, 12);
      ctx.save(); ctx.translate(end ? w - 190 : 190, h / 2); ctx.rotate(end ? -Math.PI / 2 : Math.PI / 2);
      ctx.font = `700 96px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(end ? '27' : '09', 0, 0); ctx.restore();
    }
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(400, h / 2 + 30, 300, 6); ctx.fillRect(w - 700, h / 2 - 36, 300, 6); // touchdown marks (yellow, kid-friendly)
  });
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(A.runway.x1 - A.runway.x0, A.runwayW), new THREE.MeshToonMaterial({ map: rwTex }));
  rw.rotation.x = -Math.PI / 2;
  rw.position.set((A.runway.x0 + A.runway.x1) / 2, 0.026, A.runwayZ);
  rw.receiveShadow = true;
  group.add(rw);
  // runway + taxiway edge lights (they glow at night like the street lamps)
  const bulbMat = toon(0xfff3b0, { emissive: 0x6a5a20 });
  const lights = [];
  for (let x = A.runway.x0 + 2; x <= A.runway.x1 - 2; x += 10) for (const dz of [-A.runwayW / 2 - 0.6, A.runwayW / 2 + 0.6]) lights.push([x, A.runwayZ + dz]);
  const lm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), bulbMat, lights.length);
  lights.forEach(([x, z], i) => lm.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0.3, z)));
  group.add(lm);
  const blue = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3a7bff }), 40);
  for (let i = 0; i < 40; i++) blue.setMatrixAt(i, new THREE.Matrix4().makeTranslation(A.runway.x0 + 8 + (i % 20) * 8.6, 0.25, A.taxiZ + (i < 20 ? -5.4 : 5.4)));
  group.add(blue);
  for (let i = 0; i < lights.length; i += 4) lampPts.push({ x: lights[i][0], y: 0.4, z: lights[i][1], size: 2.2 });

  // ---- Airport Road from Downtown, the forecourt with a drop-off lane and a few parked cars
  const cells = street(new Set(), ROAD_I, A.roadJ[0], ROAD_I, A.roadJ[1]);
  const { group: sg, tiles } = buildStreets(cells, { extra: new Set([`${ROAD_I},${A.roadJ[0] + 1}`]) });
  group.add(sg);
  AIR_MAP.streets = tiles;
  const cars = [];
  for (let x = A.forecourt.x0 + 4; x < A.forecourt.x1 - 4; x += 3.4) if (Math.abs(x - A.roadX) > 7 && Math.round(x) % 2) cars.push({ x, z: A.forecourt.z0 + 3, rot: 0, name: ['sedan', 'taxi', 'suv', 'taxi', 'van'][Math.abs(Math.round(x)) % 5] });
  parkedCars(group, cars);

  buildTerminal(group, blockers);
  buildTower(group, blockers);
  buildHangars(group, blockers);
  for (const [i, gxz] of A.gates.entries()) {
    if (i === 1) continue; // the middle gate is the animated jet's
    const p = makePlane(i ? 0x2f7fc1 : 0xe0453a);
    p.position.set(gxz, 0, A.terminal.z0 - 14);
    p.rotation.y = 0; // nose (+z) towards the terminal
    group.add(p);
    addBox(gxz, A.terminal.z0 - 14, 20, 22);
    AIR_MAP.planes.push({ x: gxz, z: A.terminal.z0 - 14, rot: 0 });
  }
  buildStairsTruck(group);
  buildWindsock(group, animated);
  buildFlyingJet(group, animated);

  // ---- perimeter fence (gap for Airport Road), lamps on the forecourt
  const posts = [], rails = [];
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (let d = 0; d <= len; d += 3) posts.push(new THREE.Matrix4().makeTranslation(x0 + ((x1 - x0) * d) / len, 1.1, z0 + ((z1 - z0) * d) / len));
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    for (const y of [0.6, 1.4, 2.1]) rails.push(new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, y, (z0 + z1) / 2), new THREE.Quaternion(), new THREE.Vector3(along ? len : 0.06, 0.05, along ? 0.06 : len)));
  };
  fence(A.x0, A.z1 + 0.5, A.roadX - 4.5, A.z1 + 0.5); fence(A.roadX + 4.5, A.z1 + 0.5, A.x1, A.z1 + 0.5);
  fence(A.x0, A.z0, A.x1, A.z0); fence(A.x0, A.z0, A.x0, A.z1); fence(A.x1, A.z0, A.x1, A.z1);
  group.add(instanced(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6), 0x9aa3ad, posts, { outline: 0 }));
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), 0x9aa3ad, rails, { outline: 0 }));
  const lamps = [];
  for (let x = A.forecourt.x0 + 8; x < A.forecourt.x1 - 4; x += 16) lamps.push({ x, z: A.forecourt.z1 - 0.8, rot: Math.PI });
  lampPts.push(...streetLamps(group, lamps, { height: 5.4 }));
  const sign = signBoard(new THREE.PlaneGeometry(7, 1.6), signTexture(['✈️ WOLFSON AIRPORT'], { w: 1024, h: 230, size: 96, bg: '#1e3fa0', fg: '#ffffff' }));
  sign.position.set(A.roadX, 5.8, A.z1 + 0.6);
  group.add(sign);
  for (const dx of [-3.6, 3.6]) {
    const post = part(new THREE.BoxGeometry(0.3, 6.4, 0.3), 0x2b2f38, { outline: 0.015 });
    post.position.set(A.roadX + dx, 3.2, A.z1 + 0.6);
    group.add(post);
    addCircle(A.roadX + dx, A.z1 + 0.6, 0.3);
  }
  addCameraBlocker(group, blockers);
  bakeStatic(group);
  return {
    group, animated, bulbs: lampPts, jet: AIR_MAP.jet,
    /** Jump the jet's schedule to `sec` (tests, photo opportunities). */
    jetAt(sec) { AIRPORT.jetOffset = sec - (AIRPORT.jetT ?? 0); },
  };
}

/** The terminal: a long glass hall with a curved roof, a big sign and three jet bridges out to the gates. */
function buildTerminal(group, blockers) {
  const T = AIRPORT.terminal, w = T.x1 - T.x0, d = T.z1 - T.z0, cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2;
  const glass = canvasTexture(512, 128, (ctx, cw, ch) => {
    ctx.fillStyle = '#9ad3f0'; ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 12; i++) ctx.fillRect(i * 44 + 6, 0, 10, ch);
    ctx.fillStyle = '#5b6573'; for (let i = 0; i <= 16; i++) ctx.fillRect(i * 32, 0, 4, ch); ctx.fillRect(0, ch / 2 - 2, cw, 4);
  });
  glass.wrapS = THREE.RepeatWrapping; glass.repeat.set(w / 16, 1);
  const hall = new THREE.Mesh(new THREE.BoxGeometry(w, 9, d), [toon(0xe8edf2), toon(0xe8edf2), toon(0xdfe6ee), toon(0xdfe6ee), new THREE.MeshToonMaterial({ map: glass }), new THREE.MeshToonMaterial({ map: glass })]);
  hall.position.set(cx, 4.5, cz);
  hall.castShadow = true; hall.receiveShadow = true;
  group.add(hall);
  const roof = part(new THREE.CylinderGeometry(d * 0.75, d * 0.75, w + 2, 32, 1, false, Math.PI / 2 - Math.PI * 0.32, Math.PI * 0.64), 0xffffff, { outline: 0.03 }); // the top arc once turned along x
  roof.rotation.z = Math.PI / 2;
  roof.position.set(cx, 9 - d * 0.75 * Math.cos(Math.PI * 0.32) + 0.4, cz);
  group.add(roof);
  addBox(cx, cz, w, d);
  blockers.push(new THREE.BoxGeometry(w, 11, d).translate(cx, 5.5, cz));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 3.2), new THREE.MeshBasicMaterial({ map: signTexture(['WOLFSON AIRPORT ✈'], { w: 1024, h: 128, size: 96, bg: '#ffffff', fg: '#1e3fa0' }) }));
  sign.position.set(cx, 7.2, T.z1 + 0.03);
  group.add(sign);
  // entrance canopy on the forecourt side
  const canopy = part(new THREE.BoxGeometry(30, 0.4, 5), 0x2f7fc1, { outline: 0.02 });
  canopy.position.set(cx, 4.2, T.z1 + 2.5);
  group.add(canopy);
  for (const dx of [-14, -5, 5, 14]) {
    const post = part(new THREE.CylinderGeometry(0.18, 0.18, 4.2, 8), 0xdfe6ee, { outline: 0.01 });
    post.position.set(cx + dx, 2.1, T.z1 + 4.6);
    group.add(post);
    addCircle(cx + dx, T.z1 + 4.6, 0.3);
  }
  AIR_SPOTS.entrance = { x: cx, z: T.z1 + 6 };
  // jet bridges to the gates (the middle one stands ready for the jet that comes back in)
  for (const gxz of AIRPORT.gates) {
    const bridge = part(new THREE.BoxGeometry(3.2, 3.2, 9), 0xdfe6ee, { outline: 0.02 });
    bridge.position.set(gxz - 4.5, 4.4, T.z0 - 4.5);
    group.add(bridge);
    const leg = part(new THREE.CylinderGeometry(0.25, 0.25, 2.8, 8), 0x9aa3ad, { outline: 0.01 });
    leg.position.set(gxz - 4.5, 1.4, T.z0 - 7.5);
    group.add(leg);
    addBox(gxz - 4.5, T.z0 - 4.5, 3.2, 9);
  }
}

function buildTower(group, blockers) {
  const { x, z, h } = AIRPORT.tower;
  const shaft = part(new THREE.CylinderGeometry(1.8, 2.4, h, 16), 0xe8edf2, { outline: 0.03 });
  shaft.position.set(x, h / 2, z);
  group.add(shaft);
  const deck = part(new THREE.CylinderGeometry(4.2, 3.2, 1, 16), 0x5b6573, { outline: 0.02 });
  deck.position.set(x, h + 0.5, z);
  group.add(deck);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.2, 3.4, 16), toon(0x6fb7e8, { emissive: 0x0a2030 }));
  cab.position.set(x, h + 2.7, z);
  group.add(cab);
  const top = part(new THREE.CylinderGeometry(4.4, 4.4, 0.6, 16), 0x2b2f38, { outline: 0.02 });
  top.position.set(x, h + 4.7, z);
  group.add(top);
  const mast = part(new THREE.CylinderGeometry(0.1, 0.1, 4, 6), 0xe0453a, { outline: 0 });
  mast.position.set(x, h + 7, z);
  group.add(mast);
  addCircle(x, z, 2.6);
  blockers.push(new THREE.CylinderGeometry(2.4, 2.4, h, 8).translate(x, h / 2, z));
}

function buildHangars(group, blockers) {
  for (const { x, z } of AIRPORT.hangars) {
    // a Quonset hut: half a cylinder lying along z (θ π/2…3π/2 ends up as the upper half after the turn)
    const roof = part(new THREE.CylinderGeometry(10, 10, 20, 24, 1, true, Math.PI / 2, Math.PI), 0xb8c0c9, { outline: 0.03 });
    roof.material.side = THREE.DoubleSide;
    roof.rotation.x = Math.PI / 2;
    roof.position.set(x, 0, z);
    group.add(roof);
    const back = new THREE.Mesh(new THREE.CircleGeometry(10, 24, 0, Math.PI), toon(0x8f98a2));
    back.position.set(x, 0, z + 10);
    group.add(back);
    const door = new THREE.Mesh(new THREE.CircleGeometry(9.4, 24, 0, Math.PI), toon(0x2b2f38));
    door.position.set(x, 0, z - 10.02);
    door.rotation.y = Math.PI;
    group.add(door);
    addBox(x, z, 20, 20);
    blockers.push(new THREE.BoxGeometry(18, 9, 20).translate(x, 4.5, z));
  }
}

/** An airstairs truck parked on the apron (its top platform is 3.2 up). */
function buildStairsTruck(group) {
  const { x, z } = AIRPORT.stairs;
  const cab = part(new THREE.BoxGeometry(2.4, 2, 2.6), 0xffd23f, { outline: 0.02 });
  cab.position.set(x, 1.2, z + 3.6);
  group.add(cab);
  const bed = part(new THREE.BoxGeometry(2.4, 0.6, 6), 0x5b6573, { outline: 0.02 });
  bed.position.set(x, 0.6, z);
  group.add(bed);
  for (let i = 0; i < 8; i++) {
    const step = part(new THREE.BoxGeometry(1.8, 0.14, 0.6), 0xdfe6ee, { outline: 0.008 });
    step.position.set(x, 0.95 + i * 0.32, z + 2 - i * 0.55);
    group.add(step);
  }
  const top = part(new THREE.BoxGeometry(2, 0.2, 1.8), 0xdfe6ee, { outline: 0.012 });
  top.position.set(x, 3.2, z - 2.8);
  group.add(top);
  for (const sx of [-1, 1]) {
    const rail = part(new THREE.BoxGeometry(0.08, 0.08, 6.5), 0xe0453a, { outline: 0 });
    rail.position.set(x + sx * 0.95, 2.6, z - 0.2);
    rail.rotation.x = -0.5;
    group.add(rail);
  }
  addBox(x, z + 0.6, 2.6, 8);
  AIR_SPOTS.stairsTop = { x, z: z - 2.8, y: 3.3 };
}

function buildWindsock(group, animated) {
  const x = AIRPORT.runway.x1 - 6, z = AIRPORT.runwayZ - 16;
  const pole = part(new THREE.CylinderGeometry(0.08, 0.1, 6, 6), 0xdfe6ee, { outline: 0.01 });
  pole.position.set(x, 3, z);
  group.add(pole);
  addCircle(x, z, 0.3);
  const stripes = canvasTexture(128, 32, (ctx, w, h) => { for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#ff7a1a'; ctx.fillRect(i * 32, 0, 32, h); } });
  const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.2, 2.6, 10, 1, true), new THREE.MeshToonMaterial({ map: stripes, side: THREE.DoubleSide }));
  sock.geometry.rotateZ(Math.PI / 2);
  sock.geometry.translate(1.3, 0, 0);
  sock.position.set(x, 5.8, z);
  sock.userData.dynamic = true;
  group.add(sock);
  animated.push({ update: (t) => { sock.rotation.y = Math.sin(t * 0.3) * 0.5 + 0.3; sock.rotation.z = -0.15 + Math.sin(t * 2.3) * 0.08; } });
}

/** A cartoon jet: fuselage, wings, engines, tail, windows and the Wolfson Air name. */
export function makePlane(color = 0x2f7fc1) {
  const g = new THREE.Group();
  const body = part(new THREE.CapsuleGeometry(1.7, 17, 6, 16), 0xffffff, { outline: 0.04 });
  body.rotation.x = Math.PI / 2;
  body.position.y = 3.2;
  g.add(body);
  const stripe = part(new THREE.CylinderGeometry(1.72, 1.72, 17, 16, 1, true), color, { outline: 0 });
  stripe.rotation.x = Math.PI / 2;
  stripe.scale.set(1, 1, 1);
  stripe.position.y = 3.2;
  stripe.geometry = new THREE.CylinderGeometry(1.72, 1.72, 17, 16, 1, true, Math.PI * 0.7, Math.PI * 0.6);
  g.add(stripe);
  const winTex = canvasTexture(512, 32, (ctx, w, h) => { ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#2b3d55'; for (let i = 0; i < 24; i++) { ctx.beginPath(); ctx.ellipse(12 + i * 20.8, h / 2, 6, 9, 0, 0, Math.PI * 2); ctx.fill(); } });
  for (const sx of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.8), new THREE.MeshBasicMaterial({ map: winTex, transparent: true }));
    win.position.set(sx * 1.71, 3.75, 0);
    win.rotation.y = sx * Math.PI / 2;
    g.add(win);
    const name = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.9), new THREE.MeshBasicMaterial({ map: signTexture(['WOLFSON AIR'], { w: 512, h: 76, size: 56, bg: '#ffffff', fg: '#1e3fa0' }), transparent: true }));
    name.position.set(sx * 1.73, 2.75, -1.5);
    name.rotation.y = sx * Math.PI / 2;
    g.add(name);
  }
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), toon(0x2b3d55));
  cockpit.rotation.x = 0.9;
  cockpit.position.set(0, 3.9, 9.2);
  g.add(cockpit);
  const wing = part(new THREE.BoxGeometry(22, 0.35, 4), 0xdfe6ee, { outline: 0.03 });
  wing.position.set(0, 2.6, 0.5);
  g.add(wing);
  for (const sx of [-1, 1]) {
    const eng = part(new THREE.CylinderGeometry(0.75, 0.65, 3, 14), 0xb8c0c9, { outline: 0.02 });
    eng.rotation.x = Math.PI / 2;
    eng.position.set(sx * 5, 1.75, 1.5);
    g.add(eng);
    const tip = part(new THREE.BoxGeometry(0.2, 1.2, 1.4), color, { outline: 0.01 });
    tip.position.set(sx * 11, 3.2, 0);
    g.add(tip);
  }
  const fin = part(new THREE.BoxGeometry(0.35, 4.5, 3.4), color, { outline: 0.03 });
  fin.position.set(0, 6, -8.4);
  fin.rotation.x = -0.35;
  g.add(fin);
  const stab = part(new THREE.BoxGeometry(8, 0.25, 2.2), 0xdfe6ee, { outline: 0.02 });
  stab.position.set(0, 3.8, -8.6);
  g.add(stab);
  for (const [gx2, gz2] of [[0, 7], [-2.2, 0], [2.2, 0]]) {
    const wheel = part(new THREE.CylinderGeometry(0.45, 0.45, 0.4, 10), 0x1b1b1b, { outline: 0 });
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(gx2, 0.45, gz2);
    g.add(wheel);
    const strut = part(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6), 0x9aa3ad, { outline: 0 });
    strut.position.set(gx2, 1.2, gz2);
    g.add(strut);
  }
  return g;
}

/** The jet that leaves from gate 2: pushback-free version — it taxis out, takes off east, then lands and rolls in. */
function buildFlyingJet(group, animated) {
  const A = AIRPORT;
  const jet = makePlane(0xffd23f);
  jet.userData.dynamic = true;
  group.add(jet);
  const gate = new THREE.Vector3(A.gates[1], 0, A.terminal.z0 - 14);
  const P = (x, z, y = 0) => new THREE.Vector3(x, y, z);
  // keyframes: [time, position, heading (yaw: 0 = +z), pitch]
  const W0 = A.runway.x0 + 8, E0 = A.runway.x1 - 8;
  const keys = [
    [0, gate, 0, 0], [8, gate, 0, 0], // boarding at the gate (nose to the terminal)
    [16, P(gate.x, A.taxiZ), Math.PI, 0], // backs… well, rolls out north to the taxiway
    [30, P(W0, A.taxiZ), -Math.PI / 2, 0],
    [36, P(W0, A.runwayZ), Math.PI / 2, 0], // lined up on runway 09, facing east
    [44, P(-80, A.runwayZ), Math.PI / 2, 0], // take-off roll
    [48, P(-30, A.runwayZ, 6), Math.PI / 2, -0.22], // rotate + climb
    [58, P(140, A.runwayZ, 70), Math.PI / 2, -0.18], // gone (far east, high)
    [70, P(280, A.runwayZ - 40, 90), Math.PI / 2, -0.1],
    [71, P(260, A.runwayZ, 70), -Math.PI / 2, 0.08], // comes back round from the east
    [86, P(E0 + 10, A.runwayZ, 5), -Math.PI / 2, 0.08], // final approach
    [89, P(E0 - 20, A.runwayZ), -Math.PI / 2, 0], // touchdown, braking
    [98, P(-100, A.runwayZ), -Math.PI / 2, 0],
    [104, P(-100, A.taxiZ), 0, 0], // off the runway (south)
    [112, P(gate.x, A.taxiZ), -Math.PI / 2, 0], // along the taxiway (west)
    [120, gate, 0, 0], // back in at the gate
  ];
  const period = 120;
  const lerpAngle = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
  animated.push({ update: (t) => {
    AIRPORT.jetT = t;
    const c = (t + (AIRPORT.jetOffset ?? 0)) % period;
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1][0] <= c) i++;
    const [t0, p0, h0, q0] = keys[i], [t1, p1, h1, q1] = keys[i + 1];
    let k = THREE.MathUtils.clamp((c - t0) / (t1 - t0), 0, 1);
    if (i === 4) k = k * k; // accelerating down the runway
    if (i === 10) k = 1 - (1 - k) * (1 - k); // braking after touchdown
    jet.position.lerpVectors(p0, p1, k);
    jet.rotation.set(0, 0, 0);
    jet.rotation.y = lerpAngle(h0, h1, Math.min(1, k * 2.5));
    jet.rotateX(q0 + (q1 - q0) * k);
    jet.visible = jet.position.x < 230;
  } });
  AIR_MAP.jet = jet;
}
