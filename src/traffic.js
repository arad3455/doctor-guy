// Ambient traffic on Zoo Road (Kenney Car Kit): cars drive both lanes, brake for the ambulance, Doctor Guy and
// anyone on a zebra crossing, honk when blocked, and only (re)appear at road ends you can't see.
import * as THREE from 'three';
import { kit } from './kit.js';
import { getColliders } from './world.js';
import { ZOO } from './zoo.js';
import { sfx } from './audio.js';

const MODELS = ['sedan', 'taxi', 'suv', 'van', 'delivery', 'hatchback-sports', 'police', 'truck'];
const SCALE = 2.3;
const CRUISE = 11;
const EAST_Z = ZOO.road.z + 1.75; // drive on the right: eastbound in the south lane
const WEST_Z = ZOO.road.z - 1.75;
const X0 = 61, X1 = 133; // cars use the open road between the park's east gate and the zoo
const CROSSINGS = [131];

export class Traffic {
  constructor(scene, { count = 5 } = {}) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.cars = [];
    for (let i = 0; i < count; i++) {
      const dir = i % 2 ? -1 : 1;
      const model = kit(MODELS[i % MODELS.length], { scale: SCALE, outline: 0.012 });
      const root = new THREE.Group();
      root.add(model);
      this.group.add(root);
      const colliders = [-1, 1].map((k) => ({ type: 'circle', x: 0, z: 0, r: 1.5, owner: 'traffic', k }));
      getColliders().push(...colliders);
      const x = X0 + 6 + ((i * 17 + (dir > 0 ? 0 : 9)) % (X1 - X0 - 12));
      this.cars.push({ root, dir, x, z: dir > 0 ? EAST_Z : WEST_Z, speed: CRUISE * (0.85 + (i % 3) * 0.1), cruise: CRUISE * (0.85 + (i % 3) * 0.1), colliders, waiting: 0, honked: 0, hidden: false });
    }
  }

  /** obstacles: [{ x, z, r }] things cars must not drive into (player, ambulance, nurses) */
  update(dt, { player, ambulance }) {
    const p = player.pos;
    for (const c of this.cars) {
      if (c.hidden) {
        // reappear at the start of the lane once nobody can see it
        const sx = c.dir > 0 ? X0 : X1;
        if (Math.hypot(p.x - sx, p.z - c.z) > 45) { c.hidden = false; c.root.visible = true; c.x = sx; c.speed = c.cruise * 0.6; }
        else continue;
      }
      // what's ahead in this lane?
      let gap = Infinity;
      const ahead = (x, z, halfW) => {
        if (Math.abs(z - c.z) > halfW) return;
        const d = (x - c.x) * c.dir;
        if (d > 0 && d < gap) gap = d;
      };
      for (const o of this.cars) if (o !== c && !o.hidden) ahead(o.x, o.z, 1.2);
      if (ambulance && !ambulance.siren) ahead(ambulance.pos.x, ambulance.pos.z, 3.2);
      if (!ambulance?.driving) ahead(p.x, p.z, 2.6);
      // wait at zebra crossings while someone is on them
      for (const cx of CROSSINGS) {
        const d = (cx - c.x) * c.dir;
        if (d > 0 && d < 10 && Math.abs(p.x - cx) < 3.6 && Math.abs(p.z - ZOO.road.z) < 4.5 && !ambulance?.driving) gap = Math.min(gap, d - 2);
      }
      // an ambulance with its siren on nearby: pull over onto the shoulder and stop (GTA-style)
      const yielding = ambulance?.siren && Math.hypot(ambulance.pos.x - c.x, ambulance.pos.z - c.z) < 32;
      const laneZ = c.dir > 0 ? EAST_Z : WEST_Z;
      const shoulderZ = ZOO.road.z + (c.dir > 0 ? 4.1 : -4.1);
      c.z += ((yielding ? shoulderZ : laneZ) - c.z) * Math.min(1, dt * 2.5);
      if (yielding) gap = Math.min(gap, 0);
      const stopDist = 7.5;
      const want = gap < stopDist ? 0 : gap < stopDist + 10 ? c.cruise * ((gap - stopDist) / 10) : c.cruise;
      c.speed += THREE.MathUtils.clamp(want - c.speed, -26 * dt, 8 * dt);
      c.x += c.speed * c.dir * dt;
      // stuck behind something? honk now and then
      c.waiting = c.speed < 0.5 && gap < stopDist + 1 ? c.waiting + dt : 0;
      if (c.waiting > 2 && performance.now() - c.honked > 3500 && Math.hypot(p.x - c.x, p.z - c.z) < 40) { sfx.honk(); c.honked = performance.now(); }
      // end of the road: leave if nobody's looking, otherwise wait there
      const end = c.dir > 0 ? X1 : X0;
      if ((c.x - end) * c.dir >= 0) {
        c.x = end;
        c.speed = 0;
        if (Math.hypot(p.x - end, p.z - c.z) > 40) { c.hidden = true; c.root.visible = false; }
      }
      c.root.position.set(c.x, 0, c.z);
      c.root.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; // Kenney cars face +z
      c.root.children[0].position.y = c.speed > 1 ? Math.sin(performance.now() / 70 + c.x) * 0.015 : 0;
      for (const col of c.colliders) {
        col.x = c.hidden ? -9999 : c.x + col.k * 1.6 * c.dir;
        col.z = c.z;
      }
    }
  }
}
