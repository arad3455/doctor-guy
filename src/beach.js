// Zone 2 — the Beach, south of the park (through the south gate and along the boardwalk).
// Modelled on the reference art: lifeguard tower with a red cross, striped umbrellas and towels,
// sandcastles, kids on floats, a sailboat, crabs, starfish and the "Healthy Kids Happier Days" sign.
import * as THREE from 'three';
import { part, toon, instanced, canvasTexture, signTexture, FONT } from './toon.js';
import { WORLD, addBox, addCircle } from './world.js';

const SAND = 0xf2d38a;
const WET_SAND = 0xd9b56b;
const WOOD = 0xa8743f;

const rand = (() => {
  let s = 4242;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
})();

export const BEACH = {
  tower: { x: -22, z: 101 },
  castles: { x: 14, z: 104 },
  umbrellas: [[-8, 92], [6, 95], [26, 90], [36, 99], [-38, 92], [-4, 106]],
};

export function buildBeach(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const sea = new THREE.Group(); // always visible from the park side too (horizon)
  scene.add(sea);
  const animated = [];
  const { shoreline, wadeLimit } = WORLD;

  // ---- Sand + wet sand
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(170, shoreline - 66 + 2), toon(SAND));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.015, (66 + shoreline + 2) / 2);
  sand.receiveShadow = true;
  sea.add(sand);
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(170, 6), toon(WET_SAND));
  wet.rotation.x = -Math.PI / 2;
  wet.position.set(0, 0.018, shoreline - 2);
  wet.receiveShadow = true;
  sea.add(wet);

  // ---- Sea: shallow band you can wade in, deep water beyond
  const shallow = new THREE.Mesh(new THREE.PlaneGeometry(800, wadeLimit - shoreline + 4), toon(0x5cc8f2, { transparent: true, opacity: 0.92 }));
  shallow.rotation.x = -Math.PI / 2;
  shallow.position.set(0, 0.06, (shoreline + wadeLimit + 4) / 2);
  sea.add(shallow);
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(800, 500), toon(0x2b8fd8));
  deep.rotation.x = -Math.PI / 2;
  deep.position.set(0, 0.05, wadeLimit + 4 + 250);
  sea.add(deep);
  // foam where the waves meet the sand, sliding in and out
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(170, 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.07, shoreline);
  sea.add(foam);
  // wave crests rolling towards the shore
  const crests = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(60 + rand() * 60, 0.45), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }));
    c.rotation.x = -Math.PI / 2;
    c.position.set((rand() * 2 - 1) * 60, 0.075, shoreline + 8 + i * 9);
    sea.add(c);
    crests.push(c);
  }
  animated.push({ update: (t, dt) => {
    foam.position.z = shoreline + Math.sin(t * 0.9) * 1.2;
    foam.material.opacity = 0.65 + Math.sin(t * 0.9) * 0.2;
    for (const c of crests) {
      c.position.z -= dt * 2.2;
      if (c.position.z < shoreline + 1) { c.position.z = shoreline + 60; c.position.x = (rand() * 2 - 1) * 60; }
      c.material.opacity = THREE.MathUtils.clamp((shoreline + 60 - c.position.z) / 15, 0, 1) * 0.6;
    }
  } });

  // Sailboat on the horizon
  const boat = new THREE.Group();
  const hull = part(new THREE.BoxGeometry(5, 1.2, 1.8), 0xffffff, { outline: 0.06 });
  hull.position.y = 0.4;
  boat.add(hull);
  const mast = part(new THREE.CylinderGeometry(0.1, 0.1, 7, 6), 0x7a4a26, { outline: 0 });
  mast.position.y = 4;
  boat.add(mast);
  const sailGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(0, 7.3, 0), new THREE.Vector3(3.2, 1.2, 0)]);
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  boat.add(sail);
  const sail2 = new THREE.Mesh(sailGeo, new THREE.MeshBasicMaterial({ color: 0xe0323a, side: THREE.DoubleSide }));
  sail2.scale.set(-0.7, 0.85, 1);
  boat.add(sail2);
  boat.position.set(0, 0, 210);
  sea.add(boat);
  animated.push({ update: (t) => {
    boat.position.x = Math.sin(t * 0.02) * 120;
    boat.position.y = Math.sin(t * 1.3) * 0.15;
    boat.rotation.z = Math.sin(t * 1.1) * 0.04;
  } });

  // ---- Boardwalk from the park's south gate down to the sand
  const planks = [];
  for (let z = 55.5; z < 84; z += 0.62) {
    planks.push(new THREE.Matrix4().compose(new THREE.Vector3(0, 0.12, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
  }
  group.add(instanced(new THREE.BoxGeometry(4.4, 0.16, 0.5), WOOD, planks, { outline: 0.015, cast: false }));
  const posts = [], ropes = [];
  for (const sx of [-2.4, 2.4]) {
    for (let z = 58; z <= 82; z += 4) {
      posts.push(new THREE.Matrix4().compose(new THREE.Vector3(sx, 0.55, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
    }
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 24, 6), toon(0xd8c39a));
    rope.rotation.x = Math.PI / 2;
    rope.position.set(sx, 0.85, 70);
    group.add(rope);
    ropes.push(rope);
  }
  group.add(instanced(new THREE.CylinderGeometry(0.12, 0.14, 1.1, 8), 0x7a4a26, posts, { outline: 0.02 }));

  // Dunes either side of the boardwalk, with dune grass
  const dunes = [], grass = [], grassColors = [];
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (6 + rand() * 30), z = 60 + rand() * 20;
    const s = 3 + rand() * 4;
    dunes.push(new THREE.Matrix4().compose(new THREE.Vector3(x, -s * 0.55, z), new THREE.Quaternion(), new THREE.Vector3(s * 1.6, s, s)));
    for (let j = 0; j < 5; j++) {
      grass.push(new THREE.Matrix4().compose(
        new THREE.Vector3(x + (rand() - 0.5) * s * 1.8, s * 0.32 + rand() * 0.2, z + (rand() - 0.5) * s * 1.2),
        new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5)),
        new THREE.Vector3(0.25, 0.9 + rand() * 0.6, 0.25),
      ));
      grassColors.push([0x5aa83f, 0x7cbf4a, 0x4b9a3a][j % 3]);
    }
  }
  group.add(instanced(new THREE.SphereGeometry(1, 16, 10), 0xe9c87e, dunes, { outline: 0.04, cast: false }));
  group.add(instanced(new THREE.ConeGeometry(0.5, 1, 5), 0x5aa83f, grass, { outline: 0, colors: grassColors }));

  // Welcome sign at the end of the boardwalk (like the art)
  const sign = new THREE.Group();
  const tex = signTexture(['HEALTHY', 'KIDS', 'HAPPIER', 'DAYS'], {
    w: 512, h: 460, size: 78, fg: '#2541a8', bg: '#f6e3b4',
    extra: (ctx, w) => {
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.arc(w - 70, 120, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0323a';
      ctx.font = `700 64px ${FONT}`;
      ctx.fillText('♥', w / 2 + 120, 400);
    },
  });
  const board = part(new THREE.BoxGeometry(2.6, 2.4, 0.14), 0xf6e3b4, { outline: 0.03 });
  board.material = [toon(0xf6e3b4), toon(0xf6e3b4), toon(0xf6e3b4), toon(0xf6e3b4), new THREE.MeshBasicMaterial({ map: tex }), toon(0xf6e3b4)];
  board.position.y = 2.2;
  sign.add(board);
  const sPost = part(new THREE.BoxGeometry(0.18, 2.2, 0.18), 0x7a4a26);
  sPost.position.set(0, 1.0, -0.12);
  sign.add(sPost);
  sign.position.set(5.5, 0, 82);
  sign.rotation.y = Math.PI + 0.35; // faces people walking down the boardwalk
  group.add(sign);
  addCircle(5.5, 82, 1.0);

  // ---- Lifeguard tower = the beach's first-aid station
  buildLifeguardTower(group, animated);

  // ---- Umbrellas with towels
  const towelTex = canvasTexture(128, 256, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#3a7fd8';
      ctx.fillRect(0, (i * h) / 8, w, h / 8);
    }
  });
  const towelTex2 = canvasTexture(128, 256, (ctx, w, h) => {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = ['#ff8ac0', '#ffffff', '#ffd23f'][i % 3];
      ctx.fillRect(0, (i * h) / 6, w, h / 6);
    }
  });
  BEACH.umbrellas.forEach(([x, z], i) => {
    const u = makeUmbrella(i % 2 ? 0x2f7fc1 : 0xe0323a);
    u.position.set(x, 0, z);
    u.rotation.z = (rand() - 0.5) * 0.15;
    group.add(u);
    addCircle(x, z, 0.25);
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), toon(0xffffff, { map: i % 2 ? towelTex2 : towelTex }));
    towel.rotation.set(-Math.PI / 2, 0, rand() * Math.PI);
    towel.position.set(x + 1.2, 0.03, z + 0.6);
    towel.receiveShadow = true;
    group.add(towel);
  });

  // ---- Sandcastles with buckets and spades
  const { x: cx, z: cz } = BEACH.castles;
  [[0, 0, 1.2], [3.2, 1.4, 0.8], [-2.6, 1.8, 0.65]].forEach(([dx, dz, s]) => {
    const c = makeSandcastle(s);
    c.position.set(cx + dx, 0, cz + dz);
    group.add(c);
    addCircle(cx + dx, cz + dz, 1.1 * s);
  });
  [[1.6, -1.6, 0x2f7fc1], [-1.8, -1.0, 0xe0323a], [4.6, 0.2, 0x4cc35a]].forEach(([dx, dz, col]) => {
    const b = makeBucket(col);
    b.position.set(cx + dx, 0, cz + dz);
    group.add(b);
  });

  // ---- Cooler + first-aid kit by the tower (like the art)
  const cooler = makeCooler();
  cooler.position.set(BEACH.tower.x + 3.2, 0, BEACH.tower.z - 3.2);
  cooler.rotation.y = 0.4;
  group.add(cooler);
  addCircle(cooler.position.x, cooler.position.z, 0.8);

  // ---- Palms at the edges of the beach
  [[-50, 86], [-56, 100], [48, 84], [54, 102], [-30, 82], [30, 81]].forEach(([x, z]) => {
    const p = makePalm();
    p.position.set(x, 0, z);
    p.rotation.y = rand() * 6;
    group.add(p);
    addCircle(x, z, 0.5);
  });

  // ---- Shells, starfish and little crabs scuttling around
  const shells = [], shellColors = [];
  for (let i = 0; i < 70; i++) {
    shells.push(new THREE.Matrix4().compose(
      new THREE.Vector3((rand() * 2 - 1) * 56, 0.05, 84 + rand() * (shoreline - 84)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * 6, 0)),
      new THREE.Vector3(1, 0.5, 1),
    ));
    shellColors.push([0xfff1e0, 0xffc9a8, 0xf7b3c2][i % 3]);
  }
  group.add(instanced(new THREE.SphereGeometry(0.16, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0xffffff, shells, { outline: 0, cast: false, colors: shellColors }));
  for (let i = 0; i < 6; i++) {
    const star = makeStarfish();
    star.position.set((rand() * 2 - 1) * 50, 0.04, 90 + rand() * 24);
    star.rotation.y = rand() * 6;
    group.add(star);
  }
  for (let i = 0; i < 3; i++) {
    const crab = makeCrab();
    const home = new THREE.Vector3((rand() * 2 - 1) * 45, 0, 108 + rand() * 7);
    group.add(crab);
    const phase = rand() * 10;
    animated.push({ update: (t) => {
      crab.position.set(home.x + Math.sin(t * 0.6 + phase) * 3, 0, home.z + Math.sin(t * 0.25 + phase) * 0.6);
      crab.userData.legs?.forEach((l, j) => { l.rotation.z = Math.sin(t * 14 + j) * 0.35; });
    } });
  }

  // ---- Drop-off ring at the lifeguard station
  const drop = WORLD.lifeguardDrop;
  const zone = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 40), new THREE.MeshBasicMaterial({ color: 0x4cc35a, transparent: true, opacity: 0.85 }));
  zone.rotation.x = -Math.PI / 2;
  zone.position.set(drop.x, 0.04, drop.z);
  group.add(zone);
  const zoneTex = canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#2e9c3c';
    ctx.font = `700 40px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FIRST AID', w / 2, h / 2);
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), new THREE.MeshBasicMaterial({ map: zoneTex, transparent: true }));
  label.rotation.set(-Math.PI / 2, 0, Math.PI); // reads correctly when arriving from the boardwalk
  label.position.set(drop.x, 0.045, drop.z - 2.6);
  group.add(label);
  animated.push({ update: (t) => { zone.material.opacity = 0.55 + Math.sin(t * 4) * 0.3; } });

  return { group, sea, animated };
}

/* ------------------------------------------------------------------ */

function buildLifeguardTower(group, animated) {
  const { x, z } = BEACH.tower;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  group.add(g);
  const top = 2.6;
  for (const [px, pz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
    const leg = part(new THREE.BoxGeometry(0.22, top, 0.22), WOOD);
    leg.position.set(px, top / 2, pz);
    leg.rotation.set(pz * -0.06, 0, px * 0.06);
    g.add(leg);
  }
  for (const y of [0.9, 1.8]) {
    const brace = part(new THREE.BoxGeometry(2.4, 0.12, 0.12), WOOD, { outline: 0.015 });
    brace.position.set(0, y, -1.1);
    g.add(brace);
  }
  const deck = part(new THREE.BoxGeometry(3, 0.2, 3), WOOD);
  deck.position.y = top;
  g.add(deck);
  const hut = part(new THREE.BoxGeometry(2.4, 1.7, 2.2), 0xfff4e0, { outline: 0.03 });
  hut.position.set(0, top + 0.95, 0.2);
  g.add(hut);
  const roof = part(new THREE.BoxGeometry(2.9, 0.18, 2.7), 0xe0323a, { outline: 0.03 });
  roof.position.set(0, top + 1.9, 0.2);
  roof.rotation.x = -0.12;
  g.add(roof);
  // red cross panel facing the beach (north, towards the boardwalk)
  const crossTex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e0323a';
    ctx.fillRect(w * 0.38, h * 0.14, w * 0.24, h * 0.72);
    ctx.fillRect(w * 0.14, h * 0.38, w * 0.72, h * 0.24);
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: crossTex }));
  panel.position.set(0, top + 1.0, -0.92);
  panel.rotation.y = Math.PI;
  g.add(panel);
  // ladder
  for (const lx of [-0.4, 0.4]) {
    const rail = part(new THREE.BoxGeometry(0.1, 3.2, 0.1), WOOD, { outline: 0.012 });
    rail.position.set(lx, 1.3, -2.1);
    rail.rotation.x = 0.4;
    g.add(rail);
  }
  for (let i = 0; i < 6; i++) {
    const rung = part(new THREE.BoxGeometry(0.8, 0.08, 0.12), WOOD, { outline: 0.01 });
    rung.position.set(0, 0.3 + i * 0.42, -2.55 + i * 0.17);
    g.add(rung);
  }
  // flag
  const pole = part(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), 0xdddddd, { outline: 0.01 });
  pole.position.set(1.2, top + 2.9, 1.2);
  g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshBasicMaterial({ color: 0xe0323a, side: THREE.DoubleSide }));
  flag.position.set(1.65, top + 3.75, 1.2);
  g.add(flag);
  animated.push({ update: (t) => { flag.rotation.y = Math.sin(t * 3) * 0.3; } });
  addBox(x, z - 0.4, 2.8, 3.6);
}

function makeUmbrella(color) {
  const g = new THREE.Group();
  const pole = part(new THREE.CylinderGeometry(0.05, 0.05, 2.9, 6), 0xf2f2f2, { outline: 0.012 });
  pole.position.y = 1.45;
  g.add(pole);
  const tex = canvasTexture(256, 64, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : `#${color.toString(16).padStart(6, '0')}`;
      ctx.fillRect((i * w) / 8, 0, w / 8, h);
    }
  });
  const canopy = part(new THREE.ConeGeometry(1.9, 0.75, 16, 1, true), toon(0xffffff, { map: tex, side: THREE.DoubleSide }), { outline: 0.03 });
  canopy.position.y = 2.85;
  g.add(canopy);
  return g;
}

function makeSandcastle(s) {
  const g = new THREE.Group();
  const base = part(new THREE.CylinderGeometry(1.1, 1.25, 0.7, 12), 0xe2bd6e, { outline: 0.025 });
  base.position.y = 0.35;
  g.add(base);
  const keep = part(new THREE.CylinderGeometry(0.55, 0.62, 0.9, 10), 0xe2bd6e, { outline: 0.02 });
  keep.position.y = 1.15;
  g.add(keep);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const t = part(new THREE.CylinderGeometry(0.22, 0.26, 0.55, 8), 0xe2bd6e, { outline: 0.015 });
    t.position.set(Math.cos(a) * 0.85, 0.95, Math.sin(a) * 0.85);
    g.add(t);
    const cone = part(new THREE.ConeGeometry(0.26, 0.35, 8), 0xd9ae5c, { outline: 0.012 });
    cone.position.set(Math.cos(a) * 0.85, 1.4, Math.sin(a) * 0.85);
    g.add(cone);
  }
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4), toon(0x7a4a26));
  flagPole.position.y = 1.95;
  g.add(flagPole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.22), new THREE.MeshBasicMaterial({ color: 0xe0323a, side: THREE.DoubleSide }));
  flag.position.set(0.18, 2.15, 0);
  g.add(flag);
  g.scale.setScalar(s);
  return g;
}

function makeBucket(color) {
  const g = new THREE.Group();
  const b = part(new THREE.CylinderGeometry(0.28, 0.2, 0.4, 14, 1, true), toon(color, { side: THREE.DoubleSide }), { outline: 0.012 });
  b.position.y = 0.2;
  g.add(b);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.015, 4, 16, Math.PI), toon(0x4cc35a));
  handle.position.y = 0.38;
  g.add(handle);
  const spade = part(new THREE.BoxGeometry(0.05, 0.5, 0.16), 0xe0323a, { outline: 0.008 });
  spade.position.set(0.4, 0.22, 0);
  spade.rotation.z = -0.5;
  g.add(spade);
  return g;
}

function makeCooler() {
  const g = new THREE.Group();
  const box = part(new THREE.BoxGeometry(1.2, 0.75, 0.75), 0x2f7fc1, { outline: 0.02 });
  box.position.y = 0.38;
  g.add(box);
  const lid = part(new THREE.BoxGeometry(1.25, 0.14, 0.8), 0xffffff, { outline: 0.015 });
  lid.position.y = 0.82;
  g.add(lid);
  const crossTex = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e0323a';
    ctx.fillRect(24, 8, 16, 48);
    ctx.fillRect(8, 24, 48, 16);
  });
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.45), new THREE.MeshBasicMaterial({ map: crossTex }));
  cross.position.set(0, 0.4, 0.38);
  g.add(cross);
  const kit = part(new THREE.BoxGeometry(0.6, 0.45, 0.3), 0xf28a1a, { outline: 0.015 });
  kit.position.set(-1.0, 0.23, 0.1);
  g.add(kit);
  const kitCross = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: crossTex }));
  kitCross.position.set(-1.0, 0.25, 0.26);
  g.add(kitCross);
  return g;
}

function makePalm() {
  const g = new THREE.Group();
  let y = 0;
  for (let i = 0; i < 6; i++) {
    const seg = part(new THREE.CylinderGeometry(0.2 - i * 0.015, 0.24 - i * 0.015, 0.9, 8), 0x9a6b3c, { outline: 0.015 });
    seg.position.set(i * i * 0.03, y + 0.45, 0);
    seg.rotation.z = -i * 0.05;
    g.add(seg);
    y += 0.85;
  }
  const crown = new THREE.Group();
  crown.position.set(0.8, y, 0);
  g.add(crown);
  for (let i = 0; i < 7; i++) {
    const leaf = part(new THREE.ConeGeometry(0.35, 2.6, 4), 0x3d9c3a, { outline: 0.02 });
    leaf.scale.z = 0.25;
    leaf.position.y = 0;
    leaf.rotation.set(0, (i / 7) * Math.PI * 2, 1.9);
    leaf.translateY(1.2);
    crown.add(leaf);
  }
  return g;
}

function makeStarfish() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = i % 2 ? 0.12 : 0.32;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const m = part(new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false }), 0xff8a3a, { outline: 0.012 });
  m.rotation.x = -Math.PI / 2;
  return m;
}

/* ---- props used by beach emergencies (exported for missions.js) ---- */

export function makeCrab() {
  const g = new THREE.Group();
  const body = part(new THREE.SphereGeometry(0.22, 12, 8), 0xe0402a, { outline: 0.015 });
  body.scale.set(1.3, 0.6, 1);
  body.position.y = 0.16;
  g.add(body);
  for (const sx of [-1, 1]) {
    const claw = part(new THREE.SphereGeometry(0.09, 8, 6), 0xe0402a, { outline: 0.01 });
    claw.position.set(sx * 0.3, 0.2, 0.18);
    g.add(claw);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), toon(0x111111));
    eye.position.set(sx * 0.07, 0.32, 0.12);
    g.add(eye);
  }
  const legs = [];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 4), toon(0xc0301f));
      leg.position.set(sx * 0.28, 0.08, -0.08 + i * 0.09);
      leg.rotation.z = sx * 0.9;
      g.add(leg);
      legs.push(leg);
    }
  }
  g.userData.legs = legs;
  return g;
}

export function makeFloatRing(color = 0xff5fa2) {
  const tex = canvasTexture(256, 32, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : `#${color.toString(16).padStart(6, '0')}`;
      ctx.fillRect((i * w) / 8, 0, w / 8, h);
    }
  });
  const ring = part(new THREE.TorusGeometry(0.55, 0.2, 10, 24), toon(0xffffff, { map: tex }), { outline: 0.015 });
  ring.rotation.x = Math.PI / 2;
  return ring;
}

export function makeJellyfish() {
  const g = new THREE.Group();
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xd9a8ff, { transparent: true, opacity: 0.75 }));
  g.add(bell);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.01, 0.5, 4), toon(0xc58cf0, { transparent: true, opacity: 0.7 }));
    t.position.set(Math.cos(a) * 0.18, -0.25, Math.sin(a) * 0.18);
    g.add(t);
  }
  return g;
}

export function makeBeachBall() {
  const tex = canvasTexture(256, 128, (ctx, w, h) => {
    const cols = ['#e0323a', '#ffffff', '#2f7fc1', '#ffffff', '#ffd23f', '#ffffff'];
    cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect((i * w) / 6, 0, w / 6, h); });
  });
  return part(new THREE.SphereGeometry(0.32, 18, 12), toon(0xffffff, { map: tex }), { outline: 0.015 });
}

export function makeSunscreen() {
  const g = new THREE.Group();
  const bottle = part(new THREE.CylinderGeometry(0.1, 0.12, 0.38, 10), 0xffb000, { outline: 0.01 });
  bottle.position.y = 0.19;
  g.add(bottle);
  const cap = part(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), 0xffffff, { outline: 0.008 });
  cap.position.y = 0.43;
  g.add(cap);
  return g;
}
