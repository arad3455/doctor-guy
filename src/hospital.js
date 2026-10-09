// Inside Wolfson Medical Center — a separate interior (GTA-style: walk to the doors, press E, fade in).
// Lobby with reception + nurse, Exam Room, Lab and a Ward. Furniture is generated with Meshy
// (assets/props/*.glb, see tools/meshy-props.mjs) with simple procedural stand-ins as a fallback.
import * as THREE from 'three';
import { part, toon, canvasTexture, signTexture, FONT } from './toon.js';
import { addBox } from './world.js';
import { gltfLoader, toonify } from './skinned.js';
import { buildKid, animateRig, makeBubble } from './characters.js';

export const INTERIOR = {
  origin: new THREE.Vector3(0, 0, -400),
  halfX: 18,
  halfZ: 14,
  wallH: 3.2,
  entry: new THREE.Vector3(0, 0, -400 + 12.2), // where you appear inside (facing north)
  exitDoor: new THREE.Vector3(0, 0, -400 + 13.2),
  frontDoor: new THREE.Vector3(0, 0, -45.6), // outside, in front of the hospital doors
  exitTo: new THREE.Vector3(0, 0, -43.8), // where you appear outside (facing the park)
};
const O = INTERIOR.origin;
const W = (x, z, y = 0) => new THREE.Vector3(O.x + x, y, O.z + z);
export const isInside = (p) => p.z < -300;

// Meshy props: target size in game units, how to fit it, and the yaw that turns its front to +z
const PROP_FIT = {
  bed: { length: 3.0, yaw: Math.PI / 2 }, // generated bed's long side runs along x
  monitor: { height: 2.1, yaw: 0 },
  desk: { length: 3.9, yaw: 0 },
  scale: { height: 2.3, yaw: 0 },
  chair: { height: 1.35, yaw: 0 },
};

export async function buildHospital(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const animated = [];
  const plan = { rooms: [], walls: [] }; // for the minimap
  const blockers = []; // things a patient's seat height is measured on

  // ---------- floors ----------
  const tiles = (base, line) => {
    const t = canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = line; ctx.lineWidth = 3; ctx.strokeRect(0, 0, w, h);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  const rooms = [
    { name: 'Lobby', x0: -6, x1: 6, z0: -14, z1: 14, color: '#f4ede0', line: '#e2d6c0', map: '#f4ede0' },
    { name: 'Exam', x0: -18, x1: -6, z0: -14, z1: 0, color: '#dff3e2', line: '#c4e3c9', map: '#cdebd2' },
    { name: 'Lab', x0: -18, x1: -6, z0: 0, z1: 14, color: '#ece3f6', line: '#d6c8ea', map: '#ddd0f0' },
    { name: 'Ward', x0: 6, x1: 18, z0: -14, z1: 14, color: '#dfeefa', line: '#c5dcf0', map: '#cfe4f6' },
  ];
  for (const r of rooms) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const tex = tiles(r.color, r.line);
    tex.repeat.set(w / 1.5, d / 1.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), toon(0xffffff, { map: tex }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.copy(W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, 0.01));
    floor.receiveShadow = true;
    group.add(floor);
    plan.rooms.push({ x0: O.x + r.x0, x1: O.x + r.x1, z0: O.z + r.z0, z1: O.z + r.z1, color: r.map, name: r.name });
  }
  // dark surround so the cut-away building reads as an interior
  const surround = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), toon(0x3b4a5e));
  surround.rotation.x = -Math.PI / 2;
  surround.position.copy(W(0, 0, -0.02));
  group.add(surround);

  // ---------- walls ----------
  const wallMat = toon(0xf7f3ea);
  const bandMat = toon(0x7fb8e8);
  const wall = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const g = new THREE.Group();
    const w = part(new THREE.BoxGeometry(len, INTERIOR.wallH, 0.3), wallMat, { outline: 0.02 });
    w.position.y = INTERIOR.wallH / 2;
    w.receiveShadow = true;
    g.add(w);
    const band = new THREE.Mesh(new THREE.BoxGeometry(len + 0.01, 0.9, 0.32), bandMat);
    band.position.y = 0.45;
    g.add(band);
    g.position.copy(W((x1 + x2) / 2, (z1 + z2) / 2));
    g.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    group.add(g);
    addBox(O.x + (x1 + x2) / 2, O.z + (z1 + z2) / 2, Math.abs(x2 - x1) + 0.3, Math.abs(z2 - z1) + 0.3);
    plan.walls.push([O.x + x1, O.z + z1, O.x + x2, O.z + z2]);
  };
  const { halfX: X, halfZ: Z } = INTERIOR;
  wall(-X, -Z, X, -Z); // north
  wall(-X, -Z, -X, Z); // west
  wall(X, -Z, X, Z); // east
  wall(-X, Z, -2.2, Z); wall(2.2, Z, X, Z); // south, with the entrance
  for (const x of [-6, 6]) { // wing walls with doorways at z = ±7
    wall(x, -Z, x, -8.6); wall(x, -5.4, x, 5.4); wall(x, 8.6, x, Z);
  }
  wall(-X, 0, -6, 0); // exam | lab

  // entrance: glass sliding doors (open) + EXIT sign
  for (const sx of [-1, 1]) {
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.8, 0.08), toon(0xbfe3ff, { transparent: true, opacity: 0.45 }));
    glass.position.copy(W(sx * 3.2, Z - 0.05, 1.4));
    group.add(glass);
  }
  const doorMat = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.2), toon(0x5a6b7d));
  doorMat.rotation.x = -Math.PI / 2;
  doorMat.position.copy(W(0, Z - 1.3, 0.02));
  group.add(doorMat);

  // ---------- signs ----------
  const sign = (text, x, z, yaw, { bg = '#2f7fc1', fg = '#ffffff', w = 2.4 } = {}) => {
    const tex = canvasTexture(512, 128, (ctx, cw, ch) => {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = fg; ctx.font = `700 64px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, cw / 2, ch / 2 + 4);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: tex }));
    m.position.copy(W(x, z, 2.75));
    m.rotation.y = yaw;
    group.add(m);
  };
  sign('EXAM ROOM', -5.82, -7, Math.PI / 2);
  sign('LAB', -5.82, 7, Math.PI / 2, { bg: '#8a5cc2' });
  sign('WARD', 5.82, -7, -Math.PI / 2, { bg: '#3a9c5a' });
  sign('WARD', 5.82, 7, -Math.PI / 2, { bg: '#3a9c5a' });
  sign('EXIT', 0, Z - 0.17, Math.PI, { bg: '#2e9c3c', w: 1.6 });
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.9), new THREE.MeshBasicMaterial({
    map: signTexture(['WOLFSON MEDICAL CENTER', 'Small Patients · Big Dreams'], { w: 1024, h: 384, size: 70, fg: '#1e3fa0', bg: '#fff8e6' }),
  }));
  poster.position.copy(W(0, -Z + 0.17, 2.1));
  group.add(poster);
  const chart = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.7), new THREE.MeshBasicMaterial({
    map: canvasTexture(256, 360, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#111'; ctx.textAlign = 'center';
      ['E', 'F P', 'T O Z', 'L P E D', 'P E C F D', 'E D F C Z P'].forEach((row, i) => {
        ctx.font = `700 ${70 - i * 11}px Arial`;
        ctx.fillText(row, w / 2, 70 + i * 52 - i * i * 2);
      });
    }),
  }));
  chart.position.copy(W(-12, -Z + 0.17, 1.6));
  group.add(chart);

  // ---------- props (Meshy, with fallbacks) ----------
  const models = {};
  await Promise.all(Object.keys(PROP_FIT).map(async (name) => {
    try {
      const g = await gltfLoader.loadAsync(new URL(`../assets/props/${name}.glb`, import.meta.url).href);
      models[name] = fitModel(g.scene, PROP_FIT[name]);
    } catch {
      models[name] = null;
    }
  }));
  const place = (name, x, z, yaw = 0, collide = null) => {
    const obj = models[name] ? models[name].clone() : fallbackProp(name);
    obj.position.copy(W(x, z));
    obj.rotation.y = yaw;
    group.add(obj);
    blockers.push(obj);
    if (collide) addBox(O.x + x, O.z + z, collide[0], collide[1]);
    return obj;
  };

  // Lobby: reception desk facing the entrance, waiting chairs, plants
  place('desk', 0, -6, 0, [4.2, 1.6]);
  for (const [x0, z] of [[-5, 9.2], [2.4, 9.2]]) {
    for (let i = 0; i < 3; i++) {
      const seat = part(new THREE.BoxGeometry(0.8, 0.12, 0.8), 0x2f7fc1, { outline: 0.012 });
      seat.position.copy(W(x0 + i * 0.95, z, 0.55));
      group.add(seat);
      const back = part(new THREE.BoxGeometry(0.8, 0.7, 0.12), 0x2f7fc1, { outline: 0.012 });
      back.position.copy(W(x0 + i * 0.95, z + 0.4, 0.95));
      group.add(back);
      const leg = part(new THREE.BoxGeometry(0.08, 0.5, 0.6), 0x9aa3ad, { outline: 0 });
      leg.position.copy(W(x0 + i * 0.95, z, 0.25));
      group.add(leg);
    }
    addBox(O.x + x0 + 0.95, O.z + z + 0.15, 3, 1.2);
  }
  for (const [x, z] of [[-5.3, -13.2], [5.3, -13.2], [-5.3, 13.2], [5.3, 13.2], [-17.2, -0.8], [17.2, 0]]) {
    const pot = part(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 12), 0xb07a4a, { outline: 0.015 });
    pot.position.copy(W(x, z, 0.3));
    group.add(pot);
    const leaves = part(new THREE.IcosahedronGeometry(0.6, 1), 0x3d9c3a, { outline: 0.02 });
    leaves.position.copy(W(x, z, 1.05));
    group.add(leaves);
  }

  // Exam room: scale, eye chart (on the wall above), an exam bed
  const scale = place('scale', -15.5, -11, Math.PI / 2, [1.2, 1.2]);
  place('bed', -8.6, -11.4, 0, [1.6, 3.2]);

  // Lab: blood-draw chair + a lab bench with test tubes and a microscope
  const chair = place('chair', -13.5, 7.5, Math.PI / 2, [1.2, 1.2]);
  const bench = part(new THREE.BoxGeometry(1.2, 1.1, 9), 0xffffff, { outline: 0.02 });
  bench.position.copy(W(-17.2, 7, 0.55));
  group.add(bench);
  const top = part(new THREE.BoxGeometry(1.3, 0.08, 9.1), 0x5a6b7d, { outline: 0.012 });
  top.position.copy(W(-17.2, 7, 1.14));
  group.add(top);
  addBox(O.x - 17.2, O.z + 7, 1.4, 9.2);
  for (let i = 0; i < 6; i++) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 8), toon([0xe0323a, 0x3fa9f5, 0xffd23f][i % 3]));
    tube.position.copy(W(-17, 3.4 + i * 0.16, 1.34));
    group.add(tube);
  }
  const scope = new THREE.Group();
  const sBase = part(new THREE.BoxGeometry(0.35, 0.08, 0.45), 0x2b2f38, { outline: 0.01 });
  const sArm = part(new THREE.BoxGeometry(0.1, 0.55, 0.1), 0x2b2f38, { outline: 0.01 });
  sArm.position.set(0, 0.3, -0.15);
  const sTube = part(new THREE.CylinderGeometry(0.06, 0.07, 0.4, 10), 0xd0d4da, { outline: 0.01 });
  sTube.position.set(0, 0.5, -0.02);
  sTube.rotation.x = 0.4;
  scope.add(sBase, sArm, sTube);
  scope.position.copy(W(-17.1, 9.5, 1.18));
  scope.rotation.y = Math.PI / 2;
  group.add(scope);

  // Ward: four beds along the east wall (heads north), monitors, privacy curtains
  const bedZ = [-10.5, -3.8, 3, 9.8];
  const beds = bedZ.map((z) => place('bed', 14.6, z, 0, [1.7, 3.1]));
  place('monitor', 16.6, -7.3, -Math.PI / 2, [0.6, 0.6]);
  place('monitor', 16.6, -0.5, -Math.PI / 2, [0.6, 0.6]);
  const curtainMat = toon(0xa8dcc0, { transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  for (const z of [-7.15, -0.4, 6.4]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.4), curtainMat);
    c.position.copy(W(15.9, z, 1.5));
    group.add(c);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.05, 0.05), toon(0x9aa3ad));
    rail.position.copy(W(15.9, z, 2.72));
    group.add(rail);
  }

  // ---------- spots where patients stand or sit ----------
  group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const topAt = (objs, x, z, fallback) => {
    ray.set(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObjects(objs, true).find((h) => h.object.visible);
    return hit ? hit.point.y : fallback;
  };
  const bedSpot = (i) => {
    const x = O.x + 14.6 - 0.45, z = O.z + bedZ[i];
    return { pos: new THREE.Vector3(x, 0, z), yaw: -Math.PI / 2, top: topAt([beds[i]], x + 0.25, z, 0.8), sit: true };
  };
  const scalePos = new THREE.Vector3().setFromMatrixPosition(scale.matrixWorld);
  const chairPos = new THREE.Vector3().setFromMatrixPosition(chair.matrixWorld);
  const spots = {
    scale: { pos: scalePos.clone().add(new THREE.Vector3(0.25, 0, 0)), yaw: Math.PI / 2, top: Math.min(0.4, topAt([scale], scalePos.x + 0.25, scalePos.z, 0.12)), sit: false },
    eye: { pos: W(-12, -6), yaw: Math.PI, top: 0, sit: false },
    chair: { pos: chairPos.clone(), yaw: Math.PI / 2, top: topAt([chair], chairPos.x, chairPos.z, 0.65), sit: true },
    bed1: bedSpot(0),
    bed2: bedSpot(1),
    bed3: bedSpot(2),
    bed4: bedSpot(3),
  };

  // ---------- the nurse at reception ----------
  const nurse = buildKid('nurse');
  nurse.root.position.copy(W(0, -8.2));
  group.add(nurse.root);
  const hello = makeBubble('Welcome! 💙', { w: 300 });
  hello.position.y = nurse.height + 0.9;
  hello.visible = false;
  nurse.root.add(hello);

  // ---------- admitted kids resting on the free ward beds ----------
  const resting = [];
  let nextBed = 0;
  const admit = (look) => {
    const spot = spots[['bed3', 'bed4'][nextBed++ % 2]];
    const prev = resting.find((r) => r.spot === spot);
    if (prev) { group.remove(prev.kid.root); resting.splice(resting.indexOf(prev), 1); }
    const kid = buildKid(look);
    perch(kid, spot);
    group.add(kid.root);
    resting.push({ kid, spot });
  };

  let greetT = 0;
  animated.push({ update: (t, dt) => {
    if (!group.visible) return;
    greetT -= dt;
    animateRig(nurse, greetT > 0 ? 'wave' : 'idle', t, dt);
    hello.visible = greetT > 0;
    for (const r of resting) animateRig(r.kid, 'sit', t, dt);
  } });

  return {
    group,
    animated,
    spots,
    plan,
    admit,
    greet() { greetT = 3.5; },
  };
}

/** Puts a kid on a spot: sitting on a seat/bed edge (using their measured sit pose) or standing. */
export function perch(kid, spot) {
  kid.root.rotation.y = spot.yaw;
  if (spot.sit && kid.seat) {
    const fwd = new THREE.Vector3(Math.sin(spot.yaw), 0, Math.cos(spot.yaw));
    kid.root.position.copy(spot.pos).addScaledVector(fwd, -kid.seat.z);
    kid.root.position.y = spot.top - kid.seat.bottom + 0.01;
  } else if (spot.sit) {
    kid.root.position.copy(spot.pos);
    kid.root.position.y = spot.top - 0.42;
  } else {
    kid.root.position.copy(spot.pos);
    kid.root.position.y = spot.top;
  }
}

function fitModel(model, fit) {
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
  toonify(model, 0);
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = true; } });
  const holder = new THREE.Group();
  holder.add(model);
  return holder;
}

/** Simple stand-ins used until/unless the Meshy props exist. */
function fallbackProp(name) {
  const g = new THREE.Group();
  const box = (w, h, d, color, y, x = 0, z = 0) => {
    const m = part(new THREE.BoxGeometry(w, h, d), color, { outline: 0.015 });
    m.position.set(x, y, z);
    g.add(m);
  };
  if (name === 'bed') { box(1.4, 0.25, 2.9, 0xa8d4f5, 0.75); box(1.4, 0.6, 0.12, 0xffffff, 1.1, 0, -1.4); box(1.3, 0.55, 2.8, 0xd0d4da, 0.35); }
  else if (name === 'monitor') { box(0.08, 1.6, 0.08, 0x9aa3ad, 0.8); box(0.7, 0.5, 0.15, 0x2b2f38, 1.7); }
  else if (name === 'desk') { box(3.8, 1.1, 1.2, 0xffffff, 0.55); box(3.9, 0.08, 1.3, 0xd8b98a, 1.14); }
  else if (name === 'scale') { box(0.8, 0.12, 0.8, 0xd0d4da, 0.06); box(0.08, 2.1, 0.08, 0xd0d4da, 1.1, 0, -0.35); }
  else if (name === 'chair') { box(0.9, 0.15, 0.9, 0x7fb8e8, 0.6); box(0.9, 0.8, 0.12, 0x7fb8e8, 1.05, 0, -0.42); box(0.3, 0.1, 0.9, 0x7fb8e8, 0.85, 0.6, 0.1); }
  return g;
}
