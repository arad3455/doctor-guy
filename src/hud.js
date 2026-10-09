// DOM HUD: stats, mission list, prompt, toasts, minimap.
import { WORLD } from './world.js';
import { BEACH } from './beach.js';
import { DROPS } from './missions.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.toastTimer = null;
    this.lastPrompt = undefined;
    this.mapCtx = $('minimap').getContext('2d');
  }

  show(v) { $('hud').classList.toggle('hidden', !v); }

  prompt(label) {
    if (label === this.lastPrompt) return;
    this.lastPrompt = label;
    const el = $('prompt');
    $('btn-action')?.classList.toggle('ready', !!label);
    if (!label) { el.classList.add('hidden'); return; }
    el.innerHTML = document.documentElement.classList.contains('touch') ? `✋ ${label}` : `<kbd>E</kbd> ${label}`;
    el.classList.remove('hidden');
  }

  toast(html, ms = 2000) {
    const el = $('toast');
    el.innerHTML = html;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  update(ms, player, ambulance) {
    this.ambulance = ambulance;
    $('lollipops').textContent = ms.lollipops;
    $('rescued').textContent = ms.rescued;
    $('total').textContent = ms.total;
    $('stamina-fill').style.width = `${player.stamina * 100}%`;
    $('stamina').classList.toggle('tired', !!player.tired);

    // open emergencies first (carried kid on top), then just-finished ones; at most 5 rows
    const rank = (m) => (m.state === 'carried' ? 0 : m.state === 'done' ? 2 : 1);
    const rows = ms.missions
      .filter((m) => m.state !== 'done' || ms.time - (m.doneAt ?? (m.doneAt = ms.time)) < 4)
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 5);
    const html = rows.map((m) => {
      const step = {
        active: m.found ? m.def.blurb : 'Someone is missing… search the northwest woods.',
        jumping: 'Catch!',
        treated: `Pick up ${m.def.name}.`,
        lifting: `Lifting ${m.def.name}…`,
        carried: (this.ambulance?.driving ? DROPS[m.def.deliver]?.drive : DROPS[m.def.deliver]?.step) ?? '',
        done: 'Rescued!',
      }[m.state];
      const left = Math.ceil(m.def.bonusTime - (ms.time - m.spawnedAt));
      const timer = m.state !== 'done' && left > 0 ? `<span class="m-timer">⚡${left}s</span>` : '';
      const cls = m.state === 'done' ? 'done' : m.state === 'carried' ? 'active' : '';
      return `<div class="mission ${cls}"><div class="m-title"><span>${m.def.title}</span>${timer}</div><div class="m-step">${step}</div></div>`;
    }).join('');
    if (html !== this.lastMissions) {
      $('missions').innerHTML = html;
      this.lastMissions = html;
    }
    this.drawMap(ms, player);
  }

  /** Player-centred minimap (north up) showing ~110 m of the world around Doctor Guy. */
  drawMap(ms, player) {
    const ctx = this.mapCtx;
    const S = 180, RANGE = 55;
    const sc = S / (RANGE * 2);
    const ox = player.pos.x, oz = player.pos.z;
    const tx = (x) => S / 2 + (x - ox) * sc;
    const tz = (z) => S / 2 + (z - oz) * sc;
    const rect = (x0, z0, x1, z1) => ctx.fillRect(tx(x0), tz(z0), (x1 - x0) * sc, (z1 - z0) * sc);
    const dot = (x, z, r) => { ctx.beginPath(); ctx.arc(tx(x), tz(z), r, 0, Math.PI * 2); };
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#6cc24a';
    ctx.fillRect(0, 0, S, S);

    // Beach: sand, wet sand, sea, boardwalk, lifeguard tower, sandcastles
    ctx.fillStyle = '#f2d38a';
    rect(-85, 66, 85, WORLD.shoreline);
    ctx.fillStyle = '#5cc8f2';
    rect(-400, WORLD.shoreline, 400, WORLD.wadeLimit + 4);
    ctx.fillStyle = '#2b8fd8';
    rect(-400, WORLD.wadeLimit + 4, 400, 600);
    ctx.fillStyle = '#a8743f';
    rect(-2.2, 55, 2.2, 84);
    ctx.fillStyle = '#e0323a';
    rect(BEACH.tower.x - 1.5, BEACH.tower.z - 1.5, BEACH.tower.x + 1.5, BEACH.tower.z + 1.5);
    ctx.fillStyle = '#d9ae5c';
    dot(BEACH.castles.x, BEACH.castles.z, 2.5 * sc + 1); ctx.fill();

    // Park: fence outline, paths, pond, hospital, playground, stand
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tx(-57), tz(-57), 114 * sc, 114 * sc);
    ctx.strokeStyle = '#e6c88f';
    ctx.lineWidth = 4 * sc * 1.2;
    dot(0, 0, 23 * sc); ctx.stroke();
    ctx.fillStyle = '#e6c88f';
    rect(-2.5, -42, 2.5, -22);
    rect(-2, 35, 2, 57);
    ctx.fillStyle = '#3fa9f5';
    dot(WORLD.pond.x, WORLD.pond.z, WORLD.pond.r * sc); ctx.fill();
    ctx.fillStyle = '#efe3cf';
    rect(-17, -57, 17, -47);
    ctx.fillStyle = '#e0323a';
    rect(-1.5, -53, 1.5, -50.6);
    rect(WORLD.tower.x - 1.5, WORLD.tower.z - 1.5, WORLD.tower.x + 1.5, WORLD.tower.z + 1.5);
    ctx.fillStyle = '#2457c5';
    rect(WORLD.swings.x - 3.5, WORLD.swings.z - 0.4, WORLD.swings.x + 3.5, WORLD.swings.z + 0.6);
    ctx.fillStyle = '#9a6234';
    rect(WORLD.stand.x - 0.7, WORLD.stand.z - 1.5, WORLD.stand.x + 0.7, WORLD.stand.z + 1.5);

    // Inside the hospital: rooms and walls
    if (this.plan && player.pos.z < -300) {
      ctx.fillStyle = '#3b4a5e';
      ctx.fillRect(0, 0, S, S);
      for (const r of this.plan.rooms) { ctx.fillStyle = r.color; rect(r.x0, r.z0, r.x1, r.z1); }
      ctx.strokeStyle = '#1b1b1b';
      ctx.lineWidth = 2;
      for (const [x1, z1, x2, z2] of this.plan.walls) { ctx.beginPath(); ctx.moveTo(tx(x1), tz(z1)); ctx.lineTo(tx(x2), tz(z2)); ctx.stroke(); }
    }

    // The ambulance (when you're not in it)
    const amb = this.ambulance;
    if (amb && !amb.driving) {
      ctx.save();
      ctx.translate(tx(amb.pos.x), tz(amb.pos.z));
      ctx.rotate(-amb.heading);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e0323a';
      ctx.lineWidth = 2;
      ctx.fillRect(-2.6 * sc - 2, -7 * sc / 2 - 2, 5.2 * sc + 4, 7 * sc + 4);
      ctx.strokeRect(-2.6 * sc - 2, -7 * sc / 2 - 2, 5.2 * sc + 4, 7 * sc + 4);
      ctx.restore();
    }

    // Emergencies (clamped to the rim when off-map, so you always know which way to go)
    const pulse = 1 + Math.sin(ms.time * 6) * 0.25;
    const marker = (x, z, color, r) => {
      let px = tx(x) - S / 2, pz = tz(z) - S / 2;
      const d = Math.hypot(px, pz), max = S / 2 - 8;
      if (d > max) { px *= max / d; pz *= max / d; }
      ctx.fillStyle = color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(S / 2 + px, S / 2 + pz, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    };
    for (const m of ms.missions) {
      if (m.state === 'done' || m.state === 'carried') continue;
      if (!m.found) {
        ctx.strokeStyle = '#e0323a';
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 2;
        const [x, z] = m.def.at;
        dot(x + 4, z - 4, 12 * sc); ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      const kp = m.kid.root.position;
      marker(kp.x, kp.z, '#e0323a', 5 * pulse);
    }
    const carried = ms.missions.find((m) => m.state === 'carried');
    if (carried) {
      const t = ms.dropPos(carried.def);
      marker(t.x, t.z, '#4cc35a', 6 * pulse);
    }
    // player arrow (always centred)
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(-player.facing + Math.PI);
    ctx.fillStyle = '#ffd90f';
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
}
