// Wolfson Buses: a bus stop in every area. Walk up to one, press E, pick a destination you've already visited and
// ride there (2 🍭) — a quick fade, and you step off at the other stop. Saves the long walks across a big city.
import * as THREE from 'three';
import { part, signTexture } from './toon.js';
import { addBox, collidersNear, clampWalkable } from './world.js';
import { signBoard } from './cityprops.js';
import { DT_SPOTS } from './downtown.js';
import { MH } from './suburbs.js';
import { CAMP } from './camp.js';

export const FARE = 2;
/** zone → stop. Positions are nudged to the nearest clear, walkable spot when the stops are built. */
export const STOPS = [
  { zone: 'park', name: 'Wolfson Park', icon: '🌳', x: 8, z: -31 },
  { zone: 'beach', name: 'Sunny Beach', icon: '🏖️', x: 6, z: 85 },
  { zone: 'zoo', name: 'City Zoo', icon: '🦁', x: 147, z: -33.5 },
  { zone: 'downtown', name: 'City Plaza', icon: '🏙️', x: DT_SPOTS.busStop.x + 1.6, z: DT_SPOTS.busStop.z + 3.6, shelter: true },
  { zone: 'suburbs', name: 'Maple Heights', icon: '🏡', x: MH.mapleX + 5, z: 12 },
  { zone: 'pier', name: 'Sunset Pier', icon: '🎡', x: 72, z: 68 },
  { zone: 'camp', name: 'Pinewood Camp', icon: '🌲', x: CAMP.roadX - 6, z: -108 },
  { zone: 'harbor', name: 'Wolfson Harbor', icon: '⚓', x: -122, z: 108 },
  { zone: 'airport', name: 'Airport', icon: '✈️', x: -100, z: -100 },
];

const free = (x, z) => {
  const p = { x, z };
  clampWalkable(p);
  if (Math.hypot(p.x - x, p.z - z) > 0.01) return false;
  return !collidersNear(x, z, 2.5).some((c) => (c.owner === 'car' || c.dynamic) ? false
    : c.type === 'circle' ? Math.hypot(c.x - x, c.z - z) < c.r + 1.4 : x > c.minX - 1.4 && x < c.maxX + 1.4 && z > c.minZ - 1.4 && z < c.maxZ + 1.4);
};

export function buildBusStops(scene) {
  const group = new THREE.Group();
  scene.add(group);
  for (const s of STOPS) {
    if (!s.shelter) {
      // find the nearest clear spot (spiral search), then put up a sign pole and a bench
      if (!free(s.x, s.z)) {
        let found = false;
        for (let r = 1; r < 14 && !found; r += 1) for (let a = 0; a < 16 && !found; a++) {
          const x = s.x + Math.cos((a / 16) * Math.PI * 2) * r, z = s.z + Math.sin((a / 16) * Math.PI * 2) * r;
          if (free(x, z)) { s.x = x; s.z = z; found = true; }
        }
      }
      const pole = part(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), 0x9aa3ad, { outline: 0.01 });
      pole.position.set(s.x, 1.5, s.z);
      group.add(pole);
      const disc = signBoard(new THREE.CircleGeometry(0.45, 24), signTexture(['🚌'], { w: 128, h: 128, size: 76, bg: '#2f7fc1', fg: '#ffffff' }));
      disc.position.set(s.x, 3.05, s.z);
      group.add(disc);
      const plate = signBoard(new THREE.PlaneGeometry(1.5, 0.42), signTexture([s.name.toUpperCase()], { w: 512, h: 144, size: 58, bg: '#ffffff', fg: '#2f7fc1' }));
      plate.position.set(s.x, 2.4, s.z);
      group.add(plate);
      const bench = part(new THREE.BoxGeometry(1.6, 0.1, 0.45), 0x2f7fc1, { outline: 0.012 });
      bench.position.set(s.x + 1.2, 0.5, s.z);
      group.add(bench);
      for (const dx of [-0.65, 0.65]) {
        const leg = part(new THREE.BoxGeometry(0.08, 0.5, 0.4), 0x2b2f38, { outline: 0 });
        leg.position.set(s.x + 1.2 + dx, 0.25, s.z);
        group.add(leg);
      }
      addBox(s.x + 0.6, s.z, 2.3, 0.6);
      s.board = { x: s.x - 1.1, z: s.z + 0.9 }; // where you arrive (beside the sign)
    } else s.board = { x: s.x, z: s.z };
  }
  return group;
}

/** The menu, travel and the stop-nearby check. */
export class Buses {
  constructor({ progress, wallet, onTravel, toast }) {
    Object.assign(this, { progress, wallet, onTravel, toast });
    this.el = document.getElementById('bus');
    this.list = document.getElementById('bus-list');
    document.getElementById('bus-close').addEventListener('click', () => this.close());
    addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.open) this.close(); });
  }

  get open() { return !this.el.classList.contains('hidden'); }

  nearStop(p) { return STOPS.find((s) => Math.hypot(p.x - s.x, p.z - s.z) < 3); }

  show(from) {
    const visited = this.progress.data.visited ?? {};
    this.list.innerHTML = STOPS.map((s, i) => {
      const here = s === from, known = visited[s.zone];
      return `<button data-i="${i}" ${here || !known ? 'disabled' : ''}>
        <span class="b-icon">${known ? s.icon : '❔'}</span><span class="b-name">${known ? s.name : '???'}</span>
        <span class="b-note">${here ? 'You are here' : known ? `${FARE} 🍭` : 'Visit it first'}</span></button>`;
    }).join('');
    this.list.querySelectorAll('button:not([disabled])').forEach((b) => b.addEventListener('click', () => this.ride(STOPS[+b.dataset.i])));
    this.el.classList.remove('hidden');
  }

  close() { this.el.classList.add('hidden'); }

  ride(to) {
    if (this.wallet.get() < FARE) { this.toast(`🚌 The bus costs ${FARE} 🍭 — save a few kids first!`, 2200); return; }
    this.wallet.add(-FARE);
    this.close();
    const fade = document.getElementById('bus-fade');
    fade.querySelector('span').textContent = `🚌 Next stop: ${to.name}`;
    fade.classList.add('on');
    setTimeout(() => {
      this.onTravel(to);
      setTimeout(() => fade.classList.remove('on'), 350);
    }, 900);
  }
}
