// Two community models from Meshy (CC0, made for 3D printing: plain geometry, no textures), coloured here from their
// shape so they look like real vehicles in the showroom:
//   'supra' — a Mk4-style sports coupe body shell (no wheels, open underneath): paint, dark glass, lights, + wheels
//   'moto'  — an adventure motorbike with panniers: tyres, spoked rims, alloy cases, painted tank, black seat, engine
// Both point their nose along -x (like the Fulmine). Colours go in a vertex-colour attribute; one glossy material.
import * as THREE from 'three';

const C = (hex) => new THREE.Color(hex);

/** Collects each mesh's vertices in the model's own space (model not yet rotated or scaled). */
function eachVertex(model, fn) {
  model.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert();
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  model.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    if (!g.attributes.normal) g.computeVertexNormals();
    const m = inv.clone().multiply(o.matrixWorld);
    nm.getNormalMatrix(m);
    const pos = g.attributes.position, nor = g.attributes.normal;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      fn(v, n, col, i);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  });
}

function bounds(model) {
  model.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    box.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)));
  });
  return box;
}

const glossy = (envMap) => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.3, envMap, envMapIntensity: 1.1, side: THREE.DoubleSide });

/** The sports coupe: paint + glass + lights, and four wheels in its arches. */
export function dressSupra(model, paint, envMap) {
  const b = bounds(model), L = b.max.x - b.min.x, H = b.max.y - b.min.y, W = b.max.z - b.min.z;
  const body = C(paint), glass = C(0x1a2230), lamp = C(0xf4f1e2), tail = C(0xc0181e), under = C(0x202226), trim = C(0x2a2c30);
  // arches: gaps in the skirt along the bottom edge, front half and rear half
  const bins = 60, low = new Array(bins).fill(0);
  eachVertex(model, (v) => { if (v.y - b.min.y < H * 0.14) low[Math.min(bins - 1, Math.floor(((v.x - b.min.x) / L) * bins))]++; });
  const arch = (from, to) => {
    let best = null, run = null;
    for (let i = from; i < to; i++) {
      if (low[i] === 0) { run ??= { a: i, b: i }; run.b = i; if (!best || run.b - run.a > best.b - best.a) best = { ...run }; }
      else run = null;
    }
    return best ? { x: b.min.x + ((best.a + best.b + 1) / 2 / bins) * L, w: ((best.b - best.a + 1) / bins) * L } : null;
  };
  const front = arch(2, bins / 2) ?? { x: b.min.x + L * 0.2, w: L * 0.18 }, rear = arch(bins / 2, bins - 2) ?? { x: b.min.x + L * 0.8, w: L * 0.18 };
  const yRel = (v) => (v.y - b.min.y) / H, xRel = (v) => (v.x - b.min.x) / L;
  eachVertex(model, (v, n, col, i) => {
    const y = yRel(v), x = xRel(v);
    let c = body;
    if (n.y < -0.6 && y < 0.3) c = under; // the inside of the shell / underside
    else if (y > 0.58 && x > 0.28 && x < 0.86 && (Math.abs(n.y) < 0.72 || (x < 0.52 && n.y < 0.9 && n.x < -0.25))) c = glass; // side windows + the raked windscreen
    else if (x < 0.06 && n.x < -0.55 && y > 0.3 && y < 0.62) c = lamp; // headlights (nose at -x)
    else if (x > 0.94 && n.x > 0.5 && y > 0.4 && y < 0.72) c = tail; // tail lights
    else if (y < 0.12) c = trim; // the skirt edge
    c.toArray(col, i * 3);
  });
  model.traverse((o) => { if (o.isMesh) { o.material = glossy(envMap); o.castShadow = true; o.receiveShadow = true; } });
  // wheels: tyre + rim, just inside each arch, the bottom of the tyre a little under the shell
  const r = Math.min(front.w, rear.w) * 0.46, tw = W * 0.2;
  const tyre = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd0d4da, metalness: 0.8, roughness: 0.25, envMap });
  for (const a of [front, rear]) for (const s of [-1, 1]) {
    const w = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, tw, 28), tyre);
    t.rotation.x = Math.PI / 2;
    w.add(t);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.66, r * 0.66, tw * 1.04, 10), rimMat);
    rim.rotation.x = Math.PI / 2;
    w.add(rim);
    for (let k = 0; k < 5; k++) { // spokes
      const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 1.2, r * 0.12, tw * 1.08), rimMat);
      sp.rotation.z = (k / 5) * Math.PI;
      w.add(sp);
    }
    w.position.set(a.x, b.min.y + r * 0.82, s * (W / 2 - tw * 0.62));
    w.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    model.add(w);
  }
  return model;
}

/** The adventure bike: tyres, spoked wheels, alloy cases, painted tank/fairing, black seat, dark engine and frame. */
export function dressMoto(model, paint, envMap) {
  const b = bounds(model), L = b.max.x - b.min.x, H = b.max.y - b.min.y, W = b.max.z - b.min.z;
  // the wheels: the low vertices at each end tell us where they touch the ground; radius from the front tyre's front edge
  let fx = 0, fn = 0, rx = 0, rn = 0;
  eachVertex(model, (v) => { if (v.y - b.min.y < H * 0.04) { if (v.x < b.min.x + L / 2) { fx += v.x; fn++; } else { rx += v.x; rn++; } } });
  const fc = fn ? fx / fn : b.min.x + L * 0.2, rc = rn ? rx / rn : b.min.x + L * 0.78;
  let frontEdge = Infinity;
  eachVertex(model, (v) => { if (v.y - b.min.y < H * 0.4 && v.x < fc) frontEdge = Math.min(frontEdge, v.x); });
  const R = Math.max(H * 0.2, Math.min(H * 0.36, fc - frontEdge)), cy = b.min.y + R;
  const tyre = C(0x161618), rim = C(0xbfc4ca), alloy = C(0xa8adb4), seat = C(0x1b1b1d), engine = C(0x3c3f45), body = C(paint), glassC = C(0x9fb8c8);
  eachVertex(model, (v, n, col, i) => {
    const y = (v.y - b.min.y) / H, x = (v.x - b.min.x) / L, z = Math.abs(v.z - (b.min.z + b.max.z) / 2) / W;
    const df = Math.hypot(v.x - fc, v.y - cy) / R, dr = Math.hypot(v.x - rc, v.y - cy) / R;
    const d = Math.min(df, dr);
    let c = engine;
    if (d < 1.08 && d > 0.74) c = tyre;
    else if (d <= 0.74 && (y < 0.5)) c = rim;
    else if (x > 0.55 && y > 0.28 && y < 0.72 && z > 0.22) c = alloy; // the side panniers
    else if (x > 0.62 && y >= 0.68) c = alloy; // the top case
    else if (x < 0.22 && y > 0.82) c = glassC; // the windscreen
    else if (x > 0.38 && x < 0.66 && y > 0.52 && y < 0.7 && z < 0.22 && n.y > 0.3) c = seat;
    else if (x < 0.5 && y > 0.5) c = body; // tank, fairing and beak
    c.toArray(col, i * 3);
  });
  model.traverse((o) => { if (o.isMesh) { o.material = glossy(envMap); o.material.side = THREE.FrontSide; o.castShadow = true; o.receiveShadow = true; } });
  return model;
}
