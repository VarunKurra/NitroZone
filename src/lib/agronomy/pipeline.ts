/**
 * The analysis pipeline, in one place:
 *
 *   IndexRaster (NDRE/NDVI per pixel)
 *     -> buildGrid        prescription cells clipped to the field, pixel means per cell
 *     -> delineateZones   k-means + smoothing + small-zone merging
 *
 * Rates are NOT computed here: they depend on farmer settings that change constantly, so
 * they are recomputed instantly on the main thread from `rates.ts`.
 */
import type { MultiPolygon, Polygon } from "geojson";
import { buildGrid } from "./grid";
import { delineateZones } from "./zones";
import type { AnalysisSettings, GridCell, IndexRaster, ZoningResult } from "./types";

export const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = {
  zoneCount: 4,
  cellSizeM: 20,
  minZoneAc: 0.75,
  smooth: true,
  edgeBufferM: 8,
};

export interface AnalysisOutput {
  cells: GridCell[];
  cols: number;
  rows: number;
  lookup: Int32Array;
  zoning: ZoningResult;
  fieldAreaAc: number;
  clearFraction: number;
  timings: { gridMs: number; zoningMs: number };
}

export function analyzeRaster(
  raster: IndexRaster,
  field: Polygon | MultiPolygon,
  settings: AnalysisSettings,
  reference?: Polygon | MultiPolygon | null,
): AnalysisOutput {
  const t0 = now();
  const grid = buildGrid({ raster, field, settings, reference });
  const t1 = now();
  if (!grid.cells.length) throw new Error("The field is too small for the chosen grid cell size.");
  if (grid.cells.every((c) => !Number.isFinite(c.primary)))
    throw new Error("No usable pixels inside the field (fully cloud-covered or outside the image).");
  const zoning = delineateZones({
    cells: grid.cells,
    cols: grid.cols,
    rows: grid.rows,
    lookup: grid.lookup,
    zoneCount: settings.zoneCount,
    minZoneAc: settings.minZoneAc,
    smooth: settings.smooth,
  });
  const t2 = now();
  return { ...grid, zoning, timings: { gridMs: t1 - t0, zoningMs: t2 - t1 } };
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
