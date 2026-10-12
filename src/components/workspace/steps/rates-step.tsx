"use client";

import { AlertTriangle, ArrowLeft, Ban, Info, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NumberTicker } from "@/components/common/number-ticker";
import { PanelSection, StepHeader } from "@/components/workspace/panel-parts";
import { SliderRow, ZoningSettings } from "@/components/workspace/steps/imagery-step";
import { SourceBadge } from "@/components/workspace/source-badge";
import { usePrescription } from "@/hooks/use-prescription";
import { useApp } from "@/store/app-store";
import { DEFAULT_ADJUSTMENTS, suggestAdjustmentsFromSI } from "@/lib/agronomy/rates";
import { zoneColor, zoneLabel } from "@/lib/palette";
import { cn } from "@/lib/utils";

export function RatesStep() {
  const rx = usePrescription();
  const analysis = useApp((s) => s.analysis);
  const rs = useApp((s) => s.rateSettings);
  const setRate = useApp((s) => s.setRateSettings);
  const setAdj = useApp((s) => s.setAdjustment);
  const zoneCount = analysis?.zoning.zoneCount ?? 4;
  if (!analysis || !rx) return null;
  const t = rx.totals;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5 scrollbar-thin">
        <StepHeader index={3} title="Set your fertilizer rates" description="Start with the rate you would normally use. Each zone gets a little more or a little less. Every number updates as you go." />

        <SourceBadge scene={analysis.scene} fallbackReason={analysis.fallbackReason} clearFraction={analysis.clearFraction} />

        <PanelSection title="Base plan">
          <div className="space-y-5 rounded-2xl border bg-white p-4">
            <NumberSliderRow label="Flat sidedress rate" value={rs.baseRate} min={30} max={250} step={5} unit="lb N/ac" onChange={(v) => setRate({ baseRate: v })} />
            <NumberSliderRow
              label="Nitrogen price"
              value={rs.pricePerLbN}
              min={0.2}
              max={1.6}
              step={0.01}
              unit="$/lb N"
              decimals={2}
              onChange={(v) => setRate({ pricePerLbN: v })}
              hint={
                <>
                  Default $0.75: DTN retail average for UAN32, last week of Sept 2026.{" "}
                  <a className="underline underline-offset-2" href="https://www.dtnpf.com/agriculture/web/ag/crops/article/2026/10/07/uan32-leads-fertilizer-prices-higher" target="_blank" rel="noreferrer">
                    Source
                  </a>
                </>
              }
            />
          </div>
        </PanelSection>

        <PanelSection
          title="Zone adjustments"
          aside={
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="xs" variant="ghost" onClick={() => setRate({ adjustments: suggestAdjustmentsFromSI(rx.summaries) })}>
                    <Wand2 /> From SI
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  Suggest adjustments from each zone&apos;s sufficiency index: adjustment = 3 × (0.95 − SI), capped at ±40%. A transparent starting point, not a published calibration.
                </TooltipContent>
              </Tooltip>
              <Button size="xs" variant="ghost" onClick={() => setRate({ adjustments: [...DEFAULT_ADJUSTMENTS[zoneCount as 3 | 4 | 5]] })} aria-label="Reset adjustments to defaults">
                <RotateCcw />
              </Button>
            </div>
          }
        >
          <ul className="space-y-2.5">
            {rx.summaries.map((z) => {
              const adj = rs.adjustments[z.zone - 1] ?? 0;
              const off = adj <= -1;
              return (
                <li key={z.zone} className={cn("rounded-2xl border bg-white p-3.5 transition", off && "bg-muted/60")}>
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold text-white shadow-sm" style={{ background: zoneColor(z.zone, zoneCount) }}>
                      Z{z.zone}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{zoneLabel(z.zone, zoneCount)}</div>
                      <div className="text-xs text-muted-foreground tabular">
                        {z.areaAc.toFixed(1)} ac · {rx.names.primary} {z.primary.toFixed(3)} · SI {z.sufficiency.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-xl font-bold tabular" data-testid={`zone-rate-${z.zone}`}>
                        {z.rateLbAc.toFixed(0)}
                      </div>
                      <div className="text-[0.68rem] text-muted-foreground">lb N/ac</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Slider
                      value={[off ? -0.5 : adj]}
                      min={-0.5}
                      max={0.5}
                      step={0.01}
                      disabled={off}
                      onValueChange={([v]) => setAdj(z.zone, Math.round(v * 100) / 100)}
                      aria-label={`Zone ${z.zone} adjustment`}
                      aria-valuetext={`${Math.round(adj * 100)} percent`}
                    />
                    <span className={cn("w-12 text-right text-sm font-semibold tabular", adj > 0 ? "text-harvest-700" : adj < 0 ? "text-river-600" : "text-muted-foreground")}>
                      {off ? "off" : `${adj > 0 ? "+" : ""}${Math.round(adj * 100)}%`}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant={off ? "secondary" : "ghost"}
                          aria-pressed={off}
                          aria-label={off ? `Re-enable nitrogen in zone ${z.zone}` : `No nitrogen in zone ${z.zone}`}
                          onClick={() => setAdj(z.zone, off ? (DEFAULT_ADJUSTMENTS[zoneCount as 3 | 4 | 5][z.zone - 1] ?? 0) : -1)}
                        >
                          <Ban />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{off ? "Apply nitrogen again" : "No application (waterway, non-crop area)"}</TooltipContent>
                    </Tooltip>
                  </div>
                </li>
              );
            })}
          </ul>
        </PanelSection>

        <Accordion type="multiple" className="rounded-xl border bg-white px-3">
          <AccordionItem value="range">
            <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">Applicator rate limits</AccordionTrigger>
            <AccordionContent className="grid grid-cols-2 gap-3 pb-4">
              {(["minRate", "maxRate"] as const).map((k) => (
                <div key={k} className="space-y-1.5">
                  <Label htmlFor={k} className="text-xs text-muted-foreground">
                    {k === "minRate" ? "Minimum" : "Maximum"} (lb N/ac)
                  </Label>
                  <Input id={k} type="number" inputMode="numeric" min={0} max={400} value={rs[k]} onChange={(e) => setRate({ [k]: Math.max(0, Math.min(400, Number(e.target.value) || 0)) })} className="h-9 tabular" />
                </div>
              ))}
              <p className="col-span-2 text-xs text-muted-foreground">Zone rates are clamped to this range so the controller never gets a rate it can&apos;t apply.</p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="zoning" className="border-none">
            <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">Zoning settings</AccordionTrigger>
            <AccordionContent className="space-y-5 pb-4">
              <ZoningSettings />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="border-t bg-white/90 px-5 pb-4 pt-3">
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <MiniStat label="Variable" value={t.variableLbN} unit="lb N" />
          <MiniStat label="Flat" value={t.flatLbN} unit="lb N" />
          <div className={cn("rounded-xl px-2 py-1.5", t.usesMoreThanFlat ? "bg-harvest-50" : "bg-field-50")}>
            <div className="text-[0.66rem] font-semibold uppercase tracking-wide text-muted-foreground">Est. savings</div>
            <div className={cn("font-display text-[1.05rem] font-bold", t.usesMoreThanFlat ? "text-harvest-700" : "text-field-700")}>
              <NumberTicker value={t.savedUsd} prefix={t.savedUsd < 0 ? "-$" : "$"} className="" />
            </div>
          </div>
        </div>
        {t.usesMoreThanFlat && (
          <p className="mb-3 flex items-start gap-2 rounded-lg bg-harvest-50 px-3 py-2 text-xs font-medium text-harvest-700" role="status">
            <AlertTriangle className="mt-px size-3.5 shrink-0" /> This plan uses {Math.abs(t.savedLbN).toFixed(0)} lb MORE nitrogen than the flat rate.
          </p>
        )}
        <div className="flex gap-2">
          <Button size="xl" variant="outline" onClick={() => useApp.setState({ step: "imagery" })} aria-label="Back to imagery">
            <ArrowLeft />
          </Button>
          <Button size="xl" className="flex-1" onClick={() => useApp.setState({ step: "results", generated: true, mapLayer: "zones" })} data-testid="generate">
            <Sparkles /> Generate prescription
          </Button>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl bg-muted px-2 py-1.5">
      <div className="text-[0.66rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-display text-[1.05rem] font-bold">
        <NumberTicker value={value} />
        <span className="ml-0.5 text-[0.65rem] font-medium text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function NumberSliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  decimals = 0,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  decimals?: number;
  hint?: React.ReactNode;
}) {
  const id = label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <div className="flex items-center gap-1.5">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            value={Number(value.toFixed(decimals))}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
            className="h-9 w-20 text-right font-semibold tabular"
          />
          <span className="w-14 text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} aria-label={label} />
      {hint && (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-px size-3 shrink-0" />
          <span>{hint}</span>
        </p>
      )}
    </div>
  );
}

export { SliderRow };
