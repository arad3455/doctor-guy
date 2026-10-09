// Loads the generated, rigged Doctor Guy (assets/doctor-guy/manifest.json) and wraps it in the
// same rig interface the procedural model exposes. Returns null if no generated model exists yet.
import * as THREE from 'three';
import { gltfLoader, normalizeHeight, toonify, clipAlias, stripRootMotion, loadClips, lowestHipsTime, createAnimator, faceForward, standingPoseFrom, attachToBone, findBone } from './skinned.js';

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
    animate(state, dt, speed = 0) {
      t += dt;
      anim.update(state, dt, speed);
      // gentle breathing when the idle is a single synthesised pose
      body.position.y = syntheticIdle && anim.current === anim.actions.idle ? Math.sin(t * 2.2) * 0.012 : 0;
    },
  };
}
