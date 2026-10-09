// DOM HUD: stats, mission list, prompt, toasts, minimap.
import { WORLD } from './world.js';

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
    el.innerHTML = document.body.classList.contains('touch') ? `✋ ${label}` : `<kbd>E</kbd> ${label}`;
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

  update(ms, player) {
    $('lollipops').textContent = ms.lollipops;
    $('rescued').textContent = ms.rescued;
    $('total').textContent = ms.total;
    $('stamina-fill').style.width = `${player.stamina * 100}%`;

    const rows = ms.missions.filter((m) => m.state !== 'done' || ms.time - (m.doneAt ?? (m.doneAt = ms.time)) < 4);
    const html = rows.map((m) => {
      const step = {
        active: m.found ? m.def.blurb : 'Someone is missing… search the northwest woods.',
        jumping: 'Catch!',
        treated: `Pick up ${m.def.name}.`,
        lifting: `Lifting ${m.def.name}…`,
        carried: m.def.deliver === 'mom' ? 'Bring Noa to Mom at the lollipop stand.' : 'Carry to the hospital drop-off.',
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

  drawMap(ms, player) {
    const ctx = this.mapCtx;
    const S = 180, half = WORLD.half + 2;
    const sc = S / (half * 2);
    const tx = (x) => (x + half) * sc;
    const tz = (z) => (z + half) * sc;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#6cc24a';
    ctx.fillRect(0, 0, S, S);
    // paths
    ctx.strokeStyle = '#e6c88f';
    ctx.lineWidth = 4 * sc * 1.2;
    ctx.beginPath(); ctx.arc(tx(0), tz(0), 23 * sc, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#e6c88f';
    ctx.fillRect(tx(-2.5), tz(-42), 5 * sc, 20 * sc);
    // pond
    ctx.fillStyle = '#3fa9f5';
    ctx.beginPath(); ctx.arc(tx(WORLD.pond.x), tz(WORLD.pond.z), WORLD.pond.r * sc, 0, Math.PI * 2); ctx.fill();
    // hospital
    ctx.fillStyle = '#efe3cf';
    ctx.fillRect(tx(-17), tz(-57), 34 * sc, 10 * sc);
    ctx.fillStyle = '#e0323a';
    ctx.fillRect(tx(-1.5), tz(-53), 3 * sc, 2 * sc * 1.2);
    // playground
    ctx.fillStyle = '#e0323a';
    ctx.fillRect(tx(WORLD.tower.x - 1.5), tz(WORLD.tower.z - 1.5), 3 * sc, 3 * sc);
    ctx.fillStyle = '#2457c5';
    ctx.fillRect(tx(WORLD.swings.x - 3.5), tz(WORLD.swings.z - 0.3), 7 * sc, 0.8 * sc + 1);
    // stand
    ctx.fillStyle = '#9a6234';
    ctx.fillRect(tx(WORLD.stand.x - 0.7), tz(WORLD.stand.z - 1.5), 1.4 * sc + 1, 3 * sc);

    const pulse = 1 + Math.sin(ms.time * 6) * 0.25;
    for (const m of ms.missions) {
      if (m.state === 'done' || m.state === 'carried') continue;
      const [x, z] = m.def.at;
      if (!m.found) {
        ctx.strokeStyle = '#e0323a';
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tx(x + 4), tz(z - 4), 12 * sc, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      ctx.fillStyle = '#e0323a';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tx(x), tz(z), 5 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    const carried = ms.missions.find((m) => m.state === 'carried');
    if (carried) {
      const t = carried.def.deliver === 'mom' ? ms.mom.root.position : WORLD.hospitalDoor;
      ctx.fillStyle = '#4cc35a';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tx(t.x), tz(t.z), 6 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // player arrow
    ctx.save();
    ctx.translate(tx(player.pos.x), tz(player.pos.z));
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
