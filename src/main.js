import * as THREE from 'three';
import { buildWorld, cameraBlockers } from './world.js';
import * as worldApi from './world.js';
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
import { buildDowntown } from './downtown.js';
import { buildSuburbs } from './suburbs.js';
import { buildPier, FAIR } from './pier.js';
import { loadKits } from './kit.js';
import { BigMap } from './map.js';
import { Career, achievementToast } from './career.js';
import { Progress, SHOP, SHOP_CATS, ACHIEVEMENTS } from './progress.js';
import { WORLD } from './world.js';
import { DayNight } from './daynight.js';
import { buildRamps, RAMPS } from './stunts.js';
import { Frenzy, FRENZY_TOKEN } from './frenzy.js';
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
const hemi = new THREE.HemisphereLight(0xdff2ff, 0x6cc24a, 1.1);
scene.add(hemi);
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
let downtown = null; // Zone 4, west of the park
let suburbs = null; // Zone 5, Maple Heights (south of Zoo Road)
let pier = null; // Zone 6, Sunset Pier
let road = null; // Zoo Road, built from Kenney's road kit once the kits have loaded
let zoo = null; // built (with its Meshy animals) during loading
animated.push(...beach.animated);
const input = new Input(canvas);
if (isTouch) input.distance = 9.5; // a bit further out on small screens
const player = new Player(scene);
// Use the generated, rigged Doctor Guy when assets/doctor-guy/ has one; otherwise keep the procedural model.
const doctorReady = loadDoctorModel()
  .then((rig) => { if (rig) { player.setRig(rig); applyCosmetics(); console.info('[doctor] generated model loaded, clips:', rig.clips.join(', ')); } })
  .catch((e) => console.warn('[doctor] generated model failed to load, using procedural model', e));
const ambulance = new Ambulance(scene);
const ramps = buildRamps(scene);
let skyMat = null;
base.traverse((o) => { if (o.material?.uniforms?.top) skyMat = o.material; });
const dayNight = new DayNight({ scene, sun, hemi, sky: skyMat, fog: outdoorFog, ambulance, startHour: 15.5 });
const ambulanceReady = ambulance.loadModel().catch((e) => console.warn('[ambulance] model failed, using the blocky van', e));
const follow = new FollowCamera(camera);
follow.blockers = cameraBlockers;
const hud = new HUD();
const minigame = new MiniGame();

let started = false;
let timeScale = 1; // slow motion for the PATIENT SAVED moment
const progress = new Progress(); // saved in this browser: XP, wallet, lifetime stats, shop, achievements
const career = new Career({ progress, setSlowmo: (v) => { timeScale = v; }, onLollipop: (n) => { if (missions) missions.lollipops += n; } });

/* ---- Stunt jumps ---- */
let stuntCam = 0; // seconds of cinematic camera left
ambulance.onLaunch = (ramp) => {
  if (!ambulance.driving) return;
  timeScale = 0.4; // GTA-style slow motion while airborne
  stuntCam = 99;
  sfx.whoosh();
};
ambulance.onLand = ({ ramp, airtime, distance }) => {
  timeScale = 1;
  stuntCam = 0.6;
  sfx.thud();
  if (!ambulance.driving || airtime < 0.35) return;
  const unique = !progress.data.stunts?.[ramp.id];
  progress.data.stunts = { ...(progress.data.stunts ?? {}), [ramp.id]: Date.now() };
  progress.dirty = true;
  career.stunt({ name: ramp.name, distance: distance / 1.36, airtime, unique, found: Object.keys(progress.data.stunts).length, total: RAMPS.length });
};

/* ---- Doctor Shop + cosmetics ---- */
function applyCosmetics() {
  const rig = player.rig;
  rig.setHat?.(progress.item('hat')?.id ?? null);
  rig.setCape?.(!!progress.item('cape'));
  const st = progress.item('steth');
  rig.setStethoscope?.(st ? (st.rainbow ? 'rainbow' : st.color) : null);
  ambulance.setPaint(progress.item('paint')?.tint ?? null);
  siren.tone = progress.item('siren')?.tone ?? 'classic';
}
let shopTab = 'hat';
const shopEl = document.getElementById('shop');
function renderShop() {
  document.getElementById('shop-wallet').textContent = missions?.lollipops ?? progress.wallet;
  document.getElementById('shop-tabs').innerHTML = SHOP_CATS.map(([c, label]) => `<button data-tab="${c}" class="${c === shopTab ? 'on' : ''}">${label}</button>`).join('');
  document.getElementById('shop-items').innerHTML = SHOP.filter((i) => i.cat === shopTab).map((i) => {
    const owned = progress.owned.includes(i.id), on = progress.equipped[i.cat] === i.id;
    const wallet = missions?.lollipops ?? progress.wallet;
    const btn = !owned ? `<button data-buy="${i.id}" ${wallet < i.price ? 'disabled' : ''}>🍭 ${i.price}</button>`
      : `<button data-equip="${i.id}" class="${on ? 'equipped' : 'equip'}">${on ? '✓ Wearing' : 'Use'}</button>`;
    return `<div class="item"><span class="ic">${i.icon}</span><b>${i.name}</b><small>${i.note ?? (owned ? 'Owned' : '')}</small>${btn}</div>`;
  }).join('');
}
shopEl.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.tab) { shopTab = t.dataset.tab; renderShop(); }
  if (t.dataset.buy) {
    const item = SHOP.find((i) => i.id === t.dataset.buy);
    progress.wallet = missions.lollipops;
    if (progress.buy(item)) {
      missions.lollipops = progress.wallet;
      progress.equip(item); // wear it right away
      applyCosmetics();
      sfx.buy();
      hud.toast(`🛍️ ${item.icon} ${item.name} — enjoy!`, 1600);
      progress.save(true);
    }
    renderShop();
  }
  if (t.dataset.equip) {
    progress.equip(SHOP.find((i) => i.id === t.dataset.equip));
    applyCosmetics();
    progress.save(true);
    renderShop();
  }
});
const openShop = (v) => { shopEl.classList.toggle('hidden', !v); if (v) renderShop(); };
document.getElementById('shop-close').addEventListener('click', () => openShop(false));

/* ---- Trophy room ---- */
const trophiesEl = document.getElementById('trophies');
function renderTrophies() {
  const got = ACHIEVEMENTS.filter((a) => progress.has(a.id)).length;
  document.getElementById('trophy-count').textContent = `${got}/${ACHIEVEMENTS.length}`;
  document.getElementById('trophy-list').innerHTML = ACHIEVEMENTS.map((a) => `<div class="item ${progress.has(a.id) ? '' : 'locked'}"><span class="ic">${a.icon}</span><b>${a.name}</b><small>${a.desc}</small></div>`).join('');
}
const openTrophies = (v) => { trophiesEl.classList.toggle('hidden', !v); if (v) renderTrophies(); };
document.getElementById('trophies-open').addEventListener('click', () => openTrophies(true));
document.getElementById('trophies-close').addEventListener('click', () => openTrophies(false));
addEventListener('keydown', (e) => { if (e.code === 'Escape') { openShop(false); openTrophies(false); } });

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
  if (frenzy?.available && Math.hypot(p.x - FRENZY_TOKEN.x, p.z - FRENZY_TOKEN.z) < 2.2) {
    return { label: `⚡ Start Check-up Frenzy${progress.data.frenzyBest ? ` (best ${progress.data.frenzyBest})` : ''}`, run: () => frenzy.start() };
  }
  if (Math.hypot(p.x - WORLD.stand.x, p.z - WORLD.stand.z) < 3.4) {
    return { label: '🛍️ Doctor Shop', run: () => openShop(true) };
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
  career,
  progress,
  isDriving: () => ambulance.driving,
  vehicle: () => ambulance,
  exitVehicle: (force) => exitAmbulance(force),
  vehicleAction,
  extraAction,
  get hospital() { return hospital; },
  get zoo() { return zoo; },
  get frenzy() { return frenzy; },
  onHospitalHandover: () => nurses?.escort(),
  swingSeats,
  minigame,
  toast: (h, ms) => hud.toast(h, ms),
  prompt: (l) => hud.prompt(l),
  onFinished: () => {
    // let the last PATIENT SAVED banner finish first
    if (career.showing || career.queue.length) { setTimeout(ui.onFinished, 600); return; }
    sfx.fanfare();
    career.renderStats(missions.total, missions.time);
    progress.add('shifts', 1);
    progress.save(true);
    const got = ACHIEVEMENTS.filter((a) => progress.has(a.id));
    document.getElementById('end-trophies').innerHTML = `🏆 ${got.length}/${ACHIEVEMENTS.length} achievements · ${got.map((a) => `<span title="${a.name}">${a.icon}</span>`).join(' ')}`;
    document.getElementById('end').classList.remove('hidden');
    frenzy.abort();
    hud.show(false);
    started = false;
    updateRotate();
    resetAmbulance();
  },
};
let frenzy = null;
let missions = null; // created once the kids have loaded (see bottom)

// Landscape on phones: Android can go fullscreen and lock it; iPhone can't, so a "turn sideways" card pauses the game
const rotateEl = document.getElementById('rotate');
let portraitOk = false;
try { portraitOk = sessionStorage.getItem('doctorguy.portrait') === '1'; } catch { /* ignore */ }
const portraitQuery = matchMedia('(orientation: portrait)');
function updateRotate() { rotateEl.classList.toggle('hidden', !(isTouch && started && !portraitOk && portraitQuery.matches)); }
portraitQuery.addEventListener?.('change', updateRotate);
addEventListener('resize', updateRotate);
document.getElementById('rotate-skip').addEventListener('click', () => {
  portraitOk = true;
  try { sessionStorage.setItem('doctorguy.portrait', '1'); } catch { /* ignore */ }
  updateRotate();
});
if (/iPhone|iPad|iPod/.test(navigator.userAgent)) rotateEl.classList.add('ios');
async function goLandscape() {
  if (!isTouch || portraitOk) return;
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    await screen.orientation?.lock?.('landscape');
  } catch { /* not supported (iPhone) or refused: the rotate card handles it */ }
}

function start() {
  initAudio();
  goLandscape(); // must run inside the Start tap
  document.getElementById('title').classList.add('hidden');
  document.getElementById('end').classList.add('hidden');
  hud.show(true);
  started = true;
  updateRotate();
  hud.toast(`Your shift begins!<br><small>${isTouch ? 'Tap the radar for the map 🗺️' : 'Press H for controls · M for the map'}</small>`, 3200);
}
document.getElementById('start').addEventListener('click', () => { if (missions) start(); });
// Controls help (computers): ? on the title, H in game
const help = document.getElementById('help');
const showHelp = (v) => help.classList.toggle('hidden', !v);
document.getElementById('help-open').addEventListener('click', () => showHelp(true));
document.getElementById('help-close').addEventListener('click', () => showHelp(false));
addEventListener('keydown', (e) => {
  if (e.code === 'KeyH' || e.key === '?') showHelp(help.classList.contains('hidden'));
  if (e.code === 'Escape') showHelp(false);
});
document.getElementById('restart').addEventListener('click', () => {
  career.reset();
  timeScale = 1;
  resetAmbulance();
  nurses?.reset();
  dayNight.hour = 15.5;
  frenzy?.abort();
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

/**
 * Phone driving, GTA-style and relative to the van (not the camera, which keeps swinging behind it —
 * camera-relative steering made the van chase its own tail): left/right steers, pushing up drives,
 * pulling back reverses. Any push also gives gas, so a sideways tilt still drives, and even a light
 * tilt beats rolling resistance. Analog with a soft curve: small tilts = gentle turns.
 */
window.__stickDrive = (stick, mag) => stickDrive(stick, mag); // for tools/stick-smooth.mjs
function stickDrive(stick, mag) {
  const x = stick.x, y = stick.y;
  const curve = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.6); // gentle near the centre
  const reversing = y > 0.45 && Math.abs(x) < 0.75;
  if (reversing) return { throttle: -(0.45 + 0.55 * y), steer: curve(x) };
  const push = Math.max(-y, Math.abs(x) * 0.9, mag * 0.6); // forward part of the push
  return { throttle: 0.42 + 0.58 * Math.min(1, push), steer: curve(x) };
}

let achT = 0.5, saveT = 3;
addEventListener('pagehide', () => progress.save(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) progress.save(true); });

const clock = new THREE.Clock();
let t = 0;
function frame() {
  const rawDt = Math.min(clock.getDelta(), 1 / 20);
  const menuOpen = !shopEl.classList.contains('hidden') || !trophiesEl.classList.contains('hidden') || !rotateEl.classList.contains('hidden');
  if (bigMap.open || (menuOpen && started)) { // paused: keep the map fresh, don't advance the world
    if (bigMap.open) bigMap.draw();
    else renderer.render(scene, camera);
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }
  const dt = rawDt * timeScale;
  t += dt;
  for (const a of animated) a.update(t, dt);

  if (started && ambulance.driving) {
    input.enabled = true;
    const k = (...c) => (input.down(...c) ? 1 : 0);
    const stick = input.stick ?? { x: 0, y: 0 };
    let throttle = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown');
    let steer = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');
    const stickMag = Math.min(1, Math.hypot(stick.x, stick.y));
    if (stickMag > 0.12) ({ throttle, steer } = stickDrive(stick, stickMag));
    if (input.hit('Space')) { ambulance.siren = !ambulance.siren; ambulance.siren ? siren.on() : siren.off(); }
    const before = ambulance.pos.clone();
    ambulance.update(dt, t, { throttle, steer });
    career.travel(Math.hypot(ambulance.pos.x - before.x, ambulance.pos.z - before.z), true, ambulance.siren);
    engine.set(ambulance.speed);
    // Doctor Guy rides inside: zones, spawning, lollipops and the minimap follow the van
    player.pos.copy(ambulance.pos);
    player.vel.set(0, 0, 0);
    player.facing = ambulance.heading;
    missions.update(dt, t, input);
    frenzy.update(dt, t);
    hud.update(missions, player, ambulance, input.yaw);
  } else if (started) {
    ambulance.update(dt, t, {});
    input.enabled = !minigame.active;
    const wasGround = player.onGround;
    const before = player.pos.clone();
    player.update(dt, t, input);
    const moved = Math.hypot(player.pos.x - before.x, player.pos.z - before.z);
    if (moved < 5) career.travel(moved, false); // (ignore teleports through doors)
    if (wasGround && !player.onGround && player.vel.y > 0) sfx.jump();
    missions.update(dt, t, input);
    frenzy.update(dt, t);
    minigame.update(dt);
    hud.update(missions, player, ambulance, input.yaw);
  } else {
    // Title screen: slow orbit around the park
    input.yaw += dt * 0.08;
    player.update(dt, t, { down: () => false, hit: () => false, yaw: input.yaw });
  }
  // Title screen: orbit high above the middle of the park (orbiting Doctor Guy at the hospital door put
  // the camera inside the hospital for the first seconds — the old "black background" on start-up)
  if (started && ambulance.driving && stuntCam > 0) {
    stuntCam -= rawDt;
    const a = ambulance, side = { x: Math.cos(a.heading), z: -Math.sin(a.heading) };
    const c = camera.position, target = a.root.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const want = target.clone().add(new THREE.Vector3(side.x * 11 - Math.sin(a.heading) * 5, 3.2, side.z * 11 - Math.cos(a.heading) * 5));
    c.lerp(want, Math.min(1, rawDt * 4));
    camera.lookAt(target);
  } else if (started && ambulance.driving) {
    // swing round behind the van unless you've just looked around yourself
    if (performance.now() - (input.lastLook ?? 0) > 1500) {
      const want = ambulance.heading + Math.PI;
      input.yaw += Math.atan2(Math.sin(want - input.yaw), Math.cos(want - input.yaw)) * Math.min(1, dt * 2.5);
    }
    follow.update(dt, { pos: ambulance.root.position }, { yaw: input.yaw, pitch: Math.max(input.pitch, 0.32), distance: Math.max(input.distance, 12) });
  } else if (started && isInside(player.pos)) {
    // indoors: look down into the rooms over the (roofless) walls
    follow.update(dt, player, { yaw: input.yaw, pitch: Math.max(input.pitch, 0.78), distance: THREE.MathUtils.clamp(input.distance, 6, 11) });
  } else if (started) follow.update(dt, player, input);
  else follow.update(dt, TITLE_VIEW, { yaw: input.yaw, pitch: 0.42, distance: 30 });

  // Streaming: only draw a zone's props when you're near it (the sea/sand horizon always stays)
  const inside = isInside(player.pos);
  if (started) nurses?.update(dt, t, { inside });
  // (the park and beach also drop out when you're far east at the zoo, and vice versa)
  park.visible = !inside && player.pos.z < 105 && player.pos.x < 150 && player.pos.x > -115;
  ramps.visible = !inside;
  beach.group.visible = !inside && player.pos.z > 25 && player.pos.x < 110;
  beach.sea.visible = !inside;
  if (road) road.group.visible = !inside;
  if (zoo) zoo.group.visible = !inside && player.pos.x > 70;
  if (downtown) downtown.group.visible = !inside && player.pos.x < 60 && !window.__hide?.downtown;
  if (suburbs) suburbs.group.visible = !inside && player.pos.x > -10 && player.pos.z > -80 && !window.__hide?.suburbs;
  if (pier) {
    pier.group.visible = !inside && player.pos.x > -40 && player.pos.z > -20 && !window.__hide?.pier;
    FAIR.beam.material.opacity = Math.max(0, dayNight.night - 0.2) * 0.3; // the lighthouse sweeps at night
  }
  base.visible = !inside;
  ambulance.root.visible = !inside;
  if (hospital) hospital.group.visible = inside;
  scene.background = inside ? INDOOR_BG : OUTDOOR_BG;
  scene.fog = inside ? null : outdoorFog;

  // distance culling: ambient people far from the camera aren't drawn (keeps phones smooth)
  if (missions) {
    const cam = camera.position;
    for (const a of missions.ambient) {
      if (a.mode === 'swing' || a.mode === 'ride') continue; // parented to swing seats and rides (their zone hides them)
      const p = a.kid.root.position;
      a.kid.root.visible = Math.hypot(p.x - cam.x, p.z - cam.z) < 85;
    }
  }

  // waypoint beam (mission waypoints follow the patient; hospital ones show at the doors)
  const wp = hud.radar.waypointPos();
  wpBeam.visible = !!wp && started && (isInside(player.pos) === (wp.z < -300));
  if (wp) {
    wpBeam.position.set(wp.x, 0, wp.z);
    wpRing.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
  }

  // saved progress: wallet, achievements (twice a second), autosave (every 3 s)
  if (missions && started) {
    const delta = missions.lollipops - progress.wallet;
    if (delta > 0) progress.add('earned', delta);
    progress.wallet = missions.lollipops;
    if ((achT -= rawDt) <= 0) {
      achT = 0.5;
      for (const a of progress.checkAchievements({ career, ambulance, missions })) achievementToast(a);
    }
    if ((saveT -= rawDt) <= 0) { saveT = 3; progress.save(); }
  }

  // Keep shadows centred on the player
  if (started && !isInside(player.pos)) dayNight.update(dt, { outside: true, playerPos: player.pos });
  const so = dayNight.sunOffset ?? new THREE.Vector3(30, 50, 20);
  sun.position.set(player.pos.x + so.x, so.y, player.pos.z + so.z);
  const clockEl = document.getElementById('clock');
  if (clockEl && started) clockEl.textContent = (dayNight.night > 0.5 ? '🌙 ' : '☀️ ') + dayNight.clock;
  sun.target.position.set(player.pos.x, 0, player.pos.z);

  renderer.render(scene, camera);
  input.endFrame();
  requestAnimationFrame(frame);
}
// Start drawing the park straight away (behind the title) while the characters finish loading
frame();

// Characters load in parallel; the Start button unlocks when they're in
await Promise.all([doctorReady, preloadKids(), ambulanceReady, loadKits()]);
road = buildRoad(scene);
hospital = await buildHospital(scene);
zoo = await buildZoo(scene);
downtown = buildDowntown(scene);
animated.push(...downtown.animated);
suburbs = buildSuburbs(scene);
animated.push(...suburbs.animated);
pier = buildPier(scene);
animated.push(...pier.animated);
animated.push(...zoo.animated);
dayNight.addLampHalos([...downtown.bulbs.map((b) => ({ ...b, parent: downtown.group })), ...suburbs.bulbs.map((b) => ({ ...b, parent: suburbs.group })), ...pier.bulbs.map((b) => ({ ...b, parent: pier.group }))]);
animated.push(...hospital.animated);
hud.plan = hospital.plan;
applyCosmetics(); // saved hats, paint, siren…
career.renderRank(false);
nurses = new DoorNurses(scene, ambulance, {
  onCallout: () => hud.toast('🏥 The nurses heard the siren — they’re coming out to meet you!', 2600),
});
missions = new MissionSystem(scene, player, ui);
frenzy = new Frenzy({ scene, missions, career, progress, ui });
window.__game.missions = missions;
window.__game.frenzy = frenzy;
window.__game.hospital = hospital;
window.__game.nurses = nurses;
window.__game.zoo = zoo;
window.__game.downtown = downtown;
window.__game.suburbs = suburbs;
window.__game.pier = pier;
window.__game.world = worldApi;
window.__game.bigMap = bigMap;
window.__game.hud = hud;
window.__game.career = career;
window.__game.progress = progress;
window.__game.openShop = openShop;
window.__game.dayNight = dayNight;
window.__game.ramps = RAMPS;
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
