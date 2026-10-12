"use client";

import { AlertTriangle, CheckCircle2, CircleAlert, HelpCircle, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { NumberTicker } from "@/components/common/number-ticker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePrescription } from "@/hooks/use-prescription";
import { useApp } from "@/store/app-store";
import { zoneColor, zoneLabel } from "@/lib/palette";
import { cn } from "@/lib/utils";

/** Big radial gauge for the field health score. */
export function HealthRing({ score, label }: { score: number; label: string }) {
  const reduce = useReducedMotion();
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = score >= 92 ? "#0072a3" : score >= 85 ? "#2fae8a" : score >= 75 ? "#c4b42f" : "#d6631c";
  return (
    <div className="relative size-[132px] shrink-0">
      <svg viewBox="0 0 132 132" className="size-full -rotate-90" aria-hidden>
        <circle cx="66" cy="66" r={r} fill="none" stroke="#eef0ea" strokeWidth="11" />
        <motion.circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(100, score)) / 100) }}
          transition={{ duration: reduce ? 0 : 1.3, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : 0.25 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-[2.4rem] font-bold leading-none tracking-[-0.02em]" data-testid="health-score">
            <NumberTicker value={score} duration={1.3} />
          </div>
          <div className="mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}

export function SummaryCard() {
  const rx = usePrescription();
  const analysis = useApp((s) => s.analysis);
  const rs = useApp((s) => s.rateSettings);
  if (!rx || !analysis) return null;
  const t = rx.totals;
  const reductionPct = t.flatLbN ? (t.savedLbN / t.flatLbN) * 100 : 0;
  const more = t.usesMoreThanFlat;

  return (
    <section className="overflow-hidden rounded-3xl border bg-white shadow-[var(--shadow-card)]" aria-label="Field summary">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <HealthRing score={rx.health.score} label={rx.health.label} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="font-display text-lg font-semibold">Field health</h2>
            <Popover>
              <PopoverTrigger className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted" aria-label="How the health score is calculated">
                <HelpCircle className="size-4" />
              </PopoverTrigger>
              <PopoverContent className="w-80 text-sm leading-relaxed">
                <p className="font-semibold">What this means</p>
                <p className="mt-1.5 text-muted-foreground">
                  We compare every part of the field to its healthiest part{rx.reference.kind === "strip" ? " (your extra-fertilizer strip)" : ""}. 100 means the whole field looks that healthy.
                </p>

              </PopoverContent>
            </Popover>
          </div>
          <p className="mt-1 text-[0.9rem] leading-relaxed text-muted-foreground">
            On average, the crop is <strong className="font-semibold text-foreground">{Math.round(rx.health.meanSI * 100)}%</strong> as healthy as the best part of this field.
          </p>
          <ConfidenceBar />
        </div>
      </div>

      <div className="grid grid-cols-2 border-t sm:grid-cols-3">
        <Kpi label="Field size" value={t.areaAc} decimals={0} unit="acres" />
        <Kpi label="Average rate" value={t.avgRateLbAc} decimals={0} unit="lb/acre" sub={`usual: ${rs.baseRate}`} />
        <Kpi label="Fertilizer needed" value={t.variableLbN} unit="lb" sub={`usual: ${Math.round(t.flatLbN).toLocaleString()} lb`} />
        <Kpi
          label={more ? "Extra cost" : "Money saved"}
          value={Math.abs(t.savedUsd)}
          prefix="$"
          unit=""
          sub={`${more ? "+" : ""}$${Math.abs(t.savedUsdPerAc).toFixed(2)} per acre`}
          tone={more ? "warn" : "good"}
          testId="kpi-savings"
        />
        <Kpi label={more ? "Extra fertilizer" : "Fertilizer saved"} value={Math.abs(t.savedLbN)} unit="lb" sub={`${Math.abs(reductionPct).toFixed(0)}% ${more ? "more" : "less"}`} tone={more ? "warn" : "blue"} />
        <Kpi label="Zones" value={rx.summaries.filter((z) => z.areaAc > 0).length} unit="" />
      </div>
      {more && (
        <div className="flex items-start gap-2 border-t bg-harvest-50 px-5 py-3 text-sm text-harvest-700" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-semibold">This plan uses more fertilizer than your usual rate.</strong> Lower the extra for weaker zones to save money.
          </span>
        </div>
      )}
    </section>
  );
}

function Kpi({ label, value, unit, decimals = 0, prefix = "", sub, tone, testId }: { label: string; value: number; unit: string; decimals?: number; prefix?: string; sub?: string; tone?: "good" | "warn" | "blue"; testId?: string }) {
  return (
    <div className="border-b border-r px-5 py-4 [&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r sm:[&:nth-child(3n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0 sm:[&:nth-last-child(-n+3)]:border-b-0" data-testid={testId}>
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-display text-[1.6rem] font-bold leading-tight tracking-[-0.02em]", tone === "good" && "text-field-700", tone === "warn" && "text-harvest-700", tone === "blue" && "text-river-600")}>
        <NumberTicker value={value} decimals={decimals} prefix={prefix} />
        {unit && <span className="ml-1 text-[0.8rem] font-medium tracking-normal text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground tabular">{sub}</div>}
    </div>
  );
}

function ConfidenceBar() {
  const rx = usePrescription();
  if (!rx) return null;
  const c = rx.confidence;
  const Icon = c.level === "High" ? ShieldCheck : c.level === "Medium" ? CircleAlert : AlertTriangle;
  const tone = c.level === "High" ? "text-field-700" : c.level === "Medium" ? "text-harvest-700" : "text-destructive";
  return (
    <Popover>
      <PopoverTrigger className="mt-3 flex w-full items-center gap-3 rounded-xl border bg-muted/50 px-3 py-2 text-left transition hover:bg-muted" data-testid="confidence">
        <Icon className={cn("size-4 shrink-0", tone)} />
        <span className="text-sm">
          How sure we are: <strong className={cn("font-semibold", tone)}>{c.level}</strong>
        </span>
        <span className="ml-auto h-1.5 w-20 overflow-hidden rounded-full bg-border" aria-hidden>
          <motion.span className={cn("block h-full rounded-full", c.level === "High" ? "bg-field-600" : c.level === "Medium" ? "bg-harvest-400" : "bg-destructive")} initial={{ width: 0 }} animate={{ width: `${c.score}%` }} transition={{ duration: 1, delay: 0.4 }} />
        </span>
        <span className="text-xs text-muted-foreground tabular">{c.score}/100</span>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <p className="text-sm font-semibold">Why</p>
        <ul className="mt-2 space-y-1.5">
          {c.reasons.map((r) => (
            <li key={r.text} className="flex items-start gap-2 text-sm text-muted-foreground">
              {r.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-field-600" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-harvest-600" />}
              {r.text}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Proportional zone strip: legend + filter. Click a zone to focus it everywhere. */
export function ZoneStrip() {
  const rx = usePrescription();
  const zc = useApp((s) => s.analysis?.zoning.zoneCount ?? 4);
  const filter = useApp((s) => s.zoneFilter);
  const toggle = useApp((s) => s.toggleZoneFilter);
  if (!rx) return null;
  const total = rx.totals.areaAc || 1;
  return (
    <section aria-label="Zones" className="rounded-2xl border bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[1.02rem] font-semibold">Your zones</h3>
        {filter.length > 0 && (
          <button className="text-xs font-medium text-primary underline-offset-2 hover:underline" onClick={() => useApp.setState({ zoneFilter: [] })}>
            Show all zones
          </button>
        )}
      </div>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full" aria-hidden>
        {rx.summaries.map((z) => (
          <motion.div
            key={z.zone}
            initial={{ width: 0 }}
            animate={{ width: `${(z.areaAc / total) * 100}%` }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="h-full border-r-2 border-white last:border-r-0"
            style={{ background: zoneColor(z.zone, zc), opacity: !filter.length || filter.includes(z.zone) ? 1 : 0.25 }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:[grid-template-columns:repeat(var(--zones),minmax(0,1fr))]" style={{ ["--zones" as string]: rx.summaries.length }} role="group" aria-label="Filter zones">
        {rx.summaries.map((z) => {
          const on = !filter.length || filter.includes(z.zone);
          return (
            <button
              key={z.zone}
              type="button"
              aria-pressed={filter.includes(z.zone)}
              onClick={() => toggle(z.zone)}
              className={cn("rounded-xl border px-3 py-2 text-left transition", on ? "bg-white hover:border-field-300" : "bg-muted/40 opacity-60", filter.includes(z.zone) && "border-foreground/40 ring-1 ring-foreground/10")}
              data-testid={`zone-chip-${z.zone}`}
            >
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <span className="size-3 rounded-[4px]" style={{ background: zoneColor(z.zone, zc) }} />Z{z.zone}
                <span className="ml-auto text-xs font-medium text-muted-foreground tabular">{((z.areaAc / total) * 100).toFixed(0)}%</span>
              </div>
              <div className="mt-0.5 truncate text-[0.72rem] text-muted-foreground">{zoneLabel(z.zone, zc)}</div>
              <div className="mt-1 text-sm font-semibold tabular">
                {z.rateLbAc.toFixed(0)} <span className="text-xs font-normal text-muted-foreground">lb/acre</span>
              </div>
              <div className="text-xs text-muted-foreground tabular">
                {z.areaAc.toFixed(0)} acres
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
