// GLB helpers for the Meshy pipeline.
//   node tools/glb-tools.mjs rig-input <in.glb> <out.glb>   → static textured mesh (no skin/anims), JPEG base colour
//   node tools/glb-tools.mjs model <in.glb> <out.glb> [px]  → web model: base colour only (WebP, default 2048px), pruned
//   node tools/glb-tools.mjs anim <in.glb> <out.glb>        → animation-only file: skeleton + clips, no mesh/textures
//   node tools/glb-tools.mjs compress <in.glb> <out.glb>    → meshopt-compress geometry + animation (smaller download)
//   node tools/glb-tools.mjs lod <in.glb> <out.glb>         → simplified far-away copy (~20% triangles)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, meshopt, resample, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptDecoder } from 'meshoptimizer';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const [, , mode, input, output, sizeArg] = process.argv;
const SIZE = Number(sizeArg) || 2048; // max texture size for 'model' mode
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
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
} else if (mode === 'lod') {
  // far-away copy: ~20% of the triangles, small texture
  await MeshoptSimplifier.ready;
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.2, error: 0.02 }), prune(), dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
} else if (mode === 'shrink') {
  // re-encode textures at a smaller size (default 1024px), keeping meshopt compression
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [SIZE === 2048 && !sizeArg ? 1024 : SIZE, SIZE === 2048 && !sizeArg ? 1024 : SIZE], quality: 82 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
} else if (mode === 'compress') {
  await MeshoptEncoder.ready;
  await doc.transform(resample(), dedup(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
} else {
  console.error('mode: rig-input | model | anim | compress');
  process.exit(1);
}
await io.write(output, doc);
console.log(`${mode}: wrote ${output} — animations: ${root.listAnimations().map((a) => a.getName()).join(', ') || 'none'}`);
