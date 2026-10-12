import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeCachedScene } from "@/lib/imagery/cached";
import { bandsToIndexRaster } from "@/lib/imagery/sentinel";
import { analyzeRaster, DEFAULT_ANALYSIS_SETTINGS } from "@/lib/agronomy/pipeline";
import { DEMO_FIELD } from "@/lib/demo/demo-field";
import { referenceValue, summarizeZones, totalsOf, DEFAULT_RATE_SETTINGS } from "@/lib/agronomy/rates";
import { healthScore } from "@/lib/agronomy/health";
import { areaAcresLngLat } from "@/lib/agronomy/geo";

const raw = decodeCachedScene(JSON.parse(readFileSync("public/demo/demo-scene-2025-07-01.json", "utf8")));

describe("demo field end to end", () => {
  const raster = bandsToIndexRaster(raw);
  const out = analyzeRaster(raster, DEMO_FIELD.geometry, DEFAULT_ANALYSIS_SETTINGS);

  it("cells cover the field area", () => {
    const fieldAc = areaAcresLngLat(DEMO_FIELD.geometry);
    const cellAc = out.cells.reduce((s, c) => s + c.areaAc, 0);
    console.log("field ac", fieldAc.toFixed(2), "cells ac", cellAc.toFixed(2), "cells", out.cells.length, out.timings);
    expect(Math.abs(cellAc - fieldAc) / fieldAc).toBeLessThan(0.01);
  });

  it("produces ordered zones and sane numbers", () => {
    const ref = referenceValue(out.cells);
    const zones = summarizeZones(out.cells, out.zoning.zoneOfCell, out.zoning.zoneCount, DEFAULT_RATE_SETTINGS, ref.value);
    const totals = totalsOf(zones, DEFAULT_RATE_SETTINGS);
    const health = healthScore(out.cells, ref.value);
    console.table(zones.map((z) => ({ zone: z.zone, ac: z.areaAc.toFixed(1), ndre: z.primary.toFixed(3), si: z.sufficiency.toFixed(3), rate: z.rateLbAc })));
    console.log(totals, health, "merged", out.zoning.mergedFragments, "clear", out.clearFraction);
    for (let i = 1; i < zones.length; i++) expect(zones[i].primary).toBeGreaterThan(zones[i - 1].primary);
    expect(health.score).toBeGreaterThan(50);
  });
});
