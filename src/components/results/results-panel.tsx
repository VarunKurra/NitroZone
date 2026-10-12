"use client";

import { ArrowLeft, Settings2 } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { SourceBadge } from "@/components/workspace/source-badge";
import { useApp } from "@/store/app-store";
import { FieldProfile, NitrogenByZone, SavingsWaterfall, VigorHistogram, VigorScatter } from "./charts";
import { DownloadMenu, SaveShareActions } from "./download-menu";
import { InsightsCard } from "./insights-card";
import { MethodCard } from "./method-card";
import { SummaryCard, ZoneStrip } from "./summary";
import { ZoneEditor } from "./zone-editor";
import { ZoneTable } from "./zone-table";

export function ResultsPanel() {
  const analysis = useApp((s) => s.analysis);
  const fieldName = useApp((s) => s.fieldName);
  if (!analysis) return null;
  return (
    <div className="@container mx-auto w-full max-w-[880px] space-y-4 px-4 pb-16 pt-5 sm:px-6" data-testid="results">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary">Step 4 of 4 · Prescription ready</p>
          <h1 className="mt-1 truncate font-display text-[1.9rem] font-bold leading-tight tracking-[-0.025em]">{fieldName || "Your field"}</h1>
          <div className="mt-2">
            <SourceBadge scene={analysis.scene} compact />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => useApp.setState({ step: "rates" })}>
            <Settings2 /> Adjust rates
          </Button>
        </div>
      </motion.header>

      {analysis.fallbackReason && (
        <div className="rounded-2xl border border-harvest-200 bg-harvest-50 px-4 py-3 text-sm text-harvest-700" role="status">
          <strong className="font-semibold">Fallback imagery in use.</strong> {analysis.fallbackReason}
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
        <div className="@[720px]:col-span-2">
          <VigorScatter />
        </div>
      </div>

      <ZoneEditor />
      <ZoneTable />
      <MethodCard />

      <section className="flex flex-col gap-4 rounded-3xl bg-field-900 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h3 className="font-display text-lg font-semibold">Ready for the field</h3>
          <p className="mt-1 text-sm text-white/70">Shapefile for your controller, plus GeoJSON, KML, CSV and a one-page PDF report.</p>
        </div>
        <DownloadMenu size="xl" />
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SaveShareActions />
        <Button variant="ghost" onClick={() => useApp.setState({ step: "imagery" })}>
          <ArrowLeft /> Analyze a different image
        </Button>
      </div>
    </div>
  );
}
