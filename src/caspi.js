// Caspi — Doctor Guy's friend. The chillest guy in Wolfson. You find him at home in Maple Heights, in the back
// garden, helping his dad (curly hair, always building something) put up the family sukkah: by day Caspi holds the
// beam while Dad hammers it in, in the evening they sit down to dinner in it under the string lights. His cat Gorge
// is never far away. Talk to him and all you get is "Later Later…" as he wanders off (Dad is not impressed).
// Stand near him while treating a kid and his calm rubs off (the timing bar slows down). Now and then Gorge goes
// missing — bring him back and, for once, Caspi smiles.
import * as THREE from 'three';
import { buildKid, animateRig, makeBubble } from './characters.js';
import { gltfLoader } from './skinned.js';
import { rigQuadruped } from './catrig.js';
import { part, toon } from './toon.js';
import { clampWalkable, collidersNear } from './world.js';
import { sfx } from './audio.js';
import { notify } from './notify.js';
import { MH_SPOTS } from './suburbs.js';
import { reach, armBones, makeHammer, sitOn } from './poses.js';

// his day (the day/night clock): building the sukkah with Dad, then dinner in it (spots filled in from the sukkah)
const SCHEDULE = [
  { from: 6, to: 20.5, name: 'home, building the sukkah', mode: 'build' },
  { from: 20.5, to: 30, name: 'home, having dinner in the sukkah', mode: 'dinner' },
];
const DAD_LINES = ['Shalom, Doc! Almost done!', 'Come eat with us in the sukkah tonight!', 'Measure twice, hammer once.', 'Caspi, hold it straight!', 'Next year we build a bigger one!'];
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
    // home: the sukkah in the back garden (Maple Heights); work spots by day, chairs at dinner
    const S = this.sukkah = MH_SPOTS.sukkah;
    const front = { x: S.x + 1.0, z: S.z + S.d / 2 + 0.9 }; // the way in, through the open front
    this.front = front;
    for (const s of SCHEDULE) Object.assign(s, s.mode === 'build' ? { ...S.caspi } : { x: S.seats[0].x, z: S.seats[0].z, rot: S.seats[0].rot, seat: S.seats[0] });
    for (const h of GORGE_HIDEOUTS) nudge(h);
    this.buildDad();
    this.spot = this.spotFor(this.ui.hour());
    this.pos.set(this.spot.x, 0, this.spot.z);
    this.rig.root.rotation.y = this.spot.rot ?? 0;
    this.placeDad(true);
    this.setupPoses();
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

  /** Caspi's dad: curly hair, checked work shirt, a hammer in his hand. */
  buildDad() {
    this.dad = buildKid('caspiDad');
    this.dad.root.name = 'caspiDad';
    this.scene.add(this.dad.root);
    this.dad.hammer = makeHammer(1.5);
    this.scene.add(this.dad.hammer);
    this.dad.route = null;
    this.dad.bubble = null;
    this.dad.bubbleT = 0;
    this.dadChatCooldown = 0;
  }

  /** Dad's spot for the time of day (snap = put him straight there). */
  placeDad(snap = false) {
    const S = this.sukkah, dinner = this.spot.mode === 'dinner';
    const want = dinner ? { x: S.seats[1].x, z: S.seats[1].z, rot: S.seats[1].rot, seat: S.seats[1] } : { ...S.dad };
    this.dad.spot = want;
    if (snap) { this.dad.root.position.set(want.x, 0, want.z); this.dad.root.rotation.y = want.rot; this.dad.route = null; }
    else this.dad.route = [{ ...this.front }, { x: want.x, z: want.z }];
  }

  /** The hand-made poses: Caspi holding the beam, Dad hammering it in (two-bone IK, see poses.js). */
  setupPoses() {
    const S = this.sukkah;
    const up = new THREE.Vector3(0, 1, 0);
    const holdR = new THREE.Vector3(S.hold[1].x, S.hold[1].y, S.hold[1].z), holdL = new THREE.Vector3(S.hold[0].x, S.hold[0].y, S.hold[0].z);
    const strike = new THREE.Vector3(S.strike.x, S.strike.y, S.strike.z);
    const tgt = new THREE.Vector3(), pole = new THREE.Vector3(), sh = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3();
    // Caspi: both hands on the beam (a lazy sway — he's holding it, more or less)
    const cR = armBones(this.rig, 'Right'), cL = armBones(this.rig, 'Left');
    this.caspiPose = cR && cL ? (dt, t) => {
      const w = this.posing === 'build' ? 1 : 0;
      this.holdW = (this.holdW ?? 0) + (w - (this.holdW ?? 0)) * Math.min(1, dt * 4);
      if (this.holdW < 0.01) return;
      const sway = Math.sin(t * 0.9) * 0.02;
      reach(cR, tgt.copy(holdR).setY(holdR.y + sway), pole.set(0, -1, -0.6).normalize(), this.holdW);
      reach(cL, tgt.copy(holdL).setY(holdL.y + sway), pole.set(0, -1, 0.6).normalize(), this.holdW);
    } : null;
    // Dad: left hand steadies the beam, right hand swings the hammer onto the joint (a knock you can hear)
    const dR = armBones(this.dad, 'Right'), dL = armBones(this.dad, 'Left');
    const hammer = this.dad.hammer;
    let lastPhase = 0;
    this.dadPose = dR && dL ? (dt, t) => {
      const working = this.dad.posing === 'build';
      this.dad.workW = (this.dad.workW ?? 0) + ((working ? 1 : 0) - (this.dad.workW ?? 0)) * Math.min(1, dt * 4);
      hammer.visible = this.dad.root.visible && this.dad.workW > 0.3 && !this.dad.route;
      if (this.dad.workW < 0.01) return;
      // waiting for Caspi to come back and hold the beam: arms down, no hammering
      const busy = !this.route && this.posing === 'build';
      const cycle = busy ? (t * 1.15) % 1 : 0.8;
      dR.upper.getWorldPosition(sh);
      fwd.subVectors(strike, sh).setY(0).normalize();
      side.crossVectors(fwd, up).normalize(); // his right
      const hit = tgt.copy(strike).addScaledVector(fwd, -0.3).addScaledVector(up, 0.06); // the hand stops short; the head lands on the joint
      const raised = new THREE.Vector3().copy(sh).addScaledVector(fwd, 0.22).addScaledVector(up, 0.32).addScaledVector(side, 0.05);
      let k; // 0 = raised, 1 = on the joint
      if (cycle < 0.55) k = 1 - THREE.MathUtils.smoothstep(cycle, 0, 0.5);
      else if (cycle < 0.66) k = (cycle - 0.55) / 0.11;
      else k = 1;
      const hand = raised.lerp(hit, k * k);
      reach(dR, hand, pole.set(0, -1, 0).addScaledVector(side, 0.7).normalize(), this.dad.workW);
      reach(dL, tgt.set(this.sukkah.hold[1].x, this.sukkah.hold[1].y, this.sukkah.hold[1].z - 0.0).lerp(strike, 0.35), pole.set(0, -1, 0).addScaledVector(side, -0.7).normalize(), this.dad.workW * (busy ? 1 : 0.4));
      if (busy && lastPhase < 0.66 && cycle >= 0.66 && Math.hypot(this.player.pos.x - strike.x, this.player.pos.z - strike.z) < 14) sfx.knock(0.07);
      lastPhase = cycle;
      // the hammer in his fist: handle across the forearm, head leading the swing
      dR.hand.getWorldPosition(hammer.position);
      const fore = new THREE.Vector3().subVectors(hammer.position, dR.fore.getWorldPosition(new THREE.Vector3())).normalize();
      const dir = fore.clone().applyAxisAngle(side, -Math.PI / 2 * 0.85).normalize();
      hammer.quaternion.setFromUnitVectors(up, dir);
    } : null;
    this.rig.overlay = this.caspiPose;
    this.dad.overlay = this.dadPose;
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

  /** What E does when you're next to him (or his dad). */
  chatAction(p) {
    const dCaspi = Math.hypot(p.x - this.pos.x, p.z - this.pos.z), dDad = Math.hypot(p.x - this.dad.root.position.x, p.z - this.dad.root.position.z);
    if (dDad < CHAT_RANGE && dDad < dCaspi && this.dadChatCooldown <= 0) return { label: '😎 Talk to Caspi’s dad', run: () => this.dadChat() };
    if (this.chatCooldown > 0 || dCaspi > CHAT_RANGE) return null;
    if (this.gorgeState === 'found') return null; // bringing Gorge back is automatic
    return { label: '😎 Hey Caspi!', run: () => this.brushOff() };
  }

  dadSay(text, secs = 3) {
    const d = this.dad;
    if (d.bubble) d.root.remove(d.bubble);
    d.bubble = makeBubble(text, { w: 340, bg: '#eaf3ff' });
    d.bubble.position.y = d.height + 0.9;
    d.root.add(d.bubble);
    d.bubbleT = secs;
  }

  dadChat() {
    this.dadSay(DAD_LINES[this.dadLine = ((this.dadLine ?? -1) + 1) % DAD_LINES.length]);
    this.dadChatCooldown = 4;
  }

  brushOff() {
    this.say(LINES_AWAY[Math.floor(Math.random() * LINES_AWAY.length)]);
    this.chatCooldown = 8;
    // wander off a little way (away from Doctor Guy), and drift back to his spot later
    const away = new THREE.Vector3(this.pos.x - this.player.pos.x, 0, this.pos.z - this.player.pos.z).normalize();
    const t = nudge({ x: this.pos.x + away.x * 14 + away.z * 4, z: this.pos.z + away.z * 14 - away.x * 4 });
    this.walkTo(t.x, t.z);
    this.wanderBack = 25; // seconds before strolling back to his spot
    if (this.spot.mode === 'build') setTimeout(() => this.dadSay('Caspi! Who’s holding the beam?!', 3), 1400);
    this.ui.onChat?.();
  }

  /** Walk home to a spot: by the GPS to the sukkah's open front if he's out, then straight to it. */
  goHome(spot) {
    const S = this.sukkah;
    if (Math.hypot(this.pos.x - S.x, this.pos.z - S.z) < 9) this.route = [{ ...this.front }, { x: spot.x, z: spot.z }];
    else { this.walkTo(this.front.x, this.front.z); this.route.push({ x: spot.x, z: spot.z }); }
  }

  /** Called each frame from the game loop. */
  update(dt, t, { hour, outside, inside }) {
    const p = this.player.pos;
    this.chatCooldown = Math.max(0, this.chatCooldown - dt);
    this.dadChatCooldown = Math.max(0, this.dadChatCooldown - dt);
    if (this.bubble && (this.bubbleT -= dt) <= 0) { this.rig.root.remove(this.bubble); this.bubble = null; }
    // his day: when the clock moves him on (build → dinner), walk there if you can see him, otherwise just be there
    const spot = this.spotFor(hour);
    if (spot !== this.spot) {
      this.spot = spot;
      const near = Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 40;
      if (near) this.goHome(spot);
      else { this.pos.set(spot.x, 0, spot.z); this.route = null; }
      this.placeDad(!near);
    }
    if (this.wanderBack != null && !this.route && (this.wanderBack -= dt) <= 0) { this.wanderBack = null; this.goHome(spot); }
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
    }
    // at his spot: face the work (or the table) and get on with it
    const atSpot = !this.route && Math.hypot(this.pos.x - spot.x, this.pos.z - spot.z) < 0.5;
    this.posing = atSpot ? spot.mode : null;
    if (atSpot) turnTo(this.rig.root, spot.rot, dt);
    else if (!this.route && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 6) turnTo(this.rig.root, Math.atan2(p.x - this.pos.x, p.z - this.pos.z), dt * 0.5); // a lazy glance
    const sitting = this.posing === 'dinner';
    if (!sitting) this.pos.y = 0;
    // out of sight across town: no need to pose anyone (saves the skinning + IK work)
    this.far = Math.hypot(p.x - this.sukkah.x, p.z - this.sukkah.z) > 85 && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) > 85;
    if (!this.far) animateRig(this.rig, moving ? 'walk' : sitting ? 'sit' : 'idle', t, dt, moving ? SPEED : 0);
    if (sitting) sitOn(this.rig, spot.seat);
    this.rig.root.visible = !inside;
    this.updateDad(dt, t, inside);
    this.updateGorge(dt, t, moving, inside);
  }

  updateDad(dt, t, inside) {
    const d = this.dad, dp = d.root.position, p = this.player.pos;
    if (d.bubble && (d.bubbleT -= dt) <= 0) { d.root.remove(d.bubble); d.bubble = null; }
    let moving = false;
    if (d.route) {
      const tgt = d.route[0];
      const dx = tgt.x - dp.x, dz = tgt.z - dp.z, dist = Math.hypot(dx, dz);
      if (dist < 0.3) { d.route.shift(); if (!d.route.length) d.route = null; }
      else {
        const step = Math.min(dist, SPEED * 1.1 * dt);
        dp.x += (dx / dist) * step; dp.z += (dz / dist) * step;
        d.root.rotation.y = Math.atan2(dx, dz);
        moving = true;
      }
    }
    const atSpot = !d.route && Math.hypot(dp.x - d.spot.x, dp.z - d.spot.z) < 0.5;
    d.posing = atSpot ? (d.spot.seat ? 'dinner' : 'build') : null;
    // waiting on Caspi (he wandered off): turn round to look for him
    const waiting = d.posing === 'build' && this.posing !== 'build';
    if (atSpot) turnTo(d.root, waiting ? Math.atan2(this.pos.x - dp.x, this.pos.z - dp.z) : d.spot.rot, dt);
    else if (d.bubble && !d.route) turnTo(d.root, Math.atan2(p.x - dp.x, p.z - dp.z), dt);
    const sitting = d.posing === 'dinner';
    if (!sitting) dp.y = 0;
    if (d.posing === 'build' && waiting) d.posing = 'wait';
    if (!this.far) animateRig(d, moving ? 'walk' : sitting ? 'sit' : 'idle', t, dt, moving ? SPEED : 0);
    if (sitting) sitOn(d, d.spot.seat);
    d.root.visible = !inside;
    if (inside) d.hammer.visible = false;
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
      notify('Found Gorge!', { icon: 'paw', tone: 'caspi', sub: 'He’s following you — take him back to Caspi', ms: 3400 });
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

/** Ease a character round to face `want` (radians). */
function turnTo(root, want, dt) {
  root.rotation.y += Math.atan2(Math.sin(want - root.rotation.y), Math.cos(want - root.rotation.y)) * Math.min(1, dt * 4);
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
