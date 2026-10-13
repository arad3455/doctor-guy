// Lakash — Doctor Guy's and Caspi's friend, and the zoo's head zookeeper. He lives in his log cottage at the back of
// the zoo and spends his day on his rounds: hay from the feed shed, then every enclosure in turn, bucket in hand,
// and the animals come running. He likes animals a lot more than people (it shows when you talk to him). Six cats
// follow him everywhere — Mandarin, the ginger one, always in front.
import * as THREE from 'three';
import { buildKid, animateRig, makeBubble } from './characters.js';
import { gltfLoader } from './skinned.js';
import { rigQuadruped } from './catrig.js';
import { reach, armBones, sitOn } from './poses.js';
import { ZOO } from './zoo.js';
import { sfx } from './audio.js';

const SPEED = 1.9;
const CHAT_RANGE = 2.8;
const STOP_SECS = 16;
// his six cats: name, fur palette (dark, mid, light) — null keeps Gorge's own brown tabby
const CATS = [ // (bright: light coats need a lift, toon shading greys them)
  { name: 'Mandarin', fur: ['#7a2e08', '#e0741f', '#ffc07a'], size: 0.56 },
  { name: 'Pepper', fur: ['#0e0e10', '#26262a', '#4a4a52'], size: 0.52 },
  { name: 'Snow', fur: ['#d2d2d8', '#f1f1f4', '#ffffff'], size: 0.5, bright: 1.45 },
  { name: 'Smokey', fur: ['#3c4048', '#7c838c', '#c2c7cc'], size: 0.55 },
  { name: 'Biscuit', fur: ['#b8905e', '#ecd2a6', '#fff4e0'], size: 0.48, bright: 1.2 },
  { name: 'Tiger', fur: null, size: 0.53 },
];
const LINES = [
  'Shh… the capybaras are napping.',
  'Animals first, people later. No offence, Doc.',
  'Capybaras get along with everyone. Unlike some people.',
  'Mandarin! Off the meerkat mound!',
  'Nine capybaras, five ducks, nine flamingos… and you.',
  'Feeding time waits for no one.',
  'The tortoises are 80. Show some respect.',
];

export class Lakash {
  constructor({ scene, player, gps, zoo, ui }) {
    Object.assign(this, { scene, player, gps, zoo, ui });
    this.wing = zoo.wing;
    this.rig = buildKid('lakash');
    this.rig.root.name = 'lakash';
    scene.add(this.rig.root);
    this.pos = this.rig.root.position;
    this.bucket = makeBucket();
    scene.add(this.bucket);
    // his rounds: the feed shed, then every enclosure (the new wing and the old pens)
    const P = ZOO.pens;
    const pen = (name, p, side, kind) => ({ name, kind, x: p.x + side[0] * (p.r + 1.4), z: p.z + side[1] * (p.r + 1.4), face: Math.atan2(-side[0], -side[1]), at: new THREE.Vector3(p.x + side[0] * (p.r - 2), 0, p.z + side[1] * (p.r - 2)) });
    this.stops = [
      this.wing.stops.find((s) => s.chore === 'shed'),
      ...this.wing.stops.filter((s) => s.kind),
      pen('the elephants', P.elephant, [0, -1], 'elephant'), pen('the lions', P.lion, [0, 1], 'lion'), pen('the monkeys', P.monkey, [0.7, 0.7], 'monkey'),
      pen('the penguins', P.penguin, [0.7, 0.7], 'penguin'), pen('the giraffes', P.giraffe, [0.7, -0.7], 'giraffe'),
    ];
    this.stopIndex = 0;
    this.route = null;
    this.task = null; // { stop, left }
    this.bubble = null;
    this.chatCooldown = 0;
    const start = this.stops[1];
    this.pos.set(start.x, 0, start.z);
    this.cats = [];
    this.trail = []; // his footsteps (newest first): the cats walk where he walked, not through fences
    this.loadCats();
    this.setupPose();
  }

  async loadCats() {
    try {
      const gltf = await gltfLoader.loadAsync(new URL('../assets/props/gorge.glb', import.meta.url).href);
      const src = [];
      gltf.scene.traverse((o) => { if (o.isMesh) src.push(o); });
      const baseMap = src[0].material.map;
      CATS.forEach((c, i) => {
        const map = c.fur ? recolour(baseMap, c.fur) : baseMap;
        const mat = new THREE.MeshToonMaterial({ map, color: 0xffffff });
        mat.color.multiplyScalar(c.bright ?? 1);
        const rig = rigQuadruped(gltf.scene, c.size, mat);
        rig.root.userData.dynamic = true;
        const cat = { ...c, rig, root: rig.root, slot: i, wander: null, t: Math.random() * 10 };
        const a = (i / CATS.length) * Math.PI * 2;
        cat.root.position.set(this.pos.x + Math.cos(a) * 1.5, 0, this.pos.z + Math.sin(a) * 1.5);
        this.scene.add(cat.root);
        this.cats.push(cat);
      });
    } catch (e) { console.warn('[lakash] cats failed to load', e); }
  }

  /** Bucket in his left hand; at a stop his right hand scoops and tosses feed over the fence. */
  setupPose() {
    const R = armBones(this.rig, 'Right'), L = armBones(this.rig, 'Left');
    if (!R || !L) return;
    const up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(), side = new THREE.Vector3(), sh = new THREE.Vector3(), tgt = new THREE.Vector3(), pole = new THREE.Vector3();
    this.rig.overlay = (dt, t) => {
      if (this.lastPhase !== 'rounds') return; // the bucket is put away for the evening
      const yaw = this.rig.root.rotation.y;
      fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
      side.crossVectors(fwd, up); // his right
      // the bucket hangs from the left hand all day (a little forward while walking)
      L.upper.getWorldPosition(sh);
      tgt.copy(sh).addScaledVector(up, -0.62).addScaledVector(side, -0.16).addScaledVector(fwd, 0.12);
      reach(L, tgt, pole.set(0, 0, 0).addScaledVector(fwd, -1).addScaledVector(side, -0.4).normalize(), this.busy ? 1 : 0.85);
      L.hand.getWorldPosition(this.bucket.position);
      this.bucket.rotation.y = yaw;
      if (this.feeding) {
        // scoop from the bucket … toss it over the fence
        const c = (t * 0.9) % 1;
        R.upper.getWorldPosition(sh);
        const scoop = new THREE.Vector3().copy(this.bucket.position).addScaledVector(up, 0.25).addScaledVector(side, 0.08);
        const toss = new THREE.Vector3().copy(sh).addScaledVector(fwd, 0.55).addScaledVector(up, 0.25).addScaledVector(side, 0.12);
        const k = c < 0.5 ? THREE.MathUtils.smoothstep(c, 0, 0.5) : 1 - THREE.MathUtils.smoothstep(c, 0.6, 1);
        reach(R, scoop.lerp(toss, k), pole.set(0, -1, 0).addScaledVector(side, 0.6).normalize(), 1);
        if (this.lastToss < 0.5 && c >= 0.5 && this.near) sfx.carry?.();
        this.lastToss = c;
      }
    };
  }

  /** E next to him. */
  chatAction(p) {
    if (this.chatCooldown > 0 || !this.rig.root.visible || Math.hypot(p.x - this.pos.x, p.z - this.pos.z) > CHAT_RANGE) return null;
    return { label: '🐾 Talk to Lakash', run: () => this.chat() };
  }

  chat() {
    // he doesn't stop working — and barely looks up
    this.say(LINES[this.line = ((this.line ?? -1) + 1) % LINES.length]);
    this.chatCooldown = 4;
  }

  say(text, secs = 3.4) {
    if (this.bubble) this.rig.root.remove(this.bubble);
    this.bubble = makeBubble(text, { w: 360, bg: '#f2ffe8' });
    this.bubble.position.y = this.rig.height + 0.9;
    this.rig.root.add(this.bubble);
    this.bubbleT = secs;
  }

  /** What he's up to for the time of day. */
  phase(hour) {
    if (hour >= 21 || hour < 6) return 'sleep';
    if (hour >= 18) return 'porch';
    return 'rounds';
  }

  goTo(x, z) {
    const r = this.gps?.route({ x: this.pos.x, z: this.pos.z }, { x, z });
    this.route = r && r.length > 1 ? [...r.slice(1, -1), { x, z }] : [{ x, z }];
  }

  update(dt, t, { hour, inside }) {
    const p = this.player.pos;
    this.chatCooldown = Math.max(0, this.chatCooldown - dt);
    if (this.bubble && (this.bubbleT -= dt) <= 0) { this.rig.root.remove(this.bubble); this.bubble = null; }
    const dPlayer = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    this.near = dPlayer < 25;
    const far = dPlayer > 110;
    this.hour = hour;
    const phase = this.phase(hour);
    if (phase !== this.lastPhase) {
      this.lastPhase = phase;
      this.task = null;
      if (phase === 'rounds') this.nextStop(far);
      else { const at = phase === 'porch' ? this.wing.porch : this.wing.bed; if (far) { this.pos.set(at.x, 0, at.z); this.route = null; } else this.goTo(at.x, at.z); }
    }
    // walk
    let moving = false;
    if (this.route) {
      if (far) { const last = this.route[this.route.length - 1]; this.pos.set(last.x, 0, last.z); this.route = null; }
      else {
        const tg = this.route[0], dx = tg.x - this.pos.x, dz = tg.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.3) { this.route.shift(); if (!this.route.length) { this.route = null; this.arrived(); } }
        else {
          const step = Math.min(d, SPEED * dt);
          this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step;
          turnTo(this.rig.root, Math.atan2(dx, dz), dt * 2);
          moving = true;
        }
      }
    }
    // at a stop: do the job, then move on
    this.feeding = false;
    if (this.task && !this.route) {
      turnTo(this.rig.root, this.task.stop.face, dt);
      this.feeding = !!this.task.stop.kind || this.task.stop.chore === undefined;
      if ((this.task.left -= dt) <= 0) { this.task = null; if (phase === 'rounds') this.nextStop(far); }
    } else if (!this.route && phase === 'porch') turnTo(this.rig.root, this.wing.porch.face, dt);
    this.busy = !!this.task;
    const visible = !inside && phase !== 'sleep' || !!this.route;
    this.rig.root.visible = visible;
    this.bucket.visible = visible && phase === 'rounds';
    // evenings: feet up on the porch bench
    // (sticky once seated: sitting slides him onto the bench, a little off the spot he walked to)
    const P = this.wing.porch;
    this.seated = phase === 'porch' && !this.route && (this.seated || Math.hypot(this.pos.x - P.x, this.pos.z - P.z) < 0.6);
    const sitting = this.seated;
    if (!sitting) this.pos.y = 0;
    if (!far) animateRig(this.rig, moving ? 'walk' : sitting ? 'sit' : 'idle', t, dt, moving ? SPEED : 0);
    if (sitting) sitOn(this.rig, P.seat);
    this.updateCats(dt, t, moving, phase, inside, far);
  }

  nextStop(far) {
    this.stopIndex = (this.stopIndex + 1) % this.stops.length;
    const s = this.stops[this.stopIndex];
    if (far) { this.pos.set(s.x, 0, s.z); this.route = null; this.arrived(); }
    else this.goTo(s.x, s.z);
  }

  arrived() {
    if (this.lastPhase !== 'rounds') return;
    const stop = this.stops[this.stopIndex];
    this.task = { stop, left: stop.chore === 'shed' ? 8 : STOP_SECS };
    if (stop.kind) this.zoo.gather(stop.kind, stop.at, STOP_SECS + 2);
    const meal = this.hour < 11 ? 'Breakfast' : this.hour < 15 ? 'Lunch' : 'Dinner';
    if (this.near && Math.random() < 0.5) this.say(stop.kind ? `${meal}, ${stop.name}!` : 'Hay, pellets, fish… right.', 2.6);
  }

  /** The cats: a loose little parade behind him, a curl-up round his feet when he stops, cat beds at night. */
  /** A point `dist` back along his footsteps. */
  trailPoint(dist) {
    let left = dist, prev = this.pos;
    for (const q of this.trail) {
      const d = Math.hypot(q.x - prev.x, q.z - prev.z);
      if (d >= left) { const k = left / d; return new THREE.Vector3(prev.x + (q.x - prev.x) * k, 0, prev.z + (q.z - prev.z) * k); }
      left -= d; prev = q;
    }
    return new THREE.Vector3(prev.x, 0, prev.z);
  }

  updateCats(dt, t, moving, phase, inside, far) {
    const yaw = this.rig.root.rotation.y, right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    // drop a footstep every 0.4 units (keep ~10 units of trail)
    const last = this.trail[0];
    if (!last || Math.hypot(last.x - this.pos.x, last.z - this.pos.z) > 0.4) { this.trail.unshift({ x: this.pos.x, z: this.pos.z }); if (this.trail.length > 26) this.trail.pop(); }
    if (far) this.trail.length = 1; // (he teleported: start a fresh trail)
    for (const c of this.cats) {
      const cp = c.root.position, before = cp.clone();
      c.root.visible = !inside;
      let want;
      if (phase === 'sleep' && !this.route) want = this.wing.catSpots[c.slot % this.wing.catSpots.length];
      else if (moving) {
        // a little procession along his footsteps, Mandarin first, a touch of side-to-side so they don't stack up
        want = this.trailPoint(1.1 + c.slot * 0.75).addScaledVector(right, Math.sin(t * 1.3 + c.slot * 2) * 0.22);
      } else {
        // lounging round him: each cat picks a spot now and then
        // (behind him: in front is the fence he's feeding over)
        if (!c.wander || (c.wanderT -= dt) <= 0) {
          const a = yaw + Math.PI + (c.slot - 2.5) * 0.42 + (Math.random() - 0.5) * 0.3, r = 1.0 + Math.random() * 1.1;
          c.wander = new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r);
          c.wanderT = 4 + Math.random() * 6;
        }
        want = this.pos.clone().add(c.wander);
      }
      const dx = want.x - cp.x, dz = want.z - cp.z, d = Math.hypot(dx, dz);
      let speed = 0;
      if (far || d > 25) { cp.set(want.x, 0, want.z); }
      else if (d > 0.25) {
        const sp = (d > 3 ? 3.6 : d > 1 ? 2.2 : 1.1) * dt;
        cp.x += (dx / d) * Math.min(d, sp); cp.z += (dz / d) * Math.min(d, sp);
        turnTo(c.root, Math.atan2(dx, dz), dt * 1.5);
        speed = Math.hypot(cp.x - before.x, cp.z - before.z) / Math.max(dt, 1e-3);
      }
      if (!far) c.rig.animate(dt, t + c.t, speed);
    }
  }

  blips() { return this.rig.root.visible ? [{ x: this.pos.x, z: this.pos.z, icon: '🐾', name: 'Lakash' }] : []; }
}

function turnTo(root, want, k) {
  root.rotation.y += Math.atan2(Math.sin(want - root.rotation.y), Math.cos(want - root.rotation.y)) * Math.min(1, k * 4);
}

/** A metal feed bucket with a handle, full of pellets. */
function makeBucket() {
  const g = new THREE.Group();
  const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.3, 12, 1, true), new THREE.MeshToonMaterial({ color: 0x9aa3ad, side: THREE.DoubleSide }));
  pail.position.y = -0.25;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), new THREE.MeshToonMaterial({ color: 0x7a838c }));
  bottom.rotation.x = -Math.PI / 2; bottom.position.y = -0.4;
  const feed = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), new THREE.MeshToonMaterial({ color: 0xc9a050 }));
  feed.rotation.x = -Math.PI / 2; feed.position.y = -0.14;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 4, 16, Math.PI), new THREE.MeshToonMaterial({ color: 0x5a6068 }));
  handle.position.y = -0.1;
  for (const m of [pail, bottom, feed, handle]) { m.castShadow = true; g.add(m); }
  return g;
}

/** Gorge's fur texture repainted in another coat (keeps the tabby stripes as light and dark). */
function recolour(map, [dark, mid, light]) {
  const img = map.image, w = img.width, h = img.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h), px = data.data;
  const pal = [dark, mid, light].map((hex) => [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16))); // sRGB bytes
  const mix = (a, b, k, j) => a[j] + (b[j] - a[j]) * k;
  // Gorge is a dark-ish tabby: stretch his brightness range (5th–92nd percentile) to the full palette
  const lum = (i) => (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
  const sample = [];
  for (let i = 0; i < px.length; i += 4 * 37) sample.push(lum(i));
  sample.sort((a, b) => a - b);
  const lo = sample[Math.floor(sample.length * 0.05)], hi = sample[Math.floor(sample.length * 0.92)];
  for (let i = 0; i < px.length; i += 4) {
    const k = THREE.MathUtils.clamp((lum(i) - lo) / Math.max(0.05, hi - lo), 0, 1);
    const [a, b, kk] = k < 0.5 ? [pal[0], pal[1], k * 2] : [pal[1], pal[2], (k - 0.5) * 2];
    px[i] = mix(a, b, kk, 0); px[i + 1] = mix(a, b, kk, 1); px[i + 2] = mix(a, b, kk, 2);
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = map.flipY;
  tex.colorSpace = map.colorSpace;
  return tex;
}
