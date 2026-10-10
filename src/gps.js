// GTA-style GPS: routes along roads and paths to the waypoint or the drop-off. A coarse grid (3 units) over every
// walkable area marks what's blocked (buildings, trees, fences); A* prefers road cells and avoids wading.
import { clampWalkable, collidersNear, inWater } from './world.js';

const CELL = 3;
const B = { x0: -206, x1: 242, z0: -226, z1: 182 }; // the outdoor world (the hospital interior is far away)
const NX = Math.ceil((B.x1 - B.x0) / CELL), NZ = Math.ceil((B.z1 - B.z0) / CELL);

export class GPS {
  /** roads: [{ x0, z0, x1, z1 }] rectangles that count as road (cheap to travel). */
  constructor(roads = []) {
    this.roads = roads;
    this.cost = null; // Float32Array per cell: 0 = blocked, else the cost of entering it
    this.cache = null;
  }

  build() {
    const cost = new Float32Array(NX * NZ);
    const p = { x: 0, z: 0 };
    for (let iz = 0; iz < NZ; iz++) {
      for (let ix = 0; ix < NX; ix++) {
        const x = B.x0 + (ix + 0.5) * CELL, z = B.z0 + (iz + 0.5) * CELL;
        p.x = x; p.z = z;
        clampWalkable(p);
        if (Math.hypot(p.x - x, p.z - z) > CELL * 0.45) continue; // not walkable
        if (blocked(x, z)) continue;
        const road = this.roads.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
        cost[iz * NX + ix] = road ? 1 : inWater(x, z) ? 6 : 2.2;
      }
    }
    this.cost = cost;
  }

  cellOf(x, z) {
    return [Math.min(NX - 1, Math.max(0, Math.floor((x - B.x0) / CELL))), Math.min(NZ - 1, Math.max(0, Math.floor((z - B.z0) / CELL)))];
  }

  /** The nearest open cell to (x, z) (start/target may stand right next to a wall). */
  open(x, z) {
    const [cx, cz] = this.cellOf(x, z);
    for (let r = 0; r < 6; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const ix = cx + dx, iz = cz + dz;
        if (ix >= 0 && iz >= 0 && ix < NX && iz < NZ && this.cost[iz * NX + ix] > 0) return iz * NX + ix;
      }
    }
    return -1;
  }

  /** A route from `from` to `to` as world points (cached until either end moves to another cell). */
  route(from, to) {
    if (!this.cost) this.build();
    const s = this.open(from.x, from.z), g = this.open(to.x, to.z);
    if (s < 0 || g < 0) return null;
    if (this.cache && this.cache.s === s && this.cache.g === g) return this.cache.path;
    const path = this.astar(s, g);
    this.cache = { s, g, path };
    return path;
  }

  astar(s, g) {
    const N = NX * NZ, gx = g % NX, gz = (g / NX) | 0;
    const best = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = new Heap();
    const h = (i) => { const dx = (i % NX) - gx, dz = ((i / NX) | 0) - gz; return Math.hypot(dx, dz); };
    best[s] = 0;
    heap.push(s, h(s));
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let steps = 0;
    while (heap.size && steps++ < 200000) {
      const i = heap.pop();
      if (i === g) break;
      if (closed[i]) continue; // a stale duplicate in the heap
      closed[i] = 1;
      const ix = i % NX, iz = (i / NX) | 0;
      for (const [dx, dz, d] of DIRS) {
        const jx = ix + dx, jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= NX || jz >= NZ) continue;
        const j = jz * NX + jx, c = this.cost[j];
        if (!c) continue;
        if (dx && dz && (!this.cost[iz * NX + jx] || !this.cost[jz * NX + ix])) continue; // no cutting corners
        const nb = best[i] + d * c;
        if (nb < best[j]) { best[j] = nb; came[j] = i; heap.push(j, nb + h(j)); }
      }
    }
    if (came[g] < 0 && g !== s) return null;
    const cells = [];
    for (let i = g; i >= 0; i = came[i]) { cells.push(i); if (i === s) break; }
    cells.reverse();
    // cell centres → world points, dropping the ones on a straight line
    const pts = cells.map((i) => ({ x: B.x0 + ((i % NX) + 0.5) * CELL, z: B.z0 + (((i / NX) | 0) + 0.5) * CELL }));
    const out = [pts[0]];
    for (let k = 1; k < pts.length - 1; k++) {
      const a = out[out.length - 1], b = pts[k], c = pts[k + 1];
      if (Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) > 0.01) out.push(b);
    }
    if (pts.length > 1) out.push(pts[pts.length - 1]);
    return out;
  }
}

function blocked(x, z) {
  for (const c of collidersNear(x, z, 1.5)) {
    if (c.owner === 'car' || c.dynamic) continue;
    if (c.type === 'circle' ? Math.hypot(c.x - x, c.z - z) < c.r + 0.6 : x > c.minX - 0.6 && x < c.maxX + 0.6 && z > c.minZ - 0.6 && z < c.maxZ + 0.6) return true;
  }
  return false;
}

/** Minimal binary min-heap of (item, priority). */
class Heap {
  constructor() { this.items = []; this.pri = []; }
  get size() { return this.items.length; }
  push(item, p) {
    const a = this.items, q = this.pri;
    a.push(item); q.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (q[parent] <= q[i]) break;
      [a[i], a[parent]] = [a[parent], a[i]]; [q[i], q[parent]] = [q[parent], q[i]];
      i = parent;
    }
  }
  pop() {
    const a = this.items, q = this.pri, top = a[0];
    const lastA = a.pop(), lastQ = q.pop();
    if (a.length) {
      a[0] = lastA; q[0] = lastQ;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && q[l] < q[m]) m = l;
        if (r < a.length && q[r] < q[m]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]]; [q[i], q[m]] = [q[m], q[i]];
        i = m;
      }
    }
    return top;
  }
}
