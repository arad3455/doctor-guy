// Stunt jump ramps (GTA "unique stunt jumps"): yellow/black wedges you can launch the ambulance off.
import * as THREE from 'three';
import { part, toon, canvasTexture } from './toon.js';

// heading = the direction you drive up the ramp (0 = +z); len along the slope, width across
export const RAMPS = [
  { id: 'zoo-road', name: 'Zoo Road Leap', x: 98, z: -35.4, heading: Math.PI / 2, len: 7, width: 3.4, height: 1.9 },
  { id: 'beach', name: 'Beach Bounce', x: -34, z: 103, heading: Math.PI / 2, len: 7, width: 4, height: 2.1 },
  { id: 'park', name: 'Park Flyer', x: -40, z: -18, heading: 0, len: 7, width: 4, height: 2.0 },
];

/** Ramp under a point: { ramp, u (along, -len/2..len/2), h (surface height) } or null. */
export function rampAt(x, z) {
  for (const r of RAMPS) {
    const dx = x - r.x, dz = z - r.z;
    const fx = Math.sin(r.heading), fz = Math.cos(r.heading);
    const u = dx * fx + dz * fz, v = dx * fz - dz * fx;
    if (Math.abs(v) <= r.width / 2 && u >= -r.len / 2 && u <= r.len / 2) return { ramp: r, u, h: ((u + r.len / 2) / r.len) * r.height };
  }
  return null;
}

export function buildRamps(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const stripes = canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1b1b1b';
    for (let i = -4; i < 12; i++) { ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(w, i * 32 - 40); ctx.lineTo(w, i * 32 - 20); ctx.lineTo(0, i * 32 + 20); ctx.fill(); }
  });
  stripes.wrapS = stripes.wrapT = THREE.RepeatWrapping;
  for (const r of RAMPS) {
    const g = new THREE.Group();
    g.position.set(r.x, 0, r.z);
    g.rotation.y = r.heading;
    // wedge: a sloped deck and two side walls (local +z = up-slope direction)
    const slope = Math.hypot(r.len, r.height);
    const deck = part(new THREE.BoxGeometry(r.width, 0.18, slope), toon(0xffffff, { map: stripes }), { outline: 0.03 });
    deck.rotation.x = -Math.atan2(r.height, r.len);
    deck.position.set(0, r.height / 2 - 0.05, 0);
    g.add(deck);
    const sideShape = new THREE.Shape([new THREE.Vector2(-r.len / 2, 0), new THREE.Vector2(r.len / 2, 0), new THREE.Vector2(r.len / 2, r.height)]);
    const sideGeo = new THREE.ExtrudeGeometry(sideShape, { depth: 0.12, bevelEnabled: false });
    for (const sx of [-1, 1]) {
      const side = part(sideGeo, 0x5a6068, { outline: 0.02 });
      side.rotation.y = -Math.PI / 2;
      side.position.set(sx * (r.width / 2) + (sx > 0 ? 0.12 : 0), 0, 0);
      g.add(side);
    }
    // chequered flags at the lip
    for (const sx of [-1, 1]) {
      const pole = part(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), 0xffffff, { outline: 0.01 });
      pole.position.set(sx * (r.width / 2 + 0.4), 1.2, r.len / 2);
      g.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshBasicMaterial({ map: chequer(), side: THREE.DoubleSide }));
      flag.position.set(sx * (r.width / 2 + 0.8), 2.2, r.len / 2);
      g.add(flag);
    }
    group.add(g);
  }
  return group;
}

let _chequer;
function chequer() {
  _chequer ??= canvasTexture(64, 40, (ctx, w, h) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) { ctx.fillStyle = (x + y) % 2 ? '#111' : '#fff'; ctx.fillRect(x * w / 6, y * h / 4, w / 6, h / 4); }
  });
  return _chequer;
}
