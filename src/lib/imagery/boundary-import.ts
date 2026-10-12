/**
 * Import an existing field boundary: GeoJSON, KML, or a zipped shapefile (what most farm
 * software exports). Returns the largest polygon found, in WGS84.
 */
import JSZip from "jszip";
import * as shapefile from "shapefile";
import proj4 from "proj4";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { areaAcresLngLat } from "@/lib/agronomy/geo";

type Poly = Polygon | MultiPolygon;

function largest(geoms: Poly[]): Poly {
  if (!geoms.length) throw new Error("No polygon found in the file.");
  return geoms.map((g) => ({ g, a: areaAcresLngLat(g) })).sort((a, b) => b.a - a.a)[0].g;
}

function collect(gj: unknown): Poly[] {
  const out: Poly[] = [];
  const visit = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    const obj = o as { type?: string; features?: unknown[]; geometry?: unknown; geometries?: unknown[] };
    if (obj.type === "FeatureCollection") obj.features?.forEach(visit);
    else if (obj.type === "Feature") visit(obj.geometry);
    else if (obj.type === "GeometryCollection") obj.geometries?.forEach(visit);
    else if (obj.type === "Polygon" || obj.type === "MultiPolygon") out.push(o as Poly);
  };
  visit(gj);
  return out;
}

function parseKml(text: string): Poly[] {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const polys: Poly[] = [];
  const ring = (el: Element | null): Position[] =>
    (el?.textContent ?? "")
      .trim()
      .split(/\s+/)
      .map((t) => t.split(",").map(Number))
      .filter((p) => p.length >= 2 && p.every(Number.isFinite))
      .map((p) => [p[0], p[1]]);
  for (const p of Array.from(doc.getElementsByTagName("Polygon"))) {
    const outer = ring(p.getElementsByTagName("outerBoundaryIs")[0]?.getElementsByTagName("coordinates")[0] ?? null);
    const holes = Array.from(p.getElementsByTagName("innerBoundaryIs")).map((ib) => ring(ib.getElementsByTagName("coordinates")[0]));
    if (outer.length >= 4) polys.push({ type: "Polygon", coordinates: [outer, ...holes] });
  }
  return polys;
}

export async function importBoundary(file: File): Promise<{ feature: Feature<Poly>; name: string }> {
  const name = file.name.replace(/\.(zip|geojson|json|kml)$/i, "");
  const lower = file.name.toLowerCase();
  let geom: Poly;
  if (lower.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const shp = zip.file(/\.shp$/i)[0];
    if (!shp) throw new Error("The ZIP has no .shp file.");
    const dbf = zip.file(/\.dbf$/i)[0];
    const prjFile = zip.file(/\.prj$/i)[0];
    const fc = await shapefile.read(await shp.async("arraybuffer"), dbf ? await dbf.async("arraybuffer") : undefined);
    let geoms = collect(fc);
    if (prjFile) {
      const wkt = await prjFile.async("string");
      if (!/GEOGCS/i.test(wkt) || /PROJCS/i.test(wkt)) {
        // projected shapefile: reproject to WGS84
        const tr = proj4(wkt, "EPSG:4326");
        const fix = (rings: Position[][]) => rings.map((r) => r.map((p) => tr.forward([p[0], p[1]])));
        geoms = geoms.map((g) => (g.type === "Polygon" ? { ...g, coordinates: fix(g.coordinates) } : { ...g, coordinates: g.coordinates.map(fix) }));
      }
    }
    geom = largest(geoms);
  } else if (lower.endsWith(".kml")) {
    geom = largest(parseKml(await file.text()));
  } else {
    geom = largest(collect(JSON.parse(await file.text())));
  }
  const [lon, lat] = geom.type === "Polygon" ? geom.coordinates[0][0] : geom.coordinates[0][0][0];
  if (Math.abs(lon) > 180 || Math.abs(lat) > 90) throw new Error("Coordinates are not longitude/latitude. Export the boundary in WGS84 (EPSG:4326).");
  return { feature: { type: "Feature", properties: { name }, geometry: geom }, name };
}
