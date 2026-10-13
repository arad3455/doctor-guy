// Hand-made poses on top of the Meshy clips: reach an arm to a point in the world (two-bone IK), so a character
// can hold a beam exactly where it is, or swing a hammer onto a post. Works in world space, so it doesn't care
// which way each bone's local axes point.
import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _cur = new THREE.Vector3(), _want = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _id = new THREE.Quaternion();

/** Turn `bone` so the direction bone → child points at `target` (world). weight 0..1 blends with the clip. */
export function aimBone(bone, child, target, weight = 1) {
  bone.getWorldPosition(_a);
  child.getWorldPosition(_b);
  _cur.subVectors(_b, _a).normalize();
  _want.subVectors(target, _a).normalize();
  _q.setFromUnitVectors(_cur, _want);
  if (weight < 1) _q.slerpQuaternions(_id, _qb.copy(_q), weight); // (slerpQuaternions copies its first argument into _q first)
  bone.getWorldQuaternion(_qw);
  bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(_q.multiply(_qw)));
  bone.updateMatrixWorld(true);
}

const _s = new THREE.Vector3(), _e = new THREE.Vector3(), _h = new THREE.Vector3(), _dir = new THREE.Vector3(), _pole = new THREE.Vector3(), _t = new THREE.Vector3();

/**
 * Two-bone IK for one arm: put the hand at `target` (world), the elbow bending towards `pole` (a world direction,
 * e.g. down and out). arm = { upper, fore, hand } bones.
 */
export function reach(arm, target, pole, weight = 1) {
  const { upper, fore, hand } = arm;
  upper.getWorldPosition(_s);
  fore.getWorldPosition(_e);
  hand.getWorldPosition(_h);
  const l1 = _s.distanceTo(_e), l2 = _e.distanceTo(_h);
  _dir.subVectors(target, _s);
  const d = THREE.MathUtils.clamp(_dir.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  _dir.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _pole.copy(pole).addScaledVector(_dir, -pole.dot(_dir)).normalize();
  const elbow = _t.copy(_s).addScaledVector(_dir, a).addScaledVector(_pole, h);
  aimBone(upper, fore, elbow, weight);
  const handAt = new THREE.Vector3().copy(_s).addScaledVector(_dir, d);
  aimBone(fore, hand, handAt, weight);
}

/** The arm bones of a Meshy rig ('Left' | 'Right'). */
export function armBones(rig, side) {
  const upper = rig.bone(new RegExp(`^${side}Arm$`, 'i')), fore = rig.bone(new RegExp(`^${side}ForeArm$`, 'i')), hand = rig.bone(new RegExp(`^${side}Hand$`, 'i'));
  return upper && fore && hand ? { upper, fore, hand } : null;
}

/** A claw hammer (handle along +y, head at the top), for Caspi's dad. */
export function makeHammer(scale = 1) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.36, 8), new THREE.MeshToonMaterial({ color: 0xc08a50 }));
  handle.position.y = 0.12;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.06), new THREE.MeshToonMaterial({ color: 0x9aa3ad }));
  head.position.y = 0.3;
  for (const m of [handle, head]) { m.castShadow = true; g.add(m); }
  g.scale.setScalar(scale);
  return g;
}
