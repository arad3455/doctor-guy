// Check-up Frenzy (our take on GTA's rampages): touch the glowing 🩺 token in the park, then check as many
// kids as you can in 60 seconds. Quick check-ups back-to-back build a combo (×2 … ×5).
import * as THREE from 'three';
import { buildKid } from './characters.js';
import { canvasTexture } from './toon.js';
import { sfx } from './audio.js';
import { getColliders, inPond, WORLD } from './world.js';

const DURATION = 60;
const COMBO_WINDOW = 9; // seconds to keep the combo going
const ACTIVE_KIDS = 6;
const LOOKS = ['redShirt', 'capKid', 'ponytail', 'glassesKid', 'bandageBoy', 'gownKid', 'pinkHat'];
const NAMES = ['Adam', 'Neta', 'Eli', 'Dafna', 'Yonatan', 'Hila', 'Rafi', 'Mor', 'Tal', 'Shai', 'Inbar', 'Nadav'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const FRENZY_TOKEN = new THREE.Vector3(9, 0, -9);

export class Frenzy {
  constructor({ scene, missions, career, progress, ui }) {
    Object.assign(this, { missions, career, progress, ui });
    this.active = false;
    this.token = makeToken();
    this.token.position.copy(FRENZY_TOKEN);
    scene.add(this.token);
    this.hud = document.getElementById('frenzy-hud');
  }

  get available() { return !this.active; }

  start() {
    if (this.active) return;
    this.active = true;
    this.left = DURATION;
    this.score = 0;
    this.count = 0;
    this.combo = 1;
    this.bestCombo = 1;
    this.lastCheck = -99;
    this.time = 0;
    this.kids = [];
    this.token.visible = false;
    for (let i = 0; i < ACTIVE_KIDS; i++) this.spawnKid();
    this.ui.toast('⚡ <b>CHECK-UP FRENZY!</b><br><small>Check as many kids as you can in 60 s — quick ones build a combo</small>', 2800);
    sfx.stinger();
    this.hud.classList.remove('hidden');
  }

  spawnKid() {
    // somewhere on the lawns around the fountain, away from the other frenzy kids
    let x, z, tries = 0;
    do {
      const a = Math.random() * Math.PI * 2, d = 7 + Math.random() * 13;
      x = Math.cos(a) * d; z = Math.sin(a) * d;
      tries++;
    } while (tries < 40 && (blocked(x, z) || this.kids.some((k) => Math.hypot(k.kid.root.position.x - x, k.kid.root.position.z - z) < 5)));
    const kid = buildKid(pick(LOOKS));
    kid.root.position.set(x, 0, z);
    kid.root.rotation.y = Math.random() * 6;
    this.missions.group.add(kid.root);
    const entry = { kid, mode: 'wave', frenzy: true, name: pick(NAMES.filter((n) => !this.kids.some((k) => k.name === n))) };
    this.missions.ambient.push(entry);
    this.kids.push(entry);
  }

  /** Called by MissionSystem.checkup when a frenzy kid has been checked. */
  scored(entry) {
    if (!this.active) return; // time ran out mid check-up
    this.combo = this.time - this.lastCheck <= COMBO_WINDOW ? Math.min(5, this.combo + 1) : 1;
    this.lastCheck = this.time;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += this.combo;
    this.count++;
    sfx.tick();
    if (this.combo > 1) this.ui.toast(`🔥 COMBO ×${this.combo}`, 900);
    // the kid runs off happily, a new one shows up
    setTimeout(() => {
      entry.kid.root.removeFromParent();
      const i = this.missions.ambient.indexOf(entry);
      if (i >= 0) this.missions.ambient.splice(i, 1);
      const k = this.kids.indexOf(entry);
      if (k >= 0) this.kids.splice(k, 1);
      if (this.active) this.spawnKid();
    }, 1400);
  }

  update(dt, t) {
    this.token.rotation.y += dt * 1.6;
    this.token.children[0].position.y = 1.6 + Math.sin(t * 3) * 0.2;
    if (!this.active) { this.hud.classList.add('hidden'); return; }
    this.time += dt;
    this.left -= dt;
    const comboLeft = Math.max(0, COMBO_WINDOW - (this.time - this.lastCheck));
    if (comboLeft === 0) this.combo = 1;
    const s = Math.max(0, Math.ceil(this.left));
    this.hud.innerHTML = `<span class="fz-title">⚡ CHECK-UP FRENZY</span><span class="fz-time ${s <= 10 ? 'hurry' : ''}">0:${String(s).padStart(2, '0')}</span>`
      + `<span class="fz-score">🩺 ${this.count} · ${this.score} pts</span><span class="fz-combo ${this.combo > 1 ? 'on' : ''}">×${this.combo}</span>`;
    if (this.left <= 0) this.finish();
  }

  /** Stop without a payout (shift restart / end) and tidy up the frenzy kids. */
  abort() {
    if (!this.active) return;
    this.active = false;
    this.hud.classList.add('hidden');
    for (const e of this.kids) {
      e.kid.root.removeFromParent();
      const i = this.missions.ambient.indexOf(e);
      if (i >= 0) this.missions.ambient.splice(i, 1);
    }
    this.kids = [];
    this.token.visible = true;
  }

  finish() {
    this.abort();
    const best = this.progress.data.frenzyBest ?? 0;
    const record = this.score > best;
    if (record) { this.progress.data.frenzyBest = this.score; this.progress.dirty = true; }
    const lines = [{ label: `🩺 ${this.count} check-ups`, amount: this.count }, { label: `🔥 Combo points (best ×${this.bestCombo})`, amount: this.score - this.count }];
    if (record && this.score > 0) lines.push({ label: '🏆 New record!', amount: 5 });
    this.career.frenzyOver({ score: this.score, count: this.count, record, best: Math.max(best, this.score), lines });
  }
}

/** Trees, benches, the pond, the tower and the swings are no place for a patient. */
function blocked(x, z) {
  if (inPond(x, z) || Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z) < WORLD.pond.r + 1.5) return true;
  if (Math.hypot(x - WORLD.tower.x, z - WORLD.tower.z) < 5 || Math.hypot(x - WORLD.swings.x, z - WORLD.swings.z) < 5) return true;
  return getColliders().some((c) => (c.type === 'circle'
    ? Math.hypot(x - c.x, z - c.z) < c.r + 1.2
    : x > c.minX - 1.2 && x < c.maxX + 1.2 && z > c.minZ - 1.2 && z < c.maxZ + 1.2));
}

function makeToken() {
  const g = new THREE.Group();
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    const grd = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.5, '#ff3c8e'); grd.addColorStop(1, 'rgba(255,60,142,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(64, 64, 64, 0, Math.PI * 2); ctx.fill();
    ctx.font = '64px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🩺', 64, 68);
  });
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  icon.scale.setScalar(1.6);
  icon.position.y = 1.6;
  g.add(icon);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 32), new THREE.MeshBasicMaterial({ color: 0xff3c8e, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3c8e, transparent: true, opacity: 0.18, depthWrite: false }));
  beam.position.y = 7;
  g.add(beam);
  return g;
}
