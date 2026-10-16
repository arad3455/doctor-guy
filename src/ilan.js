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
    if (want !== null) this.rig.root.rotation.y += Math.atan2(Math.sin(want - this.rig.root.rotation.y), Math.cos(want - this.rig.root.rotation.y)) * Math.min(1, dt * (moving ? 5 : 3));
    this.moving = moving;
    animateRig(this.rig, moving ? 'walk' : 'idle', t, dt, moving ? 1.1 : 0);
  }

  /** Life in the idle pose: the head looks round slowly, a little weight shift (he isn't a mannequin). */
  setupIdle() {
    const head = this.rig.bone?.(/^Head$/i), spine = this.rig.bone?.(/^Spine01$/i) ?? this.rig.bone?.(/^Spine$/i);
    if (!head) return;
    this.rig.overlay = (dt, t) => {
      if (this.moving) return;
      const k = this.paused ? 0.25 : 1;
      head.rotation.y += Math.sin(t * 0.45) * 0.35 * k + Math.sin(t * 1.3) * 0.05;
      head.rotation.x += Math.sin(t * 0.7 + 1) * 0.06;
      if (spine) spine.rotation.z += Math.sin(t * 0.6) * 0.035;
    };
  }

  blips() { return [{ x: this.pos.x, z: this.pos.z, icon: '🚗', name: 'Ilan Motors' }]; }
}
