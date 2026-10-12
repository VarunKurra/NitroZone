"use client";

import { Brush, Layers, MapPin, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { usePrescription } from "@/hooks/use-prescription";
import { useApp, type MapLayer } from "@/store/app-store";
import { INDEX_RAMP, RATE_RAMP, zoneColor, zoneLabel } from "@/lib/palette";
import { percentile } from "@/lib/agronomy/indices";
import { cn } from "@/lib/utils";

/** Layer switcher (top-left of the map). */
export function LayerSwitcher() {
  const layer = useApp((s) => s.mapLayer);
  const analysis = useApp((s) => s.analysis);
  const rx = usePrescription();
  if (!analysis || !rx) return null;
  const opts: { v: MapLayer; label: string; disabled?: boolean }[] = [
    { v: "zones", label: "Zones" },
    { v: "rate", label: "Fertilizer" },
    { v: "primary", label: "Crop health" },
    { v: "truecolor", label: "True color", disabled: !analysis.preview.rgba },
  ];
  return (
    <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-xl p-1 shadow-[var(--shadow-float)] ring-1 ring-black/5" role="radiogroup" aria-label="Map layer">
      <Layers className="mx-1.5 size-4 text-muted-foreground" aria-hidden />
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={layer === o.v}
          disabled={o.disabled}
          onClick={() => useApp.setState({ mapLayer: o.v })}
          className={cn("relative h-8 rounded-lg px-2.5 text-[0.8rem] font-medium transition disabled:opacity-40", layer === o.v ? "text-white" : "text-foreground/80 hover:bg-black/5")}
          data-testid={`layer-${o.v}`}
        >
          {layer === o.v && <motion.span layoutId="layer-pill" className="absolute inset-0 rounded-lg bg-field-800" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Legend (bottom-left of the map), matches the active layer. */
export function MapLegend() {
  const layer = useApp((s) => s.mapLayer);
  const analysis = useApp((s) => s.analysis);
  const rx = usePrescription();
  const ranges = useMemo(() => {
    if (!analysis) return null;
    return {
      primary: [percentile(analysis.preview.primary, 2), percentile(analysis.preview.primary, 98)],
      secondary: [percentile(analysis.preview.secondary, 2), percentile(analysis.preview.secondary, 98)],
    };
  }, [analysis]);
  if (!analysis || !rx || !ranges) return null;
  const zc = analysis.zoning.zoneCount;
  const box = "glass pointer-events-auto rounded-xl px-3 py-2.5 shadow-[var(--shadow-float)] ring-1 ring-black/5";
  if (layer === "zones")
    return (
      <div className={box} aria-label="Zone legend">
        <div className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Zone · lb/acre</div>
        <ul className="space-y-1">
          {rx.summaries.map((z) => (
            <li key={z.zone} className="flex items-center gap-2 text-xs">
              <span className="size-3 rounded-[4px]" style={{ background: zoneColor(z.zone, zc) }} />
              <span className="font-semibold">Z{z.zone}</span>
              <span className="text-muted-foreground">{zoneLabel(z.zone, zc)}</span>
              <span className="ml-auto pl-3 font-semibold tabular">{z.rateLbAc.toFixed(0)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  if (layer === "truecolor")
    return (
      <div className={box}>
        <div className="text-xs font-medium">Satellite photo</div>
      </div>
    );
  const isRate = layer === "rate";
  const lo = isRate ? Math.min(...rx.rates) : ranges[layer as "primary" | "secondary"][0];
  const hi = isRate ? Math.max(...rx.rates) : ranges[layer as "primary" | "secondary"][1];
  const ramp = isRate ? RATE_RAMP : INDEX_RAMP;
  const name = isRate ? "Fertilizer (lb/acre)" : "Crop health";
  return (
    <div className={cn(box, "w-56")}>
      <div className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{name}</div>
      <div className="h-2.5 rounded-full" style={{ background: `linear-gradient(90deg, ${ramp.join(",")})` }} />
      <div className="mt-1 flex justify-between text-[0.7rem] font-medium tabular">
        <span>{isRate ? lo.toFixed(0) : lo.toFixed(2)}</span>
        <span className="text-muted-foreground">{isRate ? "more →" : "healthier →"}</span>
        <span>{isRate ? hi.toFixed(0) : hi.toFixed(2)}</span>
      </div>
    </div>
  );
}

/** Floating card with everything about one grid cell. */
export function CellInspector() {
  const id = useApp((s) => s.inspectedCell);
  const analysis = useApp((s) => s.analysis);
  const rx = usePrescription();
  const cell = id !== null && analysis ? analysis.cells[id] : null;
  const zc = analysis?.zoning.zoneCount ?? 4;
  return (
    <AnimatePresence>
      {cell && rx && id !== null && (
        <motion.div
          key="inspector"
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
          transition={{ type: "spring", bounce: 0.12, duration: 0.4 }}
          className="pointer-events-auto w-72 rounded-2xl bg-white p-4 shadow-[var(--shadow-float)] ring-1 ring-black/5"
          role="dialog"
          aria-label={`Grid cell ${cell.id}`}
          data-testid="cell-inspector"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">This spot</div>
              <div className="mt-1 flex items-center gap-2 font-display text-lg font-semibold">
                <span className="size-3.5 rounded-[4px]" style={{ background: zoneColor(rx.zones[id], zc) }} />
                Zone {rx.zones[id]}
                {analysis && rx.zones[id] !== analysis.zoning.zoneOfCell[id] && <span className="rounded-md bg-harvest-50 px-1.5 py-0.5 text-[0.65rem] font-semibold text-harvest-700">edited</span>}
              </div>
            </div>
            <Button size="icon-sm" variant="ghost" onClick={() => useApp.setState({ inspectedCell: null })} aria-label="Close cell details">
              <X />
            </Button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Item k="Fertilizer" v={`${rx.rates[id].toFixed(0)} lb/acre`} strong />
            <Item k="Crop health" v={`${Math.round((cell.primary / rx.reference.value) * 100)}%`} />
            <Item k="Size" v={`${cell.areaAc.toFixed(2)} acres`} />
            <Item k="Under cloud?" v={cell.filled ? "Yes, estimated" : "No"} />
          </dl>
          <div className="mt-3 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
            <MapPin className="size-3" />
            <span className="tabular">
              {cell.center[1].toFixed(5)}, {cell.center[0].toFixed(5)}
            </span>
          </div>
          <div className="mt-3 border-t pt-3">
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Change zone</div>
            <div className="flex gap-1.5">
              {Array.from({ length: zc }, (_, i) => i + 1).map((z) => (
                <button
                  key={z}
                  type="button"
                  disabled={rx.zones[id] === z}
                  onClick={() => useApp.getState().paintCells([id], z)}
                  className="h-8 flex-1 rounded-lg text-xs font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-30"
                  style={{ background: zoneColor(z, zc) }}
                  aria-label={`Move cell to zone ${z}`}
                >
                  Z{z}
                </button>
              ))}
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Item({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[0.7rem] text-muted-foreground">{k}</dt>
      <dd className={cn("tabular", strong ? "font-semibold" : "font-medium")}>{v}</dd>
    </div>
  );
}

export function BrushBanner() {
  const brush = useApp((s) => s.brushZone);
  const zc = useApp((s) => s.analysis?.zoning.zoneCount ?? 4);
  return (
    <AnimatePresence>
      {brush && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-field-900 py-1.5 pl-3 pr-1.5 text-sm text-white shadow-[var(--shadow-float)]">
          <Brush className="size-4" />
          Painting
          <span className="rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: zoneColor(brush, zc) }}>
            Zone {brush}
          </span>
          <span className="hidden text-white/70 sm:inline">· click or drag on the map</span>
          <Button size="xs" variant="inverse" className="rounded-full" onClick={() => useApp.setState({ brushZone: null })}>
            Done
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
