/**
 * Render analysis rasters (NDRE/NDVI heat maps, true colour) into PNG data URLs that
 * MapLibre can drape over the satellite basemap as an image source.
 */
import { INDEX_RAMP, rampColor } from "@/lib/palette";
import { percentile } from "@/lib/agronomy/indices";
import type { RasterPreview } from "@/lib/worker/protocol";

export interface RampRange {
  min: number;
  max: number;
}

/** Robust colour stretch: 2nd-98th percentile, so a few odd pixels don't wash out the map. */
export function stretchOf(values: Float32Array): RampRange {
  const min = percentile(values, 2);
  const max = percentile(values, 98);
  return { min, max: max > min ? max : min + 1e-3 };
}

export function indexImage(preview: RasterPreview, which: "primary" | "secondary", range: RampRange, mask?: (i: number) => boolean): string {
  const { width, height } = preview;
  const values = preview[which];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d")!;
  const img = g.createImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    const v = values[i];
    if (!Number.isFinite(v) || (mask && !mask(i))) continue;
    const [r, gg, b] = rampColor(INDEX_RAMP, (v - range.min) / (range.max - range.min));
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = gg;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 235;
  }
  g.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export function trueColorImage(preview: RasterPreview): string | null {
  if (!preview.rgba) return null;
  const canvas = document.createElement("canvas");
  canvas.width = preview.width;
  canvas.height = preview.height;
  const g = canvas.getContext("2d")!;
  const img = g.createImageData(preview.width, preview.height);
  // Gentle brightness/contrast stretch: L2A true colour is dark straight out of the TCI.
  for (let i = 0; i < preview.rgba.length; i += 4) {
    for (let k = 0; k < 3; k++) img.data[i + k] = Math.min(255, preview.rgba[i + k] * 1.35 + 6);
    img.data[i + 3] = preview.rgba[i + 3];
  }
  g.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}
