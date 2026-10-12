/**
 * Turns the computed prescription into GeoJSON features: one polygon per grid cell,
 * clipped to the field boundary, in WGS84 (EPSG:4326) longitude/latitude.
 * This is the single feature list every export format is built from.
 */
import type { Feature, FeatureCollection, Polygon, Position } from "geojson";
import { signedRingArea } from "@/lib/agronomy/geo";
import type { GridCell } from "@/lib/agronomy/types";

export type ExportCell = Omit<GridCell, "rings">;

export interface CellProps {
  /** Shapefile attributes (names <= 10 chars, required by the DBF format). */
  ZONE: number;
  RATE_LBAC: number;
  AREA_AC: number;
}

export interface RichCellProps extends CellProps {
  CELL_ID: number;
  NDRE?: number;
  NDVI?: number;
  VARI?: number;
  EXG?: number;
  SI: number;
  TOTAL_LBN: number;
  ESTIMATED: boolean;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

/**
 * Shapefiles want outer rings clockwise and holes counter-clockwise.
 * (GeoJSON RFC 7946 prefers the opposite; most readers accept either, but controllers can be picky.)
 */
export function orientForShapefile(rings: Position[][]): Position[][] {
  return rings.map((ring, i) => {
    const closed = closeRing(ring);
    const cw = signedRingArea(closed) < 0;
    const wantCw = i === 0;
    return cw === wantCw ? closed : closed.slice().reverse();
  });
}

export function closeRing(ring: Position[]): Position[] {
  const a = ring[0];
  const b = ring[ring.length - 1];
  return a[0] === b[0] && a[1] === b[1] ? ring : [...ring, a];
}

/**
 * Split the clipped cell geometry into simple polygons. A cell clipped by an irregular
 * boundary can have several parts; each becomes its own feature with the same zone/rate.
 * Rings are grouped as [outer, ...holes] by containment.
 */
export function cellPolygons(cell: ExportCell): Position[][][] {
  const rings = cell.ringsLngLat.map(closeRing);
  if (rings.length <= 1) return [rings];
  const outers: Position[][][] = [];
  const holes: Position[][] = [];
  // In clipped output, outer rings come first; holes are the rings contained in another ring.
  for (const ring of rings) {
    const p = ring[0];
    const container = rings.find((other) => other !== ring && inRing(p[0], p[1], other) && Math.abs(signedRingArea(other)) > Math.abs(signedRingArea(ring)));
    if (container) holes.push(ring);
    else outers.push([ring]);
  }
  for (const h of holes) {
    const owner = outers.find((o) => inRing(h[0][0], h[0][1], o[0]));
    if (owner) owner.push(h);
  }
  return outers;
}

function inRing(x: number, y: number, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface PrescriptionInput {
  cells: ExportCell[];
  zones: ArrayLike<number>;
  rates: ArrayLike<number>;
  reference: number;
  sensor: "sentinel2" | "drone-rgb";
}

/** Minimal attributes for controllers (shapefile). Multi-part cells are split into parts. */
export function controllerFeatures({ cells, zones, rates }: PrescriptionInput): FeatureCollection<Polygon, CellProps> {
  const features: Feature<Polygon, CellProps>[] = [];
  cells.forEach((cell, i) => {
    const parts = cellPolygons(cell);
    const totalPartArea = parts.reduce((s, p) => s + Math.abs(signedRingArea(p[0])), 0) || 1;
    for (const rings of parts) {
      const share = Math.abs(signedRingArea(rings[0])) / totalPartArea;
      features.push({
        type: "Feature",
        properties: { ZONE: zones[i], RATE_LBAC: r2(rates[i]), AREA_AC: r4(cell.areaAc * share) },
        geometry: { type: "Polygon", coordinates: orientForShapefile(rings) },
      });
    }
  });
  return { type: "FeatureCollection", features };
}

/** Rich attributes for GeoJSON / KML / CSV (index values, SI, totals). */
export function richFeatures({ cells, zones, rates, reference, sensor }: PrescriptionInput): FeatureCollection<Polygon, RichCellProps> {
  const features: Feature<Polygon, RichCellProps>[] = [];
  cells.forEach((cell, i) => {
    const base: RichCellProps = {
      CELL_ID: cell.id,
      ZONE: zones[i],
      RATE_LBAC: r2(rates[i]),
      AREA_AC: r4(cell.areaAc),
      TOTAL_LBN: r2(rates[i] * cell.areaAc),
      SI: r4(reference > 0 ? cell.primary / reference : Number.NaN),
      ESTIMATED: cell.filled,
      ...(sensor === "sentinel2" ? { NDRE: r4(cell.primary), NDVI: r4(cell.secondary) } : { VARI: r4(cell.primary), EXG: r4(cell.secondary) }),
    };
    // GeoJSON allows MultiPolygon, but we keep simple Polygons for maximum compatibility.
    for (const rings of cellPolygons(cell)) {
      features.push({
        type: "Feature",
        properties: base,
        geometry: { type: "Polygon", coordinates: rings.map((r, k) => orientRfc7946(r, k === 0)) },
      });
    }
  });
  return { type: "FeatureCollection", features };
}

/** RFC 7946: exterior rings counter-clockwise, holes clockwise. */
function orientRfc7946(ring: Position[], exterior: boolean): Position[] {
  const ccw = signedRingArea(ring) > 0;
  return ccw === exterior ? ring : ring.slice().reverse();
}
