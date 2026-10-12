/**
 * Statewide check: runs the LIVE pipeline (Planetary Computer search -> COG band reads ->
 * NDRE/NDVI -> grid -> zones) on farm fields in every region of Missouri.
 *   npx vitest run --config vitest.scripts.mts scripts/checks/missouri.gen.ts
 */
import { it } from "vitest";
import type { Polygon } from "geojson";
import { bandsToIndexRaster, readSceneBands, searchScenes } from "@/lib/imagery/sentinel";
import { analyzeRaster, DEFAULT_ANALYSIS_SETTINGS } from "@/lib/agronomy/pipeline";
import { areaAcresLngLat } from "@/lib/agronomy/geo";

const PLACES: [string, number, number][] = [
  ["Northwest (Atchison Co.)", -95.42, 40.42],
  ["North (Grundy Co.)", -93.62, 40.1],
  ["Northeast (Lewis Co.)", -91.76, 40.1],
  ["Central (Saline Co.)", -93.2, 39.15],
  ["East (Lincoln Co.)", -90.95, 39.05],
  ["West (Bates Co.)", -94.3, 38.3],
  ["Southwest (Barton Co.)", -94.3, 37.45],
  ["South-central (Howell Co.)", -91.9, 36.8],
  ["Bootheel (New Madrid Co.)", -89.6, 36.55],
];

function square(lon: number, lat: number, halfM = 220): Polygon {
  const dLat = halfM / 111_320;
  const dLon = halfM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { type: "Polygon", coordinates: [[[lon - dLon, lat - dLat], [lon + dLon, lat - dLat], [lon + dLon, lat + dLat], [lon - dLon, lat + dLat], [lon - dLon, lat - dLat]]] };
}

it("works across Missouri", async () => {
  const rows: string[] = [];
  for (const [name, lon, lat] of PLACES) {
    const field = square(lon, lat);
    try {
      const scenes = await searchScenes(field, new Date("2025-06-10T00:00:00Z"), new Date("2025-07-20T23:59:59Z"), { maxCloud: 40 });
      if (!scenes.length) {
        rows.push(`FAIL ${name}: no scenes`);
        continue;
      }
      const scene = [...scenes].sort((a, b) => a.cloudCover - b.cloudCover)[0];
      const raw = await readSceneBands(scene, field);
      const out = analyzeRaster(bandsToIndexRaster(raw), field, DEFAULT_ANALYSIS_SETTINGS);
      rows.push(
        `OK   ${name}: ${scenes.length} scenes, used ${scene.datetime.slice(0, 10)} EPSG:${scene.epsg}, ${areaAcresLngLat(field).toFixed(0)} ac, ` +
          `${out.cells.length} cells, ${out.zoning.zoneCount} zones, ${Math.round(out.clearFraction * 100)}% clear`,
      );
    } catch (e) {
      rows.push(`FAIL ${name}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("\n" + rows.join("\n"));
}, 600_000);
