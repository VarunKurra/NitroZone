/**
 * Export formats. All of them are generated from the same `ReportContext`, so the numbers
 * in the shapefile, GeoJSON, KML, CSV and PDF are identical to what is on screen.
 */
import shpwrite from "@mapbox/shp-write";
import type { Confidence, HealthScore } from "@/lib/agronomy/health";
import type { PrescriptionTotals, RateSettings, SceneInfo, ZoneSummary } from "@/lib/agronomy/types";
import { hexToKml, zoneColor, zoneLabel } from "@/lib/palette";
import { controllerFeatures, richFeatures, type ExportCell } from "./features";
import type { Feature, MultiPolygon, Polygon } from "geojson";

export interface ReportContext {
  fieldName: string;
  field: Feature<Polygon | MultiPolygon>;
  scene: SceneInfo;
  settings: RateSettings;
  zoneCount: number;
  cellSizeM: number;
  cells: ExportCell[];
  zones: ArrayLike<number>;
  rates: ArrayLike<number>;
  reference: { value: number; kind: "strip" | "virtual" };
  summaries: ZoneSummary[];
  totals: PrescriptionTotals;
  health: HealthScore;
  confidence: Confidence;
  generatedAt: Date;
  /** Optional plain-English insights (AI or rule-based) for the PDF. */
  insights?: string[];
  insightsSource?: "gemini" | "rules";
}

export function indexNames(scene: SceneInfo) {
  return scene.sensor === "sentinel2" ? { primary: "NDRE", secondary: "NDVI" } : { primary: "VARI", secondary: "ExG" };
}

export function fileStem(ctx: ReportContext): string {
  const slug = ctx.fieldName.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 40) || "field";
  return `NitroZone_${slug}_${ctx.generatedAt.toISOString().slice(0, 10)}`;
}

const input = (ctx: ReportContext) => ({
  cells: ctx.cells,
  zones: ctx.zones,
  rates: ctx.rates,
  reference: ctx.reference.value,
  sensor: ctx.scene.sensor,
});

/** Shapefile (.shp/.shx/.dbf/.prj) zipped. WGS84, attributes RATE_LBAC, ZONE, AREA_AC. */
export async function shapefileZip(ctx: ReportContext): Promise<ArrayBuffer> {
  const fc = controllerFeatures(input(ctx));
  const name = "nitrozone_rx";
  const out = await shpwrite.zip<"arraybuffer">(fc, {
    outputType: "arraybuffer",
    compression: "DEFLATE",
    types: { polygon: name },
  });
  return out as ArrayBuffer;
}

export function geojsonString(ctx: ReportContext): string {
  const fc = richFeatures(input(ctx));
  const names = indexNames(ctx.scene);
  return JSON.stringify(
    {
      ...fc,
      // Non-standard but harmless "metadata" member, useful for anyone opening the file.
      metadata: {
        generator: "NitroZone",
        field: ctx.fieldName,
        crs: "EPSG:4326 (WGS84 longitude/latitude)",
        imagery: { source: ctx.scene.source, provider: ctx.scene.provider, scene: ctx.scene.sceneId, acquired: ctx.scene.acquired },
        primaryIndex: names.primary,
        baseRateLbAc: ctx.settings.baseRate,
        pricePerLbN: ctx.settings.pricePerLbN,
        totals: ctx.totals,
        disclaimer: DISCLAIMER,
      },
    },
    null,
    0,
  );
}

export function kmlString(ctx: ReportContext): string {
  const fc = richFeatures(input(ctx));
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const styles = Array.from({ length: ctx.zoneCount }, (_, i) => {
    const z = i + 1;
    return `<Style id="zone${z}"><LineStyle><color>${hexToKml("#ffffff", 0x99)}</color><width>0.5</width></LineStyle><PolyStyle><color>${hexToKml(zoneColor(z, ctx.zoneCount), 0xbb)}</color></PolyStyle></Style>`;
  }).join("");
  const placemarks = fc.features
    .map((f) => {
      const p = f.properties;
      const ring = (r: number[][]) => r.map((c) => `${c[0]},${c[1]},0`).join(" ");
      const [outer, ...holes] = f.geometry.coordinates;
      return `<Placemark><name>Zone ${p.ZONE} - ${p.RATE_LBAC} lb N/ac</name><styleUrl>#zone${p.ZONE}</styleUrl><ExtendedData>${Object.entries(p)
        .map(([k, v]) => `<Data name="${k}"><value>${esc(String(v))}</value></Data>`)
        .join("")}</ExtendedData><Polygon><outerBoundaryIs><LinearRing><coordinates>${ring(outer)}</coordinates></LinearRing></outerBoundaryIs>${holes
        .map((h) => `<innerBoundaryIs><LinearRing><coordinates>${ring(h)}</coordinates></LinearRing></innerBoundaryIs>`)
        .join("")}</Polygon></Placemark>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(
    `NitroZone prescription - ${ctx.fieldName}`,
  )}</name><description>${esc(DISCLAIMER)}</description>${styles}<Folder><name>Prescription cells</name>${placemarks}</Folder></Document></kml>`;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v)) ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per prescription cell. */
export function cellsCsv(ctx: ReportContext): string {
  const names = indexNames(ctx.scene);
  const header = ["cell_id", "zone", "rate_lb_n_per_ac", "area_ac", "total_lb_n", names.primary.toLowerCase(), names.secondary.toLowerCase(), "sufficiency_index", "lon", "lat", "estimated"];
  const rows = ctx.cells.map((c, i) => [
    c.id,
    ctx.zones[i],
    round(ctx.rates[i], 2),
    round(c.areaAc, 4),
    round(ctx.rates[i] * c.areaAc, 2),
    round(c.primary, 4),
    round(c.secondary, 4),
    round(ctx.reference.value > 0 ? c.primary / ctx.reference.value : Number.NaN, 4),
    c.center[0],
    c.center[1],
    c.filled ? "yes" : "no",
  ]);
  return [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";
}

/** One row per zone plus a totals row. */
export function zonesCsv(ctx: ReportContext): string {
  const names = indexNames(ctx.scene);
  const header = ["zone", "description", "area_ac", `mean_${names.primary.toLowerCase()}`, "sufficiency_index", "adjustment_pct", "rate_lb_n_per_ac", "total_lb_n", "flat_rate_lb_n", "saved_lb_n", "saved_usd_estimate"];
  const rows = ctx.summaries.map((z) => [
    z.zone,
    zoneLabel(z.zone, ctx.zoneCount),
    round(z.areaAc, 2),
    round(z.primary, 4),
    round(z.sufficiency, 3),
    round(z.adjustment * 100, 1),
    round(z.rateLbAc, 1),
    round(z.totalLbN, 1),
    round(z.flatLbN, 1),
    round(z.savedLbN, 1),
    round(z.savedUsd, 2),
  ]);
  const t = ctx.totals;
  rows.push(["total", "", round(t.areaAc, 2), "", "", "", round(t.avgRateLbAc, 1), round(t.variableLbN, 1), round(t.flatLbN, 1), round(t.savedLbN, 1), round(t.savedUsd, 2)]);
  return [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";
}

function round(v: number, d: number) {
  if (!Number.isFinite(v)) return Number.NaN;
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

export const DISCLAIMER =
  "Estimated prescription. Vegetation indices (NDRE/NDVI or VARI/ExG) are a proxy for crop stress, not a direct measurement of nitrogen. " +
  "Low vigor can also be caused by water stress, disease, compaction or poor stand. Review zones in the field, follow University of Missouri " +
  "Extension guidance and your agronomist's advice, and check rates against your applicator's range before applying. Savings are estimates of fertilizer cost only.";

export function readmeTxt(ctx: ReportContext): string {
  const names = indexNames(ctx.scene);
  return [
    `NitroZone variable-rate nitrogen prescription`,
    `Field: ${ctx.fieldName}`,
    `Generated: ${ctx.generatedAt.toISOString()}`,
    `Imagery: ${ctx.scene.provider}${ctx.scene.acquired ? `, acquired ${ctx.scene.acquired.slice(0, 10)}` : ""} (source: ${ctx.scene.source})`,
    ``,
    `FILES`,
    `  shapefile/nitrozone_rx.*   Load into your rate controller (WGS84, EPSG:4326).`,
    `                             Attributes: ZONE, RATE_LBAC (lb N/acre), AREA_AC (acres)`,
    `  prescription.geojson       Same cells with ${names.primary}, ${names.secondary}, sufficiency index`,
    `  prescription.kml           Google Earth`,
    `  prescription_cells.csv     One row per grid cell`,
    `  zone_summary.csv           One row per zone + totals`,
    `  field_report.pdf           One-page report`,
    ``,
    `FORMULAS`,
    `  zone rate = base rate x (1 + zone adjustment)  [base ${ctx.settings.baseRate} lb N/ac]`,
    `  savings   = (flat total lb - variable total lb) x N price  [$${ctx.settings.pricePerLbN.toFixed(2)}/lb N]`,
    ``,
    DISCLAIMER,
    ``,
  ].join("\n");
}
