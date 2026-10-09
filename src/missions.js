// Park emergencies, ambient kids, collectibles and the interaction loop.
import * as THREE from 'three';
import { buildKid, animateRig, makeBubble, makeAlertIcon } from './characters.js';
import { WORLD, getColliders } from './world.js';
import { sfx } from './audio.js';
import { toon, part } from './toon.js';

const DROP = WORLD.hospitalDoor;
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

export const MISSIONS = [
  {
    id: 'knee', name: 'Ido', title: 'Scraped Knee', look: 'redShirt',
    at: [15, 13.2], pose: 'cry', bubble: 'Owwie!', range: 2.4,
    blurb: 'Ido fell off the swing.',
    treatment: { title: 'Patch up Ido', speed: 0.9, zone: 0.22, steps: [{ icon: '🧼', label: 'Clean the scrape' }, { icon: '🩹', label: 'Stick on a bandage' }] },
    deliver: null, reward: 3, bonusTime: 45,
  },
  {
    id: 'tower', name: 'Maya', title: 'Scared at the Top', look: 'pinkHat',
    at: [WORLD.tower.x + 0.4, WORLD.tower.z + 0.4], y: WORLD.tower.top + 0.1, pose: 'cry', bubble: 'Too high!', range: 3.2,
    blurb: 'Maya is stuck on the slide tower. Stand below and catch her!',
    treatment: { title: 'Catch Maya!', speed: 1.5, zone: 0.14, steps: [{ icon: '🫶', label: '"Jump, I got you!"' }, { icon: '🙌', label: 'Catch!' }] },
    deliver: null, reward: 4, bonusTime: 50, special: 'catch',
  },
  {
    id: 'pond', name: 'Yoni', title: 'Splash! Kid in the Pond', look: 'capKid',
    at: [WORLD.pond.x - 1.5, WORLD.pond.z + 1], y: -0.55, pose: 'flail', bubble: 'HELP!', range: 2.4,
    blurb: 'Yoni fell into the pond. Wade in, pull him out, then take him to the hospital.',
    treatment: { title: 'Pond rescue', speed: 1.2, zone: 0.18, steps: [{ icon: '🛟', label: 'Pull him out' }, { icon: '🩺', label: 'Check breathing' }] },
    deliver: 'hospital', reward: 6, bonusTime: 35,
  },
  {
    id: 'bee', name: 'Tamar', title: 'Bee Sting', look: 'ponytail',
    at: [-30, 21], pose: 'cry', bubble: 'A bee!!', range: 2.4,
    blurb: 'Tamar got stung by the flower beds.',
    treatment: { title: 'Bee sting first aid', speed: 1.1, zone: 0.18, steps: [{ icon: '🐝', label: 'Scrape out the stinger' }, { icon: '🧊', label: 'Ice pack' }, { icon: '🍭', label: 'Bravery lollipop' }] },
    deliver: null, reward: 4, bonusTime: 45,
  },
  {
    id: 'arm', name: 'Ariel', title: 'Broken Arm', look: 'glassesKid',
    at: [38, -6], pose: 'sit', bubble: 'My arm...', range: 2.4,
    blurb: 'Ariel fell out of a tree. Splint the arm, then carry him to the hospital.',
    treatment: { title: 'Splint the arm', speed: 1.25, zone: 0.16, steps: [{ icon: '🪵', label: 'Line up the splint' }, { icon: '🩹', label: 'Wrap it' }, { icon: '🎗️', label: 'Make a sling' }] },
    deliver: 'hospital', reward: 6, bonusTime: 60, cast: true,
  },
  {
    id: 'lost', name: 'Noa', title: 'Lost Toddler', look: 'teddyToddler',
    at: [-45, 43], pose: 'cry', bubble: 'Mommy?', range: 2.2, hidden: true,
    blurb: 'Noa wandered off. Search the northwest woods, then bring her to her mom at the lollipop stand.',
    treatment: { title: 'Comfort Noa', speed: 0.8, zone: 0.26, steps: [{ icon: '🧸', label: 'Hug the teddy' }, { icon: '🍭', label: 'Lollipop!' }] },
    deliver: 'mom', reward: 6, bonusTime: 70,
  },
];

const BEACON_MAT = new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.22, depthWrite: false });
const BEACON_GREEN = new THREE.MeshBasicMaterial({ color: 0x4cc35a, transparent: true, opacity: 0.25, depthWrite: false });

function beacon(mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 40, 16, 1, true), mat);
  m.position.y = 20;
  return m;
}

export class MissionSystem {
  constructor(scene, player, ui) {
    this.scene = scene;
    this.player = player;
    this.ui = ui;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.reset();
  }

  reset() {
    this.group.clear();
    this.time = 0;
    this.lollipops = 0;
    this.nextSpawn = 2;
    this.queue = [...MISSIONS];
    this.missions = [];
    this.ambient = [];
    this.leaving = [];
    this.busy = false;
    this.finished = false;

    // Mom waiting at the stand
    this.mom = buildKid('mom');
    this.mom.root.position.set(WORLD.stand.x + 2.2, 0, WORLD.stand.z + 1.5);
    this.mom.root.rotation.y = -0.6;
    this.group.add(this.mom.root);
    this.momBubble = makeBubble('Noa?! 😟', { w: 256 });
    this.momBubble.position.y = 2.6;
    this.momBubble.visible = false;
    this.mom.root.add(this.momBubble);
    getColliders().push({ type: 'circle', x: this.mom.root.position.x, z: this.mom.root.position.z, r: 0.4 });

    this.deliverBeacon = beacon(BEACON_GREEN);
    this.deliverBeacon.visible = false;
    this.group.add(this.deliverBeacon);

    this.spawnAmbient();
    this.spawnLollipops();
  }

  spawnAmbient() {
    // Kids on swings
    const seats = this.ui.swingSeats;
    [['ponytail', 0], ['bandageBoy', 2]].forEach(([look, i]) => {
      const kid = buildKid(look);
      kid.root.position.set(0, kid.seatHeight ? -(3.4 - 0.7) + 0.04 - kid.seatHeight : -(3.4 - 0.7) - 0.05, 0);
      seats[i].pivot.add(kid.root);
      this.ambient.push({ kid, mode: 'swing' });
    });
    // Kids strolling the ring path
    ['gownKid', 'capKid', 'pinkHat', 'redShirt'].forEach((look, i) => {
      const kid = buildKid(look);
      this.group.add(kid.root);
      this.ambient.push({ kid, mode: 'stroll', a: i * 1.6, r: 22.5 + (i % 2), speed: (i % 2 ? -1 : 1) * (0.05 + i * 0.01) });
    });
    // Kid waving by the fountain
    const waver = buildKid('glassesKid');
    waver.root.position.set(4, 0, 2.5);
    waver.root.rotation.y = 0.8;
    this.group.add(waver.root);
    this.ambient.push({ kid: waver, mode: 'wave' });
  }

  spawnLollipops() {
    this.pops = [];
    const colors = [0xe0323a, 0x2f7fc1, 0x4cc35a, 0xc66bd6, 0xffb000];
    let seed = 99;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let n = 0, tries = 0;
    while (n < 30 && tries < 2000) {
      tries++;
      const x = (rnd() * 2 - 1) * 50, z = (rnd() * 2 - 1) * 48;
      if (z < -36) continue;
      if (getColliders().some((c) => c.type === 'circle'
        ? Math.hypot(c.x - x, c.z - z) < c.r + 1
        : x > c.minX - 1 && x < c.maxX + 1 && z > c.minZ - 1 && z < c.maxZ + 1)) continue;
      if (Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z) < WORLD.pond.r) continue;
      const g = new THREE.Group();
      const candy = part(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 20), colors[n % colors.length], { outline: 0.03 });
      candy.rotation.x = Math.PI / 2;
      candy.position.y = 0.55;
      g.add(candy);
      const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 6, 16), toon(0xffffff));
      swirl.position.set(0, 0.55, 0.045);
      g.add(swirl);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), toon(0xffffff));
      stick.position.y = 0.2;
      g.add(stick);
      g.position.set(x, 0.4, z);
      this.group.add(g);
      this.pops.push(g);
      n++;
    }
  }

  spawnMission(def) {
    const kid = buildKid(def.look);
    const [x, z] = def.at;
    kid.root.position.set(x, def.y ?? 0, z);
    kid.root.rotation.y = Math.atan2(this.player.pos.x - x, this.player.pos.z - z);
    this.group.add(kid.root);
    const bubble = makeBubble(def.bubble);
    bubble.position.y = kid.height + 0.9;
    kid.root.add(bubble);
    const icon = makeAlertIcon();
    icon.position.y = kid.height + 1.9;
    kid.root.add(icon);
    const bc = beacon(BEACON_MAT);
    bc.position.set(x, 20, z);
    bc.visible = !def.hidden;
    this.group.add(bc);
    if (def.hidden) { bubble.visible = false; icon.visible = false; }
    const m = { def, kid, bubble, icon, beacon: bc, state: 'active', spawnedAt: this.time, found: !def.hidden };
    if (def.id === 'tower') getColliders(); // kid is on the tower deck, nothing to add
    this.missions.push(m);
    sfx.alert();
    const p = this.player;
    if (!this.busy && !p.carrying && Math.hypot(p.vel.x, p.vel.z) < 0.5) p.rig.playOnce?.('wave', { timeScale: 1.2, maxTime: 2.6 });
    this.ui.toast(`🚨 ${def.title}!`, 2600);
    return m;
  }

  get total() { return MISSIONS.length; }
  get rescued() { return this.missions.filter((m) => m.state === 'done').length; }

  update(dt, t, input) {
    this.time += dt;
    const p = this.player.pos;

    // Spawn schedule: next emergency after a delay, sooner if the player is idle
    const open = this.missions.filter((m) => m.state !== 'done').length;
    if (this.queue.length && (this.time > this.nextSpawn || open === 0)) {
      if (open < 3) {
        this.spawnMission(this.queue.shift());
        this.nextSpawn = this.time + 28;
      }
    }

    // Ambient kids
    for (const a of this.ambient) {
      if (a.mode === 'swing') animateRig(a.kid, 'sit', t, dt);
      else if (a.mode === 'wave') animateRig(a.kid, Math.sin(t * 0.7) > 0.3 ? 'wave' : 'idle', t, dt);
      else if (a.mode === 'stroll') {
        a.a += a.speed * dt;
        const x = Math.cos(a.a) * a.r, z = Math.sin(a.a) * a.r;
        a.kid.root.position.set(x, 0, z);
        a.kid.root.rotation.y = Math.atan2(-Math.sin(a.a) * a.speed, Math.cos(a.a) * a.speed);
        animateRig(a.kid, 'walk', t + a.r, dt);
      }
    }

    // Lollipops
    for (const pop of this.pops) {
      if (!pop.visible) continue;
      pop.rotation.y += dt * 2.5;
      pop.position.y = 0.4 + Math.sin(t * 3 + pop.position.x) * 0.12;
      if (Math.hypot(pop.position.x - p.x, pop.position.z - p.z) < 1.1 && p.y < 1.5) {
        pop.visible = false;
        this.lollipops++;
        sfx.pickup();
      }
    }

    // Missions
    for (const m of this.missions) {
      const kp = m.kid.root.position;
      if (m.state === 'active') {
        animateRig(m.kid, m.kid.generated && m.def.pose === 'sit' ? 'cry' : m.def.pose, t, dt);
        m.kid.tears.visible = m.def.pose === 'cry';
        m.icon.position.y = m.kid.height + 1.9 + Math.sin(t * 4) * 0.12;
        if (m.def.id === 'pond') kp.y = -0.55 + Math.sin(t * 3) * 0.08;
        // face the player
        const target = Math.atan2(p.x - kp.x, p.z - kp.z);
        m.kid.root.rotation.y += (Math.atan2(Math.sin(target - m.kid.root.rotation.y), Math.cos(target - m.kid.root.rotation.y))) * Math.min(1, dt * 3);
        if (!m.found && Math.hypot(kp.x - p.x, kp.z - p.z) < 14) {
          m.found = true;
          m.bubble.visible = m.icon.visible = m.beacon.visible = true;
          this.ui.toast('👂 You hear crying nearby…', 1800);
        }
      } else if (m.state === 'treated' || m.state === 'lifting') {
        animateRig(m.kid, 'idle', t, dt);
      } else if (m.state === 'carried') {
        animateRig(m.kid, 'carried', t, dt);
        if (m.kid.legL) {
          m.kid.legL.rotation.z = -0.55;
          m.kid.legR.rotation.z = 0.55;
        }
      } else if (m.state === 'jumping') {
        m.jumpT += dt / 0.9;
        const k = Math.min(1, m.jumpT);
        kp.lerpVectors(m.jumpFrom, m.jumpTo, k);
        kp.y += Math.sin(k * Math.PI) * 1.6;
        animateRig(m.kid, 'air', t, dt);
        if (k >= 1) this.complete(m);
      } else if (m.state === 'done') {
        animateRig(m.kid, m.celebrate > 0 ? 'cheer' : 'idle', t, dt);
        m.celebrate -= dt;
      }
    }

    // Kids walking into the hospital after hand-off
    for (const l of this.leaving) {
      const kp = l.kid.root.position;
      const dir = new THREE.Vector3(0 - kp.x, 0, -46.5 - kp.z);
      if (dir.length() < 0.3) { l.kid.root.visible = false; continue; }
      dir.normalize();
      kp.addScaledVector(dir, dt * 2.5);
      l.kid.root.rotation.y = Math.atan2(dir.x, dir.z);
      animateRig(l.kid, 'limp', t, dt);
    }

    // Mom
    const lost = this.missions.find((m) => m.def.id === 'lost');
    const momWorried = lost && lost.state !== 'done';
    this.momBubble.visible = !!momWorried;
    animateRig(this.mom, momWorried ? 'wave' : 'idle', t + 1, dt);

    // Delivery beacon
    const carried = this.missions.find((m) => m.state === 'carried');
    this.deliverBeacon.visible = !!carried;
    if (carried) {
      const target = carried.def.deliver === 'mom' ? this.mom.root.position : DROP;
      this.deliverBeacon.position.set(target.x, 20, target.z);
    }

    this.handleInteraction(input);

    if (!this.finished && this.rescued === this.total) {
      this.finished = true;
      setTimeout(() => this.ui.onFinished(), 2500);
    }
  }

  /** Find what E would do right now, show prompt, act on E. */
  handleInteraction(input) {
    if (this.busy) { this.ui.prompt(null); return; }
    const p = this.player.pos;
    let action = null;
    const carried = this.missions.find((m) => m.state === 'carried');

    if (carried) {
      if (carried.def.deliver === 'hospital' && Math.hypot(p.x - DROP.x, p.z - DROP.z) < 3) {
        action = { label: `Hand ${carried.def.name} to the nurses`, run: () => this.deliver(carried) };
      } else if (carried.def.deliver === 'mom' && this.mom.root.position.distanceTo(new THREE.Vector3(p.x, 0, p.z)) < 3) {
        action = { label: `Reunite ${carried.def.name} with Mom`, run: () => this.deliver(carried) };
      }
    } else {
      let best = null, bestD = Infinity;
      for (const m of this.missions) {
        if (m.state !== 'active' && m.state !== 'treated') continue;
        if (!m.found) continue;
        const kp = m.kid.root.position;
        const d = Math.hypot(kp.x - p.x, kp.z - p.z);
        if (d < m.def.range && d < bestD) { best = m; bestD = d; }
      }
      if (best) {
        action = best.state === 'active'
          ? { label: `Help ${best.def.name} — ${best.def.title}`, run: () => this.treat(best) }
          : { label: `Pick up ${best.def.name}`, run: () => this.pickUp(best) };
      }
    }

    this.ui.prompt(action ? action.label : null);
    if (action && input.hit('KeyE')) action.run();
  }

  async treat(m) {
    this.busy = true;
    this.player.frozen = true;
    this.player.vel.set(0, 0, 0);
    const kp = m.kid.root.position;
    this.player.facing = Math.atan2(kp.x - this.player.pos.x, kp.z - this.player.pos.z);
    const rig = this.player.rig;
    const kneels = m.def.special !== 'catch'; // catching from the tower happens standing up
    if (kneels) await sleep(rig.kneel?.() ?? 0);
    const res = await this.ui.minigame.start(m.def.treatment);
    if (kneels) await sleep((rig.standUp?.() ?? 0) * 0.8);
    this.player.frozen = false;
    this.busy = false;
    if (!res) { this.ui.toast('Come back when you’re ready!', 1400); return; }
    m.misses = res.misses;
    m.kid.tears.visible = false;
    m.bubble.visible = false;
    m.icon.visible = false;
    if (m.def.cast) m.kid.cast.visible = true;

    if (m.def.special === 'catch') {
      m.state = 'jumping';
      m.jumpT = 0;
      m.jumpFrom = kp.clone();
      const fwd = new THREE.Vector3(Math.sin(this.player.facing), 0, Math.cos(this.player.facing));
      m.jumpTo = this.player.pos.clone().addScaledVector(fwd, 1.0).setY(0);
      return;
    }
    if (m.def.id === 'pond') {
      // pulled out onto the bank next to the doctor
      kp.set(this.player.pos.x, 0, this.player.pos.z);
    }
    if (m.def.deliver) {
      this.pickUp(m);
      this.ui.toast(m.def.deliver === 'hospital' ? `🏥 Take ${m.def.name} to the hospital!` : `💛 Bring ${m.def.name} to Mom at the lollipop stand!`, 2400);
    } else {
      this.complete(m);
    }
  }

  async pickUp(m) {
    // bend down and lift the kid, then swing them onto the shoulders
    m.state = 'lifting';
    m.beacon.visible = false;
    this.busy = true;
    this.player.frozen = true;
    this.player.vel.set(0, 0, 0);
    const rig = this.player.rig;
    if (rig.playOnce?.('pickup', { timeScale: 2 })) {
      await sleep(Math.min(rig.timeToLowest('pickup', 2), 1.4)); // grab at the bottom of the bend…
      rig.endOnce(); // …and stand straight back up into the carry
    }
    this.player.frozen = false;
    this.busy = false;
    m.state = 'carried';
    this.player.carrying = m.kid;
    this.player.rig.body.add(m.kid.root);
    m.kid.root.position.copy(this.player.rig.carryOffset ?? new THREE.Vector3(0, 1.62, -0.3));
    if (m.kid.seatHeight) m.kid.root.position.y += 0.52 - m.kid.seatHeight; // sit on the shoulders, not in the head
    m.kid.root.rotation.set(0, 0, 0);
    sfx.carry();
  }

  deliver(m) {
    this.player.rig.body.remove(m.kid.root);
    this.group.add(m.kid.root);
    this.player.carrying = null;
    if (m.kid.legL) m.kid.legL.rotation.z = m.kid.legR.rotation.z = 0;
    const fwd = new THREE.Vector3(Math.sin(this.player.facing), 0, Math.cos(this.player.facing));
    m.kid.root.position.copy(this.player.pos).addScaledVector(fwd, 0.9).setY(0);
    if (m.def.deliver === 'hospital') this.leaving.push({ kid: m.kid });
    else {
      m.kid.root.position.copy(this.mom.root.position).add(new THREE.Vector3(0.8, 0, 0.5));
      m.kid.root.rotation.y = this.mom.root.rotation.y;
    }
    this.complete(m);
  }

  complete(m) {
    m.state = 'done';
    if (!this.player.carrying) this.player.rig.playOnce?.('cheer', { timeScale: 1.15, maxTime: 3 });
    m.celebrate = 4;
    m.beacon.visible = false;
    m.kid.tears.visible = false;
    if (m.def.id === 'tower' || m.def.id === 'pond') m.kid.root.position.y = 0;
    const elapsed = this.time - m.spawnedAt;
    let reward = m.def.reward;
    const bonuses = [];
    if (elapsed < m.def.bonusTime) { reward += 2; bonuses.push('⚡ speedy'); }
    if (!m.misses) { reward += 1; bonuses.push('🎯 perfect'); }
    this.lollipops += reward;
    const thanks = makeBubble('Thanks Dr. Guy!', { w: 380, bg: '#fffbe0' });
    thanks.scale.multiplyScalar(1.3);
    thanks.position.y = m.kid.height + 0.9;
    m.kid.root.add(thanks);
    setTimeout(() => m.kid.root.remove(thanks), 3500);
    sfx.success();
    this.ui.toast(`✅ ${m.def.name} is safe! +${reward} 🍭${bonuses.length ? `<br><small>${bonuses.join(' · ')}</small>` : ''}`, 2600);
    this.nextSpawn = Math.min(this.nextSpawn, this.time + 6);
  }
}
