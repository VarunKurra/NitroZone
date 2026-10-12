/**
 * One colour rule per map layer, shared by both maps so they always match:
 *   zones       -> zone palette
 *   rate        -> amber ramp (more fertilizer = darker)
 *   primary     -> crop health ramp (healthier = deeper green-blue), drawn as crisp squares
 */
import { INDEX_RAMP, RATE_RAMP, rampColor, zoneColor } from "@/lib/palette";
import { percentile } from "@/lib/agronomy/indices";
import type { DerivedPrescription } from "@/lib/agronomy/prescription";
import type { AnalysisPayload } from "@/lib/worker/protocol";
import type { MapLayer } from "@/store/app-store";

const hex = ([r, g, b]: [number, number, number]) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

export function cellFill(analysis: AnalysisPayload, rx: Pick<DerivedPrescription, "zones" | "rates">, layer: MapLayer): (i: number) => string {
  const zc = analysis.zoning.zoneCount;
  if (layer === "rate") {
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rx.rates) {
      lo = Math.min(lo, r);
      hi = Math.max(hi, r);
    }
    const span = hi - lo || 1;
    return (i) => hex(rampColor(RATE_RAMP, (rx.rates[i] - lo) / span));
  }
  if (layer === "primary") {
    const vals = analysis.cells.map((c) => c.primary);
    const lo = percentile(vals, 2);
    const hi = percentile(vals, 98);
    const span = hi - lo || 1e-3;
    return (i) => hex(rampColor(INDEX_RAMP, (analysis.cells[i].primary - lo) / span));
  }
  return (i) => zoneColor(rx.zones[i], zc);
}

/** Range shown in the crop-health legend (same stretch as the colours). */
export function healthRange(analysis: AnalysisPayload): [number, number] {
  const vals = analysis.cells.map((c) => c.primary);
  return [percentile(vals, 2), percentile(vals, 98)];
}
