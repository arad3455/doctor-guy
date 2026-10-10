// DOM HUD: stats, mission list, prompt, toasts, minimap.
import { locationName } from './world.js';
import { DROPS } from './missions.js';
import { Radar } from './map.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.toastTimer = null;
    this.lastPrompt = undefined;
    this.radar = new Radar($('minimap'));
    this.lastLocation = null;
    this.locTimer = null;
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

  update(ms, player, ambulance, yaw = 0) {
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
    const wpDist = this.radar.draw({ player, yaw, missions: ms, ambulance, plan: this.plan, time: ms.time });
    const wp = this.radar.waypoint;
    const info = $('waypoint-info');
    if (wp && wpDist !== null) {
      if (wpDist < 4 && !wp.mission) { this.radar.waypoint = null; this.toast('⭐ You’ve reached your waypoint', 1400); }
      info.textContent = `⭐ ${wp.label} · ${Math.round(wpDist)} m`;
      info.classList.remove('hidden');
    } else info.classList.add('hidden');
    // GTA-style location name when you move into a new area
    const loc = locationName(player.pos);
    if (loc !== this.lastLocation) {
      this.lastLocation = loc;
      const el = $('location');
      el.textContent = loc;
      el.classList.remove('fade');
      void el.offsetWidth;
      el.classList.add('show');
      clearTimeout(this.locTimer);
      this.locTimer = setTimeout(() => el.classList.add('fade'), 3500);
    }
  }

}
