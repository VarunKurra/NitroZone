/**
 * Management-zone delineation.
 *
 *   cells --(k-means on standardized NDRE + NDVI)--> clusters
 *         --(rank clusters by mean NDRE)-----------> zone 1 (least vigor) ... zone k (most vigor)
 *         --(3x3 majority filter)-------------------> removes salt-and-pepper speckle
 *         --(merge fragments < min area)------------> zones a spreader can actually follow
 *
 * Why merge? A controller changes rate over a few seconds of travel; a 0.1-acre island
 * of a different rate can't be applied accurately and just adds noise to the map.
 */
import { kmeans } from "./kmeans";
import { mean, stdDev } from "./indices";
import type { GridCell, ZoningResult } from "./types";

/** Primary index carries most of the weight: it is the nitrogen-sensitive one. */
const PRIMARY_WEIGHT = 1;
const SECONDARY_WEIGHT = 0.35;

export interface ZoningInput {
  cells: GridCell[];
  cols: number;
  rows: number;
  lookup: Int32Array;
  zoneCount: number;
  minZoneAc: number;
  smooth: boolean;
  seed?: number;
}

export function delineateZones({ cells, cols, rows, lookup, zoneCount, minZoneAc, smooth, seed = 7 }: ZoningInput): ZoningResult {
  const n = cells.length;
  const zoneOfCell = new Int8Array(n);
  if (n === 0) return { zoneOfCell, zoneCount, centers: [], mergedFragments: 0, breaks: [] };

  // --- 1. Standardize features so NDRE and NDVI are on comparable scales ---
  const p = cells.map((c) => c.primary);
  const s = cells.map((c) => c.secondary);
  const pm = mean(p);
  const ps = stdDev(p) || 1;
  const sm = mean(s);
  const ss = stdDev(s) || 1;
  const points = cells.map((c) => [
    ((c.primary - pm) / ps) * PRIMARY_WEIGHT,
    (((Number.isFinite(c.secondary) ? c.secondary : sm) - sm) / ss) * SECONDARY_WEIGHT,
  ]);
  const weights = cells.map((c) => Math.max(0.05, c.areaAc));

  // --- 2. Cluster ---
  const k = Math.min(zoneCount, n);
  const { labels } = kmeans(points, k, { seed, weights });

  // --- 3. Rank clusters by mean primary index: lowest vigor becomes zone 1 ---
  const clusterMeans = Array.from({ length: k }, (_, c) => {
    const vals = cells.filter((_, i) => labels[i] === c).map((cell) => cell.primary);
    return { c, m: vals.length ? mean(vals) : Number.POSITIVE_INFINITY };
  }).sort((a, b) => a.m - b.m);
  const rankOf = new Map(clusterMeans.map((cm, rank) => [cm.c, rank + 1]));
  for (let i = 0; i < n; i++) zoneOfCell[i] = rankOf.get(labels[i]) ?? 1;

  // --- 4. Majority filter (one pass, 8-neighbourhood, needs a clear majority to flip) ---
  if (smooth) majorityFilter(zoneOfCell, cells, cols, rows, lookup);

  // --- 5. Merge small fragments into the neighbour they share the longest border with ---
  const mergedFragments = mergeSmallFragments(zoneOfCell, cells, cols, rows, lookup, minZoneAc);

  // Zone centres and break values (midpoints between adjacent zone means) for charts.
  const centers: number[] = [];
  for (let z = 1; z <= k; z++) {
    const vals = cells.filter((_, i) => zoneOfCell[i] === z).map((c) => c.primary);
    centers.push(vals.length ? mean(vals) : Number.NaN);
  }
  const breaks: number[] = [];
  for (let z = 0; z < k - 1; z++) {
    if (Number.isFinite(centers[z]) && Number.isFinite(centers[z + 1])) breaks.push((centers[z] + centers[z + 1]) / 2);
  }
  return { zoneOfCell, zoneCount: k, centers, mergedFragments, breaks };
}

function neighbours8(cell: GridCell, cols: number, rows: number, lookup: Int32Array): number[] {
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = cell.row + dr;
      const c = cell.col + dc;
      if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
      const idx = lookup[r * cols + c];
      if (idx >= 0) out.push(idx);
    }
  return out;
}

function neighbours4(cell: GridCell, cols: number, rows: number, lookup: Int32Array): number[] {
  const out: number[] = [];
  for (const [dr, dc] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    const r = cell.row + dr;
    const c = cell.col + dc;
    if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
    const idx = lookup[r * cols + c];
    if (idx >= 0) out.push(idx);
  }
  return out;
}

export function majorityFilter(zones: Int8Array, cells: GridCell[], cols: number, rows: number, lookup: Int32Array) {
  const next = zones.slice();
  cells.forEach((cell, i) => {
    const nb = neighbours8(cell, cols, rows, lookup);
    if (nb.length < 3) return;
    const counts = new Map<number, number>();
    for (const j of nb) counts.set(zones[j], (counts.get(zones[j]) ?? 0) + 1);
    let bestZ = zones[i];
    let bestC = counts.get(zones[i]) ?? 0;
    for (const [z, c] of counts) if (c > bestC) [bestZ, bestC] = [z, c];
    // Only flip when more than half of the neighbours agree.
    if (bestZ !== zones[i] && bestC > nb.length / 2) next[i] = bestZ;
  });
  zones.set(next);
}

/** Connected components (4-connectivity) of cells sharing a zone. */
export function zoneComponents(zones: Int8Array, cells: GridCell[], cols: number, rows: number, lookup: Int32Array) {
  const comp = new Int32Array(cells.length).fill(-1);
  const comps: { zone: number; members: number[]; areaAc: number }[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (comp[i] >= 0) continue;
    const id = comps.length;
    const members: number[] = [];
    let areaAc = 0;
    const stack = [i];
    comp[i] = id;
    while (stack.length) {
      const j = stack.pop()!;
      members.push(j);
      areaAc += cells[j].areaAc;
      for (const nb of neighbours4(cells[j], cols, rows, lookup)) {
        if (comp[nb] < 0 && zones[nb] === zones[i]) {
          comp[nb] = id;
          stack.push(nb);
        }
      }
    }
    comps.push({ zone: zones[i], members, areaAc });
  }
  return { comp, comps };
}

export function mergeSmallFragments(
  zones: Int8Array,
  cells: GridCell[],
  cols: number,
  rows: number,
  lookup: Int32Array,
  minZoneAc: number,
): number {
  if (minZoneAc <= 0) return 0;
  let merged = 0;
  // Repeat until stable: merging can create new adjacency. Smallest fragments go first.
  for (let pass = 0; pass < 25; pass++) {
    const { comps } = zoneComponents(zones, cells, cols, rows, lookup);
    const small = comps.filter((c) => c.areaAc < minZoneAc).sort((a, b) => a.areaAc - b.areaAc);
    if (!small.length || small.length === comps.length) break;
    let changedThisPass = false;
    for (const frag of small) {
      // Fragment may already have been changed this pass.
      if (frag.members.some((m) => zones[m] !== frag.zone)) continue;
      const border = new Map<number, number>();
      const memberSet = new Set(frag.members);
      for (const m of frag.members)
        for (const nb of neighbours4(cells[m], cols, rows, lookup))
          if (!memberSet.has(nb) && zones[nb] !== frag.zone) border.set(zones[nb], (border.get(zones[nb]) ?? 0) + 1);
      if (!border.size) continue;
      // Longest shared border wins; ties go to the zone with the closest rank (smaller jump in rate).
      const target = [...border.entries()].sort((a, b) => b[1] - a[1] || Math.abs(a[0] - frag.zone) - Math.abs(b[0] - frag.zone))[0][0];
      for (const m of frag.members) zones[m] = target;
      merged++;
      changedThisPass = true;
    }
    if (!changedThisPass) break;
  }
  return merged;
}

/** Apply farmer edits (cell id -> zone) on top of the computed zones. */
export function applyOverrides(base: Int8Array, overrides: Record<number, number>): Int8Array {
  const out = base.slice();
  for (const [id, z] of Object.entries(overrides)) {
    const i = Number(id);
    if (i >= 0 && i < out.length) out[i] = z;
  }
  return out;
}
