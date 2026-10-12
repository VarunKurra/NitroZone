"use client";

import { Calculator } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { usePrescription } from "@/hooks/use-prescription";
import { useApp } from "@/store/app-store";

/** "Show your work": every formula behind the numbers, with the farmer's own values plugged in. */
export function MethodCard() {
  const rx = usePrescription();
  const rs = useApp((s) => s.rateSettings);
  const scene = useApp((s) => s.analysis?.scene);
  if (!rx || !scene) return null;
  const t = rx.totals;
  const isS2 = scene.sensor === "sentinel2";
  const f = (v: number) => Math.round(v).toLocaleString("en-US");
  return (
    <section className="rounded-2xl border bg-white px-4 shadow-[var(--shadow-soft)] sm:px-5" aria-label="How the numbers are calculated">
      <Accordion type="single" collapsible defaultValue="savings">
        <div className="flex items-center gap-2 pt-4">
          <Calculator className="size-4 text-primary" />
          <h3 className="font-display text-[1.02rem] font-semibold">How these numbers are calculated</h3>
        </div>
        <AccordionItem value="savings">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">Savings estimate</AccordionTrigger>
          <AccordionContent className="space-y-2 text-sm">
            <Formula>savings = (flat total − variable total) × N price</Formula>
            <Formula>
              = ({f(t.flatLbN)} lb − {f(t.variableLbN)} lb) × ${rs.pricePerLbN.toFixed(2)}/lb = <strong>{t.savedUsd < 0 ? "−" : ""}${f(Math.abs(t.savedUsd))}</strong>
            </Formula>
            <p className="text-muted-foreground">Fertilizer cost only. Doesn&apos;t include yield response, application cost or equipment. Treat it as an estimate.</p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="rate">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">Zone rates</AccordionTrigger>
          <AccordionContent className="space-y-2 text-sm">
            <Formula>zone rate = base rate × (1 + zone adjustment)</Formula>
            {rx.summaries.map((z) => (
              <Formula key={z.zone}>
                Z{z.zone}: {rs.baseRate} × (1 {z.adjustment >= 0 ? "+" : "−"} {Math.abs(z.adjustment).toFixed(2)}) = <strong>{z.rateLbAc.toFixed(0)} lb N/ac</strong>
                {z.adjustment <= -1 ? " (no application)" : ""}
              </Formula>
            ))}
            <p className="text-muted-foreground">
              Rates are limited to your applicator range ({rs.minRate}–{rs.maxRate} lb N/ac). Totals use each grid cell&apos;s exact area inside your boundary.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="index">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">Vegetation indices &amp; zones</AccordionTrigger>
          <AccordionContent className="space-y-2 text-sm">
            {isS2 ? (
              <>
                <Formula>NDRE = (B8 − B5) / (B8 + B5)   red edge, nitrogen-sensitive</Formula>
                <Formula>NDVI = (B8 − B4) / (B8 + B4)   general greenness</Formula>
                <p className="text-muted-foreground">Sentinel-2 L2A surface reflectance. Pixels flagged as cloud, cloud shadow, cirrus, snow or no data in the Scene Classification (SCL) band are removed. Masked cells borrow the average of their neighbours and are marked &ldquo;estimated&rdquo;.</p>
              </>
            ) : (
              <>
                <Formula>VARI = (G − R) / (G + R − B)</Formula>
                <Formula>ExG = 2g − r − b   (on chromatic coordinates r = R/(R+G+B), …)</Formula>
              </>
            )}
            <Formula>SI = zone {rx.names.primary} ÷ reference {rx.names.primary} ({rx.reference.value.toFixed(3)})</Formula>
            <p className="text-muted-foreground">
              Zones come from k-means clustering of each grid cell&apos;s {rx.names.primary} (main weight) and {rx.names.secondary}, ranked so Zone 1 is the least vigorous. A 3 × 3 majority filter removes speckle and patches smaller than your minimum are merged into the neighbour they share the longest border with.
            </p>
            <p className="rounded-lg bg-harvest-50 px-3 py-2 text-harvest-700">
              Vegetation indices are a stress proxy, not a nitrogen test. Low vigor can also come from water stress, disease, compaction or poor stand. Scout low zones before applying extra N.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-muted/70 px-3 py-2 font-mono text-[0.8rem] leading-relaxed tabular">{children}</p>;
}
