// Shared building blocks for the city zones (Downtown, Maple Heights, Sunset Pier): seeded randomness,
// instanced street lamps that glow at night, buildings with colliders, parked cars, trees and hedges.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, instanced, canvasTexture } from './toon.js';
import { addBox, addCircle, cameraBlockers } from './world.js';
import { scatter, KIT_SIZES, KIT_CENTERS } from './kit.js';

/** Small deterministic random generator (same city every visit). */
export function seeded(seed = 1) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  r.pick = (a) => a[Math.floor(r() * a.length)];
  r.range = (a, b) => a + r() * (b - a);
  return r;
}

/** A flat paved area (slightly raised so it never z-fights with the ground). */
export function slab(group, x0, z0, x1, z1, color, { y = 0.03, map = null, repeat = null } = {}) {
  const mat = map ? new THREE.MeshToonMaterial({ color, map }) : toon(color);
  if (map && repeat) { map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(...repeat); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  group.add(m);
  return m;
}

/** A kerb around a rectangle (thin raised edge, like a pavement border). */
export function kerb(group, x0, z0, x1, z1, color = 0xaab2bd) {
  const mats = [], h = 0.14, t = 0.3;
  const add = (cx, cz, w, d) => mats.push(new THREE.Matrix4().compose(new THREE.Vector3(cx, h / 2, cz), new THREE.Quaternion(), new THREE.Vector3(w, h, d)));
  add((x0 + x1) / 2, z0, x1 - x0, t); add((x0 + x1) / 2, z1, x1 - x0, t);
  add(x0, (z0 + z1) / 2, t, z1 - z0); add(x1, (z0 + z1) / 2, t, z1 - z0);
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), color, mats, { outline: 0, cast: false }));
}

/**
 * Street lamps (pole + arm + glowing bulb), instanced. lamps: [{x, z, rot}] (rot = the way the arm points).
 * Returns the bulb positions for the night halos.
 */
export function streetLamps(group, lamps, { height = 5.2 } = {}) {
  if (!lamps.length) return [];
  const poles = [], arms = [], heads = [], bulbs = [];
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const l of lamps) {
    const r = l.rot ?? 0, dx = Math.sin(r), dz = Math.cos(r);
    q.setFromAxisAngle(up, r);
    poles.push(new THREE.Matrix4().compose(new THREE.Vector3(l.x, height / 2, l.z), q.clone(), new THREE.Vector3(1, height, 1)));
    arms.push(new THREE.Matrix4().compose(new THREE.Vector3(l.x + dx * 0.6, height - 0.05, l.z + dz * 0.6), q.clone(), new THREE.Vector3(1, 1, 1)));
    heads.push(new THREE.Matrix4().compose(new THREE.Vector3(l.x + dx * 1.15, height - 0.12, l.z + dz * 1.15), q.clone(), new THREE.Vector3(1, 1, 1)));
    bulbs.push({ x: l.x + dx * 1.15, y: height - 0.38, z: l.z + dz * 1.15 });
    addCircle(l.x, l.z, 0.25);
  }
  group.add(instanced(new THREE.CylinderGeometry(0.08, 0.12, 1, 8), 0x2b2f38, poles, { outline: 0.02 }));
  group.add(instanced(new THREE.BoxGeometry(0.1, 0.1, 1.3), 0x2b2f38, arms, { outline: 0.015 }));
  group.add(instanced(new THREE.BoxGeometry(0.5, 0.22, 0.75), 0x2b2f38, heads, { outline: 0.015 }));
  // the bulbs share the street-lamp material, so they light up at night with the rest (see daynight.js)
  const bulbMat = toon(0xfff3b0, { emissive: 0x6a5a20 });
  const bulbGeo = new THREE.BoxGeometry(0.38, 0.1, 0.6);
  const inst = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbs.length);
  bulbs.forEach((b, i) => inst.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(b.x, b.y + 0.2, b.z), new THREE.Quaternion().setFromAxisAngle(up, lamps[i].rot ?? 0), new THREE.Vector3(1, 1, 1))));
  inst.computeBoundingSphere();
  group.add(inst);
  return bulbs;
}

/**
 * Kenney buildings: [{ name, x, z, rot (0 = front faces +z, π = faces -z), scale, wall, roof }].
 * Instanced per model+colour, each gets a box collider and a box for the camera to stop at.
 */
export function buildings(group, list, { outline = 0.012, blockers = [] } = {}) {
  const groups = new Map();
  for (const b of list) {
    const key = `${b.name}|${b.wall ?? ''}|${b.roof ?? ''}`;
    if (!groups.has(key)) groups.set(key, []);
    // Kenney's city models face -z (hence + π); shift off-centre models so their footprint is centred on x, z
    const th = (b.rot ?? 0) + Math.PI, c = KIT_CENTERS[b.name];
    const ox = c ? (c.x * Math.cos(th) + c.z * Math.sin(th)) * b.scale : 0, oz = c ? (-c.x * Math.sin(th) + c.z * Math.cos(th)) * b.scale : 0;
    groups.get(key).push({ x: b.x - ox, z: b.z - oz, rot: th, scale: b.scale });
    const size = KIT_SIZES[b.name];
    if (!size) continue;
    const turned = Math.abs(Math.sin(b.rot ?? 0)) > 0.5;
    const w = (turned ? size.z : size.x) * b.scale, d = (turned ? size.x : size.z) * b.scale, h = size.y * b.scale;
    if (!b.noCollide) addBox(b.x, b.z, w * 0.96, d * 0.96);
    blockers.push(new THREE.BoxGeometry(w * 0.9, h * 0.95, d * 0.9).translate(b.x, h * 0.475, b.z));
    b.w = w; b.d = d; b.h = h;
  }
  for (const [key, ts] of groups) {
    const [name, wall, roof] = key.split('|');
    group.add(scatter(name, ts, { outline, wall: wall === '' ? null : Number(wall), roof: roof === '' ? null : Number(roof) }));
  }
  return blockers;
}

/** One invisible merged mesh the follow camera stops at instead of clipping into buildings. */
export function addCameraBlocker(group, geos) {
  if (!geos.length) return;
  const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial());
  m.visible = false;
  group.add(m);
  m.updateMatrixWorld(true);
  cameraBlockers.push(m);
}

/** Parked cars: [{ x, z, rot, name }] with colliders. */
export function parkedCars(group, cars, { scale = 2.3 } = {}) {
  const by = {};
  for (const c of cars) {
    (by[c.name] ??= []).push({ x: c.x, z: c.z, rot: c.rot, scale });
    const dx = Math.sin(c.rot) * 1.4, dz = Math.cos(c.rot) * 1.4;
    addCircle(c.x + dx, c.z + dz, 1.35);
    addCircle(c.x - dx, c.z - dz, 1.35);
  }
  for (const [name, ts] of Object.entries(by)) group.add(scatter(name, ts, { outline: 0.012 }));
}

/** Trees from the nature kit: [{ x, z, kind, scale }] with trunk colliders. */
export function trees(group, list) {
  const by = {};
  for (const t of list) { (by[t.kind] ??= []).push({ x: t.x, z: t.z, rot: t.rot ?? 0, scale: t.scale }); addCircle(t.x, t.z, 0.45); }
  for (const [kind, ts] of Object.entries(by)) group.add(scatter(kind, ts, { outline: 0.02 }));
}

/** A hedge wall along a line (town kit 'hedge'), used to show where a zone ends. */
export function hedgeLine(group, x0, z0, x1, z1, { skip = () => false, scale = 2.6 } = {}) {
  const len = Math.hypot(x1 - x0, z1 - z0), step = 2.6;
  const rot = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
  const list = [];
  for (let d = step / 2; d < len; d += step) {
    const x = x0 + ((x1 - x0) * d) / len, z = z0 + ((z1 - z0) * d) / len;
    if (!skip(x, z)) list.push({ x, z, rot, scale });
  }
  group.add(scatter('hedge', list, { outline: 0.015 }));
  return list;
}

/** Canvas texture of square paving stones. */
export function pavingTexture(base = '#d9d4ca', line = '#bdb6a8', n = 4) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = line; ctx.lineWidth = 4;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo((i * w) / n, 0); ctx.lineTo((i * w) / n, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i * h) / n); ctx.lineTo(w, (i * h) / n); ctx.stroke();
    }
  });
}

/** A sign readable from both sides (a double-sided plane would show mirrored text from the back). */
export function signBoard(geometry, map) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ map });
  g.add(new THREE.Mesh(geometry, mat));
  const back = new THREE.Mesh(geometry, mat);
  back.rotation.y = Math.PI;
  g.add(back);
  return g;
}
