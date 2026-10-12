"use client";

import Image from "next/image";
import { ArrowLeft, Settings2 } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { SourceBadge } from "@/components/workspace/source-badge";
import { useApp } from "@/store/app-store";
import { FieldProfile, NitrogenByZone, SavingsWaterfall, VigorHistogram } from "./charts";
import { DownloadMenu, SaveShareActions } from "./download-menu";
import { InsightsCard } from "./insights-card";
import { SummaryCard, ZoneStrip } from "./summary";
import { ZoneEditor } from "./zone-editor";
import { usePrescription } from "@/hooks/use-prescription";

export function ResultsPanel() {
  const analysis = useApp((s) => s.analysis);
  if (!analysis) return null;
  return (
    <div className="@container mx-auto w-full max-w-[880px] space-y-4 px-4 pb-16 pt-5 sm:px-6" data-testid="results">
      <ResultsHero />

      {analysis.fallbackReason && (
        <div className="rounded-2xl border border-harvest-200 bg-harvest-50 px-4 py-3 text-sm text-harvest-700" role="status">
          {analysis.fallbackReason}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }} className="space-y-4">
        <SummaryCard />
        <ZoneStrip />
      </motion.div>

      <InsightsCard />

      <div className="grid gap-4 @[720px]:grid-cols-2">
        <VigorHistogram />
        <NitrogenByZone />
        <SavingsWaterfall />
        <FieldProfile />
      </div>

      <ZoneEditor />

      <section className="flex flex-col gap-4 rounded-3xl bg-field-900 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h3 className="font-display text-lg font-semibold">Take it to the field</h3>
          <p className="mt-1 text-sm text-white/70">A file for your tractor and a one-page report.</p>
        </div>
        <DownloadMenu size="xl" />
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SaveShareActions />
        <Button variant="ghost" onClick={() => useApp.setState({ step: "imagery" })}>
          <ArrowLeft /> Try a different photo
        </Button>
      </div>
    </div>
  );
}

/** Photo header: the field name and what this plan means, in one sentence. */
function ResultsHero() {
  const analysis = useApp((s) => s.analysis);
  const fieldName = useApp((s) => s.fieldName);
  const rx = usePrescription();
  if (!analysis || !rx) return null;
  const t = rx.totals;
  const line = t.usesMoreThanFlat
    ? `This plan uses ${Math.round(Math.abs(t.savedLbN)).toLocaleString()} lb more fertilizer than usual.`
    : `This plan could save about $${Math.round(t.savedUsd).toLocaleString()} on fertilizer.`;
  return (
    <motion.header
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-3xl bg-field-900"
    >
      <Image src="/images/farmer-in-corn.jpg" alt="" fill priority sizes="(max-width: 1280px) 100vw, 880px" className="object-cover object-[center_35%]" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/5" />
      <div className="relative flex min-h-[188px] flex-col justify-end gap-3 p-6 text-white sm:p-7">
        <div>
          <h1 className="truncate font-display text-[2rem] font-bold leading-tight tracking-[-0.02em]">{fieldName || "Your field"}</h1>
          <p className="mt-1 max-w-md text-[1.05rem] text-white/90" data-testid="results-headline">
            {line}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge scene={analysis.scene} compact />
          <Button size="sm" variant="inverse" className="ml-auto" onClick={() => useApp.setState({ step: "rates" })}>
            <Settings2 /> Change rates
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
