"use client";

/**
 * The app workspace: top bar + map + step panel. On the Results step the layout becomes a
 * split view (map | analytics) on wide screens and a stacked view on tablets.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Presentation, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LogoMark } from "@/components/brand/logo";
import { useApp, type Step } from "@/store/app-store";
import { FieldStep, loadDemoField } from "./steps/field-step";
import { ImageryStep } from "./steps/imagery-step";
import { RatesStep } from "./steps/rates-step";
import { AnalysisOverlay } from "./analysis-overlay";
import { rezone, runAnalysis } from "./run-analysis";
import { ResultsPanel } from "@/components/results/results-panel";
import { BrushBanner, CellInspector, LayerSwitcher, MapLegend } from "@/components/results/map-overlays";
import { DownloadMenu } from "@/components/results/download-menu";
import { cn } from "@/lib/utils";

const FieldMap = dynamic(() => import("@/components/map/field-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-field-950">
      <div className="h-full w-full animate-pulse bg-gradient-to-br from-field-900 to-field-950" />
    </div>
  ),
});

const STEPS: { key: Step; label: string }[] = [
  { key: "field", label: "Field" },
  { key: "imagery", label: "Imagery" },
  { key: "rates", label: "Rates" },
  { key: "results", label: "Results" },
];

export function Workspace() {
  const step = useApp((s) => s.step);
  const presentation = useApp((s) => s.presentation);
  const params = useSearchParams();
  const boot = useRef(false);

  // URL flags: ?demo=1 loads the demo field, ?present=1 starts presentation mode (demo + bigger type).
  useEffect(() => {
    if (boot.current) return;
    boot.current = true;
    const present = params.get("present") === "1";
    if (present) useApp.setState({ presentation: true });
    if (present || params.get("demo") === "1") loadDemoField();
    if (params.get("autorun") === "1" || present) {
      // presentation: go straight to imagery so the demo flow is one click per step
      useApp.setState({ step: "imagery" });
    }
  }, [params]);

  useEffect(() => {
    document.documentElement.classList.toggle("present", presentation);
    return () => document.documentElement.classList.remove("present");
  }, [presentation]);

  useAutoRezone();

  // Global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable], [role=slider]")) return;
      if (e.key === "Escape") {
        const st = useApp.getState();
        if (st.drawMode !== "idle") useApp.setState({ drawMode: "idle" });
      }
      if (e.key.toLowerCase() === "p" && !e.metaKey && !e.ctrlKey && !e.altKey) togglePresentation();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = step === "results";
  return (
    <div className="flex h-dvh flex-col bg-background">
      <TopBar />
      <main id="main" className={cn("relative min-h-0 flex-1", results ? "overflow-y-auto xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(560px,46%)] xl:overflow-hidden" : "")}>
        {/* Map */}
        <div className={cn("relative", results ? "h-[56vh] min-h-[420px] xl:sticky xl:top-0 xl:h-full" : "absolute inset-0")}>
          <FieldMap />
          <AnalysisOverlay />
          {(step === "rates" || results) && (
            <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start justify-between gap-2" style={!results ? { left: "calc(min(420px, 46vw) + 24px)" } : undefined}>
              <LayerSwitcher />
            </div>
          )}
          {(step === "rates" || results) && (
            <div className="pointer-events-none absolute bottom-8 left-3 z-10" style={!results ? { left: "calc(min(420px, 46vw) + 24px)" } : undefined}>
              <MapLegend />
            </div>
          )}
          <div className="pointer-events-none absolute right-14 top-3 z-10">
            <CellInspector />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-10 z-10 flex justify-center">
            <BrushBanner />
          </div>
        </div>

        {/* Step panel / results */}
        {results ? (
          <div className="relative bg-background xl:h-full xl:overflow-y-auto xl:border-l xl:scrollbar-thin">
            <ResultsPanel />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.aside
              key={step}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10, transition: { duration: 0.15 } }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-3 left-3 top-3 z-20 w-[min(420px,46vw)] min-w-[340px] overflow-hidden rounded-3xl border bg-white/97 shadow-[var(--shadow-float)] backdrop-blur"
              aria-label={`Step: ${step}`}
            >
              {step === "field" && <FieldStep />}
              {step === "imagery" && <ImageryStep />}
              {step === "rates" && <RatesStep />}
            </motion.aside>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}

function togglePresentation() {
  const st = useApp.getState();
  const next = !st.presentation;
  useApp.setState({ presentation: next });
  if (next && !st.field) {
    loadDemoField();
    useApp.setState({ step: "imagery" });
  }
}

function TopBar() {
  const step = useApp((s) => s.step);
  const field = useApp((s) => s.field);
  const analysis = useApp((s) => s.analysis);
  const generated = useApp((s) => s.generated);
  const presentation = useApp((s) => s.presentation);
  const reachable: Record<Step, boolean> = { field: true, imagery: Boolean(field), rates: Boolean(analysis), results: Boolean(analysis && generated) };
  const idx = STEPS.findIndex((s) => s.key === step);
  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-white/90 px-3 backdrop-blur sm:px-4">
      <Link href="/" className="flex items-center gap-2 rounded-lg pr-1" aria-label="NitroZone home">
        <LogoMark className="size-8" />
        <span className="hidden font-display text-[1.1rem] font-bold tracking-[-0.02em] md:inline">
          Nitro<span className="text-primary">Zone</span>
        </span>
      </Link>
      <nav aria-label="Steps" className="mx-auto">
        <ol className="flex items-center gap-1 rounded-full bg-muted p-1">
          {STEPS.map((s, i) => {
            const active = s.key === step;
            const done = i < idx;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  disabled={!reachable[s.key]}
                  aria-current={active ? "step" : undefined}
                  onClick={() => useApp.setState({ step: s.key, drawMode: "idle" })}
                  className={cn("relative flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.82rem] font-medium transition disabled:cursor-not-allowed disabled:opacity-45", active ? "text-white" : "text-foreground/75 hover:text-foreground")}
                >
                  {active && <motion.span layoutId="step-pill" className="absolute inset-0 rounded-full bg-field-800 shadow-sm" transition={{ type: "spring", bounce: 0.15, duration: 0.5 }} />}
                  <span className={cn("relative grid size-[18px] place-items-center rounded-full text-[0.65rem] font-bold", active ? "bg-white/20" : done ? "bg-primary text-white" : "bg-white")}>
                    {done ? <Check className="size-3" /> : i + 1}
                  </span>
                  <span className="relative hidden sm:inline">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={presentation ? "secondary" : "ghost"} size="icon" onClick={togglePresentation} aria-pressed={presentation} aria-label={presentation ? "Exit presentation mode" : "Presentation mode"} data-testid="present-toggle">
              {presentation ? <X /> : <Presentation />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{presentation ? "Exit presentation mode (P)" : "Presentation mode (P): demo field, bigger type"}</TooltipContent>
        </Tooltip>
        {step === "results" && <DownloadMenu size="default" className="hidden md:flex" />}
      </div>
    </header>
  );
}

/** When zoning settings or the reference strip change after an analysis, re-zone automatically. */
function useAutoRezone() {
  const settings = useApp((s) => s.analysisSettings);
  const reference = useApp((s) => s.reference);
  const hasAnalysis = useApp((s) => Boolean(s.analysis));
  const last = useRef<string | null>(null);
  useEffect(() => {
    const key = JSON.stringify([settings, reference?.geometry ?? null]);
    if (!hasAnalysis) {
      last.current = key;
      return;
    }
    if (last.current === null) {
      last.current = key;
      return;
    }
    if (key === last.current) return;
    last.current = key;
    const t = setTimeout(() => {
      if (useApp.getState().status !== "running") void rezone();
    }, 450);
    return () => clearTimeout(t);
  }, [settings, reference, hasAnalysis]);
}

export { runAnalysis };
