/**
 * Build the prescription grid.
 *
 * 1. Project the field boundary into the raster's metric CRS (UTM).
 * 2. Lay a square grid (default 20 m) over the field's bounding box.
 * 3. Clip every square to the boundary, so edge cells follow the field outline.
 * 4. Average the valid pixels that fall in each cell (ignoring a thin edge buffer,
 *    because boundary pixels mix crop with roads, ditches and fence rows).
 * 5. Cells with no valid pixels (cloud, shadow) borrow the mean of their nearest valid
 *    neighbours and are flagged as `filled` so the farmer can see they were estimated.
 */
import { featureCollection, intersect, polygon as turfPolygon } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import {
  SQ_M_PER_ACRE,
  distanceToEdges,
  makeProjector,
  mapPolys,
  metricArea,
  pointInPolygons,
  polygonsOf,
  boundsOf,
} from "./geo";
import type { AnalysisSettings, GridCell, IndexRaster } from "./types";

export interface GridBuildInput {
  raster: IndexRaster;
  field: Polygon | MultiPolygon;
  settings: Pick<AnalysisSettings, "cellSizeM" | "edgeBufferM">;
  /** Optional N-rich reference strip drawn by the farmer (WGS84). */
  reference?: Polygon | MultiPolygon | null;
}

export interface GridBuildOutput {
  cells: GridCell[];
  /** Grid dimensions, so neighbours can be found by (col, row). */
  cols: number;
  rows: number;
  /** Index into `cells` for each (row * cols + col), -1 where the square is outside the field. */
  lookup: Int32Array;
  fieldAreaAc: number;
  /** Fraction of in-field pixels that were usable (not cloud/shadow/no data). */
  clearFraction: number;
}

export function buildGrid({ raster, field, settings, reference }: GridBuildInput): GridBuildOutput {
  const { toMetric, toLngLat } = makeProjector(raster.crs);
  const polys = mapPolys(polygonsOf(field), toMetric);
  const refPolys = reference ? mapPolys(polygonsOf(reference), toMetric) : null;
  const cell = settings.cellSizeM;
  const [minX, minY, maxX, maxY] = boundsOf(polys);

  // Grid snapped to multiples of the cell size so cells line up neatly between runs.
  const gx0 = Math.floor(minX / cell) * cell;
  const gy1 = Math.ceil(maxY / cell) * cell; // north edge
  const cols = Math.max(1, Math.ceil((maxX - gx0) / cell));
  const rows = Math.max(1, Math.ceil((gy1 - minY) / cell));

  // --- 1. Aggregate pixels into grid squares ---
  const n = cols * rows;
  const sumP = new Float64Array(n);
  const sumS = new Float64Array(n);
  const cntValid = new Int32Array(n);
  const cntField = new Int32Array(n);
  const cntUsable = new Int32Array(n); // in-field and not masked (ignores edge buffer)
  let fieldPx = 0;
  let usablePx = 0;

  const { width, height, originX, originY, pixelSize, primary, secondary } = raster;
  for (let r = 0; r < height; r++) {
    const y = originY - (r + 0.5) * pixelSize;
    if (y < minY || y > maxY) continue;
    for (let c = 0; c < width; c++) {
      const x = originX + (c + 0.5) * pixelSize;
      if (x < minX || x > maxX) continue;
      if (!pointInPolygons(x, y, polys)) continue;
      const gc = Math.floor((x - gx0) / cell);
      const gr = Math.floor((gy1 - y) / cell);
      if (gc < 0 || gr < 0 || gc >= cols || gr >= rows) continue;
      const gi = gr * cols + gc;
      cntField[gi]++;
      fieldPx++;
      const p = primary[r * width + c];
      const s = secondary[r * width + c];
      if (!Number.isFinite(p)) continue;
      cntUsable[gi]++;
      usablePx++;
      if (settings.edgeBufferM > 0 && distanceToEdges(x, y, polys) < settings.edgeBufferM) continue;
      sumP[gi] += p;
      sumS[gi] += Number.isFinite(s) ? s : 0;
      cntValid[gi]++;
    }
  }

  // --- 2. Build clipped cell geometry ---
  const fieldFeature = toTurf(polys);
  const cells: GridCell[] = [];
  const lookup = new Int32Array(n).fill(-1);
  const halfDiag = (cell * Math.SQRT2) / 2;
  for (let gr = 0; gr < rows; gr++) {
    for (let gc = 0; gc < cols; gc++) {
      const x0 = gx0 + gc * cell;
      const y1 = gy1 - gr * cell;
      const x1 = x0 + cell;
      const y0 = y1 - cell;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const square: Position[] = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
        [x0, y0],
      ];
      let rings: Position[][][];
      const centerInside = pointInPolygons(cx, cy, polys);
      if (centerInside && distanceToEdges(cx, cy, polys) >= halfDiag) {
        rings = [[square]]; // fully interior: no clipping needed
      } else {
        const clipped = intersect(featureCollection([fieldFeature, turfPolygon([square])]));
        if (!clipped) continue;
        rings = polygonsOf(clipped.geometry);
      }
      const areaM2 = metricArea(rings);
      if (areaM2 < cell * cell * 0.02) continue; // ignore slivers < 2% of a cell
      const gi = gr * cols + gc;
      lookup[gi] = cells.length;
      const valid = cntValid[gi];
      cells.push({
        id: cells.length,
        col: gc,
        row: gr,
        rings: rings.flat(),
        ringsLngLat: rings.flat().map((ring) => ring.map((p) => roundLngLat(toLngLat(p)))),
        areaAc: areaM2 / SQ_M_PER_ACRE,
        center: roundLngLat(toLngLat([cx, cy])),
        primary: valid ? sumP[gi] / valid : Number.NaN,
        secondary: valid ? sumS[gi] / valid : Number.NaN,
        validFraction: cntField[gi] ? cntUsable[gi] / cntField[gi] : 0,
        filled: false,
        inReference: refPolys ? pointInPolygons(cx, cy, refPolys) : false,
      });
    }
  }

  fillMissing(cells, lookup, cols, rows);

  return {
    cells,
    cols,
    rows,
    lookup,
    fieldAreaAc: metricArea(polys) / SQ_M_PER_ACRE,
    clearFraction: fieldPx ? usablePx / fieldPx : 0,
  };
}

/**
 * Cells with no valid pixels take the average of the nearest ring of valid neighbours
 * (searching outward up to the whole grid). They are flagged `filled`.
 */
function fillMissing(cells: GridCell[], lookup: Int32Array, cols: number, rows: number) {
  const missing = cells.filter((c) => !Number.isFinite(c.primary));
  if (missing.length === cells.length) return; // nothing to borrow from
  const maxR = Math.max(cols, rows);
  for (const c of missing) {
    for (let rad = 1; rad <= maxR; rad++) {
      let sp = 0;
      let ss = 0;
      let k = 0;
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
          const rr = c.row + dr;
          const cc = c.col + dc;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          const idx = lookup[rr * cols + cc];
          if (idx < 0) continue;
          const nb = cells[idx];
          if (nb.filled || !Number.isFinite(nb.primary)) continue;
          sp += nb.primary;
          ss += nb.secondary;
          k++;
        }
      }
      if (k) {
        c.primary = sp / k;
        c.secondary = ss / k;
        c.filled = true;
        break;
      }
    }
  }
}

function toTurf(polys: Position[][][]): Feature<Polygon | MultiPolygon> {
  return polys.length === 1
    ? { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: polys[0] } }
    : { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: polys } };
}

/** 7 decimal places of a degree is ~1 cm: plenty, and keeps exports small. */
function roundLngLat(p: Position): [number, number] {
  return [Math.round(p[0] * 1e7) / 1e7, Math.round(p[1] * 1e7) / 1e7];
}
