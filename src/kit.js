// Kenney asset kits (CC0, kenney.nl) packed by tools/pack-kenney.mjs into assets/kenney/<kit>.glb.
// kit(name) clones one model with the game's toon look; scatter(name, transforms) instances many copies.
import * as THREE from 'three';
import { gltfLoader } from './skinned.js';
import { outlineMaterial, softGradientMap } from './toon.js';

const templates = {}; // name → Object3D (in the kit's own units)

// Kenney's Nature Kit uses a mint/orange palette; recolour its named materials to match our park
const PALETTE = {
  leafsGreen: 0x46a83c, leafsDark: 0x2f8a35, grass: 0x5cb848,
  woodBark: 0x7a4a26, woodBarkDark: 0x5e381c,
  dirt: 0xa8875f, stone: 0xb8c0c8, stoneDark: 0x8f98a2,
  wood: 0xb07a45, woodDark: 0x8a5a32, woodInner: 0xe8c89a,
};
export const KIT_SIZES = {}; // name → THREE.Vector3 bounding-box size (handy for placement)

export async function loadKits(names = ['nature', 'roads', 'cars', 'town']) {
  await Promise.all(names.map(async (kitName) => {
    try {
      const gltf = await gltfLoader.loadAsync(new URL(`../assets/kenney/${kitName}.glb`, import.meta.url).href);
      for (const node of [...gltf.scene.children]) {
        node.position.set(0, 0, 0);
        node.updateMatrixWorld(true);
        // cartoon materials, keeping Kenney's colour atlas / vertex colours
        node.traverse((o) => {
          if (!o.isMesh) return;
          const src = o.material;
          // (not the shared toon() cache: every Kenney material keeps its own colour)
          const color = PALETTE[src.name] !== undefined ? new THREE.Color(PALETTE[src.name]) : src.color?.clone() ?? new THREE.Color(0xffffff);
          o.material = new THREE.MeshToonMaterial({ map: src.map ?? null, color, vertexColors: !!o.geometry.attributes.color, gradientMap: softGradientMap });
          o.castShadow = true;
          o.receiveShadow = true;
        });
        // three.js renames a node that shares its name with its child mesh ("stall" → "stall_1")
        const name = /_\d+$/.test(node.name) ? node.name.replace(/_\d+$/, '') : node.name;
        templates[name] = node;
        KIT_SIZES[name] = new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3());
      }
    } catch (e) {
      console.warn(`[kit] could not load ${kitName}`, e);
    }
  }));
  return templates;
}

export const hasKit = (name) => !!templates[name];

/** One copy of a model. opts: { scale, outline } */
export function kit(name, { scale = 1, outline = 0 } = {}) {
  const t = templates[name];
  if (!t) return new THREE.Group();
  const obj = t.clone(true);
  obj.scale.setScalar(scale);
  if (outline) {
    const meshes = [];
    obj.traverse((o) => { if (o.isMesh) meshes.push(o); }); // collect first: don't outline the outlines
    for (const o of meshes) { const ol = new THREE.Mesh(o.geometry, outlineMaterial(outline)); ol.raycast = () => {}; o.add(ol); }
  }
  return obj;
}

/**
 * Many copies of one model as InstancedMeshes (one draw call per part).
 * transforms: [{ x, y?, z, rot?, scale? | sx/sy/sz }]. Returns a Group.
 */
export function scatter(name, transforms, { outline = 0, cast = true } = {}) {
  const group = new THREE.Group();
  const t = templates[name];
  if (!t || !transforms.length) return group;
  t.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const placed = transforms.map((tr) => new THREE.Matrix4().compose(
    new THREE.Vector3(tr.x, tr.y ?? 0, tr.z),
    q.setFromAxisAngle(up, tr.rot ?? 0).clone(),
    new THREE.Vector3(tr.sx ?? tr.scale ?? 1, tr.sy ?? tr.scale ?? 1, tr.sz ?? tr.scale ?? 1),
  ));
  t.traverse((o) => {
    if (!o.isMesh) return;
    const local = new THREE.Matrix4().multiplyMatrices(rootInv, o.matrixWorld);
    const inst = new THREE.InstancedMesh(o.geometry, o.material, placed.length);
    inst.castShadow = cast;
    inst.receiveShadow = true;
    placed.forEach((p, i) => inst.setMatrixAt(i, m.multiplyMatrices(p, local)));
    inst.computeBoundingSphere();
    group.add(inst);
    if (outline) {
      const ol = new THREE.InstancedMesh(o.geometry, outlineMaterial(outline), placed.length);
      placed.forEach((p, i) => ol.setMatrixAt(i, m.multiplyMatrices(p, local)));
      ol.computeBoundingSphere();
      group.add(ol);
    }
  });
  return group;
}
