/**
 * Generates src/data/hero.json: the REAL demo-field prescription (zones from the actual
 * Sentinel-2 analysis) in a compact form for the landing-page hero animation, plus a
 * true-colour backdrop (PPM, converted to PNG by the caller on macOS via `sips`).
 *
 *   npm run gen:hero
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { decodeCachedScene } from "@/lib/imagery/cached";
import { bandsToIndexRaster } from "@/lib/imagery/sentinel";
import { analyzeRaster, DEFAULT_ANALYSIS_SETTINGS } from "@/lib/agronomy/pipeline";
import { derivePrescription } from "@/lib/agronomy/prescription";
import { DEFAULT_RATE_SETTINGS } from "@/lib/agronomy/rates";
import { DEMO_FIELD } from "@/lib/demo/demo-field";
import { makeProjector, polygonsOf } from "@/lib/agronomy/geo";
import { readFileSync } from "node:fs";

it("generates hero data", () => {
  const raw = decodeCachedScene(JSON.parse(readFileSync("public/demo/demo-scene-2025-07-01.json", "utf8")));
  const raster = bandsToIndexRaster(raw);
  const out = analyzeRaster(raster, DEMO_FIELD.geometry, DEFAULT_ANALYSIS_SETTINGS);
  const scene = { source: "cached" as const, sensor: "sentinel2" as const, sceneId: raw.sceneId, acquired: raw.datetime, sceneCloudPct: raw.cloudCover, resolutionM: 10, provider: "", notes: [] };
  const d = derivePrescription({ cells: out.cells, baseZones: out.zoning.zoneOfCell, zoneCount: out.zoning.zoneCount, overrides: {}, settings: DEFAULT_RATE_SETTINGS, scene, clearFraction: out.clearFraction });

  // Local pixel space of the raster (10 m pixels, origin top-left) so cells, outline and image align.
  const { toMetric } = makeProjector(raster.crs);
  const px = (lngLat: number[]) => {
    const [x, y] = toMetric(lngLat);
    return [Math.round(((x - raster.originX) / 10) * 100) / 100, Math.round(((raster.originY - y) / 10) * 100) / 100];
  };
  const cells = out.cells.map((c, i) => ({ p: c.ringsLngLat[0].map(px), z: d.zones[i], v: Math.round(c.primary * 1000) / 1000 }));
  const outline = polygonsOf(DEMO_FIELD.geometry)[0][0].map(px);
  const hero = {
    width: raster.width,
    height: raster.height,
    sceneDate: raw.datetime.slice(0, 10),
    zoneCount: out.zoning.zoneCount,
    outline,
    cells,
    stats: {
      areaAc: Math.round(d.totals.areaAc * 10) / 10,
      health: d.health.score,
      savedUsd: Math.round(d.totals.savedUsd),
      savedLbN: Math.round(d.totals.savedLbN),
      reductionPct: Math.round((d.totals.savedLbN / d.totals.flatLbN) * 1000) / 10,
      zones: d.summaries.map((z) => ({ zone: z.zone, areaAc: Math.round(z.areaAc * 10) / 10, rate: Math.round(z.rateLbAc) })),
    },
  };
  writeFileSync("src/data/hero.json", JSON.stringify(hero));

  // True-colour backdrop, brightened like the in-app "True color" layer.
  const { width, height } = raster;
  const header = Buffer.from(`P6 ${width} ${height} 255\n`);
  const body = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) for (let k = 0; k < 3; k++) body[i * 3 + k] = Math.min(255, raw.tci![i * 3 + k] * 1.45 + 8);
  writeFileSync("scripts/hero/hero-tci.ppm", Buffer.concat([header, body]));
});
