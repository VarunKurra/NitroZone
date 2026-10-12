/** Messages exchanged between the UI thread and the analysis Web Worker. */
import type { MultiPolygon, Polygon } from "geojson";
import type { AnalysisSettings, GridCell, SceneInfo, ZoningResult } from "@/lib/agronomy/types";
import type { StacScene } from "@/lib/imagery/sentinel";

export type SourceRequest =
  | { kind: "auto"; scene: StacScene | null; cachedUrl: string | null; demoSceneId: string | null }
  | { kind: "live"; scene: StacScene }
  | { kind: "cached"; cachedUrl: string }
  | { kind: "synthetic" }
  | { kind: "drone"; file: { name: string; type: string; buffer: ArrayBuffer } };

export interface AnalyzeRequest {
  type: "analyze";
  id: number;
  field: Polygon | MultiPolygon;
  reference: Polygon | MultiPolygon | null;
  settings: AnalysisSettings;
  source: SourceRequest;
}

/** Re-run gridding/zoning on the raster already loaded in the worker (no new download). */
export interface RezoneRequest {
  type: "rezone";
  id: number;
  field: Polygon | MultiPolygon;
  reference: Polygon | MultiPolygon | null;
  settings: AnalysisSettings;
}

export type WorkerRequest = AnalyzeRequest | RezoneRequest;

export type ProgressStep = "search" | "download" | "mask" | "indices" | "grid" | "zones";

/** Raster preview sent to the UI for map overlays (index heat map + true colour). */
export interface RasterPreview {
  width: number;
  height: number;
  primary: Float32Array;
  secondary: Float32Array;
  rgba: Uint8ClampedArray | null;
  /** Corner coordinates (lng/lat) clockwise from top-left, as MapLibre image sources expect. */
  corners: [[number, number], [number, number], [number, number], [number, number]];
}

export interface AnalysisPayload {
  scene: SceneInfo;
  cells: Omit<GridCell, "rings">[];
  cols: number;
  rows: number;
  lookup: Int32Array;
  zoning: ZoningResult;
  fieldAreaAc: number;
  clearFraction: number;
  preview: RasterPreview;
  /** If we fell back from live imagery, why. Shown to the farmer. */
  fallbackReason: string | null;
  durationMs: number;
}

export type WorkerResponse =
  | { type: "progress"; id: number; step: ProgressStep; message: string }
  | { type: "result"; id: number; payload: AnalysisPayload }
  | { type: "error"; id: number; message: string };
