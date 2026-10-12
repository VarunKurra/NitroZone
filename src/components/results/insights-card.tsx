"use client";

import { useQuery } from "@tanstack/react-query";
import { Bot, ListChecks, Loader2, MessageSquareText, RefreshCw, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePrescription } from "@/hooks/use-prescription";
import { useApp } from "@/store/app-store";
import { ruleInsights } from "@/lib/agronomy/health";
import { zoneColor, zoneLabel } from "@/lib/palette";
import { cn } from "@/lib/utils";

/** Compact, number-only summary sent to the server (never imagery or location). */
export function useInsightBody(mode: "field" | "zone" = "field", focusZone?: number) {
  const rx = usePrescription();
  const analysis = useApp((s) => s.analysis);
  const fieldName = useApp((s) => s.fieldName);
  const rs = useApp((s) => s.rateSettings);
  return useMemo(() => {
    if (!rx || !analysis) return null;
    const r = (v: number, d = 3) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
    const zc = analysis.zoning.zoneCount;
    return {
      mode,
      focusZone,
      fieldName: fieldName.slice(0, 120) || "Field",
      indexName: rx.names.primary as "NDRE" | "VARI",
      imagery: { source: analysis.scene.source, date: analysis.scene.acquired?.slice(0, 10) ?? null, cloudPct: analysis.scene.sceneCloudPct },
      areaAc: r(rx.totals.areaAc, 1)!,
      baseRate: rs.baseRate,
      pricePerLbN: rs.pricePerLbN,
      healthScore: rx.health.score,
      sufficientSharePct: Math.round(rx.health.sufficientShare * 100),
      variabilityPct: r(rx.health.variability * 100, 1)!,
      referenceKind: rx.reference.kind,
      totals: { flatLbN: Math.round(rx.totals.flatLbN), variableLbN: Math.round(rx.totals.variableLbN), savedLbN: Math.round(rx.totals.savedLbN), savedUsd: Math.round(rx.totals.savedUsd) },
      zones: rx.summaries.map((z) => ({ zone: z.zone, label: zoneLabel(z.zone, zc), areaAc: r(z.areaAc, 1)!, primary: r(z.primary), sufficiency: r(z.sufficiency, 2), rateLbAc: Math.round(z.rateLbAc), totalLbN: Math.round(z.totalLbN) })),
      ruleInsights: ruleInsights(rx.summaries, rx.totals, rx.health, rx.names.primary),
    };
  }, [rx, analysis, fieldName, rs, mode, focusZone]);
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

async function fetchInsights(body: unknown, signal?: AbortSignal) {
  const res = await fetch("/api/insights", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  const json = (await res.json()) as { source: "gemini" | "unavailable"; insights?: string[]; reason?: string };
  return json;
}

/** Latest AI (or rule) insights, shared with the PDF export. */
export const insightsCache: { lines: string[]; source: "gemini" | "rules" } = { lines: [], source: "rules" };

export function InsightsCard() {
  const body = useInsightBody("field");
  const debounced = useDebounced(body, 1200);
  const zc = useApp((s) => s.analysis?.zoning.zoneCount ?? 4);
  const [zone, setZone] = useState<number | null>(null);
  const zoneBody = useInsightBody("zone", zone ?? undefined);

  const q = useQuery({
    queryKey: ["insights", debounced],
    enabled: Boolean(debounced),
    queryFn: ({ signal }) => fetchInsights(debounced, signal),
    staleTime: Infinity,
    retry: false,
  });
  const zq = useQuery({
    queryKey: ["insights-zone", zone, zoneBody?.zones, zoneBody?.totals],
    enabled: zone !== null && Boolean(zoneBody),
    queryFn: ({ signal }) => fetchInsights(zoneBody, signal),
    staleTime: Infinity,
    retry: false,
  });

  const ai = q.data?.source === "gemini" && q.data.insights?.length ? q.data.insights : null;
  const lines = useMemo(() => ai ?? body?.ruleInsights ?? [], [ai, body]);
  useEffect(() => {
    insightsCache.lines = lines;
    insightsCache.source = ai ? "gemini" : "rules";
  }, [lines, ai]);
  const status = q.isFetching ? "loading" : ai ? "ai" : "rules";

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-white via-white to-field-50/70 p-4 shadow-[var(--shadow-soft)] sm:p-5" aria-label="Field insights" data-testid="insights">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-field-900 text-white">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h3 className="font-display text-[1.02rem] font-semibold">Field insights</h3>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {status === "loading" ? "Writing a plain-English summary…" : status === "ai" ? "AI summary (Google Gemini) of the numbers on this page" : q.data?.reason === "not-configured" ? "Rule-based summary (AI not configured)" : "Rule-based summary"}
            </p>
          </div>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={() => q.refetch()} disabled={q.isFetching} aria-label="Refresh insights">
          {q.isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        </Button>
      </div>
      <ul className="mt-4 space-y-2.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {lines.map((l, i) => (
            <motion.li key={`${status}-${i}-${l.slice(0, 24)}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.06 }} className="flex gap-2.5 text-[0.9rem] leading-relaxed">
              {status === "ai" ? <Bot className="mt-1 size-3.5 shrink-0 text-primary" /> : <ListChecks className="mt-1 size-3.5 shrink-0 text-primary" />}
              <span>{l}</span>
            </motion.li>
          ))}
        </AnimatePresence>
        {status === "loading" && !lines.length && [0, 1, 2].map((i) => <li key={i} className="h-4 animate-pulse rounded bg-muted" />)}
      </ul>

      <div className="mt-4 border-t pt-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <MessageSquareText className="size-3.5" /> Explain a zone
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Array.from({ length: zc }, (_, i) => i + 1).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZone(zone === z ? null : z)}
              aria-pressed={zone === z}
              className={cn("flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition", zone === z ? "border-foreground/30 bg-muted" : "bg-white hover:bg-muted")}
              data-testid={`explain-zone-${z}`}
            >
              <span className="size-2.5 rounded-[3px]" style={{ background: zoneColor(z, zc) }} />Z{z}
            </button>
          ))}
        </div>
        <AnimatePresence>
          {zone !== null && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-3 rounded-xl bg-muted/60 p-3 text-[0.88rem] leading-relaxed" aria-live="polite">
                {zq.isFetching ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Explaining zone {zone}…
                  </span>
                ) : zq.data?.source === "gemini" && zq.data.insights?.length ? (
                  zq.data.insights.join(" ")
                ) : (
                  <ZoneFallback zone={zone} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function ZoneFallback({ zone }: { zone: number }) {
  const rx = usePrescription();
  const zc = useApp((s) => s.analysis?.zoning.zoneCount ?? 4);
  const z = rx?.summaries[zone - 1];
  if (!rx || !z) return null;
  const adj = Math.round(z.adjustment * 100);
  return (
    <>
      Zone {zone} ({zoneLabel(zone, zc).toLowerCase()}) covers {z.areaAc.toFixed(1)} ac with an average {rx.names.primary} of {z.primary.toFixed(3)}, which is {Math.round(z.sufficiency * 100)}% of the reference. It gets {z.rateLbAc.toFixed(0)} lb N/ac (
      {adj > 0 ? `+${adj}%` : `${adj}%`} vs your base rate).{" "}
      {z.sufficiency < 0.95 ? "More than 5% below the reference can mean nitrogen stress, but check for wet spots, compaction or stand problems before adding N." : "At or above the reference: this part of the field looks well supplied."}
    </>
  );
}
