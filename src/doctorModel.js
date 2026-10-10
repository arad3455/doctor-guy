// Loads the generated, rigged Doctor Guy (assets/doctor-guy/manifest.json) and wraps it in the
// same rig interface the procedural model exposes. Returns null if no generated model exists yet.
import * as THREE from 'three';
import { gltfLoader, normalizeHeight, toonify, clipAlias, stripRootMotion, loadClips, lowestHipsTime, createAnimator, faceForward, standingPoseFrom, attachToBone, findBone } from './skinned.js';
// (clips loaded from a file use their first animation; Meshy's motion clips also carry a bind-pose 'clip0')

const BASE = new URL('../assets/doctor-guy/', import.meta.url);
const GAME_HEIGHT = 2.45; // matches the procedural Doctor Guy so collisions/camera stay the same
const OUTLINE = 0.011; // in world units (thin: the scanned surface has many small folds)
const _q = new URLSearchParams(location.search);
const RIDE_LIFT = Number(_q.get('rideLift') ?? 0.15); // bottom height above the base of the neck
const RIDE_BACK = Number(_q.get('rideBack') ?? 0.18); // how far behind the neck the bottom sits

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

  const gltf = await gltfLoader.loadAsync(new URL(manifest.model, BASE).href);
  const model = gltf.scene;
  normalizeHeight(model, GAME_HEIGHT);
  toonify(model, OUTLINE);

  // clips embedded in the model (clip0 = Meshy's bind pose) + one file per action
  const clips = {};
  for (const c of gltf.animations) if (!/clip0/i.test(c.name)) clips[clipAlias(c.name)] = stripRootMotion(c);
  Object.assign(clips, await loadClips(BASE, manifest.clips, 'doctor'));
  faceForward(clips, model);

  // No idle clip? Freeze the walk at the frame where the feet are closest together.
  const syntheticIdle = !clips.idle && !!clips.walk;
  if (syntheticIdle) clips.idle = standingPoseFrom(clips.walk, model);

  const root = new THREE.Group();
  const body = new THREE.Group(); // carry anchor (no bobbing — the skeleton animates)
  root.add(body);
  body.add(model);
  const anim = createAnimator(model, clips, STATE_CLIPS);
  const kneelHold = clips.kneel ? lowestHipsTime(clips.kneel) : 0;

  // ---- stethoscope prop for check-ups: earpieces at the neck, a tube to a chest piece in the right hand
  const neckBone = findBone(model, /neck/i);
  const handBone = findBone(model, /right.?hand$/i);
  const steth = new THREE.Group();
  steth.visible = false;
  root.add(steth);
  const tubeMat = new THREE.MeshToonMaterial({ color: 0x1f1f24 });
  let tube = null;
  const chestPiece = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.035, 20), new THREE.MeshToonMaterial({ color: 0xd8dde3 }));
  disc.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 20), new THREE.MeshToonMaterial({ color: 0x9aa3ad }));
  chestPiece.add(disc, rim);
  steth.add(chestPiece);
  const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  function updateSteth() {
    if (!steth.visible || !neckBone || !handBone) return;
    root.updateMatrixWorld(true);
    // from the base of the neck (in front of the chest) to the hand
    neckBone.getWorldPosition(a); root.worldToLocal(a);
    a.y -= 0.12; a.z += 0.12;
    handBone.getWorldPosition(b); root.worldToLocal(b);
    // the chest piece sits a little past the palm, facing forward
    const fwd = v.set(0, 0, 1);
    const piece = b.clone().addScaledVector(fwd, 0.1);
    chestPiece.position.copy(piece);
    const mid = a.clone().lerp(piece, 0.5); mid.y -= 0.25; mid.z += 0.05; // the tube sags
    const curve = new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).setY(a.y - 0.18), mid, piece]);
    tube?.geometry.dispose();
    if (!tube) { tube = new THREE.Mesh(new THREE.BufferGeometry(), tubeMat); steth.add(tube); }
    tube.geometry = new THREE.TubeGeometry(curve, 20, 0.018, 6);
  }
  // where the hand is (relative to Doctor Guy's feet) at the listening moment of the clip
  const waits = []; // pending untilClip() promises
  let reach = 0.9;
  if (clips.stethoscope && handBone) {
    const tmp = new THREE.AnimationMixer(model);
    const act = tmp.clipAction(clips.stethoscope).play();
    act.time = clips.stethoscope.duration * 0.5;
    tmp.update(0);
    root.updateMatrixWorld(true);
    handBone.getWorldPosition(b); root.worldToLocal(b);
    reach = b.z + 0.1;
    act.stop(); tmp.uncacheRoot(model);
  }
  let t = 0;

  return {
    root,
    body,
    generated: true,
    height: GAME_HEIGHT,
    clips: Object.keys(clips),
    // kid rides on the shoulders, just behind the head
    carryOffset: new THREE.Vector3(0, GAME_HEIGHT * 0.78 - 0.36, -0.26),
    /**
     * Seats a kid on his shoulders: their bottom rests on the base of his neck and they ride on his
     * upper spine, so they move with every step instead of floating at a fixed height.
     * seat = the kid's sitting measurements ({ bottom, z } relative to their feet).
     */
    mountRider(kidRoot, seat = { bottom: 0.4, z: 0 }) {
      const spine = findBone(model, /spine0?2$/i) ?? findBone(model, /spine/i);
      const neck = findBone(model, /neck/i);
      if (!spine || !neck) return false;
      anim.update('idle', 0); // measure in a neutral standing pose
      root.updateMatrixWorld(true);
      const n = root.worldToLocal(neck.getWorldPosition(new THREE.Vector3()));
      // straddling the neck: bottom just above the neck base, thighs forward over the shoulders
      const point = new THREE.Vector3(n.x, n.y + RIDE_LIFT - seat.bottom, n.z - seat.z - RIDE_BACK);
      kidRoot.removeFromParent();
      kidRoot.rotation.set(0, 0, 0);
      attachToBone(root, spine, kidRoot, point);
      return true;
    },
    playOnce: anim.playOnce,
    endOnce: anim.endOnce,
    /** Seconds until the hips are lowest in a clip (e.g. bent over to grab something). */
    timeToLowest(name, timeScale = 1) { return clips[name] ? lowestHipsTime(clips[name]) / timeScale : 0; },
    /** Drops to one knee and holds there; returns the seconds it takes to get down. */
    kneel() {
      if (!clips.kneel) return 0;
      anim.playOnce('kneel', { timeScale: 1.4, holdAt: kneelHold });
      return kneelHold / 1.4;
    },
    /** Finishes the kneel clip (stands back up); returns the seconds it takes. */
    standUp: anim.release,
    /** Stethoscope check-up: plays the listening clip with the stethoscope in hand. Returns its length. */
    checkup(timeScale = 1.15) {
      if (!clips.stethoscope) return 0;
      steth.visible = true;
      return anim.playOnce('stethoscope', { timeScale });
    },
    hideStethoscope() { steth.visible = false; },
    /** Resolves when the playing one-shot clip reaches `fraction` (in game time, so it stays in sync at any frame rate). */
    untilClip(fraction) { return new Promise((resolve) => waits.push({ fraction, resolve })); },
    /** How far in front of Doctor Guy the chest piece ends up (so he can stand at the right distance). */
    get checkupReach() { return reach; },
    animate(state, dt, speed = 0) {
      t += dt;
      anim.update(state, dt, speed);
      updateSteth();
      for (let i = waits.length - 1; i >= 0; i--) if (anim.progress >= waits[i].fraction) { waits[i].resolve(); waits.splice(i, 1); }
      // gentle breathing when the idle is a single synthesised pose
      body.position.y = syntheticIdle && anim.current === anim.actions.idle ? Math.sin(t * 2.2) * 0.012 : 0;
    },
  };
}
