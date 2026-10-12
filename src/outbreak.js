// Flu outbreaks: every few minutes a bug sweeps through one area you've already visited. Five kids come down with
// it at once (green-tinged, 🤒 bubbles, red blips on the radar); treat them all before the timer runs out for a
// bonus. A stethoscope check-up with a quick dose of medicine does it.
import * as THREE from 'three';
import { buildKid, makeBubble } from './characters.js';
import { clampWalkable, collidersNear } from './world.js';
import { sfx } from './audio.js';

const EVERY = [360, 540]; // seconds between outbreaks
const DURATION = 180;
const COUNT = 5;
const LOOKS = ['redShirt', 'capKid', 'ponytail', 'glassesKid', 'bandageBoy', 'pinkHat', 'gownKid'];
const NAMES = ['Omri', 'Noga', 'Yali', 'Itay', 'Maayan', 'Roy', 'Sivan', 'Liron', 'Dvir', 'Ofri'];
// hotspots per area: [x, z, radius]
const HOTSPOTS = {
  park: [[0, 0, 20]], beach: [[0, 100, 22]], zoo: [[185, 0, 26]], downtown: [[-132.5, -16, 14], [-90, -37, 10]],
  suburbs: [[100, 15, 16]], pier: [[120, 88, 16]], camp: [[50, -140, 16]], harbor: [[-140, 95, 16]], airport: [[-110, -102, 18]],
};
const NAMES_OF = { park: 'Wolfson Park', beach: 'Sunny Beach', zoo: 'the Zoo', downtown: 'Downtown', suburbs: 'Maple Heights', pier: 'Sunset Pier', camp: 'Pinewood Camp', harbor: 'the Harbor', airport: 'the Airport' };

const free = (x, z) => {
  const p = { x, z };
  clampWalkable(p);
  if (Math.hypot(p.x - x, p.z - z) > 0.01) return false;
  return !collidersNear(x, z, 2).some((c) => (c.owner === 'car' || c.dynamic) ? false
    : c.type === 'circle' ? Math.hypot(c.x - x, c.z - z) < c.r + 1 : x > c.minX - 1 && x < c.maxX + 1 && z > c.minZ - 1 && z < c.maxZ + 1);
};

export class Outbreak {
  constructor({ missions, progress, ui }) {
    Object.assign(this, { missions, progress, ui });
    this.active = null;
    this.next = 240 + Math.random() * 120; // the first one comes a little sooner
    this.hud = document.getElementById('outbreak-hud');
  }

  /** Start one now (in `zone`, or a random visited area). */
  start(zone) {
    if (this.active) return false;
    const visited = Object.keys(this.progress.data.visited ?? {}).filter((z) => HOTSPOTS[z]);
    zone ??= visited[Math.floor(Math.random() * visited.length)] ?? 'park';
    const spots = HOTSPOTS[zone];
    const kids = [];
    for (let k = 0, tries = 0; k < COUNT && tries < 400; tries++) {
      const [cx, cz, r] = spots[tries % spots.length];
      const a = Math.random() * Math.PI * 2, d = Math.random() * r;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!free(x, z) || kids.some((e) => Math.hypot(e.kid.root.position.x - x, e.kid.root.position.z - z) < 4)) continue;
      const kid = buildKid(LOOKS[k % LOOKS.length]);
      kid.root.position.set(x, 0, z);
      kid.root.rotation.y = Math.random() * 6;
      tint(kid, 0xd6f2b8);
      const bubble = makeBubble('🤒 Achoo!', { w: 240, bg: '#eaffd6' });
      bubble.position.y = kid.height + 0.9;
      kid.root.add(bubble);
      this.missions.group.add(kid.root);
      const entry = { kid, mode: 'wave', outbreak: true, name: NAMES[(k + Math.floor(Math.random() * 5)) % NAMES.length], bubble };
      this.missions.ambient.push(entry);
      kids.push(entry);
      k++;
    }
    this.active = { zone, kids, left: DURATION, cured: 0 };
    this.hud.classList.remove('hidden');
    this.ui.toast(`🤒 <b>Flu outbreak in ${NAMES_OF[zone]}!</b><br><small>${kids.length} kids are sick — check them all in 3 minutes</small>`, 3600);
    sfx.alert();
    return true;
  }

  /** Called by MissionSystem.checkup when an outbreak kid has had their check-up. */
  cured(entry) {
    const A = this.active;
    if (!A || entry.cured) return;
    entry.cured = true;
    entry.kid.root.remove(entry.bubble);
    untint(entry.kid);
    A.cured++;
    this.ui.reward(3);
    sfx.pickup();
    this.ui.toast(`💊 ${entry.name} is feeling better! (${A.cured}/${A.kids.length}) · +3 🍭`, 1600);
    // they head home a moment later
    setTimeout(() => this.remove(entry), 2500);
    if (A.cured >= A.kids.length) this.finish(true);
  }

  remove(entry) {
    entry.kid.root.removeFromParent();
    const i = this.missions.ambient.indexOf(entry);
    if (i >= 0) this.missions.ambient.splice(i, 1);
  }

  finish(won) {
    const A = this.active;
    this.active = null;
    this.next = EVERY[0] + Math.random() * (EVERY[1] - EVERY[0]);
    this.hud.classList.add('hidden');
    for (const e of A.kids) if (!e.cured) this.remove(e);
    if (won) {
      this.progress.data.outbreaks = (this.progress.data.outbreaks ?? 0) + 1;
      this.progress.dirty = true;
      this.ui.reward(15);
      this.ui.toast(`🏆 <b>Outbreak contained!</b><br><small>Everyone in ${NAMES_OF[A.zone]} is healthy again · +15 🍭</small>`, 3600);
      sfx.missionPassed();
    } else {
      this.ui.toast(`🤧 The flu ran its course in ${NAMES_OF[A.zone]}… ${A.cured}/${A.kids.length} treated.`, 3000);
    }
  }

  update(dt, started) {
    if (!started) return;
    if (!this.active) {
      if ((this.next -= dt) <= 0) this.start();
      return;
    }
    const A = this.active;
    A.left -= dt;
    const s = Math.max(0, Math.ceil(A.left));
    this.hud.innerHTML = `<span class="fz-title">🤒 FLU OUTBREAK · ${NAMES_OF[A.zone]}</span><span class="fz-time ${s <= 30 ? 'hurry' : ''}">${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</span>`
      + `<span class="fz-score">💊 ${A.cured}/${A.kids.length} treated</span><span class="fz-combo on">🤧</span>`;
    if (A.left <= 0) this.finish(false);
  }

  /** End quietly (a new shift clears every kid). */
  abort() {
    if (!this.active) return;
    this.active = null;
    this.hud.classList.add('hidden');
    this.next = 240 + Math.random() * 120;
  }

  /** Radar blips for the sick kids. */
  blips() {
    if (!this.active) return [];
    return this.active.kids.filter((e) => !e.cured).map((e) => ({ x: e.kid.root.position.x, z: e.kid.root.position.z, icon: '🤒', name: e.name }));
  }
}

function tint(kid, color) {
  kid.root.traverse((o) => {
    if (!o.isMesh || !o.material?.color || o.material.type === 'ShaderMaterial' || o.material.type === 'SpriteMaterial') return;
    o.userData.origMat = o.material;
    o.material = o.material.clone();
    o.material.color.multiply(new THREE.Color(color));
  });
}
function untint(kid) {
  kid.root.traverse((o) => { if (o.userData.origMat) { o.material = o.userData.origMat; delete o.userData.origMat; } });
}
