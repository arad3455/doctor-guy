// Two nurses who hear the ambulance siren, hurry out of the hospital doors and meet the van —
// then walk the patient inside after the hand-over (or head back in when the siren stops).
import * as THREE from 'three';
import { buildKid, animateRig, makeBubble } from './characters.js';
import { getColliders, clampWalkable } from './world.js';

const DOOR = new THREE.Vector3(0, 0, -46.4);
const HEAR_RANGE = 34; // siren must be this close to the doors
const SPEED = 4.2;

export class DoorNurses {
  constructor(scene, ambulance, { onCallout } = {}) {
    this.ambulance = ambulance;
    this.onCallout = onCallout;
    this.calm = 0; // seconds without a siren nearby
    this.cooldown = 0; // after escorting a patient in, they don't come straight back out
    this.nurses = [-1, 1].map((side) => {
      const rig = buildKid('nurse');
      rig.root.visible = false;
      scene.add(rig.root);
      const bubble = makeBubble(side < 0 ? 'Over here!' : 'We’re ready!', { w: 300 });
      bubble.position.y = rig.height + 0.9;
      bubble.visible = false;
      rig.root.add(bubble);
      const collider = { type: 'circle', x: 0, z: 0, r: 0, dynamic: true }; // moves with the nurse
      getColliders().push(collider);
      return { rig, side, state: 'in', bubble, collider, wave: Math.random() * 3 };
    });
  }

  get out() { return this.nurses.some((n) => n.state !== 'in'); }

  /** Where each nurse waits: on the door side of the van, a little apart. */
  meetPoint(side) {
    const a = this.ambulance;
    const toDoor = DOOR.clone().sub(a.pos).setY(0);
    const d = toDoor.length();
    toDoor.normalize();
    const perp = new THREE.Vector3(-toDoor.z, 0, toDoor.x);
    const p = d < 6
      ? DOOR.clone().add(new THREE.Vector3(side * 1.6, 0, 2.2))
      : a.pos.clone().addScaledVector(toDoor, a.width / 2 + 2.6).addScaledVector(perp, side * 1.4);
    clampWalkable(p);
    return p;
  }

  update(dt, t, { inside }) {
    const a = this.ambulance;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const called = a.siren && !inside && this.cooldown === 0 && a.pos.distanceTo(DOOR) < HEAR_RANGE;
    this.calm = called ? 0 : this.calm + dt;

    for (const n of this.nurses) {
      const root = n.rig.root;
      if (called && (n.state === 'in' || n.state === 'returning')) {
        if (n.state === 'in') {
          root.position.copy(DOOR).add(new THREE.Vector3(n.side * 1.1, 0, 0.4));
          root.visible = true;
          if (n.side < 0) this.onCallout?.();
        }
        n.state = 'meeting';
      }
      if (n.state === 'meeting' && this.calm > 2.5) n.state = 'returning';
      if (n.state === 'in') { n.collider.r = 0; continue; }

      const target = n.state === 'returning' ? DOOR.clone().add(new THREE.Vector3(n.side * 0.8, 0, -0.3)) : this.meetPoint(n.side);
      const to = target.clone().sub(root.position).setY(0);
      const dist = to.length();
      if (dist > 0.35) {
        to.normalize();
        root.position.addScaledVector(to, Math.min(dist, SPEED * dt));
        root.rotation.y = Math.atan2(to.x, to.z);
        animateRig(n.rig, 'run', t, dt, SPEED);
        n.bubble.visible = false;
      } else if (n.state === 'returning') {
        n.state = 'in';
        root.visible = false;
      } else {
        // waiting by the van: face it, wave now and then
        const look = a.pos.clone().sub(root.position);
        root.rotation.y = Math.atan2(look.x, look.z);
        const waving = Math.sin(t * 0.9 + n.wave) > 0.2;
        animateRig(n.rig, waving ? 'wave' : 'idle', t, dt);
        n.bubble.visible = waving;
      }
      n.collider.x = root.position.x;
      n.collider.z = root.position.z;
      n.collider.r = 0.45;
    }
  }

  /** After a hand-over: the nurses take the patient inside. */
  escort() {
    for (const n of this.nurses) if (n.state === 'meeting') { n.state = 'returning'; n.bubble.visible = false; }
    this.calm = 99;
    this.cooldown = 12;
  }

  reset() {
    for (const n of this.nurses) { n.state = 'in'; n.rig.root.visible = false; n.collider.r = 0; }
    this.cooldown = 0;
  }
}
