import * as THREE from 'three';
import { buildWorld, cameraBlockers } from './world.js';
import { buildBeach } from './beach.js';
import { Player, Input, FollowCamera } from './player.js';
import { MissionSystem } from './missions.js';
import { MiniGame } from './minigame.js';
import { HUD } from './hud.js';
import { initAudio, sfx, engine, siren } from './audio.js';
import { Ambulance, PARKING } from './vehicle.js';
import { buildHospital, INTERIOR, isInside, makeGate } from './hospital.js';
import { DoorNurses } from './nurses.js';
import { buildRoad, buildZoo, inZoo, ZOO } from './zoo.js';
import { BigMap } from './map.js';
import { loadDoctorModel } from './doctorModel.js';
import { preloadKids } from './kidModels.js';

const isTouch = document.documentElement.classList.contains('touch'); // decided by the inline script in index.html

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2)); // phones: fewer pixels, steadier frame rate
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const outdoorFog = new THREE.Fog(0xc4ecff, 90, 220);
scene.fog = outdoorFog;

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 900);

// Lighting: bright cartoon daylight
scene.add(new THREE.HemisphereLight(0xdff2ff, 0x6cc24a, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
const sc = sun.shadow.camera;
sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 150;
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(sun.target);

const { world: park, base, animated, swingSeats } = buildWorld(scene);
const OUTDOOR_BG = null, INDOOR_BG = new THREE.Color(0x2c3a4c);
let hospital = null; // the interior, built once the kids (and the nurse) have loaded
let nurses = null; // nurses who come out when they hear the siren
// A blue gate in the hospital doorway so you can see you can go inside
const entryGate = makeGate(0x3fa9ff, '🏥 ENTER', { width: 4.4, height: 3.5, labelY: 6.4, labelSize: 4 }); // label clears the canopy
entryGate.group.position.set(0, 0, -46.75);
park.add(entryGate.group);
animated.push(entryGate);
const beach = buildBeach(scene);
const road = buildRoad(scene);
let zoo = null; // built (with its Meshy animals) during loading
animated.push(...beach.animated);
const input = new Input(canvas);
if (isTouch) input.distance = 9.5; // a bit further out on small screens
const player = new Player(scene);
// Use the generated, rigged Doctor Guy when assets/doctor-guy/ has one; otherwise keep the procedural model.
const doctorReady = loadDoctorModel()
  .then((rig) => { if (rig) { player.setRig(rig); console.info('[doctor] generated model loaded, clips:', rig.clips.join(', ')); } })
  .catch((e) => console.warn('[doctor] generated model failed to load, using procedural model', e));
const ambulance = new Ambulance(scene);
const ambulanceReady = ambulance.loadModel().catch((e) => console.warn('[ambulance] model failed, using the blocky van', e));
const follow = new FollowCamera(camera);
follow.blockers = cameraBlockers;
const hud = new HUD();
const minigame = new MiniGame();

let started = false;

/* ---- Getting in and out of the ambulance ---- */
const setButtons = (driving) => {
  document.documentElement.classList.toggle('driving', driving);
  document.getElementById('btn-jump').textContent = driving ? '🚨' : '⤒';
  document.getElementById('btn-action').textContent = driving ? '🚪' : '✋';
};
function enterAmbulance() {
  ambulance.driving = true;
  player.rig.root.visible = false; // a kid on his shoulders rides along (hidden with him)
  player.vel.set(0, 0, 0);
  sfx.door();
  engine.start();
  setButtons(true);
  const patient = missions?.missions.find((m) => m.state === 'carried');
  if (patient) {
    // emergency run: siren on, head for the drop-off
    ambulance.siren = true;
    siren.on();
    hud.toast(`🚑 ${patient.def.name} is in the ambulance — siren on!<br><small>${isTouch ? 'Joystick to drive' : 'W/S drive · A/D steer'} · park at the drop-off to hand over</small>`, 3000);
  } else {
    hud.toast(isTouch ? '🚑 Joystick to drive · 🚨 siren · 🚪 get out' : '🚑 W/S drive · A/D steer · SPACE siren · E get out', 2600);
  }
}
function exitAmbulance(force = false) {
  if (!force && Math.abs(ambulance.speed) > 2.5) { hud.toast('Stop first! 🛑', 1000); return; }
  ambulance.driving = false;
  ambulance.speed = 0;
  if (ambulance.siren) { ambulance.siren = false; siren.off(); }
  player.pos.copy(ambulance.doorPoint);
  player.collide();
  player.facing = ambulance.heading;
  player.rig.root.visible = true;
  sfx.door();
  engine.stop();
  setButtons(false);
}
function vehicleAction() {
  if (ambulance.driving) return { label: 'Get out of the ambulance', run: exitAmbulance };
  const p = player.pos;
  // close to the driver's door, or anywhere right next to the van
  const nearDoor = Math.hypot(p.x - ambulance.doorPoint.x, p.z - ambulance.doorPoint.z) < 2.6;
  const local = p.clone().sub(ambulance.pos);
  const along = local.dot(ambulance.forward), across = local.dot(ambulance.right);
  const beside = Math.abs(along) < 4.2 && Math.abs(across) < ambulance.width / 2 + 1.6;
  return nearDoor || beside ? { label: 'Drive the ambulance 🚑', run: enterAmbulance } : null;
}
/* ---- Going in and out of the hospital (fade, then teleport between the outside and the interior) ---- */
let transitioning = false;
function fadeTo(fn) {
  if (transitioning) return;
  transitioning = true;
  const fade = document.getElementById('fade');
  fade.classList.add('on');
  setTimeout(() => {
    fn();
    follow.target.copy(player.pos).y += 1.8;
    follow.dist = null;
    setTimeout(() => { fade.classList.remove('on'); transitioning = false; }, 120);
  }, 360);
}
function enterHospital() {
  fadeTo(() => {
    player.pos.copy(INTERIOR.entry);
    player.vel.set(0, 0, 0);
    player.facing = Math.PI; // facing into the lobby
    input.yaw = 0; // camera behind him (south)
    sfx.door();
    hospital.greet();
  });
}
function leaveHospital() {
  fadeTo(() => {
    player.pos.copy(INTERIOR.exitTo);
    player.vel.set(0, 0, 0);
    player.facing = 0; // facing the park
    input.yaw = Math.PI;
    sfx.door();
  });
}
/** What E / ✋ does when there's no kid to help: doors, then the ambulance. */
function extraAction() {
  if (ambulance.driving) return vehicleAction();
  const p = player.pos;
  if (isInside(p)) {
    return Math.hypot(p.x - INTERIOR.exitDoor.x, p.z - INTERIOR.exitDoor.z) < 2.4 ? { label: 'Leave the hospital 🚪', run: leaveHospital } : null;
  }
  if (hospital && Math.hypot(p.x - INTERIOR.frontDoor.x, p.z - INTERIOR.frontDoor.z) < 2.6) {
    return { label: 'Enter the hospital 🏥', run: enterHospital };
  }
  return vehicleAction();
}

function resetAmbulance() {
  if (ambulance.driving) exitAmbulance();
  ambulance.speed = 0;
  ambulance.pos.set(PARKING.x, 0, PARKING.z);
  ambulance.heading = PARKING.heading;
  ambulance.syncTransform();
}

const ui = {
  isDriving: () => ambulance.driving,
  vehicle: () => ambulance,
  exitVehicle: (force) => exitAmbulance(force),
  vehicleAction,
  extraAction,
  get hospital() { return hospital; },
  get zoo() { return zoo; },
  onHospitalHandover: () => nurses?.escort(),
  swingSeats,
  minigame,
  toast: (h, ms) => hud.toast(h, ms),
  prompt: (l) => hud.prompt(l),
  onFinished: () => {
    sfx.fanfare();
    const mins = Math.floor(missions.time / 60), secs = Math.floor(missions.time % 60);
    document.getElementById('end-stats').innerHTML =
      `🍭 <b>${missions.lollipops}</b> lollipops · ⏱️ ${mins}:${String(secs).padStart(2, '0')}<br><small>More of Wolfson City coming soon…</small>`;
    document.getElementById('end').classList.remove('hidden');
    hud.show(false);
    started = false;
    resetAmbulance();
  },
};
let missions = null; // created once the kids have loaded (see bottom)

function start() {
  initAudio();
  document.getElementById('title').classList.add('hidden');
  document.getElementById('end').classList.add('hidden');
  hud.show(true);
  started = true;
  hud.toast('Your shift begins!<br><small>The beach is through the park’s south gate 🏖️</small>', 3000);
}
document.getElementById('start').addEventListener('click', () => { if (missions) start(); });
document.getElementById('restart').addEventListener('click', () => {
  resetAmbulance();
  nurses?.reset();
  hospital?.showFilm('off');
  if (isInside(player.pos)) player.pos.copy(INTERIOR.exitTo);
  player.reset();
  missions.reset();
  start();
});

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// Debug hook for automated checks
window.__game = { player, missions, input, scene, minigame, follow, renderer, ui, ambulance };

const TITLE_VIEW = { pos: new THREE.Vector3(0, 0, 4) }; // fountain area
// GTA-style map (M / tap the radar) — the game pauses while it's open
const bigMap = new BigMap(hud.radar, () => ({ player, missions, ambulance }));
bigMap.enabled = () => started && !minigame.active && !transitioning;
// waypoint marker in the world: a tall yellow beam with a ring
const wpBeam = new THREE.Group();
wpBeam.add(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, depthWrite: false })));
wpBeam.children[0].position.y = 15;
const wpRing = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.9, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, depthWrite: false }));
wpRing.rotation.x = -Math.PI / 2;
wpRing.position.y = 0.05;
wpBeam.add(wpRing);
wpBeam.visible = false;
scene.add(wpBeam);

const clock = new THREE.Clock();
let t = 0;
function frame() {
  const rawDt = Math.min(clock.getDelta(), 1 / 20);
  if (bigMap.open) { // paused: keep the map fresh, don't advance the world
    bigMap.draw();
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }
  const dt = rawDt;
  t += dt;
  for (const a of animated) a.update(t, dt);

  if (started && ambulance.driving) {
    input.enabled = true;
    const k = (...c) => (input.down(...c) ? 1 : 0);
    const stick = input.stick ?? { x: 0, y: 0 };
    const stickOn = Math.hypot(stick.x, stick.y) > 0.15;
    const throttle = THREE.MathUtils.clamp(k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown') + (stickOn ? -stick.y : 0), -1, 1);
    const steer = THREE.MathUtils.clamp(k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft') + (stickOn ? stick.x : 0), -1, 1);
    if (input.hit('Space')) { ambulance.siren = !ambulance.siren; ambulance.siren ? siren.on() : siren.off(); }
    ambulance.update(dt, t, { throttle, steer });
    engine.set(ambulance.speed);
    // Doctor Guy rides inside: zones, spawning, lollipops and the minimap follow the van
    player.pos.copy(ambulance.pos);
    player.vel.set(0, 0, 0);
    player.facing = ambulance.heading;
    missions.update(dt, t, input);
    hud.update(missions, player, ambulance, input.yaw);
  } else if (started) {
    ambulance.update(dt, t, {});
    input.enabled = !minigame.active;
    const wasGround = player.onGround;
    player.update(dt, t, input);
    if (wasGround && !player.onGround && player.vel.y > 0) sfx.jump();
    missions.update(dt, t, input);
    minigame.update(dt);
    hud.update(missions, player, ambulance, input.yaw);
  } else {
    // Title screen: slow orbit around the park
    input.yaw += dt * 0.08;
    player.update(dt, t, { down: () => false, hit: () => false, yaw: input.yaw });
  }
  // Title screen: orbit high above the middle of the park (orbiting Doctor Guy at the hospital door put
  // the camera inside the hospital for the first seconds — the old "black background" on start-up)
  if (started && ambulance.driving) {
    // swing round behind the van unless you've just looked around yourself
    if (performance.now() - (input.lastLook ?? 0) > 1500) {
      const want = ambulance.heading + Math.PI;
      input.yaw += Math.atan2(Math.sin(want - input.yaw), Math.cos(want - input.yaw)) * Math.min(1, dt * 2.5);
    }
    follow.update(dt, ambulance, { yaw: input.yaw, pitch: Math.max(input.pitch, 0.32), distance: Math.max(input.distance, 12) });
  } else if (started && isInside(player.pos)) {
    // indoors: look down into the rooms over the (roofless) walls
    follow.update(dt, player, { yaw: input.yaw, pitch: Math.max(input.pitch, 0.78), distance: THREE.MathUtils.clamp(input.distance, 6, 11) });
  } else if (started) follow.update(dt, player, input);
  else follow.update(dt, TITLE_VIEW, { yaw: input.yaw, pitch: 0.42, distance: 30 });

  // Streaming: only draw a zone's props when you're near it (the sea/sand horizon always stays)
  const inside = isInside(player.pos);
  if (started) nurses?.update(dt, t, { inside });
  park.visible = !inside && player.pos.z < 105;
  beach.group.visible = !inside && player.pos.z > 25;
  beach.sea.visible = !inside;
  road.group.visible = !inside;
  if (zoo) zoo.group.visible = !inside && player.pos.x > 70;
  base.visible = !inside;
  ambulance.root.visible = !inside;
  if (hospital) hospital.group.visible = inside;
  scene.background = inside ? INDOOR_BG : OUTDOOR_BG;
  scene.fog = inside ? null : outdoorFog;

  // waypoint beam (mission waypoints follow the patient; hospital ones show at the doors)
  const wp = hud.radar.waypointPos();
  wpBeam.visible = !!wp && started && (isInside(player.pos) === (wp.z < -300));
  if (wp) {
    wpBeam.position.set(wp.x, 0, wp.z);
    wpRing.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
  }

  // Keep shadows centred on the player
  sun.position.set(player.pos.x + 30, 50, player.pos.z + 20);
  sun.target.position.set(player.pos.x, 0, player.pos.z);

  renderer.render(scene, camera);
  input.endFrame();
  requestAnimationFrame(frame);
}
// Start drawing the park straight away (behind the title) while the characters finish loading
frame();

// Characters load in parallel; the Start button unlocks when they're in
await Promise.all([doctorReady, preloadKids(), ambulanceReady]); // kids fall back to procedural ones per look
hospital = await buildHospital(scene);
zoo = await buildZoo(scene);
animated.push(...zoo.animated);
animated.push(...hospital.animated);
hud.plan = hospital.plan;
nurses = new DoorNurses(scene, ambulance, {
  onCallout: () => hud.toast('🏥 The nurses heard the siren — they’re coming out to meet you!', 2600),
});
missions = new MissionSystem(scene, player, ui);
window.__game.missions = missions;
window.__game.hospital = hospital;
window.__game.nurses = nurses;
window.__game.zoo = zoo;
window.__game.bigMap = bigMap;
window.__game.hud = hud;
window.__game.enterHospital = enterHospital;
window.__game.leaveHospital = leaveHospital;
// Compile every shader now (phones can take seconds on the first draw) so the backdrop only fades
// once the park can actually be shown — no empty/black screen behind the title.
await renderer.compileAsync(scene, camera).catch(() => {});
await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); // two real frames drawn
requestAnimationFrame(() => {
  document.documentElement.classList.remove('loading'); // fade the painted backdrop to the live 3D park
  const btn = document.getElementById('start');
  btn.disabled = false;
  btn.textContent = 'Start shift';
});
