// Gives a static four-legged model (Gorge, from Meshy — which can't rig animals) a simple skeleton so it can walk:
// the mesh is straightened (head → +z), then every vertex is weighted to one of seven bones by where it sits —
// four legs, the head, the tail, the body — and walk() swings the legs in a diagonal gait.
import * as THREE from 'three';

/**
 * model: the loaded glTF scene (one mesh). height: target standing height.
 * Returns { root, walk(dt, speed), legs, head, tail } — root is a Group holding the SkinnedMesh.
 */
export function rigQuadruped(model, height, material) {
  model.updateMatrixWorld(true);
  const src = [];
  model.traverse((o) => { if (o.isMesh) src.push(o); });
  const mesh = src[0];
  // plain float attributes in model space
  const geo = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = mesh.geometry.attributes[name];
    if (!a) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
    geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  if (mesh.geometry.index) geo.setIndex(mesh.geometry.index.clone());
  geo.applyMatrix4(mesh.matrixWorld);

  // 1. which way is the body? principal axis of the footprint
  const pos = geo.attributes.position, n = pos.count;
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += pos.getX(i); cz += pos.getZ(i); }
  cx /= n; cz /= n;
  let sxx = 0, szz = 0, sxz = 0;
  for (let i = 0; i < n; i++) { const dx = pos.getX(i) - cx, dz = pos.getZ(i) - cz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
  let axis = 0.5 * Math.atan2(2 * sxz, sxx - szz); // angle of the long axis from +x
  // 2. which end is the head? the end with more mass up high (the tail is thin)
  geo.computeBoundingBox();
  const ymin = geo.boundingBox.min.y, H0 = geo.boundingBox.max.y - ymin;
  const dir = new THREE.Vector2(Math.cos(axis), Math.sin(axis));
  let ahead = 0, behind = 0;
  for (let i = 0; i < n; i++) {
    if ((pos.getY(i) - ymin) / H0 < 0.55) continue;
    const t = (pos.getX(i) - cx) * dir.x + (pos.getZ(i) - cz) * dir.y;
    if (t > 0) ahead++; else behind++;
  }
  if (behind > ahead) axis += Math.PI;
  // rotate so the head points along +z, centre on x/z, feet on y = 0, scale to height
  const yaw = Math.atan2(Math.cos(axis), Math.sin(axis)); // rotation that takes the head direction to +z
  geo.translate(-cx, -ymin, -cz);
  geo.rotateY(-yaw + 0); // (rotateY by -(angle of head from +z))
  geo.computeBoundingBox();
  // make sure the head really is at +z now (flip if the maths landed backwards)
  let hz = 0, hc = 0;
  for (let i = 0; i < n; i++) if (pos.getY(i) / H0 > 0.6) { hz += pos.getZ(i); hc++; }
  if (hz / hc < 0) geo.rotateY(Math.PI);
  const k = height / H0;
  geo.scale(k, k, k);
  geo.computeBoundingBox();
  const bb = geo.boundingBox, H = bb.max.y, zmin = bb.min.z, zmax = bb.max.z, L = zmax - zmin;
  geo.computeVertexNormals();

  // 3. find the four feet: the low vertices, split front/back and left/right
  const legTop = H * 0.3;
  const feet = { FL: [], FR: [], BL: [], BR: [] };
  let lowMidZ = 0, lowN = 0;
  for (let i = 0; i < n; i++) if (pos.getY(i) < H * 0.15) { lowMidZ += pos.getZ(i); lowN++; }
  lowMidZ /= Math.max(1, lowN);
  for (let i = 0; i < n; i++) {
    if (pos.getY(i) > H * 0.15) continue;
    const key = (pos.getZ(i) > lowMidZ ? 'F' : 'B') + (pos.getX(i) > 0 ? 'L' : 'R');
    feet[key].push([pos.getX(i), pos.getZ(i)]);
  }
  const centre = (arr) => arr.length ? arr.reduce((s, [x, z]) => [s[0] + x / arr.length, s[1] + z / arr.length], [0, 0]) : [0, 0];

  // 4. bones: root → body → legs / head / tail
  const root = new THREE.Bone(), body = new THREE.Bone();
  root.add(body);
  body.position.set(0, legTop, 0);
  const legs = {};
  for (const key of ['FL', 'FR', 'BL', 'BR']) {
    const [x, z] = centre(feet[key]);
    const b = new THREE.Bone();
    b.position.set(x, 0, z); // relative to body (which sits at legTop): the hip/shoulder joint
    body.add(b);
    legs[key] = b;
  }
  const head = new THREE.Bone();
  head.position.set(0, H * 0.55 - legTop, zmax - L * 0.32);
  body.add(head);
  const tail = new THREE.Bone();
  tail.position.set(0, H * 0.45 - legTop, zmin + L * 0.24);
  body.add(tail);
  const bones = [root, body, legs.FL, legs.FR, legs.BL, legs.BR, head, tail];
  const IDX = { body: 1, FL: 2, FR: 3, BL: 4, BR: 5, head: 6, tail: 7 };

  // 5. weights: legs below the belly (blending into the body), head at the front top, tail at the back top
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let a = IDX.body, b = IDX.body, w = 1;
    const legW = THREE.MathUtils.clamp((legTop + H * 0.06 - y) / (H * 0.12), 0, 1);
    if (legW > 0 && y < legTop + H * 0.06) {
      const key = (z > lowMidZ ? 'F' : 'B') + (x > 0 ? 'L' : 'R');
      a = IDX[key]; w = legW;
    } else if (z > zmax - L * 0.34 && y > H * 0.45) { a = IDX.head; w = THREE.MathUtils.clamp((z - (zmax - L * 0.38)) / (L * 0.08), 0, 1); }
    else if (z < zmin + L * 0.26 && y > H * 0.42) { a = IDX.tail; w = THREE.MathUtils.clamp(((zmin + L * 0.3) - z) / (L * 0.08), 0, 1); }
    si.set([a, b, 0, 0], i * 4);
    sw.set([w, 1 - w, 0, 0], i * 4);
  }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  const skinned = new THREE.SkinnedMesh(geo, material);
  skinned.add(root);
  skinned.bind(new THREE.Skeleton(bones));
  skinned.castShadow = true;
  skinned.frustumCulled = false;
  const group = new THREE.Group();
  group.add(skinned);

  let phase = 0, amp = 0;
  return {
    root: group, legs, head, tail, body,
    /** speed in units/s (0 = standing). */
    animate(dt, t, speed) {
      const moving = speed > 0.2;
      amp += ((moving ? Math.min(0.75, 0.35 + speed * 0.12) : 0) - amp) * Math.min(1, dt * 8);
      phase += dt * (moving ? 5 + speed * 3.2 : 0);
      const s = Math.sin(phase);
      legs.FL.rotation.x = s * amp; legs.BR.rotation.x = s * amp; // a diagonal trot
      legs.FR.rotation.x = -s * amp; legs.BL.rotation.x = -s * amp;
      body.position.y = legTop + Math.abs(Math.cos(phase)) * 0.02 * (amp / 0.6);
      body.rotation.z = Math.sin(phase) * 0.03 * (amp / 0.6);
      head.rotation.x = Math.sin(phase * 2) * 0.06 * (amp / 0.6) + (moving ? 0 : Math.sin(t * 0.7) * 0.05);
      head.rotation.y = moving ? 0 : Math.sin(t * 0.4) * 0.35; // looking around while waiting
      tail.rotation.y = Math.sin(t * (moving ? 6 : 1.6)) * (moving ? 0.25 : 0.45);
      tail.rotation.x = -0.1 + Math.sin(t * 1.1) * 0.08;
    },
  };
}
