// Third-person controller: WASD relative to camera, run with stamina, jump, collisions.
import * as THREE from 'three';
import { buildDoctor, animateRig } from './characters.js';
import { getColliders, groundHeight, inPond, WORLD } from './world.js';

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
    const release = (e) => { drags.delete(e.pointerId); pinch = 0; };
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
      const k = e.pointerType === 'touch' ? 0.009 : 0.005;
      this.yaw -= dx * k;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * k * 0.8, 0.05, 1.2);
    });
    canvas.addEventListener('wheel', (e) => {
      this.distance = THREE.MathUtils.clamp(this.distance + e.deltaY * 0.01, 4, 16);
    }, { passive: true });

    this.stick = { x: 0, y: 0 };
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

    const wet = inPond(this.pos.x, this.pos.z) && this.pos.y < 0.3;
    const wantsRun = (input.down('ShiftLeft', 'ShiftRight') || stickMag > 0.9) && moving && this.stamina > 0.02;
    let speed = wantsRun ? RUN : WALK;
    if (this.carrying) speed *= 0.85;
    if (wet) speed *= 0.55;
    this.stamina = THREE.MathUtils.clamp(this.stamina + (wantsRun ? -0.22 : 0.18) * dt, 0, 1);

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
    else if (hspeed > 6) anim = 'run';
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
    for (const c of getColliders()) {
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
    const H = WORLD.half - 0.5;
    p.x = THREE.MathUtils.clamp(p.x, -H, H);
    p.z = THREE.MathUtils.clamp(p.z, -H, H);
  }
}

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3();
    this.shake = 0;
  }
  update(dt, player, input) {
    const goal = player.pos.clone().add(new THREE.Vector3(0, 1.8, 0));
    this.target.lerp(goal, Math.min(1, dt * 10));
    const d = input.distance;
    const off = new THREE.Vector3(
      Math.sin(input.yaw) * Math.cos(input.pitch) * d,
      Math.sin(input.pitch) * d,
      Math.cos(input.yaw) * Math.cos(input.pitch) * d,
    );
    this.camera.position.copy(this.target).add(off);
    if (this.camera.position.y < 0.5) this.camera.position.y = 0.5;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.4;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.4;
    }
    this.camera.lookAt(this.target);
  }
}
