// Golden Bandages: 30 hidden collectibles all over Wolfson (GTA's hidden packages). Each one spins and sparkles;
// grab it on foot or in the ambulance for 🍭 and a counter toast. Found ones are remembered between visits.
import * as THREE from 'three';
import { toon, canvasTexture } from './toon.js';
import { sfx } from './audio.js';

/** [x, z, hint] — every area has a few, tucked behind things or at the end of somewhere. */
export const BANDAGE_SPOTS = [
  // park
  [-50, 50, 'park NW woods'], [50, -50, 'park NE corner'], [22, -22, 'behind the pond'], [-15, 11, 'under the slide tower'],
  // beach + boardwalk
  [-52, 124, 'far west shallows'], [54, 84, 'east dunes'], [-24, 104, 'under the lifeguard tower'],
  // zoo
  [228, 40, 'zoo far corner'], [140, 40, 'zoo south-west'], [205, -40, 'behind the lions'],
  // downtown
  [-196, -80, 'Downtown NW corner'], [-196, 48, 'Downtown SW corner'], [-138, -1, 'skate corner'], [-90, -55, 'tower yard'],
  // Maple Heights
  [62, -22, 'behind the corner house'], [134, 58, 'Maple Heights SE garden'], [132, -22, 'schoolyard corner'],
  // Sunset Pier
  [125.5, 176, 'the very end of the pier'], [148, 66, 'behind the drop tower'], [94, 111, 'by the bumper cars'],
  // Pinewood Camp
  [12, -214, 'deep in the NW forest'], [148, -214, 'deep in the NE forest'], [122, -181, 'beside the waterfall'], [30, -104, 'camp gate'], [146, -104, 'deer meadow edge'],
  // Wolfson Harbor
  [-197, 113, 'harbor west quay'], [-101, 138.5, 'end of the jetty'], [-194, 84, 'container yard corner'],
  // roads
  [63.5, -88, 'Pine Road'], [130, -50, 'zoo car park'],
];

export class Bandages {
  constructor(scene, progress, { onFind, isOpen = () => true } = {}) {
    this.progress = progress;
    this.onFind = onFind;
    this.isOpen = isOpen;
    this.group = new THREE.Group();
    scene.add(this.group);
    const tex = canvasTexture(128, 64, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ffd23f'); g.addColorStop(1, '#e0a020');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(4, 14, w - 8, h - 28, 16); ctx.fill();
      ctx.fillStyle = '#fff8d6'; ctx.fillRect(w / 2 - 18, 18, 36, h - 36);
      ctx.fillStyle = 'rgba(200,140,20,0.6)';
      for (let i = 0; i < 6; i++) ctx.beginPath(), ctx.arc(w / 2 - 10 + (i % 3) * 10, 26 + Math.floor(i / 3) * 12, 2, 0, Math.PI * 2), ctx.fill();
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    const glow = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd23f, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const found = progress.data.bandages ?? {};
    this.items = BANDAGE_SPOTS.map(([x, z, hint], i) => {
      const g = new THREE.Group();
      g.position.set(x, 1.1, z);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), mat);
      b.rotation.z = 0.4;
      g.add(b);
      const halo = new THREE.Sprite(glow);
      halo.scale.setScalar(2.4);
      g.add(halo);
      g.visible = !found[i];
      this.group.add(g);
      return { g, b, i, hint, taken: !!found[i] };
    });
  }

  get count() { return Object.keys(this.progress.data.bandages ?? {}).length; }

  update(dt, t, pos) {
    for (const it of this.items) {
      if (it.taken) continue;
      const dx = it.g.position.x - pos.x, dz = it.g.position.z - pos.z;
      if (dx * dx + dz * dz > 120 * 120) { it.g.visible = false; continue; } // too far to see anyway
      it.g.visible = true;
      it.g.rotation.y = t * 2 + it.i;
      it.g.position.y = 1.1 + Math.sin(t * 2.5 + it.i) * 0.15;
      if (dx * dx + dz * dz < 2.2 * 2.2 && pos.y < 2.5 && this.isOpen()) this.take(it);
    }
  }

  take(it) {
    it.taken = true;
    it.g.visible = false;
    this.progress.data.bandages = { ...(this.progress.data.bandages ?? {}), [it.i]: Date.now() };
    this.progress.dirty = true;
    sfx.achievement?.();
    this.onFind?.(this.count, BANDAGE_SPOTS.length, it);
  }
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,170,0.9)'); g.addColorStop(0.4, 'rgba(255,210,63,0.35)'); g.addColorStop(1, 'rgba(255,210,63,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
