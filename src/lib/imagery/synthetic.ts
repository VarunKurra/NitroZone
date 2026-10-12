/**
 * Synthetic raster: the LAST fallback when no real imagery can be loaded.
 *
 * It produces realistic-looking spatial patterns (smooth fractal noise for soil/vigor
 * variation, a lower-vigor drainage swale, and a few weak patches) so the full workflow can
 * be demonstrated anywhere. It is ALWAYS labeled "Synthetic" in the UI and in every export,
 * and the data-confidence score is forced to Low. It must never be used to apply fertilizer.
 */
import { boundsOf, makeProjector, mapPolys, polygonsOf, utmProjFor, centroidLngLat } from "@/lib/agronomy/geo";
import { seededRandom } from "@/lib/agronomy/kmeans";
import type { IndexRaster } from "@/lib/agronomy/types";
import type { MultiPolygon, Polygon } from "geojson";

/** Smooth value noise on a lattice, bilinear with smoothstep easing. */
function valueNoise(seed: number) {
  const rand = seededRandom(seed);
  const size = 64;
  const lattice = new Float32Array(size * size).map(() => rand());
  const at = (x: number, y: number) => lattice[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = smooth(x - xi);
    const ty = smooth(y - yi);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * tx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * tx;
    return a + (b - a) * ty;
  };
}

export function syntheticRaster(field: Polygon | MultiPolygon, seed = 1234): IndexRaster {
  const [lon, lat] = centroidLngLat(field);
  const crs = utmProjFor(lon, lat);
  const { toMetric } = makeProjector(crs);
  const [minX, minY, maxX, maxY] = boundsOf(mapPolys(polygonsOf(field), toMetric));
  const px = 10;
  const originX = Math.floor((minX - 30) / px) * px;
  const originY = Math.ceil((maxY + 30) / px) * px;
  const width = Math.ceil((maxX + 30 - originX) / px);
  const height = Math.ceil((originY - (minY - 30)) / px);
  const n1 = valueNoise(seed);
  const n2 = valueNoise(seed + 1);
  const n3 = valueNoise(seed + 2);
  const primary = new Float32Array(width * height);
  const secondary = new Float32Array(width * height);
  const rgba = new Uint8ClampedArray(width * height * 4);
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++) {
      const x = originX + (c + 0.5) * px;
      const y = originY - (r + 0.5) * px;
      const u = (x - minX) / w;
      const v = (y - minY) / h;
      // fractal noise: broad soil pattern + finer detail
      const f = 0.55 * n1(u * 3, v * 3) + 0.3 * n2(u * 7, v * 7) + 0.15 * n3(u * 15, v * 15);
      // a meandering swale (lower vigor, e.g. wet soil / N loss) running diagonally
      const swale = Math.exp(-(((v - 0.35 - 0.15 * Math.sin(u * 5)) / 0.07) ** 2));
      const vigor = Math.min(1, Math.max(0, 0.25 + 0.75 * f - 0.35 * swale));
      const i = r * width + c;
      primary[i] = 0.38 + 0.26 * vigor; // NDRE-like range 0.38 - 0.64
      secondary[i] = 0.66 + 0.22 * vigor; // NDVI-like range 0.66 - 0.88
      rgba[i * 4] = 70 - 30 * vigor;
      rgba[i * 4 + 1] = 95 + 40 * vigor;
      rgba[i * 4 + 2] = 50 - 10 * vigor;
      rgba[i * 4 + 3] = 255;
    }
  return {
    width,
    height,
    crs,
    originX,
    originY,
    pixelSize: px,
    primary,
    secondary,
    rgba,
    maskedPixels: 0,
    fieldPixels: width * height,
  };
}
