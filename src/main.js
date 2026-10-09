import * as THREE from 'three';
import { buildWorld } from './world.js';
import { buildBeach } from './beach.js';
import { Player, Input, FollowCamera } from './player.js';
import { MissionSystem } from './missions.js';
import { MiniGame } from './minigame.js';
import { HUD } from './hud.js';
import { initAudio, sfx } from './audio.js';
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
scene.fog = new THREE.Fog(0xc4ecff, 90, 220);

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

const { world: park, animated, swingSeats } = buildWorld(scene);
const beach = buildBeach(scene);
animated.push(...beach.animated);
const input = new Input(canvas);
if (isTouch) input.distance = 9.5; // a bit further out on small screens
const player = new Player(scene);
// Use the generated, rigged Doctor Guy when assets/doctor-guy/ has one; otherwise keep the procedural model.
const doctorReady = loadDoctorModel()
  .then((rig) => { if (rig) { player.setRig(rig); console.info('[doctor] generated model loaded, clips:', rig.clips.join(', ')); } })
  .catch((e) => console.warn('[doctor] generated model failed to load, using procedural model', e));
const follow = new FollowCamera(camera);
const hud = new HUD();
const minigame = new MiniGame();

let started = false;
const ui = {
  swingSeats,
  minigame,
  toast: (h, ms) => hud.toast(h, ms),
  prompt: (l) => hud.prompt(l),
  onFinished: () => {
    sfx.fanfare();
    const mins = Math.floor(missions.time / 60), secs = Math.floor(missions.time % 60);
    document.getElementById('end-stats').innerHTML =
      `🍭 <b>${missions.lollipops}</b> lollipops · ⏱️ ${mins}:${String(secs).padStart(2, '0')}<br><small>Next zone: The Zoo 🦁 (coming soon)</small>`;
    document.getElementById('end').classList.remove('hidden');
    hud.show(false);
    started = false;
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
window.__game = { player, missions, input, scene, minigame, follow, renderer };

const TITLE_VIEW = { pos: new THREE.Vector3(0, 0, 4) }; // fountain area
const clock = new THREE.Clock();
let t = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  t += dt;
  for (const a of animated) a.update(t, dt);

  if (started) {
    input.enabled = !minigame.active;
    const wasGround = player.onGround;
    player.update(dt, t, input);
    if (wasGround && !player.onGround && player.vel.y > 0) sfx.jump();
    missions.update(dt, t, input);
    minigame.update(dt);
    hud.update(missions, player);
  } else {
    // Title screen: slow orbit around the park
    input.yaw += dt * 0.08;
    player.update(dt, t, { down: () => false, hit: () => false, yaw: input.yaw });
  }
  // Title screen: orbit high above the middle of the park (orbiting Doctor Guy at the hospital door put
  // the camera inside the hospital for the first seconds — the old "black background" on start-up)
  if (started) follow.update(dt, player, input);
  else follow.update(dt, TITLE_VIEW, { yaw: input.yaw, pitch: 0.42, distance: 30 });

  // Streaming: only draw a zone's props when you're near it (the sea/sand horizon always stays)
  park.visible = player.pos.z < 105;
  beach.group.visible = player.pos.z > 25;

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
await Promise.all([doctorReady, preloadKids()]); // kids fall back to procedural ones per look
missions = new MissionSystem(scene, player, ui);
window.__game.missions = missions;
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
