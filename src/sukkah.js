// Caspi's family sukkah, going up in their back garden in Maple Heights: a wooden frame, two decorated fabric walls,
// bamboo poles with palm fronds on top (half done, the rest of the fronds in a pile), paper chains and hanging fruit,
// string lights for the evening, a table set for dinner. The east wall is still being built: a loose beam
// across it that Caspi holds while his dad hammers it in (see caspi.js).
import * as THREE from 'three';
import { part, toon, canvasTexture, FONT } from './toon.js';
import { addBox } from './world.js';

const WOOD = 0x9a6a3c, WOOD_DARK = 0x7a5230, BAMBOO = 0xc9b06a, FROND = 0x4f9a3a, FROND_DARK = 0x3a7d2c;
const W = 3.8, D = 3.2, H = 2.45; // footprint x, z and wall height

/**
 * Builds the sukkah centred at cx, cz (entrance facing +z, the work on the east wall).
 * Returns the spots the family uses: where Dad and Caspi stand, the hammer's strike point, the beam ends Caspi
 * holds, the two dinner seats, and the string-light bulbs (for the night halos).
 */
export function buildSukkah(group, cx, cz) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  group.add(g);
  const x0 = -W / 2, x1 = W / 2, z0 = -D / 2, z1 = D / 2;
  const box = (w, h, d, color, x, y, z, outline = 0.012) => { const m = part(new THREE.BoxGeometry(w, h, d), color, { outline }); m.position.set(x, y, z); g.add(m); return m; };

  // ---- the frame: corner posts, top beams all round
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) box(0.14, H, 0.14, WOOD, x, H / 2, z);
  box(W + 0.14, 0.12, 0.12, WOOD, 0, H, z0); box(W + 0.14, 0.12, 0.12, WOOD, 0, H, z1);
  box(0.12, 0.12, D, WOOD, x0, H, 0); box(0.12, 0.12, D, WOOD, x1, H, 0);

  // ---- fabric walls (back and west): cream canvas with the kids' decorations
  const wall = (len) => canvasTexture(512, 320, (c) => {
    c.fillStyle = '#fbf3df'; c.fillRect(0, 0, 512, 320);
    c.fillStyle = '#2f6fb8'; c.fillRect(0, 0, 512, 16); c.fillRect(0, 304, 512, 16);
    // paper-chain garland painted along the top
    for (let i = 0; i < 16; i++) { c.strokeStyle = ['#e0323a', '#ffd23f', '#4cc35a', '#2f7fc1'][i % 4]; c.lineWidth = 6; c.beginPath(); c.ellipse(16 + i * 32, 34, 13, 9, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = '#1e3fa0'; c.font = `700 ${len > 3.5 ? 58 : 46}px ${FONT}`; c.textAlign = 'center';
    c.fillText('חג סוכות שמח', 256, 118); // "Happy Sukkot"
    // kids' drawings: pomegranates, a lulav, a star, a sun
    const fruit = (x, y, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, 26, 0, Math.PI * 2); c.fill(); c.fillStyle = '#3a7d2c'; c.fillRect(x - 4, y - 36, 8, 12); };
    fruit(80, 210, '#d6304a'); fruit(432, 210, '#f2c22a');
    c.strokeStyle = '#3a7d2c'; c.lineWidth = 7; c.beginPath(); c.moveTo(256, 270); c.lineTo(256, 160); c.stroke();
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(256, 250 - i * 20); c.lineTo(232 - i * 2, 200 - i * 22); c.moveTo(256, 250 - i * 20); c.lineTo(280 + i * 2, 200 - i * 22); c.stroke(); }
    c.fillStyle = '#ffd23f'; c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 12 : 28; c.lineTo(168 + Math.cos(a) * r, 220 + Math.sin(a) * r); }
    c.fill();
    c.fillStyle = '#ff8a3d'; c.beginPath(); c.arc(346, 220, 22, 0, Math.PI * 2); c.fill();
  });
  const panel = (len, x, z, rotY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, H - 0.25), toon(0xffffff, { map: wall(len) }));
    m.position.set(x, (H - 0.25) / 2 + 0.05, z);
    m.rotation.y = rotY;
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    // a second face looking out, so the writing reads the right way round from the garden too
    const out = new THREE.Mesh(m.geometry, toon(0xffffff, { map: m.material.map }));
    out.position.copy(m.position).add(new THREE.Vector3(Math.sin(rotY + Math.PI), 0, Math.cos(rotY + Math.PI)).multiplyScalar(0.012));
    out.rotation.y = rotY + Math.PI;
    g.add(out);
  };
  panel(W - 0.1, 0, z0, 0); // back (towards the house)
  panel(D - 0.1, x0, 0, Math.PI / 2); // west
  // the east wall, half built: a bottom rail, one fabric panel on the north half, and the loose beam across it
  box(0.1, 0.1, D, WOOD_DARK, x1, 0.25, 0);
  const half = new THREE.Mesh(new THREE.PlaneGeometry(D / 2 - 0.1, H - 0.25), toon(0xffffff, { map: wall(1.5), side: THREE.DoubleSide }));
  half.position.set(x1, (H - 0.25) / 2 + 0.05, z0 + D / 4); half.rotation.y = Math.PI / 2; half.castShadow = true;
  g.add(half);
  const beamY = 1.45;
  box(0.1, 0.11, D + 0.3, WOOD, x1 + 0.08, beamY, 0.15, 0.015); // the beam being fixed (sticks out a little at the south end)

  // ---- the roof (schach): bamboo poles across, palm fronds over the back two-thirds
  for (let x = x0 + 0.2; x <= x1 - 0.1; x += 0.32) {
    const pole = part(new THREE.CylinderGeometry(0.035, 0.035, D + 0.4, 6), BAMBOO, { outline: 0 });
    pole.rotation.x = Math.PI / 2; pole.position.set(x, H + 0.1, 0);
    g.add(pole);
  }
  const blades = [], bladeGeo = new THREE.BoxGeometry(0.06, 0.012, 0.55);
  const frond = (x, y, z, rotY, tilt = 0, list = blades) => {
    // a stem with blades fanning out both sides
    const len = 1.9;
    const stem = part(new THREE.CylinderGeometry(0.02, 0.025, len, 5), FROND_DARK, { outline: 0 });
    stem.rotation.set(Math.PI / 2, 0, 0);
    const f = new THREE.Group();
    f.add(stem);
    for (let i = 0; i < 13; i++) {
      const along = -len / 2 + 0.15 + (i / 12) * (len - 0.3);
      for (const s of [-1, 1]) {
        const m = new THREE.Matrix4().compose(new THREE.Vector3(s * 0.22, 0, along), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * (0.9 + i * 0.02), 0)), new THREE.Vector3(1, 1, 1 - i * 0.03));
        list.push({ f, m });
      }
    }
    f.position.set(x, y, z);
    f.rotation.set(tilt, rotY, 0);
    g.add(f);
    return f;
  };
  const roofFronds = [];
  for (let i = 0; i < 6; i++) roofFronds.push(frond(x0 + 0.35 + i * 0.62, H + 0.17 + (i % 2) * 0.03, -0.45 + (i % 3) * 0.12, (i % 2 ? 0.25 : -0.2)));
  // the pile still to go up, by the ladder
  for (let i = 0; i < 4; i++) frond(x1 + 1.3 + (i % 2) * 0.2, 0.05 + i * 0.05, z0 - 0.4 + i * 0.25, 0.4 + i * 0.5);
  // blades as one instanced mesh per frond group (placed relative to each frond)
  const bladeMats = [];
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  for (const { f, m } of blades) { f.updateMatrixWorld(true); bladeMats.push(new THREE.Matrix4().multiplyMatrices(inv, f.matrixWorld).multiply(m)); }
  const bladeMesh = new THREE.InstancedMesh(bladeGeo, toon(FROND), bladeMats.length);
  bladeMats.forEach((m, i) => bladeMesh.setMatrixAt(i, m));
  bladeMesh.castShadow = true;
  g.add(bladeMesh);

  // ---- decorations hanging from the roof: fruit on strings, paper chains along the inside edges
  const fruitCols = [0xd6304a, 0xff8a3d, 0xf2c22a, 0x9a3fb0, 0xd6304a, 0x4cc35a];
  for (let i = 0; i < 6; i++) {
    const x = x0 + 0.6 + (i % 3) * 1.3, z = -0.6 + Math.floor(i / 3) * 1.1, drop = 0.35 + (i % 2) * 0.2;
    const str = part(new THREE.CylinderGeometry(0.006, 0.006, drop, 3), 0xf2f2f2, { outline: 0, cast: false });
    str.position.set(x, H - drop / 2, z); g.add(str);
    const fr = part(new THREE.SphereGeometry(0.09, 10, 8), fruitCols[i], { outline: 0.008 });
    fr.position.set(x, H - drop - 0.07, z); g.add(fr);
  }
  const links = [], linkCols = [0xe0323a, 0xffd23f, 0x4cc35a, 0x2f7fc1];
  const linkGeo = new THREE.TorusGeometry(0.06, 0.012, 4, 10);
  for (const [ax, az, bx, bz] of [[x0 + 0.1, z0 + 0.1, x1 - 0.1, z0 + 0.1], [x0 + 0.1, z0 + 0.1, x0 + 0.1, z1 - 0.1]]) {
    const n = Math.round(Math.hypot(bx - ax, bz - az) / 0.1);
    for (let i = 0; i <= n; i++) {
      const t = i / n, sag = Math.sin(t * Math.PI * 3) ** 2 * 0.22;
      links.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(ax + (bx - ax) * t, H - 0.1 - sag, az + (bz - az) * t), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i % 2 ? 0 : Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1)), c: linkCols[i % 4] });
    }
  }
  const chain = new THREE.InstancedMesh(linkGeo, toon(0xffffff), links.length);
  links.forEach((l, i) => { chain.setMatrixAt(i, l.m); chain.setColorAt(i, new THREE.Color(l.c)); });
  g.add(chain);
  // string lights along the front beam
  const bulbs = [];
  const bulbMat = toon(0xfff3b0, { emissive: 0x8a7020 });
  for (let i = 0; i < 7; i++) {
    const x = x0 + 0.3 + i * ((W - 0.6) / 6), y = H - 0.12 - Math.sin((i / 6) * Math.PI) * 0.18;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), bulbMat);
    b.position.set(x, y, z1 - 0.05); g.add(b);
    bulbs.push({ x: cx + x, y, z: cz + z1 - 0.05, size: 1.1 });
  }

  // ---- inside: a table set for dinner, four chairs
  box(1.5, 0.06, 0.85, 0xffffff, 0, 0.76, 0.1, 0.01); // tablecloth over the top
  for (const [lx, lz] of [[-0.65, -0.28], [0.65, -0.28], [-0.65, 0.48], [0.65, 0.48]]) box(0.06, 0.74, 0.06, WOOD_DARK, lx, 0.37, lz, 0);
  for (const [px, pz, col] of [[-0.4, 0.1, 0x2f7fc1], [0.4, 0.1, 0x2f7fc1], [0, 0.1, 0xf2c22a]]) {
    const plate = part(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 14), col === 0xf2c22a ? 0xd9a05a : 0xffffff, { outline: 0.004 });
    plate.position.set(px, 0.8, pz); g.add(plate);
  }
  const challah = part(new THREE.CapsuleGeometry(0.07, 0.18, 4, 8), 0xd99a4a, { outline: 0.006 });
  challah.rotation.z = Math.PI / 2; challah.position.set(0, 0.86, 0.1); g.add(challah);
  const seats = [];
  for (const [sx, sz, rot] of [[-0.95, 0.1, Math.PI / 2], [0.95, 0.1, -Math.PI / 2], [0, -0.55, 0], [0, 0.85, Math.PI]]) {
    const ch = new THREE.Group();
    ch.position.set(sx, 0, sz); ch.rotation.y = rot;
    const seat = part(new THREE.BoxGeometry(0.42, 0.05, 0.42), 0xe8e2d4, { outline: 0.008 }); seat.position.y = 0.45; ch.add(seat);
    const back = part(new THREE.BoxGeometry(0.42, 0.45, 0.04), 0xe8e2d4, { outline: 0.008 }); back.position.set(0, 0.7, -0.2); ch.add(back);
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
      const l = part(new THREE.BoxGeometry(0.035, 0.45, 0.035), 0x9aa3ad, { outline: 0 }); l.position.set(lx, 0.22, lz); ch.add(l);
    }
    g.add(ch);
    seats.push({ x: cx + sx + Math.sin(rot) * 0.05, z: cz + sz + Math.cos(rot) * 0.05, cx: cx + sx - Math.sin(rot) * 0.04, cz: cz + sz - Math.cos(rot) * 0.04, rot, y: 0.47 });
  }

  // ---- the building site: a ladder against the east wall, a toolbox, a stack of planks, a sawhorse
  const ladder = new THREE.Group();
  for (const s of [-0.22, 0.22]) { const r = part(new THREE.BoxGeometry(0.06, 2.6, 0.05), 0xb8bec6, { outline: 0.008 }); r.position.set(0, 1.3, s); ladder.add(r); }
  for (let i = 0; i < 7; i++) { const r = part(new THREE.CylinderGeometry(0.025, 0.025, 0.44, 5), 0xb8bec6, { outline: 0 }); r.rotation.x = Math.PI / 2; r.position.set(0, 0.3 + i * 0.33, 0); ladder.add(r); }
  ladder.position.set(x1 + 0.5, 0, z0 - 0.75); ladder.rotation.z = 0.2;
  g.add(ladder);
  const tb = box(0.5, 0.24, 0.25, 0xd6302a, x1 + 1.4, 0.12, z1 + 0.6, 0.01);
  tb.rotation.y = 0.3;
  const handle = part(new THREE.TorusGeometry(0.1, 0.015, 4, 10, Math.PI), 0x3a3a3a, { outline: 0 });
  handle.position.set(x1 + 1.4, 0.24, z1 + 0.6); handle.rotation.y = 0.3; g.add(handle);
  for (let i = 0; i < 4; i++) box(2.2, 0.06, 0.2, i % 2 ? WOOD : 0xb07e4a, x1 + 1.25, 0.04 + i * 0.065, z1 + 1.25 + (i % 2) * 0.03, 0.008);
  const horse = new THREE.Group();
  const top = part(new THREE.BoxGeometry(1.1, 0.08, 0.1), WOOD_DARK, { outline: 0.008 }); top.position.y = 0.62; horse.add(top);
  for (const sx of [-0.45, 0.45]) for (const s of [-1, 1]) {
    const l = part(new THREE.BoxGeometry(0.05, 0.7, 0.05), WOOD_DARK, { outline: 0 }); l.position.set(sx, 0.32, s * 0.12); l.rotation.x = s * 0.25; horse.add(l);
  }
  horse.position.set(x0 - 1.2, 0, z1 + 0.9); horse.rotation.y = 0.5;
  g.add(horse);

  // ---- colliders: the three walls (the front is open, so you can walk in), the table, the props
  const wx = (x) => cx + x, wz = (z) => cz + z;
  addBox(wx(0), wz(z0), W + 0.3, 0.3);
  addBox(wx(x0), wz(0), 0.3, D + 0.3);
  addBox(wx(x1 + 0.05), wz(0), 0.35, D + 0.3);
  addBox(wx(0), wz(0.1), 1.5, 0.85);
  addBox(wx(x1 + 1.3), wz(z1 + 1.1), 2.3, 1.2);
  addBox(wx(x0 - 1.2), wz(z1 + 0.9), 1.1, 0.5);

  return {
    x: cx, z: cz, w: W, d: D, bulbs, seats, roofFronds,
    // the work on the east wall: they stand outside it, facing west
    dad: { x: wx(x1 + 0.62), z: wz(z0 + 0.35), rot: -Math.PI / 2 },
    caspi: { x: wx(x1 + 0.64), z: wz(z1 - 0.45), rot: -Math.PI / 2 },
    strike: { x: wx(x1 + 0.14), y: beamY + 0.04, z: wz(z0 + 0.12) }, // where the beam meets the corner post
    hold: [{ x: wx(x1 + 0.16), y: beamY, z: wz(z1 - 0.2) }, { x: wx(x1 + 0.16), y: beamY, z: wz(z1 - 0.75) }],
  };
}
