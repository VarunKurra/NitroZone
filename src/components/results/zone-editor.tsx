"use client";

import { Brush, Hand, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useApp } from "@/store/app-store";
import { zoneColor } from "@/lib/palette";
import { cn } from "@/lib/utils";

/**
 * "Review & edit zones": the farmer knows the field better than any satellite.
 * Pick a zone and paint over cells on the map to reassign them. Fully undoable.
 */
export function ZoneEditor() {
  const zc = useApp((s) => s.analysis?.zoning.zoneCount ?? 4);
  const brush = useApp((s) => s.brushZone);
  const edits = useApp((s) => Object.keys(s.overrides).length);
  const canUndo = useApp((s) => s.history.length > 0);
  const canRedo = useApp((s) => s.future.length > 0);
  const { undo, redo, resetEdits } = useApp.getState();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useApp.getState().redo();
        else useApp.getState().undo();
        return;
      }
      if (e.key === "Escape" && useApp.getState().brushZone) useApp.setState({ brushZone: null });
      const n = Number(e.key);
      if (useApp.getState().brushZone && n >= 1 && n <= zc) useApp.setState({ brushZone: n });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zc]);

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5" aria-label="Review and edit zones">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[1.02rem] font-semibold">Review &amp; edit zones</h3>
          <p className="mt-1 text-[0.84rem] leading-snug text-muted-foreground">
            Know a wet spot, a waterway or an old fence line? Pick a zone, then click or drag over cells on the map to reassign them.
          </p>
        </div>
        {edits > 0 && <span className="shrink-0 rounded-full bg-harvest-50 px-2 py-0.5 text-xs font-semibold text-harvest-700 tabular">{edits} edited</span>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Paint brush zone">
        <button
          type="button"
          role="radio"
          aria-checked={brush === null}
          onClick={() => useApp.setState({ brushZone: null })}
          className={cn("flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition", brush === null ? "border-foreground/30 bg-muted" : "bg-white hover:bg-muted")}
        >
          <Hand className="size-4" /> Inspect
        </button>
        {Array.from({ length: zc }, (_, i) => i + 1).map((z) => (
          <button
            key={z}
            type="button"
            role="radio"
            aria-checked={brush === z}
            aria-label={`Paint zone ${z}`}
            onClick={() => useApp.setState({ brushZone: z, inspectedCell: null })}
            className={cn("flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition", brush === z ? "border-transparent text-white shadow-md" : "bg-white hover:bg-muted")}
            style={brush === z ? { background: zoneColor(z, zc) } : undefined}
            data-testid={`brush-${z}`}
          >
            {brush !== z && <span className="size-3 rounded-[4px]" style={{ background: zoneColor(z, zc) }} />}
            {brush === z && <Brush className="size-3.5" />}Z{z}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="outline" onClick={undo} disabled={!canUndo} data-testid="undo">
          <Undo2 /> Undo
        </Button>
        <Button size="sm" variant="outline" onClick={redo} disabled={!canRedo}>
          <Redo2 /> Redo
        </Button>
        <Button size="sm" variant="ghost" onClick={resetEdits} disabled={!edits}>
          <RotateCcw /> Reset to computed zones
        </Button>
        <span className="ml-auto hidden text-xs text-muted-foreground lg:inline" data-dev-only>
          <Kbd>1</Kbd>–<Kbd>{zc}</Kbd> brush · <Kbd>Esc</Kbd> stop · <Kbd>⌘Z</Kbd> undo
        </span>
      </div>
    </section>
  );
}
