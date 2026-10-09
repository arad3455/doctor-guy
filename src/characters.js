// Procedural Doctor Guy + kids, built from primitives in the yellow-cartoon style.
import * as THREE from 'three';
import { part, toon, canvasTexture, roundRect, FONT } from './toon.js';
export { buildDoctor } from './doctor.js';
import { hasKidModel, buildKid3D } from './kidModels.js';

export const SKIN = 0xffd90f;
const SKIN_DARK = 0xd8a90a; // stubble
const SCRUBS = 0x2f7fc1;
const HAIR_BROWN = 0x8a5527;
const BLACK = 0x161616;
const WHITE = 0xffffff;

const sphere = (r, ws = 20, hs = 14) => new THREE.SphereGeometry(r, ws, hs);
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 14);
const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);

/** A limb that pivots at its top: returns { pivot, ... }. */
function limb(parent, x, y, z, segments) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);
  let yCursor = 0;
  for (const s of segments) {
    const m = part(s.geo, s.color, { outline: s.outline ?? 0.02 });
    m.position.y = yCursor - s.len / 2;
    if (s.z) m.position.z = s.z;
    pivot.add(m);
    yCursor -= s.len;
  }
  return pivot;
}

function eyes(head, { y, z, spread, r }) {
  for (const sx of [-1, 1]) {
    const eye = part(sphere(r), WHITE, { outline: 0.012 });
    eye.position.set(sx * spread, y, z);
    head.add(eye);
    const pupil = part(sphere(r * 0.22, 10, 8), BLACK, { outline: 0 });
    pupil.position.set(sx * spread * 0.92, y, z + r * 0.95);
    head.add(pupil);
  }
}

function badgeTexture() {
  return canvasTexture(128, 160, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    roundRect(ctx, 2, 2, w - 4, h - 4, 12);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#222';
    ctx.stroke();
    ctx.fillStyle = '#1d4f9a';
    ctx.font = `700 28px ${FONT}`;
    ctx.textAlign = 'center';
    ['Not a', 'Real', 'Doctor'].forEach((t, i) => ctx.fillText(t, w / 2, 40 + i * 30));
    ctx.fillStyle = '#e0323a';
    ctx.fillRect(w / 2 - 6, 118, 12, 30);
    ctx.fillRect(w / 2 - 15, 127, 30, 12);
  });
}

/* ------------------------------------------------------------------ */
/* Kids                                                                */
/* ------------------------------------------------------------------ */
export const KID_LOOKS = {
  bandageBoy: { hair: 'curly', hairColor: 0x3a2312, shirt: 0xffffff, pants: 0x2f62b8, bandage: true },
  pinkHat: { hair: 'long', hairColor: 0x4a2a14, shirt: 0xc66bd6, pants: 0xc66bd6, hat: 'sun', dress: true },
  teddyToddler: { hair: 'curly', hairColor: 0xf4cf4a, shirt: 0x9cc8f0, pants: 0x9cc8f0, teddy: true, dress: true, scale: 0.8 },
  capKid: { hair: 'short', hairColor: 0x2a1a0e, shirt: 0xa9cff3, pants: 0x2f62b8, hat: 'cap' },
  glassesKid: { hair: 'curly', hairColor: 0x2a1a0e, shirt: 0x2f8a4a, pants: 0x2f62b8, glasses: true },
  ponytail: { hair: 'ponytail', hairColor: 0x5a3418, shirt: 0xff8ac0, pants: 0x6a8fd6, dress: true },
  redShirt: { hair: 'curly', hairColor: 0x3a2312, shirt: 0xe0453a, pants: 0x2f62b8 },
  gownKid: { hair: 'short', hairColor: 0x3a2312, shirt: 0x8fc0ef, pants: 0x8fc0ef, dress: true },
  mom: { hair: 'long', hairColor: 0x4a2a14, shirt: 0x3fae9a, pants: 0x3fae9a, dress: true, scale: 1.45 },
};

export function buildKid(lookName = 'redShirt') {
  if (hasKidModel(lookName)) return buildKid3D(lookName); // generated 3D kid
  const look = KID_LOOKS[lookName] ?? KID_LOOKS.redShirt;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const s = look.scale ?? 1;
  body.scale.setScalar(s);

  const legSegs = [{ geo: capsule(0.075, 0.3), color: look.dress ? SKIN : look.pants, len: 0.44 }];
  const legL = limb(body, -0.09, 0.52, 0, legSegs);
  const legR = limb(body, 0.09, 0.52, 0, legSegs);
  for (const leg of [legL, legR]) {
    const shoe = part(new THREE.BoxGeometry(0.13, 0.08, 0.2), 0x2645a8, { outline: 0.015 });
    shoe.position.set(0, -0.47, 0.03);
    leg.add(shoe);
  }

  const torso = look.dress
    ? part(cyl(0.15, 0.27, 0.48, 18), look.shirt, { outline: 0.02 })
    : part(capsule(0.18, 0.2), look.shirt, { outline: 0.02 });
  torso.position.y = look.dress ? 0.72 : 0.74;
  body.add(torso);

  const armSegs = [
    { geo: capsule(0.065, 0.08), color: look.shirt, len: 0.15 },
    { geo: capsule(0.05, 0.18), color: SKIN, len: 0.24 },
  ];
  const armL = limb(body, -0.24, 0.92, 0, armSegs);
  const armR = limb(body, 0.24, 0.92, 0, armSegs);
  for (const arm of [armL, armR]) {
    const hand = part(sphere(0.065, 12, 10), SKIN, { outline: 0.012 });
    hand.position.y = -0.44;
    arm.add(hand);
  }
  armL.rotation.z = -0.15;
  armR.rotation.z = 0.15;

  const head = new THREE.Group();
  head.position.y = 0.98;
  body.add(head);
  const skull = part(sphere(0.25, 22, 16), SKIN, { outline: 0.025 });
  skull.position.y = 0.24;
  skull.scale.set(1, 1.05, 0.95);
  head.add(skull);
  const muzzle = part(sphere(0.12, 14, 10), SKIN, { outline: 0.012 });
  muzzle.position.set(0, 0.12, 0.16);
  muzzle.scale.set(1.1, 0.7, 0.8);
  head.add(muzzle);
  const mouth = part(new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0x7a1a1a, { outline: 0 });
  mouth.position.set(0, 0.12, 0.25);
  mouth.scale.set(1.2, 0.9, 0.6);
  head.add(mouth);
  eyes(head, { y: 0.3, z: 0.18, spread: 0.1, r: 0.085 });

  // Hair
  const hairMat = look.hairColor;
  if (look.hair === 'curly') {
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const ring = i % 2 ? 0.22 : 0.15;
      const c = part(sphere(0.1, 10, 8), hairMat, { outline: 0.012 });
      c.position.set(Math.cos(a) * ring, 0.43 + (i % 3) * 0.03, Math.sin(a) * ring - 0.04);
      head.add(c);
    }
    const top = part(sphere(0.2, 14, 10), hairMat, { outline: 0.015 });
    top.position.set(0, 0.42, -0.04);
    top.scale.y = 0.6;
    head.add(top);
  } else if (look.hair === 'long' || look.hair === 'ponytail') {
    const cap = part(new THREE.SphereGeometry(0.265, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat, { outline: 0.015 });
    cap.position.y = 0.25;
    cap.rotation.x = -0.3;
    head.add(cap);
    if (look.hair === 'long') {
      const back = part(capsule(0.2, 0.2), hairMat, { outline: 0.015 });
      back.position.set(0, 0.1, -0.14);
      back.scale.z = 0.6;
      head.add(back);
    } else {
      const tail = part(capsule(0.08, 0.22), hairMat, { outline: 0.015 });
      tail.position.set(0, 0.28, -0.32);
      tail.rotation.x = 0.7;
      head.add(tail);
      const tie = part(sphere(0.045, 8, 6), 0xff4f9a, { outline: 0 });
      tie.position.set(0, 0.38, -0.26);
      head.add(tie);
    }
  } else {
    const cap = part(new THREE.SphereGeometry(0.262, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), hairMat, { outline: 0.015 });
    cap.position.y = 0.26;
    cap.rotation.x = -0.25;
    head.add(cap);
  }

  if (look.bandage) {
    const band = part(new THREE.TorusGeometry(0.245, 0.045, 8, 26), WHITE, { outline: 0.01 });
    band.rotation.x = Math.PI / 2 + 0.15;
    band.position.y = 0.38;
    head.add(band);
  }
  if (look.hat === 'sun') {
    const brim = part(cyl(0.42, 0.42, 0.03, 24), 0xff9fcf, { outline: 0.015 });
    brim.position.y = 0.42;
    brim.rotation.x = -0.12;
    head.add(brim);
    const crown = part(cyl(0.22, 0.26, 0.18, 20), 0xff9fcf, { outline: 0.015 });
    crown.position.y = 0.52;
    head.add(crown);
    const flower = part(sphere(0.06, 8, 6), 0xffffff, { outline: 0.01 });
    flower.position.set(0.18, 0.52, 0.14);
    head.add(flower);
  }
  if (look.hat === 'cap') {
    const dome = part(new THREE.SphereGeometry(0.27, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0x2645a8, { outline: 0.015 });
    dome.position.y = 0.3;
    head.add(dome);
    const visor = part(new THREE.BoxGeometry(0.3, 0.025, 0.22), 0x2645a8, { outline: 0.012 });
    visor.position.set(0, 0.31, 0.3);
    head.add(visor);
  }
  if (look.glasses) {
    for (const sx of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.015, 6, 16), toon(BLACK));
      rim.position.set(sx * 0.1, 0.3, 0.27);
      head.add(rim);
    }
  }
  if (look.teddy) {
    const teddy = new THREE.Group();
    const tb = part(sphere(0.09, 10, 8), 0x7a4a26, { outline: 0.012 });
    teddy.add(tb);
    const th = part(sphere(0.07, 10, 8), 0x7a4a26, { outline: 0.012 });
    th.position.y = 0.12;
    teddy.add(th);
    for (const sx of [-1, 1]) {
      const ear = part(sphere(0.03, 6, 6), 0x7a4a26, { outline: 0.008 });
      ear.position.set(sx * 0.05, 0.18, 0);
      teddy.add(ear);
    }
    teddy.position.set(0.0, 0.72, 0.2);
    body.add(teddy);
  }

  // Tears (shown when distressed)
  const tears = new THREE.Group();
  for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(sphere(0.035, 8, 6), toon(0x6fc6ff));
    t.position.set(sx * 0.17, 0.22, 0.2);
    t.scale.y = 1.6;
    tears.add(t);
  }
  tears.visible = false;
  head.add(tears);

  // Cast / sling (shown for injuries)
  const cast = part(capsule(0.065, 0.16), WHITE, { outline: 0.012 });
  cast.position.y = -0.3;
  cast.visible = false;
  armR.add(cast);

  root.traverse((o) => { if (o.isMesh && o.material?.type !== 'ShaderMaterial') o.castShadow = true; });

  return { root, body, head, legL, legR, armL, armR, tears, cast, height: 1.4 * s, look: lookName };
}

/* ------------------------------------------------------------------ */
/* Animation                                                           */
/* ------------------------------------------------------------------ */
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Pose a rig. state: 'idle' | 'walk' | 'run' | 'air' | 'wave' | 'cry' | 'sit' | 'flail' | 'carried' | 'carrying'
 */
export function animateRig(rig, state, t, dt, speed = 0) {
  if (rig.animate) { rig.animate(state, dt, speed); return; } // generated model: skeletal clips
  if (state === 'cheer') state = 'wave';
  if (state === 'limp') state = 'walk';
  const k = Math.min(1, dt * 12);
  let lL = 0, lR = 0, aL = 0, aR = 0, aLz = -0.12, aRz = 0.12, bob = 0, headTilt = 0, lean = 0;

  if (state === 'walk' || state === 'run' || state === 'carrying-walk') {
    const run = state === 'run';
    const freq = run ? 11 : 7.5;
    const amp = run ? 0.95 : 0.6;
    const p = t * freq;
    lL = Math.sin(p) * amp;
    lR = -Math.sin(p) * amp;
    aL = -Math.sin(p) * amp * 0.9;
    aR = Math.sin(p) * amp * 0.9;
    bob = Math.abs(Math.sin(p)) * (run ? 0.09 : 0.05);
    lean = run ? 0.18 : 0.05;
  } else if (state === 'air') {
    lL = 0.5; lR = -0.3; aL = -2.4; aR = -2.4; aLz = -0.4; aRz = 0.4;
  } else if (state === 'wave' || state === 'flail') {
    const fast = state === 'flail' ? 18 : 9;
    aL = -2.7 + Math.sin(t * fast) * 0.35;
    aR = -2.7 - Math.sin(t * fast) * 0.35;
    aLz = -0.5 + Math.sin(t * fast) * 0.3;
    aRz = 0.5 + Math.sin(t * fast) * 0.3;
    bob = Math.abs(Math.sin(t * fast * 0.5)) * 0.05;
    if (state === 'flail') { lL = Math.sin(t * 14) * 0.5; lR = -lL; }
  } else if (state === 'cry') {
    aL = -1.9; aR = -1.9; aLz = 0.4; aRz = -0.4; // hands to face
    headTilt = 0.25 + Math.sin(t * 6) * 0.06;
    bob = Math.abs(Math.sin(t * 6)) * 0.02;
  } else if (state === 'sit') {
    lL = -1.5; lR = -1.5; bob = -0.42;
    aL = -0.4; aR = -0.4;
  } else if (state === 'carried') {
    lL = -1.3; lR = -1.3; aL = -2.9; aR = -2.9; aLz = -0.3; aRz = 0.3;
    bob = Math.sin(t * 5) * 0.02;
  } else if (state === 'carrying') {
    aL = -2.9; aR = -2.9; aLz = 0.15; aRz = -0.15;
  } else {
    // idle breathing
    bob = Math.sin(t * 2) * 0.015;
    aL = Math.sin(t * 2) * 0.04;
    aR = -aL;
  }
  if (state === 'carrying-walk') {
    aL = -2.9; aR = -2.9; aLz = 0.15; aRz = -0.15;
  }

  rig.legL.rotation.x = lerp(rig.legL.rotation.x, lL, k);
  rig.legR.rotation.x = lerp(rig.legR.rotation.x, lR, k);
  rig.armL.rotation.x = lerp(rig.armL.rotation.x, aL, k);
  rig.armR.rotation.x = lerp(rig.armR.rotation.x, aR, k);
  rig.armL.rotation.z = lerp(rig.armL.rotation.z, aLz, k);
  rig.armR.rotation.z = lerp(rig.armR.rotation.z, aRz, k);
  rig.body.position.y = lerp(rig.body.position.y, bob, k);
  rig.body.rotation.x = lerp(rig.body.rotation.x, lean, k);
  rig.head.rotation.x = lerp(rig.head.rotation.x, headTilt, k);
}

/* ------------------------------------------------------------------ */
/* Floating UI in the world                                            */
/* ------------------------------------------------------------------ */
export function makeBubble(text, { bg = '#ffffff', fg = '#1b1b1b', w = 256, h = 110 } = {}) {
  const tex = canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 6;
    roundRect(ctx, 6, 6, w - 12, h - 34, 22);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 14, h - 31);
    ctx.lineTo(w / 2, h - 6);
    ctx.lineTo(w / 2 + 14, h - 31);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.font = `700 38px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, (h - 28) / 2 + 3);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(1.5, (1.5 * h) / w, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export function makeAlertIcon() {
  const tex = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#e0323a';
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(52, 28, 24, 72);
    ctx.fillRect(28, 52, 72, 24);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(0.8, 0.8, 1);
  s.renderOrder = 11;
  return s;
}
