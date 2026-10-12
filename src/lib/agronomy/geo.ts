/**
 * Geometry helpers. All "metric" work (areas, grid cells, distances) happens in the
 * field's UTM zone so that 1 unit = 1 metre. Results are converted back to WGS84
 * longitude/latitude for the map and for exports (shapefiles are written in WGS84).
 */
import proj4 from "proj4";
import type { MultiPolygon, Polygon, Position } from "geojson";

export const SQ_M_PER_ACRE = 4046.8564224;
export const WGS84 = "EPSG:4326";

/** UTM zone number for a longitude (no Norway/Svalbard exceptions needed for Missouri). */
export function utmZone(lon: number): number {
  return Math.min(60, Math.max(1, Math.floor((lon + 180) / 6) + 1));
}

/** Proj4 definition for the WGS84 / UTM zone covering (lon, lat). */
export function utmProjFor(lon: number, lat: number): string {
  const zone = utmZone(lon);
  return `+proj=utm +zone=${zone}${lat < 0 ? " +south" : ""} +datum=WGS84 +units=m +no_defs`;
}

/** EPSG code like 32615 -> proj4 string. Only WGS84/UTM codes are expected from Sentinel-2. */
export function projForEpsg(epsg: number): string {
  if (epsg >= 32601 && epsg <= 32660) return `+proj=utm +zone=${epsg - 32600} +datum=WGS84 +units=m +no_defs`;
  if (epsg >= 32701 && epsg <= 32760) return `+proj=utm +zone=${epsg - 32700} +south +datum=WGS84 +units=m +no_defs`;
  if (epsg === 4326) return "+proj=longlat +datum=WGS84 +no_defs";
  if (epsg === 3857) return "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +no_defs";
  if (epsg === 5070)
    return "+proj=aea +lat_0=23 +lon_0=-96 +lat_1=29.5 +lat_2=45.5 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs";
  if (epsg >= 26901 && epsg <= 26923) return `+proj=utm +zone=${epsg - 26900} +datum=NAD83 +units=m +no_defs`;
  throw new Error(`Unsupported coordinate system EPSG:${epsg}`);
}

export function makeProjector(crs: string) {
  const p = proj4(WGS84, crs);
  return {
    toMetric: (lngLat: Position): [number, number] => p.forward([lngLat[0], lngLat[1]]) as [number, number],
    toLngLat: (xy: Position): [number, number] => p.inverse([xy[0], xy[1]]) as [number, number],
  };
}

/** Polygon or MultiPolygon -> list of polygons, each a list of rings (outer first). */
export function polygonsOf(geom: Polygon | MultiPolygon): Position[][][] {
  return geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
}

/** Signed shoelace area (m^2 for metric coordinates). Positive = counter-clockwise. */
export function signedRingArea(ring: Position[]): number {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return -s / 2;
}

/** Area of polygons-with-holes in metric coordinates (m^2). */
export function metricArea(polys: Position[][][]): number {
  let a = 0;
  for (const rings of polys) {
    rings.forEach((ring, i) => {
      const ra = Math.abs(signedRingArea(ring));
      a += i === 0 ? ra : -ra;
    });
  }
  return a;
}

/** Even-odd point in polygon test over all rings (handles holes and multipolygons). */
export function pointInPolygons(x: number, y: number, polys: Position[][][]): boolean {
  let inside = false;
  for (const rings of polys) {
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0];
        const yi = ring[i][1];
        const xj = ring[j][0];
        const yj = ring[j][1];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
  }
  return inside;
}

/** Shortest distance from a point to any polygon edge (metres in metric CRS). */
export function distanceToEdges(x: number, y: number, polys: Position[][][]): number {
  let best = Infinity;
  for (const rings of polys) {
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const ax = ring[j][0];
        const ay = ring[j][1];
        const bx = ring[i][0];
        const by = ring[i][1];
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy;
        let t = len2 ? ((x - ax) * dx + (y - ay) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
        if (d < best) best = d;
      }
    }
  }
  return best;
}

export function boundsOf(polys: Position[][][]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rings of polys)
    for (const p of rings[0]) {
      minX = Math.min(minX, p[0]);
      minY = Math.min(minY, p[1]);
      maxX = Math.max(maxX, p[0]);
      maxY = Math.max(maxY, p[1]);
    }
  return [minX, minY, maxX, maxY];
}

/** Project every coordinate of polygons through a function. */
export function mapPolys(polys: Position[][][], fn: (p: Position) => Position): Position[][][] {
  return polys.map((rings) => rings.map((ring) => ring.map(fn)));
}

/** Area of a WGS84 polygon in acres (projects to its UTM zone first). */
export function areaAcresLngLat(geom: Polygon | MultiPolygon): number {
  const polys = polygonsOf(geom);
  const first = polys[0][0][0];
  const { toMetric } = makeProjector(utmProjFor(first[0], first[1]));
  return metricArea(mapPolys(polys, toMetric)) / SQ_M_PER_ACRE;
}

export function centroidLngLat(geom: Polygon | MultiPolygon): [number, number] {
  const ring = polygonsOf(geom)[0][0];
  let x = 0;
  let y = 0;
  const n = ring.length - (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? 1 : 0);
  for (let i = 0; i < n; i++) {
    x += ring[i][0];
    y += ring[i][1];
  }
  return [x / n, y / n];
}
