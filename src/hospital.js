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
  xray: { length: 3.6, yaw: 0 },
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
    { name: 'X-Ray', x0: -6, x1: 6, z0: -26, z1: -14, color: '#e9edf2', line: '#cfd6df', map: '#d6dde6' },
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
  wall(-X, -Z, 2.2, -Z); wall(4.6, -Z, X, -Z); // north, with the doorway to X-ray
  wall(-6, -26, 6, -26); wall(-6, -26, -6, -Z); wall(6, -26, 6, -Z); // X-ray room
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
  sign('X-RAY ☢', 3.4, -Z + 0.17, 0, { bg: '#f2c200', fg: '#1b1b1b', w: 2.2 });
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.9), new THREE.MeshBasicMaterial({
    map: signTexture(['WOLFSON MEDICAL CENTER', 'Small Patients · Big Dreams'], { w: 1024, h: 384, size: 70, fg: '#1e3fa0', bg: '#fff8e6' }),
  }));
  poster.scale.setScalar(0.85);
  poster.position.copy(W(-2.2, -Z + 0.17, 2.1));
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

  // X-ray room: the machine, a standing chest X-ray panel, a lightbox, lead aprons, an "in use" light
  const xray = place('xray', -1.2, -21.5, 0);
  {
    const b = new THREE.Box3().setFromObject(xray);
    addBox((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, b.max.x - b.min.x, b.max.z - b.min.z);
  }
  const stand = new THREE.Group();
  const panel = part(new THREE.BoxGeometry(1.3, 1.6, 0.25), 0xe9edf2, { outline: 0.02 });
  panel.position.y = 1.55;
  const frame = part(new THREE.BoxGeometry(1.45, 1.75, 0.18), 0x9aa3ad, { outline: 0 });
  frame.position.set(0, 1.55, -0.06);
  const column = part(new THREE.BoxGeometry(0.25, 2.6, 0.25), 0x9aa3ad, { outline: 0.015 });
  column.position.set(0, 1.3, -0.25);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.3), toon(0xcfe3ff));
  plate.position.set(0, 1.55, 0.13);
  stand.add(panel, frame, column, plate);
  stand.position.copy(W(4, -25.2));
  group.add(stand);
  addBox(O.x + 4, O.z - 25.3, 1.6, 0.8);
  // lightbox on the west wall: shows the latest scan
  const films = {
    off: canvasTexture(256, 192, (ctx, w, h) => { ctx.fillStyle = '#1c2633'; ctx.fillRect(0, 0, w, h); }),
    wrist: xrayFilm('wrist'),
    coin: xrayFilm('coin'),
  };
  const lightbox = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.35), new THREE.MeshBasicMaterial({ map: films.off }));
  lightbox.position.copy(W(-5.83, -18.5, 1.9));
  lightbox.rotation.y = Math.PI / 2;
  group.add(lightbox);
  const lbFrame = part(new THREE.BoxGeometry(0.08, 1.5, 1.95), 0x5a6b7d, { outline: 0 });
  lbFrame.position.copy(W(-5.9, -18.5, 1.9));
  group.add(lbFrame);
  for (const [z, color] of [[-23.8, 0x6a4fb0], [-23.1, 0x2f7fc1]]) { // lead aprons on hooks
    const apron = part(new THREE.BoxGeometry(0.08, 1.0, 0.55), color, { outline: 0.012 });
    apron.position.copy(W(5.8, z, 1.7));
    group.add(apron);
  }
  const inUse = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 0.08), new THREE.MeshBasicMaterial({ color: 0x552222 }));
  inUse.position.copy(W(3.4, -Z + 0.2, 3.05));
  group.add(inUse);
  const inUseLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.26), new THREE.MeshBasicMaterial({
    transparent: true,
    map: canvasTexture(256, 52, (ctx, w, h) => { ctx.fillStyle = '#fff'; ctx.font = `700 30px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('X-RAY IN USE', w / 2, h / 2 + 2); }),
  }));
  inUseLabel.position.copy(W(3.4, -Z + 0.25, 3.05));
  group.add(inUseLabel);

  // the way out: a green gate in the entrance
  const exitGate = makeGate(0x3ccf6a, 'EXIT 🚪', { width: 4.2, height: 2.9 });
  exitGate.group.position.copy(W(0, Z - 0.25));
  exitGate.group.rotation.y = Math.PI;
  group.add(exitGate.group);
  animated.push(exitGate);

  // ---------- spots where patients stand or sit ----------
  group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const topAt = (objs, x, z, fallback, maxY = Infinity) => {
    ray.set(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObjects(objs, true).find((h) => h.object.visible && h.point.y < maxY);
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
    xstand: { pos: W(4, -24.45), yaw: Math.PI, top: 0, sit: false }, // facing the chest panel
  };
  {
    // sit on the X-ray table's front (south) edge, facing into the room
    const b = new THREE.Box3().setFromObject(xray);
    const x = (b.min.x + b.max.x) / 2 - 0.3, z = b.max.z - 0.45;
    spots.xtable = { pos: new THREE.Vector3(x, 0, z), yaw: 0, top: topAt([xray], x, z - 0.3, 0.9, 1.5), sit: true };
  }

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
    /** Puts a scan on the lightbox ('wrist' | 'coin' | 'off'). */
    showFilm(name) { lightbox.material.map = films[name] ?? films.off; lightbox.material.needsUpdate = true; },
    setXrayInUse(on) { inUse.material.color.setHex(on ? 0xff2a2a : 0x552222); },
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
  else if (name === 'xray') { box(3.4, 0.2, 1.2, 0xcfd6df, 0.9); box(2.8, 0.8, 0.9, 0xe9edf2, 0.4); box(0.35, 2.6, 0.35, 0xe9edf2, 1.3, 1.6, -0.5); box(0.9, 0.5, 0.7, 0xcfd6df, 2.2, 0.6, -0.2); }
  else if (name === 'chair') { box(0.9, 0.15, 0.9, 0x7fb8e8, 0.6); box(0.9, 0.8, 0.12, 0x7fb8e8, 1.05, 0, -0.42); box(0.3, 0.1, 0.9, 0x7fb8e8, 0.85, 0.6, 0.1); }
  return g;
}

/** Cartoon X-ray scan drawn on a canvas: a wrist (sprain, no break) or a tummy with a swallowed coin. */
function xrayFilm(kind) {
  return canvasTexture(256, 192, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, '#2b4c6f'); g.addColorStop(1, '#0d1a2a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(220, 240, 255, 0.92)';
    ctx.strokeStyle = 'rgba(220, 240, 255, 0.92)';
    ctx.lineCap = 'round';
    if (kind === 'wrist') {
      // forearm bones into a hand with four fingers (it's a cartoon world)
      ctx.lineWidth = 12;
      for (const dx of [-14, 14]) { ctx.beginPath(); ctx.moveTo(w / 2 + dx, h); ctx.lineTo(w / 2 + dx * 0.8, 112); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(w / 2, 100, 30, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 9;
      [-27, -9, 9, 27].forEach((dx, i) => { ctx.beginPath(); ctx.moveTo(w / 2 + dx * 0.7, 92); ctx.lineTo(w / 2 + dx * 1.2, 30 + Math.abs(i - 1.5) * 8); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(w / 2 - 28, 100); ctx.lineTo(w / 2 - 62, 70); ctx.stroke();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w / 2, 104, 26, 0, Math.PI * 2); ctx.stroke();
    } else {
      // ribs, spine and a coin in the tummy
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(w / 2, 10); ctx.lineTo(w / 2, h - 10); ctx.stroke();
      ctx.lineWidth = 5;
      for (let i = 0; i < 5; i++) {
        const y = 28 + i * 16;
        ctx.beginPath(); ctx.ellipse(w / 2, y + 22, 70 - i * 3, 24, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(w / 2 + 26, 150, 13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w / 2 + 26, 150, 21, 0, Math.PI * 2); ctx.stroke();
    }
  });
}

/**
 * A glowing doorway "gate": a shimmering panel in an arch, a pulsing ring on the floor, a soft beam
 * and a floating label. Used for the hospital entrance (blue) and the exit (green).
 */
export function makeGate(color, label, { width = 4.2, height = 3.3, beam = true, labelY = height + 1.1, labelSize = 2.4 } = {}) {
  const group = new THREE.Group();
  const c = new THREE.Color(color);
  const shimmer = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { t: { value: 0 }, color: { value: c } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float t; uniform vec3 color; varying vec2 vUv;
      void main(){
        vec2 p = vUv - vec2(0.5, 0.0);
        float ring = 0.5 + 0.5 * sin(length(p * vec2(1.0, 0.8)) * 22.0 - t * 4.0);
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x) * smoothstep(1.0, 0.85, vUv.y);
        gl_FragColor = vec4(mix(color, vec3(1.0), ring * 0.35), (0.28 + ring * 0.25) * edge);
      }`,
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), shimmer);
  panel.position.y = height / 2;
  group.add(panel);
  const glow = new THREE.MeshBasicMaterial({ color: c });
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, height, 8), glow);
    post.position.set(sx * width / 2, height / 2, 0);
    group.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, width, 8), glow);
  lintel.rotation.z = Math.PI / 2;
  lintel.position.y = height;
  group.add(lintel);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.6, 40), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.04, 1.2);
  group.add(ring);
  let shaft = null;
  if (beam) {
    shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 12, 16, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, depthWrite: false }));
    shaft.position.set(0, 6, 1.2);
    group.add(shaft);
  }
  const tag = canvasTexture(320, 96, (ctx, w, h) => {
    ctx.fillStyle = `#${c.getHexString()}`;
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.roundRect(4, 4, w - 8, h - 8, 26); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = `700 46px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2 + 3);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tag, depthTest: false, transparent: true }));
  sprite.scale.set(labelSize, labelSize * 0.3, 1);
  sprite.renderOrder = 12;
  sprite.position.set(0, labelY, 0.6);
  group.add(sprite);
  return {
    group,
    update(t) {
      shimmer.uniforms.t.value = t;
      ring.material.opacity = 0.5 + Math.sin(t * 4) * 0.3;
      ring.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
      sprite.position.y = labelY + Math.sin(t * 2.5) * 0.15;
    },
  };
}
