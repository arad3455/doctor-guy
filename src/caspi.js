// Caspi — Doctor Guy's friend. The chillest guy in Wolfson: he drifts between his favourite spots on his own
// clock (café mornings, park afternoons, pier sunsets, campfire nights) with his cat Gorge trotting behind.
// Talk to him and all you get is "Later Later…" as he wanders off. Stand near him while treating a kid and his
// calm rubs off (the timing bar slows down). Now and then Gorge goes missing — bring him back and, for once,
// Caspi smiles.
import * as THREE from 'three';
import { buildKid, animateRig, makeBubble } from './characters.js';
import { gltfLoader } from './skinned.js';
import { rigQuadruped } from './catrig.js';
import { part, toon } from './toon.js';
import { clampWalkable, collidersNear } from './world.js';
import { DT_SPOTS, DOWNTOWN } from './downtown.js';
import { FAIR } from './pier.js';
import { CAMP } from './camp.js';
import { sfx } from './audio.js';

// where he hangs out, by the hour (the day/night clock)
const SCHEDULE = [
  { from: 6, to: 11, name: 'the café on Market Row', x: DT_SPOTS.cafe.x + 6, z: DOWNTOWN.shops.z1 - 1.6, pose: 'idle' },
  { from: 11, to: 16.5, name: 'Wolfson Park', x: -9, z: 6, pose: 'idle' },
  { from: 16.5, to: 20.5, name: 'the end of Sunset Pier', x: FAIR.pier.x0 + 2.2, z: FAIR.pier.z1 - 8, pose: 'idle' },
  { from: 20.5, to: 30, name: 'the Pinewood campfire', x: CAMP.site.x - 3.6, z: CAMP.site.z + 0.5, pose: 'idle' },
];
// where Gorge likes to "get lost"
const GORGE_HIDEOUTS = [
  { x: 23, z: -22, hint: 'by the pond' }, { x: 104, z: 81, hint: 'under the Ferris wheel… no, by the carousel' },
  { x: -160, z: 108, hint: 'on the harbour quay' }, { x: 48, z: -158, hint: 'among the tents' },
  { x: -130, z: 8, hint: 'in City Plaza' }, { x: 116, z: 40, hint: 'in a Maple Heights garden' }, { x: -60, z: -102, hint: 'at the airport' },
];
const LINES_AWAY = ['Later Later…'];
const SPEED = 1.5; // a slow stroll
const CHAT_RANGE = 2.8;
const AURA = 9; // chill aura radius

const free = (x, z) => {
  const p = { x, z };
  clampWalkable(p);
  if (Math.hypot(p.x - x, p.z - z) > 0.01) return false;
  return !collidersNear(x, z, 2).some((c) => (c.owner === 'car' || c.dynamic) ? false
    : c.type === 'circle' ? Math.hypot(c.x - x, c.z - z) < c.r + 0.8 : x > c.minX - 0.8 && x < c.maxX + 0.8 && z > c.minZ - 0.8 && z < c.maxZ + 0.8);
};
const nudge = (s) => {
  if (free(s.x, s.z)) return s;
  for (let r = 1; r < 12; r++) for (let a = 0; a < 16; a++) {
    const x = s.x + Math.cos((a / 16) * Math.PI * 2) * r, z = s.z + Math.sin((a / 16) * Math.PI * 2) * r;
    if (free(x, z)) { s.x = x; s.z = z; return s; }
  }
  return s;
};

export class Caspi {
  constructor({ scene, player, gps, progress, ui }) {
    Object.assign(this, { scene, player, gps, progress, ui });
    this.rig = buildKid('caspi');
    this.rig.root.name = 'caspi';
    scene.add(this.rig.root);
    this.pos = this.rig.root.position;
    this.gorge = makeGorge();
    scene.add(this.gorge.root);
    this.route = null; // [{x,z}] being walked
    this.bubble = null;
    this.bubbleT = 0;
    this.chatCooldown = 0;
    this.gorgeState = 'follow'; // follow | lost | found (following Doctor Guy back)
    this.gorgeTimer = 150 + Math.random() * 120; // first disappearance after a few minutes
    for (const s of SCHEDULE) nudge(s);
    for (const h of GORGE_HIDEOUTS) nudge(h);
    this.spot = this.spotFor(this.ui.hour());
    this.pos.set(this.spot.x, 0, this.spot.z);
    this.gorge.root.position.set(this.spot.x + 1.2, 0, this.spot.z + 0.8);
    this.loadGorgeModel();
  }

  async loadGorgeModel() {
    try {
      const gltf = await gltfLoader.loadAsync(new URL('../assets/props/gorge.glb', import.meta.url).href);
      // Meshy can't rig animals: give the cat a little skeleton of our own (catrig.js) so his legs really walk
      const src = [];
      gltf.scene.traverse((o) => { if (o.isMesh) src.push(o); });
      const mat = new THREE.MeshToonMaterial({ map: src[0].material.map, color: 0xffffff });
      const rig = rigQuadruped(gltf.scene, 0.55, mat); // a cat about knee-high to Caspi
      const m = rig.root;
      this.gorge.rig = rig;
      this.gorge.body.clear();
      this.gorge.body.add(m);
      this.gorge.collar.visible = this.gorge.bell.visible = false; // the model wears its own collar and bell
      this.gorge.tail = null;
      this.gorge.model = true;
    } catch { /* keep the hand-built cat */ }
  }

  spotFor(hour) { const h = hour < 6 ? hour + 24 : hour; return SCHEDULE.find((s) => h >= s.from && h < s.to) ?? SCHEDULE[0]; }

  say(text, secs = 2.6) {
    if (this.bubble) this.rig.root.remove(this.bubble);
    this.bubble = makeBubble(text, { w: 300, bg: '#f2f2f2' });
    this.bubble.position.y = this.rig.height + 0.9;
    this.rig.root.add(this.bubble);
    this.bubbleT = secs;
  }

  walkTo(x, z) {
    const r = this.gps?.route({ x: this.pos.x, z: this.pos.z }, { x, z });
    this.route = r && r.length > 1 ? r.slice(1) : [{ x, z }];
  }

  /** What E does when you're next to him. */
  chatAction(p) {
    if (this.chatCooldown > 0 || Math.hypot(p.x - this.pos.x, p.z - this.pos.z) > CHAT_RANGE) return null;
    if (this.gorgeState === 'found') return null; // bringing Gorge back is automatic
    return { label: '😎 Hey Caspi!', run: () => this.brushOff() };
  }

  brushOff() {
    this.say(LINES_AWAY[Math.floor(Math.random() * LINES_AWAY.length)]);
    this.chatCooldown = 8;
    // wander off a little way (away from Doctor Guy), and drift back to his spot later
    const away = new THREE.Vector3(this.pos.x - this.player.pos.x, 0, this.pos.z - this.player.pos.z).normalize();
    const t = nudge({ x: this.pos.x + away.x * 14 + away.z * 4, z: this.pos.z + away.z * 14 - away.x * 4 });
    this.walkTo(t.x, t.z);
    this.wanderBack = 25; // seconds before strolling back to his spot
    this.ui.onChat?.();
  }

  /** Called each frame from the game loop. */
  update(dt, t, { hour, outside, inside }) {
    const p = this.player.pos;
    this.chatCooldown = Math.max(0, this.chatCooldown - dt);
    if (this.bubble && (this.bubbleT -= dt) <= 0) { this.rig.root.remove(this.bubble); this.bubble = null; }
    // his day: when the clock moves him on, walk there if you can see him, otherwise just be there
    const spot = this.spotFor(hour);
    if (spot !== this.spot) {
      this.spot = spot;
      if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 70) this.walkTo(spot.x, spot.z);
      else { this.pos.set(spot.x, 0, spot.z); this.route = null; }
    }
    if (this.wanderBack != null && !this.route && (this.wanderBack -= dt) <= 0) { this.wanderBack = null; this.walkTo(spot.x, spot.z); }
    // far from both the player and his destination: skip the long walk
    if (this.route && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) > 90) {
      const last = this.route[this.route.length - 1];
      this.pos.set(last.x, 0, last.z);
      this.route = null;
    }
    let moving = false;
    if (this.route) {
      const tgt = this.route[0];
      const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { this.route.shift(); if (!this.route.length) this.route = null; }
      else {
        const step = Math.min(d, SPEED * dt);
        this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step;
        this.rig.root.rotation.y = Math.atan2(dx, dz);
        moving = true;
      }
    } else if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 6) {
      // a lazy glance at Doctor Guy when he's close
      const want = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
      this.rig.root.rotation.y += Math.atan2(Math.sin(want - this.rig.root.rotation.y), Math.cos(want - this.rig.root.rotation.y)) * Math.min(1, dt * 1.5);
    }
    animateRig(this.rig, moving ? 'walk' : 'idle', t, dt, moving ? SPEED : 0);
    this.rig.root.visible = !inside;
    this.updateGorge(dt, t, moving, inside);
  }

  /** Is Caspi's calm close enough to slow the treatment timing bar? */
  calming(at) { return !this.route && Math.hypot(at.x - this.pos.x, at.z - this.pos.z) < AURA; }

  updateGorge(dt, t, caspiMoving, inside) {
    const g = this.gorge, gp = g.root.position, p = this.player.pos;
    g.root.visible = !inside;
    // who is Gorge following?
    let leader = null;
    if (this.gorgeState === 'follow') leader = this.pos;
    else if (this.gorgeState === 'found') leader = p;
    if (this.gorgeState === 'follow' && (this.gorgeTimer -= dt) <= 0) this.loseGorge();
    if (this.gorgeState === 'lost' && Math.hypot(p.x - gp.x, p.z - gp.z) < 2.2) {
      this.gorgeState = 'found';
      this.ui.toast('🐱 <b>Found Gorge!</b><br><small>He’s following you — take him back to Caspi</small>', 2800);
      sfx.pickup();
    }
    if (this.gorgeState === 'found' && Math.hypot(this.pos.x - gp.x, this.pos.z - gp.z) < 4) this.reunite();
    let moving = false;
    const before = gp.clone();
    if (leader) {
      const dx = leader.x - gp.x, dz = leader.z - gp.z, d = Math.hypot(dx, dz);
      if (d > 30) { gp.set(leader.x - 1.2, 0, leader.z - 1.2); } // got left behind (a bus ride): catch up
      else if (d > 1.8) {
        const sp = (d > 5 ? 3.4 : 1.9) * dt;
        gp.x += (dx / d) * Math.min(d - 1.6, sp); gp.z += (dz / d) * Math.min(d - 1.6, sp);
        g.root.rotation.y = Math.atan2(dx, dz);
        moving = true;
      }
    }
    // the rigged cat walks with real legs; the hand-built stand-in just bobs
    const speed = dt > 0 ? Math.hypot(gp.x - before.x, gp.z - before.z) / dt : 0;
    if (g.rig) g.rig.animate(dt, t, moving ? speed : 0);
    else {
      g.body.position.y = moving ? Math.abs(Math.sin(t * 12)) * 0.05 : 0;
      g.body.rotation.x = moving ? 0 : -0.08;
    }
    if (g.tail) g.tail.rotation.y = Math.sin(t * (moving ? 7 : 2)) * 0.5;
    g.bell.rotation.z = Math.sin(t * (moving ? 14 : 1)) * 0.3;
    if (this.gorgeState === 'lost') g.root.rotation.y += dt * 0.4; // looking around, lost
  }

  loseGorge() {
    const options = GORGE_HIDEOUTS.filter((h) => Math.hypot(h.x - this.pos.x, h.z - this.pos.z) > 25);
    const h = options[Math.floor(Math.random() * options.length)] ?? GORGE_HIDEOUTS[0];
    this.gorgeState = 'lost';
    this.gorge.root.position.set(h.x, 0, h.z);
    this.gorgeHint = h.hint;
    this.say('…seen Gorge?', 4);
    this.ui.gorgeLost?.(h);
  }

  reunite() {
    this.gorgeState = 'follow';
    this.gorgeTimer = 240 + Math.random() * 180;
    this.say('🙂 …Thanks, man.', 4);
    sfx.success();
    this.ui.gorgeHome?.();
  }

  /** Radar/map blips: Caspi, and Gorge while he's lost. */
  blips() {
    const out = [{ x: this.pos.x, z: this.pos.z, icon: '😎', name: 'Caspi' }];
    if (this.gorgeState === 'lost') out.push({ x: this.gorge.root.position.x, z: this.gorge.root.position.z, icon: '🐱', name: 'Gorge' });
    return out;
  }
}

/** Gorge, hand-built until (or if) the Meshy model loads: a brown tabby with a red check collar and a bell. */
function makeGorge() {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const fur = 0x8a6a4a, dark = 0x4a3524;
  const torso = part(new THREE.CapsuleGeometry(0.13, 0.32, 4, 10), fur, { outline: 0.01 });
  torso.rotation.x = Math.PI / 2;
  torso.position.y = 0.24;
  body.add(torso);
  const head = part(new THREE.SphereGeometry(0.13, 12, 10), fur, { outline: 0.01 });
  head.position.set(0, 0.38, 0.24);
  body.add(head);
  for (const sx of [-1, 1]) {
    const ear = part(new THREE.ConeGeometry(0.05, 0.1, 4), dark, { outline: 0 });
    ear.position.set(sx * 0.07, 0.5, 0.24);
    body.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), toon(0xc8b84a));
    eye.position.set(sx * 0.05, 0.4, 0.35);
    body.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), toon(0xe8a0a0));
  nose.position.set(0, 0.37, 0.37);
  body.add(nose);
  for (const [lx, lz] of [[-0.07, 0.15], [0.07, 0.15], [-0.07, -0.15], [0.07, -0.15]]) {
    const leg = part(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6), fur, { outline: 0 });
    leg.position.set(lx, 0.08, lz);
    body.add(leg);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.27, -0.27);
  const tt = part(new THREE.CylinderGeometry(0.02, 0.03, 0.32, 6), dark, { outline: 0 });
  tt.rotation.x = -0.9; tt.position.set(0, 0.11, -0.1);
  tail.add(tt);
  body.add(tail);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.02, 6, 16), toon(0xc0262c));
  collar.position.set(0, 0.31, 0.19);
  collar.rotation.x = Math.PI / 2 - 0.5;
  root.add(collar);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), toon(0xdfe6ee));
  bell.position.set(0, 0.27, 0.27);
  root.add(bell);
  return { root, body, tail, bell, collar };
}
