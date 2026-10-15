// City streets on a 7-unit grid: every district registers the cells that are road here, and roads.js draws the
// whole network at once (asphalt 2·HW wide, kerbs, markings, crossings) once they all have.
import * as THREE from 'three';

export const TILE = 7; // the street grid's spacing
/** Half the width of the asphalt (wider than a grid cell: roads spill 0.5 into the pavement on each side). */
export const HW = 4.0;
/** Junction cells that get no zebra crossings. */
export const NO_ZEBRA = new Set();
// Grid aligned with Zoo Road (its tiles sit at x = -20.5 + 7k, z = -37)
export const gx = (i) => -20.5 + i * TILE;
export const gz = (j) => -37 + j * TILE;
export const cellOf = (x, z) => [Math.round((x + 20.5) / TILE), Math.round((z + 37) / TILE)];
/** Every road tile in the city ("i,j"), for the ambulance's top speed. Zoo Road (row 0) is pre-registered. */
export const ROAD_CELLS = new Set();
for (let i = 0; i <= 22; i++) ROAD_CELLS.add(`${i},0`);
/** Other fast tarmac (the runway, the taxiway): [{ x0, x1, z0, z1 }]. */
export const FAST_RECTS = [];
/** On a road tile (within the asphalt) or other fast tarmac? */
export function onRoad(x, z) {
  const [i, j] = cellOf(x, z);
  if (ROAD_CELLS.has(`${i},${j}`) && Math.abs(x - gx(i)) < HW - 0.1 && Math.abs(z - gz(j)) < HW - 0.1) return true;
  // (the half-cell of wider asphalt beside a road cell)
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (ROAD_CELLS.has(`${i + di},${j + dj}`) && Math.abs(x - gx(i + di)) < HW - 0.1 && Math.abs(z - gz(j + dj)) < HW - 0.1) return true;
  return FAST_RECTS.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
}

/**
 * Registers a district's road cells (drawn later, all together, by roads.js). Returns { group, tiles } — the group
 * stays empty (kept so districts can add it as before); tiles [{x,z,name,open}] feed the maps and the GPS.
 * extra: cells drawn by another district that count as neighbours here. crossings: false = no zebras at its junctions.
 */
export function buildStreets(cells, { extra = new Set(), crossings = true } = {}) {
  const group = new THREE.Group();
  const tiles = [];
  const has = (i, j) => cells.has(`${i},${j}`) || extra.has(`${i},${j}`) || ROAD_CELLS.has(`${i},${j}`);
  for (const key of cells) ROAD_CELLS.add(key);
  for (const key of cells) {
    const [i, j] = key.split(',').map(Number);
    const open = [has(i + 1, j), has(i, j + 1), has(i - 1, j), has(i, j - 1)].map(Number);
    if (!crossings) NO_ZEBRA.add(key);
    tiles.push({ x: gx(i), z: gz(j), name: 'road', open });
  }
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

/**
 * Moves a point (in place) out of the asphalt of any road cell near it, `clear` beyond the kerb — for lamp posts,
 * traffic lights and signs placed against the old, narrower streets. Pushes across the road, not along it.
 */
export function offRoad(p, clear = 0.55) {
  const lim = HW + clear;
  for (let iter = 0; iter < 3; iter++) {
    const [i, j] = cellOf(p.x, p.z);
    let moved = false;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!ROAD_CELLS.has(`${i + di},${j + dj}`)) continue;
      const dx = p.x - gx(i + di), dz = p.z - gz(j + dj);
      if (Math.abs(dx) >= lim || Math.abs(dz) >= lim) continue;
      if (lim - Math.abs(dx) < lim - Math.abs(dz)) p.x = gx(i + di) + Math.sign(dx || 1) * lim;
      else p.z = gz(j + dj) + Math.sign(dz || 1) * lim;
      moved = true;
    }
    if (!moved) break;
  }
  return p;
}

/**
 * Lane keeping: on a straight stretch, where's the centre of the lane you're driving in (traffic keeps right)?
 * Returns { lateral, align } — how far the lane centre is to your right, and how far the road's direction is to your
 * right (sin of the angle) — or null at junctions, off the road, or when you're not roughly along the road.
 */
export function laneAssist(x, z, heading) {
  const [i, j] = cellOf(x, z);
  if (!ROAD_CELLS.has(`${i},${j}`)) return null;
  const e = ROAD_CELLS.has(`${i + 1},${j}`), w = ROAD_CELLS.has(`${i - 1},${j}`), s = ROAD_CELLS.has(`${i},${j + 1}`), n = ROAD_CELLS.has(`${i},${j - 1}`);
  const alongX = e && w && !s && !n, alongZ = s && n && !e && !w;
  if (!alongX && !alongZ) return null;
  const fx = Math.sin(heading), fz = Math.cos(heading); // forward
  const rx = -fz, rz = fx; // right
  const tx = alongX ? Math.sign(fx) || 1 : 0, tz = alongZ ? Math.sign(fz) || 1 : 0; // the road's direction, your way
  if (fx * tx + fz * tz < 0.85) return null; // turning, or across the road
  // the lane centre: half a lane to the right of the centre line
  const cx = alongZ ? gx(i) + (tz > 0 ? -1 : 1) * HW / 2 : x, cz = alongX ? gz(j) + (tx > 0 ? 1 : -1) * HW / 2 : z;
  return { lateral: (cx - x) * rx + (cz - z) * rz, align: tx * rx + tz * rz };
}
