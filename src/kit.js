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
/** City-building materials whose windows light up at night (daynight.js sets their emissiveIntensity). */
export const NIGHT_MATS = new Set();
const GLOW_KITS = new Set(['commercial', 'suburban']);
const glowMaps = new Map();
/** An emissive map that is black except the window-glass swatch (column 5, row 0 of the 8×8 atlas) in warm light. */
function windowGlow(tex) {
  if (glowMaps.has(tex.uuid)) return glowMaps.get(tex.uuid);
  const img = tex.image, c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d'), k = img.width / 512;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#ffd98a'; ctx.fillRect(320 * k, 128 * k, 64 * k, 128 * k);
  const t = new THREE.CanvasTexture(c);
  t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  glowMaps.set(tex.uuid, t);
  return t;
}

export async function loadKits(names = ['nature', 'roads', 'cars', 'town', 'commercial', 'suburban']) {
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
          if (GLOW_KITS.has(kitName) && src.map?.image) {
            o.material.emissive = new THREE.Color(0xffffff);
            o.material.emissiveMap = windowGlow(src.map);
            o.material.emissiveIntensity = 0;
            NIGHT_MATS.add(o.material);
          }
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

// Colour variants for the city kits: their 512² colour atlas is a grid of 64-px swatches. Walls use the white
// swatch (column 3, row 1 → x 192, y 256) and suburban roofs the green one (column 0, row 0 → x 0, y 128).
export const WALL_TINTS = [null, 0xffd2ad, 0xbfe6ff, 0xcff2bd, 0xffd6e8, 0xe2d6ff, 0xfff0a8];
export const ROOF_TINTS = [null, 0x5b8fd6, 0xe0605a, 0x9a6440, 0x7a808c, 0xf0a23c];
const variantTex = new Map(), variantMat = new Map();
function tintedTexture(src, wall, roof) {
  const key = `${src.uuid}|${wall}|${roof}`;
  if (variantTex.has(key)) return variantTex.get(key);
  const img = src.image;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const k = img.width / 512;
  const tint = (x, y, w, h, hex) => {
    if (hex == null) return;
    const d = ctx.getImageData(x * k, y * k, w * k, h * k);
    const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
    for (let i = 0; i < d.data.length; i += 4) { d.data[i] *= r; d.data[i + 1] *= g; d.data[i + 2] *= b; }
    ctx.putImageData(d, x * k, y * k);
  };
  tint(192, 256, 64, 128, wall);
  if (roof != null) {
    // the roof swatch is green: rebuild it as the new colour, keeping its light→dark shading
    const d = ctx.getImageData(0, 128 * k, 64 * k, 128 * k);
    const r = (roof >> 16) & 255, g = (roof >> 8) & 255, b = roof & 255;
    for (let i = 0; i < d.data.length; i += 4) {
      const l = (d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11) / 160;
      d.data[i] = Math.min(255, r * l); d.data[i + 1] = Math.min(255, g * l); d.data[i + 2] = Math.min(255, b * l);
    }
    ctx.putImageData(d, 0, 128 * k);
  }
  const t = new THREE.CanvasTexture(c);
  t.flipY = src.flipY; t.colorSpace = src.colorSpace; t.wrapS = src.wrapS; t.wrapT = src.wrapT;
  t.magFilter = src.magFilter; t.minFilter = src.minFilter;
  variantTex.set(key, t);
  return t;
}
function variantMaterial(m, wall, roof) {
  if ((wall == null && roof == null) || !m.map?.image) return m;
  const key = `${m.uuid}|${wall}|${roof}`;
  if (!variantMat.has(key)) {
    const v = m.clone();
    v.map = tintedTexture(m.map, wall, roof);
    if (NIGHT_MATS.has(m)) NIGHT_MATS.add(v);
    variantMat.set(key, v);
  }
  return variantMat.get(key);
}

/**
 * Many copies of one model as InstancedMeshes (one draw call per part).
 * transforms: [{ x, y?, z, rot?, scale? | sx/sy/sz }]. Returns a Group.
 */
export function scatter(name, transforms, { outline = 0, cast = true, wall = null, roof = null } = {}) {
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
    const inst = new THREE.InstancedMesh(o.geometry, variantMaterial(o.material, wall, roof), placed.length);
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
