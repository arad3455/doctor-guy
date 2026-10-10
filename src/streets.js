// City streets on a 7-unit grid of Kenney road tiles: give it the cells that are road and it picks the right
// tile for each one (straight, bend, T-junction, crossroads, dead end) from its neighbours.
import * as THREE from 'three';
import { scatter } from './kit.js';

export const TILE = 7; // one road tile = the road's width (same as Zoo Road)
// Grid aligned with Zoo Road (its tiles sit at x = -20.5 + 7k, z = -37)
export const gx = (i) => -20.5 + i * TILE;
export const gz = (j) => -37 + j * TILE;
export const cellOf = (x, z) => [Math.round((x + 20.5) / TILE), Math.round((z + 37) / TILE)];

// Openings of each tile in its default orientation, as [E, S, W, N] (E = +x, S = +z), checked top-down
const BASE = {
  'road-straight': [1, 0, 1, 0],
  'road-bend': [0, 1, 1, 0],
  'road-intersection': [1, 1, 1, 0],
  'road-crossroad': [1, 1, 1, 1],
  'road-end': [1, 0, 0, 0],
};
// three.js yaw +90° turns E→N, N→W, W→S, S→E
const turn = ([e, s, w, n]) => [s, w, n, e];

function pick(open) {
  const want = open.join('');
  for (const [name, base] of Object.entries(BASE)) {
    let o = base;
    for (let k = 0; k < 4; k++) {
      if (o.join('') === want) return { name, rot: (k * Math.PI) / 2 };
      o = turn(o);
    }
  }
  return { name: 'road-square', rot: 0 };
}

/**
 * cells: Set of "i,j" keys. extra: Set of keys that count as road neighbours but are drawn elsewhere (e.g.
 * Zoo Road). Junction tiles get zebra crossings ('-path' variants). Returns { group, tiles: [{x,z,name}] }.
 */
export function buildStreets(cells, { extra = new Set(), crossings = true } = {}) {
  const group = new THREE.Group();
  const byName = {};
  const tiles = [];
  const has = (i, j) => cells.has(`${i},${j}`) || extra.has(`${i},${j}`);
  for (const key of cells) {
    const [i, j] = key.split(',').map(Number);
    const open = [has(i + 1, j), has(i, j + 1), has(i - 1, j), has(i, j - 1)].map(Number);
    let { name, rot } = pick(open);
    const n = open.reduce((a, b) => a + b, 0);
    if (crossings && n >= 3) name += '-path';
    (byName[name] ??= []).push({ x: gx(i), y: 0.006, z: gz(j), rot, sx: TILE, sy: 1, sz: TILE });
    tiles.push({ x: gx(i), z: gz(j), name, open });
  }
  for (const [name, list] of Object.entries(byName)) group.add(scatter(name, list, { cast: false }));
  return { group, tiles };
}

/** Adds the cells of a straight street from (i0,j0) to (i1,j1) (inclusive; horizontal or vertical). */
export function street(cells, i0, j0, i1, j1) {
  const di = Math.sign(i1 - i0), dj = Math.sign(j1 - j0);
  for (let i = i0, j = j0; ; i += di, j += dj) {
    cells.add(`${i},${j}`);
    if (i === i1 && j === j1) break;
  }
  return cells;
}
