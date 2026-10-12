"use client";

/**
 * Orchestrates an analysis run: picks the imagery source (with the fallback chain), runs the
 * worker, stores the result, logs anonymous analytics and tells the farmer what happened.
 */
import { toast } from "sonner";
import { kinks } from "@turf/turf";
import { useApp } from "@/store/app-store";
import { runInWorker } from "@/lib/worker/client";
import type { SourceRequest } from "@/lib/worker/protocol";
import { DEMO_CACHE_URL } from "@/lib/demo/demo-field";
import { areaAcresLngLat } from "@/lib/agronomy/geo";
import { logRun } from "@/lib/storage/repo";

export function validateField(): string | null {
  const { field } = useApp.getState();
  if (!field) return "Draw your field boundary first.";
  if (field.geometry.type === "Polygon" && kinks(field as GeoJSON.Feature<GeoJSON.Polygon>).features.length)
    return "The boundary crosses itself. Edit the corners so the edges don't cross.";
  const ac = areaAcresLngLat(field.geometry);
  if (ac < 1) return "The field is smaller than 1 acre. Satellite pixels (10 m) are too coarse for it.";
  if (ac > 5000) return "The field is larger than 5,000 acres. Split it into individual fields.";
  return null;
}

export async function runAnalysis(opts: { useBundled?: boolean } = {}) {
  const st = useApp.getState();
  const problem = validateField();
  if (problem || !st.field) {
    toast.error(problem ?? "No field");
    return;
  }
  let source: SourceRequest;
  if (st.source === "drone") {
    if (!st.drone) {
      toast.error("Choose a drone image first.");
      return;
    }
    // Copy the buffer: it is transferred (moved) to the worker.
    source = { kind: "drone", file: { name: st.drone.name, type: st.drone.type, buffer: st.drone.buffer.slice(0) } };
  } else if (st.isDemo && (opts.useBundled || !st.scene)) {
    source = { kind: "cached", cachedUrl: DEMO_CACHE_URL };
  } else {
    source = { kind: "auto", scene: st.scene, cachedUrl: st.isDemo ? DEMO_CACHE_URL : null, demoSceneId: null };
  }

  useApp.setState({ status: "running", progress: [{ step: "search", message: "Preparing analysis" }], error: null, brushZone: null, inspectedCell: null });
  const t0 = performance.now();
  try {
    const payload = await runInWorker(
      { type: "analyze", field: st.field.geometry, reference: st.reference?.geometry ?? null, settings: st.analysisSettings, source },
      (step, message) => useApp.setState((s) => ({ progress: [...s.progress, { step, message }] })),
    );
    useApp.setState((s) => ({
      analysis: payload,
      status: "done",
      step: "rates",
      generated: false,
      overrides: {},
      history: [],
      future: [],
      zoneFilter: [],
      valueRange: null,
      mapLayer: "zones",
      analysisVersion: s.analysisVersion + 1,
    }));
    if (payload.fallbackReason) toast.warning("Heads up", { description: payload.fallbackReason, duration: 9000 });
    else toast.success("Field checked", { description: `Found ${payload.zoning.zoneCount} zones.` });
    logRun({
      source: payload.scene.source,
      area_ac: payload.fieldAreaAc,
      zone_count: payload.zoning.zoneCount,
      cell_size_m: st.analysisSettings.cellSizeM,
      duration_ms: performance.now() - t0,
      success: true,
      is_demo: st.isDemo,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    useApp.setState({ status: "error", error: message });
    toast.error("Something went wrong", { description: message });
    logRun({ source: st.source === "drone" ? "drone" : "live", success: false, error: message, is_demo: st.isDemo });
  }
}

/** Re-grid / re-zone the already-loaded raster after zone settings change. */
export async function rezone() {
  const st = useApp.getState();
  if (!st.field || !st.analysis) return;
  const hadEdits = Object.keys(st.overrides).length > 0;
  useApp.setState({ status: "running", progress: [{ step: "grid", message: "Re-zoning with new settings" }] });
  try {
    const payload = await runInWorker({ type: "rezone", field: st.field.geometry, reference: st.reference?.geometry ?? null, settings: st.analysisSettings });
    useApp.setState((s) => ({
      analysis: payload,
      status: "done",
      overrides: {},
      history: [],
      future: [],
      inspectedCell: null,
      zoneFilter: [],
      valueRange: null,
      analysisVersion: s.analysisVersion + 1,
    }));
    if (hadEdits) toast.info("Zones recomputed", { description: "Your manual zone edits were cleared because the grid changed." });
  } catch (e) {
    useApp.setState({ status: "error", error: e instanceof Error ? e.message : String(e) });
  }
}
