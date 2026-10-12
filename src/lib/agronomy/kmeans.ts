/**
 * k-means clustering (Lloyd's algorithm with k-means++ seeding).
 *
 * Used for zone delineation: each prescription cell is a point described by its
 * (standardized) NDRE and NDVI. k-means groups cells with similar crop vigor; we then
 * rank the groups by NDRE so "zone 1" is always the least vigorous.
 *
 * A seeded random generator makes the result deterministic: the same field and the same
 * settings always produce the same zones (important for trust and for tests).
 */

/** Mulberry32: tiny, fast, deterministic PRNG. Returns floats in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface KMeansResult {
  /** Cluster index per point. */
  labels: Int32Array;
  /** Cluster centres, one array of length `dims` per cluster. */
  centroids: number[][];
  iterations: number;
  /** Sum of squared distances to assigned centroids (lower = tighter clusters). */
  inertia: number;
}

function sqDist(a: number[], b: number[]): number {
  let s = 0;
  for (let d = 0; d < a.length; d++) s += (a[d] - b[d]) ** 2;
  return s;
}

/**
 * @param points  array of feature vectors (all the same length)
 * @param k       number of clusters
 * @param weights optional per-point weights (e.g. cell area) so partial edge cells count less
 */
export function kmeans(
  points: number[][],
  k: number,
  { seed = 42, maxIter = 100, weights }: { seed?: number; maxIter?: number; weights?: number[] } = {},
): KMeansResult {
  const n = points.length;
  if (n === 0) return { labels: new Int32Array(0), centroids: [], iterations: 0, inertia: 0 };
  const kk = Math.min(k, n);
  const dims = points[0].length;
  const rand = seededRandom(seed);
  const w = weights ?? new Array(n).fill(1);

  // --- k-means++ seeding: spread the initial centres out, proportional to D(x)^2 ---
  const centroids: number[][] = [points[Math.floor(rand() * n)].slice()];
  const d2 = new Float64Array(n);
  while (centroids.length < kk) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      let best = Infinity;
      for (const c of centroids) best = Math.min(best, sqDist(points[i], c));
      d2[i] = best * w[i];
      total += d2[i];
    }
    if (total === 0) {
      // all remaining points coincide with a centre; duplicate to keep k clusters
      centroids.push(points[Math.floor(rand() * n)].slice());
      continue;
    }
    let r = rand() * total;
    let pick = n - 1;
    for (let i = 0; i < n; i++) {
      r -= d2[i];
      if (r <= 0) {
        pick = i;
        break;
      }
    }
    centroids.push(points[pick].slice());
  }

  // --- Lloyd iterations: assign to nearest centre, move centres to weighted mean ---
  const labels = new Int32Array(n);
  let iterations = 0;
  for (; iterations < maxIter; iterations++) {
    let changed = 0;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < kk; c++) {
        const dd = sqDist(points[i], centroids[c]);
        if (dd < bestD) {
          bestD = dd;
          best = c;
        }
      }
      if (labels[i] !== best || iterations === 0) {
        if (labels[i] !== best) changed++;
        labels[i] = best;
      }
    }
    const sums = Array.from({ length: kk }, () => new Array(dims).fill(0));
    const wsum = new Array(kk).fill(0);
    for (let i = 0; i < n; i++) {
      const c = labels[i];
      wsum[c] += w[i];
      for (let d = 0; d < dims; d++) sums[c][d] += points[i][d] * w[i];
    }
    for (let c = 0; c < kk; c++) {
      if (wsum[c] > 0) centroids[c] = sums[c].map((s) => s / wsum[c]);
    }
    if (changed === 0 && iterations > 0) break;
  }

  let inertia = 0;
  for (let i = 0; i < n; i++) inertia += sqDist(points[i], centroids[labels[i]]) * w[i];
  return { labels, centroids, iterations, inertia };
}
