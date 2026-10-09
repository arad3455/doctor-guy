// Generated, rigged kids (assets/kids/manifest.json). Every kid shares one animation set — Meshy rigs
// use the same bone names, so clips made on one kid play on all of them. Looks without a generated
// model keep the procedural kid (see buildKid in characters.js).
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { gltfLoader, normalizeHeight, toonify, loadClips, createAnimator, attachToBone, findBone, faceForward, standingPoseFrom } from './skinned.js';
import { toon } from './toon.js';

const BASE = new URL('../assets/kids/', import.meta.url);
const OUTLINE = 0.008;
const DEFAULT_HEIGHT = 1.4; // same as the procedural kids, so bubbles/colliders/carrying line up
const HEIGHTS = { teddyToddler: 1.1, mom: 2.05 };
const BIND_POSE = new URLSearchParams(location.search).has('bind');

// Game state → shared kid clips (see ACTIONS in tools/meshy-kids.mjs)
const STATE_CLIPS = {
  idle: ['idle'],
  walk: ['walk'],
  run: ['run', 'walk'],
  limp: ['limp', 'walk'],
  cry: ['help', 'idle'],
  wave: ['help', 'idle'],
  flail: ['swim', 'help'],
  sit: ['sit', 'idle'],
  carried: ['sit', 'idle'],
  air: ['idle'],
  cheer: ['cheer', 'idle'],
};

const templates = {}; // look → { model, height, seat }
let clips = {};

/** Loads every generated kid once at start-up. Safe to call when no kids have been generated. */
export async function preloadKids() {
  let manifest;
  try {
    const res = await fetch(new URL('manifest.json', BASE));
    if (!res.ok) return;
    manifest = await res.json();
  } catch {
    return;
  }
  clips = await loadClips(BASE, manifest.clips, 'kids');
  await Promise.all(Object.entries(manifest.kids ?? {}).map(async ([look, file]) => {
    try {
      const gltf = await gltfLoader.loadAsync(new URL(file, BASE).href);
      const model = gltf.scene;
      const height = HEIGHTS[look] ?? DEFAULT_HEIGHT;
      normalizeHeight(model, height);
      toonify(model, OUTLINE);
      faceForward(clips, model); // shared clips: fixed once, on whichever kid loads first
      // Meshy's library Idle twists kid proportions around; stand still in a walk pose instead
      if (clips.walk && !clips.idle?.userData?.synthetic) {
        clips.idle = standingPoseFrom(clips.walk, model);
        clips.idle.userData = { synthetic: true };
      }
      templates[look] = { model, height, seat: measureSeat(model, height) };
    } catch (e) {
      console.warn(`[kids] could not load ${look}`, e);
    }
  }));
  console.info('[kids] generated models:', Object.keys(templates).join(', ') || 'none');
}

export const hasKidModel = (look) => !!templates[look];

/**
 * Sitting pose measurements (relative to the feet): `hips` = hip joint height (used for riding on
 * shoulders), `bottom` = lowest point of the bottom/thighs and `z` = where that contact patch is
 * centred front-to-back — so a kid can be placed sitting ON a swing seat instead of through it.
 */
function measureSeat(template, height) {
  const fallback = { hips: 0.52, bottom: 0.4, z: 0 };
  if (!clips.sit) return fallback;
  const model = cloneSkinned(template);
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(clips.sit).play();
  mixer.update(0.5);
  model.updateMatrixWorld(true);
  const hipsBone = findBone(model, /hips?$/i);
  if (!hipsBone) return fallback;
  const hp = hipsBone.getWorldPosition(new THREE.Vector3());
  let bottom = Infinity, zSum = 0, n = 0;
  const v = new THREE.Vector3();
  model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.skeleton.update();
    const count = o.geometry.attributes.position.count;
    for (let i = 0; i < count; i += 3) {
      o.getVertexPosition(i, v); // skinned (posed) position
      o.localToWorld(v);
      // the patch under the bottom and thighs: near the hips sideways, from behind the hips to mid-thigh
      if (Math.abs(v.x - hp.x) > height * 0.16 || v.z < hp.z - height * 0.1 || v.z > hp.z + height * 0.18 || v.y > hp.y) continue;
      if (v.y < bottom) bottom = v.y;
      zSum += v.z; n++;
    }
  });
  mixer.stopAllAction();
  return n ? { hips: hp.y, bottom, z: zSum / n } : { ...fallback, hips: hp.y };
}

export function buildKid3D(look) {
  const tpl = templates[look];
  const H = tpl.height;
  const model = cloneSkinned(tpl.model);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(model);
  root.updateMatrixWorld(true);
  const anim = createAnimator(model, clips, STATE_CLIPS);
  let t = 0;
  const phase = Math.random() * 6;

  // Cartoon tears on the cheeks (shown while crying), riding on the head bone
  const tears = new THREE.Group();
  for (const sx of [-1, 1]) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(H * 0.013, 8, 6), toon(0x6fc6ff));
    drop.position.set(sx * H * 0.085, 0, 0);
    drop.scale.y = 1.6;
    tears.add(drop);
  }
  tears.visible = false;
  const head = findBone(model, /^head$/i) ?? findBone(model, /head/i);
  if (head) attachToBone(root, head, tears, new THREE.Vector3(0, H * 0.82, H * 0.13));
  else { tears.position.set(0, H * 0.76, H * 0.15); body.add(tears); }

  // Plaster cast on the right forearm (broken-arm emergency)
  const cast = new THREE.Group();
  const fore = findBone(model, /right.*fore.*arm/i);
  const hand = findBone(model, /right.*hand$/i);
  if (fore && hand) {
    const a = fore.getWorldPosition(new THREE.Vector3());
    const b = hand.getWorldPosition(new THREE.Vector3());
    const len = a.distanceTo(b);
    const tube = new THREE.Mesh(new THREE.CapsuleGeometry(H * 0.04, len * 0.7, 4, 10), toon(0xffffff));
    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    tube.castShadow = true;
    cast.add(tube);
    attachToBone(root, fore, cast, a.clone().lerp(b, 0.5));
  }
  cast.visible = false;

  return {
    root,
    body,
    head: new THREE.Group(), // procedural-only API (head tilt); unused by generated kids
    tears,
    cast,
    height: H,
    look,
    generated: true,
    seatHeight: tpl.seat.hips, // hip height while sitting (riding on shoulders)
    seat: tpl.seat,
    playOnce: anim.playOnce,
    animate(state, dt, speed = 0) {
      t += dt;
      if (BIND_POSE) return; // debug: ?bind shows the raw rig
      anim.update(state, dt, speed);
      body.position.y = anim.current === anim.actions.idle ? Math.sin(t * 2.6 + phase) * 0.01 : 0; // breathing
    },
  };
}
