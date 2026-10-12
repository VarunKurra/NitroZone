/**
 * Drone imagery (RGB). Supports:
 *   - GeoTIFF orthomosaics (georeferenced; any common CRS: WGS84, UTM, Web Mercator)
 *   - plain JPG / PNG (NOT georeferenced: stretched over the field's bounding box, with a
 *     warning, because we can't know where the photo's pixels are on the ground)
 *
 * Indices: VARI (primary) and ExG (secondary). RGB cameras have no near-infrared or
 * red-edge band, so these are weaker nitrogen indicators than Sentinel-2 NDRE; the UI says so.
 */
import { fromArrayBuffer } from "geotiff";
import { boundsOf, centroidLngLat, makeProjector, mapPolys, polygonsOf, projForEpsg, utmProjFor } from "@/lib/agronomy/geo";
import { exg, vari } from "@/lib/agronomy/indices";
import type { IndexRaster } from "@/lib/agronomy/types";
import proj4 from "proj4";
import type { MultiPolygon, Polygon } from "geojson";

export interface DecodedRgb {
  width: number;
  height: number;
  /** RGBA, row-major, row 0 = top/north. */
  data: Uint8ClampedArray;
  /** Source CRS + bbox [minX, minY, maxX, maxY] when georeferenced. */
  crs: string | null;
  bbox: [number, number, number, number] | null;
  notes: string[];
}

const MAX_SOURCE_PIXELS = 2_000_000;

export async function decodeGeoTiff(buffer: ArrayBuffer): Promise<DecodedRgb> {
  const tiff = await fromArrayBuffer(buffer);
  const img = await tiff.getImage();
  const notes: string[] = [];
  const keys = (img.getGeoKeys?.() ?? {}) as Record<string, number>;
  const epsg = keys.ProjectedCSTypeGeoKey ?? keys.GeographicTypeGeoKey ?? null;
  let crs: string | null = null;
  let bbox: [number, number, number, number] | null = null;
  try {
    if (epsg) {
      crs = projForEpsg(epsg);
      bbox = img.getBoundingBox() as [number, number, number, number];
    }
  } catch {
    notes.push(`GeoTIFF coordinate system EPSG:${epsg} is not supported; image stretched to field bounds.`);
    crs = null;
    bbox = null;
  }
  if (!crs) notes.push("GeoTIFF has no usable georeference; image stretched to field bounds.");

  const srcW = img.getWidth();
  const srcH = img.getHeight();
  const scale = Math.min(1, Math.sqrt(MAX_SOURCE_PIXELS / (srcW * srcH)));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));
  const bands = img.getSamplesPerPixel();
  if (bands < 3) throw new Error("Drone image must have red, green and blue bands.");
  const rasters = (await img.readRasters({ width, height, samples: bands >= 4 ? [0, 1, 2, 3] : [0, 1, 2], resampleMethod: "nearest" })) as unknown as ArrayLike<number>[];
  const bits = img.getBitsPerSample?.() ?? 8;
  const max = bits > 8 ? 2 ** bits - 1 : 255;
  const data = new Uint8ClampedArray(width * height * 4);
  const nodata = img.getGDALNoData?.();
  for (let i = 0; i < width * height; i++) {
    const r = rasters[0][i];
    const g = rasters[1][i];
    const b = rasters[2][i];
    data[i * 4] = (r / max) * 255;
    data[i * 4 + 1] = (g / max) * 255;
    data[i * 4 + 2] = (b / max) * 255;
    const alpha = bands >= 4 ? rasters[3][i] : 255;
    const isNoData = nodata !== null && nodata !== undefined && r === nodata && g === nodata && b === nodata;
    data[i * 4 + 3] = isNoData || alpha === 0 ? 0 : 255;
  }
  return { width, height, data, crs, bbox, notes };
}

/**
 * Resample decoded RGB onto a metric grid over the field and compute VARI / ExG.
 */
export function rgbToIndexRaster(src: DecodedRgb, field: Polygon | MultiPolygon): IndexRaster {
  const [lon, lat] = centroidLngLat(field);
  const crs = utmProjFor(lon, lat);
  const { toMetric, toLngLat } = makeProjector(crs);
  const fb = boundsOf(mapPolys(polygonsOf(field), toMetric));
  // Output pixel ~1 m, but never more than ~600 px across (keeps the worker fast).
  const extent = Math.max(fb[2] - fb[0], fb[3] - fb[1]);
  const px = Math.max(1, extent / 600);
  const originX = fb[0] - px;
  const originY = fb[3] + px;
  const width = Math.ceil((fb[2] - fb[0]) / px) + 2;
  const height = Math.ceil((fb[3] - fb[1]) / px) + 2;
  const toSrc = src.crs ? proj4("EPSG:4326", src.crs) : null;

  const primary = new Float32Array(width * height).fill(Number.NaN);
  const secondary = new Float32Array(width * height).fill(Number.NaN);
  const rgba = new Uint8ClampedArray(width * height * 4);
  let masked = 0;
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++) {
      const x = originX + (c + 0.5) * px;
      const y = originY - (r + 0.5) * px;
      let u: number;
      let v: number;
      if (toSrc && src.bbox) {
        const [sx, sy] = toSrc.forward(toLngLat([x, y]));
        u = (sx - src.bbox[0]) / (src.bbox[2] - src.bbox[0]);
        v = (src.bbox[3] - sy) / (src.bbox[3] - src.bbox[1]);
      } else {
        u = (x - fb[0]) / (fb[2] - fb[0]);
        v = (fb[3] - y) / (fb[3] - fb[1]);
      }
      const i = r * width + c;
      const sc = Math.floor(u * src.width);
      const sr = Math.floor(v * src.height);
      if (sc < 0 || sr < 0 || sc >= src.width || sr >= src.height) {
        masked++;
        continue;
      }
      const j = (sr * src.width + sc) * 4;
      if (src.data[j + 3] === 0) {
        masked++;
        continue;
      }
      const R = src.data[j];
      const G = src.data[j + 1];
      const B = src.data[j + 2];
      primary[i] = vari(R, G, B);
      secondary[i] = exg(R, G, B);
      rgba[i * 4] = R;
      rgba[i * 4 + 1] = G;
      rgba[i * 4 + 2] = B;
      rgba[i * 4 + 3] = 255;
    }
  return { width, height, crs, originX, originY, pixelSize: px, primary, secondary, rgba, maskedPixels: masked, fieldPixels: width * height };
}
