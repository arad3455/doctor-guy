// GLB helpers for the Meshy pipeline.
//   node tools/glb-tools.mjs rig-input <in.glb> <out.glb>   → static textured mesh (no skin/anims), JPEG base colour
//   node tools/glb-tools.mjs model <in.glb> <out.glb>       → web model: base colour only (WebP 2048), pruned
//   node tools/glb-tools.mjs anim <in.glb> <out.glb>        → animation-only file: skeleton + clips, no mesh/textures
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';

const [, , mode, input, output] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
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
  await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 85 }));
} else if (mode === 'anim') {
  for (const node of root.listNodes()) node.setMesh(null);
  for (const m of root.listMeshes()) m.dispose();
  for (const t of root.listTextures()) t.dispose();
  for (const m of root.listMaterials()) m.dispose();
  await doc.transform(prune({ keepLeaves: true }), dedup());
} else {
  console.error('mode: rig-input | model | anim');
  process.exit(1);
}
await io.write(output, doc);
console.log(`${mode}: wrote ${output} — animations: ${root.listAnimations().map((a) => a.getName()).join(', ') || 'none'}`);
