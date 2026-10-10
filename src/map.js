// GTA-style navigation: a rotating radar (minimap) with compass and blips, a full-screen world map
// (M / tap the radar) where you can set a waypoint, and the shared painter that draws the world.
import { WORLD, clampWalkable, PARK_TREES } from './world.js';
import { BEACH } from './beach.js';
import { ZOO, MAP_DECOR } from './zoo.js';
import { INTERIOR } from './hospital.js';
import { RAMPS } from './stunts.js';
import { FRENZY_TOKEN } from './frenzy.js';

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
 * Paints the outdoor world in an illustrated map style. P(x, z) → [cx, cy] maps world to canvas (it may
 * rotate), s = pixels per world unit. Everything goes through P so the rotating radar and the big map share it.
 */
export function paintWorld(ctx, P, s, { labels = false, upright = (fn, x, y) => fn(x, y), time = 0 } = {}) {
  const path = (pts) => { ctx.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.closePath(); };
  const poly = (pts, fill, stroke, lw = 1) => { path(pts); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } };
  const rect = (x0, z0, x1, z1, fill, stroke, lw) => poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], fill, stroke, lw);
  const circle = (x, z, r, fill, stroke, lw = 1) => {
    const [a, b] = P(x, z);
    ctx.beginPath(); ctx.arc(a, b, Math.max(0.6, r * s), 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  };
  const line = (x0, z0, x1, z1, color, lw, dash) => {
    const [a, b] = P(x0, z0), [c, d] = P(x1, z1);
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
    if (dash) ctx.setLineDash([]);
  };
  const shadow = (fn) => { ctx.save(); ctx.translate(2.5, 3); fn('rgba(15,40,20,0.22)'); ctx.restore(); };
  const text = (x, z, str, px, color = '#fff') => {
    const [a, b] = P(x, z);
    upright((cx, cy) => {
      ctx.font = `700 ${px}px "Fredoka", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, px / 5); ctx.strokeStyle = 'rgba(20,30,40,0.85)';
      ctx.strokeText(str, cx, cy); ctx.fillStyle = color; ctx.fillText(str, cx, cy);
    }, a, b);
  };
  const detail = s > 1.2;
  const { road } = ZOO;

  // ---- sea, surf and the beach
  rect(-400, WORLD.wadeLimit + 4, 400, 600, '#2b86d0');
  rect(-400, WORLD.shoreline, 400, WORLD.wadeLimit + 4, '#56c2f0');
  if (detail) for (let i = 0; i < 4; i++) { const z = WORLD.shoreline + 4 + i * 7; line(-120, z, 120, z, 'rgba(255,255,255,0.35)', Math.max(1, 0.4 * s), [6 * s, 9 * s]); }
  rect(-85, 66, 85, WORLD.shoreline, '#f3d68f');
  rect(-85, WORLD.shoreline - 4, 85, WORLD.shoreline, '#e2bd73');
  line(-85, WORLD.shoreline + 0.4, 85, WORLD.shoreline + 0.4, '#ffffff', Math.max(1.5, 0.8 * s));
  rect(-2.2, 55, 2.2, 84, '#a8743f', '#7a4a26', 1);
  if (detail) for (let z = 56; z < 84; z += 1.2) line(-2.2, z, 2.2, z, 'rgba(90,55,25,0.45)', 0.6);
  rect(BEACH.tower.x - 1.5, BEACH.tower.z - 1.5, BEACH.tower.x + 1.5, BEACH.tower.z + 1.5, '#ffffff', '#e0323a', 2);
  circle(BEACH.castles.x, BEACH.castles.z, 2.5, '#d9ae5c', '#a8823a', 1);
  BEACH.umbrellas.forEach(([x, z], i) => { circle(x, z, 1.9, i % 2 ? '#2f7fc1' : '#e0323a', '#ffffff', 1.5); circle(x, z, 0.5, '#ffffff'); });

  // ---- the park: lawn, paths with edges, pond, playgrounds
  rect(-57, -57, 57, 57, '#72c64f');
  const pathFill = '#ecd3a0', pathEdge = '#c9a86b';
  circle(0, 0, 23, null, pathEdge, 5.2 * s);
  circle(0, 0, 23, null, pathFill, 3.8 * s);
  for (const [x0, z0, x1, z1] of [[-1.6, -18.5, 1.6, -3.5], [-1.6, 3.5, 1.6, 18.5], [-18.5, -1.6, -3.5, 1.6], [3.5, -1.6, 18.5, 1.6], [-2.5, -42, 2.5, -22], [-2, 25, 2, 57]]) rect(x0, z0, x1, z1, pathFill, pathEdge, 1);
  circle(0, 0, 7, pathFill, pathEdge, 1);
  circle(0, 0, 3, '#c9d3dd', '#8f98a2', 1.5);
  circle(0, 0, 2.3, '#5cc8f2');
  circle(WORLD.tower.x, WORLD.tower.z, 7.5, '#dcb27a');
  circle(WORLD.swings.x, WORLD.swings.z, 6.5, '#dcb27a');
  rect(WORLD.tower.x - 1.5, WORLD.tower.z - 1.5, WORLD.tower.x + 1.5, WORLD.tower.z + 1.5, '#e0323a', '#7a1a1a', 1);
  rect(WORLD.tower.x + 1.5, WORLD.tower.z - 0.5, WORLD.tower.x + 6.5, WORLD.tower.z + 0.5, '#e0323a');
  rect(WORLD.swings.x - 3.5, WORLD.swings.z - 0.4, WORLD.swings.x + 3.5, WORLD.swings.z + 0.6, '#2457c5');
  circle(WORLD.pond.x, WORLD.pond.z, WORLD.pond.r + 0.6, '#9aa3ad');
  circle(WORLD.pond.x, WORLD.pond.z, WORLD.pond.r, '#43aef5');
  circle(WORLD.pond.x, WORLD.pond.z, WORLD.pond.r * 0.55, '#2a8fd8');
  rect(WORLD.stand.x - 0.7, WORLD.stand.z - 1.5, WORLD.stand.x + 0.7, WORLD.stand.z + 1.5, '#9a6234');
  rect(-57, -57, 57, 57, null, 'rgba(255,255,255,0.9)', Math.max(1, 0.35 * s));

  // ---- Zoo Road: asphalt, white edges, dashed centre, zebra crossings, car park
  rect(road.x0, road.z - road.width / 2 - 0.5, road.x1, road.z + road.width / 2 + 0.5, '#c9ced4');
  rect(road.x0, road.z - road.width / 2, road.x1, road.z + road.width / 2, '#4a5058');
  line(road.x0, road.z - road.width / 2 + 0.4, road.x1, road.z - road.width / 2 + 0.4, '#ffffff', Math.max(1, 0.25 * s));
  line(road.x0, road.z + road.width / 2 - 0.4, road.x1, road.z + road.width / 2 - 0.4, '#ffffff', Math.max(1, 0.25 * s));
  line(road.x0 + 2, road.z, road.x1, road.z, '#ffd23f', Math.max(1, 0.3 * s), [Math.max(2, 2 * s), Math.max(2, 2 * s)]);
  if (detail) for (const cx of [0, 131]) for (let k = -3; k <= 3; k++) rect(cx - 2.2, road.z + k * 0.9 - 0.3, cx + 2.2, road.z + k * 0.9 + 0.3, '#ffffff');
  rect(115, -53, 133, -42, '#5a6068', '#c9ced4', 1.5);
  if (detail) for (let i = 0; i <= 6; i++) line(115 + i * 3, -50.5, 115 + i * 3, -45.5, '#ffffff', 0.8);
  ['#e0323a', '#ffd23f', null, '#2f7fc1', '#ffffff', '#4cc35a'].forEach((c, i) => { if (c) rect(116.6 + i * 3, -50, 118.4 + i * 3, -46, c, '#1b1b1b', 0.8); });

  // ---- the hospital (with a soft shadow)
  shadow((c) => rect(-17, -57, 17, -47, c));
  rect(-17, -57, 17, -47, '#f4ead8', '#a89a80', 1.5);
  rect(-5, -47, 5, -44.5, '#ffffff', '#c9c0ae', 1);
  rect(-1.5, -53, 1.5, -50.6, '#e0323a');
  rect(-0.5, -54.2, 0.5, -49.4, '#e0323a');
  circle(0, -41, 2, null, '#4cc35a', Math.max(1, 0.5 * s));

  // ---- the zoo
  rect(ZOO.min.x, ZOO.min.z, ZOO.max.x, ZOO.max.z, '#7ccf55', '#3a7a3a', Math.max(1.5, 0.4 * s));
  circle(ZOO.center.x, ZOO.center.z, ZOO.ring, null, pathEdge, 5.2 * s);
  circle(ZOO.center.x, ZOO.center.z, ZOO.ring, null, pathFill, 3.8 * s);
  rect(ZOO.min.x, road.z - 2.25, ZOO.center.x + 2, road.z + 2.25, pathFill);
  rect(ZOO.center.x - 2, road.z, ZOO.center.x + 2, ZOO.center.z - ZOO.ring + 1, pathFill);
  rect(138, -45, 156, -30, '#ddcda9', '#bfae88', 1);
  circle(148, -41.2, 3, '#c9d3dd', '#8f98a2', 1);
  circle(148, -41.2, 2.2, '#5cc8f2');
  for (const [x, c] of [[166, '#4cc35a'], [172, '#e0323a'], [178.5, '#4cc35a']]) rect(x - 1.4, -44, x + 1.4, -41, c, '#1b1b1b', 0.8);
  rect(147.6, -30.8, 150.4, -28.2, '#ff8ac0', '#1b1b1b', 0.8);
  const penIcons = { lion: '🦁', elephant: '🐘', giraffe: '🦒', penguin: '🐧', monkey: '🐒' };
  for (const [name, p] of Object.entries(ZOO.pens)) {
    shadow((c) => circle(p.x, p.z, p.r + 0.4, c));
    circle(p.x, p.z, p.r + 0.3, '#8a5a32');
    circle(p.x, p.z, p.r - 0.2, `#${p.color.toString(16).padStart(6, '0')}`);
    if (name === 'elephant') circle(p.x + 5, p.z + 4, 3.8, '#43aef5');
    if (name === 'penguin') circle(p.x - 1.5, p.z + 1.5, 3.8, '#86d6ff');
    if (name === 'monkey') rect(p.x - 2.7, p.z - 2.7, p.x + 2.7, p.z + 2.7, '#a8743f', '#7a4a26', 1);
    if (s > 1) text(p.x, p.z, penIcons[name], Math.min(28, p.r * s * 0.95));
  }
  rect(ZOO.gate.x - 1, ZOO.gate.z - 5.5, ZOO.gate.x + 1, ZOO.gate.z + 5.5, '#c0541f', '#6b2a0d', 1);

  // ---- trees everywhere, with shadows and a highlight
  const trees = [...PARK_TREES, ...MAP_DECOR.trees];
  if (detail) {
    ctx.fillStyle = 'rgba(15,40,20,0.22)';
    for (const [x, z, r] of trees) { const [a, b] = P(x, z); ctx.beginPath(); ctx.arc(a + 2, b + 2.5, r * s, 0, Math.PI * 2); ctx.fill(); }
  }
  for (const [x, z, r] of trees) {
    const [a, b] = P(x, z);
    ctx.fillStyle = '#2f8a35'; ctx.beginPath(); ctx.arc(a, b, Math.max(1, r * s), 0, Math.PI * 2); ctx.fill();
    if (detail) { ctx.fillStyle = '#4fb447'; ctx.beginPath(); ctx.arc(a - r * s * 0.25, b - r * s * 0.25, r * s * 0.55, 0, Math.PI * 2); ctx.fill(); }
  }

  // stunt ramps: a yellow arrow pointing the way you jump
  for (const r of RAMPS) {
    const f = { x: Math.sin(r.heading), z: Math.cos(r.heading) }, q = { x: f.z, z: -f.x };
    poly([
      [r.x - f.x * r.len / 2 + q.x * r.width / 2, r.z - f.z * r.len / 2 + q.z * r.width / 2],
      [r.x + f.x * r.len / 2, r.z + f.z * r.len / 2],
      [r.x - f.x * r.len / 2 - q.x * r.width / 2, r.z - f.z * r.len / 2 - q.z * r.width / 2],
    ], '#ffd23f', '#1b1b1b', 1.5);
  }

  // the Check-up Frenzy token
  circle(FRENZY_TOKEN.x, FRENZY_TOKEN.z, 1.8, '#ff3c8e', '#ffffff', 1.5);
  if (s > 1) text(FRENZY_TOKEN.x, FRENZY_TOKEN.z, '⚡', Math.min(18, 3 * s));

  if (labels) for (const l of ZONE_LABELS) pill(ctx, P(l.x, l.z), l.text, upright);
}

/** A rounded label like a map sticker. */
function pill(ctx, [x, y], str, upright) {
  upright((cx, cy) => {
    ctx.font = '700 14px "Fredoka", sans-serif';
    const w = ctx.measureText(str).width + 18, h = 24;
    ctx.fillStyle = 'rgba(20, 32, 46, 0.82)';
    ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(str, cx, cy + 1);
  }, x, y);
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
    // drag to pan, pinch / wheel to zoom, tap to set a waypoint
    const pts = new Map();
    let moved = 0, pinch = 0;
    this.canvas.addEventListener('pointerdown', (e) => { this.canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; pinch = 0; });
    this.canvas.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const r = this.canvas.getBoundingClientRect();
        if (pinch) this.zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, d / pinch);
        pinch = d; moved = 99;
        return;
      }
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6 && (this.zoom ?? 1) > 1) {
        this.center = this.center ?? this.toWorld(this.view.w / 2, this.view.h / 2);
        this.center = { x: this.center.x - dx / this.view.s, z: this.center.z - dy / this.view.s };
        this.draw();
      }
    });
    const up = (e) => { if (pts.has(e.pointerId) && pts.size === 1 && moved <= 6) this.click(e); pts.delete(e.pointerId); };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', (e) => pts.delete(e.pointerId));
    this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); const r = this.canvas.getBoundingClientRect(); this.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
    $('bigmap-zin').addEventListener('click', () => this.zoomAt(this.view.w / 2, this.view.h / 2, 1.5));
    $('bigmap-zout').addEventListener('click', () => this.zoomAt(this.view.w / 2, this.view.h / 2, 1 / 1.5));
    $('bigmap-me').addEventListener('click', () => {
      const { player } = this.getState();
      const me = Radar.blipPos(player.pos.x, player.pos.z, false);
      this.zoom = Math.max(this.zoom ?? 1, 2.5); this.center = { x: me.x, z: me.z }; this.draw();
    });
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyM' && !e.repeat && this.enabled?.()) this.toggle();
      if (e.code === 'Escape' && this.open) this.toggle(false);
    });
    addEventListener('resize', () => this.open && this.draw());
  }

  toggle(v = !this.open) {
    this.open = v;
    this.el.classList.toggle('hidden', !v);
    if (v) { this.zoom = 1; this.center = null; this.draw(); }
  }

  /** Fit the world, then apply zoom (1 = whole world) and pan (world-space centre). */
  layout() {
    const dpr = Math.min(devicePixelRatio, 2);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (this.canvas.width !== Math.round(w * dpr)) { this.canvas.width = w * dpr; this.canvas.height = h * dpr; }
    const fit = Math.min(w / (BOUNDS.x1 - BOUNDS.x0), h / (BOUNDS.z1 - BOUNDS.z0));
    const s = fit * (this.zoom ?? 1);
    const c = this.center ?? { x: (BOUNDS.x0 + BOUNDS.x1) / 2, z: (BOUNDS.z0 + BOUNDS.z1) / 2 };
    this.view = { dpr, s, w, h, ox: w / 2 - c.x * s, oz: h / 2 - c.z * s };
    return this.view;
  }

  toScreen(x, z) { const v = this.view; return [v.ox + x * v.s, v.oz + z * v.s]; }
  toWorld(px, py) { const v = this.view; return { x: (px - v.ox) / v.s, z: (py - v.oz) / v.s }; }

  /** Zoom around a screen point (keeps that spot under the finger/cursor). */
  zoomAt(px, py, factor) {
    const before = this.toWorld(px, py);
    this.zoom = Math.min(8, Math.max(1, (this.zoom ?? 1) * factor));
    this.center = this.center ?? this.toWorld(this.view.w / 2, this.view.h / 2);
    this.layout();
    const after = this.toWorld(px, py);
    this.center = { x: this.center.x + before.x - after.x, z: this.center.z + before.z - after.z };
    this.draw();
  }

  draw() {
    const { player, missions, ambulance } = this.getState();
    const { dpr, s } = this.layout();
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#5fb546';
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
    this.decorations();
    $('bigmap-where').textContent = inside ? '📍 You are inside Wolfson Medical Center' : '';
  }

  /** Compass rose and scale bar drawn on top of the map. */
  decorations() {
    const ctx = this.ctx, { w, h, s } = this.view;
    // compass rose (north = towards the hospital)
    const cx = w - 46, cy = 52;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(20,32,46,0.75)'; ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = i === 3 ? '#e0323a' : '#ffffff';
      ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(6, 0); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#ffffff'; ctx.font = '700 12px "Fredoka", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - 40 < 6 ? cy + 40 : cy - 40 + 0);
    // scale bar: a round number of metres
    const pxPerM = s * UNITS_PER_M;
    const metres = [10, 20, 50, 100, 200].find((m) => m * pxPerM > 70) ?? 200;
    const len = metres * pxPerM, x0 = 18, y0 = h - 22;
    ctx.fillStyle = 'rgba(20,32,46,0.75)'; ctx.beginPath(); ctx.roundRect(x0 - 8, y0 - 22, len + 16, 32, 8); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, y0, len, 4); ctx.fillRect(x0, y0 - 5, 2, 9); ctx.fillRect(x0 + len - 2, y0 - 5, 2, 9);
    ctx.textAlign = 'left'; ctx.fillText(`${metres} m`, x0, y0 - 12);
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
