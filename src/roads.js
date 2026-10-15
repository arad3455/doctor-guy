// The city's road network, drawn in one go once every district has registered its road cells (streets.js):
// wide asphalt with a fine grain, raised kerbs with rounded corners at junctions, a dashed centre line and solid
// edge lines, zebra crossings and stop lines at junctions, manholes and drains. Replaces the Kenney road tiles.
//
// Layout: every road cell is either a "run" (straight through, open on two opposite sides) or a "node" (junction,
// bend or dead end). Runs are strips 2·HW wide; nodes are 2·HW squares with rounded fillets between open arms.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROAD_CELLS, TILE, gx, gz, HW, NO_ZEBRA } from './streets.js';
import { toon, canvasTexture } from './toon.js';

const KERB_W = 0.3, KERB_H = 0.13;
const R = 1.6; // kerb radius at junction corners
const H = TILE / 2;
const Y = { asphalt: 0.03, mark: 0.036 };
// directions: E, S, W, N as [dx, dz]
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/** Mid-block zebra crossings registered by zones (e.g. Zoo Road by the hospital): { x, z, axis: 'x'|'z' }. */
export const CROSSWALKS = [];
/** Words painted on the road: { x, z, text, yaw (the way the text reads up the road), color, box: [w, d] outline }. */
export const ROAD_TEXT = [];

export function buildRoadNetwork(scene) {
  const group = new THREE.Group();
  group.name = 'roads';
  scene.add(group);
  const has = (i, j) => ROAD_CELLS.has(`${i},${j}`);
  const cells = [...ROAD_CELLS].map((k) => k.split(',').map(Number));
  const asphalt = [], fillets = [], kerbs = [], white = [], yellow = [], dark = [], arrows = [];
  const quad = (x0, z0, x1, z1) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, Y.asphalt, (z0 + z1) / 2);
    asphalt.push(g.toNonIndexed()); // (the corner fillets aren't indexed: merging needs them all alike)
  };
  // a flat marking rectangle (centre, length along `ax`, width across), as an instance matrix
  const mark = (list, x, z, len, wid, ax) => list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, Y.mark, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ax === 'x' ? 0 : Math.PI / 2), new THREE.Vector3(len, 1, wid)));
  // a kerb stone run from (x0,z0) to (x1,z1)
  const kerb = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.05) return;
    kerbs.push(new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, KERB_H / 2, (z0 + z1) / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(z1 - z0, x1 - x0)), new THREE.Vector3(len + 0.02, 1, 1)));
  };
  const kind = (i, j) => {
    const o = DIRS.map(([dx, dz]) => has(i + dx, j + dz));
    const n = o.filter(Boolean).length;
    const run = n === 2 && ((o[0] && o[2]) || (o[1] && o[3]));
    return { o, n, run, axis: o[0] || o[2] ? 'x' : 'z' };
  };
  const rand = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

  for (const [i, j] of cells) {
    const x = gx(i), z = gz(j), k = kind(i, j);
    if (k.run) {
      // ---- a straight piece: the strip, kerbs on both sides, lines (stopping short of junctions)
      const along = k.axis === 'x';
      const [a0, a1] = along ? [x - H, x + H] : [z - H, z + H];
      if (along) quad(a0, z - HW, a1, z + HW); else quad(x - HW, a0, x + HW, a1);
      const ends = [-1, 1].map((s) => {
        const [ni, nj] = along ? [i + s, j] : [i, j + s];
        const nk = kind(ni, nj);
        return { node: !nk.run || nk.axis !== k.axis, nk, s };
      });
      for (const side of [-1, 1]) {
        // kerb: shorten at an end whose junction has an arm on this side (the rounded corner takes over there)
        let lo = a0, hi = a1;
        for (const e of ends) {
          if (!e.node) continue;
          const armOnSide = e.nk.o[along ? (side > 0 ? 1 : 3) : (side > 0 ? 0 : 2)];
          const cut = (HW + R) - H;
          if (armOnSide) { if (e.s < 0) lo += cut; else hi -= cut; }
        }
        const off = side * (HW + KERB_W / 2);
        if (along) kerb(lo, z + off, hi, z + off); else kerb(x + off, lo, x + off, hi);
        // the solid edge line, stopping before crossings
        let el = a0, eh = a1;
        for (const e of ends) if (e.node && e.nk.n >= 3) { if (e.s < 0) el += 3.6; else eh -= 3.6; }
        const eo = side * (HW - 0.45);
        if (eh - el > 0.3) { const c = (el + eh) / 2; if (along) mark(white, c, z + eo, eh - el, 0.12, 'x'); else mark(white, x + eo, c, eh - el, 0.12, 'z'); }
        // a drain grate now and then by the kerb
        if (rand() < 0.18) { const c = along ? x : z; if (along) mark(dark, c, z + side * (HW - 0.25), 0.7, 0.35, 'x'); else mark(dark, x + side * (HW - 0.25), c, 0.7, 0.35, 'z'); }
      }
      // centre line: two dashes per tile (none on the stretch into a junction: that's the crossing)
      for (const d of [-1.75, 1.75]) {
        const near = ends.some((e) => e.node && e.nk.n >= 3 && Math.sign(d) === e.s);
        if (near) continue;
        if (along) mark(white, x + d, z, 1.9, 0.14, 'x'); else mark(white, x, z + d, 1.9, 0.14, 'z');
      }
      // a manhole cover in the middle of a lane, sometimes
      if (rand() < 0.12) {
        const lane = (rand() < 0.5 ? -1 : 1) * HW / 2;
        dark.push(new THREE.Matrix4().compose(new THREE.Vector3(along ? x + (rand() - 0.5) * 3 : x + lane, Y.mark, along ? z + lane : z + (rand() - 0.5) * 3), new THREE.Quaternion(), new THREE.Vector3(0.9, 1, 0.9)));
      }
    } else {
      // ---- a node: a square of asphalt, kerbs on its closed sides, rounded fillets between neighbouring arms
      quad(x - HW, z - HW, x + HW, z + HW);
      k.o.forEach((open, d) => {
        if (open) return;
        const [dx, dz] = DIRS[d];
        // closed side: a straight kerb across the square's edge
        if (dx) kerb(x + dx * (HW + KERB_W / 2), z - HW, x + dx * (HW + KERB_W / 2), z + HW);
        else kerb(x - HW, z + dz * (HW + KERB_W / 2), x + HW, z + dz * (HW + KERB_W / 2));
      });
      // corners: between two open arms a rounded kerb (and asphalt filling the corner)
      for (let d = 0; d < 4; d++) {
        const e = (d + 1) % 4;
        if (!k.o[d] || !k.o[e]) continue;
        const [ax, az] = DIRS[d], [bx, bz] = DIRS[e];
        const sx = ax + bx, sz = az + bz; // the diagonal (±1, ±1)
        const cx = x + sx * (HW + R), cz = z + sz * (HW + R); // arc centre, out beyond the corner
        fillets.push(cornerFillet(x + sx * HW, z + sz * HW, cx, cz, sx, sz));
        // the kerb: an arc round (cx, cz) just inside the asphalt's edge, from arm e's kerb (t = 0) to arm d's (t = π/2)
        const r = R - KERB_W / 2, steps = 6;
        let px = null, pz = null;
        for (let s = 0; s <= steps; s++) {
          const t = (s / steps) * (Math.PI / 2);
          const vx = cx - sx * r * Math.cos(t), vz = cz - sz * r * Math.sin(t);
          if (px !== null) kerb(px, pz, vx, vz);
          px = vx; pz = vz;
        }
      }
      // zebra crossings + stop lines on each arm of a real junction (3 or 4 ways)
      if (k.n >= 3 && !NO_ZEBRA.has(`${i},${j}`)) {
        k.o.forEach((open, d) => {
          if (!open) return;
          const [dx, dz] = DIRS[d];
          const nk = kind(i + dx, j + dz);
          if (!nk.run) return; // two junctions side by side: no room
          zebra(white, x + dx * (HW + 1.5), z + dz * (HW + 1.5), dx ? 'z' : 'x');
          // stop line across the lane coming in (traffic drives on the right: the lane on the left of the arm)
          const lx = x + dx * (HW + 2.9), lz = z + dz * (HW + 2.9);
          const across = dx ? 'z' : 'x';
          const laneSide = dx ? -dx : dz; // which half of the road the incoming lane is on
          if (across === 'z') mark(white, lx, lz + laneSide * HW / 2, HW - 0.3, 0.32, 'z');
          else mark(white, lx + laneSide * HW / 2, lz, HW - 0.3, 0.32, 'x');
          // a painted arrow in that lane, pointing into the junction
          const ax = x + dx * (HW + 5.6) + (across === 'x' ? laneSide * HW / 2 : 0), az = z + dz * (HW + 5.6) + (across === 'z' ? laneSide * HW / 2 : 0);
          arrows.push(new THREE.Matrix4().compose(new THREE.Vector3(ax, Y.mark, az), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dx, dz)), new THREE.Vector3(1.3, 1, 2.6))); // (the tip is the plane's -z)
        });
      }
    }
  }
  for (const c of CROSSWALKS) zebra(white, c.x, c.z, c.axis);

  // ---- meshes
  const roadMat = toon(0xffffff, { map: asphaltTexture() });
  const geo = mergeGeometries([...asphalt, ...fillets]);
  worldUV(geo, 9);
  const road = new THREE.Mesh(geo, roadMat);
  road.receiveShadow = true;
  group.add(road);
  const inst = (geom, mat, list, shadows = false) => {
    if (!list.length) return;
    const m = new THREE.InstancedMesh(geom, mat, list.length);
    list.forEach((mx, i) => m.setMatrixAt(i, mx));
    m.receiveShadow = true;
    m.castShadow = shadows;
    group.add(m);
  };
  const kerbGeo = new THREE.BoxGeometry(1, KERB_H, KERB_W);
  inst(kerbGeo, toon(0xc9ccd2), kerbs, false);
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  inst(flat, new THREE.MeshToonMaterial({ color: 0xf4f4f0, polygonOffset: true, polygonOffsetFactor: -2 }), white);
  inst(flat, new THREE.MeshToonMaterial({ color: 0xf2c230, polygonOffset: true, polygonOffsetFactor: -2 }), yellow);
  inst(new THREE.CircleGeometry(0.5, 14).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ color: 0x3a3d44, polygonOffset: true, polygonOffsetFactor: -2 }), dark);
  inst(flat, new THREE.MeshToonMaterial({ map: arrowTexture(), transparent: true, alphaTest: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }), arrows);
  // words on the road (AMBULANCE bay, SLOW by the school…), with an optional box painted round them
  for (const t of ROAD_TEXT) {
    const tex = canvasTexture(512, 160, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = t.color ?? '#f4f4f0';
      c.font = `700 ${t.text.length > 7 ? 92 : 118}px Anton, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.save(); c.translate(w / 2, h / 2); c.scale(1, 1.35); c.fillText(t.text, 0, 4); c.restore();
    });
    const len = t.text.length > 7 ? 5 : 3.4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, len * 160 / 512 * 1.6).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ map: tex, transparent: true, alphaTest: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(t.x, Y.mark, t.z);
    m.rotation.y = t.yaw ?? 0;
    m.receiveShadow = true;
    group.add(m);
    if (t.box) {
      const [bw, bd] = t.box, col = t.boxColor ?? 0xf2c230;
      const list = [];
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.yaw ?? 0);
      const at = (u, v) => new THREE.Vector3(u, 0, v).applyQuaternion(q).add(new THREE.Vector3(t.x, Y.mark, t.z));
      for (const [u, v, sw, sd] of [[0, -bd / 2, bw, 0.18], [0, bd / 2, bw, 0.18], [-bw / 2, 0, 0.18, bd], [bw / 2, 0, 0.18, bd]]) list.push(new THREE.Matrix4().compose(at(u, v), q, new THREE.Vector3(sw, 1, sd)));
      inst(flat, new THREE.MeshToonMaterial({ color: col, polygonOffset: true, polygonOffsetFactor: -2 }), list);
    }
  }
  return group;
}

/** A straight-on lane arrow (points along the plane's -z), white on transparent. */
function arrowTexture() {
  return canvasTexture(64, 128, (c) => {
    c.clearRect(0, 0, 64, 128);
    c.fillStyle = '#f4f4f0';
    c.beginPath();
    c.moveTo(32, 2); c.lineTo(60, 44); c.lineTo(41, 44); c.lineTo(41, 126); c.lineTo(23, 126); c.lineTo(23, 44); c.lineTo(4, 44); c.closePath();
    c.fill();
  });
}

/** Zebra stripes across a road centred at (x, z); `across` is the axis the stripes run along. */
function zebra(list, x, z, across) {
  const n = Math.floor((HW * 2 - 0.6) / 0.85);
  for (let s = 0; s < n; s++) {
    const o = -HW + 0.55 + s * 0.85;
    if (across === 'z') list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, Y.mark, z + o), new THREE.Quaternion(), new THREE.Vector3(1.8, 1, 0.45)));
    else list.push(new THREE.Matrix4().compose(new THREE.Vector3(x + o, Y.mark, z), new THREE.Quaternion(), new THREE.Vector3(0.45, 1, 1.8)));
  }
}

/** The asphalt filling a junction corner: the square from the corner (qx, qz) out to the arc centre, minus the arc. */
function cornerFillet(qx, qz, cx, cz, sx, sz) {
  // corner Q → A (on arm d's edge, at the arc's start) → round the arc → B (on arm e's edge) → back to Q
  const pts = [[qx, qz]];
  for (let s = 0; s <= 8; s++) {
    const t = (Math.PI / 2) * (1 - s / 8);
    pts.push([cx - sx * R * Math.cos(t), cz - sz * R * Math.sin(t)]);
  }
  const pos = [];
  for (let s = 1; s < pts.length - 1; s++) {
    const [a, b, c] = [pts[0], pts[s], pts[s + 1]];
    // keep every triangle facing up (counter-clockwise seen from above, i.e. in x/-z)
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const [p1, p2] = cross < 0 ? [b, c] : [c, b];
    pos.push(a[0], Y.asphalt, a[1], p1[0], Y.asphalt, p1[1], p2[0], Y.asphalt, p2[1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return g;
}

/** Planar UVs from world x/z, so the asphalt grain is continuous across every piece. */
function worldUV(geo, size) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / size; uv[i * 2 + 1] = p.getZ(i) / size; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Asphalt: a fine speckled grain with a few darker patches and repairs. */
function asphaltTexture() {
  const tex = canvasTexture(512, 512, (c) => {
    c.fillStyle = '#585d66'; c.fillRect(0, 0, 512, 512);
    const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    for (let i = 0; i < 9; i++) { // soft patches
      const x = rnd() * 512, y = rnd() * 512, r = 40 + rnd() * 90;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rnd() < 0.5 ? 'rgba(40,44,52,0.22)' : 'rgba(120,124,132,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 9000; i++) { // grain
      const v = 70 + rnd() * 70;
      c.fillStyle = `rgba(${v},${v + 2},${v + 8},${0.25 + rnd() * 0.35})`;
      c.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
    }
    c.strokeStyle = 'rgba(35,38,45,0.35)'; c.lineWidth = 2; // a couple of sealed cracks
    for (let i = 0; i < 4; i++) { c.beginPath(); let x = rnd() * 512, y = rnd() * 512; c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.2) * 40; c.lineTo(x, y); } c.stroke(); }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
