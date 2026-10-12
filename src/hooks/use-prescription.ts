"use client";

import { useMemo } from "react";
import { derivePrescription, type DerivedPrescription } from "@/lib/agronomy/prescription";
import { indexNames, type ReportContext } from "@/lib/export/formats";
import { useApp } from "@/store/app-store";

/**
 * The live, derived prescription. Recomputed whenever the analysis, settings or zone edits
 * change. Every chart, stat and export reads from this one object.
 */
export function usePrescription(): (DerivedPrescription & { names: { primary: string; secondary: string } }) | null {
  const analysis = useApp((s) => s.analysis);
  const overrides = useApp((s) => s.overrides);
  const rateSettings = useApp((s) => s.rateSettings);
  return useMemo(() => {
    if (!analysis) return null;
    const d = derivePrescription({
      cells: analysis.cells,
      baseZones: analysis.zoning.zoneOfCell,
      zoneCount: analysis.zoning.zoneCount,
      overrides,
      settings: rateSettings,
      scene: analysis.scene,
      clearFraction: analysis.clearFraction,
    });
    return { ...d, names: indexNames(analysis.scene) };
  }, [analysis, overrides, rateSettings]);
}

/** Snapshot everything an export needs. */
export function buildReportContext(insights?: { lines: string[]; source: "gemini" | "rules" }): ReportContext | null {
  const s = useApp.getState();
  if (!s.analysis || !s.field) return null;
  const d = derivePrescription({
    cells: s.analysis.cells,
    baseZones: s.analysis.zoning.zoneOfCell,
    zoneCount: s.analysis.zoning.zoneCount,
    overrides: s.overrides,
    settings: s.rateSettings,
    scene: s.analysis.scene,
    clearFraction: s.analysis.clearFraction,
  });
  return {
    fieldName: s.fieldName.trim() || "Field",
    field: s.field,
    scene: s.analysis.scene,
    settings: s.rateSettings,
    zoneCount: s.analysis.zoning.zoneCount,
    cellSizeM: s.analysisSettings.cellSizeM,
    cells: s.analysis.cells,
    zones: d.zones,
    rates: d.rates,
    reference: d.reference,
    summaries: d.summaries,
    totals: d.totals,
    health: d.health,
    confidence: d.confidence,
    generatedAt: new Date(),
    insights: insights?.lines,
    insightsSource: insights?.source,
  };
}
