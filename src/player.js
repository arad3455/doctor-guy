// Third-person controller: WASD relative to camera, run with stamina, jump, collisions.
import * as THREE from 'three';
import { buildDoctor, animateRig } from './characters.js';
import { getColliders, collidersNear, groundHeight, inWater, clampWalkable } from './world.js';

const WALK = 4.2;
const RUN = 8.5;
const JUMP = 6.5;
const GRAVITY = 20;
const RADIUS = 0.45;

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered this frame
    this.yaw = Math.PI; // camera behind the player looking north
    this.pitch = 0.35;
    this.distance = 8;
    this.dragging = false;
    this.enabled = true;

    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    // Look around: drag with mouse or finger; pinch with two fingers to zoom
    const drags = new Map(); // pointerId → last position
    let pinch = 0;
    canvas.addEventListener('pointerdown', (e) => {
      drags.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
    });
    const release = (e) => { drags.delete(e.pointerId); pinch = 0; this.lastLook = performance.now(); };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointermove', (e) => {
      const d = drags.get(e.pointerId);
      if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      if (drags.size === 2) {
        const [p1, p2] = [...drags.values()];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (pinch) this.distance = THREE.MathUtils.clamp(this.distance - (dist - pinch) * 0.03, 4, 16);
        pinch = dist;
        return;
      }
      this.lastLook = performance.now(); // the driving camera waits a moment before swinging back behind
      const k = e.pointerType === 'touch' ? 0.009 : 0.005;
      this.yaw -= dx * k;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * k * 0.8, 0.05, 1.2);
    });
    canvas.addEventListener('wheel', (e) => {
      this.distance = THREE.MathUtils.clamp(this.distance + e.deltaY * 0.01, 4, 16);
    }, { passive: true });

    this.stick = { x: 0, y: 0 };
    this.drive = { steer: 0, throttle: 0 }; // touch driving: wheel −1..1 (right +), lever −1..1 (up = gas)
    this.bindTouchControls();
  }

  /** On-screen joystick + buttons (only visible on touch devices). */
  bindTouchControls() {
    const stick = document.getElementById('stick');
    const knob = document.getElementById('stick-knob');
    if (stick) {
      let id = null;
      const update = (e) => {
        const r = stick.getBoundingClientRect();
        const radius = r.width / 2;
        let x = (e.clientX - (r.left + radius)) / radius;
        let y = (e.clientY - (r.top + radius)) / radius;
        const m = Math.hypot(x, y);
        if (m > 1) { x /= m; y /= m; }
        this.stick.x = x;
        this.stick.y = y;
        knob.style.transform = `translate(${x * radius * 0.75}px, ${y * radius * 0.75}px)`;
      };
      stick.addEventListener('pointerdown', (e) => { id = e.pointerId; stick.setPointerCapture(id); update(e); });
      stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) update(e); });
      const end = (e) => {
        if (e.pointerId !== id) return;
        id = null;
        this.stick.x = this.stick.y = 0;
        knob.style.transform = '';
      };
      stick.addEventListener('pointerup', end);
      stick.addEventListener('pointercancel', end);
    }
    // steering wheel: drag sideways from wherever you touch it (no jump on touch-down); springs back to centre
    const wheel = document.getElementById('wheel');
    const wknob = document.getElementById('wheel-knob');
    if (wheel) {
      let id = null, x0 = 0;
      const set = (v) => {
        this.drive.steer = v;
        const range = wheel.clientWidth / 2 - wknob.clientWidth / 2;
        wknob.style.transform = `translateX(${v * range}px) rotate(${v * 100}deg)`;
      };
      wheel.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        id = e.pointerId; wheel.setPointerCapture(id);
        // touching the knob grabs it where it is; touching the track off to one side steers that way straight away
        const r = wknob.getBoundingClientRect();
        const range = wheel.clientWidth / 2 - wknob.clientWidth / 2, wr = wheel.getBoundingClientRect();
        x0 = e.clientX >= r.left && e.clientX <= r.right ? e.clientX - this.drive.steer * range : wr.left + wr.width / 2;
        wheel.classList.add('on');
        move(e);
      });
      const move = (e) => {
        if (e.pointerId !== id) return;
        const range = Math.max(40, wheel.clientWidth / 2 - wknob.clientWidth / 2);
        set(Math.max(-1, Math.min(1, (e.clientX - x0) / range)));
      };
      wheel.addEventListener('pointermove', move);
      const end = (e) => { if (e.pointerId !== id) return; id = null; wheel.classList.remove('on'); set(0); };
      wheel.addEventListener('pointerup', end);
      wheel.addEventListener('pointercancel', end);
    }
    // gas lever, like a real throttle slider: it rests low, just above reverse — push it up the long way for gas,
    // pull it down the short way to brake and then reverse. It springs back to rest when you let go.
    const lever = document.getElementById('throttle');
    const lknob = document.getElementById('throttle-knob');
    const fill = lever?.querySelector('.th-fill');
    if (lever) {
      const REST = 0.22; // how far up from the bottom of the travel the knob rests (0 = reverse end, 1 = full gas)
      let id = null, grab = 0;
      // the knob's travel, in px down from the top of the lever element (knob centre)
      const travel = () => {
        const tr = lever.querySelector('.th-track'), half = lknob.offsetHeight / 2;
        const top = tr.offsetTop + half - 4, bottom = tr.offsetTop + tr.offsetHeight - half + 4;
        return { top, bottom, rest: bottom - (bottom - top) * REST };
      };
      const yOf = (v) => { const t = travel(); return v >= 0 ? t.rest - v * (t.rest - t.top) : t.rest - v * (t.bottom - t.rest); };
      const set = (v) => {
        this.drive.throttle = v;
        const t = travel(), y = yOf(v);
        lknob.style.top = `${y}px`;
        // the fill runs from the rest mark to the knob: green for gas, red for brake / reverse
        const tr = lever.querySelector('.th-track');
        fill.style.top = `${Math.min(y, t.rest) - tr.offsetTop}px`;
        fill.style.height = `${Math.abs(y - t.rest)}px`;
        lever.classList.toggle('rev', v < -0.05);
      };
      const vOf = (y) => { const t = travel(); return y <= t.rest ? Math.min(1, (t.rest - y) / (t.rest - t.top)) : -Math.min(1, (y - t.rest) / (t.bottom - t.rest)); };
      const localY = (e) => e.clientY - lever.getBoundingClientRect().top;
      const move = (e) => { if (e.pointerId === id) set(vOf(localY(e) - grab)); };
      lever.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        id = e.pointerId; lever.setPointerCapture(id);
        // grab the knob where you touched it, or touch anywhere on the track to jump the knob there
        const r = lknob.getBoundingClientRect();
        grab = e.clientY >= r.top && e.clientY <= r.bottom ? e.clientY - (r.top + r.height / 2) : 0;
        lever.classList.add('on');
        move(e);
      });
      lever.addEventListener('pointermove', move);
      const end = (e) => { if (e.pointerId !== id) return; id = null; lever.classList.remove('on'); set(0); };
      lever.addEventListener('pointerup', end);
      lever.addEventListener('pointercancel', end);
      // place the knob at rest once it's on screen (and again if the screen turns)
      const place = () => { if (lever.offsetHeight) set(this.drive.throttle); };
      new ResizeObserver(place).observe(lever);
      this.placeLever = place;
    }
    for (const [elId, code] of [['btn-jump', 'Space'], ['btn-action', 'KeyE']]) {
      const btn = document.getElementById(elId);
      if (!btn) continue;
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.pressed.add(code); this.keys.add(code); });
      const up = () => this.keys.delete(code);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
    }
  }

  down(...codes) { return this.enabled && codes.some((c) => this.keys.has(c)); }
  hit(code) { return this.enabled && this.pressed.has(code); }
  endFrame() { this.pressed.clear(); }
}

export class Player {
  constructor(scene) {
    this.rig = buildDoctor();
    scene.add(this.rig.root);
    this.pos = new THREE.Vector3(0, 0, -30);
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.onGround = true;
    this.stamina = 1;
    this.carrying = null; // kid rig being carried
    this.frozen = false;
    this.anim = 'idle';
  }

  /** Swap in a different rig (e.g. the generated 3D model once it has loaded). */
  setRig(rig) {
    const scene = this.rig.root.parent;
    scene.remove(this.rig.root);
    this.rig = rig;
    scene.add(rig.root);
  }

  reset() {
    this.pos.set(0, 0, -30);
    this.vel.set(0, 0, 0);
    this.facing = 0;
    this.stamina = 1;
    this.tired = false;
    this.carrying = null;
    this.frozen = false;
  }

  update(dt, t, input) {
    const fwd = new THREE.Vector3(-Math.sin(input.yaw), 0, -Math.cos(input.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = new THREE.Vector3();
    if (!this.frozen) {
      if (input.down('KeyW', 'ArrowUp')) move.add(fwd);
      if (input.down('KeyS', 'ArrowDown')) move.sub(fwd);
      if (input.down('KeyD', 'ArrowRight')) move.add(right);
      if (input.down('KeyA', 'ArrowLeft')) move.sub(right);
    }
    const stick = input.stick;
    const stickMag = stick ? Math.min(1, Math.hypot(stick.x, stick.y)) : 0;
    if (!this.frozen && stickMag > 0.15) move.addScaledVector(fwd, -stick.y).addScaledVector(right, stick.x);
    const moving = move.lengthSq() > 0;
    if (moving) move.normalize();

    const wet = inWater(this.pos.x, this.pos.z) && this.pos.y < 0.3;
    // Out of breath: no running until stamina has refilled a bit (stops run/walk flickering at 0)
    if (this.stamina <= 0) this.tired = true;
    else if (this.stamina >= 0.35) this.tired = false;
    const wantsRun = (input.down('ShiftLeft', 'ShiftRight') || stickMag > 0.9) && moving && !this.tired;
    let speed = wantsRun ? RUN : WALK;
    if (this.carrying) speed *= 0.85;
    if (wet) speed *= 0.55;
    this.stamina = THREE.MathUtils.clamp(this.stamina + (wantsRun ? -0.15 : 0.2) * dt, 0, 1);

    const k = Math.min(1, dt * (this.onGround ? 12 : 4));
    this.vel.x += (move.x * speed - this.vel.x) * k;
    this.vel.z += (move.z * speed - this.vel.z) * k;

    if (moving) {
      const target = Math.atan2(move.x, move.z);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 12);
    }

    if (this.onGround && !this.frozen && input.hit('Space')) {
      this.vel.y = this.carrying ? JUMP * 0.75 : JUMP;
      this.onGround = false;
    }
    this.vel.y -= GRAVITY * dt;

    this.pos.addScaledVector(this.vel, dt);
    this.collide();

    const floor = groundHeight(this.pos.x, this.pos.z);
    if (this.pos.y <= floor) {
      this.pos.y = floor;
      this.vel.y = 0;
      this.onGround = true;
    } else if (this.pos.y > floor + 0.05) {
      this.onGround = false;
    }

    // Visuals
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    let anim = 'idle';
    if (!this.onGround) anim = 'air';
    // separate thresholds into/out of running so speed hovering near one value can't flicker the animation
    else if (hspeed > (this.anim === 'run' ? 5.5 : 6.5)) anim = 'run';
    else if (hspeed > 0.5) anim = 'walk';
    if (this.carrying) anim = anim === 'idle' ? 'carrying' : anim === 'air' ? 'carrying' : 'carrying-walk';
    this.anim = anim;
    animateRig(this.rig, anim, t, dt, hspeed);
    this.rig.root.position.copy(this.pos);
    if (wet) this.rig.root.position.y -= 0.35;
    this.rig.root.rotation.y = this.facing;
  }

  collide() {
    const p = this.pos;
    for (const c of collidersNear(p.x, p.z, 2)) {
      if (c.type === 'circle') {
        const dx = p.x - c.x, dz = p.z - c.z;
        const d = Math.hypot(dx, dz);
        const min = c.r + RADIUS;
        if (d < min && d > 1e-5) {
          p.x = c.x + (dx / d) * min;
          p.z = c.z + (dz / d) * min;
        }
      } else {
        // skip boxes we're standing on top of
        if (p.y > 1.5 && c.maxX - c.minX < 4 && c.maxZ - c.minZ < 4) continue;
        const cx = THREE.MathUtils.clamp(p.x, c.minX, c.maxX);
        const cz = THREE.MathUtils.clamp(p.z, c.minZ, c.maxZ);
        const dx = p.x - cx, dz = p.z - cz;
        const d = Math.hypot(dx, dz);
        if (d < RADIUS) {
          if (d > 1e-5) {
            p.x = cx + (dx / d) * RADIUS;
            p.z = cz + (dz / d) * RADIUS;
          } else {
            // inside: push out along shallowest axis
            const pushes = [
              [c.minX - RADIUS - p.x, 0], [c.maxX + RADIUS - p.x, 0],
              [0, c.minZ - RADIUS - p.z], [0, c.maxZ + RADIUS - p.z],
            ].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
            p.x += pushes[0][0];
            p.z += pushes[0][1];
          }
        }
      }
    }
    clampWalkable(p);
  }
}

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 1.8, 4);
    this.shake = 0;
    this.blockers = []; // big solid meshes (buildings) the camera must never end up inside
    this.ray = new THREE.Raycaster();
    this.dist = null; // current (possibly pulled-in) distance
  }
  update(dt, player, input) {
    const goal = player.pos.clone().add(new THREE.Vector3(0, 1.8, 0));
    this.target.lerp(goal, Math.min(1, dt * 10));
    const dir = new THREE.Vector3(
      Math.sin(input.yaw) * Math.cos(input.pitch),
      Math.sin(input.pitch),
      Math.cos(input.yaw) * Math.cos(input.pitch),
    );
    // Pull the camera in front of any building between it and the player (snap in, ease back out)
    let d = input.distance;
    if (this.blockers.length) {
      this.ray.set(this.target, dir);
      this.ray.far = d;
      const hit = this.ray.intersectObjects(this.blockers, false)[0];
      if (hit) d = Math.max(2.5, hit.distance - 0.6);
    }
    this.dist = this.dist === null || d < this.dist ? d : this.dist + (d - this.dist) * Math.min(1, dt * 3);
    this.camera.position.copy(this.target).addScaledVector(dir, this.dist);
    if (this.camera.position.y < 0.5) this.camera.position.y = 0.5;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.4;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.4;
    }
    this.camera.lookAt(this.target);
  }
}
