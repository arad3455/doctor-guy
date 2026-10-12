// Ambulance time trials (GTA-style checkpoint races). Drive into a race start flag, press E, 3-2-1-GO, then hit the
// glowing checkpoint rings in order. Gold / silver / bronze times, best times saved, lollipops for medals.
import * as THREE from 'three';
import { signTexture } from './toon.js';
import { sfx } from './audio.js';
import { timerHTML } from './icons.js';
import { headline } from './notify.js';

export const RACES = [
  {
    id: 'downtown', name: 'Downtown Dash', icon: '🏙️', medals: { gold: 28, silver: 33, bronze: 41 },
    start: { x: -80, z: -37, heading: -Math.PI / 2 },
    cps: [[-111.5, -37], [-111.5, 5], [-153.5, 5], [-153.5, -79], [-69.5, -79], [-69.5, -37]],
  },
  {
    id: 'seaside', name: 'Seaside Sprint', icon: '🎡', medals: { gold: 19, silver: 23, bronze: 28 },
    start: { x: 40, z: -37, heading: Math.PI / 2 },
    cps: [[84.5, -37], [84.5, -2], [119.5, -2], [119.5, 33], [84.5, 33], [84.5, 61], [84.5, 70]],
  },
  {
    id: 'runway', name: 'Runway Rush', icon: '✈️', medals: { gold: 25, silver: 29, bronze: 36 },
    start: { x: -30, z: -37, heading: -Math.PI / 2 },
    cps: [[-111.5, -37], [-111.5, -79], [-111.5, -100], [-76, -100], [-75, -150], [-75, -160], [-100, -192], [-30, -192]],
  },
];
const CP_RADIUS = 6.5;
// medal times are set from test laps (tools/race-test.mjs: an autopilot does ~31 / 21 / 27 s; gold needs clean corners)
for (const r of RACES) {
  let len = 0, prev = r.start;
  for (const [x, z] of r.cps) { len += Math.hypot(x - prev.x, z - prev.z); prev = { x, z }; }
  r.length = len;
}

export class Races {
  constructor({ scene, progress, ambulance, ui }) {
    Object.assign(this, { scene, progress, ambulance, ui });
    this.active = null;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.hud = document.getElementById('race-hud');
    // start flags: a chequered banner on a pole + a ground ring
    for (const r of RACES) {
      const g = new THREE.Group();
      g.position.set(r.start.x, 0, r.start.z);
      const ring = new THREE.Mesh(new THREE.RingGeometry(3, 3.6, 40), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
      g.add(ring);
      const flag = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture([`🏁 ${r.name}`], { w: 512, h: 128, size: 52, bg: '#1b1b2e', fg: '#ffd23f' }), depthWrite: false }));
      flag.scale.set(6, 1.5, 1); flag.position.y = 4.2;
      g.add(flag);
      this.group.add(g);
      r.marker = g;
    }
    // the checkpoint rings (re-used for every race): the next one bright, the one after faint
    const ringGeo = new THREE.TorusGeometry(4.2, 0.35, 10, 40);
    this.next = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9 }));
    this.after = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.3 }));
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.25, depthWrite: false }));
    for (const m of [this.next, this.after, this.beam]) { m.visible = false; scene.add(m); }
  }

  /** E while driving near a start flag. */
  action(p) {
    if (this.active || Math.abs(this.ambulance.speed) > 4) return null;
    const r = RACES.find((x) => Math.hypot(p.x - x.start.x, p.z - x.start.z) < 6);
    if (!r) return null;
    const best = this.progress.data.races?.[r.id];
    return { label: `🏁 Race: ${r.name}${best ? ` (best ${best.time.toFixed(1)}s)` : ''}`, run: () => this.start(r) };
  }

  start(r) {
    const a = this.ambulance;
    a.pos.set(r.start.x, 0, r.start.z);
    a.heading = r.start.heading;
    a.speed = 0;
    a.syncTransform();
    this.active = { r, i: 0, t: -3, frozen: true };
    for (const x of RACES) x.marker.visible = false;
    this.place();
    this.hud.classList.remove('hidden');
    headline({ kicker: 'TIME TRIAL', icon: 'flag', tone: 'race', title: r.name, sub: `🥇 ${r.medals.gold}s · 🥈 ${r.medals.silver}s · 🥉 ${r.medals.bronze}s`, ms: 2400, replace: true });
    sfx.stinger();
  }

  place() {
    const { r, i } = this.active, [x, z] = r.cps[i], last = i === r.cps.length - 1;
    const prev = i ? r.cps[i - 1] : [r.start.x, r.start.z];
    this.next.position.set(x, 4.2, z);
    this.next.rotation.y = Math.atan2(x - prev[0], z - prev[1]);
    this.next.material.color.setHex(last ? 0xffffff : 0xffd23f);
    this.beam.position.set(x, 20, z);
    this.next.visible = this.beam.visible = true;
    const n = r.cps[i + 1];
    this.after.visible = !!n;
    if (n) { this.after.position.set(n[0], 4.2, n[1]); this.after.rotation.y = Math.atan2(n[0] - x, n[1] - z); }
  }

  /** The ring the GPS should point at. */
  get target() { return this.active ? { x: this.active.r.cps[this.active.i][0], z: this.active.r.cps[this.active.i][1] } : null; }

  update(dt, t) {
    for (const r of RACES) r.marker.rotation.y = t * 0.6;
    const A = this.active;
    if (!A) return;
    if (!this.ambulance.driving) { this.stop({ title: 'Race abandoned', sub: 'You got out of the ambulance' }); return; }
    const prevT = A.t;
    A.t += dt;
    // countdown: hold the ambulance still until GO
    if (A.t < 0) {
      this.ambulance.speed = 0;
      const n = Math.ceil(-A.t);
      if (n !== Math.ceil(-prevT)) sfx.tick();
      this.hud.innerHTML = timerHTML({ icon: 'flag', title: A.r.name, time: n, hurry: true, sub: 'Get ready…' });
      return;
    }
    if (prevT < 0) { headline({ kicker: A.r.name.toUpperCase(), icon: 'flag', tone: 'race', title: 'GO!', ms: 900, replace: true }); sfx.success(); }
    this.next.rotation.z = t * 1.5;
    const p = this.ambulance.pos, [cx, cz] = A.r.cps[A.i];
    if (Math.hypot(p.x - cx, p.z - cz) < CP_RADIUS) {
      A.i++;
      sfx.pickup();
      if (A.i >= A.r.cps.length) { this.finish(); return; }
      this.place();
    }
    const best = this.progress.data.races?.[A.r.id]?.time;
    const medal = medalFor(A.r, A.t);
    this.hud.innerHTML = timerHTML({ icon: 'flag', title: A.r.name, time: `${A.t.toFixed(1)}s`,
      sub: `Checkpoint ${A.i}/${A.r.cps.length}${best ? ` · best ${best.toFixed(1)}s` : ''}`, badge: medal?.icon ?? '', badgeOn: !!medal });
    if (A.t > A.r.medals.bronze * 3) this.stop({ title: 'Out of time', sub: 'Try again!' });
  }

  finish() {
    const { r, t } = this.active;
    const medal = medalFor(r, t);
    const prev = this.progress.data.races?.[r.id];
    const record = !prev || t < prev.time;
    if (record) {
      this.progress.data.races = { ...(this.progress.data.races ?? {}), [r.id]: { time: +t.toFixed(2), medal: medal?.id ?? null } };
      this.progress.dirty = true;
    }
    const reward = medal ? medal.reward : 1;
    this.ui.reward(reward);
    this.stop({ kicker: medal ? `${medal.name.toUpperCase()} MEDAL` : 'FINISHED', title: `${r.name} · ${t.toFixed(1)}s`, tone: medal ? 'race' : 'info',
      sub: `${medal ? medal.icon : 'No medal this time'}${record ? ' · Personal best!' : ''} · +${reward} 🍭`, ms: 4200 });
    sfx.missionPassed();
  }

  /** End the race; msg is a headline ({ title, sub, kicker, tone, ms }). */
  stop(msg) {
    this.active = null;
    this.next.visible = this.after.visible = this.beam.visible = false;
    for (const x of RACES) x.marker.visible = true;
    this.hud.classList.add('hidden');
    if (msg) headline({ kicker: 'TIME TRIAL', icon: 'flag', tone: 'info', ms: 2600, ...msg, replace: true });
  }

  blips() { return RACES.map((r) => ({ x: r.start.x, z: r.start.z, icon: '🏁', name: r.name })); }
}

function medalFor(r, t) {
  if (t <= r.medals.gold) return { id: 'gold', name: 'Gold', icon: '🥇', reward: 15 };
  if (t <= r.medals.silver) return { id: 'silver', name: 'Silver', icon: '🥈', reward: 10 };
  if (t <= r.medals.bronze) return { id: 'bronze', name: 'Bronze', icon: '🥉', reward: 5 };
  return null;
}
