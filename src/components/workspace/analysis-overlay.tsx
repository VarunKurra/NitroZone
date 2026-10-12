"use client";

import { Check, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/store/app-store";
import type { ProgressStep } from "@/lib/worker/protocol";
import { cn } from "@/lib/utils";

const STEPS: { key: ProgressStep; label: string }[] = [
  { key: "search", label: "Getting ready" },
  { key: "download", label: "Downloading the satellite photo" },
  { key: "mask", label: "Removing clouds" },
  { key: "indices", label: "Measuring crop health" },
  { key: "grid", label: "Splitting the field into squares" },
  { key: "zones", label: "Grouping into zones" },
];

/** Full-map "satellite scan" while analysis runs: sweeping scan line + live step list. */
export function AnalysisOverlay() {
  const status = useApp((s) => s.status);
  const progress = useApp((s) => s.progress);
  const error = useApp((s) => s.error);
  const step = useApp((s) => s.step);
  const reached = new Set(progress.map((p) => p.step));
  const lastIdx = Math.max(-1, ...STEPS.map((s, i) => (reached.has(s.key) ? i : -1)));
  const latest = progress[progress.length - 1];
  const show = status === "running" || (status === "error" && step === "imagery");

  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }} className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-live="polite" data-testid="analysis-overlay">
          <div className="absolute inset-0 bg-field-950/35" />
          {status === "running" && (
            <>
              <div className="absolute inset-0 bg-grid opacity-40 mix-blend-overlay" />
              <div className="absolute inset-x-0 top-0 h-1/3 animate-scan bg-gradient-to-b from-transparent via-field-300/25 to-transparent">
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-field-200 to-transparent shadow-[0_0_24px_4px_rgba(149,198,162,0.7)]" />
              </div>
            </>
          )}
          <div className="absolute inset-0 grid place-items-center p-6">
            <motion.div initial={{ y: 12, scale: 0.98 }} animate={{ y: 0, scale: 1 }} className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white/95 p-5 shadow-[var(--shadow-float)] ring-1 ring-black/5 backdrop-blur">
              {status === "error" ? (
                <>
                  <div className="flex items-center gap-2 font-semibold text-destructive">
                    <X className="size-4" /> Analysis failed
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                  <Button className="mt-4 w-full" variant="outline" onClick={() => useApp.setState({ status: "idle", error: null })}>
                    Back to settings
                  </Button>
                </>
              ) : (
                <>
                  <div className="font-display text-lg font-semibold">Checking your field</div>
                  <p className="mt-0.5 min-h-5 text-sm text-muted-foreground">{latest?.message}</p>
                  <ol className="mt-4 space-y-2.5">
                    {STEPS.map((s, i) => {
                      const done = i < lastIdx;
                      const active = i === lastIdx;
                      return (
                        <li key={s.key} className={cn("flex items-center gap-2.5 text-sm transition-colors", done || active ? "text-foreground" : "text-muted-foreground/60")}>
                          <span className={cn("grid size-5 place-items-center rounded-full border transition", done && "border-primary bg-primary text-white", active && "border-primary")}>
                            {done ? <Check className="size-3" /> : active ? <Loader2 className="size-3 animate-spin text-primary" /> : null}
                          </span>
                          {s.label}
                        </li>
                      );
                    })}
                  </ol>
                </>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
