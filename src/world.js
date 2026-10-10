// The open world: shared terrain + walkable areas, and Zone 1 (the Park: playground, pond, hospital).
// The Beach lives in beach.js and is reached through the park's south gate along the boardwalk.
import * as THREE from 'three';
import { part, toon, instanced, signTexture, canvasTexture, FONT } from './toon.js';

export const WORLD = {
  half: 56, // park half-size (fence at half + 1)
  hospitalDoor: new THREE.Vector3(0, 0, -41),
  // Beach: sand from z=beachStart, the sea starts at the shoreline, wading allowed until wadeLimit
  beachStart: 80,
  shoreline: 116,
  wadeLimit: 127,
  lifeguardDrop: new THREE.Vector3(-22, 0, 96),
  pond: { x: 20, z: -14, r: 7.5 },
  tower: { x: -15, z: 6, top: 2.4 },
  swings: { x: 15, z: 9 },
  stand: { x: -7, z: -24 },
};

const colliders = []; // { type:'circle', x, z, r } | { type:'box', minX, maxX, minZ, maxZ }
export const cameraBlockers = []; // meshes the follow camera may not pass through (see FollowCamera)
const platforms = []; // { minX, maxX, minZ, maxZ, y }

export function getColliders() { return colliders; }

export function groundHeight(x, z) {
  let h = 0;
  for (const p of platforms) {
    if (x > p.minX && x < p.maxX && z > p.minZ && z < p.maxZ) h = Math.max(h, p.y);
  }
  return h;
}

export function inPond(x, z) {
  const { pond } = WORLD;
  return Math.hypot(x - pond.x, z - pond.z) < pond.r - 0.6;
}

/** True where Doctor Guy is wading (pond or the shallow sea) — slower, and he sinks to the knees. */
export function inWater(x, z) {
  return inPond(x, z) || z > WORLD.shoreline + 1;
}

/** Which zone a point belongs to (drives streaming, spawning and the zone banner). */
export const zoneAt = (z, x = 0) => (z < -300 ? 'hospital' : x > 100 ? 'zoo' : z > 62 ? 'beach' : 'park');

/** GTA-style location name for the corner label. */
export function locationName(p) {
  if (p.z < -300) return p.z < -413.5 ? 'X-Ray · Wolfson Medical Center' : 'Wolfson Medical Center';
  if (p.x > 137) return 'Wolfson City Zoo';
  if (p.x > 56) return 'Zoo Road';
  if (p.z > 82) return 'Sunny Beach';
  if (p.z > 56) return 'The Boardwalk';
  if (p.z < -30) return 'Hospital Plaza';
  return 'Wolfson Park';
}

// Walkable areas: the park, the boardwalk through the south gate, and the beach up to wading depth
const WALKABLE = [
  { minX: -55.5, maxX: 55.5, minZ: -55.5, maxZ: 55.5 },
  { minX: -2.1, maxX: 2.1, minZ: 50, maxZ: 82 },
  { minX: -57, maxX: 57, minZ: 79, maxZ: 127 },
  { minX: -17.6, maxX: 17.6, minZ: -413.6, maxZ: -386.6 }, // inside the hospital (see hospital.js)
  { minX: -5.6, maxX: 5.6, minZ: -425.6, maxZ: -413.0 }, // its X-ray room
  { minX: 50, maxX: 140, minZ: -40.4, maxZ: -33.6 }, // Zoo Road, through the park's east gate (see zoo.js)
  { minX: 137.5, maxX: 232.5, minZ: -45.5, maxZ: 45.5 }, // the zoo
];

/** Keeps a position inside the walkable areas (moves it to the nearest one if it left them all). */
export function clampWalkable(p) {
  let best = null, bestD = Infinity;
  for (const r of WALKABLE) {
    const x = THREE.MathUtils.clamp(p.x, r.minX, r.maxX);
    const z = THREE.MathUtils.clamp(p.z, r.minZ, r.maxZ);
    const d = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d === 0) return;
    if (d < bestD) { bestD = d; best = [x, z]; }
  }
  p.x = best[0];
  p.z = best[1];
}

/** For other zone modules that register their own colliders. */
export { addBox, addCircle };

function addBox(cx, cz, w, d) {
  colliders.push({ type: 'box', minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
}
function addCircle(x, z, r) { colliders.push({ type: 'circle', x, z, r }); }

const rand = (() => {
  let s = 1337;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
})();

function keepClear(x, z) {
  // Areas where trees shouldn't spawn
  const zones = [
    [0, 0, 7], // central fountain
    [WORLD.tower.x, WORLD.tower.z, 9],
    [WORLD.swings.x, WORLD.swings.z, 8],
    [WORLD.pond.x, WORLD.pond.z, WORLD.pond.r + 3],
    [WORLD.stand.x, WORLD.stand.z, 5],
    [24, 24, 4],
    [-30, 21, 3], // mission spots
    [38, -6, 3],
    [-45, 43, 2.5],
  ];
  if (zones.some(([zx, zz, r]) => Math.hypot(x - zx, z - zz) < r)) return false;
  const rr = Math.hypot(x, z);
  if (rr > 20.5 && rr < 25.5) return false; // ring path
  if (Math.abs(x) < 3.5 && z < -20) return false; // hospital path
  if (z < -34) return false; // hospital plaza
  if (Math.abs(x) < 6 && z > 44) return false; // path to the south gate
  if (Math.abs(z + 37) < 6) return false; // Zoo Road
  return true;
}

export function buildWorld(scene) {
  colliders.length = 0;
  platforms.length = 0;
  cameraBlockers.length = 0;
  const world = new THREE.Group(); // park props (hidden when far away, see main.js)
  scene.add(world);
  const base = new THREE.Group(); // always visible: sky and ground
  scene.add(base);
  const animated = []; // { update(t, dt) }

  // ---- Sky dome
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x3d8fe0) }, bottom: { value: new THREE.Color(0xc4ecff) } },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
        void main(){ float h = clamp(normalize(vP).y*1.6, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }`,
    }),
  );
  base.add(sky);

  // ---- Ground (big enough for park, boardwalk and beach)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), toon(0x6cc24a));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  base.add(ground);
  // path from the fountain spoke out to the south gate
  const gatePath = new THREE.Mesh(new THREE.PlaneGeometry(4, 22), toon(0xe6c88f));
  gatePath.rotation.x = -Math.PI / 2;
  gatePath.position.set(0, 0.021, 46);
  gatePath.receiveShadow = true;
  world.add(gatePath);

  const pathMat = toon(0xe6c88f);
  const ring = new THREE.Mesh(new THREE.RingGeometry(21, 25, 72), pathMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.receiveShadow = true;
  world.add(ring);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(5, 22), pathMat);
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0.021, -31);
  lane.receiveShadow = true;
  world.add(lane);
  for (const [x, z, rot] of [[0, 11, 0], [0, -11, 0], [11, 0, Math.PI / 2], [-11, 0, Math.PI / 2]]) {
    const spoke = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 15), pathMat);
    spoke.rotation.set(-Math.PI / 2, 0, rot);
    spoke.position.set(x, 0.019, z);
    spoke.receiveShadow = true;
    world.add(spoke);
  }
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(7, 40), pathMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.022;
  plaza.receiveShadow = true;
  world.add(plaza);

  // Playground sand pits
  for (const [x, z, r] of [[WORLD.tower.x, WORLD.tower.z, 7.5], [WORLD.swings.x, WORLD.swings.z, 6.5]]) {
    const pit = new THREE.Mesh(new THREE.CircleGeometry(r, 40), toon(0xd9a86a));
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(x, 0.025, z);
    pit.receiveShadow = true;
    world.add(pit);
  }

  // ---- Central fountain
  const fountain = new THREE.Group();
  fountain.add(Object.assign(part(new THREE.CylinderGeometry(3, 3.2, 0.7, 32), 0xbfc7d1), { receiveShadow: true }));
  fountain.children[0].position.y = 0.35;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.1, 32), toon(0x3fa9f5));
  water.position.y = 0.62;
  fountain.add(water);
  const pillar = part(new THREE.CylinderGeometry(0.35, 0.5, 1.6, 16), 0xbfc7d1);
  pillar.position.y = 1.2;
  fountain.add(pillar);
  const bowl = part(new THREE.CylinderGeometry(1.1, 0.4, 0.4, 20), 0xbfc7d1);
  bowl.position.y = 2.0;
  fountain.add(bowl);
  const spray = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 16, 1, true), toon(0x9ddcff, { transparent: true, opacity: 0.7 }));
  spray.position.y = 2.7;
  fountain.add(spray);
  animated.push({ update: (t) => { spray.scale.set(1 + Math.sin(t * 6) * 0.08, 1 + Math.sin(t * 4) * 0.12, 1 + Math.sin(t * 6) * 0.08); } });
  world.add(fountain);
  addCircle(0, 0, 3.3);

  // ---- Playground tower + slide (red roof, like the art)
  buildTower(world, animated);

  // ---- Swing set
  const swingSeats = buildSwings(world, animated);

  // ---- Pond
  buildPond(world, animated);

  // ---- Hospital
  buildHospital(world, animated);

  // ---- Lollipop stand
  buildStand(world);

  // ---- Signs
  const sign = buildSign(['HEALTHY', 'KIDS', 'HAPPIER', 'TOMORROWS'], {
    extra: (ctx, w) => {
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.arc(w - 70, 70, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0323a';
      ctx.font = `700 60px ${FONT}`;
      ctx.fillText('♥', w / 2, 345);
    },
    fg: '#1e3fa0', size: 62,
  });
  sign.position.set(26, 0, 26);
  sign.rotation.y = -Math.PI * 0.75;
  world.add(sign);
  addCircle(26, 26, 1.3);

  const sign2 = buildSign(['SMALL PATIENTS', 'BIG DREAMS'], { size: 56, fg: '#1b1b1b' });
  sign2.position.set(-26, 0, -18);
  sign2.rotation.y = Math.PI * 0.3;
  world.add(sign2);
  addCircle(-26, -18, 1.3);

  // ---- Benches & lamps along the ring path
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    const lamp = buildLamp();
    lamp.position.set(Math.cos(a) * 26, 0, Math.sin(a) * 26);
    world.add(lamp);
    addCircle(lamp.position.x, lamp.position.z, 0.3);
    if (i % 2 === 0) {
      const b = buildBench();
      const ba = a + 0.13;
      b.position.set(Math.cos(ba) * 26.2, 0, Math.sin(ba) * 26.2);
      b.rotation.y = -ba - Math.PI / 2;
      world.add(b);
      addCircle(b.position.x, b.position.z, 1.0);
    }
  }

  // ---- Trees, bushes, flowers (instanced)
  buildVegetation(world);

  // ---- Fence around park
  buildFence(world);

  // ---- City skyline
  buildSkyline(world);

  // ---- Clouds
  buildClouds(world, animated);

  return { world, base, animated, swingSeats };
}

/* ------------------------------------------------------------------ */

function buildTower(world, animated) {
  const { x, z, top } = WORLD.tower;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  world.add(g);
  const blue = 0x2457c5;
  for (const [px, pz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) {
    const post = part(new THREE.CylinderGeometry(0.12, 0.12, top + 2.2, 10), blue);
    post.position.set(px, (top + 2.2) / 2, pz);
    g.add(post);
  }
  const deck = part(new THREE.BoxGeometry(2.9, 0.2, 2.9), 0xffc61a);
  deck.position.y = top;
  deck.receiveShadow = true;
  g.add(deck);
  // rails
  for (const [rx, rz, w, d] of [[0, -1.35, 2.7, 0.08], [-1.35, 0, 0.08, 2.7]]) {
    const rail = part(new THREE.BoxGeometry(w, 0.08, d), 0xffc61a);
    rail.position.set(rx, top + 0.9, rz);
    g.add(rail);
    const panel = part(new THREE.BoxGeometry(w, 0.6, d), 0xf6a51a);
    panel.position.set(rx, top + 0.4, rz);
    g.add(panel);
  }
  const roof = part(new THREE.ConeGeometry(2.4, 1.6, 4), 0xe0323a, { outline: 0.04 });
  roof.position.y = top + 3.0;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);

  // Ladder (on -x side)
  const ladder = new THREE.Group();
  ladder.position.set(-1.9, 0, 0.6);
  ladder.rotation.z = -0.25;
  for (const lz of [-0.35, 0.35]) {
    const rail = part(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 8), blue);
    rail.position.set(0, 1.3, lz);
    ladder.add(rail);
  }
  for (let i = 0; i < 6; i++) {
    const rung = part(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), 0xffc61a, { outline: 0.012 });
    rung.rotation.x = Math.PI / 2;
    rung.position.set(0, 0.3 + i * 0.4, 0);
    ladder.add(rung);
  }
  g.add(ladder);

  // Slide (towards +x)
  const slideLen = 5.2;
  const slide = new THREE.Group();
  slide.position.set(1.45, top, 0);
  const angle = Math.atan2(top - 0.3, slideLen);
  slide.rotation.z = -angle;
  const bed = part(new THREE.BoxGeometry(Math.hypot(slideLen, top), 0.1, 1.0), 0xe0323a);
  bed.position.x = Math.hypot(slideLen, top) / 2;
  slide.add(bed);
  for (const sz of [-0.5, 0.5]) {
    const wall = part(new THREE.BoxGeometry(Math.hypot(slideLen, top), 0.3, 0.08), 0xe0323a);
    wall.position.set(Math.hypot(slideLen, top) / 2, 0.15, sz);
    slide.add(wall);
  }
  g.add(slide);

  addBox(x, z, 3.0, 3.0);
  addBox(x - 2.0, z + 0.6, 0.6, 1.0);
  // slide footprint (series of small circles so you can't walk through)
  for (let i = 0.5; i < slideLen; i += 1) addCircle(x + 1.6 + i, z, 0.6);
  platforms.push({ minX: x - 1.45, maxX: x + 1.45, minZ: z - 1.45, maxZ: z + 1.45, y: top + 0.1 });
}

function buildSwings(world, animated) {
  const { x, z } = WORLD.swings;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  world.add(g);
  const blue = 0x2457c5;
  const H = 3.4;
  const beam = part(new THREE.CylinderGeometry(0.12, 0.12, 7, 10), blue);
  beam.rotation.z = Math.PI / 2;
  beam.position.y = H;
  g.add(beam);
  for (const sx of [-3.4, 3.4]) {
    for (const sz of [-1, 1]) {
      const leg = part(new THREE.CylinderGeometry(0.1, 0.1, H / Math.cos(0.3) + 0.1, 10), blue);
      leg.position.set(sx, H / 2, sz * Math.tan(0.3) * H / 2);
      leg.rotation.x = sz * -0.3;
      g.add(leg);
    }
    addCircle(x + sx, z - 1, 0.35);
    addCircle(x + sx, z + 1, 0.35);
  }
  const seats = [];
  [-2, 0, 2].forEach((sx, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx, H, 0);
    g.add(pivot);
    for (const cx of [-0.3, 0.3]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, H - 0.7, 4), toon(0x555555));
      chain.position.set(cx, -(H - 0.7) / 2, 0);
      pivot.add(chain);
    }
    const seat = part(new THREE.BoxGeometry(0.75, 0.08, 0.35), 0x1b1b1b, { outline: 0.012 });
    seat.position.y = -(H - 0.7);
    pivot.add(seat);
    const phase = i * 1.7;
    const amp = i === 1 ? 0 : 0.55;
    const state = { pivot, seat, amp, phase };
    animated.push({ update: (t) => { pivot.rotation.x = Math.sin(t * 2.2 + phase) * state.amp; } });
    seats.push(state);
  });
  return seats;
}

function buildPond(world, animated) {
  const { x, z, r } = WORLD.pond;
  const water = new THREE.Mesh(new THREE.CircleGeometry(r, 48), toon(0x3fa9f5, { transparent: true, opacity: 0.9 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, 0.05, z);
  water.receiveShadow = true;
  world.add(water);
  const deep = new THREE.Mesh(new THREE.CircleGeometry(r * 0.55, 32), toon(0x2a84d4, { transparent: true, opacity: 0.8 }));
  deep.rotation.x = -Math.PI / 2;
  deep.position.set(x, 0.055, z);
  world.add(deep);
  // Rocks around
  const mats = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rand() * 0.1;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x + Math.cos(a) * (r + 0.2), 0.15, z + Math.sin(a) * (r + 0.2)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(), rand() * 3, 0)),
      new THREE.Vector3(0.6 + rand() * 0.4, 0.4 + rand() * 0.3, 0.6 + rand() * 0.4),
    );
    mats.push(m);
  }
  world.add(instanced(new THREE.DodecahedronGeometry(0.6, 0), 0x9aa3ad, mats, { outline: 0.03 }));
  // Lily pads
  for (let i = 0; i < 6; i++) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12, 0.3, Math.PI * 1.8), toon(0x3d9c3a));
    pad.rotation.x = -Math.PI / 2;
    const a = rand() * Math.PI * 2, d = 2 + rand() * (r - 3);
    pad.position.set(x + Math.cos(a) * d, 0.07, z + Math.sin(a) * d);
    world.add(pad);
  }
  // A duck
  const duck = new THREE.Group();
  const db = part(new THREE.SphereGeometry(0.3, 12, 10), 0xffffff, { outline: 0.02 });
  db.scale.set(1.3, 0.8, 1);
  duck.add(db);
  const dh = part(new THREE.SphereGeometry(0.18, 12, 10), 0x2f8a4a, { outline: 0.02 });
  dh.position.set(0.32, 0.3, 0);
  duck.add(dh);
  const beak = part(new THREE.ConeGeometry(0.07, 0.18, 8), 0xff9a1a, { outline: 0.01 });
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.52, 0.28, 0);
  duck.add(beak);
  world.add(duck);
  animated.push({ update: (t) => {
    const a = t * 0.25;
    duck.position.set(x + Math.cos(a) * 4.5, 0.12 + Math.sin(t * 3) * 0.03, z + Math.sin(a) * 4.5);
    duck.rotation.y = -a - Math.PI;
  } });
}

function buildHospital(world, animated) {
  const g = new THREE.Group();
  g.position.set(0, 0, -52);
  world.add(g);

  const facade = canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#efe3cf';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 10; col++) {
        if (row === 2 && col >= 4 && col <= 5) continue;
        const x = 24 + col * 100, y = 30 + row * 160;
        ctx.fillStyle = '#5b8fd0';
        ctx.fillRect(x, y, 76, 110);
        ctx.fillStyle = '#9cc4f0';
        ctx.fillRect(x + 6, y + 6, 30, 98);
        ctx.strokeStyle = '#2b3d55';
        ctx.lineWidth = 6;
        ctx.strokeRect(x, y, 76, 110);
      }
    }
  });
  const sideMat = toon(0xefe3cf);
  const frontMat = toon(0xffffff, { map: facade });
  const body = part(new THREE.BoxGeometry(34, 14, 10), [sideMat, sideMat, toon(0xd8ccb8), sideMat, frontMat, sideMat], { outline: 0.06, receive: true });
  cameraBlockers.push(body);
  body.position.y = 7;
  g.add(body);
  // Roof trim
  const trim = part(new THREE.BoxGeometry(35, 0.6, 11), 0x4a77b8, { outline: 0.04 });
  trim.position.y = 14.3;
  g.add(trim);

  // Big sign board on the roof (like the art)
  const signTex = canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f4ead8';
    ctx.fillRect(0, 0, w, h);
    // Logo blocks
    const lx = w / 2 - 90, ly = 30;
    ctx.fillStyle = '#2458b8'; ctx.fillRect(lx, ly, 80, 80);
    ctx.fillStyle = '#f0b400'; ctx.fillRect(lx + 100, ly, 80, 80);
    ctx.fillStyle = '#e0323a'; ctx.beginPath(); ctx.arc(lx + 40, ly + 140, 40, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1f8a4a'; ctx.fillRect(lx + 100, ly + 100, 80, 80);
    ctx.fillStyle = '#1e2e5c';
    ctx.textAlign = 'center';
    ctx.font = `700 92px ${FONT}`;
    ctx.fillText('WOLFSON', w / 2, 330);
    ctx.font = `600 62px ${FONT}`;
    ctx.fillText('MEDICAL CENTER', w / 2, 420);
  });
  const board = part(new THREE.BoxGeometry(12, 6, 0.4), toon(0xf4ead8), { outline: 0.05 });
  board.material = [toon(0xf4ead8), toon(0xf4ead8), toon(0xf4ead8), toon(0xf4ead8), new THREE.MeshBasicMaterial({ map: signTex }), toon(0xf4ead8)];
  board.position.set(8, 17.8, 3);
  g.add(board);
  for (const px of [4, 12]) {
    const leg = part(new THREE.BoxGeometry(0.4, 1.4, 0.4), 0x8a8f99);
    leg.position.set(px, 15.1, 3);
    g.add(leg);
  }

  // Entrance: canopy, doors, red cross
  const canopy = part(new THREE.BoxGeometry(10, 0.5, 5), 0xffffff, { outline: 0.04 });
  canopy.position.set(0, 4.5, 7.3);
  g.add(canopy);
  for (const px of [-4.6, 4.6]) {
    const p = part(new THREE.CylinderGeometry(0.2, 0.2, 4.5, 12), 0xd0d4da);
    p.position.set(px, 2.25, 9.4);
    g.add(p);
    addCircle(px, -52 + 9.4, 0.35);
  }
  const doors = part(new THREE.BoxGeometry(5, 3.8, 0.2), 0x7fb8e8, { outline: 0.03 });
  doors.position.set(0, 1.9, 5.05);
  g.add(doors);
  const crossBg = part(new THREE.CylinderGeometry(1.1, 1.1, 0.2, 32), 0xffffff, { outline: 0.03 });
  crossBg.rotation.x = Math.PI / 2;
  crossBg.position.set(0, 6.8, 7.4);
  g.add(crossBg);
  for (const [w, h] of [[0.5, 1.5], [1.5, 0.5]]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.25), toon(0xe0323a));
    c.position.set(0, 6.8, 7.45);
    g.add(c);
  }

  // (the ambulance is a drivable vehicle now — see vehicle.js)

  // Planters by the entrance
  for (const px of [-8, 8]) {
    const pl = part(new THREE.BoxGeometry(3, 0.8, 1.2), 0xb07a4a);
    pl.position.set(px, 0.4, 6.3);
    g.add(pl);
    const bush = part(new THREE.SphereGeometry(0.9, 12, 10), 0x3d9c3a);
    bush.scale.set(1.5, 0.8, 0.7);
    bush.position.set(px, 1.2, 6.3);
    g.add(bush);
    addBox(px, -52 + 6.3, 3, 1.2);
  }

  addBox(0, -52, 34, 10);

  // Drop-off zone marker
  const zone = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 2.1, 40),
    new THREE.MeshBasicMaterial({ color: 0x4cc35a, transparent: true, opacity: 0.85 }),
  );
  zone.rotation.x = -Math.PI / 2;
  zone.position.set(0, 0.04, -41);
  world.add(zone);
  const zoneTex = canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#4cc35a';
    ctx.font = `700 40px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DROP-OFF', w / 2, h / 2);
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), new THREE.MeshBasicMaterial({ map: zoneTex, transparent: true }));
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.045, -38.2);
  world.add(label);
  animated.push({ update: (t) => { zone.material.opacity = 0.55 + Math.sin(t * 4) * 0.3; } });
}

function buildStand(world) {
  const { x, z } = WORLD.stand;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI / 2;
  world.add(g);
  const wood = 0x9a6234;
  const top = part(new THREE.BoxGeometry(3, 0.15, 1.3), wood);
  top.position.y = 1.05;
  g.add(top);
  for (const [lx, lz] of [[-1.35, -0.5], [1.35, -0.5], [-1.35, 0.5], [1.35, 0.5]]) {
    const leg = part(new THREE.BoxGeometry(0.14, 1.0, 0.14), wood);
    leg.position.set(lx, 0.5, lz);
    g.add(leg);
  }
  const box = part(new THREE.BoxGeometry(1.4, 0.35, 0.9), 0xc89a62);
  box.position.set(-0.5, 1.3, 0);
  g.add(box);
  // Lollipops in the box
  const colors = [0xe0323a, 0x2f7fc1, 0x4cc35a, 0xc66bd6, 0xffb000];
  for (let i = 0; i < 14; i++) {
    const pop = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 14), toon(colors[i % colors.length]));
    pop.rotation.x = Math.PI / 2 - 0.3;
    pop.position.set(-0.5 + ((i % 5) - 2) * 0.24, 1.55 + (i % 2) * 0.05, -0.25 + Math.floor(i / 5) * 0.25);
    g.add(pop);
  }
  // Front sign
  const tex = signTexture(['SMILES', 'MAKE', 'HEALING', 'EASIER'], {
    w: 512, h: 400, size: 70, fg: '#2541a8',
    extra: (ctx, w) => {
      ctx.fillStyle = '#e0323a';
      ctx.font = `700 70px ${FONT}`;
      ctx.fillText('♥', w - 60, 70);
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.arc(w - 60, 330, 34, 0, Math.PI * 2); ctx.fill();
    },
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.25), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(0.6, 0.55, 0.66);
  g.add(sign);
  addBox(x, z, 1.4, 3.1);
}

function buildSign(lines, opts) {
  const g = new THREE.Group();
  const tex = signTexture(lines, { w: 512, h: 400, ...opts });
  const board = part(new THREE.BoxGeometry(3, 2.35, 0.15), 0xfff8e6, { outline: 0.03 });
  board.material = [toon(0xfff8e6), toon(0xfff8e6), toon(0xfff8e6), toon(0xfff8e6), new THREE.MeshBasicMaterial({ map: tex }), toon(0xfff8e6)];
  board.position.y = 2.4;
  g.add(board);
  for (const px of [-1.2, 1.2]) {
    const post = part(new THREE.BoxGeometry(0.16, 2.4, 0.16), 0x7a4a26);
    post.position.set(px, 1.2, -0.12);
    g.add(post);
  }
  return g;
}

function buildLamp() {
  const g = new THREE.Group();
  const pole = part(new THREE.CylinderGeometry(0.07, 0.1, 3.6, 8), 0x2b2f38);
  pole.position.y = 1.8;
  g.add(pole);
  const head = part(new THREE.CylinderGeometry(0.22, 0.32, 0.5, 8), 0x2b2f38);
  head.position.y = 3.75;
  g.add(head);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), toon(0xfff3b0, { emissive: 0x6a5a20 }));
  bulb.position.y = 3.5;
  g.add(bulb);
  return g;
}

function buildBench() {
  const g = new THREE.Group();
  const wood = 0x9a6234;
  const seat = part(new THREE.BoxGeometry(2, 0.12, 0.6), wood);
  seat.position.y = 0.5;
  g.add(seat);
  const back = part(new THREE.BoxGeometry(2, 0.5, 0.1), wood);
  back.position.set(0, 0.9, -0.28);
  g.add(back);
  for (const lx of [-0.85, 0.85]) {
    const leg = part(new THREE.BoxGeometry(0.1, 0.5, 0.55), 0x2b2f38);
    leg.position.set(lx, 0.25, 0);
    g.add(leg);
  }
  return g;
}

function buildVegetation(world) {
  const trunks = [], crowns = [], crownColors = [], bushes = [], flowers = [], flowerColors = [];
  let placed = 0, tries = 0;
  while (placed < 70 && tries < 3000) {
    tries++;
    const x = (rand() * 2 - 1) * (WORLD.half - 3);
    const z = (rand() * 2 - 1) * (WORLD.half - 3);
    if (!keepClear(x, z)) continue;
    if (colliders.some((c) => c.type === 'circle' && Math.hypot(c.x - x, c.z - z) < c.r + 2.5)) continue;
    const h = 2 + rand() * 1.5;
    const s = 0.9 + rand() * 0.6;
    trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)));
    const green = [0x3d9c3a, 0x4bb043, 0x2f8a35][Math.floor(rand() * 3)];
    for (const [ox, oy, oz, r] of [[0, 1.2, 0, 1.5], [0.7, 0.5, 0.3, 1.0], [-0.6, 0.6, -0.4, 1.1], [0.1, 0.4, -0.8, 0.9]]) {
      crowns.push(new THREE.Matrix4().compose(
        new THREE.Vector3(x + ox * s, h + oy * s, z + oz * s), new THREE.Quaternion(), new THREE.Vector3(r * s, r * s, r * s),
      ));
      crownColors.push(green);
    }
    addCircle(x, z, 0.5);
    placed++;
  }
  world.add(instanced(new THREE.CylinderGeometry(0.22, 0.32, 1, 8), 0x7a4a26, trunks, { outline: 0.04 }));
  world.add(instanced(new THREE.IcosahedronGeometry(1, 2), 0x3d9c3a, crowns, { outline: 0.05, colors: crownColors }));

  for (let i = 0; i < 90; i++) {
    const x = (rand() * 2 - 1) * (WORLD.half - 2);
    const z = (rand() * 2 - 1) * (WORLD.half - 2);
    if (!keepClear(x, z)) continue;
    const s = 0.6 + rand() * 0.5;
    bushes.push(new THREE.Matrix4().compose(new THREE.Vector3(x, s * 0.5, z), new THREE.Quaternion(), new THREE.Vector3(s * 1.3, s, s * 1.2)));
  }
  world.add(instanced(new THREE.IcosahedronGeometry(1, 1), 0x4bb043, bushes, { outline: 0.04 }));

  const palette = [0xff6fa8, 0xffffff, 0xffd400, 0xff7a3a, 0xb27bff];
  for (let i = 0; i < 260; i++) {
    const x = (rand() * 2 - 1) * WORLD.half;
    const z = (rand() * 2 - 1) * WORLD.half;
    if (!keepClear(x, z)) continue;
    flowers.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.12, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
    flowerColors.push(palette[i % palette.length]);
  }
  world.add(instanced(new THREE.SphereGeometry(0.12, 6, 4), 0xffffff, flowers, { outline: 0, cast: false, colors: flowerColors }));
}

function buildFence(world) {
  const pickets = [];
  const H = WORLD.half + 1;
  for (let i = -H; i <= H; i += 0.8) {
    for (const [x, z] of [[i, -H], [i, H], [-H, i], [H, i]]) {
      if (z === -H && Math.abs(x) < 20) continue; // hospital side open
      if (z === H && Math.abs(x) < 3) continue; // south gate to the beach
      if (x === H && Math.abs(z + 37) < 4) continue; // east gate: Zoo Road
      pickets.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.55, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
    }
  }
  world.add(instanced(new THREE.BoxGeometry(0.14, 1.1, 0.14), 0xffffff, pickets, { outline: 0.025 }));
  const halfRail = (H - 3) / 2;
  // east rail is split by the road (z = -37 ± 4)
  const eastN = (-H + (-41)) / 2, eastS = (-33 + H) / 2;
  for (const [x, z, w, d] of [[-(3 + halfRail), H, 2 * halfRail, 0.08], [3 + halfRail, H, 2 * halfRail, 0.08], [-H, 0, 0.08, 2 * H], [H, eastN, 0.08, -41 + H], [H, eastS, 0.08, H + 33]]) {
    const rail = part(new THREE.BoxGeometry(w, 0.1, d), 0xffffff, { outline: 0.02 });
    rail.position.set(x, 0.8, z);
    world.add(rail);
  }
}

function buildSkyline(world) {
  const mats = [], colors = [];
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    if (Math.sin(a) < -0.6) continue; // keep the hospital backdrop clean
    if (Math.sin(a) > 0.05) continue; // the south is open sea
    if (Math.cos(a) > 0.35) continue; // the east is Zoo Road and the zoo
    const d = 95 + rand() * 30;
    const h = 10 + rand() * 30;
    const w = 6 + rand() * 8;
    mats.push(new THREE.Matrix4().compose(
      new THREE.Vector3(Math.cos(a) * d, h / 2, Math.sin(a) * d),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)),
      new THREE.Vector3(w, h, w),
    ));
    colors.push([0x7d9fcf, 0x8fb0dc, 0x6e8fc2, 0xa2bde3][i % 4]);
  }
  world.add(instanced(new THREE.BoxGeometry(1, 1, 1), 0x8fb0dc, mats, { outline: 0, cast: false, colors }));
}

function buildClouds(world, animated) {
  const clouds = new THREE.Group();
  world.add(clouds);
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Group();
    const n = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < n; j++) {
      const p = part(new THREE.SphereGeometry(3 + rand() * 2, 14, 10), 0xffffff, { outline: 0.2, cast: false });
      p.position.set(j * 3.5 - n * 1.7, rand() * 1.5, rand() * 2);
      c.add(p);
    }
    c.position.set((rand() * 2 - 1) * 150, 45 + rand() * 25, (rand() * 2 - 1) * 150);
    clouds.add(c);
  }
  animated.push({ update: (t, dt) => {
    for (const c of clouds.children) {
      c.position.x += dt * 1.5;
      if (c.position.x > 170) c.position.x = -170;
    }
  } });
}
