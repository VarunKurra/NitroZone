/**
 * Field health score, data confidence and plain-English (rule-based) insights.
 *
 * FIELD HEALTH SCORE (0-100)
 *   = 100 x area-weighted average of min(SI, 1) across the field
 *   where SI (sufficiency index) = cell NDRE / reference NDRE.
 *   100 means every part of the field looks as vigorous as the reference (the N-rich strip,
 *   or the best 5% of the field when no strip was drawn). It is a RELATIVE measure of crop
 *   vigor uniformity, not an absolute measure of nitrogen in the plant.
 */
import { SI_SUFFICIENT } from "./rates";
import type { GridCell, PrescriptionTotals, SceneInfo, ZoneSummary } from "./types";

export interface HealthScore {
  score: number;
  label: "Excellent" | "Good" | "Fair" | "Stressed";
  /** Share of the field area at or above the 0.95 sufficiency threshold (0-1). */
  sufficientShare: number;
  /** Coefficient of variation of the primary index (std / mean). */
  variability: number;
  meanSI: number;
}

export function healthScore(cells: GridCell[], reference: number): HealthScore {
  let area = 0;
  let siSum = 0;
  let suff = 0;
  let m = 0;
  for (const c of cells) {
    if (!Number.isFinite(c.primary) || !(reference > 0)) continue;
    const si = c.primary / reference;
    area += c.areaAc;
    siSum += Math.min(si, 1) * c.areaAc;
    if (si >= SI_SUFFICIENT) suff += c.areaAc;
    m += c.primary * c.areaAc;
  }
  const meanP = area ? m / area : Number.NaN;
  let v = 0;
  for (const c of cells) if (Number.isFinite(c.primary)) v += (c.primary - meanP) ** 2 * c.areaAc;
  const variability = area && meanP ? Math.sqrt(v / area) / Math.abs(meanP) : 0;
  const meanSI = area ? siSum / area : 0;
  const score = Math.round(100 * meanSI);
  const label = score >= 92 ? "Excellent" : score >= 85 ? "Good" : score >= 75 ? "Fair" : "Stressed";
  return { score, label, sufficientShare: area ? suff / area : 0, variability, meanSI };
}

export interface Confidence {
  level: "High" | "Medium" | "Low";
  /** 0-100 for the gauge. */
  score: number;
  reasons: { ok: boolean; text: string }[];
}

/**
 * How much should the farmer trust this analysis? Simple, explainable checklist.
 */
export function dataConfidence(params: {
  scene: SceneInfo;
  clearFraction: number;
  meanSecondary: number;
  filledShare: number;
  today?: Date;
}): Confidence {
  const { scene, clearFraction, meanSecondary, filledShare } = params;
  const reasons: Confidence["reasons"] = [];
  let score = 100;

  if (scene.source === "synthetic") {
    score -= 60;
    reasons.push({ ok: false, text: "Synthetic demonstration raster, not a real image of this field" });
  } else if (scene.source === "cached") {
    reasons.push({ ok: true, text: "Real Sentinel-2 scene (bundled copy for offline use)" });
  } else if (scene.source === "drone") {
    reasons.push({ ok: true, text: "Your drone image (RGB indices are less nitrogen-specific than red-edge)" });
    score -= 10;
  } else {
    reasons.push({ ok: true, text: "Live Sentinel-2 L2A scene" });
  }

  const clearPct = Math.round(clearFraction * 100);
  if (clearFraction >= 0.97) reasons.push({ ok: true, text: `${clearPct}% of the field was cloud-free` });
  else if (clearFraction >= 0.8) {
    score -= 15;
    reasons.push({ ok: false, text: `${clearPct}% of the field was cloud-free; masked cells were estimated from neighbours` });
  } else {
    score -= 35;
    reasons.push({ ok: false, text: `Only ${clearPct}% of the field was cloud-free; pick a clearer date if possible` });
  }

  if (filledShare > 0.02) {
    score -= Math.min(20, Math.round(filledShare * 50));
    reasons.push({ ok: false, text: `${Math.round(filledShare * 100)}% of grid cells were gap-filled` });
  }

  if (scene.sensor === "sentinel2") {
    if (meanSecondary < 0.4) {
      score -= 25;
      reasons.push({ ok: false, text: "Sparse canopy (NDVI < 0.4): soil may dominate the signal; is the corn past V6?" });
    } else reasons.push({ ok: true, text: `Canopy is established (mean NDVI ${meanSecondary.toFixed(2)})` });
  }

  if (scene.acquired && scene.source === "live") {
    const ageDays = ((params.today ?? new Date()).getTime() - new Date(scene.acquired).getTime()) / 86_400_000;
    if (ageDays > 14) {
      score -= 10;
      reasons.push({ ok: false, text: `Image is ${Math.round(ageDays)} days old; crop condition may have changed` });
    } else reasons.push({ ok: true, text: `Image is ${Math.max(0, Math.round(ageDays))} days old` });
  }

  score = Math.max(0, Math.min(100, score));
  return { level: score >= 80 ? "High" : score >= 55 ? "Medium" : "Low", score, reasons };
}

/**
 * Rule-based insights. Used on their own when Gemini is not configured or fails,
 * and also passed to Gemini as grounding so the AI can only rephrase real numbers.
 */
export function ruleInsights(zones: ZoneSummary[], totals: PrescriptionTotals, health: HealthScore, indexName: string): string[] {
  const out: string[] = [];
  const nonEmpty = zones.filter((z) => z.areaAc > 0);
  if (!nonEmpty.length) return out;
  const low = nonEmpty[0];
  const high = nonEmpty[nonEmpty.length - 1];
  const pct = (a: number) => Math.round((a / totals.areaAc) * 100);

  out.push(
    `${pct(health.sufficientShare * totals.areaAc)}% of the field is within 5% of the reference ${indexName}; ` +
      `the field health score is ${health.score}/100 (${health.label.toLowerCase()}).`,
  );
  out.push(
    `Zone ${low.zone} (${low.areaAc.toFixed(1)} ac, ${pct(low.areaAc)}% of the field) shows the lowest vigor ` +
      `(${indexName} ${low.primary.toFixed(3)}, SI ${low.sufficiency.toFixed(2)}). Scout it before sidedressing: ` +
      `low vigor can also come from water stress, compaction or poor stand, where extra N will not pay.`,
  );
  if (high.zone !== low.zone)
    out.push(
      `Zone ${high.zone} (${high.areaAc.toFixed(1)} ac) is the most vigorous at SI ${high.sufficiency.toFixed(2)}; ` +
        `it receives ${high.rateLbAc.toFixed(0)} lb N/ac in this plan.`,
    );
  if (totals.usesMoreThanFlat)
    out.push(
      `This plan uses ${Math.abs(totals.savedLbN).toFixed(0)} lb MORE nitrogen than a flat rate. That can be the right call ` +
        `on a stressed field, but it will not save fertilizer cost.`,
    );
  else
    out.push(
      `Compared with a flat ${(totals.flatLbN / totals.areaAc).toFixed(0)} lb N/ac, this plan uses ` +
        `${totals.savedLbN.toFixed(0)} lb less N (estimated $${totals.savedUsd.toFixed(0)} at your N price).`,
    );
  if (health.variability < 0.03)
    out.push(`Vigor is very uniform (CV ${(health.variability * 100).toFixed(1)}%). A flat rate may be just as good here.`);
  return out;
}
