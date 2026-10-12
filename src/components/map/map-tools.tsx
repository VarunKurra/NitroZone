"use client";

import { Hand, PenLine } from "lucide-react";
import { useApp } from "@/store/app-store";
import { cn } from "@/lib/utils";

/**
 * Step 1 map tools: "Outline field" (on by default) and "Move map".
 * Shared by both map renderers. Dragging the map also pans while outlining.
 */
export function MapTools() {
  const step = useApp((s) => s.step);
  const drawMode = useApp((s) => s.drawMode);
  const field = useApp((s) => s.field);
  if (step !== "field" || field) return null;
  const outlining = drawMode === "draw-field";
  return (
    <div
      data-ui
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute top-3 z-10 flex items-center gap-0.5 rounded-xl bg-white/95 p-1 shadow-[var(--shadow-float)] ring-1 ring-black/5 max-lg:left-1/2 max-lg:-translate-x-1/2 lg:left-[calc(min(420px,46vw)+28px)]"
      role="radiogroup"
      aria-label="Map tool"
    >
      <button
        type="button"
        role="radio"
        aria-checked={outlining}
        onClick={() => useApp.setState({ drawMode: "draw-field" })}
        className={cn("flex h-8 items-center gap-1.5 rounded-lg px-3 text-[0.82rem] font-medium transition", outlining ? "bg-field-800 text-white" : "text-foreground/80 hover:bg-black/5")}
        data-testid="tool-outline"
      >
        <PenLine className="size-3.5" /> Outline field
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={!outlining}
        onClick={() => useApp.setState({ drawMode: "pan" })}
        className={cn("flex h-8 items-center gap-1.5 rounded-lg px-3 text-[0.82rem] font-medium transition", !outlining ? "bg-field-800 text-white" : "text-foreground/80 hover:bg-black/5")}
      >
        <Hand className="size-3.5" /> Move map
      </button>
    </div>
  );
}
