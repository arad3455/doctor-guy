// GTA-style navigation: a rotating radar (minimap) with compass and blips, a full-screen world map
// (M / tap the radar) where you can set a waypoint, and the shared painter that draws the world.
import { WORLD, clampWalkable } from './world.js';
import { BEACH } from './beach.js';
import { ZOO } from './zoo.js';
import { INTERIOR } from './hospital.js';

const $ = (id) => document.getElementById(id);
const UNITS_PER_M = 1.36; // Doctor Guy is 2.45 units ≈ 1.8 m
const HOSPITAL_DOOR = { x: 0, z: -46.5 };
const ZONE_BLIPS = [
  { x: 0, z: -46.5, icon: '🏥', name: 'Wolfson Medical Center' },
  { x: 0, z: 96, icon: '🏖️', name: 'Sunny Beach' },
  { x: ZOO.gate.x, z: ZOO.gate.z, icon: '🦁', name: 'Wolfson City Zoo' },
  { x: 0, z: 0, icon: '🌳', name: 'Wolfson Park' },
];
export const ZONE_LABELS = [
  { x: 0, z: 12, text: 'WOLFSON PARK' },
  { x: 0, z: -62, text: 'WOLFSON MEDICAL CENTER' },
  { x: 0, z: 100, text: 'SUNNY BEACH' },
  { x: 97, z: -46, text: 'ZOO ROAD' },
  { x: ZOO.center.x, z: ZOO.max.z + 7, text: 'WOLFSON CITY ZOO' },
];
const isInterior = (z) => z < -300;

/**
 * Paints the outdoor world. P(x, z) → [cx, cy] maps world to canvas (it may rotate), s = pixels per unit.
 * Shapes are drawn as polygons/circles through P so the same code serves the rotating radar and the big map.
 */
export function paintWorld(ctx, P, s, { labels = false, upright = (fn, x, y) => fn(x, y) } = {}) {
  const poly = (pts, fill, stroke, lw = 1) => {
    ctx.beginPath();
    pts.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  };
  const rect = (x0, z0, x1, z1, fill, stroke, lw) => poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], fill, stroke, lw);
  const circle = (x, z, r, fill, stroke, lw = 1) => {
    const [a, b] = P(x, z);
    ctx.beginPath(); ctx.arc(a, b, Math.max(0.5, r * s), 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  };
  const text = (x, z, str, px, color = '#fff') => {
    const [a, b] = P(x, z);
    upright((cx, cy) => {
      ctx.font = `700 ${px}px "Fredoka", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, px / 5); ctx.strokeStyle = 'rgba(20,30,40,0.85)';
      ctx.strokeText(str, cx, cy); ctx.fillStyle = color; ctx.fillText(str, cx, cy);
    }, a, b);
  };

  // sea + beach
  rect(-400, WORLD.shoreline, 400, WORLD.wadeLimit + 4, '#5cc8f2');
  rect(-400, WORLD.wadeLimit + 4, 400, 600, '#2b8fd8');
  rect(-85, 66, 85, WORLD.shoreline, '#f2d38a');
  rect(-2.2, 55, 2.2, 84, '#a8743f');
  rect(BEACH.tower.x - 1.5, BEACH.tower.z - 1.5, BEACH.tower.x + 1.5, BEACH.tower.z + 1.5, '#e0323a');
  circle(BEACH.castles.x, BEACH.castles.z, 2.5, '#d9ae5c');
  for (const [x, z] of BEACH.umbrellas) circle(x, z, 1.6, '#ffffff', '#e0323a', 1);
  // park
  rect(-57, -57, 57, 57, null, 'rgba(255,255,255,0.85)', 1.5);
  circle(0, 0, 23, null, '#e6c88f', 4 * s);
  rect(-2.5, -42, 2.5, -22, '#e6c88f');
  rect(-2, 35, 2, 57, '#e6c88f');
  circle(0, 0, 3, '#bfc7d1');
  circle(WORLD.pond.x, WORLD.pond.z, WORLD.pond.r, '#3fa9f5');
  rect(WORLD.tower.x - 1.5, WORLD.tower.z - 1.5, WORLD.tower.x + 1.5, WORLD.tower.z + 1.5, '#e0323a');
  rect(WORLD.swings.x - 3.5, WORLD.swings.z - 0.4, WORLD.swings.x + 3.5, WORLD.swings.z + 0.6, '#2457c5');
  rect(WORLD.stand.x - 0.7, WORLD.stand.z - 1.5, WORLD.stand.x + 0.7, WORLD.stand.z + 1.5, '#9a6234');
  // hospital
  rect(-17, -57, 17, -47, '#efe3cf', '#9a8f7a', 1);
  rect(-1.5, -53, 1.5, -50.6, '#e0323a');
  rect(-0.5, -54.2, 0.5, -49.4, '#e0323a');
  // Zoo Road
  const { road } = ZOO;
  rect(road.x0, road.z - road.width / 2, road.x1, road.z + road.width / 2, '#4a5058');
  {
    ctx.setLineDash([Math.max(2, 2 * s), Math.max(2, 2 * s)]);
    const [a, b] = P(road.x0, road.z), [c, d] = P(road.x1, road.z);
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = Math.max(1, 0.25 * s); ctx.stroke();
    ctx.setLineDash([]);
  }
  // zoo
  rect(ZOO.min.x, ZOO.min.z, ZOO.max.x, ZOO.max.z, '#7ccf55', '#3a7a3a', 2);
  circle(ZOO.center.x, ZOO.center.z, ZOO.ring, null, '#e8cf98', 4 * s);
  rect(ZOO.min.x, road.z - 2.2, ZOO.center.x, road.z + 2.2, '#e8cf98');
  const penIcons = { lion: '🦁', elephant: '🐘', giraffe: '🦒', penguin: '🐧', monkey: '🐒' };
  for (const [name, p] of Object.entries(ZOO.pens)) {
    circle(p.x, p.z, p.r, `#${p.color.toString(16).padStart(6, '0')}`, '#8a6f45', 2);
    if (s > 1) text(p.x, p.z, penIcons[name], Math.min(26, p.r * s * 0.9));
  }
  rect(ZOO.gate.x - 1, ZOO.gate.z - 5.5, ZOO.gate.x + 1, ZOO.gate.z + 5.5, '#c0541f');

  if (labels) for (const l of ZONE_LABELS) text(l.x, l.z, l.text, 15, '#ffffff');
}

/* ------------------------------------------------------------------ */
/* Radar (minimap)                                                     */
/* ------------------------------------------------------------------ */
export class Radar {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.waypoint = null; // { x, z, label, mission? }
  }

  /** Where a thing should appear: things inside the hospital show at its door when you're outside, and vice versa. */
  static blipPos(x, z, playerInside) {
    if (isInterior(z) && !playerInside) return HOSPITAL_DOOR;
    if (!isInterior(z) && playerInside) return { x: INTERIOR.exitDoor.x, z: INTERIOR.exitDoor.z + 2 };
    return { x, z };
  }

  waypointPos() {
    const w = this.waypoint;
    if (!w) return null;
    if (w.mission) {
      if (w.mission.state === 'done') { this.waypoint = null; return null; }
      const k = w.mission.kid.root.position;
      return { x: k.x, z: k.z };
    }
    return { x: w.x, z: w.z };
  }

  draw({ player, yaw, missions, ambulance, plan, time }) {
    const ctx = this.ctx;
    const S = this.canvas.width, C = S / 2, RANGE = 60;
    const s = S / (RANGE * 2);
    const inside = isInterior(player.pos.z);
    const ox = player.pos.x, oz = player.pos.z;
    // the camera's forward direction is "up"
    const vx = -Math.sin(yaw), vz = -Math.cos(yaw);
    const th = -Math.PI / 2 - Math.atan2(vz, vx);
    const ct = Math.cos(th), st = Math.sin(th);
    const P = (x, z) => { const dx = (x - ox) * s, dz = (z - oz) * s; return [C + dx * ct - dz * st, C + dx * st + dz * ct]; };
    const upright = (fn, x, y) => fn(x, y);

    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(C, C, C, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = inside ? '#3b4a5e' : '#6cc24a';
    ctx.fillRect(0, 0, S, S);

    if (inside && plan) {
      for (const r of plan.rooms) {
        ctx.beginPath();
        [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]].forEach(([x, z], i) => { const [a, b] = P(x, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
        ctx.closePath(); ctx.fillStyle = r.color; ctx.fill();
      }
      ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 2;
      for (const [x1, z1, x2, z2] of plan.walls) { const [a, b] = P(x1, z1), [c, d] = P(x2, z2); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
      const [ex, ey] = P(INTERIOR.exitDoor.x, INTERIOR.exitDoor.z);
      this.icon(ex, ey, '🚪', 13);
    } else {
      paintWorld(ctx, P, s, { upright });
      // the ambulance, drawn as a small van shape (when you're not driving it)
      if (ambulance && !ambulance.driving) {
        const f = { x: Math.sin(ambulance.heading), z: Math.cos(ambulance.heading) }, r = { x: f.z, z: -f.x };
        const L = 3.6, W = 1.7, a = ambulance.pos;
        ctx.beginPath();
        [[1, 1], [1, -1], [-1, -1], [-1, 1]].forEach(([i, j], k) => {
          const [px, py] = P(a.x + f.x * L * i + r.x * W * j, a.z + f.z * L * i + r.z * W * j);
          k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#e0323a'; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // zone icons (on the rim when far away), emergencies, drop-off, waypoint
    const rim = (x, z, pad = 9) => {
      let [a, b] = P(x, z);
      const dx = a - C, dy = b - C, d = Math.hypot(dx, dy), max = C - pad;
      const off = d > max;
      if (off) { a = C + (dx / d) * max; b = C + (dy / d) * max; }
      return [a, b, off];
    };
    if (!inside) {
      for (const z of ZONE_BLIPS) {
        const [a, b, off] = rim(z.x, z.z, 11);
        if (z.icon === '🌳' && off) continue;
        this.icon(a, b, z.icon, off ? 12 : 15, off);
      }
    }
    const pulse = 1 + Math.sin(time * 6) * 0.25;
    for (const m of missions.missions) {
      if (m.state === 'done' || m.state === 'carried' || !m.found) continue;
      const k = m.kid.root.position;
      const bp = Radar.blipPos(k.x, k.z, inside);
      const [a, b] = rim(bp.x, bp.z);
      ctx.fillStyle = '#e0323a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(a, b, 5 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    const carried = missions.missions.find((m) => m.state === 'carried');
    if (carried) {
      const t = missions.dropPos(carried.def);
      const bp = Radar.blipPos(t.x, t.z, inside);
      const [a, b] = rim(bp.x, bp.z);
      ctx.fillStyle = '#4cc35a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(a, b, 6 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    const wp = this.waypointPos();
    let wpDist = null;
    if (wp) {
      const bp = Radar.blipPos(wp.x, wp.z, inside);
      const [a, b] = rim(bp.x, bp.z);
      // GPS line from you to the waypoint
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(C, C); ctx.lineTo(a, b); ctx.stroke();
      ctx.setLineDash([]);
      ctx.save(); ctx.translate(a, b); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 2;
      ctx.fillRect(-6, -6, 12, 12); ctx.strokeRect(-6, -6, 12, 12);
      ctx.restore();
      wpDist = Math.hypot(bp.x - ox, bp.z - oz) / UNITS_PER_M;
    }

    // you: an arrow pointing where Doctor Guy is heading
    const fa = Math.atan2(Math.cos(player.facing), Math.sin(player.facing)) + th;
    ctx.save(); ctx.translate(C, C); ctx.rotate(fa + Math.PI / 2);
    ctx.fillStyle = '#ffd90f'; ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, 7); ctx.lineTo(0, 3); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.restore();

    // compass ring: N / E / S / W turn with the map (north = towards the hospital)
    ctx.save();
    for (const [label, ang] of [['N', -Math.PI / 2], ['E', 0], ['S', Math.PI / 2], ['W', Math.PI]]) {
      const a = ang + th;
      const x = C + Math.cos(a) * (C - 9), y = C + Math.sin(a) * (C - 9);
      ctx.fillStyle = label === 'N' ? '#e0323a' : 'rgba(27,27,27,0.85)';
      ctx.beginPath(); ctx.arc(x, y, label === 'N' ? 9 : 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 ${label === 'N' ? 11 : 9}px "Fredoka", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y + 0.5);
    }
    ctx.restore();
    return wpDist;
  }

  icon(x, y, emoji, px, faded = false) {
    const ctx = this.ctx;
    ctx.globalAlpha = faded ? 0.85 : 1;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.arc(x, y, px * 0.72, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = `${px}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, y + 1);
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ */
/* Full-screen map                                                      */
/* ------------------------------------------------------------------ */
const BOUNDS = { x0: -95, x1: 245, z0: -78, z1: 140 };

export class BigMap {
  constructor(radar, getState) {
    this.radar = radar;
    this.getState = getState; // () => { player, missions, ambulance }
    this.el = $('bigmap');
    this.canvas = $('bigmap-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.open = false;
    $('bigmap-close').addEventListener('click', (e) => { e.stopPropagation(); this.toggle(false); });
    $('minimap').addEventListener('click', () => this.toggle(true));
    this.canvas.addEventListener('pointerdown', (e) => this.click(e));
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyM' && !e.repeat && this.enabled?.()) this.toggle();
      if (e.code === 'Escape' && this.open) this.toggle(false);
    });
    addEventListener('resize', () => this.open && this.draw());
  }

  toggle(v = !this.open) {
    this.open = v;
    this.el.classList.toggle('hidden', !v);
    if (v) this.draw();
  }

  layout() {
    const dpr = Math.min(devicePixelRatio, 2);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = w * dpr; this.canvas.height = h * dpr;
    const s = Math.min(w / (BOUNDS.x1 - BOUNDS.x0), h / (BOUNDS.z1 - BOUNDS.z0));
    const ox = (w - (BOUNDS.x1 - BOUNDS.x0) * s) / 2, oz = (h - (BOUNDS.z1 - BOUNDS.z0) * s) / 2;
    this.view = { dpr, s, ox, oz };
    return this.view;
  }

  toScreen(x, z) { const v = this.view; return [v.ox + (x - BOUNDS.x0) * v.s, v.oz + (z - BOUNDS.z0) * v.s]; }
  toWorld(px, py) { const v = this.view; return { x: BOUNDS.x0 + (px - v.ox) / v.s, z: BOUNDS.z0 + (py - v.oz) / v.s }; }

  draw() {
    const { player, missions, ambulance } = this.getState();
    const { dpr, s } = this.layout();
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#58ad3f';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    paintWorld(ctx, (x, z) => this.toScreen(x, z), s, { labels: true });
    const inside = isInterior(player.pos.z);
    const pin = (x, z, color, label) => {
      const [a, b] = this.toScreen(x, z);
      ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(a, b - 9, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(a - 5, b - 4); ctx.lineTo(a, b + 2); ctx.lineTo(a + 5, b - 4); ctx.fill();
      if (label) {
        ctx.font = '700 12px "Fredoka", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,30,40,0.85)'; ctx.strokeText(label, a, b - 19);
        ctx.fillStyle = '#fff'; ctx.fillText(label, a, b - 19);
      }
    };
    // ambulance
    if (ambulance && !ambulance.driving) {
      const [a, b] = this.toScreen(ambulance.pos.x, ambulance.pos.z);
      this.badge(a, b, '🚑');
    }
    // emergencies + drop-off
    this.hits = [];
    for (const m of missions.missions) {
      if (m.state === 'done' || m.state === 'carried' || !m.found) continue;
      const k = m.kid.root.position;
      const bp = Radar.blipPos(k.x, k.z, false);
      pin(bp.x, bp.z, '#e0323a', m.def.title);
      this.hits.push({ x: bp.x, z: bp.z, mission: m });
    }
    const carried = missions.missions.find((m) => m.state === 'carried');
    if (carried) { const t = missions.dropPos(carried.def); pin(t.x, t.z, '#4cc35a', 'Drop-off'); }
    // waypoint
    const wp = this.radar.waypointPos();
    if (wp) {
      const bp = Radar.blipPos(wp.x, wp.z, false);
      const [a, b] = this.toScreen(bp.x, bp.z);
      ctx.save(); ctx.translate(a, b); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 2.5;
      ctx.fillRect(-8, -8, 16, 16); ctx.strokeRect(-8, -8, 16, 16);
      ctx.restore();
      const [pa, pb] = this.toScreen(...Object.values(Radar.blipPos(player.pos.x, player.pos.z, false)));
      ctx.setLineDash([6, 5]); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(pa, pb); ctx.lineTo(a, b); ctx.stroke(); ctx.setLineDash([]);
    }
    // you
    const me = Radar.blipPos(player.pos.x, player.pos.z, false);
    const [a, b] = this.toScreen(me.x, me.z);
    ctx.save(); ctx.translate(a, b); ctx.rotate(Math.PI - player.facing);
    ctx.fillStyle = '#ffd90f'; ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(9, 9); ctx.lineTo(0, 4); ctx.lineTo(-9, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    $('bigmap-where').textContent = inside ? '📍 You are inside Wolfson Medical Center' : '';
  }

  badge(x, y, emoji) {
    const ctx = this.ctx;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = '15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, y + 1);
  }

  /** Tap an emergency to route to it, tap anywhere else to drop a waypoint, tap the waypoint to clear it. */
  click(e) {
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const w = this.toWorld(px, py);
    const near = (x, z) => { const [a, b] = this.toScreen(x, z); return Math.hypot(a - px, b - py + 9) < 18; };
    const wp = this.radar.waypointPos();
    if (wp && near(...Object.values(Radar.blipPos(wp.x, wp.z, false)))) { this.radar.waypoint = null; this.draw(); return; }
    const hit = this.hits?.find((h) => near(h.x, h.z));
    if (hit) this.radar.waypoint = { mission: hit.mission, label: hit.mission.def.title };
    else {
      const p = { x: w.x, z: w.z };
      clampWalkable(p);
      this.radar.waypoint = { x: p.x, z: p.z, label: 'Waypoint' };
    }
    this.draw();
  }
}
