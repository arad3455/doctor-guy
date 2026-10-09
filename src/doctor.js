// Doctor Guy — modelled after the reference art (~/Downloads/Doctor Guy):
// tall yellow head, huge eyes behind thick black rectangular glasses, brown swept-up quiff,
// stubbly muzzle with a big toothy grin, blue scrubs, stethoscope, blue lanyard + badge.
import * as THREE from 'three';
import { part, toon, canvasTexture, roundRect, FONT } from './toon.js';

const SKIN = 0xffd90f;
const SCRUBS = 0x2f7fc1;
const SCRUBS_DARK = 0x22649e;
const HAIR = 0x8a5527;
const HAIR_LIGHT = 0xa86c34;
const HAIR_DARK = 0x6a3f1c;
const BLACK = 0x161616;

const sphere = (r, ws = 24, hs = 18) => new THREE.SphereGeometry(r, ws, hs);
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 16);

/* ---------------- Head shape ---------------- */

// Head profile (radius, height): broad forehead narrowing to a defined jaw and chin
const HEAD_PROFILE = [[0.0, 0.03], [0.09, 0.04], [0.16, 0.08], [0.205, 0.15], [0.235, 0.25], [0.25, 0.36], [0.252, 0.46], [0.243, 0.56], [0.218, 0.64], [0.17, 0.7], [0.1, 0.725], [0.0, 0.735]];
const HEAD_DEPTH = 0.97; // z squash

function profileRadius(y) {
  if (y <= HEAD_PROFILE[0][1] || y >= HEAD_PROFILE.at(-1)[1]) return 0;
  for (let i = 1; i < HEAD_PROFILE.length; i++) {
    const [r1, y1] = HEAD_PROFILE[i];
    if (y <= y1) {
      const [r0, y0] = HEAD_PROFILE[i - 1];
      return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
    }
  }
  return 0;
}

/** Point where a ray from `origin` along `dir` leaves the head surface. */
function headSurface(origin, dir) {
  const p = new THREE.Vector3();
  for (let t = 0; t < 0.6; t += 0.002) {
    p.copy(origin).addScaledVector(dir, t);
    if (Math.hypot(p.x, p.z / HEAD_DEPTH) >= profileRadius(p.y)) return p;
  }
  return p;
}

/* ---------------- Textures ---------------- */

function stubble(ctx, x0, y0, x1, y1, n, alpha = 0.5) {
  for (let i = 0; i < n; i++) {
    const x = x0 + Math.random() * (x1 - x0);
    const y = y0 + Math.random() * (y1 - y0);
    ctx.fillStyle = `rgba(${110 + Math.random() * 40}, ${70 + Math.random() * 20}, 20, ${alpha * (0.6 + Math.random() * 0.4)})`;
    ctx.fillRect(x, y, 1.6 + Math.random() * 1.6, 1.6 + Math.random() * 1.6);
  }
}

// Lathe UVs: u=0 / u=1 is the front (+z), u=0.25 / 0.75 the sides; v=0 is the chin.
function skullTexture() {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#ffd90f';
    ctx.fillRect(0, 0, w, h);
    // beard stubble along the jaw and chin, fading towards the ears and cheeks
    for (let i = 0; i < 9000; i++) {
      const u = Math.random() - 0.5; // -0.5..0.5, 0 = front
      const v = Math.random() * 0.42;
      const side = Math.abs(u) / 0.25; // 1 at the ears
      if (side > 1.05) continue;
      const fade = Math.min(1, (1.05 - side) * 3) * Math.min(1, (0.42 - v) / 0.1 + side * 0.15);
      if (Math.random() > fade) continue;
      ctx.fillStyle = `rgba(${110 + Math.random() * 40}, ${70 + Math.random() * 20}, 20, ${0.4 + Math.random() * 0.3})`;
      ctx.fillRect(((u + 1) % 1) * w, h - v * h, 1.6 + Math.random() * 1.6, 1.6 + Math.random() * 1.6);
    }
    // short hair painted on the scalp: hairline higher at the forehead, lower at sides/back
    ctx.fillStyle = '#7a4a22';
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const front = Math.max(0, Math.cos(u * Math.PI * 2));
      const v = 0.54 + 0.14 * front ** 2 + Math.sin(x * 0.35) * 0.006;
      ctx.fillRect(x, 0, 1, (1 - v) * h);
    }
    ctx.fillStyle = 'rgba(70, 40, 15, 0.35)';
    for (let i = 0; i < 400; i++) ctx.fillRect(Math.random() * w, Math.random() * h * 0.35, 2, 8 + Math.random() * 10);
    // sideburns just in front of the ears
    ctx.fillStyle = '#7a4a22';
    for (const u of [0.215, 0.755]) {
      roundRect(ctx, u * w, h * 0.36, w * 0.03, h * 0.2, 8);
      ctx.fill();
    }
  });
}

function muzzleTexture() {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#ffd90f';
    ctx.fillRect(0, 0, w, h);
    stubble(ctx, 0, h * 0.25, w, h, 4200, 0.6);
    // Big open grin, centred on the front (u = 0.25)
    const cx = w * 0.25, top = h * 0.53, half = w * 0.085;
    const mouth = new Path2D();
    mouth.moveTo(cx - half, top - h * 0.05);
    mouth.quadraticCurveTo(cx, top + h * 0.02, cx + half, top - h * 0.05);
    mouth.quadraticCurveTo(cx + half * 0.7, top + h * 0.22, cx, top + h * 0.23);
    mouth.quadraticCurveTo(cx - half * 0.7, top + h * 0.22, cx - half, top - h * 0.05);
    ctx.fillStyle = '#5e0f12';
    ctx.fill(mouth);
    ctx.save();
    ctx.clip(mouth);
    ctx.fillStyle = '#ffffff'; // top teeth
    ctx.fillRect(cx - half, top - h * 0.06, half * 2, h * 0.085);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * half * 0.22, top - h * 0.03);
      ctx.lineTo(cx + i * half * 0.22, top + h * 0.025);
      ctx.stroke();
    }
    ctx.fillStyle = '#e0505a'; // tongue
    ctx.beginPath();
    ctx.ellipse(cx, top + h * 0.2, half * 0.5, h * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 6;
    ctx.stroke(mouth);
  });
}

function lanyardTexture() {
  const tex = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#69b2ee';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(16, 16, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2d63b8';
    ctx.beginPath(); ctx.arc(46, 46, 7, 0, Math.PI * 2); ctx.fill();
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(30, 1);
  return tex;
}

function badgeTexture() {
  return canvasTexture(160, 200, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    roundRect(ctx, 3, 3, w - 6, h - 6, 14);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#222';
    ctx.stroke();
    ctx.fillStyle = '#1d4f9a';
    ctx.font = `700 34px ${FONT}`;
    ctx.textAlign = 'center';
    ['Not a', 'Real', 'Doctor'].forEach((t, i) => ctx.fillText(t, w / 2, 48 + i * 38));
    ctx.fillStyle = '#e0323a';
    ctx.fillRect(w / 2 - 8, 148, 16, 38);
    ctx.fillRect(w / 2 - 19, 159, 38, 16);
  });
}

/* ---------------- Parts ---------------- */

/** Simpsons-style four-fingered hand; palm faces the body (x). */
function hand(side) {
  const g = new THREE.Group();
  const palm = part(sphere(0.07, 14, 12), SKIN, { outline: 0.014 });
  palm.scale.set(0.65, 1.05, 1);
  g.add(palm);
  [-0.035, 0, 0.035].forEach((z, i) => {
    const f = part(capsule(0.023, 0.06 - Math.abs(i - 1) * 0.01), SKIN, { outline: 0.01 });
    f.position.set(0, -0.09, z);
    f.rotation.x = z * 3;
    g.add(f);
  });
  const thumb = part(capsule(0.024, 0.05), SKIN, { outline: 0.01 });
  thumb.position.set(-side * 0.035, -0.02, 0.06);
  thumb.rotation.set(0.9, 0, -side * 0.4);
  g.add(thumb);
  return g;
}

function glasses() {
  const g = new THREE.Group();
  const mat = toon(BLACK);
  const frame = new THREE.Shape();
  const W = 0.25, H = 0.18, R = 0.045;
  frame.moveTo(-W / 2 + R, -H / 2);
  frame.lineTo(W / 2 - R, -H / 2);
  frame.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + R);
  frame.lineTo(W / 2, H / 2 - R);
  frame.quadraticCurveTo(W / 2, H / 2, W / 2 - R, H / 2);
  frame.lineTo(-W / 2 + R, H / 2);
  frame.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - R);
  frame.lineTo(-W / 2, -H / 2 + R);
  frame.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + R, -H / 2);
  const hw = W / 2 - 0.024, hh = H / 2 - 0.024, hr = 0.03;
  const hole = new THREE.Path();
  hole.moveTo(-hw + hr, -hh);
  hole.lineTo(hw - hr, -hh);
  hole.quadraticCurveTo(hw, -hh, hw, -hh + hr);
  hole.lineTo(hw, hh - hr);
  hole.quadraticCurveTo(hw, hh, hw - hr, hh);
  hole.lineTo(-hw + hr, hh);
  hole.quadraticCurveTo(-hw, hh, -hw, hh - hr);
  hole.lineTo(-hw, -hh + hr);
  hole.quadraticCurveTo(-hw, -hh, -hw + hr, -hh);
  frame.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(frame, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 6 });
  for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(geo, mat);
    f.position.x = sx * 0.128;
    f.rotation.y = sx * 0.12;
    g.add(f);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.03), mat);
  bridge.position.set(0, 0.035, 0.02);
  g.add(bridge);
  for (const sx of [-1, 1]) {
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.3), mat);
    temple.position.set(sx * 0.255, 0.04, -0.13);
    g.add(temple);
  }
  return g;
}

/**
 * Short, textured hair swept up and to his right: a cap hugging the skull plus a field of
 * spiky tufts sampled over the top of the head (taller at the front for the quiff).
 */
function hair() {
  const g = new THREE.Group();
  const C = new THREE.Vector3(0, 0.4, 0); // rays are cast from here onto the head surface
  const browns = [HAIR, HAIR_LIGHT, HAIR, HAIR_DARK, HAIR_LIGHT];
  const tuftGeo = new THREE.ConeGeometry(1, 1, 7, 1);
  tuftGeo.translate(0, 0.5, 0); // pivot at the base
  const Y = new THREE.Vector3(0, 1, 0);
  const sweep = new THREE.Vector3(-0.35, 0.75, -0.25); // up, back and to his right (-x)
  let k = 0;
  for (let e = 0; e <= 88; e += 11) {
    const er = THREE.MathUtils.degToRad(e);
    const n = Math.max(1, Math.round(Math.sin(er) * 22));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + e * 0.05;
      const front = Math.cos(a); // 1 = forehead, -1 = back of head
      if (front > 0.4 && e > 46) continue; // hairline above the forehead
      if (front > -0.3 && e > 70) continue; // short over the ears
      const d = new THREE.Vector3(Math.sin(er) * Math.sin(a), Math.cos(er), Math.sin(er) * Math.cos(a));
      const pos = headSurface(C, d);
      const quiff = Math.max(0, front) * (1 - e / 90); // front-top tufts stand tallest
      const dir = d.clone().multiplyScalar(0.45).add(sweep.clone().multiplyScalar(0.8 + quiff * 0.3));
      if (front > 0.3) dir.z += 0.25 * quiff; // quiff lifts forward a touch before sweeping
      dir.normalize();
      const h = 0.075 + quiff * 0.13 + (k % 3) * 0.01;
      const r = 0.062 + (1 - e / 90) * 0.012;
      const t = part(tuftGeo, browns[k++ % browns.length], { outline: 0.006 });
      t.position.copy(pos).addScaledVector(dir, -0.035);
      t.quaternion.setFromUnitVectors(Y, dir);
      t.scale.set(r, h, r * 0.8);
      g.add(t);
    }
  }
  return g;
}

/* ---------------- Doctor ---------------- */

export function buildDoctor() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Legs: straight scrub pants + navy sneakers with white soles
  const legs = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.15, 1.0, 0);
    body.add(pivot);
    const leg = part(new THREE.CylinderGeometry(0.135, 0.15, 0.9, 16), SCRUBS, { outline: 0.02 });
    leg.position.y = -0.45;
    pivot.add(leg);
    const shoe = part(sphere(1, 16, 12), 0x1f2b4d, { outline: 0.018 });
    shoe.scale.set(0.12, 0.08, 0.2);
    shoe.position.set(0, -0.92, 0.06);
    pivot.add(shoe);
    const sole = part(new THREE.BoxGeometry(0.22, 0.04, 0.38), 0xffffff, { outline: 0.01 });
    sole.position.set(0, -0.98, 0.06);
    pivot.add(sole);
    legs.push(pivot);
  }
  const hips = part(new THREE.CylinderGeometry(0.29, 0.29, 0.2, 20), SCRUBS, { outline: 0.02 });
  hips.position.y = 1.0;
  hips.scale.z = 0.7;
  body.add(hips);

  // Torso: tapered scrub top with broad shoulders
  const prof = [[0.0, 0.9], [0.31, 0.9], [0.32, 1.0], [0.33, 1.2], [0.36, 1.42], [0.37, 1.52], [0.32, 1.62], [0.18, 1.68], [0.1, 1.7], [0.0, 1.7]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const torso = part(new THREE.LatheGeometry(prof, 28), SCRUBS, { outline: 0.03 });
  torso.scale.z = 0.62;
  body.add(torso);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.312, 0.018, 6, 30), toon(SCRUBS_DARK));
  hem.rotation.x = Math.PI / 2;
  hem.scale.y = 0.62;
  hem.position.y = 0.91;
  body.add(hem);
  // V-neck showing skin, with darker collar trim
  const trim = part(new THREE.ConeGeometry(0.115, 0.24, 3), SCRUBS_DARK, { outline: 0 });
  trim.rotation.set(Math.PI, 0, 0);
  trim.scale.z = 0.25;
  trim.position.set(0, 1.56, 0.215);
  body.add(trim);
  const vneck = part(new THREE.ConeGeometry(0.09, 0.2, 3), SKIN, { outline: 0 });
  vneck.rotation.set(Math.PI, 0, 0);
  vneck.scale.z = 0.25;
  vneck.position.set(0, 1.575, 0.225);
  body.add(vneck);
  const pocket = part(new THREE.BoxGeometry(0.13, 0.12, 0.015), SCRUBS_DARK, { outline: 0.008 });
  pocket.position.set(0.18, 1.36, 0.212);
  pocket.rotation.y = 0.25;
  body.add(pocket);
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6), toon(0xe0323a));
  pen.position.set(0.15, 1.43, 0.216);
  body.add(pen);
  for (const sx of [-1, 1]) {
    const sh = part(sphere(0.125), SCRUBS, { outline: 0.02 });
    sh.position.set(sx * 0.34, 1.52, 0);
    sh.scale.z = 0.85;
    body.add(sh);
  }

  // Arms: short flared sleeves, yellow arms, four-fingered hands
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.42, 1.55, 0);
    body.add(pivot);
    const sleeve = part(new THREE.CylinderGeometry(0.115, 0.13, 0.26, 16), SCRUBS, { outline: 0.02 });
    sleeve.position.y = -0.12;
    pivot.add(sleeve);
    const arm = part(new THREE.CapsuleGeometry(0.075, 0.44, 6, 16), SKIN, { outline: 0.018 });
    arm.scale.set(1.1, 1, 1.1);
    arm.position.y = -0.42;
    pivot.add(arm);
    const h = hand(sx);
    h.position.y = -0.74;
    pivot.add(h);
    pivot.rotation.z = sx * 0.12;
    arms.push(pivot);
  }

  // Head
  const head = new THREE.Group();
  head.position.y = 1.64;
  head.scale.setScalar(1.12); // big cartoon head
  body.add(head);
  const neck = part(new THREE.CylinderGeometry(0.11, 0.12, 0.16, 16), SKIN, { outline: 0.015 });
  neck.position.y = 0.06;
  head.add(neck);
  const lathe = new THREE.LatheGeometry(HEAD_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 48);
  const skull = part(lathe, toon(0xffffff, { map: skullTexture() }), { outline: 0.03 });
  skull.scale.z = HEAD_DEPTH;
  head.add(skull);
  // Muzzle with stubble and the big grin
  const muzzle = part(sphere(0.17, 40, 28), toon(0xffffff, { map: muzzleTexture() }), { outline: 0 });
  muzzle.scale.set(1.18, 0.82, 0.8);
  muzzle.position.set(0, 0.2, 0.115);
  head.add(muzzle);
  // Sausage nose
  const nose = part(capsule(0.036, 0.05), SKIN, { outline: 0.012 });
  nose.rotation.x = Math.PI / 2 - 0.45;
  nose.position.set(0, 0.34, 0.262);
  head.add(nose);
  // Big bulging eyes
  for (const sx of [-1, 1]) {
    const eye = part(sphere(0.092, 24, 18), 0xffffff, { outline: 0.012 });
    eye.position.set(sx * 0.095, 0.445, 0.2);
    head.add(eye);
    const pupil = new THREE.Mesh(sphere(0.022, 10, 8), toon(BLACK));
    pupil.position.set(sx * 0.095 + 0.008, 0.46, 0.288);
    head.add(pupil);
  }
  const specs = glasses();
  specs.position.set(0, 0.44, 0.275);
  head.add(specs);
  // C-shaped ears
  for (const sx of [-1, 1]) {
    const ear = part(sphere(0.075, 14, 12), SKIN, { outline: 0.014 });
    ear.scale.set(0.45, 1, 0.75);
    ear.position.set(sx * 0.25, 0.4, -0.02);
    head.add(ear);
    const fold = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 14, Math.PI * 1.4), toon(0xd9a90c));
    fold.rotation.set(0, sx * Math.PI / 2, 0.8);
    fold.position.set(sx * 0.285, 0.4, -0.02);
    head.add(fold);
  }
  // Hair: painted scalp (skull texture) + swept tufts
  head.add(hair());

  // Stethoscope: tube draped around the neck, chest piece on the right, earpieces on the left
  const tubeMat = toon(0x222222);
  const loop = new THREE.CatmullRomCurve3([
    [-0.11, 1.24, 0.235], [-0.16, 1.42, 0.225], [-0.17, 1.6, 0.17], [-0.13, 1.7, 0.02],
    [0, 1.73, -0.13], [0.13, 1.7, 0.02], [0.17, 1.6, 0.17], [0.17, 1.42, 0.225], [0.15, 1.24, 0.24],
  ].map((p) => new THREE.Vector3(...p)));
  body.add(Object.assign(new THREE.Mesh(new THREE.TubeGeometry(loop, 60, 0.02, 8), tubeMat), { castShadow: true }));
  const chest = part(new THREE.CylinderGeometry(0.06, 0.06, 0.035, 20), 0xc9ccd1, { outline: 0.01 });
  chest.rotation.x = Math.PI / 2;
  chest.position.set(0.15, 1.19, 0.25);
  body.add(chest);
  for (const sx of [-1, 1]) {
    const branch = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.11, 1.24, 0.235), new THREE.Vector3(-0.11 + sx * 0.03, 1.16, 0.245), new THREE.Vector3(-0.11 + sx * 0.04, 1.1, 0.25),
    ]);
    body.add(new THREE.Mesh(new THREE.TubeGeometry(branch, 12, 0.012, 6), toon(0xc9ccd1)));
    const tip = new THREE.Mesh(sphere(0.02, 8, 6), toon(BLACK));
    tip.position.set(-0.11 + sx * 0.04, 1.09, 0.25);
    body.add(tip);
  }

  // Lanyard (light blue patterned strap) + badge
  const strap = new THREE.CatmullRomCurve3([
    [0, 1.3, 0.24], [-0.09, 1.48, 0.225], [-0.12, 1.63, 0.12], [-0.08, 1.71, -0.04],
    [0, 1.72, -0.11], [0.08, 1.71, -0.04], [0.12, 1.63, 0.12], [0.09, 1.48, 0.225], [0, 1.3, 0.24],
  ].map((p) => new THREE.Vector3(...p)));
  const lanyard = new THREE.Mesh(new THREE.TubeGeometry(strap, 80, 0.016, 6), toon(0xffffff, { map: lanyardTexture() }));
  body.add(lanyard);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.02), toon(0xc9ccd1));
  clip.position.set(0, 1.28, 0.245);
  body.add(clip);
  const card = toon(0xffffff);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.19, 0.012), [card, card, card, card, new THREE.MeshBasicMaterial({ map: badgeTexture() }), card]);
  badge.position.set(0, 1.16, 0.25);
  badge.rotation.x = -0.08;
  body.add(badge);

  root.traverse((o) => { if (o.isMesh && o.material?.type !== 'ShaderMaterial') o.castShadow = true; });

  return { root, body, head, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], height: 2.6 };
}
