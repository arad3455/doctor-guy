// Shared plumbing for Meshy-generated, rigged characters: loading, toon look, clip clean-up and an
// animator that maps game states ("walk", "cry", "carried"…) onto skeletal clips with cross-fades.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { toon, outlineMaterial, softGradientMap } from './toon.js';

export const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); // assets are meshopt-compressed

/** Scales a model to `height` and stands its feet on y=0. */
export function normalizeHeight(model, height) {
  const box = new THREE.Box3().setFromObject(model);
  const scale = height / (box.max.y - box.min.y);
  model.scale.setScalar(scale);
  model.position.y = -box.min.y * scale;
}

const outlineGeoCache = new WeakMap();

/**
 * Generated meshes split vertices along texture seams, so pushing them out along their own normals
 * tears the outline into ragged strokes. The outline gets a copy of the geometry whose normals are
 * averaged across every vertex at the same position (positions/skinning are shared, not copied).
 */
function smoothOutlineGeometry(geo) {
  if (outlineGeoCache.has(geo)) return outlineGeoCache.get(geo);
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'skinIndex', 'skinWeight']) if (geo.attributes[name]) out.setAttribute(name, geo.attributes[name]);
  if (geo.index) out.setIndex(geo.index);
  const flat = geo.attributes.normal ? geo : (() => { const g = geo.clone(); g.computeVertexNormals(); return g; })();
  const pos = geo.attributes.position, nrm = flat.attributes.normal;
  const key = (i) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  const sums = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const v = sums.get(k) ?? [0, 0, 0];
    v[0] += nrm.getX(i); v[1] += nrm.getY(i); v[2] += nrm.getZ(i);
    sums.set(k, v);
  }
  const smooth = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = sums.get(key(i));
    const l = Math.hypot(x, y, z) || 1;
    smooth.set([x / l, y / l, z / l], i * 3);
  }
  out.setAttribute('normal', new THREE.BufferAttribute(smooth, 3));
  out.boundingSphere = geo.boundingSphere;
  outlineGeoCache.set(geo, out);
  return out;
}

/** Cartoon look: toon shading + a black outline that follows the skeleton. */
export function toonify(model, outline, maxAnisotropy = 8) {
  const meshes = [];
  model.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const mesh of meshes) {
    const src = mesh.material;
    if (src.map) src.map.anisotropy = maxAnisotropy; // crisp texture at grazing angles
    mesh.material = toon(0xffffff, { map: src.map ?? null, color: src.color ?? new THREE.Color(0xffffff), gradientMap: softGradientMap });
    mesh.castShadow = true;
    mesh.frustumCulled = false; // skinned bounds don't follow animation
    if (!outline) continue; // no outline (e.g. thin-panelled vehicles where the hull pokes through)
    const olGeo = smoothOutlineGeometry(mesh.geometry);
    const ol = mesh.isSkinnedMesh ? new THREE.SkinnedMesh(olGeo, outlineMaterial(outline)) : new THREE.Mesh(olGeo, outlineMaterial(outline));
    if (mesh.isSkinnedMesh) ol.bind(mesh.skeleton, mesh.bindMatrix);
    ol.frustumCulled = false;
    mesh.add(ol);
  }
}

/** Meshy names clips "Armature|Running|baselayer" etc.; map them onto the game's names. */
export function clipAlias(name) {
  const n = name.toLowerCase();
  if (n.includes('idle')) return 'idle';
  if (n.includes('walk')) return 'walk';
  if (n.includes('run')) return 'run';
  if (n.includes('jump')) return 'jump';
  if (n.includes('wave')) return 'wave';
  return n;
}

/**
 * Root motion would drag characters away from the game's own movement: keep bone rotations and
 * only the vertical part of the hips' position (so crouches, kneels and sits still lower the body).
 */
export function stripRootMotion(clip) {
  if (clip.userData?.stripped) return clip;
  clip.tracks = clip.tracks.filter((t) => !(t.name.endsWith('.position') && !/hip|pelvis|root/i.test(t.name)));
  for (const t of clip.tracks) {
    if (t.name.endsWith('.position') && /hip|pelvis|root/i.test(t.name)) {
      for (let i = 0; i < t.values.length; i += 3) { t.values[i] = t.values[0]; t.values[i + 2] = t.values[2]; }
    }
  }
  clip.userData = { ...clip.userData, stripped: true };
  return clip;
}

/**
 * Some library clips (e.g. Meshy's "Idle") turn the whole body sideways. Rotate each clip's hips
 * track so the character faces the same way as in its bind pose; the game handles facing itself.
 */
export function faceForward(clips, model) {
  const hips = findBone(model, /hips?$/i);
  if (!hips?.parent) return;
  model.updateMatrixWorld(true);
  const bindQ = hips.getWorldQuaternion(new THREE.Quaternion());
  const fLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(bindQ.clone().invert()); // "forward" in hips space
  const parentQ = hips.parent.getWorldQuaternion(new THREE.Quaternion());
  const parentInv = parentQ.clone().invert();
  for (const clip of Object.values(clips)) {
    if (clip.userData?.facing) continue;
    const track = clip.tracks.find((t) => t.name === `${hips.name}.quaternion`);
    if (!track) continue;
    const q0 = new THREE.Quaternion().fromArray(track.values, 0);
    const fWorld = fLocal.clone().applyQuaternion(parentQ.clone().multiply(q0));
    const yaw = Math.atan2(fWorld.x, fWorld.z);
    if (Math.abs(yaw) > 0.15) {
      const fix = parentInv.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw)).multiply(parentQ);
      const q = new THREE.Quaternion();
      for (let i = 0; i < track.values.length; i += 4) {
        q.fromArray(track.values, i).premultiply(fix).toArray(track.values, i);
      }
    }
    clip.userData = { ...clip.userData, facing: true };
  }
}

/** Loads one animation per file, keyed by game clip name. Missing files are skipped. */
export async function loadClips(base, files, tag) {
  const clips = {};
  await Promise.all(Object.entries(files ?? {}).map(async ([name, file]) => {
    try {
      const g = await gltfLoader.loadAsync(new URL(file, base).href);
      if (g.animations[0]) clips[name] = stripRootMotion(g.animations[0]);
    } catch (e) {
      console.warn(`[${tag}] could not load clip ${name}`, e);
    }
  }));
  return clips;
}

/** Time in a clip where the hips are lowest (e.g. fully down on one knee, bent over). */
export function lowestHipsTime(clip) {
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

/**
 * Drives a model's AnimationMixer from game states.
 * stateClips: { state: [clip names to try, in order] }. Clips named "jump" play as a one-shot while airborne.
 */
export function createAnimator(model, clips, stateClips) {
  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(Object.entries(clips).map(([k, c]) => [k, mixer.clipAction(c)]));
  let current = null;
  let oneShot = null; // { name, action, end, hold, holdAt }
  let t = 0;

  function crossTo(action) {
    if (current === action) return;
    action.fadeIn(0.18).play();
    current?.fadeOut(0.18);
    current = action;
  }

  /** Plays a clip once. Returns its length in seconds (capped by maxTime), 0 if missing. */
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
      if (oneShot.hold) return; // e.g. kneeling: stays down until release()
      if (oneShot.name === 'jump' ? state === 'air' : t < oneShot.end && !moving) return;
      oneShot = null;
    }
    if (state === 'air' && actions.jump) { playOnce('jump', { timeScale: 1.2 }); return; }
    const name = (stateClips[state] ?? ['idle']).find((n) => actions[n]) ?? 'idle';
    const action = actions[name];
    if (!action) return;
    if (name === 'walk') action.timeScale = speed ? THREE.MathUtils.clamp(speed / 3.5, 0.6, 1.6) : 1;
    if (name === 'run') action.timeScale = speed ? THREE.MathUtils.clamp(speed / 7.5, 0.8, 1.4) : 1;
    if (current !== action) {
      action.reset();
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.time = Math.random() * action.getClip().duration; // de-sync crowds
    }
    crossTo(action);
  }

  return {
    actions,
    get current() { return current; },
    /** Progress 0..1 of the playing one-shot clip (1 when none). */
    get progress() { return oneShot ? Math.min(1, oneShot.action.time / oneShot.action.getClip().duration) : 1; },
    playOnce,
    /** Ends the current one-shot early so the normal state animation blends back in. */
    endOnce() { if (oneShot && !oneShot.hold) oneShot.end = t; },
    /** Lets a held one-shot (holdAt) finish; returns the seconds it takes. */
    release() {
      if (!oneShot?.hold) return 0;
      oneShot.hold = false;
      oneShot.action.paused = false;
      const left = (oneShot.action.getClip().duration - oneShot.action.time) / oneShot.action.timeScale;
      oneShot.end = t + left;
      return left;
    },
    update(state, dt, speed = 0) {
      t += dt;
      play(state, speed);
      if (oneShot?.hold && oneShot.action.time >= oneShot.holdAt) oneShot.action.paused = true;
      mixer.update(dt);
    },
  };
}

/**
 * Parents `obj` to a bone so it follows the animation, placed at `point` (in the character root's
 * space, measured in the bind pose) and with unit world scale regardless of the armature's units.
 */
export function attachToBone(root, bone, obj, point) {
  root.updateMatrixWorld(true);
  const world = root.localToWorld(point.clone());
  bone.add(obj);
  obj.position.copy(bone.worldToLocal(world));
  const s = bone.getWorldScale(new THREE.Vector3());
  obj.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
  const q = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
  obj.quaternion.copy(q.multiply(root.getWorldQuaternion(new THREE.Quaternion())));
}

export const findBone = (model, re) => {
  let found = null;
  model.traverse((o) => { if (!found && o.isBone && re.test(o.name)) found = o; });
  return found;
};

/** Builds a one-pose "idle" clip from the walk cycle, at the moment the feet pass each other. */
export function standingPoseFrom(walk, model) {
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(walk).play();
  const left = findBone(model, /left.?foot$/i);
  const right = findBone(model, /right.?foot$/i);
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
