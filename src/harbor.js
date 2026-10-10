// Zone 8 — Wolfson Harbor: the docks south of Downtown, down Harbor Road. Warehouses, a container yard with a
// working gantry crane, the fish market, a cargo ship moored at the quay, a jetty with bobbing fishing boats and
// seagulls wheeling overhead.
import * as THREE from 'three';
import { part, toon, instanced, canvasTexture, signTexture, FONT } from './toon.js';
import { addBox, addCircle } from './world.js';
import { scatter, KIT_SIZES, WALL_TINTS } from './kit.js';
import { buildStreets, street, gx, gz } from './streets.js';
import { seeded, slab, streetLamps, buildings, addCameraBlocker, signBoard } from './cityprops.js';

const ROAD_I = -13; // Harbor Road continues Downtown's avenue at x = -111.5
export const HARBOR = {
  x0: -199.5, x1: -92, z0: 52, z1: 115.5, // the quay (land)
  roadX: gx(ROAD_I), roadJ: [13, 20], // z = 54 … 103
  yard: { x0: -192, x1: -150, z0: 82, z1: 102 },
  market: { x: -132, z: 100, w: 16, d: 8 },
  ship: { x: -168, z: 124, len: 46, beam: 11 },
  jetty: { x0: -103, x1: -99, z0: 114, z1: 140 },
  boats: [],
};
export const HARBOR_SPOTS = {};
export const HB_MAP = { buildings: [], containers: [] };
/** On the jetty deck (over the water). */
export const onJetty = (x, z) => x > HARBOR.jetty.x0 && x < HARBOR.jetty.x1 && z > HARBOR.jetty.z0 - 1 && z < HARBOR.jetty.z1;

export function buildHarbor(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const animated = [];
  const rand = seeded(2468);
  const blockers = [];
  const lampPts = [];
  const H = HARBOR;

  // ---- ground: concrete quay with expansion joints, a darker asphalt yard, the quay edge
  const conc = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c4c8cc'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#a9aeb4'; ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) { ctx.fillStyle = 'rgba(120,125,130,0.25)'; ctx.fillRect((i * 83) % w, (i * 47) % h, 6, 6); }
  });
  slab(group, H.x0 - 1, H.z0, H.x1 + 1, H.z1 + 0.5, 0xffffff, { y: 0.012, map: conc, repeat: [(H.x1 - H.x0) / 8, (H.z1 - H.z0) / 8] });
  slab(group, H.yard.x0 - 2, H.yard.z0 - 2, H.yard.x1 + 2, H.yard.z1 + 2, 0x6a7078, { y: 0.02 });
  const edge = part(new THREE.BoxGeometry(H.x1 - H.x0 + 2, 0.6, 1), 0x8f98a2, { outline: 0.02 });
  edge.position.set((H.x0 + H.x1) / 2, -0.1, H.z1 + 0.5);
  group.add(edge);
  // yellow safety line along the quay edge, bollards
  slab(group, H.x0, H.z1 - 1.1, H.x1, H.z1 - 0.8, 0xffd23f, { y: 0.03 });
  const bollards = [];
  for (let x = H.x0 + 4; x < H.x1 - 2; x += 8) { bollards.push(new THREE.Matrix4().makeTranslation(x, 0.35, H.z1 - 0.3)); addCircle(x, H.z1 - 0.3, 0.3); }
  group.add(instanced(new THREE.CylinderGeometry(0.22, 0.28, 0.7, 10), 0x2b2f38, bollards, { outline: 0.012 }));
  HARBOR_SPOTS.bollards = bollards.map((m) => new THREE.Vector3().setFromMatrixPosition(m));

  // ---- Harbor Road: Downtown's avenue carries on south to the quay
  const cells = street(new Set(), ROAD_I, H.roadJ[0], ROAD_I, H.roadJ[1]);
  const { group: sg, tiles } = buildStreets(cells, { extra: new Set([`${ROAD_I},${H.roadJ[0] - 1}`]) });
  group.add(sg);
  H.streets = tiles;

  // ---- warehouses down both sides of Harbor Road (painted in dock colours), chimneys and tanks behind
  const list = [];
  // west side faces east (front towards the road), east side faces west; two each, end before the fish market
  const side = (name, sc, z0, west, wall) => {
    const w = KIT_SIZES[name].x * sc, d = KIT_SIZES[name].z * sc;
    list.push({ name, x: west ? H.roadX - 6 - d / 2 : H.roadX + 6 + d / 2, z: z0 + w / 2, rot: west ? Math.PI / 2 : -Math.PI / 2, scale: sc, wall });
    return z0 + w + 2;
  };
  side('ind-building-e', 9, side('ind-building-a', 9, 56, true, 0xbfe6ff), true, 0xffd2ad);
  side('ind-building-g', 9, side('ind-building-e', 9, 56, false, 0xcff2bd), false, 0xe2d6ff);
  // big sheds behind the container yard and by the fish market
  list.push({ name: 'ind-building-f', x: -176, z: 63, rot: 0, scale: 10, wall: 0xffd2ad });
  list.push({ name: 'ind-building-l', x: -150, z: 63, rot: 0, scale: 9 });
  list.push({ name: 'ind-water-tower', x: -196, z: 72, rot: 0, scale: 8 });
  list.push({ name: 'ind-chimney-medium', x: -160, z: 74, rot: 0, scale: 8 });
  list.push({ name: 'ind-detail-tank-large', x: -99, z: 95, rot: 0, scale: 7 });
  list.push({ name: 'ind-detail-tank', x: -98, z: 106, rot: Math.PI / 2, scale: 7 });
  buildings(group, list, { blockers, outline: 0 });
  HB_MAP.buildings = list.map((b) => ({ x: b.x, z: b.z, w: b.w, d: b.d, wall: b.wall }));

  buildContainerYard(group, animated, blockers);
  buildMarket(group);
  buildShip(group, animated, blockers);
  buildJetty(group, animated, lampPts);
  buildGulls(group, animated);

  // ---- fence on the land sides (gap for Harbor Road), lamps along the quay
  const posts = [], rails = [];
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (let d = 0; d <= len; d += 2.5) posts.push(new THREE.Matrix4().makeTranslation(x0 + ((x1 - x0) * d) / len, 0.9, z0 + ((z1 - z0) * d) / len));
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    rails.push(new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, 1.6, (z0 + z1) / 2), new THREE.Quaternion(), new THREE.Vector3(along ? len : 0.08, 0.08, along ? 0.08 : len)));
  };
  fence(H.x0, H.z0, H.roadX - 4.5, H.z0); fence(H.roadX + 4.5, H.z0, H.x1, H.z0);
  fence(H.x1 + 0.5, H.z0, H.x1 + 0.5, H.z1); fence(H.x0 - 0.5, H.z0, H.x0 - 0.5, H.z1);
  group.add(instanced(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), 0x9aa3ad, posts, { outline: 0 }));
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), 0x9aa3ad, rails, { outline: 0 }));
  const mesh = new THREE.MeshBasicMaterial({ color: 0x9aa3ad, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
  for (const [x0, z0, x1, z1] of [[H.x0, H.z0, H.roadX - 4.5, H.z0], [H.roadX + 4.5, H.z0, H.x1, H.z0]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 1.6), mesh);
    m.position.set((x0 + x1) / 2, 0.85, z0);
    group.add(m);
  }
  const lamps = [];
  for (let x = H.x0 + 10; x < H.x1 - 4; x += 18) lamps.push({ x, z: H.z1 - 3, rot: Math.PI });
  for (let j = H.roadJ[0] + 1; j < H.roadJ[1]; j += 3) lamps.push({ x: H.roadX - 4.3, z: gz(j), rot: Math.PI / 2 });
  lampPts.push(...streetLamps(group, lamps, { height: 5.2 }));
  // a big harbour sign at the top of Harbor Road
  const sign = signBoard(new THREE.PlaneGeometry(6, 1.6), signTexture(['⚓ WOLFSON HARBOR'], { w: 1024, h: 260, size: 104, bg: '#1e3fa0', fg: '#ffffff' }));
  sign.position.set(H.roadX, 5.6, H.z0 + 0.6);
  group.add(sign);
  for (const dx of [-3.3, 3.3]) {
    const post = part(new THREE.BoxGeometry(0.3, 6.2, 0.3), 0x2b2f38, { outline: 0.015 });
    post.position.set(H.roadX + dx, 3.1, H.z0 + 0.6);
    group.add(post);
    addCircle(H.roadX + dx, H.z0 + 0.6, 0.3);
  }
  addCameraBlocker(group, blockers);
  return { group, animated, bulbs: lampPts };
}

/** Stacks of shipping containers in rows, and a gantry crane that rolls along the yard lifting one. */
function buildContainerYard(group, animated, blockers) {
  const { x0, x1, z0, z1 } = HARBOR.yard;
  const sc = 7.5, L = 0.82 * sc, W = 0.37 * sc, Hc = 0.35 * sc;
  const names = ['ind-shipping-container-a', 'ind-shipping-container-b', 'ind-shipping-container-c'];
  const by = {};
  const rand = seeded(77);
  for (let row = 0; row < 3; row++) {
    const cz = z0 + 3 + row * 7;
    for (let x = x0 + L / 2; x < x1 - L / 2; x += L + 0.6) {
      if (row === 1 && Math.abs(x - (x0 + x1) / 2) < L) continue; // a gap down the middle
      const stack = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < stack; k++) {
        const name = rand.pick(names);
        (by[name] ??= []).push({ x, y: k * Hc, z: cz, rot: Math.PI / 2, scale: sc });
      }
      addBox(x, cz, L, W);
      blockers.push(new THREE.BoxGeometry(L * 0.95, Hc * stack, W * 0.95).translate(x, Hc * stack / 2, cz));
      HB_MAP.containers.push({ x, z: cz, l: L, w: W, n: stack });
      if (row === 0 && stack === 1 && !HARBOR_SPOTS.climb) HARBOR_SPOTS.climb = { x, z: cz, top: Hc };
    }
  }
  for (const [name, ts] of Object.entries(by)) group.add(scatter(name, ts, { outline: 0.012 }));
  // gantry crane straddling the middle row
  const crane = new THREE.Group();
  const cz = z0 + 10;
  crane.position.set(x0 + 10, 0, cz);
  group.add(crane);
  const span = 18, hgt = 13;
  for (const dz of [-span / 2, span / 2]) for (const dx of [-2.5, 2.5]) {
    const leg = part(new THREE.BoxGeometry(0.7, hgt, 0.7), 0xe0453a, { outline: 0.02 });
    leg.position.set(dx, hgt / 2, dz);
    crane.add(leg);
  }
  for (const dz of [-span / 2, span / 2]) {
    const sill = part(new THREE.BoxGeometry(6, 0.8, 1.2), 0xffd23f, { outline: 0.02 });
    sill.position.set(0, 0.4, dz);
    crane.add(sill);
  }
  const beam = part(new THREE.BoxGeometry(6, 1.2, span + 1), 0xe0453a, { outline: 0.02 });
  beam.position.y = hgt;
  crane.add(beam);
  const cab = part(new THREE.BoxGeometry(2, 1.6, 2), 0xffffff, { outline: 0.02 });
  cab.position.set(2.6, hgt - 1.4, -span / 2 + 2);
  crane.add(cab);
  const trolley = new THREE.Group();
  trolley.position.y = hgt - 0.8;
  crane.add(trolley);
  const tb = part(new THREE.BoxGeometry(2.4, 0.6, 2.4), 0x2b2f38, { outline: 0.015 });
  trolley.add(tb);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 4), toon(0x1b1b1b));
  trolley.add(cable);
  const spreader = new THREE.Group();
  trolley.add(spreader);
  const sp = part(new THREE.BoxGeometry(2.3, 0.3, L * 0.9), 0xffd23f, { outline: 0.015 });
  spreader.add(sp);
  const box = part(new THREE.BoxGeometry(W, Hc, L), 0x2f7fc1, { outline: 0.015 });
  box.position.y = -Hc / 2 - 0.15;
  box.rotation.y = Math.PI / 2;
  spreader.add(box);
  // the crane's legs are obstacles at both ends of its travel
  animated.push({ update: (t) => {
    const c = (t * 0.05) % 2, k = c < 1 ? c : 2 - c; // roll up and down the yard
    crane.position.x = x0 + 6 + k * (x1 - x0 - 12);
    const lift = (Math.sin(t * 0.4) + 1) / 2;
    const drop = 2 + lift * 6;
    spreader.position.y = -drop;
    cable.scale.y = drop;
    cable.position.y = -drop / 2;
    trolley.position.z = Math.sin(t * 0.25) * (span / 2 - 3);
  } });
  HARBOR.crane = crane;
}

/** The fish market: an open shed with a striped awning, stalls of fish on ice and crates. */
function buildMarket(group) {
  const { x, z, w, d } = HARBOR.market;
  const roof = part(new THREE.BoxGeometry(w, 0.3, d), 0x2f7fc1, { outline: 0.02 });
  roof.position.set(x, 4, z);
  group.add(roof);
  const stripes = canvasTexture(512, 64, (ctx, cw, ch) => { for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#2f7fc1'; ctx.fillRect(i * 32, 0, 32, ch); } });
  const val = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.8), new THREE.MeshBasicMaterial({ map: stripes, side: THREE.DoubleSide }));
  val.position.set(x, 3.5, z - d / 2);
  group.add(val);
  for (const [px, pz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
    const post = part(new THREE.CylinderGeometry(0.15, 0.15, 4, 8), 0xffffff, { outline: 0.015 });
    post.position.set(x + px, 2, z + pz);
    group.add(post);
    addCircle(x + px, z + pz, 0.25);
  }
  const fishTex = canvasTexture(256, 128, (ctx, cw, ch) => {
    ctx.fillStyle = '#dff3ff'; ctx.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 10; i++) {
      const fx = 20 + (i % 5) * 48, fy = 30 + Math.floor(i / 5) * 60;
      ctx.fillStyle = ['#9aa3ad', '#ff8a6a', '#c9d3dd'][i % 3];
      ctx.beginPath(); ctx.ellipse(fx, fy, 20, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(fx + 18, fy); ctx.lineTo(fx + 30, fy - 8); ctx.lineTo(fx + 30, fy + 8); ctx.fill();
      ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(fx - 12, fy - 2, 2, 0, Math.PI * 2); ctx.fill();
    }
  });
  for (const dx of [-5, 0, 5]) {
    const table = part(new THREE.BoxGeometry(4, 1, 2), 0xb07a45, { outline: 0.015 });
    table.position.set(x + dx, 0.5, z + 1);
    group.add(table);
    const ice = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.8), new THREE.MeshToonMaterial({ map: fishTex }));
    ice.rotation.x = -Math.PI / 2;
    ice.position.set(x + dx, 1.02, z + 1);
    group.add(ice);
    addBox(x + dx, z + 1, 4, 2);
  }
  const sign = signBoard(new THREE.PlaneGeometry(6, 1.2), signTexture(['🐟 FISH MARKET'], { w: 640, h: 128, size: 72, bg: '#ffffff', fg: '#1e3fa0' }));
  sign.position.set(x, 4.8, z - d / 2);
  group.add(sign);
  // crates
  const crates = [];
  for (let i = 0; i < 6; i++) crates.push(new THREE.Matrix4().compose(new THREE.Vector3(x + w / 2 + 1 + (i % 2) * 1.1, 0.5 + Math.floor(i / 4) * 1, z - 2 + Math.floor(i / 2) % 2 * 1.1), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), 0x9a6234, crates, { outline: 0.015 }));
  addBox(x + w / 2 + 1.6, z - 1.5, 2.4, 2.4);
  HARBOR_SPOTS.market = { x, z: z + 3.2 };
}

/** A cargo ship moored along the quay: hull, a bridge tower, containers on deck, a gently rocking motion. */
function buildShip(group, animated, blockers) {
  const { x, z, len, beam } = HARBOR.ship;
  const ship = new THREE.Group();
  ship.position.set(x, 0, z);
  group.add(ship);
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-len / 2, -beam / 2); hullShape.lineTo(len / 2 - 6, -beam / 2);
  hullShape.quadraticCurveTo(len / 2 + 2, 0, len / 2 - 6, beam / 2);
  hullShape.lineTo(-len / 2, beam / 2); hullShape.lineTo(-len / 2, -beam / 2);
  const hull = part(new THREE.ExtrudeGeometry(hullShape, { depth: 4, bevelEnabled: false }), 0xc0392b, { outline: 0.04 });
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -1.5;
  ship.add(hull);
  const stripe = part(new THREE.ExtrudeGeometry(hullShape, { depth: 0.6, bevelEnabled: false }), 0x1b1b1b, { outline: 0 });
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.y = 2.5;
  stripe.scale.set(1.002, 1.002, 1);
  ship.add(stripe);
  const deck = part(new THREE.BoxGeometry(len - 4, 0.2, beam - 0.6), 0x6a7078, { outline: 0 });
  deck.position.set(-1, 2.55, 0);
  ship.add(deck);
  // bridge at the stern
  const bridge = part(new THREE.BoxGeometry(6, 7, beam - 1), 0xffffff, { outline: 0.03 });
  bridge.position.set(-len / 2 + 4, 6, 0);
  ship.add(bridge);
  const windows = new THREE.Mesh(new THREE.PlaneGeometry(beam - 2, 1.1), toon(0x2b6fb0, { emissive: 0x112244 }));
  windows.rotation.y = Math.PI / 2;
  windows.position.set(-len / 2 + 7.02, 8.4, 0);
  ship.add(windows);
  const funnel = part(new THREE.CylinderGeometry(1.1, 1.3, 3.2, 14), 0xffd23f, { outline: 0.02 });
  funnel.position.set(-len / 2 + 3, 11, 0);
  ship.add(funnel);
  const funnelTop = part(new THREE.CylinderGeometry(1.15, 1.15, 0.6, 14), 0x1b1b1b, { outline: 0 });
  funnelTop.position.set(-len / 2 + 3, 12.8, 0);
  ship.add(funnelTop);
  // containers on deck
  const cols = [0xe0453a, 0x2f7fc1, 0x4cc35a, 0xffd23f, 0xff8a3a];
  const rand = seeded(5);
  const mats = [], colors = [];
  for (let bx = -len / 2 + 9; bx < len / 2 - 8; bx += 6.4) for (const bz of [-beam / 4, beam / 4]) {
    const n = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) { mats.push(new THREE.Matrix4().compose(new THREE.Vector3(bx, 3.85 + k * 2.6, bz), new THREE.Quaternion(), new THREE.Vector3(6, 2.5, beam / 2 - 0.4))); colors.push(rand.pick(cols)); }
  }
  ship.add(instanced(new THREE.BoxGeometry(1, 1, 1), 0xffffff, mats, { outline: 0.02, colors }));
  const name = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.4), new THREE.MeshBasicMaterial({ map: signTexture(['DR. GUY EXPRESS'], { w: 768, h: 108, size: 76, bg: '#c0392b', fg: '#ffffff' }) }));
  name.position.set(6, 1.2, -beam / 2 - 0.02);
  name.rotation.y = Math.PI;
  ship.add(name);
  // mooring ropes to the bollards
  const ropeMat = new THREE.LineBasicMaterial({ color: 0xc9a46a });
  for (const dx of [-16, 14]) {
    const a = new THREE.Vector3(x + dx, 3, z - beam / 2), b = new THREE.Vector3(x + dx + (dx < 0 ? -4 : 4), 0.5, HARBOR.z1 - 0.3);
    const mid = a.clone().lerp(b, 0.5); mid.y -= 0.8;
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(10)), ropeMat));
  }
  // gangway from the quay up to the deck
  const gang = part(new THREE.BoxGeometry(1.4, 0.12, 6), 0x9aa3ad, { outline: 0.012 });
  gang.position.set(x + 4, 1.4, HARBOR.z1 + 1.5);
  gang.rotation.x = -0.4;
  group.add(gang);
  HARBOR_SPOTS.gangway = { x: x + 4, z: HARBOR.z1 - 2 };
  animated.push({ update: (t) => { ship.position.y = Math.sin(t * 0.6) * 0.12; ship.rotation.x = Math.sin(t * 0.5) * 0.008; } });
}

/** A wooden jetty with fishing boats bobbing alongside and a crab trap. */
function buildJetty(group, animated, lampPts) {
  const { x0, x1, z0, z1 } = HARBOR.jetty;
  const planks = canvasTexture(128, 256, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#a06c3a' : '#b8834c'; ctx.fillRect(0, i * 32, w, 30); ctx.fillStyle = '#7a4a26'; ctx.fillRect(0, i * 32 + 30, w, 2); }
  });
  slab(group, x0, z0 - 1, x1, z1, 0xffffff, { y: 0.12, map: planks, repeat: [1, (z1 - z0) / 4] });
  const piles = [];
  for (let zz = z0 + 2; zz < z1; zz += 4) for (const xx of [x0 + 0.2, x1 - 0.2]) piles.push(new THREE.Matrix4().makeTranslation(xx, -0.3, zz));
  group.add(instanced(new THREE.CylinderGeometry(0.2, 0.2, 1.6, 8), 0x5e381c, piles, { outline: 0.015 }));
  // fishing boats tied up on both sides
  const cols = [0x2f7fc1, 0xe0453a, 0x4cc35a, 0xffd23f];
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1;
    const b = new THREE.Group();
    b.position.set((side > 0 ? x1 : x0) + side * 2.4, 0, z0 + 6 + i * 5.5);
    const hull = part(new THREE.CylinderGeometry(1.1, 0.7, 4.6, 12, 1, false, 0, Math.PI), cols[i], { outline: 0.02 });
    hull.rotation.z = Math.PI / 2; hull.rotation.y = Math.PI / 2;
    hull.position.y = 0.3;
    b.add(hull);
    const inside = part(new THREE.BoxGeometry(1.6, 0.1, 4.2), 0xb07a45, { outline: 0 });
    inside.position.y = 0.32;
    b.add(inside);
    const cabin = part(new THREE.BoxGeometry(1.3, 1.1, 1.3), 0xffffff, { outline: 0.015 });
    cabin.position.set(0, 0.9, -0.8);
    b.add(cabin);
    const mast = part(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), 0xffffff, { outline: 0 });
    mast.position.set(0, 2.2, 0.6);
    b.add(mast);
    group.add(b);
    HARBOR.boats.push({ b, phase: i * 1.3 });
  }
  animated.push({ update: (t) => HARBOR.boats.forEach((o) => { o.b.position.y = Math.sin(t * 1.2 + o.phase) * 0.12; o.b.rotation.z = Math.sin(t * 0.9 + o.phase) * 0.05; }) });
  const lamps = [{ x: x0 + 0.3, z: z0 + 10, rot: Math.PI / 2 }, { x: x1 - 0.3, z: z1 - 4, rot: -Math.PI / 2 }];
  lampPts.push(...streetLamps(group, lamps, { height: 4 }));
  // a crab trap by the end
  const trap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), new THREE.MeshBasicMaterial({ color: 0x2b2f38, wireframe: true }));
  trap.position.set(x0 + 1, 0.4, z1 - 3);
  group.add(trap);
  HARBOR_SPOTS.jettyEnd = { x: (x0 + x1) / 2, z: z1 - 4 };
}

/** Seagulls circling over the harbour (wings flap). */
function buildGulls(group, animated) {
  const gulls = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const body = part(new THREE.SphereGeometry(0.25, 8, 6), 0xffffff, { outline: 0.012 });
    body.scale.set(1, 0.8, 1.8);
    g.add(body);
    const wings = [];
    for (const sx of [-1, 1]) {
      const w = part(new THREE.BoxGeometry(1.1, 0.04, 0.35), 0xf2f2f2, { outline: 0.008 });
      w.geometry.translate(sx * 0.55, 0, 0);
      g.add(w);
      wings.push(w);
    }
    const beak = part(new THREE.ConeGeometry(0.05, 0.2, 5), 0xffb347, { outline: 0 });
    beak.rotation.x = Math.PI / 2;
    beak.position.z = 0.5;
    g.add(beak);
    group.add(g);
    gulls.push({ g, wings, r: 8 + i * 3, h: 10 + (i % 3) * 3, speed: 0.25 + (i % 2) * 0.1, phase: i * 1.1, cx: -150 + (i % 3) * 18, cz: 105 });
  }
  animated.push({ update: (t) => gulls.forEach((s) => {
    const a = t * s.speed + s.phase;
    s.g.position.set(s.cx + Math.cos(a) * s.r, s.h + Math.sin(t + s.phase) * 0.6, s.cz + Math.sin(a) * s.r);
    s.g.rotation.y = -a;
    s.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 6 + s.phase) * 0.5; });
  }) });
}
