"use client";

import { useQuery } from "@tanstack/react-query";
import { Bot, ListChecks, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePrescription } from "@/hooks/use-prescription";
import { useApp } from "@/store/app-store";
import { ruleInsights } from "@/lib/agronomy/health";
import { zoneLabel } from "@/lib/palette";

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

  const q = useQuery({
    queryKey: ["insights", debounced],
    enabled: Boolean(debounced),
    queryFn: ({ signal }) => fetchInsights(debounced, signal),
    staleTime: Infinity,
    retry: false,
  });

  const ai = q.data?.source === "gemini" && q.data.insights?.length ? q.data.insights : null;
  const lines = useMemo(() => (ai ?? body?.ruleInsights ?? []).slice(0, 3), [ai, body]);
  useEffect(() => {
    insightsCache.lines = lines;
    insightsCache.source = ai ? "gemini" : "rules";
  }, [lines, ai]);
  const status = q.isFetching ? "loading" : ai ? "ai" : "rules";

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-white via-white to-river-50 p-4 shadow-[var(--shadow-soft)] sm:p-5" aria-label="Field insights" data-testid="insights">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-river-600 text-white">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h3 className="font-display text-[1.02rem] font-semibold">Quick summary</h3>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {status === "loading" ? "Writing a summary…" : status === "ai" ? "Written with AI" : "Based on your numbers"}
            </p>
          </div>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={() => q.refetch()} disabled={q.isFetching} aria-label="Refresh insights">
          {q.isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        </Button>
      </div>
      <ul className="mt-4 space-y-2.5">
        {/* new lines replace old ones instantly (no exit animation), so two sets never overlap */}
        {lines.map((l, i) => (
          <motion.li key={`${status}-${i}-${l.slice(0, 24)}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="flex gap-2.5 text-[0.9rem] leading-relaxed">
            {status === "ai" ? <Bot className="mt-1 size-3.5 shrink-0 text-primary" /> : <ListChecks className="mt-1 size-3.5 shrink-0 text-primary" />}
            <span>{l}</span>
          </motion.li>
        ))}
        {status === "loading" && !lines.length && [0, 1, 2].map((i) => <li key={i} className="h-4 animate-pulse rounded bg-muted" />)}
      </ul>

    </section>
  );
}

