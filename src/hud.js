// DOM HUD: stats, mission list, prompt, toasts, minimap.
import { locationName } from './world.js';
import { DROPS } from './missions.js';
import { Radar } from './map.js';
import { icon, iconize, leadIcon } from './icons.js';
import { notify, notices } from './notify.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
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
    const btn = $('btn-action');
    btn?.classList.toggle('ready', !!label);
    // the touch action button shows what it will do (drive, shop, check-up…), a plain hand otherwise
    if (btn && !document.documentElement.classList.contains('driving')) btn.innerHTML = icon((label && leadIcon(label)) || 'cross');
    if (!label) { el.classList.add('hidden'); return; }
    el.innerHTML = document.documentElement.classList.contains('touch') ? iconize(label) : `<kbd>E</kbd> ${iconize(label)}`;
    el.classList.remove('hidden');
  }

  /** Small messages go to the side feed (see notify.js); big moments use headline(). */
  toast(html, ms = 2000) { notify(html, { ms: Math.max(ms, 2200) }); }
  get notices() { return notices; }

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
      const timer = m.state !== 'done' && left > 0 ? `<span class="m-timer">${icon('bolt')}${left}s</span>` : '';
      const cls = m.state === 'done' ? 'done' : m.state === 'carried' ? 'active' : '';
      return `<div class="mission ${cls}"><div class="m-title"><span>${m.def.title}</span>${timer}</div><div class="m-step">${iconize(step)}</div></div>`;
    }).join('');
    if (html !== this.lastMissions) {
      $('missions').innerHTML = html;
      this.lastMissions = html;
    }
    const wpDist = this.radar.draw({ player, yaw, missions: ms, ambulance, plan: this.plan, time: ms.time });
    const wp = this.radar.waypoint;
    const info = $('waypoint-info');
    if (wp && wpDist !== null) {
      if (wpDist < 4 && !wp.mission) { this.radar.waypoint = null; notify('You’ve reached your waypoint', { icon: 'star', tone: 'success', ms: 1800 }); }
      info.innerHTML = `${icon('star')}<span>${wp.label} · ${Math.round(wpDist)} m</span>`;
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
