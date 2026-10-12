"use client";

/**
 * Read-only view of a shared prescription (snapshot stored in Supabase, or on this device
 * when the database is unavailable). Rebuilds a ReportContext from the snapshot so the
 * PDF and shapefile can be downloaded again with identical numbers.
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, FileText, Loader2, Map as MapIcon, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { SourceBadge } from "@/components/workspace/source-badge";
import { HealthRing } from "@/components/results/summary";
import { getShare } from "@/lib/storage/repo";
import type { SharePayload } from "@/components/results/download-menu";
import { DISCLAIMER, fileStem, shapefileZip, type ReportContext } from "@/lib/export/formats";
import { buildPdf } from "@/lib/export/pdf";
import { loadPdfFonts } from "@/lib/export/pdf-fonts";
import { downloadBlob } from "@/lib/export/bundle";
import { polygonsOf } from "@/lib/agronomy/geo";
import { zoneColor, zoneLabel } from "@/lib/palette";

function toContext(p: SharePayload): ReportContext {
  return {
    fieldName: p.fieldName,
    field: p.field,
    scene: p.scene,
    settings: p.settings,
    zoneCount: p.zoneCount,
    cellSizeM: p.cellSizeM,
    cells: p.cells.map((c, i) => ({
      id: i,
      col: 0,
      row: 0,
      ringsLngLat: [c.g],
      areaAc: c.a,
      center: c.g[0] as [number, number],
      primary: c.p,
      secondary: c.s,
      validFraction: 1,
      filled: false,
      inReference: false,
    })),
    zones: Int8Array.from(p.cells.map((c) => c.z)),
    rates: Float32Array.from(p.cells.map((c) => c.r)),
    reference: p.reference,
    summaries: p.summaries,
    totals: p.totals,
    health: p.health,
    confidence: p.confidence,
    generatedAt: new Date(p.generatedAt),
    insights: p.insights,
    insightsSource: p.insightsSource,
  };
}

export function SharedReport({ slug }: { slug: string }) {
  const q = useQuery({ queryKey: ["share", slug], queryFn: () => getShare(slug), retry: false });
  const [busy, setBusy] = useState<"pdf" | "shp" | null>(null);

  if (q.isLoading)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" aria-label="Loading report" />
      </div>
    );
  const payload = q.data?.payload as SharePayload | undefined;
  if (!payload || payload.v !== 1)
    return (
      <main id="main" className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
        <div>
          <TriangleAlert className="mx-auto size-8 text-harvest-600" />
          <h1 className="mt-4 font-display text-2xl font-bold">Report not found</h1>
          <p className="mt-2 text-muted-foreground">This link may have expired, or it was created while offline and only works on the device that made it.</p>
          <Button asChild className="mt-6" size="lg">
            <Link href="/app">Open NitroZone</Link>
          </Button>
        </div>
      </main>
    );

  const ctx = toContext(payload);
  const t = payload.totals;
  const dl = async (kind: "pdf" | "shp") => {
    setBusy(kind);
    try {
      if (kind === "pdf") downloadBlob(new Blob([buildPdf(ctx, await loadPdfFonts()).output("arraybuffer")], { type: "application/pdf" }), `${fileStem(ctx)}_report.pdf`);
      else downloadBlob(new Blob([await shapefileZip(ctx)], { type: "application/zip" }), `${fileStem(ctx)}_shapefile.zip`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark className="size-8" />
            <span className="font-display text-lg font-bold">
              Nitro<span className="text-primary">Zone</span>
            </span>
          </Link>
          <span className="ml-2 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Shared report · read-only</span>
          <Button asChild variant="outline" className="ml-auto">
            <Link href="/app">
              Make your own <ArrowRight />
            </Link>
          </Button>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary">Variable-rate nitrogen prescription</p>
            <h1 className="mt-1 font-display text-[2.2rem] font-bold tracking-[-0.02em]">{payload.fieldName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <SourceBadge scene={payload.scene} compact />
              <span>Created {new Date(payload.generatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="lg" onClick={() => dl("pdf")} disabled={busy !== null}>
              {busy === "pdf" ? <Loader2 className="animate-spin" /> : <FileText />} PDF report
            </Button>
            <Button size="lg" variant="outline" onClick={() => dl("shp")} disabled={busy !== null}>
              {busy === "shp" ? <Loader2 className="animate-spin" /> : <Download />} Shapefile
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <section className="overflow-hidden rounded-3xl border bg-field-950 p-6" aria-label="Zone map">
            <StaticZoneMap ctx={ctx} />
          </section>
          <div className="space-y-4">
            <section className="flex items-center gap-5 rounded-3xl border bg-white p-6 shadow-[var(--shadow-soft)]">
              <HealthRing score={payload.health.score} label={payload.health.label} />
              <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Stat k="Field area" v={`${t.areaAc.toFixed(1)} ac`} />
                <Stat k="Average rate" v={`${t.avgRateLbAc.toFixed(0)} lb N/ac`} />
                <Stat k="Nitrogen in plan" v={`${Math.round(t.variableLbN).toLocaleString()} lb`} />
                <Stat k={t.usesMoreThanFlat ? "Est. extra cost" : "Est. savings"} v={`$${Math.abs(Math.round(t.savedUsd)).toLocaleString()}`} strong />
              </dl>
            </section>
            <section className="rounded-3xl border bg-white p-6 shadow-[var(--shadow-soft)]" aria-label="Zones">
              <h2 className="font-display text-lg font-semibold">Zones and rates</h2>
              <ul className="mt-3 divide-y">
                {payload.summaries.map((z) => (
                  <li key={z.zone} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="size-3.5 rounded" style={{ background: zoneColor(z.zone, payload.zoneCount) }} />
                    <span className="font-semibold">Z{z.zone}</span>
                    <span className="text-muted-foreground">{zoneLabel(z.zone, payload.zoneCount)}</span>
                    <span className="ml-auto tabular text-muted-foreground">{z.areaAc.toFixed(1)} ac</span>
                    <span className="w-24 text-right font-semibold tabular">{z.rateLbAc.toFixed(0)} lb N/ac</span>
                  </li>
                ))}
              </ul>
            </section>
            {payload.insights.length > 0 && (
              <section className="rounded-3xl border bg-white p-6 shadow-[var(--shadow-soft)]" aria-label="Insights">
                <h2 className="font-display text-lg font-semibold">Field insights</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                  {payload.insights.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
        <p className="mt-8 rounded-2xl bg-harvest-50 px-5 py-4 text-sm leading-relaxed text-harvest-700">{DISCLAIMER}</p>
      </main>
    </div>
  );
}

function Stat({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className={strong ? "font-display text-xl font-bold text-field-700" : "font-semibold tabular"}>{v}</dd>
    </div>
  );
}

/** Vector zone map (no tiles needed), drawn in a local equirectangular projection. */
function StaticZoneMap({ ctx }: { ctx: ReportContext }) {
  const rings = polygonsOf(ctx.field.geometry);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rings)
    for (const [x, y] of r[0]) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const W = (maxX - minX) * k;
  const H = maxY - minY;
  const s = 1000 / Math.max(W, H);
  const P = (p: number[]) => `${((p[0] - minX) * k * s).toFixed(1)},${((maxY - p[1]) * s).toFixed(1)}`;
  return (
    <figure>
      <svg viewBox={`-10 -10 ${W * s + 20} ${H * s + 20}`} className="mx-auto max-h-[560px] w-full" role="img" aria-label="Zone map of the field">
        {ctx.cells.map((c, i) => (
          <path key={i} d={`M${c.ringsLngLat[0].map(P).join("L")}Z`} fill={zoneColor(ctx.zones[i], ctx.zoneCount)} stroke={zoneColor(ctx.zones[i], ctx.zoneCount)} strokeWidth={0.6} />
        ))}
        {rings.map((r, i) => (
          <path key={i} d={`M${r[0].map(P).join("L")}Z`} fill="none" stroke="white" strokeWidth={4} strokeLinejoin="round" />
        ))}
      </svg>
      <figcaption className="mt-4 flex items-center justify-center gap-1.5 text-xs text-white/60">
        <MapIcon className="size-3.5" /> {ctx.cellSizeM} m prescription grid · north up
      </figcaption>
    </figure>
  );
}
