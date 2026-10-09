// GLB helpers for the Meshy pipeline.
//   node tools/glb-tools.mjs rig-input <in.glb> <out.glb>   → static textured mesh (no skin/anims), JPEG base colour
//   node tools/glb-tools.mjs model <in.glb> <out.glb> [px]  → web model: base colour only (WebP, default 2048px), pruned
//   node tools/glb-tools.mjs anim <in.glb> <out.glb>        → animation-only file: skeleton + clips, no mesh/textures
//   node tools/glb-tools.mjs compress <in.glb> <out.glb>    → meshopt-compress geometry + animation (smaller download)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, meshopt, resample } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const [, , mode, input, output, sizeArg] = process.argv;
const SIZE = Number(sizeArg) || 2048; // max texture size for 'model' mode
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
const root = doc.getRoot();

const baseColourOnly = () => {
  for (const mat of root.listMaterials()) {
    mat.setNormalTexture(null);
    mat.setMetallicRoughnessTexture(null);
    mat.setOcclusionTexture(null);
    mat.setEmissiveTexture(null);
  }
};

if (mode === 'rig-input') {
  baseColourOnly();
  for (const a of root.listAnimations()) a.dispose();
  for (const node of root.listNodes()) node.setSkin(null);
  for (const s of root.listSkins()) s.dispose();
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) {
      prim.setAttribute('JOINTS_0', null);
      prim.setAttribute('WEIGHTS_0', null);
    }
  await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [2048, 2048], quality: 90 }));
} else if (mode === 'model') {
  baseColourOnly();
  await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [SIZE, SIZE], quality: 85 }));
} else if (mode === 'anim') {
  for (const node of root.listNodes()) node.setMesh(null);
  for (const m of root.listMeshes()) m.dispose();
  for (const t of root.listTextures()) t.dispose();
  for (const m of root.listMaterials()) m.dispose();
  await doc.transform(prune({ keepLeaves: true }), dedup());
} else if (mode === 'compress') {
  await MeshoptEncoder.ready;
  await doc.transform(resample(), dedup(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
} else {
  console.error('mode: rig-input | model | anim | compress');
  process.exit(1);
}
await io.write(output, doc);
console.log(`${mode}: wrote ${output} — animations: ${root.listAnimations().map((a) => a.getName()).join(', ') || 'none'}`);
