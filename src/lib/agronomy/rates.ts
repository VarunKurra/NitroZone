/**
 * Nitrogen rate math. Every number the farmer sees comes from these functions,
 * so the map, charts, summary, exports and PDF always agree.
 *
 *   zone rate (lb N/ac)   = base rate x (1 + zone adjustment)       (then clamped to min/max)
 *   zone total (lb N)     = zone rate x zone acres
 *   flat total (lb N)     = base rate x field acres
 *   variable total (lb N) = sum of zone totals
 *   savings ($)           = (flat total - variable total) x N price ($/lb N)
 *
 * Savings are an ESTIMATE of fertilizer cost only. They do not include yield effects,
 * application costs, or the cost of the imagery/equipment.
 */
import type { GridCell, PrescriptionTotals, RateSettings, ZoneSummary } from "./types";

/**
 * Default per-zone adjustments (zone 1 = least vigorous = more N).
 * They are a starting point only, chosen to be modest (within +/-20%) and are fully editable.
 */
export const DEFAULT_ADJUSTMENTS: Record<3 | 4 | 5, number[]> = {
  3: [0.15, 0, -0.15],
  4: [0.15, 0.05, -0.1, -0.2],
  5: [0.2, 0.1, 0, -0.1, -0.2],
};

export const DEFAULT_RATE_SETTINGS: RateSettings = {
  baseRate: 120,
  // DTN retail survey, last week of Sept 2026: UAN32 averaged $0.75 per lb of N (see SOURCES.md).
  pricePerLbN: 0.75,
  adjustments: DEFAULT_ADJUSTMENTS[4],
  minRate: 0,
  maxRate: 250,
};

/** Sufficiency index threshold: below ~95% of a well-fertilized reference suggests N deficiency. */
export const SI_SUFFICIENT = 0.95;

export function zoneRate(settings: RateSettings, zone: number): number {
  const adj = settings.adjustments[zone - 1] ?? 0;
  const raw = settings.baseRate * (1 + adj);
  return clamp(raw, settings.minRate, settings.maxRate);
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Reference value for the sufficiency index.
 * - If the farmer drew an N-rich strip: mean primary index of cells in the strip.
 * - Otherwise a "virtual reference": the 95th percentile of the field, i.e. the best-performing
 *   5% of the field stands in for "corn that is not short of nitrogen".
 */
export function referenceValue(cells: GridCell[]): { value: number; kind: "strip" | "virtual" } {
  const strip = cells.filter((c) => c.inReference && Number.isFinite(c.primary));
  if (strip.length >= 2) {
    const area = strip.reduce((s, c) => s + c.areaAc, 0);
    return { value: strip.reduce((s, c) => s + c.primary * c.areaAc, 0) / area, kind: "strip" };
  }
  const vals = cells.map((c) => c.primary).filter(Number.isFinite).sort((a, b) => a - b);
  if (!vals.length) return { value: Number.NaN, kind: "virtual" };
  const idx = 0.95 * (vals.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return { value: vals[lo] + (vals[hi] - vals[lo]) * (idx - lo), kind: "virtual" };
}

/** Per-zone summaries. `zones[i]` is the zone of `cells[i]`. */
export function summarizeZones(
  cells: GridCell[],
  zones: ArrayLike<number>,
  zoneCount: number,
  settings: RateSettings,
  reference: number,
): ZoneSummary[] {
  const out: ZoneSummary[] = [];
  for (let z = 1; z <= zoneCount; z++) {
    let area = 0;
    let p = 0;
    let s = 0;
    let count = 0;
    for (let i = 0; i < cells.length; i++) {
      if (zones[i] !== z) continue;
      const c = cells[i];
      area += c.areaAc;
      p += c.primary * c.areaAc;
      s += (Number.isFinite(c.secondary) ? c.secondary : 0) * c.areaAc;
      count++;
    }
    const rate = zoneRate(settings, z);
    const total = rate * area;
    const flat = settings.baseRate * area;
    const primary = area ? p / area : Number.NaN;
    out.push({
      zone: z,
      cellCount: count,
      areaAc: area,
      primary,
      secondary: area ? s / area : Number.NaN,
      sufficiency: reference > 0 ? primary / reference : Number.NaN,
      adjustment: settings.adjustments[z - 1] ?? 0,
      rateLbAc: rate,
      totalLbN: total,
      flatLbN: flat,
      savedLbN: flat - total,
      savedUsd: (flat - total) * settings.pricePerLbN,
    });
  }
  return out;
}

export function totalsOf(summaries: ZoneSummary[], settings: RateSettings): PrescriptionTotals {
  const areaAc = summaries.reduce((s, z) => s + z.areaAc, 0);
  const variableLbN = summaries.reduce((s, z) => s + z.totalLbN, 0);
  const flatLbN = settings.baseRate * areaAc;
  const savedLbN = flatLbN - variableLbN;
  const savedUsd = savedLbN * settings.pricePerLbN;
  return {
    areaAc,
    flatLbN,
    variableLbN,
    savedLbN,
    savedUsd,
    savedUsdPerAc: areaAc ? savedUsd / areaAc : 0,
    avgRateLbAc: areaAc ? variableLbN / areaAc : 0,
    // tiny tolerance so floating point noise never triggers the warning
    usesMoreThanFlat: variableLbN > flatLbN + 1e-6,
  };
}

/**
 * Sufficiency-index guided adjustment (used when the farmer asks NitroZone to suggest
 * adjustments). Transparent, editable heuristic, NOT a published calibration:
 *
 *   adjustment = gain x (0.95 - SI), clamped to +/-40%
 *
 * Zones below 95% of the reference get proportionally more N; zones at or above the
 * reference get a modest reduction. With the default gain of 3, SI 0.85 -> +30%, SI 1.00 -> -15%.
 */
export function suggestAdjustmentsFromSI(summaries: ZoneSummary[], gain = 3): number[] {
  return summaries.map((z) =>
    Number.isFinite(z.sufficiency) ? round2(clamp(gain * (SI_SUFFICIENT - z.sufficiency), -0.4, 0.4)) : 0,
  );
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

/** Per-cell rate for map colouring and exports. */
export function cellRates(zones: ArrayLike<number>, settings: RateSettings): Float32Array {
  const out = new Float32Array(zones.length);
  for (let i = 0; i < zones.length; i++) out[i] = zoneRate(settings, zones[i]);
  return out;
}
