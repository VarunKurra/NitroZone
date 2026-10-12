/**
 * Round-trip tests: write every export format, read it back with an independent parser,
 * and check the geometry, attributes and totals survive unchanged.
 */
import JSZip from "jszip";
import * as shapefile from "shapefile";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { cellsCsv, geojsonString, kmlString, shapefileZip, zonesCsv } from "@/lib/export/formats";
import { buildPdf } from "@/lib/export/pdf";
import { buildBundle } from "@/lib/export/bundle";
import { areaAcresLngLat } from "@/lib/agronomy/geo";
import { demoContext } from "./helpers";

const ctx = demoContext();

describe("shapefile export", () => {
  it("contains .shp/.shx/.dbf/.prj with WGS84 and the required attributes", async () => {
    const zip = await JSZip.loadAsync(await shapefileZip(ctx));
    const names = Object.keys(zip.files).map((n) => n.split("/").pop());
    expect(names).toEqual(expect.arrayContaining(["nitrozone_rx.shp", "nitrozone_rx.shx", "nitrozone_rx.dbf", "nitrozone_rx.prj"]));
    const prj = await zip.file(/nitrozone_rx\.prj$/)[0].async("string");
    expect(prj).toContain("WGS_1984");

    const shp = await zip.file(/nitrozone_rx\.shp$/)[0].async("arraybuffer");
    const dbf = await zip.file(/nitrozone_rx\.dbf$/)[0].async("arraybuffer");
    const fc = await shapefile.read(shp, dbf);
    expect(fc.features.length).toBeGreaterThanOrEqual(ctx.cells.length);

    let area = 0;
    let lbs = 0;
    for (const f of fc.features) {
      const p = f.properties as { ZONE: number; RATE_LBAC: number; AREA_AC: number };
      expect(Object.keys(p).sort()).toEqual(["AREA_AC", "RATE_LBAC", "ZONE"]);
      expect(p.ZONE).toBeGreaterThanOrEqual(1);
      expect(p.ZONE).toBeLessThanOrEqual(ctx.zoneCount);
      expect(p.RATE_LBAC).toBeCloseTo(ctx.summaries[p.ZONE - 1].rateLbAc, 1);
      area += p.AREA_AC;
      lbs += p.AREA_AC * p.RATE_LBAC;
      // coordinates are lon/lat in Missouri
      const [lon, lat] = (f.geometry as GeoJSON.Polygon).coordinates[0][0];
      expect(lon).toBeGreaterThan(-92);
      expect(lon).toBeLessThan(-91);
      expect(lat).toBeGreaterThan(39);
      expect(lat).toBeLessThan(40);
    }
    expect(area).toBeCloseTo(ctx.totals.areaAc, 0);
    expect(Math.abs(lbs - ctx.totals.variableLbN) / ctx.totals.variableLbN).toBeLessThan(0.002);

    // geometry area read back matches the attribute
    const geomArea = fc.features.reduce((s, f) => s + areaAcresLngLat(f.geometry as GeoJSON.Polygon), 0);
    expect(Math.abs(geomArea - ctx.totals.areaAc) / ctx.totals.areaAc).toBeLessThan(0.005);
  });
});

describe("GeoJSON export", () => {
  it("round-trips with totals and metadata", () => {
    const gj = JSON.parse(geojsonString(ctx));
    expect(gj.type).toBe("FeatureCollection");
    const ids = new Set(gj.features.map((f: { properties: { CELL_ID: number } }) => f.properties.CELL_ID));
    expect(ids.size).toBe(ctx.cells.length);
    expect(gj.metadata.totals.variableLbN).toBeCloseTo(ctx.totals.variableLbN, 3);
    expect(gj.features[0].properties).toHaveProperty("NDRE");
  });
});

describe("KML export", () => {
  it("is valid XML with one styled placemark per polygon", () => {
    const xml = kmlString(ctx);
    const dom = new JSDOM(xml, { contentType: "text/xml" });
    const doc = dom.window.document;
    expect(doc.getElementsByTagName("parsererror").length).toBe(0);
    expect(doc.getElementsByTagName("Style").length).toBe(ctx.zoneCount);
    expect(doc.getElementsByTagName("Placemark").length).toBeGreaterThanOrEqual(ctx.cells.length);
  });
});

describe("CSV export", () => {
  it("cells CSV has one row per cell and sums to the variable total", () => {
    const lines = cellsCsv(ctx).trim().split("\n");
    expect(lines.length).toBe(ctx.cells.length + 1);
    const header = lines[0].split(",");
    const iTotal = header.indexOf("total_lb_n");
    const sum = lines.slice(1).reduce((s, l) => s + Number(l.split(",")[iTotal]), 0);
    expect(Math.abs(sum - ctx.totals.variableLbN)).toBeLessThan(ctx.cells.length * 0.01);
  });
  it("zones CSV ends with a totals row matching the summary", () => {
    const lines = zonesCsv(ctx).trim().split("\n");
    expect(lines.length).toBe(ctx.zoneCount + 2);
    const total = lines[lines.length - 1].split(",");
    expect(total[0]).toBe("total");
    expect(Number(total[9])).toBeCloseTo(ctx.totals.savedLbN, 0);
  });
});

describe("PDF report", () => {
  it("is a one-page PDF with key text", () => {
    const doc = buildPdf(ctx);
    expect(doc.getNumberOfPages()).toBe(1);
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    const raw = doc.output();
    expect(raw).toContain("Zones and rates");
    expect(raw).toContain("Estimated N cost savings");
  });
});

describe("bundle", () => {
  it("contains every file", async () => {
    const blob = await buildBundle(ctx);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).map((n) => n.split("/").slice(1).join("/"));
    expect(names.sort()).toEqual(
      [
        "README.txt",
        "field_report.pdf",
        "prescription.geojson",
        "prescription.kml",
        "prescription_cells.csv",
        "shapefile/nitrozone_rx.dbf",
        "shapefile/nitrozone_rx.prj",
        "shapefile/nitrozone_rx.shp",
        "shapefile/nitrozone_rx.shx",
        "zone_summary.csv",
      ].sort(),
    );
  });
});
