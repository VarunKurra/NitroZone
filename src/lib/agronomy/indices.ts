/**
 * Vegetation indices.
 *
 * Satellite (Sentinel-2 L2A, surface reflectance):
 *   NDVI = (NIR - Red) / (NIR + Red)            bands B8 (842 nm) and B4 (665 nm), both 10 m
 *   NDRE = (NIR - RedEdge) / (NIR + RedEdge)    bands B8 and B5 (705 nm, 20 m)
 *
 *   NDRE is the primary nitrogen signal: the red-edge band responds to leaf chlorophyll
 *   (which tracks plant N) and keeps separating healthy from stressed canopy after NDVI
 *   has saturated in a dense corn canopy.
 *
 * Drone (plain RGB camera, no NIR band):
 *   ExG  = 2G - R - B                    Excess Green, computed on chromatic coordinates
 *                                        (r = R/(R+G+B), etc.) so lighting changes cancel out
 *   VARI = (G - R) / (G + R - B)         Visible Atmospherically Resistant Index
 *
 * These are STRESS PROXIES. Low values mean "less green / less vigorous", which is often
 * nitrogen deficiency but can also be water stress, disease, compaction or poor stand.
 * That is why the app asks the farmer to review the zones before exporting.
 */

/** Normalized difference of two bands; NaN when undefined (both zero / no data). */
export function normalizedDifference(a: number, b: number): number {
  const sum = a + b;
  if (!Number.isFinite(sum) || sum <= 0) return Number.NaN;
  return (a - b) / sum;
}

export const ndvi = (nir: number, red: number) => normalizedDifference(nir, red);
export const ndre = (nir: number, redEdge: number) => normalizedDifference(nir, redEdge);

/** Excess Green on chromatic coordinates. Range roughly -1 to 2; vegetation is > 0. */
export function exg(r: number, g: number, b: number): number {
  const sum = r + g + b;
  if (sum <= 0) return Number.NaN;
  return (2 * g - r - b) / sum;
}

/** VARI. Undefined when the denominator is ~0; clamped to [-1, 1] because it can blow up. */
export function vari(r: number, g: number, b: number): number {
  const d = g + r - b;
  if (Math.abs(d) < 1e-6) return Number.NaN;
  const v = (g - r) / d;
  return Math.max(-1, Math.min(1, v));
}

/**
 * Sentinel-2 L2A digital numbers -> surface reflectance (0-1).
 *
 * Since processing baseline 04.00 (January 2022), ESA adds a +1000 offset to L2A digital
 * numbers so that negative reflectances can be stored. Reflectance = (DN - 1000) / 10000.
 * Older products have no offset. Forgetting this skews NDVI/NDRE badly, so we check the
 * scene's processing baseline.
 */
export function s2Reflectance(dn: number, processingBaseline: string | null): number {
  if (dn === 0) return Number.NaN; // 0 = no data in L2A
  const offset = baselineHasOffset(processingBaseline) ? 1000 : 0;
  return (dn - offset) / 10000;
}

export function baselineHasOffset(processingBaseline: string | null): boolean {
  if (!processingBaseline) return true; // everything served today is >= 04.00
  const major = Number.parseFloat(processingBaseline);
  return Number.isFinite(major) ? major >= 4 : true;
}

/**
 * Sentinel-2 Scene Classification (SCL) codes we treat as unusable:
 *   0 no data, 1 saturated/defective, 3 cloud shadow, 8 cloud (medium prob.),
 *   9 cloud (high prob.), 10 thin cirrus, 11 snow/ice.
 * Codes 4 (vegetation), 5 (bare soil), 6 (water), 7 (unclassified) and 2 (dark area)
 * are kept: bare soil inside a corn field is real information (poor stand, washout).
 */
export const SCL_MASKED = new Set([0, 1, 3, 8, 9, 10, 11]);

export function sclIsValid(code: number): boolean {
  return !SCL_MASKED.has(code);
}

/** Simple statistics helpers used everywhere (NaN-safe). */
export function finiteValues(values: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

export function mean(values: ArrayLike<number>): number {
  let s = 0;
  let n = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (Number.isFinite(v)) {
      s += v;
      n++;
    }
  }
  return n ? s / n : Number.NaN;
}

export function stdDev(values: ArrayLike<number>): number {
  const m = mean(values);
  if (!Number.isFinite(m)) return Number.NaN;
  let s = 0;
  let n = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (Number.isFinite(v)) {
      s += (v - m) ** 2;
      n++;
    }
  }
  return n > 1 ? Math.sqrt(s / (n - 1)) : 0;
}

/** Linear-interpolated percentile (p in 0-100) of the finite values. */
export function percentile(values: ArrayLike<number>, p: number): number {
  const v = finiteValues(values).sort((a, b) => a - b);
  if (!v.length) return Number.NaN;
  const idx = (p / 100) * (v.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return v[lo] + (v[hi] - v[lo]) * (idx - lo);
}
