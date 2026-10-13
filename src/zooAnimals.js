// The new animals of Lakash's wing of the zoo, hand-built in the game's toon style (outlined, chunky, friendly):
// capybaras (his favourites — one wears a mandarin on its head), flamingos, giant tortoises, meerkats and ducks.
// Each maker returns { root, body, parts } where parts holds the bits the animator moves (head, legs, neck…).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { part, toon, canvasTexture } from './toon.js';

const O = 0.012; // outline thickness

const sphere = (r, color, sx = 1, sy = 1, sz = 1, outline = O) => {
  const m = part(new THREE.SphereGeometry(r, 16, 12), color, { outline });
  m.scale.set(sx, sy, sz);
  return m;
};
const eye = (r = 0.035) => new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), toon(0x1b1b1b));

/** A capybara (~1.3 long): a long barrel body, a big blunt box of a head held level, tiny ears, eyes high up. */
export function makeCapybara({ mandarin = false, baby = false, tone = 0 } = {}) {
  const fur = new THREE.Color(0xa36c42).offsetHSL(0, 0, tone).getHex(), dark = new THREE.Color(0x7a4f2e).offsetHSL(0, 0, tone).getHex();
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const torso = part(new THREE.CapsuleGeometry(0.3, 0.62, 8, 16), fur, { outline: O });
  torso.rotation.x = Math.PI / 2;
  torso.scale.set(1.05, 1, 0.95);
  torso.position.set(0, 0.44, -0.05);
  body.add(torso);
  const rump = sphere(0.31, fur, 1.05, 0.98, 1); // the back end sits a touch higher
  rump.position.set(0, 0.47, -0.42);
  body.add(rump);
  const back = part(new THREE.CapsuleGeometry(0.18, 0.55, 6, 12), dark, { outline: 0 });
  back.rotation.x = Math.PI / 2;
  back.scale.set(1.2, 0.5, 1);
  back.position.set(0, 0.66, -0.12);
  body.add(back);
  // the head: blunt and rectangular, nose at the front, the face long and deep
  const head = new THREE.Group();
  head.position.set(0, 0.6, 0.48);
  head.rotation.x = 0.12;
  body.add(head);
  const skull = part(new RoundedBoxGeometry(0.3, 0.32, 0.5, 3, 0.1), fur, { outline: O });
  skull.position.set(0, 0, 0.12);
  head.add(skull);
  const jaw = part(new RoundedBoxGeometry(0.24, 0.12, 0.34, 2, 0.05), fur, { outline: 0 });
  jaw.position.set(0, -0.14, 0.17);
  head.add(jaw);
  const nose = part(new RoundedBoxGeometry(0.22, 0.11, 0.05, 2, 0.02), 0x3a2618, { outline: 0 });
  nose.position.set(0, 0.06, 0.37);
  head.add(nose);
  for (const s of [-1, 1]) {
    const e = eye(0.03);
    e.position.set(s * 0.15, 0.1, 0.04);
    head.add(e);
    const ear = sphere(0.045, dark, 0.8, 1, 0.55, 0.006);
    ear.position.set(s * 0.12, 0.18, -0.1);
    head.add(ear);
  }
  if (mandarin) {
    const fruit = sphere(0.085, 0xff9a1f, 1, 0.85, 1, 0.008);
    fruit.position.set(0, 0.24, 0.02);
    head.add(fruit);
    const leaf = part(new THREE.ConeGeometry(0.025, 0.07, 5), 0x3a9a3a, { outline: 0 });
    leaf.position.set(0.02, 0.31, 0.02);
    leaf.rotation.z = -0.5;
    head.add(leaf);
  }
  // short, sturdy legs
  const legs = [];
  for (const [x, z] of [[-0.18, 0.3], [0.18, 0.3], [-0.2, -0.45], [0.2, -0.45]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.26, z);
    const l = part(new THREE.CylinderGeometry(0.075, 0.065, 0.27, 8), dark, { outline: O });
    l.position.y = -0.13;
    leg.add(l);
    body.add(leg);
    legs.push(leg);
  }
  if (baby) root.scale.setScalar(0.55);
  return { root, body, parts: { head, legs, torso }, kind: 'capybara' };
}

/** A flamingo (~1.7 tall), standing on one leg when idle. */
export function makeFlamingo() {
  const pink = 0xff8fb0, deep = 0xf2668f;
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const torso = sphere(0.22, pink, 0.85, 0.8, 1.35);
  torso.position.set(0, 1.05, 0);
  body.add(torso);
  const wing = sphere(0.18, deep, 0.9, 0.6, 1.2, 0);
  wing.position.set(0, 1.12, -0.06);
  body.add(wing);
  const tail = part(new THREE.ConeGeometry(0.08, 0.2, 6), deep, { outline: 0 });
  tail.rotation.x = -Math.PI / 2 - 0.3;
  tail.position.set(0, 1.08, -0.32);
  body.add(tail);
  // the S-shaped neck, a small head and the bent black-tipped beak
  const neckCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.12, 0.22), new THREE.Vector3(0, 1.38, 0.32), new THREE.Vector3(0, 1.55, 0.14), new THREE.Vector3(0, 1.7, 0.18)]);
  const neck = part(new THREE.TubeGeometry(neckCurve, 16, 0.045, 8), pink, { outline: 0.008 });
  body.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 1.72, 0.2);
  body.add(head);
  head.add(sphere(0.075, pink, 1, 0.95, 1.2, 0.008));
  const beak = part(new THREE.ConeGeometry(0.035, 0.16, 8), 0xffffff, { outline: 0.006 });
  beak.rotation.x = Math.PI / 2 + 0.9;
  beak.position.set(0, -0.04, 0.12);
  head.add(beak);
  const tip = part(new THREE.ConeGeometry(0.025, 0.07, 8), 0x1b1b1b, { outline: 0 });
  tip.rotation.x = Math.PI / 2 + 1.3;
  tip.position.set(0, -0.09, 0.16);
  head.add(tip);
  for (const s of [-1, 1]) { const e = eye(0.016); e.position.set(s * 0.055, 0.02, 0.05); head.add(e); }
  // legs: hips → knee (backwards) → foot
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.07, 0.95, 0);
    const thigh = part(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6), deep, { outline: 0 });
    thigh.position.y = -0.25;
    leg.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.5;
    leg.add(knee);
    const shin = part(new THREE.CylinderGeometry(0.018, 0.016, 0.45, 6), deep, { outline: 0 });
    shin.position.y = -0.22;
    knee.add(shin);
    const foot = part(new THREE.BoxGeometry(0.1, 0.02, 0.12), deep, { outline: 0 });
    foot.position.set(0, -0.45, 0.03);
    knee.add(foot);
    body.add(leg);
    legs.push({ leg, knee });
  }
  return { root, body, parts: { head, legs, torso }, kind: 'flamingo' };
}

/** A giant tortoise (~1.3 long) with a patterned dome shell. */
export function makeTortoise() {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const shellTex = canvasTexture(256, 128, (c) => {
    c.fillStyle = '#6d5a3a'; c.fillRect(0, 0, 256, 128);
    c.strokeStyle = '#4a3a22'; c.lineWidth = 5;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
      const cx = x * 34 + (y % 2) * 17, cy = y * 34 + 10;
      c.beginPath();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; c.lineTo(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15); }
      c.closePath(); c.fillStyle = '#7d6942'; c.fill(); c.stroke();
    }
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xffffff, { map: shellTex }));
  shell.scale.set(1, 0.85, 1.25);
  shell.position.y = 0.2;
  shell.castShadow = true;
  body.add(shell);
  const rim = part(new THREE.TorusGeometry(0.55, 0.05, 6, 24), 0x5a4a2e, { outline: 0 });
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1, 1.25, 1);
  rim.position.y = 0.2;
  body.add(rim);
  const skin = 0x8a8a74;
  const head = new THREE.Group();
  head.position.set(0, 0.28, 0.74);
  body.add(head);
  const neck = part(new THREE.CylinderGeometry(0.09, 0.11, 0.3, 8), skin, { outline: O });
  neck.rotation.x = Math.PI / 2 - 0.4;
  neck.position.set(0, -0.04, -0.1);
  head.add(neck);
  head.add(sphere(0.13, skin, 0.9, 0.8, 1.15));
  for (const s of [-1, 1]) { const e = eye(0.022); e.position.set(s * 0.08, 0.04, 0.08); head.add(e); }
  const legs = [];
  for (const [x, z] of [[-0.4, 0.42], [0.4, 0.42], [-0.4, -0.44], [0.4, -0.44]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.22, z);
    const l = part(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 8), skin, { outline: O });
    l.position.y = -0.11;
    leg.add(l);
    body.add(leg);
    legs.push(leg);
  }
  return { root, body, parts: { head, legs, torso: shell }, kind: 'tortoise' };
}

/** A meerkat (~0.6 tall when standing sentry). */
export function makeMeerkat() {
  const fur = 0xc9a678, dark = 0x5a4632;
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const torso = part(new THREE.CapsuleGeometry(0.09, 0.26, 6, 10), fur, { outline: O });
  torso.position.set(0, 0.3, 0);
  body.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 0.55, 0.02);
  body.add(head);
  head.add(sphere(0.075, fur, 0.95, 0.9, 1.1, 0.008));
  const snout = part(new THREE.ConeGeometry(0.04, 0.09, 8), fur, { outline: 0.006 });
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.01, 0.1);
  head.add(snout);
  const nose = eye(0.018);
  nose.position.set(0, -0.01, 0.145);
  head.add(nose);
  for (const s of [-1, 1]) {
    const patch = sphere(0.025, dark, 1, 1.3, 0.6, 0);
    patch.position.set(s * 0.04, 0.015, 0.06);
    head.add(patch);
    const e = eye(0.014);
    e.position.set(s * 0.041, 0.018, 0.075);
    head.add(e);
  }
  const tail = part(new THREE.CylinderGeometry(0.012, 0.025, 0.3, 6), fur, { outline: 0 });
  tail.position.set(0, 0.12, -0.12);
  tail.rotation.x = 0.9;
  body.add(tail);
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = part(new THREE.CylinderGeometry(0.022, 0.02, 0.18, 6), dark, { outline: 0 });
    leg.position.set(s * 0.05, 0.09, 0.02);
    body.add(leg);
    legs.push(leg);
    const arm = part(new THREE.CylinderGeometry(0.016, 0.014, 0.12, 6), fur, { outline: 0 });
    arm.position.set(s * 0.06, 0.38, 0.07);
    arm.rotation.x = -0.5;
    body.add(arm);
  }
  return { root, body, parts: { head, legs, torso, tail }, kind: 'meerkat' };
}

/** A duck for the lagoon. */
export function makeDuck(color = 0xffffff) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const torso = sphere(0.12, color, 0.8, 0.6, 1.2);
  torso.position.y = 0.06;
  body.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 0.16, 0.1);
  body.add(head);
  head.add(sphere(0.06, color === 0xffffff ? 0xffffff : 0x2e7d4f, 1, 1, 1, 0.006));
  const beak = part(new THREE.BoxGeometry(0.05, 0.018, 0.06), 0xffa62b, { outline: 0 });
  beak.position.set(0, -0.01, 0.07);
  head.add(beak);
  for (const s of [-1, 1]) { const e = eye(0.011); e.position.set(s * 0.04, 0.015, 0.035); head.add(e); }
  return { root, body, parts: { head, legs: [] }, kind: 'duck' };
}

/** A zebra (~2.2 long): a horse shape in black-and-white stripes, a short upright mane. */
export function makeZebra() {
  // bands across the texture's v axis, so they wrap round the body, neck and legs (capsules/cylinders run along v)
  const stripes = canvasTexture(64, 256, (c) => {
    c.fillStyle = '#f6f6f2'; c.fillRect(0, 0, 64, 256);
    c.fillStyle = '#1b1b1b';
    for (let y = 0; y < 256; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(64, y + 5); c.lineTo(64, y + 15); c.lineTo(0, y + 10); c.fill(); }
  });
  stripes.wrapS = stripes.wrapT = THREE.RepeatWrapping;
  stripes.repeat.set(1, 1.6);
  const coat = toon(0xffffff, { map: stripes });
  // the body: meridian stripes on an upright-axis ellipsoid meet along the spine and the belly, like a real zebra's
  const meridians = canvasTexture(256, 64, (c) => {
    c.fillStyle = '#f6f6f2'; c.fillRect(0, 0, 256, 64);
    c.fillStyle = '#1b1b1b';
    for (let x = 0; x < 256; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 7, 0); c.lineTo(x + 9, 64); c.lineTo(x + 2, 64); c.fill(); }
  });
  meridians.wrapS = THREE.RepeatWrapping;
  meridians.repeat.set(2, 1);
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const torso = part(new THREE.SphereGeometry(0.5, 24, 16), toon(0xffffff, { map: meridians }), { outline: O });
  torso.scale.set(0.78, 0.8, 1.45);
  torso.position.set(0, 1.25, 0);
  body.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 1.62, 0.78);
  body.add(head);
  const neck = part(new THREE.CapsuleGeometry(0.16, 0.55, 6, 10), coat, { outline: O });
  neck.rotation.x = 0.55;
  neck.position.set(0, 0.12, -0.08);
  head.add(neck);
  const skull = part(new THREE.CapsuleGeometry(0.14, 0.42, 6, 10), coat, { outline: O });
  skull.rotation.x = Math.PI / 2 + 0.55;
  skull.position.set(0, 0.32, 0.25);
  head.add(skull);
  const muzzle = sphere(0.12, 0x2a2a2a, 1, 0.9, 1.1, 0.006);
  muzzle.position.set(0, 0.14, 0.47);
  head.add(muzzle);
  const mane = part(new THREE.BoxGeometry(0.06, 0.16, 0.7), 0x1b1b1b, { outline: 0 });
  mane.rotation.x = 0.55;
  mane.position.set(0, 0.32, -0.12);
  head.add(mane);
  for (const s of [-1, 1]) {
    const e = eye(0.028); e.position.set(s * 0.13, 0.42, 0.28); head.add(e);
    const ear = part(new THREE.ConeGeometry(0.05, 0.16, 6), 0xf6f6f2, { outline: 0.006 }); ear.position.set(s * 0.08, 0.6, 0.12); head.add(ear);
  }
  const tail = part(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), 0x1b1b1b, { outline: 0 });
  tail.position.set(0, 1.1, -0.8); tail.rotation.x = 0.3;
  body.add(tail);
  const legs = [];
  for (const [x, z] of [[-0.2, 0.5], [0.2, 0.5], [-0.2, -0.52], [0.2, -0.52]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 1.05, z);
    const l = part(new THREE.CylinderGeometry(0.07, 0.055, 1.05, 8), coat, { outline: O });
    l.position.y = -0.52;
    leg.add(l);
    const hoof = part(new THREE.CylinderGeometry(0.065, 0.075, 0.1, 8), 0x1b1b1b, { outline: 0 });
    hoof.position.y = -1.02;
    leg.add(hoof);
    body.add(leg);
    legs.push(leg);
  }
  return { root, body, parts: { head, legs, torso, tail }, kind: 'zebra' };
}

/** A hippo (~2.6 long): a huge grey-pink barrel, a wide muzzle, tiny ears — usually up to its eyes in water. */
export function makeHippo() {
  const skin = 0x8f7f8f, pink = 0xd99aa6;
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const torso = part(new THREE.CapsuleGeometry(0.62, 1.2, 8, 16), skin, { outline: O });
  torso.rotation.x = Math.PI / 2;
  torso.scale.set(1.1, 1, 0.95);
  torso.position.set(0, 0.85, 0);
  body.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 1.0, 1.15);
  body.add(head);
  const skull = part(new RoundedBoxGeometry(0.75, 0.55, 0.6, 3, 0.2), skin, { outline: O });
  head.add(skull);
  const muzzle = part(new RoundedBoxGeometry(0.85, 0.5, 0.45, 3, 0.2), skin, { outline: O });
  muzzle.position.set(0, -0.12, 0.42);
  head.add(muzzle);
  const mouth = part(new THREE.BoxGeometry(0.7, 0.04, 0.3), pink, { outline: 0 });
  mouth.position.set(0, -0.3, 0.45);
  head.add(mouth);
  for (const s of [-1, 1]) {
    const e = eye(0.045); e.position.set(s * 0.22, 0.3, 0.05); head.add(e);
    const brow = sphere(0.08, skin, 1, 0.7, 1, 0.006); brow.position.set(s * 0.22, 0.27, 0.0); head.add(brow);
    const ear = sphere(0.06, pink, 0.8, 1, 0.5, 0.006); ear.position.set(s * 0.24, 0.32, -0.22); head.add(ear);
    const nostril = eye(0.03); nostril.position.set(s * 0.18, 0.12, 0.66); head.add(nostril);
  }
  const legs = [];
  for (const [x, z] of [[-0.42, 0.6], [0.42, 0.6], [-0.42, -0.65], [0.42, -0.65]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.45, z);
    const l = part(new THREE.CylinderGeometry(0.2, 0.22, 0.45, 10), skin, { outline: O });
    l.position.y = -0.22;
    leg.add(l);
    body.add(leg);
    legs.push(leg);
  }
  return { root, body, parts: { head, legs, torso }, kind: 'hippo' };
}

/** A macaw for the aviary: red, blue or green-yellow, perched or flying in loops. */
export function makeParrot(scheme = 0) {
  const [main, wingC, tailC] = [[0xe0323a, 0x2f7fc1, 0xffd23f], [0x2f7fc1, 0xffd23f, 0x2f7fc1], [0x4cc35a, 0x2f7fc1, 0xffd23f]][scheme % 3];
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const torso = sphere(0.12, main, 0.85, 1.25, 0.95, 0.008);
  torso.position.y = 0.22;
  torso.rotation.x = 0.35;
  body.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 0.4, 0.05);
  body.add(head);
  head.add(sphere(0.085, main, 1, 1, 1, 0.006));
  const face = sphere(0.05, 0xffffff, 0.6, 1, 0.5, 0);
  face.position.set(0, 0.0, 0.065);
  head.add(face);
  const beak = part(new THREE.ConeGeometry(0.035, 0.09, 8), 0x2a2a2a, { outline: 0 });
  beak.rotation.x = Math.PI / 2 + 0.7;
  beak.position.set(0, -0.03, 0.09);
  head.add(beak);
  for (const s of [-1, 1]) { const e = eye(0.015); e.position.set(s * 0.05, 0.02, 0.06); head.add(e); }
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(s * 0.09, 0.28, 0);
    const blade = sphere(0.11, wingC, 0.3, 1.2, 0.8, 0.006);
    blade.position.set(s * 0.04, -0.06, -0.02);
    w.add(blade);
    body.add(w);
    wings.push(w);
  }
  const tail = part(new THREE.BoxGeometry(0.06, 0.32, 0.02), tailC, { outline: 0 });
  tail.position.set(0, 0.02, -0.1);
  tail.rotation.x = 0.4;
  body.add(tail);
  return { root, body, parts: { head, wings, legs: [], torso }, kind: 'parrot' };
}
