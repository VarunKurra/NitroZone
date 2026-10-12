import { readFileSync } from "node:fs";
import { decodeCachedScene } from "@/lib/imagery/cached";
import { bandsToIndexRaster } from "@/lib/imagery/sentinel";
import { analyzeRaster, DEFAULT_ANALYSIS_SETTINGS } from "@/lib/agronomy/pipeline";
import { DEMO_FIELD } from "@/lib/demo/demo-field";
import { derivePrescription } from "@/lib/agronomy/prescription";
import { DEFAULT_RATE_SETTINGS } from "@/lib/agronomy/rates";
import type { ReportContext } from "@/lib/export/formats";
import type { AnalysisSettings, RateSettings, SceneInfo } from "@/lib/agronomy/types";

export const demoRaw = () => decodeCachedScene(JSON.parse(readFileSync("public/demo/demo-scene-2025-07-01.json", "utf8")));

export const demoScene: SceneInfo = {
  source: "cached",
  sensor: "sentinel2",
  sceneId: "S2C_MSIL2A_20250701T164921_R026_T15SXD_20250701T221619",
  acquired: "2025-07-01T16:49:21Z",
  sceneCloudPct: 3.2,
  resolutionM: 10,
  provider: "Sentinel-2 L2A",
  notes: [],
};

export function demoContext(settings: Partial<AnalysisSettings> = {}, rate: Partial<RateSettings> = {}): ReportContext {
  const s = { ...DEFAULT_ANALYSIS_SETTINGS, ...settings };
  const out = analyzeRaster(bandsToIndexRaster(demoRaw()), DEMO_FIELD.geometry, s);
  const rs = { ...DEFAULT_RATE_SETTINGS, ...rate };
  const d = derivePrescription({
    cells: out.cells,
    baseZones: out.zoning.zoneOfCell,
    zoneCount: out.zoning.zoneCount,
    overrides: {},
    settings: rs,
    scene: demoScene,
    clearFraction: out.clearFraction,
  });
  return {
    fieldName: "Audrain County demo field",
    field: DEMO_FIELD,
    scene: demoScene,
    settings: rs,
    zoneCount: out.zoning.zoneCount,
    cellSizeM: s.cellSizeM,
    cells: out.cells,
    zones: d.zones,
    rates: d.rates,
    reference: d.reference,
    summaries: d.summaries,
    totals: d.totals,
    health: d.health,
    confidence: d.confidence,
    generatedAt: new Date("2026-10-11T12:00:00Z"),
    insights: ["Test insight one.", "Test insight two."],
    insightsSource: "rules",
  };
}
