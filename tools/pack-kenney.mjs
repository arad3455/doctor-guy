// Packs selected Kenney (CC0, kenney.nl) models into one compressed GLB per kit: assets/kenney/<kit>.glb.
// Each model becomes a named top-level node, so the game loads one file and clones models by name.
//   node tools/pack-kenney.mjs        (expects the unzipped packs in vendor-src/, see README)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, meshopt, flatten, join as joinPrims } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'vendor-src');
export const KITS = {
  nature: {
    dir: 'kenney_nature-kit/Models/GLTF format',
    models: [
      'tree_oak', 'tree_default', 'tree_detailed', 'tree_fat', 'tree_plateau', 'tree_plateau_dark', 'tree_tall', 'tree_palmTall', 'tree_palmDetailedTall', 'tree_palmBend', 'tree_cone',
      'plant_bush', 'plant_bushDetailed', 'plant_bushLarge', 'plant_bushSmall', 'plant_flatTall',
      'flower_redA', 'flower_purpleA', 'flower_yellowA', 'flower_redB', 'flower_yellowB', 'grass', 'grass_large', 'grass_leafsLarge',
      'rock_largeA', 'rock_largeC', 'rock_largeE', 'rock_tallA', 'rock_tallE', 'rock_smallA', 'rock_smallFlatA', 'stone_largeB', 'stone_tallB', 'stone_smallFlatA',
      'log', 'log_large', 'log_stack', 'stump_round', 'mushroom_redGroup', 'hanging_moss', 'lily_large', 'lily_small',
      'fence_simple', 'fence_planks', 'fence_gate', 'bridge_woodNarrow', 'sign', 'tent_detailedOpen', 'pot_large', 'canoe', 'campfire_logs', 'statue_obelisk',
    ],
  },
  roads: {
    dir: 'kenney_city-kit-roads/Models/GLB format',
    models: ['road-straight', 'road-crossing', 'road-end-round', 'light-curved', 'light-square-double', 'traffic-light', 'sign-highway', 'sign-highway-detailed', 'construction-cone', 'construction-barrier', 'electricity-pole', 'road-sign-street', 'dumpster'],
  },
  cars: {
    dir: 'kenney_car-kit/Models/GLB format',
    models: ['sedan', 'taxi', 'police', 'suv', 'van', 'hatchback-sports', 'delivery', 'truck', 'firetruck', 'garbage-truck', 'cone'],
  },
  town: {
    dir: 'kenney_fantasy-town-kit_2.0/Models/GLB format',
    models: ['stall', 'stall-red', 'stall-green', 'stall-bench', 'stall-stool', 'cart', 'lantern', 'banner-red', 'banner-green', 'fountain-round-detail', 'hedge', 'hedge-large', 'hedge-curved', 'fence', 'fence-curved', 'pillar-stone', 'rock-large', 'poles'],
  },
};

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
mkdirSync(join(ROOT, 'assets/kenney'), { recursive: true });
const only = process.argv[2];
for (const [kit, { dir, models }] of Object.entries(KITS)) {
  if (only && only !== kit) continue;
  const target = await io.read(join(SRC, dir, `${models[0]}.glb`));
  const scene = target.getRoot().getDefaultScene() ?? target.getRoot().listScenes()[0];
  const wrap = (sc, name) => {
    const holder = target.createNode(name);
    for (const child of sc.listChildren()) { sc.removeChild(child); holder.addChild(child); }
    return holder;
  };
  const first = wrap(scene, models[0]);
  scene.addChild(first);
  for (const name of models.slice(1)) {
    const src = await io.read(join(SRC, dir, `${name}.glb`));
    const before = new Set(target.getRoot().listScenes());
    mergeDocuments(target, src);
    for (const sc of target.getRoot().listScenes()) {
      if (before.has(sc)) continue;
      scene.addChild(wrap(sc, name));
      sc.dispose();
    }
  }
  for (const b of target.getRoot().listBuffers().slice(1)) { // single buffer for GLB
    for (const a of target.getRoot().listAccessors()) if (a.getBuffer() === b) a.setBuffer(target.getRoot().listBuffers()[0]);
    b.dispose();
  }
  await target.transform(dedup(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = join(ROOT, 'assets/kenney', `${kit}.glb`);
  await io.write(out, target);
  console.log(`${kit}: ${models.length} models → assets/kenney/${kit}.glb (${(statSync(out).size / 1024).toFixed(0)} KB)`);
}
writeFileSync(join(ROOT, 'assets/kenney/LICENSE.txt'), 'Models by Kenney (www.kenney.nl) — Creative Commons Zero (CC0 1.0), https://creativecommons.org/publicdomain/zero/1.0/\nPacks: Nature Kit, City Kit (Roads), Car Kit, Fantasy Town Kit.\n');
