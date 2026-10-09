// Shrinks a Meshy export for the browser: keeps only the base-colour texture (toon shading ignores
// normal/metallic maps), resizes it to 2048px WebP, and prunes unused data.
//   node tools/optimize-glb.mjs <in.glb> <out.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';

const [, , input, output] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
for (const mat of doc.getRoot().listMaterials()) {
  mat.setNormalTexture(null);
  mat.setMetallicRoughnessTexture(null);
  mat.setOcclusionTexture(null);
  mat.setEmissiveTexture(null);
}
await doc.transform(
  prune(),
  dedup(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 85 }),
);
await io.write(output, doc);
const anims = doc.getRoot().listAnimations().map((a) => a.getName());
console.log(`wrote ${output} — animations: ${anims.join(', ')}`);
