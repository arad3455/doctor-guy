// Loads the generated, rigged Doctor Guy (assets/doctor-guy/manifest.json) and wraps it in the
// same rig interface the procedural model exposes. Returns null if no generated model exists yet.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toon, outlineMaterial } from './toon.js';

const BASE = new URL('../assets/doctor-guy/', import.meta.url);
const GAME_HEIGHT = 2.45; // matches the procedural Doctor Guy so collisions/camera stay the same
const OUTLINE = 0.011; // in world units (thin: the scanned surface has many small folds)

// Game animation state → clip names to try, in order
const STATE_CLIPS = {
  idle: ['idle'],
  walk: ['walk'],
  run: ['run', 'walk'],
  air: ['run'], // the jump clip is played as a one-shot instead
  wave: ['wave', 'idle'],
  flail: ['wave', 'idle'],
  cry: ['idle'],
  sit: ['idle'],
  carrying: ['carry_idle', 'idle'],
  'carrying-walk': ['carry_walk', 'walk'],
};

export async function loadDoctorModel() {
  let manifest;
  try {
    const res = await fetch(new URL('manifest.json', BASE));
    if (!res.ok) return null;
    manifest = await res.json();
    if (!manifest.model) return null; // pipeline hasn't produced a model yet
  } catch {
    return null;
  }

  const loader = new GLTFLoader();
  const load = (file) => loader.loadAsync(new URL(file, BASE).href);
  const gltf = await load(manifest.model);
  const model = gltf.scene;

  // Normalise size and put the feet on the ground
  const box = new THREE.Box3().setFromObject(model);
  const scale = GAME_HEIGHT / (box.max.y - box.min.y);
  model.scale.setScalar(scale);
  model.position.y = -box.min.y * scale;

  // Cartoon look: toon shading + black outline that follows the skeleton
  const meshes = [];
  model.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const mesh of meshes) {
    const src = mesh.material;
    mesh.material = toon(0xffffff, { map: src.map ?? null, color: src.color ?? new THREE.Color(0xffffff) });
    mesh.castShadow = true;
    mesh.frustumCulled = false; // skinned bounds don't follow animation
    const ol = mesh.isSkinnedMesh ? new THREE.SkinnedMesh(mesh.geometry, outlineMaterial(OUTLINE)) : new THREE.Mesh(mesh.geometry, outlineMaterial(OUTLINE));
    if (mesh.isSkinnedMesh) ol.bind(mesh.skeleton, mesh.bindMatrix);
    ol.frustumCulled = false;
    mesh.add(ol);
  }

  // Animations: clips from the rigged file plus one file per action
  const clips = {};
  // Meshy names clips "Running", "Walking", "Idle"…; map them onto the game's names
  const alias = (name) => {
    const n = name.toLowerCase();
    if (n.includes('idle')) return 'idle';
    if (n.includes('walk')) return 'walk';
    if (n.includes('run')) return 'run';
    if (n.includes('jump')) return 'jump';
    if (n.includes('wave')) return 'wave';
    return n;
  };
  for (const c of gltf.animations) if (!/clip0/i.test(c.name)) clips[alias(c.name)] = c; // clip0 = Meshy's bind-pose clip
  for (const [name, file] of Object.entries(manifest.clips ?? {})) {
    try {
      const g = await load(file);
      if (g.animations[0]) clips[name] = g.animations[0];
    } catch (e) {
      console.warn(`[doctor] could not load clip ${name}`, e);
    }
  }
  // Root motion would drag the character away from the controller; keep only rotations + vertical hips
  for (const clip of Object.values(clips)) {
    clip.tracks = clip.tracks.filter((t) => !(t.name.endsWith('.position') && !/hip|pelvis|root/i.test(t.name)));
    for (const t of clip.tracks) {
      if (t.name.endsWith('.position') && /hip|pelvis|root/i.test(t.name)) {
        for (let i = 0; i < t.values.length; i += 3) { t.values[i] = t.values[0]; t.values[i + 2] = t.values[2]; }
      }
    }
  }

  // No idle clip? Freeze the walk at the frame where the feet are closest together.
  const syntheticIdle = !clips.idle && !!clips.walk;
  if (syntheticIdle) clips.idle = standingPoseFrom(clips.walk, model);

  const root = new THREE.Group();
  const body = new THREE.Group(); // carry anchor (no bobbing — the skeleton animates)
  root.add(body);
  body.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(Object.entries(clips).map(([k, c]) => [k, mixer.clipAction(c)]));
  const kneelHold = clips.kneel ? lowestHipsTime(clips.kneel) : 0;
  let current = null;
  let oneShot = null; // { name, action, end, hold, holdAt }
  let t = 0;

  function crossTo(action) {
    if (current === action) return;
    action.fadeIn(0.18).play();
    current?.fadeOut(0.18);
    current = action;
  }

  /** Plays a clip once (cheer, wave, pickup, jump, kneel). Returns its length in seconds, 0 if missing. */
  function playOnce(name, { timeScale = 1, holdAt = null, maxTime = Infinity } = {}) {
    const action = actions[name];
    if (!action) return 0;
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = timeScale;
    current = current === action ? null : current;
    crossTo(action);
    const duration = Math.min(action.getClip().duration / timeScale, maxTime);
    oneShot = { name, action, end: t + duration, hold: holdAt !== null, holdAt };
    return duration;
  }

  function play(state, speed) {
    if (oneShot) {
      const moving = state === 'walk' || state === 'run' || state === 'carrying-walk';
      if (oneShot.hold) return; // kneeling: stays down until standUp()
      if (oneShot.name === 'jump' ? state === 'air' : t < oneShot.end && !moving) return;
      oneShot = null;
    }
    if (state === 'air' && actions.jump) { playOnce('jump', { timeScale: 1.2 }); return; }
    const name = (STATE_CLIPS[state] ?? ['idle']).find((n) => actions[n]) ?? 'idle';
    const action = actions[name];
    if (!action) return;
    if (name === 'walk') action.timeScale = THREE.MathUtils.clamp(speed / 3.5, 0.6, 1.6);
    if (name === 'run') action.timeScale = THREE.MathUtils.clamp(speed / 7.5, 0.8, 1.4);
    if (current !== action) {
      action.reset();
      action.setLoop(THREE.LoopRepeat, Infinity);
    }
    crossTo(action);
  }

  return {
    root,
    body,
    generated: true,
    height: GAME_HEIGHT,
    clips: Object.keys(clips),
    // kid rides on the shoulders, just behind the head
    carryOffset: new THREE.Vector3(0, GAME_HEIGHT * 0.78 - 0.36, -0.26),
    playOnce,
    /** Ends the current one-shot early so the normal state animation blends back in. */
    endOnce() { if (oneShot && !oneShot.hold) oneShot.end = t; },
    /** Seconds until the hips are lowest in a clip (e.g. bent over to grab something). */
    timeToLowest(name, timeScale = 1) { return clips[name] ? lowestHipsTime(clips[name]) / timeScale : 0; },
    /** Drops to one knee and holds there; resolves the seconds it takes to get down. */
    kneel() {
      if (!actions.kneel) return 0;
      playOnce('kneel', { timeScale: 1.4, holdAt: kneelHold });
      return kneelHold / 1.4;
    },
    /** Finishes the kneel clip (stands back up); returns the seconds it takes. */
    standUp() {
      if (!oneShot?.hold) return 0;
      oneShot.hold = false;
      oneShot.action.paused = false;
      const left = (oneShot.action.getClip().duration - oneShot.action.time) / oneShot.action.timeScale;
      oneShot.end = t + left;
      return left;
    },
    animate(state, dt, speed = 0) {
      t += dt;
      play(state, speed);
      if (oneShot?.hold && oneShot.action.time >= oneShot.holdAt) oneShot.action.paused = true;
      mixer.update(dt);
      // gentle breathing when the idle is a single synthesised pose
      body.position.y = syntheticIdle && current === actions.idle ? Math.sin(t * 2.2) * 0.012 : 0;
    },
  };
}

/** Time in a clip where the hips are lowest (e.g. fully down on one knee). */
function lowestHipsTime(clip) {
  const track = clip.tracks.find((tr) => /hips?\.position$/i.test(tr.name));
  if (!track) return clip.duration * 0.4;
  const interp = track.createInterpolant();
  let best = 0, bestY = Infinity;
  for (let i = 0; i <= 80; i++) {
    const time = (i / 80) * clip.duration;
    const y = interp.evaluate(time)[1];
    if (y < bestY) { bestY = y; best = time; }
  }
  return best;
}

/** Builds a one-pose "idle" clip from the walk cycle, at the moment the feet pass each other. */
function standingPoseFrom(walk, model) {
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(walk).play();
  const left = model.getObjectByName('mixamorigLeftFoot') ?? model.getObjectByName('mixamorig:LeftFoot');
  const right = model.getObjectByName('mixamorigRightFoot') ?? model.getObjectByName('mixamorig:RightFoot');
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  let best = 0, bestD = Infinity;
  for (let i = 0; i < 60; i++) {
    const time = (i / 60) * walk.duration;
    action.time = time;
    mixer.update(0);
    model.updateMatrixWorld(true);
    if (!left || !right) break;
    left.getWorldPosition(a);
    right.getWorldPosition(b);
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < bestD) { bestD = d; best = time; }
  }
  action.stop();
  mixer.uncacheRoot(model);
  const tracks = walk.tracks.map((track) => {
    const v = track.createInterpolant().evaluate(best).slice();
    const Track = track.constructor;
    return new Track(track.name, [0, 1], [...v, ...v]);
  });
  return new THREE.AnimationClip('idle', 1, tracks);
}
