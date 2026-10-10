// Zone 4 — Downtown Wolfson: a 3×3 grid of city blocks west of the park, reached along Main Street (Zoo Road
// carries on west through a new gate in the park fence). City Plaza sits in the middle: fountain, skate corner,
// ice-cream truck, bus stop and pigeons; around it office towers, a shopping street and a basketball court.
import * as THREE from 'three';
import { part, toon, canvasTexture, signTexture, FONT, roundRect } from './toon.js';
import { addBox, addCircle } from './world.js';
import { scatter, kit, WALL_TINTS, KIT_SIZES } from './kit.js';
import { buildStreets, street, gx, gz, TILE } from './streets.js';
import { RAMPS } from './stunts.js';
import { seeded, slab, kerb, streetLamps, buildings, addCameraBlocker, parkedCars, trees, hedgeLine, pavingTexture, signBoard } from './cityprops.js';

const XS = [-7, -13, -19, -25]; // north–south avenues (grid columns), east → west
const ZS = [-6, 0, 6, 12]; // east–west streets (grid rows), north → south
const HALF = TILE / 2;

/** Block (bx: 0 = next to the park … 2 = far west, bz: 0 = north … 2 = south) → its pavement rectangle. */
export function block(bx, bz) {
  const x1 = gx(XS[bx]) - HALF, x0 = gx(XS[bx + 1]) + HALF;
  const z0 = gz(ZS[bz]) + HALF, z1 = gz(ZS[bz + 1]) - HALF;
  return { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
}

export const DOWNTOWN = {
  min: { x: gx(XS[3]) - HALF - 0.5, z: gz(ZS[0]) - HALF - 0.5 }, // -199.5, -83
  max: { x: -64, z: gz(ZS[3]) + HALF + 0.5 }, // -64, 51
  gateZ: -37, // Main Street, through the park's west gate
  plaza: block(1, 1),
  court: block(2, 1),
  shops: block(0, 1),
};
const P = DOWNTOWN.plaza, C = DOWNTOWN.court;
// Landmarks other modules use (missions, map)
export const DT_SPOTS = {
  fountain: { x: P.cx, z: P.cz },
  skate: { x: P.x0 + 7, z: P.z1 - 7 },
  icecream: { x: P.x1 - 5, z: P.z0 + 4.5 },
  busStop: { x: P.x1 - 3.2, z: P.cz + 6 },
  hoopEast: { x: C.cx + 11, z: C.cz },
  cafe: { x: DOWNTOWN.shops.cx, z: DOWNTOWN.shops.cz },
  pigeons: { x: P.cx - 7, z: P.cz + 4 },
};
/** What the map draws for Downtown (filled in by buildDowntown). */
export const DT_MAP = { blocks: [], buildings: [], streets: [], trees: [] };

export function buildDowntown(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const animated = [];
  const rand = seeded(4242);
  const blockers = [];
  const lamps = [];
  let billboardAt = null;

  // ---- streets: the avenues, the cross streets and Main Street back to the park
  const cells = new Set();
  for (const i of XS) street(cells, i, ZS[0], i, ZS[3]);
  for (const j of ZS) street(cells, XS[3], j, XS[0], j);
  street(cells, XS[0], 0, -1, 0); // Main Street → Zoo Road (its first tile is cell 0,0)
  const { group: streetGroup, tiles } = buildStreets(cells, { extra: new Set(['0,0']) });
  group.add(streetGroup);
  DT_MAP.streets = tiles;

  // ---- concrete under everything (the grass ends at the city edge)
  slab(group, DOWNTOWN.min.x - 1, DOWNTOWN.min.z - 1, DOWNTOWN.max.x + 1, DOWNTOWN.max.z + 1, 0xb9c0c9, { y: 0.004 });

  // ---- blocks
  const towers = ['building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c', 'building-skyscraper-d', 'building-skyscraper-e', 'building-m', 'building-l'];
  const midrise = ['building-a', 'building-b', 'building-d', 'building-f', 'building-g', 'building-h', 'building-i', 'building-j', 'building-k', 'building-l'];
  const shopsRow = ['building-c', 'building-e', 'building-a', 'building-h', 'building-d', 'building-b'];
  const list = [];
  const pave = pavingTexture('#dcd8d0', '#c4beb2', 4);
  for (let bx = 0; bx < 3; bx++) {
    for (let bz = 0; bz < 3; bz++) {
      const b = block(bx, bz);
      const kind = bx === 1 && bz === 1 ? 'plaza' : bx === 2 && bz === 1 ? 'court' : bx === 0 && bz === 1 ? 'shops' : (bz === 0 && bx < 2) ? 'towers' : 'mixed';
      DT_MAP.blocks.push({ ...b, kind });
      slab(group, b.x0, b.z0, b.x1, b.z1, 0xffffff, { y: 0.03, map: pave.clone(), repeat: [(b.x1 - b.x0) / 6, (b.z1 - b.z0) / 6] });
      kerb(group, b.x0, b.z0, b.x1, b.z1);
      // lamps on the block corners and mid-sides, arms reaching over the road
      for (const [x, z, rot] of [
        [b.x0 + 0.7, b.z0 + 0.7, -Math.PI / 2], [b.x1 - 0.7, b.z1 - 0.7, Math.PI / 2],
        [b.cx, b.z0 + 0.7, Math.PI], [b.cx, b.z1 - 0.7, 0],
      ]) lamps.push({ x, z, rot });
      if (kind === 'plaza' || kind === 'court') continue;
      const pool = kind === 'towers' ? towers : kind === 'shops' ? shopsRow : midrise;
      const wall = kind === 'towers' ? null : WALL_TINTS[(bx * 3 + bz) % WALL_TINTS.length];
      const wall2 = WALL_TINTS[(bx * 3 + bz + 3) % WALL_TINTS.length];
      const scale = kind === 'towers' ? 10.5 : 10;
      // a row of buildings facing each street (north row faces north = rot π); rows never meet in the middle
      // (the shops leave a wide pavement on the south side for the café tables)
      const setback = (side) => (side === 's' && kind === 'shops' ? 5 : 1.3);
      const maxDepth = (b.z1 - b.z0 - 1.3 - setback('s') - 4) / 2;
      const rowDepth = { n: 0, s: 0 };
      for (const [side, rot] of [['n', Math.PI], ['s', 0]]) {
        const reserved = [];
        if (bx === 1 && bz === 0 && side === 's') {
          // the billboard building, right across Main Street from the plaza
          const { name, scale: sc } = BILLBOARD_BUILDING;
          const w = KIT_W(name) * sc, d = Math.min(KIT_D(name) * sc, maxDepth);
          list.push({ name, x: b.cx, z: b.z1 - 1.3 - d / 2, rot, scale: sc, wall: WALL_TINTS[1] });
          billboardAt = { x: b.cx, z: b.z1 - 1.3 - d / 2, top: KIT_SIZES[name].y * sc };
          reserved.push([b.cx - w / 2 - 1, b.cx + w / 2 + 1]);
          rowDepth.s = d;
        }
        let x = b.x0 + 1;
        let n = 0, tries = 0;
        while (x < b.x1 - 4 && tries++ < 60) {
          const r = reserved.find(([a, c]) => x + 4 > a && x < c);
          if (r) { x = r[1]; continue; }
          const name = rand.pick(pool);
          const w = KIT_W(name) * scale, d = KIT_D(name) * scale;
          if (x + w > b.x1 - 0.8 || d > maxDepth || reserved.some(([a, c]) => x + w > a && x < c)) { if (tries % 6 === 5) x += 2; continue; }
          const z = side === 'n' ? b.z0 + 1.3 + d / 2 : b.z1 - setback(side) - d / 2;
          list.push({ name, x: x + w / 2, z, rot, scale, wall: n % 2 ? wall2 : wall });
          rowDepth[side] = Math.max(rowDepth[side], d);
          x += w + rand.range(0.4, 2.2);
          n++;
        }
      }
      // the yard between the rows (if there's room): trees, a dumpster
      const ya = b.z0 + 1.3 + rowDepth.n, yb = b.z1 - setback('s') - rowDepth.s;
      if (yb - ya > 4) {
        const yz = (ya + yb) / 2;
        trees(group, [{ x: b.x0 + 4, z: yz, kind: 'tree_default', scale: 2.6 }, { x: b.x1 - 4, z: yz, kind: 'tree_oak', scale: 2.4 }]);
        DT_MAP.trees.push([b.x0 + 4, yz, 2.2], [b.x1 - 4, yz, 2.2]);
        if (yb - ya > 6) {
          group.add(scatter('dumpster', [{ x: b.cx - 3, z: yz, rot: 0, scale: 6 }], { outline: 0.012 }));
          addBox(b.cx - 3, yz, 3.2, 2.2);
        }
      }
    }
  }
  buildings(group, list, { blockers, outline: 0 }); // (Kenney buildings have their own dark trims; outlines would double the draw calls)
  DT_MAP.buildings = list.map((b) => ({ x: b.x, z: b.z, w: b.w, d: b.d, h: b.h, wall: b.wall }));

  // ---- shopping street: awnings and café parasols in front of the shops
  const S = DOWNTOWN.shops;
  group.add(scatter('detail-parasol-a', [-12, -4, 4, 12].map((dx, i) => ({ x: S.cx + dx, z: S.z1 - 2.8, rot: 0, scale: 7 + (i % 2) }))));
  for (const dx of [-12, -4, 4, 12]) addCircle(S.cx + dx, S.z1 - 2.8, 0.8);
  cafeTables(group, S.cx, S.z1 - 2.8);

  buildPlaza(group, animated, blockers);
  buildCourt(group);
  if (billboardAt) buildBillboard(group, billboardAt);

  // ---- street furniture: traffic lights at the crossroads, parked cars along the quiet streets
  const tl = [];
  for (const i of XS.slice(0, 3)) for (const j of ZS.slice(1, 3)) {
    // NE and SW corners (the other two have street lamps)
    tl.push({ x: gx(i) + HALF + 0.5, z: gz(j) - HALF - 0.5, rot: Math.PI, scale: 7 }, { x: gx(i) - HALF - 0.5, z: gz(j) + HALF + 0.5, rot: 0, scale: 7 });
  }
  group.add(scatter('traffic-light', tl, { outline: 0.012 }));
  for (const t of tl) addCircle(t.x, t.z, 0.3);
  const cars = [];
  const carNames = ['sedan', 'taxi', 'suv', 'van', 'hatchback-sports', 'taxi', 'delivery', 'police'];
  // along the cross streets (cars parked by the north kerb, pointing east/west)
  for (const j of [ZS[0], ZS[3], ZS[2]]) {
    for (let i = XS[3] + 1; i < XS[0]; i++) {
      if (XS.includes(i) || XS.includes(i - 1) || XS.includes(i + 1) || rand() < 0.45) continue;
      if (RAMPS.some((r) => Math.abs(gz(j) - r.z) < 5 && Math.abs(gx(i) - r.x) < 34)) continue; // keep the stunt run-ups clear
      cars.push({ x: gx(i), z: gz(j) - 2.1, rot: Math.PI / 2 + (rand() < 0.5 ? 0 : Math.PI), name: rand.pick(carNames) });
    }
  }
  parkedCars(group, cars);

  // ---- where the city ends: hedges along the edges (Main Street gap to the park), backdrop skyline beyond
  const m = DOWNTOWN;
  hedgeLine(group, m.max.x + 1.2, m.min.z, m.max.x + 1.2, m.max.z, { skip: (x, z) => Math.abs(z - DOWNTOWN.gateZ) < 4.5 });
  hedgeLine(group, m.min.x - 1, m.min.z - 1, m.max.x + 1, m.min.z - 1);
  hedgeLine(group, m.min.x - 1, m.max.z + 1, m.max.x + 1, m.max.z + 1);
  hedgeLine(group, m.min.x - 1, m.min.z, m.min.x - 1, m.max.z);
  const skyline = [];
  const lows = ['low-detail-building-a', 'low-detail-building-c', 'low-detail-building-e', 'low-detail-building-g', 'low-detail-building-wide-a', 'low-detail-building-wide-b'];
  for (let x = m.min.x - 8; x < m.max.x - 6; x += 9 + rand() * 4) {
    skyline.push({ name: rand.pick(lows), x, z: m.min.z - 12 - rand() * 8, rot: 0, scale: 12 + rand() * 6, wall: rand.pick(WALL_TINTS), noCollide: true });
    if (x < -92) skyline.push({ name: rand.pick(lows), x, z: m.max.z + 12 + rand() * 6, rot: Math.PI, scale: 10 + rand() * 6, wall: rand.pick(WALL_TINTS), noCollide: true });
  }
  for (let z = m.min.z - 4; z < m.max.z + 6; z += 9 + rand() * 4) skyline.push({ name: rand.pick(lows), x: m.min.x - 12 - rand() * 8, z, rot: Math.PI / 2, scale: 12 + rand() * 6, wall: rand.pick(WALL_TINTS), noCollide: true });
  buildings(group, skyline, { outline: 0, blockers: [] });

  const bulbs = streetLamps(group, lamps);
  addCameraBlocker(group, blockers);
  return { group, animated, bulbs };
}

const KIT_W = (n) => KIT_SIZES[n]?.x ?? 1;
const KIT_D = (n) => KIT_SIZES[n]?.z ?? 1;
const BILLBOARD_BUILDING = { name: 'building-n', scale: 10 }; // the plaza-facing building that carries the poster

function cafeTables(group, cx, z) {
  const tops = [], legs = [];
  for (const dx of [-12, -4, 4, 12]) {
    tops.push(new THREE.Matrix4().compose(new THREE.Vector3(cx + dx, 0.95, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
    legs.push(new THREE.Matrix4().compose(new THREE.Vector3(cx + dx, 0.48, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
  }
  group.add(instancedPart(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 16), 0xffffff, tops));
  group.add(instancedPart(new THREE.CylinderGeometry(0.06, 0.06, 0.95, 6), 0x2b2f38, legs));
}
function instancedPart(geo, color, mats) {
  const m = new THREE.InstancedMesh(geo, toon(color), mats.length);
  mats.forEach((x, i) => m.setMatrixAt(i, x));
  m.castShadow = true;
  return m;
}

/** City Plaza: paving, a big fountain, trees in planters, benches, a skate corner, an ice-cream truck, a bus stop, pigeons. */
function buildPlaza(group, animated, blockers) {
  const { x0, x1, z0, z1, cx, cz } = P;
  // a warm paving pattern with a ring around the fountain
  const tex = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#e9d9bd'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d4c09c'; ctx.lineWidth = 3;
    for (let i = 0; i <= 16; i++) { ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(w, i * 32); ctx.stroke(); }
    ctx.strokeStyle = '#c98f5a'; ctx.lineWidth = 18;
    for (const r of [120, 200]) { ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = '#b9764a'; ctx.lineWidth = 10;
    for (let a = 0; a < 8; a++) { ctx.beginPath(); ctx.moveTo(w / 2 + Math.cos(a * Math.PI / 4) * 120, h / 2 + Math.sin(a * Math.PI / 4) * 120); ctx.lineTo(w / 2 + Math.cos(a * Math.PI / 4) * 200, h / 2 + Math.sin(a * Math.PI / 4) * 200); ctx.stroke(); }
  });
  slab(group, x0, z0, x1, z1, 0xffffff, { y: 0.035, map: tex });

  // fountain: a stone basin, a tiered column and animated jets
  const basin = part(new THREE.CylinderGeometry(5.2, 5.5, 0.9, 40), 0xc9d3dd, { outline: 0.03 });
  basin.position.set(cx, 0.45, cz);
  group.add(basin);
  const water = new THREE.Mesh(new THREE.CircleGeometry(4.7, 40), toon(0x4fc0f0, { transparent: true, opacity: 0.9 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(cx, 0.86, cz);
  group.add(water);
  const col = part(new THREE.CylinderGeometry(0.6, 0.9, 2.6, 16), 0xc9d3dd, { outline: 0.02 });
  col.position.set(cx, 1.6, cz);
  group.add(col);
  const bowl = part(new THREE.CylinderGeometry(2, 1.1, 0.5, 24), 0xc9d3dd, { outline: 0.02 });
  bowl.position.set(cx, 2.9, cz);
  group.add(bowl);
  const top = part(new THREE.SphereGeometry(0.55, 16, 12), 0xffd23f, { outline: 0.02 });
  top.position.set(cx, 3.6, cz);
  group.add(top);
  addCircle(cx, cz, 5.6);
  // eight water arcs from the top bowl down into the basin, plus a bubbling plume on top
  const jetMat = toon(0xbfe9ff, { transparent: true, opacity: 0.7 });
  const jets = new THREE.Group();
  jets.position.set(cx, 0, cz);
  group.add(jets);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(dx * 1.9, 3.05, dz * 1.9),
      new THREE.Vector3(dx * 3.3, 3.9, dz * 3.3),
      new THREE.Vector3(dx * 4.1, 0.9, dz * 4.1),
    );
    jets.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.09, 6), jetMat));
  }
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 12, 1, true), jetMat);
  plume.position.set(cx, 4.5, cz);
  group.add(plume);
  const splashes = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.32, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    sp.rotation.x = -Math.PI / 2;
    sp.position.set(cx + Math.cos(a) * 4.1, 0.88, cz + Math.sin(a) * 4.1);
    group.add(sp);
    splashes.push(sp);
  }
  animated.push({ update: (t) => {
    jets.scale.set(1 + Math.sin(t * 3) * 0.03, 1, 1 + Math.sin(t * 3) * 0.03);
    plume.scale.set(1 + Math.sin(t * 7) * 0.1, 1 + Math.sin(t * 4) * 0.2, 1 + Math.sin(t * 7) * 0.1);
    splashes.forEach((sp, i) => { const k = (t * 1.6 + i * 0.37) % 1; sp.scale.setScalar(0.6 + k * 1.6); sp.material.opacity = 0.75 * (1 - k); });
  } });

  // trees in round planters at the four corners + benches facing the fountain
  const planters = [[x0 + 5, z0 + 5], [x1 - 5, z0 + 5], [x0 + 5, z1 - 13], [x1 - 5, z1 - 5]];
  const ring = [];
  for (const [x, z] of planters) {
    const pl = part(new THREE.CylinderGeometry(1.7, 1.8, 0.7, 20), 0xb9764a, { outline: 0.02 });
    pl.position.set(x, 0.35, z);
    group.add(pl);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(1.55, 20), toon(0x6b4a2a));
    soil.rotation.x = -Math.PI / 2; soil.position.set(x, 0.71, z);
    group.add(soil);
    ring.push({ x, z, kind: 'tree_detailed', scale: 3.2 });
    addCircle(x, z, 1.8);
    DT_MAP.trees.push([x, z, 3]);
  }
  trees(group, ring);
  const benches = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = cx + Math.cos(a) * 9, z = cz + Math.sin(a) * 9;
    benches.push({ x, z, rot: Math.atan2(cx - x, cz - z) + Math.PI, scale: 3 });
    addCircle(x, z, 0.9);
  }
  group.add(scatter('stall-bench', benches, { outline: 0.012 }));
  // flower beds along the north edge
  group.add(scatter('flower_redA', Array.from({ length: 10 }, (_, i) => ({ x: x0 + 9 + i * 1.8, z: z0 + 1.2, scale: 3 }))));
  group.add(scatter('flower_yellowA', Array.from({ length: 10 }, (_, i) => ({ x: x0 + 9.9 + i * 1.8, z: z0 + 1.6, scale: 3 }))));

  buildSkateCorner(group, x0 + 1, z1 - 1);
  buildIceCreamTruck(group, animated, DT_SPOTS.icecream.x, DT_SPOTS.icecream.z - 1.4);
  buildBusStop(group, DT_SPOTS.busStop.x, DT_SPOTS.busStop.z);
  buildPigeons(group, animated, DT_SPOTS.pigeons.x, DT_SPOTS.pigeons.z);
}

/** Skate corner (south-west of the plaza): a quarter pipe, a fun box and a grind rail. */
function buildSkateCorner(group, x0, z1) {
  const conc = 0xa7b0bb;
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), toon(0x9aa3ad));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(x0 + 7, 0.04, z1 - 6);
  pad.receiveShadow = true;
  group.add(pad);
  // quarter pipe along the west edge (curved face towards +x)
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(2.6, 0);
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; shape.lineTo(2.6 - Math.sin(a) * 2.6, 2.6 - Math.cos(a) * 2.6); }
  shape.lineTo(0, 2.6); shape.lineTo(0, 0);
  const qp = part(new THREE.ExtrudeGeometry(shape, { depth: 10, bevelEnabled: false }), conc, { outline: 0.02 });
  qp.position.set(x0, 0, z1 - 11); // profile in x/y, extruded south along z: the curve faces east
  group.add(qp);
  addBox(x0 + 1.3, z1 - 6, 2.6, 10);
  const coping = part(new THREE.CylinderGeometry(0.08, 0.08, 10, 8), 0xe8eef3, { outline: 0.01 });
  coping.rotation.x = Math.PI / 2;
  coping.position.set(x0 + 0.05, 2.62, z1 - 6);
  group.add(coping);
  // fun box with ramps
  const box = part(new THREE.BoxGeometry(3, 0.6, 2.2), conc, { outline: 0.02 });
  box.position.set(x0 + 8, 0.3, z1 - 6);
  group.add(box);
  for (const sx of [-1, 1]) {
    const r = part(new THREE.BoxGeometry(1.6, 0.1, 2.2), conc, { outline: 0.015 });
    r.position.set(x0 + 8 + sx * 2.25, 0.3, z1 - 6);
    r.rotation.z = sx * -0.36;
    group.add(r);
  }
  addBox(x0 + 8, z1 - 6, 3, 2.2);
  // grind rail
  const rail = part(new THREE.CylinderGeometry(0.06, 0.06, 6, 8), 0xffd23f, { outline: 0.01 });
  rail.rotation.z = Math.PI / 2;
  rail.position.set(x0 + 8, 0.7, z1 - 2.2);
  group.add(rail);
  for (const dx of [-2.6, 2.6]) {
    const leg = part(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), 0x2b2f38, { outline: 0.01 });
    leg.position.set(x0 + 8 + dx, 0.35, z1 - 2.2);
    group.add(leg);
  }
  // graffiti wall behind (cheerful, readable)
  const wallTex = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#5b6573'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#ff5f8f'); g.addColorStop(0.5, '#ffd23f'); g.addColorStop(1, '#4fc0f0');
    ctx.fillStyle = g; ctx.font = `700 74px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.strokeStyle = '#1b1b1b'; ctx.strokeText('SKATE · WOLFSON', w / 2, h / 2 + 4); ctx.fillText('SKATE · WOLFSON', w / 2, h / 2 + 4);
  });
  const wall = part(new THREE.BoxGeometry(12, 2.2, 0.3), 0xffffff, { outline: 0.02, matOpts: { map: wallTex } });
  wall.position.set(x0 + 7, 1.1, z1 + 0.2);
  group.add(wall);
}

/** An ice-cream truck with a giant cone on the roof (the cone slowly spins). */
function buildIceCreamTruck(group, animated, x, z) {
  const truck = kit('delivery', { scale: 2.4, outline: 0.012 });
  truck.position.set(x, 0, z);
  truck.rotation.y = Math.PI / 2;
  group.add(truck);
  addCircle(x - 1.5, z, 1.5); addCircle(x + 1.5, z, 1.5);
  const cone = new THREE.Group();
  const waffle = part(new THREE.ConeGeometry(0.55, 1.4, 16), 0xe2a85a, { outline: 0.02 });
  waffle.rotation.x = Math.PI;
  waffle.position.y = 0.7;
  cone.add(waffle);
  const scoops = [[0xff8ac0, 0], [0xfff3d6, 0.5], [0x8a5a3c, 0.95]];
  for (const [c, y] of scoops) {
    const s = part(new THREE.SphereGeometry(0.62, 16, 12), c, { outline: 0.02 });
    s.position.y = 1.5 + y;
    cone.add(s);
  }
  cone.position.set(x, 3.1, z);
  group.add(cone);
  animated.push({ update: (t) => { cone.rotation.y = t * 0.8; } });
  const sign = signBoard(new THREE.PlaneGeometry(3.2, 0.8), signTexture(['ICE CREAM'], { w: 512, h: 128, size: 82, bg: '#ff8ac0', fg: '#ffffff' }));
  sign.position.set(x, 2.9, z + 1.3);
  group.add(sign);
}

/** A bus stop: shelter with a glass back, a bench and a sign. */
function buildBusStop(group, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI / 2; // open to the east (the avenue), glass back towards the plaza
  group.add(g);
  const roof = part(new THREE.BoxGeometry(4.4, 0.15, 1.8), 0x2f7fc1, { outline: 0.02 });
  roof.position.set(0, 2.6, 0);
  g.add(roof);
  for (const sx of [-2.1, 2.1]) {
    const post = part(new THREE.BoxGeometry(0.12, 2.6, 0.12), 0x2b2f38, { outline: 0.01 });
    post.position.set(sx, 1.3, -0.75);
    g.add(post);
  }
  const glass = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.1, 0.06), toon(0xbfe6ff, { transparent: true, opacity: 0.45 }));
  glass.position.set(0, 1.35, -0.8);
  g.add(glass);
  const bench = part(new THREE.BoxGeometry(3, 0.12, 0.5), 0x9a6234, { outline: 0.015 });
  bench.position.set(0, 0.55, -0.45);
  g.add(bench);
  const ad = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.7), new THREE.MeshBasicMaterial({ map: signTexture(['🦷', 'Brush', 'twice', 'a day!'], { w: 256, h: 384, size: 52, bg: '#fff3d6', fg: '#2f7fc1' }) }));
  ad.position.set(1.3, 1.35, -0.76);
  g.add(ad);
  const pole = part(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), 0x9aa3ad, { outline: 0.01 });
  pole.position.set(2.6, 1.5, 0.4);
  g.add(pole);
  const busSign = signBoard(new THREE.CircleGeometry(0.4, 20), signTexture(['BUS'], { w: 128, h: 128, size: 44, bg: '#2f7fc1', fg: '#ffffff' }));
  busSign.position.set(2.6, 3.0, 0.4);
  busSign.rotation.y = Math.PI / 2;
  g.add(busSign);
  addBox(x, z, 1.8, 4.4);
}

/** A little flock of pigeons pecking at crumbs (they hop and bob). */
function buildPigeons(group, animated, x, z) {
  const birds = [];
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Group();
    const body = part(new THREE.SphereGeometry(0.22, 10, 8), 0x8f98a8, { outline: 0.012 });
    body.scale.set(1, 0.85, 1.4);
    body.position.y = 0.25;
    b.add(body);
    const head = part(new THREE.SphereGeometry(0.12, 8, 6), 0x6a7385, { outline: 0.01 });
    head.position.set(0, 0.42, 0.24);
    b.add(head);
    const neck = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), toon(0x5aa58a));
    neck.position.set(0, 0.35, 0.17);
    b.add(neck);
    const beak = part(new THREE.ConeGeometry(0.035, 0.1, 5), 0xffb347, { outline: 0 });
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.42, 0.37);
    b.add(beak);
    b.position.set(x + Math.cos(i * 2.4) * (1 + i * 0.35), 0.03, z + Math.sin(i * 2.4) * (1 + i * 0.35));
    b.rotation.y = i * 1.3;
    group.add(b);
    birds.push({ b, head, phase: i * 1.7, home: b.position.clone() });
  }
  animated.push({ update: (t) => {
    for (const p of birds) {
      const peck = Math.max(0, Math.sin(t * 6 + p.phase));
      p.head.position.y = 0.42 - peck * 0.14;
      p.head.position.z = 0.24 + peck * 0.06;
      const hop = Math.max(0, Math.sin(t * 1.3 + p.phase * 3)) ** 8;
      p.b.position.y = 0.03 + hop * 0.25;
      if (hop > 0.9) p.b.rotation.y += 0.04;
      p.b.position.x = p.home.x + Math.sin(t * 0.2 + p.phase) * 0.6;
      p.b.position.z = p.home.z + Math.cos(t * 0.17 + p.phase) * 0.6;
    }
  } });
}

/** Basketball court (west of the plaza) with hoops, bleachers and a fence. */
function buildCourt(group) {
  const { x0, x1, z0, z1, cx, cz } = C;
  slab(group, x0, z0, x1, z1, 0x7fbf6a, { y: 0.035 });
  const L = 28, W = 15;
  const tex = canvasTexture(1024, 548, (ctx, w, h) => {
    ctx.fillStyle = '#e0703a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2f7fc1'; ctx.fillRect(0, 0, w, 24); ctx.fillRect(0, h - 24, w, 24); ctx.fillRect(0, 0, 24, h); ctx.fillRect(w - 24, 0, 24, h);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8;
    ctx.strokeRect(24, 24, w - 48, h - 48);
    ctx.beginPath(); ctx.moveTo(w / 2, 24); ctx.lineTo(w / 2, h - 24); ctx.stroke();
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 70, 0, Math.PI * 2); ctx.stroke();
    for (const s of [0, 1]) {
      const x = s ? w - 24 : 24, dir = s ? -1 : 1;
      ctx.strokeRect(s ? x - 190 : x, h / 2 - 80, 190, 160);
      ctx.beginPath(); ctx.arc(x + dir * 190, h / 2, 80, s ? Math.PI / 2 : -Math.PI / 2, s ? -Math.PI / 2 : Math.PI / 2, s === 0 ? false : false); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, h / 2, 240, s ? Math.PI / 2 : -Math.PI / 2, s ? Math.PI * 1.5 : Math.PI / 2); ctx.stroke();
    }
    ctx.font = `700 54px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('WOLFSON HOOPS', w / 2, h / 2);
  });
  const court = new THREE.Mesh(new THREE.PlaneGeometry(L, W), new THREE.MeshToonMaterial({ map: tex }));
  court.rotation.x = -Math.PI / 2;
  court.position.set(cx, 0.045, cz);
  court.receiveShadow = true;
  group.add(court);
  for (const s of [-1, 1]) {
    const hx = cx + s * (L / 2 - 0.6);
    const pole = part(new THREE.CylinderGeometry(0.12, 0.14, 3.6, 10), 0x2b2f38, { outline: 0.015 });
    pole.position.set(hx + s * 0.4, 1.8, cz);
    group.add(pole);
    const arm = part(new THREE.BoxGeometry(0.9, 0.12, 0.12), 0x2b2f38, { outline: 0.01 });
    arm.position.set(hx, 3.45, cz);
    group.add(arm);
    const board = part(new THREE.BoxGeometry(0.1, 1.1, 1.8), 0xffffff, { outline: 0.015 });
    board.position.set(hx - s * 0.45, 3.6, cz);
    group.add(board);
    const sq = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshBasicMaterial({ color: 0xe0453a, side: THREE.DoubleSide }));
    sq.rotation.y = Math.PI / 2;
    sq.position.set(hx - s * 0.51, 3.45, cz);
    group.add(sq);
    const hoop = part(new THREE.TorusGeometry(0.3, 0.035, 8, 20), 0xff6a2a, { outline: 0 });
    hoop.rotation.x = Math.PI / 2;
    hoop.position.set(hx - s * 0.85, 3.1, cz);
    group.add(hoop);
    const net = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.45, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }));
    net.position.set(hx - s * 0.85, 2.85, cz);
    group.add(net);
    addCircle(hx + s * 0.4, cz, 0.3);
  }
  // bleachers along the north side
  for (let r = 0; r < 3; r++) {
    const step = part(new THREE.BoxGeometry(16, 0.35, 0.9), [0x2f7fc1, 0xffd23f, 0xe0453a][r], { outline: 0.015 });
    step.position.set(cx, 0.18 + r * 0.38, z0 + 2 + r * 0.9 - 0.9 * 2 + 1.8);
    step.position.y = 0.2 + r * 0.38;
    step.position.z = z0 + 1.3 + (2 - r) * 0.9;
    group.add(step);
  }
  addBox(cx, z0 + 2.6, 16, 2.8);
  // chain-link fence around the court (lines), gaps in the middle of the long sides
  const fence = new THREE.Group();
  const posts = [];
  const fx0 = cx - L / 2 - 1, fx1 = cx + L / 2 + 1, fz0 = cz - W / 2 - 1, fz1 = cz + W / 2 + 1;
  for (let x = fx0; x <= fx1 + 0.01; x += 3) for (const z of [fz0, fz1]) if (Math.abs(x - cx) > 3) posts.push([x, z]);
  for (let z = fz0; z <= fz1 + 0.01; z += 3) for (const x of [fx0, fx1]) posts.push([x, z]);
  for (const [x, z] of posts) {
    const p = part(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), 0x9aa3ad, { outline: 0 });
    p.position.set(x, 1.2, z);
    fence.add(p);
  }
  const mesh = new THREE.MeshBasicMaterial({ color: 0x9aa3ad, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  for (const [a, b, z] of [[fx0, cx - 3, fz0], [cx + 3, fx1, fz0], [fx0, cx - 3, fz1], [cx + 3, fx1, fz1]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 2.3), mesh);
    m.position.set((a + b) / 2, 1.2, z);
    fence.add(m);
    addBox((a + b) / 2, z, b - a, 0.3);
  }
  for (const x of [fx0, fx1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(fz1 - fz0, 2.3), mesh);
    m.rotation.y = Math.PI / 2;
    m.position.set(x, 1.2, cz);
    fence.add(m);
    addBox(x, cz, 0.3, fz1 - fz0);
  }
  group.add(fence);
  // trees around it
  trees(group, [[x0 + 2.5, z1 - 3], [x1 - 2.5, z1 - 3], [x0 + 2.5, z0 + 3], [x1 - 2.5, z0 + 3]].map(([x, z]) => ({ x, z, kind: 'tree_oak', scale: 2.8 })));
  DT_MAP.trees.push([x0 + 2.5, z1 - 3, 2.5], [x1 - 2.5, z1 - 3, 2.5], [x0 + 2.5, z0 + 3, 2.5], [x1 - 2.5, z0 + 3, 2.5]);
}

/** A rooftop billboard with the Doctor Guy poster, facing the plaza (GTA-style city advertising). */
function buildBillboard(group, at) {
  const tex = new THREE.TextureLoader().load(new URL('../assets/title/key-art-wide.webp', import.meta.url).href);
  tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  const w = 22, h = w * 941 / 1672;
  const frame = part(new THREE.BoxGeometry(w + 0.8, h + 0.8, 0.4), 0x2b2f38, { outline: 0.03 });
  g.add(frame);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  art.position.z = 0.21;
  g.add(art);
  const legH = 2.2;
  for (const sx of [-w / 3, 0, w / 3]) {
    const leg = part(new THREE.BoxGeometry(0.4, legH + h / 2, 0.4), 0x2b2f38, { outline: 0.02 });
    leg.position.set(sx, -(legH + h / 2) / 2, -0.5);
    g.add(leg);
  }
  const lightBar = part(new THREE.BoxGeometry(w, 0.25, 0.6), 0x2b2f38, { outline: 0.01 });
  lightBar.position.set(0, -h / 2 - 0.5, 0.6);
  g.add(lightBar);
  // standing on the roof of the building across Main Street from the plaza, facing south
  g.position.set(at.x, at.top + legH + h / 2, at.z);
  group.add(g);
}
