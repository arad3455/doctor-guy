// Timing-bar treatment mini-game: hit SPACE while the needle is in the green zone.
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);

export class MiniGame {
  constructor() {
    this.el = $('minigame');
    this.active = false;
    addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) this.press(); }
      if (e.code === 'Escape') this.finish(null);
    });
    // touch: tap anywhere on the overlay
    this.el.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      e.preventDefault();
      this.press();
    });
  }

  /** treatment: { title, desc, steps: [{icon, label}], speed, zone } → Promise<{misses}|null> */
  start(treatment) {
    this.t = treatment;
    this.step = 0;
    this.misses = 0;
    this.pos = 0;
    this.dir = 1;
    this.active = true;
    $('mg-title').textContent = treatment.title;
    this.el.classList.remove('hidden');
    this.newZone();
    this.renderSteps();
    return new Promise((resolve) => { this.resolve = resolve; });
  }

  newZone() {
    const w = this.t.zone ?? 0.2;
    this.zoneW = w;
    this.zoneX = 0.08 + Math.random() * (0.84 - w);
    const z = $('mg-zone');
    z.style.left = `${this.zoneX * 100}%`;
    z.style.width = `${w * 100}%`;
    const s = this.t.steps[this.step];
    $('mg-desc').textContent = s ? `${s.icon} ${s.label}` : '';
  }

  renderSteps() {
    $('mg-steps').innerHTML = this.t.steps
      .map((s, i) => `<span style="opacity:${i < this.step ? 1 : 0.3}">${i < this.step ? '✅' : s.icon}</span>`)
      .join('');
  }

  update(dt) {
    if (!this.active) return;
    const speed = (this.t.speed ?? 1) * (1 + this.step * 0.15);
    this.pos += this.dir * dt * speed;
    if (this.pos > 1) { this.pos = 1; this.dir = -1; }
    if (this.pos < 0) { this.pos = 0; this.dir = 1; }
    $('mg-needle').style.left = `${this.pos * 100}%`;
  }

  press() {
    const bar = $('mg-bar');
    bar.classList.remove('hit', 'miss');
    void bar.offsetWidth;
    if (this.pos >= this.zoneX && this.pos <= this.zoneX + this.zoneW) {
      sfx.hit();
      bar.classList.add('hit');
      this.step++;
      this.renderSteps();
      if (this.step >= this.t.steps.length) {
        setTimeout(() => this.finish({ misses: this.misses }), 250);
        this.active = false;
        return;
      }
      this.newZone();
    } else {
      sfx.miss();
      bar.classList.add('miss');
      this.misses++;
    }
  }

  finish(result) {
    this.active = false;
    this.el.classList.add('hidden');
    this.resolve?.(result);
    this.resolve = null;
  }
}
