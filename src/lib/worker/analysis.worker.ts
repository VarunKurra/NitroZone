/// <reference lib="webworker" />
/**
 * Analysis Web Worker. All heavy work (downloading/decoding imagery, per-pixel math,
 * gridding, k-means) runs here so the map and UI stay smooth at 60 fps.
 *
 * Imagery fallback chain for "auto":
 *   live Sentinel-2 scene  ->  bundled cached scene (demo field only)  ->  synthetic raster
 * The source actually used is always reported back and shown in the UI.
 */
import { analyzeRaster } from "@/lib/agronomy/pipeline";
import { makeProjector } from "@/lib/agronomy/geo";
import type { IndexRaster, SceneInfo } from "@/lib/agronomy/types";
import { loadCachedScene } from "@/lib/imagery/cached";
import { decodeGeoTiff, rgbToIndexRaster, type DecodedRgb } from "@/lib/imagery/drone";
import { bandsToIndexRaster, readSceneBands, type RawS2Bands } from "@/lib/imagery/sentinel";
import { syntheticRaster } from "@/lib/imagery/synthetic";
import type { AnalysisPayload, AnalyzeRequest, ProgressStep, RasterPreview, WorkerRequest, WorkerResponse } from "./protocol";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const LIVE_TIMEOUT_MS = 25_000;

let lastRaster: IndexRaster | null = null;
let lastScene: SceneInfo | null = null;
let lastFallback: string | null = null;

function post(msg: WorkerResponse, transfer: Transferable[] = []) {
  ctx.postMessage(msg, transfer);
}

ctx.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  const progress = (step: ProgressStep, message: string) => post({ type: "progress", id: req.id, step, message });
  const t0 = performance.now();
  try {
    if (req.type === "analyze") {
      const { raster, scene, fallbackReason } = await loadRaster(req, progress);
      lastRaster = raster;
      lastScene = scene;
      lastFallback = fallbackReason;
    }
    if (!lastRaster || !lastScene) throw new Error("No imagery loaded yet.");
    progress("grid", "Building the prescription grid");
    const out = analyzeRaster(lastRaster, req.field, req.settings, req.reference);
    progress("zones", "Clustering management zones");
    const preview = makePreview(lastRaster);
    const payload: AnalysisPayload = {
      scene: lastScene,
      // metric rings stay in the worker: the UI only needs lon/lat
      cells: out.cells.map((c) => {
        const { rings, ...rest } = c;
        void rings;
        return rest;
      }),
      cols: out.cols,
      rows: out.rows,
      lookup: out.lookup,
      zoning: out.zoning,
      fieldAreaAc: out.fieldAreaAc,
      clearFraction: out.clearFraction,
      preview,
      fallbackReason: lastFallback,
      durationMs: performance.now() - t0,
    };
    post({ type: "result", id: req.id, payload });
  } catch (err) {
    post({ type: "error", id: req.id, message: err instanceof Error ? err.message : String(err) });
  }
};

async function loadRaster(
  req: AnalyzeRequest,
  progress: (s: ProgressStep, m: string) => void,
): Promise<{ raster: IndexRaster; scene: SceneInfo; fallbackReason: string | null }> {
  const src = req.source;

  const fromBands = (raw: RawS2Bands, source: "live" | "cached"): { raster: IndexRaster; scene: SceneInfo } => {
    progress("mask", "Masking clouds and shadows (SCL)");
    progress("indices", "Computing NDRE and NDVI");
    return {
      raster: bandsToIndexRaster(raw),
      scene: {
        source,
        sensor: "sentinel2",
        sceneId: raw.sceneId,
        acquired: raw.datetime,
        sceneCloudPct: raw.cloudCover,
        resolutionM: 10,
        provider: "Sentinel-2 L2A (ESA Copernicus) via Microsoft Planetary Computer",
        notes: [],
      },
    };
  };

  const live = async (scene: NonNullable<Extract<typeof src, { kind: "live" }>["scene"]>) => {
    progress("download", `Downloading bands B4, B5, B8 + SCL for ${scene.datetime.slice(0, 10)}`);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS);
    try {
      const raw = await readSceneBands(scene, req.field, ctrl.signal);
      return fromBands(raw, "live");
    } finally {
      clearTimeout(timer);
    }
  };

  const cached = async (url: string) => {
    progress("download", "Loading the bundled Sentinel-2 scene");
    return fromBands(await loadCachedScene(url), "cached");
  };

  const synthetic = () => {
    progress("indices", "Generating a synthetic demonstration raster");
    return {
      raster: syntheticRaster(req.field),
      scene: {
        source: "synthetic" as const,
        sensor: "sentinel2" as const,
        sceneId: null,
        acquired: null,
        sceneCloudPct: null,
        resolutionM: 10,
        provider: "Synthetic raster (demonstration only, not real imagery)",
        notes: ["Do not apply fertilizer from a synthetic prescription."],
      },
    };
  };

  switch (src.kind) {
    case "live":
      return { ...(await live(src.scene)), fallbackReason: null };
    case "cached":
      return { ...(await cached(src.cachedUrl)), fallbackReason: null };
    case "synthetic":
      return { ...synthetic(), fallbackReason: null };
    case "drone": {
      progress("download", `Reading ${src.file.name}`);
      const decoded = await decodeDrone(src.file);
      progress("indices", "Computing VARI and ExG from RGB");
      const raster = rgbToIndexRaster(decoded, req.field);
      return {
        raster,
        scene: {
          source: "drone",
          sensor: "drone-rgb",
          sceneId: src.file.name,
          acquired: null,
          sceneCloudPct: null,
          resolutionM: raster.pixelSize,
          provider: "Uploaded drone image (RGB)",
          notes: decoded.notes,
        },
        fallbackReason: null,
      };
    }
    case "auto": {
      const reasons: string[] = [];
      // A pinned demo scene that is also bundled: prefer the bundled copy when live fails.
      if (src.scene) {
        try {
          return { ...(await live(src.scene)), fallbackReason: null };
        } catch (e) {
          reasons.push(e instanceof Error && e.name === "AbortError" ? "The satellite service was too slow" : "The satellite service couldn't be reached");
        }
      } else reasons.push("No clear satellite photo was found");
      if (src.cachedUrl) {
        try {
          return { ...(await cached(src.cachedUrl)), fallbackReason: `${reasons.join(". ")}, so we used the saved copy of the photo.` };
        } catch {
          reasons.push("the saved photo didn't load");
        }
      }
      return { ...synthetic(), fallbackReason: `${reasons.join(". ")}. Showing practice data so you can try the app. Don't use this plan in a real field.` };
    }
  }
}

async function decodeDrone(file: { name: string; type: string; buffer: ArrayBuffer }): Promise<DecodedRgb> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".tif") || lower.endsWith(".tiff") || file.type === "image/tiff") return decodeGeoTiff(file.buffer);
  // Plain photo: decode with the browser's image decoder.
  const bitmap = await createImageBitmap(new Blob([file.buffer], { type: file.type || "image/jpeg" }));
  const scale = Math.min(1, Math.sqrt(2_000_000 / (bitmap.width * bitmap.height)));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Could not decode image in this browser.");
  g.drawImage(bitmap, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h).data;
  return {
    width: w,
    height: h,
    data,
    crs: null,
    bbox: null,
    notes: ["Photo is not georeferenced: it was stretched over the field's bounding box (north up). Use a GeoTIFF orthomosaic for accurate placement."],
  };
}

function makePreview(r: IndexRaster): RasterPreview {
  const { toLngLat } = makeProjector(r.crs);
  const x0 = r.originX;
  const y0 = r.originY;
  const x1 = r.originX + r.width * r.pixelSize;
  const y1 = r.originY - r.height * r.pixelSize;
  return {
    width: r.width,
    height: r.height,
    primary: r.primary.slice(),
    secondary: r.secondary.slice(),
    rgba: r.rgba ? r.rgba.slice() : null,
    corners: [toLngLat([x0, y0]), toLngLat([x1, y0]), toLngLat([x1, y1]), toLngLat([x0, y1])],
  };
}
