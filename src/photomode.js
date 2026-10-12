// Photo mode (GTA's Snapmatic): freeze the world, orbit the camera freely around Doctor Guy, pick a filter and
// save the shot as a PNG. Opened with P or the camera button; Esc / ✕ closes.
import { icon } from './icons.js';
const FILTERS = [
  ['Normal', 'none'],
  ['Sunset', 'saturate(1.35) sepia(0.25) hue-rotate(-12deg) contrast(1.05)'],
  ['Vivid', 'saturate(1.7) contrast(1.1)'],
  ['Noir', 'grayscale(1) contrast(1.25)'],
  ['Retro', 'sepia(0.55) saturate(1.2) contrast(0.95) brightness(1.05)'],
  ['Dreamy', 'saturate(1.2) brightness(1.1) blur(0.4px) hue-rotate(10deg)'],
];

export class PhotoMode {
  constructor({ renderer, camera, scene, target, onToggle }) {
    Object.assign(this, { renderer, camera, scene, target, onToggle });
    this.active = false;
    this.filter = 0;
    this.orbit = { yaw: 0, pitch: 0.25, dist: 7 };
    this.el = document.createElement('div');
    this.el.id = 'photo';
    this.el.className = 'hidden';
    this.el.innerHTML = `
      <div class="ph-frame"></div>
      <div class="ph-top"><span class="ph-label">${icon('camera')}Photo mode</span><button class="ph-close" aria-label="Close">✕</button></div>
      <div class="ph-bottom">
        <div class="ph-filters">${FILTERS.map(([n], i) => `<button data-f="${i}">${n}</button>`).join('')}</div>
        <button class="ph-snap">${icon('camera')}Save photo</button>
      </div>
      <div class="ph-hint">drag to look around · scroll / pinch to zoom</div>`;
    document.body.appendChild(this.el);
    this.el.querySelector('.ph-close').addEventListener('click', () => this.toggle(false));
    this.el.querySelector('.ph-snap').addEventListener('click', () => this.snap());
    this.el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => this.setFilter(+b.dataset.f)));
    // orbit with drag / pinch / wheel on the frame
    const frame = this.el.querySelector('.ph-frame');
    const pts = new Map();
    let pinch = 0;
    frame.addEventListener('pointerdown', (e) => { frame.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch = 0; });
    frame.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.orbit.dist = clamp(this.orbit.dist * (pinch / d), 2.5, 40);
        pinch = d;
      } else {
        this.orbit.yaw -= (e.clientX - p.x) * 0.006;
        this.orbit.pitch = clamp(this.orbit.pitch + (e.clientY - p.y) * 0.004, 0.03, 1.35);
      }
      p.x = e.clientX; p.y = e.clientY;
    });
    const up = (e) => pts.delete(e.pointerId);
    frame.addEventListener('pointerup', up);
    frame.addEventListener('pointercancel', up);
    frame.addEventListener('wheel', (e) => { e.preventDefault(); this.orbit.dist = clamp(this.orbit.dist * (e.deltaY > 0 ? 1.1 : 0.9), 2.5, 40); }, { passive: false });
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.active) this.toggle(false);
    });
  }

  toggle(v = !this.active) {
    this.active = v;
    this.el.classList.toggle('hidden', !v);
    if (v) {
      // start from wherever the game camera was looking
      const t = this.target(), c = this.camera.position;
      this.orbit.yaw = Math.atan2(c.x - t.x, c.z - t.z);
      this.orbit.dist = clamp(Math.hypot(c.x - t.x, c.z - t.z), 3, 20);
      this.orbit.pitch = clamp(Math.atan2(c.y - t.y - 1.2, this.orbit.dist), 0.05, 1.2);
      this.setFilter(this.filter);
    } else this.renderer.domElement.style.filter = '';
    this.onToggle?.(v);
  }

  setFilter(i) {
    this.filter = i;
    this.renderer.domElement.style.filter = FILTERS[i][1] === 'none' ? '' : FILTERS[i][1];
    this.el.querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('on', +b.dataset.f === i));
  }

  /** Called every frame while active: place the orbit camera. */
  update() {
    const t = this.target(), o = this.orbit;
    this.camera.position.set(t.x + Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist, Math.max(t.y + 0.5, t.y + 1.2 + Math.sin(o.pitch) * o.dist), t.z + Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist);
    this.camera.lookAt(t.x, t.y + 1.2, t.z);
  }

  /** Renders a frame and saves it (with the filter and a little Doctor Guy watermark) as a PNG. */
  snap() {
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d');
    ctx.filter = FILTERS[this.filter][1];
    ctx.drawImage(src, 0, 0);
    ctx.filter = 'none';
    const s = c.height / 720;
    ctx.font = `700 ${Math.round(26 * s)}px "Fredoka", sans-serif`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 5 * s; ctx.strokeStyle = 'rgba(20,20,30,0.85)';
    ctx.strokeText('✚ Doctor Guy', c.width - 18 * s, c.height - 14 * s);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('✚ Doctor Guy', c.width - 18 * s, c.height - 14 * s);
    c.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `doctor-guy-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
    // a camera flash
    const flash = document.createElement('div');
    flash.className = 'ph-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 450);
    this.lastSnap = { w: c.width, h: c.height };
  }
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
