"use client";

/**
 * Global workspace state (zustand). Holds the farmer's inputs and the analysis output.
 * Everything numeric that is DERIVED (rates, totals, health...) is not stored here; it is
 * recomputed from this state by `usePrescription()` so it can never go stale.
 */
import { create } from "zustand";
import type { FieldPolygon, AnalysisSettings, RateSettings } from "@/lib/agronomy/types";
import { DEFAULT_ANALYSIS_SETTINGS } from "@/lib/agronomy/pipeline";
import { DEFAULT_ADJUSTMENTS, DEFAULT_RATE_SETTINGS } from "@/lib/agronomy/rates";
import type { AnalysisPayload, ProgressStep } from "@/lib/worker/protocol";
import type { StacScene } from "@/lib/imagery/sentinel";

export type Step = "field" | "imagery" | "rates" | "results";
export type MapLayer = "zones" | "primary" | "secondary" | "rate" | "truecolor";
export type SourceChoice = "satellite" | "drone";
export type DrawMode = "idle" | "pan" | "draw-field" | "edit-field" | "draw-strip";

export interface DroneFile {
  name: string;
  type: string;
  size: number;
  buffer: ArrayBuffer;
}

interface State {
  step: Step;
  presentation: boolean;

  // --- field ---
  field: FieldPolygon | null;
  fieldName: string;
  isDemo: boolean;
  savedFieldId: string | null;
  drawMode: DrawMode;
  reference: FieldPolygon | null;

  // --- imagery ---
  source: SourceChoice;
  scene: StacScene | null;
  drone: DroneFile | null;
  analysisSettings: AnalysisSettings;

  // --- analysis ---
  status: "idle" | "running" | "done" | "error";
  progress: { step: ProgressStep; message: string }[];
  error: string | null;
  analysis: AnalysisPayload | null;
  /** Bumps every time a NEW analysis lands, so the map can replay its reveal. */
  analysisVersion: number;

  // --- rates + edits ---
  rateSettings: RateSettings;
  overrides: Record<number, number>;
  history: Record<number, number>[];
  future: Record<number, number>[];
  generated: boolean;

  // --- results UI ---
  mapLayer: MapLayer;
  zoneFilter: number[]; // empty = all
  inspectedCell: number | null;
  hoveredCell: number | null;
  brushZone: number | null; // non-null = zone painting mode
  /** Drill-in from the histogram: only cells whose index value is in [min, max] stay highlighted. */
  valueRange: { key: "primary" | "secondary"; min: number; max: number } | null;

  set: (patch: Partial<State>) => void;
  setField: (f: FieldPolygon | null, opts?: { name?: string; isDemo?: boolean; savedFieldId?: string | null }) => void;
  setAnalysisSettings: (patch: Partial<AnalysisSettings>) => void;
  setRateSettings: (patch: Partial<RateSettings>) => void;
  setAdjustment: (zone: number, value: number) => void;
  paintCells: (ids: number[], zone: number) => void;
  undo: () => void;
  redo: () => void;
  resetEdits: () => void;
  toggleZoneFilter: (zone: number) => void;
  resetAnalysis: () => void;
}

const initialResults = {
  status: "idle" as const,
  progress: [],
  error: null,
  analysis: null,
  overrides: {},
  history: [],
  future: [],
  generated: false,
  zoneFilter: [],
  inspectedCell: null,
  hoveredCell: null,
  brushZone: null,
  valueRange: null,
};

export const useApp = create<State>((set, get) => ({
  step: "field",
  presentation: false,
  field: null,
  fieldName: "My field",
  isDemo: false,
  savedFieldId: null,
  drawMode: "idle",
  reference: null,
  source: "satellite",
  scene: null,
  drone: null,
  analysisSettings: DEFAULT_ANALYSIS_SETTINGS,
  rateSettings: DEFAULT_RATE_SETTINGS,
  analysisVersion: 0,
  mapLayer: "zones",
  ...initialResults,

  set: (patch) => set(patch),

  setField: (f, opts = {}) =>
    set({
      field: f,
      fieldName: opts.name ?? get().fieldName,
      isDemo: opts.isDemo ?? false,
      savedFieldId: opts.savedFieldId ?? null,
      reference: null,
      scene: null,
      ...initialResults,
    }),

  setAnalysisSettings: (patch) => {
    const next = { ...get().analysisSettings, ...patch };
    const rs = get().rateSettings;
    // Changing the number of zones resets per-zone adjustments to that count's defaults.
    const rateSettings =
      patch.zoneCount && patch.zoneCount !== get().analysisSettings.zoneCount
        ? { ...rs, adjustments: [...DEFAULT_ADJUSTMENTS[patch.zoneCount]] }
        : rs;
    set({ analysisSettings: next, rateSettings });
  },

  setRateSettings: (patch) => set({ rateSettings: { ...get().rateSettings, ...patch } }),

  setAdjustment: (zone, value) => {
    const adjustments = [...get().rateSettings.adjustments];
    adjustments[zone - 1] = value;
    set({ rateSettings: { ...get().rateSettings, adjustments } });
  },

  paintCells: (ids, zone) => {
    const { overrides, history, analysis } = get();
    if (!analysis) return;
    const next = { ...overrides };
    let changed = false;
    for (const id of ids) {
      const base = analysis.zoning.zoneOfCell[id];
      const current = next[id] ?? base;
      if (current === zone) continue;
      changed = true;
      if (zone === base) delete next[id];
      else next[id] = zone;
    }
    if (!changed) return;
    set({ overrides: next, history: [...history.slice(-49), overrides], future: [] });
  },

  undo: () => {
    const { history, overrides, future } = get();
    if (!history.length) return;
    set({ overrides: history[history.length - 1], history: history.slice(0, -1), future: [overrides, ...future] });
  },
  redo: () => {
    const { history, overrides, future } = get();
    if (!future.length) return;
    set({ overrides: future[0], future: future.slice(1), history: [...history, overrides] });
  },
  resetEdits: () => {
    const { overrides, history } = get();
    if (!Object.keys(overrides).length) return;
    set({ overrides: {}, history: [...history, overrides], future: [] });
  },

  toggleZoneFilter: (zone) => {
    const f = get().zoneFilter;
    set({ zoneFilter: f.includes(zone) ? f.filter((z) => z !== zone) : [...f, zone].sort() });
  },

  resetAnalysis: () => set({ ...initialResults }),
}));
