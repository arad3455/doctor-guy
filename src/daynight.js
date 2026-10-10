// Day/night cycle: the sun travels across the sky, golden hour turns the sky into the poster's purple-pink
// sunset, night is a soft blue with stars, glowing street lamps and ambulance headlights (never too dark).
import * as THREE from 'three';
import { toon } from './toon.js';
import { NIGHT_MATS } from './kit.js';

const DAY_SECONDS = 8 * 60; // one full in-game day lasts 8 real minutes

// key moments of the day: [hour, sky top, sky bottom/fog, sun colour, sun intensity, hemi intensity]
const KEYS = [
  [0, 0x0b1440, 0x24305e, 0x7f8fe8, 0.5, 0.72],
  [5, 0x1a1f5a, 0x5a4a8a, 0x8f8fe0, 0.55, 0.75],
  [6.5, 0x5b6fd0, 0xffb38a, 0xffb27a, 1.2, 0.85],
  [8, 0x3d8fe0, 0xc4ecff, 0xffffff, 2.0, 1.1],
  [16.5, 0x3d8fe0, 0xc4ecff, 0xffffff, 2.0, 1.1],
  [18, 0x6a4bc8, 0xff9a6a, 0xffb070, 1.6, 0.95],
  [19, 0x5b2d8c, 0xff5f8f, 0xff8a5a, 1.1, 0.8], // the poster sunset
  [20.3, 0x1b1650, 0x5a3a8a, 0x9a8ae0, 0.6, 0.75],
  [24, 0x0b1440, 0x24305e, 0x7f8fe8, 0.5, 0.72],
];

const lerpColor = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

export class DayNight {
  constructor({ scene, sun, hemi, sky, fog, ambulance, startHour = 19 }) {
    Object.assign(this, { scene, sun, hemi, sky, fog, ambulance });
    this.hour = startHour;
    this.lampMat = toon(0xfff3b0, { emissive: 0x6a5a20 }); // shared by every street-lamp bulb
    // stars
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.3;
      pos.set([Math.cos(a) * Math.cos(e) * 380, Math.sin(e) * 380, Math.sin(a) * Math.cos(e) * 380], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    scene.add(this.stars);
    // ambulance headlights (on at dusk and night)
    this.headlight = new THREE.SpotLight(0xfff2cc, 0, 38, 0.55, 0.6, 1.2);
    this.headlight.position.set(0, 1.4, 3.2);
    this.headlight.target.position.set(0, 0, 14);
    ambulance.root.add(this.headlight, this.headlight.target);
    this.apply();
  }

  /** Soft glow halos on every street-lamp bulb (call once the world is built); extra: [{x,y,z}] for instanced bulbs. */
  addLampHalos(extra = []) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,240,180,1)'); grd.addColorStop(0.35, 'rgba(255,220,140,0.45)'); grd.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = grd; x.fillRect(0, 0, 64, 64);
    this.haloMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false });
    const bulbs = [];
    this.scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.material === this.lampMat) bulbs.push(o); });
    for (const b of bulbs) {
      const s = new THREE.Sprite(this.haloMat);
      s.scale.setScalar(3.2);
      b.add(s);
    }
    for (const p of extra) {
      const s = new THREE.Sprite(this.haloMat);
      s.scale.setScalar(p.size ?? 3.6);
      s.position.set(p.x, p.y, p.z);
      (p.parent ?? this.scene).add(s);
    }
    return bulbs.length + extra.length;
  }

  get clock() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  /** 0 = full day, 1 = full night */
  get night() {
    const h = this.hour;
    if (h >= 20.3 || h < 5) return 1;
    if (h >= 18) return (h - 18) / 2.3;
    if (h < 7) return 1 - (h - 5) / 2;
    return 0;
  }

  update(dt, { outside, playerPos }) {
    this.hour = (this.hour + (dt / DAY_SECONDS) * 24) % 24;
    this.apply(outside, playerPos);
  }

  apply(outside = true, p = { x: 0, z: 0 }) {
    const h = this.hour;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
    const [h0, top0, bot0, sun0, si0, hi0] = KEYS[i], [h1, top1, bot1, sun1, si1, hi1] = KEYS[i + 1];
    const t = THREE.MathUtils.clamp((h - h0) / (h1 - h0), 0, 1);
    const top = lerpColor(top0, top1, t), bottom = lerpColor(bot0, bot1, t);
    this.sky.uniforms.top.value.copy(top);
    this.sky.uniforms.bottom.value.copy(bottom);
    this.fog.color.copy(bottom);
    this.sun.color.copy(lerpColor(sun0, sun1, t));
    this.sun.intensity = si0 + (si1 - si0) * t;
    this.hemi.intensity = hi0 + (hi1 - hi0) * t;
    this.hemi.color.copy(lerpColor(0xdff2ff, 0x8a9ae8, this.night));
    // the sun's (or moon's) direction: low and long shadows at dawn/dusk
    const dayT = THREE.MathUtils.clamp((h - 6) / 14, 0, 1); // 6:00 → 20:00
    const ang = Math.PI * (0.08 + 0.84 * dayT);
    const elev = this.night > 0.6 ? 0.9 : 0.25 + Math.sin(ang) * 0.75;
    this.sunOffset = new THREE.Vector3(Math.cos(ang) * 45, 12 + elev * 40, 18);
    const n = this.night;
    this.stars.material.opacity = Math.max(0, n - 0.3) * 1.2;
    this.stars.visible = outside && n > 0.3;
    this.stars.position.set(p.x, 0, p.z);
    this.lampMat.emissive.setRGB(0.42 + n * 0.58, 0.35 + n * 0.5, 0.12 + n * 0.25);
    this.headlight.intensity = n > 0.25 ? 40 * Math.min(1, n * 1.6) : 0;
    if (this.haloMat) this.haloMat.opacity = Math.max(0, n - 0.15) * 0.9;
    // city windows light up after dusk
    const glow = Math.max(0, n - 0.25) * 1.2;
    for (const m of NIGHT_MATS) m.emissiveIntensity = glow;
  }
}
