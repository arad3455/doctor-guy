// The drivable ambulance: Meshy model (assets/props/ambulance.glb) with a procedural fallback,
// arcade driving, collisions against the world, siren lights, and getting in/out.
import * as THREE from 'three';
import { gltfLoader, toonify } from './skinned.js';
import { part, toon } from './toon.js';
import { getColliders, clampWalkable, inPond, WORLD } from './world.js';

const LENGTH = 7; // game units (Doctor Guy is 2.45 tall)
const MAX_FWD = 12.5;
const MAX_ROAD = 21; // on Zoo Road
const onOpenRoad = (p) => p.x > -24 && p.x < 137 && Math.abs(p.z + 37) < 3.6; // all of Zoo Road
const MAX_REV = 5;
const ACCEL = 7;
const ACCEL_ROAD = 10;
const BRAKE = 22;
const DRAG = 3.2;
const STEER = 1.9; // rad/s at full lock and speed
const REACH = LENGTH / 2 - 1.35; // collision circles run from bumper to bumper (radius ≈ half the width)
// The generated model's nose points along this local direction once loaded (fixed after inspecting it)
const MODEL_YAW = Math.PI / 2; // generated ambulance's nose points -x
// No black outline: the realistic van has thin panels the outline hull pokes through (dark shards)
const OUTLINE = Number(new URLSearchParams(location.search).get('carOutline') ?? 0);

export const PARKING = { x: -12, z: -37, heading: Math.PI / 2 }; // at the start of Zoo Road by the hospital, nose east

export class Ambulance {
  constructor(scene) {
    this.root = new THREE.Group();
    this.body = new THREE.Group(); // tilts with acceleration/turning
    this.root.add(this.body);
    scene.add(this.root);
    this.pos = new THREE.Vector3(PARKING.x, 0, PARKING.z);
    this.heading = PARKING.heading;
    this.speed = 0;
    this.steer = 0;
    this.siren = false;
    this.driving = false;
    this.width = 2.6;
    this.height = 3.2;
    // three circles along the body: what the car collides with, and what the player bumps into when parked
    this.circles = [-1, -0.5, 0, 0.5, 1].map((k) => ({ type: 'circle', x: 0, z: 0, r: 1.35, owner: 'car', k }));
    getColliders().push(...this.circles);
    this.lights = this.makeLights();
    this.useProcedural();
    this.syncTransform();
  }

  /** Swaps in the generated model if it exists (falls back silently to the procedural van). */
  async loadModel() {
    let gltf;
    try {
      gltf = await gltfLoader.loadAsync(new URL('../assets/props/ambulance.glb', import.meta.url).href);
    } catch {
      return false;
    }
    const model = gltf.scene;
    model.rotation.y = MODEL_YAW;
    model.updateMatrixWorld(true);
    // scale to LENGTH along its longest horizontal axis, centre it, wheels on the ground
    let box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = LENGTH / Math.max(size.x, size.z);
    model.scale.setScalar(s);
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -box.min.y, -c.z);
    toonify(model, OUTLINE);
    model.traverse((o) => { if (o.isMesh) { o.frustumCulled = true; o.receiveShadow = true; } });
    const fitted = new THREE.Box3().setFromObject(model);
    this.width = Math.min(fitted.max.x - fitted.min.x, fitted.max.z - fitted.min.z);
    this.height = fitted.max.y;
    this.body.remove(this.procedural);
    this.body.add(model);
    this.model = model;
    this.placeLights();
    return true;
  }

  /** The original blocky van, kept as a fallback. Nose points +z. */
  useProcedural() {
    const g = new THREE.Group();
    const ab = part(new THREE.BoxGeometry(2.4, 2.2, 4.6), 0xffffff, { outline: 0.04 });
    ab.position.set(0, 1.5, -0.9);
    g.add(ab);
    const cab = part(new THREE.BoxGeometry(2.3, 1.4, 1.8), 0xffffff, { outline: 0.04 });
    cab.position.set(0, 1.1, 2.3);
    g.add(cab);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.35, 6.45), toon(0xe0323a));
    stripe.position.set(0, 1.4, 0);
    g.add(stripe);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 0.05), toon(0x7fb8e8));
    windshield.position.set(0, 1.45, 3.21);
    g.add(windshield);
    for (const [wx, wz] of [[-1.2, -2.3], [1.2, -2.3], [-1.2, 2.1], [1.2, 2.1]]) {
      const wheel = part(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16), 0x222222);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      g.add(wheel);
    }
    this.procedural = g;
    this.body.add(g);
    this.height = 2.8;
    this.placeLights();
  }

  /** Flashing red/blue lamps on the roof (lit while the siren is on). */
  makeLights() {
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.17, 0.26), new THREE.MeshBasicMaterial({ color: 0x551111 }));
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.17, 0.26), new THREE.MeshBasicMaterial({ color: 0x111155 }));
    const glow = new THREE.PointLight(0xff3030, 0, 9);
    this.body.add(red, blue, glow);
    return { red, blue, glow };
  }

  /** On the cab's light bar (measured on the generated model: ~18% of the length back from the nose). */
  placeLights() {
    const y = this.model ? this.height * 0.885 : this.height + 0.08;
    const z = this.model ? LENGTH * 0.17 : LENGTH * 0.22;
    this.lights.red.position.set(0.3, y, z); // red on the driver's (left) side, like the reference
    this.lights.blue.position.set(-0.3, y, z);
    this.lights.glow.position.set(0, y + 0.4, z);
  }

  get forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
  get right() { return new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading)); }

  /** Where Doctor Guy stands to get in, and where he's put when he gets out (driver's side). */
  get doorPoint() {
    return this.pos.clone().addScaledVector(this.right, -(this.width / 2 + 0.9)).addScaledVector(this.forward, LENGTH * 0.18);
  }

  syncTransform() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.heading;
    for (const c of this.circles) {
      c.x = this.pos.x + Math.sin(this.heading) * c.k * REACH;
      c.z = this.pos.z + Math.cos(this.heading) * c.k * REACH;
      c.r = this.width / 2 + 0.05;
    }
  }

  /** input: { throttle -1..1, steer -1..1 } */
  update(dt, t, { throttle = 0, steer = 0 } = {}) {
    if (this.driving) {
      // throttle forward/back; pressing against the motion brakes first
      const road = onOpenRoad(this.pos);
      if (throttle > 0) this.speed += (this.speed < 0 ? BRAKE : road ? ACCEL_ROAD : ACCEL) * throttle * dt;
      else if (throttle < 0) this.speed += (this.speed > 0 ? BRAKE : ACCEL * 0.7) * throttle * dt;
      // steering wheel: eases towards the input (no snapping), returns to centre a bit faster
      const rate = Math.abs(steer) < Math.abs(this.steer) ? 7 : 4.5;
      this.steer += (steer - this.steer) * Math.min(1, dt * rate);
    } else {
      this.steer += (0 - this.steer) * Math.min(1, dt * 4);
    }
    // rolling resistance
    const drag = (throttle === 0 || !this.driving ? DRAG * 2.2 : DRAG) * dt;
    this.speed = Math.abs(this.speed) <= drag ? 0 : this.speed - Math.sign(this.speed) * drag;
    const top = onOpenRoad(this.pos) ? MAX_ROAD : MAX_FWD;
    // leaving the road: ease down to the normal top speed instead of snapping
    this.speed = THREE.MathUtils.clamp(this.speed, -MAX_REV, Math.max(top, this.speed - 12 * dt));

    // turning: needs some speed, tighter at low speed, reversed when backing up
    // turning: needs some speed; gentler at high speed so road driving doesn't twitch
    const grip = THREE.MathUtils.clamp(Math.abs(this.speed) / 4, 0, 1) * Math.max(0.35, 1 - Math.abs(this.speed) / (MAX_ROAD * 1.6));
    this.heading -= this.steer * STEER * grip * Math.sign(this.speed) * dt;

    const prev = this.pos.clone();
    this.pos.addScaledVector(this.forward, this.speed * dt);
    if (this.collide()) {
      this.speed *= -0.25; // bump
      this.bumped = 0.35;
    }
    // no driving into the sea or the pond
    if (this.pos.z > WORLD.shoreline - 1 || inPond(this.pos.x, this.pos.z)) {
      this.pos.copy(prev);
      this.speed *= -0.2;
    }
    this.syncTransform();

    // body roll/pitch for feel
    const accel = (this.speed - (this.lastSpeed ?? 0)) / Math.max(dt, 1e-3);
    this.lastSpeed = this.speed;
    this.body.rotation.x += (THREE.MathUtils.clamp(-accel * 0.004, -0.05, 0.05) - this.body.rotation.x) * Math.min(1, dt * 6);
    this.body.rotation.z += (this.steer * grip * 0.05 * Math.sign(this.speed) - this.body.rotation.z) * Math.min(1, dt * 6);
    if (this.bumped > 0) { this.bumped -= dt; this.body.position.y = Math.sin(this.bumped * 40) * 0.04; } else this.body.position.y = 0;

    // siren lights
    const on = this.siren;
    const phase = Math.sin(t * 14) > 0;
    this.lights.red.material.color.setHex(on && phase ? 0xff2020 : 0x551111);
    this.lights.blue.material.color.setHex(on && !phase ? 0x2050ff : 0x111155);
    this.lights.glow.intensity = on ? 6 : 0;
    this.lights.glow.color.setHex(phase ? 0xff3030 : 0x3050ff);
  }

  /** Pushes the car out of static colliders and the walkable bounds. Returns true on a hit. */
  collide() {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const cc of this.circles) {
        const cx = this.pos.x + Math.sin(this.heading) * cc.k * REACH;
        const cz = this.pos.z + Math.cos(this.heading) * cc.k * REACH;
        const r = this.width / 2;
        let px = 0, pz = 0;
        for (const c of getColliders()) {
          if (c.owner === 'car') continue;
          if (c.type === 'circle') {
            const dx = cx - c.x, dz = cz - c.z, d = Math.hypot(dx, dz), min = c.r + r;
            if (d < min && d > 1e-5) { px += (dx / d) * (min - d); pz += (dz / d) * (min - d); }
          } else {
            const nx = THREE.MathUtils.clamp(cx, c.minX, c.maxX), nz = THREE.MathUtils.clamp(cz, c.minZ, c.maxZ);
            const dx = cx - nx, dz = cz - nz, d = Math.hypot(dx, dz);
            if (d < r) {
              if (d > 1e-5) { px += (dx / d) * (r - d); pz += (dz / d) * (r - d); }
              else { pz += cz < (c.minZ + c.maxZ) / 2 ? -(cz - c.minZ + r) : c.maxZ - cz + r; }
            }
          }
        }
        // stay inside the walkable areas (the centre line of the body may not leave them)
        const q = new THREE.Vector3(cx, 0, cz);
        clampWalkable(q);
        px += q.x - cx; pz += q.z - cz;
        if (px || pz) {
          this.pos.x += px;
          this.pos.z += pz;
          hit = hit || Math.hypot(px, pz) > 0.02;
        }
      }
    }
    return hit;
  }
}
