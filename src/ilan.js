// Ilan — Doctor Guy's friend who sells luxury cars. Always in his showroom (Ilan Motors, Downtown), always serious,
// never really smiles, and can't say two sentences without bringing it back to the cars. Talk to him, then the
// register opens the catalogue: buy a Fulmine and it waits for you on the YOUR CAR bay outside, ready to drive.
import * as THREE from 'three';
import { buildKid, animateRig, makeBubble } from './characters.js';
import { DT_SPOTS } from './downtown.js';
import { CARS, CAR_LENGTH, CAR_YAW, paintCar } from './dealership.js';
import { Ambulance } from './vehicle.js';
import { notify, headline } from './notify.js';
import { icon } from './icons.js';
import { sfx } from './audio.js';

const RANGE = 2.8;
// deadpan, always the same two loves: cars… and tzizi ("forget X, check out Y" / "whatever, but the tzizi, hah")
const LINES = [
  'Forget the Lambo. Check out the tzizi.',
  'Whatever. But the tzizi, hah.',
  'Zero to a hundred in 2.5. Whatever, but the tzizi, hah.',
  'Forget the horsepower, Doc. Tzizi-power, hah.',
  'I don’t smile. The tzizi make me smile.',
  'Forget the leather seats. Check out the tzizi.',
  'Nice wheels, right? Whatever, but the tzizi, hah.',
  'Forget the ambulance. Check out the tzizi.',
  'Carbon fibre, twin turbo… whatever, but the tzizi, hah.',
];

export class Ilan {
  constructor({ scene, player, progress, wallet, renderer, ui }) {
    Object.assign(this, { scene, player, progress, wallet, renderer, ui });
    this.dealer = DT_SPOTS.dealer;
    const s = this.dealer.ilan;
    this.rig = buildKid('ilan');
    this.rig.root.name = 'ilan';
    this.rig.root.position.set(s.x, 0, s.z);
    this.rig.root.rotation.y = s.rot;
    scene.add(this.rig.root);
    this.pos = this.rig.root.position;
    this.bubble = null;
    this.cooldown = 0;
    this.car = null; // the car you own, waiting on the bay (an Ambulance-class vehicle)
    this.dealer.addCars(renderer);
    const t0 = this.dealer.tour[0];
    this.rig.root.position.set(t0.x, 0, t0.z);
    this.setupIdle();
    this.el = document.getElementById('dealer');
    this.el.querySelector('#dealer-close').addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => { const id = e.target.closest('[data-car]')?.dataset.car; if (id) this.choose(id); });
    // a car bought on an earlier visit is already there
    if (this.progress.data.car) this.spawnCar(this.progress.data.car);
  }

  get talked() { return !!this.progress.data.metIlan; }

  /** What E does nearby: talk to Ilan, or the catalogue at the register. */
  chatAction(p) {
    if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < RANGE && this.cooldown <= 0) return { label: '🚗 Talk to Ilan', run: () => this.talk() };
    const r = this.dealer.register;
    if (Math.hypot(p.x - r.x, p.z - r.z) < 2.4) {
      return this.talked ? { label: '🚗 Car catalogue', run: () => this.open() } : { label: '🚗 Car catalogue (talk to Ilan first)', run: () => this.say('We talk first. Then we buy. Hah.') };
    }
    return null;
  }

  talk() {
    const first = !this.talked;
    if (first) { this.progress.data.metIlan = true; this.progress.dirty = true; }
    this.say(first ? 'Doc. You need a real car. Forget the ambulance, check out the tzizi. The register is right there.' : LINES[this.line = ((this.line ?? -1) + 1) % LINES.length]);
    this.cooldown = 3;
    this.lookAt = 3;
  }

  say(text, secs = 3.6) {
    if (this.bubble) this.rig.root.remove(this.bubble);
    this.bubble = makeBubble(text, { bg: '#f1f1f1' });
    this.bubble.position.y = this.rig.height + 0.9;
    this.rig.root.add(this.bubble);
    this.bubbleT = secs;
  }

  // ---- the catalogue
  open() {
    this.render();
    this.el.classList.remove('hidden');
    this.ui.onOpen?.();
  }
  close() { this.el.classList.add('hidden'); }
  get isOpen() { return !this.el.classList.contains('hidden'); }

  render() {
    const owned = this.progress.data.cars ?? [], cur = this.progress.data.car, money = this.wallet.get();
    this.el.querySelector('#dealer-wallet').textContent = money;
    this.el.querySelector('#dealer-list').innerHTML = CARS.map((c) => {
      const has = owned.includes(c.id), here = cur === c.id;
      const btn = here ? '<span class="dl-tag">Outside</span>'
        : has ? `<button data-car="${c.id}">Take it out</button>`
        : `<button data-car="${c.id}" ${money < c.price ? 'disabled' : ''}>${icon('lollipop')}${c.price}</button>`;
      return `<div class="dl-car ${here ? 'here' : ''}"><span class="dl-swatch" style="background:${c.paint ?? '#e0323a'}"></span>`
        + `<span class="dl-info"><b>${c.name}</b><small>${c.blurb}</small><em>${c.zero} · ${c.top}</em></span>${btn}</div>`;
    }).join('');
  }

  choose(id) {
    const c = CARS.find((x) => x.id === id);
    const owned = this.progress.data.cars ?? [];
    if (!owned.includes(id)) {
      if (this.wallet.get() < c.price) return;
      this.wallet.add(-c.price);
      this.progress.data.cars = [...owned, id];
      sfx.buy?.();
      headline({ kicker: 'ILAN MOTORS', icon: 'flag', tone: 'success', title: `${c.name} — sold!`, sub: 'It’s waiting for you outside, on the YOUR CAR bay', ms: 3600 });
      this.say('Good choice. Whatever, but the tzizi, hah.');
    } else notify(`${c.name} is outside`, { icon: 'flag', tone: 'info', sub: 'On the YOUR CAR bay', ms: 2600 });
    this.progress.data.car = id;
    this.progress.dirty = true;
    this.spawnCar(id);
    this.render();
    this.close();
  }

  /** Put your car on the bay (replacing any other one there). */
  spawnCar(id) {
    const c = CARS.find((x) => x.id === id);
    if (!c) return;
    if (this.car?.driving) return; // (not while you're in it)
    this.car?.dispose();
    const bay = this.dealer.bay;
    this.car = new Ambulance(this.scene, {
      model: 'carSuper', yaw: CAR_YAW, length: CAR_LENGTH, lights: false, speed: 1.35, toonMaterials: false,
      start: { x: bay.x, z: bay.z, heading: Math.PI / 2 },
      prepare: (m) => paintCar(m, c.paint, this.renderer),
    });
    this.car.carId = id;
    this.car.label = c.name;
    this.car.loadModel();
    this.ui.onCar?.(this.car);
  }

  update(dt, t) {
    const p = this.player.pos;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.bubble && (this.bubbleT -= dt) <= 0) { this.rig.root.remove(this.bubble); this.bubble = null; }
    const near = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    if (near > 120) return;
    const tour = this.dealer.tour;
    this.tourI ??= 0;
    this.wait ??= 2;
    // you're close: he stops what he's doing and turns to you (and carries on when you step away)
    if (near < 4.5) this.paused = true;
    else if (near > 6) this.paused = false;
    let moving = false, want = null;
    if (this.paused || (this.lookAt = Math.max(0, (this.lookAt ?? 0) - dt)) > 0) want = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    else if (this.wait > 0) {
      // lingering at a car (or by the glass), now and then glancing round the showroom
      this.wait -= dt;
      const stop = tour[this.tourI];
      if (stop.look) want = Math.atan2(stop.look[0] - this.pos.x, stop.look[1] - this.pos.z);
      if (this.wait <= 0) this.tourI = (this.tourI + 1) % tour.length;
    } else {
      const tgt = tour[this.tourI], dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.15) this.wait = tgt.stop || 0.01;
      else {
        const step = Math.min(d, 1.1 * dt); // a slow, relaxed walk
        this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step;
        want = Math.atan2(dx, dz);
        moving = true;
      }
    }
    // turning: at a person's pace (never faster than ~100°/s), and on the spot he steps round rather than pivoting
    let turning = false;
    if (want !== null) {
      const diff = Math.atan2(Math.sin(want - this.rig.root.rotation.y), Math.cos(want - this.rig.root.rotation.y));
      const step = Math.sign(diff) * Math.min(Math.abs(diff), (moving ? 2.4 : 1.7) * dt, Math.abs(diff) * Math.min(1, dt * 4));
      this.rig.root.rotation.y += step;
      turning = !moving && Math.abs(diff) > 0.3;
    }
    this.moving = moving || turning;
    animateRig(this.rig, moving || turning ? 'walk' : 'idle', t, dt, moving ? 1.1 : 0.6);
  }

  /**
   * Life in the idle pose: now and then he turns his head to look round (a gentle yaw about the true vertical).
   * The turn is undone before the next one, so it never adds up, whether or not the clip moves the head.
   */
  setupIdle() {
    const head = this.rig.bone?.(/^Head$/i);
    if (!head) return;
    const up = new THREE.Vector3(), pq = new THREE.Quaternion(), off = new THREE.Quaternion(), last = new THREE.Quaternion(), left = new THREE.Quaternion();
    let yaw = 0;
    this.rig.overlay = (dt, t) => {
      // take back last frame's turn — unless the clip has already set the head afresh this frame
      if (head.quaternion.angleTo(left) < 1e-6) head.quaternion.premultiply(last.invert());
      // where to look: a slow glance left / right while standing, straight ahead while walking or talking
      const want = this.moving || this.paused ? 0 : Math.sin(t * 0.35) * 0.45 * (Math.sin(t * 0.13) > -0.3 ? 1 : 0);
      yaw += (want - yaw) * Math.min(1, dt * 2);
      head.parent.getWorldQuaternion(pq);
      up.set(0, 1, 0).applyQuaternion(pq.invert()); // the world's up, in the head's parent space
      off.setFromAxisAngle(up, yaw);
      head.quaternion.premultiply(off);
      last.copy(off);
      left.copy(head.quaternion);
    };
  }

  blips() { return [{ x: this.pos.x, z: this.pos.z, icon: '🚗', name: 'Ilan Motors' }]; }
}
