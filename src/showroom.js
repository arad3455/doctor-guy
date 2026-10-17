// Ilan Motors — inside. Through the blue portal in the showroom's glass front you arrive in the real thing: a grand
// hall far bigger than the building outside (like the hospital, it lives in its own space, at z ≈ 700). A red carpet
// to the hero car on a raised turntable under a ring chandelier, every car in the catalogue on its own lit turntable
// with a plaque, marble columns with gold bands, a gold ILAN MOTORS wall and a video wall, a lounge with leather
// sofas and a coffee bar, Ilan's glass office, velvet ropes. Stand by a car and press E to buy it (or take it out).
import * as THREE from 'three';
import { part, toon, canvasTexture, FONT } from './toon.js';
import { addBox, addCircle, addWalkable, cameraBlockers } from './world.js';
import { makeGate } from './hospital.js';
import { CARS, loadCarModel, dressCar, CAR_LENGTH, CAR_YAW, studioEnv } from './dealership.js';

export const SHOWROOM = {
  origin: new THREE.Vector3(0, 0, 700),
  halfX: 34, halfZ: 25, H: 9,
};
const O = SHOWROOM.origin;
SHOWROOM.entry = new THREE.Vector3(O.x, 0, O.z + 17.5); // where you appear, facing north into the hall
SHOWROOM.exitDoor = new THREE.Vector3(O.x, 0, O.z + 23.2);
export const inShowroom = (p) => p.z > 500;

// where the cars stand: the hero in the middle, the rest round the hall (relative to the origin)
const SLOTS = [
  [0, -6, 'hero'],
  [-25, -17], [-25, -7], [-25, 3], [25, -17], [25, -7], [25, 3],
  [-11, -19], [11, -19], [-11, -8], [11, -8], [-12, 10], [12, 10],
];

export function buildShowroom(scene, renderer) {
  const group = new THREE.Group();
  group.name = 'showroom';
  group.visible = false;
  scene.add(group);
  const { halfX: HX, halfZ: HZ, H } = SHOWROOM;
  const at = (x, z) => new THREE.Vector3(O.x + x, 0, O.z + z);
  const env = studioEnv(renderer);
  const animated = [];
  addWalkable({ minX: O.x - HX + 0.6, maxX: O.x + HX - 0.6, minZ: O.z - HZ + 0.6, maxZ: O.z + HZ - 0.6 });

  // ---- floor: black marble tiles, polished (reflections from the studio env)
  const marble = canvasTexture(512, 512, (c) => {
    c.fillStyle = '#16171b'; c.fillRect(0, 0, 512, 512);
    const rnd = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    c.strokeStyle = 'rgba(200,200,215,0.10)'; c.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) { c.beginPath(); let x = rnd() * 512, y = rnd() * 512; c.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (rnd() - 0.5) * 120; y += (rnd() - 0.5) * 120; c.lineTo(x, y); } c.stroke(); }
    c.strokeStyle = '#2c2d33'; c.lineWidth = 3;
    for (let k = 0; k <= 512; k += 256) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, 512); c.moveTo(0, k); c.lineTo(512, k); c.stroke(); }
  });
  marble.wrapS = marble.wrapT = THREE.RepeatWrapping;
  marble.repeat.set(HX / 4, HZ / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2), new THREE.MeshStandardMaterial({ map: marble, roughness: 0.34, metalness: 0.15, envMap: env, envMapIntensity: 0.22 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.copy(at(0, 0));
  floor.receiveShadow = true;
  group.add(floor);
  // the red carpet, from the door to the hero car
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3.4, HZ + 2), toon(0xa3151d));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.copy(at(0, (HZ - 2) / 2 + 0.5)).setY(0.02);
  group.add(carpet);
  for (const s of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.12, HZ + 2), new THREE.MeshBasicMaterial({ color: 0xe0b44a }));
    edge.rotation.x = -Math.PI / 2;
    edge.position.copy(at(s * 1.7, (HZ - 2) / 2 + 0.5)).setY(0.025);
    group.add(edge);
  }

  // ---- walls: charcoal panels with lit gold seams, a gold name wall, a video wall
  const panelTex = canvasTexture(512, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#24262c'); g.addColorStop(1, '#1a1b20');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e0b44a'; for (let x = 0; x < w; x += 128) c.fillRect(x, 0, 3, h);
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(0, h * 0.62, w, 2);
  });
  panelTex.wrapS = THREE.RepeatWrapping;
  const wallMat = (len) => { const t = panelTex.clone(); t.needsUpdate = true; t.repeat.set(len / 12, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.2, envMap: env, envMapIntensity: 0.3, side: THREE.DoubleSide }); };
  const wall = (len, x, z, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, H), wallMat(len));
    m.position.copy(at(x, z)).setY(H / 2);
    m.rotation.y = rot;
    group.add(m);
    cameraBlockers.push(m); // the follow camera stays inside the hall
  };
  wall(HX * 2, 0, -HZ, 0);
  wall(HZ * 2, -HX, 0, Math.PI / 2);
  wall(HZ * 2, HX, 0, -Math.PI / 2);
  wall(HX - 4, -(HX + 4) / 2, HZ, Math.PI);
  wall(HX - 4, (HX + 4) / 2, HZ, Math.PI);
  const lintel = new THREE.Mesh(new THREE.PlaneGeometry(8, H - 5), wallMat(8));
  lintel.position.copy(at(0, HZ)).setY(5 + (H - 5) / 2);
  lintel.rotation.y = Math.PI;
  group.add(lintel);
  cameraBlockers.push(lintel);
  const doorStop = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), new THREE.MeshBasicMaterial({ visible: false }));
  doorStop.position.copy(at(0, HZ + 0.2)).setY(2.5);
  group.add(doorStop);
  cameraBlockers.push(doorStop); // (invisible: keeps the camera from backing out through the doorway)
  for (const [x0, z0, x1, z1] of [[-HX, -HZ, HX, -HZ], [-HX, -HZ, -HX, HZ], [HX, -HZ, HX, HZ], [-HX, HZ, -4, HZ], [4, HZ, HX, HZ]]) {
    addBox(O.x + (x0 + x1) / 2, O.z + (z0 + z1) / 2, Math.max(0.4, Math.abs(x1 - x0)), Math.max(0.4, Math.abs(z1 - z0)));
  }
  // the gold name over the back wall, and a skirting of light all round
  const name = new THREE.Mesh(new THREE.PlaneGeometry(24, 3.6), new THREE.MeshBasicMaterial({ map: goldText('ILAN MOTORS', 1600, 240, 200), transparent: true }));
  name.position.copy(at(0, -HZ + 0.05)).setY(H - 2);
  group.add(name);
  const sub = new THREE.Mesh(new THREE.PlaneGeometry(14, 1), new THREE.MeshBasicMaterial({ map: goldText('EST. WOLFSON CITY · EXCEPTIONAL CARS', 1400, 100, 64), transparent: true }));
  sub.position.copy(at(0, -HZ + 0.05)).setY(H - 4.2);
  group.add(sub);
  for (const [len, x, z, rot] of [[HX * 2, 0, -HZ + 0.06, 0], [HZ * 2, -HX + 0.06, 0, Math.PI / 2], [HZ * 2, HX - 0.06, 0, -Math.PI / 2]]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.12), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    strip.position.copy(at(x, z)).setY(0.35);
    strip.rotation.y = rot;
    group.add(strip);
  }
  // the video wall (left wall): a slow slideshow of the collection
  const vw = canvasTexture(1024, 512, () => {});
  const vwMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: vw }));
  vwMesh.position.copy(at(-HX + 0.2, -2)).setY(4.6); // (in front of its frame)
  vwMesh.rotation.y = Math.PI / 2;
  group.add(vwMesh);
  const frame = part(new THREE.BoxGeometry(0.3, 7.5, 14.5), 0x0d0e11, { outline: 0 });
  frame.position.copy(at(-HX + 0.02, -2)).setY(4.6);
  group.add(frame);
  let slide = -1;
  animated.push({ update: (t) => {
    if (!group.visible) return;
    const k = Math.floor(t / 5) % CARS.length;
    if (k === slide) return;
    slide = k;
    drawSlide(vw.image.getContext('2d'), CARS[k], vw.image.width, vw.image.height);
    vw.needsUpdate = true;
  } });

  // ---- ceiling: dark coffers with light strips, a ring chandelier over the hero
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2), toon(0x111216, { side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.copy(at(0, 0)).setY(H);
  group.add(ceil);
  cameraBlockers.push(ceil); // (zoomed right out, the camera stops under the ceiling)
  for (let x = -HX + 6; x <= HX - 6; x += 12) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, HZ * 2 - 6), new THREE.MeshBasicMaterial({ color: 0xfff4dc }));
    s.position.copy(at(x, 0)).setY(H - 0.1);
    group.add(s);
  }
  const chand = new THREE.Group();
  chand.position.copy(at(SLOTS[0][0], SLOTS[0][1])).setY(H - 1.6);
  for (const [r, y] of [[5.2, 0], [3.8, -0.6], [2.4, -1.1]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 8, 64), new THREE.MeshBasicMaterial({ color: 0xfff1cf }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    chand.add(ring);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, w = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.6, 4), new THREE.MeshBasicMaterial({ color: 0xbfa060 }));
    w.position.set(Math.cos(a) * 5.2, 0.8, Math.sin(a) * 5.2);
    chand.add(w);
  }
  group.add(chand);
  animated.push({ update: (t) => { chand.rotation.y = t * 0.05; } });

  // ---- columns: white marble, gold bands
  for (const [x, z] of [[-17, -12], [17, -12], [-17, 4], [17, 4], [-17, 18], [17, 18]]) {
    const col = part(new THREE.CylinderGeometry(0.7, 0.75, H, 24), 0xf1efe9, { outline: 0 });
    col.material = new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.2, metalness: 0.05, envMap: env, envMapIntensity: 0.6 });
    col.position.copy(at(x, z)).setY(H / 2);
    group.add(col);
    for (const y of [0.4, H - 0.5, 3.2]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.2, 24), new THREE.MeshStandardMaterial({ color: 0xd9a940, roughness: 0.2, metalness: 0.9, envMap: env }));
      band.position.copy(at(x, z)).setY(y);
      group.add(band);
    }
    addCircle(O.x + x, O.z + z, 0.85);
  }

  // ---- the turntables and plaques
  const tables = SLOTS.map(([x, z, kind], i) => {
    const hero = kind === 'hero';
    const r = hero ? 4.6 : 3.4, h = hero ? 0.55 : 0.22;
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.1, h, 48), new THREE.MeshStandardMaterial({ color: hero ? 0x1b1c20 : 0x5d636c, roughness: 0.3, metalness: 0.5, envMap: env, envMapIntensity: 0.6 }));
    plat.position.copy(at(x, z)).setY(h / 2);
    plat.receiveShadow = true;
    group.add(plat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.05, 6, 64), new THREE.MeshBasicMaterial({ color: hero ? 0xe0b44a : 0x9fe3ff }));
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(at(x, z)).setY(h - 0.02);
    group.add(ring);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, H - 1, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3d0, transparent: true, opacity: hero ? 0.05 : 0.03, depthWrite: false, side: THREE.FrontSide }));
    cone.position.copy(at(x, z)).setY((H - 1) / 2);
    group.add(cone);
    addCircle(O.x + x, O.z + z, r - 0.4);
    const turner = new THREE.Group();
    turner.position.copy(at(x, z)).setY(h);
    turner.userData.dynamic = true;
    group.add(turner);
    // the plaque faces the aisle (towards the hall's centre line)
    const toward = new THREE.Vector3(-x, 0, x === 0 ? 1 : 0).normalize();
    const pq = at(x, z).addScaledVector(toward, r + 0.9);
    const plaque = new THREE.Group();
    plaque.position.copy(pq);
    plaque.rotation.y = Math.atan2(toward.x, toward.z);
    const post = part(new THREE.BoxGeometry(0.12, 1, 0.12), 0x111216, { outline: 0 });
    post.position.y = 0.5;
    plaque.add(post);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    board.position.set(0, 1.25, 0.02);
    board.rotation.x = -0.35;
    plaque.add(board);
    const backing = part(new THREE.BoxGeometry(1.66, 0.96, 0.04), 0x111216, { outline: 0 });
    backing.position.set(0, 1.25, -0.01);
    backing.rotation.x = -0.35;
    plaque.add(backing);
    group.add(plaque);
    addCircle(pq.x, pq.z, 0.25);
    return { i, x: O.x + x, z: O.z + z, r, hero, turner, board, stand: pq.clone().addScaledVector(toward, 0.8), face: Math.atan2(-toward.x, -toward.z) };
  });
  animated.push({ update: (t) => { if (group.visible) tables.forEach((tt, i) => { tt.turner.rotation.y = t * (tt.hero ? 0.18 : 0.12) + i * 0.9; }); } });
  // velvet ropes round the hero
  const hero = tables[0];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    if (Math.sin(a) > 0.9) continue; // a gap on the carpet side (south)
    const px = hero.x + Math.cos(a) * 6.2, pz = hero.z + Math.sin(a) * 6.2;
    const post = part(new THREE.CylinderGeometry(0.06, 0.12, 1, 10), 0xd9a940, { outline: 0 });
    post.material = new THREE.MeshStandardMaterial({ color: 0xd9a940, metalness: 0.9, roughness: 0.25, envMap: env });
    post.position.set(px, 0.5, pz);
    group.add(post);
    const b = (((i + 1) / 10) * Math.PI * 2);
    if (Math.sin(b) > 0.9) continue;
    const qx = hero.x + Math.cos(b) * 6.2, qz = hero.z + Math.sin(b) * 6.2;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(px, 0.9, pz), new THREE.Vector3((px + qx) / 2, 0.65, (pz + qz) / 2), new THREE.Vector3(qx, 0.9, qz));
    const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.04, 6), toon(0x8a1018));
    group.add(rope);
  }

  // ---- the lounge (front left): leather sofas round a coffee table, a coffee bar, plants
  const leather = 0x6b3418;
  const sofa = (x, z, rot) => {
    const g = new THREE.Group();
    g.position.copy(at(x, z));
    g.rotation.y = rot;
    const seat = part(new THREE.BoxGeometry(3, 0.5, 1.1), leather, { outline: 0.01 }); seat.position.y = 0.45; g.add(seat);
    const back = part(new THREE.BoxGeometry(3, 0.9, 0.3), leather, { outline: 0.01 }); back.position.set(0, 0.9, -0.45); g.add(back);
    for (const s of [-1, 1]) { const arm = part(new THREE.BoxGeometry(0.3, 0.75, 1.1), leather, { outline: 0.01 }); arm.position.set(s * 1.5, 0.6, 0); g.add(arm); }
    group.add(g);
    addBox(O.x + x, O.z + z, Math.abs(Math.cos(rot)) * 3.2 + Math.abs(Math.sin(rot)) * 1.2, Math.abs(Math.sin(rot)) * 3.2 + Math.abs(Math.cos(rot)) * 1.2);
  };
  sofa(-27, 21.5, Math.PI); sofa(-30.5, 18, Math.PI / 2); sofa(-23.5, 18, -Math.PI / 2);
  const table = part(new THREE.CylinderGeometry(1, 1, 0.08, 24), 0x111216, { outline: 0 });
  table.material = new THREE.MeshStandardMaterial({ color: 0x111216, roughness: 0.05, metalness: 0.3, envMap: env });
  table.position.copy(at(-27, 18)).setY(0.5);
  group.add(table);
  const leg = part(new THREE.CylinderGeometry(0.1, 0.25, 0.5, 10), 0xd9a940, { outline: 0 }); leg.position.copy(at(-27, 18)).setY(0.25); group.add(leg);
  addCircle(O.x - 27, O.z + 18, 1);
  // coffee bar
  const bar = part(new THREE.BoxGeometry(6, 1.1, 1), 0xf1efe9, { outline: 0.01 });
  bar.position.copy(at(-26, 9.5)).setY(0.55);
  group.add(bar);
  const barTop = part(new THREE.BoxGeometry(6.2, 0.08, 1.2), 0x111216, { outline: 0 }); barTop.position.copy(at(-26, 9.5)).setY(1.14); group.add(barTop);
  const machine = part(new THREE.BoxGeometry(0.9, 0.6, 0.5), 0xbfc4ca, { outline: 0.01 }); machine.position.copy(at(-27.5, 9.4)).setY(1.48); group.add(machine);
  for (let k = 0; k < 3; k++) { const cup = part(new THREE.CylinderGeometry(0.08, 0.06, 0.12, 10), 0xffffff, { outline: 0 }); cup.position.copy(at(-25.6 + k * 0.4, 9.5)).setY(1.24); group.add(cup); }
  const barSign = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.7), new THREE.MeshBasicMaterial({ map: goldText('ESPRESSO BAR', 600, 140, 90), transparent: true }));
  barSign.position.copy(at(-26, 9.0)).setY(3.2);
  group.add(barSign);
  addBox(O.x - 26, O.z + 9.5, 6.2, 1.2);
  // plants in tall pots by the doors and the columns
  for (const [x, z] of [[-6, 22.5], [6, 22.5], [-32, 23], [32, 23], [-32, -23], [32, -23]]) plant(group, at(x, z), env);

  // ---- Ilan's glass office (front right): desk, chair, a trophy
  const office = { x: 27, z: 19 };
  const glass = new THREE.MeshStandardMaterial({ color: 0xa8d8ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.3, envMap: env, depthWrite: false, side: THREE.DoubleSide });
  for (const [w, x, z, rot] of [[12, office.x - 1, office.z - 4.5, 0], [8, office.x - 7, office.z, Math.PI / 2]]) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.2), glass);
    g.position.copy(at(x, z)).setY(1.6);
    g.rotation.y = rot;
    group.add(g);
    addBox(O.x + x, O.z + z, rot ? 0.3 : w, rot ? w : 0.3);
  }
  const desk = part(new THREE.BoxGeometry(3, 0.1, 1.3), 0x111216, { outline: 0 });
  desk.position.copy(at(office.x, office.z)).setY(0.95);
  group.add(desk);
  for (const s of [-1, 1]) { const l = part(new THREE.BoxGeometry(0.1, 0.9, 1.2), 0xd9a940, { outline: 0 }); l.position.copy(at(office.x + s * 1.4, office.z)).setY(0.45); group.add(l); }
  const chair = part(new THREE.BoxGeometry(0.8, 1.4, 0.8), leather, { outline: 0.01 }); chair.position.copy(at(office.x, office.z + 1.3)).setY(0.7); group.add(chair);
  const trophy = part(new THREE.CylinderGeometry(0.18, 0.08, 0.4, 12), 0xd9a940, { outline: 0 });
  trophy.material = new THREE.MeshStandardMaterial({ color: 0xd9a940, metalness: 0.9, roughness: 0.2, envMap: env });
  trophy.position.copy(at(office.x + 1, office.z)).setY(1.2); group.add(trophy);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.6), new THREE.MeshBasicMaterial({ map: goldText('ILAN · OWNER', 700, 100, 70), transparent: true }));
  sign.position.copy(at(office.x - 1, office.z - 4.55)).setY(3.6);
  group.add(sign);
  addBox(O.x + office.x, O.z + office.z, 3.2, 1.6);

  // ---- the way out: a green portal in the doorway
  const exit = makeGate(0x3ccf6a, 'EXIT', { width: 6, height: 4.6, beam: false, labelY: 5.4, labelSize: 1.6 });
  exit.group.position.copy(at(0, HZ - 0.2));
  exit.group.rotation.y = Math.PI;
  group.add(exit.group);
  animated.push(exit);

  return {
    group, animated, tables,
    /** Puts every catalogue car on a turntable (hero first). */
    async addCars() {
      const order = [...CARS].sort((a, b) => (b.price ?? 0) - (a.price ?? 0)); // the priciest is the hero
      await Promise.all(order.slice(0, tables.length).map(async (car, i) => {
        try {
          const m = (await loadCarModel(car.model ?? 'carSuper')).clone(true);
          m.traverse((o) => { if (o.isMesh) o.geometry = o.geometry.clone(); });
          dressCar(m, car, renderer);
          m.rotation.y = CAR_YAW;
          m.updateMatrixWorld(true);
          let box = new THREE.Box3().setFromObject(m);
          const size = box.getSize(new THREE.Vector3());
          m.scale.setScalar(((car.length ?? CAR_LENGTH) * (tables[i].hero ? 1.12 : 1)) / Math.max(size.x, size.z));
          m.updateMatrixWorld(true);
          box = new THREE.Box3().setFromObject(m);
          const c = box.getCenter(new THREE.Vector3());
          m.position.set(-c.x, -box.min.y, -c.z);
          tables[i].turner.add(m);
          tables[i].car = car;
          drawPlaque(tables[i].board, car);
        } catch (e) { console.warn('[showroom] car failed', car.id, e); }
      }));
    },
    /** The car you're standing next to (by its plaque or the platform's edge). */
    carNear(p) {
      let best = null, bd = 3.2;
      for (const t of tables) {
        if (!t.car) continue;
        const d = Math.min(Math.hypot(p.x - t.stand.x, p.z - t.stand.z), Math.hypot(p.x - t.x, p.z - t.z) - t.r);
        if (d < bd) { bd = d; best = t; }
      }
      return best;
    },
    /** Refresh every plaque (owned / for sale). */
    refresh(owned) { for (const t of tables) if (t.car) drawPlaque(t.board, t.car, owned.includes(t.car.id)); },
  };
}

function plant(group, pos, env) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 1.1, 20), new THREE.MeshStandardMaterial({ color: 0x111216, roughness: 0.15, metalness: 0.3, envMap: env }));
  pot.position.copy(pos).setY(0.55);
  group.add(pot);
  for (let k = 0; k < 7; k++) {
    const leaf = part(new THREE.ConeGeometry(0.22, 1.6 + (k % 3) * 0.3, 6), 0x2e8b3c, { outline: 0.006 });
    const a = (k / 7) * Math.PI * 2;
    leaf.position.copy(pos).add(new THREE.Vector3(Math.cos(a) * 0.18, 1.7, Math.sin(a) * 0.18));
    leaf.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    group.add(leaf);
  }
  addCircle(pos.x, pos.z, 0.6);
}

function goldText(text, w, h, size) {
  return canvasTexture(w, h, (c) => {
    c.clearRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffe7a3'); g.addColorStop(0.5, '#e0b44a'); g.addColorStop(1, '#b8862a');
    c.fillStyle = g; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `400 ${size}px Anton, Impact, sans-serif`;
    c.fillText(text, w / 2, h / 2 + size * 0.05);
  });
}

function drawPlaque(board, car, owned = false) {
  const tex = canvasTexture(512, 288, (c, w, h) => {
    c.fillStyle = '#111216'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#e0b44a'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.font = `400 58px Anton, Impact, sans-serif`; c.fillText(car.name, w / 2, 86);
    c.fillStyle = '#9aa3ad'; c.font = `600 28px ${FONT}`; c.fillText(`${car.zero} · ${car.top}`, w / 2, 140);
    c.fillStyle = owned ? '#5be08a' : '#e0b44a'; c.font = `400 64px Anton, Impact, sans-serif`;
    c.fillText(owned ? 'YOURS' : `${car.price} LOLLIPOPS`, w / 2, 222);
  });
  board.material.map?.dispose();
  board.material.map = tex;
  board.material.needsUpdate = true;
}

function drawSlide(c, car, w, h) {
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#0d0e11'); g.addColorStop(1, car.swatch ?? car.paint ?? '#e0323a');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, h * 0.62, w, h * 0.38);
  c.fillStyle = '#ffffff'; c.textAlign = 'left';
  c.font = `400 120px Anton, Impact, sans-serif`; c.fillText(car.name.toUpperCase(), 60, h * 0.42);
  c.font = `600 40px ${FONT}`; c.fillText(car.blurb, 60, h * 0.55);
  c.fillStyle = '#e0b44a'; c.font = `400 64px Anton, Impact, sans-serif`;
  c.fillText(`${car.zero}  ·  ${car.top}  ·  ${car.price} LOLLIPOPS`, 60, h * 0.82);
}
