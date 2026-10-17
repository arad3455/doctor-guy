import * as THREE from 'three';
import { buildWorld, cameraBlockers } from './world.js';
import * as worldApi from './world.js';
import { buildBeach } from './beach.js';
import { Player, Input, FollowCamera } from './player.js';
import { MissionSystem } from './missions.js';
import { MiniGame } from './minigame.js';
import { HUD } from './hud.js';
import { headline, notify, notices } from './notify.js';
import { icon, iconize, hydrateIcons } from './icons.js';
import { initAudio, sfx, engine, siren, audioCtx } from './audio.js';
import { Ambulance, PARKING } from './vehicle.js';
import { buildHospital, INTERIOR, isInside, makeGate } from './hospital.js';
import { DoorNurses } from './nurses.js';
import { buildRoad, buildZoo, inZoo, ZOO } from './zoo.js';
import { buildDowntown } from './downtown.js';
import { buildSuburbs } from './suburbs.js';
import { buildPier, FAIR } from './pier.js';
import { buildCamp } from './camp.js';
import { buildHarbor, HARBOR } from './harbor.js';
import { buildAirport, AIR_MAP } from './airport.js';
import { GPS } from './gps.js';
import { Bandages, BANDAGE_SPOTS } from './collectibles.js';
import { Weather } from './weather.js';
import { Ambience } from './ambience.js';
import { PhotoMode } from './photomode.js';
import { buildBusStops, Buses, STOPS } from './bus.js';
import { Radio } from './radio.js';
import { Caspi } from './caspi.js';
import { Lakash } from './lakash.js';
import { Ilan } from './ilan.js';
import { buildShowroom, SHOWROOM, inShowroom } from './showroom.js';
import { animateRig } from './characters.js';
import { reach } from './poses.js';
import { Races, RACES } from './races.js';
import { Outbreak } from './outbreak.js';
import { trimShadows, bakeStatic } from './cityprops.js';
import { buildRoadNetwork, ROAD_TEXT } from './roads.js';
import { laneAssist, HW } from './streets.js';
import { DT_MAP, DT_SPOTS } from './downtown.js';
import { MH_MAP, MH } from './suburbs.js';
import { CAMP } from './camp.js';
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
let camp = null; // Zone 7, Pinewood Camp
let harbor = null; // Zone 8, Wolfson Harbor
let airport = null; // Zone 10, Wolfson Airport
let roadNetwork = null; // every street, drawn at once (roads.js)
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
const weather = new Weather(scene); // rain showers now and then, a rainbow after
const radioBtn = document.getElementById('radio-btn');
const radio = new Radio({ onChange: (name) => notify(name, { icon: 'radio', tone: 'info', ms: 1800 }) }); // R / 📻 while driving
const ambience = new Ambience(audioCtx); // gulls, music box, campfire, birds, city hum, rain
const dayNight = new DayNight({ scene, sun, hemi, sky: skyMat, fog: outdoorFog, ambulance, startHour: 15.5 });
const ambulanceReady = ambulance.loadModel().catch((e) => console.warn('[ambulance] model failed, using the blocky van', e));
const follow = new FollowCamera(camera);
follow.blockers = cameraBlockers;
const hud = new HUD();
hydrateIcons(); // the static HUD buttons and chips (data-icon="…")
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
  document.getElementById('shop-tabs').innerHTML = SHOP_CATS.map(([c, label]) => `<button data-tab="${c}" class="${c === shopTab ? 'on' : ''}">${iconize(label)}</button>`).join('');
  document.getElementById('shop-items').innerHTML = SHOP.filter((i) => i.cat === shopTab).map((i) => {
    const owned = progress.owned.includes(i.id), on = progress.equipped[i.cat] === i.id;
    const wallet = missions?.lollipops ?? progress.wallet;
    const btn = !owned ? `<button data-buy="${i.id}" ${wallet < i.price ? 'disabled' : ''}>${icon('lollipop')}${i.price}</button>`
      : `<button data-equip="${i.id}" class="${on ? 'equipped' : 'equip'}">${on ? 'Wearing' : 'Use'}</button>`;
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
      notify(`${item.name} — enjoy!`, { icon: 'bag', tone: 'success', ms: 2000 });
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
addEventListener('keydown', (e) => { if (e.code === 'Escape') { openShop(false); openTrophies(false); ilan?.close(); } });

/* ---- Getting in and out of the ambulance ---- */
const setButtons = (driving) => {
  document.documentElement.classList.toggle('driving', driving);
  document.getElementById('btn-jump').innerHTML = icon(driving ? 'siren' : 'jump');
  document.getElementById('btn-action').innerHTML = icon(driving ? 'door' : 'cross');
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
    notify(`${patient.def.name} is in the ambulance — siren on!`, { icon: 'ambulance', tone: 'alert', sub: `${isTouch ? 'Wheel to steer · lever for gas' : 'W/S drive · A/D steer'} · park at the drop-off to hand over`, ms: 3400 });
  } else {
    notify('Ambulance', { icon: 'ambulance', sub: isTouch ? 'Slide the wheel to steer · push the lever up for gas, down to brake / reverse' : 'W/S drive · A/D steer · SPACE siren · E get out', ms: 3000 });
  }
}
function exitAmbulance(force = false) {
  if (!force && Math.abs(ambulance.speed) > 2.5) { notify('Stop first!', { icon: 'stop', tone: 'alert', ms: 1400 }); return; }
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
/* ---- Your own car (bought from Ilan): same driving, no siren, no patients ---- */
let myCar = null; // parked on Ilan's YOUR CAR bay, or wherever you left it
let riderArms = null; // Doctor Guy's arm bones (riding the bike)
const driven = () => (myCar?.driving ? myCar : ambulance);
function enterCar() {
  if (missions?.missions.some((m) => m.state === 'carried')) { notify('Patients ride in the ambulance!', { icon: 'ambulance', tone: 'alert', ms: 2400 }); return; }
  myCar.driving = true;
  // on the bike he rides standing on the footpegs, like an off-road rider (he rides with it: a child of its body)
  if (myCar.bike) { myCar.body.add(player.rig.root); player.rig.root.position.set(0, myCar.height * 0.18, -0.15); player.rig.root.rotation.set(0, 0, 0); }
  else player.rig.root.visible = false;
  player.vel.set(0, 0, 0);
  sfx.door();
  engine.start();
  setButtons(true);
  notify(myCar.label, { icon: 'flag', tone: 'success', sub: isTouch ? 'Wheel to steer · lever for gas · door to get out' : 'W/S drive · A/D steer · E get out', ms: 3000 });
}
function exitCar() {
  if (Math.abs(myCar.speed) > 2.5) { notify('Stop first!', { icon: 'stop', tone: 'alert', ms: 1400 }); return; }
  myCar.driving = false;
  myCar.speed = 0;
  if (player.rig.root.parent === myCar.body) scene.add(player.rig.root); // off the bike
  player.pos.copy(myCar.doorPoint);
  player.collide();
  player.facing = myCar.heading;
  player.rig.root.visible = true;
  sfx.door();
  engine.stop();
  setButtons(false);
}
/** Next to a vehicle: by the driver's door, or anywhere right beside it. */
function besideVehicle(v) {
  const p = player.pos;
  if (Math.hypot(p.x - v.doorPoint.x, p.z - v.doorPoint.z) < 2.6) return true;
  const local = p.clone().sub(v.pos);
  return Math.abs(local.dot(v.forward)) < v.len * 0.7 && Math.abs(local.dot(v.right)) < v.width / 2 + 1.6;
}
function vehicleAction() {
  if (ambulance.driving) return { label: 'Get out of the ambulance', run: exitAmbulance };
  if (myCar?.driving) return { label: `Get out of the ${myCar.label}`, run: exitCar };
  if (besideVehicle(ambulance)) return { label: 'Drive the ambulance 🚑', run: enterAmbulance };
  if (myCar && besideVehicle(myCar)) return { label: `🏁 Drive your ${myCar.label}`, run: enterCar };
  return null;
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
function enterShowroom() {
  fadeTo(() => {
    player.pos.copy(SHOWROOM.entry);
    player.vel.set(0, 0, 0);
    player.facing = Math.PI; // into the hall (north)
    input.yaw = 0; // (behind him; the hall's walls keep the camera in)
    follow.dist = 4;
    sfx.door();
    ilan?.host(showroom);
  });
}
function leaveShowroom() {
  fadeTo(() => {
    const d = DT_SPOTS.dealer.door;
    player.pos.set(d.x + 5, 0, d.z + 1.5); // a few steps out on the forecourt, looking back at the showroom
    player.vel.set(0, 0, 0);
    player.facing = -Math.PI / 2;
    input.yaw = Math.PI / 2 + 0.3;
    sfx.door();
    ilan?.unhost();
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
  if (inShowroom(p)) {
    if (Math.hypot(p.x - SHOWROOM.exitDoor.x, p.z - SHOWROOM.exitDoor.z) < 2.8) return { label: 'Leave Ilan Motors 🚪', run: leaveShowroom };
    const t = showroom.carNear(p);
    if (t) {
      const owned = (progress.data.cars ?? []).includes(t.car.id);
      if (owned) return progress.data.car === t.car.id ? { label: `🏁 Your ${t.car.name} is outside` , run: () => notify('It’s on the YOUR CAR bay outside', { icon: 'car', ms: 2400 }) } : { label: `🏁 Take out the ${t.car.name}`, run: () => ilan.buyHere(t.car) };
      return { label: `🏁 Buy the ${t.car.name} · ${t.car.price} 🍭`, run: () => ilan.buyHere(t.car) };
    }
    return ilan?.chatAction(p) ?? null;
  }
  if (isInside(p)) {
    return Math.hypot(p.x - INTERIOR.exitDoor.x, p.z - INTERIOR.exitDoor.z) < 2.4 ? { label: 'Leave the hospital 🚪', run: leaveHospital } : null;
  }
  if (frenzy?.available && Math.hypot(p.x - FRENZY_TOKEN.x, p.z - FRENZY_TOKEN.z) < 2.2) {
    return { label: `⚡ Start Check-up Frenzy${progress.data.frenzyBest ? ` (best ${progress.data.frenzyBest})` : ''}`, run: () => frenzy.start() };
  }
  const chat = caspi?.chatAction(p) ?? lakash?.chatAction(p) ?? ilan?.chatAction(p);
  if (chat) return chat;
  const stop = buses?.nearStop(p);
  if (stop) return { label: '🚌 Take the bus', run: () => buses.show(stop) };
  if (Math.hypot(p.x - WORLD.stand.x, p.z - WORLD.stand.z) < 3.4) {
    return { label: '🛍️ Doctor Shop', run: () => openShop(true) };
  }
  if (showroom && Math.hypot(p.x - DT_SPOTS.dealer.door.x - 1.2, p.z - DT_SPOTS.dealer.door.z) < 2.4) {
    return { label: '🚗 Enter Ilan Motors', run: enterShowroom };
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
  raceAction: () => races?.action(ambulance.pos) ?? null,
  extraAction,
  get hospital() { return hospital; },
  get zoo() { return zoo; },
  get frenzy() { return frenzy; },
  get outbreak() { return outbreak; },
  onHospitalHandover: () => nurses?.escort(),
  swingSeats,
  minigame,
  toast: (h, ms) => hud.toast(h, ms),
  zoneEntered: (zone) => {
    const names = { park: ['WOLFSON PARK', 'Where it all began'], beach: ['SUNNY BEACH', 'Sun, sand and sea'], zoo: ['WOLFSON CITY ZOO', 'Mind the monkeys'],
      downtown: ['DOWNTOWN WOLFSON', 'The big city'], suburbs: ['MAPLE HEIGHTS', 'Nice and quiet… usually'], pier: ['SUNSET PIER', 'Rides by the sea'],
      camp: ['PINEWOOD CAMP', 'Deep in the woods'], harbor: ['WOLFSON HARBOR', 'Ships and cranes'], airport: ['WOLFSON AIRPORT', 'Now boarding…'], hospital: ['WOLFSON MEDICAL CENTER', 'Your second home'] };
    const [name, sub] = names[zone] ?? [];
    if (name) {
      const el = document.getElementById('district');
      el.querySelector('.d-name').textContent = name;
      el.querySelector('.d-sub').textContent = sub;
      el.classList.remove('hidden');
      for (const s of el.children) { s.style.animation = 'none'; void s.offsetWidth; s.style.animation = ''; }
      clearTimeout(ui.districtTimer);
      ui.districtTimer = setTimeout(() => el.classList.add('hidden'), 3900);
    }
    // remember every area ever visited (the Explorer achievement)
    progress.data.visited = { ...(progress.data.visited ?? {}), [zone]: true };
    progress.dirty = true;
  },
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
let photo = null; // photo mode (P / 📷)
let buses = null; // bus stops in every area (fast travel)
let caspi = null; // Doctor Guy's friend (and Gorge the cat)
let lakash = null; // the zookeeper (and his six cats)
let ilan = null; // the car dealer (Ilan Motors, Downtown)
let showroom = null; // Ilan Motors, inside (showroom.js)
let races = null; // ambulance time trials
let outbreak = null; // flu outbreaks
let bandages = null; // Golden Bandages (created once the world is built)
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
  progress.data.visited = { ...(progress.data.visited ?? {}), park: true };
  notify('Your shift begins!', { icon: 'cross', tone: 'success', sub: isTouch ? 'Tap the radar for the map' : 'Press H for controls · M for the map', ms: 3600 });
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
  outbreak?.abort();
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
// Whole zones drop out when they're behind the camera or deep in the fog (their instanced meshes span the whole
// zone, so three.js's per-object culling rarely helps). Boxes are measured once, a little padded for shadows.
const zoneBoxes = new Map(), viewFrustum = new THREE.Frustum(), viewMatrix = new THREE.Matrix4();
let viewFrame = -1;
function inView(group) {
  if (!zoneBoxes.has(group)) {
    const was = group.visible;
    group.visible = true;
    zoneBoxes.set(group, new THREE.Box3().setFromObject(group).expandByScalar(6));
    group.visible = was;
  }
  if (viewFrame !== frameNo) {
    viewFrame = frameNo;
    camera.updateMatrixWorld();
    viewFrustum.setFromProjectionMatrix(viewMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  }
  const box = zoneBoxes.get(group);
  return box.distanceToPoint(camera.position) < (scene.fog?.far ?? 220) && viewFrustum.intersectsBox(box);
}
let frameNo = 0;

function frame() {
  frameNo++;
  const rawDt = Math.min(clock.getDelta(), 1 / 20);
  const menuOpen = !shopEl.classList.contains('hidden') || !trophiesEl.classList.contains('hidden') || !rotateEl.classList.contains('hidden') || !!buses?.open;
  if (photo?.active) { // photo mode: the world is frozen, the camera orbits
    photo.update();
    renderer.render(scene, camera);
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }
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

  if (started && (ambulance.driving || myCar?.driving)) {
    const V = driven(); // the ambulance, or your own car
    input.enabled = true;
    const k = (...c) => (input.down(...c) ? 1 : 0);
    const stick = input.stick ?? { x: 0, y: 0 };
    let throttle = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown');
    let steer = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');
    const stickMag = Math.min(1, Math.hypot(stick.x, stick.y));
    if (stickMag > 0.12) ({ throttle, steer } = stickDrive(stick, stickMag));
    const d = input.drive; // phones: wheel + gas lever
    if (d) { if (Math.abs(d.throttle) > 0.05) throttle = d.throttle; if (Math.abs(d.steer) > 0.03) steer = d.steer; }
    // lane keeping: hands off the wheel on a straight street and the van eases into the middle of its lane
    V.assist = 0;
    if (Math.abs(steer) < 0.05 && V.speed > 3) {
      const lane = laneAssist(V.pos.x, V.pos.z, V.heading);
      if (lane) {
        const k = Math.min(1, V.speed / 8);
        steer = V.assist = THREE.MathUtils.clamp((0.25 * lane.lateral + 2.6 * lane.align) * k, -0.5, 0.5); // (a damped PD: settles in a second or two)
      }
    }
    if (input.hit('Space')) { if (V === ambulance) { ambulance.siren = !ambulance.siren; ambulance.siren ? siren.on() : siren.off(); } else sfx.horn?.(); }
    const before = V.pos.clone();
    V.update(dt, t, { throttle, steer });
    career.travel(Math.hypot(V.pos.x - before.x, V.pos.z - before.z), true, V.siren);
    engine.set(V.speed);
    // Doctor Guy rides inside: zones, spawning, lollipops and the minimap follow the van
    player.pos.copy(V.pos);
    player.vel.set(0, 0, 0);
    player.facing = V.heading;
    missions.update(dt, t, input);
    frenzy.update(dt, t);
    bandages?.update(dt, t, V.pos);
    hud.update(missions, player, ambulance, input.yaw);
    if (V !== ambulance) ambulance.update(dt, t, {}); else myCar?.update(dt, t, {}); // (the other one stays parked)
    if (V.bike) { // the rider, standing on the pegs, hands on the bars
      animateRig(player.rig, 'idle', t, dt, 0);
      const arms = (riderArms ??= ['Left', 'Right'].map((side) => {
        const f = (re) => { let b = null; player.rig.root.traverse((o) => { if (!b && o.isBone && re.test(o.name)) b = o; }); return b; };
        const upper = f(new RegExp(`${side}Arm$`, 'i')), fore = f(new RegExp(`${side}ForeArm$`, 'i')), hand = f(new RegExp(`${side}Hand$`, 'i'));
        return upper && fore && hand ? { upper, fore, hand, s: side === 'Left' ? -1 : 1 } : null;
      }));
      player.rig.root.updateMatrixWorld(true);
      for (const a of arms) if (a) {
        const bar = V.pos.clone().addScaledVector(V.forward, V.len * 0.27).addScaledVector(V.right, a.s * V.width * 0.42).setY(V.height * 0.8);
        reach(a, bar, new THREE.Vector3(0, -1, 0).addScaledVector(V.right, a.s * 0.8).normalize());
      }
    }
  } else if (started) {
    ambulance.update(dt, t, {});
    myCar?.update(dt, t, {});
    input.enabled = !minigame.active;
    const wasGround = player.onGround;
    const before = player.pos.clone();
    player.update(dt, t, input);
    const moved = Math.hypot(player.pos.x - before.x, player.pos.z - before.z);
    if (moved < 5) career.travel(moved, false); // (ignore teleports through doors)
    if (wasGround && !player.onGround && player.vel.y > 0) sfx.jump();
    missions.update(dt, t, input);
    frenzy.update(dt, t);
    bandages?.update(dt, t, player.pos);
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
  } else if (started && (ambulance.driving || myCar?.driving)) {
    const V = driven();
    // swing round behind the van unless you've just looked around yourself
    if (performance.now() - (input.lastLook ?? 0) > 1500) {
      const want = V.heading + Math.PI;
      input.yaw += Math.atan2(Math.sin(want - input.yaw), Math.cos(want - input.yaw)) * Math.min(1, dt * 2.5);
    }
    follow.update(dt, { pos: V.root.position }, { yaw: input.yaw, pitch: Math.max(input.pitch, 0.38), distance: Math.max(input.distance, V === ambulance ? 12.5 : 11) }); // high enough to see the road ahead
  } else if (started && inShowroom(player.pos)) {
    // the showroom: the normal free camera (drag to look round, scroll / pinch to zoom); the walls keep it inside
    follow.update(dt, player, input);
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
  if (zoo) zoo.group.visible = !inside && player.pos.x > 70 && inView(zoo.group);
  if (downtown) downtown.group.visible = !inside && player.pos.x < 60 && !window.__hide?.downtown && inView(downtown.group);
  if (suburbs) suburbs.group.visible = !inside && player.pos.x > -10 && player.pos.z > -80 && !window.__hide?.suburbs && inView(suburbs.group);
  if (camp) camp.group.visible = !inside && player.pos.z < 0 && player.pos.x > -60 && !window.__hide?.camp && inView(camp.group);
  if (harbor) harbor.group.visible = !inside && player.pos.x < 20 && player.pos.z > -40 && !window.__hide?.harbor && inView(harbor.group);
  if (airport) airport.group.visible = !inside && player.pos.x < 60 && player.pos.z < 20 && !window.__hide?.airport && inView(airport.group);
  if (pier) {
    pier.group.visible = !inside && player.pos.x > -40 && player.pos.z > -20 && !window.__hide?.pier && inView(pier.group);
    FAIR.beam.material.opacity = Math.max(0, dayNight.night - 0.2) * 0.3; // the lighthouse sweeps at night
  }
  base.visible = !inside;
  ambulance.root.visible = !inside;
  if (hospital) hospital.group.visible = inside && player.pos.z < -300;
  if (showroom) showroom.group.visible = inShowroom(player.pos);
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
  if (started && !isInside(player.pos)) {
    dayNight.update(dt, { outside: true, playerPos: player.pos });
    weather.update(dt, { camera, dayNight, outside: true, sun, hemi, sky: skyMat, fog: outdoorFog }); // after day/night: it greys what that just set
  } else weather.lines.visible = weather.rainbow.visible = false;
  radio.update(started && ambulance.driving && !photo?.active && !bigMap.open);
  if (races && started) races.update(dt, t);
  outbreak?.update(dt, started && !isInside(player.pos) && !frenzy?.active);
  if (caspi && started) {
    caspi.update(dt, t, { hour: dayNight.hour, inside: isInside(player.pos) });
    lakash?.update(dt, t, { hour: dayNight.hour, inside: isInside(player.pos) });
    ilan?.update(dt, t);
    minigame.slow = caspi.calming(player.pos) ? 0.6 : 1; // his calm makes treatments easier
  }
  radioBtn.style.display = started && ambulance.driving ? '' : 'none';
  if (started) {
    const p = player.pos, near = (x, z, r) => Math.max(0, 1 - Math.hypot(p.x - x, p.z - z) / r);
    const inRect = (x0, z0, x1, z1, fade) => Math.max(0, 1 - Math.hypot(Math.max(x0 - p.x, 0, p.x - x1), Math.max(z0 - p.z, 0, p.z - z1)) / fade);
    ambience.update(rawDt, {
      outside: !isInside(p),
      rain: weather.rain,
      sea: Math.max(Math.min(1, Math.max(0, (p.z - 70) / 45)), inRect(-200, 52, -92, 116, 30)),
      city: inRect(-200, -83, -64, 51, 50),
      fair: inRect(92, 64, 150, 113, 45),
      camp: Math.max(inRect(8, -218, 152, -98, 40), near(0, 0, 60) * 0.35),
      fire: near(40, -152, 20),
    });
  }
  const so = dayNight.sunOffset ?? new THREE.Vector3(30, 50, 20);
  sun.position.set(player.pos.x + so.x, so.y, player.pos.z + so.z);
  const clockEl = document.getElementById('clock');
  if (clockEl && started) {
    const night = dayNight.night > 0.5;
    if (night !== clockEl.night) { clockEl.night = night; document.getElementById('clock-icon').innerHTML = icon(night ? 'moon' : 'sun'); }
    clockEl.textContent = dayNight.clock;
  }
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
camp = buildCamp(scene);
animated.push(...camp.animated);
harbor = buildHarbor(scene);
animated.push(...harbor.animated);
airport = buildAirport(scene);
// painted words: the ambulance's own bay by the hospital, SCHOOL / SLOW by Maple Heights Elementary
ROAD_TEXT.push({ x: PARKING.x, z: PARKING.z, text: 'AMBULANCE', color: '#f2c230', box: [7.6, 3.3] });
for (const [z, text, yaw, side] of [[-23.5, 'SLOW', Math.PI, -1], [-19.5, 'SCHOOL', Math.PI, -1], [-9, 'SLOW', 0, 1], [-13, 'SCHOOL', 0, 1]] /* (the first word a driver meets is nearest) */) ROAD_TEXT.push({ x: MH.mapleX + side * HW / 2, z, text, yaw });
roadNetwork = buildRoadNetwork(scene); // every district has registered its streets: draw them all
animated.push(...airport.animated);
animated.push(...zoo.animated);
dayNight.addLampHalos([...downtown.bulbs.map((b) => ({ ...b, parent: downtown.group })), ...suburbs.bulbs.map((b) => ({ ...b, parent: suburbs.group })), ...pier.bulbs.map((b) => ({ ...b, parent: pier.group })), ...camp.bulbs.map((b) => ({ ...b, parent: camp.group })), ...harbor.bulbs.map((b) => ({ ...b, parent: harbor.group })), ...airport.bulbs.map((b) => ({ ...b, parent: airport.group }))]);
animated.push(...hospital.animated);
hud.plan = hospital.plan;
applyCosmetics(); // saved hats, paint, siren…
career.renderRank(false);
nurses = new DoorNurses(scene, ambulance, {
  onCallout: () => notify('The nurses heard the siren', { icon: 'hospital', tone: 'info', sub: 'They’re coming out to meet you', ms: 2800 }),
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
window.__game.camp = camp;
window.__game.harbor = harbor;
window.__game.airport = airport;
// 30 Golden Bandages hidden around the city (+5 🍭 each; found ones are saved)
bandages = new Bandages(scene, progress, {
  isOpen: () => started && !isInside(player.pos),
  onFind: (n, total, it) => {
    missions.lollipops += 5;
    notify(`Golden Bandage ${n}/${total}`, { icon: 'bandage', tone: 'reward', sub: it.hint, reward: '+5 🍭', ms: 3000 });
  },
});
window.__game.bandages = bandages;
photo = new PhotoMode({
  renderer, camera, scene,
  target: () => (ambulance.driving ? ambulance.pos : player.pos),
  onToggle: (on) => { hud.show(!on); document.getElementById('photo-btn').style.display = on ? 'none' : ''; },
});
window.__game.photo = photo;
buildBusStops(scene);
buses = new Buses({
  progress,
  wallet: { get: () => missions.lollipops, add: (n) => { missions.lollipops += n; } },
  toast: (h, ms) => hud.toast(h, ms),
  onTravel: (to) => {
    player.pos.set(to.board.x, 0, to.board.z);
    player.vel.set(0, 0, 0);
    input.yaw = Math.atan2(player.pos.x - to.x, player.pos.z - to.z) + Math.PI;
    sfx.success();
  },
});
window.__game.buses = buses;
window.__game.busStops = STOPS;
document.getElementById('photo-btn').addEventListener('click', () => { if (started && !bigMap.open) photo.toggle(true); });
addEventListener('keydown', (e) => { if (e.code === 'KeyP' && !e.repeat && started && !bigMap.open) photo.toggle(); });
for (const g of [park, beach.group, beach.sea, zoo.group, road.group]) bakeStatic(g); // the park and beach: hundreds of small parts → a few batches
for (const g of [downtown.group, suburbs.group, pier.group, camp.group, harbor.group, zoo.group, park, beach.group, road.group]) { g.updateMatrixWorld(true); trimShadows(g); } // lighter shadow pass
// GPS routes prefer roads: every street tile of every zone, plus Zoo Road
{
  const tileRects = [...DT_MAP.streets, ...MH_MAP.streets, ...(CAMP.streets ?? []), ...(HARBOR.streets ?? []), ...AIR_MAP.streets].map((t) => ({ x0: t.x - 3.6, x1: t.x + 3.6, z0: t.z - 3.6, z1: t.z + 3.6 }));
  hud.radar.gps = new GPS([...tileRects, { x0: ZOO.road.x0, x1: ZOO.road.x1, z0: ZOO.road.z - 3.6, z1: ZOO.road.z + 3.6 }]);
  window.__game.gps = hud.radar.gps;
}
caspi = new Caspi({
  scene, player, gps: hud.radar.gps, progress,
  ui: {
    hour: () => dayNight.hour,
    toast: (h, ms) => hud.toast(h, ms),
    gorgeLost: (h) => headline({ kicker: 'CASPI’S CAT', title: 'Gorge is missing!', sub: `Caspi doesn’t look worried… last seen ${h.hint}`, tone: 'caspi', icon: 'paw', ms: 3600 }),
    gorgeHome: () => {
      missions.lollipops += 10;
      progress.data.caspiSmiled = (progress.data.caspiSmiled ?? 0) + 1;
      progress.dirty = true;
      headline({ kicker: 'GORGE IS HOME', title: 'Caspi smiled!', sub: '+10 🍭', tone: 'success', icon: 'paw', ms: 3000 });
    },
  },
});
races = new Races({ scene, progress, ambulance, ui: { toast: (h, ms) => hud.toast(h, ms), reward: (n) => { missions.lollipops += n; } } });
hud.radar.raceTarget = () => races.target;
outbreak = new Outbreak({ missions, progress, ui: { toast: (h, ms) => hud.toast(h, ms), reward: (n) => { missions.lollipops += n; } } });
window.__game.outbreak = outbreak;
lakash = new Lakash({ scene, player, gps: hud.radar.gps, zoo, ui: {} });
window.__game.lakash = lakash;
ilan = new Ilan({
  scene, player, progress, renderer,
  wallet: { get: () => missions.lollipops, add: (n) => { missions.lollipops += n; } },
  ui: { onCar: (car) => { myCar = car; window.__game.myCar = car; } },
});
window.__game.ilan = ilan;
// the big showroom behind the portal, and the portal itself in the glass front
showroom = buildShowroom(scene, renderer);
animated.push(...showroom.animated);
showroom.addCars().then(() => showroom.refresh(progress.data.cars ?? []));
showroom.addDecor();
window.__game.showroom = showroom;
{
  const d = DT_SPOTS.dealer, gate = makeGate(0x3fa9ff, 'ENTER', { width: 3.2, height: 3.4, labelY: 4.6, labelSize: 2 });
  gate.group.position.set(d.door.x + 0.15, 0, d.door.z);
  gate.group.rotation.y = Math.PI / 2; // facing the forecourt
  downtown.group.add(gate.group);
  animated.push(gate);
}
hud.radar.extraBlips = () => [...caspi.blips(), ...lakash.blips(), ...ilan.blips(), ...(myCar && !myCar.driving ? [{ x: myCar.pos.x, z: myCar.pos.z, icon: '🏎️', name: 'Your car' }] : []), ...outbreak.blips(), ...(races.active ? [] : races.blips())];
window.__game.races = races;
window.__game.raceDefs = { RACES };
window.__game.caspi = caspi;
window.__game.world = worldApi;
window.__game.bigMap = bigMap;
window.__game.hud = hud;
window.__game.notices = notices;
window.__game.headline = headline;
window.__game.notify = notify;
window.__game.career = career;
window.__game.progress = progress;
window.__game.openShop = openShop;
window.__game.dayNight = dayNight;
window.__game.weather = weather;
window.__game.radio = radio;
radioBtn.addEventListener('click', () => { initAudio(); radio.cycle(); });
addEventListener('keydown', (e) => { if (e.code === 'KeyR' && !e.repeat && started && ambulance.driving) radio.cycle(); });
window.__game.ambience = ambience;
window.__game.ramps = RAMPS;
window.__game.enterHospital = enterHospital;
window.__game.enterShowroom = enterShowroom;
window.__game.leaveShowroom = leaveShowroom;
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
