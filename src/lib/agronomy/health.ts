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
    reasons.push({ ok: false, text: "Practice data, not a real photo of this field" });
  } else if (scene.source === "cached") {
    reasons.push({ ok: true, text: "Real satellite photo of this field" });
  } else if (scene.source === "drone") {
    reasons.push({ ok: true, text: "Your drone photo (a little less precise than satellite)" });
    score -= 10;
  } else {
    reasons.push({ ok: true, text: "Real satellite photo of this field" });
  }

  const clearPct = Math.round(clearFraction * 100);
  if (clearFraction >= 0.97) reasons.push({ ok: true, text: `${clearPct}% of the field was clear of clouds` });
  else if (clearFraction >= 0.8) {
    score -= 15;
    reasons.push({ ok: false, text: `${clearPct}% of the field was clear of clouds; the rest was estimated` });
  } else {
    score -= 35;
    reasons.push({ ok: false, text: `Only ${clearPct}% of the field was clear. Try a clearer photo.` });
  }

  if (filledShare > 0.02) {
    score -= Math.min(20, Math.round(filledShare * 50));
    reasons.push({ ok: false, text: `${Math.round(filledShare * 100)}% of the field had to be estimated` });
  }

  if (scene.sensor === "sentinel2") {
    if (meanSecondary < 0.4) {
      score -= 25;
      reasons.push({ ok: false, text: "The crop is still small, so the photo mostly shows soil. Try a later date." });
    } else reasons.push({ ok: true, text: "The crop is big enough to measure" });
  }

  if (scene.acquired && scene.source === "live") {
    const ageDays = ((params.today ?? new Date()).getTime() - new Date(scene.acquired).getTime()) / 86_400_000;
    if (ageDays > 14) {
      score -= 10;
      reasons.push({ ok: false, text: `Photo is ${Math.round(ageDays)} days old; the crop may have changed` });
    } else reasons.push({ ok: true, text: `Photo is ${Math.max(0, Math.round(ageDays))} days old` });
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

  void indexName;
  out.push(`Your field scores ${health.score} out of 100 for crop health (${health.label.toLowerCase()}).`);
  out.push(
    `Zone ${low.zone} (${low.areaAc.toFixed(0)} acres, ${pct(low.areaAc)}% of the field) is the weakest. ` +
      `Walk it first: the cause could be water, soil or pests, not just fertilizer.`,
  );
  if (totals.usesMoreThanFlat)
    out.push(`This plan uses ${Math.abs(totals.savedLbN).toFixed(0)} lb more fertilizer than your usual rate.`);
  else out.push(`This plan saves about ${totals.savedLbN.toFixed(0)} lb of fertilizer, worth about $${totals.savedUsd.toFixed(0)}.`);
  if (high.zone !== low.zone) out.push(`Zone ${high.zone} is the healthiest, so it gets the least: ${high.rateLbAc.toFixed(0)} lb per acre.`);
  if (health.variability < 0.03) out.push("The field is very even, so one rate everywhere might work just as well.");
  return out;
}
