import { AlertTriangle, Database, Drone, FlaskConical, Satellite } from "lucide-react";
import type { SceneInfo } from "@/lib/agronomy/types";
import { cn } from "@/lib/utils";

const META = {
  live: { icon: Satellite, label: "Live Sentinel-2", cls: "bg-field-50 text-field-800 border-field-200" },
  cached: { icon: Database, label: "Sentinel-2 (bundled copy)", cls: "bg-river-50 text-river-700 border-river-100" },
  synthetic: { icon: FlaskConical, label: "Synthetic demo raster", cls: "bg-harvest-50 text-harvest-700 border-harvest-200" },
  drone: { icon: Drone, label: "Drone image (RGB)", cls: "bg-field-50 text-field-800 border-field-200" },
} as const;

/** Always-visible label of which imagery the numbers came from. */
export function SourceBadge({ scene, fallbackReason, clearFraction, compact }: { scene: SceneInfo; fallbackReason?: string | null; clearFraction?: number; compact?: boolean }) {
  const m = META[scene.source];
  const Icon = m.icon;
  const date = scene.acquired ? new Date(scene.acquired).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : null;
  if (compact)
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", m.cls)} data-testid="source-badge">
        <Icon className="size-3.5" /> {m.label}
        {date && <span className="opacity-70">· {date}</span>}
      </span>
    );
  return (
    <div className={cn("rounded-2xl border px-3.5 py-3", m.cls)} data-testid="source-badge">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4" /> {m.label}
      </div>
      <div className="mt-1 text-xs opacity-80 tabular">
        {[date && `Acquired ${date}`, scene.sceneCloudPct !== null && `${scene.sceneCloudPct.toFixed(1)}% scene cloud`, clearFraction !== undefined && `${Math.round(clearFraction * 100)}% of field clear`].filter(Boolean).join(" · ")}
      </div>
      {fallbackReason && (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium">
          <AlertTriangle className="mt-px size-3.5 shrink-0" /> {fallbackReason}
        </p>
      )}
      {scene.notes.map((n) => (
        <p key={n} className="mt-1.5 text-xs opacity-80">
          {n}
        </p>
      ))}
    </div>
  );
}
