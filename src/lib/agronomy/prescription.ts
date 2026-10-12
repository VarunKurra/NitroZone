/**
 * Derive the full prescription (zones after edits, rates, summaries, totals, health,
 * confidence) from an analysis + the farmer's settings. Pure and fast (~1 ms), so it
 * re-runs on every slider move and every zone edit. Every screen and every export reads
 * from its output, so the numbers can never disagree.
 */
import { applyOverrides } from "./zones";
import { cellRates, referenceValue, summarizeZones, totalsOf } from "./rates";
import { dataConfidence, healthScore, type Confidence, type HealthScore } from "./health";
import type { GridCell, PrescriptionTotals, RateSettings, SceneInfo, ZoneSummary } from "./types";

export interface DerivedPrescription {
  zones: Int8Array;
  rates: Float32Array;
  reference: { value: number; kind: "strip" | "virtual" };
  summaries: ZoneSummary[];
  totals: PrescriptionTotals;
  health: HealthScore;
  confidence: Confidence;
}

export function derivePrescription(input: {
  cells: Omit<GridCell, "rings">[];
  baseZones: Int8Array;
  zoneCount: number;
  overrides: Record<number, number>;
  settings: RateSettings;
  scene: SceneInfo;
  clearFraction: number;
}): DerivedPrescription {
  const cells = input.cells as GridCell[];
  const zones = applyOverrides(input.baseZones, input.overrides);
  const rates = cellRates(zones, input.settings);
  const reference = referenceValue(cells);
  const summaries = summarizeZones(cells, zones, input.zoneCount, input.settings, reference.value);
  const totals = totalsOf(summaries, input.settings);
  const health = healthScore(cells, reference.value);
  let secArea = 0;
  let secSum = 0;
  let filled = 0;
  for (const c of cells) {
    if (Number.isFinite(c.secondary)) {
      secSum += c.secondary * c.areaAc;
      secArea += c.areaAc;
    }
    if (c.filled) filled++;
  }
  const confidence = dataConfidence({
    scene: input.scene,
    clearFraction: input.clearFraction,
    meanSecondary: secArea ? secSum / secArea : 0,
    filledShare: cells.length ? filled / cells.length : 0,
  });
  return { zones, rates, reference, summaries, totals, health, confidence };
}
