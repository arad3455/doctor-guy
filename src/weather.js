// Weather: every few minutes a rain shower rolls over Wolfson — the sky and fog turn grey, the sun dims, rain
// streaks fall around the camera — and when it clears a rainbow hangs in the sky for a while.
import * as THREE from 'three';

const SHOWER_EVERY = [300, 480]; // seconds of fair weather between showers
const SHOWER_LENGTH = [55, 85];
const FADE = 8; // seconds to roll in / clear up
const RAINBOW_FOR = 45;

const grey = new THREE.Color(0x8e98a6), greyLow = new THREE.Color(0xb3bcc6);

export class Weather {
  constructor(scene) {
    this.scene = scene;
    this.rain = 0; // 0 = clear … 1 = full shower
    this.t = 0;
    this.next = rand(...SHOWER_EVERY) * 0.5; // the first shower comes a bit sooner
    this.shower = null;
    this.rainbowT = 0;
    // rain streaks: short lines in a box that follows the camera
    const N = 1400;
    const pos = new Float32Array(N * 6);
    this.drops = [];
    for (let i = 0; i < N; i++) this.drops.push({ x: rand(-35, 35), y: rand(0, 28), z: rand(-35, 35), v: rand(26, 34) });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    scene.add(this.lines);
    this.rainbow = makeRainbow();
    this.rainbow.visible = false;
    scene.add(this.rainbow);
  }

  get raining() { return this.rain > 0.2; }

  /** Start a shower right now (debug / tests). */
  startShower(length = rand(...SHOWER_LENGTH)) { this.shower = { t: 0, length }; }

  update(dt, { camera, dayNight, outside, sun, hemi, sky, fog }) {
    this.t += dt;
    if (!this.shower && this.t > this.next) this.startShower();
    if (this.shower) {
      const s = this.shower;
      s.t += dt;
      this.rain = Math.min(1, s.t / FADE, Math.max(0, (s.length - s.t) / FADE));
      if (s.t >= s.length) {
        this.shower = null;
        this.rain = 0;
        this.t = 0;
        this.next = rand(...SHOWER_EVERY);
        if ((dayNight?.night ?? 0) < 0.4) this.rainbowT = RAINBOW_FOR; // only in daylight
      }
    }
    // grey the sky, fog and light (after the day/night cycle has set them this frame)
    const r = this.rain * 0.75;
    if (r > 0) {
      sky.uniforms.top.value.lerp(grey, r);
      sky.uniforms.bottom.value.lerp(greyLow, r);
      fog.color.lerp(greyLow, r);
      sun.intensity *= 1 - r * 0.65;
      hemi.intensity *= 1 - r * 0.2;
    }
    // falling rain around the camera
    this.lines.visible = outside && this.rain > 0.02;
    if (this.lines.visible) {
      const p = this.lines.geometry.attributes.position.array, c = camera.position;
      const slant = 0.12;
      let k = 0;
      for (const d of this.drops) {
        d.y -= d.v * dt;
        if (d.y < -2) { d.y += 30; d.x = rand(-35, 35); d.z = rand(-35, 35); }
        const x = c.x + d.x, y = c.y - 12 + d.y, z = c.z + d.z;
        p[k++] = x; p[k++] = y; p[k++] = z;
        p[k++] = x + slant; p[k++] = y + 0.9; p[k++] = z;
      }
      this.lines.geometry.attributes.position.needsUpdate = true;
      this.lines.material.opacity = 0.55 * this.rain;
    }
    // the rainbow, opposite the sun, fading in and out
    if (this.rainbowT > 0) this.rainbowT -= dt;
    const rb = this.rainbowT > 0 ? Math.min(1, (RAINBOW_FOR - this.rainbowT) / 4, this.rainbowT / 6) : 0;
    this.rainbow.visible = outside && rb > 0.01;
    if (this.rainbow.visible) {
      const so = dayNight?.sunOffset ?? new THREE.Vector3(30, 50, 20);
      const away = new THREE.Vector3(-so.x, 0, -so.z).normalize();
      this.rainbow.position.set(camera.position.x + away.x * 260, -10, camera.position.z + away.z * 260);
      this.rainbow.lookAt(camera.position.x, -10, camera.position.z);
      this.rainbow.material.opacity = 0.55 * rb;
    }
  }
}

function rand(a, b) { return a + Math.random() * (b - a); }

function makeRainbow() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const x = c.getContext('2d');
  const cols = ['#ff3b3b', '#ff9a2a', '#ffe23a', '#4cd964', '#3aa0ff', '#5a4bff', '#b04cff'];
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  cols.forEach((col, i) => g.addColorStop(0.12 + (i / (cols.length - 1)) * 0.76, col));
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  // a half ring; the texture's v runs across the band (inner → outer)
  const geo = new THREE.RingGeometry(150, 175, 64, 1, 0, Math.PI);
  const uv = geo.attributes.uv, posA = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const r = Math.hypot(posA.getX(i), posA.getY(i));
    uv.setXY(i, 0.5, (r - 150) / 25);
  }
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false }));
}
