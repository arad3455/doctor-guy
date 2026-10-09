// Treatment mini-game. Each step has a mode:
//   timing (default) — tap when the moving needle is in the green zone
//   hold             — hold down to fill the gauge, let go while it's in the green zone (blood draw, thermometer)
//   mash             — tap as fast as you can to pump the gauge into the green zone before time runs out
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const isTouch = () => document.documentElement.classList.contains('touch');

const HINTS = {
  timing: () => (isTouch() ? 'Tap when the needle is in the green zone' : 'Press <kbd>SPACE</kbd> when the needle is in the green zone'),
  hold: () => (isTouch() ? 'Hold your finger down, let go in the green zone' : 'Hold <kbd>SPACE</kbd>, let go in the green zone'),
  mash: () => (isTouch() ? 'Tap fast! Fill it up to the green zone' : 'Tap <kbd>SPACE</kbd> fast! Fill it up to the green zone'),
};

export class MiniGame {
  constructor() {
    this.el = $('minigame');
    this.active = false;
    this.holding = false;
    addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) this.down(); }
      if (e.code === 'Escape') this.finish(null);
    });
    addEventListener('keyup', (e) => { if (this.active && e.code === 'Space') this.up(); });
    // touch: tap / hold anywhere on the overlay
    this.el.addEventListener('pointerdown', (e) => { if (!this.active) return; e.preventDefault(); this.down(); });
    addEventListener('pointerup', () => { if (this.active) this.up(); });
  }

  /** treatment: { title, steps: [{icon, label, mode?}], speed, zone } → Promise<{misses}|null> */
  start(treatment) {
    this.t = treatment;
    this.step = 0;
    this.misses = 0;
    this.active = true;
    $('mg-title').textContent = treatment.title;
    this.el.classList.remove('hidden');
    this.newStep();
    this.renderSteps();
    return new Promise((resolve) => { this.resolve = resolve; });
  }

  get mode() { return this.t.steps[this.step]?.mode ?? 'timing'; }

  newStep() {
    const mode = this.mode;
    this.pos = 0;
    this.dir = 1;
    this.holding = false;
    this.mashTime = 0;
    // timing: random green zone; hold/mash: the zone sits near the top of the gauge
    const w = mode === 'timing' ? this.t.zone ?? 0.2 : mode === 'hold' ? Math.max(0.14, (this.t.zone ?? 0.2) * 0.9) : 0.2;
    this.zoneW = w;
    this.zoneX = mode === 'timing' ? 0.08 + Math.random() * (0.84 - w) : mode === 'hold' ? 0.55 + Math.random() * (0.38 - w) : 0.72;
    const z = $('mg-zone');
    z.style.left = `${this.zoneX * 100}%`;
    z.style.width = `${w * 100}%`;
    const s = this.t.steps[this.step];
    $('mg-desc').textContent = s ? `${s.icon} ${s.label}` : '';
    $('mg-bar').classList.toggle('gauge', mode !== 'timing');
    document.querySelector('#minigame .mg-hint.key-hint').innerHTML = HINTS[mode]();
    document.querySelector('#minigame .mg-hint.touch-hint').innerHTML = HINTS[mode]();
  }

  renderSteps() {
    $('mg-steps').innerHTML = this.t.steps
      .map((s, i) => `<span style="opacity:${i < this.step ? 1 : 0.3}">${i < this.step ? '✅' : s.icon}</span>`)
      .join('');
  }

  update(dt) {
    if (!this.active) return;
    const speed = (this.t.speed ?? 1) * (1 + this.step * 0.15);
    if (this.mode === 'timing') {
      this.pos += this.dir * dt * speed;
      if (this.pos > 1) { this.pos = 1; this.dir = -1; }
      if (this.pos < 0) { this.pos = 0; this.dir = 1; }
    } else if (this.mode === 'hold') {
      if (this.holding) {
        this.pos += dt * speed * 0.55;
        if (this.pos >= 1) { this.pos = 1; this.miss(); this.holding = false; this.pos = 0; } // held too long
      }
    } else if (this.mode === 'mash') {
      this.pos = Math.max(0, this.pos - dt * 0.28); // the cuff leaks air
      this.mashTime += dt;
      if (this.pos >= this.zoneX) this.hit();
      else if (this.mashTime > 6) { this.miss(); this.mashTime = 0; this.pos = 0; }
    }
    $('mg-needle').style.left = `${this.pos * 100}%`;
    $('mg-fill').style.width = this.mode === 'timing' ? '0' : `${this.pos * 100}%`;
  }

  down() {
    if (this.mode === 'timing') this.judge();
    else if (this.mode === 'hold') { this.holding = true; }
    else { this.pos = Math.min(1, this.pos + 0.075); sfx.pickup(); }
  }

  up() {
    if (this.mode === 'hold' && this.holding) { this.holding = false; this.judge(); }
  }

  judge() {
    if (this.pos >= this.zoneX && this.pos <= this.zoneX + this.zoneW) this.hit();
    else { this.miss(); if (this.mode === 'hold') this.pos = 0; }
  }

  hit() {
    const bar = $('mg-bar');
    bar.classList.remove('hit', 'miss');
    void bar.offsetWidth;
    sfx.hit();
    bar.classList.add('hit');
    this.step++;
    this.renderSteps();
    if (this.step >= this.t.steps.length) {
      this.active = false;
      setTimeout(() => this.finish({ misses: this.misses }), 250);
      return;
    }
    this.newStep();
  }

  miss() {
    const bar = $('mg-bar');
    bar.classList.remove('hit', 'miss');
    void bar.offsetWidth;
    sfx.miss();
    bar.classList.add('miss');
    this.misses++;
  }

  finish(result) {
    this.active = false;
    this.holding = false;
    this.el.classList.add('hidden');
    this.resolve?.(result);
    this.resolve = null;
  }
}
