/**
 * "Download everything" bundle: one ZIP with the shapefile (primary format for controllers),
 * GeoJSON, KML, both CSVs, the PDF report and a README.
 */
import JSZip from "jszip";
import { buildPdf, type PdfFonts } from "./pdf";
import { cellsCsv, fileStem, geojsonString, kmlString, readmeTxt, shapefileZip, zonesCsv, type ReportContext } from "./formats";

export async function buildBundle(ctx: ReportContext, fonts?: PdfFonts): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder(fileStem(ctx))!;
  // Shapefile: unpack the shapefile zip into a folder so controllers see the 4 files directly.
  const shp = await JSZip.loadAsync(await shapefileZip(ctx));
  const shpFolder = root.folder("shapefile")!;
  for (const [name, file] of Object.entries(shp.files)) {
    if (!file.dir) shpFolder.file(name.split("/").pop()!, await file.async("uint8array"));
  }
  root.file("prescription.geojson", geojsonString(ctx));
  root.file("prescription.kml", kmlString(ctx));
  root.file("prescription_cells.csv", cellsCsv(ctx));
  root.file("zone_summary.csv", zonesCsv(ctx));
  root.file("field_report.pdf", buildPdf(ctx, fonts).output("arraybuffer"));
  root.file("README.txt", readmeTxt(ctx));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
